# Hướng dẫn cài đặt IELTS with Ms Nhi (bản có dashboard)

Chào cô/thầy! Website đã được nâng cấp: giờ có **dashboard riêng** để tự tải bài nghe/bài đọc lên, tự tạo bài kiểm tra Nghe và Đọc, học sinh có **tài khoản riêng**, và xem toàn bộ bài nộp của học sinh — không cần nhờ ai chỉnh code nữa. Đổi lại, cách cài đặt sẽ khác trước một chút (không còn kéo-thả Netlify + Google Sheet nữa), làm theo đúng thứ tự bên dưới nhé.

---

## TỔNG QUAN — Web này gồm những gì?

- Một **web app** (HTML/CSS/JS + một ít code chạy trên máy chủ) — học sinh đăng nhập vào làm bài Nghe/Đọc, giáo viên vào quản lý.
- Một **cơ sở dữ liệu MongoDB** — lưu tài khoản học sinh, bài nghe/bài đọc, bài kiểm tra, kết quả nộp bài.
- Một tài khoản **Cloudinary** (miễn phí) — nơi lưu trữ các file mp3 và ảnh (sơ đồ/bản đồ) cô/thầy tải lên.
- Web được host trên **Vercel** (miễn phí) — nơi chạy toàn bộ web app.

Ba nơi này (Vercel, MongoDB, Cloudinary) nối với nhau qua các "biến môi trường" (environment variables) — khai báo 1 lần lúc cài đặt, không cần đụng đến code.

---

## BƯỚC 1 — Tạo tài khoản Cloudinary (lưu file âm thanh)

1. Vào **https://cloudinary.com/users/register_free**, đăng ký tài khoản miễn phí (có thể dùng Gmail).
2. Sau khi đăng nhập, vào **Dashboard** (trang chính sau khi login) — cô/thầy sẽ thấy 3 thông tin:
   - **Cloud name**
   - **API Key**
   - **API Secret** (bấm vào biểu tượng con mắt để hiện ra)
3. Copy lại 3 thông tin này, sẽ dùng ở Bước 3.

> Gói miễn phí của Cloudinary cho phép lưu khá nhiều file âm thanh (25GB), đủ dùng cho một lớp học trong thời gian dài.

---

## BƯỚC 2 — Đưa code lên GitHub

1. Nếu chưa có tài khoản GitHub, tạo miễn phí tại **https://github.com/signup**.
2. Tạo 1 repository mới (nút **New repository**), đặt tên tuỳ ý, ví dụ `ielts-listening-site`, để **Private** nếu muốn.
3. Trên máy tính, mở thư mục chứa web (thư mục có file `index.html`, `package.json`...), mở Terminal/Command Prompt tại đó và chạy lần lượt:
   ```
   git add .
   git commit -m "Website luyện nghe IELTS"
   git branch -M main
   git remote add origin https://github.com/<tên-tài-khoản>/<tên-repo>.git
   git push -u origin main
   ```
   (Thay `<tên-tài-khoản>` và `<tên-repo>` bằng thông tin thật. GitHub sẽ hỏi đăng nhập nếu cần.)

---

## BƯỚC 3 — Deploy lên Vercel

1. Vào **https://vercel.com/signup**, chọn **Continue with GitHub** để đăng ký/đăng nhập bằng chính tài khoản GitHub ở Bước 2.
2. Bấm **Add New... → Project**, chọn repository vừa tạo (`ielts-listening-site`) → **Import**.
3. Ở phần **Environment Variables**, thêm lần lượt các biến sau (Name / Value):

   | Name | Value |
   |---|---|
   | `MONGODB_URI` | Đường link kết nối MongoDB Atlas (dạng `mongodb+srv://...`) |
   | `JWT_SECRET` | Một chuỗi bất kỳ, dài, khó đoán (ví dụ tự gõ lung tung 40 ký tự) |
   | `TEACHER_PASSWORD` | Mật khẩu giáo viên muốn dùng để đăng nhập dashboard |
   | `CLOUDINARY_CLOUD_NAME` | Lấy ở Bước 1 |
   | `CLOUDINARY_API_KEY` | Lấy ở Bước 1 |
   | `CLOUDINARY_API_SECRET` | Lấy ở Bước 1 |

4. Bấm **Deploy**. Đợi khoảng 1 phút, Vercel sẽ cấp 1 đường link dạng:
   `https://ielts-listening-site.vercel.app`
   → Đây chính là **link website** để gửi cho học sinh.

> ⚠️ Không bao giờ dán các giá trị ở bảng trên vào file code (như `assets/config.js` trước đây) — chỉ khai báo trong mục Environment Variables của Vercel. Đây là nơi duy nhất các thông tin này được lưu, không ai xem source code của web mà thấy được.

---

## BƯỚC 4 — Kiểm tra xem đã chạy chưa

1. Mở link website vừa deploy → bấm **Giáo viên** → đăng nhập bằng `TEACHER_PASSWORD` đã đặt ở Bước 3.
2. Vào tab **Bài nghe** → tải thử 1 file mp3 lên → kiểm tra nghe lại được ngay trong danh sách.
3. Vào tab **Bài kiểm tra** → bấm **Tạo bài kiểm tra** → đặt tên, thêm 1 phần nghe (chọn file mp3 vừa tải), thêm vài câu hỏi + đáp án đúng → bấm **Lưu & công bố**.
4. Mở link website ở 1 tab khác (hoặc trên điện thoại) → bấm **Học sinh** → **Đăng ký** một tài khoản học sinh thử → chọn **Nghe** hoặc **Đọc** → sẽ thấy bài kiểm tra vừa tạo → làm thử và nộp bài.
5. Quay lại dashboard giáo viên → tab **Bài nộp** sẽ thấy ngay kết quả vừa nộp; tab **Tổng quan** cập nhật số liệu.

Nếu có lỗi hiện màu đỏ (⚠️), thường là do:
- Thiếu hoặc gõ sai 1 trong các Environment Variables ở Bước 3 (vào **Vercel → Project → Settings → Environment Variables** để kiểm tra/sửa, sau đó **Redeploy**).
- MongoDB Atlas chưa cho phép kết nối từ bên ngoài — vào **Atlas → Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`).

---

## CẬP NHẬT WEB SAU NÀY

Mỗi khi sửa code (thêm tính năng, sửa giao diện...), chỉ cần chạy trong thư mục dự án:
```
git add .
git commit -m "Mô tả thay đổi"
git push
```
Vercel sẽ **tự động deploy lại** sau vài chục giây, không cần làm lại từ đầu.

Việc **thêm bài nghe mới / tạo bài kiểm tra mới** thì không cần đụng đến code hay GitHub gì cả — làm trực tiếp trong dashboard giáo viên trên web.

---

## LƯU Ý QUAN TRỌNG

- Mật khẩu giáo viên nay được kiểm tra ở máy chủ (không còn lộ trong mã nguồn như bản cũ), nhưng vẫn nên chọn mật khẩu không quá dễ đoán.
- Không chia sẻ giá trị của `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_API_SECRET` cho ai — những chuỗi này tương đương với "chìa khoá" vào toàn bộ dữ liệu.
- Học sinh tự đăng ký tài khoản (tên đăng nhập + mật khẩu) ngay trên web — không cần giáo viên tạo trước. Trong dashboard, tab **Học viên** cho phép xem danh sách, đặt lại mật khẩu hoặc xoá tài khoản khi cần (ví dụ học sinh quên mật khẩu).
- Bài kiểm tra Đọc dùng chung một hệ thống dạng câu hỏi với bài Nghe (điền từ, trắc nghiệm 1/nhiều đáp án, đúng-sai-không có thông tin, ghép nối, điền nhãn sơ đồ) — chọn dạng phù hợp khi soạn câu hỏi trong tab **Bài kiểm tra**.
