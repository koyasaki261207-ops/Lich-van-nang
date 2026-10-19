// Modal cắt ảnh banner và trích màu nền.

import { S } from '../state/store.js';
import { getHexLuminance, hslToRgb, rgbToHsl } from '../core/color.js';
import { inputTitle } from './event-form.js';

// Các phần tử giao diện Tải & Cắt ảnh
export const eventImageData = document.getElementById('event-image-data');

export const eventImageFile = document.getElementById('event-image-file');

export const eventImageUrl = document.getElementById('event-image-url');

export const btnLoadUrl = document.getElementById('btn-load-url');

export const fileDropzone = document.getElementById('file-dropzone');

export const tabBtnFile = document.getElementById('tab-btn-file');

export const tabBtnUrl = document.getElementById('tab-btn-url');

export const tabContentFile = document.getElementById('tab-content-file');

export const tabContentUrl = document.getElementById('tab-content-url');

export const imageCropPreviewWrapper = document.getElementById('image-crop-preview-wrapper');

export const eventBarPreviewBox = document.getElementById('event-bar-preview-box');

export const previewBarTitle = document.getElementById('preview-bar-title');

export const previewBarArt = document.getElementById('preview-bar-art');

export const btnRecrop = document.getElementById('btn-recrop');

export const btnRemoveArt = document.getElementById('btn-remove-art');

// Các phần tử trong Modal Cắt Ảnh
export const modalCropImage = document.getElementById('modal-crop-image');

export const btnCloseCropModal = document.getElementById('btn-close-crop-modal');

export const btnCancelCrop = document.getElementById('btn-cancel-crop');

export const btnApplyCrop = document.getElementById('btn-apply-crop');

export const cropperCanvas = document.getElementById('cropper-canvas');

export const cropBox = document.getElementById('crop-box');

export const cropperWorkspaceWrapper = document.getElementById('cropper-workspace-wrapper');

export const cropZoomSlider = document.getElementById('crop-zoom-slider');

export const cropZoomValue = document.getElementById('crop-zoom-value');

export const btnRatioBanner = document.getElementById('btn-ratio-banner');

export const btnRatioFree = document.getElementById('btn-ratio-free');

export const cropperSampleBar = document.getElementById('cropper-sample-bar');

export const cropperSampleTitle = document.getElementById('cropper-sample-title');

export const cropperSampleArt = document.getElementById('cropper-sample-art');

// 7.1 Mở / Đóng Modal Cắt Ảnh
export function openCropper(imageSrc) {
    S.originalImageSrc = imageSrc;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        S.currentCropperImg = img;
        S.zoomLevel = 1.0;
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
                S.originalImageSrc = optCanvas.toDataURL('image/jpeg', 0.82);
            } else {
                S.originalImageSrc = imageSrc;
            }
        } catch (err) {
            console.warn('Lỗi tối ưu ảnh gốc chưa cắt:', err);
            S.originalImageSrc = imageSrc;
        }

        // Đồng bộ tên tiêu đề và màu xem trước mẫu
        const curTitle = inputTitle.value.trim() || 'Tên hoạt động';
        if (cropperSampleTitle) cropperSampleTitle.textContent = curTitle;
        const curColor = S.currentEventColor || '#d6aa7d';
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

export function closeCropper() {
    if (!modalCropImage) return;
    modalCropImage.classList.remove('is-active');
    modalCropImage.setAttribute('aria-hidden', 'true');
    S.isDraggingBox = false;
    S.activeResizeHandle = null;
}

// 7.2 Khởi tạo Canvas & Khung cắt
export function initCropperCanvas() {
    if (!S.currentCropperImg || !cropperCanvas || !cropperWorkspaceWrapper) return;
    const wrapW = cropperWorkspaceWrapper.clientWidth || 560;
    const wrapH = cropperWorkspaceWrapper.clientHeight || 280;

    const imgW = S.currentCropperImg.naturalWidth;
    const imgH = S.currentCropperImg.naturalHeight;
    const scale = Math.min((wrapW - 24) / imgW, (wrapH - 24) / imgH, 1);

    const dw = Math.max(100, Math.round(imgW * scale));
    const dh = Math.max(60, Math.round(imgH * scale));
    S.canvasDisplayWidth = dw;
    S.canvasDisplayHeight = dh;

    cropperCanvas.width = dw;
    cropperCanvas.height = dh;
    cropperCanvas.style.width = `${dw}px`;
    cropperCanvas.style.height = `${dh}px`;

    drawCropperImage();

    // Đặt vị trí khung cắt ban đầu ở giữa canvas
    const canvasLeft = cropperCanvas.offsetLeft;
    const canvasTop = cropperCanvas.offsetTop;

    let initW = Math.min(dw * 0.75, 200);
    let initH = S.cropRatioMode === 'banner' ? initW / 3.6 : Math.min(dh * 0.75, 60);
    if (initH > dh * 0.85) {
        initH = dh * 0.85;
        if (S.cropRatioMode === 'banner') initW = initH * 3.6;
    }

    const initX = canvasLeft + (dw - initW) / 2;
    const initY = canvasTop + (dh - initH) / 2;

    S.cropBoxRect = {
        x: Math.round(initX),
        y: Math.round(initY),
        width: Math.round(initW),
        height: Math.round(initH)
    };

    updateCropBoxDom();
    updateLivePreview();
}

export function drawCropperImage() {
    if (!S.currentCropperImg || !cropperCanvas) return;
    const ctx = cropperCanvas.getContext('2d');
    ctx.clearRect(0, 0, cropperCanvas.width, cropperCanvas.height);

    const dw = S.canvasDisplayWidth * S.zoomLevel;
    const dh = S.canvasDisplayHeight * S.zoomLevel;
    const dx = (S.canvasDisplayWidth - dw) / 2;
    const dy = (S.canvasDisplayHeight - dh) / 2;

    ctx.drawImage(S.currentCropperImg, dx, dy, dw, dh);
}

export function updateCropBoxDom() {
    if (!cropBox) return;
    cropBox.style.left = `${S.cropBoxRect.x}px`;
    cropBox.style.top = `${S.cropBoxRect.y}px`;
    cropBox.style.width = `${S.cropBoxRect.width}px`;
    cropBox.style.height = `${S.cropBoxRect.height}px`;
}

// 7.3 Xem trước hình ảnh trực tiếp (Live Preview)
export function updateLivePreview() {
    if (!S.currentCropperImg || !cropperCanvas || !cropperSampleArt) return;
    const canvasLeft = cropperCanvas.offsetLeft;
    const canvasTop = cropperCanvas.offsetTop;

    const relX = S.cropBoxRect.x - canvasLeft;
    const relY = S.cropBoxRect.y - canvasTop;
    const relW = S.cropBoxRect.width;
    const relH = S.cropBoxRect.height;

    const dw = S.canvasDisplayWidth * S.zoomLevel;
    const dh = S.canvasDisplayHeight * S.zoomLevel;
    const dx = (S.canvasDisplayWidth - dw) / 2;
    const dy = (S.canvasDisplayHeight - dh) / 2;

    const origX = ((relX - dx) / dw) * S.currentCropperImg.naturalWidth;
    const origY = ((relY - dy) / dh) * S.currentCropperImg.naturalHeight;
    const origW = (relW / dw) * S.currentCropperImg.naturalWidth;
    const origH = (relH / dh) * S.currentCropperImg.naturalHeight;

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 180;
    previewCanvas.height = 50;
    const pCtx = previewCanvas.getContext('2d');

    try {
        pCtx.drawImage(
            S.currentCropperImg,
            Math.max(0, origX), Math.max(0, origY),
            Math.min(S.currentCropperImg.naturalWidth, origW),
            Math.min(S.currentCropperImg.naturalHeight, origH),
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
        cropperSampleArt.style.backgroundImage = `url('${S.originalImageSrc}')`;
    }
}

// 7.4 Trích xuất màu nền cho ô sự kiện từ ảnh đã cắt
// QUY ĐỊNH: Màu nền phải là MÀU SÁNG, NỔI BẬT (tươi tắn) và NHIỀU (chiếm đa số) trong ảnh sau khi cắt
export function extractDominantLeftEdgeColor(canvas) {
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
export function applyCroppedImage() {
    if (!S.currentCropperImg || !cropperCanvas) return;
    const canvasLeft = cropperCanvas.offsetLeft;
    const canvasTop = cropperCanvas.offsetTop;

    const relX = S.cropBoxRect.x - canvasLeft;
    const relY = S.cropBoxRect.y - canvasTop;
    const relW = S.cropBoxRect.width;
    const relH = S.cropBoxRect.height;

    const dw = S.canvasDisplayWidth * S.zoomLevel;
    const dh = S.canvasDisplayHeight * S.zoomLevel;
    const dx = (S.canvasDisplayWidth - dw) / 2;
    const dy = (S.canvasDisplayHeight - dh) / 2;

    const origX = ((relX - dx) / dw) * S.currentCropperImg.naturalWidth;
    const origY = ((relY - dy) / dh) * S.currentCropperImg.naturalHeight;
    const origW = (relW / dw) * S.currentCropperImg.naturalWidth;
    const origH = (relH / dh) * S.currentCropperImg.naturalHeight;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 180;
    finalCanvas.height = 50;
    const fCtx = finalCanvas.getContext('2d');

    try {
        fCtx.drawImage(
            S.currentCropperImg,
            Math.max(0, origX), Math.max(0, origY),
            Math.min(S.currentCropperImg.naturalWidth, origW),
            Math.min(S.currentCropperImg.naturalHeight, origH),
            0, 0, finalCanvas.width, finalCanvas.height
        );
        const croppedUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
        const dominantColor = extractDominantLeftEdgeColor(finalCanvas);
        setCroppedResult(croppedUrl, dominantColor);
        closeCropper();
    } catch (e) {
        console.warn('CORS tainted canvas, using direct URL fallback');
        setCroppedResult(S.originalImageSrc, '#d6aa7d');
        closeCropper();
    }
}

export function setCroppedResult(dataUrl, dominantColor) {
    if (eventImageData) eventImageData.value = dataUrl;
    if (previewBarArt) previewBarArt.style.backgroundImage = `url('${dataUrl}')`;
    if (previewBarTitle) previewBarTitle.textContent = inputTitle.value.trim() || 'Tên hoạt động';

    // Tự động đồng bộ màu chủ đạo từ mép trái ảnh vào ô xem trước
    let chosenColor = dominantColor || S.currentEventColor || '#d6aa7d';
    S.currentEventColor = chosenColor;

    if (eventBarPreviewBox) {
        eventBarPreviewBox.style.background = chosenColor;
        const lum = getHexLuminance(chosenColor);
        if (previewBarTitle) previewBarTitle.style.color = lum > 60 ? '#111827' : '#ffffff';
    }

    if (imageCropPreviewWrapper) imageCropPreviewWrapper.style.display = 'flex';
    if (tabContentFile) tabContentFile.style.display = 'none';
    if (tabContentUrl) tabContentUrl.style.display = 'none';
}

export function removeCroppedImage() {
    if (eventImageData) eventImageData.value = '';
    S.originalImageSrc = '';
    if (imageCropPreviewWrapper) imageCropPreviewWrapper.style.display = 'none';
    if (eventImageFile) eventImageFile.value = '';
    if (eventImageUrl) eventImageUrl.value = '';

    // Khôi phục lại màu chuẩn mặc định khi xóa ảnh
    S.currentEventColor = '#d6aa7d';
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
            S.activeResizeHandle = handle.dataset.handle;
        } else {
            S.isDraggingBox = true;
        }
        S.dragStartX = e.clientX;
        S.dragStartY = e.clientY;
        S.startBoxRect = { ...S.cropBoxRect };
        e.preventDefault();
    });

    // Hỗ trợ cảm ứng (Touch)
    cropBox.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const handle = e.target.closest('.crop-handle');
        if (handle) {
            S.activeResizeHandle = handle.dataset.handle;
        } else {
            S.isDraggingBox = true;
        }
        S.dragStartX = touch.clientX;
        S.dragStartY = touch.clientY;
        S.startBoxRect = { ...S.cropBoxRect };
        e.preventDefault();
    }, { passive: false });
}

window.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && (S.isDraggingBox || S.activeResizeHandle)) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
}, { passive: false });

export function handlePointerMove(clientX, clientY) {
    if (!S.isDraggingBox && !S.activeResizeHandle) return;
    if (!cropperCanvas) return;

    const canvasLeft = cropperCanvas.offsetLeft;
    const canvasTop = cropperCanvas.offsetTop;
    const minX = canvasLeft;
    const minY = canvasTop;
    const maxX = canvasLeft + S.canvasDisplayWidth;
    const maxY = canvasTop + S.canvasDisplayHeight;

    const dx = clientX - S.dragStartX;
    const dy = clientY - S.dragStartY;

    if (S.isDraggingBox) {
        let nextX = S.startBoxRect.x + dx;
        let nextY = S.startBoxRect.y + dy;

        nextX = Math.max(minX, Math.min(nextX, maxX - S.startBoxRect.width));
        nextY = Math.max(minY, Math.min(nextY, maxY - S.startBoxRect.height));

        S.cropBoxRect.x = Math.round(nextX);
        S.cropBoxRect.y = Math.round(nextY);
    } else if (S.activeResizeHandle) {
        let { x, y, width, height } = S.startBoxRect;
        const minSize = 25;

        if (S.cropRatioMode === 'banner') {
            const ratio = 3.6;
            if (S.activeResizeHandle === 'se' || S.activeResizeHandle === 'e' || S.activeResizeHandle === 's') {
                let nw = Math.max(minSize * ratio, width + dx);
                let nh = nw / ratio;
                if (x + nw > maxX) { nw = maxX - x; nh = nw / ratio; }
                if (y + nh > maxY) { nh = maxY - y; nw = nh * ratio; }
                width = nw;
                height = nh;
            } else if (S.activeResizeHandle === 'nw' || S.activeResizeHandle === 'w' || S.activeResizeHandle === 'n') {
                let nw = Math.max(minSize * ratio, width - dx);
                let nh = nw / ratio;
                let nx = x + (width - nw);
                let ny = y + (height - nh);
                if (nx < minX) { nx = minX; nw = x + width - nx; nh = nw / ratio; ny = y + height - nh; }
                if (ny < minY) { ny = minY; nh = y + height - ny; nw = nh * ratio; nx = x + width - nw; }
                x = nx; y = ny; width = nw; height = nh;
            } else if (S.activeResizeHandle === 'ne') {
                let nw = Math.max(minSize * ratio, width + dx);
                let nh = nw / ratio;
                let ny = y + (height - nh);
                if (x + nw > maxX) { nw = maxX - x; nh = nw / ratio; ny = y + height - nh; }
                if (ny < minY) { ny = minY; nh = y + height - ny; nw = nh * ratio; }
                y = ny; width = nw; height = nh;
            } else if (S.activeResizeHandle === 'sw') {
                let nw = Math.max(minSize * ratio, width - dx);
                let nh = nw / ratio;
                let nx = x + (width - nw);
                if (nx < minX) { nx = minX; nw = x + width - nx; nh = nw / ratio; }
                if (y + nh > maxY) { nh = maxY - y; nw = nh * ratio; nx = x + width - nw; }
                x = nx; width = nw; height = nh;
            }
        } else {
            // Chế độ tự do (Freeform)
            if (S.activeResizeHandle.includes('e')) width = Math.max(minSize, Math.min(width + dx, maxX - x));
            if (S.activeResizeHandle.includes('s')) height = Math.max(minSize, Math.min(height + dy, maxY - y));
            if (S.activeResizeHandle.includes('w')) {
                const nx = Math.max(minX, Math.min(x + dx, x + width - minSize));
                width += (x - nx);
                x = nx;
            }
            if (S.activeResizeHandle.includes('n')) {
                const ny = Math.max(minY, Math.min(y + dy, y + height - minSize));
                height += (y - ny);
                y = ny;
            }
        }

        S.cropBoxRect = {
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
    S.isDraggingBox = false;
    S.activeResizeHandle = null;
});

window.addEventListener('touchend', () => {
    S.isDraggingBox = false;
    S.activeResizeHandle = null;
});

// 7.6 Thanh trượt Thu phóng & Lăn chuột
if (cropZoomSlider) {
    cropZoomSlider.addEventListener('input', (e) => {
        S.zoomLevel = parseFloat(e.target.value);
        if (cropZoomValue) cropZoomValue.textContent = `${Math.round(S.zoomLevel * 100)}%`;
        drawCropperImage();
        updateLivePreview();
    });
}

if (cropperWorkspaceWrapper) {
    cropperWorkspaceWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        S.zoomLevel = Math.max(0.5, Math.min(3.0, S.zoomLevel + delta));
        if (cropZoomSlider) cropZoomSlider.value = S.zoomLevel.toFixed(2);
        if (cropZoomValue) cropZoomValue.textContent = `${Math.round(S.zoomLevel * 100)}%`;
        drawCropperImage();
        updateLivePreview();
    }, { passive: false });
}

// 7.7 Nút chuyển tỉ lệ cắt ảnh (Banner vs Free)
if (btnRatioBanner) {
    btnRatioBanner.addEventListener('click', () => {
        S.cropRatioMode = 'banner';
        btnRatioBanner.classList.add('is-active');
        if (btnRatioFree) btnRatioFree.classList.remove('is-active');

        const newHeight = S.cropBoxRect.width / 3.6;
        S.cropBoxRect.height = Math.round(newHeight);
        updateCropBoxDom();
        updateLivePreview();
    });
}

if (btnRatioFree) {
    btnRatioFree.addEventListener('click', () => {
        S.cropRatioMode = 'free';
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
        if (S.originalImageSrc) {
            openCropper(S.originalImageSrc);
        }
    });
}

if (btnRemoveArt) {
    btnRemoveArt.addEventListener('click', removeCroppedImage);
}
