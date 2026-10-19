// Gọi Google Gemini để đọc thông tin sự kiện từ ảnh (không thao tác DOM).

import { STORAGE_KEY_GEMINI_KEY, STORAGE_KEY_GEMINI_MODEL } from '../core/constants.js';

export function getGeminiApiKey() {
    return localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
}

// image: { mimeType, base64Data }. Trả về object { title, start, end, tag, note, articleUrl }; lỗi được ném cho UI.
export async function extractEventFromImage(compressed, apiKey) {
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

    return parsed;
}
