// Modal sắp xếp và kéo thả hàng sự kiện.

import { S } from '../state/store.js';
import { getTrackOrderStorageKey, loadTrackOrder, saveTrackOrder } from '../services/event.service.js';
import { renderEvents } from './timeline.view.js';

// Các phần tử trong Modal Sắp Xếp & Hoán Đổi Hàng Sự Kiện
export const btnReorderTracks = document.getElementById('btn-reorder-tracks');

export const modalReorderTracks = document.getElementById('modal-reorder-tracks');

export const btnCloseReorderModal = document.getElementById('btn-close-reorder-modal');

export const btnCloseReorderDone = document.getElementById('btn-close-reorder-done');

export const swapSelectX = document.getElementById('swap-select-x');

export const swapSelectY = document.getElementById('swap-select-y');

export const btnTriggerSwap = document.getElementById('btn-trigger-swap');

export const trackListContainer = document.getElementById('track-list-container');

export const btnResetTracks = document.getElementById('btn-reset-tracks');

// Hoán đổi vị trí của 2 hàng hiển thị (Swap track A và track B)
export function swapTracks(visualIdxA, visualIdxB) {
    if (visualIdxA === visualIdxB) return;
    const total = S.currentTotalTracks;
    if (visualIdxA < 0 || visualIdxB < 0 || visualIdxA >= total || visualIdxB >= total) return;
    const order = loadTrackOrder(total);
    const temp = order[visualIdxA];
    order[visualIdxA] = order[visualIdxB];
    order[visualIdxB] = temp;
    saveTrackOrder(order);
    renderEvents();
    renderTrackManager(visualIdxB);
}

// Di chuyển hàng từ vị trí fromIndex sang vị trí toIndex (Move / Drag & Drop)
export function moveTrack(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const total = S.currentTotalTracks;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= total || toIndex >= total) return;
    const order = loadTrackOrder(total);
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    saveTrackOrder(order);
    renderEvents();
    renderTrackManager(toIndex);
}

// Khôi phục thứ tự hàng mặc định theo thuật toán sắp xếp thông minh
export function resetTrackOrder() {
    localStorage.removeItem(getTrackOrderStorageKey());
    renderEvents();
    renderTrackManager(0);
}

// Mở và hiển thị Modal Sắp Xếp Hàng
export function openReorderModal(preselectedVisualTrack = 0) {
    renderTrackManager(preselectedVisualTrack);
    if (!modalReorderTracks) return;
    modalReorderTracks.classList.add('is-active');
    modalReorderTracks.setAttribute('aria-hidden', 'false');
}

export function closeReorderModal() {
    if (typeof S.isDraggingTrack !== 'undefined' && S.isDraggingTrack) onTrackMouseUp();
    if (!modalReorderTracks) return;
    modalReorderTracks.classList.remove('is-active');
    modalReorderTracks.setAttribute('aria-hidden', 'true');
}

export function updateDragTarget(x, y) {
    if (!trackListContainer || !S.isDraggingTrack) return;
    const cards = Array.from(trackListContainer.querySelectorAll('.track-item-card:not(.is-floating-drag)'));
    if (!cards.length) return;

    let foundIdx = null;
    for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) {
            foundIdx = parseInt(card.dataset.visualIdx, 10);
            break;
        }
    }

    const containerRect = trackListContainer.getBoundingClientRect();
    if (foundIdx === null) {
        if (y < containerRect.top) {
            foundIdx = parseInt(cards[0].dataset.visualIdx, 10);
        } else if (y > containerRect.bottom) {
            foundIdx = parseInt(cards[cards.length - 1].dataset.visualIdx, 10);
        }
    }

    if (foundIdx !== null && !isNaN(foundIdx)) {
        S.currentTargetVisualIdx = foundIdx;
    }

    cards.forEach(card => {
        const vIdx = parseInt(card.dataset.visualIdx, 10);
        if (vIdx === S.currentTargetVisualIdx && vIdx !== S.dragFromVisualIdx) {
            card.classList.add('drag-over');
        } else {
            card.classList.remove('drag-over');
        }
    });
}

export function checkTrackAutoScroll(y) {
    if (!trackListContainer) return;
    const rect = trackListContainer.getBoundingClientRect();
    const threshold = 45;
    const maxSpeed = 12;

    if (y < rect.top + threshold && y > rect.top - 30) {
        const ratio = Math.max(0.2, (rect.top + threshold - y) / threshold);
        S.trackAutoScrollSpeed = -maxSpeed * ratio;
        startTrackAutoScroll();
    } else if (y > rect.bottom - threshold && y < rect.bottom + 30) {
        const ratio = Math.max(0.2, (y - (rect.bottom - threshold)) / threshold);
        S.trackAutoScrollSpeed = maxSpeed * ratio;
        startTrackAutoScroll();
    } else {
        stopTrackAutoScroll();
    }
}

export function startTrackAutoScroll() {
    if (S.trackAutoScrollRaf) return;
    function step() {
        if (!S.isDraggingTrack || S.trackAutoScrollSpeed === 0 || !trackListContainer) {
            S.trackAutoScrollRaf = null;
            return;
        }
        trackListContainer.scrollTop += S.trackAutoScrollSpeed;
        updateDragTarget(S.lastDragPointerX, S.lastDragPointerY);
        S.trackAutoScrollRaf = requestAnimationFrame(step);
    }
    S.trackAutoScrollRaf = requestAnimationFrame(step);
}

export function stopTrackAutoScroll() {
    if (S.trackAutoScrollRaf) {
        cancelAnimationFrame(S.trackAutoScrollRaf);
        S.trackAutoScrollRaf = null;
    }
    S.trackAutoScrollSpeed = 0;
}

export function onTrackDragWheel(e) {
    if (!S.isDraggingTrack || !trackListContainer) return;
    // Cho phép vừa giữ chuột kéo hàng vừa lăn chuột cuộn mượt mà
    e.preventDefault();
    trackListContainer.scrollTop += e.deltaY;
    updateDragTarget(S.lastDragPointerX, S.lastDragPointerY);
}

export function onTrackMouseMove(e) {
    if (!S.isDraggingTrack) return;
    S.lastDragPointerX = e.clientX;
    S.lastDragPointerY = e.clientY;

    if (S.floatingDragCard) {
        S.floatingDragCard.style.left = `${e.clientX - S.dragOffsetX}px`;
        S.floatingDragCard.style.top = `${e.clientY - S.dragOffsetY}px`;
    }

    checkTrackAutoScroll(e.clientY);
    updateDragTarget(e.clientX, e.clientY);
}

export function onTrackMouseUp() {
    if (!S.isDraggingTrack) return;
    S.isDraggingTrack = false;

    stopTrackAutoScroll();

    window.removeEventListener('mousemove', onTrackMouseMove);
    window.removeEventListener('mouseup', onTrackMouseUp);
    window.removeEventListener('wheel', onTrackDragWheel);

    document.body.classList.remove('is-reordering-tracks');

    if (S.floatingDragCard && S.floatingDragCard.parentNode) {
        S.floatingDragCard.parentNode.removeChild(S.floatingDragCard);
    }
    S.floatingDragCard = null;

    if (S.dragOriginCard) {
        S.dragOriginCard.classList.remove('is-drag-origin');
        S.dragOriginCard = null;
    }

    document.querySelectorAll('.track-item-card').forEach(c => c.classList.remove('drag-over'));

    const fromIdx = S.dragFromVisualIdx;
    const toIdx = S.currentTargetVisualIdx;
    S.dragFromVisualIdx = null;
    S.currentTargetVisualIdx = null;

    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
        moveTrack(fromIdx, toIdx);
    }
}

export function startTrackCardDrag(e, card, visualIdx) {
    if (e.button !== 0) return;
    if (e.target.closest('.btn-track-move') || e.target.closest('button')) return;

    if (e.preventDefault) e.preventDefault();

    S.isDraggingTrack = true;
    S.dragFromVisualIdx = visualIdx;
    S.currentTargetVisualIdx = visualIdx;
    S.dragOriginCard = card;

    const rect = card.getBoundingClientRect();
    S.dragOffsetX = e.clientX - rect.left;
    S.dragOffsetY = e.clientY - rect.top;
    S.lastDragPointerX = e.clientX;
    S.lastDragPointerY = e.clientY;

    card.classList.add('is-drag-origin');
    document.body.classList.add('is-reordering-tracks');

    // Tạo thẻ lơ lửng clone theo chuột
    S.floatingDragCard = card.cloneNode(true);
    S.floatingDragCard.classList.remove('is-drag-origin');
    S.floatingDragCard.classList.add('is-floating-drag');
    S.floatingDragCard.style.width = `${rect.width}px`;
    S.floatingDragCard.style.height = `${rect.height}px`;
    S.floatingDragCard.style.left = `${rect.left}px`;
    S.floatingDragCard.style.top = `${rect.top}px`;
    document.body.appendChild(S.floatingDragCard);

    window.addEventListener('mousemove', onTrackMouseMove);
    window.addEventListener('mouseup', onTrackMouseUp);
    window.addEventListener('wheel', onTrackDragWheel, { passive: false });
}

window.addEventListener('touchmove', (e) => {
    if (!S.isDraggingTrack) return;
    const touch = e.touches[0];
    if (touch) {
        onTrackMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
}, { passive: false });

window.addEventListener('touchend', onTrackMouseUp);

// Render giao diện quản lý sắp xếp trong modal
export function renderTrackManager(selectedVisualIndex = 0) {
    if (!modalReorderTracks) return;
    const total = S.currentTotalTracks;
    const order = S.currentTrackOrder.length === total ? S.currentTrackOrder : loadTrackOrder(total);

    // 1. Cập nhật 2 dropdown hoán đổi nhanh X và Y
    if (swapSelectX && swapSelectY) {
        swapSelectX.innerHTML = '';
        swapSelectY.innerHTML = '';

        for (let v = 0; v < total; v++) {
            const lIdx = order[v];
            const trackData = S.currentLogicalTracks[lIdx];
            const evts = (trackData && trackData.events) || [];
            let label = `Hàng #${v + 1}`;
            if (evts.length > 0) {
                const firstTitle = evts[0].title;
                const countExtra = evts.length > 1 ? ` (+${evts.length - 1})` : '';
                const shortTitle = firstTitle.length > 25 ? firstTitle.substring(0, 25) + '...' : firstTitle;
                label += `: ${shortTitle}${countExtra}`;
            } else {
                label += ` (Trống)`;
            }

            const optX = document.createElement('option');
            optX.value = v;
            optX.textContent = label;
            swapSelectX.appendChild(optX);

            const optY = document.createElement('option');
            optY.value = v;
            optY.textContent = label;
            swapSelectY.appendChild(optY);
        }

        const safeSelX = Math.max(0, Math.min(total - 1, selectedVisualIndex));
        const safeSelY = safeSelX === 0 ? Math.min(1, total - 1) : 0;
        swapSelectX.value = safeSelX;
        swapSelectY.value = safeSelY;
    }

    // 2. Cập nhật danh sách các thẻ hàng (Cards)
    if (trackListContainer) {
        const savedScrollTop = trackListContainer.scrollTop;
        trackListContainer.innerHTML = '';

        for (let v = 0; v < total; v++) {
            const visualIdx = v;
            const lIdx = order[v];
            const trackData = S.currentLogicalTracks[lIdx];
            const evts = (trackData && trackData.events) || [];

            const card = document.createElement('div');
            card.className = 'track-item-card';
            card.dataset.visualIdx = visualIdx;

            // Handle icon kéo thả
            const handle = document.createElement('div');
            handle.className = 'track-drag-handle';
            handle.title = 'Giữ chuột để di chuyển hàng (có thể vừa giữ vừa lăn chuột để cuộn)';
            handle.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="5" r="1.5"></circle>
                    <circle cx="9" cy="12" r="1.5"></circle>
                    <circle cx="9" cy="19" r="1.5"></circle>
                    <circle cx="15" cy="5" r="1.5"></circle>
                    <circle cx="15" cy="12" r="1.5"></circle>
                    <circle cx="15" cy="19" r="1.5"></circle>
                </svg>
            `;

            // Badge số hàng
            const badge = document.createElement('div');
            badge.className = 'track-number-badge';
            badge.textContent = `Hàng #${visualIdx + 1}`;

            // Container xem trước sự kiện
            const preview = document.createElement('div');
            preview.className = 'track-events-preview';

            if (evts.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'track-empty-text';
                empty.textContent = '(Hàng trống)';
                preview.appendChild(empty);
            } else {
                evts.forEach(evt => {
                    const pill = document.createElement('div');
                    pill.className = 'mini-event-pill';
                    pill.style.borderLeftColor = evt.color || '#38bdf8';
                    pill.title = evt.title;
                    pill.textContent = evt.title;
                    preview.appendChild(pill);
                });
            }

            // Nút mũi tên lên / xuống
            const actions = document.createElement('div');
            actions.className = 'track-item-actions';

            const btnUp = document.createElement('button');
            btnUp.type = 'button';
            btnUp.className = 'btn-track-move';
            btnUp.title = 'Di chuyển lên';
    btnUp.setAttribute('aria-label', btnUp.title);
            btnUp.disabled = (visualIdx === 0);
            btnUp.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            `;
            btnUp.addEventListener('click', (e) => {
                e.stopPropagation();
                moveTrack(visualIdx, visualIdx - 1);
            });

            const btnDown = document.createElement('button');
            btnDown.type = 'button';
            btnDown.className = 'btn-track-move';
            btnDown.title = 'Di chuyển xuống';
    btnDown.setAttribute('aria-label', btnDown.title);
            btnDown.disabled = (visualIdx === total - 1);
            btnDown.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            btnDown.addEventListener('click', (e) => {
                e.stopPropagation();
                moveTrack(visualIdx, visualIdx + 1);
            });

            actions.appendChild(btnUp);
            actions.appendChild(btnDown);

            card.appendChild(handle);
            card.appendChild(badge);
            card.appendChild(preview);
            card.appendChild(actions);

            // Gắn sự kiện giữ chuột để kéo thả (kèm lăn chuột cuộn mượt mà)
            card.addEventListener('mousedown', (e) => {
                startTrackCardDrag(e, card, visualIdx);
            });

            // Hỗ trợ cảm ứng trên thiết bị di động
            card.addEventListener('touchstart', (e) => {
                if (e.target.closest('.btn-track-move') || e.target.closest('button')) return;
                const touch = e.touches[0];
                if (!touch) return;
                startTrackCardDrag({
                    button: 0,
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    target: e.target,
                    preventDefault: () => e.preventDefault()
                }, card, visualIdx);
            }, { passive: false });

            trackListContainer.appendChild(card);
        }

        // Khôi phục lại vị trí cuộn trước đó
        if (savedScrollTop > 0) {
            trackListContainer.scrollTop = savedScrollTop;
        }
    }
}

// Gắn sự kiện các nút điều khiển của Modal Sắp Xếp Hàng
if (btnReorderTracks) {
    btnReorderTracks.addEventListener('click', () => {
        openReorderModal(0);
    });
}

if (btnCloseReorderModal) {
    btnCloseReorderModal.addEventListener('click', closeReorderModal);
}

if (btnCloseReorderDone) {
    btnCloseReorderDone.addEventListener('click', closeReorderModal);
}

if (modalReorderTracks) {
    modalReorderTracks.addEventListener('click', (e) => {
        if (e.target === modalReorderTracks) closeReorderModal();
    });
}

if (btnTriggerSwap) {
    btnTriggerSwap.addEventListener('click', () => {
        if (!swapSelectX || !swapSelectY) return;
        const idxA = parseInt(swapSelectX.value, 10);
        const idxB = parseInt(swapSelectY.value, 10);
        if (isNaN(idxA) || isNaN(idxB)) return;
        if (idxA === idxB) {
            alert('Vui lòng chọn 2 hàng khác nhau để hoán đổi!');
            return;
        }
        swapTracks(idxA, idxB);
    });
}

if (btnResetTracks) {
    btnResetTracks.addEventListener('click', () => {
        if (confirm('Khôi phục thứ tự các hàng về trạng thái sắp xếp tự động tối ưu?')) {
            resetTrackOrder();
        }
    });
}
