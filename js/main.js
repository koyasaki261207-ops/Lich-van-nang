// Điểm vào: khởi tạo ứng dụng và nối các module.

import { updateAuthUI } from './ui/auth.view.js';
import { initMonthlyCalendar } from './ui/calendar.view.js';
import { initFirebaseSync } from './ui/cloud.view.js';
import { initNotificationUI } from './ui/notification.view.js';
import { handleScreenResize, renderEvents, renderTimelineScale, scrollToToday, syncColWidthCss, timelineViewport, updateCurrentTime, updatePinnedMonth } from './ui/timeline.view.js';

document.addEventListener('DOMContentLoaded', () => {
    const dayHScrollWrap = document.getElementById('day-h-scroll-wrap');

    const dayHTrackContainer = document.getElementById('day-h-track-container');

    // ========================================================
    // 8. KHỞI CHẠY HỆ THỐNG
    // ========================================================
    syncColWidthCss();

    renderTimelineScale();

    updateCurrentTime();

    renderEvents();

    initMonthlyCalendar();

    updateAuthUI();

    initFirebaseSync();

    initNotificationUI();

    // Cập nhật vị trí vạch thời gian mỗi giây
    setInterval(updateCurrentTime, 1000);

    // Tự động cuộn đến ngày hôm nay sau khi render
    setTimeout(scrollToToday, 50);

    // Lắng nghe sự kiện cuộn để ghim nhãn tháng ở mép trái
    timelineViewport.addEventListener('scroll', updatePinnedMonth);

    window.addEventListener('resize', handleScreenResize);

    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleScreenResize();
            scrollToToday(false);
        }, 150);
    });
});
