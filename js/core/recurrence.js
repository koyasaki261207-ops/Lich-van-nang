// Thuật toán sự kiện lặp lại (hàm thuần, không đụng DOM).

import { parseLocalDateString, toDateTimeLocalString } from './date-utils.js';
export function addMonthsToDate(date, months) {
    const d = new Date(date);
    const originalDay = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== originalDay) {
        d.setDate(0); // Về ngày cuối cùng của tháng nếu tháng mục tiêu có ít ngày hơn
    }
    return d;
}

export function addYearsToDate(date, years) {
    const d = new Date(date);
    const originalDay = d.getDate();
    d.setFullYear(d.getFullYear() + years);
    if (d.getDate() !== originalDay) {
        d.setDate(0);
    }
    return d;
}

// Tính mốc kết thúc chính xác theo lịch cho từng chu kỳ lặp lại (đặc biệt là theo tháng/năm)
// Tránh việc tháng 31 ngày làm hụt mất 1 ngày (VD: rơi vào ngày 15 thay vì ngày 16)
export function getOccurrenceEnd(curStart, repeatType, baseStartDate, baseEndDate) {
    if (!baseStartDate || !baseEndDate || isNaN(baseStartDate.getTime()) || isNaN(baseEndDate.getTime())) {
        return new Date(curStart.getTime() + 24 * 3600000);
    }

    if (repeatType === 'monthly') {
        const monthSpan = (baseEndDate.getFullYear() - baseStartDate.getFullYear()) * 12 + (baseEndDate.getMonth() - baseStartDate.getMonth());
        const endMonthDate = addMonthsToDate(curStart, monthSpan);
        const targetEndDay = baseEndDate.getDate();
        const targetEndHour = baseEndDate.getHours();
        const targetEndMin = baseEndDate.getMinutes();
        const targetEndSec = baseEndDate.getSeconds() || 0;

        let curEnd = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth(), targetEndDay, targetEndHour, targetEndMin, targetEndSec);
        // Nếu tháng mục tiêu có ít ngày hơn targetEndDay (VD tháng 2 có 28 ngày):
        if (curEnd.getMonth() !== ((endMonthDate.getMonth() + 12) % 12)) {
            curEnd = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() + 1, 0, targetEndHour, targetEndMin, targetEndSec);
        }
        if (curEnd.getTime() > curStart.getTime()) {
            return curEnd;
        }
    } else if (repeatType === 'yearly') {
        const yearSpan = baseEndDate.getFullYear() - baseStartDate.getFullYear();
        const endYearDate = addYearsToDate(curStart, yearSpan);
        const targetEndMonth = baseEndDate.getMonth();
        const targetEndDay = baseEndDate.getDate();
        const targetEndHour = baseEndDate.getHours();
        const targetEndMin = baseEndDate.getMinutes();
        const targetEndSec = baseEndDate.getSeconds() || 0;

        let curEnd = new Date(endYearDate.getFullYear(), targetEndMonth, targetEndDay, targetEndHour, targetEndMin, targetEndSec);
        if (curEnd.getMonth() !== targetEndMonth) {
            curEnd = new Date(endYearDate.getFullYear(), targetEndMonth + 1, 0, targetEndHour, targetEndMin, targetEndSec);
        }
        if (curEnd.getTime() > curStart.getTime()) {
            return curEnd;
        }
    }

    // Với chu kỳ hàng ngày hoặc hàng tuần: cộng theo chênh lệch thời gian thực
    const durationMs = baseEndDate.getTime() - baseStartDate.getTime();
    return new Date(curStart.getTime() + Math.max(3600000, durationMs));
}

export function calculateRepeatCount(repeatType, startValStr, endValStr, isForever, { timelineEnd, baseStartVal = '', baseEndVal = '', endUserModified = false }) {
    if (!repeatType || repeatType === 'none') return 1;
    if (!startValStr) return 0;

    const dStart = parseLocalDateString(startValStr);
    if (!dStart) return 0;

    const maxTimelineEnd = new Date(timelineEnd.getFullYear(), timelineEnd.getMonth(), timelineEnd.getDate(), 23, 59, 59, 999);

    let limitEnd;
    if (isForever) {
        // Vĩnh viễn: Chỉ tạo tối đa trong phạm vi hiển thị của timeline (không vượt rìa phải)
        limitEnd = maxTimelineEnd;
    } else {
        if (!endValStr) return 0;
        const dEnd = parseLocalDateString(endValStr);
        if (!dEnd) return 0;
        limitEnd = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate(), 23, 59, 59, 999);
        if (limitEnd.getTime() < dStart.getTime()) return -1;
        // Không vượt quá rìa hiển thị của timeline
        if (limitEnd.getTime() > maxTimelineEnd.getTime()) {
            limitEnd = maxTimelineEnd;
        }
    }

    // Ước lượng thời lượng (duration) của sự kiện
    let estDurationMs = 24 * 3600000;
    let baseStartDate = null;
    let baseEndDate = null;
    if (baseStartVal && baseEndVal) {
        const s = new Date(baseStartVal);
        const e = new Date(baseEndVal);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e.getTime() > s.getTime()) {
            baseStartDate = s;
            baseEndDate = e;
            estDurationMs = e.getTime() - s.getTime();
            if (repeatType === 'daily' && estDurationMs > 24 * 3600000 && !endUserModified) {
                estDurationMs = 24 * 3600000;
            } else if (repeatType === 'weekly' && estDurationMs > 7 * 24 * 3600000 && !endUserModified) {
                estDurationMs = 7 * 24 * 3600000;
            }
        }
    }

    let cur = new Date(dStart);
    let count = 0;
    const maxOccurrences = 200;

    while (cur.getTime() <= limitEnd.getTime() && count < maxOccurrences) {
        const occEnd = (baseStartDate && baseEndDate)
            ? getOccurrenceEnd(cur, repeatType, baseStartDate, baseEndDate)
            : new Date(cur.getTime() + estDurationMs);

        // Quy tắc: Khi có đủ không gian hiển thị thêm sự kiện lặp lại nữa mới tạo ra
        if (count > 0 && (occEnd.getTime() > limitEnd.getTime())) {
            break;
        }
        if (cur.getTime() >= limitEnd.getTime()) {
            break;
        }
        count++;
        if (repeatType === 'daily') {
            cur.setDate(cur.getDate() + 1);
        } else if (repeatType === 'weekly') {
            cur.setDate(cur.getDate() + 7);
        } else if (repeatType === 'monthly') {
            cur = addMonthsToDate(cur, 1);
        } else if (repeatType === 'yearly') {
            cur = addYearsToDate(cur, 1);
        } else {
            break;
        }
    }
    return count;
}
