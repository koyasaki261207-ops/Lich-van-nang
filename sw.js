// Service Worker cho PWA & Thông báo đẩy (Web Push / Local Push) - Lịch Vạn Năng
const CACHE_NAME = 'lich-van-nang-v5';

// Danh sách các tệp giao diện cốt lõi cần lưu vào bộ nhớ cache để chạy Offline 100%
const STATIC_ASSETS = [
    './',
    './index.html',
    './favicon.svg',
    './icon-192.png',
    './icon-512.png',
    './manifest.json',
    './css/base.css',
    './css/layout.css',
    './css/timeline.css',
    './css/components.css',
    './css/calendar.css',
    './css/responsive.css',
    './css/auth.css',
    './js/main.js',
    './js/config/firebase.js',
    './js/core/banner-catalog.js',
    './js/core/calendar-events.js',
    './js/core/color.js',
    './js/core/constants.js',
    './js/core/date-utils.js',
    './js/core/event-layout.js',
    './js/core/holidays.js',
    './js/core/html.js',
    './js/core/lunar.js',
    './js/core/recurrence.js',
    './js/data/avatar-presets.js',
    './js/services/ai.service.js',
    './js/services/auth.service.js',
    './js/services/calendar.service.js',
    './js/services/event.service.js',
    './js/services/notification.service.js',
    './js/services/sync.service.js',
    './js/state/store.js',
    './js/ui/ai-scan.view.js',
    './js/ui/auth.view.js',
    './js/ui/calendar-event-form.js',
    './js/ui/calendar-event-view.js',
    './js/ui/calendar.view.js',
    './js/ui/cloud.view.js',
    './js/ui/day-detail.view.js',
    './js/ui/day-timeline.view.js',
    './js/ui/event-detail.view.js',
    './js/ui/event-form.js',
    './js/ui/image-cropper.view.js',
    './js/ui/notification.view.js',
    './js/ui/tag-filter.view.js',
    './js/ui/timeline.view.js',
    './js/ui/toast.js',
    './js/ui/track-manager.view.js'
];

// 1. Cài đặt Service Worker và nạp trước cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('Một số tài nguyên cache tĩnh không tải được:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. Kích hoạt và dọn dẹp các phiên bản cache cũ
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Xử lý phản hồi yêu cầu tài nguyên mạng (Network-first với cache fallback)
self.addEventListener('fetch', (event) => {
    // Chỉ cache các request HTTP/HTTPS thông thường và cùng nguồn
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Nếu lấy được từ mạng, cập nhật lại bản mới vào cache
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Nếu mất mạng, trả về bản trong cache
                return caches.match(event.request);
            })
    );
});

// 4. LẮNG NGHE SỰ KIỆN THÔNG BÁO ĐẨY (PUSH NOTIFICATION TỪ SERVER / FIREBASE)
self.addEventListener('push', (event) => {
    let payload = {
        title: 'Lịch Vạn Năng',
        body: 'Bạn có một sự kiện hoặc thông báo mới!',
        icon: './icon-192.png',
        badge: './favicon.svg',
        data: { url: './' }
    };

    if (event.data) {
        try {
            const json = event.data.json();
            payload = { ...payload, ...json };
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || './icon-192.png',
        badge: payload.badge || './favicon.svg',
        data: payload.data || { url: './' },
        vibrate: [150, 80, 150],
        requireInteraction: false,
        actions: [
            { action: 'open', title: 'Mở ứng dụng' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// 5. XỬ LÝ KHI NGƯỜI DÙNG NHẤP VÀO THÔNG BÁO
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url) || './';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Nếu đã có tab đang mở, chuyển sang tab đó và focus
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Nếu chưa mở tab nào, mở cửa sổ mới
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// 6. NHẬN TIN NHẮN TỪ CLIENT ĐỂ BẮN THÔNG BÁO TRỰC TIẾP (LOCAL / TEST)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        self.registration.showNotification(title || 'Lịch Vạn Năng', {
            icon: './icon-192.png',
            badge: './favicon.svg',
            vibrate: [150, 80, 150],
            ...options
        });
    }
});
