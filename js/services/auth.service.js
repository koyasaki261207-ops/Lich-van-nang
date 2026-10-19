// Phiên đăng nhập và danh sách tài khoản đã lưu (localStorage).

import { S } from '../state/store.js';
import { CURRENT_USER_KEY, SAVED_GOOGLE_ACCOUNTS_KEY } from '../core/constants.js';
import { getFirebaseAuth, getFirebaseSdk, initFirebaseApp } from '../config/firebase.js';

export function getCurrentUser() {
    if (S.currentActiveUser) return S.currentActiveUser;
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        if (raw) {
            S.currentActiveUser = JSON.parse(raw);
            if (S.currentActiveUser && S.currentActiveUser.avatar && S.currentActiveUser.avatar.includes('koyasaki_avatar.png')) {
                S.currentActiveUser.avatar = '';
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(S.currentActiveUser));
            }
            return S.currentActiveUser;
        }
    } catch (e) {
        console.error('Lỗi khi đọc session tài khoản:', e);
    }
    return null;
}

export function setCurrentUser(user) {
    S.currentActiveUser = user;
    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(CURRENT_USER_KEY);
    }
}

export function getSavedGoogleAccounts() {
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

export function saveGoogleAccount(userObj) {
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

export function removeSavedGoogleAccount(email) {
    try {
        let accounts = getSavedGoogleAccounts();
        const cleanEmail = email.trim().toLowerCase();
        accounts = accounts.filter(a => a.email.toLowerCase() !== cleanEmail);
        localStorage.setItem(SAVED_GOOGLE_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) { }
}

// --- Quản lý ID sự kiện đã xóa (Tombstone Tracking) để chống hồi sinh khi đồng bộ ---
export function getCleanUserEmail() {
    const u = getCurrentUser();
    return (u && u.email) ? u.email.trim().toLowerCase() : 'guest';
}

// Đăng xuất khỏi Firebase Auth nếu đang có phiên Firebase
export function signOutFirebase() {
    const sdk = getFirebaseSdk();
    if (!sdk) return;
    try {
        const auth = getFirebaseAuth();
        if (auth.currentUser) {
            sdk.signOut(auth).catch(err => console.warn('Lỗi signOut:', err));
        }
    } catch (e) { }
}

// Mở cửa sổ Google Sign-In; trả về user Firebase (lỗi được ném cho UI xử lý)
export async function signInWithGooglePopup(cfg) {
    const sdk = getFirebaseSdk();
    try {
        initFirebaseApp(cfg);
    } catch (e) {
        console.warn('Lỗi kiểm tra Firebase app:', e);
    }
    const auth = getFirebaseAuth();
    sdk.useDeviceLanguage(auth);
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await sdk.signInWithPopup(auth, provider);
    return result.user;
}

// Lắng nghe trạng thái xác thực Firebase; trả về hàm huỷ lắng nghe
export function watchFirebaseAuth(callback) {
    return getFirebaseSdk().onAuthStateChanged(getFirebaseAuth(), callback);
}

// Bắt đầu phiên cho email (tự nhận diện tài khoản đã lưu nếu chỉ gõ phần trước @), trả về user
export function startSession(email, customName, avatarUrl) {
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

    S.isInitialCloudPullComplete = false;
    setCurrentUser(userObj);
    saveGoogleAccount(userObj); // Tự động ghi nhớ tài khoản để hiển thị trong Google Account Chooser
    S.cachedEventsMemory = null;

    return userObj;
}

// Kết thúc phiên hiện tại (đăng xuất Firebase nếu có)
export function endSession() {
    signOutFirebase();
    setCurrentUser(null);
    S.cachedEventsMemory = null;
}
