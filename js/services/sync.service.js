// Đồng bộ đám mây Firestore: kéo, đẩy và lắng nghe thay đổi.
// Module này không thao tác DOM. Trạng thái và thay đổi từ xa được báo cho UI qua syncHooks.

import { S } from '../state/store.js';
import { CAL_USER_EVENTS_KEY } from '../core/constants.js';
import { getKnownRawBannerUrl } from '../core/banner-catalog.js';
import { getFirebaseSdk, getFirestoreDb } from '../config/firebase.js';
import { EMBEDDED_RECOVERY_DATA } from '../data/recovery-data.js';
import { getCurrentUser, saveGoogleAccount, setCurrentUser } from './auth.service.js';
import { getCalCatsStorageKey, getCalEventsStorageKey, getDeletedCalIds, loadCalCategories, loadCalEvents, recordDeletedCalIds } from './calendar.service.js';
import { getDeletedTimelineIds, getTimelineStorageKey, getTrackOrderStorageKey, loadEvents, loadTrackOrder, recordDeletedTimelineIds } from './event.service.js';

// UI đăng ký các hàm này qua setSyncHooks.
// onStatus nhận 'syncing' | 'connected' | 'idle'.
// onRemoteChange nhận { dataChanged, profileChanged } khi dữ liệu từ đám mây được áp dụng.
export const syncHooks = {
    onStatus: () => { },
    onRemoteChange: () => { }
};

export function setSyncHooks(hooks) {
    Object.assign(syncHooks, hooks);
}

export function connectCloud() {
    S.firestoreDb = getFirestoreDb();
}

// Ngừng lắng nghe tài liệu Firestore của người dùng hiện tại
export function detachFirestoreSync() {
    if (S.firestoreUnsubscribe) {
        S.firestoreUnsubscribe();
        S.firestoreUnsubscribe = null;
    }
}

export function disconnectCloud() {
    if (S.firestoreUnsubscribe) {
        S.firestoreUnsubscribe();
        S.firestoreUnsubscribe = null;
    }
    S.firestoreDb = null;
}

// Đọc tài liệu của người dùng trên Firestore. Trả về dữ liệu, hoặc null nếu chưa có tài liệu.
export async function fetchCloudSnapshot(email) {
    const sdk = getFirebaseSdk();
    const snap = await sdk.getDoc(sdk.doc(S.firestoreDb, 'user_calendars', email.trim().toLowerCase()));
    return snap.exists() ? (snap.data() || {}) : null;
}

export function attachFirestoreSyncForUser(user) {
    if (!S.firestoreDb || !user || !user.email) return;
    const sdk = getFirebaseSdk();
    const cleanEmail = user.email.trim().toLowerCase();

    S.isInitialCloudPullComplete = false;

    if (S.firestoreUnsubscribe) {
        S.firestoreUnsubscribe();
        S.firestoreUnsubscribe = null;
    }

    const docRef = sdk.doc(S.firestoreDb, 'user_calendars', cleanEmail);

    S.firestoreUnsubscribe = sdk.onSnapshot(docRef, snap => {
        S.isInitialCloudPullComplete = true;
        if (snap.exists()) {
            // Snapshot do chính tab này vừa ghi (pending writes): bỏ qua để không ghi đè dữ liệu mới
            if (snap.metadata && snap.metadata.hasPendingWrites) {
                return;
            }
            applyCloudData(user, snap.data() || {});
        } else {
            // Tài liệu chưa có trên đám mây: CHỈ đẩy lên nếu cục bộ thực sự có sự kiện
            const localTL = loadEvents();
            const localCal = loadCalEvents();
            if ((localTL && localTL.length > 0) || (localCal && localCal.length > 0)) {
                pushLocalDataToCloud(cleanEmail);
            }
        }
    }, err => {
        console.warn('Lỗi Firestore onSnapshot:', err);
        S.isInitialCloudPullComplete = true;
    });
}

// Áp dụng dữ liệu từ đám mây: hợp nhất thông minh với dữ liệu cục bộ
function applyCloudData(user, data) {
    S.isIncomingCloudUpdate = true;
    let changed = false;

    // Tự động sao lưu cục bộ trước khi nhận dữ liệu từ đám mây
    const currentTLRaw = localStorage.getItem(getTimelineStorageKey());
    const currentCalRaw = localStorage.getItem(getCalEventsStorageKey());
    if (currentTLRaw && currentTLRaw !== '[]') {
        try { localStorage.setItem('timeline_backup_auto_tl', currentTLRaw); } catch (e) { }
    }
    if (currentCalRaw && currentCalRaw !== '[]') {
        try { localStorage.setItem('timeline_backup_auto_cal', currentCalRaw); } catch (e) { }
    }

    // Đồng bộ danh sách ID đã xoá từ đám mây (tombstones) để không bao giờ hồi sinh sự kiện đã xoá
    if (Array.isArray(data.deletedTimelineEventIds)) {
        recordDeletedTimelineIds(data.deletedTimelineEventIds);
    }
    if (Array.isArray(data.deletedCalEventIds)) {
        recordDeletedCalIds(data.deletedCalEventIds);
    }
    const deletedTimelineIds = getDeletedTimelineIds();
    const deletedCalIds = getDeletedCalIds();

    // Hợp nhất sự kiện timeline
    if (Array.isArray(data.timelineEvents)) {
        const localEvents = (loadEvents() || []).filter(e => e && e.id && !deletedTimelineIds.has(e.id));
        const cloudMap = new Map();
        data.timelineEvents.forEach(e => {
            if (e && e.id && !deletedTimelineIds.has(e.id)) {
                cloudMap.set(e.id, e);
            }
        });

        let hasLocalNew = false;
        localEvents.forEach(e => {
            if (e && e.id && !cloudMap.has(e.id) && !deletedTimelineIds.has(e.id)) {
                cloudMap.set(e.id, e);
                hasLocalNew = true;
            }
        });

        const finalTimelineEvents = Array.from(cloudMap.values());
        S.cachedEventsMemory = finalTimelineEvents;
        try {
            localStorage.setItem(getTimelineStorageKey(), JSON.stringify(finalTimelineEvents));
        } catch (e) { }

        if (hasLocalNew) {
            setTimeout(() => {
                scheduleCloudPush();
            }, 1000);
        }
        changed = true;
    }

    // Hợp nhất sự kiện lịch riêng
    if (Array.isArray(data.calEvents)) {
        const localCal = (loadCalEvents() || []).filter(e => e && e.id && !deletedCalIds.has(e.id));
        const cloudCalMap = new Map();
        data.calEvents.forEach(e => {
            if (e && e.id && !deletedCalIds.has(e.id)) {
                cloudCalMap.set(e.id, e);
            }
        });

        let hasLocalNewCal = false;
        localCal.forEach(e => {
            if (e && e.id && !cloudCalMap.has(e.id) && !deletedCalIds.has(e.id)) {
                cloudCalMap.set(e.id, e);
                hasLocalNewCal = true;
            }
        });

        const finalCalEvents = Array.from(cloudCalMap.values());
        try {
            localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(finalCalEvents));
        } catch (e) { }

        if (hasLocalNewCal) {
            setTimeout(() => {
                scheduleCloudPush();
            }, 1000);
        }
        changed = true;
    }

    if (Array.isArray(data.calCategories) && data.calCategories.length) {
        try {
            localStorage.setItem(getCalCatsStorageKey(), JSON.stringify(data.calCategories));
        } catch (e) { }
        changed = true;
    }

    if (Array.isArray(data.trackOrder) && data.trackOrder.length >= S.currentTotalTracks && !S.trackToHoistOnRender) {
        try {
            localStorage.setItem(getTrackOrderStorageKey(), JSON.stringify(data.trackOrder));
        } catch (e) { }
        changed = true;
    }

    let profileChanged = false;
    if (data.userProfile) {
        if (data.userProfile.name && data.userProfile.name !== user.name) {
            user.name = data.userProfile.name;
            profileChanged = true;
        }
        if (data.userProfile.avatar !== undefined && data.userProfile.avatar !== (user.avatar || '')) {
            user.avatar = data.userProfile.avatar;
            profileChanged = true;
        }
        if (profileChanged) {
            setCurrentUser(user);
            saveGoogleAccount(user);
        }
    }

    syncHooks.onRemoteChange({ dataChanged: changed, profileChanged });
    setTimeout(() => { S.isIncomingCloudUpdate = false; }, 200);
}

export function pushLocalDataToCloud(targetEmail) {
    if (!S.firestoreDb) return;
    if (!S.isInitialCloudPullComplete) return;

    const user = getCurrentUser();
    const email = targetEmail || (user ? user.email : null);
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();

    const timelineEvents = loadEvents();
    const calEvents = loadCalEvents();

    // BẢO VỆ: nếu cả 2 danh sách đều rỗng thì không bao giờ ghi đè lên đám mây
    // (tránh trường hợp trình duyệt mới mở đẩy mảng rỗng đè mất toàn bộ dữ liệu trên đám mây)
    if ((!timelineEvents || timelineEvents.length === 0) && (!calEvents || calEvents.length === 0)) {
        syncHooks.onStatus('idle');
        return;
    }

    syncHooks.onStatus('syncing');

    const calCategories = loadCalCategories();
    const trackOrder = loadTrackOrder(S.currentTotalTracks);
    const userProfile = {
        name: (user && user.name) ? user.name : '',
        avatar: (user && user.avatar) ? user.avatar : ''
    };

    const deletedTimelineIds = getDeletedTimelineIds();
    const deletedCalIds = getDeletedCalIds();

    // Lọc chắc chắn không đẩy bất kỳ sự kiện nào đã bị xoá, và bỏ ảnh gốc quá lớn
    const cleanTimelineEvents = JSON.parse(JSON.stringify((timelineEvents || [])
        .filter(evt => evt && evt.id && !deletedTimelineIds.has(evt.id))
        .map(evt => {
            const clone = { ...evt };
            if (clone.rawImageUrl && typeof clone.rawImageUrl === 'string' && clone.rawImageUrl.startsWith('data:') && clone.rawImageUrl.length > 120000) {
                delete clone.rawImageUrl;
            }
            if (!clone.rawImageUrl) {
                const known = getKnownRawBannerUrl(clone.title);
                if (known) clone.rawImageUrl = known;
            }
            return clone;
        })));

    const cleanCalEvents = JSON.parse(JSON.stringify((calEvents || [])
        .filter(evt => evt && evt.id && !deletedCalIds.has(evt.id))
        .map(evt => {
            const clone = { ...evt };
            if (clone.attachment && clone.attachment.dataUrl && clone.attachment.dataUrl.length > 100000) {
                clone.attachment = { ...clone.attachment, dataUrl: '' };
            }
            return clone;
        })));

    const sdk = getFirebaseSdk();
    sdk.setDoc(sdk.doc(S.firestoreDb, 'user_calendars', cleanEmail), {
        email: cleanEmail,
        updatedAt: sdk.serverTimestamp(),
        updatedFrom: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
        timelineEvents: cleanTimelineEvents,
        calEvents: cleanCalEvents,
        deletedTimelineEventIds: Array.from(deletedTimelineIds).slice(-500),
        deletedCalEventIds: Array.from(deletedCalIds).slice(-500),
        calCategories: JSON.parse(JSON.stringify(calCategories || [])),
        trackOrder: JSON.parse(JSON.stringify(trackOrder || [])),
        userProfile
    }, { merge: true })
        .then(() => syncHooks.onStatus('connected'))
        .catch(err => {
            console.warn('Lỗi khi đẩy dữ liệu lên Firestore:', err);
            syncHooks.onStatus('idle');
        });
}

export function scheduleCloudPush() {
    if (!S.firestoreDb || S.isIncomingCloudUpdate || !S.isInitialCloudPullComplete) return;
    const user = getCurrentUser();
    if (!user || !user.email) return;

    if (S.cloudPushTimeout) clearTimeout(S.cloudPushTimeout);
    S.cloudPushTimeout = setTimeout(() => {
        pushLocalDataToCloud(user.email);
    }, 500);
}

// Khôi phục dữ liệu: ưu tiên đám mây, sau đó bản sao lưu tích hợp sẵn, cuối cùng bản sao lưu tự động trên máy.
// Trả về cờ cho biết đã khôi phục được timeline / lịch riêng / hồ sơ hay chưa.
export async function restoreFromBackups(user) {
    let restoredTL = false;
    let restoredCal = false;
    let profileChanged = false;

    // 1. Lấy dữ liệu từ Firestore trước
    if (S.firestoreDb) {
        try {
            const data = await fetchCloudSnapshot(user.email);
            if (data) {
                if (Array.isArray(data.timelineEvents) && data.timelineEvents.length > 0) {
                    S.cachedEventsMemory = data.timelineEvents;
                    localStorage.setItem(getTimelineStorageKey(), JSON.stringify(data.timelineEvents));
                    restoredTL = true;
                }
                if (Array.isArray(data.calEvents) && data.calEvents.length > 0) {
                    localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(data.calEvents));
                    restoredCal = true;
                }
                if (Array.isArray(data.calCategories) && data.calCategories.length > 0) {
                    localStorage.setItem(getCalCatsStorageKey(), JSON.stringify(data.calCategories));
                }
                if (data.userProfile) {
                    if (data.userProfile.name) user.name = data.userProfile.name;
                    if (data.userProfile.avatar !== undefined) user.avatar = data.userProfile.avatar;
                    setCurrentUser(user);
                    saveGoogleAccount(user);
                    profileChanged = true;
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc Firestore:', e);
        }
    }

    // 2. Nếu đám mây không có, dùng bản sao lưu tích hợp sẵn cho phần còn thiếu
    if (!restoredTL || !restoredCal) {
        if (!restoredTL && Array.isArray(EMBEDDED_RECOVERY_DATA.timelineEvents) && EMBEDDED_RECOVERY_DATA.timelineEvents.length > 0) {
            S.cachedEventsMemory = EMBEDDED_RECOVERY_DATA.timelineEvents;
            localStorage.setItem(getTimelineStorageKey(), JSON.stringify(EMBEDDED_RECOVERY_DATA.timelineEvents));
            restoredTL = true;
        }
        if (!restoredCal && Array.isArray(EMBEDDED_RECOVERY_DATA.calEvents) && EMBEDDED_RECOVERY_DATA.calEvents.length > 0) {
            localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(EMBEDDED_RECOVERY_DATA.calEvents));
            restoredCal = true;
        }
        if (EMBEDDED_RECOVERY_DATA.userProfile) {
            if (EMBEDDED_RECOVERY_DATA.userProfile.name) user.name = EMBEDDED_RECOVERY_DATA.userProfile.name;
            if (EMBEDDED_RECOVERY_DATA.userProfile.avatar) user.avatar = EMBEDDED_RECOVERY_DATA.userProfile.avatar;
            setCurrentUser(user);
            saveGoogleAccount(user);
            profileChanged = true;
        }
    }

    // 3. Bản sao lưu tự động còn lưu trên máy
    if (!restoredTL) {
        const bTL = localStorage.getItem('timeline_backup_auto_tl') || localStorage.getItem('timeline_events_v8');
        if (bTL) {
            try {
                const parsed = JSON.parse(bTL);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    S.cachedEventsMemory = parsed;
                    localStorage.setItem(getTimelineStorageKey(), JSON.stringify(parsed));
                    restoredTL = true;
                }
            } catch (e) { }
        }
    }

    if (!restoredCal) {
        const bCal = localStorage.getItem('timeline_backup_auto_cal') || localStorage.getItem(CAL_USER_EVENTS_KEY);
        if (bCal) {
            try {
                const parsed = JSON.parse(bCal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(parsed));
                    restoredCal = true;
                }
            } catch (e) { }
        }
    }

    return { restoredTL, restoredCal, profileChanged };
}
