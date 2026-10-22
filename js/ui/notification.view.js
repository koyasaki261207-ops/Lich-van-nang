// Giao diện điều khiển Cài đặt, Thông báo & Cài đặt PWA cho Lịch Vạn Năng

import {
    dismissAlarm,
    getNotificationPermission,
    initPwaInstallPrompt,
    isIosDevice,
    isNotificationSupported,
    isStandaloneApp,
    promptPwaInstall,
    registerServiceWorker,
    requestNotificationPermission,
    sendTestNotification,
    snoozeAlarm,
    startEventReminderEngine,
    triggerAlarm
} from '../services/notification.service.js';
import { showToastNotification } from './toast.js';

// Cập nhật giao diện trạng thái thông báo
export function updateNotificationStateUI() {
    const perm = getNotificationPermission();

    const notiBadgeDot = document.getElementById('noti-badge-dot');
    if (notiBadgeDot) {
        notiBadgeDot.className = 'noti-badge-dot';
        if (perm === 'granted') {
            notiBadgeDot.classList.add('is-granted');
        } else if (perm === 'denied') {
            notiBadgeDot.classList.add('is-denied');
        } else {
            notiBadgeDot.classList.add('is-default');
        }
    }

    const popoverNotiStatus = document.getElementById('popover-noti-status');
    const topAvatarDot = document.getElementById('top-avatar-dot');
    if (popoverNotiStatus) {
        if (perm === 'granted') {
            popoverNotiStatus.textContent = 'Đã bật';
            popoverNotiStatus.className = 'popover-action-badge is-granted';
            if (topAvatarDot) topAvatarDot.style.display = 'none';
        } else if (perm === 'denied') {
            popoverNotiStatus.textContent = 'Bị chặn';
            popoverNotiStatus.className = 'popover-action-badge';
            if (topAvatarDot) {
                topAvatarDot.style.display = 'block';
                topAvatarDot.style.background = '#ef4444';
                topAvatarDot.style.boxShadow = '0 0 6px #ef4444';
            }
        } else {
            popoverNotiStatus.textContent = 'Bật';
            popoverNotiStatus.className = 'popover-action-badge';
            if (topAvatarDot) {
                topAvatarDot.style.display = 'block';
                topAvatarDot.style.background = '#38bdf8';
                topAvatarDot.style.boxShadow = '0 0 6px #38bdf8';
            }
        }
    }

    const notiStatusBadge = document.getElementById('noti-status-badge');
    const notiStatusText = document.getElementById('noti-status-text');
    const btnModalRequestNoti = document.getElementById('btn-modal-request-noti');
    const btnModalTestNoti = document.getElementById('btn-modal-test-noti');

    if (notiStatusBadge && notiStatusText) {
        if (perm === 'granted') {
            notiStatusBadge.className = 'noti-modal-badge status-granted';
            notiStatusBadge.innerHTML = '● Đã cho phép';
            notiStatusText.textContent = 'Thiết bị của bạn đã sẵn sàng nhận thông báo và reo báo thức khi có sự kiện!';
            if (btnModalRequestNoti) btnModalRequestNoti.style.display = 'none';
            if (btnModalTestNoti) btnModalTestNoti.style.display = 'inline-flex';
        } else if (perm === 'denied') {
            notiStatusBadge.className = 'noti-modal-badge status-denied';
            notiStatusBadge.innerHTML = '● Bị chặn';
            notiStatusText.textContent = 'Quyền thông báo đang bị chặn trong trình duyệt. Hãy nhấp vào biểu tượng Ổ khóa / Cài đặt cạnh thanh địa chỉ URL để Bật lại.';
            if (btnModalRequestNoti) {
                btnModalRequestNoti.style.display = 'inline-flex';
                btnModalRequestNoti.textContent = 'Xem cách mở lại';
            }
            if (btnModalTestNoti) btnModalTestNoti.style.display = 'none';
        } else {
            notiStatusBadge.className = 'noti-modal-badge status-default';
            notiStatusBadge.innerHTML = '● Chưa bật';
            notiStatusText.textContent = 'Bật thông báo để nhận nhắc nhở sự kiện, chuông báo thức và rung trực tiếp trên màn hình máy tính hoặc điện thoại.';
            if (btnModalRequestNoti) {
                btnModalRequestNoti.style.display = 'inline-flex';
                btnModalRequestNoti.textContent = 'Bật thông báo ngay';
            }
            if (btnModalTestNoti) btnModalTestNoti.style.display = 'inline-flex';
        }
    }
}

// Render danh sách sự kiện có chuông nhắc hôm nay
export function renderUpcomingReminders() {
    const listEl = document.getElementById('noti-upcoming-list');
    const countEl = document.getElementById('noti-upcoming-count');
    if (!listEl) return;

    import('../services/calendar.service.js').then(({ loadCalEvents }) => {
        import('../core/calendar-events.js').then(({ isCalEventOnDate }) => {
            const events = loadCalEvents() || [];
            const now = new Date();
            const curY = now.getFullYear();
            const curM = now.getMonth();
            const curD = now.getDate();

            const todayEvents = events.filter(e => {
                if (!e || !e.id) return false;
                const r = e.reminder !== undefined ? String(e.reminder) : '10';
                if (r === 'none' || !r) return false;
                return isCalEventOnDate(e, curY, curM, curD);
            });

            if (countEl) {
                countEl.textContent = `${todayEvents.length} sự kiện`;
            }

            if (!todayEvents.length) {
                listEl.innerHTML = `<div class="noti-upcoming-empty">Chưa có sự kiện nào đặt nhắc nhở hôm nay. Bấm vào bất kỳ sự kiện nào để hẹn chuông nhắc hoặc báo thức!</div>`;
                return;
            }

            listEl.innerHTML = '';
            todayEvents.forEach(evt => {
                const item = document.createElement('div');
                item.className = 'noti-upcoming-item';
                const timeText = evt.allDay ? 'Cả ngày' : (evt.startTime || '09:00');
                const rVal = evt.reminder !== undefined ? String(evt.reminder) : '10';
                let rLabel = 'Trước 10p';
                if (rVal === '0') rLabel = 'Đúng giờ';
                else if (rVal === '5') rLabel = 'Trước 5p';
                else if (rVal === '10') rLabel = 'Trước 10p';
                else if (rVal === '30') rLabel = 'Trước 30p';
                else if (rVal === '60') rLabel = 'Trước 1h';
                else if (rVal === '1440') rLabel = 'Trước 1 ngày';

                const isAlarm = (evt.alertType || 'alarm') === 'alarm';
                const iconType = isAlarm ? '⏰' : '🔔';
                const badgeText = isAlarm ? `${iconType} Báo thức: ${rLabel}` : `${iconType} ${rLabel}`;

                item.innerHTML = `
                    <div class="noti-upcoming-item-left">
                        <span class="noti-upcoming-item-color" style="background: ${evt.categoryColor || '#38bdf8'};"></span>
                        <span class="noti-upcoming-item-name" title="${evt.title}">${evt.title}</span>
                        <span class="noti-upcoming-item-time">${timeText}</span>
                    </div>
                    <span class="noti-upcoming-item-badge ${isAlarm ? 'is-alarm' : ''}">${badgeText}</span>
                `;
                listEl.appendChild(item);
            });
        });
    });
}

// Chuyển tab trong Modal Cài đặt
export function switchSettingsTab(targetTabId) {
    const tabs = document.querySelectorAll('.settings-tab-btn');
    const panes = document.querySelectorAll('.settings-tab-pane');

    tabs.forEach(btn => {
        const isMatch = btn.getAttribute('data-tab') === targetTabId;
        btn.classList.toggle('is-active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    panes.forEach(pane => {
        const isMatch = pane.id === targetTabId;
        pane.classList.toggle('is-active', isMatch);
    });

    if (targetTabId === 'tab-settings-noti') {
        updateNotificationStateUI();
        renderUpcomingReminders();
    }
}

// Mở Modal Cài đặt (Mặc định mở tab Thông báo)
export function openSettingsModal(tabId = 'tab-settings-noti') {
    const modalSettings = document.getElementById('modal-settings') || document.getElementById('modal-notification-center');
    if (!modalSettings) return;

    if (tabId === 'notifications' || tabId === 'noti') tabId = 'tab-settings-noti';
    if (tabId === 'app' || tabId === 'pwa') tabId = 'tab-settings-app';
    if (tabId === 'cloud') tabId = 'tab-settings-cloud';
    if (tabId === 'ai') tabId = 'tab-settings-ai';

    switchSettingsTab(tabId);
    updateNotificationStateUI();
    renderUpcomingReminders();

    modalSettings.classList.add('is-active');
    modalSettings.setAttribute('aria-hidden', 'false');
}

// Đóng Modal Cài đặt
export function closeSettingsModal() {
    const modalSettings = document.getElementById('modal-settings') || document.getElementById('modal-notification-center');
    if (modalSettings) {
        modalSettings.classList.remove('is-active');
        modalSettings.setAttribute('aria-hidden', 'true');
    }
}

// Tương thích ngược
export function openNotiModal() {
    openSettingsModal('tab-settings-noti');
}

export function closeNotiModal() {
    closeSettingsModal();
}

export function initNotificationUI() {
    // 1. Đăng ký Service Worker & Khởi động Động cơ nhắc nhở tự động
    registerServiceWorker();
    startEventReminderEngine();

    // 2. Tham chiếu các phần tử DOM
    const btnInstallPwa = document.getElementById('btn-install-pwa');
    const btnNotificationToggle = document.getElementById('btn-notification-toggle');

    const modalSettings = document.getElementById('modal-settings') || document.getElementById('modal-notification-center');
    const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
    const btnCloseNotiModal = document.getElementById('btn-close-noti-modal');
    const btnModalRequestNoti = document.getElementById('btn-modal-request-noti');
    const btnModalTestNoti = document.getElementById('btn-modal-test-noti');
    const btnModalTestAlarm = document.getElementById('btn-modal-test-alarm');

    // Nút điều khiển màn hình Báo thức (Alarm Ringing Modal)
    const btnAlarmDismiss = document.getElementById('btn-alarm-dismiss');
    const btnAlarmSnooze = document.getElementById('btn-alarm-snooze');

    const modalIosInstall = document.getElementById('modal-ios-install');
    const btnCloseIosModal = document.getElementById('btn-close-ios-modal');

    // 3. Gắn sự kiện Tắt / Hoãn Báo thức
    if (btnAlarmDismiss) {
        btnAlarmDismiss.addEventListener('click', () => {
            dismissAlarm();
            showToastNotification('Đã tắt báo thức.', 'Báo thức');
        });
    }

    if (btnAlarmSnooze) {
        btnAlarmSnooze.addEventListener('click', () => {
            snoozeAlarm(5);
        });
    }

    // Nhấn phím Escape để tắt báo thức hoặc đóng Cài đặt
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const alarmModal = document.getElementById('modal-alarm-ringing');
            if (alarmModal && alarmModal.classList.contains('is-active')) {
                dismissAlarm();
                return;
            }
            if (modalSettings && modalSettings.classList.contains('is-active')) {
                closeSettingsModal();
            }
        }
    });

    // 4. Xử lý chuyển tab trong Modal Cài đặt
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (targetTab) switchSettingsTab(targetTab);
        });
    });

    // 5. Đóng Modal Cài đặt
    if (btnCloseSettingsModal) {
        btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
    }
    if (btnCloseNotiModal) {
        btnCloseNotiModal.addEventListener('click', closeSettingsModal);
    }
    if (modalSettings) {
        modalSettings.addEventListener('click', (e) => {
            if (e.target === modalSettings) closeSettingsModal();
        });
    }

    // 6. Xử lý nút Thông báo ở Header (nếu có kích hoạt)
    if (btnNotificationToggle) {
        btnNotificationToggle.addEventListener('click', () => {
            const perm = getNotificationPermission();
            if (perm === 'default') {
                requestNotificationPermission()
                    .then((newPerm) => {
                        updateNotificationStateUI();
                        if (newPerm === 'granted') {
                            showToastNotification('Đã bật quyền thông báo thành công!', 'Thông báo');
                            sendTestNotification('Lịch Vạn Năng', 'Chào mừng bạn! Hệ thống thông báo & báo thức đã sẵn sàng. 🎉');
                        } else if (newPerm === 'denied') {
                            showToastNotification('Bạn đã từ chối nhận thông báo.', 'Thông báo');
                        }
                    })
                    .catch(() => {
                        openSettingsModal('tab-settings-noti');
                    });
            } else {
                openSettingsModal('tab-settings-noti');
            }
        });
    }

    // 7. Nút xin cấp quyền trong Modal Cài đặt (Tab Thông báo)
    if (btnModalRequestNoti) {
        btnModalRequestNoti.addEventListener('click', async () => {
            const perm = getNotificationPermission();
            if (perm === 'denied') {
                alert('Quyền thông báo hiện đang bị chặn. Vui lòng nhấp vào biểu tượng Ổ khóa trên thanh địa chỉ URL của trình duyệt, chọn "Quyền riêng tư" hoặc "Thông báo" rồi gạt sang "Cho phép".');
                return;
            }

            try {
                const res = await requestNotificationPermission();
                updateNotificationStateUI();
                if (res === 'granted') {
                    showToastNotification('Đã cho phép thông báo thành công!', 'Thành công');
                    await sendTestNotification('Lịch Vạn Năng', 'Chào mừng bạn! Thiết bị đã sẵn sàng nhận thông báo và báo thức. 🎉');
                }
            } catch (err) {
                console.warn(err);
            }
        });
    }

    // 8. Nút Bắn thông báo thử nghiệm (Test Notification)
    if (btnModalTestNoti) {
        btnModalTestNoti.addEventListener('click', async () => {
            try {
                await sendTestNotification('Lịch Vạn Năng 🎉', 'Kiểm tra thông báo thành công trên ' + (isIosDevice() ? 'iPhone' : 'thiết bị của bạn') + '!');
                showToastNotification('Đã gửi thông báo thử nghiệm!', 'Thành công');
            } catch (err) {
                showToastNotification('Chưa thể gửi thông báo: ' + (err.message || 'Chưa cấp quyền'), 'Lỗi');
            }
        });
    }

    // 9. Nút Thử nghiệm Báo thức & Rung (Test Alarm & Vibration)
    if (btnModalTestAlarm) {
        btnModalTestAlarm.addEventListener('click', () => {
            closeSettingsModal();
            const now = new Date();
            const nowTimeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            triggerAlarm({
                id: 'test-alarm-sample',
                title: 'Báo thức mẫu: Họp giao ban 🎯',
                startTime: nowTimeStr,
                categoryName: 'Công việc',
                categoryColor: '#38bdf8',
                note: 'Chuông reo liên tục, điện thoại rung theo nhịp giật và hiển thị nút Báo lại 5 phút / Tắt báo thức.'
            }, 0);
        });
    }

    // 10. Xử lý nút Cài đặt App trong Tab 2 của Cài đặt
    const btnSettingsInstallPwa = document.getElementById('btn-settings-install-pwa');
    if (btnSettingsInstallPwa) {
        btnSettingsInstallPwa.addEventListener('click', async () => {
            if (isIosDevice()) {
                showToastNotification('Hãy làm theo hướng dẫn 3 bước bên dưới trên Safari iPhone.', 'iPhone');
                return;
            }
            const success = await promptPwaInstall();
            if (success) {
                showToastNotification('Đang cài đặt ứng dụng vào thiết bị...', 'Thành công');
                btnSettingsInstallPwa.style.display = 'none';
            }
        });
    }

    // 11. Xử lý nút Mở Cấu hình Đám mây trong Tab 3
    const btnSettingsOpenCloud = document.getElementById('btn-settings-open-cloud');
    if (btnSettingsOpenCloud) {
        btnSettingsOpenCloud.addEventListener('click', () => {
            closeSettingsModal();
            import('./cloud.view.js').then(({ openCloudModal }) => {
                if (openCloudModal) openCloudModal();
            });
        });
    }

    // 12. Xử lý nút Mở Cấu hình AI trong Tab 4
    const btnSettingsOpenAi = document.getElementById('btn-settings-open-ai');
    if (btnSettingsOpenAi) {
        btnSettingsOpenAi.addEventListener('click', () => {
            closeSettingsModal();
            import('./ai-scan.view.js').then(({ openAiConfigModal }) => {
                if (openAiConfigModal) openAiConfigModal();
            });
        });
    }

    // 13. Xử lý nút Cài đặt Ứng dụng PWA trên Header (nếu có)
    const isIOS = isIosDevice();
    const isStandalone = isStandaloneApp();

    if (btnInstallPwa) {
        if (isStandalone) {
            btnInstallPwa.style.display = 'none';
        } else if (isIOS) {
            btnInstallPwa.style.display = 'inline-flex';
            const label = btnInstallPwa.querySelector('.btn-install-label');
            if (label) label.textContent = 'Cài vào iPhone';

            btnInstallPwa.addEventListener('click', () => {
                if (modalIosInstall) modalIosInstall.classList.add('is-active');
            });
        } else {
            initPwaInstallPrompt((isReady) => {
                if (isReady && !isStandaloneApp()) {
                    btnInstallPwa.style.display = 'inline-flex';
                    const label = btnInstallPwa.querySelector('.btn-install-label');
                    if (label) label.textContent = 'Cài đặt App';
                } else {
                    btnInstallPwa.style.display = 'none';
                }
            });

            btnInstallPwa.addEventListener('click', async () => {
                const success = await promptPwaInstall();
                if (success) {
                    showToastNotification('Đang cài đặt ứng dụng vào thiết bị...', 'Thành công');
                    btnInstallPwa.style.display = 'none';
                }
            });
        }
    }

    // Xử lý đóng modal hướng dẫn iOS
    if (btnCloseIosModal) {
        btnCloseIosModal.addEventListener('click', () => {
            if (modalIosInstall) modalIosInstall.classList.remove('is-active');
        });
    }

    if (modalIosInstall) {
        modalIosInstall.addEventListener('click', (e) => {
            if (e.target === modalIosInstall) {
                modalIosInstall.classList.remove('is-active');
            }
        });
    }

    // Khởi tạo trạng thái ban đầu
    updateNotificationStateUI();
}
