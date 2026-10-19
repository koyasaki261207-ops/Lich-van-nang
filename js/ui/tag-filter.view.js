// Bộ lọc sự kiện theo tag.

import { S } from '../state/store.js';
import { escapeHtml } from '../core/html.js';
import { loadEvents } from '../services/event.service.js';
import { renderEvents } from './timeline.view.js';

// Các phần tử Bộ lọc Tag sự kiện (Tag Filter)
export const btnFilterTag = document.getElementById('btn-filter-tag');

export const btnFilterLabel = document.getElementById('btn-filter-label');

export const filterActiveDot = document.getElementById('filter-active-dot');

export const filterDropdownWrapper = document.getElementById('filter-dropdown-wrapper');

export const filterDropdownMenu = document.getElementById('filter-dropdown-menu');

export const filterTagList = document.getElementById('filter-tag-list');

export const btnFilterReset = document.getElementById('btn-filter-reset');

export const activeFilterBanner = document.getElementById('active-filter-banner');

export const activeFilterName = document.getElementById('active-filter-name');

export const activeFilterCount = document.getElementById('active-filter-count');

export const btnClearFilter = document.getElementById('btn-clear-filter');

// ========================================================
// QUẢN LÝ BỘ LỌC THEO TAG (Tag Filter Manager)
// ========================================================
export function toggleFilterDropdown() {
    if (!filterDropdownMenu) return;
    const isHidden = filterDropdownMenu.style.display === 'none';
    if (isHidden) {
        updateFilterDropdownList();
        filterDropdownMenu.style.display = 'block';
    } else {
        closeFilterDropdown();
    }
}

export function closeFilterDropdown() {
    if (filterDropdownMenu) {
        filterDropdownMenu.style.display = 'none';
    }
}

export function setTagFilter(tag) {
    if (!tag || (S.activeTagFilter && S.activeTagFilter.toLowerCase() === tag.trim().toLowerCase())) {
        S.activeTagFilter = null;
    } else {
        S.activeTagFilter = tag.trim();
    }
    closeFilterDropdown();
    renderEvents();
}

export function updateFilterUI(allEventsList) {
    const events = allEventsList || loadEvents();

    if (S.activeTagFilter) {
        const cleanFilter = S.activeTagFilter.trim().toLowerCase();
        const matchingCount = events.filter(e => (e.tag || '').trim().toLowerCase() === cleanFilter).length;

        if (btnFilterTag) {
            btnFilterTag.classList.add('is-active');
            btnFilterTag.title = `Đang lọc: #${S.activeTagFilter} (Nhấp để đổi hoặc bỏ lọc)`;
        }
        if (btnFilterLabel) {
            btnFilterLabel.textContent = `#${S.activeTagFilter}`;
        }
        if (filterActiveDot) {
            filterActiveDot.style.display = 'inline-block';
        }
        if (btnFilterReset) {
            btnFilterReset.style.display = 'inline-block';
        }
        if (activeFilterBanner) {
            activeFilterBanner.style.display = 'flex';
        }
        if (activeFilterName) {
            activeFilterName.textContent = `#${S.activeTagFilter}`;
        }
        if (activeFilterCount) {
            activeFilterCount.textContent = `(${matchingCount} sự kiện)`;
        }
    } else {
        if (btnFilterTag) {
            btnFilterTag.classList.remove('is-active');
            btnFilterTag.title = 'Lọc sự kiện theo Tag';
        }
        if (btnFilterLabel) {
            btnFilterLabel.textContent = 'Lọc';
        }
        if (filterActiveDot) {
            filterActiveDot.style.display = 'none';
        }
        if (btnFilterReset) {
            btnFilterReset.style.display = 'none';
        }
        if (activeFilterBanner) {
            activeFilterBanner.style.display = 'none';
        }
    }
}

export function updateFilterDropdownList() {
    if (!filterTagList) return;
    const allEvents = loadEvents();

    const tagMap = {};
    allEvents.forEach(evt => {
        const rawTag = (evt.tag || '').trim();
        if (rawTag) {
            const key = rawTag.toLowerCase();
            if (!tagMap[key]) {
                tagMap[key] = { original: rawTag, count: 0 };
            }
            tagMap[key].count++;
        }
    });

    const sortedKeys = Object.keys(tagMap).sort();

    let html = '';

    // Tùy chọn 1: Hiện tất cả sự kiện (Mặc định)
    const isAllSelected = !S.activeTagFilter;
    html += `
        <button type="button" class="filter-tag-item ${isAllSelected ? 'is-selected' : ''}" data-tag="">
            <div class="filter-tag-name-col">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                <span>Tất cả sự kiện</span>
            </div>
            <span class="filter-tag-count-badge">${allEvents.length}</span>
        </button>
    `;

    if (sortedKeys.length === 0) {
        html += `
            <div class="filter-tag-empty-msg">
                Chưa có sự kiện nào gắn tag.<br>
                Hãy nhập nhãn tag khi tạo sự kiện để lọc!
            </div>
        `;
    } else {
        sortedKeys.forEach(k => {
            const item = tagMap[k];
            const isSelected = S.activeTagFilter && S.activeTagFilter.toLowerCase() === k;
            html += `
                <button type="button" class="filter-tag-item ${isSelected ? 'is-selected' : ''}" data-tag="${escapeHtml(item.original)}">
                    <div class="filter-tag-name-col">
                        <span style="color: #c084fc; font-weight: 700;">#</span>
                        <span>${escapeHtml(item.original)}</span>
                    </div>
                    <span class="filter-tag-count-badge">${item.count}</span>
                </button>
            `;
        });
    }

    filterTagList.innerHTML = html;

    // Bắt sự kiện nhấp chọn tag
    filterTagList.querySelectorAll('.filter-tag-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            setTagFilter(tag || null);
        });
    });
}

if (btnFilterTag) {
    btnFilterTag.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFilterDropdown();
    });
}

if (btnFilterReset) {
    btnFilterReset.addEventListener('click', (e) => {
        e.stopPropagation();
        setTagFilter(null);
    });
}

if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
        setTagFilter(null);
    });
}

// Đóng dropdown khi nhấp ra ngoài màn hình
document.addEventListener('click', (e) => {
    if (filterDropdownWrapper && !filterDropdownWrapper.contains(e.target)) {
        closeFilterDropdown();
    }
});
