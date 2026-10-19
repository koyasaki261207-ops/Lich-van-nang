// Modal chi tiết một ngày trong lịch.

import { S } from '../state/store.js';
import { formatCalEventTimeRange, getRepeatLabel, isCalEventOnDate } from '../core/calendar-events.js';
import { escapeHtml } from '../core/html.js';
import { getCanChiMonth, getCanChiYear } from '../core/lunar.js';
import { loadCalEvents } from '../services/calendar.service.js';
import { openCalEditEventModal } from './calendar-event-form.js';
import { deleteCalEvent } from './calendar-event-view.js';
import { modalDayDetail } from './calendar.view.js';

export const modalDayWeekday = document.getElementById('modal-day-weekday');

export const modalDayFullSolar = document.getElementById('modal-day-full-solar');

export const modalDayRelative = document.getElementById('modal-day-relative');

export const modalDayHolidayBanner = document.getElementById('modal-day-holiday-banner');

export const modalDayHolidayTitle = document.getElementById('modal-day-holiday-title');

export const modalDaySolarNum = document.getElementById('modal-day-solar-num');

export const modalDaySolarSub = document.getElementById('modal-day-solar-sub');

export const modalDayLunarNum = document.getElementById('modal-day-lunar-num');

export const modalDayLunarSub = document.getElementById('modal-day-lunar-sub');

export const modalDayCanChiDay = document.getElementById('modal-day-canchi-day');

export const modalDayCanChiMonth = document.getElementById('modal-day-canchi-month');

export const modalDayCanChiYear = document.getElementById('modal-day-canchi-year');

export const modalDayHoangDaoCard = document.getElementById('modal-day-hoangdao-card');

export const modalDayHoangDaoBadge = document.getElementById('modal-day-hoangdao-badge');

export const modalDayHoangDaoAdvice = document.getElementById('modal-day-hoangdao-advice');

export const modalDayEventsList = document.getElementById('modal-day-events-list');

export function renderDayDetailEvents(data) {
    if (!modalDayEventsList) return;
    const { dayNum, cellMonth, cellYear } = data;
    const userCalEvents = loadCalEvents();
    const dayEvents = userCalEvents.filter(e => isCalEventOnDate(e, cellYear, cellMonth, dayNum));

    modalDayEventsList.innerHTML = '';
    if (dayEvents.length === 0) {
        modalDayEventsList.innerHTML = `<div class="day-empty-events">Chưa có sự kiện nào trong ngày này. Nhấp "+ Thêm sự kiện" bên trên để tạo mới.</div>`;
        return;
    }

    dayEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'day-event-item';
        item.style.borderLeftColor = evt.categoryColor;

        const timeStr = formatCalEventTimeRange(evt);
        const repeatStr = (evt.repeat && evt.repeat !== 'none') ? ` • Lặp lại: ${getRepeatLabel(evt.repeat)}` : '';
        const noteHtml = evt.note ? `<div class="day-event-item-note">${escapeHtml(evt.note)}</div>` : '';
        const linkHtml = evt.url ? `<a href="${escapeHtml(evt.url)}" target="_blank" rel="noopener noreferrer" class="day-event-item-link">🔗 ${escapeHtml(evt.url)}</a>` : '';
        const attachHtml = evt.attachment ? `<div class="day-event-item-attachment">📎 <a href="${evt.attachment.dataUrl || '#'}" download="${escapeHtml(evt.attachment.name)}" style="color: inherit; text-decoration: underline;">${escapeHtml(evt.attachment.name)}</a></div>` : '';

        item.innerHTML = `
            <div class="day-event-item-top">
                <div>
                    <div class="day-event-item-title">${escapeHtml(evt.title)}</div>
                    <div class="day-event-item-meta">
                        <span class="day-event-cat-badge" style="background: ${evt.categoryColor}22; color: ${evt.categoryColor}; border: 1px solid ${evt.categoryColor}44;">${escapeHtml(evt.categoryName || 'Sự kiện')}</span>
                        <span>⏰ ${timeStr}${repeatStr}</span>
                    </div>
                </div>
                <div class="day-event-item-actions">
                    <button type="button" class="btn-edit-cal-event" title="Chỉnh sửa sự kiện này">✏️</button>
                    <button type="button" class="btn-delete-cal-event" title="Xóa sự kiện này">🗑️</button>
                </div>
            </div>
            ${noteHtml}
            ${attachHtml}
            ${linkHtml}
        `;

        const btnEdit = item.querySelector('.btn-edit-cal-event');
        if (btnEdit) {
            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                openCalEditEventModal(evt.id);
            });
        }

        const btnDel = item.querySelector('.btn-delete-cal-event');
        if (btnDel) {
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Bạn có chắc muốn xóa sự kiện "${evt.title}"?`)) {
                    deleteCalEvent(evt.id);
                }
            });
        }

        modalDayEventsList.appendChild(item);
    });
}

export function openDayDetailModal(data) {
    if (!modalDayDetail) return;
    S.activeDayDetailData = data;
    const { dayNum, cellMonth, cellYear, lunar, canChi, hoangDao, holiday } = data;
    const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const dateObj = new Date(cellYear, cellMonth, dayNum);
    const weekdayText = WEEKDAYS[dateObj.getDay()];

    // Tính khoảng cách thời gian so với hôm nay
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const targetDateObj = new Date(cellYear, cellMonth, dayNum);
    targetDateObj.setHours(0, 0, 0, 0);
    const diffMs = targetDateObj.getTime() - todayObj.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    let relativeText = '';
    let isTodayDate = false;
    if (diffDays === 0) {
        relativeText = 'Hôm nay';
        isTodayDate = true;
    } else if (diffDays === 1) {
        relativeText = 'Ngày mai';
    } else if (diffDays === -1) {
        relativeText = 'Hôm qua';
    } else if (diffDays > 1) {
        relativeText = `Còn ${diffDays} ngày nữa`;
    } else {
        relativeText = `Cách đây ${Math.abs(diffDays)} ngày`;
    }

    if (modalDayWeekday) modalDayWeekday.textContent = weekdayText;
    if (modalDayFullSolar) modalDayFullSolar.textContent = `${dayNum} tháng ${cellMonth + 1} năm ${cellYear}`;
    if (modalDayRelative) {
        modalDayRelative.textContent = relativeText;
        modalDayRelative.classList.toggle('is-today', isTodayDate);
    }

    // Banner Ngày lễ nếu có
    if (modalDayHolidayBanner) {
        if (holiday) {
            modalDayHolidayBanner.style.display = 'flex';
            if (modalDayHolidayTitle) modalDayHolidayTitle.textContent = holiday;
        } else {
            modalDayHolidayBanner.style.display = 'none';
        }
    }

    // Khối Dương lịch
    if (modalDaySolarNum) modalDaySolarNum.textContent = String(dayNum).padStart(2, '0');
    if (modalDaySolarSub) modalDaySolarSub.textContent = `Tháng ${cellMonth + 1}, ${cellYear}`;

    // Khối Âm lịch & Can Chi
    const canChiYear = getCanChiYear(lunar.year);
    const canChiMonth = getCanChiMonth(lunar.month, lunar.year);
    if (modalDayLunarNum) modalDayLunarNum.textContent = String(lunar.day).padStart(2, '0');
    if (modalDayLunarSub) modalDayLunarSub.textContent = `Tháng ${lunar.month}${lunar.leap ? ' (Nhuận)' : ''}, Năm ${canChiYear}`;

    // Khối Can Chi Tam Trụ
    if (modalDayCanChiDay) modalDayCanChiDay.textContent = canChi;
    if (modalDayCanChiMonth) modalDayCanChiMonth.textContent = canChiMonth;
    if (modalDayCanChiYear) modalDayCanChiYear.textContent = canChiYear;

    // Khối Hoàng Đạo / Hắc Đạo
    if (modalDayHoangDaoCard) {
        modalDayHoangDaoCard.classList.toggle('is-hd', hoangDao);
        modalDayHoangDaoCard.classList.toggle('is-hac', !hoangDao);
    }
    if (modalDayHoangDaoBadge) {
        modalDayHoangDaoBadge.textContent = hoangDao ? '✨ Ngày Hoàng Đạo (Cát lành)' : '🌑 Ngày Hắc Đạo (Cẩn trọng)';
    }
    if (modalDayHoangDaoAdvice) {
        modalDayHoangDaoAdvice.textContent = hoangDao
            ? 'Ngày cát tinh chiếu mệnh, rất thuận lợi cho các công việc quan trọng: cưới hỏi, khai trương, xuất hành, khởi công, ký kết.'
            : 'Ngày có hung tinh ngự trị, nên thận trọng trong các quyết định lớn, thích hợp nghỉ ngơi, làm việc thường nhật, phòng tránh tranh chấp.';
    }

    // Hiển thị danh sách sự kiện trong ngày
    renderDayDetailEvents(data);

    modalDayDetail.classList.add('is-active');
    modalDayDetail.setAttribute('aria-hidden', 'false');
}

export function closeDayDetailModal() {
    if (!modalDayDetail) return;
    modalDayDetail.classList.remove('is-active');
    modalDayDetail.setAttribute('aria-hidden', 'true');
}
