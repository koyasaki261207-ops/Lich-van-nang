// Trạng thái dùng chung: người dùng, ngày hiển thị, danh sách sự kiện, bộ cắt ảnh, thao tác kéo.

import { DAYS_FUTURE, DAYS_PAST } from '../core/constants.js';

export const S = {
  currentActiveUser: null,
  firestoreDb: null,
  pendingAvatarDataUrl: null,
  firestoreUnsubscribe: null,
  cloudPushTimeout: null,
  isIncomingCloudUpdate: false,
  isInitialCloudPullComplete: false,
  currentEventColor: '#d6aa7d',
  activeTagFilter: null,
  currentLogicalTracks: [],
  currentTrackOrder: [],
  currentTotalTracks: 14,
  timelineDaysData: [],
  isDown: false,
  startX: 0,
  startY: 0,
  initialScrollLeft: 0,
  initialScrollTop: 0,
  cachedEventsMemory: null,
  trackToHoistOnRender: null,
  isDraggingTrack: false,
  dragFromVisualIdx: null,
  currentTargetVisualIdx: null,
  floatingDragCard: null,
  dragOriginCard: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  lastDragPointerX: 0,
  lastDragPointerY: 0,
  trackAutoScrollRaf: null,
  trackAutoScrollSpeed: 0,
  currentCropperImg: null,
  originalImageSrc: '',
  isAutoSyncedImage: false,
  canvasDisplayWidth: 0,
  canvasDisplayHeight: 0,
  zoomLevel: 1.0,
  cropRatioMode: 'banner',
  cropBoxRect: { x: 0, y: 0, width: 180, height: 50 },
  isDraggingBox: false,
  activeResizeHandle: null,
  dragStartX: 0,
  dragStartY: 0,
  startBoxRect: { x: 0, y: 0, width: 0, height: 0 },
  isAiReadingMode: false,
  currentDetailEvent: null,
  detailCountdownTimer: null,
  pendingRepeatEventToDelete: null,
  pendingRepeatDeleteMeta: null,
  pendingScanFile: null,
  currentCalMonth: new Date().getMonth(),
  currentCalYear: new Date().getFullYear(),
  currentSelectedCatId: 'nha',
  currentCalAttachment: null,
  activeDayDetailData: null,
  editingCalEventId: null,
  activeTimelineDate: null,
  nowNeedleInterval: null,
};
export const now = new Date();
// Ngày bắt đầu: lùi đúng 90 ngày tính từ 00:00:00 hôm nay
export const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_PAST);
startDate.setHours(0, 0, 0, 0);
// Ngày kết thúc: tiến đúng 90 ngày tính đến 23:59:59
export const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_FUTURE);
endDate.setHours(23, 59, 59, 999);
export const totalDays = DAYS_PAST + 1 + DAYS_FUTURE;
