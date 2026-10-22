// Cấu hình Firebase và nạp SDK modular v10 từ gstatic.
// Cấu hình web không phải bí mật; việc bảo vệ dữ liệu nằm ở Firestore Rules (xem firestore.rules).

import { FIREBASE_CONFIG_STORAGE_KEY } from '../core/constants.js';

const FIREBASE_VERSION = '10.14.1';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

export const DEFAULT_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBpW-HumKLjtac1atO_V65OWi_sS3J3a7w',
    authDomain: 'lich-van-nang.firebaseapp.com',
    projectId: 'lich-van-nang',
    storageBucket: 'lich-van-nang.firebasestorage.app',
    messagingSenderId: '934822957407',
    appId: '1:934822957407:web:4b1f27cabd6d9a53b2e6ea',
    measurementId: 'G-1PGN55NQ3E'
};

let sdk = null;

// Nạp SDK. Trả về null nếu không tải được (ví dụ mất mạng) để app vẫn chạy ở chế độ cục bộ.
export async function loadFirebaseSdk() {
    if (sdk) return sdk;
    try {
        const [appMod, authMod, fsMod] = await Promise.all([
            import(`${SDK_BASE}/firebase-app.js`),
            import(`${SDK_BASE}/firebase-auth.js`),
            import(`${SDK_BASE}/firebase-firestore.js`)
        ]);
        sdk = { ...appMod, ...authMod, ...fsMod };
    } catch (err) {
        console.warn('Không tải được Firebase SDK:', err);
    }
    return sdk;
}

export function getFirebaseSdk() {
    return sdk;
}

// Khởi tạo app mặc định. Nếu app cũ có apiKey khác với cfg hiện tại thì khởi tạo lại.
export function initFirebaseApp(cfg) {
    if (!sdk) return null;
    if (sdk.getApps().length) {
        const currentApp = sdk.getApp();
        if (currentApp.options && cfg && currentApp.options.apiKey !== cfg.apiKey) {
            try {
                sdk.deleteApp(currentApp);
            } catch (e) { }
            return sdk.initializeApp(cfg);
        }
        return currentApp;
    }
    return sdk.initializeApp(cfg);
}

export function getFirebaseAuth() {
    return sdk.getAuth(sdk.getApp());
}

export function getFirestoreDb() {
    return sdk.getFirestore(sdk.getApp());
}

export function parseFirebaseConfig(raw) {
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

export function getActiveFirebaseConfig() {
    try {
        const stored = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
        if (stored) {
            const parsed = parseFirebaseConfig(stored);
            if (parsed && parsed.apiKey) {
                // Tự động khắc phục lỗi typo cũ 'jtaclatO' (chữ l) thành 'jtac1atO' (số 1)
                if (parsed.apiKey.includes('jtaclatO')) {
                    parsed.apiKey = parsed.apiKey.replace(/jtaclatO/g, 'jtac1atO');
                    try {
                        localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(parsed));
                    } catch (e) { }
                }
                // Nếu là dự án chính 'lich-van-nang', luôn ưu tiên cấu hình chính thức từ DEFAULT_FIREBASE_CONFIG
                if (!parsed.projectId || parsed.projectId === DEFAULT_FIREBASE_CONFIG.projectId) {
                    if (DEFAULT_FIREBASE_CONFIG.apiKey) {
                        return DEFAULT_FIREBASE_CONFIG;
                    }
                }
                return parsed;
            }
        }
    } catch (e) { }
    if (DEFAULT_FIREBASE_CONFIG.apiKey) {
        return DEFAULT_FIREBASE_CONFIG;
    }
    return null;
}
