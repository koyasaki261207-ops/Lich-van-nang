// Xử lý sự kiện lịch riêng: kiểm tra ngày, nhãn lặp lại, định dạng thời gian (hàm thuần).

export function isCalEventOnDate(evt, cellYear, cellMonth, dayNum) {
    const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const sDate = evt.startDate || evt.date;
    const eDate = evt.endDate || evt.date || sDate;

    if (!evt.repeat || evt.repeat === 'none') {
        return cellDateStr >= sDate && cellDateStr <= eDate;
    }
    if (cellDateStr < sDate) return false;
    const cellDate = new Date(cellYear, cellMonth, dayNum);
    const evtParts = sDate.split('-').map(Number);
    const evtDate = new Date(evtParts[0], evtParts[1] - 1, evtParts[2]);

    if (evt.repeat === 'daily') {
        return true;
    }
    if (evt.repeat === 'weekly') {
        return cellDate.getDay() === evtDate.getDay();
    }
    if (evt.repeat === 'monthly') {
        return dayNum === evtParts[2];
    }
    if (evt.repeat === 'yearly') {
        return (cellMonth + 1) === evtParts[1] && dayNum === evtParts[2];
    }
    return false;
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

export function getRepeatLabel(repeat) {
    switch (repeat) {
        case 'daily': return 'Mỗi ngày';
        case 'weekly': return 'Mỗi tuần';
        case 'monthly': return 'Mỗi tháng';
        case 'yearly': return 'Mỗi năm';
        default: return 'Không';
    }
}
