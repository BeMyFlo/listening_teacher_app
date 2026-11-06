import "@/styles/landing.css";
import { PLATFORM_NAME, PLATFORM_LOGO } from "@/lib/platform";
import { CONTACT } from "@/lib/landing";
import { POLICY_VERSION } from "@/lib/privacy";

// Chính sách bảo mật / thông báo xử lý dữ liệu cá nhân.
// Căn cứ: Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (Đ.4 quyền chủ thể, Đ.9 đồng ý, Đ.20 chuyển xuyên biên giới,
// Đ.24 trẻ em, Đ.30 AI/cloud) và NĐ 356/2025/NĐ-CP (Đ.4 dữ liệu nhạy cảm, Đ.5 thời hạn, Đ.6 đồng ý, Đ.10 xử lý tự động).
// Sửa nội dung thì tăng POLICY_VERSION trong lib/privacy.js.
// Trang công khai, hiện ở mọi tên miền (kể cả subdomain trung tâm) để học viên cũng đọc được.

export const metadata = {
  title: `Chính sách bảo mật – ${PLATFORM_NAME}`,
  description: `Cách ${PLATFORM_NAME} thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân.`,
};

function fmtDate(v) {
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

export default function PrivacyPolicy() {
  const mail = <a href={"mailto:" + CONTACT.email}>{CONTACT.email}</a>;
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <a className="lp-brand" href="/" aria-label={PLATFORM_NAME}>
            <img src={PLATFORM_LOGO} alt="" width={40} height={40} />
            <span>{PLATFORM_NAME}</span>
          </a>
        </div>
      </header>

      <main className="lp-policy" id="noi-dung">
        <div className="lp-wrap">
          <h1>Chính sách bảo mật và xử lý dữ liệu cá nhân</h1>
          <p className="lp-policy-meta">Phiên bản {fmtDate(POLICY_VERSION)} · Áp dụng cho trang {PLATFORM_NAME} và mọi workspace của trung tâm.</p>

          <p>
            Chính sách này cho biết {PLATFORM_NAME} thu thập dữ liệu cá nhân nào, dùng để làm gì, gửi cho ai, lưu ở đâu và trong bao lâu,
            và bạn có những quyền gì theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.
          </p>

          <h2>1. Ai chịu trách nhiệm với dữ liệu của bạn</h2>
          <ul>
            <li>
              <b>Thông tin đăng ký dùng thử</b> (form trên trang giới thiệu): {PLATFORM_NAME} là bên kiểm soát dữ liệu.
            </li>
            <li>
              <b>Dữ liệu trong workspace của một trung tâm</b> (tài khoản giáo viên, học viên, bài làm, điểm): trung tâm hoặc giáo viên tạo tài khoản
              là bên kiểm soát dữ liệu; {PLATFORM_NAME} là bên xử lý, chỉ xử lý theo yêu cầu của trung tâm để cung cấp dịch vụ.
              Trung tâm có trách nhiệm thông báo và có sự đồng ý của học viên (và cha mẹ/người giám hộ với học viên chưa thành niên)
              trước khi tạo tài khoản.
            </li>
          </ul>
          <p>Liên hệ về dữ liệu cá nhân: {mail}{CONTACT.phone ? <> · {CONTACT.phone}</> : null}.</p>

          <h2>2. Dữ liệu chúng tôi thu thập và mục đích</h2>
          <div className="lp-policy-scroll">
            <table>
              <thead>
                <tr><th>Dữ liệu</th><th>Ai cung cấp</th><th>Mục đích</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Họ tên, email, số điện thoại/Zalo, tên trung tâm, nội dung bạn ghi</td>
                  <td>Bạn, qua form đăng ký dùng thử</td>
                  <td>Liên hệ tư vấn, tạo workspace dùng thử</td>
                </tr>
                <tr>
                  <td>Họ tên, tên đăng nhập, mật khẩu (chỉ lưu dạng mã hoá một chiều), email (không bắt buộc), lớp học</td>
                  <td>Trung tâm/giáo viên khi tạo tài khoản</td>
                  <td>Đăng nhập, phân lớp, giao bài, gửi thông báo và nhắc hạn nộp bài</td>
                </tr>
                <tr>
                  <td>Bài làm Listening/Reading, bài viết Writing, <b>bản ghi âm giọng nói</b> bài Speaking, điểm, nhận xét, nhật ký học tập, điểm danh</td>
                  <td>Học viên và giáo viên khi dùng ứng dụng</td>
                  <td>Chấm bài, nhận xét, theo dõi tiến độ học tập</td>
                </tr>
                <tr>
                  <td>Địa chỉ IP, thời điểm đăng nhập, nhật ký thao tác</td>
                  <td>Tự động khi sử dụng</td>
                  <td>Bảo mật, chống dò mật khẩu, điều tra sự cố</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Bản ghi âm chỉ dùng để giáo viên và công cụ AI nghe và chấm bài nói; chúng tôi <b>không</b> dùng giọng nói để nhận diện danh tính.
            Chúng tôi không thu thập số căn cước, dữ liệu tài chính hay vị trí, và không bán dữ liệu cá nhân.
          </p>

          <h2>3. Chấm bài bằng AI</h2>
          <p>
            Khi giáo viên dùng tính năng chấm nháp bằng AI, bài viết, bản ghi âm và ảnh đề bài được gửi tới dịch vụ Google Gemini để tạo bản
            chấm nháp. Kết quả AI chỉ là gợi ý; giáo viên xem lại và quyết định điểm cuối cùng. Trung tâm có thể không dùng tính năng này,
            và học viên có thể yêu cầu giáo viên chấm thủ công không qua AI.
          </p>

          <h2>4. Bên nhận dữ liệu và chuyển dữ liệu ra nước ngoài</h2>
          <p>Để vận hành, {PLATFORM_NAME} dùng các nhà cung cấp sau. Máy chủ của họ đặt ở nước ngoài, nên dữ liệu được chuyển ra ngoài lãnh thổ Việt Nam:</p>
          <ul>
            <li><b>MongoDB Atlas</b> (MongoDB, Inc.): cơ sở dữ liệu lưu tài khoản, bài làm, điểm.</li>
            <li><b>Cloudinary</b> (Cloudinary Ltd.): lưu tệp âm thanh, hình ảnh, bản ghi âm Speaking.</li>
            <li><b>Vercel</b> (Vercel Inc.): máy chủ chạy ứng dụng web.</li>
            <li><b>Google</b> (Google LLC): Gemini API cho chấm nháp bằng AI; Gmail để gửi email thông báo.</li>
          </ul>
          <p>
            Các nhà cung cấp chỉ được xử lý dữ liệu để cung cấp dịch vụ cho {PLATFORM_NAME}, có biện pháp bảo mật (mã hoá đường truyền, kiểm soát truy cập).
            Ngoài ra, dữ liệu chỉ được cung cấp cho cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu.
            Dữ liệu trong workspace chỉ giáo viên/quản trị của chính trung tâm đó và quản trị viên hệ thống {PLATFORM_NAME} (khi cần hỗ trợ) xem được.
          </p>

          <h2>5. Thời gian lưu trữ</h2>
          <ul>
            <li>Thông tin đăng ký dùng thử: tối đa 12 tháng kể từ lần liên hệ cuối, hoặc xoá sớm hơn khi bạn yêu cầu.</li>
            <li>Tài khoản và bài làm: trong thời gian trung tâm sử dụng dịch vụ. Khi trung tâm xoá học viên hoặc ngừng dùng dịch vụ, dữ liệu liên quan được xoá theo yêu cầu của trung tâm.</li>
            <li>Nhật ký bảo mật: tối đa 12 tháng.</li>
          </ul>

          <h2>6. Dữ liệu của trẻ em</h2>
          <p>
            Học viên chưa đủ 16 tuổi chỉ được tạo tài khoản khi trung tâm đã có sự đồng ý của cha mẹ hoặc người giám hộ (và của chính học viên nếu từ đủ 7 tuổi).
            Cha mẹ/người giám hộ có thể thực hiện các quyền ở mục 7 thay cho học viên, và có thể rút lại đồng ý bất cứ lúc nào; khi đó chúng tôi và trung tâm sẽ ngừng xử lý dữ liệu của học viên.
          </p>

          <h2>7. Quyền của bạn</h2>
          <p>Bạn có quyền:</p>
          <ul>
            <li>được biết về việc xử lý dữ liệu của mình;</li>
            <li>đồng ý hoặc không đồng ý, và rút lại sự đồng ý (việc rút lại không ảnh hưởng tới xử lý đã thực hiện trước đó);</li>
            <li>xem, chỉnh sửa, yêu cầu cung cấp bản sao dữ liệu;</li>
            <li>yêu cầu xoá, hạn chế xử lý, phản đối xử lý dữ liệu;</li>
            <li>khiếu nại, tố cáo, khởi kiện và yêu cầu bồi thường theo quy định pháp luật.</li>
          </ul>
          <p>
            Gửi yêu cầu bằng email tới {mail} (học viên có thể gửi qua trung tâm của mình). Chúng tôi phản hồi trong 02 ngày làm việc và thực hiện
            trong thời hạn theo Nghị định 356/2025/NĐ-CP (ví dụ: rút đồng ý trong 15 ngày, chỉnh sửa/cung cấp trong 10 ngày, xoá trong 20 ngày).
          </p>

          <h2>8. Bảo mật và sự cố</h2>
          <p>
            Mật khẩu được mã hoá một chiều; kết nối dùng HTTPS; quyền truy cập được giới hạn theo vai trò và theo trung tâm.
            Ứng dụng chỉ lưu mã đăng nhập (token) trong bộ nhớ trình duyệt của bạn, không dùng cookie quảng cáo hay công cụ theo dõi bên thứ ba.
            Nếu xảy ra sự cố lộ lọt dữ liệu, chúng tôi sẽ thông báo cho cơ quan chuyên trách và người bị ảnh hưởng theo thời hạn pháp luật quy định.
          </p>

          <h2>9. Thay đổi chính sách</h2>
          <p>
            Khi chính sách thay đổi, chúng tôi cập nhật phiên bản ở đầu trang. Nếu thay đổi mục đích xử lý, chúng tôi sẽ xin lại sự đồng ý của bạn.
          </p>

          <p style={{ marginTop: 32 }}><a href="/">← Về trang chủ</a></p>
        </div>
      </main>
    </div>
  );
}
