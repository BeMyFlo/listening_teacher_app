# PLAN — Phase 11: Trang giới thiệu (landing) ở `www.bemyflo.com`

> Trạng thái: **11A + 11B CODE XONG trên nhánh `phase-11-landing` (chưa merge, chưa deploy) ◐.** Soạn 2026-10-09 theo yêu cầu của chủ dự án; chủ dự án đã trả lời Q1–Q8 cùng ngày (xem mục 8). 11C (trang pháp lý) để sau theo Q7. Số phase: 8 = TOEIC (đang nằm trên nhánh `phase-8-toeic`), 9 = tương lai, 10/10B = subdomain, nên đây là **Phase 11**.
> Nhánh làm việc dự kiến: `phase-11-landing` (không bao giờ push thẳng `main`).

## 1. Mục tiêu và ngoài phạm vi

**Mục tiêu.** Người lạ (giáo viên, chủ trung tâm) mở `www.bemyflo.com` phải hiểu trong 10 giây: BeMyFlo là gì,
dành cho ai, làm được gì, xem thử ở đâu, liên hệ thế nào. Đồng thời Google có nội dung tiếng Việt thật để lập chỉ mục.

**Ngoài phạm vi (cố ý):** đăng ký tự phục vụ (vẫn là B2B theo hợp đồng, xem `no-self-signup`), thanh toán, bảng giá,
blog, đa ngôn ngữ, form liên hệ có lưu dữ liệu, analytics bên thứ ba.

## 2. Hiện trạng (đã kiểm code 2026-10-09)

- `app/page.js` là component client chỉ làm một việc: có phiên thì `router.replace(NAV[role].home)`, không thì `/login`.
  → Người lạ vào `www.bemyflo.com` thấy form đăng nhập; Google không có nội dung nào để xếp hạng (chỉ có thẻ meta ở `app/layout.js`).
- Google **đã lập chỉ mục** `https://www.bemyflo.com` (kiểm bằng `site:bemyflo.com`, 2026-10-09) và Search Console đã xác minh.
- `<html lang="en">` toàn cục (UI app là tiếng Anh, đúng quy tắc English-only UI). Metadata SEO đã là tiếng Việt.
- `lib/host.js` `parseHost`: `root` (gốc, `www`, host lạ như `*.vercel.app`) | `tenant` | `invalid`.
- Nhánh `seo-robots-sitemap` (`robots.txt` + `sitemap.xml` theo host, `lib/seo.js`): **chưa merge** — Phase 11 xây tiếp trên nó.
- `demo-seed` đã merge: workspace `demo` có guard chặn AI + email.
- `lib/platform.js`: `PLATFORM_NAME`, `PLATFORM_LOGO` (= `/logo.png`) — landing dùng đúng hai hằng này nên đổi logo/tên sau này chỉ sửa một chỗ.

## 3. Quyết định kiến trúc (đã thống nhất với chủ dự án 2026-10-09)

| Địa chỉ | Việc |
|---|---|
| `www.bemyflo.com/` | **Trang giới thiệu (mới)**, nút **Đăng nhập** ở góc, nút **Xem demo** |
| `www.bemyflo.com/login` | Đăng nhập chung — **giữ nguyên**. Phase 10B (tự chuyển sang subdomain) không đổi |
| `<slug>.bemyflo.com` | Trang đăng nhập có thương hiệu từng trung tâm — **giữ nguyên hành vi `/` cũ** (redirect) |

Không tách app sang `app.bemyflo.com` (kéo theo đổi cơ chế chuyển phiên; `app` đã là tên bị cấm). Không dùng domain thứ hai cho trang giới thiệu (chia sức SEO).

**Cách dựng `/`:** `app/page.js` thành **server component** đọc `headers().get("host")`:
- host `root` → render `<Landing />` (HTML đầy đủ phía server, Google đọc được ngay, không cần JS).
- host `tenant`/`invalid` → render component redirect cũ (chuyển vào `components/SessionRedirect.js`, logic y nguyên).
- Logic chọn view là hàm thuần `shouldShowLanding(host)` (`lib/landing.js`) để **test được không cần server**.

**Người đã đăng nhập mở `www.bemyflo.com`:** KHÔNG ép chuyển hướng nữa (đó là hành vi cũ, nó làm Google/người mới chỉ thấy trang trống). Một island client nhỏ (`<SessionCta />`) đọc `readSession` và đổi nút
**Đăng nhập → Vào ứng dụng** (link `NAV[role].home`; `RoleGate` + Phase 10B lo phần chuyển sang subdomain như cũ).
Tác động cần báo trước: giáo viên đang bookmark `bemyflo.com` sẽ phải bấm thêm 1 lần.

**Ngôn ngữ:** nội dung tiếng Việt, đặt `lang="vi"` trên `<main>` của landing (không đổi `<html lang>` toàn cục vì UI app là tiếng Anh).
Quy tắc "UI chỉ tiếng Anh" áp cho **ứng dụng**; trang quảng bá nhắm giáo viên Việt Nam — xem Q1.

## 4. Cấu trúc trang (một cột cuộn, mobile-first)

1. **Thanh trên cùng (dính):** logo + tên · neo `Tính năng` `Cách hoạt động` `Hỏi đáp` · nút **Đăng nhập** (hoặc **Vào ứng dụng**).
2. **Hero:** 1 `<h1>`, 1 câu mô tả, 2 nút (**Xem demo**, **Liên hệ**), 1 ảnh chụp màn hình dashboard giáo viên.
3. **Tính năng (6 thẻ):** Bài giảng & ngân hàng câu hỏi IELTS · Đề thi thử 4 kỹ năng · Chấm Writing/Speaking có AI hỗ trợ (giáo viên duyệt) · Giao bài theo lớp + hạn nộp · Điểm danh & theo dõi bài tập về nhà · Nhập từ Excel.
4. **Xem thật (2–3 ảnh chụp):** chấm Writing có sửa lỗi inline · dashboard "học viên cần chú ý" · làm đề thi thử.
5. **Cách hoạt động (3 bước):** Liên hệ → nhận workspace riêng `ten-cua-ban.bemyflo.com` · Tạo/nhập bài và giao cho lớp · Chấm và theo dõi tiến độ.
6. **Khối demo:** nút vào `demo.bemyflo.com` + tài khoản demo hiển thị rõ (mật khẩu demo công khai có chủ đích, xem `demo-workspace`).
7. **Hỏi đáp (5–6 câu, chỉ những điều đã kiểm là đúng):** học viên có tự đăng ký không (không, giáo viên tạo) · AI có thay giáo viên chấm không (không, AI soạn nháp, giáo viên duyệt/sửa) · dữ liệu các trung tâm có lẫn nhau không (không, cô lập ở server) · nhập câu hỏi từ Excel được không · có tùy chỉnh tên/logo/màu và địa chỉ riêng không.
8. **Liên hệ:** email / Zalo (đọc từ env, xem §6) · **Chân trang:** © BeMyFlo, `Chính sách bảo mật`, `Điều khoản`, `Đăng nhập`.

**Nguyên tắc nội dung — không bịa:** không số liệu/khách hàng/đánh giá/"được tin dùng bởi…" nếu chưa có thật; không bảng giá (chưa quyết); không hứa tính năng chưa chạy
(chat lớp: kiểm trạng thái deploy trước khi đưa vào); không nói "dùng tốt trên điện thoại" trước khi tự kiểm. Nêu tên trung tâm đang dùng chỉ khi họ đồng ý (Q4).

## 5. Thiết kế kỹ thuật

- **File mới:** `app/page.js` (server) · `components/SessionRedirect.js` (logic cũ) · `components/landing/{Landing,Nav,Features,Faq,DemoCard,Contact,Footer}.js` · `components/landing/SessionCta.js` (client) · `styles/landing.css` (prefix `.lp-`, chỉ import ở landing để không đụng `legacy.css` 4127 dòng) · `lib/landing.js` (`shouldShowLanding`, hằng nội dung) · `public/landing/*.webp` (ảnh chụp) · `public/og.png`.
- **Màu/phông:** dùng biến CSS đang có (`--blue`, `--ink`, `--bg`...) và phông của app để đồng bộ thương hiệu; chỉ giao diện sáng.
- **SEO:** `generateMetadata` cho `/`: title/description (đã có), `alternates.canonical = https://www.bemyflo.com/`, Open Graph + Twitter (`og.png` 1200×630). JSON-LD `Organization` + `SoftwareApplication` (`applicationCategory: EducationalApplication`),
  **không** có `aggregateRating`/`offers` bịa. Đúng 1 `<h1>`, thứ bậc heading hợp lý, `alt` mô tả cho mọi ảnh.
- **Hiệu năng:** `next/image` có `width/height` (không nhảy bố cục), chỉ ảnh hero `priority`, ảnh WebP < ~150 KB, không thư viện JS mới. Mục tiêu Lighthouse mobile ≥ 90 (Performance/SEO/Accessibility), LCP < 2.5 s.
- **Truy cập được:** điều hướng bàn phím, focus rõ, tương phản đủ, nút/thẻ đủ lớn trên mobile.
- **Link demo:** dựng từ `workspaceOrigin("demo")`; nếu chưa cấu hình tên miền gốc (dev local) thì ẩn khối demo.
- **Sitemap:** `lib/seo.js` thêm `/privacy`, `/terms` (sau 11C). `robots.txt` giữ nguyên (đã cho `/`, chặn khu vực sau đăng nhập và mọi subdomain).
- **Form xin dùng thử (chủ dự án chọn, Q3):** KHÔNG tạo tài khoản — chỉ lưu yêu cầu để admin liên hệ lại, nên quy tắc "không tự đăng ký" vẫn giữ. Model `SignupRequest` (tầng platform, không có `workspaceId`), API công khai `POST /api/public/signup-request` (ô bẫy, giới hạn theo IP, trần 1000 yêu cầu `new`, trùng email 24h thì bỏ qua, không trả lại dữ liệu), API admin `/api/sysadmin/signup-requests` (xem/đổi trạng thái/ghi chú/xoá) và trang `/admin/signups`. Thư báo cho chủ dự án gửi nếu đặt env `SIGNUP_NOTIFY_EMAIL`.
- **Env (tuỳ chọn):** `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_PHONE` (mặc định là liên hệ chủ dự án đưa ngày 2026-10-09), `SIGNUP_NOTIFY_EMAIL` (địa chỉ nhận thư báo có yêu cầu mới; thiếu thì không gửi thư, vẫn xem được ở trang admin).

## 6. Các bước thực hiện

| Bước | Việc | Ghi chú |
|---|---|---|
| 11.0 | **Việc chủ dự án trước khi code** | merge `seo-robots-sitemap` · **xoá/đổi `NEXT_PUBLIC_PLATFORM_NAME` trên Vercel** (đang ghi đè thành "IELTS LMS", landing sẽ hiện sai tên) · trả lời Q1–Q7 |
| 11A | Khung + SEO | `app/page.js` server + `shouldShowLanding` + `SessionRedirect` + `SessionCta`; Nav/Hero/Footer; metadata/canonical/JSON-LD; `styles/landing.css` |
| 11B | Nội dung + ảnh | Tính năng, hỏi đáp, khối demo, liên hệ; chụp ảnh từ workspace `demo` bằng trình duyệt tích hợp (chỉ dữ liệu demo, không dữ liệu khách thật); tạo `og.png` |
| 11C | Trang pháp lý | `/privacy`, `/terms`: tôi soạn **bản nháp** theo đúng dữ liệu app thu thập (tên, email tuỳ chọn, bài viết, **ghi âm Speaking**, kết quả học tập); **chủ dự án/luật sư duyệt trước khi công bố**, đây không phải tư vấn pháp lý. Bắt buộc có trước khi quảng bá rộng (mạng xã hội, chạy quảng cáo) |
| 11D | Hậu kiểm | Lighthouse mobile · gửi `sitemap.xml` ở Search Console · "Yêu cầu lập chỉ mục" lại trang chủ · kiểm Open Graph bằng trình gỡ lỗi chia sẻ của Facebook/Zalo |

11A+11B nằm cùng nhánh `phase-11-landing` (gắn chặt với nhau, owner duyệt nội dung trước khi merge). 11C có thể tách nhánh riêng. Ước lượng: ~1–1,5 ngày code; thời gian chờ chủ yếu là các quyết định bên dưới và duyệt nội dung.

## 7. Rủi ro và cách kiểm

| Rủi ro | Giảm thiểu / kiểm |
|---|---|
| Subdomain của khách (`ieltswithnhi.`) bỗng hiện landing thay vì đăng nhập | Hàm thuần `shouldShowLanding` có test cho: `www`, gốc, `ieltswithnhi.`, `demo.`, `a.b.`, `*.vercel.app`, rỗng; chạy bằng node, **không đụng dev server**. Sau deploy: `curl` `/` ở 3 host và so nội dung |
| Giáo viên đã đăng nhập thấy hành vi khác | Nêu rõ ở §3; nút "Vào ứng dụng"; `/login` và RoleGate không đổi |
| Landing hiện sai tên thương hiệu | Phụ thuộc 11.0 (env `NEXT_PUBLIC_PLATFORM_NAME`) |
| Dev local: `localhost:3000/` giờ ra landing, không còn tự vào app | Có nút "Vào ứng dụng"/"Đăng nhập"; ghi vào changelog |
| Demo bị khách nghịch làm hỏng dữ liệu | Có lệnh reset (`demo-workspace`); xét lịch reset định kỳ riêng, ngoài Phase 11 |
| Build thất bại do `headers()` | Trang vốn đã động theo host; Vercel preview của nhánh là bước kiểm đầu tiên trước khi merge |
| Nội dung quảng bá nói quá | Danh sách "không bịa" ở §4; chủ dự án duyệt từng câu ở 11B |

Không cần migration, không đụng DB, không đụng `pages/api`, không đổi `check-tenant-scope`.

## 8. Câu hỏi cần chủ dự án quyết — ĐÃ TRẢ LỜI 2026-10-09

**Câu trả lời:** Q1 tiếng Việt · Q2 haminhthong0811@gmail.com + 0934149864 · Q3 không hiện giá, chỉ form đăng ký, ghi rõ "miễn phí trong giai đoạn thử nghiệm để có người dùng test" · Q4 không nêu tên khách · Q5 có hiện tài khoản demo · Q6 ok ảnh từ demo · Q7 để sau · Q8 giao tôi tự nghĩ: **"Quản lý lớp IELTS gọn hơn, chấm bài nhanh hơn."**

Câu hỏi gốc (giữ để tham chiếu):

- **Q1. Ngôn ngữ trang:** tiếng Việt (đề xuất, khớp metadata SEO và thị trường) · hay song ngữ vi/en?
- **Q2. Kênh liên hệ:** email nào, Zalo/Facebook nào? (cần giá trị thật để đặt env)
- **Q3. Giá:** không hiển thị, dùng "Liên hệ để được tư vấn" (đề xuất, vì giá chưa quyết).
- **Q4. Nêu tên khách đang dùng** ("IELTS with Ms Nhi")? Mặc định **không** nêu tên nếu chưa có đồng ý của cô; chỉ nói chung "đã chạy thực tế trong lớp học".
- **Q5. Hiện tài khoản demo công khai trên trang?** (đề xuất có: mật khẩu demo vốn công khai, AI/email đã bị khoá ở demo.)
- **Q6. Ảnh chụp màn hình** lấy từ workspace `demo` (đề xuất) — chủ dự án duyệt ảnh trước khi đưa lên.
- **Q7. Trang pháp lý** làm ngay trong Phase 11 (đề xuất, trước khi quảng bá rộng) hay để sau?
- **Q8. Khẩu hiệu hero** — chọn 1 (hoặc đưa câu của bạn):
  - A: "Quản lý lớp IELTS gọn hơn, chấm bài nhanh hơn."
  - B: "Giao bài, chấm Writing & Speaking, theo dõi học viên — trong một nơi."
  - C: "Nền tảng quản lý lớp học IELTS cho giáo viên và trung tâm."

## 9. Bản nháp nội dung để duyệt (chưa phải bản cuối)

- **Mô tả hero:** "BeMyFlo giúp giáo viên và trung tâm giao bài, chấm Writing/Speaking có AI hỗ trợ, điểm danh và theo dõi từng học viên. Học viên làm bài luyện tập và thi thử online."
- **Thẻ "Chấm bài có AI hỗ trợ":** "AI soạn nháp điểm và chỉnh sửa trực tiếp trên bài viết, ghi âm Speaking. Giáo viên luôn là người xem lại và quyết định."
- **Thẻ "Nhập từ Excel":** "Đang giữ ngân hàng câu hỏi trong file Excel? Tải lên là có bài, không phải gõ lại."
- **Thẻ "Mỗi lớp một nhịp":** "Cùng một bài học, lớp A mở đủ kỹ năng, lớp B chỉ mở Listening/Reading."
- **Hỏi: "AI có thay giáo viên chấm bài không?"** — "Không. AI chỉ soạn nháp. Điểm và nhận xét cuối cùng do giáo viên duyệt và chỉnh sửa."
- **Hỏi: "Dữ liệu của các trung tâm có bị lẫn nhau không?"** — "Không. Mỗi trung tâm có workspace riêng và hệ thống kiểm soát quyền truy cập ở phía máy chủ."

## 10. Tiêu chí hoàn thành

- `www.bemyflo.com/` trả HTML đầy đủ (kiểm bằng `curl`, không cần JS) với `<title>`, 1 `<h1>`, canonical, OG, JSON-LD hợp lệ.
- `ieltswithnhi.bemyflo.com/` và `demo.bemyflo.com/` vẫn hành xử như cũ (không hiện landing).
- `/login` và luồng Phase 10B không đổi; người có phiên thấy "Vào ứng dụng".
- Lighthouse mobile ≥ 90 cho Performance, SEO, Accessibility; không nhảy bố cục.
- Chủ dự án đã duyệt từng câu nội dung và ảnh; không có số liệu/khách hàng bịa.
- `npm run build` (gồm `check-tenant-scope --strict`) qua; Vercel preview của nhánh chạy được trước khi merge.

## 11. Nhật ký thực hiện

### 2026-10-09 — 11A + 11B code xong trên `phase-11-landing` (chưa merge, chưa deploy) ◐
- Đã làm: `app/page.js` (server, theo host) · `lib/landing.js` · `components/landing/*` · `styles/landing.css` · `public/og.png` ·
  form xin dùng thử + API công khai + API/trang admin (`Sign-up requests` trong sidebar) · `scripts/check-orphans.js` biết collection `signuprequests`.
- Kiểm tra (trên BẢN SAO build ở thư mục tạm, cổng 3199, DB dev; không đụng `.next` hay dev server của chủ dự án):
  `next build` qua · `www`/gốc/`*.vercel.app` ra landing (title, 1 `<h1>`, canonical, JSON-LD) · `ieltswithnhi.`/`demo.`/`a.b.` giữ hành vi cũ (không có landing) ·
  `robots.txt`/`sitemap.xml` đúng theo host · API: GET 405, hợp lệ 200, email sai/tên ngắn/SĐT sai/body không phải object 400, trùng email 200 không lưu thêm,
  ô bẫy 200 không lưu, hit thứ 6 từ một IP 429 · admin API: không token 401, token giáo viên 403, đổi trạng thái/lọc/xoá đúng, id sai 404 · form gửi thành công trong trình duyệt,
  mobile 375px không tràn ngang. Đã xoá sạch dữ liệu probe khỏi DB dev.
- **Chưa có:** ảnh chụp màn hình thật (`SCREENSHOTS` trong `lib/landing.js` đang rỗng nên mục "Xem giao diện thực tế" ẩn) — chủ dự án chụp từ workspace demo rồi đặt vào `public/landing/`;
  trang pháp lý 11C; Lighthouse (cần chạy trên bản deploy preview); chưa thử gửi thư báo thật (cần `SIGNUP_NOTIFY_EMAIL` + Gmail trên Vercel).
- Cần chủ dự án sau khi merge: đặt `SIGNUP_NOTIFY_EMAIL` trên Vercel; xoá `NEXT_PUBLIC_PLATFORM_NAME`; gửi `sitemap.xml` ở Search Console; mở `/robots.txt`, `/sitemap.xml`, `/og.png` kiểm tra.
