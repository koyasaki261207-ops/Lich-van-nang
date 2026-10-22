// Modal chi tiết sự kiện và xoá sự kiện lặp lại.

import { S } from '../state/store.js';
import { getKnownRawBannerUrl } from '../core/banner-catalog.js';
import { formatDetailDateRange } from '../core/date-utils.js';
import { getCurrentUser } from '../services/auth.service.js';
import { loadEvents, recordDeletedTimelineIds, saveEvents } from '../services/event.service.js';
import { pushLocalDataToCloud } from '../services/sync.service.js';
import { closeModal, modalAddEvent, updateTagSuggestions, updateTitleSuggestions } from './event-form.js';
import { closeCropper, modalCropImage } from './image-cropper.view.js';
import { deleteEvent, renderEvents } from './timeline.view.js';
import { closeReorderModal, modalReorderTracks, openReorderModal } from './track-manager.view.js';
import { deleteCalEvent, excludeCalEventDate, stopCalEventRepeatFrom } from './calendar-event-view.js';

// Các phần tử trong Modal Chi tiết Sự kiện
export const modalEventDetail = document.getElementById('modal-event-detail');

export const btnCloseEventDetail = document.getElementById('btn-close-event-detail');

export const detailImageBox = document.getElementById('detail-image-box');

export const detailImage = document.getElementById('detail-image');

export const detailTitle = document.getElementById('detail-title');

export const detailTime = document.getElementById('detail-time');

export const detailLinkBox = document.getElementById('detail-link-box');

export const detailLink = document.getElementById('detail-link');

export const detailCountdown = document.getElementById('detail-countdown');

export const btnDeleteDetailEvent = document.getElementById('btn-delete-detail-event');

export const detailTagBox = document.getElementById('detail-tag-box');

export const detailTagPill = document.getElementById('detail-tag-pill');

export const detailRepeatPill = document.getElementById('detail-repeat-pill');

export const detailNote = document.getElementById('detail-note');

// Các phần tử trong Modal Xóa / Dừng Sự Kiện Lặp Lại
export const modalDeleteRepeat = document.getElementById('modal-delete-repeat');

export const btnCloseDeleteRepeat = document.getElementById('btn-close-delete-repeat');

export const btnCancelDeleteRepeat = document.getElementById('btn-cancel-delete-repeat');

export const btnDeleteThisOnly = document.getElementById('btn-delete-this-only');

export const btnDeleteFromHere = document.getElementById('btn-delete-from-here');

export const btnDeleteAllRepeat = document.getElementById('btn-delete-all-repeat');

export const deleteRepeatSubtitle = document.getElementById('delete-repeat-subtitle');

// Các phần tử trong Modal Xác Nhận Xóa Sự Kiện Đơn Lẻ
export const modalConfirmDelete = document.getElementById('modal-confirm-delete');
export const btnCloseConfirmDelete = document.getElementById('btn-close-confirm-delete');
export const btnCancelConfirmDelete = document.getElementById('btn-cancel-confirm-delete');
export const btnSubmitConfirmDelete = document.getElementById('btn-submit-confirm-delete');
export const confirmDeleteTitle = document.getElementById('confirm-delete-title');
export const confirmDeleteSubtitle = document.getElementById('confirm-delete-subtitle');
export const confirmDeleteEventName = document.getElementById('confirm-delete-event-name');
export const confirmDeleteEventMeta = document.getElementById('confirm-delete-event-meta');

export const detailTrackBadge = document.getElementById('detail-track-badge');

export const btnDetailSwapTrack = document.getElementById('btn-detail-swap-track');

export function updateDetailCountdown(evt) {
    if (!evt || !detailCountdown) return;
    const nowMs = Date.now();
    const startMs = new Date(evt.start).getTime();
    const endMs = new Date(evt.end).getTime();

    const isStarted = nowMs >= startMs;
    const isEnded = nowMs >= endMs;

    function formatHMS(diffMs) {
        if (diffMs <= 0) return '00:00:00';
        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
        if (days > 0) return `${days}d ${timeStr}`;
        return timeStr;
    }

    if (!isStarted) {
        const diffStart = startMs - nowMs;
        detailCountdown.textContent = `Bắt đầu sau ${formatHMS(diffStart)}`;
    } else if (!isEnded) {
        const diffEnd = endMs - nowMs;
        detailCountdown.textContent = `Kết thúc sau ${formatHMS(diffEnd)}`;
    } else {
        detailCountdown.textContent = 'Đã kết thúc';
    }
}

export function openEventDetail(evt) {
    if (!modalEventDetail || !evt) return;
    S.currentDetailEvent = evt;

    // 1. Ảnh chưa cắt (Ưu tiên rawImageUrl nếu có, sau đó tìm từ chuỗi lặp lại, sự kiện cùng tên hoặc kho banner gốc)
    let bannerImgSrc = evt.rawImageUrl;
    if (!bannerImgSrc || bannerImgSrc === evt.imageUrl) {
        const allEvts = loadEvents();
        if (evt.repeatId) {
            const sibling = allEvts.find(e => e.repeatId === evt.repeatId && e.rawImageUrl && e.rawImageUrl !== e.imageUrl);
            if (sibling) bannerImgSrc = sibling.rawImageUrl;
        }
        if (!bannerImgSrc && evt.title) {
            const sameTitle = allEvts.find(e => e.title && e.title.trim().toLowerCase() === evt.title.trim().toLowerCase() && e.rawImageUrl && e.rawImageUrl !== e.imageUrl);
            if (sameTitle) bannerImgSrc = sameTitle.rawImageUrl;
        }
        if (!bannerImgSrc) {
            bannerImgSrc = getKnownRawBannerUrl(evt.title);
        }
        if (bannerImgSrc && !evt.rawImageUrl) {
            evt.rawImageUrl = bannerImgSrc;
        }
    }
    if (!bannerImgSrc) {
        bannerImgSrc = evt.imageUrl;
    }

    if (bannerImgSrc) {
        detailImage.src = bannerImgSrc;
        detailImageBox.style.display = 'block';
    } else {
        detailImage.src = '';
        detailImageBox.style.display = 'none';
    }

    // 2. Tên sự kiện
    detailTitle.textContent = evt.title || '';

    // 2.0 Nhãn Lặp lại nếu có
    if (detailRepeatPill) {
        const isRepeating = (evt.repeatType && evt.repeatType !== 'none') || !!evt.repeatId;
        if (isRepeating) {
            const repeatTypeLabels = {
                daily: 'Mỗi ngày',
                weekly: 'Mỗi tuần',
                monthly: 'Mỗi tháng',
                yearly: 'Mỗi năm'
            };
            const repeatLabel = repeatTypeLabels[evt.repeatType] || 'Chu kỳ lặp';
            detailRepeatPill.textContent = `🔁 ${repeatLabel}${evt.isForever ? ' (Vĩnh viễn)' : ''}`;
            detailRepeatPill.style.display = 'inline-flex';
        } else {
            detailRepeatPill.textContent = '';
            detailRepeatPill.style.display = 'none';
        }
    }

    // 2.1 Nhãn nhóm / Tag liên kết nếu có
    if (detailTagBox && detailTagPill) {
        if (evt.tag) {
            detailTagBox.style.display = 'flex';
            detailTagPill.textContent = '#' + evt.tag;
        } else {
            detailTagBox.style.display = 'none';
            detailTagPill.textContent = '';
        }
    }

    // 2.2 Ghi chú / Note nếu có (chỉ hiển thị nội dung đơn giản)
    if (detailNote) {
        if (evt.note && evt.note.trim()) {
            detailNote.textContent = evt.note.trim();
            detailNote.style.display = 'block';
        } else {
            detailNote.textContent = '';
            detailNote.style.display = 'none';
        }
    }

    // 3. Thời gian sự kiện: CN, 27 Th09 2026 23:00 - T2, 2 Th11 2026 02:59
    const dStart = new Date(evt.start);
    const dEnd = new Date(evt.end);
    detailTime.textContent = formatDetailDateRange(dStart, dEnd);

    // 4. Đường dẫn liên kết Hoyolab nếu có
    if (evt.url) {
        detailLink.href = evt.url;
        detailLink.textContent = evt.url;
        detailLinkBox.style.display = 'block';
    } else {
        detailLink.href = '#';
        detailLink.textContent = '';
        detailLinkBox.style.display = 'none';
    }

    // 4.1 Vị trí dòng hiện tại & Nút đổi nhanh
    if (detailTrackBadge) {
        const visualRow = (typeof evt.visualTrackIndex === 'number' ? evt.visualTrackIndex : 0) + 1;
        detailTrackBadge.textContent = `Hàng #${visualRow}`;
    }
    if (btnDetailSwapTrack) {
        btnDetailSwapTrack.onclick = () => {
            const targetVisualTrack = typeof evt.visualTrackIndex === 'number' ? evt.visualTrackIndex : 0;
            closeEventDetail();
            openReorderModal(targetVisualTrack);
        };
    }

    // 5. Cập nhật thời gian còn lại (ticking mỗi 1 giây)
    updateDetailCountdown(evt);
    if (S.detailCountdownTimer) clearInterval(S.detailCountdownTimer);
    S.detailCountdownTimer = setInterval(() => {
        if (S.currentDetailEvent) updateDetailCountdown(S.currentDetailEvent);
    }, 1000);

    modalEventDetail.classList.add('is-active');
    modalEventDetail.setAttribute('aria-hidden', 'false');
}

export function closeEventDetail() {
    if (!modalEventDetail) return;
    modalEventDetail.classList.remove('is-active');
    modalEventDetail.setAttribute('aria-hidden', 'true');
    if (S.detailCountdownTimer) {
        clearInterval(S.detailCountdownTimer);
        S.detailCountdownTimer = null;
    }
    S.currentDetailEvent = null;
}

export function openDeleteRepeatModal(evt, meta = {}) {
    S.pendingRepeatEventToDelete = evt;
    S.pendingRepeatDeleteMeta = meta;
    if (!modalDeleteRepeat) return;

    const isCal = meta.type === 'calendar';
    const title = evt.title || (isCal ? 'sự kiện này' : 'hoạt động này');
    const typeLabel = isCal ? 'Sự kiện' : 'Hoạt động';

    if (deleteRepeatSubtitle) {
        deleteRepeatSubtitle.textContent = `${typeLabel} "${title}" thuộc một chuỗi lặp lại. Bạn muốn xóa như thế nào?`;
    }

    const descAll = document.getElementById('delete-all-repeat-desc');
    if (descAll) {
        descAll.textContent = isCal
            ? 'Xóa sạch toàn bộ chuỗi sự kiện này (cả quá khứ và tương lai) khỏi lịch.'
            : 'Xóa sạch toàn bộ chuỗi sự kiện này (cả quá khứ và tương lai) khỏi timeline.';
    }

    modalDeleteRepeat.classList.add('is-active');
    modalDeleteRepeat.setAttribute('aria-hidden', 'false');
}

export function closeDeleteRepeatModal() {
    if (!modalDeleteRepeat) return;
    modalDeleteRepeat.classList.remove('is-active');
    modalDeleteRepeat.setAttribute('aria-hidden', 'true');
    S.pendingRepeatEventToDelete = null;
    S.pendingRepeatDeleteMeta = null;
}

if (btnCloseDeleteRepeat) btnCloseDeleteRepeat.addEventListener('click', closeDeleteRepeatModal);

if (btnCancelDeleteRepeat) btnCancelDeleteRepeat.addEventListener('click', closeDeleteRepeatModal);

if (modalDeleteRepeat) {
    modalDeleteRepeat.addEventListener('click', (e) => {
        if (e.target === modalDeleteRepeat) closeDeleteRepeatModal();
    });
}

// 1. Chỉ xóa sự kiện này
if (btnDeleteThisOnly) {
    btnDeleteThisOnly.addEventListener('click', () => {
        if (!S.pendingRepeatEventToDelete) return;
        const evt = S.pendingRepeatEventToDelete;
        const meta = S.pendingRepeatDeleteMeta || {};

        if (meta.type === 'calendar') {
            const dateStr = meta.dateStr;
            closeDeleteRepeatModal();
            excludeCalEventDate(evt.id, dateStr);
        } else {
            const idToDelete = evt.id;
            closeDeleteRepeatModal();
            deleteEvent(idToDelete);
        }
    });
}

// 2. Dừng lặp lại từ kỳ này trở đi
if (btnDeleteFromHere) {
    btnDeleteFromHere.addEventListener('click', () => {
        if (!S.pendingRepeatEventToDelete) return;
        const evt = S.pendingRepeatEventToDelete;
        const meta = S.pendingRepeatDeleteMeta || {};

        if (meta.type === 'calendar') {
            const dateStr = meta.dateStr;
            closeDeleteRepeatModal();
            stopCalEventRepeatFrom(evt.id, dateStr);
        } else {
            const repId = evt.repeatId;
            const curStartMs = new Date(evt.start).getTime();

            let events = loadEvents();
            const idsToDelete = [];
            // Xóa sự kiện này và tất cả các sự kiện tương lai trong chuỗi lặp
            events = events.filter(e => {
                if (e.repeatId === repId && new Date(e.start).getTime() >= curStartMs) {
                    idsToDelete.push(e.id);
                    return false;
                }
                return true;
            });
            recordDeletedTimelineIds(idsToDelete);

            // Tắt chế độ vĩnh viễn và dừng chuỗi lặp lại cho các sự kiện còn lại trong quá khứ
            events.forEach(e => {
                if (e.repeatId === repId) {
                    e.isForever = false;
                    e.repeatLimitEnd = e.end;
                }
            });

            saveEvents(events);
            closeDeleteRepeatModal();
            renderEvents();
            updateTitleSuggestions();
            updateTagSuggestions();

            const user = getCurrentUser();
            if (user && user.email) {
                pushLocalDataToCloud(user.email);
            }
        }
    });
}

// 3. Xóa tất cả các lần lặp
if (btnDeleteAllRepeat) {
    btnDeleteAllRepeat.addEventListener('click', () => {
        if (!S.pendingRepeatEventToDelete) return;
        const evt = S.pendingRepeatEventToDelete;
        const meta = S.pendingRepeatDeleteMeta || {};

        if (meta.type === 'calendar') {
            closeDeleteRepeatModal();
            deleteCalEvent(evt.id);
        } else {
            const repId = evt.repeatId;
            const allInGroup = loadEvents().filter(e => e.repeatId === repId);
            recordDeletedTimelineIds(allInGroup.map(e => e.id));
            let events = loadEvents().filter(e => e.repeatId !== repId);
            saveEvents(events);
            closeDeleteRepeatModal();
            renderEvents();
            updateTitleSuggestions();
            updateTagSuggestions();

            const user = getCurrentUser();
            if (user && user.email) {
                pushLocalDataToCloud(user.email);
            }
        }
    });
}

let pendingSingleDeleteCallback = null;

export function openSingleDeleteConfirmModal({
    title = 'Xóa sự kiện',
    subtitle = 'Bạn có chắc chắn muốn xóa sự kiện này?',
    eventName = 'Sự kiện này',
    eventMeta = 'Hành động này sẽ xóa sự kiện khỏi lịch và không thể hoàn tác.',
    confirmText = 'Xóa sự kiện',
    onConfirm = null
} = {}) {
    pendingSingleDeleteCallback = onConfirm;
    if (!modalConfirmDelete) return;

    if (confirmDeleteTitle) confirmDeleteTitle.textContent = title;
    if (confirmDeleteSubtitle) confirmDeleteSubtitle.textContent = subtitle;
    if (confirmDeleteEventName) confirmDeleteEventName.textContent = eventName;
    if (confirmDeleteEventMeta) confirmDeleteEventMeta.textContent = eventMeta;
    if (btnSubmitConfirmDelete) btnSubmitConfirmDelete.textContent = confirmText;

    modalConfirmDelete.classList.add('is-active');
    modalConfirmDelete.setAttribute('aria-hidden', 'false');
}

export function closeSingleDeleteConfirmModal() {
    if (!modalConfirmDelete) return;
    modalConfirmDelete.classList.remove('is-active');
    modalConfirmDelete.setAttribute('aria-hidden', 'true');
    pendingSingleDeleteCallback = null;
}

if (btnCloseConfirmDelete) btnCloseConfirmDelete.addEventListener('click', closeSingleDeleteConfirmModal);

if (btnCancelConfirmDelete) btnCancelConfirmDelete.addEventListener('click', closeSingleDeleteConfirmModal);

if (modalConfirmDelete) {
    modalConfirmDelete.addEventListener('click', (e) => {
        if (e.target === modalConfirmDelete) closeSingleDeleteConfirmModal();
    });
}

if (btnSubmitConfirmDelete) {
    btnSubmitConfirmDelete.addEventListener('click', () => {
        const cb = pendingSingleDeleteCallback;
        closeSingleDeleteConfirmModal();
        if (typeof cb === 'function') {
            cb();
        }
    });
}

if (btnCloseEventDetail) btnCloseEventDetail.addEventListener('click', closeEventDetail);

if (btnDeleteDetailEvent) {
    btnDeleteDetailEvent.addEventListener('click', () => {
        if (!S.currentDetailEvent) return;
        const evt = S.currentDetailEvent;
        const title = evt.title || 'hoạt động này';
        const isRepeating = !!(evt.repeatId || (evt.repeatType && evt.repeatType !== 'none'));

        if (isRepeating && evt.repeatId) {
            // Sự kiện lặp lại: Đóng modal chi tiết và mở modal lựa chọn xóa / dừng lặp lại
            closeEventDetail();
            openDeleteRepeatModal(evt);
        } else {
            // Sự kiện đơn lẻ thông thường: mở hộp thoại xác nhận đẹp mắt
            openSingleDeleteConfirmModal({
                title: 'Xóa hoạt động',
                subtitle: 'Bạn có chắc chắn muốn xóa hoạt động này khỏi timeline?',
                eventName: title,
                eventMeta: 'Hoạt động sẽ bị xóa vĩnh viễn khỏi timeline và không thể hoàn tác.',
                confirmText: 'Xóa hoạt động',
                onConfirm: () => {
                    const idToDelete = evt.id;
                    closeEventDetail();
                    deleteEvent(idToDelete);
                }
            });
        }
    });
}

if (modalEventDetail) {
    modalEventDetail.addEventListener('click', (e) => {
        if (e.target === modalEventDetail) closeEventDetail();
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (modalConfirmDelete && modalConfirmDelete.classList.contains('is-active')) {
            closeSingleDeleteConfirmModal();
        } else if (modalDeleteRepeat && modalDeleteRepeat.classList.contains('is-active')) {
            closeDeleteRepeatModal();
        } else if (modalReorderTracks && modalReorderTracks.classList.contains('is-active')) {
            closeReorderModal();
        } else if (modalCropImage && modalCropImage.classList.contains('is-active')) {
            closeCropper();
        } else if (modalEventDetail && modalEventDetail.classList.contains('is-active')) {
            closeEventDetail();
        } else if (modalAddEvent && modalAddEvent.classList.contains('is-active')) {
            closeModal();
        }
    }
});
