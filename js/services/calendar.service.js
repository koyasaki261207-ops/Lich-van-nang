// Lưu trữ sự kiện và danh mục lịch riêng.

import { S } from '../state/store.js';
import { CAL_USER_EVENTS_KEY, DEFAULT_CAL_CATEGORIES } from '../core/constants.js';
import { getCleanUserEmail, getCurrentUser } from './auth.service.js';
import { scheduleCloudPush } from './sync.service.js';

export function getCalEventsStorageKey() {
    const user = getCurrentUser();
    return user ? ('calendar_user_events_' + encodeURIComponent(user.id)) : 'calendar_user_events_guest';
}

export function getCalCatsStorageKey() {
    const user = getCurrentUser();
    return user ? ('calendar_user_categories_' + encodeURIComponent(user.id)) : 'calendar_user_categories_guest';
}

export function getDeletedCalIds() {
    try {
        const raw = localStorage.getItem(`calendar_deleted_ids_${getCleanUserEmail()}`);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return new Set(arr);
        }
    } catch (e) { }
    return new Set();
}

export function recordDeletedCalIds(idOrIds) {
    const set = getDeletedCalIds();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    ids.forEach(id => { if (id) set.add(id); });
    const arr = Array.from(set).slice(-500);
    try {
        localStorage.setItem(`calendar_deleted_ids_${getCleanUserEmail()}`, JSON.stringify(arr));
    } catch (e) { }
    return set;
}

export function unmarkCalEventDeleted(id) {
    const set = getDeletedCalIds();
    if (set.has(id)) {
        set.delete(id);
        try {
            localStorage.setItem(`calendar_deleted_ids_${getCleanUserEmail()}`, JSON.stringify(Array.from(set)));
        } catch (e) { }
    }
}

export function loadCalEvents() {
    try {
        const key = getCalEventsStorageKey();
        let raw = localStorage.getItem(key);
        const user = getCurrentUser();
        const deletedCalIds = getDeletedCalIds();
        if (!raw && user && !localStorage.getItem('legacy_cal_migrated')) {
            const legacy = localStorage.getItem(CAL_USER_EVENTS_KEY);
            if (legacy) {
                raw = legacy;
                localStorage.setItem(key, legacy);
                localStorage.setItem('legacy_cal_migrated', '1');
            }
        }
        if ((!raw || raw === '[]') && user) {
            const autoBackup = localStorage.getItem('timeline_backup_auto_cal');
            if (autoBackup) {
                try {
                    const parsedBackup = JSON.parse(autoBackup);
                    if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
                        const filtered = parsedBackup.filter(e => e && e.id && !deletedCalIds.has(e.id));
                        localStorage.setItem(key, JSON.stringify(filtered));
                        return filtered;
                    }
                } catch (e) { }
            }
        }
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter(e => e && e.id && !deletedCalIds.has(e.id));
            }
        }
        return [];
    } catch (e) {
        return [];
    }
}

export function saveCalEvents(events) {
    try {
        const key = getCalEventsStorageKey();
        localStorage.setItem(key, JSON.stringify(events));
    } catch (e) {
        console.error('Lỗi khi lưu sự kiện lịch:', e);
    }
    if (typeof scheduleCloudPush === 'function') {
        scheduleCloudPush();
    }
}

export function loadCalCategories() {
    try {
        const key = getCalCatsStorageKey();
        const raw = localStorage.getItem(key);
        if (!raw) return [...DEFAULT_CAL_CATEGORIES];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_CAL_CATEGORIES];
    } catch (e) {
        return [...DEFAULT_CAL_CATEGORIES];
    }
}

export function saveCalCategories(cats) {
    try {
        const key = getCalCatsStorageKey();
        localStorage.setItem(key, JSON.stringify(cats));
    } catch (e) { }
    if (typeof scheduleCloudPush === 'function') {
        scheduleCloudPush();
    }
}

// Xoá một loại nhãn đã có kiểm tra (không hiển thị hộp thoại; UI tự xác nhận trước khi gọi)
export function deleteCalCategory(catId) {
    const cats = loadCalCategories().filter(c => c.id !== catId);
    saveCalCategories(cats);

    if (S.currentSelectedCatId === catId) {
        S.currentSelectedCatId = cats.length ? cats[0].id : 'nha';
    }
}
