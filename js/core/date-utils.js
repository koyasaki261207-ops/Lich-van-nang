// Tiện ích ngày giờ (múi giờ người dùng): định dạng, chuyển đổi input, đếm ngược.

import { MS_PER_DAY, WEEKDAYS_VN } from './constants.js';

// Kiểm tra 2 ngày có cùng ngày/tháng/năm hay không
export function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

// Tính toán chữ đếm ngược: nếu từ 1 ngày trở lên dạng xdyh (VD: 17d 20h, 1d 11h),
// nếu dưới 1 ngày thì hiển thị dạng xx:xx:xx (VD: 08:22:18)
export function formatDuration(diffMs) {
    if (diffMs <= 0) return '';
    const diffDays = Math.floor(diffMs / MS_PER_DAY);
    if (diffDays > 0) {
        const diffHours = Math.floor((diffMs % MS_PER_DAY) / (3600 * 1000));
        return `${diffDays}d ${diffHours}h`;
    }
    const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export function formatDateTimeVn(isoStr) {
    try {
        const d = new Date(isoStr);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    } catch {
        return isoStr;
    }
}

// ========================================================
// 7.9B TÍNH NĂNG LẶP LẠI SỰ KIỆN (Recurring Event Engine)
// Hỗ trợ: mỗi ngày / mỗi tuần / mỗi tháng / mỗi năm
// Thời gian lặp từ: xx/xx/xxxx - xx/xx/xxxx
// ========================================================
export function toDateInputVal(d) {
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeInputVal(d) {
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocalDateString(dateStr) {
    if (!dateStr) return null;
    dateStr = String(dateStr).trim();
    // Hỗ trợ cả dấu gạch chéo '/' và dấu gạch ngang '-'
    const sep = dateStr.includes('/') ? '/' : (dateStr.includes('-') ? '-' : null);
    if (sep) {
        const rawParts = dateStr.split(sep).map(p => parseInt(p, 10));
        if (rawParts.length === 3 && !rawParts.some(isNaN)) {
            // Định dạng YYYY-MM-DD hoặc YYYY/MM/DD (phần đầu có 4 chữ số)
            if (rawParts[0] > 999) {
                return new Date(rawParts[0], rawParts[1] - 1, rawParts[2]);
            }
            // Định dạng DD-MM-YYYY hoặc DD/MM/YYYY (phần cuối có 4 chữ số)
            if (rawParts[2] > 999) {
                return new Date(rawParts[2], rawParts[1] - 1, rawParts[0]);
            }
        }
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// Chuyển Date object sang định dạng chuỗi YYYY-MM-DDTHH:mm theo giờ địa phương
export function toDateTimeLocalString(d) {
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDetailDateTime(date) {
    if (!date || isNaN(date.getTime())) return '';
    const dayName = WEEKDAYS_VN[date.getDay()];
    const day = date.getDate();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${dayName}, ${day} Th${month} ${year} ${hours}:${minutes}`;
}

export function formatDetailDateRange(startDate, endDate) {
    const startStr = formatDetailDateTime(startDate);
    const endStr = formatDetailDateTime(endDate);
    if (!endStr) return startStr;
    return `${startStr} - ${endStr}`;
}
