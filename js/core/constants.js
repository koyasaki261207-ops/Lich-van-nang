// Hằng số dùng chung: khoá localStorage, khoảng thời gian timeline, danh mục lịch mặc định.

export const VISIBLE_DAYS = 44;

// ========================================================
// QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG & TÁCH BIỆT DỮ LIỆU RIÊNG (User Session & Google Chooser)
// ========================================================
export const CURRENT_USER_KEY = 'timeline_current_user_session';

export const SAVED_GOOGLE_ACCOUNTS_KEY = 'timeline_saved_google_accounts';

// ========================================================
// QUẢN LÝ ĐỒNG BỘ ĐÁM MÂY (FIREBASE REAL-TIME CLOUD SYNC)
// ========================================================
export const FIREBASE_CONFIG_STORAGE_KEY = 'timeline_firebase_config';

   // Tổng số hàng hiển thị

// Tên các thứ tiếng Việt theo đúng giao diện mẫu (CN, T2, T3, T4, T5, T6, T7)
export const WEEKDAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Xác định khoảng thời gian: chính xác 90 ngày trước và 90 ngày sau hôm nay
export const DAYS_PAST = 90;

export const DAYS_FUTURE = 90;

// Tính tổng số ngày (90 ngày trước + 1 ngày hôm nay + 90 ngày sau = 181 ngày)
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ========================================================
// 7.15 TÍNH NĂNG AI VISION (Google Gemini Image Auto-Fill)
// ========================================================
export const STORAGE_KEY_GEMINI_KEY = 'gemini_api_key';

export const STORAGE_KEY_GEMINI_MODEL = 'gemini_ai_model';

// Storage Keys cho Lịch Cá Nhân (hoàn toàn độc lập với Timeline)
export const CAL_USER_EVENTS_KEY = 'calendar_user_events';

export const CAL_CATEGORIES_KEY = 'calendar_user_categories';

export const DEFAULT_CAL_CATEGORIES = [
    { id: 'nha', name: 'Nhà', color: '#38bdf8', icon: '🏠' },
    { id: 'cong-viec', name: 'Công việc', color: '#c084fc', icon: '💼' },
    { id: 'vui-choi', name: 'Vui chơi', color: '#10b981', icon: '🎮' },
    { id: 'thoi-han', name: 'Thời hạn', color: '#ef4444', icon: '⏰' }
];
