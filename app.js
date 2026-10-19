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
        // Tự động nhận diện tài khoản đã lưu nếu người dùng chỉ nhập tên gợi nhớ (VD: gõ koyasaki tự nhận diện koyasaki261207@gmail.com)
        const savedAccs = getSavedGoogleAccounts();
        if (!email.includes('@')) {
            const prefix = email.trim().toLowerCase();
            const matched = savedAccs.find(a => 
                a.email.toLowerCase() === cleanEmail ||
                a.email.toLowerCase().startsWith(prefix) ||
                prefix.startsWith(a.email.toLowerCase().split('@')[0])
            );
            if (matched) {
                cleanEmail = matched.email.toLowerCase();
            }
        }

        const usernamePart = cleanEmail.split('@')[0];
        const existingAcc = savedAccs.find(a => a.email.toLowerCase() === cleanEmail);
        const name = customName || (existingAcc ? existingAcc.name : '') || (usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1));
        const userAvatar = avatarUrl || (existingAcc ? existingAcc.avatar : '') || '';

        const userObj = {
            id: cleanEmail,
            email: cleanEmail,
            name: name,
            avatar: userAvatar,
            loginAt: new Date().toISOString()
        };

        isInitialCloudPullComplete = false;
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
            if (typeof scheduleCloudPush === 'function') {
                scheduleCloudPush();
            }
            if (typeof showToastNotification === 'function') {
                showToastNotification(`Đã lưu thông tin "${user.name}" và đồng bộ đám mây!`, '👤 Hồ sơ tài khoản');
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
    const btnCloudRestoreBackup = document.getElementById('btn-cloud-restore-backup');
    const inputFirebaseConfig = document.getElementById('input-firebase-config');
    const cloudStatusBanner = document.getElementById('cloud-status-banner');
    const cloudBannerIcon = document.getElementById('cloud-banner-icon');
    const cloudBannerTitle = document.getElementById('cloud-banner-title');
    const cloudBannerDesc = document.getElementById('cloud-banner-desc');

    let firestoreUnsubscribe = null;
    let cloudPushTimeout = null;
    let isIncomingCloudUpdate = false;
    let isInitialCloudPullComplete = false;

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

        isInitialCloudPullComplete = false;

        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }

        const docRef = firestoreDb.collection('user_calendars').doc(cleanEmail);

        firestoreUnsubscribe = docRef.onSnapshot(doc => {
            isInitialCloudPullComplete = true;
            if (doc.exists) {
                // Nếu snapshot này là do chính tab này vừa ghi (pending writes), bỏ qua để không ghi đè dữ liệu mới
                if (doc.metadata && doc.metadata.hasPendingWrites) {
                    return;
                }

                const data = doc.data() || {};
                isIncomingCloudUpdate = true;
                let changed = false;

                // Tự động sao lưu cục bộ trước khi nhận dữ liệu từ đám mây (bảo đảm an toàn tuyệt đối)
                const currentTLRaw = localStorage.getItem(getTimelineStorageKey());
                const currentCalRaw = localStorage.getItem(getCalEventsStorageKey());
                if (currentTLRaw && currentTLRaw !== '[]') {
                    try { localStorage.setItem('timeline_backup_auto_tl', currentTLRaw); } catch (e) { }
                }
                if (currentCalRaw && currentCalRaw !== '[]') {
                    try { localStorage.setItem('timeline_backup_auto_cal', currentCalRaw); } catch (e) { }
                }

                // MERGE THÔNG MINH CHO TIMELINE:
                // Nếu máy cục bộ có sự kiện mới hơn hoặc chưa kịp lên đám mây, KHÔNG BAO GIỜ xóa mất!
                if (Array.isArray(data.timelineEvents)) {
                    const localEvents = loadEvents() || [];
                    const cloudMap = new Map();
                    data.timelineEvents.forEach(e => {
                        if (e && e.id) cloudMap.set(e.id, e);
                    });

                    let hasLocalNew = false;
                    localEvents.forEach(e => {
                        if (e && e.id && !cloudMap.has(e.id)) {
                            cloudMap.set(e.id, e);
                            hasLocalNew = true;
                        }
                    });

                    const finalTimelineEvents = Array.from(cloudMap.values());
                    cachedEventsMemory = finalTimelineEvents;
                    try {
                        localStorage.setItem(getTimelineStorageKey(), JSON.stringify(finalTimelineEvents));
                    } catch (e) { }

                    if (hasLocalNew) {
                        setTimeout(() => {
                            scheduleCloudPush();
                        }, 1000);
                    }
                    changed = true;
                }

                // MERGE THÔNG MINH CHO CALENDAR:
                if (Array.isArray(data.calEvents)) {
                    const localCal = loadCalEvents() || [];
                    const cloudCalMap = new Map();
                    data.calEvents.forEach(e => {
                        if (e && e.id) cloudCalMap.set(e.id, e);
                    });

                    let hasLocalNewCal = false;
                    localCal.forEach(e => {
                        if (e && e.id && !cloudCalMap.has(e.id)) {
                            cloudCalMap.set(e.id, e);
                            hasLocalNewCal = true;
                        }
                    });

                    const finalCalEvents = Array.from(cloudCalMap.values());
                    try {
                        localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(finalCalEvents));
                    } catch (e) { }

                    if (hasLocalNewCal) {
                        setTimeout(() => {
                            scheduleCloudPush();
                        }, 1000);
                    }
                    changed = true;
                }

                if (Array.isArray(data.calCategories) && data.calCategories.length) {
                    try {
                        localStorage.setItem(getCalCatsStorageKey(), JSON.stringify(data.calCategories));
                    } catch (e) { }
                    changed = true;
                }

                if (Array.isArray(data.trackOrder) && data.trackOrder.length >= currentTotalTracks && !trackToHoistOnRender) {
                    try {
                        localStorage.setItem(getTrackOrderStorageKey(), JSON.stringify(data.trackOrder));
                    } catch (e) { }
                    changed = true;
                }

                if (data.userProfile) {
                    let profileChanged = false;
                    if (data.userProfile.name && data.userProfile.name !== user.name) {
                        user.name = data.userProfile.name;
                        profileChanged = true;
                    }
                    if (data.userProfile.avatar !== undefined && data.userProfile.avatar !== (user.avatar || '')) {
                        user.avatar = data.userProfile.avatar;
                        profileChanged = true;
                    }
                    if (profileChanged) {
                        setCurrentUser(user);
                        saveGoogleAccount(user);
                        updateAuthUI();
                    }
                }

                if (changed) {
                    renderEvents();
                    if (typeof renderMonthlyCalendar === 'function' && typeof calSelectMonth !== 'undefined' && calSelectMonth && typeof calSelectYear !== 'undefined' && calSelectYear) {
                        renderMonthlyCalendar(parseInt(calSelectMonth.value, 10), parseInt(calSelectYear.value, 10));
                    }
                    if (typeof renderHorizontalDailyTimeline === 'function') {
                        renderHorizontalDailyTimeline(activeTimelineDate);
                    }
                    if (activeDayDetailData && modalDayDetail && modalDayDetail.classList.contains('is-active') && typeof renderDayDetailEvents === 'function') {
                        renderDayDetailEvents(activeDayDetailData);
                    }
                }
                setTimeout(() => { isIncomingCloudUpdate = false; }, 200);
            } else {
                // Tài liệu chưa có trên đám mây: CHỈ đẩy lên nếu cục bộ thực sự có sự kiện (tránh đẩy mảng rỗng làm mất dữ liệu)
                const localTL = loadEvents();
                const localCal = loadCalEvents();
                if ((localTL && localTL.length > 0) || (localCal && localCal.length > 0)) {
                    pushLocalDataToCloud(cleanEmail);
                }
            }
        }, err => {
            console.warn('Lỗi Firestore onSnapshot:', err);
            isInitialCloudPullComplete = true;
        });
    }

    function pushLocalDataToCloud(targetEmail) {
        if (!firestoreDb) return;
        if (!isInitialCloudPullComplete) {
            console.log('[Firestore] Bỏ qua đẩy dữ liệu vì chưa hoàn thành đồng bộ ban đầu từ đám mây.');
            return;
        }

        const user = getCurrentUser();
        const email = targetEmail || (user ? user.email : null);
        if (!email) return;
        const cleanEmail = email.trim().toLowerCase();

        const timelineEvents = loadEvents();
        const calEvents = loadCalEvents();

        // BẢO VỆ TUYỆT ĐỐI: Nếu cả 2 danh sách sự kiện đều rỗng thì không bao giờ tự động ghi đè lên đám mây
        // (Tránh trường hợp trình duyệt mới mở đẩy mảng rỗng đè mất toàn bộ dữ liệu trên đám mây)
        if ((!timelineEvents || timelineEvents.length === 0) && (!calEvents || calEvents.length === 0)) {
            console.log('[Firestore] Dữ liệu sự kiện cục bộ rỗng, bỏ qua đẩy lên đám mây để bảo vệ dữ liệu đám mây.');
            if (cloudStatusDot) cloudStatusDot.classList.remove('is-syncing');
            return;
        }

        if (cloudStatusDot) cloudStatusDot.classList.add('is-syncing');

        const calCategories = loadCalCategories();
        const trackOrder = loadTrackOrder(currentTotalTracks);
        const userProfile = {
            name: (user && user.name) ? user.name : '',
            avatar: (user && user.avatar) ? user.avatar : ''
        };

        // Tối ưu hóa dữ liệu đẩy lên Firestore:
        // Giữ lại rawImageUrl đã nén (< 120KB) để xem ảnh đầy đủ trên mọi thiết bị, chỉ lược bỏ nếu là data: siêu lớn chưa nén (> 120KB)
        const cleanTimelineEvents = JSON.parse(JSON.stringify((timelineEvents || []).map(evt => {
            const clone = { ...evt };
            if (clone.rawImageUrl && typeof clone.rawImageUrl === 'string' && clone.rawImageUrl.startsWith('data:') && clone.rawImageUrl.length > 120000) {
                delete clone.rawImageUrl;
            }
            if (!clone.rawImageUrl && typeof getKnownRawBannerUrl === 'function') {
                const known = getKnownRawBannerUrl(clone.title);
                if (known) clone.rawImageUrl = known;
            }
            return clone;
        })));

        const cleanCalEvents = JSON.parse(JSON.stringify((calEvents || []).map(evt => {
            const clone = { ...evt };
            if (clone.attachment && clone.attachment.dataUrl && clone.attachment.dataUrl.length > 100000) {
                clone.attachment = { ...clone.attachment, dataUrl: '' };
            }
            return clone;
        })));

        const docRef = firestoreDb.collection('user_calendars').doc(cleanEmail);
        docRef.set({
            email: cleanEmail,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedFrom: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            timelineEvents: cleanTimelineEvents,
            calEvents: cleanCalEvents,
            calCategories: JSON.parse(JSON.stringify(calCategories || [])),
            trackOrder: JSON.parse(JSON.stringify(trackOrder || [])),
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
        if (!firestoreDb || isIncomingCloudUpdate || !isInitialCloudPullComplete) return;
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

    const EMBEDDED_RECOVERY_DATA = {"timelineEvents": [{"imageUrl": "data:image/png;base64,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", "isForever": true, "note": "", "repeatType": "monthly", "id": "evt_1792248788879_0", "color": "#70bcf5", "repeatId": "rep_1792248788879", "title": "la hoàn", "url": "", "end": "2026-10-16T02:59", "rawImageUrl": "https://paimon.moe/images/events/spiral_abyss.jpg", "start": "2026-09-16T03:00", "tag": "la-hoan"}, {"rawImageUrl": "https://paimon.moe/images/events/spiral_abyss.jpg", "color": "#70bcf5", "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAAyCAYAAAD1JPH3AAAQAElEQVR4AWy8CdRuWXrX9Xv2PsM7v+83T3eo4Vbd6qrqOemM3SHdGUFZJAYBRRZrObAEUQjBxCAqulRGUQggC9QoGAUBwUgCMRoT05ma7iRdPdTQNded7ze/8zlnb//73KpO1tJzv+fd++zh2c/w388eTnW7w+/4D+LRd/8n8cpv/U/j0T//p+OV3/5n4pXv/Qtx/1/4C/Hq7/0rcfv7/nzc/d1/8RH9nv8y7v2ev9jS/u/+L+Kh8lvf+5/Hjd/xn4j+VNz+7f9RnHzHD8WN7/jBlja/+4fjzm/99+Peb/uTcVe098/9h3Hju344jr79h+LGd/6JuPtb/6O4/Z1/Mm5+2w/H7W//E3HzUz8UNz/5g3HzU/9u3PnUD8ZdtdtSuvWtfzxu/pY/Jvr+uP2tfyxuf+L749Y3/5G48Y1/OE6+/g+1tPF1fyhufOwPxc2Uija/4Q/HJ777P4if+jf/Zrz52/9kfOy7fiAefuu/HQ9+yx+Jh5/6gXg1kfhe03hXRUca+0hyHHz7D8eDT/178eBbfzAefssfF/278eC3/FA8+vY/GZ/+vj8Xn/pdfy5uqd3gm/5YHH/8h+L2d/ypePX3/bX4yR9/Nd78G5+OV/7434l7P/Bj8cZf/j/j1/6DL8Thv/5X4+6/9CNx4/v+Yjz4nv8q7nzffxUnv/svxe7v/5F45T/+R/FD/91n4+Gf/cn4/P/wz+L1v/nz8X1/99fjY3/z0/G5v6XyP/OTces//ofxqf/2F+P7/trPx80/8N/E3d/zV+Lev/iX487v/Etx93f9SNz/3X81bv7eH4n5H/ob8Zv//kvx4If/Xnzi+/9u3PjD/138hh/7fHz+L/xU3Jfco4//oOT992TXPxFv/I7/LD77fX82PvHb/sO484k/Erc//kfjzsf/WNz+pu+Pu5/4gbj3LT8QDz/5A/FIfjj6dtng234gHnzb98eDT/7RuP+tP6C6PxoPP/Fvxb2v//1x8NzviP33fV989rf9qXj9u/503PrW/1Q++s/izif/87j7bX9a9vkzcfu7/qxw8Ofj/m//i/Ha7/yr8dl/9W/F9/3rfzs++wf+x/j8H/yx+IE//D/HD/07fyd+7Pv/fvzQH/zb8Wv/nf8pfs2//bfjB/+t/z6+/w/+zfjM7/1zsffR3xfLZ74nTp7+nrj11PfE7RvfF7dE209/b9x8KtHviOOn/4XoIhBCJMZ3yfSeCp1RVWtSNqo+ZUxtVI3pR62pY6Cu67Zv0wS1r8Ec77UPdUO1XrMWxRBomhonHpl4J14hvQMm5qGqSe1TWVR50zQ06h+VRo1jGtOLt1NrM70kUh6VtRzsN8qSzDjH7v4+9+7ewaoKVzvJ0mNdj5UOWVc96qagqjOqJheVVKFLjANJ84jW9FjFDk0s8daBFazPVsQqkDmP0/gmiqFhOZ3RMa82FVuhYPnwDDtbkC2DREktHcEgi0YvOPrRcfbwlFh4Hv/w+zk9PuXkzn3OZpc8+f5nOD0/Z1Gt2b9yxNWr15ldziR3ReFyMo3sNb45h9P4QeSGXeKgZNZUJK8Vgz6r3LBBh/V6RU/9So01ngwp8px6HVnM6paqJeKtsrqrtCO795Qm6lCvumpbKhVV4lXnLCvHSuWx7stnyLY1d954lWp2gSeAKMiKUTnTj4VI8mNoMVIJb6oVDtRE+UhoouxuNKl90aHJHI3PCC6jMemYF+SdLsi+JtKI6qo+4ivTk8aI4mexwRn6Z6KU8uixlEiQBFKz9i2VtBQETPHRYIZpOnQHXcyUR6Z1bROcDG1mOJGZ6kSpXxQ4JQmkwdGjVCygDjJi3Za37TRGmgAtqU0S2DRoem/rNY5w0bISl0fja4xUlkDjvE/FnJw84HK+4uGl8XDaYR7GLOuBnFWyXhrrRS3HVCxWFcvlnNVsyvLykrloOr1gtVhSLRdKp1xenApUl5g4j4ZjRuMReZ7JmJHV+SXLr9wmm1fUanBxeib7OJa9nLCpySNDeyna+EglZVZKy+GQD3/owzCvefEX/xnT+Yz9q1for+CLP/2LXBlt8f6b72N+cclLv/4CV65c4Zmv/TCr0lELmI0zaqm5Lhzl3gbPf/hDmmg1RVGyskBV13TqyP1X3qQ1VO6ZbIzJs0z6B+azNfPLBc26plquqBYLatmgWs1YLs5Yzh+KjlnOjlnPzqjmF6IpzfSMMKvwtktTXKfxu6xjl5Um+Wq1woeIl5UyczilydcyGWaWkjZN4EsvbSqHhQRoodlST/WLcqSLHqeJ75rEpyAoAJjqUF3bT3Y0e8QTTSCH4VQv6CmrRqaXiFM0Mhoi6UnNE0W9RjklxoCaEGUwDLGBFKGLokjFKjK+Cma9iTOxFTjQKAI3MnKiKCNGRU1ramIUaUQTNws1plkc5YioNKh9rCsaTcNG/II5xA6JIwo4r/EkRxozkaXZm5RUeVAcWwgcpwvHebbDdHCdMN7T7A/UzQXNesZ0tuJyumJ1OWc1XdIsl4TVgrhawqoGRbZGTlpqUlxO15zOay5lArmToujR6w2SCwQcuPO5L5ALJI8//hhN7mjeeMj8zfs8/c0fZXU0ZjkqWXcLZpMOy/0Nrn7DRzkT/7dfer0de3//iLCs2egOmS/mvPPGm5w+fIDXpJmdnXPv5deRT7nysfcz2+oy3+2z2Bsy3R9w7UPPs1H2uf1LX8SfzbSq1Fy7dpXX/u/PUL+qFUr2Hm5t4DLP9GLFyelKugetVjlVlQn8pnwllec01VzAnlKtptSLS9liRhTQo+xi6yU2X7B+cIoasHA9wugG655A7RzIn5q3srzHJ2GTszD5ivbx8k3uPCkoBYGqVoBr5OfW1ykvTKBUsx45ScFC3QTsxCD3JcRMWa/yDEKOEEA0R9SIIQoI8o2LGiRaVGEEATXJ5b1rQWRmKkeP6vT73p+TkClimoQSIkkg9Zr5eZbjNQDR1D/xhEzloLwmhEWNqOjbKiSQ1gJsvV6jxpoQapOUUbk0hpSqvURr602zOOVdEiJETGOYepnzJOOoAHOGmSWRVAbTaSNn9cg6u4pMMv7FMdXxbaiWlFmHQX+TXm+LTm/CsLNFN9ugm2/S7+7Q721TKO309hiOjhhPrpKpbr0qUSBnsZAZ8w794UBROSpqLXnrlz/HyVtv8/iT1+nKhvXbd7n/pVe5oUj71Dd/PU9888d439d/He//+Ddim2MWZcbB+57k2lNPcXL/mIfacrx66x32PvYB5v2SB8dnNJrcu3sH1PM199+4jQng7/u6r+Xm138Nz4nXB7/ma+llJS/97C9TC2jNfMkTGzu8/gu/SnX3BLes2N8/wMs3Jw8umV6uaBrDfEnZndAf7TMYHzAcHzIcHdIb6F36DntaLfpH9Lr7lB3ZotzASX81puoMOZ7d04qwIhvsUGw8hslO2l3hvXibQx4ClBc55DX5yzmHzzJaAGs7mRwVk5/lTyf/xqoBtTdIVdRauUn9fMHmzi6+02GJJqKL1C4QEiHbq0zdlGs0kno7Z0iGxAYz6HY7pDIVoNd2z5VJEA1DSr13qAtRgqAWZoZ3XphymHm8z9TfU2v21Y0Aq6ESn6gJ4JRXU4IUqeu1cFsTFIVTNFaheEQNI+Crbav4b5oAsdHaIZ0TH0zjmcOUeq+8E2mQKP7qTZQh6qYr2TfItTbnmv3r2Yyi02MwUhSc3mF29jrL83dYnt3TluKuJsADzs7vKYLd5uTkHS6O32F2fpf5heof3mJ1KifOL/H1qt2arFcrzUWj0+kSZZM0OR+88hp3br3N7vOPs/JQ3puz/OybnH/+FmevPeBYW5M3P/dlXv6Fz3H+6jucv3abi1feojmd4qvIE9euMj+/5PDKESk6n56fMdzcoJa9nBx++4uvcu/XX+b4BY3zqy/z9ude4o0vvERQRMz3N3nsg+/j3otfwc8WFDiuaf/tXc758TlrrTRpZayXl8xO7zB9cIvF2QPOH9zm9O47nN5J6T2lD3h47x7Hogd373KileL0+ITzE6060yB5bmBZh2q1AJ07XLZNRxPAdzaoXEljuSAmZ+iPaJjkyFymX9f6NwrMYVVpRVxrf75+VCYsBZVXi7UWRpVXCRcJCw4nQE92D9i/8TRe273KPMI/qqUNxgbJ7+hJI5BlTrOwSKVijmbxVPm2OSZDFpmnWxY4J7B3CgmoOkVPTUZFZNN7iooBnOHkWBM1qseM9EQpFTHMjFwHEiS8pYp3KQioYo03h0XQbzu+03sCr6mdqSIJHTEaUUxA14Rp1LflL56oPPU1aWtysGkp8tkY6OGagqwcUU72uNCBq7k8Jm/muHpBpjRrZoTmXJPwRMvvQ6rmhCacslrdl4EfMBGbJ5/YZEdbhkaOXGp/fXk51z5zCRFF+4EiTyQool7cPeb2y2/w5LPPsurmLHLHQi6ehooLRZX0HmULVg2NHLuWDr3RgG/+xNdx+0uvcPzpz3Prs1/gqrYhg/FIkzOS2q+DBnI5a/Wdy2er3Ah5Rp1lDJ+5xmh7g6/80mdAq16mtpPJiDOdB+7ff6BtzIIoGYJkyFxge2vA9u6AbieQ+RWEC9npnGhnuGxKXi4pypUCwIpOd01ezGTdc5rlKeuwUJtS74X85ankMVyXtIJVrtCKlaKnWFrCRMDMSL5E4tdpVdbWZK1gsJjNqbR/b1SWMLDQdmamM8M0kQ7ZKUAgX9aidWP0J9s8+YEPceWZ5+hvbhI8iSXp10Uj/XMoCQLHSgMEgTAIwCh9FA0b0hNVVinCqTEzrbdJmEazKTZBTYP4SVIZMCqJ4sdvIjOHd+5dhRx5XuAiLXlMAJBBnXIqQ3I4KW8a36muTVXu0BMM+YOorYtrB4pqAU68Vfvunyk1zBxmaSviaIKjjn1qxmS9I6rYY6nNdWbgdCOgMxYd7ynEp1S/wmeUeamtyIDxxhY3nn6Oj37s4zz+tMApcyxlh7JbkmmCV4oiUxl+Pl20snV6A5z+Bb0v3rnPnS99hb1nnmT84ZuMv+F5et/4PBvf8kGufPOHuP6R56hLTwL5xs0neOyJJ/nln/g5pm8+YFzn5MdLXvnsC1y79hgRDz6j6Xc4/LrnGXzT++h98jm6H3+O4UdvsnPlkM5lza3PfImuHC+cc3R0qP1xYCFZVorMMgJR9jXn8QoqLsvoDnps7e1y/YnHeeypJxlrJSilV1TIAId3OUXWIbMMBLrYLInNCav1HfJsi7yzTxtwFGzMZByl73pFMkOUL1N98lnCSlMHaq0yzboiip/Jp0H7+6WAvZzPSQBe6xyzlMyzyykXFxdcTi81tPqJfSNfNr5kpC3YcGcHyyWXaZwIKEUyO0mkEmik7KPBAwg5lkAlUhfdACw1WEWjmRIVgSz1FqgSn5Ys9UCsAkHlIUSc8y17M48lioZTeZqBGgqkTAK2B9QdEKc2E8UnUWiLHnHxaqNK9XdSjCoQ1T/qwBDFl1SrMdBj5tIv2Focl1SaeIZ4q8erxQAAEABJREFUqTxaB5z2cKmPhkOCmHe4wss4ouTk3oi9/Ws8ffN5nn3u/VpKh9x7eMydu/flSDnCi5szvCaBmbXGngnUl9MpaIxef0juStwa5m89aPeyr73wJYJQVlwZEfY6vHnxIEmED1EHsBWWed7UVmX58JKeNgq5rko6jcN0YH3rpVfJioyoNqYxT7WaTEeR/o1dtg5106AI95a2HHd/5Ytkp3OQXQbDiQLPmunFVKvLWn4L1I1Iq1YwT/QF0QqqmLdUa8xef8L1a09qAj3JxuY+3bJH5gRmASjUQYGnplZ0D4rHjQKCJCDLRiT7Z+It1ZNpMQUciJjGkUFkb40XIaTyKD5q2whDiVRImmSVVpQUrVda9WoFiUYBNMo2jfKpPEXsuXRZ6VYqNhkheOk3JwVVccYsEDVG0t2ZGU3TSASVWFQq5+tXkgFqqLypPCj/iNQu/SUOIlW1TU2t3yNlkTuw9C8aToZ0KnFOv87z3hPV/z3SMG1xTCBTP6d+kjOJQCut2jq1kMCYibNk0Ou7f/bV1PA4jaEmmNBvVqn7QvmAS0Y2TVGlDUZjTrdmFZfVio72FNtHV3jimWd5/MZToJXkzsMLprp5aMgJ9oii+koU0pNpAqQVJ2iizwW+tQ6KTpAsO5tkOkQFbaKzkwXZnRPdUryIbtTYPdzEea1KilD9yig0Kbsay8Qj87nYKsbImT4YHTmvGwttiTK8xifJTMC0jXHmmH7lFvPPfBl7kCaT4ft9xqNNXbPVnD/QnnlRsU7yryKaUWS+p8jaxwmoDRnRMtCY5jwrgXYpGfJun/2r1zi4do0NRe9Mq9FKWwRhUP0cqK/Pt7BiRO0DmpWYgZMtXJYrb+iH9JiZbB9TlvQbpFfCWqLk9yBftySQt6ne1QGNQvJ9Sl0MNIroK4F9LeCnskq3LjNFbpy4puGcbKaxZKS27yNBVRc1i6IYJKIVIcp8QdG7IWjWtDNH5Yr8RGeasUEzv1YJj3RIPCRUkIAah0ROv1FlKVVCeBcNUWlSIra9SXq0SpiA7GSnViE5NfGIMkRq0PZRxEWMzFSj8UyUljMVpSaqCkgFMUz1FSHOCUGRK65wpslkJVYOFWdKFopQsTtmfHid/SefYOPwkLW6va0956mWvAZHSE5v+6W+SQunyFSIkvM8TnU+K2kaY6VhmnWp8Xr4fCRQD6RdxlARML58l7N/+s/IvnJMdw1ZdHj1yfBMT0+0l6xamSNO/QO1FKs95Lrqy/sFjSJ87aAQyHvngdnn3uLBp79IcXeGrSomG5sMOyMd8pZML9dkvsulInZavhtNHid+mSJ8O9lJQwXpJqIhgbWWHmtzrGV/4Zq8U5L29ZPtPUbbB+T9HWI2hGxAd7ihvhmBTJPNCMs1Tv6I0tZcJu4yon7Tn9mjfOs7OSmliZLvQ9O0urb531THu/6WyIhly7sRXpyAm/nIuQ6yy8VMfg6qN4q8T170pUmmbaTGSzMwMTUZGQEwkXCCSUEkUGLknWsnRAtWAdZL8dxLIZeT+lkCnwaVlogzQVZJglsqEMKCKAloKg8CZdSdc6qP4pVmbEgTRvmkTEwKqV9jjVhJaOWRwkEGSFsjNI6lySceIZVL2KAlOlEtOWrxSeXWRudTGoEa6YnVqFrReJtMd9Lb129y80MfY+fqE5zqq9lDHfIuV2tqNW7krFr2qDVmkGxpfJd0dgVeEVtmxGvZ9lqSvaJWR5Mk6p50vWxASIwCni/7WE8TJ6wpdXqPX3ybF//Jp5m/cR8nFNXSI0rWSteLOzv70tVoDNYC3tw7bG/CxvVDTrSXrPUeZe/Ub/n528x//mXKezP5xDHWNsc1kZmi2ErR2ELBWqtFKSd7X+DU12WGy4LyNbiGiMAsvUJsaKRx0rNOMiXxRYt1YKaJUuHZ3n+Ma0+8nx2lPX3wcVpRomxrChKZeNIsyCyQvjtHpWYm/oBWHw0G5pCqGtHQzyOSvDH5TgoH2VmvkiO2/RoX1Qecs7YsYUfrIx3xlmJy40oBIZIlZ6ppCrSdbof9vf0EfiMpjB4TtRxTRg3bVxk8c54okJV5h0wKIiFo0GpjepfhJU2UMbQyte2CPpY0eokxCgdSVCnqHxoZUkqYeKe6JHcao61Tm0agTxTUoFa7BEqZgkRmkMyUKMmSSM2IAlmSOfFrSeOIDUjZKIchMMVGjkfbjrigXlywe7DPx779u/SJ+YOc60R9pkjW6MthqHLqdU5UGhWqoz7xJj3NDHO0T6Xlb6273VhLL+3lvMDd7w6Y9Ia6NamZP7zH/PQBWb2UvDWmvW8uuzkBvB9LircXFG9NKXT9VYtHT9eI8/vn7B8ccPVDz7Dc7FBt9eBokxsf/RBzbSeOX7xFJnBs7Wwz0CR68MKrlCcryqYg19ilbm/m4jef1qSJ9fDhGRdTLReW01c0HQiEWZpcLsMpALVbG3ME55CE1O/6rlpG1poQS9Fa9gvyeyV7TvWhKWhS7F+5wZNPfVTXnhuYnxPduT6Dp48/K8ytMQWg5AP0mCj9mfDS+kgrADjSu4FyYDG2FDWpjEdPtIjTmKml0/ip1FTZzeX55QUP33mDk9u3QFgybRUsSod1g5duebJzVI8gxl57ILx66h0VplymstFYS6dSZzKAQJpA6NQ+gTABp9IptdGSFgSeIMGiCqMYtKnaBU0IoY4ogKY+j5QImIQOv6ks1amREvVWXao3gTUo32jCNOl0rLQ9oKhflBPUmCRP1DimcdG4ZpJcskaZTMUQKkwROoRTRjpMPfv0NcaDPm+99Q6vv/YmYRVo9xmKqk3j5VzTQVL2qox27ybwLlsKrNZRdnRg/hFJvhi8gkbN9PgSp+jck5EXAtT09BxCkANLSFdanQnLVUFRd8gujIs7Z+xs7+HrjDJkfOHLXya/ssVT3/WNXP2Wj3Dzmz7K2bkc+JW3KacV8XLJkdoff/kdNqyr7c2KIivItEKsVya5MnI/4M6dY7Ksg+UZDbDQPnohuaDEZT1RV+KXGBlRYIiyU6O3BFxhGKnNWio20lEwoTZ0cAws9JXwQjcRaa/d7ee6RRkyHhsxnFN20VgrjRbELSrVn3iTKCif/lRsyV7yUfKXLIlpAri4JpOPsljJDjWFgJrpMBjmM33BvaQv7JXC1eWDu9x+7WXdkb+Nq1Z4YSGGiGYlUXY+OT7m7bff1OIjIKYBKm2403IuOJHeoxrnec7p6Wl7fbJerwgCrhFUH9p8pau+mICUkKPUtcIGKeWw9E/lUYOpA1H8LEIUwN+bEOkdtUn6JmCqu3pBEK9UbPox9UPvKsUp/xtlSdLU812ylBox9bH0YpicYjJGma3Z3+/w9FM7TOd3efjwtq5ql6AIECVtigqx1auRCNJNxm0ShbXaOFGHaAKB76hLgVOUc4qUmS8wPOYyfLdD3utS9nv0+l3OT844e3hGB4FOW5HCFQwGY7Up6XdzHt49pSj6bO7uoj0RuYZ67bNf4uL1e8QHM2Yv3ubixbcx3VUHczx5/Ule+sUXqN85Y1gVTAabZAL0Wjc+SIqi7HByfEqMRpRe3uekA2upcq92qVkC9kL8LBZ0yzG9fKj1pUumCeItJwgkQdGu1p54OV1qX78m1LKJfJiC1lqgrtaX2mFoz3/5gN1JjxuPX8U5WdHLDvKvoScqo8Sw9tcJ2Ka84fTrwFQvvzit5F5g9vpyG+fnVBcPWR7f1Sp3l8XxHa1Otzm//SaLh+/QTI8xje8EdpOciR/mcC6Rxwzp3uC89yRK0fhRpeO9Z64Z2QIQS25LPUjA1A9ICXOGCWTtuwSMUiTJmjhoCFoAom4ySHyP1CZoFqb3oDL0LgSrEeIFKZ94RPQv1bWkcv2ZGU5kPHrSeIlHGgc58lFpqpVTJXPSaUufmK/oZqFX1rzxxgs01Rnm5Cg1C3KiTIDEacdFk7vdKqnOZZG8FFDzEqGVqCgbBOJGwGx8SZOVuG6PcjigGA5FI2zQxY165KM+pcC90Gfm+28/wLSdSZHE+5wPPbXPv/YvfYyrWwVvvfkGc03W3ceuYXLSRLci9ct3mL7wBovX7pFfBkqNOdFn39deeYPm4ZSBthld12Ot1WKh1cVpP7vWynnn9j3p4HEuw3lZP8vJyi6+6JAr7XT7FNqeBDLOBdbTs7l4OJx4ZXlPbQZkiuyldCujJ5NcTvYwBaAkO1ZSh0xbkhq07cqbSsB7QK2gtjnZpFuU5BozucEMWT9gZrRgFj+vSe2Ck4yIAk5Advri6qo59eyM+lJ0Ibo8JS6n+GpGUU1pLk9YntxX2Zxc8rTBUJiIhMRIv4H47j8Te9U3hNTQO3zuqKiJTo19VOCoMW/4zJPQFjSjqmYlDAYsQtShLKp9UDSLMgDvPQJ5G0lTm0R6R2QmTTVbCYaT5l6CEQKkOgllYvoIim0nlQSi2kQZtSUaolOd+KgGcG29Guov8VGR+HvzjASua1eP2N3dwgjM9MUsas8aayNWpfoVYDmxKdt6Yi08K2prLBTBYuxThb5Ey9r6GCsqfapvZCs0vv5wzjCRTJSKMK9lXOTyUuDp08kKGn3UuLh3TAr2jcCJIuDXPDnkqe0uSwH+ztu3eKBPyo8/9RSlz+lWjq62Pk2RsxyWbOsT+PEbt+H+BV1ti8r+iGUGOEevP1GywsjoaHL1xo700acv8A6GY/ra1/d6AwaitqzXZ9AfqN8AJzkX+jy+XK5Yy3S1KylHO7jBhDrrygQ9yProh5UOymsdEPNS2ybrMw2l1HAk3Cz1dW+h7UGRZWyMhxTCEMKEtX4SfizgI9oimHwecMIPa4F4OdP14oyFPtRV+pjSaJIERV8fAhZWbVsvnxQynEvYikhPo7W18l6+dyL0JECrUjnUT4Cp6woTaFdKnQyVQBQSYxADA0XfRmEsgUrYoKkFrHffU5kJkLElwUyDR5FyahoxAZdgGs8RlaL3qDHb0fVjpjqRGujt0d+jeokZNfRvakt61zhJEY9XF9cS+kV80VOWJYe6frt65RpBMl6cX2q/2eirWc66LlgkMNsO3fyARoegi4tTlusFSxm61nLsBfBuvkF0fTnSUytyYnKMq/ByUrJPEtd7jW1Ow5pIsrgcnBdlSnKKTpcyKxnmXZwi6f17D7jUtu7NO5E//5c+w5deWtG3Ac3FipO7J7z06mscPHcTDrdY74yxqzuMHz/ijVdfxwn4HR0q0wEy3ZkvU6RzBeenD/nIh67ywY+O8JkjLzY07hjXbjM8yadkjyZZ9AXR5yAquj0GownjzR3yosta++zj+8fcvfeQuXzU2TmkHOwpoAnYVjCfXXKhj0GXukXJNFnQVmkRclaUmvTiH1DAOGN6/oDcasGsIhOoPRXe1vLOWo5cEdYJxOdUM5EO59VqqkP4kkbRPig4QkIN/5/HzFRmyPWkeKMX2VxlKjczzKJIQhBxZioQiM3LQUofgUldBKQoQLRgT6+KbmovbKsTprHFROWonendNH/WbJcAABAASURBVFpqb5oIaU+aymPqICHVWK810RoeRdjUEZU9Sv//f8XV3q1RmuRK/GIqSj+JNKZp7ChC1EjbnpZ65zwnJ6dcKgLVWiarMJDxt1j4faryiiSacP7wjOPbr1NNT1jr3rawIem/KovW5ezBCcdvvc7lg1vMTi6Iq4zSjxXdJqRI19XNRJaVGjLDyHFOTpUdMS8dHU5LbylAd/tD8k6fsjcmrjNO3j7V7QPcP91kMe8wzjqM1MfOF0zvnfH5X32B4WRL++p9CgHp1c+/zGpa4a2jaLvBsnbUrgPqV+kWxsU+X/zsA9580VG6XXJX4r2sockVLZetH1EQr1rL/rqS79S30xuRC5i5gO3ygjZALRasHjzg9LXX9RHoJW2T1uzpbjvHk3zaLCXj3Zc5feclfJhLp64ieQfFUoE6YI3AqKgbZmfaPpzKZpd4bSesWuCbBS4sqFYXVItzosq9tkkIX6ZgKajKjlH2NHAG6U2vghbtY0bEEZXK2I9S1ICgapFWAQnZ5p0esjxjPp+SlmRL7Rr9pCisQyAaOChNLNvpoXexJs0qcWj/LDq8eXxUK4EsjZMAmHYuiFVUgdQlpuU6SalBoirS2NYK3zZCxV8lQlBe5eqL2rZ/ek1t0uFV1QTxChovpTQmXTPOz6fcunWbqa6tgsoWTc45ffzGNYbbj1GWI13V3ebi7BZFJnc5J7WCPqUuOdWXwYcP7jO9PEbhRE6qtCwuuDieMb+o8dpvdrsjSgE6Lzo0SF9zYB7vMpEApeXa5z2cIp8fqu3WFqWAMRhvkrsO7+gW4rJaU3mHbsfodIaMih7ZvCHTVdydX/kS7/zyC1z8+mv0poFO1qe7sceCDhdLySpwn2sCXl5WrATw4+Oc44eylYuYecxyiSNSGi2T9RJ5am21nCvo9Ib4JFtestISP5st2n1xjIF0uIsqq/Qp/9arX+GVL32RB3fvUS9r7V/RnnYFJ7d4+PLndNvwFdCYvhhqK1YS9R3AtDWZnpwwvThhdnHM5fmJUpEOdIvpQ5l0Jp+uZVcFNq0ETiBNWHRY+y/KyVE+lSDKqcycUrkCEMSkl8dcKldB+2e07VOleCEuLhU0UiIx9UCajU7Kqam4xBakskZbjsxjZuR53jJ6D9RJkEazLabZZuiJiLcoKlGBgE4rGnqCCMxUzm88FiGVJBJz5ZVLZSKn/s6cRM4Aj8lxSW5D/8RHv6A06WAySKWrxNlsSdV4ogBRjrfxuTE7foPNzhmboxVbWwPKrqKyAJrJ0V0t07UOISmSeNfgZDjnPIW2DF6Rb6kPFRenaznfq65HdAUJMLrRo44FwQ2J5Vi0QehsE7q71N0NVipbaRLV/Q1Me9Q4HnNrNuOsW3I2GDAvBmTZhE4+gHS9phuGTJvaarGi0N1xZzjhWLqcajvYO9hl3smZ63wwnwyYDXtcDEouup7LImPd68NgBGUPKwp8okypz0mrRorMzpcsJXSyz3y6INkqz0u6/TFlfySb9DVuj7TC1Ioa1VrTNni8FWSK8lnyha7NVsf3ePjKl1ifnWhSjln7DaZNl7k+IHlhwUneqInb6OBX6XZirZuM0KxIvorigZ6Y3szr1+vNtWnEIeOCORqgMUPYJ6i2iUKaqTCRkvQX3+UlZ+jVcJJZeScMJfaKowJzYuCcU6V4x4hCoWZVwKvCaYDFcgHOePQE1BlUXkuIOkVMFblI+zwCeVDziKWQbUo1owzxTySBPCYWUXwe8Ux16FT8Hjkp7TSed06GlcJEVEQ0DYSeiBSOEtOUQi2l1pVRZBuMywn59Izp26/rQ8R9fu+//DwH+1FO69DtDCg6HXxe6CvbglzniCxzAlhOoRuBjhycKRpnaXkWSHR+4ux0xXrtyazLoNxgONgiF3C16aQWOGvxXHS7TAei0Zjz7U1mVw/Jnr1J78PPMfra59n8ug/QPL7PUgAN+kK41hbAa7yeDlUh9zqkRboq64mmAsi6zPHXBearE9wHH2PwsWcYfu3TdD78BO75I3juKvWTe1QHm6BDMFtjml6HqEnqRF4Ttz/YlF597VnRsl8zV2ROQaEU6POikD1KOrqt8ernixLTmHkhHjo8Bl/gsg6Ztk/kPaSw9IdC24f5W69w8pUva4uykg9zuSwjyzMFQNk4NGQiRwT5PKZVAw/Oq0Rl7/ovpjeDR4BVpi2POGHDePQPeda7SApYao6ZkR6zlDplE5n6CLCmfF93p+Y0dHoXRYEi814NEBOROgaVJWZplkpFiWZtXTKMpgLS6KsDhTQxEh8ROLUzLKXiQ6Ko5uhxECyqyPRimLg6l+EE4ERmpiHVSNGB9MT0I6MkA4l4l0xp6p0U9jKIt5r19AGnb73Fxa03iJdv4ec1v/BTr0E9AfFpQkWliNjofBC0xQKHlwO9IlrmcuQafDKqIk6yhc9ygmS7VIRbU1BlXSoBca5oO9Wd7Gx/xPLxLZqbe/C+QzofuMroQ9cYP7/H8OaQ/uMFg6slvcOC7lZHAOlS97aJo2vU+Qjzjk7hSVuQTiiYXa5YCUy9q9dgZ4sw7KqP5OoVuGGHfHtA72ibwWO7jG4eUT4tcD91RHhSAL9+jdXeHpcC6VznikXuWcmmS20n5/Jj5TMaUTosmhWYtHUCXKZVwcoelpW4rMB5pVqhoijTapYPJsS8T/QDgu8jYxLXp5y98yKz+2/QFYAz2dZjycSqj/K9wGkiAk6pqZS2Xnjj0ePM4Z0jM1ONSGnUuzrw6HEgH6N2ZoYatWSmPL/xuNQnzzJmWgbTf4+ark5a0iZfAbkVJgG1BbP6mcqjonDaYqC8i6gNtMGX3/SkgQxS0mLaEkgzFQDqFNUhSkHwapO15DRzTe3MPF6TibY+angTOUKTUhODIILEGz1mJr1Vpi2PkxlLRdq97W0tp1PmS91hhguCbhiWukJLn3Yf3j9TXcVyVrc8g4Cd9FnXdbuvXFcNK4G20dfIXE7d2d/FDTqsS8+izFjp6utEUf2hItvFZEgQoPJnD+h+4Ij85g69JzcYXh8yOPBot8PWjjGZBLa3jMOdyOFhw9OPd3n2qS1ct8HtdXHbiqoCjHU2VDbW/tjTuC6Ta1cF+IxyGLh2pcfjVztKS/Eo2Nkt2NxJ5BgfdOjsd2g2StabfZb7m3DjKqYvo81j+1xuDTkd5qwPNrBruuHZHFFJfhOoM5Ezz1oTd6mtwlK3Dmv5Np1VZFrhyMmqubZwGS4fUHQneIE+7cUzrWBF4em4NWVc4tIZS5hAAS3Kf6l/G2QUGFx0wkryt1IDLBAzIzhD1V+lVNWycJCcbGYYCG5qT8S8YU5pqle5md5FyuLKrowgIYosZ9Dvk3mH/uRoRa/1kkaChRaRkCJxHeQA51ErnNO+TfvVVB41UGKoRvrTpl/91INojpZhGlBSZzGTHg5TeTAJKaVbMfUeWxIXlbdDmse8B72nnxg9Ufu5IB6qwGSgNAbiEUXmGsbjIVeuXGexWrLS/WZoltIlSA9jofdf/eznWUyl17rCmXQR88yXFHJuJy/JyRjISVcODtjd2qEzHHBnccl6q0//metsfvhZRs89Tu/mFdxTB9pKKDIKxKMrQ4E147HNyONbAWGVm/uOG7vGE9vw+J5x7cC4chC5sue4ehS4+Uzg6z/WpRw/JDscYI89xnznGie9DVa6ehxqnDCec/1awzd9cMIHHvPc3I08J57P7cIzh5GnrzTcOHA8sRd5TBPoaM+zs+npTxzTfMVisyQcjHFXdwXmHRb7G7gnDxi8/wk23n8Dd2WHatzDSc/hcMJAh8Y0ibO8oJAd+v0xw576lyVRKxe+S1GOybpbuME2bnQkuoKN9rTK9FjLZwoTYJb+SH6MKgt4IGKJonLCAsl/oS1Jpao3VaR3p3wiJaQ0kcoTs1QkLpb6io86aIz4LoGr6gW1nL6uFszml4JFo71oUBf1TAzaTpAidAwql6BVtW4ZdLT/TJGtrVNbU1uToMKJOkBmGSZlErajZmFQ3+CcRhUwVY4opneTsKJ0CKg1RiVK+dgCPLXPQG1NEykqxYw0ydo9tKXpIFJ0PtCe9Oj6Efd0U3F5cUnmO3SKgdISC04AX7NIUXq51l6yBsmKniSzV5TKc8eTNx7nWz71SQrtf+cadtr1DG5eZ/MDT7Le6zAdaWL0jZ5Asnl9k8l+Tn/L2Np0XN/KeGLDuL5pXNt1XN30XNuG/a0oUDTkGczPJMPpEnQQ3xh5nn7G8x2fPMQVl8wKgysTihtXiNcOqEYZjz0+4Ws+ssvBdsN2p2K7q7QX2BlEdoeiQcPeqOJw1HA4iTyh7czVQ8fRYc7efslIMuVDIx85ATCjUUScybhnssdsY8z4o89TPP8Uy9GQlc9xnT5Fb4BX3vsS5wtwOZkmu2UCtcug7EF3xFr30U05JBvtivZw/Q3x9wT5p0EgIyAjY5GW9AsY/GZS27YeUNDFzFrS61f/UsAEh5dMROFBNanMlDrhyqnIzNQP3FKX5cIiWZZJeE+tJSdo6VHbJItI0qQGogTkar3Ce0fKn52dkud5S179g5jHwjPa22bv6hUef+oGVx+/Lv07YmeYom2UYFiGXohmiDvJAEl9c4bLPKkdLhnGqz4Tqa/qzDmcyttUyw6G6sRRYx5euYJmEC+98iLn0wu8Di9Z2cf5Dt40vvaJWd7FOTlVg4YQaUJoJ8ZK0fzK0RU+9o1fR+x5fvqzv8Rd7ant6Brj557H7x9yEWCwscH29pCr17Y43OtzXZ+vnxg7nhl7nhR4jwTco13P0XbG/oZjawxjUS17/vJn7vJPfvKE/+PHZ/zUP1zwv/7oCf/jj7zD3/vrt/i5f/wizz6+wURADd7h9wr6OzPe/3TNNz43YCtfoq8/WmnWdLqevmjY8YzKyKQbGPUjowFstVRzTZPrxrbjfYrWz+zB00eBqwc11x8Tr/0Rk50NOoMBy2DcOp5RdSYMb96ke/MGzc6EZjIgH4+wXknIcmQ0YnAaX17SZIjyQzns0x0OkfOp5E/rbpJtaHvU2dUnlS5yIs5MKaD0kafRozKc+CkbRPJgKjH5JCqTJkJbrHwC7SNSb9WjfmJF1DkAHpU9qk+VETPDeefkcEejg1Gj7YNXp1YQ9GiEEAKpk1M7Z5C2JLUitPpSlgU9Kd3TyXisGb6jg0uiXr9kJeCfXl4wXczoqD66KIZgYhJJIhte4HKW4ZxvyxH/qPHRe0gv5gimQqVtb+WjypM8ZlJIxih7fa6m/2WzDP/w+Jyp9sVlZ0iuu906KZ5mtMYw1fu8xCnvtG3R6ESNU/R6fNMnPoFJ5l958Qu8pU+xoyduMHzyJm7/MVbjHcJkwuBgm61ru2xeGdLbMHqbMNo2dnYyNpQfa6vRGTcUgyDQGZ0SmrjmUsvTfd0Bn1RdLhe5Akau/XxONXecH1e88/qcr/xa5P/8u2+wuJuTrz2unvGBa8a3f82Ew0mD6d9P/PTL/Ng/eIn/9cchCjzhAAAQAElEQVRf4rO/dofjs7kc21DmOWVmFJrg/W7GuGNs9Bp2BnCkyfbYluex7ZyrOx0Ot0uODnpsKWpfvbbBY48dMdkcM6+XnOpz82rcoXfjGuWTV4hHO9SbYjLq4rtdTLZKkigOAK6louiQdztE71jLzlb26W8ekvW2dN1WEmVrk+9MB3SzNWYBU1/Dt743YcKpxMyIwgVKzYwAsp1Q8i72TDwejakKDDND8VVphksYaskr73AJsApTmFpE7Y9TlyipTWAmuvRKEGP94BCzRgNpuSxzzyApo4mwnM31eXlOrQv5+uKM89tvcf/Nl0QvU1+c4HTYGqZlLCvEz1HpG30rUUgcPWmcIO5NkKAaIyiFTG09zlSflBVFosqkrkVSdM2LkmvXrutDyZxb7xyznHu6ihBFsSV9Ojjfwbz4eI/lhSbfUJOwh1c+FgXW79Hb2+ELb73Ja/qy2L/6BBvPfIBpf5MHOvHfq4wL6zKlx+Wq5F4C4HHD6w8CX3h9wedeWvDpF2Z8+vMX/PLLSl9Z8jMvLfk/Xlzwk1+a8o8+f8Y/+swxP//COZfrApxJ/ka2umC1mFFpHx+jp2kKfREsufXSA26/8DoXL93l5I0pL794zsuvNHzx1yvuv5Zx8prx0mcu+Zn/7Q7/89/4Mn/vb3+Jz3xabe+tyGS3ycCY9GGi6L1ZBrY7gb0cDrqOxze7XNfku7obuH4U2d1eo/jD0dGAa49tMdbKszTjVCtTNRzhtbIOn7lJmIyI/T6d4SZlp6dRMtrDnc8pBiPRGFd0yIWHQv7taIt35Ylnoavthw61MeHIaSr4JbgF2EokH/LoSR5NlN5SmijZycyB8GciEo9U0aaWoKg6a8nMsNQWE6QiDkUQeZ8YUw/UWLAJEAWqEJRXuakqNCrUOyJ1JaXz+Zw2WqtNs1rLKZec37+jj0lvtf+F1OzhHerlOaGe01WUzgQk2sFlFO+UFWPNWtdGf4f3LumFk+MtZc30LpJSUSSRaFzAZzmdTpfdvX1u377H2cmU+TqCK8iyjgASCeKhEkWOqD6Id0ZedhU5PE2Z09vdJhsNObbAdHfM8KknqcaH3Ft2mfoJSzkGHZTQpGkqz2rlmFelgNnjVOA+WXe4v+hwZ9rh7bM+r9zJ+dLbFV+8teCNU3jzLHBrnXNn3eNSV1yxLPHeSHZOegQXiK7GfE1wFTGXfRXRw3TF5Vszfv4n3uCv//lf47/9K1/kf/87r7K4b4RjRA3LByvO7la89uWKf/IP3uF/+Ktf5h/+rTd54ZfPuTxeUboVw6JmlFUMs7UoMOoGtkYJyI79/Yz9wy4be47NXdjey9g+6rN9fZvO1oild0wzWI5yisevEnT9N+13FAAGmCZL1CWCS0oMSpwOncWwjxTjQHv2j3zkKZ3FAp3BEU22SeNLRdxGOjZoJuA8YAEzJeYx/XPmSHgyS2+GXEcqcnmGSZb0rkQtw6M6wEwYchkxqC/piSozDRFJ/Ana5yVjmxkQxb/Wr0hgjcqpkFSfqNBMrBV166rC1N9r5pgi9cXDE86Oj2nWC3xc4cOM6ek9rKl0Rbag1JJfClSZFAGH4Ym6sWgE1kRB0QoJGlUOmcRQvVoFlDX9iMyZMNbj8MpjnJ8vtMVY60OK4V1OJjBjHhJvc2Qaryg75FqWvSxyfHyfzmjA3uOPCbAZa0WebOuA7v4Nlp0jRaeBHDBR9x7OSnLJU2i70JHROmT6SGCYHGnSN0YpLlmcIlPWNW1BMq4+MeDmMz0++IzjGz9Q8omnuhx0GnrSr5916fgcJ1taS4CJn0qQrNBgInS4pVa+LmW/EcsLWOsLZX2iLYbupUknuilwabpbl0PnHWYPu3zpc3P+8f9ynx/966/xd//OG7z46gWLBop+Ri4Zuh20ohobPYG359kbOQ53HEcHGUeHOQcHJft7PQ6PdvR+yKQ/pMpy/O4OpW5cJleuseoW+EGPXJP87PRMZ5UZTtF8+4kj0uT/6Mef5VO/9Tn2FCAcXpqV8m9XgO6JOtIv+TN5M5F0kO+RXU2EapM1zIS2VC0bm8jJNpZI/BCZ8OFcjqkMHGbGe0/yiTN1DiHIjmIkH6XCllRmMZXXNHUlwCdwNy3QVwJsXa1Axo+6w40CrHcRJ2rfrWF7d1M69qjnM+Yn5zQr9Q+QZ0mpRluGhjr1l6pRQpnAYWYS0LWEOVBZqlMBmIYT37Kbs3u4w+tvvs3ltJJsheDRwWV9snTqFvjMF7i8o/cCL6dU2iItFwtuPvssk/1tbp8fs8wc46Nr9HeuE2xDsgyJ1tc4JaZJ4cwIIYq/dJYtGq1QlahRdGop1GorhXwkOMeyMd64M+OFL57xi790yi/80oxf/1JkfjrALhzr4ymLiwvq1ZygYCDTKppIx2g4iyRHKsHEJ2pFsORs1SEZgsaPqQMRlNeyiK3XWr2XLSF/BF1JXjxYc3q35Iu/tubHfvRt/tpfe4Gf+7l7yPySMVLmDeOsZpI1bHUiuolkawN2W2B7gVsAV9Q+2s/Z0/Xe7u4uWadDvjHC722y89TjVKM+lxm4bkk1WzK/mHMp/3dV/39p+/MjP/JzvHPrBCR75kuJ26Fp+tR1V1tNTyAStYKglcN8hRQmmmYeRlSwiMl/ChamdycfmFR2yqc/MSWqTp1QsfKJG+1jqJUw46J8goyWGqdWqUMiBzL4I7JU3zJSof7MDCcnpquzWpE9sTDv2dzeYTieaFkqOdNSutobUm5scKH96eXlKYvZhfoZI5V5n0lGRxSvqFyUQI3SoPeAp4lSUGWYRyYguoZuP2drd8Tx6X3qYCKB2fXI8zFZOSD6Tktrzfil5LrUIfd8tQJFlCd1ij/XvjWBudibMLqujw1a8s+WK6b6kLIOYFmG8w6nMYmO0ERtNdakrdVM54R0f71S+3pZay4b6QlyQBMyZgvHuh7QVJvMF5s8PJlw53bGxcOaTCvZE/sZ2+MT8T7XGKmnU7SPaBByL1vUAVNk9pVSUQta3ReY6V2RO4RGbdVe1lBGzhQYwhpL/yWbrl29FHDpOvLskngq+S4Cx2/n/NQ/eMiP/jdf5Fe/cELhjG1F60m3oqstTtdDrzA2+8buRuRwr+FA++udK4GJ7tC39cFne2+AFTVr32DaT289/Qyjx28Q0uon3dNxaBoCTb/PeZPxYAGryqG5n5SU+zpYChShTxCoa+nS2Ey/M7Aac0iXiNyNcmoLDhPpTZjT36NJgN5VTvJN6mR6t6gf9RUWJALJRE7c9BdT00cUwZkpb2osLv8/f2oigYNmXkMTQztgULvojL6WICcA7X/4w3z0D/x+ws1rFDqQVOuHRM51/XpJWZYU3R6N2kcJaCKQGhI0KiWNL0oTyyRpkNW6/ZJOryugnHIxlSOzHllnSNEbKVrI6FmHYDlB++hK1lkFYymA9Psjrl+7weWy4VTl5bVrrHUtcZqVrAoBMO+qTw6SxcyUeMSIBOYUidM1ZvufVwpw3sBHhxNv+RenQ2Mzr6jO1tSnDeuTSJxm2CUC1Yrm4Zq19rsP3zzh1hsP2dve55nnntL+spCKaiuLRIE9rms6WUFmvgV5UFnQShDldu+DWgm8iFyiGhLQVWehwtTOrSvJssI3Kx3AK4ImXaPtSTOtiIs+J/cG/Pwv3OH+3Tkljr6AsJFHNqX2yEX64jXQOOOeU8SO7O86rm5GtvuVgO44ujrRHluhfJCz7mTkW5vsPvGUgtUWlUBdye5Ll1HpNmTVKaiLDJkauZMsc+TaZpbdiYw3pAkFaXuZtA/WAEEEzjmlRkQkX0QRZvLNoxYh4SyER5hTsIrKG9b20c9X/5yakJa0oCgcBQDS1FI+qFPLREMk4WKaKurWpsqbyk0DIuc2Yl5rCV7LMJQZrslZyMHd4RVu3PwYwRft0ji9ONbXujlT3fsWgx4J+DE50ZxkkEJaZl0wZGMSayRvQ6ArIG9obVzWtbYZQZ+Fu/QGu6INXNnB8gIvQEeXEZzH6d0so9sfs7F9wMmiZjXZYuujX8OpJsDMybCMMT8CTQAND3JydKAVn6iCqP1zaFQgXXGBQnvPjjaimYzhZSPTForFSvtYhSQtu17XaNnxEp+AdHlJPZsSVjPi+pKoLdvD4zVf+MIlL35RNpg3ROllCikalmqufnmmm4YtutrjdwcD+pMJm1vbOIO0Ogmt4AVm10AWiSagy+5REy2GKG5rgq0k/1KUAk0GtbFeX2jVmHF66vmVX3vImoyO9Otbzihv2C8qdoqGDRl9YjUbPrChleug7zgaFmxPPJPtLluHJYPdAT3ZoCw8jT7WTJ57GsYD6bmmli6h9PRGIx2eKyrZzbyTTIFKdWsBMuuU9Pq7cusWMSqYJBs7cF4wjuCtlL4FRi5KFdLdQHOGR7BHjwr0m/4SPqOpo4wkt8gmTthrGjFXoQZMdYmQgVRIIqe8EzeTgMiA0hunvKm8Bb84B5WrSJjwpNk36PU5f/F1fulHfpSv/D8/K8MuqBQ95hdnVMsZa1FQZOn1e5g5zbooZUx8ESklpSID5xxjOfdSoLk4W2FuwGCwgSnC1kJgI02CGVHtTJTaY9AbDhjpFuOiXuk+eRt39YjbimSrvA/5CJ/18a4rKnBWELTsR+/RC8ECLkcrQIHXalJKH+dzqlVF1G1OpZuI9D+tqi+XxJmANF8LwBWNJg4VMpOT6UxaRDAncQQuRaZq7UmrR7Q0jsqdAzVJTllMZ+Rlzo5uFcY3jujpq8xS9/21Jo+UBac+eNJENTOMR08KMIK47A4NgeTkIJ8KRmqwFv+VAFfpLON44SuXfO4rZ8QmY6xVYKyt1qDxjAXuSZYzUDTtipL+r2pSLnpokgUOtiPjobG11WFjf4Af95ErONFX182DI7rjCcEZTpMyfW8w8fBeurlMYneI4o8oBEcuu3c7Gzi6kk0raqyJMpppoprkJz3SL+GJr2ppmIlf4imKzkgkJuqLdJYR1Qc9qjJkfSzoTVyiwGlKPUYmJpqwZMp7AccFw9TX6d2JgVMXr7RpGqIAnpbhQtbtatBSoF188ctUr73eLodOo5v6r7QXJVZUaf9XZCDl1YUYndRxaBii+CdxEg1GfRbLBZeKYlk2YDQ8wGU9akXPIPlMQAzqEZWPAspivWJzf4ed6wesyoxqMmK9v8U9Lc9LRQTvSvJCpD2gU3QOeq9EwToEAbvRjI2dSKavgH63S7EzxPU7rNZrVvqcvpYcCGSN9tFBW4UUIWkiKY2yXYgNuGQYh8kOlnmSjm0qh7uig8sL0uQxM+QNBVzDLyruv/GWLjGWdPcmrBUtL3XmiM5hzuO0yjlfgstBOiPeidIYOKMlM9rHIjKJfFVh+mCiJY1mGrk47fKTv3Sbz54G7ueekEQzR46jI5v3JWs3V14y/spXbvO5u+esO05XfhWHY2M89kwE6GJ7Ql1OmK5NNx1TnPw4UmQ2OazMuwxHE1Yyg8muJpmDeHvpHiTfXHaLff/2DQAAEABJREFUsnPRHcnemeQMIF3fIzVRWdIjEXpMvUVtheGcExkkHZVEbwT3qIuZpTr9qIuKkC/xbV5vMRAURYM6KqeCgLM0eFQ+krKobWgafITWqSp0KkMCm+/gPbjcU5gjUwTIilyn/AXL8xNFuoWixpqhLuczr15ObQ0CTpEmInwzGo/afnPtU2PdZzJ+DGT6WhEmyvApskWNl6Jro4mxEmj39ncZTybMvVFPxnSvPcF56FAJsL7oSp6C1C9I1qDxkBFkc/JxpNie4fcv6D2uYbYidSdQZ1BLqkAFqb1Aa6GRrWQLAduCJBAPV2R4AR+R73XJygKXqbMXSfeYdJRMMW0XZGiTfXFeekpObfXWkqdq1py+/jbT128xOz5jc2+XfNgj0x1+FNikNsnY0UCjkp6YcipwEk7FmMbAlBNIouSOCk5oOxi1/ak0ae7cyvmJn3mFF2+vWEQvFqbmgVKRcqCJOZZaOzk8qa8ut9+a8v98+g6zdc3GjnG47xmNAqYol2xnkj9Ir/Rf5tWSwZddGtnD6zzQiHPaduBzirLHUjdN5ksaQ4fnVFvQLYYYmUiNZWW0p44KCI5GZVFKOtI/qQjOYSKVEs1Akzj5USrihGgvwKgaF5VJ3RvxTIOlDkgxazMqFGsXIL1rLFIdIWrsiFfqk8FU0QhMQQ5WqQbrQi4ltCeuk+Nk5N6gJBPyhUPtr48Jl1NyKVlo/MlwAyfHm2aAk+OQwP1hn44OGRfak1Z1h17vSG1G2qt56ZATZRxStHIeJ8A0RHYO9+lvTLivSDqPnu72VdYCckxGTddPZam2no7PKFwGZY4b5vRHXsvpnI98BL77uyc8++EuTp+ci4EnSnnZC192sNyDyc6axEHbl7Q3jtIvygbJyJZkl4OTHngvfQsygdqLMq0KvihSd9ITf/OPeEh8rDYdMGc8fOkNMjmjkR9Kjeuc0woW275pnNQV2SilUR2jJkM0yYV+zOEyh8ku+lETk+/UN8l7sWB9VvH62w0/8dn7vHLeMI81XhYtpUNf/hsJ/FtW803XxvTXgfsPBvzDn36Hdx4smWzWir7G6fGptolOFHGWE4IXLDxFZ0Cug7rLOzTiWkt+sSVX1M60vUs3vVnRI1pBVTt63bHs01PfSJAcsQ0aawQyUfpzapuDy6W/8klJAzPD0LvGVQMkhcbTu+pdlAFQgzRwEEDTDAsxSMUoJmBSUvaiJWQ0tW2UJierP5j+RAjUUZErKoJFoNRs9V6KySiZytAWo9srSVG+cE5ftB4SdM2UvjB6l9HtDiSYx8zIivTe0UeTKXUdybMhZH3mytdylKm+qisar4HLTKCD0fYWrtflreMT8p0Dss09loXT0hi1BSnYu5qxc9TBl2CdDKerqmJrzXD/AVefvMO/+J1dftfXb/HJx/pslZV41oQUTQvZoVCf0pPlThEgkIBs0hXZRhEBQ4+ibNReuhFo6su5bheWWoGW2ldXUr0myrke9VdTqUgiLCp1oijDBpSRzY0gZ+iPIH/k2p7wnqFTk2RLVaqr2qe+DjVEHdGPCJxslPkMk53FWcXSQfKFxVK3MaKzgtffyPj7P3OfX7+z5lKNGpNsliFVGYr/4+OCxzf1plV6Grb5pz9/h3fuzyn6gdotUBeirueWlx7HGPyAOhlXWzy3vUmnN1R5hhPPmPbqgz4d3YCshQcToANJT0euM02IBVEKBb8muopGFFxUmRcZaSwpA6Z39RM8pVOS16nMYdLTzNq8G+lOWH5JAZ+gskBoGShLapOYiTXpSWmUsin/HqX3KMMnqnULkZwRQsC5DO9KNSuo1o0EiPg8MhiXrdC1AH55cdJOmBTtChnDISeYUzTuUelAdHl5oZkXCN5DnqFJLTKVmV5znNoGICsKCi3Nty/PyK8eEna3WI4UUTc8BwLokzd7PPf+AeNxJaM2coqAvLPg8GjGJz7S4V/5zqt8YK/kSLx2avGrPRoAfbnGdXPkEwpNDm+BmO61dTg06ZQme2ss2ay1lxzndEiMZ1N9oj4nKpIFbR3C6SX1+ZlWphNqnQekHCSvtLaUVVNeYyv3iJ0M3whIlQ6gRS5Qte0CaJCY2uo9pVHRNGq1sGTed30QU11ypHf4Im8p5h4yp/4VTofk5mzB6jjy2jsd/vfPnfGFs8iJQKGv+0RL4xibRcP7n9okZ0bQgf78rOZn/8lb3L7lcOlQVwqE2kOHOaymja7NM1by4aVuQdb6KNNsDnDai3vzusuft2emri4BSpVFTdBGoEv/gwqEk0guC+Yk/UML5oZgepO+qDTpjfpEFIVFZtYWSSH9mYh3H8MNRhu4shRIHLWW/2AZUctFlFGiIqLFiNxIowECYq93Er2XfzdNhkxCNsnAml1oSCdAx5jrQNXgXI7zhfZPtXTI8c6xnJ3rY8sZaDqFuKTXzygLr55wfnahcuV9h6C+jfMtmBGwfdoqaBkPmjiZDDKaTLiQ83va9xXbY86bGb2BcfXakP29nD1tH/ZHNePslCsbF3zrBwu+9xObfM83bvLxp0bsWc3AArkIZ6xlgSD5fJTGizmNZFmcnrNaLkEg0l0YCNimZRyB2KpIWUO5CtiF2pzO4OEl4f452v/AgwvsofKnZ9jJJfFiSupr4m/SEjkokZkpMTBHpbvktcZeL+d4LzBikiry6IntmxwDCciqSbySX5IKQatHsk16Fw5IOpnzmCZHzDvQRNJ/NDY7v+TVW0t+/LO3+dWTBWcaJtAorATSuWfUM+VVKEDHVcmd1wf87I+fMr23Ymd7SNbNsKT/5ZrqZEkjgNfC0rnkndx4Aq/P5stS4+kAXml7GSRr2enS6fUxn5G+H1XRS4We1BrRNF0QXjAD/SXZg3SLqDiVKVWu/SU14N0nNXg363IN8NgTN9g/vEqmfWZQx0SNGmj8ZBOiMuk/vK+/CmRIwqHyRKZyjd8OsZjPSf9vOmqB0yRIHway/pBcp9pqXmuqZPS7Q+2fBjgZ+UwHxDosNNoSn1XkRWDWRmaPlUMsk5JSvhavaI5Mxsl9R2Z3pD329vY2CwErGwwpBOhKW4PJbp+9Kz329IHgcDdwoAPe0VbGN3xgzO/8ll2+7QNdPnwIzw5VZ0tGCnE54GS8RmnCrGs8KApHXRf6ZaXlNaiBIwroaPk23UNbKtfnXy4XRG0zUmoz6TJV2Eq3IZLLdDviBE6nA5ml6D1bgepMEzDT5HeyoWlks0iyWYqQcoHykagofXZywlr39nICyM6tkVOt+qV3wU1FjbKt5CBERynQ6FouSM7WP7JbzCS7Ze02KnjpVutduq20jXj91TX/9Ffu8Pa01p7aqMS0li3mi8ByMSXMI2Glvpq0lXwzf3DJaj5jvNMl8xVuIZ1Ol0TpVWic3qDHhbZnHV1Bhg1tRXR+Wgv46X+YG6RzK590S/fTjSYXzmPassQ4kLglElIkVQjSzZByemnwspFaguyVrGVmqoqSVGQq1rsOiA6vZWBza4fDoysMRmPwnrSXTkAmOHXyai2Kvs0HTZ2ooRBjjYGZSzl8iFTzBecnD5kJqC6u2y9gXfG/PLtkej6lWsnw4tnv9rUFGErYFQ8fvsNyfSl2Qb5es1hFyMba604oNrYJnZxKoEOHSg1F0Dhr7b8HwzEL5as8J9vWVVfh8MOM3Sv6KLFbMNaWY3OSsaX98mZecVMfCG5sdth2gbGi+0h69GSE0lBE0pjOsRa/i+ki4YJYB4KWxqg2ZGrkII2PTIiia1TUSU6M2jdXZzPW54rM2kebvkqSAK965EgZE7QdcwKYU2oCOorwUduq0KyJsSaIkAMTmQXQGMn+jQBQq59eVSYZZGmiYS1JZslrwUhdDVP6qEzhjijQGFE9UrkoSgG1VYvUElsrdxFZ3A+88lrDX//fvsyv3a45l95v68PYz/zsi6z1FTScadXRTZOpPJ1poib72Z1j5rqC3by2TdWNGm5NENCdLqg75Iz6I04E8MMbT1GORgpoHZaaZEvpHTQxvXetbWvxzLVy7OzuMtnYEWi7kljhxYS1pLFJfvnFWoklb1umNznCpJkXVs3Su5Ee532OzwpcljMYjji6ek2gHqK2qJ2YhzZFOXOaCYqNsqbeUvdETq+mjCFb4ZxSOWmxvMD5hslkQqpN+2ivLUitbczlYsayFmiyyGAyoKMZnJeeuqlYKqLlxUAy7NEd7xOLDuQeEwjTDJV+rJslG7sbmPa3ghHj6/uEXobvO3b2h2zp3mkyMbZHxlYftjpGisIjKjpxJaPV5DKqtCbXSdkr76NU0N9MTp+u0cQMNHIiAg4yvomcyKSfFCbpmqqkLTFFREXRsF7KTDVmmrQ6JKNJA0FJI+c1AliDqW0CcqOtxEpRLtQaLNlUE4TULxFR+kaQsqY8qjfxSZT4meRNKeJFqNrxSRNC55L0Tng0Dpo8URMySA4zS+xo2WkSxJQxxFW6asuwftBw943I//QTX+af3Y78xC/f48UXK1ZnaqN6ky1MvmtEMiNZBYvjUx0HFvS3tV0ojFpni8s37uNP5mz3xuRFlzcePmSwv0coc7wO80t9J6g10Qrd+vR7Pbr9Ab7b5SzZwns6ow20VRAVIFsHyZkoCW/eMOdkX6UYqiI9ZoaZSHWqTTPBgQVQB6elYntnR0t7TnIa5t7rhwHOe5xymbyZUjMDMUKp4TWIEWVcJ8csFwsBdKH6gNe2wecd5TOyLFP0nBAlcNnrsLG5SVdKzQQKXMaWonLmNL4cEeXoTBPOKwqTeRoBu1TEHm2MtTw2dHY2qXNjFabaNo24ctgj/Xe/h0PY6zo2faAveboYeXRkkj43j5O8JHnNIaFFsMLxlfMlD6aG5owiGNLd0IKCaSn1kqHQFs2UmsCdamOMSgKWEkXToKjrJDMCdBSl1N5Ng8AXdHcVdUOTIrcpYqFJ3IKQWhKGlleUjom/05iJsROAI6oTucRbgFVIhARo6WZ6N+WjeEWBRSc0UFSPSZ40YVIf9VUHTDZFWkUTPwUok86ZIq7TVUdz6nn71Zy/8V+/yM99+j5h1SHMatKZodaWqdEWy2vFMfFFj9PEOH77LlETZ7gxJEjOWqtP2puXnYzOsIflBZeKyttH+xSFx2ncIDk1vcnk826vT1b2mWo1m0nvSm1yHSyT/zPLSeTkIxNFZ4gBZkb6x7tP1LgpG6WXazSD9UeQk+UTtfeY08BegMKBAJxOp/3hAOd96vcbZBBlrCiHxZapw6mvZKbSAWql/fRcXwwrKZBmWZDhi6Kg1Mw81fIcQka3HONCyWIZCUF1nRELCTYva5aKss1Oj3VhmDk5IyaJGI1HXOi2oCpyAXpClddceXKPyXbOWF+0tvtw0PXsCegTCwzUtyPj5Poy6M2Lj9MIEEDye/1kpA8xrzfwuVtnnF4GLAVOLckmQluIRg5FDnQa08ngQWCLhngFgUfaSTdaUNVEgcpkFxPKTaPENnKuMX0hjWqT2pnaNAI/CSswvXMAAAXWSURBVNTJdonQI576xSl9REbLJ/ETGGMCk/K0eY0r4Abxogm4OmAChilPapNI7RDgTEBMbSQSJj0QxZYaBQmRJr5YUc1ki2Nt8R5mxIs1OqCAtoCJZ5SOydeNeAaNIdPKd15XsGdkErrTLZG6XJ5cMLuYMdnawMpSAd3ji76i8Ujxysv2QWtOjRWO8ZHWzWGX3Y99CLR9WTlHYxlRqcPwYmgJX9QgfWJLEXAgX6qhypWPRnrcLJ286xWarOpsbZry3U6Hia70tva2SdHw4OCAnoBoJheJGhPT1glKEU9RkAdytdncOcLnA6J3VIoQJgFNkd80+ywrtU/1uvlwTLSlIHYIdYGwr/Z9XGfAvJez2C7pfOf72fmOj+BHfalmxMzoKkJWejvRJLHNEZfap6fPsZsC82TXS9aG3YExyWGoGd+T0qVOzp3oZIIGLNLq7nKcnGiuaQ1+W1d1v/4w8PLdTEHTCRgNJiDHtCcWocNco0m4ms7EQ8bzHtkaE4i8nJsLNFHgjNK3UZoA3VGU6vUK2TWKn8CRtiSpTqDTIOorJwmgpsMnsmUQoScS5VT9aphMtnYi5NQEKnSIMgFLRsMErPeAmvbzJERKDtNKEEWmyWOaNFErZdR+F+1pc10teMmcCczWaHzxkknEXjJqfJOMjc4/9ekxQiWKNKBzTxDvKFmjdE2rRJIl6uNPVOeoupO792Tfmo58HGtdCb7+DpYXjLY2CXmP9J+WZpv7UHZxhdN4FRvjPn/g3/heDq7tsPmJj/D47/vnWF0dM5PvEpZqJztI36wBJ9miVqMW0N6hRUU2krFkXZOPUw451i1P77I4uSfnXeKlYBRQajml1rLY73fp9/tkec5CRkkUkhHV28nIrTKW/Go0mPgZW1t7HF25zpVrj7F/eIhJqXSg6436DCdSjoKg65nxxgGNQCYZ0KQTeXzWVbQtWGlvvPmRp7l2Q5+60xWYbge8xuvIZF57/YVmb0ezv5HxBtqDjzcHbGx12NaBcLtvDLuRnu5Ru84oJZ+X0RGlLVQjPolaieXUc/F8UXL81O0FP/3WOafrjHTMr3ULgfbzpZzl0yleV1zN6QWNru+CQN2CQoJ7RT5fLdUn0YKo4GCaZEFRudIqkv7blbQNCbLpI9BpzysbI3BIaYjJckFplFVJYrYUJFtQmyaRAOgkp1Qh6SJLg2ZTSqOcnvIxOVxgQxQlE+pDSjV5THtbZpqIl5e6iZiStZNKcujgiijVO/k1hiSL5JBeYiePakSJlmR8REFJQ5BNotqYAOaIZJIh1yFkcXEq4DVJHKrFmrpaMBoNKbRPnseMpuyxKWy4ckDWGXJ6vuIv/5V/zO17c249POX8YIv9T30TtfzfyMcIqFHLQJTvWpzIBqRyvZguKAyPmWTkNx63OHnArVde4tbLL3Ly9ts8ePstTu7e1S2FnHv/IXdv3+b4+JgghbNczm77BjGS4uIVW82TaQ3NBx48OOXu/WMB3DHZ2ubo2lU29OUobTvmihBoezGZ7GFZRmUVdVzK7nO8tjgu6xD1ta9zdZfy+esKigtuff5lvCJElDKFIm2l8SpvFBNF7Z5jtNlla7PDVheOCjhwxkAG6LqM0kHmwRzI0vrRn/oHF1gSOXc5v1AZP6qrt0+b52SlxjK8qsjSfzmnicT5Gqc7Vnswwz2cYydT4ok+mpxdaEmeYQJ3oyu7WhM+aAIgUARFySh7NesV9SqBXJFQIDDVJXJtWgm4Kk9RVOB0GlqBR3Y1CSkSkJGsCaCm1KR/kgsBCdWZ+EVZOTnbpK8wpSr5RBFNxZgAbQJ3m0oeRO1KIHCH1ZJGd9ymw7kJ6I10iMsVSGYxgTSQyacByWiPTKeIn3hEjRtEKVonMDsME8iy0hNl15UmS5mVBE2mNJG7/YLeaIz1JpzHng7vu/jhIXW2wXRZcnI/Uukef/ql13EPNAGEl+HRAciPhXyieUIa55Ge6AmYSU/ZzGSLKNuo8Kt//y8AAAD//5J3MQsAAAAGSURBVAMAsJwXglksAvoAAAAASUVORK5CYII=", "repeatType": "monthly", "id": "evt_1792248788879_1", "repeatId": "rep_1792248788879", "start": "2026-10-16T03:00", "tag": "la-hoan", "note": "", "title": "la hoàn", "isForever": true, "url": "", "end": "2026-11-16T02:59"}, {"imageUrl": "data:image/png;base64,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", "start": "2026-11-16T03:00", "rawImageUrl": "https://paimon.moe/images/events/spiral_abyss.jpg", "title": "la hoàn", "color": "#70bcf5", "repeatId": "rep_1792248788879", "tag": "la-hoan", "note": "", "repeatType": "monthly", "id": "evt_1792248788879_2", "isForever": true, "url": "", "end": "2026-12-16T02:59"}, {"repeatId": "rep_1792248788879", "url": "", "end": "2027-01-16T02:59", "start": "2026-12-16T03:00", "tag": "la-hoan", "rawImageUrl": "https://paimon.moe/images/events/spiral_abyss.jpg", "title": "la hoàn", "color": "#70bcf5", "imageUrl": "data:image/png;base64,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", "note": "", "isForever": true, "repeatLimitEnd": "", "repeatType": "monthly", "id": "evt_1792256960624_rep_qrhuag"}, {"note": "Sự kiện nhân đôi phần thưởng rơi ra từ Bí Cảnh Thánh Di Vật (Artifacts).", "end": "2026-11-02T02:59", "title": "Overflowing Favor", "url": "https://www.hoyolab.com/article/47058278", "imageUrl": "data:image/png;base64,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", "id": "evt_1792257478447", "color": "#8ac6db", "tag": "genshin-event", "start": "2026-10-26T03:00"}, {"tag": "genshin-event", "imageUrl": "data:image/png;base64,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", "note": "Sự kiện Carefree Snowball Fight trong Genshin Impact, bắt đầu từ ngày 21/10 đến ngày 02/11/2026.", "id": "evt_1792259588324", "title": "Carefree Snowball Fight", "url": "https://www.hoyolab.com/article/47058278", "color": "#add0ea", "end": "2026-11-02T02:59", "start": "2026-10-21T09:00"}, {"note": "Sự kiện dự đoán kết quả chiến đấu Predictive Victory Dynamics (Battle Outcome Prediction).", "url": "https://www.hoyolab.com/article/47031716", "end": "2026-10-19T20:59", "id": "evt_1792260392472", "title": "Predictive Victory Dynamics", "imageUrl": "data:image/png;base64,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", "tag": "genshin-event", "color": "#f9e3a4", "start": "2026-10-11T21:00"}, {"tag": "nha-hat", "note": "Kỳ Nhà Hát Viễn Chinh yêu cầu nguyên tố Thủy, Băng và Phong. Các nhân vật mở màn gồm Neuvillette, Barbara, Citlali, Kaeya, Wanderer và Prune.", "title": "Imaginarium Theater", "id": "evt_1792260630614", "imageUrl": "data:image/png;base64,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", "url": "", "color": "#a08cd9", "end": "2026-11-01T03:00", "start": "2026-10-01T03:00"}, {"title": "Imaginarium Theater", "imageUrl": "data:image/png;base64,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", "tag": "nha-hat", "start": "2026-11-01T03:00", "color": "#a08cd9", "url": "", "note": "Required Elemental Types: Hydro, Electro, and Geo.\nOpening Characters: Yelan, Aino, Flins, Fischl, Zhongli, and Kachina.\nSpecial Guest Stars: Qiqi, Odette, Vesna, and Jahoda.", "id": "evt_1792263375229", "end": "2026-12-01T03:00"}, {"color": "#ed6ecb", "tag": "ao-canh", "id": "evt_1792263471763", "start": "2026-09-30T09:00", "note": "Permanent Combat Event\nDefeat Powerful Foes and Uncover Hidden Treasures!", "end": "2026-11-03T02:59", "url": "https://www.hoyolab.com/article/46791577", "imageUrl": "data:image/png;base64,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", "title": "Stygian Onslaught"}, {"id": "evt_skirk_banner_recovered", "title": "Void Star's Advent - Skirk Banner", "start": "2026-10-14T15:00", "end": "2026-11-04T14:59", "color": "#87b1e2", "imageUrl": "https://paimon.moe/images/events/Void%20Stars%20Advent%203.png", "rawImageUrl": "https://paimon.moe/images/events/Void%20Stars%20Advent%203.png", "url": "https://www.hoyolab.com/article/47010361", "tag": "banner", "note": ""}, {"id": "evt_escoffier_banner_recovered", "title": "La Chanson Cerise - Escoffier Banner", "start": "2026-10-14T15:00", "end": "2026-11-04T14:59", "color": "#5eead4", "imageUrl": "https://paimon.moe/images/events/La%20Chanson%20Cerise%203.png", "rawImageUrl": "https://paimon.moe/images/events/La%20Chanson%20Cerise%203.png", "url": "https://www.hoyolab.com/article/47010361", "tag": "banner", "note": ""}], "calEvents": [{"startDate": "2026-10-21", "repeat": "weekly", "allDay": false, "categoryName": "Học", "createdAt": "2026-10-18T18:01:31.626Z", "startTime": "19:45", "id": "calevt_1792346491626", "time": "19:45", "endDate": "2026-10-21", "endTime": "21:15", "attachment": null, "categoryId": "cat_1792346352157", "note": "", "title": "học tiếng anh", "url": "", "date": "2026-10-21", "categoryColor": "#f8f00d"}, {"id": "calevt_1792346534010", "date": "2026-10-23", "attachment": null, "categoryId": "cat_1792346352157", "endDate": "2026-10-23", "startDate": "2026-10-23", "url": "", "createdAt": "2026-10-18T18:02:14.010Z", "note": "", "updatedAt": "2026-10-18T18:08:37.423Z", "startTime": "19:45", "time": "19:45", "endTime": "21:15", "categoryName": "Học", "title": "học tiếng anh", "categoryColor": "#f8f00d", "allDay": false, "repeat": "weekly"}, {"createdAt": "2026-10-18T18:09:06.244Z", "date": "2026-10-26", "startTime": "19:45", "updatedAt": "2026-10-18T18:09:12.295Z", "endDate": "2026-10-26", "startDate": "2026-10-26", "categoryColor": "#f8f00d", "url": "", "id": "calevt_1792346946244", "note": "", "time": "19:45", "repeat": "weekly", "allDay": false, "categoryName": "Học", "endTime": "21:15", "title": "học tiếng anh", "attachment": null, "categoryId": "cat_1792346352157"}, {"time": null, "title": "Sinh nhật An", "endDate": "2026-10-09", "startDate": "2026-10-09", "attachment": null, "categoryId": "cat_1792347382139", "allDay": true, "repeat": "yearly", "startTime": null, "updatedAt": "2026-10-18T18:16:23.239Z", "categoryColor": "#f105f5", "createdAt": "2026-10-18T18:15:55.764Z", "categoryName": "Sinh nhật", "date": "2026-10-09", "id": "calevt_1792347355764", "endTime": null, "url": "", "note": ""}, {"endTime": null, "categoryColor": "#c084fc", "title": "đóng học phí agena", "id": "calevt_1792349664866", "date": "2026-10-20", "categoryName": "Công việc", "note": "đóng 7.250.000 đ", "allDay": true, "repeat": "none", "time": null, "attachment": null, "categoryId": "cong-viec", "startDate": "2026-10-20", "url": "", "createdAt": "2026-10-18T18:54:24.866Z", "startTime": null, "updatedAt": "2026-10-19T06:53:18.127Z", "endDate": "2026-10-20"}, {"url": "", "time": "13:00", "startDate": "2026-10-29", "endDate": "2026-10-29", "repeat": "none", "createdAt": "2026-10-18T20:45:50.866Z", "allDay": false, "startTime": "13:00", "categoryColor": "#f83a3a", "date": "2026-10-29", "categoryName": "Thi", "id": "calevt_1792356350866", "endTime": "14:30", "attachment": null, "categoryId": "cat_1792356327728", "note": "A3-102\nCơ sở Cơ sở chính, ĐH SPKT TpHCM", "title": "Thi python"}, {"categoryId": "cat_1792356327728", "attachment": null, "repeat": "none", "allDay": false, "title": "Thi điện tử", "time": "12:45", "endDate": "2026-10-20", "endTime": "15:00", "url": "", "date": "2026-10-20", "id": "calevt_1792388348111", "categoryColor": "#f83a3a", "createdAt": "2026-10-19T05:39:08.111Z", "updatedAt": "2026-10-19T06:52:48.007Z", "startTime": "12:45", "note": "", "categoryName": "Thi", "startDate": "2026-10-20"}, {"createdAt": "2026-10-19T14:03:19.743Z", "allDay": false, "startDate": "2026-12-26", "categoryName": "Sinh nhật", "categoryColor": "#f105f5", "startTime": "09:00", "endTime": "10:00", "title": "Sinh nhật Bi", "categoryId": "cat_1792347382139", "updatedAt": "2026-10-19T14:03:25.267Z", "id": "calevt_1792418599743", "endDate": "2026-12-26", "attachment": null, "repeat": "yearly", "note": "", "time": "09:00", "date": "2026-12-26", "url": ""}], "calCategories": [{"id": "nha", "name": "Nhà", "color": "#38bdf8", "icon": "🏠"}, {"id": "cong-viec", "name": "Công việc", "color": "#c084fc", "icon": "💼"}, {"id": "vui-choi", "name": "Vui chơi", "color": "#10b981", "icon": "🎮"}, {"id": "thoi-han", "name": "Thời hạn", "color": "#ef4444", "icon": "⏰"}, {"id": "cat_1792346352157", "name": "Học", "color": "#f8f00d", "icon": "📌"}, {"id": "cat_1792347351975", "name": "Sinh nhật", "color": "#0919f6", "icon": "📌"}, {"id": "cat_1792347382139", "name": "Sinh nhật", "color": "#f105f5", "icon": "📌"}, {"id": "cat_1792356327728", "name": "Thi", "color": "#f83a3a", "icon": "📌"}], "googleAccounts": [{"id": "koyasaki261207@gmail.com", "email": "koyasaki261207@gmail.com", "name": "Najime", "avatar": "data:image/jpeg;base64,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", "lastUsed": "2026-10-19T08:40:10.600Z"}, {"id": "thanhnguyen@gmail.com", "email": "thanhnguyen@gmail.com", "name": "Thanhnguyen", "avatar": "", "lastUsed": "2026-10-19T08:35:48.640Z"}]};

    if (btnCloudRestoreBackup) {
        btnCloudRestoreBackup.addEventListener('click', async () => {
            const user = getCurrentUser();
            if (!user || !user.email) {
                alert('Vui lòng đăng nhập trước khi khôi phục dữ liệu!');
                return;
            }

            if (!confirm('Bạn có chắc muốn khôi phục lại dữ liệu lịch & sự kiện gốc cho tài khoản này không?')) {
                return;
            }

            let restoredTL = false;
            let restoredCal = false;

            // 1. Lấy dữ liệu từ Firestore trước
            if (firestoreDb) {
                try {
                    const cleanEmail = user.email.trim().toLowerCase();
                    const docSnap = await firestoreDb.collection('user_calendars').doc(cleanEmail).get();
                    if (docSnap.exists) {
                        const data = docSnap.data() || {};
                        if (Array.isArray(data.timelineEvents) && data.timelineEvents.length > 0) {
                            cachedEventsMemory = data.timelineEvents;
                            localStorage.setItem(getTimelineStorageKey(), JSON.stringify(data.timelineEvents));
                            restoredTL = true;
                        }
                        if (Array.isArray(data.calEvents) && data.calEvents.length > 0) {
                            localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(data.calEvents));
                            restoredCal = true;
                        }
                        if (Array.isArray(data.calCategories) && data.calCategories.length > 0) {
                            localStorage.setItem(getCalCatsStorageKey(), JSON.stringify(data.calCategories));
                        }
                        if (data.userProfile) {
                            if (data.userProfile.name) user.name = data.userProfile.name;
                            if (data.userProfile.avatar !== undefined) user.avatar = data.userProfile.avatar;
                            setCurrentUser(user);
                            saveGoogleAccount(user);
                            updateAuthUI();
                        }
                    }
                } catch (e) {
                    console.warn('Lỗi đọc Firestore:', e);
                }
            }

            // 2. Nếu Firestore chưa lấy được, tìm từ bản sao lưu máy
            // 2. Dùng bản sao lưu vĩnh viễn tích hợp sẵn nếu máy chưa có
            if ((!restoredTL || !restoredCal) && typeof EMBEDDED_RECOVERY_DATA !== 'undefined' && EMBEDDED_RECOVERY_DATA) {
                if (!restoredTL && Array.isArray(EMBEDDED_RECOVERY_DATA.timelineEvents) && EMBEDDED_RECOVERY_DATA.timelineEvents.length > 0) {
                    cachedEventsMemory = EMBEDDED_RECOVERY_DATA.timelineEvents;
                    localStorage.setItem(getTimelineStorageKey(), JSON.stringify(EMBEDDED_RECOVERY_DATA.timelineEvents));
                    restoredTL = true;
                }
                if (!restoredCal && Array.isArray(EMBEDDED_RECOVERY_DATA.calEvents) && EMBEDDED_RECOVERY_DATA.calEvents.length > 0) {
                    localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(EMBEDDED_RECOVERY_DATA.calEvents));
                    restoredCal = true;
                }
                if (EMBEDDED_RECOVERY_DATA.userProfile) {
                    if (EMBEDDED_RECOVERY_DATA.userProfile.name) user.name = EMBEDDED_RECOVERY_DATA.userProfile.name;
                    if (EMBEDDED_RECOVERY_DATA.userProfile.avatar) user.avatar = EMBEDDED_RECOVERY_DATA.userProfile.avatar;
                    setCurrentUser(user);
                    saveGoogleAccount(user);
                    updateAuthUI();
                }
            }

            if (!restoredTL) {
                const bTL = localStorage.getItem('timeline_backup_auto_tl') || localStorage.getItem('timeline_events_v8');
                if (bTL) {
                    try {
                        const parsed = JSON.parse(bTL);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            cachedEventsMemory = parsed;
                            localStorage.setItem(getTimelineStorageKey(), JSON.stringify(parsed));
                            restoredTL = true;
                        }
                    } catch (e) { }
                }
            }

            if (!restoredCal) {
                const bCal = localStorage.getItem('timeline_backup_auto_cal') || localStorage.getItem(CAL_USER_EVENTS_KEY);
                if (bCal) {
                    try {
                        const parsed = JSON.parse(bCal);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            localStorage.setItem(getCalEventsStorageKey(), JSON.stringify(parsed));
                            restoredCal = true;
                        }
                    } catch (e) { }
                }
            }

            renderEvents();
            if (typeof renderMonthlyCalendar === 'function' && typeof calSelectMonth !== 'undefined' && calSelectMonth && typeof calSelectYear !== 'undefined' && calSelectYear) {
                renderMonthlyCalendar(parseInt(calSelectMonth.value, 10), parseInt(calSelectYear.value, 10));
            }

            if (restoredTL || restoredCal) {
                if (typeof showToastNotification === 'function') {
                    showToastNotification('Đã khôi phục thành công toàn bộ sự kiện gốc!', '🔄 Khôi phục hoàn tất');
                } else {
                    alert('Đã khôi phục thành công toàn bộ sự kiện gốc!');
                }
                closeCloudModal();
            } else {
                alert('Không tìm thấy bản sao lưu cũ nào trên thiết bị này.');
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
                    events = parsed.filter(e => {
                        if (!e || !e.id) return false;
                        const s = new Date(e.start).getTime();
                        const end = new Date(e.end).getTime();
                        if (isNaN(s) || isNaN(end)) return false;
                        return true;
                    });
                }
            }

            // Cơ chế tự phục hồi: Nếu tài khoản đang trống, kiểm tra xem có bản sao lưu nào không
            if (events.length === 0) {
                const autoBackup = localStorage.getItem('timeline_backup_auto_tl') || localStorage.getItem('timeline_events_v8');
                if (autoBackup) {
                    try {
                        const parsedB = JSON.parse(autoBackup);
                        if (Array.isArray(parsedB) && parsedB.length > 0) {
                            events = parsedB.filter(e => e && e.id);
                            if (events.length > 0) {
                                localStorage.setItem(storageKey, JSON.stringify(events));
                            }
                        }
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.error('Lỗi khi đọc LocalStorage:', e);
        }

        // Lưu memory cache (tuyệt đối KHÔNG gọi saveEvents ở đây để tránh tự động kích hoạt đẩy lên đám mây khi chỉ đọc)
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
            try {
                localStorage.setItem(getTimelineStorageKey(), JSON.stringify(events));
            } catch (e) { }
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
                // Tối ưu: Lược bỏ rawImageUrl dạng base64 dung lượng lớn để dung lượng luôn cực nhỏ
                const slimmed = events.map(evt => {
                    const c = { ...evt };
                    if (c.rawImageUrl && typeof c.rawImageUrl === 'string' && c.rawImageUrl.startsWith('data:')) {
                        delete c.rawImageUrl;
                    }
                    return c;
                });
                localStorage.setItem(storageKey, JSON.stringify(slimmed));
                cachedEventsMemory = slimmed;
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

            // Tự động nén và chuẩn hóa ảnh gốc chưa cắt (~35-50KB) để lưu trữ nhẹ nhàng mà cực kỳ sắc nét
            try {
                if (typeof imageSrc === 'string' && imageSrc.startsWith('data:')) {
                    const maxDim = 960;
                    let w = img.naturalWidth || img.width;
                    let h = img.naturalHeight || img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round(h * (maxDim / w));
                            w = maxDim;
                        } else {
                            w = Math.round(w * (maxDim / h));
                            h = maxDim;
                        }
                    }
                    const optCanvas = document.createElement('canvas');
                    optCanvas.width = w;
                    optCanvas.height = h;
                    const optCtx = optCanvas.getContext('2d');
                    optCtx.drawImage(img, 0, 0, w, h);
                    originalImageSrc = optCanvas.toDataURL('image/jpeg', 0.82);
                } else {
                    originalImageSrc = imageSrc;
                }
            } catch (err) {
                console.warn('Lỗi tối ưu ảnh gốc chưa cắt:', err);
                originalImageSrc = imageSrc;
            }

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
            const croppedUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
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
                    originalImageSrc = matched.rawImageUrl || (typeof getKnownRawBannerUrl === 'function' ? getKnownRawBannerUrl(matched.title) : '') || matched.imageUrl;
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

    // Tra cứu kho banner chính thức chưa cắt theo tên sự kiện
    function getKnownRawBannerUrl(title) {
        if (!title || typeof title !== 'string') return '';
        const t = title.trim().toLowerCase();
        if (t.includes('skirk') || t.includes('void star')) {
            return 'https://paimon.moe/images/events/Void%20Stars%20Advent%203.png';
        }
        if (t.includes('escoffier') || t.includes('chanson cerise')) {
            return 'https://paimon.moe/images/events/La%20Chanson%20Cerise%203.png';
        }
        if (t.includes('la hoàn') || t.includes('spiral abyss')) {
            return 'https://paimon.moe/images/events/spiral_abyss.jpg';
        }
        if (t.includes('imaginarium') || t.includes('nhà hát')) {
            return 'https://paimon.moe/images/events/imaginarium_theater.jpg';
        }
        if (t.includes('warm winds') || t.includes('venti')) {
            return 'https://paimon.moe/images/events/When%20Warm%20Winds%20Cavort%201.png';
        }
        if (t.includes('surging ballad') || t.includes('furina')) {
            return 'https://paimon.moe/images/events/Surging%20Ballad%201.png';
        }
        if (t.includes('epitome invocation') || t.includes('định hình quỹ đạo')) {
            return 'https://paimon.moe/images/events/Epitome%20Invocation%20105.png';
        }
        if (t.includes('overflowing favor')) {
            return 'https://paimon.moe/images/events/Overflowing%20Favor%201.png';
        }
        if (t.includes('snowball fight') || t.includes('carefree snowball')) {
            return 'https://paimon.moe/images/events/Carefree%20Snowball%20Fight%201.png';
        }
        if (t.includes('predictive victory')) {
            return 'https://paimon.moe/images/events/Predictive%20Victory%20Dynamics%201.png';
        }
        if (t.includes('stygian onslaught')) {
            return 'https://paimon.moe/images/events/Stygian%20Onslaught%201.png';
        }
        return '';
    }

    function openEventDetail(evt) {
        if (!modalEventDetail || !evt) return;
        currentDetailEvent = evt;

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
                    rawImageUrl: (originalImageSrc && typeof originalImageSrc === 'string' && originalImageSrc.startsWith('data:') && originalImageSrc.length > 150000) ? (getKnownRawBannerUrl(title) || '') : (originalImageSrc || getKnownRawBannerUrl(title) || imgVal || ''),
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
                        rawImageUrl: (originalImageSrc && typeof originalImageSrc === 'string' && originalImageSrc.startsWith('data:') && originalImageSrc.length > 150000) ? (getKnownRawBannerUrl(title) || '') : (originalImageSrc || getKnownRawBannerUrl(title) || imgVal || ''),
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

    // DOM Elements cho Modal Xem Chi Tiết Sự Kiện Lịch (Chỉ xem thông tin, không sửa/xóa)
    const modalCalEventView = document.getElementById('modal-cal-event-view');
    const btnCloseCalViewModal = document.getElementById('btn-close-cal-view-modal');
    const btnDoneCalViewModal = document.getElementById('btn-done-cal-view-modal');
    const viewCalIcon = document.getElementById('view-cal-icon');
    const viewCalCatBadge = document.getElementById('view-cal-cat-badge');
    const viewCalTitle = document.getElementById('view-cal-title');
    const viewCalTimeVal = document.getElementById('view-cal-time-val');
    const viewCalRepeatRow = document.getElementById('view-cal-repeat-row');
    const viewCalRepeatVal = document.getElementById('view-cal-repeat-val');
    const viewCalNoteRow = document.getElementById('view-cal-note-row');
    const viewCalNoteVal = document.getElementById('view-cal-note-val');
    const viewCalAttachmentRow = document.getElementById('view-cal-attachment-row');
    const viewCalAttachmentVal = document.getElementById('view-cal-attachment-val');
    const viewCalUrlRow = document.getElementById('view-cal-url-row');
    const viewCalUrlVal = document.getElementById('view-cal-url-val');

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
            if ((!raw || raw === '[]') && user) {
                const autoBackup = localStorage.getItem('timeline_backup_auto_cal');
                if (autoBackup) {
                    try {
                        const parsedBackup = JSON.parse(autoBackup);
                        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
                            localStorage.setItem(key, autoBackup);
                            return parsedBackup;
                        }
                    } catch (e) { }
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

    function openCalEventViewModal(evt, isHoliday = false) {
        if (!modalCalEventView) return;

        if (isHoliday) {
            if (viewCalIcon) viewCalIcon.textContent = '🎉';
            if (viewCalCatBadge) {
                viewCalCatBadge.textContent = 'Ngày lễ';
                viewCalCatBadge.style.background = '#ef444422';
                viewCalCatBadge.style.color = '#ef4444';
                viewCalCatBadge.style.borderColor = '#ef444444';
            }
            if (viewCalTitle) viewCalTitle.textContent = evt.title || evt;
            if (viewCalTimeVal) {
                const dateStr = activeTimelineDate ? `${activeTimelineDate.getDate()}/${activeTimelineDate.getMonth() + 1}/${activeTimelineDate.getFullYear()}` : 'Cả ngày';
                viewCalTimeVal.textContent = `Cả ngày (${dateStr})`;
            }
            if (viewCalRepeatRow) viewCalRepeatRow.style.display = 'none';
            if (viewCalNoteRow) viewCalNoteRow.style.display = 'none';
            if (viewCalAttachmentRow) viewCalAttachmentRow.style.display = 'none';
            if (viewCalUrlRow) viewCalUrlRow.style.display = 'none';
        } else {
            const cat = DEFAULT_CAL_CATEGORIES.find(c => c.id === evt.categoryId) || {
                name: evt.categoryName || 'Sự kiện',
                color: evt.categoryColor || '#38bdf8',
                icon: '📌'
            };

            if (viewCalIcon) viewCalIcon.textContent = cat.icon || '📌';
            if (viewCalCatBadge) {
                viewCalCatBadge.textContent = evt.categoryName || cat.name || 'Sự kiện';
                viewCalCatBadge.style.background = `${evt.categoryColor || cat.color}22`;
                viewCalCatBadge.style.color = evt.categoryColor || cat.color;
                viewCalCatBadge.style.borderColor = `${evt.categoryColor || cat.color}44`;
            }
            if (viewCalTitle) viewCalTitle.textContent = evt.title || '';

            if (viewCalTimeVal) {
                const timeStr = formatCalEventTimeRange(evt);
                const sDate = evt.startDate || evt.date || '';
                const eDate = evt.endDate || sDate;
                let dateDisplay = '';
                if (sDate && eDate && sDate !== eDate) {
                    dateDisplay = ` • ${sDate} ➔ ${eDate}`;
                } else if (sDate) {
                    dateDisplay = ` • ${sDate}`;
                }
                viewCalTimeVal.textContent = `${timeStr}${dateDisplay}`;
            }

            // Lặp lại
            if (viewCalRepeatRow && viewCalRepeatVal) {
                if (evt.repeat && evt.repeat !== 'none') {
                    viewCalRepeatRow.style.display = 'flex';
                    viewCalRepeatVal.textContent = getRepeatLabel(evt.repeat);
                } else {
                    viewCalRepeatRow.style.display = 'none';
                }
            }

            // Ghi chú
            if (viewCalNoteRow && viewCalNoteVal) {
                if (evt.note && evt.note.trim()) {
                    viewCalNoteRow.style.display = 'flex';
                    viewCalNoteVal.textContent = evt.note;
                } else {
                    viewCalNoteRow.style.display = 'none';
                }
            }

            // Đính kèm
            if (viewCalAttachmentRow && viewCalAttachmentVal) {
                if (evt.attachment) {
                    viewCalAttachmentRow.style.display = 'flex';
                    viewCalAttachmentVal.innerHTML = `<a href="${evt.attachment.dataUrl || '#'}" download="${escapeHtml(evt.attachment.name)}" style="color: #38bdf8; text-decoration: underline;">${escapeHtml(evt.attachment.name)}</a>`;
                } else {
                    viewCalAttachmentRow.style.display = 'none';
                }
            }

            // URL
            if (viewCalUrlRow && viewCalUrlVal) {
                if (evt.url && evt.url.trim()) {
                    viewCalUrlRow.style.display = 'flex';
                    viewCalUrlVal.innerHTML = `<a href="${escapeHtml(evt.url)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; word-break: break-all; text-decoration: underline;">${escapeHtml(evt.url)}</a>`;
                } else {
                    viewCalUrlRow.style.display = 'none';
                }
            }
        }

        modalCalEventView.classList.add('is-active');
        modalCalEventView.setAttribute('aria-hidden', 'false');
    }

    function closeCalEventViewModal() {
        if (!modalCalEventView) return;
        modalCalEventView.classList.remove('is-active');
        modalCalEventView.setAttribute('aria-hidden', 'true');
    }

    if (btnCloseCalViewModal) {
        btnCloseCalViewModal.addEventListener('click', closeCalEventViewModal);
    }
    if (btnDoneCalViewModal) {
        btnDoneCalViewModal.addEventListener('click', closeCalEventViewModal);
    }
    if (modalCalEventView) {
        modalCalEventView.addEventListener('click', (e) => {
            if (e.target === modalCalEventView) closeCalEventViewModal();
        });
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
                    pill.title = 'Nhấp để xem thông tin';
                    pill.addEventListener('click', () => openCalEventViewModal({ title: holiday }, true));
                    dayHAlldayPills.appendChild(pill);
                }

                allDayEvents.forEach(evt => {
                    const pill = document.createElement('div');
                    pill.className = 'day-h-allday-pill';
                    pill.style.background = `linear-gradient(135deg, ${evt.categoryColor || '#38bdf8'} 0%, rgba(15, 23, 42, 0.9) 100%)`;
                    pill.style.borderLeft = `3px solid ${evt.categoryColor || '#38bdf8'}`;
                    pill.innerHTML = `📌 ${escapeHtml(evt.title)}`;
                    pill.title = 'Nhấp để xem thông tin sự kiện';
                    pill.addEventListener('click', () => openCalEventViewModal(evt));
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
                `;
                bar.title = `${ev.title} (${timeLabel})${ev.note ? ' - ' + ev.note : ''}\nNhấp để xem thông tin`;

                // Bấm vào ô trong timeline ngày: chỉ hiển thị thông tin, không cho phép sửa hoặc xóa
                bar.addEventListener('click', () => {
                    openCalEventViewModal(ev);
                });

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