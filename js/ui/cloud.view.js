// Giao diện trạng thái và cấu hình đồng bộ đám mây.

import { S } from '../state/store.js';
import { getActiveFirebaseConfig, initFirebaseApp, loadFirebaseSdk, parseFirebaseConfig } from '../config/firebase.js';
import { FIREBASE_CONFIG_STORAGE_KEY } from '../core/constants.js';
import { getCurrentUser, saveGoogleAccount, setCurrentUser, watchFirebaseAuth } from '../services/auth.service.js';
import { attachFirestoreSyncForUser, connectCloud, disconnectCloud, pushLocalDataToCloud, restoreFromBackups, setSyncHooks } from '../services/sync.service.js';
import { calSelectMonth, performLogin, updateAuthUI } from './auth.view.js';
import { calSelectYear, modalDayDetail, renderMonthlyCalendar } from './calendar.view.js';
import { renderDayDetailEvents } from './day-detail.view.js';
import { renderHorizontalDailyTimeline } from './day-timeline.view.js';
import { renderEvents } from './timeline.view.js';
import { showToastNotification } from './toast.js';

const cloudStatusDot = document.getElementById('cloud-status-dot');

export const btnTopCloudSync = document.getElementById('btn-top-cloud-sync');

export const cloudStatusText = document.getElementById('cloud-status-text');

export const modalCloudSync = document.getElementById('modal-cloud-sync');

export const btnCloseCloudModal = document.getElementById('btn-close-cloud-modal');

export const btnCancelCloudModal = document.getElementById('btn-cancel-cloud-modal');

export const btnSaveFirebaseConfig = document.getElementById('btn-save-firebase-config');

export const btnDisconnectFirebase = document.getElementById('btn-disconnect-firebase');

export const btnCloudManualSync = document.getElementById('btn-cloud-manual-sync');

export const btnCloudRestoreBackup = document.getElementById('btn-cloud-restore-backup');

export const inputFirebaseConfig = document.getElementById('input-firebase-config');

export const cloudStatusBanner = document.getElementById('cloud-status-banner');

export const cloudBannerIcon = document.getElementById('cloud-banner-icon');

export const cloudBannerTitle = document.getElementById('cloud-banner-title');

export const cloudBannerDesc = document.getElementById('cloud-banner-desc');

export function updateCloudUIState(isConnected, config, errMsg) {
    if (cloudStatusDot) {
        if (isConnected) {
            cloudStatusDot.classList.add('is-connected');
            cloudStatusDot.classList.remove('is-syncing');
        } else {
            cloudStatusDot.classList.remove('is-connected', 'is-syncing');
        }
    }
    if (cloudStatusText) {
        cloudStatusText.textContent = isConnected ? 'Đám mây' : 'Chưa kết nối';
    }
    if (btnTopCloudSync) {
        btnTopCloudSync.title = isConnected
            ? `Đồng bộ đám mây: Đã kết nối với dự án "${config ? config.projectId : ''}"`
            : 'Đồng bộ đám mây: Nhấp để kết nối Firebase';
    }

    if (cloudStatusBanner) {
        if (isConnected) {
            cloudStatusBanner.classList.add('is-connected');
            if (cloudBannerIcon) cloudBannerIcon.textContent = '🟢';
            if (cloudBannerTitle) cloudBannerTitle.textContent = `Đã kết nối đám mây (Dự án: ${config && config.projectId ? config.projectId : 'Firebase'})`;
            if (cloudBannerDesc) cloudBannerDesc.textContent = 'Dữ liệu lịch & sự kiện sẽ tự động đồng bộ theo thời gian thực giữa máy tính và điện thoại.';
            if (btnDisconnectFirebase) btnDisconnectFirebase.style.display = 'inline-block';
            if (btnCloudManualSync) btnCloudManualSync.style.display = 'inline-flex';
        } else {
            cloudStatusBanner.classList.remove('is-connected');
            if (cloudBannerIcon) cloudBannerIcon.textContent = '⚪';
            if (cloudBannerTitle) cloudBannerTitle.textContent = errMsg ? `Lỗi: ${errMsg}` : 'Chưa kết nối Firebase';
            if (cloudBannerDesc) cloudBannerDesc.textContent = 'Dán mã cấu hình Firebase bên dưới để đồng bộ dữ liệu thời gian thực giữa các thiết bị.';
            if (btnDisconnectFirebase) btnDisconnectFirebase.style.display = 'none';
            if (btnCloudManualSync) btnCloudManualSync.style.display = 'none';
        }
    }
}

export async function initFirebaseSync() {
    const cfg = getActiveFirebaseConfig();
    const sdk = await loadFirebaseSdk();
    if (!cfg || !cfg.apiKey || !sdk) {
        updateCloudUIState(false, null);
        return false;
    }

    try {
        initFirebaseApp(cfg);
        connectCloud();
        updateCloudUIState(true, cfg);

        // Lắng nghe trạng thái xác thực người dùng Firebase Auth
        try {
            watchFirebaseAuth(firebaseUser => {
                if (firebaseUser && firebaseUser.email) {
                    const activeUser = getCurrentUser();
                    if (!activeUser) {
                        performLogin(
                            firebaseUser.email,
                            firebaseUser.displayName || firebaseUser.email.split('@')[0],
                            firebaseUser.photoURL || ''
                        );
                    } else if (activeUser.email.toLowerCase() === firebaseUser.email.toLowerCase()) {
                        let profileUpdated = false;
                        if (firebaseUser.photoURL && activeUser.avatar !== firebaseUser.photoURL) {
                            activeUser.avatar = firebaseUser.photoURL;
                            profileUpdated = true;
                        }
                        if (firebaseUser.displayName && (!activeUser.name || activeUser.name === activeUser.email.split('@')[0])) {
                            activeUser.name = firebaseUser.displayName;
                            profileUpdated = true;
                        }
                        if (profileUpdated) {
                            setCurrentUser(activeUser);
                            saveGoogleAccount(activeUser);
                            updateAuthUI();
                        }
                    }
                }
            });
        } catch (authErr) {
            console.warn('Lỗi lắng nghe Firebase Auth:', authErr);
        }

        const user = getCurrentUser();
        if (user && user.email) {
            attachFirestoreSyncForUser(user);
        }
        return true;
    } catch (err) {
        console.warn('Lỗi khởi tạo Firebase:', err);
        updateCloudUIState(false, null, err.message);
        return false;
    }
}

// Hiển thị trạng thái đồng bộ và làm mới giao diện khi dữ liệu từ đám mây thay đổi
setSyncHooks({
    onStatus(status) {
        if (!cloudStatusDot) return;
        if (status === 'syncing') {
            cloudStatusDot.classList.add('is-syncing');
        } else if (status === 'connected') {
            cloudStatusDot.classList.remove('is-syncing');
            cloudStatusDot.classList.add('is-connected');
        } else {
            cloudStatusDot.classList.remove('is-syncing');
        }
    },
    onRemoteChange({ dataChanged, profileChanged }) {
        if (profileChanged) updateAuthUI();
        if (!dataChanged) return;
        renderEvents();
        if (calSelectMonth && calSelectYear) {
            renderMonthlyCalendar(parseInt(calSelectMonth.value, 10), parseInt(calSelectYear.value, 10));
        }
        renderHorizontalDailyTimeline(S.activeTimelineDate);
        if (S.activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
            renderDayDetailEvents(S.activeDayDetailData);
        }
    }
});

export function openCloudModal() {
    if (!modalCloudSync) return;
    const activeCfg = getActiveFirebaseConfig();
    if (inputFirebaseConfig) {
        if (activeCfg) {
            inputFirebaseConfig.value = JSON.stringify(activeCfg, null, 2);
        } else {
            inputFirebaseConfig.value = '';
        }
    }
    updateCloudUIState(!!(S.firestoreDb && activeCfg), activeCfg);
    modalCloudSync.classList.add('is-active');
    modalCloudSync.setAttribute('aria-hidden', 'false');
}

export function closeCloudModal() {
    if (!modalCloudSync) return;
    modalCloudSync.classList.remove('is-active');
    modalCloudSync.setAttribute('aria-hidden', 'true');
}

if (btnTopCloudSync) {
    btnTopCloudSync.addEventListener('click', openCloudModal);
}

if (btnCloseCloudModal) {
    btnCloseCloudModal.addEventListener('click', closeCloudModal);
}

if (btnCancelCloudModal) {
    btnCancelCloudModal.addEventListener('click', closeCloudModal);
}

if (btnSaveFirebaseConfig) {
    btnSaveFirebaseConfig.addEventListener('click', async () => {
        const raw = inputFirebaseConfig ? inputFirebaseConfig.value.trim() : '';
        if (!raw) {
            alert('Vui lòng dán mã cấu hình Firebase trước khi lưu!');
            return;
        }
        const cfg = parseFirebaseConfig(raw);
        if (!cfg || !cfg.apiKey) {
            alert('Mã cấu hình không hợp lệ hoặc thiếu apiKey/projectId. Vui lòng kiểm tra lại!');
            return;
        }

        try {
            localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
            const ok = await initFirebaseSync();
            if (ok) {
                closeCloudModal();
                if (typeof showToastNotification === 'function') {
                    showToastNotification(`Đã kết nối thành công với dự án "${cfg.projectId}"!`, '☁️ Đám mây Firebase');
                }
                const user = getCurrentUser();
                if (user && user.email) {
                    pushLocalDataToCloud(user.email);
                }
            } else {
                alert('Không thể khởi tạo Firebase với cấu hình này. Vui lòng kiểm tra lại apiKey hoặc quyền truy cập mạng.');
            }
        } catch (err) {
            alert('Lỗi khi lưu cấu hình: ' + err.message);
        }
    });
}

if (btnDisconnectFirebase) {
    btnDisconnectFirebase.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn ngắt kết nối đồng bộ đám mây Firebase trên thiết bị này?')) {
            localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
            disconnectCloud();
            updateCloudUIState(false, null);
            closeCloudModal();
            if (typeof showToastNotification === 'function') {
                showToastNotification('Đã ngắt kết nối đồng bộ đám mây', '☁️ Firebase');
            }
        }
    });
}

if (btnCloudManualSync) {
    btnCloudManualSync.addEventListener('click', () => {
        const user = getCurrentUser();
        if (!user || !user.email) {
            alert('Vui lòng đăng nhập trước khi đồng bộ!');
            return;
        }
        pushLocalDataToCloud(user.email);
        if (typeof showToastNotification === 'function') {
            showToastNotification('Đã gửi toàn bộ dữ liệu sự kiện lên Đám mây!', '☁️ Firebase');
        }
    });
}

if (btnCloudRestoreBackup) {
    btnCloudRestoreBackup.addEventListener('click', async () => {
        const user = getCurrentUser();
        if (!user || !user.email) {
            alert('Vui lòng đăng nhập trước khi khôi phục dữ liệu!');
            return;
        }

        if (!confirm('Bạn có chắc muốn khôi phục lại dữ liệu lịch & sự kiện gốc cho tài khoản này không?')) {
            return;
        }

        const { restoredTL, restoredCal, profileChanged } = await restoreFromBackups(user);
        if (profileChanged) updateAuthUI();

        renderEvents();
        if (calSelectMonth && calSelectYear) {
            renderMonthlyCalendar(parseInt(calSelectMonth.value, 10), parseInt(calSelectYear.value, 10));
        }

        if (restoredTL || restoredCal) {
            if (typeof showToastNotification === 'function') {
                showToastNotification('Đã khôi phục thành công toàn bộ sự kiện gốc!', '🔄 Khôi phục hoàn tất');
            } else {
                alert('Đã khôi phục thành công toàn bộ sự kiện gốc!');
            }
            closeCloudModal();
        } else {
            alert('Không tìm thấy bản sao lưu cũ nào trên thiết bị này.');
        }
    });
}
