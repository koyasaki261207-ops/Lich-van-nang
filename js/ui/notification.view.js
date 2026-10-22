// Giao diện điều khiển Trung tâm Đồng hồ & Chuông thông báo (Clock & Notification Center)
// Chuyên biệt: Đồng hồ số thời gian thực, Tiếng chuông báo, Rung, Báo thức & Bản tin tổng hợp sự kiện

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
    triggerAlarm,
    RINGTONES,
    getSelectedRingtone,
    setSelectedRingtone,
    previewRingtone,
    isVibrationEnabled,
    setVibrationEnabled,
    triggerDeviceVibration,
    isDailyBriefingEnabled,
    setDailyBriefingEnabled,
    getDailyBriefingTime,
    setDailyBriefingTime,
    sendDailyBriefingNotification,
    playNotificationChime
} from '../services/notification.service.js';
import { showToastNotification } from './toast.js';

let liveClockIntervalId = null;

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

// Cập nhật widget đồng hồ số thời gian thực trong Modal
export function updateLiveClock() {
    const digitsEl = document.getElementById('modal-clock-live-digits');
    const dateEl = document.getElementById('modal-clock-live-date');
    const lunarEl = document.getElementById('modal-clock-live-lunar');

    if (!digitsEl && !dateEl) return;

    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    if (digitsEl) {
        digitsEl.textContent = `${h}:${m}:${s}`;
    }

    if (dateEl) {
        const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayOfWeek = weekdays[now.getDay()];
        const d = now.getDate();
        const mon = now.getMonth() + 1;
        const y = now.getFullYear();
        dateEl.textContent = `${dayOfWeek}, ${d}/${mon}/${y}`;
    }

    if (lunarEl) {
        import('../core/lunar.js').then(({ getLunarDate }) => {
            const lunar = getLunarDate(now.getDate(), now.getMonth() + 1, now.getFullYear());
            lunarEl.textContent = `Âm lịch: ${lunar.day}/${lunar.month} (${lunar.yearName || 'Năm mới'})`;
        }).catch(() => { });
    }
}

function startClockTicker() {
    updateLiveClock();
    if (liveClockIntervalId) clearInterval(liveClockIntervalId);
    liveClockIntervalId = setInterval(updateLiveClock, 1000);
}

function stopClockTicker() {
    if (liveClockIntervalId) {
        clearInterval(liveClockIntervalId);
        liveClockIntervalId = null;
    }
}

// Render danh sách chọn tiếng chuông báo (Ringtone Selector)
export function renderRingtonePicker() {
    const listEl = document.getElementById('ringtone-picker-list');
    if (!listEl) return;

    const currentRingtone = getSelectedRingtone();
    listEl.innerHTML = '';

    RINGTONES.forEach(r => {
        const isSelected = r.id === currentRingtone;
        const item = document.createElement('div');
        item.className = `ringtone-item ${isSelected ? 'is-selected' : ''}`;
        item.dataset.ringtoneId = r.id;

        item.innerHTML = `
            <label class="ringtone-label" for="ringtone-radio-${r.id}">
                <input type="radio" name="cal-ringtone-choice" id="ringtone-radio-${r.id}" value="${r.id}" ${isSelected ? 'checked' : ''}>
                <span class="ringtone-radio-custom"></span>
                <span class="ringtone-icon">${r.icon || '🔔'}</span>
                <div class="ringtone-text">
                    <span class="ringtone-name">${r.name}</span>
                    <span class="ringtone-desc">${r.desc}</span>
                </div>
            </label>
            <button type="button" class="btn-preview-ringtone" data-ringtone="${r.id}" title="Nghe thử âm thanh này">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Nghe thử</span>
            </button>
        `;

        // Sự kiện khi chọn radio hoặc click vào toàn bộ thẻ chuông
        const radio = item.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            setSelectedRingtone(r.id);
            document.querySelectorAll('.ringtone-item').forEach(el => el.classList.remove('is-selected'));
            item.classList.add('is-selected');
            previewRingtone(r.id);
            showToastNotification(`Đã chọn chuông: "${r.name}"`, 'Tiếng chuông');
        });

        // Nút bấm Nghe thử riêng biệt
        const btnPreview = item.querySelector('.btn-preview-ringtone');
        btnPreview.addEventListener('click', (e) => {
            e.stopPropagation();
            previewRingtone(r.id);
        });

        listEl.appendChild(item);
    });
}

// Cập nhật cấu hình Rung và Thông báo tổng hợp trên giao diện
export function syncClockSettingsUI() {
    // 1. Tùy chọn rung
    const chkVibration = document.getElementById('chk-vibration-toggle');
    if (chkVibration) {
        chkVibration.checked = isVibrationEnabled();
    }

    // 2. Tùy chọn thông báo tổng hợp
    const chkDailyBriefing = document.getElementById('chk-daily-briefing-toggle');
    const briefingDetails = document.getElementById('daily-briefing-details');
    const inputTime = document.getElementById('input-daily-briefing-time');

    const isBriefingOn = isDailyBriefingEnabled();
    if (chkDailyBriefing) {
        chkDailyBriefing.checked = isBriefingOn;
    }
    if (briefingDetails) {
        briefingDetails.style.display = isBriefingOn ? 'block' : 'none';
    }
    if (inputTime) {
        inputTime.value = getDailyBriefingTime();
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
                listEl.innerHTML = `<div class="noti-upcoming-empty">Chưa có sự kiện nào đặt chuông nhắc hôm nay. Bạn có thể mở bất kỳ ngày nào để tạo sự kiện kèm báo thức!</div>`;
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

                const iconType = '🔔';
                const badgeText = `${iconType} Nhắc nhẹ: ${rLabel}`;

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

// Chuyển tab (giữ để tương thích ngược nếu các module khác còn gọi)
export function switchSettingsTab(targetTabId) {
    updateNotificationStateUI();
    renderUpcomingReminders();
    renderRingtonePicker();
    syncClockSettingsUI();
}

// Mở Modal Đồng hồ & Chuông thông báo
export function openSettingsModal(tabId = 'tab-settings-noti') {
    const modalSettings = document.getElementById('modal-settings') || document.getElementById('modal-notification-center');
    if (!modalSettings) return;

    startClockTicker();
    updateNotificationStateUI();
    renderRingtonePicker();
    syncClockSettingsUI();
    renderUpcomingReminders();

    modalSettings.classList.add('is-active');
    modalSettings.setAttribute('aria-hidden', 'false');
}

// Đóng Modal Đồng hồ & Chuông thông báo
export function closeSettingsModal() {
    stopClockTicker();
    const modalSettings = document.getElementById('modal-settings') || document.getElementById('modal-notification-center');
    if (modalSettings) {
        modalSettings.classList.remove('is-active');
        modalSettings.setAttribute('aria-hidden', 'true');
    }
}

// Tương thích ngược
export function openNotiModal() {
    openSettingsModal();
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
    const btnModalTestVibrate = document.getElementById('btn-modal-test-vibrate');

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

    // Nhấn phím Escape để tắt báo thức hoặc đóng Modal
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

    // 4. Đóng Modal Đồng hồ & Chuông báo
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

    // 5. Xử lý nút Thông báo ở Header (nếu người dùng bấm vào)
    if (btnNotificationToggle) {
        btnNotificationToggle.addEventListener('click', () => {
            const perm = getNotificationPermission();
            if (perm === 'default') {
                requestNotificationPermission()
                    .then((newPerm) => {
                        updateNotificationStateUI();
                        if (newPerm === 'granted') {
                            showToastNotification('Đã bật quyền thông báo thành công!', 'Thông báo');
                            sendTestNotification('Lịch Vạn Năng', 'Chào mừng bạn! Hệ thống chuông báo & đồng hồ đã sẵn sàng. 🎉');
                        } else if (newPerm === 'denied') {
                            showToastNotification('Bạn đã từ chối nhận thông báo.', 'Thông báo');
                        }
                    })
                    .catch(() => {
                        openSettingsModal();
                    });
            } else {
                openSettingsModal();
            }
        });
    }

    // 6. Nút xin cấp quyền trong Modal
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
                    await sendTestNotification('Lịch Vạn Năng', 'Chào mừng bạn! Thiết bị đã sẵn sàng nhận thông báo và báo thức.');
                }
            } catch (err) {
                console.warn(err);
            }
        });
    }

    // 7. Nút Bắn thông báo thử nghiệm (Test Notification)
    if (btnModalTestNoti) {
        btnModalTestNoti.addEventListener('click', async () => {
            try {
                playNotificationChime();
                await sendTestNotification('Lịch Vạn Năng', 'Kiểm tra chuông thông báo thành công trên ' + (isIosDevice() ? 'iPhone' : 'thiết bị của bạn') + '!');
                showToastNotification('Đã ting chuông & gửi thông báo nhắc nhẹ!', 'Thành công');
            } catch (err) {
                showToastNotification('Chưa thể gửi thông báo: ' + (err.message || 'Chưa cấp quyền'), 'Lỗi');
            }
        });
    }

    // 8. Nút Thử nghiệm Báo thức & Rung (Test Alarm & Vibration)
    if (btnModalTestAlarm) {
        btnModalTestAlarm.addEventListener('click', () => {
            closeSettingsModal();
            const now = new Date();
            const nowTimeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            triggerAlarm({
                id: 'test-alarm-sample',
                title: 'Báo thức mẫu: Lịch Vạn Năng ⏰',
                startTime: nowTimeStr,
                categoryName: 'Công việc',
                categoryColor: '#38bdf8',
                note: 'Chuông reo to theo kiểu chuông bạn đã chọn, điện thoại rung dồn dập và có nút Hoãn 5 phút / Tắt báo thức.'
            }, 0);
        });
    }

    // 9. Nút Thử nghiệm Rung thiết bị (Test Vibration)
    if (btnModalTestVibrate) {
        btnModalTestVibrate.addEventListener('click', () => {
            if (!isVibrationEnabled()) {
                showToastNotification('Bạn đang TẮT tùy chọn rung. Hãy gạt công tắc rung bên dưới để bật.', 'Lưu ý');
                return;
            }
            const ok = triggerDeviceVibration([250, 100, 250, 100, 450]);
            if (ok) {
                showToastNotification('Thiết bị đang rung thử nghiệm! 📳', 'Rung thiết bị');
            } else {
                showToastNotification('Trình duyệt đã gửi lệnh rung (chỉ có tác dụng trên thiết bị có motor rung như điện thoại).', 'Rung thiết bị');
            }
        });
    }

    // 10. Sự kiện Toggle Rung thiết bị
    const chkVibrationToggle = document.getElementById('chk-vibration-toggle');
    if (chkVibrationToggle) {
        chkVibrationToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            setVibrationEnabled(enabled);
            if (enabled) {
                triggerDeviceVibration([100]);
                showToastNotification('Đã BẬT rung khi có thông báo & báo thức 📳', 'Rung thiết bị');
            } else {
                showToastNotification('Đã TẮT rung thiết bị', 'Rung thiết bị');
            }
        });
    }

    // 11. Sự kiện Toggle Thông báo tổng hợp hằng ngày
    const chkDailyBriefingToggle = document.getElementById('chk-daily-briefing-toggle');
    const briefingDetails = document.getElementById('daily-briefing-details');
    const inputDailyBriefingTime = document.getElementById('input-daily-briefing-time');
    const btnPreviewDailyBriefing = document.getElementById('btn-preview-daily-briefing');

    if (chkDailyBriefingToggle) {
        chkDailyBriefingToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            setDailyBriefingEnabled(enabled);
            if (briefingDetails) {
                briefingDetails.style.display = enabled ? 'block' : 'none';
            }
            if (enabled) {
                const timeStr = getDailyBriefingTime();
                showToastNotification(`Đã BẬT thông báo tổng hợp lịch trình lúc ${timeStr} mỗi ngày!`, 'Tổng hợp lịch');
            } else {
                showToastNotification('Đã TẮT thông báo tổng hợp lịch trình hằng ngày.', 'Tổng hợp lịch');
            }
        });
    }

    if (inputDailyBriefingTime) {
        inputDailyBriefingTime.addEventListener('change', (e) => {
            const val = e.target.value || '07:30';
            setDailyBriefingTime(val);
            showToastNotification(`Đã đổi giờ nhận thông báo tổng hợp thành: ${val}`, 'Cài đặt giờ');
        });
    }

    if (btnPreviewDailyBriefing) {
        btnPreviewDailyBriefing.addEventListener('click', async () => {
            try {
                await sendDailyBriefingNotification(true);
                showToastNotification('Đã gửi thông báo tổng hợp lịch trình hôm nay!', 'Thành công');
            } catch (err) {
                showToastNotification('Chưa thể gửi tổng hợp: ' + (err.message || 'Lỗi quyền'), 'Lỗi');
            }
        });
    }

    // 12. Xử lý nút Cài đặt Ứng dụng PWA trên Header (nếu có)
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
