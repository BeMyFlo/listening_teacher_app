import "@/styles/landing.css";
import Icon from "@/components/Icon";
import SessionCta from "./SessionCta";
import LeadForm from "./LeadForm";
import { PLATFORM_NAME, PLATFORM_LOGO } from "@/lib/platform";
import { siteOrigin } from "@/lib/seo";
import {
  CONTACT, DEMO, TAGLINE, SCREENSHOTS, FEATURES, STEPS, FAQ, telHref, zaloHref, demoLoginUrl,
} from "@/lib/landing";

const SKILLS = ["Listening", "Reading", "Writing", "Speaking"];
const FLOW = [
  { icon: "upload", label: "Giao bài cho lớp" },
  { icon: "student", label: "Học viên làm online" },
  { icon: "sparkles", label: "AI soạn nháp, giáo viên duyệt" },
  { icon: "chart-bar", label: "Theo dõi tiến độ" },
];

// JSON-LD: chỉ những điều có thật. Không đánh giá, không giá.
function jsonLd() {
  const origin = siteOrigin();
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: PLATFORM_NAME,
      ...(origin ? { url: origin + "/", logo: origin + PLATFORM_LOGO } : {}),
      email: CONTACT.email,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: PLATFORM_NAME,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      inLanguage: "vi",
      description:
        "Nền tảng quản lý lớp học cho giáo viên và trung tâm IELTS: giao bài, thi thử, chấm Writing và Speaking có AI hỗ trợ, điểm danh.",
    },
  ];
  // "<" -> < để dữ liệu không thể đóng thẻ <script>.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function Landing() {
  const demoUrl = demoLoginUrl();
  return (
    <div className="lp" lang="vi">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <a className="lp-skip" href="#noi-dung">Bỏ qua điều hướng</a>

      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <a className="lp-brand" href="/" aria-label={PLATFORM_NAME}>
            <img src={PLATFORM_LOGO} alt="" width={36} height={36} />
            <span>{PLATFORM_NAME}</span>
          </a>
          <nav className="lp-nav" aria-label="Điều hướng chính">
            <a href="#tinh-nang">Tính năng</a>
            <a href="#cach-hoat-dong">Cách hoạt động</a>
            <a href="#hoi-dap">Hỏi đáp</a>
          </nav>
          <div className="lp-header-cta">
            <SessionCta className="lp-btn lp-btn-ghost" />
            <a className="lp-btn lp-btn-primary lp-hide-sm" href="#dang-ky">Dùng thử miễn phí</a>
          </div>
        </div>
      </header>

      <main id="noi-dung">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <p className="lp-badge">Đang miễn phí trong giai đoạn thử nghiệm</p>
              <h1>{TAGLINE}</h1>
              <p className="lp-lead">
                {PLATFORM_NAME} giúp giáo viên và trung tâm IELTS giao bài, chấm Writing và Speaking có AI hỗ trợ,
                điểm danh và theo dõi từng học viên. Học viên làm bài luyện tập và thi thử online.
              </p>
              <div className="lp-actions">
                <a className="lp-btn lp-btn-primary lp-btn-lg" href="#dang-ky">Đăng ký dùng thử</a>
                {demoUrl && <a className="lp-btn lp-btn-outline lp-btn-lg" href="#demo">Xem demo</a>}
              </div>
              <p className="lp-fineprint">Không cần thẻ thanh toán. Chúng tôi tạo workspace riêng cho bạn.</p>
            </div>
            <div className="lp-hero-visual" aria-hidden="true">
              <div className="lp-skills">
                {SKILLS.map((s) => <span key={s} className="lp-chip">{s}</span>)}
              </div>
              <ol className="lp-flow">
                {FLOW.map((f, i) => (
                  <li key={f.label}>
                    <span className="lp-flow-ico"><Icon name={f.icon} /></span>
                    <span>{f.label}</span>
                    {i < FLOW.length - 1 && <i className="lp-flow-line" />}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="tinh-nang" className="lp-section">
          <div className="lp-wrap">
            <h2>Mọi thứ một giáo viên IELTS cần, trong một nơi</h2>
            <p className="lp-sub">Từ soạn bài đến chấm bài và theo dõi lớp, không phải chuyển qua lại giữa nhiều công cụ.</p>
            <ul className="lp-grid">
              {FEATURES.map((f) => (
                <li key={f.title} className="lp-card">
                  <span className="lp-card-ico"><Icon name={f.icon} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {SCREENSHOTS.length > 0 && (
          <section className="lp-section lp-alt" aria-label="Giao diện thực tế">
            <div className="lp-wrap">
              <h2>Xem giao diện thực tế</h2>
              <div className="lp-shots">
                {SCREENSHOTS.map((s) => (
                  <figure key={s.src}>
                    <img src={s.src} alt={s.alt} width={s.width} height={s.height} loading="lazy" decoding="async" />
                    <figcaption>{s.caption}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="cach-hoat-dong" className="lp-section lp-alt">
          <div className="lp-wrap">
            <h2>Bắt đầu như thế nào</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {demoUrl && (
          <section id="demo" className="lp-section">
            <div className="lp-wrap lp-demo">
              <div>
                <h2>Dùng thử ngay, không cần đăng ký</h2>
                <p className="lp-sub">
                  Vào workspace demo bằng tài khoản dưới đây để xem BeMyFlo từ góc nhìn giáo viên hoặc học viên.
                </p>
                <a className="lp-btn lp-btn-primary" href={demoUrl} rel="noopener">Mở workspace demo</a>
              </div>
              <div className="lp-creds">
                <dl>
                  <div><dt>Giáo viên</dt><dd><code>{DEMO.teacher}</code> / <code>{DEMO.password}</code></dd></div>
                  <div><dt>Học viên</dt><dd><code>{DEMO.student}</code> / <code>{DEMO.password}</code></dd></div>
                </dl>
                <p className="lp-fineprint">
                  Tài khoản dùng chung, dữ liệu có thể bị đặt lại bất cứ lúc nào. Vui lòng không nhập thông tin cá nhân
                  thật. Trong bản demo, chấm bằng AI và gửi email được tắt.
                </p>
              </div>
            </div>
          </section>
        )}

        <section id="hoi-dap" className="lp-section lp-alt">
          <div className="lp-wrap lp-narrow">
            <h2>Hỏi đáp</h2>
            {FAQ.map((f) => (
              <details key={f.q} className="lp-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="dang-ky" className="lp-section">
          <div className="lp-wrap lp-signup">
            <div>
              <h2>Đăng ký dùng thử miễn phí</h2>
              <p className="lp-sub">
                {PLATFORM_NAME} hiện miễn phí trong giai đoạn thử nghiệm, để chúng tôi có thêm giáo viên và trung tâm
                dùng thử và góp ý. Để lại thông tin, chúng tôi sẽ tạo workspace riêng cho bạn và liên hệ lại.
              </p>
              <ul className="lp-contact">
                <li><strong>Email:</strong> <a href={"mailto:" + CONTACT.email}>{CONTACT.email}</a></li>
                <li><strong>Điện thoại:</strong> <a href={telHref(CONTACT.phone)}>{CONTACT.phone}</a> · <a href={zaloHref(CONTACT.phone)} rel="noopener" target="_blank">Zalo</a></li>
              </ul>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in">
          <span>© {new Date().getFullYear()} {PLATFORM_NAME}</span>
          <nav aria-label="Chân trang">
            <a href="#tinh-nang">Tính năng</a>
            <a href="#dang-ky">Liên hệ</a>
            <a href="/login">Đăng nhập</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
