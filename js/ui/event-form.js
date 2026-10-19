// Form thêm/sửa sự kiện timeline.

import { S } from '../state/store.js';
import { getKnownRawBannerUrl } from '../core/banner-catalog.js';
import { MS_PER_DAY } from '../core/constants.js';
import { parseLocalDateString, toDateInputVal, toDateTimeInputVal, toDateTimeLocalString } from '../core/date-utils.js';
import { addMonthsToDate, addYearsToDate, calculateRepeatCount, getOccurrenceEnd } from '../core/recurrence.js';
import { loadEvents, saveEvents, unmarkTimelineEventDeleted } from '../services/event.service.js';
import { endDate, startDate } from '../state/store.js';
import { setAiReadingMode } from './ai-scan.view.js';
import { cropperSampleBar, cropperSampleTitle, eventBarPreviewBox, eventImageData, previewBarTitle, removeCroppedImage, setCroppedResult } from './image-cropper.view.js';
import { updateFilterUI } from './tag-filter.view.js';
import { getColWidth, renderEvents, timelineTracks, timelineViewport } from './timeline.view.js';
import { showToastNotification } from './toast.js';

export const btnAddEvent = document.getElementById('btn-add-event');

export const modalAddEvent = document.getElementById('modal-add-event');

export const btnCloseModal = document.getElementById('btn-close-modal');

export const btnCancelModal = document.getElementById('btn-cancel-modal');

export const formAddEvent = document.getElementById('form-add-event');

export const inputTitle = document.getElementById('event-title');

export const inputStart = document.getElementById('event-start');

export const inputEnd = document.getElementById('event-end');

// Các phần tử Lặp lại sự kiện (Recurring Events)
export const inputRepeatType = document.getElementById('event-repeat-type');

export const inputRepeatStart = document.getElementById('event-repeat-start');

export const inputRepeatEnd = document.getElementById('event-repeat-end');

export const inputRepeatForever = document.getElementById('event-repeat-forever');

export const repeatRangeGroup = document.getElementById('repeat-range-group');

export const repeatStatusHint = document.getElementById('repeat-status-hint');

export const inputArticleUrl = document.getElementById('event-article-url');

export const inputTag = document.getElementById('event-tag');

export const inputNote = document.getElementById('event-note');

// ========================================================
// TỰ ĐỘNG ĐỒNG BỘ CHU KỲ THEO TÊN & QUẢN LÝ TAG
// ========================================================
export function updateTitleSuggestions() {
    const datalist = document.getElementById('event-title-suggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    const events = loadEvents();
    const seen = new Set();
    events.forEach(e => {
        const t = (e.title || '').trim();
        if (t && !seen.has(t.toLowerCase())) {
            seen.add(t.toLowerCase());
            const opt = document.createElement('option');
            opt.value = t;
            datalist.appendChild(opt);
        }
    });
}

export function updateTagSuggestions() {
    const datalist = document.getElementById('event-tag-suggestions');
    const quickTagsContainer = document.getElementById('quick-tags-container');
    const quickTagsList = document.getElementById('quick-tags-list');

    if (datalist) datalist.innerHTML = '';
    if (quickTagsList) quickTagsList.innerHTML = '';

    const events = loadEvents();
    const tagCounts = {};
    events.forEach(e => {
        const t = (e.tag || '').trim().toLowerCase();
        if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
    const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

    if (sortedTags.length > 0) {
        if (quickTagsContainer) quickTagsContainer.style.display = 'flex';
        const curVal = (inputTag ? inputTag.value : '').trim().toLowerCase();

        sortedTags.forEach(t => {
            if (datalist) {
                const opt = document.createElement('option');
                opt.value = t;
                datalist.appendChild(opt);
            }
            if (quickTagsList) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-quick-tag' + (curVal === t ? ' is-selected' : '');
                btn.dataset.tag = t;
                btn.textContent = `#${t}`;
                btn.addEventListener('click', () => {
                    if (inputTag) {
                        inputTag.value = t;
                        document.querySelectorAll('.btn-quick-tag').forEach(b => b.classList.remove('is-selected'));
                        btn.classList.add('is-selected');
                        inputTag.focus();
                    }
                });
                quickTagsList.appendChild(btn);
            }
        });
    } else {
        if (quickTagsContainer) quickTagsContainer.style.display = 'none';
    }
}

if (inputTag) {
    inputTag.addEventListener('input', () => {
        const curVal = inputTag.value.trim().toLowerCase();
        document.querySelectorAll('.btn-quick-tag').forEach(b => {
            if (b.dataset.tag === curVal) {
                b.classList.add('is-selected');
            } else {
                b.classList.remove('is-selected');
            }
        });
    });
}

// Giới hạn ghi chú tối đa 3 dòng (chặn phím Enter và cắt khi dán)
if (inputNote) {
    inputNote.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const lines = inputNote.value.split('\n');
            if (lines.length >= 3) {
                e.preventDefault();
            }
        }
    });

    inputNote.addEventListener('input', () => {
        const lines = inputNote.value.split('\n');
        if (lines.length > 3) {
            inputNote.value = lines.slice(0, 3).join('\n');
        }
    });
}

export function checkTitleSync() {
    const titleVal = inputTitle ? inputTitle.value.trim() : '';
    const hintEl = document.getElementById('recurring-sync-hint');
    const hintText = document.getElementById('recurring-sync-text');

    if (!titleVal) {
        if (hintEl) hintEl.style.display = 'none';
        return;
    }

    const events = loadEvents();
    // Tìm sự kiện đã có cùng tên (không phân biệt chữ hoa thường)
    const matched = [...events].reverse().find(e =>
        (e.title || '').trim().toLowerCase() === titleVal.toLowerCase()
    );

    if (matched) {
        // Tự động sao chép ảnh nếu người dùng chưa tự tải ảnh khác
        if (!eventImageData.value || S.isAutoSyncedImage) {
            const imgToUse = matched.imageUrl || matched.rawImageUrl;
            if (imgToUse) {
                S.originalImageSrc = matched.rawImageUrl || getKnownRawBannerUrl(matched.title) || matched.imageUrl;
                S.isAutoSyncedImage = true;
                setCroppedResult(imgToUse, matched.color || '#d6aa7d');
            }
        }

        // Tự động sao chép màu sắc
        if (matched.color) {
            S.currentEventColor = matched.color;
            if (eventBarPreviewBox) eventBarPreviewBox.style.background = matched.color;
            if (cropperSampleBar) cropperSampleBar.style.background = matched.color;
        }

        // Tự động sao chép đường dẫn bài viết nếu người dùng chưa nhập
        if (inputArticleUrl && !inputArticleUrl.value && matched.url) {
            inputArticleUrl.value = matched.url;
        }

        // Tự động sao chép Ghi chú nếu sự kiện trước có Ghi chú và người dùng chưa gõ Ghi chú
        if (inputNote && !inputNote.value && matched.note) {
            inputNote.value = matched.note;
        }

        // Tự động sao chép Tag nếu sự kiện trước có Tag và người dùng chưa gõ Tag
        if (inputTag && !inputTag.value && matched.tag) {
            inputTag.value = matched.tag;
            document.querySelectorAll('.btn-quick-tag').forEach(b => {
                if (b.dataset.tag === matched.tag.toLowerCase()) {
                    b.classList.add('is-selected');
                } else {
                    b.classList.remove('is-selected');
                }
            });
        }

        // Đề xuất thời gian bắt đầu nối tiếp kỳ trước nếu người dùng chưa chỉnh sửa ngày thủ công
        if (matched.end && (!inputStart.dataset.userModified || inputStart.dataset.userModified === 'false')) {
            const prevEnd = new Date(matched.end);
            if (!isNaN(prevEnd.getTime())) {
                const toInputVal = (d) => {
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };
                inputStart.value = toInputVal(prevEnd);

                const prevStart = new Date(matched.start);
                const durationMs = (!isNaN(prevStart.getTime()) && prevEnd.getTime() > prevStart.getTime())
                    ? (prevEnd.getTime() - prevStart.getTime())
                    : (14 * 24 * 3600 * 1000);
                const nextEnd = new Date(prevEnd.getTime() + durationMs);
                inputEnd.value = toInputVal(nextEnd);
            }
        }

        if (hintEl && hintText) {
            hintText.textContent = `Đã nhận diện chu kỳ "${matched.title}": Tự động đồng bộ ảnh, màu sắc, tag và xếp nối tiếp cùng dòng!`;
            hintEl.style.display = 'flex';
        }
    } else {
        if (hintEl) hintEl.style.display = 'none';
    }
}

// Cập nhật tiêu đề & màu sắc xem trước khi người dùng nhập thông tin
if (inputTitle) {
    inputTitle.addEventListener('input', () => {
        const curTitle = inputTitle.value.trim() || 'Tên hoạt động';
        if (previewBarTitle) previewBarTitle.textContent = curTitle;
        if (cropperSampleTitle) cropperSampleTitle.textContent = curTitle;
        checkTitleSync();
    });
    inputTitle.addEventListener('change', checkTitleSync);
}

if (inputStart) {
    inputStart.addEventListener('input', () => {
        inputStart.dataset.userModified = 'true';
    });
    inputStart.addEventListener('change', () => {
        if (inputRepeatStart && inputRepeatStart.dataset.userModified !== 'true') {
            if (inputStart.value) {
                inputRepeatStart.value = inputStart.value.split('T')[0];
                updateRepeatStatusHint();
            }
        }
    });
}

if (inputEnd) {
    inputEnd.addEventListener('input', () => {
        inputEnd.dataset.userModified = 'true';
    });
}

export function updateRepeatStatusHint() {
    if (!inputRepeatType || !repeatStatusHint) return;
    const type = inputRepeatType.value || 'none';
    const isForever = inputRepeatForever && inputRepeatForever.checked;

    if (type === 'none') {
        if (repeatRangeGroup) {
            repeatRangeGroup.classList.remove('is-active');
            repeatRangeGroup.classList.add('is-disabled');
        }
        if (inputRepeatStart) inputRepeatStart.disabled = true;
        if (inputRepeatEnd) {
            inputRepeatEnd.disabled = true;
            inputRepeatEnd.style.opacity = '';
            inputRepeatEnd.style.filter = '';
            inputRepeatEnd.style.cursor = '';
            inputRepeatEnd.title = 'Đến ngày (dd/mm/yyyy)';
        }
        if (inputRepeatForever) {
            inputRepeatForever.disabled = true;
            inputRepeatForever.checked = false;
        }
        repeatStatusHint.innerHTML = '<span class="repeat-badge-idle">Không lặp lại</span>';
        return;
    }

    if (repeatRangeGroup) {
        repeatRangeGroup.classList.remove('is-disabled');
        repeatRangeGroup.classList.add('is-active');
    }
    if (inputRepeatStart) inputRepeatStart.disabled = false;
    if (inputRepeatForever) inputRepeatForever.disabled = false;

    if (isForever) {
        if (inputRepeatEnd) {
            inputRepeatEnd.disabled = true;
            inputRepeatEnd.style.opacity = '0.35';
            inputRepeatEnd.style.filter = 'grayscale(1)';
            inputRepeatEnd.style.cursor = 'not-allowed';
            inputRepeatEnd.title = 'Lặp vĩnh viễn (không giới hạn ngày kết thúc)';
        }
    } else {
        if (inputRepeatEnd) {
            inputRepeatEnd.disabled = false;
            inputRepeatEnd.style.opacity = '1';
            inputRepeatEnd.style.filter = 'none';
            inputRepeatEnd.style.cursor = 'pointer';
            inputRepeatEnd.title = 'Đến ngày (dd/mm/yyyy)';
        }
    }

    const startVal = inputRepeatStart ? inputRepeatStart.value : '';
    const endVal = inputRepeatEnd ? inputRepeatEnd.value : '';

    if (!startVal || (!isForever && !endVal)) {
        repeatStatusHint.innerHTML = '<span class="repeat-badge-idle">Chọn khoảng ngày lặp</span>';
        return;
    }

    const count = calculateRepeatCount(type, startVal, endVal, isForever, {
        timelineEnd: endDate,
        baseStartVal: inputStart ? inputStart.value : '',
        baseEndVal: inputEnd ? inputEnd.value : '',
        endUserModified: !!inputEnd && inputEnd.dataset.userModified === 'true'
    });
    if (count === -1) {
        repeatStatusHint.innerHTML = '<span class="repeat-badge-error">⚠️ Ngày kết thúc phải sau ngày bắt đầu</span>';
    } else if (count === 0) {
        repeatStatusHint.innerHTML = '<span class="repeat-badge-error">⚠️ Khoảng ngày không tạo ra sự kiện nào</span>';
    } else {
        const labels = {
            daily: 'Mỗi ngày',
            weekly: 'Mỗi tuần',
            monthly: 'Mỗi tháng',
            yearly: 'Mỗi năm'
        };
        const label = labels[type] || '';
        if (isForever) {
            repeatStatusHint.innerHTML = `
                <span class="repeat-badge-active" title="Tự động lặp vĩnh viễn trên lịch">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Vĩnh viễn (${label})
                </span>
            `;
        } else {
            repeatStatusHint.innerHTML = `
                <span class="repeat-badge-active">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Sẽ tạo ${count} sự kiện (${label})
                </span>
            `;
        }
    }
}

if (inputRepeatType) {
    inputRepeatType.addEventListener('change', () => {
        const type = inputRepeatType.value || 'none';
        if (type !== 'none') {
            if (inputRepeatStart && (!inputRepeatStart.value || inputRepeatStart.dataset.userModified !== 'true')) {
                if (inputStart && inputStart.value) {
                    inputRepeatStart.value = inputStart.value.split('T')[0];
                } else {
                    inputRepeatStart.value = toDateInputVal(new Date());
                }
            }

            const sDate = parseLocalDateString(inputRepeatStart.value) || new Date();
            let eDate = new Date(sDate);
            if (type === 'daily') {
                eDate.setDate(eDate.getDate() + 14);
            } else if (type === 'weekly') {
                eDate.setDate(eDate.getDate() + 56);
            } else if (type === 'monthly') {
                eDate = addMonthsToDate(eDate, 6);
            } else if (type === 'yearly') {
                eDate = addYearsToDate(eDate, 2);
            }
            if (inputRepeatEnd && (!inputRepeatEnd.value || inputRepeatEnd.value <= inputRepeatStart.value)) {
                inputRepeatEnd.value = toDateInputVal(eDate);
            }

            // Tự động tối ưu thời lượng sự kiện gốc nếu người dùng chưa sửa thủ công:
            // Nếu lặp 'mỗi ngày' mà sự kiện kéo dài 14 ngày thì các lần lặp sẽ chồng lấn lên nhau 14 hàng.
            // Tự động thu gọn về trong ngày để tất cả các ngày lặp xếp thẳng hàng trên 1 dòng duy nhất!
            if (inputEnd && inputEnd.dataset.userModified !== 'true' && inputStart && inputStart.value) {
                const s = new Date(inputStart.value);
                if (type === 'daily') {
                    const endSameDay = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59);
                    inputEnd.value = toDateTimeInputVal(endSameDay);
                } else if (type === 'weekly') {
                    const endWeek = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59);
                    inputEnd.value = toDateTimeInputVal(endWeek);
                }
            }
        } else {
            // Khôi phục lại 14 ngày mặc định nếu chuyển về Không lặp lại và người dùng chưa sửa
            if (inputEnd && inputEnd.dataset.userModified !== 'true' && inputStart && inputStart.value) {
                const s = new Date(inputStart.value);
                const endDef = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 14, 18, 0);
                inputEnd.value = toDateTimeInputVal(endDef);
            }
        }
        updateRepeatStatusHint();
    });
}

if (inputRepeatStart) {
    inputRepeatStart.addEventListener('input', () => {
        inputRepeatStart.dataset.userModified = 'true';
        updateRepeatStatusHint();
    });
}

if (inputRepeatEnd) {
    inputRepeatEnd.addEventListener('input', () => {
        inputRepeatEnd.dataset.userModified = 'true';
        updateRepeatStatusHint();
    });
}

if (inputRepeatForever) {
    inputRepeatForever.addEventListener('change', () => {
        updateRepeatStatusHint();
    });
}

// 7.10 Điều khiển Hộp thoại Modal Thêm Hoạt Động (Add Event Modal)
export function openModal() {
    if (!modalAddEvent) return;
    modalAddEvent.classList.add('is-active');
    modalAddEvent.setAttribute('aria-hidden', 'false');

    // Luôn mặc định mở ở Chế độ ảnh minh họa thường (không tự kích hoạt AI)
    S.pendingScanFile = null;
    setAiReadingMode(false);

    updateTitleSuggestions();
    updateTagSuggestions();
    if (inputTag) inputTag.value = '';
    if (inputNote) inputNote.value = '';
    document.querySelectorAll('.btn-quick-tag').forEach(b => b.classList.remove('is-selected'));

    S.currentEventColor = '#d6aa7d';
    if (eventBarPreviewBox) eventBarPreviewBox.style.background = '#d6aa7d';

    S.isAutoSyncedImage = false;
    if (inputStart) inputStart.dataset.userModified = 'false';
    if (inputEnd) inputEnd.dataset.userModified = 'false';
    const hintEl = document.getElementById('recurring-sync-hint');
    if (hintEl) hintEl.style.display = 'none';

    const nowObj = new Date();
    const startDef = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate(), nowObj.getHours(), 0);
    const endDef = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate() + 14, 18, 0);

    const toInputVal = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    if (inputStart && !inputStart.value) inputStart.value = toInputVal(startDef);
    if (inputEnd && !inputEnd.value) inputEnd.value = toInputVal(endDef);

    if (inputRepeatType) inputRepeatType.value = 'none';
    if (inputRepeatStart) {
        inputRepeatStart.dataset.userModified = 'false';
        inputRepeatStart.value = toDateInputVal(startDef);
    }
    if (inputRepeatEnd) {
        inputRepeatEnd.dataset.userModified = 'false';
        inputRepeatEnd.value = '';
        inputRepeatEnd.style.opacity = '';
        inputRepeatEnd.style.filter = '';
        inputRepeatEnd.style.cursor = '';
        inputRepeatEnd.title = 'Đến ngày (dd/mm/yyyy)';
    }
    if (inputRepeatForever) {
        inputRepeatForever.checked = false;
        inputRepeatForever.disabled = true;
    }
    updateRepeatStatusHint();

    if (inputTitle) {
        setTimeout(() => inputTitle.focus(), 50);
    }
}

export function closeModal() {
    if (!modalAddEvent) return;
    modalAddEvent.classList.remove('is-active');
    modalAddEvent.setAttribute('aria-hidden', 'true');
    if (formAddEvent) formAddEvent.reset();
    if (inputArticleUrl) inputArticleUrl.value = '';
    if (inputTag) inputTag.value = '';
    if (inputNote) inputNote.value = '';
    document.querySelectorAll('.btn-quick-tag').forEach(b => b.classList.remove('is-selected'));
    const hintEl = document.getElementById('recurring-sync-hint');
    if (hintEl) hintEl.style.display = 'none';
    S.isAutoSyncedImage = false;
    if (inputStart) inputStart.dataset.userModified = 'false';
    if (inputEnd) inputEnd.dataset.userModified = 'false';

    if (inputRepeatType) inputRepeatType.value = 'none';
    if (inputRepeatStart) {
        inputRepeatStart.value = '';
        inputRepeatStart.dataset.userModified = 'false';
    }
    if (inputRepeatEnd) {
        inputRepeatEnd.value = '';
        inputRepeatEnd.dataset.userModified = 'false';
        inputRepeatEnd.style.opacity = '';
        inputRepeatEnd.style.filter = '';
        inputRepeatEnd.style.cursor = '';
        inputRepeatEnd.title = 'Đến ngày (dd/mm/yyyy)';
    }
    if (inputRepeatForever) {
        inputRepeatForever.checked = false;
        inputRepeatForever.disabled = true;
    }
    updateRepeatStatusHint();

    removeCroppedImage();
    S.pendingScanFile = null;
    setAiReadingMode(false);
}

if (btnAddEvent) btnAddEvent.addEventListener('click', openModal);

if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

if (modalAddEvent) {
    modalAddEvent.addEventListener('click', (e) => {
        if (e.target === modalAddEvent) closeModal();
    });
}

// 7.11 Gửi Form Lưu hoạt động mới
if (formAddEvent) {
    formAddEvent.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = inputTitle.value.trim();
        const startVal = inputStart.value;
        const endVal = inputEnd.value;
        const imgVal = (eventImageData && eventImageData.value.trim()) || '';
        const colorVal = S.currentEventColor || '#d6aa7d';
        const articleUrlVal = (inputArticleUrl && inputArticleUrl.value.trim()) || '';
        const tagVal = (inputTag && inputTag.value.trim().toLowerCase()) || '';
        const noteVal = (inputNote && inputNote.value.trim()) || '';

        if (!title) {
            alert('Vui lòng nhập tên hoạt động!');
            return;
        }
        if (new Date(endVal).getTime() <= new Date(startVal).getTime()) {
            alert('Thời gian kết thúc phải diễn ra sau thời gian bắt đầu!');
            return;
        }

        const repeatType = (inputRepeatType && inputRepeatType.value) || 'none';
        const repeatStartVal = inputRepeatStart ? inputRepeatStart.value : '';
        const repeatEndVal = inputRepeatEnd ? inputRepeatEnd.value : '';

        const eventsToAdd = [];

        const isForever = inputRepeatForever && inputRepeatForever.checked;

        if (repeatType === 'none') {
            eventsToAdd.push({
                id: 'evt_' + Date.now(),
                title: title,
                start: startVal,
                end: endVal,
                color: colorVal,
                imageUrl: imgVal,
                rawImageUrl: (S.originalImageSrc && typeof S.originalImageSrc === 'string' && S.originalImageSrc.startsWith('data:') && S.originalImageSrc.length > 150000) ? (getKnownRawBannerUrl(title) || '') : (S.originalImageSrc || getKnownRawBannerUrl(title) || imgVal || ''),
                url: articleUrlVal,
                tag: tagVal,
                note: noteVal
            });
        } else {
            if (!repeatStartVal) {
                alert('Vui lòng chọn ngày bắt đầu lặp lại!');
                return;
            }
            const dRepeatStart = parseLocalDateString(repeatStartVal);
            if (!dRepeatStart) {
                alert('Thời gian bắt đầu lặp lại không hợp lệ!');
                return;
            }

            const maxTimelineEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

            let limitEnd;
            let repeatLimitEndStr = '';
            if (isForever) {
                // Vĩnh viễn: Giới hạn tối đa đúng bằng rìa hiển thị của timeline hiện tại (không tạo dư ra ngoài màn hình)
                limitEnd = maxTimelineEnd;
            } else {
                if (!repeatEndVal) {
                    alert('Vui lòng chọn ngày kết thúc lặp lại hoặc tích chọn Vĩnh viễn!');
                    return;
                }
                const dRepeatEnd = parseLocalDateString(repeatEndVal);
                if (!dRepeatEnd) {
                    alert('Thời gian kết thúc lặp lại không hợp lệ!');
                    return;
                }
                const rawLimitEnd = new Date(dRepeatEnd.getFullYear(), dRepeatEnd.getMonth(), dRepeatEnd.getDate(), 23, 59, 59, 999);
                if (rawLimitEnd.getTime() < dRepeatStart.getTime()) {
                    alert('Thời gian kết thúc lặp lại phải sau hoặc bằng ngày bắt đầu lặp!');
                    return;
                }
                repeatLimitEndStr = toDateTimeLocalString(rawLimitEnd);
                // Giới hạn không vượt quá rìa hiển thị của timeline
                limitEnd = rawLimitEnd.getTime() > maxTimelineEnd.getTime() ? maxTimelineEnd : rawLimitEnd;
            }

            // Tính toán khoảng cách thời lượng (duration) của sự kiện
            const baseStartDate = new Date(startVal);
            const baseEndDate = new Date(endVal);
            let durationMs = baseEndDate.getTime() - baseStartDate.getTime();

            // Tối ưu thông minh: Nếu lặp mỗi ngày mà người dùng chưa chỉnh thời lượng (để mặc định 14 ngày)
            // thì tự động đặt thời lượng kết thúc lúc 23:59:59 của cùng ngày,
            // tránh việc các sự kiện lặp bị gối nhau 14 ngày làm bung ra 14 hàng khác nhau!
            if (repeatType === 'daily' && durationMs > 24 * 3600000 && inputEnd && inputEnd.dataset.userModified !== 'true') {
                const sameDayEnd = new Date(baseStartDate.getFullYear(), baseStartDate.getMonth(), baseStartDate.getDate(), 23, 59, 59);
                durationMs = Math.max(3600000, sameDayEnd.getTime() - baseStartDate.getTime());
            } else if (repeatType === 'weekly' && durationMs > 7 * 24 * 3600000 && inputEnd && inputEnd.dataset.userModified !== 'true') {
                const weekEnd = new Date(baseStartDate.getFullYear(), baseStartDate.getMonth(), baseStartDate.getDate() + 6, 23, 59, 59);
                durationMs = Math.max(3600000, weekEnd.getTime() - baseStartDate.getTime());
            }

            const startHour = baseStartDate.getHours();
            const startMin = baseStartDate.getMinutes();

            let curStart = new Date(dRepeatStart.getFullYear(), dRepeatStart.getMonth(), dRepeatStart.getDate(), startHour, startMin, 0);
            let occIndex = 0;
            const maxOcc = 200;
            const batchId = 'rep_' + Date.now();

            while (curStart.getTime() <= limitEnd.getTime() && occIndex < maxOcc) {
                const curEnd = getOccurrenceEnd(curStart, repeatType, baseStartDate, baseEndDate);
                // Quy tắc: Khi có đủ không gian hiển thị thêm sự kiện lặp lại nữa mới tạo ra
                if (occIndex > 0 && (curEnd.getTime() > limitEnd.getTime())) {
                    break;
                }
                if (curStart.getTime() >= limitEnd.getTime()) {
                    break;
                }
                eventsToAdd.push({
                    id: 'evt_' + Date.now() + '_' + occIndex,
                    repeatId: batchId,
                    repeatType: repeatType,
                    isForever: isForever,
                    repeatLimitEnd: repeatLimitEndStr,
                    title: title,
                    start: toDateTimeLocalString(curStart),
                    end: toDateTimeLocalString(curEnd),
                    color: colorVal,
                    imageUrl: imgVal,
                    rawImageUrl: (S.originalImageSrc && typeof S.originalImageSrc === 'string' && S.originalImageSrc.startsWith('data:') && S.originalImageSrc.length > 150000) ? (getKnownRawBannerUrl(title) || '') : (S.originalImageSrc || getKnownRawBannerUrl(title) || imgVal || ''),
                    url: articleUrlVal,
                    tag: tagVal,
                    note: noteVal
                });

                occIndex++;
                if (repeatType === 'daily') {
                    curStart.setDate(curStart.getDate() + 1);
                } else if (repeatType === 'weekly') {
                    curStart.setDate(curStart.getDate() + 7);
                } else if (repeatType === 'monthly') {
                    curStart = addMonthsToDate(curStart, 1);
                } else if (repeatType === 'yearly') {
                    curStart = addYearsToDate(curStart, 1);
                } else {
                    break;
                }
            }

            if (eventsToAdd.length === 0) {
                alert('Khoảng thời gian lặp không tạo ra sự kiện nào!');
                return;
            }
        }

        eventsToAdd.forEach(e => {
            if (e.id) unmarkTimelineEventDeleted(e.id);
        });
        const events = loadEvents();
        events.push(...eventsToAdd);
        saveEvents(events);

        // Tự động bỏ lọc tag (nếu đang bật) để các sự kiện vừa tạo chắc chắn được nhìn thấy ngay
        if (S.activeTagFilter) {
            S.activeTagFilter = null;
            updateFilterUI(events);
        }

        const firstEventId = eventsToAdd[0].id;
        const repeatBatchId = eventsToAdd[0].repeatId;

        // Đặt cờ để đưa hàng chứa sự kiện mới lên Hàng #1 ngay trên cùng của timeline
        S.trackToHoistOnRender = repeatBatchId || firstEventId;

        closeModal();
        renderEvents();
        updateTitleSuggestions();
        updateTagSuggestions();

        // Tự động cuộn đến sự kiện mới thêm: Hàng mới đã được đưa lên trên cùng (top: 0),
        // chỉ cần cuộn ngang đến ngày bắt đầu là người dùng thấy ngay lập tức!
        setTimeout(() => {
            const firstStart = eventsToAdd[0].start;
            const diffStartMs = new Date(firstStart).getTime() - startDate.getTime();
            const targetLeft = Math.max(0, (diffStartMs / MS_PER_DAY + 0.5) * getColWidth() - (timelineViewport.clientWidth / 2));

            if (timelineViewport) {
                timelineViewport.scrollTo({
                    left: targetLeft,
                    top: 0,
                    behavior: 'smooth'
                });
            }

            const targetBar = (repeatBatchId ? timelineTracks.querySelector(`.event-bar[data-repeat-id="${repeatBatchId}"]`) : null)
                || timelineTracks.querySelector(`.event-bar[data-event-id="${firstEventId}"]`);

            if (targetBar) {
                const newBars = repeatBatchId
                    ? timelineTracks.querySelectorAll(`.event-bar[data-repeat-id="${repeatBatchId}"]`)
                    : [targetBar];

                newBars.forEach(b => b.classList.add('new-event-highlight'));
                setTimeout(() => {
                    newBars.forEach(b => b.classList.remove('new-event-highlight'));
                }, 4500);
            }

            // Hiển thị thông báo Toast đẹp mắt
            const countMsg = eventsToAdd.length > 1 ? `${eventsToAdd.length} sự kiện lặp lại` : 'sự kiện';
            showToastNotification(`Đã tạo thành công ${countMsg} "${title}"!`);
        }, 60);
    });
}
