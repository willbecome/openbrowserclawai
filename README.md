# 🦀 OpenBrowserClaw (Việt hóa)

**OpenBrowserClaw** là một trợ lý AI cá nhân chạy hoàn toàn trên trình duyệt của bạn. Không cần máy chủ, không cần cài đặt hạ tầng phức tạp — trình duyệt của bạn chính là máy chủ.

Đây là phiên bản được cải tiến mạnh mẽ với giao diện hiện đại, hỗ trợ đa mô hình AI và được tối ưu hóa riêng cho người dùng Việt Nam trên Windows 11.

---

## ✨ Tính năng nổi bật

- **Chạy trực tiếp trên trình duyệt (Browser-native):** Toàn bộ logic, dữ liệu và lịch sử trò chuyện được lưu trữ cục bộ trong trình duyệt của bạn (sử dụng IndexedDB và OPFS).
- **Hỗ trợ đa mô hình AI:** Tích hợp nhiều nhà cung cấp hàng đầu:
  - **OpenRouter (Ưu tiên):** Truy cập hàng trăm mô hình, bao gồm cả các mô hình **miễn phí**.
  - **Anthropic:** Claude 3.7 Sonnet, Claude 3.5 Haiku, Opus.
  - **OpenAI:** GPT-4o, o1, o3-mini.
  - **Google Gemini:** Gemini 2.0 Flash, 1.5 Pro.
  - **DeepSeek:** DeepSeek-V3, DeepSeek-R1.
  - **xAI (Grok) & Perplexity.**
- **Hỗ trợ Công cụ (Tool Use):** AI có thể thực thi lệnh shell (bash), chạy mã JavaScript, đọc/ghi tệp tin, truy cập URL và tạo nhiệm vụ định kỳ.
- **Giao diện Tiếng Việt 100%:** Được thiết kế lại hoàn toàn thân thiện với người dùng Việt.
- **Tối ưu Windows 11 & Chrome:** Sử dụng font chữ hệ thống mượt mà và thanh cuộn hiện đại.
- **Bảo mật tuyệt đối:** API Key của bạn được mã hóa AES-256-GCM và lưu trữ cục bộ, không bao giờ rời khỏi trình duyệt.

---

## 🚀 Hướng dẫn cài đặt cho người mới (Newbie)

Bạn không cần biết quá nhiều về kỹ thuật để bắt đầu. Hãy làm theo các bước sau:

### 1. Chuẩn bị công cụ
- Cài đặt **Node.js** (phiên bản 18 trở lên) từ [nodejs.org](https://nodejs.org/).
- Một trình duyệt web hiện đại (khuyến nghị **Google Chrome** hoặc **Microsoft Edge** trên Windows 11).

### 2. Tải mã nguồn và cài đặt
Mở ứng dụng **Terminal** (hoặc PowerShell/Command Prompt) trên máy tính và chạy các lệnh sau:

```bash
# Tải dự án về máy
git clone https://github.com/your-repo/openbrowserclaw.git
cd openbrowserclaw

# Cài đặt các thư viện cần thiết
npm install

# Chạy ứng dụng ở chế độ phát triển
npm run dev
```

### 3. Mở ứng dụng
Sau khi chạy lệnh `npm run dev`, terminal sẽ hiển thị một địa chỉ (thường là `http://localhost:5173`). Hãy sao chép và dán địa chỉ này vào trình duyệt của bạn.

---

## 🛠️ Cách sử dụng

### Bước 1: Cấu hình AI
1. Nhấp vào tab **"Cài đặt"** trên thanh điều hướng.
2. Chọn **Nhà cung cấp AI** bạn muốn dùng (ví dụ: `OpenRouter`).
3. Nhập **API Key** tương ứng.
   - *Mẹo:* Bạn có thể lấy key OpenRouter tại [openrouter.ai](https://openrouter.ai/).
4. Nhấn **"Lưu Key"**.
5. Chọn **Mô hình** bạn thích từ danh sách thả xuống.

### Bước 2: Bắt đầu trò chuyện
1. Chuyển sang tab **"Trò chuyện"**.
2. Nhập yêu cầu của bạn vào ô dưới cùng.
3. Trợ lý (mặc định tên là **Andy**) sẽ phản hồi và thực hiện các nhiệm vụ như lập trình, tìm kiếm tin tức hoặc xử lý dữ liệu.

### Bước 3: Quản lý tệp tin và nhiệm vụ
- **Tệp tin:** Xem các tệp mà AI đã tạo ra trong quá trình làm việc.
- **Nhiệm vụ:** Lên lịch để trợ lý tự động thực hiện công việc (ví dụ: tổng hợp tin tức mỗi sáng).

---

## 🔒 Bảo mật và Riêng tư

OpenBrowserClaw là một dự án mã nguồn mở ưu tiên quyền riêng tư:
- **Dữ liệu của bạn:** Nằm trong trình duyệt của bạn.
- **API Keys:** Được mã hóa bằng một khóa không thể xuất (non-extractable key) của trình duyệt.
- **Kết nối:** Trình duyệt kết nối trực tiếp đến API của nhà cung cấp AI (Anthropic, OpenRouter...), không qua bất kỳ máy chủ trung gian nào.

---

## ⚙️ Phát triển nâng cao

Nếu bạn là nhà phát triển và muốn đóng góp:

```bash
npm run typecheck  # Kiểm tra lỗi kiểu TypeScript
npm run build      # Biên dịch dự án để triển khai (sản phẩm nằm trong thư mục dist/)
npm run preview    # Xem trước bản biên dịch
```

---
*Chúc bạn có những trải nghiệm tuyệt vời với trợ lý AI cá nhân của riêng mình!* 🦀
