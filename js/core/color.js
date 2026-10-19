// Bảng màu sự kiện và tính toán màu (hàm thuần).

// ========================================================
// 6. QUẢN LÝ SỰ KIỆN & HIỂN THỊ (Event Management & Tracks)
// ========================================================

// Bảng màu đơn sắc (Flat Solid Colors) chuẩn theo ảnh chụp Hoyoverse
export const COLOR_THEMES = {
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
export function getHexLuminance(hexColor) {
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
export function getEventTheme(colorHex) {
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

// ========================================================
// CHUYỂN ĐỔI KHÔNG GIAN MÀU RGB <-> HSL HỖ TRỢ PHÂN TÍCH MÀU SẮC
// ========================================================
export function rgbToHsl(r, g, b) {
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

export function hslToRgb(h, s, l) {
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
