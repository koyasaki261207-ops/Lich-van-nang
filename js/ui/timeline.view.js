// Render timeline ngang: trục ngày, sự kiện, vạch thời gian hiện tại.

import { S } from '../state/store.js';
import { getEventTheme } from '../core/color.js';
import { allocateTracks } from '../core/event-layout.js';
import { MS_PER_DAY, VISIBLE_DAYS, WEEKDAYS_VN } from '../core/constants.js';
import { formatDateTimeVn, formatDuration } from '../core/date-utils.js';
import { escapeHtml } from '../core/html.js';
import { getCurrentUser } from '../services/auth.service.js';
import { loadEvents, loadTrackOrder, recordDeletedTimelineIds, saveEvents, saveTrackOrder } from '../services/event.service.js';
import { pushLocalDataToCloud } from '../services/sync.service.js';
import { endDate, startDate, totalDays } from '../state/store.js';
import { updateHorizontalNowNeedle } from './day-timeline.view.js';
import { openEventDetail } from './event-detail.view.js';
import { updateTagSuggestions, updateTitleSuggestions } from './event-form.js';
import { updateFilterUI } from './tag-filter.view.js';

 // Hiển thị 44 ngày vừa vặn trên màn hình chuẩn như Hình 1 (Paimon.moe)

// Lấy độ rộng cột ngày được căn chỉnh chuẩn theo pixel vật lý (devicePixelRatio)
// Tự động tối ưu linh hoạt theo độ rộng màn hình (Responsive Mobile & Desktop)
export function getColWidth() {
    const viewportWidth = timelineViewport.clientWidth || window.innerWidth;
    const dpr = window.devicePixelRatio || 1;

    let targetDays = VISIBLE_DAYS;
    if (viewportWidth < 500) {
        // Điện thoại màn hình dọc: hiển thị 8 - 10 ngày (mỗi cột ~40-45px rộng rãi, chữ số rõ nét)
        targetDays = Math.max(7, Math.floor(viewportWidth / 42));
    } else if (viewportWidth < 800) {
        // Điện thoại xoay ngang / Tablet nhỏ: ~14 - 18 ngày
        targetDays = Math.max(12, Math.floor(viewportWidth / 40));
    } else if (viewportWidth < 1200) {
        // Tablet vừa / Laptop nhỏ: ~24 - 32 ngày
        targetDays = Math.max(20, Math.floor(viewportWidth / 38));
    }

    let physColWidth = Math.round((viewportWidth * dpr) / targetDays);
    if (physColWidth % 2 !== 0) physColWidth += 1; // số chẵn pixel vật lý để vị trí 50% luôn trúng tâm pixel nguyên
    return Math.max(34, physColWidth / dpr);
}

// Đồng bộ thuộc tính CSS --col-width
export function syncColWidthCss() {
    const width = getColWidth();
    document.documentElement.style.setProperty('--col-width', `${width}px`);
    return width;
}

export const headerAxis = document.getElementById('timeline-header-axis');

export const timelineGrid = document.getElementById('timeline-grid');

export const timelineTracks = document.getElementById('timeline-tracks');

export const timelineViewport = document.getElementById('timeline-viewport');

export const timeIndicator = document.getElementById('current-time-indicator');

export const timeBadge = document.getElementById('time-badge');

export const btnJumpNow = document.getElementById('btn-jump-now');

// 1. VẼ TRỤC THỜI GIAN & LƯỚI CỘT
export function renderTimelineScale() {
    headerAxis.innerHTML = '';
    timelineGrid.innerHTML = '';

    // 1.1 Khởi tạo mảng thông tin từng ngày
    const daysData = [];
    const tempDate = new Date(startDate);

    for (let i = 0; i < totalDays; i++) {
        daysData.push({
            index: i,
            dayOfWeek: tempDate.getDay(),
            dayNum: tempDate.getDate(),
            monthIndex: tempDate.getMonth(),
            // Hiện tên tháng ở cột đầu tiên (i === 0) hoặc ngày 1 hàng tháng
            showMonth: (i === 0 || tempDate.getDate() === 1)
        });
        tempDate.setDate(tempDate.getDate() + 1);
    }

    // 1.2 Vẽ các cột ra giao diện (Thứ luôn hiển thị ổn định, chữ tháng có nền nhỏ đè lên)
    daysData.forEach(item => {
        const axisCol = document.createElement('div');
        axisCol.className = 'axis-col';

        const monthHtml = item.showMonth
            ? `<div class="month-overlay-text">tháng ${item.monthIndex + 1}</div>`
            : '';

        axisCol.innerHTML = `
            <div class="col-label-top">
                <span class="weekday-text">${WEEKDAYS_VN[item.dayOfWeek]}</span>
                ${monthHtml}
            </div>
            <div class="day-number">${item.dayNum}</div>
        `;
        headerAxis.appendChild(axisCol);

        // Cột lưới dọc bên dưới
        const gridCol = document.createElement('div');
        gridCol.className = 'grid-col';
        timelineGrid.appendChild(gridCol);
    });

    S.timelineDaysData = daysData;
    updatePinnedMonth();
}

// 1.4 CẬP NHẬT NHÃN THÁNG GHIM Ở MÉP TRÁI KHI NGÀY MÙNG 1 BỊ CUỘN KHUẤT
export function updatePinnedMonth() {
    const scrollLeft = timelineViewport.scrollLeft;
    const colWidth = getColWidth();
    if (!colWidth || colWidth <= 0 || !S.timelineDaysData.length) return;

    // Cột ngày nằm ngay ở mép trái tầm nhìn của viewport
    const leftColIndex = Math.floor(scrollLeft / colWidth);
    if (leftColIndex < 0 || leftColIndex >= totalDays) return;

    const currentDayItem = S.timelineDaysData[leftColIndex];
    const currentMonth = currentDayItem.monthIndex; // 0..11
    const dayNum = currentDayItem.dayNum;

    // Vị trí cột mùng 1 của tháng này
    const monthDay1Index = leftColIndex - (dayNum - 1);

    // Kiểm tra xem ngày mùng 1 có bị khuất về bên trái hay không
    const isDay1Offscreen = (monthDay1Index < leftColIndex);

    const pinnedBadge = document.getElementById('pinned-month-badge');
    if (!pinnedBadge) return;

    if (isDay1Offscreen) {
        pinnedBadge.style.display = 'block';
        pinnedBadge.textContent = `tháng ${currentMonth + 1}`;

        // Ghim tại vị trí cách mép trái đang nhìn khoảng 1.2 cột (giống ảnh mẫu ở ngày 23-24)
        const pinnedX = scrollLeft + colWidth * 1.2;

        // Tìm ngày mùng 1 của tháng kế tiếp
        let nextMonthDay1Index = -1;
        for (let j = leftColIndex + 1; j < totalDays; j++) {
            if (S.timelineDaysData[j].dayNum === 1) {
                nextMonthDay1Index = j;
                break;
            }
        }

        // Khi ngày mùng 1 của tháng kế tiếp tiến sát đến pinnedBadge, làm mờ dần để không chồng chéo
        if (nextMonthDay1Index !== -1) {
            const nextMonthX = (nextMonthDay1Index + 0.5) * colWidth;
            const distance = nextMonthX - pinnedX;
            if (distance < colWidth * 2) {
                pinnedBadge.style.opacity = Math.max(0, (distance - colWidth * 0.5) / (colWidth * 1.5));
            } else {
                pinnedBadge.style.opacity = '1';
            }
        } else {
            pinnedBadge.style.opacity = '1';
        }

        pinnedBadge.style.transform = `translateX(${pinnedX}px)`;
    } else {
        pinnedBadge.style.display = 'none';
    }
}

// 2. VẠCH THỜI GIAN HIỆN TẠI (CURRENT TIME INDICATOR)
export function updateCurrentTime() {
    const current = new Date();
    const diffMs = current.getTime() - startDate.getTime();
    // Cộng 0.5 để vạch thời gian căn chuẩn theo vạch giữa của mỗi ngày
    const leftPx = (diffMs / MS_PER_DAY + 0.5) * getColWidth();

    timeIndicator.style.left = `${leftPx}px`;

    const hh = String(current.getHours()).padStart(2, '0');
    const mm = String(current.getMinutes()).padStart(2, '0');
    const ss = String(current.getSeconds()).padStart(2, '0');
    timeBadge.textContent = `${hh}:${mm}:${ss}`;

    updateTimelineCountdowns();
    updateHorizontalNowNeedle();
}

// Cuộn màn hình đưa ngày hôm nay vào chính giữa trục thời gian
export function scrollToToday(smooth = false) {
    const current = new Date();
    const diffMs = current.getTime() - startDate.getTime();
    const currentLeftPx = (diffMs / MS_PER_DAY + 0.5) * getColWidth();
    const viewportWidth = timelineViewport.clientWidth;
    const targetScroll = Math.max(0, currentLeftPx - (viewportWidth / 2));

    if (smooth) {
        timelineViewport.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
        });
    } else {
        timelineViewport.scrollLeft = targetScroll;
    }
}

// Gắn sự kiện click cho nút "Hiện tại"
if (btnJumpNow) {
    btnJumpNow.addEventListener('click', () => {
        scrollToToday(true);
    });
}

// 3. TƯƠNG TÁC: LĂN CHUỘT DỌC & CUỘN TIMELINE
timelineViewport.addEventListener('wheel', (e) => {
    if (e.shiftKey) {
        // Giữ Shift + lăn chuột để cuộn ngang
        e.preventDefault();
        timelineViewport.scrollLeft += e.deltaY * 1.1;
    } else if (e.deltaX !== 0) {
        // Trackpad hoặc chuột có con lăn ngang tự nhiên
    } else if (e.deltaY !== 0) {
        // Nếu viewport không có thanh cuộn dọc (màn hình rất lớn), chuyển con lăn thành cuộn ngang
        if (timelineViewport.scrollHeight <= timelineViewport.clientHeight) {
            e.preventDefault();
            timelineViewport.scrollLeft += e.deltaY * 1.1;
        }
        // Nếu có độ cao vượt màn hình (15 hàng sự kiện + footer), để trình duyệt cuộn dọc tự nhiên
    }
}, { passive: false });

timelineViewport.addEventListener('mousedown', (e) => {
    // Chỉ nhận chuột trái (button = 0)
    if (e.button !== 0) return;
    // Không kích hoạt kéo cuộn nếu click vào nút, form hoặc nút xóa sự kiện
    if (e.target.closest('.event-delete-btn') || e.target.closest('button') || e.target.closest('input')) return;
    S.isDown = true;
    timelineViewport.classList.add('is-dragging');
    S.startX = e.pageX - timelineViewport.offsetLeft;
    S.startY = e.pageY - timelineViewport.offsetTop;
    S.initialScrollLeft = timelineViewport.scrollLeft;
    S.initialScrollTop = timelineViewport.scrollTop;
});

window.addEventListener('mouseup', () => {
    if (!S.isDown) return;
    S.isDown = false;
    timelineViewport.classList.remove('is-dragging');
});

window.addEventListener('mousemove', (e) => {
    if (!S.isDown) return;
    e.preventDefault();
    const x = e.pageX - timelineViewport.offsetLeft;
    const y = e.pageY - timelineViewport.offsetTop;
    const walkX = (x - S.startX) * 1.25; // Hệ số tốc độ kéo ngang
    const walkY = (y - S.startY) * 1.25; // Hệ số tốc độ kéo dọc
    timelineViewport.scrollLeft = S.initialScrollLeft - walkX;
    timelineViewport.scrollTop = S.initialScrollTop - walkY;
});

// Cập nhật chữ đếm ngược trên các nhãn sự kiện theo thời gian thực mỗi giây
export function updateTimelineCountdowns() {
    if (!timelineTracks) return;
    const badges = timelineTracks.querySelectorAll('.event-countdown-badge');
    if (!badges.length) return;
    const nowMs = Date.now();
    let needsReRender = false;

    badges.forEach(badge => {
        const targetMs = Number(badge.dataset.targetMs);
        if (!targetMs) return;
        const diffMs = targetMs - nowMs;
        if (diffMs <= 0) {
            needsReRender = true;
            return;
        }
        const newText = formatDuration(diffMs);
        if (badge.textContent !== newText) {
            badge.textContent = newText;
        }
    });

    if (needsReRender) {
        renderEvents();
    }
}

// Vẽ toàn bộ các thanh sự kiện lên các hàng (Tracks)
export function renderEvents() {
    if (!timelineTracks) return;
    timelineTracks.innerHTML = '';

    const colWidth = getColWidth();
    if (!colWidth || colWidth <= 0) return;

    // Đảm bảo chiều rộng khu vực tracks bằng đúng toàn bộ các ngày
    timelineTracks.style.width = `${totalDays * colWidth}px`;

    const allEvents = loadEvents();
    updateFilterUI(allEvents);

    if (!allEvents.length) {
        S.currentTotalTracks = 0;
        S.currentLogicalTracks = [];
        S.currentTrackOrder = [];
        return;
    }

    // Áp dụng bộ lọc Tag: chỉ giữ lại sự kiện có cùng Tag, ẩn các sự kiện khác
    let events = allEvents;
    if (S.activeTagFilter) {
        const cleanFilter = S.activeTagFilter.trim().toLowerCase();
        events = allEvents.filter(e => (e.tag || '').trim().toLowerCase() === cleanFilter);
    }

    if (!events.length) {
        timelineTracks.innerHTML = `
            <div class="filter-empty-timeline-notice" style="position: absolute; left: 50%; top: 40px; transform: translateX(-50%); text-align: center; color: #cbd5e1; font-size: 13px; font-weight: 500; background: rgba(22, 28, 48, 0.9); padding: 14px 28px; border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.35); box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5); z-index: 20;">
                Không tìm thấy sự kiện nào khớp với tag <strong style="color: #facc15;">#${escapeHtml(S.activeTagFilter)}</strong>
            </div>
        `;
        return;
    }

    // Xếp sự kiện vào các hàng (xem core/event-layout.js)
    const { assignedEvents, totalTracksCount } = allocateTracks(events);
    S.currentTotalTracks = totalTracksCount;

    // Lưu danh sách sự kiện trên từng hàng logic (0 -> totalTracksCount - 1)
    S.currentLogicalTracks = [];
    for (let i = 0; i < totalTracksCount; i++) {
        S.currentLogicalTracks.push({
            logicalIndex: i,
            events: assignedEvents.filter(e => e.allocatedTrackIndex === i).sort((a, b) => a.startMs - b.startMs)
        });
    }

    // Tải mảng thứ tự hiển thị (trackOrder[visualRow] = logicalTrackIndex)
    S.currentTrackOrder = loadTrackOrder(totalTracksCount);

    // Nếu vừa tạo sự kiện mới, tự động đưa hàng chứa sự kiện đó lên vị trí đầu tiên (Hàng #1) để người dùng thấy ngay
    if (S.trackToHoistOnRender) {
        const newlyCreated = assignedEvents.find(e => e.id === S.trackToHoistOnRender || e.repeatId === S.trackToHoistOnRender);
        if (newlyCreated && typeof newlyCreated.allocatedTrackIndex === 'number') {
            const targetIdx = newlyCreated.allocatedTrackIndex;
            S.currentTrackOrder = [targetIdx, ...S.currentTrackOrder.filter(idx => idx !== targetIdx)];
            saveTrackOrder(S.currentTrackOrder);
        }
        S.trackToHoistOnRender = null;
    }

    let visualCounter = 0;
    for (let t = 0; t < totalTracksCount; t++) {
        const logicalIdx = S.currentTrackOrder[t];
        const rowEvents = assignedEvents
            .filter(e => e.allocatedTrackIndex === logicalIdx)
            .sort((a, b) => a.startMs - b.startMs);

        // Bỏ qua nếu không có sự kiện và dồn các hàng ở dưới lên
        if (!rowEvents || rowEvents.length === 0) continue;

        const row = document.createElement('div');
        row.className = 'timeline-track-row';
        timelineTracks.appendChild(row);

        const visualIdx = visualCounter++;
        const maxTimelineWidth = totalDays * colWidth;

        rowEvents.forEach((evt, idx) => {
            evt.visualTrackIndex = visualIdx;

            // Bỏ qua nếu sự kiện nằm hoàn toàn ngoài trục hiển thị timeline
            if (evt.startMs >= endDate.getTime() || evt.endMs <= startDate.getTime()) return;

            const diffStartMs = evt.startMs - startDate.getTime();
            const diffDurationMs = evt.endMs - evt.startMs;

            let leftPx = (diffStartMs / MS_PER_DAY + 0.5) * colWidth;
            let widthPx = (diffDurationMs / MS_PER_DAY) * colWidth;

            let isClippedLeft = false;
            let isClippedRight = false;

            // Ngắt mép trái nếu sự kiện vượt ra ngoài rìa trái màn hình
            if (leftPx < 0) {
                widthPx += leftPx;
                leftPx = 0;
                isClippedLeft = true;
            }

            // Bỏ qua nếu sau khi ngắt mép trái thì sự kiện không còn chiều rộng hoặc đã nằm ngoài rìa phải
            if (leftPx >= maxTimelineWidth || widthPx <= 0) return;

            // Ngắt mép phải nếu sự kiện vượt ra ngoài rìa phải màn hình
            if (leftPx + widthPx > maxTimelineWidth) {
                widthPx = maxTimelineWidth - leftPx;
                isClippedRight = true;
            }

            // Đảm bảo bề rộng tối thiểu để hiển thị được thanh
            widthPx = Math.max(isClippedRight ? 8 : 42, widthPx);
            if (leftPx + widthPx > maxTimelineWidth) {
                widthPx = Math.max(8, maxTimelineWidth - leftPx);
            }

            const theme = getEventTheme(evt.color);

            // Kiểm tra sự kiện liền kề trước và sau
            const prevEvt = rowEvents[idx - 1];
            const nextEvt = rowEvents[idx + 1];

            const isContiguousWithPrev = prevEvt && (evt.startMs - prevEvt.endMs <= 3600000);
            const isContiguousWithNext = nextEvt && (nextEvt.startMs - evt.endMs <= 3600000);

            const bar = document.createElement('div');
            bar.className = 'event-bar';
            bar.dataset.eventId = evt.id;
            if (evt.repeatId) {
                bar.dataset.repeatId = evt.repeatId;
            }
            bar.style.left = `${leftPx}px`;
            bar.style.width = `${widthPx}px`;
            bar.style.background = theme.bg;
            bar.style.setProperty('--bar-bg', theme.bg);

            // Phân loại thanh ngắn hay dài để hiển thị hình ảnh tối ưu:
            // - Thanh ngắn (< 120px, ví dụ sự kiện trong ngày): Chuyển thành Icon Thumbnail nhỏ (19x19px) gọn gàng
            // - Thanh dài (>= 120px): Hiển thị ảnh bìa nghệ thuật (art) ở đuôi phải mờ dần về trái
            const isCompact = widthPx < 120;
            if (isCompact) {
                bar.classList.add('is-compact');
            }

            const isRepeating = (evt.repeatType && evt.repeatType !== 'none') || !!evt.repeatId;
            const repeatTypeLabels = {
                daily: 'Mỗi ngày',
                weekly: 'Mỗi tuần',
                monthly: 'Mỗi tháng',
                yearly: 'Mỗi năm'
            };
            const repeatLabel = repeatTypeLabels[evt.repeatType] || 'Chu kỳ lặp';
            const repeatTitleText = isRepeating ? `\nLặp lại: ${repeatLabel}${evt.isForever ? ' (Vĩnh viễn)' : ''}` : '';
            bar.title = `${evt.title}${repeatTitleText}\nBắt đầu: ${formatDateTimeVn(evt.start)}\nKết thúc: ${formatDateTimeVn(evt.end)}`;

            // Bo góc: làm phẳng các cạnh tiếp giáp ở vị trí nối hoặc khi bị ngắt ở rìa trái/phải
            if (isContiguousWithPrev || isClippedLeft) {
                bar.style.borderTopLeftRadius = '0px';
                bar.style.borderBottomLeftRadius = '0px';
                if (isContiguousWithPrev) bar.classList.add('has-contiguous-prev');
            }
            if (isContiguousWithNext || isClippedRight) {
                bar.style.borderTopRightRadius = '0px';
                bar.style.borderBottomRightRadius = '0px';
                if (isContiguousWithNext) bar.classList.add('has-contiguous-next');
            }

            const artHtml = (!isCompact && evt.imageUrl)
                ? `<div class="event-bar-art" style="background-image: url('${escapeHtml(evt.imageUrl)}')"></div>`
                : '';

            const thumbHtml = (isCompact && evt.imageUrl && widthPx >= 30)
                ? `<img class="event-bar-thumb" src="${escapeHtml(evt.imageUrl)}" alt="" />`
                : '';

            bar.innerHTML = `
                ${artHtml}
                <div class="event-bar-content">
                    ${thumbHtml}
                    <span class="event-bar-title" style="color: ${theme.color}">${escapeHtml(evt.title)}</span>
                </div>
            `;

            // Nhấn vào thanh sự kiện để mở Modal Chi tiết sự kiện (tránh nhầm khi vuốt cuộn màn hình)
            let touchMoved = false;
            bar.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
            bar.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
            bar.addEventListener('click', () => {
                if (touchMoved) return;
                openEventDetail(evt);
            });

            row.appendChild(bar);

            // ==========================================
            // HIỂN THỊ THỜI GIAN CÒN LẠI (COUNTDOWN BADGE)
            // ==========================================
            const nowMs = new Date().getTime();
            const isStarted = nowMs >= evt.startMs;
            const isEnded = nowMs >= evt.endMs;

            // 1. Vạch trắng phân cách nếu có sự kiện tiếp giáp
            if (isContiguousWithNext && !isClippedRight) {
                const boundaryX = leftPx + widthPx;
                if (boundaryX <= maxTimelineWidth) {
                    const divider = document.createElement('div');
                    divider.className = 'event-track-divider';
                    divider.style.left = `${boundaryX}px`;
                    row.appendChild(divider);
                }
            }

            // 2. Quy tắc chuẩn Paimon.moe:
            // - Sự kiện đã qua (isEnded): TUYỆT ĐỐI KHÔNG HIỆN NHÃN
            // - Sự kiện đang diễn ra (isStarted && !isEnded): Hiện thời gian còn lại đến khi kết thúc ở đuôi bên phải
            //   (hoặc trên vạch nối nếu kết thúc ngay tại vạch nối)
            // - Sự kiện sắp diễn ra trong tương lai (!isStarted): Hiện thời gian đếm ngược đến lúc bắt đầu ở đầu bên trái
            if (!isEnded) {
                if (isStarted) {
                    const diffEnd = evt.endMs - nowMs;
                    const countdown = formatDuration(diffEnd);

                    if (countdown) {
                        if (isContiguousWithNext && !isClippedRight) {
                            // 1. Sự kiện tiếp giáp liền mạch (dính liền vạch chia)
                            if (leftPx + widthPx + 30 <= maxTimelineWidth) {
                                const junctionBadge = document.createElement('div');
                                junctionBadge.className = 'event-countdown-badge is-junction';
                                junctionBadge.dataset.targetMs = evt.endMs;
                                junctionBadge.style.left = `${leftPx + widthPx}px`;
                                junctionBadge.textContent = countdown;
                                row.appendChild(junctionBadge);
                            }
                        } else if (!isClippedRight) {
                            // 2. Kiểm tra khoảng cách đến sự kiện kế tiếp nếu có trên cùng hàng
                            const nextStartMs = nextEvt ? nextEvt.startMs : Infinity;
                            const gapMsToNext = nextEvt ? (nextStartMs - evt.endMs) : Infinity;
                            const nextLeftPx = nextEvt ? (((nextStartMs - startDate.getTime()) / MS_PER_DAY + 0.5) * colWidth) : Infinity;
                            const gapPxToNext = nextLeftPx - (leftPx + widthPx);

                            if (nextEvt && (gapMsToNext < 24 * 3600000 || gapPxToNext < 70) && gapPxToNext > 0) {
                                // Khoảng cách quá gần (< 24 giờ hoặc < 70px): Hiển thị 1 nhãn duy nhất căn giữa khoảng trống
                                const gapCenterPx = (leftPx + widthPx) + (gapPxToNext / 2);
                                if (gapCenterPx + 25 <= maxTimelineWidth) {
                                    const junctionBadge = document.createElement('div');
                                    junctionBadge.className = 'event-countdown-badge is-junction';
                                    junctionBadge.dataset.targetMs = evt.endMs;
                                    junctionBadge.style.left = `${gapCenterPx}px`;
                                    junctionBadge.textContent = countdown;
                                    row.appendChild(junctionBadge);
                                }
                            } else if (leftPx + widthPx + 45 <= maxTimelineWidth) {
                                // Khoảng trống đủ rộng hoặc là sự kiện cuối cùng trên hàng: hiện nhãn ở đuôi bên phải
                                const trailBadge = document.createElement('div');
                                trailBadge.className = 'event-countdown-badge is-trail';
                                trailBadge.dataset.targetMs = evt.endMs;
                                trailBadge.style.left = `${leftPx + widthPx + 5}px`;
                                trailBadge.textContent = countdown;
                                row.appendChild(trailBadge);
                            }
                        }
                    }
                } else {
                    // Sự kiện sắp tới trong tương lai: hiện nhãn đếm ngược đến khi BẮT ĐẦU ở đầu bên trái
                    // Quy tắc: Nếu sự kiện liền trước đang diễn ra và khoảng cách quá gần (< 24 giờ hoặc < 70px),
                    // thì nhãn kết thúc của sự kiện trước đã được hiển thị làm nhãn đại diện ở giữa.
                    // Ẩn nhãn bắt đầu của sự kiện này để không bị đè 2 nhãn lên nhau!
                    const prevIsActive = prevEvt && (nowMs < prevEvt.endMs);
                    const prevEndGapMs = prevEvt ? (evt.startMs - prevEvt.endMs) : Infinity;
                    const prevRightPx = prevEvt ? (((prevEvt.endMs - startDate.getTime()) / MS_PER_DAY + 0.5) * colWidth) : -Infinity;
                    const prevGapPx = leftPx - prevRightPx;

                    const isTooCloseToRunningPrev = prevIsActive && (prevEndGapMs < 24 * 3600000 || prevGapPx < 70 || isContiguousWithPrev);

                    if (!isTooCloseToRunningPrev && !isClippedLeft) {
                        const diffStart = evt.startMs - nowMs;
                        const countdown = formatDuration(diffStart);
                        if (countdown && leftPx >= 45 && leftPx <= maxTimelineWidth) {
                            const startBadge = document.createElement('div');
                            startBadge.className = 'event-countdown-badge is-start';
                            startBadge.dataset.targetMs = evt.startMs;
                            startBadge.style.left = `${leftPx - 5}px`;
                            startBadge.textContent = countdown;
                            row.appendChild(startBadge);
                        }
                    }
                }
            }
        });
    }
}

// Xóa một sự kiện theo ID
export function deleteEvent(id) {
    if (!id) return;
    const deletedSet = recordDeletedTimelineIds(id);
    const events = loadEvents().filter(e => e && e.id !== id && !deletedSet.has(e.id));
    saveEvents(events);
    renderEvents();
    updateTitleSuggestions();
    updateTagSuggestions();

    // Đẩy ngay lập tức lên đám mây, không cần chờ debounce 500ms
    const user = getCurrentUser();
    if (user && user.email) {
        pushLocalDataToCloud(user.email);
    }
}

// Tự động điều chỉnh khi thay đổi kích thước cửa sổ trình duyệt hoặc xoay màn hình điện thoại
export function handleScreenResize() {
    syncColWidthCss();
    updateCurrentTime();
    updatePinnedMonth();
    renderEvents();
}
