// ========================================================
// Lịch Hoạt Động - Timeline Engine
// Trục thời gian: 2 tháng trước đến 2 tháng sau
// Hỗ trợ: Kéo chuột (Drag) & Lăn chuột (Wheel) qua trái/phải
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
    const VISIBLE_DAYS = 44; // Hiển thị 44 ngày vừa vặn trên màn hình chuẩn như Hình 1 (Paimon.moe)

    // Lấy độ rộng cột ngày được căn chỉnh chuẩn theo pixel vật lý (devicePixelRatio)
    // Tự động tối ưu linh hoạt theo độ rộng màn hình (Responsive Mobile & Desktop)
    function getColWidth() {
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
    function syncColWidthCss() {
        const width = getColWidth();
        document.documentElement.style.setProperty('--col-width', `${width}px`);
        return width;
    }
    const headerAxis = document.getElementById('timeline-header-axis');
    const timelineGrid = document.getElementById('timeline-grid');
    const timelineTracks = document.getElementById('timeline-tracks');
    const timelineViewport = document.getElementById('timeline-viewport');
    const timeIndicator = document.getElementById('current-time-indicator');
    const timeBadge = document.getElementById('time-badge');
    const btnJumpNow = document.getElementById('btn-jump-now');
    const btnAddEvent = document.getElementById('btn-add-event');
    const modalAddEvent = document.getElementById('modal-add-event');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');
    const formAddEvent = document.getElementById('form-add-event');
    const inputTitle = document.getElementById('event-title');
    const inputStart = document.getElementById('event-start');
    const inputEnd = document.getElementById('event-end');

    // ========================================================
    // QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG & TÁCH BIỆT DỮ LIỆU RIÊNG (User Session & Google Chooser)
    // ========================================================
    const CURRENT_USER_KEY = 'timeline_current_user_session';
    const SAVED_GOOGLE_ACCOUNTS_KEY = 'timeline_saved_google_accounts';
    let currentActiveUser = null;
    let currentFirebaseUser = null;
    let firestoreDb = null;

    function safeEscape(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const loginGateOverlay = document.getElementById('login-gate-overlay');
    const loginPanelMain = document.getElementById('login-panel-main');
    const loginPanelGoogleChooser = document.getElementById('login-panel-google-chooser');
    const btnLoginGateGoogle = document.getElementById('btn-login-gate-google');
    const btnChooserBack = document.getElementById('btn-chooser-back');
    const googleAccountsList = document.getElementById('google-accounts-list');
    const btnToggleAddAccount = document.getElementById('btn-toggle-add-account');
    const formAddGoogleAccount = document.getElementById('form-add-google-account');
    const inputNewGoogleEmail = document.getElementById('input-new-google-email');

    const formQuickLogin = document.getElementById('form-quick-login');
    const inputQuickEmail = document.getElementById('input-quick-email');
    const topUserProfileBadge = document.getElementById('top-user-profile-badge');
    const userAvatarWrap = document.getElementById('user-avatar-wrap');
    const userAvatarCircle = document.getElementById('user-avatar-circle');
    const topUserName = document.getElementById('top-user-name');
    const topUserEmail = document.getElementById('top-user-email');
    const topUserInfo = document.getElementById('top-user-info');
    const btnQuickEditName = document.getElementById('btn-quick-edit-name');
    const btnTopLogout = document.getElementById('btn-top-logout');

    // Các phần tử trong Modal Hồ Sơ & Đổi Tên / Ảnh Đại Diện
    const modalUserAvatar = document.getElementById('modal-user-avatar');
    const btnCloseAvatarModal = document.getElementById('btn-close-avatar-modal');
    const btnCancelAvatarModal = document.getElementById('btn-cancel-avatar-modal');
    const btnSaveAvatarModal = document.getElementById('btn-save-avatar-modal');
    const avatarPreviewLarge = document.getElementById('avatar-preview-large');
    const avatarPreviewInitial = document.getElementById('avatar-preview-initial');
    const avatarPreviewImg = document.getElementById('avatar-preview-img');
    const avatarPreviewName = document.getElementById('avatar-preview-name');
    const avatarPreviewEmail = document.getElementById('avatar-preview-email');
    const inputUserDisplayName = document.getElementById('input-user-display-name');
    const btnTriggerAvatarFile = document.getElementById('btn-trigger-avatar-file');
    const inputAvatarFile = document.getElementById('input-avatar-file');
    const inputAvatarUrl = document.getElementById('input-avatar-url');
    const btnApplyAvatarUrl = document.getElementById('btn-apply-avatar-url');
    const btnRemoveAvatar = document.getElementById('btn-remove-avatar');
    const avatarPresetsGrid = document.getElementById('avatar-presets-grid');

    let pendingAvatarDataUrl = null;

    // Bộ sưu tập Avatar mẫu phong cách Mascot & Google
    const PRESET_AVATARS = [
        {
            id: 'anime_purple_girl',
            name: 'Anime Tím',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#pbg1)"/><circle cx="50" cy="46" r="23" fill="#fed7aa"/><path d="M26 40 C28 20, 72 20, 74 40 C76 46, 68 52, 64 54 C60 48, 40 48, 36 54 C32 52, 24 46, 26 40 Z" fill="#6d28d9"/><path d="M24 38 C20 46, 24 64, 30 70 C34 58, 36 52, 34 46 Z" fill="#5b21b6"/><path d="M76 38 C80 46, 76 64, 70 70 C66 58, 64 52, 66 46 Z" fill="#5b21b6"/><circle cx="41" cy="45" r="4.5" fill="#4c1d95"/><circle cx="59" cy="45" r="4.5" fill="#4c1d95"/><circle cx="42.5" cy="43.5" r="1.8" fill="#ffffff"/><circle cx="60.5" cy="43.5" r="1.8" fill="#ffffff"/><path d="M46 53 Q50 58 54 53" stroke="#e11d48" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="36" cy="50" rx="4" ry="2" fill="#f43f5e" opacity="0.45"/><ellipse cx="64" cy="50" rx="4" ry="2" fill="#f43f5e" opacity="0.45"/><path d="M30 84 C34 70, 66 70, 70 84 L72 100 L28 100 Z" fill="#c084fc"/></svg>`
        },
        {
            id: 'anime_cyan_boy',
            name: 'Cyber Boy',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#pbg2)"/><circle cx="50" cy="47" r="23" fill="#ffedd5"/><path d="M25 42 C26 22, 74 22, 75 42 C68 36, 60 35, 50 36 C40 35, 32 36, 25 42 Z" fill="#0369a1"/><rect x="23" y="42" width="54" height="9" rx="4" fill="#0284c7" opacity="0.85"/><circle cx="41" cy="46" r="3.5" fill="#38bdf8"/><circle cx="59" cy="46" r="3.5" fill="#38bdf8"/><path d="M46 54 Q50 57 54 54" stroke="#0284c7" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M28 85 C32 72, 68 72, 72 85 L74 100 L26 100 Z" fill="#0f172a"/><path d="M20 42 C16 42, 16 54, 20 54 Z" fill="#38bdf8"/><path d="M80 42 C84 42, 84 54, 80 54 Z" fill="#38bdf8"/></svg>`
        },
        {
            id: 'cute_neko',
            name: 'Mèo Neko',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbg3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fbbf24"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#pbg3)"/><polygon points="30,42 22,18 44,28" fill="#ffffff"/><polygon points="30,40 25,23 41,30" fill="#f43f5e"/><polygon points="70,42 78,18 56,28" fill="#ffffff"/><polygon points="70,40 75,23 59,30" fill="#f43f5e"/><circle cx="50" cy="54" r="28" fill="#ffffff"/><circle cx="39" cy="52" r="5" fill="#1e293b"/><circle cx="61" cy="52" r="5" fill="#1e293b"/><circle cx="41" cy="50" r="1.8" fill="#ffffff"/><circle cx="63" cy="50" r="1.8" fill="#ffffff"/><polygon points="50,57 47,60 53,60" fill="#f43f5e"/><path d="M44 63 Q47 67 50 63 Q53 67 56 63" stroke="#475569" stroke-width="2" fill="none" stroke-linecap="round"/><line x1="28" y1="56" x2="18" y2="54" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><line x1="28" y1="60" x2="18" y2="62" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><line x1="72" y1="56" x2="82" y2="54" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/><line x1="72" y1="60" x2="82" y2="62" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>`
        },
        {
            id: 'google_official',
            name: 'Google Color',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="50" fill="#ffffff"/><g transform="translate(18, 18) scale(2.65)"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></g></svg>`
        },
        {
            id: 'star_cosmic',
            name: 'Ngôi Sao',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbg5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#pbg5)"/><polygon points="50,20 59,38 79,41 64,56 68,76 50,66 32,76 36,56 21,41 41,38" fill="#facc15"/><circle cx="43" cy="48" r="3.5" fill="#1e1b4b"/><circle cx="57" cy="48" r="3.5" fill="#1e1b4b"/><path d="M47 54 Q50 58 53 54" stroke="#1e1b4b" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`
        },
        {
            id: 'gamer_neon',
            name: 'Gamer Neon',
            svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pbg6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#pbg6)"/><circle cx="50" cy="50" r="44" stroke="#10b981" stroke-width="2.5" fill="none"/><path d="M30 42 C30 35, 70 35, 70 42 L74 62 C75 68, 68 72, 62 66 L56 60 L44 60 L38 66 C32 72, 25 68, 26 62 Z" fill="#10b981"/><circle cx="65" cy="47" r="3" fill="#0f172a"/><circle cx="61" cy="53" r="3" fill="#0f172a"/><rect x="35" y="45" width="4" height="10" fill="#0f172a"/><rect x="32" y="48" width="10" height="4" fill="#0f172a"/></svg>`
        }
    ];

    function getCurrentUser() {
        if (currentActiveUser) return currentActiveUser;
        try {
            const raw = localStorage.getItem(CURRENT_USER_KEY);
            if (raw) {
                currentActiveUser = JSON.parse(raw);
                if (currentActiveUser && currentActiveUser.avatar && currentActiveUser.avatar.includes('koyasaki_avatar.png')) {
                    currentActiveUser.avatar = '';
                    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentActiveUser));
                }
                return currentActiveUser;
            }
        } catch (e) {
            console.error('Lỗi khi đọc session tài khoản:', e);
        }
        return null;
    }

    function setCurrentUser(user) {
        currentActiveUser = user;
        if (user) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    }

    function getSavedGoogleAccounts() {
        try {
            const raw = localStorage.getItem(SAVED_GOOGLE_ACCOUNTS_KEY);
            let accounts = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(accounts)) accounts = [];

            // Tự động làm sạch các avatar dính ảnh cũ koyasaki_avatar.png
            let updatedAccounts = false;
            accounts.forEach(acc => {
                if (acc.avatar && acc.avatar.includes('koyasaki_avatar.png')) {
                    acc.avatar = '';
                    updatedAccounts = true;
                }
            });
            if (updatedAccounts) {
                localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(accounts));
            }

            // Nếu đã từng có session hiện tại mà chưa được lưu vào danh sách thì tự động đưa vào
            const user = getCurrentUser();
            if (user && user.email) {
                const exists = accounts.some(a => a.email.toLowerCase() === user.email.toLowerCase());
                if (!exists) {
                    accounts.unshift({
                        id: user.id || user.email,
                        email: user.email,
                        name: user.name || user.email.split('@')[0],
                        avatar: user.avatar || '',
                        lastUsed: new Date().toISOString()
                    });
                    localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(accounts));
                }
            }
            return accounts;
        } catch (e) {
            return [];
        }
    }

    function saveGoogleAccount(userObj) {
        try {
            let accounts = getSavedGoogleAccounts();
            const cleanEmail = userObj.email.trim().toLowerCase();
            const existing = accounts.find(a => a.email.toLowerCase() === cleanEmail);
            const avatar = userObj.avatar || (existing ? existing.avatar : '') || '';
            accounts = accounts.filter(a => a.email.toLowerCase() !== cleanEmail);
            accounts.unshift({
                id: cleanEmail,
                email: cleanEmail,
                name: userObj.name || (cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1)),
                avatar: avatar,
                lastUsed: new Date().toISOString()
            });
            localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(accounts));
        } catch (e) { }
    }

    function removeSavedGoogleAccount(email) {
        try {
            let accounts = getSavedGoogleAccounts();
            const cleanEmail = email.trim().toLowerCase();
            accounts = accounts.filter(a => a.email.toLowerCase() !== cleanEmail);
            localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(accounts));
            renderGoogleAccountsList();
        } catch (e) { }
    }

    function showGoogleChooserPanel() {
        if (loginPanelMain) loginPanelMain.classList.add('is-hidden');
        if (loginPanelGoogleChooser) loginPanelGoogleChooser.classList.remove('is-hidden');
        if (formAddGoogleAccount) formAddGoogleAccount.classList.add('is-hidden');
        renderGoogleAccountsList();
    }

    function showMainLoginPanel() {
        if (loginPanelGoogleChooser) loginPanelGoogleChooser.classList.add('is-hidden');
        if (loginPanelMain) loginPanelMain.classList.remove('is-hidden');
    }

    function renderGoogleAccountsList() {
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
                ? `<img src="${safeEscape(acc.avatar)}" alt="${safeEscape(acc.name)}">`
                : initial;
            const avatarStyle = acc.avatar
                ? ''
                : `background: linear-gradient(135deg, hsl(${hue}, 75%, 55%), hsl(${(hue + 40) % 360}, 85%, 45%));`;

            item.innerHTML = `
                <div class="google-acc-avatar" style="${avatarStyle}">
                    ${avatarHtml}
                </div>
                <div class="google-acc-info">
                    <div class="google-acc-name">${safeEscape(acc.name)}</div>
                    <div class="google-acc-email">${safeEscape(acc.email)}</div>
                </div>
                <div class="google-acc-badge">Đã lưu</div>
                <button type="button" class="google-acc-btn-remove" title="Xóa tài khoản này khỏi máy" data-email="${safeEscape(acc.email)}">
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
                    }
                });
            }

            googleAccountsList.appendChild(item);
        });
    }

    function getTimelineStorageKey() {
        const user = getCurrentUser();
        return user ? ('timeline_events_user_' + encodeURIComponent(user.id)) : 'timeline_events_guest';
    }

    function getCalEventsStorageKey() {
        const user = getCurrentUser();
        return user ? ('calendar_user_events_' + encodeURIComponent(user.id)) : 'calendar_user_events_guest';
    }

    function getCalCatsStorageKey() {
        const user = getCurrentUser();
        return user ? ('calendar_user_categories_' + encodeURIComponent(user.id)) : 'calendar_user_categories_guest';
    }

    function getTrackOrderStorageKey() {
        const user = getCurrentUser();
        return user ? ('timeline_track_order_' + encodeURIComponent(user.id)) : 'timeline_track_order_guest';
    }

    function updateAuthUI() {
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
                    userAvatarCircle.innerHTML = `<img src="${safeEscape(user.avatar)}" alt="${safeEscape(user.name)}">`;
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
        }
    }

    function performLogin(email, customName, avatarUrl) {
        if (!email) return;
        let cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail.includes('@')) {
            cleanEmail += '@gmail.com';
        }
        const usernamePart = cleanEmail.split('@')[0];
        const existingAcc = getSavedGoogleAccounts().find(a => a.email.toLowerCase() === cleanEmail);
        const name = customName || (existingAcc ? existingAcc.name : '') || (usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1));
        const userAvatar = avatarUrl || (existingAcc ? existingAcc.avatar : '') || '';

        const userObj = {
            id: cleanEmail,
            email: cleanEmail,
            name: name,
            avatar: userAvatar,
            loginAt: new Date().toISOString()
        };

        setCurrentUser(userObj);
        saveGoogleAccount(userObj); // Tự động ghi nhớ tài khoản để hiển thị trong Google Account Chooser
        cachedEventsMemory = null;
        updateAuthUI();

        // Tự động kết nối đồng bộ đám mây Firebase nếu đã cấu hình
        if (typeof attachFirestoreSyncForUser === 'function') {
            attachFirestoreSyncForUser(userObj);
        }

        // Tự động tải lại lịch cá nhân và timeline riêng của tài khoản này
        renderEvents();
        if (typeof renderMonthlyCalendar === 'function' && typeof calSelectMonth !== 'undefined' && calSelectMonth && typeof calSelectYear !== 'undefined' && calSelectYear) {
            const m = parseInt(calSelectMonth.value, 10);
            const y = parseInt(calSelectYear.value, 10);
            renderMonthlyCalendar(m, y);
        }
    }

    function performLogout() {
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }
        setCurrentUser(null);
        cachedEventsMemory = null;
        updateAuthUI();
        showGoogleChooserPanel(); // Hiển thị sẵn danh sách các tài khoản Google đã lưu trên máy để chuyển đổi 1-click!

        renderEvents();
        if (typeof renderMonthlyCalendar === 'function' && typeof calSelectMonth !== 'undefined' && calSelectMonth && typeof calSelectYear !== 'undefined' && calSelectYear) {
            const m = parseInt(calSelectMonth.value, 10);
            const y = parseInt(calSelectYear.value, 10);
            renderMonthlyCalendar(m, y);
        }
    }

    // ========================================================
    // QUẢN LÝ AVATAR TÀI KHOẢN (Avatar Customizer Controller)
    // ========================================================
    function updateModalAvatarPreview(dataUrl) {
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

    function openAvatarModal(focusName = false) {
        const user = getCurrentUser();
        if (!user || !modalUserAvatar) return;

        pendingAvatarDataUrl = user.avatar || '';
        if (inputUserDisplayName) {
            inputUserDisplayName.value = user.name || user.email.split('@')[0];
        }
        if (avatarPreviewName) avatarPreviewName.textContent = user.name || 'Người dùng';
        if (avatarPreviewEmail) avatarPreviewEmail.textContent = user.email || '';
        if (inputAvatarUrl) inputAvatarUrl.value = '';

        updateModalAvatarPreview(pendingAvatarDataUrl);
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

    function closeAvatarModal() {
        if (!modalUserAvatar) return;
        modalUserAvatar.classList.remove('is-active');
        modalUserAvatar.setAttribute('aria-hidden', 'true');
        pendingAvatarDataUrl = null;
    }

    function renderAvatarPresetsGrid() {
        if (!avatarPresetsGrid) return;
        avatarPresetsGrid.innerHTML = '';
        PRESET_AVATARS.forEach(p => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'avatar-preset-btn';
            btn.title = p.name;
            const imgSrc = p.img ? p.img : ('data:image/svg+xml;utf8,' + encodeURIComponent(p.svg));
            btn.innerHTML = `<img src="${safeEscape(imgSrc)}" alt="${safeEscape(p.name)}">`;

            btn.addEventListener('click', () => {
                pendingAvatarDataUrl = imgSrc;
                updateModalAvatarPreview(imgSrc);
                avatarPresetsGrid.querySelectorAll('.avatar-preset-btn').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
            });
            avatarPresetsGrid.appendChild(btn);
        });
    }

    function processImageFileToAvatar(file) {
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
                pendingAvatarDataUrl = dataUrl;
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
                    pendingAvatarDataUrl = dataUrl;
                    updateModalAvatarPreview(dataUrl);
                } catch (err) {
                    // Nếu lỗi CORS từ server ngoài, dùng trực tiếp link URL
                    pendingAvatarDataUrl = url;
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
            pendingAvatarDataUrl = '';
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
            if (pendingAvatarDataUrl !== null) {
                user.avatar = pendingAvatarDataUrl;
            }
            setCurrentUser(user);
            saveGoogleAccount(user);
            updateAuthUI();
            renderGoogleAccountsList();
            closeAvatarModal();
            if (typeof showToastNotification === 'function') {
                showToastNotification(`Đã lưu tên "${user.name}" thành công!`, '👤 Hồ sơ tài khoản');
            }
        });
    }

    // Sự kiện khi bấm "Tiếp tục với Google": bật ngay bảng chọn tài khoản Google
    if (btnLoginGateGoogle) {
        btnLoginGateGoogle.addEventListener('click', () => {
            showGoogleChooserPanel();
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

    // ========================================================
    // QUẢN LÝ ĐỒNG BỘ ĐÁM MÂY (FIREBASE REAL-TIME CLOUD SYNC)
    // ========================================================
    const FIREBASE_CONFIG_STORAGE_KEY = 'timeline_firebase_config';
    const btnTopCloudSync = document.getElementById('btn-top-cloud-sync');
    const cloudStatusDot = document.getElementById('cloud-status-dot');
    const cloudStatusText = document.getElementById('cloud-status-text');
    const modalCloudSync = document.getElementById('modal-cloud-sync');
    const btnCloseCloudModal = document.getElementById('btn-close-cloud-modal');
    const btnCancelCloudModal = document.getElementById('btn-cancel-cloud-modal');
    const btnSaveFirebaseConfig = document.getElementById('btn-save-firebase-config');
    const btnDisconnectFirebase = document.getElementById('btn-disconnect-firebase');
    const btnCloudManualSync = document.getElementById('btn-cloud-manual-sync');
    const inputFirebaseConfig = document.getElementById('input-firebase-config');
    const cloudStatusBanner = document.getElementById('cloud-status-banner');
    const cloudBannerIcon = document.getElementById('cloud-banner-icon');
    const cloudBannerTitle = document.getElementById('cloud-banner-title');
    const cloudBannerDesc = document.getElementById('cloud-banner-desc');

    let firestoreUnsubscribe = null;
    let cloudPushTimeout = null;
    let isIncomingCloudUpdate = false;

    function parseFirebaseConfig(raw) {
        if (!raw) return null;
        if (typeof raw === 'object' && raw.apiKey) return raw;
        if (typeof raw !== 'string') return null;
        let text = raw.trim();
        if (!text) return null;

        // Bỏ qua dấu gán nếu có (VD: const firebaseConfig = { ... };)
        const braceStart = text.indexOf('{');
        const braceEnd = text.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
            text = text.substring(braceStart, braceEnd + 1);
        }

        try {
            const parsed = JSON.parse(text);
            if (parsed && (parsed.apiKey || parsed.projectId)) return parsed;
        } catch (e) { }

        try {
            let cleaned = text
                .replace(/([a-zA-Z0-9_$]+)\s*:/g, '"$1":')
                .replace(/'/g, '"')
                .replace(/,\s*([}\]])/g, '$1');
            const parsed = JSON.parse(cleaned);
            if (parsed && (parsed.apiKey || parsed.projectId)) return parsed;
        } catch (err2) { }

        try {
            const extract = (key) => {
                const match = raw.match(new RegExp(`['"]?${key}['"]?\\s*[:=]\\s*['"]([^'"]+)['"]`));
                return match ? match[1] : '';
            };
            const apiKey = extract('apiKey');
            const projectId = extract('projectId');
            if (apiKey || projectId) {
                return {
                    apiKey,
                    authDomain: extract('authDomain'),
                    projectId,
                    storageBucket: extract('storageBucket'),
                    messagingSenderId: extract('messagingSenderId'),
                    appId: extract('appId'),
                    measurementId: extract('measurementId')
                };
            }
        } catch (err3) { }

        return null;
    }

    function getActiveFirebaseConfig() {
        if (window.firebaseConfig && typeof window.firebaseConfig === 'object' && window.firebaseConfig.apiKey) {
            return window.firebaseConfig;
        }
        try {
            const stored = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
            if (stored) {
                const parsed = parseFirebaseConfig(stored);
                if (parsed && parsed.apiKey) return parsed;
            }
        } catch (e) { }
        return null;
    }

    function updateCloudUIState(isConnected, config, errMsg) {
        if (cloudStatusDot) {
            if (isConnected) {
                cloudStatusDot.classList.add('is-connected');
                cloudStatusDot.classList.remove('is-syncing');
            } else {
                cloudStatusDot.classList.remove('is-connected', 'is-syncing');
            }
        }
        if (cloudStatusText) {
            cloudStatusText.textContent = isConnected ? 'Đám mây' : 'Chưa kết nối';
        }
        if (btnTopCloudSync) {
            btnTopCloudSync.title = isConnected
                ? `Đồng bộ đám mây: Đã kết nối với dự án "${config ? config.projectId : ''}"`
                : 'Đồng bộ đám mây: Nhấp để kết nối Firebase';
        }

        if (cloudStatusBanner) {
            if (isConnected) {
                cloudStatusBanner.classList.add('is-connected');
                if (cloudBannerIcon) cloudBannerIcon.textContent = '🟢';
                if (cloudBannerTitle) cloudBannerTitle.textContent = `Đã kết nối đám mây (Dự án: ${config && config.projectId ? config.projectId : 'Firebase'})`;
                if (cloudBannerDesc) cloudBannerDesc.textContent = 'Dữ liệu lịch & sự kiện sẽ tự động đồng bộ theo thời gian thực giữa máy tính và điện thoại.';
                if (btnDisconnectFirebase) btnDisconnectFirebase.style.display = 'inline-block';
                if (btnCloudManualSync) btnCloudManualSync.style.display = 'inline-flex';
            } else {
                cloudStatusBanner.classList.remove('is-connected');
                if (cloudBannerIcon) cloudBannerIcon.textContent = '⚪';
                if (cloudBannerTitle) cloudBannerTitle.textContent = errMsg ? `Lỗi: ${errMsg}` : 'Chưa kết nối Firebase';
                if (cloudBannerDesc) cloudBannerDesc.textContent = 'Dán mã cấu hình Firebase bên dưới để đồng bộ dữ liệu thời gian thực giữa các thiết bị.';
                if (btnDisconnectFirebase) btnDisconnectFirebase.style.display = 'none';
                if (btnCloudManualSync) btnCloudManualSync.style.display = 'none';
            }
        }
    }

    function initFirebaseSync() {
        const cfg = getActiveFirebaseConfig();
        if (!cfg || !cfg.apiKey || typeof firebase === 'undefined') {
            updateCloudUIState(false, null);
            return false;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(cfg);
            }
            firestoreDb = firebase.firestore();
            updateCloudUIState(true, cfg);

            const user = getCurrentUser();
            if (user && user.email) {
                attachFirestoreSyncForUser(user);
            }
            return true;
        } catch (err) {
            console.warn('Lỗi khởi tạo Firebase:', err);
            updateCloudUIState(false, null, err.message);
            return false;
        }
    }

    function attachFirestoreSyncForUser(user) {
        if (!firestoreDb || !user || !user.email) return;
        const cleanEmail = user.email.trim().toLowerCase();

        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }

        const docRef = firestoreDb.collection('user_calendars').doc(cleanEmail);

        firestoreUnsubscribe = docRef.onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data() || {};
                isIncomingCloudUpdate = true;
                let changed = false;

                if (Array.isArray(data.timelineEvents)) {
                    cachedEventsMemory = data.timelineEvents;
                    try {
                        localStorage.setItem(getTimelineStorageKey(), JSON.stringify(data.timelineEvents));
                    } catch (e) { }
                    changed = true;
                }

                if (Array.isArray(data.calEvents)) {
                    try {
                        localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(data.calEvents));
                    } catch (e) { }
                    changed = true;
                }

                if (Array.isArray(data.calCategories) && data.calCategories.length) {
                    try {
                        localStorage.setItem(getCalCatsStorageKey(), JSON.stringify(data.calCategories));
                    } catch (e) { }
                    changed = true;
                }

                if (Array.isArray(data.trackOrder) && data.trackOrder.length) {
                    try {
                        localStorage.setItem(getTrackOrderStorageKey(), JSON.stringify(data.trackOrder));
                    } catch (e) { }
                    changed = true;
                }

                if (data.userProfile && data.userProfile.name && data.userProfile.name !== user.name) {
                    user.name = data.userProfile.name;
                    if (data.userProfile.avatar !== undefined) user.avatar = data.userProfile.avatar;
                    setCurrentUser(user);
                    saveGoogleAccount(user);
                    updateAuthUI();
                }

                if (changed) {
                    renderEvents();
                    if (typeof renderMonthlyCalendar === 'function' && typeof calSelectMonth !== 'undefined' && calSelectMonth) {
                        renderMonthlyCalendar(parseInt(calSelectMonth.value, 10), parseInt(calSelectYear.value, 10));
                    }
                    if (typeof showToastNotification === 'function') {
                        showToastNotification('Đã đồng bộ dữ liệu mới nhất từ Đám mây!', '☁️ Firebase Sync');
                    }
                }
                setTimeout(() => { isIncomingCloudUpdate = false; }, 200);
            } else {
                pushLocalDataToCloud(cleanEmail);
            }
        }, err => {
            console.warn('Lỗi Firestore onSnapshot:', err);
        });
    }

    function pushLocalDataToCloud(targetEmail) {
        if (!firestoreDb) return;
        const user = getCurrentUser();
        const email = targetEmail || (user ? user.email : null);
        if (!email) return;
        const cleanEmail = email.trim().toLowerCase();

        if (cloudStatusDot) cloudStatusDot.classList.add('is-syncing');

        const timelineEvents = loadEvents();
        const calEvents = loadCalEvents();
        const calCategories = loadCalCategories();
        const trackOrder = loadTrackOrder(currentTotalTracks);
        const userProfile = {
            name: user ? user.name : '',
            avatar: user ? (user.avatar || '') : ''
        };

        const docRef = firestoreDb.collection('user_calendars').doc(cleanEmail);
        docRef.set({
            email: cleanEmail,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedFrom: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            timelineEvents,
            calEvents,
            calCategories,
            trackOrder,
            userProfile
        }, { merge: true })
        .then(() => {
            if (cloudStatusDot) {
                cloudStatusDot.classList.remove('is-syncing');
                cloudStatusDot.classList.add('is-connected');
            }
        })
        .catch(err => {
            console.warn('Lỗi khi đẩy dữ liệu lên Firestore:', err);
            if (cloudStatusDot) cloudStatusDot.classList.remove('is-syncing');
        });
    }

    function scheduleCloudPush() {
        if (!firestoreDb || isIncomingCloudUpdate) return;
        const user = getCurrentUser();
        if (!user || !user.email) return;

        if (cloudPushTimeout) clearTimeout(cloudPushTimeout);
        cloudPushTimeout = setTimeout(() => {
            pushLocalDataToCloud(user.email);
        }, 500);
    }

    function openCloudModal() {
        if (!modalCloudSync) return;
        const activeCfg = getActiveFirebaseConfig();
        if (inputFirebaseConfig) {
            if (activeCfg) {
                inputFirebaseConfig.value = JSON.stringify(activeCfg, null, 2);
            } else {
                inputFirebaseConfig.value = '';
            }
        }
        updateCloudUIState(!!(firestoreDb && activeCfg), activeCfg);
        modalCloudSync.classList.add('is-active');
        modalCloudSync.setAttribute('aria-hidden', 'false');
    }

    function closeCloudModal() {
        if (!modalCloudSync) return;
        modalCloudSync.classList.remove('is-active');
        modalCloudSync.setAttribute('aria-hidden', 'true');
    }

    if (btnTopCloudSync) {
        btnTopCloudSync.addEventListener('click', openCloudModal);
    }

    if (btnCloseCloudModal) {
        btnCloseCloudModal.addEventListener('click', closeCloudModal);
    }

    if (btnCancelCloudModal) {
        btnCancelCloudModal.addEventListener('click', closeCloudModal);
    }

    if (btnSaveFirebaseConfig) {
        btnSaveFirebaseConfig.addEventListener('click', () => {
            const raw = inputFirebaseConfig ? inputFirebaseConfig.value.trim() : '';
            if (!raw) {
                alert('Vui lòng dán mã cấu hình Firebase trước khi lưu!');
                return;
            }
            const cfg = parseFirebaseConfig(raw);
            if (!cfg || !cfg.apiKey) {
                alert('Mã cấu hình không hợp lệ hoặc thiếu apiKey/projectId. Vui lòng kiểm tra lại!');
                return;
            }

            try {
                localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
                const ok = initFirebaseSync();
                if (ok) {
                    closeCloudModal();
                    if (typeof showToastNotification === 'function') {
                        showToastNotification(`Đã kết nối thành công với dự án "${cfg.projectId}"!`, '☁️ Đám mây Firebase');
                    }
                    const user = getCurrentUser();
                    if (user && user.email) {
                        pushLocalDataToCloud(user.email);
                    }
                } else {
                    alert('Không thể khởi tạo Firebase với cấu hình này. Vui lòng kiểm tra lại apiKey hoặc quyền truy cập mạng.');
                }
            } catch (err) {
                alert('Lỗi khi lưu cấu hình: ' + err.message);
            }
        });
    }

    if (btnDisconnectFirebase) {
        btnDisconnectFirebase.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn ngắt kết nối đồng bộ đám mây Firebase trên thiết bị này?')) {
                localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
                if (firestoreUnsubscribe) {
                    firestoreUnsubscribe();
                    firestoreUnsubscribe = null;
                }
                firestoreDb = null;
                updateCloudUIState(false, null);
                closeCloudModal();
                if (typeof showToastNotification === 'function') {
                    showToastNotification('Đã ngắt kết nối đồng bộ đám mây', '☁️ Firebase');
                }
            }
        });
    }

    if (btnCloudManualSync) {
        btnCloudManualSync.addEventListener('click', () => {
            const user = getCurrentUser();
            if (!user || !user.email) {
                alert('Vui lòng đăng nhập trước khi đồng bộ!');
                return;
            }
            pushLocalDataToCloud(user.email);
            if (typeof showToastNotification === 'function') {
                showToastNotification('Đã gửi toàn bộ dữ liệu sự kiện lên Đám mây!', '☁️ Firebase');
            }
        });
    }

    // Các phần tử Lặp lại sự kiện (Recurring Events)
    const inputRepeatType = document.getElementById('event-repeat-type');
    const inputRepeatStart = document.getElementById('event-repeat-start');
    const inputRepeatEnd = document.getElementById('event-repeat-end');
    const inputRepeatForever = document.getElementById('event-repeat-forever');
    const repeatRangeGroup = document.getElementById('repeat-range-group');
    const repeatStatusHint = document.getElementById('repeat-status-hint');

    // Các phần tử giao diện Tải & Cắt ảnh
    const eventImageData = document.getElementById('event-image-data');
    const eventImageFile = document.getElementById('event-image-file');
    const eventImageUrl = document.getElementById('event-image-url');
    const btnLoadUrl = document.getElementById('btn-load-url');
    const fileDropzone = document.getElementById('file-dropzone');
    const tabBtnFile = document.getElementById('tab-btn-file');
    const tabBtnUrl = document.getElementById('tab-btn-url');
    const tabContentFile = document.getElementById('tab-content-file');
    const tabContentUrl = document.getElementById('tab-content-url');
    const imageCropPreviewWrapper = document.getElementById('image-crop-preview-wrapper');
    const eventBarPreviewBox = document.getElementById('event-bar-preview-box');
    const previewBarTitle = document.getElementById('preview-bar-title');
    const previewBarArt = document.getElementById('preview-bar-art');
    let currentEventColor = '#d6aa7d';
    const btnRecrop = document.getElementById('btn-recrop');
    const btnRemoveArt = document.getElementById('btn-remove-art');

    // Các phần tử trong Modal Cắt Ảnh
    const modalCropImage = document.getElementById('modal-crop-image');
    const btnCloseCropModal = document.getElementById('btn-close-crop-modal');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnApplyCrop = document.getElementById('btn-apply-crop');
    const cropperCanvas = document.getElementById('cropper-canvas');
    const cropBox = document.getElementById('crop-box');
    const cropperWorkspaceWrapper = document.getElementById('cropper-workspace-wrapper');
    const cropZoomSlider = document.getElementById('crop-zoom-slider');
    const cropZoomValue = document.getElementById('crop-zoom-value');
    const btnRatioBanner = document.getElementById('btn-ratio-banner');
    const btnRatioFree = document.getElementById('btn-ratio-free');
    const cropperSampleBar = document.getElementById('cropper-sample-bar');
    const cropperSampleTitle = document.getElementById('cropper-sample-title');
    const cropperSampleArt = document.getElementById('cropper-sample-art');

    // Các phần tử trong Modal Chi tiết Sự kiện
    const modalEventDetail = document.getElementById('modal-event-detail');
    const btnCloseEventDetail = document.getElementById('btn-close-event-detail');
    const detailImageBox = document.getElementById('detail-image-box');
    const detailImage = document.getElementById('detail-image');
    const detailTitle = document.getElementById('detail-title');
    const detailTime = document.getElementById('detail-time');
    const detailLinkBox = document.getElementById('detail-link-box');
    const detailLink = document.getElementById('detail-link');
    const detailCountdown = document.getElementById('detail-countdown');
    const btnDeleteDetailEvent = document.getElementById('btn-delete-detail-event');
    const inputArticleUrl = document.getElementById('event-article-url');
    const inputTag = document.getElementById('event-tag');
    const inputNote = document.getElementById('event-note');
    const detailTagBox = document.getElementById('detail-tag-box');
    const detailTagPill = document.getElementById('detail-tag-pill');
    const detailRepeatPill = document.getElementById('detail-repeat-pill');
    const detailNote = document.getElementById('detail-note');

    // Các phần tử trong Modal Xóa / Dừng Sự Kiện Lặp Lại
    const modalDeleteRepeat = document.getElementById('modal-delete-repeat');
    const btnCloseDeleteRepeat = document.getElementById('btn-close-delete-repeat');
    const btnCancelDeleteRepeat = document.getElementById('btn-cancel-delete-repeat');
    const btnDeleteThisOnly = document.getElementById('btn-delete-this-only');
    const btnDeleteFromHere = document.getElementById('btn-delete-from-here');
    const btnDeleteAllRepeat = document.getElementById('btn-delete-all-repeat');
    const deleteRepeatSubtitle = document.getElementById('delete-repeat-subtitle');

    // Các phần tử trong Modal Sắp Xếp & Hoán Đổi Hàng Sự Kiện
    const btnReorderTracks = document.getElementById('btn-reorder-tracks');
    const modalReorderTracks = document.getElementById('modal-reorder-tracks');
    const btnCloseReorderModal = document.getElementById('btn-close-reorder-modal');
    const btnCloseReorderDone = document.getElementById('btn-close-reorder-done');
    const swapSelectX = document.getElementById('swap-select-x');
    const swapSelectY = document.getElementById('swap-select-y');
    const btnTriggerSwap = document.getElementById('btn-trigger-swap');
    const trackListContainer = document.getElementById('track-list-container');
    const btnResetTracks = document.getElementById('btn-reset-tracks');
    const detailTrackBadge = document.getElementById('detail-track-badge');
    const btnDetailSwapTrack = document.getElementById('btn-detail-swap-track');

    // Các phần tử Bộ lọc Tag sự kiện (Tag Filter)
    const btnFilterTag = document.getElementById('btn-filter-tag');
    const btnFilterLabel = document.getElementById('btn-filter-label');
    const filterActiveDot = document.getElementById('filter-active-dot');
    const filterDropdownWrapper = document.getElementById('filter-dropdown-wrapper');
    const filterDropdownMenu = document.getElementById('filter-dropdown-menu');
    const filterTagList = document.getElementById('filter-tag-list');
    const btnFilterReset = document.getElementById('btn-filter-reset');
    const activeFilterBanner = document.getElementById('active-filter-banner');
    const activeFilterName = document.getElementById('active-filter-name');
    const activeFilterCount = document.getElementById('active-filter-count');
    const btnClearFilter = document.getElementById('btn-clear-filter');

    // Trạng thái bộ lọc Tag hiện tại (null = hiển thị tất cả, hoặc string tên tag)
    let activeTagFilter = null;

    // Quản lý thứ tự hiển thị các hàng (Track Order & Reordering)
    let currentLogicalTracks = []; // Mảng chứa { logicalIndex, events: [] }
    let currentTrackOrder = [];    // Mảng ánh xạ: visualRowIndex -> logicalTrackIndex
    let currentTotalTracks = 14;   // Tổng số hàng hiển thị

    // Tên các thứ tiếng Việt theo đúng giao diện mẫu (CN, T2, T3, T4, T5, T6, T7)
    const WEEKDAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // Xác định khoảng thời gian: chính xác 90 ngày trước và 90 ngày sau hôm nay
    const DAYS_PAST = 90;
    const DAYS_FUTURE = 90;

    const now = new Date();

    // Ngày bắt đầu: lùi đúng 90 ngày tính từ 00:00:00 hôm nay
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_PAST);
    startDate.setHours(0, 0, 0, 0);

    // Ngày kết thúc: tiến đúng 90 ngày tính đến 23:59:59
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_FUTURE);
    endDate.setHours(23, 59, 59, 999);

    // Tính tổng số ngày (90 ngày trước + 1 ngày hôm nay + 90 ngày sau = 181 ngày)
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const totalDays = DAYS_PAST + 1 + DAYS_FUTURE;

    // Kiểm tra 2 ngày có cùng ngày/tháng/năm hay không
    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    let timelineDaysData = [];

    // 1. VẼ TRỤC THỜI GIAN & LƯỚI CỘT
    function renderTimelineScale() {
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

        timelineDaysData = daysData;
        updatePinnedMonth();
    }

    // 1.4 CẬP NHẬT NHÃN THÁNG GHIM Ở MÉP TRÁI KHI NGÀY MÙNG 1 BỊ CUỘN KHUẤT
    function updatePinnedMonth() {
        const scrollLeft = timelineViewport.scrollLeft;
        const colWidth = getColWidth();
        if (!colWidth || colWidth <= 0 || !timelineDaysData.length) return;

        // Cột ngày nằm ngay ở mép trái tầm nhìn của viewport
        const leftColIndex = Math.floor(scrollLeft / colWidth);
        if (leftColIndex < 0 || leftColIndex >= totalDays) return;

        const currentDayItem = timelineDaysData[leftColIndex];
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
                if (timelineDaysData[j].dayNum === 1) {
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
    function updateCurrentTime() {
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
        if (typeof updateHorizontalNowNeedle === 'function') {
            updateHorizontalNowNeedle();
        }
    }

    // Cuộn màn hình đưa ngày hôm nay vào chính giữa trục thời gian
    function scrollToToday(smooth = false) {
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

    // 4. TƯƠNG TÁC: KÉO CHUỘT 2 CHIỀU (MOUSE DRAG TO PAN 2D)
    let isDown = false;
    let startX = 0;
    let startY = 0;
    let initialScrollLeft = 0;
    let initialScrollTop = 0;

    timelineViewport.addEventListener('mousedown', (e) => {
        // Chỉ nhận chuột trái (button = 0)
        if (e.button !== 0) return;
        // Không kích hoạt kéo cuộn nếu click vào nút, form hoặc nút xóa sự kiện
        if (e.target.closest('.event-delete-btn') || e.target.closest('button') || e.target.closest('input')) return;
        isDown = true;
        timelineViewport.classList.add('is-dragging');
        startX = e.pageX - timelineViewport.offsetLeft;
        startY = e.pageY - timelineViewport.offsetTop;
        initialScrollLeft = timelineViewport.scrollLeft;
        initialScrollTop = timelineViewport.scrollTop;
    });

    window.addEventListener('mouseup', () => {
        if (!isDown) return;
        isDown = false;
        timelineViewport.classList.remove('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - timelineViewport.offsetLeft;
        const y = e.pageY - timelineViewport.offsetTop;
        const walkX = (x - startX) * 1.25; // Hệ số tốc độ kéo ngang
        const walkY = (y - startY) * 1.25; // Hệ số tốc độ kéo dọc
        timelineViewport.scrollLeft = initialScrollLeft - walkX;
        timelineViewport.scrollTop = initialScrollTop - walkY;
    });

    // ========================================================
    // 6. QUẢN LÝ SỰ KIỆN & HIỂN THỊ (Event Management & Tracks)
    // ========================================================

    // Bảng màu đơn sắc (Flat Solid Colors) chuẩn theo ảnh chụp Hoyoverse
    const COLOR_THEMES = {
        '#d6aa7d': {
            bg: '#d6aa7d', // Vàng be / Caramel (Tabletop Troupe)
            color: '#111827',
            badgeBg: 'rgba(17, 24, 39, 0.75)'
        },
        '#d5f2ee': {
            bg: '#d5f2ee', // Xanh bạc hà / Mint (Across the Frozen Wilds)
            color: '#111827',
            badgeBg: 'rgba(17, 24, 39, 0.75)'
        },
        '#87b1e2': {
            bg: '#87b1e2', // Xanh lam pastel (Resplendent Starlight / Missive)
            color: '#111827',
            badgeBg: 'rgba(17, 24, 39, 0.75)'
        },
        '#da515f': {
            bg: '#da515f', // Đỏ san hô (A Rekviem for the Underworld)
            color: '#111827',
            badgeBg: 'rgba(17, 24, 39, 0.75)'
        },
        '#f6a86c': {
            bg: '#f6a86c', // Cam đào (Epitome Invocation)
            color: '#111827',
            badgeBg: 'rgba(17, 24, 39, 0.75)'
        },
        '#ec75d7': {
            bg: '#ec75d7', // Hồng tím (Stygian Onslaught)
            color: '#111827',
            badgeBg: 'rgba(17, 24, 39, 0.75)'
        },
        // Fallbacks
        '#eab308': { bg: '#d6aa7d', color: '#111827', badgeBg: 'rgba(17, 24, 39, 0.75)' },
        '#38bdf8': { bg: '#87b1e2', color: '#111827', badgeBg: 'rgba(17, 24, 39, 0.75)' },
        '#f43f5e': { bg: '#da515f', color: '#111827', badgeBg: 'rgba(17, 24, 39, 0.75)' },
        '#a855f7': { bg: '#ec75d7', color: '#111827', badgeBg: 'rgba(17, 24, 39, 0.75)' },
        '#10b981': { bg: '#d5f2ee', color: '#111827', badgeBg: 'rgba(17, 24, 39, 0.75)' },
        '#f97316': { bg: '#f6a86c', color: '#111827', badgeBg: 'rgba(17, 24, 39, 0.75)' }
    };

    // Tính độ sáng (Luminance) của màu mã Hex để tự động chọn chữ đen hay trắng
    function getHexLuminance(hexColor) {
        if (!hexColor || typeof hexColor !== 'string') return 180;
        const hex = hexColor.replace('#', '');
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return 0.299 * r + 0.587 * g + 0.114 * b;
        } else if (hex.length >= 6) {
            const r = parseInt(hex.substring(0, 2), 16) || 0;
            const g = parseInt(hex.substring(2, 4), 16) || 0;
            const b = parseInt(hex.substring(4, 6), 16) || 0;
            return 0.299 * r + 0.587 * g + 0.114 * b;
        }
        return 180;
    }

    // Lấy thông số màu hiển thị sự kiện (hỗ trợ màu trích xuất động từ ảnh)
    function getEventTheme(colorHex) {
        if (colorHex && COLOR_THEMES[colorHex]) {
            return COLOR_THEMES[colorHex];
        }
        // Chuẩn Paimon.moe: tất cả thanh sự kiện dùng chữ đen đậm #111827 (chỉ dùng chữ trắng khi nền quá tối đen lum <= 60)
        const lum = getHexLuminance(colorHex);
        const textColor = lum > 60 ? '#111827' : '#ffffff';
        return {
            bg: colorHex || '#d6aa7d',
            color: textColor,
            badgeBg: textColor === '#ffffff' ? 'rgba(0, 0, 0, 0.65)' : 'rgba(17, 24, 39, 0.75)'
        };
    }

    // Ban đầu không thêm sự kiện mẫu, để người dùng tự do thêm sự kiện theo ý muốn
    function getDefaultEvents() {
        return [];
    }

    let cachedEventsMemory = null;

    // Tự động bù đắp (replenish) các sự kiện lặp lại "Vĩnh viễn" khi thời gian trôi qua và mở rộng thêm ngày mới trên timeline
    function replenishRepeatingEvents(events) {
        if (!Array.isArray(events) || events.length === 0) return false;

        // Gom các sự kiện lặp lại (Vĩnh viễn hoặc có hạn lặp dài hạn) theo repeatId
        const repeatGroups = new Map();
        events.forEach(e => {
            const hasFutureRepeat = e.repeatId && e.repeatType && e.repeatType !== 'none' && (
                e.isForever || (e.repeatLimitEnd && new Date(e.repeatLimitEnd).getTime() > new Date(e.start).getTime())
            );
            if (hasFutureRepeat) {
                if (!repeatGroups.has(e.repeatId)) {
                    repeatGroups.set(e.repeatId, []);
                }
                repeatGroups.get(e.repeatId).push(e);
            }
        });

        if (repeatGroups.size === 0) return false;

        let hasNewEvents = false;
        const maxTimelineEndMs = endDate.getTime();

        repeatGroups.forEach((groupEvents, repeatId) => {
            const sample = groupEvents[0];
            const repeatType = sample.repeatType;

            // Sắp xếp các sự kiện theo ngày bắt đầu để lấy kỳ đầu tiên (base) và kỳ mới nhất (last)
            groupEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            const baseEvt = groupEvents[0];
            const lastEvt = groupEvents[groupEvents.length - 1];

            const baseStart = new Date(baseEvt.start);
            const baseEnd = new Date(baseEvt.end);
            const lastStart = new Date(lastEvt.start);
            if (isNaN(baseStart.getTime()) || isNaN(baseEnd.getTime()) || isNaN(lastStart.getTime())) return;

            let curStart = new Date(lastStart);
            if (repeatType === 'daily') {
                curStart.setDate(curStart.getDate() + 1);
            } else if (repeatType === 'weekly') {
                curStart.setDate(curStart.getDate() + 7);
            } else if (repeatType === 'monthly') {
                curStart = addMonthsToDate(curStart, 1);
            } else if (repeatType === 'yearly') {
                curStart = addYearsToDate(curStart, 1);
            } else {
                return;
            }

            const repeatLimitEndMs = sample.repeatLimitEnd ? new Date(sample.repeatLimitEnd).getTime() : Infinity;
            const effectiveMaxEndMs = sample.isForever ? maxTimelineEndMs : Math.min(maxTimelineEndMs, repeatLimitEndMs);

            let newAdded = 0;
            // Quy tắc: Khi có đủ không gian hiển thị thêm sự kiện lặp lại nữa mới tạo ra
            while (newAdded < 100) {
                const curEnd = getOccurrenceEnd(curStart, repeatType, baseStart, baseEnd);
                if (curEnd.getTime() > effectiveMaxEndMs || curStart.getTime() > effectiveMaxEndMs) {
                    break;
                }
                const newEvt = {
                    id: 'evt_' + Date.now() + '_rep_' + Math.random().toString(36).substr(2, 6),
                    repeatId: repeatId,
                    repeatType: repeatType,
                    isForever: !!sample.isForever,
                    repeatLimitEnd: sample.repeatLimitEnd || '',
                    title: sample.title,
                    start: toDateTimeLocalString(curStart),
                    end: toDateTimeLocalString(curEnd),
                    color: sample.color,
                    imageUrl: sample.imageUrl || '',
                    rawImageUrl: baseEvt.rawImageUrl || sample.rawImageUrl || sample.imageUrl || '',
                    url: sample.url || '',
                    tag: sample.tag || '',
                    note: sample.note || ''
                };
                events.push(newEvt);
                hasNewEvents = true;
                newAdded++;

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
        });

        return hasNewEvents;
    }

    // Đọc danh sách sự kiện từ LocalStorage (chỉ lấy sự kiện do người dùng tự thêm theo tài khoản riêng)
    function loadEvents() {
        if (cachedEventsMemory) {
            return cachedEventsMemory;
        }

        let events = [];
        try {
            const storageKey = getTimelineStorageKey();
            let raw = localStorage.getItem(storageKey);
            const user = getCurrentUser();
            // Nếu người dùng đầu tiên đăng nhập chưa có sự kiện riêng, chuyển sự kiện có sẵn sang tài khoản này
            if (!raw && user && !localStorage.getItem('legacy_events_migrated')) {
                const legacy = localStorage.getItem('timeline_events_v8');
                if (legacy) {
                    raw = legacy;
                    localStorage.setItem(storageKey, legacy);
                    localStorage.setItem('legacy_events_migrated', '1');
                }
            }

            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Loại bỏ hoàn toàn các sự kiện mẫu (id bắt đầu bằng 'evt_sample_') để timeline hoàn toàn sạch
                    events = parsed.filter(e => {
                        if (e.id && String(e.id).startsWith('evt_sample_')) return false;
                        const s = new Date(e.start).getTime();
                        const end = new Date(e.end).getTime();
                        if (isNaN(s) || isNaN(end)) return false;
                        if (s >= endDate.getTime() || end <= startDate.getTime()) return false;
                        if (e.repeatId && end > endDate.getTime()) return false;
                        return true;
                    });
                }
            }
        } catch (e) {
            console.error('Lỗi khi đọc LocalStorage:', e);
        }

        // Tự động lưu lại danh sách đã dọn sạch mẫu vào LocalStorage và memory cache
        saveEvents(events);
        cachedEventsMemory = events;

        if (!events.length) {
            return [];
        }

        // Tự động kiểm tra và sửa lỗi ngày kết thúc cho các sự kiện lặp lại hàng tháng/năm
        const repairGroups = new Map();
        events.forEach(e => {
            if (e.repeatId && (e.repeatType === 'monthly' || e.repeatType === 'yearly')) {
                if (!repairGroups.has(e.repeatId)) {
                    repairGroups.set(e.repeatId, []);
                }
                repairGroups.get(e.repeatId).push(e);
            }
        });
        let hadRepairs = false;
        repairGroups.forEach(group => {
            if (group.length <= 1) return;
            group.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            const baseEvt = group[0];
            const baseStart = new Date(baseEvt.start);
            const baseEnd = new Date(baseEvt.end);
            const targetDurationDays = Math.round((baseEnd.getTime() - baseStart.getTime()) / MS_PER_DAY);

            group.forEach(evt => {
                const curS = new Date(evt.start);
                const curE = new Date(evt.end);
                const curDurationDays = Math.round((curE.getTime() - curS.getTime()) / MS_PER_DAY);
                if (curDurationDays !== targetDurationDays) {
                    const correctedEnd = getOccurrenceEnd(curS, evt.repeatType, baseStart, baseEnd);
                    const newEndStr = toDateTimeLocalString(correctedEnd);
                    if (evt.end !== newEndStr) {
                        evt.end = newEndStr;
                        hadRepairs = true;
                    }
                }
            });
        });

        if (hadRepairs) {
            saveEvents(events);
        }

        return events;
    }

    // Lưu danh sách sự kiện vào LocalStorage với cơ chế chống tràn bộ nhớ (QuotaExceededError)
    function saveEvents(events) {
        cachedEventsMemory = events;
        const storageKey = getTimelineStorageKey();
        try {
            localStorage.setItem(storageKey, JSON.stringify(events));
        } catch (e) {
            console.warn('Lỗi khi lưu LocalStorage (có thể do ảnh quá lớn), đang tối ưu dữ liệu...', e);
            try {
                // Tối ưu: Lược bỏ rawImageUrl trên các sự kiện để giảm 80% dung lượng
                const slimmed = events.map(evt => {
                    const c = { ...evt };
                    if (c.imageUrl && c.rawImageUrl && c.rawImageUrl.length > 50000) {
                        delete c.rawImageUrl;
                    }
                    return c;
                });
                localStorage.setItem(storageKey, JSON.stringify(slimmed));
                console.log('Đã lưu thành công danh sách sự kiện sau khi tối ưu dung lượng!');
            } catch (err2) {
                console.error('Không thể lưu vào LocalStorage do vượt hạn mức trình duyệt:', err2);
            }
        }
        // Tự động đẩy lên đám mây Firebase nếu đã kết nối
        if (typeof scheduleCloudPush === 'function') {
            scheduleCloudPush();
        }
    }

    // Tính toán chữ đếm ngược: nếu từ 1 ngày trở lên dạng xdyh (VD: 17d 20h, 1d 11h),
    // nếu dưới 1 ngày thì hiển thị dạng xx:xx:xx (VD: 08:22:18)
    function formatDuration(diffMs) {
        if (diffMs <= 0) return '';
        const diffDays = Math.floor(diffMs / MS_PER_DAY);
        if (diffDays > 0) {
            const diffHours = Math.floor((diffMs % MS_PER_DAY) / (3600 * 1000));
            return `${diffDays}d ${diffHours}h`;
        }
        const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }

    // Cập nhật chữ đếm ngược trên các nhãn sự kiện theo thời gian thực mỗi giây
    function updateTimelineCountdowns() {
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

    function formatDateTimeVn(isoStr) {
        try {
            const d = new Date(isoStr);
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        } catch {
            return isoStr;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Biến lưu ID sự kiện vừa tạo để tự động đưa hàng của sự kiện đó lên hàng đầu tiên (Hàng #1)
    let trackToHoistOnRender = null;

    // Vẽ toàn bộ các thanh sự kiện lên các hàng (Tracks)
    function renderEvents() {
        if (!timelineTracks) return;
        timelineTracks.innerHTML = '';

        const colWidth = getColWidth();
        if (!colWidth || colWidth <= 0) return;

        // Đảm bảo chiều rộng khu vực tracks bằng đúng toàn bộ các ngày
        timelineTracks.style.width = `${totalDays * colWidth}px`;

        const allEvents = loadEvents();
        updateFilterUI(allEvents);

        if (!allEvents.length) {
            currentTotalTracks = 0;
            currentLogicalTracks = [];
            currentTrackOrder = [];
            return;
        }

        // Áp dụng bộ lọc Tag: chỉ giữ lại sự kiện có cùng Tag, ẩn các sự kiện khác
        let events = allEvents;
        if (activeTagFilter) {
            const cleanFilter = activeTagFilter.trim().toLowerCase();
            events = allEvents.filter(e => (e.tag || '').trim().toLowerCase() === cleanFilter);
        }

        if (!events.length) {
            timelineTracks.innerHTML = `
                <div class="filter-empty-timeline-notice" style="position: absolute; left: 50%; top: 40px; transform: translateX(-50%); text-align: center; color: #cbd5e1; font-size: 13px; font-weight: 500; background: rgba(22, 28, 48, 0.9); padding: 14px 28px; border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.35); box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5); z-index: 20;">
                    Không tìm thấy sự kiện nào khớp với tag <strong style="color: #facc15;">#${escapeHtml(activeTagFilter)}</strong>
                </div>
            `;
            return;
        }

        // ========================================================
        // PHÂN PHỐI LÀN SỰ KIỆN THEO TAG & CHU KỲ (TAG & SERIES ALLOCATOR)
        // - Các sự kiện CÙNG TAG:
        //   + Nếu KHÁC mốc thời gian -> xếp NẰM TRÊN CÙNG 1 DÒNG
        //   + Nếu TRÙNG mốc thời gian -> xếp thành CÁC DÒNG LIỀN KỀ NHAU (cạnh nhau)
        // - Nhóm có Tag / nhiều kỳ được ưu tiên xếp trước, nếu sự kiện khác chen vào sẽ bị "đá" ra ngoài!
        // - Nếu không có Tag: tự động gom theo Tên (Title) để giữ các kỳ cùng tên trên cùng 1 dòng
        // ========================================================
        let maxTrack = 0;
        events.forEach(evt => {
            if (typeof evt.track === 'number' && evt.track > maxTrack) {
                maxTrack = evt.track;
            }
        });

        const assignedEvents = [];
        const trackOccupancy = []; // Mảng chứa danh sách các khoảng [{startMs, endMs}] trên từng track

        function ensureTracks(count) {
            while (trackOccupancy.length < count) {
                trackOccupancy.push([]);
            }
        }
        ensureTracks(maxTrack + 1);

        // Kiểm tra xem một danh sách sự kiện có vừa trên trackIndex hay không
        function canChainFitOnTrack(tIndex, eventsList) {
            if (!trackOccupancy[tIndex]) return true;
            for (const occ of trackOccupancy[tIndex]) {
                for (const evt of eventsList) {
                    if (Math.max(evt.startMs, occ.startMs) < Math.min(evt.endMs, occ.endMs)) {
                        return false;
                    }
                }
            }
            return true;
        }

        // Kiểm tra xem TOÀN BỘ CỤM các làn (lanes) có thể vừa vặn liên tiếp từ startTrack -> startTrack + lanes.length - 1 hay không
        function canGroupFitAt(startTrack, lanes) {
            ensureTracks(startTrack + lanes.length);
            for (let offset = 0; offset < lanes.length; offset++) {
                if (!canChainFitOnTrack(startTrack + offset, lanes[offset])) {
                    return false;
                }
            }
            return true;
        }

        // 1. Nhóm sự kiện:
        // - ƯU TIÊN HÀNG ĐẦU: Các sự kiện lặp lại (cùng repeatId hoặc chu kỳ) BẮT BUỘC gom vào cùng 1 nhóm
        //   để đảm bảo toàn bộ chuỗi luôn luôn nằm trên CÙNG MỘT HÀNG!
        // - Tiếp theo: Gom theo Tag nếu có
        // - Tiếp theo: Gom theo Tên (Title)
        // - Cuối cùng: Sự kiện đơn lẻ (Single)
        const groupsMap = {};
        events.forEach(evt => {
            const startMs = new Date(evt.start).getTime();
            const endMs = new Date(evt.end).getTime();
            const eCopy = { ...evt, startMs, endMs };

            const tag = (evt.tag || '').trim().toLowerCase();
            const title = (evt.title || '').trim().toLowerCase();
            const repeatId = evt.repeatId || (evt.repeatType && evt.repeatType !== 'none' ? `rep_${title || evt.id}` : '');
            const isRepeating = !!repeatId;

            let groupKey = '';
            let isTagGroup = false;

            if (repeatId) {
                // Sự kiện lặp lại: Gom toàn bộ chuỗi các lần lặp vào cùng 1 nhóm
                groupKey = `repeat:${repeatId}`;
            } else if (tag) {
                groupKey = `tag:${tag}`;
                isTagGroup = true;
            } else if (title) {
                groupKey = `title:${title}`;
            } else {
                groupKey = `single:${evt.id}`;
            }

            if (!groupsMap[groupKey]) {
                groupsMap[groupKey] = {
                    key: groupKey,
                    isTag: isTagGroup,
                    isRepeating: isRepeating,
                    events: []
                };
            }
            groupsMap[groupKey].events.push(eCopy);
        });

        // 2. Với mỗi nhóm, tách thành các làn (lanes) không đè giờ lên nhau
        const groupList = [];
        Object.keys(groupsMap).forEach(gKey => {
            const gData = groupsMap[gKey];
            const evts = gData.events;
            evts.sort((a, b) => a.startMs - b.startMs);

            const lanes = []; // Mỗi lane là 1 chuỗi sự kiện nối tiếp nhau không trùng giờ
            evts.forEach(evt => {
                let placed = false;
                for (const lane of lanes) {
                    const overlaps = lane.some(e =>
                        Math.max(evt.startMs, e.startMs) < Math.min(evt.endMs, e.endMs)
                    );
                    if (!overlaps) {
                        lane.push(evt);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    lanes.push([evt]);
                }
            });

            // Tìm preferredTrack nếu có trong nhóm
            let prefTrack = undefined;
            for (const lane of lanes) {
                for (const evt of lane) {
                    if (typeof evt.track === 'number') {
                        if (prefTrack === undefined || evt.track < prefTrack) {
                            prefTrack = evt.track;
                        }
                    }
                }
            }

            groupList.push({
                key: gKey,
                isTag: gData.isTag,
                isRepeating: gData.isRepeating,
                lanes: lanes,
                laneCount: lanes.length,
                totalCount: evts.length,
                preferredTrack: prefTrack,
                earliestStart: evts[0].startMs
            });
        });

        // 3. Sắp xếp thứ tự ưu tiên gán dòng:
        // - Nhóm có preferredTrack (cố định) được xếp theo preferredTrack
        // 3. Sắp xếp thứ tự gán dòng:
        // - Nhóm có preferredTrack (cố định) được xếp theo preferredTrack
        // - Nhóm có Tag được ưu tiên xếp trước để bảo lưu cụm dòng liền kề
        // - Sắp xếp tự nhiên theo mốc thời gian bắt đầu (earliestStart): Sự kiện lặp lại vẫn giữ trọn vẹn
        //   trên CÙNG MỘT HÀNG, nhưng không bị ép phải nhảy lên hàng trên cùng!
        groupList.sort((a, b) => {
            const aHasPref = typeof a.preferredTrack === 'number';
            const bHasPref = typeof b.preferredTrack === 'number';

            if (aHasPref && bHasPref) {
                if (a.preferredTrack !== b.preferredTrack) {
                    return a.preferredTrack - b.preferredTrack;
                }
                if (a.isTag !== b.isTag) return b.isTag ? 1 : -1;
                if (a.earliestStart !== b.earliestStart) return a.earliestStart - b.earliestStart;
                if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
            }

            if (aHasPref && !bHasPref) return -1;
            if (!aHasPref && bHasPref) return 1;

            // 1. Nhóm có Tag được ưu tiên hơn nhóm không có Tag (để gom dòng liên kết)
            if (a.isTag !== b.isTag) return b.isTag ? 1 : -1;

            // 2. Sắp xếp tự nhiên theo mốc thời gian bắt đầu của nhóm
            if (a.earliestStart !== b.earliestStart) {
                return a.earliestStart - b.earliestStart;
            }

            // 3. Nhóm nhiều sự kiện hơn ưu tiên hơn
            if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;

            return 0;
        });

        // 4. Phân bổ các làn của từng nhóm vào các dòng LIỀN KỀ NHAU (adjacent tracks)
        groupList.forEach(g => {
            const lanes = g.lanes;
            const numLanes = lanes.length;
            let assignedStartTrack = -1;

            // Ưu tiên 1: Đặt vào đúng preferredTrack nếu cả cụm numLanes dòng đều vừa
            if (typeof g.preferredTrack === 'number') {
                if (canGroupFitAt(g.preferredTrack, lanes)) {
                    assignedStartTrack = g.preferredTrack;
                }
            }

            // Ưu tiên 2: Tìm cụm numLanes dòng liền kề trống đầu tiên
            if (assignedStartTrack === -1) {
                const searchLimit = Math.max(trackOccupancy.length, maxTrack + 1);
                for (let t = 0; t < searchLimit; t++) {
                    if (canGroupFitAt(t, lanes)) {
                        assignedStartTrack = t;
                        break;
                    }
                }
            }

            // Ưu tiên 3: Mở thêm các dòng mới ở cuối nếu không cụm nào chứa vừa
            if (assignedStartTrack === -1) {
                assignedStartTrack = trackOccupancy.length;
            }

            ensureTracks(assignedStartTrack + numLanes);

            // Gán từng làn vào từng dòng liền kề: assignedStartTrack + offset
            lanes.forEach((lane, offset) => {
                const trackIdx = assignedStartTrack + offset;
                lane.forEach(evt => {
                    trackOccupancy[trackIdx].push({ startMs: evt.startMs, endMs: evt.endMs });
                    assignedEvents.push({ ...evt, allocatedTrackIndex: trackIdx });
                });
            });
        });

        // ========================================================
        // TỰ ĐỘNG DỒN HÀNG: Khi một hàng không có sự kiện, dồn các hàng ở dưới lên!
        // ========================================================
        const usedLogicalIndices = [...new Set(assignedEvents.map(e => e.allocatedTrackIndex))].sort((a, b) => a - b);
        const compactTrackMap = new Map();
        usedLogicalIndices.forEach((oldIdx, newIdx) => {
            compactTrackMap.set(oldIdx, newIdx);
        });

        assignedEvents.forEach(evt => {
            evt.allocatedTrackIndex = compactTrackMap.get(evt.allocatedTrackIndex);
        });

        const totalTracksCount = usedLogicalIndices.length;
        currentTotalTracks = totalTracksCount;

        // Lưu danh sách sự kiện trên từng hàng logic (0 -> totalTracksCount - 1)
        currentLogicalTracks = [];
        for (let i = 0; i < totalTracksCount; i++) {
            currentLogicalTracks.push({
                logicalIndex: i,
                events: assignedEvents.filter(e => e.allocatedTrackIndex === i).sort((a, b) => a.startMs - b.startMs)
            });
        }

        // Tải mảng thứ tự hiển thị (trackOrder[visualRow] = logicalTrackIndex)
        currentTrackOrder = loadTrackOrder(totalTracksCount);

        // Nếu vừa tạo sự kiện mới, tự động đưa hàng chứa sự kiện đó lên vị trí đầu tiên (Hàng #1) để người dùng thấy ngay
        if (trackToHoistOnRender) {
            const newlyCreated = assignedEvents.find(e => e.id === trackToHoistOnRender || e.repeatId === trackToHoistOnRender);
            if (newlyCreated && typeof newlyCreated.allocatedTrackIndex === 'number') {
                const targetIdx = newlyCreated.allocatedTrackIndex;
                currentTrackOrder = [targetIdx, ...currentTrackOrder.filter(idx => idx !== targetIdx)];
                saveTrackOrder(currentTrackOrder);
            }
            trackToHoistOnRender = null;
        }

        let visualCounter = 0;
        for (let t = 0; t < totalTracksCount; t++) {
            const logicalIdx = currentTrackOrder[t];
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
    function deleteEvent(id) {
        const events = loadEvents().filter(e => e.id !== id);
        saveEvents(events);
        renderEvents();
        updateTitleSuggestions();
        updateTagSuggestions();
    }

    // ========================================================
    // 6.5 QUẢN LÝ THỨ TỰ HÀNG & MODAL SẮP XẾP (Track Order & Reorder Manager)
    // ========================================================

    // Đọc thứ tự hàng tùy chỉnh từ LocalStorage
    function loadTrackOrder(totalTracks) {
        try {
            const raw = localStorage.getItem(getTrackOrderStorageKey());
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const valid = parsed.filter(idx => typeof idx === 'number' && idx >= 0 && idx < totalTracks);
                    const seen = new Set(valid);
                    for (let i = 0; i < totalTracks; i++) {
                        if (!seen.has(i)) valid.push(i);
                    }
                    return valid;
                }
            }
        } catch (e) {
            console.error('Lỗi khi đọc timeline_track_order:', e);
        }
        return Array.from({ length: totalTracks }, (_, i) => i);
    }

    // Lưu thứ tự hàng vào LocalStorage
    function saveTrackOrder(order) {
        try {
            localStorage.setItem(getTrackOrderStorageKey(), JSON.stringify(order));
        } catch (e) {
            console.error('Lỗi khi lưu timeline_track_order:', e);
        }

        if (typeof scheduleCloudPush === 'function') {
            scheduleCloudPush();
        }
    }

    // Hoán đổi vị trí của 2 hàng hiển thị (Swap track A và track B)
    function swapTracks(visualIdxA, visualIdxB) {
        if (visualIdxA === visualIdxB) return;
        const total = currentTotalTracks;
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
    function moveTrack(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        const total = currentTotalTracks;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= total || toIndex >= total) return;
        const order = loadTrackOrder(total);
        const [moved] = order.splice(fromIndex, 1);
        order.splice(toIndex, 0, moved);
        saveTrackOrder(order);
        renderEvents();
        renderTrackManager(toIndex);
    }

    // Khôi phục thứ tự hàng mặc định theo thuật toán sắp xếp thông minh
    function resetTrackOrder() {
        localStorage.removeItem(getTrackOrderStorageKey());
        renderEvents();
        renderTrackManager(0);
    }

    // Mở và hiển thị Modal Sắp Xếp Hàng
    function openReorderModal(preselectedVisualTrack = 0) {
        renderTrackManager(preselectedVisualTrack);
        if (!modalReorderTracks) return;
        modalReorderTracks.classList.add('is-active');
        modalReorderTracks.setAttribute('aria-hidden', 'false');
    }

    function closeReorderModal() {
        if (typeof isDraggingTrack !== 'undefined' && isDraggingTrack) onTrackMouseUp();
        if (!modalReorderTracks) return;
        modalReorderTracks.classList.remove('is-active');
        modalReorderTracks.setAttribute('aria-hidden', 'true');
    }

    // --- State & Xử lý Kéo thả hàng kèm Lăn chuột (Mouse Drag & Wheel Scroll) ---
    let isDraggingTrack = false;
    let dragFromVisualIdx = null;
    let currentTargetVisualIdx = null;
    let floatingDragCard = null;
    let dragOriginCard = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let lastDragPointerX = 0;
    let lastDragPointerY = 0;
    let trackAutoScrollRaf = null;
    let trackAutoScrollSpeed = 0;

    function updateDragTarget(x, y) {
        if (!trackListContainer || !isDraggingTrack) return;
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
            currentTargetVisualIdx = foundIdx;
        }

        cards.forEach(card => {
            const vIdx = parseInt(card.dataset.visualIdx, 10);
            if (vIdx === currentTargetVisualIdx && vIdx !== dragFromVisualIdx) {
                card.classList.add('drag-over');
            } else {
                card.classList.remove('drag-over');
            }
        });
    }

    function checkTrackAutoScroll(y) {
        if (!trackListContainer) return;
        const rect = trackListContainer.getBoundingClientRect();
        const threshold = 45;
        const maxSpeed = 12;

        if (y < rect.top + threshold && y > rect.top - 30) {
            const ratio = Math.max(0.2, (rect.top + threshold - y) / threshold);
            trackAutoScrollSpeed = -maxSpeed * ratio;
            startTrackAutoScroll();
        } else if (y > rect.bottom - threshold && y < rect.bottom + 30) {
            const ratio = Math.max(0.2, (y - (rect.bottom - threshold)) / threshold);
            trackAutoScrollSpeed = maxSpeed * ratio;
            startTrackAutoScroll();
        } else {
            stopTrackAutoScroll();
        }
    }

    function startTrackAutoScroll() {
        if (trackAutoScrollRaf) return;
        function step() {
            if (!isDraggingTrack || trackAutoScrollSpeed === 0 || !trackListContainer) {
                trackAutoScrollRaf = null;
                return;
            }
            trackListContainer.scrollTop += trackAutoScrollSpeed;
            updateDragTarget(lastDragPointerX, lastDragPointerY);
            trackAutoScrollRaf = requestAnimationFrame(step);
        }
        trackAutoScrollRaf = requestAnimationFrame(step);
    }

    function stopTrackAutoScroll() {
        if (trackAutoScrollRaf) {
            cancelAnimationFrame(trackAutoScrollRaf);
            trackAutoScrollRaf = null;
        }
        trackAutoScrollSpeed = 0;
    }

    function onTrackDragWheel(e) {
        if (!isDraggingTrack || !trackListContainer) return;
        // Cho phép vừa giữ chuột kéo hàng vừa lăn chuột cuộn mượt mà
        e.preventDefault();
        trackListContainer.scrollTop += e.deltaY;
        updateDragTarget(lastDragPointerX, lastDragPointerY);
    }

    function onTrackMouseMove(e) {
        if (!isDraggingTrack) return;
        lastDragPointerX = e.clientX;
        lastDragPointerY = e.clientY;

        if (floatingDragCard) {
            floatingDragCard.style.left = `${e.clientX - dragOffsetX}px`;
            floatingDragCard.style.top = `${e.clientY - dragOffsetY}px`;
        }

        checkTrackAutoScroll(e.clientY);
        updateDragTarget(e.clientX, e.clientY);
    }

    function onTrackMouseUp() {
        if (!isDraggingTrack) return;
        isDraggingTrack = false;

        stopTrackAutoScroll();

        window.removeEventListener('mousemove', onTrackMouseMove);
        window.removeEventListener('mouseup', onTrackMouseUp);
        window.removeEventListener('wheel', onTrackDragWheel);

        document.body.classList.remove('is-reordering-tracks');

        if (floatingDragCard && floatingDragCard.parentNode) {
            floatingDragCard.parentNode.removeChild(floatingDragCard);
        }
        floatingDragCard = null;

        if (dragOriginCard) {
            dragOriginCard.classList.remove('is-drag-origin');
            dragOriginCard = null;
        }

        document.querySelectorAll('.track-item-card').forEach(c => c.classList.remove('drag-over'));

        const fromIdx = dragFromVisualIdx;
        const toIdx = currentTargetVisualIdx;
        dragFromVisualIdx = null;
        currentTargetVisualIdx = null;

        if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
            moveTrack(fromIdx, toIdx);
        }
    }

    function startTrackCardDrag(e, card, visualIdx) {
        if (e.button !== 0) return;
        if (e.target.closest('.btn-track-move') || e.target.closest('button')) return;

        if (e.preventDefault) e.preventDefault();

        isDraggingTrack = true;
        dragFromVisualIdx = visualIdx;
        currentTargetVisualIdx = visualIdx;
        dragOriginCard = card;

        const rect = card.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        lastDragPointerX = e.clientX;
        lastDragPointerY = e.clientY;

        card.classList.add('is-drag-origin');
        document.body.classList.add('is-reordering-tracks');

        // Tạo thẻ lơ lửng clone theo chuột
        floatingDragCard = card.cloneNode(true);
        floatingDragCard.classList.remove('is-drag-origin');
        floatingDragCard.classList.add('is-floating-drag');
        floatingDragCard.style.width = `${rect.width}px`;
        floatingDragCard.style.height = `${rect.height}px`;
        floatingDragCard.style.left = `${rect.left}px`;
        floatingDragCard.style.top = `${rect.top}px`;
        document.body.appendChild(floatingDragCard);

        window.addEventListener('mousemove', onTrackMouseMove);
        window.addEventListener('mouseup', onTrackMouseUp);
        window.addEventListener('wheel', onTrackDragWheel, { passive: false });
    }

    window.addEventListener('touchmove', (e) => {
        if (!isDraggingTrack) return;
        const touch = e.touches[0];
        if (touch) {
            onTrackMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }, { passive: false });
    window.addEventListener('touchend', onTrackMouseUp);

    // Render giao diện quản lý sắp xếp trong modal
    function renderTrackManager(selectedVisualIndex = 0) {
        if (!modalReorderTracks) return;
        const total = currentTotalTracks;
        const order = currentTrackOrder.length === total ? currentTrackOrder : loadTrackOrder(total);

        // 1. Cập nhật 2 dropdown hoán đổi nhanh X và Y
        if (swapSelectX && swapSelectY) {
            swapSelectX.innerHTML = '';
            swapSelectY.innerHTML = '';

            for (let v = 0; v < total; v++) {
                const lIdx = order[v];
                const trackData = currentLogicalTracks[lIdx];
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
                const trackData = currentLogicalTracks[lIdx];
                const evts = (trackData && trackData.events) || [];

                const card = document.createElement('div');
                card.className = 'track-item-card';
                card.dataset.visualIdx = visualIdx;

                // Handle icon kéo thả
                const handle = document.createElement('div');
                handle.className = 'track-drag-handle';
                handle.title = 'Giữ chuột để di chuyển hàng (có thể vừa giữ vừa lăn chuột để cuộn)';
                handle.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
                btnUp.disabled = (visualIdx === 0);
                btnUp.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
                btnDown.disabled = (visualIdx === total - 1);
                btnDown.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

    // ========================================================
    // QUẢN LÝ BỘ LỌC THEO TAG (Tag Filter Manager)
    // ========================================================
    function toggleFilterDropdown() {
        if (!filterDropdownMenu) return;
        const isHidden = filterDropdownMenu.style.display === 'none';
        if (isHidden) {
            updateFilterDropdownList();
            filterDropdownMenu.style.display = 'block';
        } else {
            closeFilterDropdown();
        }
    }

    function closeFilterDropdown() {
        if (filterDropdownMenu) {
            filterDropdownMenu.style.display = 'none';
        }
    }

    function setTagFilter(tag) {
        if (!tag || (activeTagFilter && activeTagFilter.toLowerCase() === tag.trim().toLowerCase())) {
            activeTagFilter = null;
        } else {
            activeTagFilter = tag.trim();
        }
        closeFilterDropdown();
        renderEvents();
    }

    function updateFilterUI(allEventsList) {
        const events = allEventsList || loadEvents();

        if (activeTagFilter) {
            const cleanFilter = activeTagFilter.trim().toLowerCase();
            const matchingCount = events.filter(e => (e.tag || '').trim().toLowerCase() === cleanFilter).length;

            if (btnFilterTag) {
                btnFilterTag.classList.add('is-active');
                btnFilterTag.title = `Đang lọc: #${activeTagFilter} (Nhấp để đổi hoặc bỏ lọc)`;
            }
            if (btnFilterLabel) {
                btnFilterLabel.textContent = `#${activeTagFilter}`;
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
                activeFilterName.textContent = `#${activeTagFilter}`;
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

    function updateFilterDropdownList() {
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
        const isAllSelected = !activeTagFilter;
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
                const isSelected = activeTagFilter && activeTagFilter.toLowerCase() === k;
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

    // ========================================================
    // 7. BỘ CÔNG CỤ CẮT ẢNH & ĐIỀU KHIỂN MODAL (Image Cropper & Modals)
    // ========================================================

    // --- State bộ cắt ảnh ---
    let currentCropperImg = null;
    let originalImageSrc = ''; // Lưu ảnh gốc để cắt lại nếu muốn
    let isAutoSyncedImage = false; // Đánh dấu ảnh tự động đồng bộ theo chu kỳ
    let canvasDisplayWidth = 0;
    let canvasDisplayHeight = 0;
    let zoomLevel = 1.0;
    let cropRatioMode = 'banner'; // 'banner' (~3.6:1) hoặc 'free'
    let cropBoxRect = { x: 0, y: 0, width: 180, height: 50 };
    let isDraggingBox = false;
    let activeResizeHandle = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let startBoxRect = { x: 0, y: 0, width: 0, height: 0 };

    // 7.1 Mở / Đóng Modal Cắt Ảnh
    function openCropper(imageSrc) {
        originalImageSrc = imageSrc;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            currentCropperImg = img;
            zoomLevel = 1.0;
            if (cropZoomSlider) cropZoomSlider.value = '1';
            if (cropZoomValue) cropZoomValue.textContent = '100%';

            // Đồng bộ tên tiêu đề và màu xem trước mẫu
            const curTitle = inputTitle.value.trim() || 'Tên hoạt động';
            if (cropperSampleTitle) cropperSampleTitle.textContent = curTitle;
            const curColor = currentEventColor || '#d6aa7d';
            if (cropperSampleBar) cropperSampleBar.style.background = curColor;

            modalCropImage.classList.add('is-active');
            modalCropImage.setAttribute('aria-hidden', 'false');

            requestAnimationFrame(() => {
                initCropperCanvas();
            });
        };
        img.onerror = () => {
            alert('Không thể tải ảnh. Nếu dùng đường dẫn web, máy chủ ảnh có thể chặn truy cập (CORS). Bạn hãy tải ảnh về máy và chọn thẻ "Tải từ máy tính"!');
        };
        img.src = imageSrc;
    }

    function closeCropper() {
        if (!modalCropImage) return;
        modalCropImage.classList.remove('is-active');
        modalCropImage.setAttribute('aria-hidden', 'true');
        isDraggingBox = false;
        activeResizeHandle = null;
    }

    // 7.2 Khởi tạo Canvas & Khung cắt
    function initCropperCanvas() {
        if (!currentCropperImg || !cropperCanvas || !cropperWorkspaceWrapper) return;
        const wrapW = cropperWorkspaceWrapper.clientWidth || 560;
        const wrapH = cropperWorkspaceWrapper.clientHeight || 280;

        const imgW = currentCropperImg.naturalWidth;
        const imgH = currentCropperImg.naturalHeight;
        const scale = Math.min((wrapW - 24) / imgW, (wrapH - 24) / imgH, 1);

        const dw = Math.max(100, Math.round(imgW * scale));
        const dh = Math.max(60, Math.round(imgH * scale));
        canvasDisplayWidth = dw;
        canvasDisplayHeight = dh;

        cropperCanvas.width = dw;
        cropperCanvas.height = dh;
        cropperCanvas.style.width = `${dw}px`;
        cropperCanvas.style.height = `${dh}px`;

        drawCropperImage();

        // Đặt vị trí khung cắt ban đầu ở giữa canvas
        const canvasLeft = cropperCanvas.offsetLeft;
        const canvasTop = cropperCanvas.offsetTop;

        let initW = Math.min(dw * 0.75, 200);
        let initH = cropRatioMode === 'banner' ? initW / 3.6 : Math.min(dh * 0.75, 60);
        if (initH > dh * 0.85) {
            initH = dh * 0.85;
            if (cropRatioMode === 'banner') initW = initH * 3.6;
        }

        const initX = canvasLeft + (dw - initW) / 2;
        const initY = canvasTop + (dh - initH) / 2;

        cropBoxRect = {
            x: Math.round(initX),
            y: Math.round(initY),
            width: Math.round(initW),
            height: Math.round(initH)
        };

        updateCropBoxDom();
        updateLivePreview();
    }

    function drawCropperImage() {
        if (!currentCropperImg || !cropperCanvas) return;
        const ctx = cropperCanvas.getContext('2d');
        ctx.clearRect(0, 0, cropperCanvas.width, cropperCanvas.height);

        const dw = canvasDisplayWidth * zoomLevel;
        const dh = canvasDisplayHeight * zoomLevel;
        const dx = (canvasDisplayWidth - dw) / 2;
        const dy = (canvasDisplayHeight - dh) / 2;

        ctx.drawImage(currentCropperImg, dx, dy, dw, dh);
    }

    function updateCropBoxDom() {
        if (!cropBox) return;
        cropBox.style.left = `${cropBoxRect.x}px`;
        cropBox.style.top = `${cropBoxRect.y}px`;
        cropBox.style.width = `${cropBoxRect.width}px`;
        cropBox.style.height = `${cropBoxRect.height}px`;
    }

    // 7.3 Xem trước hình ảnh trực tiếp (Live Preview)
    function updateLivePreview() {
        if (!currentCropperImg || !cropperCanvas || !cropperSampleArt) return;
        const canvasLeft = cropperCanvas.offsetLeft;
        const canvasTop = cropperCanvas.offsetTop;

        const relX = cropBoxRect.x - canvasLeft;
        const relY = cropBoxRect.y - canvasTop;
        const relW = cropBoxRect.width;
        const relH = cropBoxRect.height;

        const dw = canvasDisplayWidth * zoomLevel;
        const dh = canvasDisplayHeight * zoomLevel;
        const dx = (canvasDisplayWidth - dw) / 2;
        const dy = (canvasDisplayHeight - dh) / 2;

        const origX = ((relX - dx) / dw) * currentCropperImg.naturalWidth;
        const origY = ((relY - dy) / dh) * currentCropperImg.naturalHeight;
        const origW = (relW / dw) * currentCropperImg.naturalWidth;
        const origH = (relH / dh) * currentCropperImg.naturalHeight;

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 180;
        previewCanvas.height = 50;
        const pCtx = previewCanvas.getContext('2d');

        try {
            pCtx.drawImage(
                currentCropperImg,
                Math.max(0, origX), Math.max(0, origY),
                Math.min(currentCropperImg.naturalWidth, origW),
                Math.min(currentCropperImg.naturalHeight, origH),
                0, 0, previewCanvas.width, previewCanvas.height
            );
            const dataUrl = previewCanvas.toDataURL('image/png');
            cropperSampleArt.style.backgroundImage = `url('${dataUrl}')`;

            // Tự động trích xuất màu nền: màu sáng, nổi bật và nhiều trong ảnh đã cắt
            const dominantColor = extractDominantLeftEdgeColor(previewCanvas);
            if (cropperSampleBar) {
                cropperSampleBar.style.background = dominantColor;
            }
            if (cropperSampleTitle) {
                const lum = getHexLuminance(dominantColor);
                cropperSampleTitle.style.color = lum > 60 ? '#111827' : '#ffffff';
            }
        } catch (e) {
            cropperSampleArt.style.backgroundImage = `url('${originalImageSrc}')`;
        }
    }

    // ========================================================
    // CHUYỂN ĐỔI KHÔNG GIAN MÀU RGB <-> HSL HỖ TRỢ PHÂN TÍCH MÀU SẮC
    // ========================================================
    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }
        return [h, s, l];
    }

    function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    // 7.4 Trích xuất màu nền cho ô sự kiện từ ảnh đã cắt
    // QUY ĐỊNH: Màu nền phải là MÀU SÁNG, NỔI BẬT (tươi tắn) và NHIỀU (chiếm đa số) trong ảnh sau khi cắt
    function extractDominantLeftEdgeColor(canvas) {
        try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            if (!w || !h) return '#d6aa7d';

            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;

            // Bảng gom nhóm màu theo 36 dải sắc độ Hue (10 độ mỗi dải màu)
            const buckets = {};

            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                if (a < 50) continue; // Bỏ qua pixel trong suốt

                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const [hue, sat, light] = rgbToHsl(r, g, b);

                // 1. LOẠI BỎ MÀU TỐI: Màu nền sự kiện bắt buộc là màu sáng (bỏ qua pixel tối/bóng đổ/đen)
                if (light < 0.35) continue;

                // 2. LOẠI BỎ MÀU XỈN HOẶC TRẮNG XÓA: Cần màu nổi bật, độ bão hòa (Saturation) phải tươi
                if (sat < 0.16) continue;
                if (light > 0.94) continue; // Bỏ qua màu trắng quá chói

                // Gom nhóm theo dải sắc độ (Hue)
                const hueKey = Math.floor(hue * 36) % 36;
                if (!buckets[hueKey]) {
                    buckets[hueKey] = {
                        count: 0,
                        rSum: 0,
                        gSum: 0,
                        bSum: 0,
                        hSum: 0,
                        sSum: 0,
                        lSum: 0
                    };
                }

                const bItem = buckets[hueKey];
                bItem.count++;
                bItem.rSum += r;
                bItem.gSum += g;
                bItem.bSum += b;
                bItem.hSum += hue;
                bItem.sSum += sat;
                bItem.lSum += light;
            }

            let bestBucket = null;
            let maxScore = -1;

            for (const key in buckets) {
                const bItem = buckets[key];
                if (bItem.count < 5) continue;

                const avgS = bItem.sSum / bItem.count;
                const avgL = bItem.lSum / bItem.count;

                // Tiêu chí 1 - NHIỀU: Số lượng pixel màu đó xuất hiện trong ảnh đã cắt (Frequency)
                const frequencyWeight = bItem.count;

                // Tiêu chí 2 - NỔI BẬT: Độ bão hòa màu càng cao thì càng tươi tắn, hút mắt
                const saturationScore = Math.pow(avgS, 1.35);

                // Tiêu chí 3 - MÀU SÁNG: Ưu tiên dải sáng lý tưởng (0.60 -> 0.85) để chữ đen đọc đẹp nhất
                let lightnessScore = 1.0;
                if (avgL < 0.45) {
                    lightnessScore = 0.3; // Quá tối
                } else if (avgL < 0.55) {
                    lightnessScore = 0.7;
                } else if (avgL >= 0.55 && avgL <= 0.85) {
                    lightnessScore = 1.3; // Dải sáng pastel đẹp nhất chuẩn Paimon.moe
                } else {
                    lightnessScore = 0.8; // Hơi nhạt
                }

                const totalScore = frequencyWeight * saturationScore * lightnessScore;

                if (totalScore > maxScore) {
                    maxScore = totalScore;
                    bestBucket = bItem;
                }
            }

            // Nếu tìm thấy nhóm màu sáng, nổi bật và xuất hiện nhiều:
            if (bestBucket && bestBucket.count > 0) {
                const avgH = bestBucket.hSum / bestBucket.count;
                const avgS = bestBucket.sSum / bestBucket.count;
                const avgL = bestBucket.lSum / bestBucket.count;

                // Quy định chuẩn hóa đảm bảo kết quả LUÔN là "MÀU SÁNG VÀ NỔI BẬT":
                // - Đảm bảo Lightness tối thiểu 0.68 và tối đa 0.82 (nền sáng tôn chữ đen đậm #111827)
                // - Đảm bảo Saturation tối thiểu 0.50 (tươi tắn) và tối đa 0.88 (không bị gắt)
                let targetL = avgL;
                if (targetL < 0.66) {
                    targetL = 0.70;
                } else if (targetL > 0.82) {
                    targetL = 0.80;
                }

                const targetS = Math.max(0.50, Math.min(0.88, avgS));

                const [r, g, b] = hslToRgb(avgH, targetS, targetL);
                const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            }

            // Phương án dự phòng: nếu ảnh không có màu tươi rực rỡ, lấy trung bình các pixel sáng
            let rTotal = 0, gTotal = 0, bTotal = 0, validPixels = 0;
            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                if (a < 50) continue;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const [, , l] = rgbToHsl(r, g, b);
                if (l >= 0.35) {
                    rTotal += r;
                    gTotal += g;
                    bTotal += b;
                    validPixels++;
                }
            }

            if (validPixels > 0) {
                const avgR = Math.round(rTotal / validPixels);
                const avgG = Math.round(gTotal / validPixels);
                const avgB = Math.round(bTotal / validPixels);
                const [h, s, l] = rgbToHsl(avgR, avgG, avgB);
                const targetL = Math.max(0.68, Math.min(0.82, l < 0.6 ? 0.70 : l));
                const targetS = Math.max(0.40, Math.min(0.75, s));
                const [fr, fg, fb] = hslToRgb(h, targetS, targetL);
                const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
                return `#${toHex(fr)}${toHex(fg)}${toHex(fb)}`;
            }

            return '#d6aa7d';
        } catch (e) {
            console.warn('Không thể trích xuất màu tự động (do CORS hoặc lỗi Canvas):', e);
            return '#d6aa7d';
        }
    }

    // 7.5 Áp dụng kết quả sau khi cắt
    function applyCroppedImage() {
        if (!currentCropperImg || !cropperCanvas) return;
        const canvasLeft = cropperCanvas.offsetLeft;
        const canvasTop = cropperCanvas.offsetTop;

        const relX = cropBoxRect.x - canvasLeft;
        const relY = cropBoxRect.y - canvasTop;
        const relW = cropBoxRect.width;
        const relH = cropBoxRect.height;

        const dw = canvasDisplayWidth * zoomLevel;
        const dh = canvasDisplayHeight * zoomLevel;
        const dx = (canvasDisplayWidth - dw) / 2;
        const dy = (canvasDisplayHeight - dh) / 2;

        const origX = ((relX - dx) / dw) * currentCropperImg.naturalWidth;
        const origY = ((relY - dy) / dh) * currentCropperImg.naturalHeight;
        const origW = (relW / dw) * currentCropperImg.naturalWidth;
        const origH = (relH / dh) * currentCropperImg.naturalHeight;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 180;
        finalCanvas.height = 50;
        const fCtx = finalCanvas.getContext('2d');

        try {
            fCtx.drawImage(
                currentCropperImg,
                Math.max(0, origX), Math.max(0, origY),
                Math.min(currentCropperImg.naturalWidth, origW),
                Math.min(currentCropperImg.naturalHeight, origH),
                0, 0, finalCanvas.width, finalCanvas.height
            );
            const croppedUrl = finalCanvas.toDataURL('image/png');
            const dominantColor = extractDominantLeftEdgeColor(finalCanvas);
            setCroppedResult(croppedUrl, dominantColor);
            closeCropper();
        } catch (e) {
            console.warn('CORS tainted canvas, using direct URL fallback');
            setCroppedResult(originalImageSrc, '#d6aa7d');
            closeCropper();
        }
    }

    function setCroppedResult(dataUrl, dominantColor) {
        if (eventImageData) eventImageData.value = dataUrl;
        if (previewBarArt) previewBarArt.style.backgroundImage = `url('${dataUrl}')`;
        if (previewBarTitle) previewBarTitle.textContent = inputTitle.value.trim() || 'Tên hoạt động';

        // Tự động đồng bộ màu chủ đạo từ mép trái ảnh vào ô xem trước
        let chosenColor = dominantColor || currentEventColor || '#d6aa7d';
        currentEventColor = chosenColor;

        if (eventBarPreviewBox) {
            eventBarPreviewBox.style.background = chosenColor;
            const lum = getHexLuminance(chosenColor);
            if (previewBarTitle) previewBarTitle.style.color = lum > 60 ? '#111827' : '#ffffff';
        }

        if (imageCropPreviewWrapper) imageCropPreviewWrapper.style.display = 'flex';
        if (tabContentFile) tabContentFile.style.display = 'none';
        if (tabContentUrl) tabContentUrl.style.display = 'none';
    }

    function removeCroppedImage() {
        if (eventImageData) eventImageData.value = '';
        originalImageSrc = '';
        if (imageCropPreviewWrapper) imageCropPreviewWrapper.style.display = 'none';
        if (eventImageFile) eventImageFile.value = '';
        if (eventImageUrl) eventImageUrl.value = '';

        // Khôi phục lại màu chuẩn mặc định khi xóa ảnh
        currentEventColor = '#d6aa7d';
        if (eventBarPreviewBox) {
            eventBarPreviewBox.style.background = '#d6aa7d';
            if (previewBarTitle) previewBarTitle.style.color = '#111827';
        }

        if (tabBtnFile && tabBtnFile.classList.contains('is-active')) {
            if (tabContentFile) tabContentFile.style.display = 'block';
        } else {
            if (tabContentUrl) tabContentUrl.style.display = 'block';
        }
    }

    // 7.5 Tương tác Kéo & Thay đổi kích thước khung cắt (Drag & Resize)
    if (cropBox) {
        cropBox.addEventListener('mousedown', (e) => {
            const handle = e.target.closest('.crop-handle');
            if (handle) {
                activeResizeHandle = handle.dataset.handle;
            } else {
                isDraggingBox = true;
            }
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            startBoxRect = { ...cropBoxRect };
            e.preventDefault();
        });

        // Hỗ trợ cảm ứng (Touch)
        cropBox.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            const handle = e.target.closest('.crop-handle');
            if (handle) {
                activeResizeHandle = handle.dataset.handle;
            } else {
                isDraggingBox = true;
            }
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            startBoxRect = { ...cropBoxRect };
            e.preventDefault();
        }, { passive: false });
    }

    window.addEventListener('mousemove', (e) => {
        handlePointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && (isDraggingBox || activeResizeHandle)) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault();
        }
    }, { passive: false });

    function handlePointerMove(clientX, clientY) {
        if (!isDraggingBox && !activeResizeHandle) return;
        if (!cropperCanvas) return;

        const canvasLeft = cropperCanvas.offsetLeft;
        const canvasTop = cropperCanvas.offsetTop;
        const minX = canvasLeft;
        const minY = canvasTop;
        const maxX = canvasLeft + canvasDisplayWidth;
        const maxY = canvasTop + canvasDisplayHeight;

        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;

        if (isDraggingBox) {
            let nextX = startBoxRect.x + dx;
            let nextY = startBoxRect.y + dy;

            nextX = Math.max(minX, Math.min(nextX, maxX - startBoxRect.width));
            nextY = Math.max(minY, Math.min(nextY, maxY - startBoxRect.height));

            cropBoxRect.x = Math.round(nextX);
            cropBoxRect.y = Math.round(nextY);
        } else if (activeResizeHandle) {
            let { x, y, width, height } = startBoxRect;
            const minSize = 25;

            if (cropRatioMode === 'banner') {
                const ratio = 3.6;
                if (activeResizeHandle === 'se' || activeResizeHandle === 'e' || activeResizeHandle === 's') {
                    let nw = Math.max(minSize * ratio, width + dx);
                    let nh = nw / ratio;
                    if (x + nw > maxX) { nw = maxX - x; nh = nw / ratio; }
                    if (y + nh > maxY) { nh = maxY - y; nw = nh * ratio; }
                    width = nw;
                    height = nh;
                } else if (activeResizeHandle === 'nw' || activeResizeHandle === 'w' || activeResizeHandle === 'n') {
                    let nw = Math.max(minSize * ratio, width - dx);
                    let nh = nw / ratio;
                    let nx = x + (width - nw);
                    let ny = y + (height - nh);
                    if (nx < minX) { nx = minX; nw = x + width - nx; nh = nw / ratio; ny = y + height - nh; }
                    if (ny < minY) { ny = minY; nh = y + height - ny; nw = nh * ratio; nx = x + width - nw; }
                    x = nx; y = ny; width = nw; height = nh;
                } else if (activeResizeHandle === 'ne') {
                    let nw = Math.max(minSize * ratio, width + dx);
                    let nh = nw / ratio;
                    let ny = y + (height - nh);
                    if (x + nw > maxX) { nw = maxX - x; nh = nw / ratio; ny = y + height - nh; }
                    if (ny < minY) { ny = minY; nh = y + height - ny; nw = nh * ratio; }
                    y = ny; width = nw; height = nh;
                } else if (activeResizeHandle === 'sw') {
                    let nw = Math.max(minSize * ratio, width - dx);
                    let nh = nw / ratio;
                    let nx = x + (width - nw);
                    if (nx < minX) { nx = minX; nw = x + width - nx; nh = nw / ratio; }
                    if (y + nh > maxY) { nh = maxY - y; nw = nh * ratio; nx = x + width - nw; }
                    x = nx; width = nw; height = nh;
                }
            } else {
                // Chế độ tự do (Freeform)
                if (activeResizeHandle.includes('e')) width = Math.max(minSize, Math.min(width + dx, maxX - x));
                if (activeResizeHandle.includes('s')) height = Math.max(minSize, Math.min(height + dy, maxY - y));
                if (activeResizeHandle.includes('w')) {
                    const nx = Math.max(minX, Math.min(x + dx, x + width - minSize));
                    width += (x - nx);
                    x = nx;
                }
                if (activeResizeHandle.includes('n')) {
                    const ny = Math.max(minY, Math.min(y + dy, y + height - minSize));
                    height += (y - ny);
                    y = ny;
                }
            }

            cropBoxRect = {
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(width),
                height: Math.round(height)
            };
        }

        updateCropBoxDom();
        updateLivePreview();
    }

    window.addEventListener('mouseup', () => {
        isDraggingBox = false;
        activeResizeHandle = null;
    });

    window.addEventListener('touchend', () => {
        isDraggingBox = false;
        activeResizeHandle = null;
    });

    // 7.6 Thanh trượt Thu phóng & Lăn chuột
    if (cropZoomSlider) {
        cropZoomSlider.addEventListener('input', (e) => {
            zoomLevel = parseFloat(e.target.value);
            if (cropZoomValue) cropZoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
            drawCropperImage();
            updateLivePreview();
        });
    }

    if (cropperWorkspaceWrapper) {
        cropperWorkspaceWrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            zoomLevel = Math.max(0.5, Math.min(3.0, zoomLevel + delta));
            if (cropZoomSlider) cropZoomSlider.value = zoomLevel.toFixed(2);
            if (cropZoomValue) cropZoomValue.textContent = `${Math.round(zoomLevel * 100)}%`;
            drawCropperImage();
            updateLivePreview();
        }, { passive: false });
    }

    // 7.7 Nút chuyển tỉ lệ cắt ảnh (Banner vs Free)
    if (btnRatioBanner) {
        btnRatioBanner.addEventListener('click', () => {
            cropRatioMode = 'banner';
            btnRatioBanner.classList.add('is-active');
            if (btnRatioFree) btnRatioFree.classList.remove('is-active');

            const newHeight = cropBoxRect.width / 3.6;
            cropBoxRect.height = Math.round(newHeight);
            updateCropBoxDom();
            updateLivePreview();
        });
    }

    if (btnRatioFree) {
        btnRatioFree.addEventListener('click', () => {
            cropRatioMode = 'free';
            btnRatioFree.classList.add('is-active');
            if (btnRatioBanner) btnRatioBanner.classList.remove('is-active');
        });
    }

    // 7.8 Xử lý nút bấm trong Modal Cắt Ảnh
    if (btnApplyCrop) btnApplyCrop.addEventListener('click', applyCroppedImage);
    if (btnCancelCrop) btnCancelCrop.addEventListener('click', closeCropper);
    if (btnCloseCropModal) btnCloseCropModal.addEventListener('click', closeCropper);
    if (modalCropImage) {
        modalCropImage.addEventListener('click', (e) => {
            if (e.target === modalCropImage) closeCropper();
        });
    }

    // 7.9 Xử lý Tải ảnh: File máy tính, URL, Kéo thả & Dán ảnh (Ctrl+V)
    if (tabBtnFile && tabBtnUrl) {
        tabBtnFile.addEventListener('click', () => {
            tabBtnFile.classList.add('is-active');
            tabBtnUrl.classList.remove('is-active');
            if (tabContentFile) tabContentFile.style.display = 'block';
            if (tabContentUrl) tabContentUrl.style.display = 'none';
        });

        tabBtnUrl.addEventListener('click', () => {
            tabBtnUrl.classList.add('is-active');
            tabBtnFile.classList.remove('is-active');
            if (tabContentUrl) tabContentUrl.style.display = 'block';
            if (tabContentFile) tabContentFile.style.display = 'none';
        });
    }

    // Xử lý chọn file ảnh từ máy tính
    if (eventImageFile) {
        eventImageFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    openCropper(evt.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Hỗ trợ Kéo thả file ảnh vào dropzone
    if (fileDropzone) {
        fileDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileDropzone.classList.add('is-dragover');
        });
        fileDropzone.addEventListener('dragleave', () => {
            fileDropzone.classList.remove('is-dragover');
        });
        fileDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            fileDropzone.classList.remove('is-dragover');
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    openCropper(evt.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Trạng thái Chế độ đọc thông tin (AI Reading Mode) trong ô Ảnh minh họa sự kiện
    let isAiReadingMode = false;

    function setAiReadingMode(active) {
        isAiReadingMode = !!active;
        const btnToggleAiMode = document.getElementById('btn-toggle-ai-mode');
        const aiBtnText = document.getElementById('ai-btn-text');
        const btnAiSettingsGear = document.getElementById('btn-ai-settings-gear');
        const imageNormalMode = document.getElementById('image-normal-mode');
        const imageAiMode = document.getElementById('image-ai-mode');
        const aiScanningOverlay = document.getElementById('ai-scanning-overlay');

        // Luôn tắt lớp phủ loading khi chuyển chế độ, tuyệt đối không tự ý phân tích ảnh
        if (aiScanningOverlay) {
            aiScanningOverlay.classList.remove('is-active');
            aiScanningOverlay.style.display = 'none';
        }

        if (isAiReadingMode) {
            if (btnToggleAiMode) {
                btnToggleAiMode.classList.add('is-ai-active');
                btnToggleAiMode.classList.add('is-active');
            }
            if (aiBtnText) aiBtnText.textContent = 'Quay lại ảnh minh họa';
            if (btnAiSettingsGear) btnAiSettingsGear.style.display = 'inline-flex';
            if (imageNormalMode) imageNormalMode.style.display = 'none';
            if (imageAiMode) imageAiMode.style.display = 'flex';
        } else {
            if (btnToggleAiMode) {
                btnToggleAiMode.classList.remove('is-ai-active');
                btnToggleAiMode.classList.remove('is-active');
            }
            if (aiBtnText) aiBtnText.textContent = 'Chế độ đọc thông tin';
            if (btnAiSettingsGear) btnAiSettingsGear.style.display = 'none';
            if (imageNormalMode) imageNormalMode.style.display = 'block';
            if (imageAiMode) imageAiMode.style.display = 'none';
        }
    }

    // Hỗ trợ dán ảnh từ Clipboard (Ctrl+V):
    // - Khi ở chế độ thường: dán ảnh để cắt làm banner sự kiện
    // - Khi ở "Chế độ đọc thông tin" (AI): dán ảnh màn hình để AI tự quét và điền thông tin sự kiện
    window.addEventListener('paste', (e) => {
        if (!modalAddEvent || !modalAddEvent.classList.contains('is-active')) return;
        if (modalCropImage && modalCropImage.classList.contains('is-active')) return;
        if (typeof modalAiConfig !== 'undefined' && modalAiConfig && modalAiConfig.classList.contains('is-active')) return;

        const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type && items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (!file) continue;

                e.preventDefault();

                if (isAiReadingMode) {
                    // Chế độ đọc thông tin: gửi ảnh sang Gemini AI
                    if (typeof processAiScanFile === 'function') {
                        processAiScanFile(file);
                    }
                } else {
                    // Chế độ thường: nạp ảnh vào bộ cắt ảnh minh họa
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        openCropper(evt.target.result);
                    };
                    reader.readAsDataURL(file);
                }
                break;
            }
        }
    });


    // Tải ảnh từ URL
    if (btnLoadUrl && eventImageUrl) {
        btnLoadUrl.addEventListener('click', () => {
            const url = eventImageUrl.value.trim();
            if (!url) {
                alert('Vui lòng nhập đường dẫn ảnh hợp lệ!');
                return;
            }
            openCropper(url);
        });

        eventImageUrl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnLoadUrl.click();
            }
        });
    }

    // Các nút thao tác với ảnh đã cắt
    if (btnRecrop) {
        btnRecrop.addEventListener('click', () => {
            if (originalImageSrc) {
                openCropper(originalImageSrc);
            }
        });
    }

    if (btnRemoveArt) {
        btnRemoveArt.addEventListener('click', removeCroppedImage);
    }

    // ========================================================
    // TỰ ĐỘNG ĐỒNG BỘ CHU KỲ THEO TÊN & QUẢN LÝ TAG
    // ========================================================
    function updateTitleSuggestions() {
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

    function updateTagSuggestions() {
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

    function checkTitleSync() {
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
            if (!eventImageData.value || isAutoSyncedImage) {
                const imgToUse = matched.imageUrl || matched.rawImageUrl;
                if (imgToUse) {
                    originalImageSrc = matched.rawImageUrl || matched.imageUrl;
                    isAutoSyncedImage = true;
                    setCroppedResult(imgToUse, matched.color || '#d6aa7d');
                }
            }

            // Tự động sao chép màu sắc
            if (matched.color) {
                currentEventColor = matched.color;
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

    // ========================================================
    // 7.9B TÍNH NĂNG LẶP LẠI SỰ KIỆN (Recurring Event Engine)
    // Hỗ trợ: mỗi ngày / mỗi tuần / mỗi tháng / mỗi năm
    // Thời gian lặp từ: xx/xx/xxxx - xx/xx/xxxx
    // ========================================================
    function toDateInputVal(d) {
        if (!d || isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function toDateTimeInputVal(d) {
        if (!d || isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function parseLocalDateString(dateStr) {
        if (!dateStr) return null;
        dateStr = String(dateStr).trim();
        // Hỗ trợ cả dấu gạch chéo '/' và dấu gạch ngang '-'
        const sep = dateStr.includes('/') ? '/' : (dateStr.includes('-') ? '-' : null);
        if (sep) {
            const rawParts = dateStr.split(sep).map(p => parseInt(p, 10));
            if (rawParts.length === 3 && !rawParts.some(isNaN)) {
                // Định dạng YYYY-MM-DD hoặc YYYY/MM/DD (phần đầu có 4 chữ số)
                if (rawParts[0] > 999) {
                    return new Date(rawParts[0], rawParts[1] - 1, rawParts[2]);
                }
                // Định dạng DD-MM-YYYY hoặc DD/MM/YYYY (phần cuối có 4 chữ số)
                if (rawParts[2] > 999) {
                    return new Date(rawParts[2], rawParts[1] - 1, rawParts[0]);
                }
            }
        }
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    function addMonthsToDate(date, months) {
        const d = new Date(date);
        const originalDay = d.getDate();
        d.setMonth(d.getMonth() + months);
        if (d.getDate() !== originalDay) {
            d.setDate(0); // Về ngày cuối cùng của tháng nếu tháng mục tiêu có ít ngày hơn
        }
        return d;
    }

    function addYearsToDate(date, years) {
        const d = new Date(date);
        const originalDay = d.getDate();
        d.setFullYear(d.getFullYear() + years);
        if (d.getDate() !== originalDay) {
            d.setDate(0);
        }
        return d;
    }

    // Chuyển Date object sang định dạng chuỗi YYYY-MM-DDTHH:mm theo giờ địa phương
    function toDateTimeLocalString(d) {
        if (!d || isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // Tính mốc kết thúc chính xác theo lịch cho từng chu kỳ lặp lại (đặc biệt là theo tháng/năm)
    // Tránh việc tháng 31 ngày làm hụt mất 1 ngày (VD: rơi vào ngày 15 thay vì ngày 16)
    function getOccurrenceEnd(curStart, repeatType, baseStartDate, baseEndDate) {
        if (!baseStartDate || !baseEndDate || isNaN(baseStartDate.getTime()) || isNaN(baseEndDate.getTime())) {
            return new Date(curStart.getTime() + 24 * 3600000);
        }

        if (repeatType === 'monthly') {
            const monthSpan = (baseEndDate.getFullYear() - baseStartDate.getFullYear()) * 12 + (baseEndDate.getMonth() - baseStartDate.getMonth());
            const endMonthDate = addMonthsToDate(curStart, monthSpan);
            const targetEndDay = baseEndDate.getDate();
            const targetEndHour = baseEndDate.getHours();
            const targetEndMin = baseEndDate.getMinutes();
            const targetEndSec = baseEndDate.getSeconds() || 0;

            let curEnd = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth(), targetEndDay, targetEndHour, targetEndMin, targetEndSec);
            // Nếu tháng mục tiêu có ít ngày hơn targetEndDay (VD tháng 2 có 28 ngày):
            if (curEnd.getMonth() !== ((endMonthDate.getMonth() + 12) % 12)) {
                curEnd = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() + 1, 0, targetEndHour, targetEndMin, targetEndSec);
            }
            if (curEnd.getTime() > curStart.getTime()) {
                return curEnd;
            }
        } else if (repeatType === 'yearly') {
            const yearSpan = baseEndDate.getFullYear() - baseStartDate.getFullYear();
            const endYearDate = addYearsToDate(curStart, yearSpan);
            const targetEndMonth = baseEndDate.getMonth();
            const targetEndDay = baseEndDate.getDate();
            const targetEndHour = baseEndDate.getHours();
            const targetEndMin = baseEndDate.getMinutes();
            const targetEndSec = baseEndDate.getSeconds() || 0;

            let curEnd = new Date(endYearDate.getFullYear(), targetEndMonth, targetEndDay, targetEndHour, targetEndMin, targetEndSec);
            if (curEnd.getMonth() !== targetEndMonth) {
                curEnd = new Date(endYearDate.getFullYear(), targetEndMonth + 1, 0, targetEndHour, targetEndMin, targetEndSec);
            }
            if (curEnd.getTime() > curStart.getTime()) {
                return curEnd;
            }
        }

        // Với chu kỳ hàng ngày hoặc hàng tuần: cộng theo chênh lệch thời gian thực
        const durationMs = baseEndDate.getTime() - baseStartDate.getTime();
        return new Date(curStart.getTime() + Math.max(3600000, durationMs));
    }

    function calculateRepeatCount(repeatType, startValStr, endValStr, isForever = false) {
        if (!repeatType || repeatType === 'none') return 1;
        if (!startValStr) return 0;

        const dStart = parseLocalDateString(startValStr);
        if (!dStart) return 0;

        const maxTimelineEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

        let limitEnd;
        if (isForever) {
            // Vĩnh viễn: Chỉ tạo tối đa trong phạm vi hiển thị của timeline (không vượt rìa phải)
            limitEnd = maxTimelineEnd;
        } else {
            if (!endValStr) return 0;
            const dEnd = parseLocalDateString(endValStr);
            if (!dEnd) return 0;
            limitEnd = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate(), 23, 59, 59, 999);
            if (limitEnd.getTime() < dStart.getTime()) return -1;
            // Không vượt quá rìa hiển thị của timeline
            if (limitEnd.getTime() > maxTimelineEnd.getTime()) {
                limitEnd = maxTimelineEnd;
            }
        }

        // Ước lượng thời lượng (duration) của sự kiện
        let estDurationMs = 24 * 3600000;
        let baseStartDate = null;
        let baseEndDate = null;
        if (inputStart && inputEnd && inputStart.value && inputEnd.value) {
            const s = new Date(inputStart.value);
            const e = new Date(inputEnd.value);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e.getTime() > s.getTime()) {
                baseStartDate = s;
                baseEndDate = e;
                estDurationMs = e.getTime() - s.getTime();
                if (repeatType === 'daily' && estDurationMs > 24 * 3600000 && inputEnd.dataset.userModified !== 'true') {
                    estDurationMs = 24 * 3600000;
                } else if (repeatType === 'weekly' && estDurationMs > 7 * 24 * 3600000 && inputEnd.dataset.userModified !== 'true') {
                    estDurationMs = 7 * 24 * 3600000;
                }
            }
        }

        let cur = new Date(dStart);
        let count = 0;
        const maxOccurrences = 200;

        while (cur.getTime() <= limitEnd.getTime() && count < maxOccurrences) {
            const occEnd = (baseStartDate && baseEndDate)
                ? getOccurrenceEnd(cur, repeatType, baseStartDate, baseEndDate)
                : new Date(cur.getTime() + estDurationMs);

            // Quy tắc: Khi có đủ không gian hiển thị thêm sự kiện lặp lại nữa mới tạo ra
            if (count > 0 && (occEnd.getTime() > limitEnd.getTime())) {
                break;
            }
            if (cur.getTime() >= limitEnd.getTime()) {
                break;
            }
            count++;
            if (repeatType === 'daily') {
                cur.setDate(cur.getDate() + 1);
            } else if (repeatType === 'weekly') {
                cur.setDate(cur.getDate() + 7);
            } else if (repeatType === 'monthly') {
                cur = addMonthsToDate(cur, 1);
            } else if (repeatType === 'yearly') {
                cur = addYearsToDate(cur, 1);
            } else {
                break;
            }
        }
        return count;
    }

    function updateRepeatStatusHint() {
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

        const count = calculateRepeatCount(type, startVal, endVal, isForever);
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
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
    function openModal() {
        if (!modalAddEvent) return;
        modalAddEvent.classList.add('is-active');
        modalAddEvent.setAttribute('aria-hidden', 'false');

        // Luôn mặc định mở ở Chế độ ảnh minh họa thường (không tự kích hoạt AI)
        pendingScanFile = null;
        setAiReadingMode(false);

        updateTitleSuggestions();
        updateTagSuggestions();
        if (inputTag) inputTag.value = '';
        if (inputNote) inputNote.value = '';
        document.querySelectorAll('.btn-quick-tag').forEach(b => b.classList.remove('is-selected'));

        currentEventColor = '#d6aa7d';
        if (eventBarPreviewBox) eventBarPreviewBox.style.background = '#d6aa7d';

        isAutoSyncedImage = false;
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

    function closeModal() {
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
        isAutoSyncedImage = false;
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
        pendingScanFile = null;
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

    // ========================================================
    // 7.12 MODAL CHI TIẾT SỰ KIỆN (Event Detail Modal)
    // ========================================================
    let currentDetailEvent = null;
    let detailCountdownTimer = null;

    function formatDetailDateTime(date) {
        if (!date || isNaN(date.getTime())) return '';
        const dayName = WEEKDAYS_VN[date.getDay()];
        const day = date.getDate();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${dayName}, ${day} Th${month} ${year} ${hours}:${minutes}`;
    }

    function formatDetailDateRange(startDate, endDate) {
        const startStr = formatDetailDateTime(startDate);
        const endStr = formatDetailDateTime(endDate);
        if (!endStr) return startStr;
        return `${startStr} - ${endStr}`;
    }

    function updateDetailCountdown(evt) {
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

    function openEventDetail(evt) {
        if (!modalEventDetail || !evt) return;
        currentDetailEvent = evt;

        // 1. Ảnh chưa cắt (Ưu tiên rawImageUrl nếu có, sau đó tìm từ chuỗi lặp lại hoặc sự kiện cùng tên)
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
            if (!bannerImgSrc && evt.title && (evt.title.trim().toLowerCase().includes('la hoàn') || evt.title.trim().toLowerCase().includes('spiral abyss'))) {
                bannerImgSrc = 'https://paimon.moe/images/events/spiral_abyss.jpg';
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
        if (detailCountdownTimer) clearInterval(detailCountdownTimer);
        detailCountdownTimer = setInterval(() => {
            if (currentDetailEvent) updateDetailCountdown(currentDetailEvent);
        }, 1000);

        modalEventDetail.classList.add('is-active');
        modalEventDetail.setAttribute('aria-hidden', 'false');
    }

    function closeEventDetail() {
        if (!modalEventDetail) return;
        modalEventDetail.classList.remove('is-active');
        modalEventDetail.setAttribute('aria-hidden', 'true');
        if (detailCountdownTimer) {
            clearInterval(detailCountdownTimer);
            detailCountdownTimer = null;
        }
        currentDetailEvent = null;
    }

    // Modal Xóa / Dừng Hoạt Động Lặp Lại
    let pendingRepeatEventToDelete = null;

    function openDeleteRepeatModal(evt) {
        pendingRepeatEventToDelete = evt;
        if (!modalDeleteRepeat) return;
        if (deleteRepeatSubtitle) {
            deleteRepeatSubtitle.textContent = `Hoạt động "${evt.title || 'này'}" thuộc một chuỗi lặp lại. Bạn muốn xóa như thế nào?`;
        }
        modalDeleteRepeat.classList.add('is-active');
        modalDeleteRepeat.setAttribute('aria-hidden', 'false');
    }

    function closeDeleteRepeatModal() {
        if (!modalDeleteRepeat) return;
        modalDeleteRepeat.classList.remove('is-active');
        modalDeleteRepeat.setAttribute('aria-hidden', 'true');
        pendingRepeatEventToDelete = null;
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
            if (!pendingRepeatEventToDelete) return;
            const idToDelete = pendingRepeatEventToDelete.id;
            closeDeleteRepeatModal();
            deleteEvent(idToDelete);
        });
    }

    // 2. Dừng lặp lại từ kỳ này trở đi
    if (btnDeleteFromHere) {
        btnDeleteFromHere.addEventListener('click', () => {
            if (!pendingRepeatEventToDelete) return;
            const repId = pendingRepeatEventToDelete.repeatId;
            const curStartMs = new Date(pendingRepeatEventToDelete.start).getTime();

            let events = loadEvents();
            // Xóa sự kiện này và tất cả các sự kiện tương lai trong chuỗi lặp
            events = events.filter(e => {
                if (e.repeatId === repId && new Date(e.start).getTime() >= curStartMs) {
                    return false;
                }
                return true;
            });
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
        });
    }

    // 3. Xóa tất cả các lần lặp
    if (btnDeleteAllRepeat) {
        btnDeleteAllRepeat.addEventListener('click', () => {
            if (!pendingRepeatEventToDelete) return;
            const repId = pendingRepeatEventToDelete.repeatId;
            let events = loadEvents().filter(e => e.repeatId !== repId);
            saveEvents(events);
            closeDeleteRepeatModal();
            renderEvents();
            updateTitleSuggestions();
            updateTagSuggestions();
        });
    }

    if (btnCloseEventDetail) btnCloseEventDetail.addEventListener('click', closeEventDetail);
    if (btnDeleteDetailEvent) {
        btnDeleteDetailEvent.addEventListener('click', () => {
            if (!currentDetailEvent) return;
            const evt = currentDetailEvent;
            const title = evt.title || 'hoạt động này';
            const isRepeating = !!(evt.repeatId || (evt.repeatType && evt.repeatType !== 'none'));

            if (isRepeating && evt.repeatId) {
                // Sự kiện lặp lại: Đóng modal chi tiết và mở modal lựa chọn xóa / dừng lặp lại
                closeEventDetail();
                openDeleteRepeatModal(evt);
            } else {
                // Sự kiện đơn lẻ thông thường
                if (confirm(`Bạn có chắc muốn xóa hoạt động "${title}" không?`)) {
                    const idToDelete = evt.id;
                    closeEventDetail();
                    deleteEvent(idToDelete);
                }
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
            if (modalDeleteRepeat && modalDeleteRepeat.classList.contains('is-active')) {
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

    // 7.11 Gửi Form Lưu hoạt động mới
    if (formAddEvent) {
        formAddEvent.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = inputTitle.value.trim();
            const startVal = inputStart.value;
            const endVal = inputEnd.value;
            const imgVal = (eventImageData && eventImageData.value.trim()) || '';
            const colorVal = currentEventColor || '#d6aa7d';
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
                    rawImageUrl: originalImageSrc || imgVal,
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
                        rawImageUrl: originalImageSrc || imgVal || '',
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

            const events = loadEvents();
            events.push(...eventsToAdd);
            saveEvents(events);

            // Tự động bỏ lọc tag (nếu đang bật) để các sự kiện vừa tạo chắc chắn được nhìn thấy ngay
            if (activeTagFilter) {
                activeTagFilter = null;
                updateFilterUI(events);
            }

            const firstEventId = eventsToAdd[0].id;
            const repeatBatchId = eventsToAdd[0].repeatId;

            // Đặt cờ để đưa hàng chứa sự kiện mới lên Hàng #1 ngay trên cùng của timeline
            trackToHoistOnRender = repeatBatchId || firstEventId;

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

    // ========================================================
    // THÔNG BÁO TOAST NỔI (Toast Notification Utility)
    // ========================================================
    function showToastNotification(message, titleText = 'Thành công') {
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

    // ========================================================
    // 7.15 TÍNH NĂNG AI VISION (Google Gemini Image Auto-Fill)
    // ========================================================
    const STORAGE_KEY_GEMINI_KEY = 'gemini_api_key';
    const STORAGE_KEY_GEMINI_MODEL = 'gemini_ai_model';

    const btnToggleAiMode = document.getElementById('btn-toggle-ai-mode');
    const aiFileDropzone = document.getElementById('ai-file-dropzone');
    const btnAiChooseFile = document.getElementById('btn-ai-choose-file');
    const aiScanFileInput = document.getElementById('ai-scan-file-input');
    const btnAiSettingsGear = document.getElementById('btn-ai-settings-gear');
    const aiScanningOverlay = document.getElementById('ai-scanning-overlay');
    const aiScanStatusText = document.getElementById('ai-scan-status-text');

    const modalAiConfig = document.getElementById('modal-ai-config');
    const btnCloseAiConfig = document.getElementById('btn-close-ai-config');
    const btnCancelAiConfig = document.getElementById('btn-cancel-ai-config');
    const btnSaveAiConfig = document.getElementById('btn-save-ai-config');
    const btnClearAiKey = document.getElementById('btn-clear-ai-key');
    const inputGeminiKey = document.getElementById('input-gemini-key');
    const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
    const selectGeminiModel = document.getElementById('select-gemini-model');
    const keyStatusHint = document.getElementById('key-status-hint');

    let pendingScanFile = null;

    function openAiConfigModal(customHint) {
        if (!modalAiConfig) return;
        modalAiConfig.classList.add('is-active');
        modalAiConfig.setAttribute('aria-hidden', 'false');

        const savedKey = localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
        const modernModels = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
        let savedModel = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL) || 'gemini-flash-lite-latest';
        if (!modernModels.includes(savedModel) || savedModel === 'gemini-3.8-flash' || savedModel.includes('1.5') || savedModel.includes('2.0') || savedModel.includes('2.5')) {
            savedModel = 'gemini-flash-lite-latest';
            localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, 'gemini-flash-lite-latest');
        }

        if (inputGeminiKey) {
            inputGeminiKey.value = savedKey;
            inputGeminiKey.type = 'password';
        }
        if (selectGeminiModel) {
            selectGeminiModel.value = savedModel;
        }

        if (keyStatusHint) {
            if (customHint) {
                keyStatusHint.textContent = customHint;
                keyStatusHint.className = 'key-status-hint is-missing';
            } else if (savedKey) {
                keyStatusHint.textContent = '✓ Đã có API Key lưu trên trình duyệt này.';
                keyStatusHint.className = 'key-status-hint is-saved';
            } else {
                keyStatusHint.textContent = 'Chưa cấu hình API Key. Hãy dán mã API Key của bạn vào đây.';
                keyStatusHint.className = 'key-status-hint is-missing';
            }
        }

        if (inputGeminiKey) {
            setTimeout(() => inputGeminiKey.focus(), 80);
        }
    }

    function closeAiConfigModal() {
        if (!modalAiConfig) return;
        modalAiConfig.classList.remove('is-active');
        modalAiConfig.setAttribute('aria-hidden', 'true');
        pendingScanFile = null;
    }

    function saveAiConfig() {
        if (!inputGeminiKey) return;
        const key = inputGeminiKey.value.trim();
        if (!key) {
            alert('Vui lòng nhập Google Gemini API Key để lưu!');
            inputGeminiKey.focus();
            return;
        }

        localStorage.setItem(STORAGE_KEY_GEMINI_KEY, key);
        if (selectGeminiModel) {
            localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, selectGeminiModel.value);
        }

        pendingScanFile = null;
        closeAiConfigModal();
        showToastNotification('Đã lưu cấu hình Google Gemini API thành công!', '✨ Cài đặt AI');
    }

    function clearAiKey() {
        if (confirm('Bạn có chắc chắn muốn xóa mã Gemini API Key đã lưu trên trình duyệt?')) {
            localStorage.removeItem(STORAGE_KEY_GEMINI_KEY);
            if (inputGeminiKey) inputGeminiKey.value = '';
            if (keyStatusHint) {
                keyStatusHint.textContent = 'Đã xóa API Key.';
                keyStatusHint.className = 'key-status-hint is-missing';
            }
            showToastNotification('Đã xóa API Key thành công.', 'Đã xóa');
        }
    }

    function toggleKeyVisibility() {
        if (!inputGeminiKey) return;
        inputGeminiKey.type = inputGeminiKey.type === 'password' ? 'text' : 'password';
    }

    if (btnAiSettingsGear) btnAiSettingsGear.addEventListener('click', () => openAiConfigModal());
    if (btnCloseAiConfig) btnCloseAiConfig.addEventListener('click', closeAiConfigModal);
    if (btnCancelAiConfig) btnCancelAiConfig.addEventListener('click', closeAiConfigModal);
    if (btnSaveAiConfig) btnSaveAiConfig.addEventListener('click', saveAiConfig);
    if (btnClearAiKey) btnClearAiKey.addEventListener('click', clearAiKey);
    if (btnToggleKeyVisibility) btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);
    if (modalAiConfig) {
        modalAiConfig.addEventListener('click', (e) => {
            if (e.target === modalAiConfig) closeAiConfigModal();
        });
    }

    // Nút chuyển đổi giữa "Ảnh minh họa thường" và "Chế độ đọc thông tin (AI)"
    if (btnToggleAiMode) {
        btnToggleAiMode.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setAiReadingMode(!isAiReadingMode);
        });
    }

    // Nút chọn file trong khung quét AI
    if (btnAiChooseFile && aiScanFileInput) {
        btnAiChooseFile.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            aiScanFileInput.click();
        });
    }

    if (aiScanFileInput) {
        aiScanFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                processAiScanFile(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // Hỗ trợ Kéo & Thả ảnh vào ô quét AI
    if (aiFileDropzone) {
        ['dragenter', 'dragover'].forEach(evtName => {
            aiFileDropzone.addEventListener(evtName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                aiFileDropzone.classList.add('is-dragover');
            });
        });
        ['dragleave', 'drop'].forEach(evtName => {
            aiFileDropzone.addEventListener(evtName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                aiFileDropzone.classList.remove('is-dragover');
            });
        });
        aiFileDropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                const f = e.dataTransfer.files[0];
                if (f.type.startsWith('image/')) {
                    processAiScanFile(f);
                }
            }
        });
    }

    // Hàm nén ảnh siêu tốc phía Client (giảm 95% dung lượng ảnh để upload trong tích tắc ~0.1s)
    function compressImageForAi(file, maxWidth = 1080, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fullQualityDataUrl = e.target.result;
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    const commaIdx = compressedDataUrl.indexOf(',');
                    const base64Data = commaIdx !== -1 ? compressedDataUrl.slice(commaIdx + 1) : compressedDataUrl;
                    resolve({
                        base64Data,
                        mimeType: 'image/jpeg',
                        fullQualityDataUrl
                    });
                };
                img.onerror = () => {
                    const commaIdx = fullQualityDataUrl.indexOf(',');
                    resolve({
                        base64Data: commaIdx !== -1 ? fullQualityDataUrl.slice(commaIdx + 1) : fullQualityDataUrl,
                        mimeType: file.type || 'image/png',
                        fullQualityDataUrl
                    });
                };
                img.src = fullQualityDataUrl;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Hàm cốt lõi: Đọc và gửi ảnh tới Gemini AI Vision (Đã tối ưu tốc độ tối đa)
    async function processAiScanFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Vui lòng chọn một tập tin hình ảnh hợp lệ (PNG, JPG, WEBP)!');
            return;
        }

        const apiKey = localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
        if (!apiKey) {
            pendingScanFile = file;
            openAiConfigModal('Vui lòng nhập API Key Google Gemini để kích hoạt tính năng AI Vision.');
            return;
        }

        if (aiScanningOverlay) {
            aiScanningOverlay.classList.add('is-active');
            aiScanningOverlay.style.display = 'flex';
        }
        if (aiScanStatusText) {
            aiScanStatusText.textContent = 'Đang tối ưu kích thước ảnh siêu tốc...';
        }

        try {
            // Nén ảnh tự động để giảm 90-95% dung lượng giúp tải lên trong tích tắc
            const compressed = await compressImageForAi(file);

            if (aiScanStatusText) {
                aiScanStatusText.textContent = 'Đang phân tích ngày giờ bằng Gemini AI...';
            }

            // Lấy model người dùng đã cấu hình (mặc định gemini-flash-lite-latest hạn mức cao nhất)
            const supportedModern = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
            let userModel = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL) || 'gemini-flash-lite-latest';
            if (!supportedModern.includes(userModel) || userModel === 'gemini-3.8-flash') {
                userModel = 'gemini-flash-lite-latest';
                localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, 'gemini-flash-lite-latest');
            }

            // 1. Tự động kiểm tra API Key và lấy danh sách Model thực tế đang hỗ trợ từ Google
            let activeModels = null;
            try {
                const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
                    headers: { 'x-goog-api-key': apiKey }
                });
                if (listResp.ok) {
                    const listJson = await listResp.json();
                    const available = (listJson.models || [])
                        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                        .map(m => m.name.replace(/^models\//, ''));
                    if (available.length > 0) activeModels = available;
                } else if (listResp.status === 400 || listResp.status === 401 || listResp.status === 403) {
                    const errJson = await listResp.json().catch(() => ({}));
                    const msg = errJson.error?.message || listResp.statusText;
                    throw new Error(`Google Gemini API Key không hợp lệ (${listResp.status}): ${msg}\n\nVui lòng kiểm tra lại mã Key tại https://aistudio.google.com.`);
                }
            } catch (listErr) {
                if (listErr.message && listErr.message.includes('API Key không hợp lệ')) {
                    throw listErr;
                }
                console.warn('Không thể kiểm tra ListModels, dùng danh sách dự phòng:', listErr);
            }

            // 2. Chọn danh sách model tối ưu nhất (ưu tiên flash-lite hạn mức cao, siêu tốc và ổn định)
            const preferredModels = [
                'gemini-flash-lite-latest',
                'gemini-3.1-flash-lite',
                'gemini-3.5-flash-lite',
                'gemini-3.5-flash',
                'gemini-3.6-flash',
                'gemini-flash-latest'
            ];
            let candidateModels = [];
            if (userModel && supportedModern.includes(userModel)) {
                candidateModels.push(userModel);
            }
            preferredModels.forEach(m => {
                if (!candidateModels.includes(m)) candidateModels.push(m);
            });
            if (activeModels && activeModels.length > 0) {
                activeModels.forEach(m => {
                    const isRestricted = m.includes('1.5') || m.includes('2.0') || m.includes('2.5') || m.includes('3.8-flash') || m.includes('pro') || m.includes('tts') || m.includes('lyria') || m.includes('robotics') || m.includes('research') || m.includes('banana') || m.includes('argon');
                    if (!isRestricted && !candidateModels.includes(m)) {
                        candidateModels.push(m);
                    }
                });
            }

            const currentYear = new Date().getFullYear();
            const promptText = `Bạn là trợ lý trích xuất lịch sự kiện từ ảnh (banner game, thông báo sự kiện, lịch trình).
Năm hiện tại: ${currentYear}. Thời gian hệ thống: ${new Date().toISOString()}.
Chỉ trả về 1 JSON object duy nhất (không dùng markdown code block):
{
  "title": "Tên sự kiện hoặc tiêu đề banner (viết hoa chữ cái đầu các từ)",
  "start": "YYYY-MM-DDTHH:mm",
  "end": "YYYY-MM-DDTHH:mm",
  "tag": "từ khóa nhãn nhóm ngắn gọn không dấu (vd: banner, event, genshin, la-hoan)",
  "note": "Ghi lại đầy đủ và chi tiết các thông tin có trên ảnh (ví dụ: yêu cầu nguyên tố, danh sách nhân vật, điều kiện tham gia, quy tắc sự kiện, quà thưởng nếu có, xuống dòng từng ý rõ ràng)",
  "articleUrl": "link nếu có trên ảnh hoặc để rỗng"
}
Quy tắc bóc tách:
- Chuyển đúng ngày giờ trên ảnh sang YYYY-MM-DDTHH:mm. Nếu ảnh thiếu năm thì dùng ${currentYear}.
- Nếu không có giờ cụ thể: start 10:00 (hoặc 04:00), end 03:59 (hoặc 18:00).
- Đảm bảo start luôn nhỏ hơn end.`;

            const payload = {
                contents: [{
                    parts: [
                        { text: promptText },
                        {
                            inline_data: {
                                mime_type: compressed.mimeType,
                                data: compressed.base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    response_mime_type: 'application/json',
                    temperature: 0.1,
                    max_output_tokens: 800
                }
            };

            let response = null;
            let usedModel = candidateModels[0] || userModel;

            for (const tryModel of candidateModels) {
                usedModel = tryModel;
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${tryModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

                try {
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': apiKey
                        },
                        body: JSON.stringify(payload)
                    });

                    // Nếu thành công (200 OK)
                    if (response.ok) {
                        localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, tryModel);
                        break;
                    }

                    // Nếu model bị 404 (không tồn tại), 429 (hết hạn mức quota lượt gọi của model này), hoặc 503 (quá tải):
                    // Tự động chuyển ngay sang model dự phòng tiếp theo còn hạn mức!
                    if (response.status === 404 || response.status === 429 || response.status === 503) {
                        console.warn(`Model ${tryModel} trả về HTTP ${response.status}, tự động chuyển sang model dự phòng tiếp theo...`);
                        continue;
                    }

                    // Nếu lỗi do sai API Key (400, 401, 403), dừng ngay để báo cho người dùng
                    break;
                } catch (netErr) {
                    console.warn(`Lỗi kết nối khi gọi ${tryModel}:`, netErr);
                }
            }

            if (!response || !response.ok) {
                let errText = '';
                if (response) {
                    try {
                        const errJson = await response.json();
                        errText = errJson.error?.message || response.statusText;
                    } catch {
                        errText = response.statusText;
                    }

                    if (response.status === 429) {
                        throw new Error(`Tài khoản Google đã hết hạn mức lượt gọi miễn phí hôm nay (Lỗi 429 Quota Exceeded).\n\n👉 Cách xử lý ngay:\n1. Vào Cài đặt (⚙️) chọn mô hình "Gemini Flash Lite" (hạn mức cao nhất).\n2. Hoặc vào https://aistudio.google.com tạo thêm 1 API Key mới để tiếp tục quét ảnh ngay.`);
                    } else if (response.status === 400 || response.status === 401 || response.status === 403) {
                        throw new Error(`API Key không hợp lệ hoặc đã hết hạn (${response.status}): ${errText}\n\nBạn có thể kiểm tra lại mã Key tại https://aistudio.google.com`);
                    } else {
                        throw new Error(`Lỗi từ Gemini API (${response.status}): ${errText}`);
                    }
                } else {
                    throw new Error('Không thể kết nối đến máy chủ Google Gemini API.');
                }
            }

            const resJson = await response.json();
            const textResult = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textResult) {
                throw new Error('Gemini AI không trả về dữ liệu nội dung!');
            }

            let parsed;
            try {
                parsed = JSON.parse(textResult);
            } catch (jsonErr) {
                const match = textResult.match(/\{[\s\S]*\}/);
                if (match) {
                    parsed = JSON.parse(match[0]);
                } else {
                    throw new Error('Không thể phân tích dữ liệu JSON từ AI.');
                }
            }

            // ĐIỀN DỮ LIỆU TỰ ĐỘNG VÀO FORM
            if (parsed.title && inputTitle) {
                inputTitle.value = parsed.title;
                inputTitle.dispatchEvent(new Event('input'));
                inputTitle.dispatchEvent(new Event('change'));
            }

            if (parsed.start && inputStart) {
                inputStart.value = parsed.start;
                inputStart.dataset.userModified = 'true';
                inputStart.dispatchEvent(new Event('change'));
            }

            if (parsed.end && inputEnd) {
                inputEnd.value = parsed.end;
                inputEnd.dataset.userModified = 'true';
                inputEnd.dispatchEvent(new Event('change'));
            }

            if (parsed.tag && inputTag) {
                inputTag.value = parsed.tag;
                inputTag.dispatchEvent(new Event('input'));
            }

            if (parsed.note && inputNote) {
                inputNote.value = parsed.note;
            }

            if (parsed.articleUrl && inputArticleUrl) {
                inputArticleUrl.value = parsed.articleUrl;
            }

            // Chuyển lại về chế độ ảnh minh họa thường để hiển thị kết quả cắt ảnh
            setAiReadingMode(false);

            // Tự động nạp bức ảnh gốc (chất lượng cao) vừa quét vào bộ cắt ảnh
            if (typeof openCropper === 'function') {
                openCropper(compressed.fullQualityDataUrl);
            }

            showToastNotification(`AI đã điền thành công thông tin "${parsed.title || 'Sự kiện'}"!`, '✨ AI Vision');
        } catch (err) {
            console.error('Lỗi nhận diện ảnh bằng AI:', err);
            alert(`Không thể nhận diện ảnh: ${err.message}\n\nBạn có thể kiểm tra lại API Key trong mục Cài đặt (nút ⚙️) hoặc thử lại.`);
        } finally {
            if (aiScanningOverlay) {
                aiScanningOverlay.classList.remove('is-active');
                aiScanningOverlay.style.display = 'none';
            }
        }
    }

    // ========================================================
    // 7.8 BỘ MÁY LỊCH THÁNG & ÂM LỊCH VIỆT NAM (Lunar Calendar & Monthly View)
    // Thuật toán thiên văn Hồ Ngọc Đức (chuẩn xác 100% múi giờ Việt Nam UTC+7)
    // Hỗ trợ Can Chi, ngày Hoàng đạo / Hắc đạo, ngày lễ và đồng bộ sự kiện Timeline
    // ========================================================

    const TK20 = [
        0x3c4bd8, 0x624ae0, 0x4ca570, 0x3854d5, 0x5cd260, 0x44d950, 0x315554, 0x5656a0, 0x409ad0, 0x2a55d2,
        0x504ae0, 0x3aa5b6, 0x60a4d0, 0x48d250, 0x33d255, 0x58b540, 0x42d6a0, 0x2cada2, 0x5295b0, 0x3f4977,
        0x644970, 0x4ca4b0, 0x36b4b5, 0x5c6a50, 0x466d50, 0x312b54, 0x562b60, 0x409570, 0x2c52f2, 0x504970,
        0x3a6566, 0x5ed4a0, 0x48ea50, 0x336a95, 0x585ad0, 0x442b60, 0x2f86e3, 0x5292e0, 0x3dc8d7, 0x62c950,
        0x4cd4a0, 0x35d8a6, 0x5ab550, 0x4656a0, 0x31a5b4, 0x5625d0, 0x4092d0, 0x2ad2b2, 0x50a950, 0x38b557,
        0x5e6ca0, 0x48b550, 0x355355, 0x584da0, 0x42a5b0, 0x2f4573, 0x5452b0, 0x3ca9a8, 0x60e950, 0x4c6aa0,
        0x36aea6, 0x5aab50, 0x464b60, 0x30aae4, 0x56a570, 0x405260, 0x28f263, 0x4ed940, 0x38db47, 0x5cd6a0,
        0x4896d0, 0x344dd5, 0x5a4ad0, 0x42a4d0, 0x2cd4b4, 0x52b250, 0x3cd558, 0x60b540, 0x4ab5a0, 0x3755a6,
        0x5c95b0, 0x4649b0, 0x30a974, 0x56a4b0, 0x40aa50, 0x29aa52, 0x4e6d20, 0x39ad47, 0x5eab60, 0x489370,
        0x344af5, 0x5a4970, 0x4464b0, 0x2c74a3, 0x50ea50, 0x3d6a58, 0x6256a0, 0x4aaad0, 0x3696d5, 0x5c92e0
    ];

    const TK21 = [
        0x46c960, 0x2ed954, 0x54d4a0, 0x3eda50, 0x2a7552, 0x4e56a0, 0x38a7a7, 0x5ea5d0, 0x4a92b0, 0x32aab5,
        0x58a950, 0x42b4a0, 0x2cbaa4, 0x50ad50, 0x3c55d9, 0x624ba0, 0x4ca5b0, 0x375176, 0x5c5270, 0x466930,
        0x307934, 0x546aa0, 0x3ead50, 0x2a5b52, 0x504b60, 0x38a6e6, 0x5ea4e0, 0x48d260, 0x32ea65, 0x56d520,
        0x40daa0, 0x2d56a3, 0x5256d0, 0x3c4afb, 0x6249d0, 0x4ca4d0, 0x37d0b6, 0x5ab250, 0x44b520, 0x2edd25,
        0x54b5a0, 0x3e55d0, 0x2a55b2, 0x5049b0, 0x3aa577, 0x5ea4b0, 0x48aa50, 0x33b255, 0x586d20, 0x40ad60,
        0x2d4b63, 0x525370, 0x3e49e8, 0x60c970, 0x4c54b0, 0x3768a6, 0x5ada50, 0x445aa0, 0x2fa6a4, 0x54aad0,
        0x4052e0, 0x28d2e3, 0x4ec950, 0x38d557, 0x5ed4a0, 0x46d950, 0x325d55, 0x5856a0, 0x42a6d0, 0x2c55d4,
        0x5252b0, 0x3ca9b8, 0x62a930, 0x4ab490, 0x34b6a6, 0x5aad50, 0x4655a0, 0x2eab64, 0x54a570, 0x4052b0,
        0x2ab173, 0x4e6930, 0x386b37, 0x5e6aa0, 0x48ad50, 0x332ad5, 0x582b60, 0x42a570, 0x2e52e4, 0x50d160,
        0x3ae958, 0x60d520, 0x4ada90, 0x355aa6, 0x5a56d0, 0x462ae0, 0x30a9d4, 0x54a2d0, 0x3ed150, 0x28e952
    ];

    const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

    function jdn(dd, mm, yy) {
        const a = Math.floor((14 - mm) / 12);
        const y = yy + 4800 - a;
        const m = mm + 12 * a - 3;
        return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    }

    function decodeLunarYear(yy, k) {
        const monthLengths = [29, 30];
        const regularMonths = new Array(12);
        const offsetOfTet = k >> 17;
        const leapMonth = k & 0xf;
        const leapMonthLength = monthLengths[(k >> 16) & 0x1];
        const solarNY = jdn(1, 1, yy);
        let currentJD = solarNY + offsetOfTet;
        let j = k >> 4;
        for (let i = 0; i < 12; i++) {
            regularMonths[11 - i] = monthLengths[j & 0x1];
            j >>= 1;
        }
        const ly = [];
        if (leapMonth === 0) {
            for (let mm = 1; mm <= 12; mm++) {
                ly.push({ day: 1, month: mm, year: yy, leap: 0, jd: currentJD });
                currentJD += regularMonths[mm - 1];
            }
        } else {
            for (let mm = 1; mm <= leapMonth; mm++) {
                ly.push({ day: 1, month: mm, year: yy, leap: 0, jd: currentJD });
                currentJD += regularMonths[mm - 1];
            }
            ly.push({ day: 1, month: leapMonth, year: yy, leap: 1, jd: currentJD });
            currentJD += leapMonthLength;
            for (let mm = leapMonth + 1; mm <= 12; mm++) {
                ly.push({ day: 1, month: mm, year: yy, leap: 0, jd: currentJD });
                currentJD += regularMonths[mm - 1];
            }
        }
        return ly;
    }

    function getLunarDate(dd, mm, yy) {
        const jd = jdn(dd, mm, yy);
        let k;
        if (yy >= 2000 && yy <= 2099) {
            k = TK21[yy - 2000];
        } else if (yy >= 1900 && yy <= 1999) {
            k = TK20[yy - 1900];
        } else {
            return { day: dd, month: mm, year: yy, leap: 0, jd: jd };
        }
        let ly = decodeLunarYear(yy, k);
        if (jd < ly[0].jd) {
            const prevK = (yy - 1 >= 2000) ? TK21[yy - 1 - 2000] : TK20[yy - 1 - 1900];
            ly = decodeLunarYear(yy - 1, prevK);
        }
        for (let i = ly.length - 1; i >= 0; i--) {
            if (jd >= ly[i].jd) {
                return {
                    day: jd - ly[i].jd + 1,
                    month: ly[i].month,
                    year: ly[i].year,
                    leap: ly[i].leap,
                    jd: jd
                };
            }
        }
        return { day: 1, month: 1, year: yy, leap: 0, jd: jd };
    }

    function getCanChiDay(jd) {
        const canIdx = (jd + 9) % 10;
        const chiIdx = (jd + 1) % 12;
        return `${CAN[canIdx]} ${CHI[chiIdx]}`;
    }

    function getCanChiYear(lunarYear) {
        const canIdx = (lunarYear + 6) % 10;
        const chiIdx = (lunarYear + 8) % 12;
        return `${CAN[canIdx]} ${CHI[chiIdx]}`;
    }

    function getCanChiMonth(lunarMonth, lunarYear) {
        const canYearIdx = (lunarYear + 6) % 10;
        const canMIdx = ((canYearIdx % 5) * 2 + 2 + (lunarMonth - 1)) % 10;
        const chiMIdx = (lunarMonth + 1) % 12;
        return `${CAN[canMIdx]} ${CHI[chiMIdx]}`;
    }

    const HOURS_HOANG_DAO = {
        0: ['Tý (23h-01h)', 'Sửu (01h-03h)', 'Mão (05h-07h)', 'Ngọ (11h-13h)', 'Thân (15h-17h)', 'Dậu (17h-19h)'],
        6: ['Tý (23h-01h)', 'Sửu (01h-03h)', 'Mão (05h-07h)', 'Ngọ (11h-13h)', 'Thân (15h-17h)', 'Dậu (17h-19h)'],
        1: ['Dần (03h-05h)', 'Mão (05h-07h)', 'Tỵ (09h-11h)', 'Thân (15h-17h)', 'Tuất (19h-21h)', 'Hợi (21h-23h)'],
        7: ['Dần (03h-05h)', 'Mão (05h-07h)', 'Tỵ (09h-11h)', 'Thân (15h-17h)', 'Tuất (19h-21h)', 'Hợi (21h-23h)'],
        2: ['Tý (23h-01h)', 'Sửu (01h-03h)', 'Thìn (07h-09h)', 'Tỵ (09h-11h)', 'Mùi (13h-15h)', 'Tuất (19h-21h)'],
        8: ['Tý (23h-01h)', 'Sửu (01h-03h)', 'Thìn (07h-09h)', 'Tỵ (09h-11h)', 'Mùi (13h-15h)', 'Tuất (19h-21h)'],
        3: ['Tý (23h-01h)', 'Dần (03h-05h)', 'Mão (05h-07h)', 'Ngọ (11h-13h)', 'Mùi (13h-15h)', 'Dậu (17h-19h)'],
        9: ['Tý (23h-01h)', 'Dần (03h-05h)', 'Mão (05h-07h)', 'Ngọ (11h-13h)', 'Mùi (13h-15h)', 'Dậu (17h-19h)'],
        4: ['Dần (03h-05h)', 'Thìn (07h-09h)', 'Tỵ (09h-11h)', 'Thân (15h-17h)', 'Dậu (17h-19h)', 'Hợi (21h-23h)'],
        10: ['Dần (03h-05h)', 'Thìn (07h-09h)', 'Tỵ (09h-11h)', 'Thân (15h-17h)', 'Dậu (17h-19h)', 'Hợi (21h-23h)'],
        5: ['Sửu (01h-03h)', 'Thìn (07h-09h)', 'Ngọ (11h-13h)', 'Mùi (13h-15h)', 'Tuất (19h-21h)', 'Hợi (21h-23h)'],
        11: ['Sửu (01h-03h)', 'Thìn (07h-09h)', 'Ngọ (11h-13h)', 'Mùi (13h-15h)', 'Tuất (19h-21h)', 'Hợi (21h-23h)']
    };

    const HOANG_DAO_CHI = {
        1: [0, 1, 4, 5, 7, 10],
        2: [2, 3, 6, 7, 9, 0],
        3: [4, 5, 8, 9, 11, 2],
        4: [6, 7, 10, 11, 1, 4],
        5: [8, 9, 0, 1, 3, 6],
        6: [10, 11, 2, 3, 5, 8],
        7: [0, 1, 4, 5, 7, 10],
        8: [2, 3, 6, 7, 9, 0],
        9: [4, 5, 8, 9, 11, 2],
        10: [6, 7, 10, 11, 1, 4],
        11: [8, 9, 0, 1, 3, 6],
        12: [10, 11, 2, 3, 5, 8]
    };

    function isHoangDao(lunarMonth, jd) {
        const chiIdx = (jd + 1) % 12;
        const list = HOANG_DAO_CHI[lunarMonth] || [];
        return list.includes(chiIdx);
    }

    const SOLAR_HOLIDAYS = {
        '1-1': 'Tết Dương lịch',
        '14-2': 'Lễ tình nhân',
        '27-2': 'Thầy thuốc VN',
        '8-3': 'Quốc tế Phụ nữ',
        '26-3': 'Đoàn TNCS',
        '30-4': 'Giải phóng miền Nam',
        '1-5': 'Quốc tế Lao động',
        '7-5': 'Chiến thắng ĐBP',
        '19-5': 'Sinh nhật Bác Hồ',
        '1-6': 'Quốc tế Thiếu nhi',
        '28-6': 'Gia đình VN',
        '27-7': 'Thương binh Liệt sĩ',
        '19-8': 'Cách mạng tháng 8',
        '2-9': 'Quốc khánh',
        '1-10': 'Ngày quốc tế người cao tuổi',
        '10-10': 'Ngày giải phóng thủ đô',
        '13-10': 'Ngày doanh nhân Việt Nam',
        '20-10': 'Ngày Phụ nữ Việt Nam',
        '31-10': 'Lễ hội Halloween',
        '20-11': 'Nhà giáo Việt Nam',
        '22-12': 'Quân đội NDVN',
        '24-12': 'Đêm Giáng sinh',
        '25-12': 'Giáng sinh'
    };

    const LUNAR_HOLIDAYS = {
        '1-1': 'Mùng 1 Tết',
        '2-1': 'Mùng 2 Tết',
        '3-1': 'Mùng 3 Tết',
        '15-1': 'Tết Nguyên Tiêu',
        '10-3': 'Giỗ Tổ Hùng Vương',
        '15-4': 'Lễ Phật Đản',
        '5-5': 'Tết Đoan Ngọ',
        '15-7': 'Lễ Vu Lan',
        '15-8': 'Tết Trung Thu',
        '9-9': 'Tết Trùng Cửu',
        '15-10': 'Tết Hạ Nguyên',
        '23-12': 'Ông Táo chầu trời'
    };

    let currentCalMonth = new Date().getMonth();
    let currentCalYear = new Date().getFullYear();

    const calMonthTitle = document.getElementById('cal-month-title');
    const btnCalPrev = document.getElementById('btn-cal-prev');
    const btnCalNext = document.getElementById('btn-cal-next');
    const btnCalToday = document.getElementById('btn-cal-today');
    const calSelectMonth = document.getElementById('cal-select-month');
    const calSelectYear = document.getElementById('cal-select-year');
    const btnCalAddEvent = document.getElementById('btn-cal-add-event');
    const calGrid = document.getElementById('monthly-cal-grid');

    // DOM Elements cho Modal Thông Tin Chi Tiết Ngày (Day Detail Modal)
    const modalDayDetail = document.getElementById('modal-day-detail');
    const btnCloseDayDetail = document.getElementById('btn-close-day-detail');
    const btnDoneDayDetail = document.getElementById('btn-done-day-detail');
    const modalDayWeekday = document.getElementById('modal-day-weekday');
    const modalDayFullSolar = document.getElementById('modal-day-full-solar');
    const modalDayRelative = document.getElementById('modal-day-relative');
    const modalDayHolidayBanner = document.getElementById('modal-day-holiday-banner');
    const modalDayHolidayTitle = document.getElementById('modal-day-holiday-title');
    const modalDaySolarNum = document.getElementById('modal-day-solar-num');
    const modalDaySolarSub = document.getElementById('modal-day-solar-sub');
    const modalDayLunarNum = document.getElementById('modal-day-lunar-num');
    const modalDayLunarSub = document.getElementById('modal-day-lunar-sub');
    const modalDayCanChiDay = document.getElementById('modal-day-canchi-day');
    const modalDayCanChiMonth = document.getElementById('modal-day-canchi-month');
    const modalDayCanChiYear = document.getElementById('modal-day-canchi-year');
    const modalDayHoangDaoCard = document.getElementById('modal-day-hoangdao-card');
    const modalDayHoangDaoBadge = document.getElementById('modal-day-hoangdao-badge');
    const modalDayHoangDaoAdvice = document.getElementById('modal-day-hoangdao-advice');
    const modalDayEventsList = document.getElementById('modal-day-events-list');
    const btnDayAddEvent = document.getElementById('btn-day-add-event');

    // DOM Elements cho Modal Thêm Sự Kiện Lịch Cá Nhân (+ Thêm)
    const modalCalAddEvent = document.getElementById('modal-cal-add-event');
    const btnCloseCalAddModal = document.getElementById('btn-close-cal-add-modal');
    const btnCancelCalAdd = document.getElementById('btn-cancel-cal-add');
    const btnSaveCalEvent = document.getElementById('btn-save-cal-event');
    const calModalTitle = document.getElementById('cal-modal-title');
    const formCalAddEvent = document.getElementById('form-cal-add-event');
    const inputCalTitle = document.getElementById('cal-event-title');
    const inputCalStartDate = document.getElementById('cal-event-start-date');
    const inputCalStartTime = document.getElementById('cal-event-start-time');
    const inputCalEndDate = document.getElementById('cal-event-end-date');
    const inputCalEndTime = document.getElementById('cal-event-end-time');
    const calStartTimeInputs = document.getElementById('cal-start-time-inputs');
    const calEndTimeInputs = document.getElementById('cal-end-time-inputs');
    const chkCalAllDay = document.getElementById('cal-event-allday');
    const selectCalRepeat = document.getElementById('cal-event-repeat');
    const calCategoriesList = document.getElementById('cal-categories-list');
    const calAddCustomCatBox = document.getElementById('cal-add-custom-cat-box');
    const inputCustomCatName = document.getElementById('input-custom-cat-name');
    const inputCustomCatColor = document.getElementById('input-custom-cat-color');
    const btnConfirmAddCat = document.getElementById('btn-confirm-add-cat');
    const btnCancelAddCat = document.getElementById('btn-cancel-add-cat');
    const btnResetDefaultCats = document.getElementById('btn-reset-default-cats');
    const textareaCalNote = document.getElementById('cal-event-note');
    const inputCalAttachment = document.getElementById('cal-event-attachment-input');
    const calAttachmentLabel = document.getElementById('cal-attachment-label');
    const calAttachmentPreviewBox = document.getElementById('cal-attachment-preview-box');
    const calAttachmentName = document.getElementById('cal-attachment-name');
    const btnRemoveCalAttachment = document.getElementById('btn-remove-cal-attachment');
    const inputCalUrl = document.getElementById('cal-event-url');

    // Storage Keys cho Lịch Cá Nhân (hoàn toàn độc lập với Timeline)
    const CAL_USER_EVENTS_KEY = 'calendar_user_events';
    const CAL_CATEGORIES_KEY = 'calendar_user_categories';

    const DEFAULT_CAL_CATEGORIES = [
        { id: 'nha', name: 'Nhà', color: '#38bdf8', icon: '🏠' },
        { id: 'cong-viec', name: 'Công việc', color: '#c084fc', icon: '💼' },
        { id: 'vui-choi', name: 'Vui chơi', color: '#10b981', icon: '🎮' },
        { id: 'thoi-han', name: 'Thời hạn', color: '#ef4444', icon: '⏰' }
    ];

    let currentSelectedCatId = 'nha';
    let currentCalAttachment = null;
    let activeDayDetailData = null;
    let editingCalEventId = null; // ID sự kiện đang được chỉnh sửa (null nếu là thêm mới)

    // DOM Elements cho Timeline Ngang 24 Giờ Trong Ngày (Ở dưới lịch)
    const dayHTitleDate = document.getElementById('day-h-title-date');
    const dayHLunarBadge = document.getElementById('day-h-lunar-badge');
    const dayHCanchiBadge = document.getElementById('day-h-canchi-badge');
    const dayHCountBadge = document.getElementById('day-h-count-badge');
    const dayHAlldayBar = document.getElementById('day-h-allday-bar');
    const dayHAlldayPills = document.getElementById('day-h-allday-pills');
    const dayHScrollWrap = document.getElementById('day-h-scroll-wrap');
    const dayHTrackContainer = document.getElementById('day-h-track-container');
    const dayHRulerGrid = document.getElementById('day-h-ruler-grid');
    const dayHNowNeedle = document.getElementById('day-h-now-needle');
    const dayHNowText = document.getElementById('day-h-now-text');
    const dayHEventsLane = document.getElementById('day-h-events-lane');

    let activeTimelineDate = null;
    let nowNeedleInterval = null;

    function loadCalEvents() {
        try {
            const key = getCalEventsStorageKey();
            let raw = localStorage.getItem(key);
            const user = getCurrentUser();
            if (!raw && user && !localStorage.getItem('legacy_cal_migrated')) {
                const legacy = localStorage.getItem(CAL_USER_EVENTS_KEY);
                if (legacy) {
                    raw = legacy;
                    localStorage.setItem(key, legacy);
                    localStorage.setItem('legacy_cal_migrated', '1');
                }
            }
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCalEvents(events) {
        try {
            const key = getCalEventsStorageKey();
            localStorage.setItem(key, JSON.stringify(events));
        } catch (e) {
            console.error('Lỗi khi lưu sự kiện lịch:', e);
        }
        if (typeof scheduleCloudPush === 'function') {
            scheduleCloudPush();
        }
    }

    function loadCalCategories() {
        try {
            const key = getCalCatsStorageKey();
            const raw = localStorage.getItem(key);
            if (!raw) return [...DEFAULT_CAL_CATEGORIES];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_CAL_CATEGORIES];
        } catch (e) {
            return [...DEFAULT_CAL_CATEGORIES];
        }
    }

    function saveCalCategories(cats) {
        try {
            const key = getCalCatsStorageKey();
            localStorage.setItem(key, JSON.stringify(cats));
        } catch (e) { }
        if (typeof scheduleCloudPush === 'function') {
            scheduleCloudPush();
        }
    }

    function deleteCalCategory(catId) {
        let cats = loadCalCategories();
        if (cats.length <= 1) {
            alert('Bạn cần giữ lại ít nhất 1 loại nhãn!');
            return;
        }
        const catToDelete = cats.find(c => c.id === catId);
        if (!catToDelete) return;

        if (!confirm(`Bạn có chắc chắn muốn xóa loại nhãn "${catToDelete.name}"?`)) {
            return;
        }

        cats = cats.filter(c => c.id !== catId);
        saveCalCategories(cats);

        if (currentSelectedCatId === catId) {
            currentSelectedCatId = cats.length ? cats[0].id : 'nha';
        }

        renderCategoryChips();
    }

    function renderCategoryChips() {
        if (!calCategoriesList) return;
        const cats = loadCalCategories();
        if (!cats.some(c => c.id === currentSelectedCatId) && cats.length > 0) {
            currentSelectedCatId = cats[0].id;
        }

        calCategoriesList.innerHTML = '';
        cats.forEach(cat => {
            const chip = document.createElement('div');
            chip.className = 'cal-cat-chip';
            const isActive = (cat.id === currentSelectedCatId);
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
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;
            chip.addEventListener('click', () => {
                currentSelectedCatId = cat.id;
                renderCategoryChips();
            });

            const delBtn = chip.querySelector('.cal-cat-del-btn');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteCalCategory(cat.id);
                });
            }

            calCategoriesList.appendChild(chip);
        });

        // Nút + Thêm loại
        const addChip = document.createElement('div');
        addChip.className = 'cal-cat-chip-add';
        addChip.title = 'Thêm loại nhãn mới';
        addChip.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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

    function isCalEventOnDate(evt, cellYear, cellMonth, dayNum) {
        const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const sDate = evt.startDate || evt.date;
        const eDate = evt.endDate || evt.date || sDate;

        if (!evt.repeat || evt.repeat === 'none') {
            return cellDateStr >= sDate && cellDateStr <= eDate;
        }
        if (cellDateStr < sDate) return false;
        const cellDate = new Date(cellYear, cellMonth, dayNum);
        const evtParts = sDate.split('-').map(Number);
        const evtDate = new Date(evtParts[0], evtParts[1] - 1, evtParts[2]);

        if (evt.repeat === 'daily') {
            return true;
        }
        if (evt.repeat === 'weekly') {
            return cellDate.getDay() === evtDate.getDay();
        }
        if (evt.repeat === 'monthly') {
            return dayNum === evtParts[2];
        }
        if (evt.repeat === 'yearly') {
            return (cellMonth + 1) === evtParts[1] && dayNum === evtParts[2];
        }
        return false;
    }

    function formatCalEventTimeRange(evt) {
        if (evt.allDay) return 'Cả ngày';
        const sDate = evt.startDate || evt.date || '';
        const eDate = evt.endDate || evt.date || sDate;
        const sTime = evt.startTime || evt.time || '';
        const eTime = evt.endTime || '';

        if (!sDate || sDate === eDate) {
            if (sTime && eTime) return `${sTime} - ${eTime}`;
            return sTime || eTime || 'Cả ngày';
        }
        // Khác ngày
        const sPart = sTime ? `${sDate} ${sTime}` : sDate;
        const ePart = eTime ? `${eDate} ${eTime}` : eDate;
        return `${sPart} ➔ ${ePart}`;
    }

    function getRepeatLabel(repeat) {
        switch (repeat) {
            case 'daily': return 'Mỗi ngày';
            case 'weekly': return 'Mỗi tuần';
            case 'monthly': return 'Mỗi tháng';
            case 'yearly': return 'Mỗi năm';
            default: return 'Không';
        }
    }

    function openCalAddEventModal(prefillDateStr = null, prefillStartTime = null, prefillEndTime = null) {
        editingCalEventId = null;
        if (calModalTitle) calModalTitle.textContent = 'Thêm Sự Kiện Lịch';
        if (btnSaveCalEvent) btnSaveCalEvent.textContent = 'Lưu sự kiện';
        if (!modalCalAddEvent) return;
        if (formCalAddEvent) formCalAddEvent.reset();
        currentCalAttachment = null;
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
        if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';

        currentSelectedCatId = 'nha';
        renderCategoryChips();
        modalCalAddEvent.classList.add('is-active');
        modalCalAddEvent.setAttribute('aria-hidden', 'false');
        setTimeout(() => { if (inputCalTitle) inputCalTitle.focus(); }, 60);
    }

    function openCalEditEventModal(eventId) {
        const events = loadCalEvents();
        const evt = events.find(e => e.id === eventId);
        if (!evt) return;

        editingCalEventId = eventId;
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

        // 3. Loại nhãn
        currentSelectedCatId = evt.categoryId || 'nha';
        renderCategoryChips();

        if (calAddCustomCatBox) calAddCustomCatBox.style.display = 'none';

        // 4. Chi tiết
        if (textareaCalNote) textareaCalNote.value = evt.note || '';

        // Tệp đính kèm
        currentCalAttachment = evt.attachment || null;
        if (currentCalAttachment) {
            if (calAttachmentName) calAttachmentName.textContent = currentCalAttachment.name;
            if (calAttachmentPreviewBox) calAttachmentPreviewBox.style.display = 'flex';
            if (calAttachmentLabel) calAttachmentLabel.textContent = 'Đã chọn: ' + currentCalAttachment.name;
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

    function closeCalAddEventModal() {
        if (!modalCalAddEvent) return;
        editingCalEventId = null;
        modalCalAddEvent.classList.remove('is-active');
        modalCalAddEvent.setAttribute('aria-hidden', 'true');
    }

    function deleteCalEvent(id) {
        let events = loadCalEvents();
        events = events.filter(e => e.id !== id);
        saveCalEvents(events);
        renderMonthlyCalendar(currentCalMonth, currentCalYear);
        renderHorizontalDailyTimeline(activeTimelineDate);
        if (activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
            renderDayDetailEvents(activeDayDetailData);
        }
    }

    function renderDayDetailEvents(data) {
        if (!modalDayEventsList) return;
        const { dayNum, cellMonth, cellYear } = data;
        const userCalEvents = loadCalEvents();
        const dayEvents = userCalEvents.filter(e => isCalEventOnDate(e, cellYear, cellMonth, dayNum));

        modalDayEventsList.innerHTML = '';
        if (dayEvents.length === 0) {
            modalDayEventsList.innerHTML = `<div class="day-empty-events">Chưa có sự kiện nào trong ngày này. Nhấp "+ Thêm sự kiện" bên trên để tạo mới.</div>`;
            return;
        }

        dayEvents.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'day-event-item';
            item.style.borderLeftColor = evt.categoryColor;

            const timeStr = formatCalEventTimeRange(evt);
            const repeatStr = (evt.repeat && evt.repeat !== 'none') ? ` • Lặp lại: ${getRepeatLabel(evt.repeat)}` : '';
            const noteHtml = evt.note ? `<div class="day-event-item-note">${escapeHtml(evt.note)}</div>` : '';
            const linkHtml = evt.url ? `<a href="${escapeHtml(evt.url)}" target="_blank" rel="noopener noreferrer" class="day-event-item-link">🔗 ${escapeHtml(evt.url)}</a>` : '';
            const attachHtml = evt.attachment ? `<div class="day-event-item-attachment">📎 <a href="${evt.attachment.dataUrl || '#'}" download="${escapeHtml(evt.attachment.name)}" style="color: inherit; text-decoration: underline;">${escapeHtml(evt.attachment.name)}</a></div>` : '';

            item.innerHTML = `
                <div class="day-event-item-top">
                    <div>
                        <div class="day-event-item-title">${escapeHtml(evt.title)}</div>
                        <div class="day-event-item-meta">
                            <span class="day-event-cat-badge" style="background: ${evt.categoryColor}22; color: ${evt.categoryColor}; border: 1px solid ${evt.categoryColor}44;">${escapeHtml(evt.categoryName || 'Sự kiện')}</span>
                            <span>⏰ ${timeStr}${repeatStr}</span>
                        </div>
                    </div>
                    <div class="day-event-item-actions">
                        <button type="button" class="btn-edit-cal-event" title="Chỉnh sửa sự kiện này">✏️</button>
                        <button type="button" class="btn-delete-cal-event" title="Xóa sự kiện này">🗑️</button>
                    </div>
                </div>
                ${noteHtml}
                ${attachHtml}
                ${linkHtml}
            `;

            const btnEdit = item.querySelector('.btn-edit-cal-event');
            if (btnEdit) {
                btnEdit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openCalEditEventModal(evt.id);
                });
            }

            const btnDel = item.querySelector('.btn-delete-cal-event');
            if (btnDel) {
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Bạn có chắc muốn xóa sự kiện "${evt.title}"?`)) {
                        deleteCalEvent(evt.id);
                    }
                });
            }

            modalDayEventsList.appendChild(item);
        });
    }

    function openDayDetailModal(data) {
        if (!modalDayDetail) return;
        activeDayDetailData = data;
        const { dayNum, cellMonth, cellYear, lunar, canChi, hoangDao, holiday } = data;
        const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        const dateObj = new Date(cellYear, cellMonth, dayNum);
        const weekdayText = WEEKDAYS[dateObj.getDay()];

        // Tính khoảng cách thời gian so với hôm nay
        const todayObj = new Date();
        todayObj.setHours(0, 0, 0, 0);
        const targetDateObj = new Date(cellYear, cellMonth, dayNum);
        targetDateObj.setHours(0, 0, 0, 0);
        const diffMs = targetDateObj.getTime() - todayObj.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        let relativeText = '';
        let isTodayDate = false;
        if (diffDays === 0) {
            relativeText = 'Hôm nay';
            isTodayDate = true;
        } else if (diffDays === 1) {
            relativeText = 'Ngày mai';
        } else if (diffDays === -1) {
            relativeText = 'Hôm qua';
        } else if (diffDays > 1) {
            relativeText = `Còn ${diffDays} ngày nữa`;
        } else {
            relativeText = `Cách đây ${Math.abs(diffDays)} ngày`;
        }

        if (modalDayWeekday) modalDayWeekday.textContent = weekdayText;
        if (modalDayFullSolar) modalDayFullSolar.textContent = `${dayNum} tháng ${cellMonth + 1} năm ${cellYear}`;
        if (modalDayRelative) {
            modalDayRelative.textContent = relativeText;
            modalDayRelative.classList.toggle('is-today', isTodayDate);
        }

        // Banner Ngày lễ nếu có
        if (modalDayHolidayBanner) {
            if (holiday) {
                modalDayHolidayBanner.style.display = 'flex';
                if (modalDayHolidayTitle) modalDayHolidayTitle.textContent = holiday;
            } else {
                modalDayHolidayBanner.style.display = 'none';
            }
        }

        // Khối Dương lịch
        if (modalDaySolarNum) modalDaySolarNum.textContent = String(dayNum).padStart(2, '0');
        if (modalDaySolarSub) modalDaySolarSub.textContent = `Tháng ${cellMonth + 1}, ${cellYear}`;

        // Khối Âm lịch & Can Chi
        const canChiYear = getCanChiYear(lunar.year);
        const canChiMonth = getCanChiMonth(lunar.month, lunar.year);
        if (modalDayLunarNum) modalDayLunarNum.textContent = String(lunar.day).padStart(2, '0');
        if (modalDayLunarSub) modalDayLunarSub.textContent = `Tháng ${lunar.month}${lunar.leap ? ' (Nhuận)' : ''}, Năm ${canChiYear}`;

        // Khối Can Chi Tam Trụ
        if (modalDayCanChiDay) modalDayCanChiDay.textContent = canChi;
        if (modalDayCanChiMonth) modalDayCanChiMonth.textContent = canChiMonth;
        if (modalDayCanChiYear) modalDayCanChiYear.textContent = canChiYear;

        // Khối Hoàng Đạo / Hắc Đạo
        if (modalDayHoangDaoCard) {
            modalDayHoangDaoCard.classList.toggle('is-hd', hoangDao);
            modalDayHoangDaoCard.classList.toggle('is-hac', !hoangDao);
        }
        if (modalDayHoangDaoBadge) {
            modalDayHoangDaoBadge.textContent = hoangDao ? '✨ Ngày Hoàng Đạo (Cát lành)' : '🌑 Ngày Hắc Đạo (Cẩn trọng)';
        }
        if (modalDayHoangDaoAdvice) {
            modalDayHoangDaoAdvice.textContent = hoangDao
                ? 'Ngày cát tinh chiếu mệnh, rất thuận lợi cho các công việc quan trọng: cưới hỏi, khai trương, xuất hành, khởi công, ký kết.'
                : 'Ngày có hung tinh ngự trị, nên thận trọng trong các quyết định lớn, thích hợp nghỉ ngơi, làm việc thường nhật, phòng tránh tranh chấp.';
        }


        // Hiển thị danh sách sự kiện trong ngày
        renderDayDetailEvents(data);

        modalDayDetail.classList.add('is-active');
        modalDayDetail.setAttribute('aria-hidden', 'false');
    }

    function closeDayDetailModal() {
        if (!modalDayDetail) return;
        modalDayDetail.classList.remove('is-active');
        modalDayDetail.setAttribute('aria-hidden', 'true');
    }

    function populateCalYearSelect() {
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

    function getTodayData() {
        const now = new Date();
        const d = now.getDate();
        const m = now.getMonth();
        const y = now.getFullYear();
        const lunar = getLunarDate(d, m + 1, y);
        const canChi = getCanChiDay(lunar.jd);
        const solarKey = `${d}-${m + 1}`;
        const lunarKey = `${lunar.day}-${lunar.month}`;
        const holiday = SOLAR_HOLIDAYS[solarKey] || LUNAR_HOLIDAYS[lunarKey] || (lunar.day === 1 ? 'Mùng một' : (lunar.day === 15 ? 'Ngày rằm' : ''));
        return {
            dayNum: d,
            cellMonth: m,
            cellYear: y,
            lunar,
            canChi,
            holiday
        };
    }

    function buildHorizontalTimelineRuler() {
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
                    const dateData = activeTimelineDate || getTodayData();
                    const dateStr = `${dateData.cellYear}-${String(dateData.cellMonth + 1).padStart(2, '0')}-${String(dateData.dayNum).padStart(2, '0')}`;
                    const sTime = `${String(h).padStart(2, '0')}:00`;
                    const eTime = `${String((h + 1) % 24).padStart(2, '0')}:00`;
                    openCalAddEventModal(dateStr, sTime, eTime);
                });
            }

            dayHRulerGrid.appendChild(tick);
        }
    }

    function updateHorizontalNowNeedle(dateData = activeTimelineDate) {
        if (typeof dayHNowNeedle === 'undefined' || !dayHNowNeedle || !dayHNowText) return;
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

    function renderHorizontalDailyTimeline(dateData) {
        if (!dateData) dateData = getTodayData();
        activeTimelineDate = dateData;

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
        if (dayHLunarBadge) dayHLunarBadge.textContent = `🌙 ${lunar.day}/${lunar.month}${lunar.leap ? ' Nhuận' : ''} ÂL`;
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
                    dayHAlldayPills.appendChild(pill);
                }

                allDayEvents.forEach(evt => {
                    const pill = document.createElement('div');
                    pill.className = 'day-h-allday-pill';
                    pill.style.background = `linear-gradient(135deg, ${evt.categoryColor || '#38bdf8'} 0%, rgba(15, 23, 42, 0.9) 100%)`;
                    pill.style.borderLeft = `3px solid ${evt.categoryColor || '#38bdf8'}`;
                    pill.innerHTML = `📌 ${escapeHtml(evt.title)}`;
                    pill.title = 'Nhấp để chỉnh sửa sự kiện';
                    pill.addEventListener('click', () => openCalEditEventModal(evt.id));
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
                    <div class="day-h-event-actions">
                        <button type="button" class="btn-h-evt-action btn-edit" title="Chỉnh sửa">✏️</button>
                        <button type="button" class="btn-h-evt-action btn-del" title="Xóa">🗑️</button>
                    </div>
                `;
                bar.title = `${ev.title} (${timeLabel})${ev.note ? ' - ' + ev.note : ''}`;

                // Bấm vào bar để chỉnh sửa
                bar.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-del')) return;
                    openCalEditEventModal(ev.id);
                });

                const btnEdit = bar.querySelector('.btn-edit');
                if (btnEdit) {
                    btnEdit.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openCalEditEventModal(ev.id);
                    });
                }

                const btnDel = bar.querySelector('.btn-del');
                if (btnDel) {
                    btnDel.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc muốn xóa sự kiện "${ev.title}"?`)) {
                            deleteCalEvent(ev.id);
                        }
                    });
                }

                dayHEventsLane.appendChild(bar);
            });
        }
    }

    function renderMonthlyCalendar(month, year) {
        if (!calGrid || !calMonthTitle) return;
        currentCalMonth = month;
        currentCalYear = year;

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

            const isSelected = activeTimelineDate
                ? (dayNum === activeTimelineDate.dayNum && cellMonth === activeTimelineDate.cellMonth && cellYear === activeTimelineDate.cellYear && !isOtherMonth)
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

    function initMonthlyCalendar() {
        populateCalYearSelect();
        buildHorizontalTimelineRuler();
        activeTimelineDate = getTodayData();
        renderMonthlyCalendar(currentCalMonth, currentCalYear);
        renderHorizontalDailyTimeline(activeTimelineDate);

        // Cập nhật vị trí Now Needle mỗi giây để đồng bộ chính xác khi sang phút
        if (nowNeedleInterval) clearInterval(nowNeedleInterval);
        nowNeedleInterval = setInterval(() => {
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
                if (activeDayDetailData) {
                    const { dayNum, cellMonth, cellYear } = activeDayDetailData;
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
                    currentCalAttachment = {
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
                currentCalAttachment = null;
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
                currentSelectedCatId = newId;
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
                    currentSelectedCatId = DEFAULT_CAL_CATEGORIES[0].id;
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
                const cat = cats.find(c => c.id === currentSelectedCatId) || cats[0] || { id: 'nha', name: 'Nhà', color: '#38bdf8' };

                const note = textareaCalNote ? textareaCalNote.value.trim() : '';
                const url = inputCalUrl ? inputCalUrl.value.trim() : '';

                const events = loadCalEvents();
                if (editingCalEventId) {
                    const idx = events.findIndex(e => e.id === editingCalEventId);
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
                            attachment: currentCalAttachment,
                            url,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    editingCalEventId = null;
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
                        attachment: currentCalAttachment,
                        url,
                        createdAt: new Date().toISOString()
                    };
                    events.push(newEvt);
                }
                saveCalEvents(events);

                closeCalAddEventModal();
                renderMonthlyCalendar(currentCalMonth, currentCalYear);
                renderHorizontalDailyTimeline(activeTimelineDate);

                if (activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active')) {
                    renderDayDetailEvents(activeDayDetailData);
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
                currentCalMonth--;
                if (currentCalMonth < 0) {
                    currentCalMonth = 11;
                    currentCalYear--;
                }
                renderMonthlyCalendar(currentCalMonth, currentCalYear);
            });
        }

        if (btnCalNext) {
            btnCalNext.addEventListener('click', () => {
                currentCalMonth++;
                if (currentCalMonth > 11) {
                    currentCalMonth = 0;
                    currentCalYear++;
                }
                renderMonthlyCalendar(currentCalMonth, currentCalYear);
            });
        }

        if (btnCalToday) {
            btnCalToday.addEventListener('click', () => {
                const now = new Date();
                currentCalMonth = now.getMonth();
                currentCalYear = now.getFullYear();
                renderMonthlyCalendar(currentCalMonth, currentCalYear);
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

    // ========================================================
    // 8. KHỞI CHẠY HỆ THỐNG
    // ========================================================
    syncColWidthCss();
    renderTimelineScale();
    updateCurrentTime();
    renderEvents();
    initMonthlyCalendar();
    updateAuthUI();
    initFirebaseSync();

    // Cập nhật vị trí vạch thời gian mỗi giây
    setInterval(updateCurrentTime, 1000);

    // Tự động cuộn đến ngày hôm nay sau khi render
    setTimeout(scrollToToday, 50);

    // Lắng nghe sự kiện cuộn để ghim nhãn tháng ở mép trái
    timelineViewport.addEventListener('scroll', updatePinnedMonth);

    // Tự động điều chỉnh khi thay đổi kích thước cửa sổ trình duyệt hoặc xoay màn hình điện thoại
    function handleScreenResize() {
        syncColWidthCss();
        updateCurrentTime();
        updatePinnedMonth();
        renderEvents();
    }

    window.addEventListener('resize', handleScreenResize);
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            handleScreenResize();
            scrollToToday(false);
        }, 150);
    });
});