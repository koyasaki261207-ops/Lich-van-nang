# Lịch Vạn Năng & Timeline

Ứng dụng web thuần (HTML/CSS/JS, không framework, không bước build) gồm lịch tháng âm–dương và timeline sự kiện kiểu Paimon.moe, có đồng bộ đám mây qua Firebase.

## Tính năng

- Lịch tháng dương–âm, can chi, giờ hoàng đạo, ngày lễ; timeline 24 giờ và chi tiết từng ngày; sự kiện lịch riêng có danh mục, ghi chú, đính kèm.
- Timeline ngang ±90 ngày: kéo/lăn chuột, đếm ngược, gom hàng theo tag/tên/chuỗi lặp, sắp xếp & hoán đổi hàng, lọc theo tag.
- Sự kiện lặp lại (ngày/tuần/tháng/năm, vĩnh viễn), tải và cắt ảnh banner, tự trích màu nền.
- Đọc thông tin sự kiện từ ảnh bằng Gemini (API key lưu trên máy bạn).
- Đăng nhập Google (Firebase Authentication) và đồng bộ thời gian thực với Firestore giữa nhiều thiết bị.

## Chạy local

Ứng dụng dùng ES Modules nên cần một máy chủ tĩnh (không mở trực tiếp bằng `file://`):

```bash
npx serve .
# hoặc: python -m http.server 8080
```

Mở địa chỉ được in ra (ví dụ http://localhost:3000).

## Cấu trúc

```
index.html
css/        base, layout, timeline, components, calendar, responsive, auth
js/
  main.js            điểm vào, nối các module
  config/firebase.js cấu hình + nạp Firebase SDK modular v10 (gstatic)
  services/          auth, event, calendar, sync (Firestore), không đụng DOM
  core/              hàm thuần: lunar, date-utils, recurrence, color, holidays, html...
  state/store.js     trạng thái dùng chung (object S)
  data/              dữ liệu tĩnh (avatar mẫu, bản sao lưu dự phòng)
  ui/                các view, thao tác DOM
firestore.rules      luật bảo mật Firestore
```

Quy ước phụ thuộc: `core` ← `services` ← `ui` ← `main`. `core` và `services` không thao tác DOM; `ui` đi qua `services` để đọc/ghi dữ liệu.

## Cấu hình Firebase

1. Tạo dự án tại https://console.firebase.google.com, bật **Authentication → Sign-in method → Google** và tạo **Firestore Database**.
2. Dán cấu hình web app vào `DEFAULT_FIREBASE_CONFIG` trong [js/config/firebase.js](js/config/firebase.js). Cấu hình web không phải bí mật; bảo mật nằm ở Firestore Rules.
3. Triển khai luật bảo mật từ [firestore.rules](firestore.rules) (Firebase Console → Firestore → Rules, hoặc `firebase deploy --only firestore:rules`).
4. **Thêm tên miền triển khai** (ví dụ `ten-ban.github.io`, `localhost`) vào **Authentication → Settings → Authorized domains**, nếu không đăng nhập Google sẽ báo `auth/unauthorized-domain`.

Dữ liệu mỗi người dùng nằm ở `user_calendars/{email}`; luật chỉ cho phép đọc/ghi khi email đã xác thực của tài khoản Google trùng với tài liệu. Vì vậy chỉ người đăng nhập bằng Google thật mới đồng bộ được đám mây; chế độ nhập email tay vẫn dùng được cục bộ.
