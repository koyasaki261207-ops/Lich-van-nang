// Danh mục ảnh banner gốc theo tên sự kiện.

// Tra cứu kho banner chính thức chưa cắt theo tên sự kiện
export function getKnownRawBannerUrl(title) {
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
