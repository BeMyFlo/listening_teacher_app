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

// Ảnh chụp màn hình thật (chụp từ workspace demo, đặt ở public/landing/). Để trống thì mục "Xem thật" ẩn.
// { src: "/landing/dashboard.webp", width: 1600, height: 900, alt: "…", caption: "…" }
const SCREENSHOTS = [];

const FEATURES = [
  {
    icon: "book-open",
    title: "Bài học và ngân hàng câu hỏi IELTS",
    text: "Đủ dạng câu hỏi IELTS: điền từ, trắc nghiệm, True/False/Not Given, nối thông tin, hoàn thành ghi chú. Mỗi câu có giải thích đáp án cho học viên xem sau khi chấm.",
  },
  {
    icon: "clipboard",
    title: "Đề thi thử đủ 4 kỹ năng",
    text: "Một đề gồm Listening, Reading, Writing và Speaking, có lịch mở đề và kết quả tổng hợp. Listening và Reading được chấm tự động.",
  },
  {
    icon: "sparkles",
    title: "Chấm Writing và Speaking có AI hỗ trợ",
    text: "AI soạn nháp điểm và chỉnh sửa trực tiếp trên bài viết, nghe bản ghi âm Speaking và nhận xét. Giáo viên luôn là người xem lại, sửa và quyết định.",
  },
  {
    icon: "student",
    title: "Giao bài theo lớp, mỗi lớp một nhịp",
    text: "Giao bài cho từng lớp kèm hạn nộp. Cùng một bài học, lớp A mở đủ kỹ năng, lớp B mới chỉ mở Listening và Reading.",
  },
  {
    icon: "chart-bar",
    title: "Điểm danh và theo dõi học viên",
    text: "Điểm danh theo buổi, tự nhận biết bài về nhà đã làm hay chưa, và danh sách học viên cần chú ý: trễ hạn, điểm Writing/Speaking giảm, lâu không vào học.",
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
  shouldShowLanding, CONTACT, telHref, zaloHref, DEMO, demoLoginUrl, TAGLINE, SCREENSHOTS, FEATURES, STEPS, FAQ,
};
