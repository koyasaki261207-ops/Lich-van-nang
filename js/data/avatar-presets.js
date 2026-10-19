// Bộ avatar mẫu (SVG).

// Bộ sưu tập Avatar mẫu phong cách Mascot & Google
export const PRESET_AVATARS = [
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
