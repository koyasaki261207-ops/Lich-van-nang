// Dịch vụ quản lý Thông báo (Web Notification / Push) & PWA (Cài đặt ứng dụng) - Lịch Vạn Năng

let swRegistration = null;
let deferredInstallPrompt = null;
const installListeners = [];

/**
 * Kiểm tra thiết bị/trình duyệt có hỗ trợ Notification và Service Worker không
 */
export function isNotificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Lấy trạng thái cấp quyền thông báo hiện tại
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

/**
 * Đăng ký Service Worker cho trang web
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;

    try {
        const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        swRegistration = reg;

        // Chủ động kiểm tra cập nhật mới từ server
        reg.update().catch(() => {});

        // Khi người dùng quay lại tab hoặc mở lại ứng dụng trên điện thoại, tự kiểm tra cập nhật
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                reg.update().catch(() => {});
            }
        });

        // Lắng nghe cập nhật của Service Worker nếu có
        reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
                installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('Phiên bản mới của Lịch Vạn Năng đã sẵn sàng!');
                    }
                });
            }
        });

        // Lắng nghe khi Service Worker mới đã active và chiếm quyền điều khiển (controllerchange)
        // Tự động reload để người dùng (đặc biệt là trên điện thoại di động) nhận ngay phiên bản mới
        let isReloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!isReloading) {
                isReloading = true;
                window.location.reload();
            }
        });

        return reg;
    } catch (err) {
        console.warn('Đăng ký Service Worker thất bại (có thể do chạy không qua HTTPs/localhost):', err);
        return null;
    }
}

export function getServiceWorkerRegistration() {
    return swRegistration;
}

/**
 * Yêu cầu quyền nhận thông báo từ người dùng
 */
export async function requestNotificationPermission() {
    if (!isNotificationSupported()) {
        throw new Error('Trình duyệt hoặc thiết bị này không hỗ trợ Notification API.');
    }

    try {
        const permission = await Notification.requestPermission();
        return permission;
    } catch (err) {
        console.error('Lỗi khi xin quyền thông báo:', err);
        throw err;
    }
}

/**
 * Bắn một thông báo thử nghiệm (Test Notification) ngay lập tức
 */
export async function sendTestNotification(
    title = 'Lịch Vạn Năng 🎉',
    body = 'Thông báo đã hoạt động thành công trên thiết bị của bạn!'
) {
    if (getNotificationPermission() !== 'granted') {
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
            throw new Error('Chưa được cấp quyền gửi thông báo.');
        }
    }

    const options = {
        body,
        icon: './icon-192.png',
        badge: './favicon.svg',
        vibrate: [150, 80, 150],
        tag: 'test-notification-' + Date.now(),
        data: { url: window.location.href }
    };

    // Ưu tiên hiển thị thông qua Service Worker (chuẩn PWA trên cả Android & PC)
    if (swRegistration && swRegistration.showNotification) {
        await swRegistration.showNotification(title, options);
        return true;
    }

    // Hoặc kiểm tra ready registration
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title, options);
                return true;
            }
        } catch (e) { }
    }

    // Fallback: Sử dụng Notification API truyền thống
    try {
        const noti = new Notification(title, options);
        noti.onclick = () => {
            window.focus();
            noti.close();
        };
        return true;
    } catch (err) {
        console.warn('Lỗi khi bắn thông báo trực tiếp qua constructor:', err);
        throw err;
    }
}

/**
 * Kiểm tra xem người dùng có đang dùng iOS (iPhone, iPad) hay không
 */
export function isIosDevice() {
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isIOS;
}

/**
 * Kiểm tra xem web có đang chạy ở chế độ App độc lập (Standalone PWA) hay không
 */
export function isStandaloneApp() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

/**
 * Đăng ký lắng nghe sự kiện cài đặt PWA (beforeinstallprompt)
 */
export function initPwaInstallPrompt(onPromptReady) {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Ngăn trình duyệt hiển thị thanh mặc định quá sớm
        e.preventDefault();
        deferredInstallPrompt = e;

        if (typeof onPromptReady === 'function') {
            onPromptReady(true);
        }
        installListeners.forEach((cb) => cb(true));
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        console.log('Lịch Vạn Năng đã được cài đặt thành công làm App!');
        if (typeof onPromptReady === 'function') {
            onPromptReady(false);
        }
        installListeners.forEach((cb) => cb(false));
    });
}

export function onInstallAvailabilityChange(callback) {
    if (typeof callback === 'function') {
        installListeners.push(callback);
    }
}

/**
 * Kích hoạt popup cài đặt ứng dụng cho người dùng
 */
export async function promptPwaInstall() {
    if (!deferredInstallPrompt) {
        return false;
    }

    try {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return outcome === 'accepted';
    } catch (err) {
        console.warn('Lỗi khi kích hoạt cài đặt PWA:', err);
        return false;
    }
}

// ========================================================
// 7. ÂM THANH CHUÔNG BÁO & RUNG THIẾT BỊ (VIBRATION & AUDIO)
// ========================================================

let alarmVibrationIntervalId = null;
let alarmAudioCtx = null;
let alarmLoopIntervalId = null;
let isAlarmSoundPlaying = false;

let currentRingingEvent = null;
let alarmClockTimerId = null;
let activeSnoozeList = [];

/**
 * Kích hoạt rung thiết bị (Hỗ trợ tốt nhất trên Chrome / Android Mobile)
 * @param {number|number[]} pattern - Khoảng thời gian rung tính bằng mili-giây
 */
export function triggerDeviceVibration(pattern = [200, 100, 200]) {
    try {
        if ('vibrate' in navigator) {
            return navigator.vibrate(pattern);
        }
    } catch (e) {
        console.warn('Không thể kích hoạt rung thiết bị:', e);
    }
    return false;
}

/**
 * Bắt đầu chuỗi rung báo thức liên tục theo nhịp giật dồn dập
 */
export function startAlarmVibration() {
    stopAlarmVibration();
    // Pattern: Rung 600ms, nghỉ 200ms, rung 600ms, nghỉ 200ms, rung 600ms, nghỉ 600ms
    const alarmPattern = [600, 200, 600, 200, 600, 600];
    triggerDeviceVibration(alarmPattern);

    // Lặp lại chu kỳ rung mỗi 2.5 giây cho đến khi tắt báo thức
    alarmVibrationIntervalId = setInterval(() => {
        triggerDeviceVibration(alarmPattern);
    }, 2500);
}

/**
 * Dừng mọi rung động đang diễn ra trên thiết bị
 */
export function stopAlarmVibration() {
    if (alarmVibrationIntervalId) {
        clearInterval(alarmVibrationIntervalId);
        alarmVibrationIntervalId = null;
    }
    try {
        if ('vibrate' in navigator) {
            navigator.vibrate(0);
        }
    } catch (e) { }
}

/**
 * Phát âm thanh chuông "Ding-Dong" trong trẻo chuẩn Apple/Slack (thông báo thường)
 */
export function playNotificationChime() {
    // Kích hoạt thêm rung nhẹ cùng tiếng chuông
    triggerDeviceVibration([150, 80, 150]);

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;

        // Note 1: A5 (880Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.5);

        // Note 2: E6 (1318.5Hz) - âm hưởng thanh tao, sang trọng
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.5, now + 0.1);
        gain2.gain.setValueAtTime(0.22, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.8);
    } catch (e) {
        console.warn('Không thể phát âm thanh chuông thông báo:', e);
    }
}

/**
 * Phát 1 chu kỳ âm chuông báo thức điện tử réo rắt (Melodic Alarm Chime)
 */
function playAlarmChimeStep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        if (!alarmAudioCtx || alarmAudioCtx.state === 'closed') {
            alarmAudioCtx = new AudioContext();
        }
        if (alarmAudioCtx.state === 'suspended') {
            alarmAudioCtx.resume();
        }

        const ctx = alarmAudioCtx;
        const now = ctx.currentTime;

        // Giai điệu chuông báo thức 4 nốt liên hồi tươi sáng, réo rắt:
        // C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.98Hz) -> C7 (2093Hz)
        const notes = [
            { freq: 1046.5, time: now, dur: 0.12 },
            { freq: 1318.5, time: now + 0.14, dur: 0.12 },
            { freq: 1567.98, time: now + 0.28, dur: 0.14 },
            { freq: 2093.0, time: now + 0.44, dur: 0.28 }
        ];

        notes.forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle'; // Âm sắc dày dặn, ngân vang như chuông thức giấc
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.28, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(time);
            osc.stop(time + dur);
        });
    } catch (e) {
        console.warn('Lỗi phát âm báo thức:', e);
    }
}

/**
 * Bắt đầu reo chuông báo thức liên tục
 */
export function startAlarmSound() {
    if (isAlarmSoundPlaying) return;
    isAlarmSoundPlaying = true;

    // Phát ngay nốt đầu
    playAlarmChimeStep();

    // Lặp lại chu kỳ mỗi 1.1 giây
    alarmLoopIntervalId = setInterval(() => {
        if (!isAlarmSoundPlaying) return;
        playAlarmChimeStep();
    }, 1100);
}

/**
 * Dừng reo chuông báo thức
 */
export function stopAlarmSound() {
    isAlarmSoundPlaying = false;
    if (alarmLoopIntervalId) {
        clearInterval(alarmLoopIntervalId);
        alarmLoopIntervalId = null;
    }
    if (alarmAudioCtx && alarmAudioCtx.state !== 'closed') {
        try {
            alarmAudioCtx.close().catch(() => {});
        } catch (e) { }
        alarmAudioCtx = null;
    }
}

// ========================================================
// 8. ĐIỀU KHIỂN MÀN HÌNH BÁO THỨC & SNOOZE / DISMISS
// ========================================================

function startAlarmClockDisplay() {
    const timeEl = document.getElementById('alarm-clock-time');
    const dateEl = document.getElementById('alarm-clock-date');

    const update = () => {
        const now = new Date();
        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString('vi-VN', { hour12: false });
        }
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    };

    update();
    if (alarmClockTimerId) clearInterval(alarmClockTimerId);
    alarmClockTimerId = setInterval(update, 1000);
}

function stopAlarmClockDisplay() {
    if (alarmClockTimerId) {
        clearInterval(alarmClockTimerId);
        alarmClockTimerId = null;
    }
}

/**
 * Hiển thị màn hình Báo thức toàn diện nổi bật
 */
export function showAlarmModal(evt, reminderMinutes = 0) {
    const modal = document.getElementById('modal-alarm-ringing');
    if (!modal) return;

    const titleEl = document.getElementById('alarm-event-title');
    const timeEl = document.getElementById('alarm-event-time');
    const badgeEl = document.getElementById('alarm-event-badge');
    const noteEl = document.getElementById('alarm-event-note');

    if (titleEl) titleEl.textContent = evt.title || 'Sự kiện đến giờ';
    if (badgeEl) {
        badgeEl.textContent = evt.categoryName || 'Báo thức';
        if (evt.categoryColor) {
            badgeEl.style.backgroundColor = `${evt.categoryColor}25`;
            badgeEl.style.color = evt.categoryColor;
            badgeEl.style.borderColor = evt.categoryColor;
        }
    }

    const timeStr = evt.allDay ? 'Cả ngày' : (evt.startTime ? `lúc ${evt.startTime}` : '');
    const reminderNum = parseInt(reminderMinutes, 10);
    let reminderText = 'Đang reo chuông & rung máy...';
    if (reminderNum > 0) {
        reminderText = `Nhắc trước ${reminderNum} phút (${timeStr})`;
    } else if (timeStr) {
        reminderText = `Diễn ra ${timeStr}`;
    }
    if (timeEl) timeEl.textContent = reminderText;

    if (noteEl) {
        if (evt.note) {
            noteEl.textContent = evt.note;
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }
    }

    startAlarmClockDisplay();
    modal.style.display = 'flex';
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
}

export function hideAlarmModal() {
    const modal = document.getElementById('modal-alarm-ringing');
    if (modal) {
        modal.classList.remove('is-active');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    stopAlarmClockDisplay();
}

/**
 * Kích hoạt báo thức hoàn chỉnh (Reo liên tục + Rung giật nhịp + Màn hình + Web Notification)
 */
export function triggerAlarm(evt, reminderMinutes = 0) {
    currentRingingEvent = evt;

    // 1. Âm thanh báo thức réo rắt liên tục
    startAlarmSound();

    // 2. Rung điện thoại liên tục theo chuỗi
    startAlarmVibration();

    // 3. Mở giao diện Báo thức
    showAlarmModal(evt, reminderMinutes);

    // 4. Bắn Web Notification với cờ requireInteraction: true (ghim trên thiết bị)
    if (getNotificationPermission() === 'granted') {
        const timeStr = evt.allDay ? 'Cả ngày' : (evt.startTime ? `lúc ${evt.startTime}` : '');
        const title = `⏰ BÁO THỨC: ${evt.title || 'Đến giờ sự kiện'}`;
        const body = `Sự kiện đang diễn ra (${timeStr}). Nhấn vào đây để tắt hoặc báo lại sau 5 phút!`;
        const options = {
            body,
            icon: './icon-192.png',
            badge: './favicon.svg',
            vibrate: [600, 200, 600, 200, 600],
            requireInteraction: true,
            tag: `alarm-${evt.id || Date.now()}`,
            data: { url: window.location.href, eventId: evt.id, isAlarm: true }
        };

        if (swRegistration && swRegistration.showNotification) {
            swRegistration.showNotification(title, options).catch(() => {});
        } else if ('Notification' in window) {
            try {
                const noti = new Notification(title, options);
                noti.onclick = () => {
                    window.focus();
                    noti.close();
                };
            } catch (err) { }
        }
    }
}

/**
 * Tắt hoàn toàn báo thức đang reo
 */
export function dismissAlarm() {
    stopAlarmSound();
    stopAlarmVibration();
    hideAlarmModal();
    currentRingingEvent = null;
}

/**
 * Hoãn báo thức (Snooze) - Reo lại sau số phút chỉ định (mặc định 5 phút)
 */
export function snoozeAlarm(minutes = 5) {
    if (!currentRingingEvent) {
        dismissAlarm();
        return;
    }

    const evt = { ...currentRingingEvent };
    const snoozeTimeMs = Date.now() + (minutes * 60 * 1000);

    activeSnoozeList.push({
        event: evt,
        triggerTime: snoozeTimeMs,
        reminderMinutes: 0
    });

    dismissAlarm();

    try {
        import('../ui/toast.js').then(({ showToastNotification }) => {
            showToastNotification(`Đã hoãn báo thức "${evt.title}". Chuông sẽ reo lại sau ${minutes} phút nữa!`, 'Hoãn báo thức 5 phút ⏰');
        });
    } catch (e) { }
}

// ========================================================
// 9. ĐỘNG CƠ NHẮC NHỞ SỰ KIỆN TỰ ĐỘNG (BACKGROUND REMINDER ENGINE)
// ========================================================
let reminderIntervalId = null;

/**
 * Gửi thông báo cho một sự kiện đến giờ nhắc (Chế độ Thông báo nhẹ)
 */
export async function sendEventNotification(evt, reminderMinutes) {
    let title = `🔔 Nhắc nhở: ${evt.title}`;
    let body = '';

    const timeStr = evt.allDay ? 'Cả ngày' : (evt.startTime ? `lúc ${evt.startTime}` : '');
    const reminderNum = parseInt(reminderMinutes, 10);

    if (reminderNum === 0) {
        title = `⏰ Đến giờ: ${evt.title}`;
        body = `Sự kiện đang bắt đầu ${timeStr}.`;
    } else if (reminderNum === 1440) {
        title = `📅 Ngày mai: ${evt.title}`;
        body = `Sự kiện sẽ diễn ra vào ngày mai ${timeStr}.`;
    } else if (reminderNum >= 60) {
        const hours = Math.round(reminderNum / 60);
        body = `Sự kiện sẽ diễn ra sau ${hours} giờ nữa (${timeStr}).`;
    } else {
        body = `Sự kiện sẽ diễn ra sau ${reminderNum} phút nữa (${timeStr}).`;
    }

    if (evt.note) {
        body += `\nGhi chú: ${evt.note}`;
    }

    // 1. Phát âm thanh chuông êm tai & rung nhẹ
    playNotificationChime();

    // 2. Hiện Toast nổi bên trong ứng dụng
    try {
        const { showToastNotification } = await import('../ui/toast.js');
        showToastNotification(body, title);
    } catch (e) { }

    // 3. Bắn thông báo hệ thống qua Service Worker hoặc Notification API nếu đã được cấp quyền
    if (getNotificationPermission() === 'granted') {
        const options = {
            body,
            icon: './icon-192.png',
            badge: './favicon.svg',
            vibrate: [200, 100, 200],
            tag: `calevt-${evt.id}-${reminderNum}`,
            data: { url: window.location.href, eventId: evt.id }
        };

        if (swRegistration && swRegistration.showNotification) {
            swRegistration.showNotification(title, options).catch(() => {});
        } else if ('Notification' in window) {
            try {
                const noti = new Notification(title, options);
                noti.onclick = () => {
                    window.focus();
                    noti.close();
                };
            } catch (err) { }
        }
    }
}

/**
 * Quét toàn bộ sự kiện hôm nay và kiểm tra mốc thời gian nhắc nhở / Báo thức
 */
export async function checkEventReminders() {
    try {
        const now = new Date();
        const curTimeMs = now.getTime();

        // 1. Kiểm tra danh sách Báo Lại (Snooze)
        const remainingSnoozes = [];
        activeSnoozeList.forEach((item) => {
            if (curTimeMs >= item.triggerTime) {
                triggerAlarm(item.event, item.reminderMinutes);
            } else {
                remainingSnoozes.push(item);
            }
        });
        activeSnoozeList = remainingSnoozes;

        // 2. Kiểm tra danh sách sự kiện lịch
        const { loadCalEvents } = await import('./calendar.service.js');
        const { isCalEventOnDate } = await import('../core/calendar-events.js');

        const events = loadCalEvents();
        if (!events || !events.length) return;

        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        const curDate = now.getDate();

        const pad = (n) => String(n).padStart(2, '0');
        const todayStr = `${curYear}-${pad(curMonth + 1)}-${pad(curDate)}`;

        // Tính ngày mai (để phục vụ mốc nhắc trước 1 ngày = 1440 phút)
        const tomorrow = new Date(curYear, curMonth, curDate + 1);
        const tomorrowYear = tomorrow.getFullYear();
        const tomorrowMonth = tomorrow.getMonth();
        const tomorrowDate = tomorrow.getDate();
        const tomorrowStr = `${tomorrowYear}-${pad(tomorrowMonth + 1)}-${pad(tomorrowDate)}`;

        events.forEach((evt) => {
            if (!evt || !evt.id) return;
            const reminderVal = evt.reminder !== undefined ? String(evt.reminder) : '10';
            if (reminderVal === 'none' || !reminderVal) return;

            const reminderMinutes = parseInt(reminderVal, 10);
            if (isNaN(reminderMinutes)) return;

            // Xử lý sự kiện diễn ra hôm nay hoặc ngày mai (với mốc 1440 phút)
            const isToday = isCalEventOnDate(evt, curYear, curMonth, curDate);
            const isTomorrow = (reminderMinutes >= 1440) && isCalEventOnDate(evt, tomorrowYear, tomorrowMonth, tomorrowDate);

            if (!isToday && !isTomorrow) return;

            const targetDateStr = isToday ? todayStr : tomorrowStr;
            let eventTimeHour = 9;
            let eventTimeMin = 0;

            if (evt.allDay) {
                // Sự kiện cả ngày: Mốc diễn ra tính từ 08:00 sáng
                eventTimeHour = 8;
                eventTimeMin = 0;
            } else if (evt.startTime) {
                const parts = evt.startTime.split(':').map(Number);
                eventTimeHour = parts[0] || 0;
                eventTimeMin = parts[1] || 0;
            }

            const targetDateParts = targetDateStr.split('-').map(Number);
            const eventTargetDate = new Date(targetDateParts[0], targetDateParts[1] - 1, targetDateParts[2], eventTimeHour, eventTimeMin, 0);
            const eventTargetMs = eventTargetDate.getTime();

            // Thời điểm cần phát chuông nhắc = Thời điểm sự kiện - số phút nhắc
            const triggerTimeMs = eventTargetMs - (reminderMinutes * 60 * 1000);

            // Kiểm tra xem hiện tại có nằm trong cửa sổ kích hoạt [-30s, +90s] không
            const diffMs = curTimeMs - triggerTimeMs;
            if (diffMs >= -30000 && diffMs <= 90000) {
                const dedupeKey = `reminded_${evt.id}_${targetDateStr}_${reminderMinutes}`;
                if (!sessionStorage.getItem(dedupeKey)) {
                    sessionStorage.setItem(dedupeKey, String(Date.now()));
                    
                    // Phân biệt kiểu Báo thức (Alarm + Rung + Popup) hay Thông báo thường
                    const alertType = evt.alertType || 'alarm';
                    if (alertType === 'alarm') {
                        triggerAlarm(evt, reminderMinutes);
                    } else {
                        sendEventNotification(evt, reminderMinutes);
                    }
                }
            }
        });
    } catch (err) {
        console.warn('Lỗi trong chu kỳ quét nhắc nhở sự kiện:', err);
    }
}

/**
 * Khởi động động cơ đếm giờ kiểm tra sự kiện ngầm
 */
export function startEventReminderEngine() {
    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
    }
    // Chạy kiểm tra ngay lập tức
    checkEventReminders();
    // Lặp lại mỗi 20 giây
    reminderIntervalId = setInterval(checkEventReminders, 20000);
}


