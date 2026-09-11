# 💖 Đoàn Thảo - Personal Space (Schedule & Notes)

Ứng dụng web PWA cao cấp dành riêng cho **Đoàn Phương Thảo** để quản lý lịch học, ghi chú, đếm ngày yêu, nghe nhạc và trò chuyện cùng trợ lý AI "Chồng yêu".

---

## 📖 Tài Liệu Hướng Dẫn Sử Dụng
👉 **[Xem Hướng Dẫn Sử Dụng Chi Tiết Tại Đây (HUONG_DAN_SU_DUNG.md)](./HUONG_DAN_SU_DUNG.md)**

---

## ✨ Các Tính Năng Nổi Bật

1. **⚡ Đồng bộ Thời khóa biểu 1-chạm từ Cổng sinh viên HPU2** (`sinhvien.hpu2.edu.vn`):
   - Tự động hóa đăng nhập và cào toàn bộ 7 môn học, phòng học, giảng viên, tiết học vào ứng dụng.
2. **📅 Quản lý Thời khóa biểu thông minh**:
   - Chế độ xem theo Ngày (Day view) & Cả tuần (Week view) với màu sắc pastel ngọt ngào.
   - Tự động tính toán và đánh dấu tiết học hiện tại/sắp diễn ra.
3. **🔔 Thông báo nhắc tiết học xuyên màn hình khóa**:
   - Web Push Notification chuẩn Apple APNs (iOS PWA) và FCM (Android/Desktop).
4. **💬 Trợ lý riêng "Chồng yêu" (AI Chatbot & Mascot 3D)**:
   - Trò chuyện thông minh, hỗ trợ nhận diện giọng nói tiếng Việt (Speech-to-Text).
   - Mascot 3D tương tác theo dõi mắt và phản hồi biểu cảm sinh động.
5. **🎵 Trình phát nhạc YouTube Audio (Spotify Style)**:
   - Mini Player cố định đáy màn hình, Full Player vuốt lên kèm đĩa than vinyl xoay mượt mà.
6. **💕 Love Days (Đếm ngày yêu)**:
   - Đếm ngày yêu tự động, quản lý các mốc kỷ niệm kèm thông báo đếm ngược.
7. **🌤️ Dự báo thời tiết & Gợi ý trang phục**:
   - Cập nhật thời tiết theo thời gian thực và nhắc mang ô/áo mưa khi đi học.
8. **📝 Ghi chú thông minh (Notes)**:
   - Quản lý ghi chú bài học theo thư mục, định dạng Markdown và tìm kiếm tức thì.

---

## 🚀 Công Nghệ Sử Dụng

- **Frontend**: Vanilla HTML5, CSS3 Custom Properties, JavaScript ES6+, PWA Service Worker (Cache v22).
- **Backend & Cloud**: Supabase (Auth, PostgreSQL Database, Row Level Security, Deno Edge Functions).
- **3D Graphics Engine**: DThao3D (Canvas WebGL Matrix Engine siêu nhẹ ~10KB, 60fps).
- **Domain**: `sub.dichvutot.store`

---

## 💻 Chạy & Xem Web Cục Bộ (Local Development)

```bash
# Cách 1: Chạy dev server bằng Node.js (Khuyên dùng - không cần cài thêm thư viện)
node server.js

# Hoặc nhấp đúp vào file start-dev.bat trong thư mục dự án
```
- **Trên máy tính**: Mở trình duyệt truy cập `http://localhost:3000`
- **Trên điện thoại**: Mở trình duyệt truy cập `http://<IP-LAN>:3000` (hiển thị trực tiếp trên terminal khi server khởi động, điện thoại cùng kết nối mạng Wi-Fi).

