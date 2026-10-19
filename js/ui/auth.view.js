// Giao diện đăng nhập, hồ sơ và avatar.

import { S } from '../state/store.js';
import { getActiveFirebaseConfig, loadFirebaseSdk } from '../config/firebase.js';
import { escapeHtml } from '../core/html.js';
import { PRESET_AVATARS } from '../data/avatar-presets.js';
import { endSession, getCurrentUser, getSavedGoogleAccounts, removeSavedGoogleAccount, saveGoogleAccount, setCurrentUser, signInWithGooglePopup, startSession } from '../services/auth.service.js';
import { attachFirestoreSyncForUser, detachFirestoreSync, scheduleCloudPush } from '../services/sync.service.js';
import { calSelectYear, renderMonthlyCalendar } from './calendar.view.js';
import { renderEvents } from './timeline.view.js';
import { showToastNotification } from './toast.js';

export const loginGateOverlay = document.getElementById('login-gate-overlay');

export const loginPanelMain = document.getElementById('login-panel-main');

export const loginPanelGoogleChooser = document.getElementById('login-panel-google-chooser');

export const btnLoginGateGoogle = document.getElementById('btn-login-gate-google');

export const btnShowSavedAccounts = document.getElementById('btn-show-saved-accounts');

export const btnChooserGooglePopup = document.getElementById('btn-chooser-google-popup');

export const btnChooserBack = document.getElementById('btn-chooser-back');

export const googleAccountsList = document.getElementById('google-accounts-list');

export const btnToggleAddAccount = document.getElementById('btn-toggle-add-account');

export const formAddGoogleAccount = document.getElementById('form-add-google-account');

export const inputNewGoogleEmail = document.getElementById('input-new-google-email');

export const formQuickLogin = document.getElementById('form-quick-login');

export const inputQuickEmail = document.getElementById('input-quick-email');

export const topUserProfileBadge = document.getElementById('top-user-profile-badge');

export const userAvatarWrap = document.getElementById('user-avatar-wrap');

export const userAvatarCircle = document.getElementById('user-avatar-circle');

export const topUserName = document.getElementById('top-user-name');

export const topUserEmail = document.getElementById('top-user-email');

export const topUserInfo = document.getElementById('top-user-info');

export const btnQuickEditName = document.getElementById('btn-quick-edit-name');

export const btnTopLogout = document.getElementById('btn-top-logout');

// Các phần tử trong Modal Hồ Sơ & Đổi Tên / Ảnh Đại Diện
export const modalUserAvatar = document.getElementById('modal-user-avatar');

export const btnCloseAvatarModal = document.getElementById('btn-close-avatar-modal');

export const btnCancelAvatarModal = document.getElementById('btn-cancel-avatar-modal');

export const btnSaveAvatarModal = document.getElementById('btn-save-avatar-modal');

export const avatarPreviewLarge = document.getElementById('avatar-preview-large');

export const avatarPreviewInitial = document.getElementById('avatar-preview-initial');

export const avatarPreviewImg = document.getElementById('avatar-preview-img');

export const avatarPreviewName = document.getElementById('avatar-preview-name');

export const avatarPreviewEmail = document.getElementById('avatar-preview-email');

export const inputUserDisplayName = document.getElementById('input-user-display-name');

export const btnTriggerAvatarFile = document.getElementById('btn-trigger-avatar-file');

export const inputAvatarFile = document.getElementById('input-avatar-file');

export const inputAvatarUrl = document.getElementById('input-avatar-url');

export const btnApplyAvatarUrl = document.getElementById('btn-apply-avatar-url');

export const btnRemoveAvatar = document.getElementById('btn-remove-avatar');

export const avatarPresetsGrid = document.getElementById('avatar-presets-grid');

export function showGoogleChooserPanel() {
    if (loginPanelMain) loginPanelMain.classList.add('is-hidden');
    if (loginPanelGoogleChooser) loginPanelGoogleChooser.classList.remove('is-hidden');
    if (formAddGoogleAccount) formAddGoogleAccount.classList.add('is-hidden');
    renderGoogleAccountsList();
}

export function showMainLoginPanel() {
    if (loginPanelGoogleChooser) loginPanelGoogleChooser.classList.add('is-hidden');
    if (loginPanelMain) loginPanelMain.classList.remove('is-hidden');
}

export function renderGoogleAccountsList() {
    if (!googleAccountsList) return;
    googleAccountsList.innerHTML = '';
    const accounts = getSavedGoogleAccounts();

    if (!accounts.length) {
        const emptyHint = document.createElement('div');
        emptyHint.className = 'google-empty-hint';
        emptyHint.textContent = 'Chưa có tài khoản Google nào được lưu trên trình duyệt này. Hãy nhập Gmail của bạn ở mục bên dưới để ghi nhớ và đăng nhập nhanh cho các lần sau!';
        googleAccountsList.appendChild(emptyHint);
        if (formAddGoogleAccount) {
            formAddGoogleAccount.classList.remove('is-hidden');
            if (inputNewGoogleEmail) inputNewGoogleEmail.focus();
        }
        return;
    }

    accounts.forEach(acc => {
        const item = document.createElement('div');
        item.className = 'google-account-item';
        item.setAttribute('data-email', acc.email);

        const initial = (acc.name || acc.email || 'G').trim().charAt(0).toUpperCase();
        const hue = (initial.charCodeAt(0) * 47) % 360;

        const avatarHtml = acc.avatar
            ? `<img src="${escapeHtml(acc.avatar)}" alt="${escapeHtml(acc.name)}">`
            : initial;
        const avatarStyle = acc.avatar
            ? ''
            : `background: linear-gradient(135deg, hsl(${hue}, 75%, 55%), hsl(${(hue + 40) % 360}, 85%, 45%));`;

        item.innerHTML = `
            <div class="google-acc-avatar" style="${avatarStyle}">
                ${avatarHtml}
            </div>
            <div class="google-acc-info">
                <div class="google-acc-name">${escapeHtml(acc.name)}</div>
                <div class="google-acc-email">${escapeHtml(acc.email)}</div>
            </div>
            <div class="google-acc-badge">Đã lưu</div>
            <button type="button" class="google-acc-btn-remove" title="Xóa tài khoản này khỏi máy" data-email="${escapeHtml(acc.email)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        // Click vào tài khoản để đăng nhập nhanh ngay tức khắc!
        item.addEventListener('click', (e) => {
            if (e.target.closest('.google-acc-btn-remove')) return;
            performLogin(acc.email, acc.name, acc.avatar);
        });

        // Nút xóa tài khoản khỏi danh sách máy
        const btnRemove = item.querySelector('.google-acc-btn-remove');
        if (btnRemove) {
            btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Bạn có chắc muốn xóa gợi ý tài khoản "${acc.email}" khỏi thiết bị này?`)) {
                    removeSavedGoogleAccount(acc.email);
                    renderGoogleAccountsList();
                }
            });
        }

        googleAccountsList.appendChild(item);
    });
}

export function updateAuthUI() {
    const user = getCurrentUser();
    if (user) {
        if (loginGateOverlay) {
            loginGateOverlay.classList.add('is-hidden');
        }
        if (topUserProfileBadge) {
            topUserProfileBadge.style.display = 'flex';
        }
        if (topUserName) {
            topUserName.textContent = user.name || 'Người dùng';
        }
        if (topUserEmail) {
            topUserEmail.textContent = user.email || '';
        }
        if (userAvatarCircle) {
            if (user.avatar) {
                userAvatarCircle.innerHTML = `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}">`;
                userAvatarCircle.style.background = 'transparent';
            } else {
                const initial = (user.name || user.email || 'U').trim().charAt(0).toUpperCase();
                userAvatarCircle.textContent = initial;
                const hue = (initial.charCodeAt(0) * 47) % 360;
                userAvatarCircle.style.background = `linear-gradient(135deg, hsl(${hue}, 75%, 55%), hsl(${(hue + 40) % 360}, 85%, 45%))`;
            }
        }
    } else {
        if (loginGateOverlay) {
            loginGateOverlay.classList.remove('is-hidden');
        }
        if (topUserProfileBadge) {
            topUserProfileBadge.style.display = 'none';
        }
        const savedAccs = getSavedGoogleAccounts();
        if (btnShowSavedAccounts) {
            if (savedAccs && savedAccs.length > 0) {
                btnShowSavedAccounts.classList.remove('is-hidden');
            } else {
                btnShowSavedAccounts.classList.add('is-hidden');
            }
        }
    }
}

export function performLogin(email, customName, avatarUrl) {
    if (!email) return;
    const userObj = startSession(email, customName, avatarUrl);
    updateAuthUI();

    // Tự động kết nối đồng bộ đám mây Firebase nếu đã cấu hình
    attachFirestoreSyncForUser(userObj);

    // Tự động tải lại lịch cá nhân và timeline riêng của tài khoản này
    renderEvents();
    if (calSelectMonth && calSelectYear) {
        const m = parseInt(calSelectMonth.value, 10);
        const y = parseInt(calSelectYear.value, 10);
        renderMonthlyCalendar(m, y);
    }
}

export function performLogout() {
    detachFirestoreSync();
    endSession();
    updateAuthUI();
    showGoogleChooserPanel(); // Hiển thị sẵn danh sách các tài khoản Google đã lưu trên máy để chuyển đổi 1-click!

    renderEvents();
    if (calSelectMonth && calSelectYear) {
        const m = parseInt(calSelectMonth.value, 10);
        const y = parseInt(calSelectYear.value, 10);
        renderMonthlyCalendar(m, y);
    }
}

// ========================================================
// QUẢN LÝ AVATAR TÀI KHOẢN (Avatar Customizer Controller)
// ========================================================
export function updateModalAvatarPreview(dataUrl) {
    const user = getCurrentUser();
    if (dataUrl) {
        if (avatarPreviewImg) {
            avatarPreviewImg.src = dataUrl;
            avatarPreviewImg.style.display = 'block';
        }
        if (avatarPreviewInitial) avatarPreviewInitial.style.display = 'none';
        if (avatarPreviewLarge) avatarPreviewLarge.style.background = 'transparent';
    } else {
        if (avatarPreviewImg) {
            avatarPreviewImg.src = '';
            avatarPreviewImg.style.display = 'none';
        }
        if (avatarPreviewInitial) {
            avatarPreviewInitial.style.display = 'block';
            const initial = (user ? (user.name || user.email) : 'U').trim().charAt(0).toUpperCase();
            avatarPreviewInitial.textContent = initial;
        }
        if (avatarPreviewLarge) {
            const initial = (user ? (user.name || user.email) : 'U').trim().charAt(0).toUpperCase();
            const hue = (initial.charCodeAt(0) * 47) % 360;
            avatarPreviewLarge.style.background = `linear-gradient(135deg, hsl(${hue}, 75%, 55%), hsl(${(hue + 40) % 360}, 85%, 45%))`;
        }
    }
}

export function openAvatarModal(focusName = false) {
    const user = getCurrentUser();
    if (!user || !modalUserAvatar) return;

    S.pendingAvatarDataUrl = user.avatar || '';
    if (inputUserDisplayName) {
        inputUserDisplayName.value = user.name || user.email.split('@')[0];
    }
    if (avatarPreviewName) avatarPreviewName.textContent = user.name || 'Người dùng';
    if (avatarPreviewEmail) avatarPreviewEmail.textContent = user.email || '';
    if (inputAvatarUrl) inputAvatarUrl.value = '';

    updateModalAvatarPreview(S.pendingAvatarDataUrl);
    renderAvatarPresetsGrid();

    modalUserAvatar.classList.add('is-active');
    modalUserAvatar.setAttribute('aria-hidden', 'false');

    if (focusName && inputUserDisplayName) {
        setTimeout(() => {
            inputUserDisplayName.focus();
            inputUserDisplayName.select();
        }, 80);
    }
}

export function closeAvatarModal() {
    if (!modalUserAvatar) return;
    modalUserAvatar.classList.remove('is-active');
    modalUserAvatar.setAttribute('aria-hidden', 'true');
    S.pendingAvatarDataUrl = null;
}

export function renderAvatarPresetsGrid() {
    if (!avatarPresetsGrid) return;
    avatarPresetsGrid.innerHTML = '';
    PRESET_AVATARS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avatar-preset-btn';
        btn.title = p.name;
        const imgSrc = p.img ? p.img : ('data:image/svg+xml;utf8,' + encodeURIComponent(p.svg));
        btn.innerHTML = `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}">`;

        btn.addEventListener('click', () => {
            S.pendingAvatarDataUrl = imgSrc;
            updateModalAvatarPreview(imgSrc);
            avatarPresetsGrid.querySelectorAll('.avatar-preset-btn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
        });
        avatarPresetsGrid.appendChild(btn);
    });
}

export function processImageFileToAvatar(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Vui lòng chọn một tệp hình ảnh hợp lệ (JPG, PNG, WebP)!');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            S.pendingAvatarDataUrl = dataUrl;
            updateModalAvatarPreview(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Sự kiện mở Modal Hồ sơ khi nhấp vào Avatar hoặc Tên người dùng ở góc trên phải
if (userAvatarWrap) {
    userAvatarWrap.addEventListener('click', () => openAvatarModal(false));
}

if (btnQuickEditName) {
    btnQuickEditName.addEventListener('click', (e) => {
        e.stopPropagation();
        openAvatarModal(true);
    });
}

if (topUserInfo) {
    topUserInfo.addEventListener('click', (e) => {
        if (e.target.closest('#btn-top-logout')) return;
        openAvatarModal(true);
    });
}

if (inputUserDisplayName) {
    inputUserDisplayName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (btnSaveAvatarModal) btnSaveAvatarModal.click();
        }
    });
}

if (btnCloseAvatarModal) {
    btnCloseAvatarModal.addEventListener('click', closeAvatarModal);
}

if (btnCancelAvatarModal) {
    btnCancelAvatarModal.addEventListener('click', closeAvatarModal);
}

if (btnTriggerAvatarFile) {
    btnTriggerAvatarFile.addEventListener('click', () => {
        if (inputAvatarFile) inputAvatarFile.click();
    });
}

if (inputAvatarFile) {
    inputAvatarFile.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processImageFileToAvatar(e.target.files[0]);
            inputAvatarFile.value = '';
        }
    });
}

if (btnApplyAvatarUrl) {
    btnApplyAvatarUrl.addEventListener('click', () => {
        const url = inputAvatarUrl ? inputAvatarUrl.value.trim() : '';
        if (!url) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);
            try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                S.pendingAvatarDataUrl = dataUrl;
                updateModalAvatarPreview(dataUrl);
            } catch (err) {
                // Nếu lỗi CORS từ server ngoài, dùng trực tiếp link URL
                S.pendingAvatarDataUrl = url;
                updateModalAvatarPreview(url);
            }
        };
        img.onerror = () => {
            alert('Không thể tải hình ảnh từ liên kết này. Vui lòng kiểm tra lại URL hoặc tải ảnh trực tiếp từ máy!');
        };
        img.src = url;
    });
}

if (btnRemoveAvatar) {
    btnRemoveAvatar.addEventListener('click', () => {
        S.pendingAvatarDataUrl = '';
        updateModalAvatarPreview('');
    });
}

if (btnSaveAvatarModal) {
    btnSaveAvatarModal.addEventListener('click', () => {
        const user = getCurrentUser();
        if (!user) return;
        const inputName = inputUserDisplayName ? inputUserDisplayName.value.trim() : '';
        if (inputName) {
            user.name = inputName;
        }
        if (S.pendingAvatarDataUrl !== null) {
            user.avatar = S.pendingAvatarDataUrl;
        }
        setCurrentUser(user);
        saveGoogleAccount(user);
        updateAuthUI();
        renderGoogleAccountsList();
        closeAvatarModal();
        scheduleCloudPush();
        showToastNotification(`Đã lưu thông tin "${user.name}" và đồng bộ đám mây!`, '👤 Hồ sơ tài khoản');
    });
}

// ========================================================
// ĐĂNG NHẬP GOOGLE BẰNG FIREBASE AUTHENTICATION (POPUP)
// ========================================================
async function loginWithGoogle() {
    const cfg = getActiveFirebaseConfig();
    const sdk = await loadFirebaseSdk();
    if (!cfg || !cfg.apiKey || !sdk) {
        showToastNotification('Chưa tải được Firebase Authentication. Đang mở danh sách tài khoản...', '⚠️ Thông báo');
        showGoogleChooserPanel();
        return;
    }

    const setButtonsBusy = (isBusy) => {
        if (btnLoginGateGoogle) {
            btnLoginGateGoogle.disabled = isBusy;
            btnLoginGateGoogle.style.opacity = isBusy ? '0.6' : '1';
            btnLoginGateGoogle.style.pointerEvents = isBusy ? 'none' : 'auto';
        }
        if (btnChooserGooglePopup) {
            btnChooserGooglePopup.disabled = isBusy;
            btnChooserGooglePopup.style.opacity = isBusy ? '0.6' : '1';
            btnChooserGooglePopup.style.pointerEvents = isBusy ? 'none' : 'auto';
        }
    };

    try {
        setButtonsBusy(true);
        const user = await signInWithGooglePopup(cfg);
        if (user && user.email) {
            const email = user.email;
            const displayName = user.displayName || (email ? email.split('@')[0] : 'Người dùng');
            const photoURL = user.photoURL || '';

            performLogin(email, displayName, photoURL);
            showToastNotification(`Đăng nhập Google thành công! Xin chào "${displayName}"`, '🎉 Google Sign-in');
        }
    } catch (error) {
        console.error('Lỗi khi đăng nhập Google qua Firebase:', error);
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            return;
        }
        if (error.code === 'auth/unauthorized-domain') {
            const currentHost = window.location.hostname || 'localhost';
            alert(
                `⚠️ Tên miền "${currentHost}" chưa được thêm vào Authorized domains trong Firebase Console.\n\n` +
                `CÁCH CẤP PHÉP TRONG 30 GIÂY:\n` +
                `1. Mở Firebase Console > Chọn dự án "${cfg.projectId || 'lich-van-nang'}"\n` +
                `2. Vào mục "Authentication" > chọn thẻ "Settings"\n` +
                `3. Nhấp vào "Authorized domains" (Miền được ủy quyền)\n` +
                `4. Bấm "Add domain" và nhập: ${currentHost}\n` +
                `5. Bấm "Add" xong quay lại trang này bấm Đăng nhập lại là được ngay!`
            );
            return;
        }
        if (error.code === 'auth/operation-not-allowed') {
            alert(
                `⚠️ Đăng nhập Google chưa được kích hoạt trong Firebase Console.\n\n` +
                `Vào: Authentication > Sign-in method > Google > Bật "Enable" và nhấn Lưu.`
            );
            return;
        }
        if (error.code === 'auth/popup-blocked') {
            alert('Trình duyệt đã chặn cửa sổ bật lên (popup). Vui lòng cho phép popup đối với trang này để đăng nhập Google.');
            return;
        }
        alert('Đăng nhập Google không thành công: ' + (error.message || error.code || 'Đã xảy ra lỗi'));
    } finally {
        setButtonsBusy(false);
    }
}

// Sự kiện khi bấm "Tiếp tục với Google": mở cửa sổ Google Sign-In chính thức
if (btnLoginGateGoogle) {
    btnLoginGateGoogle.addEventListener('click', () => {
        loginWithGoogle();
    });
}

// Sự kiện mở danh sách các tài khoản Google đã lưu trên máy
if (btnShowSavedAccounts) {
    btnShowSavedAccounts.addEventListener('click', () => {
        showGoogleChooserPanel();
    });
}

// Sự kiện đăng nhập bằng tài khoản Google khác trong bảng Account Chooser
if (btnChooserGooglePopup) {
    btnChooserGooglePopup.addEventListener('click', () => {
        loginWithGoogle();
    });
}

if (btnChooserBack) {
    btnChooserBack.addEventListener('click', () => {
        showMainLoginPanel();
    });
}

if (btnToggleAddAccount) {
    btnToggleAddAccount.addEventListener('click', () => {
        if (formAddGoogleAccount) {
            formAddGoogleAccount.classList.toggle('is-hidden');
            if (!formAddGoogleAccount.classList.contains('is-hidden') && inputNewGoogleEmail) {
                inputNewGoogleEmail.focus();
            }
        }
    });
}

if (formAddGoogleAccount) {
    formAddGoogleAccount.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = inputNewGoogleEmail ? inputNewGoogleEmail.value.trim() : '';
        if (email) {
            performLogin(email);
            if (inputNewGoogleEmail) inputNewGoogleEmail.value = '';
        }
    });
}

if (formQuickLogin) {
    formQuickLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = inputQuickEmail ? inputQuickEmail.value.trim() : '';
        if (email) {
            performLogin(email);
        }
    });
}

if (btnTopLogout) {
    btnTopLogout.addEventListener('click', () => {
        if (confirm('Bạn có muốn đổi sang tài khoản Google khác không?')) {
            performLogout();
        }
    });
}

export const calSelectMonth = document.getElementById('cal-select-month');
