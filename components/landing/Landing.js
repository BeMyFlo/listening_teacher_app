import "@/styles/landing.css";
import Image from "next/image";
import Icon from "@/components/Icon";
import SessionCta from "./SessionCta";
import LeadForm from "./LeadForm";
import HeroRotator from "./HeroRotator";
import Testimonials from "./Testimonials";
import { PLATFORM_NAME, PLATFORM_LOGO } from "@/lib/platform";
import { siteOrigin } from "@/lib/seo";
import {
  CONTACT, DEMO, HERO_PREFIX, HERO_ROTATE, HERO_LEAD, TESTIMONIALS, SHOTS, SKILLS_HEAD, SKILLS_DEFAULT, SKILL_TABS, ATTENDANCE_SPOTLIGHT,
  FEATURES, STEPS, FAQ, telHref, zaloHref, demoLoginUrl,
} from "@/lib/landing";

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
  const { overview, attendance } = SHOTS;
  return (
    <div className="lp" lang="vi">
      {/* Phông chữ tiêu đề (hỗ trợ tiếng Việt tốt). Nếu không tải được thì dùng phông hệ thống. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@600;700;800&display=swap" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
      <a className="lp-skip" href="#noi-dung">Bỏ qua điều hướng</a>

      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <a className="lp-brand" href="/" aria-label={PLATFORM_NAME}>
            <img src={PLATFORM_LOGO} alt="" width={40} height={40} />
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
              <HeroRotator prefix={HERO_PREFIX} items={HERO_ROTATE} />
              <p className="lp-lead">{HERO_LEAD}</p>
              <div className="lp-actions">
                <a className="lp-btn lp-btn-primary lp-btn-lg" href="#dang-ky">
                  Dùng thử miễn phí <Icon name="arrow-left" flip />
                </a>
                {demoUrl ? (
                  <a className="lp-textlink" href="#demo">Hoặc xem bằng tài khoản demo</a>
                ) : (
                  <a className="lp-textlink" href="#cach-hoat-dong">Xem cách hoạt động</a>
                )}
              </div>
              <p className="lp-fineprint">Đang miễn phí trong giai đoạn thử nghiệm.</p>
            </div>
            <div className="lp-hero-visual">
              <div className="lp-frame">
                <div className="lp-frame-bar" aria-hidden="true">
                  <i /><i /><i />
                  <span>ten-trung-tam.bemyflo.com</span>
                </div>
                <Image
                  src={overview.src} width={overview.width} height={overview.height} alt={overview.alt}
                  priority quality={85} sizes="(max-width: 1000px) 100vw, 760px"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="tinh-nang" className="lp-spot lp-tint">
          <div className="lp-wrap">
            <div className="lp-skills-head">
              <h2>{SKILLS_HEAD.title}</h2>
              <p className="lp-sub">{SKILLS_HEAD.sub}</p>
            </div>
            {/* Tab chỉ bằng CSS (không cần JS): nút radio ẩn + nhãn dạng viên thuốc, khung nội dung hiện theo :checked.
                Radio cùng nhóm nên phím mũi tên chuyển tab. Xem styles/landing.css. */}
            <fieldset className="lp-skills">
              <legend className="lp-sr">Chọn kỹ năng</legend>
              {SKILL_TABS.map((t) => (
                <input
                  key={t.key} type="radio" name="lp-skill" id={"lp-skill-" + t.key}
                  className="lp-skill-radio" defaultChecked={t.key === SKILLS_DEFAULT}
                />
              ))}
              <div className="lp-skill-tabs">
                {SKILL_TABS.map((t) => (
                  <label key={t.key} htmlFor={"lp-skill-" + t.key}>{t.label}</label>
                ))}
              </div>
              <div className="lp-skill-panels">
                {SKILL_TABS.map((t) => (
                  <div key={t.key} className={"lp-skill-panel lp-skill-panel--" + t.key}>
                    <figure className={"lp-spot-shot" + (t.key === "writing" ? " lp-shot-crop" : "")}>
                      <Image
                        src={t.shot.src} width={t.shot.width} height={t.shot.height} alt={t.shot.alt}
                        quality={88} sizes="(max-width: 1000px) 100vw, 700px"
                      />
                    </figure>
                    <div className="lp-spot-copy">
                      <h3 className="lp-skill-title">{t.title}</h3>
                      {t.lead && <p className="lp-lead">{t.lead}</p>}
                      <ul className="lp-callouts">
                        {t.callouts.map((c) => (
                          <li key={c.title} className={"lp-callout lp-tone-" + c.tone}>
                            <h4>{c.title}</h4>
                            <p>{c.text}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section className="lp-spot lp-spot2">
          <div className="lp-wrap">
            <div className="lp-spot2-head">
              <h2>{ATTENDANCE_SPOTLIGHT.title}</h2>
              <p>{ATTENDANCE_SPOTLIGHT.text}</p>
            </div>
            <figure className="lp-spot2-shot">
              <Image
                src={attendance.src} width={attendance.width} height={attendance.height} alt={attendance.alt}
                quality={88} sizes="(max-width: 1000px) 100vw, 1000px"
              />
            </figure>

            <div className="lp-more">
              <h3 className="lp-more-title">Và những gì còn lại</h3>
              <ul className="lp-more-list">
                {FEATURES.map((f) => (
                  <li key={f.title}>
                    <Icon name={f.icon} />
                    <div>
                      <h4>{f.title}</h4>
                      <p>{f.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="cach-hoat-dong" className="lp-section lp-tint lp-howto">
          <div className="lp-wrap">
            <h2>Bắt đầu như thế nào</h2>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="lp-step-n" aria-hidden="true">{i + 1}</span>
                  <h3><span className="lp-sr">Bước {i + 1}: </span>{s.title}</h3>
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
                <h2>Xem thử bằng workspace demo</h2>
                <p className="lp-sub">
                  Vào workspace demo bằng tài khoản dưới đây để xem BeMyFlo từ góc nhìn giáo viên hoặc học viên.
                </p>
                <a className="lp-btn lp-btn-primary" href={demoUrl} rel="noopener">
                  Mở workspace demo <Icon name="arrow-left" flip />
                </a>
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

        {/* Chỉ hiện khi có lời nhận xét thật (xem lib/landing.js). */}
        {TESTIMONIALS.length > 0 && <Testimonials items={TESTIMONIALS} />}

        <section id="hoi-dap" className="lp-section lp-faq-sec">
          <div className="lp-wrap lp-faq-in">
            <h2>Câu hỏi thường gặp</h2>
            <div className="lp-faq-list">
              {FAQ.map((f) => (
                <details key={f.q} className="lp-faq">
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="dang-ky" className="lp-section lp-signup-sec">
          <div className="lp-wrap lp-signup">
            <div className="lp-signup-copy">
              <h2>Để lại thông tin, chúng tôi sẽ liên hệ</h2>
              <p className="lp-sub">
                {PLATFORM_NAME} hiện miễn phí trong giai đoạn thử nghiệm, để chúng tôi có thêm giáo viên và trung tâm
                dùng thử và góp ý. Để lại thông tin, chúng tôi sẽ tạo workspace riêng cho bạn và liên hệ lại.
              </p>
              <ul className="lp-contact">
                <li><span>Email</span> <a href={"mailto:" + CONTACT.email}>{CONTACT.email}</a></li>
                <li><span>Điện thoại</span> <a href={telHref(CONTACT.phone)}>{CONTACT.phone}</a> · <a href={zaloHref(CONTACT.phone)} rel="noopener" target="_blank">Zalo</a></li>
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
