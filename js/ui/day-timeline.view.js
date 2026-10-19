// Timeline 24 giờ của một ngày trong lịch.

import { S } from '../state/store.js';
import { isCalEventOnDate } from '../core/calendar-events.js';
import { escapeHtml } from '../core/html.js';
import { getTodayData } from '../core/lunar.js';
import { loadCalEvents } from '../services/calendar.service.js';
import { openCalAddEventModal } from './calendar-event-form.js';
import { openCalEventViewModal } from './calendar-event-view.js';

 // ID sự kiện đang được chỉnh sửa (null nếu là thêm mới)

// DOM Elements cho Timeline Ngang 24 Giờ Trong Ngày (Ở dưới lịch)
export const dayHTitleDate = document.getElementById('day-h-title-date');

export const dayHLunarBadge = document.getElementById('day-h-lunar-badge');

export const dayHCanchiBadge = document.getElementById('day-h-canchi-badge');

export const dayHCountBadge = document.getElementById('day-h-count-badge');

export const dayHAlldayBar = document.getElementById('day-h-allday-bar');

export const dayHAlldayPills = document.getElementById('day-h-allday-pills');

export const dayHRulerGrid = document.getElementById('day-h-ruler-grid');

export const dayHNowNeedle = document.getElementById('day-h-now-needle');

export const dayHNowText = document.getElementById('day-h-now-text');

export const dayHEventsLane = document.getElementById('day-h-events-lane');

export function buildHorizontalTimelineRuler() {
    if (!dayHRulerGrid) return;
    dayHRulerGrid.innerHTML = '';
    for (let h = 0; h <= 24; h++) {
        const tick = document.createElement('div');
        tick.className = 'day-h-ruler-tick' + (h === 24 ? ' tick-last' : '');

        const label = document.createElement('span');
        label.className = 'tick-label';
        label.textContent = `${String(h).padStart(2, '0')}:00`;
        tick.appendChild(label);

        if (h < 24) {
            tick.title = `Nhấp để thêm công việc vào lúc ${String(h).padStart(2, '0')}:00`;
            tick.addEventListener('click', () => {
                const dateData = S.activeTimelineDate || getTodayData();
                const dateStr = `${dateData.cellYear}-${String(dateData.cellMonth + 1).padStart(2, '0')}-${String(dateData.dayNum).padStart(2, '0')}`;
                const sTime = `${String(h).padStart(2, '0')}:00`;
                const eTime = `${String((h + 1) % 24).padStart(2, '0')}:00`;
                openCalAddEventModal(dateStr, sTime, eTime);
            });
        }

        dayHRulerGrid.appendChild(tick);
    }
}

export function updateHorizontalNowNeedle(dateData = S.activeTimelineDate) {
    if (!dayHNowNeedle || !dayHNowText) return;
    if (!dateData) dateData = getTodayData();

    const now = new Date();
    const isToday = (dateData.dayNum === now.getDate() && dateData.cellMonth === now.getMonth() && dateData.cellYear === now.getFullYear());

    if (!isToday) {
        dayHNowNeedle.style.display = 'none';
        return;
    }

    dayHNowNeedle.style.display = 'flex';
    const hours = now.getHours();
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    const totalSeconds = hours * 3600 + mins * 60 + secs;
    const pct = (totalSeconds / 86400) * 100;

    dayHNowNeedle.style.left = `${pct}%`;
    dayHNowText.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function renderHorizontalDailyTimeline(dateData) {
    if (!dateData) dateData = getTodayData();
    S.activeTimelineDate = dateData;

    const { dayNum, cellMonth, cellYear, lunar, canChi, holiday } = dateData;
    const now = new Date();
    const isToday = (dayNum === now.getDate() && cellMonth === now.getMonth() && cellYear === now.getFullYear());

    // 1. Tiêu đề ngày tháng
    const dateObj = new Date(cellYear, cellMonth, dayNum);
    const dayOfWeek = dateObj.getDay();
    const weekdaysLong = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const weekdayName = weekdaysLong[dayOfWeek];
    if (dayHTitleDate) {
        dayHTitleDate.textContent = `${isToday ? 'Hôm nay (' + weekdayName + ')' : weekdayName}, ${String(dayNum).padStart(2, '0')}/${String(cellMonth + 1).padStart(2, '0')}/${cellYear}`;
    }

    // 2. Badges âm lịch, can chi
    if (dayHLunarBadge) dayHLunarBadge.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg> ${lunar.day}/${lunar.month}${lunar.leap ? ' Nhuận' : ''} ÂL`;
    if (dayHCanchiBadge) dayHCanchiBadge.textContent = canChi || '';

    // 3. Đọc sự kiện trong ngày
    const userCalEvents = loadCalEvents();
    const dayEvents = userCalEvents.filter(e => isCalEventOnDate(e, cellYear, cellMonth, dayNum));
    const totalCount = dayEvents.length + (holiday ? 1 : 0);
    if (dayHCountBadge) dayHCountBadge.textContent = `${totalCount} sự kiện`;

    // 4. Sự kiện cả ngày
    if (dayHAlldayBar && dayHAlldayPills) {
        dayHAlldayPills.innerHTML = '';
        const allDayEvents = dayEvents.filter(e => e.allDay);

        if (holiday || allDayEvents.length > 0) {
            dayHAlldayBar.style.display = 'flex';

            if (holiday) {
                const pill = document.createElement('div');
                pill.className = 'day-h-allday-pill';
                pill.style.background = 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
                pill.innerHTML = `🎉 ${escapeHtml(holiday)}`;
                pill.title = 'Nhấp để xem thông tin';
                pill.addEventListener('click', () => openCalEventViewModal({ title: holiday }, true));
                dayHAlldayPills.appendChild(pill);
            }

            allDayEvents.forEach(evt => {
                const pill = document.createElement('div');
                pill.className = 'day-h-allday-pill';
                pill.style.background = `linear-gradient(135deg, ${evt.categoryColor || '#38bdf8'} 0%, rgba(15, 23, 42, 0.9) 100%)`;
                pill.style.borderLeft = `3px solid ${evt.categoryColor || '#38bdf8'}`;
                pill.innerHTML = `📌 ${escapeHtml(evt.title)}`;
                pill.title = 'Nhấp để xem thông tin sự kiện';
                pill.addEventListener('click', () => openCalEventViewModal(evt));
                dayHAlldayPills.appendChild(pill);
            });
        } else {
            dayHAlldayBar.style.display = 'none';
        }
    }

    // 5. Cập nhật Now Needle
    updateHorizontalNowNeedle(dateData);

    // 6. Vẽ các thanh sự kiện trên thước đo ngang 24 giờ (Events Lane)
    if (dayHEventsLane) {
        dayHEventsLane.innerHTML = '';
        const timedEvents = dayEvents.filter(e => !e.allDay);

        // Chuyển đổi sang số phút
        const eventItems = timedEvents.map(evt => {
            let startMins = 9 * 60; // 09:00 mặc định
            let endMins = 10 * 60; // 10:00 mặc định
            const sTime = evt.startTime || evt.time;
            if (sTime) {
                const parts = sTime.split(':').map(Number);
                if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    startMins = parts[0] * 60 + parts[1];
                }
            }
            if (evt.endTime) {
                const parts = evt.endTime.split(':').map(Number);
                if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    endMins = parts[0] * 60 + parts[1];
                }
            }
            if (endMins <= startMins) endMins = startMins + 45;
            return {
                ...evt,
                startMins,
                endMins,
                duration: endMins - startMins
            };
        });

        // Xếp hàng tránh đè nhau nếu có sự kiện trùng giờ (hàng 0 hoặc hàng 1)
        eventItems.forEach((ev, idx) => {
            let row = 0;
            for (let j = 0; j < idx; j++) {
                const prev = eventItems[j];
                if (ev.startMins < prev.endMins && ev.endMins > prev.startMins && prev.row === 0) {
                    row = 1;
                    break;
                }
            }
            ev.row = row;
        });

        // Vẽ từng bar sự kiện
        eventItems.forEach(ev => {
            const leftPct = (ev.startMins / 1440) * 100;
            const widthPct = Math.min(100 - leftPct, Math.max(3.2, (ev.duration / 1440) * 100));

            const bar = document.createElement('div');
            bar.className = 'day-h-event-bar';
            bar.style.left = `${leftPct}%`;
            bar.style.width = `${widthPct}%`;

            // Đặt vị trí hàng trên / dưới nếu trùng giờ
            if (ev.row === 1) {
                bar.style.top = '48px';
                bar.style.height = '40px';
            } else {
                bar.style.top = '4px';
                bar.style.height = eventItems.some(o => o.row === 1) ? '40px' : '44px';
            }

            const catColor = ev.categoryColor || '#38bdf8';
            bar.style.borderLeft = `3.5px solid ${catColor}`;
            bar.style.background = `linear-gradient(135deg, ${catColor}33 0%, rgba(20, 26, 46, 0.95) 75%)`;

            const startH = String(Math.floor(ev.startMins / 60)).padStart(2, '0');
            const startM = String(ev.startMins % 60).padStart(2, '0');
            const endH = String(Math.floor(ev.endMins / 60)).padStart(2, '0');
            const endM = String(ev.endMins % 60).padStart(2, '0');
            const timeLabel = `${startH}:${startM} - ${endH}:${endM}`;

            bar.innerHTML = `
                <span class="day-h-event-time" style="color: ${catColor};">${timeLabel}</span>
                <span class="day-h-event-title">${escapeHtml(ev.title)}</span>
            `;
            bar.title = `${ev.title} (${timeLabel})${ev.note ? ' - ' + ev.note : ''}\nNhấp để xem thông tin`;

            // Bấm vào ô trong timeline ngày: chỉ hiển thị thông tin, không cho phép sửa hoặc xóa
            bar.addEventListener('click', () => {
                openCalEventViewModal(ev);
            });

            dayHEventsLane.appendChild(bar);
        });
    }
}
