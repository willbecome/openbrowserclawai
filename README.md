# 🦀 OpenBrowserClaw (Phiên bản tối ưu cho người Việt)

**OpenBrowserClaw** là một trợ lý AI cá nhân mạnh mẽ, hoạt động trực tiếp trong trình duyệt của bạn mà không cần máy chủ trung gian. Phiên bản này đã được tinh chỉnh, Việt hóa toàn diện và tối ưu hóa hiệu suất cho người dùng tại Việt Nam.

---

## ✨ Tại sao nên dùng phiên bản này?

- **Hỗ trợ đa mô hình cực mạnh:** Tích hợp sẵn Anthropic, OpenAI, Gemini, DeepSeek, Grok và đặc biệt là **OpenRouter** để sử dụng các mô hình AI chất lượng cao hoàn toàn **miễn phí**.
- **Tiếng Việt 100%:** Toàn bộ giao diện từ các nút bấm, hướng dẫn đến phản hồi hệ thống đều được dịch sang Tiếng Việt chuẩn.
- **Tối ưu Windows 11 & Chrome:** Giao diện mượt mà với font chữ hệ thống và thanh cuộn được thiết kế lại theo phong cách hiện đại.
- **Quyền riêng tư tuyệt đối:** Dữ liệu và API Key của bạn chỉ nằm trong trình duyệt của bạn, được mã hóa an toàn và không bao giờ gửi đi nơi khác.

---

## 🚀 Hướng dẫn cài đặt chi tiết (Dành cho người mới)

Chỉ với vài bước đơn giản, bạn sẽ có ngay một trợ lý AI của riêng mình:

### 1. Chuẩn bị
- Đảm bảo máy tính đã cài đặt **Node.js** (tải tại [nodejs.org](https://nodejs.org/)).
- Sử dụng trình duyệt **Google Chrome** hoặc **Microsoft Edge** để có trải nghiệm tốt nhất.

### 2. Tải và Chạy ứng dụng
Mở **Terminal** (Windows PowerShell hoặc Command Prompt) và chạy các lệnh sau:

```bash
# 1. Tải thư mục chứa mã nguồn này về máy tính của bạn

# 2. Truy cập vào thư mục dự án
cd openbrowserclaw

# 3. Cài đặt các thành phần cần thiết (chỉ cần chạy lần đầu)
npm install

# 4. Khởi động ứng dụng
npm run dev
```

### 3. Truy cập trợ lý
Sau khi chạy lệnh cuối cùng, bạn mở trình duyệt và truy cập địa chỉ: `http://localhost:5173`

---

## 🛠️ Cách cấu hình để sử dụng Miễn Phí

Để bắt đầu trò chuyện, bạn cần cấu hình API Key:

1. Vào mục **"Cài đặt"** (biểu tượng bánh răng).
2. Tại phần **"Nhà cung cấp AI"**, chọn **OpenRouter**.
3. Lấy API Key miễn phí tại [openrouter.ai/keys](https://openrouter.ai/keys) và dán vào ô nhập liệu.
4. Nhấn **"Lưu Key"**.
5. Ở phần **"Mô hình"**, chọn các dòng có chữ **(Free)** để bắt đầu sử dụng không tốn phí.

---

## 💡 Các tính năng chính hiện có

- **Trò chuyện thông minh:** AI có khả năng nhớ ngữ cảnh và hỗ trợ tiếng Việt cực tốt.
- **Quản lý Tệp tin:** AI có thể tạo, đọc và chỉnh sửa các tệp tin ngay trong không gian làm việc của bạn.
- **Nhiệm vụ định kỳ:** Lên lịch để AI tự động làm việc (ví dụ: báo thức, tổng hợp thông tin hàng ngày).
- **Thực thi lệnh:** AI có khả năng chạy mã JavaScript hoặc lệnh Linux (Bash) để giải quyết các yêu cầu phức tạp.

---

## ❓ Các lỗi thường gặp và cách xử lý

- **Lỗi 429 (Rate Limit):**
  - *Nguyên nhân:* Bạn đã vượt quá số lượng câu hỏi cho phép trong một khoảng thời gian (thường gặp khi dùng mô hình Miễn phí).
  - *Xử lý:* Chờ vài phút rồi thử lại, hoặc chuyển sang một mô hình (Free) khác trong phần Cài đặt.
- **Lỗi API Key không hợp lệ:**
  - *Nguyên nhân:* Key nhập sai hoặc đã hết hạn/bị xóa.
  - *Xử lý:* Kiểm tra lại key tại trang quản lý của nhà cung cấp (ví dụ: OpenRouter) và cập nhật lại trong mục Cài đặt.
- **Trợ lý không phản hồi:**
  - *Xử lý:* F5 lại trang web hoặc kiểm tra kết nối internet của bạn.

---
*Dự án này được phát triển với mục tiêu mang AI đến gần hơn với mọi người dùng Việt Nam một cách dễ dàng và an toàn nhất.* 🦀
