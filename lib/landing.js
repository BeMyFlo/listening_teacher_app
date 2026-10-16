// Trang giới thiệu ở domain gốc (PLAN-LANDING-PAGE.md, Phase 11).
const { parseHost, workspaceOrigin, baseDomain } = require("./host");

// Chỉ domain gốc / www / host lạ (vd bản preview *.vercel.app) hiện trang giới thiệu.
// Subdomain của trung tâm (và host sai định dạng) giữ hành vi cũ: chuyển thẳng vào đăng nhập/ứng dụng.
function shouldShowLanding(host, base = baseDomain()) {
  return parseHost(host, base).kind === "root";
}

// Liên hệ công khai. Đổi bằng env mà không cần sửa code.
const CONTACT = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "haminhthong0811@gmail.com",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "0934149864",
};

// 0934149864 -> +84934149864 (cho tel:) ; zalo.me nhận số dạng 0xxxxxxxxx
function telHref(phone) {
  const d = String(phone).replace(/\D/g, "");
  return "tel:" + (d.startsWith("0") ? "+84" + d.slice(1) : "+" + d);
}
function zaloHref(phone) {
  return "https://zalo.me/" + String(phone).replace(/\D/g, "");
}

// Tài khoản demo công khai (mật khẩu công khai có chủ đích — xem workspace demo).
const DEMO = { teacher: "demo", student: "demo.an", password: "123456" };
function demoLoginUrl() {
  const origin = workspaceOrigin("demo");
  return origin ? origin + "/login" : null;
}

const TAGLINE = "Quản lý lớp IELTS gọn hơn, chấm bài nhanh hơn.";

// Tiêu đề hero (h1): phần đầu cố định + một dòng tự đổi lần lượt qua các việc chính
// (components/landing/HeroRotator.js). Chỉ ghi việc sản phẩm làm được thật.
// Thẻ <title>/og vẫn dùng TAGLINE.
const HERO_PREFIX = "Một nơi để";
const HERO_ROTATE = [
  "quản lý lớp IELTS.",
  "giao bài tập về nhà.",
  "tạo đề thi thử 4 kỹ năng.",
  "chấm Writing ngay trên bài.",
  "điểm danh, nhắc học viên.",
];
const HERO_LEAD =
  "Tạo bài học và đề thi thử, giao bài về nhà theo từng lớp, chấm Writing và Speaking có AI hỗ trợ, điểm danh và theo dõi tiến độ từng học viên. AI soạn nháp, giáo viên quyết định.";

// Lời nhận xét của giáo viên/trung tâm. ĐỂ TRỐNG cho đến khi có lời nhận xét THẬT và được người đó
// đồng ý cho đăng: không bịa, không lấy từ bản thiết kế mẫu. Mảng rỗng thì mục này không hiện.
// Dạng: { quote: "…", name: "Tên người nói", role: "Giáo viên IELTS" }
const TESTIMONIALS = [];

// Ảnh chụp màn hình thật (chụp từ workspace demo, dữ liệu giả, đặt ở public/landing/). width/height là kích thước thật của file.
const SHOTS = {
  overview: {
    src: "/landing/app-overview.png", width: 2880, height: 1800,
    alt: "Trang tổng quan của giáo viên trong BeMyFlo: các lớp, số bài đang chờ chấm, học viên cần chú ý và tiến độ từng lớp (dữ liệu demo, giao diện tiếng Anh).",
  },
  attendance: {
    src: "/landing/attendance.png", width: 2200, height: 800,
    alt: "Danh sách các buổi học: ngày học, số học viên có mặt, số bài về nhà đã làm và số lượng theo từng trạng thái điểm danh P, A, L, E (dữ liệu demo).",
  },
};

// Spotlight 1: bộ chuyển kỹ năng (tab). Mỗi tab một ảnh chụp thật (workspace demo, 2x, public/landing/) và 2-3 ý.
// Chỉ mô tả đúng những gì ảnh và sản phẩm có. Tab Writing giữ nguyên ý của mục "Chấm Writing" cũ.
// tone: fix (đỏ) | crit (teal) | band (navy), chỉ là màu nhấn của vạch bên trái.
const SKILLS_HEAD = {
  title: "Một bài học, đủ các kỹ năng.",
  sub: "Listening, Reading, Writing, Speaking và từ vựng nằm cùng một chỗ. Chọn một kỹ năng để xem học viên và giáo viên thấy gì (ảnh chụp thật từ workspace demo).",
};
const SKILLS_DEFAULT = "writing";
const SKILL_TABS = [
  {
    key: "listening", label: "Listening",
    title: "Listening chấm tự động ngay khi nộp",
    callouts: [
      { tone: "band", title: "Đủ dạng bài IELTS", text: "Điền form, ghi chú, bảng; trắc nghiệm; nối; điền nhãn sơ đồ hoặc bản đồ." },
      { tone: "fix", title: "Ô đúng xanh, ô sai đỏ", text: "Học viên thấy ngay câu nào đúng, câu nào sai, và ô sai hiện kèm đáp án đúng." },
      { tone: "crit", title: "Nghe audio ngay trên web", text: "Học viên nghe và làm bài trên trình duyệt, không cần cài thêm gì." },
    ],
    shot: {
      src: "/landing/skill-listening.png", width: 2098, height: 500,
      alt: "Bài Listening điền ghi chú sau khi nộp: ô trả lời đúng viền xanh, ô sai viền đỏ và đáp án đúng hiện bên cạnh (dữ liệu demo).",
    },
  },
  {
    key: "reading", label: "Reading",
    title: "Đọc bài bên trái, làm câu hỏi bên phải",
    callouts: [
      { tone: "band", title: "Nhiều dạng câu hỏi", text: "True/False/Not Given, nối thông tin, hoàn thành ghi chú và các dạng khác." },
      { tone: "crit", title: "Giải thích vì sao đúng", text: "Mỗi câu có phần giải thích đáp án để học viên xem lại sau khi chấm." },
      { tone: "fix", title: "Tô sáng và ghi chú", text: "Học viên tô sáng và ghi chú ngay trên đoạn văn, như khi đọc trên giấy." },
    ],
    shot: {
      src: "/landing/skill-reading.png", width: 2144, height: 1280,
      alt: "Bài Reading: đoạn văn bên trái, các câu True/False/Not Given bên phải kèm dấu tick và khung giải thích dưới mỗi câu (dữ liệu demo).",
    },
  },
  {
    key: "writing", label: "Writing",
    title: "Chấm Writing ngay trên bài",
    lead: "AI soạn nháp điểm và chỉnh sửa trực tiếp trên bài viết. Giáo viên luôn là người xem lại, sửa và quyết định.",
    callouts: [
      { tone: "fix", title: "Sửa trực tiếp trên câu", text: "Chữ sai gạch đỏ, bản sửa hiện ngay cạnh bằng màu xanh. Chỗ viết tốt được gạch chân để khen." },
      { tone: "crit", title: "Nhận xét gắn theo tiêu chí", text: "Mỗi nhận xét mang nhãn TR, CC, LR hoặc GRA, kèm lý do ngắn để học viên hiểu vì sao phải sửa." },
      { tone: "band", title: "Band cho từng tiêu chí", text: "Band tổng và band từng tiêu chí, mỗi dòng có ghi chú. Giáo viên chỉnh lại số nào cũng được." },
    ],
    shot: {
      src: "/landing/writing-graded.png", width: 2188, height: 2092,
      alt: "Bài Writing Task 2 đã chấm: câu sai gạch đỏ kèm bản sửa màu xanh, nhận xét gắn nhãn GRA, TR, LR và bảng Band 6.5 theo từng tiêu chí TR, CC, LR, GRA (dữ liệu demo).",
    },
  },
  {
    key: "speaking", label: "Speaking",
    title: "Ghi âm ngay trên web",
    callouts: [
      { tone: "band", title: "Đề Part 1 đến Part 3 do giáo viên soạn", text: "Giáo viên tự soạn câu hỏi cho từng phần của bài Speaking." },
      { tone: "crit", title: "Bấm ghi âm và nộp, không cần app", text: "Học viên ghi âm và nộp bài ngay trên trình duyệt." },
      { tone: "fix", title: "AI soạn nháp, giáo viên quyết định", text: "AI nghe bản ghi âm và soạn nhận xét nháp. Giáo viên nghe lại, chỉnh sửa và quyết định." },
    ],
    shot: {
      src: "/landing/skill-speaking.png", width: 2144, height: 528,
      alt: "Đề Speaking Part 1 \"Your daily routine\" với danh sách câu hỏi và nút Start Recording để ghi âm (dữ liệu demo).",
    },
  },
  {
    key: "vocabulary", label: "Vocabulary",
    title: "Flashcard từ vựng cho từng chủ đề",
    callouts: [
      { tone: "band", title: "Thẻ từ đầy đủ", text: "IPA, nghĩa tiếng Việt, định nghĩa, ví dụ, collocation và từ đồng nghĩa trên cùng một thẻ. Kèm bài tập luyện từ." },
      { tone: "crit", title: "AI hỗ trợ soạn bài", text: "AI có thể soạn nhóm từ và bài tập. Giáo viên sửa lại trước khi giao cho học viên." },
    ],
    shot: {
      src: "/landing/skill-vocab.png", width: 2148, height: 810,
      alt: "Flashcard từ vựng chủ đề Daily routines: từ routine, phiên âm IPA, loại từ, nghĩa tiếng Việt, định nghĩa, ví dụ, collocation và từ đồng nghĩa (dữ liệu demo).",
    },
  },
];

// Spotlight 2: điểm danh. Ý giữ nguyên với mục "Điểm danh và theo dõi học viên" cũ.
const ATTENDANCE_SPOTLIGHT = {
  title: "Điểm danh, và biết ngay ai cần được nhắc.",
  text: "Điểm danh theo buổi, tự nhận biết bài về nhà đã làm hay chưa. Trang tổng quan liệt kê những học viên cần chú ý: trễ hạn, điểm Writing/Speaking giảm, lâu không vào học.",
};

// Các tính năng còn lại, hiện dạng danh sách gọn (Writing/Speaking và điểm danh đã có spotlight riêng).
const FEATURES = [
  {
    icon: "book-open",
    title: "Bài học và ngân hàng câu hỏi IELTS",
    text: "Điền từ, trắc nghiệm, True/False/Not Given, nối thông tin, hoàn thành ghi chú. Mỗi câu có giải thích đáp án cho học viên xem sau khi chấm.",
  },
  {
    icon: "clipboard",
    title: "Đề thi thử đủ 4 kỹ năng",
    text: "Listening, Reading, Writing và Speaking trong một đề, có lịch mở đề và kết quả tổng hợp. Listening và Reading được chấm tự động.",
  },
  {
    icon: "student",
    title: "Giao bài theo lớp, mỗi lớp một nhịp",
    text: "Giao bài cho từng lớp kèm hạn nộp. Cùng một bài học, lớp A mở đủ kỹ năng, lớp B mới chỉ mở Listening và Reading.",
  },
  {
    icon: "upload",
    title: "Nhập câu hỏi từ Excel",
    text: "Đang giữ ngân hàng câu hỏi trong file Excel? Tải lên theo mẫu là có bài học và đề, không phải gõ lại từng câu.",
  },
];

const STEPS = [
  { title: "Để lại thông tin", text: "Điền form bên dưới. Chúng tôi liên hệ lại và tạo workspace riêng cho bạn, với địa chỉ dạng ten-cua-ban.bemyflo.com." },
  { title: "Tạo bài và giao cho lớp", text: "Tạo bài học, đề thi thử hoặc nhập từ Excel, tạo lớp và học viên rồi giao bài kèm hạn nộp." },
  { title: "Chấm và theo dõi", text: "Học viên làm bài online. Bạn chấm (có AI hỗ trợ), điểm danh và xem ngay ai cần được nhắc." },
];

const FAQ = [
  {
    q: "BeMyFlo có miễn phí không?",
    a: "Hiện đang miễn phí trong giai đoạn thử nghiệm, để chúng tôi có thêm giáo viên và trung tâm dùng thử và góp ý. Chính sách sau giai đoạn này chưa được chốt.",
  },
  {
    q: "Học viên có tự đăng ký tài khoản không?",
    a: "Không. Giáo viên tạo tài khoản học viên và xếp vào lớp. Học viên chỉ thấy những bài được giao cho lớp của mình.",
  },
  {
    q: "AI có thay giáo viên chấm bài không?",
    a: "Không. AI chỉ soạn nháp chấm Writing và Speaking. Điểm và nhận xét cuối cùng do giáo viên xem lại, chỉnh sửa và quyết định.",
  },
  {
    q: "Dữ liệu của các trung tâm có bị lẫn nhau không?",
    a: "Không. Mỗi trung tâm có một workspace riêng, quyền truy cập được kiểm soát ở phía máy chủ nên giáo viên của trung tâm này không xem được dữ liệu của trung tâm khác.",
  },
  {
    q: "Tôi đã có ngân hàng câu hỏi trong Excel, dùng được không?",
    a: "Được. Bạn tải file .xlsx theo mẫu lên và hệ thống chuyển thành bài học hoặc đề thi, gồm cả bài Reading, Listening, Grammar và Vocabulary.",
  },
  {
    q: "Có đặt được tên, logo, màu và địa chỉ riêng cho trung tâm không?",
    a: "Có. Mỗi trung tâm có địa chỉ riêng dạng ten-trung-tam.bemyflo.com, và có thể đặt tên, logo và màu sắc của riêng mình.",
  },
];

module.exports = {
  shouldShowLanding, CONTACT, telHref, zaloHref, DEMO, demoLoginUrl, TAGLINE, HERO_PREFIX, HERO_ROTATE, HERO_LEAD, TESTIMONIALS, SHOTS,
  SKILLS_HEAD, SKILLS_DEFAULT, SKILL_TABS, ATTENDANCE_SPOTLIGHT, FEATURES, STEPS, FAQ,
};
