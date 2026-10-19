// Lịch tháng âm–dương.

import { S } from '../state/store.js';
import { formatCalEventTimeRange, isCalEventOnDate } from '../core/calendar-events.js';
import { DEFAULT_CAL_CATEGORIES } from '../core/constants.js';
import { LUNAR_HOLIDAYS, SOLAR_HOLIDAYS } from '../core/holidays.js';
import { escapeHtml } from '../core/html.js';
import { getCanChiDay, getLunarDate, getTodayData, isHoangDao } from '../core/lunar.js';
import { loadCalCategories, loadCalEvents, saveCalCategories, saveCalEvents, unmarkCalEventDeleted } from '../services/calendar.service.js';
import { calSelectMonth } from './auth.view.js';
import { calAddCustomCatBox, calAttachmentLabel, calAttachmentName, calAttachmentPreviewBox, calEndTimeInputs, calStartTimeInputs, closeCalAddEventModal, formCalAddEvent, inputCalEndTime, inputCalTitle, inputCalUrl, modalCalAddEvent, openCalAddEventModal, renderCategoryChips, selectCalRepeat, textareaCalNote } from './calendar-event-form.js';
import { closeDayDetailModal, openDayDetailModal, renderDayDetailEvents } from './day-detail.view.js';
import { buildHorizontalTimelineRuler, renderHorizontalDailyTimeline, updateHorizontalNowNeedle } from './day-timeline.view.js';

export const calMonthTitle = document.getElementById('cal-month-title');

export const btnCalPrev = document.getElementById('btn-cal-prev');

export const btnCalNext = document.getElementById('btn-cal-next');

export const btnCalToday = document.getElementById('btn-cal-today');

export const calSelectYear = document.getElementById('cal-select-year');

export const btnCalAddEvent = document.getElementById('btn-cal-add-event');

export const calGrid = document.getElementById('monthly-cal-grid');

// DOM Elements cho Modal Thông Tin Chi Tiết Ngày (Day Detail Modal)
export const modalDayDetail = document.getElementById('modal-day-detail');

export const btnCloseDayDetail = document.getElementById('btn-close-day-detail');

export const btnDoneDayDetail = document.getElementById('btn-done-day-detail');

export const btnDayAddEvent = document.getElementById('btn-day-add-event');

export const btnCloseCalAddModal = document.getElementById('btn-close-cal-add-modal');

export const btnCancelCalAdd = document.getElementById('btn-cancel-cal-add');

export const inputCalStartDate = document.getElementById('cal-event-start-date');

export const inputCalStartTime = document.getElementById('cal-event-start-time');

export const inputCalEndDate = document.getElementById('cal-event-end-date');

export const chkCalAllDay = document.getElementById('cal-event-allday');

export const inputCustomCatName = document.getElementById('input-custom-cat-name');

export const inputCustomCatColor = document.getElementById('input-custom-cat-color');

export const btnConfirmAddCat = document.getElementById('btn-confirm-add-cat');

export const btnCancelAddCat = document.getElementById('btn-cancel-add-cat');

export const btnResetDefaultCats = document.getElementById('btn-reset-default-cats');

export const inputCalAttachment = document.getElementById('cal-event-attachment-input');

export const btnRemoveCalAttachment = document.getElementById('btn-remove-cal-attachment');

export function populateCalYearSelect() {
    if (!calSelectYear) return;
    calSelectYear.innerHTML = '';
    const thisYear = new Date().getFullYear();
    for (let y = thisYear - 5; y <= thisYear + 10; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `Năm ${y}`;
        calSelectYear.appendChild(opt);
    }
}

export function renderMonthlyCalendar(month, year) {
    if (!calGrid || !calMonthTitle) return;
    S.currentCalMonth = month;
    S.currentCalYear = year;

    calMonthTitle.textContent = `THÁNG ${month + 1} - ${year}`;
    if (calSelectMonth) calSelectMonth.value = month;
    if (calSelectYear) calSelectYear.value = year;

    calGrid.innerHTML = '';

    const today = new Date();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    // Thứ hai là cột đầu tiên: (dayOfWeek + 6) % 7
    const startDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;

    // Đọc danh sách sự kiện lịch cá nhân của người dùng
    const userCalEvents = loadCalEvents();

    for (let cellIdx = 0; cellIdx < totalCells; cellIdx++) {
        let dayNum;
        let cellMonth = month;
        let cellYear = year;
        let isOtherMonth = false;

        if (cellIdx < startDayOfWeek) {
            // Ngày của tháng trước
            dayNum = prevMonthDays - startDayOfWeek + cellIdx + 1;
            cellMonth = month - 1;
            if (cellMonth < 0) {
                cellMonth = 11;
                cellYear--;
            }
            isOtherMonth = true;
        } else if (cellIdx >= startDayOfWeek + daysInMonth) {
            // Ngày của tháng sau
            dayNum = cellIdx - (startDayOfWeek + daysInMonth) + 1;
            cellMonth = month + 1;
            if (cellMonth > 11) {
                cellMonth = 0;
                cellYear++;
            }
            isOtherMonth = true;
        } else {
            // Ngày của tháng hiện tại
            dayNum = cellIdx - startDayOfWeek + 1;
        }

        const isSat = (cellIdx % 7 === 5);
        const isSun = (cellIdx % 7 === 6);
        const isToday = !isOtherMonth && (dayNum === today.getDate() && cellMonth === today.getMonth() && cellYear === today.getFullYear());

        const lunar = getLunarDate(dayNum, cellMonth + 1, cellYear);
        const canChi = getCanChiDay(lunar.jd);
        const hoangDao = isHoangDao(lunar.month, lunar.jd);

        const solarKey = `${dayNum}-${cellMonth + 1}`;
        const lunarKey = `${lunar.day}-${lunar.month}`;
        const holiday = SOLAR_HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey] || (lunar.day === 1 ? 'Mùng một' : (lunar.day === 15 ? 'Ngày rằm' : ''));
        const isHoliday = !!holiday;

        // Định dạng hiển thị số ngày âm
        let lunarText = String(lunar.day);
        if (lunar.day === 1 || cellIdx === 0 || dayNum === 1) {
            lunarText = `${lunar.day}/${lunar.month}`;
        }

        const isSelected = S.activeTimelineDate
            ? (dayNum === S.activeTimelineDate.dayNum && cellMonth === S.activeTimelineDate.cellMonth && cellYear === S.activeTimelineDate.cellYear && !isOtherMonth)
            : isToday;

        const cell = document.createElement('div');
        cell.className = 'cal-day-cell';
        if (isOtherMonth) cell.classList.add('other-month');
        if (isToday) cell.classList.add('is-today');
        if (isSelected) cell.classList.add('is-selected');
        if (isSat) cell.classList.add('is-sat');
        if (isSun) cell.classList.add('is-sun');
        if (isHoliday) cell.classList.add('is-holiday');

        const holidayHtml = holiday ? `<span class="cal-holiday-text" title="${holiday}">${holiday}</span>` : '';
        const lunarClass = (lunar.day === 1 || lunar.day === 15) ? 'is-first-or-full' : '';

        // Sự kiện lịch cá nhân do người dùng thêm vào
        const dayEvents = userCalEvents.filter(e => isCalEventOnDate(e, cellYear, cellMonth, dayNum));
        let userEventsHtml = '';
        if (dayEvents.length > 0) {
            const visibleEvents = dayEvents.slice(0, 2);
            visibleEvents.forEach(evt => {
                const timeRangeLabel = formatCalEventTimeRange(evt);
                const pillTime = evt.allDay ? '' : `<span class="user-event-time">${evt.startTime || evt.time || ''}</span>`;
                userEventsHtml += `
                    <div class="cal-user-event-pill" style="border-left: 3px solid ${evt.categoryColor}; background: ${evt.categoryColor}2e; color: #ffffff;" title="${escapeHtml(evt.title)} (${timeRangeLabel})">
                        <span class="user-event-dot" style="background: ${evt.categoryColor};"></span>
                        ${pillTime}
                        <span class="user-event-title">${escapeHtml(evt.title)}</span>
                    </div>
                `;
            });
            if (dayEvents.length > 2) {
                userEventsHtml += `<div class="cal-user-event-more">+${dayEvents.length - 2} khác</div>`;
            }
        }

        // Ô lịch tối giản, thanh lịch, có thêm các sự kiện người dùng thêm
        cell.innerHTML = `
            <div class="cal-cell-top">
                <span class="cal-solar-day">${String(dayNum).padStart(2, '0')}</span>
            </div>
            <div class="cal-cell-mid">
                ${holidayHtml}
                ${userEventsHtml}
            </div>
            <div class="cal-cell-bottom">
                <span class="cal-lunar-day ${lunarClass}" title="Âm lịch: ${lunar.day} tháng ${lunar.month}">${lunarText}</span>
            </div>
        `;

        // Bấm vào ô lịch: cập nhật ngày được chọn, đồng bộ hiển thị Timeline ngang 24h bên dưới và mở thông tin chi tiết ngày
        cell.addEventListener('click', () => {
            document.querySelectorAll('.cal-day-cell.is-selected').forEach(c => c.classList.remove('is-selected'));
            cell.classList.add('is-selected');

            const cellData = {
                dayNum,
                cellMonth,
                cellYear,
                isOtherMonth,
                isSat,
                isSun,
                lunar,
                canChi,
                hoangDao,
                holiday
            };

            renderHorizontalDailyTimeline(cellData);
            openDayDetailModal(cellData);
        });

        calGrid.appendChild(cell);
    }
}

export function initMonthlyCalendar() {
    populateCalYearSelect();
    buildHorizontalTimelineRuler();
    S.activeTimelineDate = getTodayData();
    renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
    renderHorizontalDailyTimeline(S.activeTimelineDate);

    // Cập nhật vị trí Now Needle mỗi giây để đồng bộ chính xác khi sang phút
    if (S.nowNeedleInterval) clearInterval(S.nowNeedleInterval);
    S.nowNeedleInterval = setInterval(() => {
        updateHorizontalNowNeedle();
    }, 1000);

    // Lắng nghe sự kiện đóng Modal Chi Tiết Ngày
    if (btnCloseDayDetail) {
        btnCloseDayDetail.addEventListener('click', closeDayDetailModal);
    }
    if (btnDoneDayDetail) {
        btnDoneDayDetail.addEventListener('click', closeDayDetailModal);
    }
    if (modalDayDetail) {
        modalDayDetail.addEventListener('click', (e) => {
            if (e.target === modalDayDetail) closeDayDetailModal();
        });
    }

    // Lắng nghe nút "+ Thêm sự kiện" trong Day Detail Modal
    if (btnDayAddEvent) {
        btnDayAddEvent.addEventListener('click', () => {
            if (S.activeDayDetailData) {
                const { dayNum, cellMonth, cellYear } = S.activeDayDetailData;
                const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                openCalAddEventModal(dateStr);
            } else {
                openCalAddEventModal();
            }
        });
    }

    // Lắng nghe nút "+ Thêm" trên thanh toolbar lịch tháng
    if (btnCalAddEvent) {
        btnCalAddEvent.addEventListener('click', () => {
            openCalAddEventModal();
        });
    }

    // Lắng nghe đóng Modal Thêm Sự Kiện Lịch
    if (btnCloseCalAddModal) {
        btnCloseCalAddModal.addEventListener('click', closeCalAddEventModal);
    }
    if (btnCancelCalAdd) {
        btnCancelCalAdd.addEventListener('click', closeCalAddEventModal);
    }
    if (modalCalAddEvent) {
        modalCalAddEvent.addEventListener('click', (e) => {
            if (e.target === modalCalAddEvent) closeCalAddEventModal();
        });
    }

    // Tùy chọn "Cả ngày" bật / tắt chọn giờ phút cho cả Bắt đầu và Kết thúc
    if (chkCalAllDay) {
        chkCalAllDay.addEventListener('change', () => {
            const isAllDay = chkCalAllDay.checked;
            if (calStartTimeInputs) calStartTimeInputs.classList.toggle('is-allday', isAllDay);
            if (calEndTimeInputs) calEndTimeInputs.classList.toggle('is-allday', isAllDay);
        });
    }

    // Tự động điều chỉnh ngày & giờ kết thúc hợp lý
    if (inputCalStartDate) {
        inputCalStartDate.addEventListener('change', () => {
            if (inputCalEndDate && (!inputCalEndDate.value || inputCalEndDate.value < inputCalStartDate.value)) {
                inputCalEndDate.value = inputCalStartDate.value;
            }
        });
    }

    if (inputCalStartTime) {
        inputCalStartTime.addEventListener('change', () => {
            if (inputCalStartDate && inputCalEndDate && inputCalStartDate.value === inputCalEndDate.value) {
                if (inputCalEndTime) {
                    const parts = inputCalStartTime.value.split(':').map(Number);
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                        const endH = (parts[0] + 1) % 24;
                        inputCalEndTime.value = `${String(endH).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
                    }
                }
            }
        });
    }

    if (inputCalEndDate) {
        inputCalEndDate.addEventListener('change', () => {
            if (inputCalStartDate && inputCalEndDate.value && inputCalEndDate.value < inputCalStartDate.value) {
                inputCalStartDate.value = inputCalEndDate.value;
            }
        });
    }

    // Đính kèm tệp
    if (inputCalAttachment) {
        inputCalAttachment.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                S.currentCalAttachment = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    dataUrl: ev.target.result
                };
                if (calAttachmentName) calAttachmentName.textContent = file.name;
                if (calAttachmentPreviewBox) calAttachmentPreviewBox.style.display = 'flex';
                if (calAttachmentLabel) calAttachmentLabel.textContent = 'Đã chọn: ' + file.name;
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnRemoveCalAttachment) {
        btnRemoveCalAttachment.addEventListener('click', () => {
            S.currentCalAttachment = null;
            if (inputCalAttachment) inputCalAttachment.value = '';
            if (calAttachmentPreviewBox) calAttachmentPreviewBox.style.display = 'none';
            if (calAttachmentLabel) calAttachmentLabel.textContent = 'Thêm tệp đính kèm (Ảnh, tài liệu...)';
        });
    }

    // Thêm nhãn tùy chỉnh
    if (btnConfirmAddCat) {
        btnConfirmAddCat.addEventListener('click', () => {
            const name = inputCustomCatName ? inputCustomCatName.value.trim() : '';
            const color = inputCustomCatColor ? inputCustomCatColor.value : '#38bdf8';
            if (!name) return;
            const cats = loadCalCategories();
            const newId = 'cat_' + Date.now();
            cats.push({ id: newId, name, color, icon: '📌' });
            saveCalCategories(cats);
            S.currentSelectedCatId = newId;
            if (inputCustomCatName) inputCustomCatName.value = '';
            if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';
            renderCategoryChips();
        });
    }

    if (btnCancelAddCat) {
        btnCancelAddCat.addEventListener('click', () => {
            if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';
        });
    }

    if (btnResetDefaultCats) {
        btnResetDefaultCats.addEventListener('click', () => {
            if (confirm('Khôi phục danh sách nhãn về các nhãn mặc định ban đầu (Nhà, Công việc, Vui chơi, Thời hạn)?')) {
                saveCalCategories([...DEFAULT_CAL_CATEGORIES]);
                S.currentSelectedCatId = DEFAULT_CAL_CATEGORIES[0].id;
                if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';
                renderCategoryChips();
            }
        });
    }

    // Lưu sự kiện khi submit form
    if (formCalAddEvent) {
        formCalAddEvent.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = inputCalTitle ? inputCalTitle.value.trim() : '';
            if (!title) return;
            const startDate = inputCalStartDate ? inputCalStartDate.value : '';
            if (!startDate) return;
            const endDate = (inputCalEndDate && inputCalEndDate.value) ? inputCalEndDate.value : startDate;
            const allDay = chkCalAllDay ? chkCalAllDay.checked : false;

            let startTime = null;
            let endTime = null;

            if (!allDay) {
                startTime = inputCalStartTime ? inputCalStartTime.value : '09:00';
                endTime = inputCalEndTime ? inputCalEndTime.value : '10:00';

                // Kiểm tra tính hợp lệ
                if (startDate > endDate) {
                    alert('Ngày kết thúc không thể trước ngày bắt đầu!');
                    return;
                }
                if (startDate === endDate && startTime && endTime && endTime < startTime) {
                    alert('Giờ kết thúc không thể trước giờ bắt đầu trong cùng một ngày!');
                    return;
                }
            } else {
                if (startDate > endDate) {
                    alert('Ngày kết thúc không thể trước ngày bắt đầu!');
                    return;
                }
            }

            const repeat = selectCalRepeat ? selectCalRepeat.value : 'none';

            const cats = loadCalCategories();
            const cat = cats.find(c => c.id === S.currentSelectedCatId) || cats[0] || { id: 'nha', name: 'Nhà', color: '#38bdf8' };

            const note = textareaCalNote ? textareaCalNote.value.trim() : '';
            const url = inputCalUrl ? inputCalUrl.value.trim() : '';

            const events = loadCalEvents();
            if (S.editingCalEventId) {
                const idx = events.findIndex(e => e.id === S.editingCalEventId);
                if (idx !== -1) {
                    events[idx] = {
                        ...events[idx],
                        title,
                        startDate,
                        startTime,
                        endDate,
                        endTime,
                        // Giữ tương thích ngược với dữ liệu cũ
                        date: startDate,
                        time: startTime,
                        allDay,
                        repeat,
                        categoryId: cat.id,
                        categoryName: cat.name,
                        categoryColor: cat.color,
                        note,
                        attachment: S.currentCalAttachment,
                        url,
                        updatedAt: new Date().toISOString()
                    };
                }
                S.editingCalEventId = null;
            } else {
                const newEvt = {
                    id: 'calevt_' + Date.now(),
                    title,
                    startDate,
                    startTime,
                    endDate,
                    endTime,
                    // Giữ tương thích ngược với dữ liệu cũ
                    date: startDate,
                    time: startTime,
                    allDay,
                    repeat,
                    categoryId: cat.id,
                    categoryName: cat.name,
                    categoryColor: cat.color,
                    note,
                    attachment: S.currentCalAttachment,
                    url,
                    createdAt: new Date().toISOString()
                };
                unmarkCalEventDeleted(newEvt.id);
                events.push(newEvt);
            }
            saveCalEvents(events);

            closeCalAddEventModal();
            renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
            renderHorizontalDailyTimeline(S.activeTimelineDate);

            if (S.activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
                renderDayDetailEvents(S.activeDayDetailData);
            }
        });
    }

    // Phím Escape đóng modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalCalAddEvent && modalCalAddEvent.classList.contains('is-active')) {
                closeCalAddEventModal();
            } else if (modalDayDetail && modalDayDetail.classList.contains('is-active')) {
                closeDayDetailModal();
            }
        }
    });

    if (btnCalPrev) {
        btnCalPrev.addEventListener('click', () => {
            S.currentCalMonth--;
            if (S.currentCalMonth < 0) {
                S.currentCalMonth = 11;
                S.currentCalYear--;
            }
            renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
        });
    }

    if (btnCalNext) {
        btnCalNext.addEventListener('click', () => {
            S.currentCalMonth++;
            if (S.currentCalMonth > 11) {
                S.currentCalMonth = 0;
                S.currentCalYear++;
            }
            renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
        });
    }

    if (btnCalToday) {
        btnCalToday.addEventListener('click', () => {
            const now = new Date();
            S.currentCalMonth = now.getMonth();
            S.currentCalYear = now.getFullYear();
            renderMonthlyCalendar(S.currentCalMonth, S.currentCalYear);
        });
    }

    if (calSelectMonth) {
        calSelectMonth.addEventListener('change', () => {
            const m = parseInt(calSelectMonth.value, 10);
            const y = parseInt(calSelectYear.value, 10);
            renderMonthlyCalendar(m, y);
        });
    }

    if (calSelectYear) {
        calSelectYear.addEventListener('change', () => {
            const m = parseInt(calSelectMonth.value, 10);
            const y = parseInt(calSelectYear.value, 10);
            renderMonthlyCalendar(m, y);
        });
    }
}
