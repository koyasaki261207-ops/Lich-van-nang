// Chế độ đọc ảnh bằng AI và modal cấu hình API key.

import { S } from '../state/store.js';
import { STORAGE_KEY_GEMINI_KEY, STORAGE_KEY_GEMINI_MODEL } from '../core/constants.js';
import { extractEventFromImage, getGeminiApiKey } from '../services/ai.service.js';
import { inputArticleUrl, inputEnd, inputNote, inputStart, inputTag, inputTitle, modalAddEvent } from './event-form.js';
import { modalCropImage, openCropper } from './image-cropper.view.js';
import { showToastNotification } from './toast.js';

export function setAiReadingMode(active) {
    S.isAiReadingMode = !!active;
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

    if (S.isAiReadingMode) {
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
    if (modalAiConfig && modalAiConfig.classList.contains('is-active')) return;

    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (!file) continue;

            e.preventDefault();

            if (S.isAiReadingMode) {
                // Chế độ đọc thông tin: gửi ảnh sang Gemini AI
                processAiScanFile(file);
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

export const btnToggleAiMode = document.getElementById('btn-toggle-ai-mode');

export const aiFileDropzone = document.getElementById('ai-file-dropzone');

export const btnAiChooseFile = document.getElementById('btn-ai-choose-file');

export const aiScanFileInput = document.getElementById('ai-scan-file-input');

export const btnAiSettingsGear = document.getElementById('btn-ai-settings-gear');

export const aiScanningOverlay = document.getElementById('ai-scanning-overlay');

export const aiScanStatusText = document.getElementById('ai-scan-status-text');

export const modalAiConfig = document.getElementById('modal-ai-config');

export const btnCloseAiConfig = document.getElementById('btn-close-ai-config');

export const btnCancelAiConfig = document.getElementById('btn-cancel-ai-config');

export const btnSaveAiConfig = document.getElementById('btn-save-ai-config');

export const btnClearAiKey = document.getElementById('btn-clear-ai-key');

export const inputGeminiKey = document.getElementById('input-gemini-key');

export const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');

export const selectGeminiModel = document.getElementById('select-gemini-model');

export const keyStatusHint = document.getElementById('key-status-hint');

export function openAiConfigModal(customHint) {
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

export function closeAiConfigModal() {
    if (!modalAiConfig) return;
    modalAiConfig.classList.remove('is-active');
    modalAiConfig.setAttribute('aria-hidden', 'true');
    S.pendingScanFile = null;
}

export function saveAiConfig() {
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

    S.pendingScanFile = null;
    closeAiConfigModal();
    showToastNotification('Đã lưu cấu hình Google Gemini API thành công!', 'Cài đặt AI');
}

export function clearAiKey() {
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

export function toggleKeyVisibility() {
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
        setAiReadingMode(!S.isAiReadingMode);
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
export function compressImageForAi(file, maxWidth = 1080, quality = 0.82) {
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

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        S.pendingScanFile = file;
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

        const parsed = await extractEventFromImage(compressed, apiKey);

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
        openCropper(compressed.fullQualityDataUrl);

        showToastNotification(`AI đã điền thành công thông tin "${parsed.title || 'Sự kiện'}"!`, 'Đọc ảnh bằng AI');
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
