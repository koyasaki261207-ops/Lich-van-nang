// Thông báo nổi.

import { escapeHtml } from '../core/html.js';

// ========================================================
// THÔNG BÁO TOAST NỔI (Toast Notification Utility)
// ========================================================
export function showToastNotification(message, titleText = 'Thành công') {
    let toastContainer = document.getElementById('app-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'app-toast-container';
        toastContainer.className = 'app-toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.innerHTML = `
        <div class="app-toast-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <div class="app-toast-msg">
            <div class="app-toast-title">${escapeHtml(titleText)}</div>
            <div>${escapeHtml(message)}</div>
        </div>
    `;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });

    setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 350);
    }, 4000);
}
