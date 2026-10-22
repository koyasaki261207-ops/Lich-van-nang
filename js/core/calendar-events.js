// Xử lý sự kiện lịch riêng: kiểm tra ngày, nhãn lặp lại, định dạng thời gian (hàm thuần).

export function isCalEventOnDate(evt, cellYear, cellMonth, dayNum) {
    const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const sDate = evt.startDate || evt.date;
    const eDate = evt.endDate || evt.date || sDate;

    if (!sDate) return false;

    // 1. Ngày bị loại trừ khỏi chuỗi lặp (người dùng chọn "Chỉ xóa sự kiện này")
    if (evt.excludedDates && Array.isArray(evt.excludedDates) && evt.excludedDates.includes(cellDateStr)) {
        return false;
    }

    // 2. Giới hạn dừng lặp (người dùng chọn "Dừng lặp lại từ kỳ này trở đi")
    if (evt.repeatLimitEnd && cellDateStr > evt.repeatLimitEnd) {
        return false;
    }

    if (!evt.repeat || evt.repeat === 'none') {
        return cellDateStr >= sDate && cellDateStr <= eDate;
    }
    if (cellDateStr < sDate) return false;

    const sParts = sDate.split('-').map(Number);
    const evtStartDate = new Date(sParts[0], sParts[1] - 1, sParts[2]);

    let durationDays = 0;
    if (eDate && eDate >= sDate) {
        const eParts = eDate.split('-').map(Number);
        const evtEndDate = new Date(eParts[0], eParts[1] - 1, eParts[2]);
        durationDays = Math.max(0, Math.round((evtEndDate.getTime() - evtStartDate.getTime()) / 86400000));
    }

    const cellDate = new Date(cellYear, cellMonth, dayNum);
    const interval = Math.max(1, parseInt(evt.repeatInterval || evt.interval || 1, 10) || 1);

    if (evt.repeat === 'daily') {
        const diffDays = Math.round((cellDate.getTime() - evtStartDate.getTime()) / 86400000);
        if (diffDays < 0) return false;
        const offset = diffDays % interval;
        if (offset > durationDays) return false;
        const occStartDate = new Date(cellDate.getTime() - offset * 86400000);
        const occStartDateStr = `${occStartDate.getFullYear()}-${String(occStartDate.getMonth() + 1).padStart(2, '0')}-${String(occStartDate.getDate()).padStart(2, '0')}`;
        if (evt.excludedDates && Array.isArray(evt.excludedDates) && evt.excludedDates.includes(occStartDateStr)) {
            return false;
        }
        if (evt.repeatLimitEnd && occStartDateStr > evt.repeatLimitEnd) {
            return false;
        }
        return true;
    }

    if (evt.repeat === 'weekly') {
        const diffDays = Math.round((cellDate.getTime() - evtStartDate.getTime()) / 86400000);
        if (diffDays < 0) return false;
        const cycleDays = interval * 7;
        const offset = diffDays % cycleDays;
        if (offset > durationDays) return false;
        const occStartDate = new Date(cellDate.getTime() - offset * 86400000);
        const occStartDateStr = `${occStartDate.getFullYear()}-${String(occStartDate.getMonth() + 1).padStart(2, '0')}-${String(occStartDate.getDate()).padStart(2, '0')}`;
        if (evt.excludedDates && Array.isArray(evt.excludedDates) && evt.excludedDates.includes(occStartDateStr)) {
            return false;
        }
        if (evt.repeatLimitEnd && occStartDateStr > evt.repeatLimitEnd) {
            return false;
        }
        return true;
    }

    if (evt.repeat === 'monthly') {
        const startYear = sParts[0];
        const startMonth = sParts[1] - 1;
        const startDay = sParts[2];

        const monthDiff = (cellYear - startYear) * 12 + (cellMonth - startMonth);
        if (monthDiff < 0) return false;
        if ((monthDiff % interval) !== 0) return false;

        const daysInCurrentMonth = new Date(cellYear, cellMonth + 1, 0).getDate();
        const actualStartDay = Math.min(startDay, daysInCurrentMonth);
        const occStartDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(actualStartDay).padStart(2, '0')}`;
        if (evt.excludedDates && Array.isArray(evt.excludedDates) && evt.excludedDates.includes(occStartDateStr)) {
            return false;
        }
        if (evt.repeatLimitEnd && occStartDateStr > evt.repeatLimitEnd) {
            return false;
        }

        const occStartDate = new Date(cellYear, cellMonth, actualStartDay);
        const dayDiffInOcc = Math.round((cellDate.getTime() - occStartDate.getTime()) / 86400000);
        return dayDiffInOcc >= 0 && dayDiffInOcc <= durationDays;
    }

    if (evt.repeat === 'yearly') {
        const startYear = sParts[0];
        const startMonth = sParts[1] - 1;
        const startDay = sParts[2];

        const yearDiff = cellYear - startYear;
        if (yearDiff < 0) return false;
        if ((yearDiff % interval) !== 0) return false;
        if (cellMonth !== startMonth) return false;

        const daysInCurrentMonth = new Date(cellYear, cellMonth + 1, 0).getDate();
        const actualStartDay = Math.min(startDay, daysInCurrentMonth);
        const occStartDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(actualStartDay).padStart(2, '0')}`;
        if (evt.excludedDates && Array.isArray(evt.excludedDates) && evt.excludedDates.includes(occStartDateStr)) {
            return false;
        }
        if (evt.repeatLimitEnd && occStartDateStr > evt.repeatLimitEnd) {
            return false;
        }

        const occStartDate = new Date(cellYear, cellMonth, actualStartDay);
        const dayDiffInOcc = Math.round((cellDate.getTime() - occStartDate.getTime()) / 86400000);
        return dayDiffInOcc >= 0 && dayDiffInOcc <= durationDays;
    }

    return false;
}

// Tính ngày bắt đầu của kỳ lặp chứa targetDateStr
export function getCalEventOccStartDateStr(evt, targetDateStr) {
    const sDate = evt.startDate || evt.date;
    if (!sDate) return targetDateStr;
    if (!evt.repeat || evt.repeat === 'none') return sDate;

    const parts = targetDateStr.split('-').map(Number);
    const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const sParts = sDate.split('-').map(Number);
    const evtStartDate = new Date(sParts[0], sParts[1] - 1, sParts[2]);

    const interval = Math.max(1, parseInt(evt.repeatInterval || evt.interval || 1, 10) || 1);

    if (evt.repeat === 'daily') {
        const diffDays = Math.round((targetDate.getTime() - evtStartDate.getTime()) / 86400000);
        if (diffDays < 0) return targetDateStr;
        const offset = diffDays % interval;
        const occDate = new Date(targetDate.getTime() - offset * 86400000);
        return `${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`;
    }

    if (evt.repeat === 'weekly') {
        const diffDays = Math.round((targetDate.getTime() - evtStartDate.getTime()) / 86400000);
        if (diffDays < 0) return targetDateStr;
        const cycleDays = interval * 7;
        const offset = diffDays % cycleDays;
        const occDate = new Date(targetDate.getTime() - offset * 86400000);
        return `${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, '0')}-${String(occDate.getDate()).padStart(2, '0')}`;
    }

    if (evt.repeat === 'monthly' || evt.repeat === 'yearly') {
        const cellYear = parts[0];
        const cellMonth = parts[1] - 1;
        const startDay = sParts[2];
        const daysInCurrentMonth = new Date(cellYear, cellMonth + 1, 0).getDate();
        const actualStartDay = Math.min(startDay, daysInCurrentMonth);
        return `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(actualStartDay).padStart(2, '0')}`;
    }

    return targetDateStr;
}

export function formatCalEventTimeRange(evt) {
    if (evt.allDay) return 'Cả ngày';
    const sDate = evt.startDate || evt.date || '';
    const eDate = evt.endDate || evt.date || sDate;
    const sTime = evt.startTime || evt.time || '';
    const eTime = evt.endTime || '';

    if (!sDate || sDate === eDate) {
        if (sTime && eTime) return `${sTime} - ${eTime}`;
        return sTime || eTime || 'Cả ngày';
    }
    // Khác ngày
    const sPart = sTime ? `${sDate} ${sTime}` : sDate;
    const ePart = eTime ? `${eDate} ${eTime}` : eDate;
    return `${sPart} ➔ ${ePart}`;
}

export function getRepeatLabel(repeatOrEvt, repeatInterval = 1) {
    let repeat = repeatOrEvt;
    let interval = repeatInterval;
    if (repeatOrEvt && typeof repeatOrEvt === 'object') {
        repeat = repeatOrEvt.repeat;
        interval = repeatOrEvt.repeatInterval || repeatOrEvt.interval || 1;
    }
    interval = Math.max(1, parseInt(interval || 1, 10) || 1);
    if (!repeat || repeat === 'none') return 'Không';

    if (interval === 1) {
        switch (repeat) {
            case 'daily': return 'Mỗi ngày';
            case 'weekly': return 'Mỗi tuần';
            case 'monthly': return 'Mỗi tháng';
            case 'yearly': return 'Mỗi năm';
            default: return 'Không';
        }
    }

    switch (repeat) {
        case 'daily': return `Mỗi ${interval} ngày`;
        case 'weekly': return `Mỗi ${interval} tuần`;
        case 'monthly': return `Mỗi ${interval} tháng`;
        case 'yearly': return `Mỗi ${interval} năm`;
        default: return 'Không';
    }
}
