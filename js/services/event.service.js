// Lưu trữ sự kiện timeline, thứ tự hàng và danh sách đã xoá (tombstone).

import { S } from '../state/store.js';
import { MS_PER_DAY } from '../core/constants.js';
import { toDateTimeLocalString } from '../core/date-utils.js';
import { getOccurrenceEnd } from '../core/recurrence.js';
import { getCleanUserEmail, getCurrentUser } from './auth.service.js';
import { scheduleCloudPush } from './sync.service.js';

export function getTimelineStorageKey() {
    const user = getCurrentUser();
    return user ? ('timeline_events_user_' + encodeURIComponent(user.id)) : 'timeline_events_guest';
}

export function getTrackOrderStorageKey() {
    const user = getCurrentUser();
    return user ? ('timeline_track_order_' + encodeURIComponent(user.id)) : 'timeline_track_order_guest';
}

export function getDeletedTimelineIds() {
    try {
        const raw = localStorage.getItem(`timeline_deleted_ids_${getCleanUserEmail()}`);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return new Set(arr);
        }
    } catch (e) { }
    return new Set();
}

export function recordDeletedTimelineIds(idOrIds) {
    const set = getDeletedTimelineIds();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    ids.forEach(id => { if (id) set.add(id); });
    const arr = Array.from(set).slice(-500);
    try {
        localStorage.setItem(`timeline_deleted_ids_${getCleanUserEmail()}`, JSON.stringify(arr));
    } catch (e) { }
    return set;
}

export function unmarkTimelineEventDeleted(id) {
    const set = getDeletedTimelineIds();
    if (set.has(id)) {
        set.delete(id);
        try {
            localStorage.setItem(`timeline_deleted_ids_${getCleanUserEmail()}`, JSON.stringify(Array.from(set)));
        } catch (e) { }
    }
}

// Đọc danh sách sự kiện từ LocalStorage (chỉ lấy sự kiện do người dùng tự thêm theo tài khoản riêng)
export function loadEvents() {
    if (S.cachedEventsMemory) {
        return S.cachedEventsMemory;
    }

    let events = [];
    try {
        const storageKey = getTimelineStorageKey();
        let raw = localStorage.getItem(storageKey);
        const user = getCurrentUser();
        // Nếu người dùng đầu tiên đăng nhập chưa có sự kiện riêng, chuyển sự kiện có sẵn sang tài khoản này
        if (!raw && user && !localStorage.getItem('legacy_events_migrated')) {
            const legacy = localStorage.getItem('timeline_events_v8');
            if (legacy) {
                raw = legacy;
                localStorage.setItem(storageKey, legacy);
                localStorage.setItem('legacy_events_migrated', '1');
            }
        }

        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const deletedSet = getDeletedTimelineIds();
                events = parsed.filter(e => {
                    if (!e || !e.id || deletedSet.has(e.id)) return false;
                    const s = new Date(e.start).getTime();
                    const end = new Date(e.end).getTime();
                    if (isNaN(s) || isNaN(end)) return false;
                    return true;
                });
            }
        }

        // Cơ chế tự phục hồi: Nếu tài khoản đang trống, kiểm tra xem có bản sao lưu nào không
        if (events.length === 0) {
            const autoBackup = localStorage.getItem('timeline_backup_auto_tl') || localStorage.getItem('timeline_events_v8');
            if (autoBackup) {
                try {
                    const parsedB = JSON.parse(autoBackup);
                    if (Array.isArray(parsedB) && parsedB.length > 0) {
                        const deletedSet = getDeletedTimelineIds();
                        events = parsedB.filter(e => e && e.id && !deletedSet.has(e.id));
                        if (events.length > 0) {
                            localStorage.setItem(storageKey, JSON.stringify(events));
                        }
                    }
                } catch (e) { }
            }
        }
    } catch (e) {
        console.error('Lỗi khi đọc LocalStorage:', e);
    }

    // Lưu memory cache (tuyệt đối KHÔNG gọi saveEvents ở đây để tránh tự động kích hoạt đẩy lên đám mây khi chỉ đọc)
    S.cachedEventsMemory = events;

    if (!events.length) {
        return [];
    }

    // Tự động kiểm tra và sửa lỗi ngày kết thúc cho các sự kiện lặp lại hàng tháng/năm
    const repairGroups = new Map();
    events.forEach(e => {
        if (e.repeatId && (e.repeatType === 'monthly' || e.repeatType === 'yearly')) {
            if (!repairGroups.has(e.repeatId)) {
                repairGroups.set(e.repeatId, []);
            }
            repairGroups.get(e.repeatId).push(e);
        }
    });
    let hadRepairs = false;
    repairGroups.forEach(group => {
        if (group.length <= 1) return;
        group.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        const baseEvt = group[0];
        const baseStart = new Date(baseEvt.start);
        const baseEnd = new Date(baseEvt.end);
        const targetDurationDays = Math.round((baseEnd.getTime() - baseStart.getTime()) / MS_PER_DAY);

        group.forEach(evt => {
            const curS = new Date(evt.start);
            const curE = new Date(evt.end);
            const curDurationDays = Math.round((curE.getTime() - curS.getTime()) / MS_PER_DAY);
            if (curDurationDays !== targetDurationDays) {
                const correctedEnd = getOccurrenceEnd(curS, evt.repeatType, baseStart, baseEnd);
                const newEndStr = toDateTimeLocalString(correctedEnd);
                if (evt.end !== newEndStr) {
                    evt.end = newEndStr;
                    hadRepairs = true;
                }
            }
        });
    });

    if (hadRepairs) {
        try {
            localStorage.setItem(getTimelineStorageKey(), JSON.stringify(events));
        } catch (e) { }
    }

    return events;
}

// Lưu danh sách sự kiện vào LocalStorage với cơ chế chống tràn bộ nhớ (QuotaExceededError)
export function saveEvents(events) {
    S.cachedEventsMemory = events;
    const storageKey = getTimelineStorageKey();
    try {
        localStorage.setItem(storageKey, JSON.stringify(events));
    } catch (e) {
        console.warn('Lỗi khi lưu LocalStorage (có thể do ảnh quá lớn), đang tối ưu dữ liệu...', e);
        try {
            // Tối ưu: Lược bỏ rawImageUrl dạng base64 dung lượng lớn để dung lượng luôn cực nhỏ
            const slimmed = events.map(evt => {
                const c = { ...evt };
                if (c.rawImageUrl && typeof c.rawImageUrl === 'string' && c.rawImageUrl.startsWith('data:')) {
                    delete c.rawImageUrl;
                }
                return c;
            });
            localStorage.setItem(storageKey, JSON.stringify(slimmed));
            S.cachedEventsMemory = slimmed;
        } catch (err2) {
            console.error('Không thể lưu vào LocalStorage do vượt hạn mức trình duyệt:', err2);
        }
    }
    // Tự động đẩy lên đám mây Firebase nếu đã kết nối
    if (typeof scheduleCloudPush === 'function') {
        scheduleCloudPush();
    }
}

// ========================================================
// 6.5 QUẢN LÝ THỨ TỰ HÀNG & MODAL SẮP XẾP (Track Order & Reorder Manager)
// ========================================================

// Đọc thứ tự hàng tùy chỉnh từ LocalStorage
export function loadTrackOrder(totalTracks) {
    try {
        const raw = localStorage.getItem(getTrackOrderStorageKey());
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const valid = parsed.filter(idx => typeof idx === 'number' && idx >= 0 && idx < totalTracks);
                const seen = new Set(valid);
                for (let i = 0; i < totalTracks; i++) {
                    if (!seen.has(i)) valid.push(i);
                }
                return valid;
            }
        }
    } catch (e) {
        console.error('Lỗi khi đọc timeline_track_order:', e);
    }
    return Array.from({ length: totalTracks }, (_, i) => i);
}

// Lưu thứ tự hàng vào LocalStorage
export function saveTrackOrder(order) {
    try {
        localStorage.setItem(getTrackOrderStorageKey(), JSON.stringify(order));
    } catch (e) {
        console.error('Lỗi khi lưu timeline_track_order:', e);
    }

    if (typeof scheduleCloudPush === 'function') {
        scheduleCloudPush();
    }
}
