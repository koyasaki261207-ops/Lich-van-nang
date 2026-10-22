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
// 7. CẤU HÌNH TIẾNG CHUÔNG BÁO, RUNG & THÔNG BÁO TỔNG HỢP
// ========================================================

export const RINGTONES = [
    { id: 'classic-chime', name: 'Chuông ngân vang', desc: 'Trong trẻo, tươi sáng (Marimba)', icon: '🔔' },
    { id: 'melodic', name: 'Điện tử réo rắt', desc: 'Réo rắt, dồn dập, dễ thức giấc', icon: '⏰' },
    { id: 'radar', name: 'Kỹ thuật số xung nhịp', desc: 'Âm thanh hiện đại, dứt khoát', icon: '📟' },
    { id: 'gentle-morning', name: 'Bình minh êm dịu', desc: 'Nhẹ nhàng, thư thái, bình yên', icon: '🕊️' },
    { id: 'cosmic-glow', name: 'Vũ trụ huyền ảo', desc: 'Âm ngân vang không gian ngân hà', icon: '🌌' }
];

export function getSelectedRingtone() {
    return localStorage.getItem('cal_alarm_ringtone') || 'classic-chime';
}

export function setSelectedRingtone(id) {
    localStorage.setItem('cal_alarm_ringtone', id || 'classic-chime');
}

export function isVibrationEnabled() {
    return localStorage.getItem('cal_vibration_enabled') !== 'false';
}

export function setVibrationEnabled(enabled) {
    localStorage.setItem('cal_vibration_enabled', enabled ? 'true' : 'false');
}

export function isDailyBriefingEnabled() {
    return localStorage.getItem('cal_daily_briefing_enabled') === 'true';
}

export function setDailyBriefingEnabled(enabled) {
    localStorage.setItem('cal_daily_briefing_enabled', enabled ? 'true' : 'false');
}

export function getDailyBriefingTime() {
    return localStorage.getItem('cal_daily_briefing_time') || '07:00';
}

export function setDailyBriefingTime(timeStr) {
    localStorage.setItem('cal_daily_briefing_time', timeStr || '07:00');
}

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
    // Nếu người dùng tắt rung trong cài đặt, không rung
    if (!isVibrationEnabled()) return false;

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
    if (!isVibrationEnabled()) return;

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
 * Tổng hợp phát nốt nhạc cụ thể với Web Audio API
 */
function synthesizeNote(ctx, freq, type, startTime, duration, maxGain = 0.28) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

/**
 * Phát 1 chu kỳ giai điệu của kiểu chuông đã chọn
 */
export function playRingtoneById(id, ctx, startTime) {
    const ringtone = id || getSelectedRingtone();

    switch (ringtone) {
        case 'melodic': {
            // Điện tử réo rắt: C6 -> E6 -> G6 -> C7
            synthesizeNote(ctx, 1046.5, 'triangle', startTime, 0.12, 0.3);
            synthesizeNote(ctx, 1318.5, 'triangle', startTime + 0.14, 0.12, 0.3);
            synthesizeNote(ctx, 1567.98, 'triangle', startTime + 0.28, 0.14, 0.3);
            synthesizeNote(ctx, 2093.0, 'triangle', startTime + 0.44, 0.28, 0.32);
            break;
        }
        case 'radar': {
            // Kỹ thuật số xung nhịp: Beep Beep kép dứt khoát
            synthesizeNote(ctx, 880, 'square', startTime, 0.08, 0.18);
            synthesizeNote(ctx, 1760, 'square', startTime + 0.10, 0.12, 0.2);
            synthesizeNote(ctx, 880, 'square', startTime + 0.30, 0.08, 0.18);
            synthesizeNote(ctx, 1760, 'square', startTime + 0.40, 0.18, 0.22);
            break;
        }
        case 'gentle-morning': {
            // Bình minh êm dịu: Hợp âm D5 -> F#5 -> A5 -> D6 ngân nga
            synthesizeNote(ctx, 587.33, 'sine', startTime, 0.6, 0.22);
            synthesizeNote(ctx, 739.99, 'sine', startTime + 0.15, 0.7, 0.24);
            synthesizeNote(ctx, 880.0, 'sine', startTime + 0.30, 0.8, 0.25);
            synthesizeNote(ctx, 1174.66, 'sine', startTime + 0.48, 1.1, 0.28);
            break;
        }
        case 'cosmic-glow': {
            // Vũ trụ huyền ảo: Tần số quét âm vang không gian
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, startTime);
            osc.frequency.exponentialRampToValueAtTime(1046.5, startTime + 0.35);
            osc.frequency.exponentialRampToValueAtTime(1318.5, startTime + 0.7);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.26, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.9);
            break;
        }
        case 'classic-chime':
        default: {
            // Chuông ngân vang: G5 -> C6 -> E6 -> G6
            synthesizeNote(ctx, 783.99, 'sine', startTime, 0.3, 0.25);
            synthesizeNote(ctx, 1046.5, 'sine', startTime + 0.12, 0.35, 0.28);
            synthesizeNote(ctx, 1318.51, 'sine', startTime + 0.26, 0.4, 0.28);
            synthesizeNote(ctx, 1567.98, 'sine', startTime + 0.42, 0.65, 0.3);
            break;
        }
    }
}

/**
 * Nghe thử 1 kiểu chuông bất kỳ khi người dùng bấm vào danh sách âm thanh
 */
export function previewRingtone(ringtoneId) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        playRingtoneById(ringtoneId, ctx, ctx.currentTime);

        // Kèm rung nhẹ nếu đang bật rung
        if (isVibrationEnabled()) {
            triggerDeviceVibration([80, 50, 80]);
        }
    } catch (e) {
        console.warn('Lỗi nghe thử chuông:', e);
    }
}

/**
 * Phát âm thanh chuông thông báo thường
 */
export function playNotificationChime() {
    if (isVibrationEnabled()) {
        triggerDeviceVibration([150, 80, 150]);
    }

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        playRingtoneById(getSelectedRingtone(), ctx, ctx.currentTime);
    } catch (e) {
        console.warn('Không thể phát âm thanh chuông thông báo:', e);
    }
}

/**
 * Phát 1 chu kỳ âm chuông báo thức theo kiểu chuông người dùng đã chọn
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
        playRingtoneById(getSelectedRingtone(), ctx, now);
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
 * Gửi thông báo tổng hợp lịch trình các sự kiện trong ngày
 */
export async function sendDailyBriefingNotification(isTest = false) {
    try {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        const curDate = now.getDate();

        const { loadCalEvents } = await import('./calendar.service.js');
        const { isCalEventOnDate } = await import('../core/calendar-events.js');
        const { getLunarDate } = await import('../core/lunar.js');
        const { SOLAR_HOLIDAYS, LUNAR_HOLIDAYS } = await import('../core/holidays.js');

        const allEvents = loadCalEvents() || [];
        const todayEvents = allEvents.filter(e => e && e.id && isCalEventOnDate(e, curYear, curMonth, curDate));

        const lunar = getLunarDate(curDate, curMonth + 1, curYear);
        const solarKey = `${curDate}-${curMonth + 1}`;
        const lunarKey = `${lunar.day}-${lunar.month}`;
        const holiday = SOLAR_HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey] || (lunar.day === 1 ? 'Mùng một Âm lịch' : (lunar.day === 15 ? 'Ngày Rằm Âm lịch' : ''));

        const title = isTest 
            ? `📋 [Thử nghiệm] Tổng hợp lịch trình (${curDate}/${curMonth + 1})`
            : `📋 Lịch trình hôm nay (${curDate}/${curMonth + 1})`;

        let body = '';
        if (holiday) {
            body += `🎉 Hôm nay là ${holiday}.\n`;
        }

        if (todayEvents.length === 0) {
            body += 'Hôm nay bạn không có lịch trình nào. Chúc bạn một ngày mới an lành, thảnh thơi và tràn đầy năng lượng!';
        } else {
            const previewTitles = todayEvents.slice(0, 3).map(e => {
                const time = e.allDay ? 'Cả ngày' : (e.startTime || '09:00');
                return `• ${e.title} (${time})`;
            }).join('\n');
            const moreCount = todayEvents.length - 3;
            const moreText = moreCount > 0 ? `\n... và ${moreCount} sự kiện khác.` : '';
            body += `Bạn có ${todayEvents.length} sự kiện & công việc:\n${previewTitles}${moreText}`;
        }

        // Phát chuông báo và rung
        playNotificationChime();

        // Hiển thị Toast
        try {
            const { showToastNotification } = await import('../ui/toast.js');
            showToastNotification(body, title);
        } catch (e) { }

        // Bắn thông báo hệ thống
        if (getNotificationPermission() === 'granted') {
            const options = {
                body,
                icon: './icon-192.png',
                badge: './favicon.svg',
                vibrate: isVibrationEnabled() ? [250, 100, 250] : undefined,
                tag: `daily-briefing-${curDate}-${curMonth + 1}-${isTest ? Date.now() : ''}`,
                data: { url: window.location.href }
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
        return true;
    } catch (err) {
        console.warn('Lỗi khi gửi thông báo tổng hợp sự kiện:', err);
        return false;
    }
}

/**
 * Kiểm tra mốc giờ gửi thông báo tổng hợp hằng ngày
 */
export function checkDailyBriefing() {
    if (!isDailyBriefingEnabled()) return;

    const targetTime = getDailyBriefingTime(); // 'HH:mm'
    if (!targetTime) return;

    const now = new Date();
    const curHour = String(now.getHours()).padStart(2, '0');
    const curMin = String(now.getMinutes()).padStart(2, '0');
    const curTimeStr = `${curHour}:${curMin}`;

    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDate = String(now.getDate()).padStart(2, '0');
    const todayStr = `${curYear}-${curMonth}-${curDate}`;

    const lastSentDate = localStorage.getItem('cal_daily_briefing_last_sent');

    if (curTimeStr === targetTime && lastSentDate !== todayStr) {
        localStorage.setItem('cal_daily_briefing_last_sent', todayStr);
        sendDailyBriefingNotification(false);
    }
}

/**
 * Quét toàn bộ sự kiện hôm nay và kiểm tra mốc thời gian nhắc nhở / Báo thức
 */
export async function checkEventReminders() {
    try {
        // Kiểm tra thông báo tổng hợp đầu ngày
        checkDailyBriefing();

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


