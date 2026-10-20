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
