// Modal xem chi tiết sự kiện lịch riêng.

import { S } from '../state/store.js';
import { formatCalEventTimeRange, getCalEventOccStartDateStr, getRepeatLabel } from '../core/calendar-events.js';
import { DEFAULT_CAL_CATEGORIES } from '../core/constants.js';
import { escapeHtml } from '../core/html.js';
import { getCurrentUser } from '../services/auth.service.js';
import { loadCalEvents, recordDeletedCalIds, saveCalEvents } from '../services/calendar.service.js';
import { pushLocalDataToCloud } from '../services/sync.service.js';
import { modalDayDetail, renderMonthlyCalendar } from './calendar.view.js';
import { renderDayDetailEvents } from './day-detail.view.js';
import { renderHorizontalDailyTimeline } from './day-timeline.view.js';

// DOM Elements cho Modal Xem Chi Tiết Sự Kiện Lịch (Chỉ xem thông tin, không sửa/xóa)
export const modalCalEventView = document.getElementById('modal-cal-event-view');

export const btnCloseCalViewModal = document.getElementById('btn-close-cal-view-modal');

export const btnDoneCalViewModal = document.getElementById('btn-done-cal-view-modal');

export const viewCalIcon = document.getElementById('view-cal-icon');

export const viewCalCatBadge = document.getElementById('view-cal-cat-badge');

export const viewCalTitle = document.getElementById('view-cal-title');

export const viewCalTimeVal = document.getElementById('view-cal-time-val');

export const viewCalRepeatRow = document.getElementById('view-cal-repeat-row');

export const viewCalRepeatVal = document.getElementById('view-cal-repeat-val');

export const viewCalReminderRow = document.getElementById('view-cal-reminder-row');

export const viewCalReminderVal = document.getElementById('view-cal-reminder-val');

export const viewCalNoteRow = document.getElementById('view-cal-note-row');

export const viewCalNoteVal = document.getElementById('view-cal-note-val');

export const viewCalAttachmentRow = document.getElementById('view-cal-attachment-row');

export const viewCalAttachmentVal = document.getElementById('view-cal-attachment-val');

export const viewCalUrlRow = document.getElementById('view-cal-url-row');

export const viewCalUrlVal = document.getElementById('view-cal-url-val');

export function openCalEventViewModal(evt, isHoliday = false) {
    if (!modalCalEventView) return;

    if (isHoliday) {
        if (viewCalIcon) viewCalIcon.textContent = '🎉';
        if (viewCalCatBadge) {
            viewCalCatBadge.textContent = 'Ngày lễ';
            viewCalCatBadge.style.background = '#ef444422';
            viewCalCatBadge.style.color = '#ef4444';
            viewCalCatBadge.style.borderColor = '#ef444444';
        }
        if (viewCalTitle) viewCalTitle.textContent = evt.title || evt;
        if (viewCalTimeVal) {
            const dateStr = S.activeTimelineDate ? `${S.activeTimelineDate.getDate()}/${S.activeTimelineDate.getMonth() + 1}/${S.activeTimelineDate.getFullYear()}` : 'Cả ngày';
            viewCalTimeVal.textContent = `Cả ngày (${dateStr})`;
        }
        if (viewCalRepeatRow) viewCalRepeatRow.style.display = 'none';
        if (viewCalReminderRow) viewCalReminderRow.style.display = 'none';
        if (viewCalNoteRow) viewCalNoteRow.style.display = 'none';
        if (viewCalAttachmentRow) viewCalAttachmentRow.style.display = 'none';
        if (viewCalUrlRow) viewCalUrlRow.style.display = 'none';
    } else {
        const cat = DEFAULT_CAL_CATEGORIES.find(c => c.id === evt.categoryId) || {
            name: evt.categoryName || 'Sự kiện',
            color: evt.categoryColor || '#38bdf8',
            icon: '📌'
        };

        if (viewCalIcon) viewCalIcon.textContent = cat.icon || '📌';
        if (viewCalCatBadge) {
            viewCalCatBadge.textContent = evt.categoryName || cat.name || 'Sự kiện';
            viewCalCatBadge.style.background = `${evt.categoryColor || cat.color}22`;
            viewCalCatBadge.style.color = evt.categoryColor || cat.color;
            viewCalCatBadge.style.borderColor = `${evt.categoryColor || cat.color}44`;
        }
        if (viewCalTitle) viewCalTitle.textContent = evt.title || '';

        if (viewCalTimeVal) {
            const timeStr = formatCalEventTimeRange(evt);
            const sDate = evt.startDate || evt.date || '';
            const eDate = evt.endDate || sDate;
            let dateDisplay = '';
            if (sDate && eDate && sDate !== eDate) {
                dateDisplay = ` • ${sDate} ➔ ${eDate}`;
            } else if (sDate) {
                dateDisplay = ` • ${sDate}`;
            }
            viewCalTimeVal.textContent = `${timeStr}${dateDisplay}`;
        }

        // Lặp lại
        if (viewCalRepeatRow && viewCalRepeatVal) {
            if (evt.repeat && evt.repeat !== 'none') {
                viewCalRepeatRow.style.display = 'flex';
                viewCalRepeatVal.textContent = getRepeatLabel(evt);
            } else {
                viewCalRepeatRow.style.display = 'none';
            }
        }

        // Nhắc nhở (Reminder)
        if (viewCalReminderRow && viewCalReminderVal) {
            const rVal = (evt.reminder !== undefined && evt.reminder !== null) ? String(evt.reminder) : '10';
            if (rVal && rVal !== 'none') {
                viewCalReminderRow.style.display = 'flex';
                let rLabel = 'Trước 10 phút';
                if (rVal === '0') rLabel = 'Đúng giờ diễn ra';
                else if (rVal === '5') rLabel = 'Trước 5 phút';
                else if (rVal === '10') rLabel = 'Trước 10 phút';
                else if (rVal === '30') rLabel = 'Trước 30 phút';
                else if (rVal === '60') rLabel = 'Trước 1 giờ';
                else if (rVal === '1440') rLabel = 'Trước 1 ngày (lúc 08:00)';
                viewCalReminderVal.textContent = `🔔 ${rLabel}`;
            } else {
                viewCalReminderRow.style.display = 'none';
            }
        }

        // Ghi chú
        if (viewCalNoteRow && viewCalNoteVal) {
            if (evt.note && evt.note.trim()) {
                viewCalNoteRow.style.display = 'flex';
                viewCalNoteVal.textContent = evt.note;
            } else {
                viewCalNoteRow.style.display = 'none';
            }
        }

        // Đính kèm
        if (viewCalAttachmentRow && viewCalAttachmentVal) {
            if (evt.attachment) {
                viewCalAttachmentRow.style.display = 'flex';
                viewCalAttachmentVal.innerHTML = `<a href="${evt.attachment.dataUrl || '#'}" download="${escapeHtml(evt.attachment.name)}" style="color: #38bdf8; text-decoration: underline;">${escapeHtml(evt.attachment.name)}</a>`;
            } else {
                viewCalAttachmentRow.style.display = 'none';
            }
        }

        // URL
        if (viewCalUrlRow && viewCalUrlVal) {
            if (evt.url && evt.url.trim()) {
                viewCalUrlRow.style.display = 'flex';
                viewCalUrlVal.innerHTML = `<a href="${escapeHtml(evt.url)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; word-break: break-all; text-decoration: underline;">${escapeHtml(evt.url)}</a>`;
            } else {
                viewCalUrlRow.style.display = 'none';
            }
        }
    }

    modalCalEventView.classList.add('is-active');
    modalCalEventView.setAttribute('aria-hidden', 'false');
}

export function closeCalEventViewModal() {
    if (!modalCalEventView) return;
    modalCalEventView.classList.remove('is-active');
    modalCalEventView.setAttribute('aria-hidden', 'true');
}

if (btnCloseCalViewModal) {
    btnCloseCalViewModal.addEventListener('click', closeCalEventViewModal);
}

if (btnDoneCalViewModal) {
    btnDoneCalViewModal.addEventListener('click', closeCalEventViewModal);
}

if (modalCalEventView) {
    modalCalEventView.addEventListener('click', (e) => {
        if (e.target === modalCalEventView) closeCalEventViewModal();
    });
}

export function deleteCalEvent(id) {
    if (!id) return;
    const deletedSet = recordDeletedCalIds(id);
    let events = loadCalEvents();
    events = events.filter(e => e && e.id !== id && !deletedSet.has(e.id));
    saveCalEvents(events);
    renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
    renderHorizontalDailyTimeline(S.activeTimelineDate);
    if (S.activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
        renderDayDetailEvents(S.activeDayDetailData);
    }

    const user = getCurrentUser();
    if (user && user.email) {
        pushLocalDataToCloud(user.email);
    }
}

// 1. Chỉ xóa một kỳ cụ thể trong chuỗi lặp lại
export function excludeCalEventDate(id, dateStr) {
    if (!id || !dateStr) return;
    let events = loadCalEvents();
    const target = events.find(e => e && e.id === id);
    if (!target) return;

    if (!Array.isArray(target.excludedDates)) {
        target.excludedDates = [];
    }

    const occStartStr = getCalEventOccStartDateStr(target, dateStr);
    const datesToExclude = new Set([dateStr, occStartStr]);

    const sDate = target.startDate || target.date;
    const eDate = target.endDate || target.date || sDate;
    if (sDate && eDate && eDate > sDate) {
        const sParts = sDate.split('-').map(Number);
        const eParts = eDate.split('-').map(Number);
        const sD = new Date(sParts[0], sParts[1] - 1, sParts[2]);
        const eD = new Date(eParts[0], eParts[1] - 1, eParts[2]);
        const durationDays = Math.max(0, Math.round((eD.getTime() - sD.getTime()) / 86400000));
        if (durationDays > 0 && occStartStr) {
            const occParts = occStartStr.split('-').map(Number);
            for (let i = 0; i <= durationDays; i++) {
                const cur = new Date(occParts[0], occParts[1] - 1, occParts[2] + i);
                datesToExclude.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
            }
        }
    }

    datesToExclude.forEach(d => {
        if (d && !target.excludedDates.includes(d)) {
            target.excludedDates.push(d);
        }
    });

    saveCalEvents(events);
    renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
    renderHorizontalDailyTimeline(S.activeTimelineDate);
    if (S.activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
        renderDayDetailEvents(S.activeDayDetailData);
    }

    const user = getCurrentUser();
    if (user && user.email) {
        pushLocalDataToCloud(user.email);
    }
}

// 2. Dừng lặp lại từ kỳ này trở đi (giữ lại các kỳ trong quá khứ)
export function stopCalEventRepeatFrom(id, dateStr) {
    if (!id || !dateStr) return;
    let events = loadCalEvents();
    const target = events.find(e => e && e.id === id);
    if (!target) return;

    const sDate = target.startDate || target.date;
    const occStartStr = getCalEventOccStartDateStr(target, dateStr);
    const stopFromDate = occStartStr || dateStr;

    // Nếu kỳ đang chọn là kỳ bắt đầu (hoặc trước ngày bắt đầu), thì không còn kỳ nào trong quá khứ -> xóa sạch
    if (stopFromDate <= sDate) {
        deleteCalEvent(id);
        return;
    }

    // Ngày dừng lặp là ngày trước kỳ này
    const parts = stopFromDate.split('-').map(Number);
    const prevDate = new Date(parts[0], parts[1] - 1, parts[2] - 1);
    const prevDayStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

    target.repeatLimitEnd = prevDayStr;

    saveCalEvents(events);
    renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
    renderHorizontalDailyTimeline(S.activeTimelineDate);
    if (S.activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
        renderDayDetailEvents(S.activeDayDetailData);
    }

    const user = getCurrentUser();
    if (user && user.email) {
        pushLocalDataToCloud(user.email);
    }
}
