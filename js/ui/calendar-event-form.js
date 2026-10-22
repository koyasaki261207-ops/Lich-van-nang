// Form thêm/sửa sự kiện lịch riêng.

import { S } from '../state/store.js';
import { escapeHtml } from '../core/html.js';
import { deleteCalCategory, loadCalCategories, loadCalEvents } from '../services/calendar.service.js';
import { chkCalAllDay, inputCalEndDate, inputCalStartDate, inputCalStartTime, inputCustomCatName } from './calendar.view.js';

// DOM Elements cho Modal Thêm Sự Kiện Lịch Cá Nhân (+ Thêm)
export const modalCalAddEvent = document.getElementById('modal-cal-add-event');

export const btnSaveCalEvent = document.getElementById('btn-save-cal-event');

export const calModalTitle = document.getElementById('cal-modal-title');

export const formCalAddEvent = document.getElementById('form-cal-add-event');

export const inputCalTitle = document.getElementById('cal-event-title');

export const inputCalEndTime = document.getElementById('cal-event-end-time');

export const calStartTimeInputs = document.getElementById('cal-start-time-inputs');

export const calEndTimeInputs = document.getElementById('cal-end-time-inputs');

export const selectCalRepeat = document.getElementById('cal-event-repeat');

export const inputCalRepeatInterval = document.getElementById('cal-event-repeat-interval');

export const calRepeatIntervalGroup = document.getElementById('cal-repeat-interval-group');

export const selectCalReminder = document.getElementById('cal-event-reminder');

export const inputCalAlertType = document.getElementById('cal-event-alert-type');

export const btnAlertTypeAlarm = document.getElementById('btn-alert-type-alarm');

export const btnAlertTypeNotify = document.getElementById('btn-alert-type-notify');

export const calAlertModeWrap = document.getElementById('cal-alert-mode-wrap');

export function setAlertMode(type = 'alarm') {
    const safeType = (type === 'notification') ? 'notification' : 'alarm';
    if (inputCalAlertType) inputCalAlertType.value = safeType;
    if (btnAlertTypeAlarm && btnAlertTypeNotify) {
        if (safeType === 'alarm') {
            btnAlertTypeAlarm.classList.add('is-active');
            btnAlertTypeNotify.classList.remove('is-active');
        } else {
            btnAlertTypeNotify.classList.add('is-active');
            btnAlertTypeAlarm.classList.remove('is-active');
        }
    }
}

export function initAlertModeUI() {
    if (btnAlertTypeAlarm) {
        btnAlertTypeAlarm.addEventListener('click', () => setAlertMode('alarm'));
    }
    if (btnAlertTypeNotify) {
        btnAlertTypeNotify.addEventListener('click', () => setAlertMode('notification'));
    }
    if (selectCalReminder) {
        selectCalReminder.addEventListener('change', () => {
            if (calAlertModeWrap) {
                calAlertModeWrap.style.display = (selectCalReminder.value === 'none') ? 'none' : 'flex';
            }
        });
    }
}

export const calCategoriesList = document.getElementById('cal-categories-list');

export const calAddCustomCatBox = document.getElementById('cal-add-custom-cat-box');

export const textareaCalNote = document.getElementById('cal-event-note');

export const calAttachmentLabel = document.getElementById('cal-attachment-label');

export const calAttachmentPreviewBox = document.getElementById('cal-attachment-preview-box');

export const calAttachmentName = document.getElementById('cal-attachment-name');

export const inputCalUrl = document.getElementById('cal-event-url');

// Xác nhận rồi xoá loại nhãn; giữ lại ít nhất 1 loại
function handleDeleteCalCategory(catId) {
    const cats = loadCalCategories();
    if (cats.length <= 1) {
        alert('Bạn cần giữ lại ít nhất 1 loại nhãn!');
        return;
    }
    const catToDelete = cats.find(c => c.id === catId);
    if (!catToDelete) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa loại nhãn "${catToDelete.name}"?`)) {
        return;
    }

    deleteCalCategory(catId);
    renderCategoryChips();
}

export function renderCategoryChips() {
    if (!calCategoriesList) return;
    const cats = loadCalCategories();
    if (!cats.some(c => c.id === S.currentSelectedCatId) && cats.length > 0) {
        S.currentSelectedCatId = cats[0].id;
    }

    calCategoriesList.innerHTML = '';
    cats.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'cal-cat-chip';
        const isActive = (cat.id === S.currentSelectedCatId);
        if (isActive) {
            chip.classList.add('is-active');
            chip.style.borderColor = cat.color;
            chip.style.background = `${cat.color}25`;
            chip.style.boxShadow = `0 0 10px ${cat.color}40`;
        }
        chip.innerHTML = `
            <span class="cal-cat-dot" style="background: ${cat.color};"></span>
            <span class="cal-cat-name">${escapeHtml(cat.name)}</span>
            <button type="button" class="cal-cat-del-btn" title="Xóa nhãn ${escapeHtml(cat.name)}" aria-label="Xóa nhãn ${escapeHtml(cat.name)}">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        chip.addEventListener('click', () => {
            S.currentSelectedCatId = cat.id;
            renderCategoryChips();
        });

        const delBtn = chip.querySelector('.cal-cat-del-btn');
        if (delBtn) {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteCalCategory(cat.id);
            });
        }

        calCategoriesList.appendChild(chip);
    });

    // Nút + Thêm loại
    const addChip = document.createElement('div');
    addChip.className = 'cal-cat-chip-add';
    addChip.title = 'Thêm loại nhãn mới';
    addChip.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>Thêm</span>
    `;
    addChip.addEventListener('click', () => {
        if (calAddCustomCatBox) {
            const isHidden = (calAddCustomCatBox.style.display === 'none' || !calAddCustomCatBox.style.display);
            calAddCustomCatBox.style.display = isHidden ? 'block' : 'none';
            if (isHidden && inputCustomCatName) inputCustomCatName.focus();
        }
    });
    calCategoriesList.appendChild(addChip);
}

export function openCalAddEventModal(prefillDateStr = null, prefillStartTime = null, prefillEndTime = null) {
    S.editingCalEventId = null;
    if (calModalTitle) calModalTitle.textContent = 'Thêm Sự Kiện Lịch';
    if (btnSaveCalEvent) btnSaveCalEvent.textContent = 'Lưu sự kiện';
    if (!modalCalAddEvent) return;
    if (formCalAddEvent) formCalAddEvent.reset();
    S.currentCalAttachment = null;
    if (calAttachmentPreviewBox) calAttachmentPreviewBox.style.display = 'none';
    if (calAttachmentLabel) calAttachmentLabel.textContent = 'Thêm tệp đính kèm (Ảnh, tài liệu...)';

    // Gán ngày mặc định
    let dateStr = prefillDateStr;
    if (!dateStr) {
        const now = new Date();
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    if (inputCalStartDate) inputCalStartDate.value = dateStr;
    if (inputCalEndDate) inputCalEndDate.value = dateStr;
    if (inputCalStartTime) inputCalStartTime.value = prefillStartTime || '09:00';
    if (inputCalEndTime) inputCalEndTime.value = prefillEndTime || '10:00';
    if (chkCalAllDay) chkCalAllDay.checked = false;
    if (calStartTimeInputs) calStartTimeInputs.classList.remove('is-allday');
    if (calEndTimeInputs) calEndTimeInputs.classList.remove('is-allday');
    if (selectCalRepeat) selectCalRepeat.value = 'none';
    if (inputCalRepeatInterval) inputCalRepeatInterval.value = '1';
    if (calRepeatIntervalGroup) calRepeatIntervalGroup.style.display = 'none';
    if (selectCalReminder) selectCalReminder.value = '10';
    setAlertMode('alarm');
    if (calAlertModeWrap) calAlertModeWrap.style.display = 'flex';
    if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';

    S.currentSelectedCatId = 'nha';
    renderCategoryChips();
    modalCalAddEvent.classList.add('is-active');
    modalCalAddEvent.setAttribute('aria-hidden', 'false');
    setTimeout(() => { if (inputCalTitle) inputCalTitle.focus(); }, 60);
}

export function openCalEditEventModal(eventId) {
    const events = loadCalEvents();
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;

    S.editingCalEventId = eventId;
    if (calModalTitle) calModalTitle.textContent = 'Chỉnh Sửa Sự Kiện';
    if (btnSaveCalEvent) btnSaveCalEvent.textContent = 'Cập nhật';

    if (!modalCalAddEvent) return;
    if (formCalAddEvent) formCalAddEvent.reset();

    // 1. Tiêu đề
    if (inputCalTitle) inputCalTitle.value = evt.title || '';

    // 2. Thời gian
    const sDate = evt.startDate || evt.date || '';
    const eDate = evt.endDate || evt.date || sDate;
    const sTime = evt.startTime || evt.time || '09:00';
    const eTime = evt.endTime || '10:00';
    const isAllDay = !!evt.allDay;

    if (inputCalStartDate) inputCalStartDate.value = sDate;
    if (inputCalEndDate) inputCalEndDate.value = eDate;
    if (inputCalStartTime) inputCalStartTime.value = sTime;
    if (inputCalEndTime) inputCalEndTime.value = eTime;
    if (chkCalAllDay) chkCalAllDay.checked = isAllDay;

    if (calStartTimeInputs) calStartTimeInputs.classList.toggle('is-allday', isAllDay);
    if (calEndTimeInputs) calEndTimeInputs.classList.toggle('is-allday', isAllDay);

    // Lặp lại
    if (selectCalRepeat) selectCalRepeat.value = evt.repeat || 'none';
    if (inputCalRepeatInterval) inputCalRepeatInterval.value = evt.repeatInterval || evt.interval || 1;
    if (calRepeatIntervalGroup) {
        calRepeatIntervalGroup.style.display = (evt.repeat && evt.repeat !== 'none') ? 'inline-flex' : 'none';
    }

    // Nhắc nhở (Reminder) & Kiểu báo
    if (selectCalReminder) {
        selectCalReminder.value = (evt.reminder !== undefined && evt.reminder !== null) ? String(evt.reminder) : '10';
        if (calAlertModeWrap) {
            calAlertModeWrap.style.display = (selectCalReminder.value === 'none') ? 'none' : 'flex';
        }
    }
    setAlertMode(evt.alertType || 'alarm');

    // 3. Loại nhãn
    S.currentSelectedCatId = evt.categoryId || 'nha';
    renderCategoryChips();

    if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';

    // 4. Chi tiết
    if (textareaCalNote) textareaCalNote.value = evt.note || '';

    // Tệp đính kèm
    S.currentCalAttachment = evt.attachment || null;
    if (S.currentCalAttachment) {
        if (calAttachmentName) calAttachmentName.textContent = S.currentCalAttachment.name;
        if (calAttachmentPreviewBox) calAttachmentPreviewBox.style.display = 'flex';
        if (calAttachmentLabel) calAttachmentLabel.textContent = 'Đã chọn: ' + S.currentCalAttachment.name;
    } else {
        if (calAttachmentPreviewBox) calAttachmentPreviewBox.style.display = 'none';
        if (calAttachmentLabel) calAttachmentLabel.textContent = 'Thêm tệp đính kèm (Ảnh, tài liệu...)';
    }

    // URL
    if (inputCalUrl) inputCalUrl.value = evt.url || '';

    modalCalAddEvent.classList.add('is-active');
    modalCalAddEvent.setAttribute('aria-hidden', 'false');
    setTimeout(() => { if (inputCalTitle) inputCalTitle.focus(); }, 60);
}

export function closeCalAddEventModal() {
    if (!modalCalAddEvent) return;
    S.editingCalEventId = null;
    modalCalAddEvent.classList.remove('is-active');
    modalCalAddEvent.setAttribute('aria-hidden', 'true');
}
