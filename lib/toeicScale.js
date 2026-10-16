// Điểm quy đổi ƯỚC TÍNH của TOEIC Listening & Reading — CHỈ để hiển thị, KHÔNG lưu DB
// (nên đổi bảng sau này không cần migrate). Chỉ áp dụng cho Mock Test (plan Phase 8, C5);
// bài tập trong Lesson không bao giờ quy đổi.
//
// Vị trí file: plan ghi `lib/curriculum/toeicScale.js`, nhưng `lib/curriculum.js` đã tồn
// tại là FILE nên không tạo được thư mục cùng tên -> đặt ở `lib/toeicScale.js`.
//
// ===== NGUỒN BẢNG QUY ĐỔI (quyết định D7) — ĐỌC KỸ =====
// ETS KHÔNG công bố bảng quy đổi chính thức; điểm thật được "equating" theo từng đề.
// Bảng dưới đây KHÔNG sao chép từ một nguồn đã kiểm chứng: người viết không có mạng để
// đối chiếu trang nào. Đây là xấp xỉ đơn điệu (piecewise-linear) đi qua các mốc đầu/cuối
// hay được trích dẫn (0 câu đúng -> 5, 100 câu đúng -> 495) và có hình dạng giống các
// bảng không chính thức lưu hành rộng rãi trên mạng (Reading thấp hơn Listening ở giữa
// thang). Các mốc ở giữa là ƯỚC LƯỢNG, chưa kiểm chứng.
// -> Chủ dự án nên thay `ANCHORS` bằng một bảng công khai đã chọn (ghi URL vào đây)
//    TRƯỚC KHI merge / cho học sinh dùng. Chỉ cần sửa mảng ANCHORS, không đổi API.
// Mọi con số hiển thị luôn kèm chữ "estimated" và ký hiệu "≈".

// [số câu đúng trên thang 100, điểm]. Phải tăng nghiêm ngặt theo cả hai trục (đơn điệu).
const ANCHORS = {
  listening: [
    [0, 5], [10, 30], [20, 75], [30, 125], [40, 175], [50, 235],
    [60, 290], [70, 340], [80, 395], [90, 450], [95, 480], [100, 495],
  ],
  reading: [
    [0, 5], [10, 15], [20, 45], [30, 85], [40, 130], [50, 185],
    [60, 245], [70, 305], [80, 365], [90, 430], [95, 465], [100, 495],
  ],
};

// URL của bảng quy đổi công khai mà chủ dự án đã chọn cho ANCHORS (D7). ĐỂ TRỐNG = TẮT điểm
// quy đổi: mọi chỗ hiển thị chỉ còn "x/y correct". ANCHORS hiện tại là xấp xỉ tự đặt, chưa
// kiểm chứng, nên KHÔNG được cho học sinh/giáo viên xem cho tới khi thay bằng bảng thật.
const SCALE_SOURCE = "";

const { PROGRAMS, isProgram } = require("./curriculum");

const MIN_SCORE = 5;
const MAX_SCORE = 495;
const MAX_TOTAL = 990;

function scoreFromScaled(anchors, x) {
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (x <= x1) {
      const [x0, y0] = anchors[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return anchors[anchors.length - 1][1];
}

// Điểm ước tính 5–495 của 1 kỹ năng ("listening" | "reading"), hoặc null nếu không
// quy đổi được (kỹ năng lạ, total <= 0, số không hợp lệ).
// total != 100 thì quy theo tỉ lệ round(correct * 100 / total) trước khi tra bảng.
function estimateFromTable(skill, correct, total) {
  const anchors = Object.prototype.hasOwnProperty.call(ANCHORS, skill) ? ANCHORS[skill] : null;
  const c = Number(correct);
  const t = Number(total);
  if (!anchors || !Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return null;
  const clamped = Math.min(Math.max(c, 0), t);
  const x = t === 100 ? clamped : Math.round((clamped * 100) / t);
  const raw = scoreFromScaled(anchors, x);
  const rounded = Math.round(raw / 5) * 5;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, rounded));
}

// Điểm ước tính để HIỂN THỊ: null khi chưa có bảng nguồn (SCALE_SOURCE rỗng).
function estimateToeic(skill, correct, total) {
  return SCALE_SOURCE ? estimateFromTable(skill, correct, total) : null;
}

// Tổng L + R (10–990) nếu cả hai đều có điểm, không thì null.
function estimateToeicTotal(listeningScore, readingScore) {
  if (listeningScore == null || readingScore == null) return null;
  return Number(listeningScore) + Number(readingScore);
}

// Chương trình có dùng thang TOEIC không (đọc registry `scoring`, không so chuỗi "toeic").
function usesToeicScale(program) {
  return isProgram(program) && PROGRAMS[program].scoring === "toeic-scaled";
}

// "≈ 385 / 495 (estimated)" — "" nếu không quy đổi được.
function formatToeicEstimate(skill, correct, total) {
  const s = estimateToeic(skill, correct, total);
  return s == null ? "" : `≈ ${s} / ${MAX_SCORE} (estimated)`;
}

// "38/50 correct · ≈ 385 / 495 (estimated)" — dùng cho Mock Test TOEIC L/R.
function toeicResultLine(skill, correct, total) {
  const base = `${correct}/${total} correct`;
  const est = formatToeicEstimate(skill, correct, total);
  return est ? `${base} · ${est}` : base;
}

// "≈ 785 / 990 (estimated)" khi có đủ L và R của cùng một đề, không thì "".
function formatToeicTotal(listeningScore, readingScore) {
  const t = estimateToeicTotal(listeningScore, readingScore);
  return t == null ? "" : `≈ ${t} / ${MAX_TOTAL} (estimated)`;
}

// Gộp 2 bài nộp L/R ({ score, total }) của cùng một đề thành tổng ước tính.
function formatToeicTotalFromSubs(listeningSub, readingSub) {
  if (!listeningSub || !readingSub) return "";
  return formatToeicTotal(
    estimateToeic("listening", listeningSub.score, listeningSub.total),
    estimateToeic("reading", readingSub.score, readingSub.total)
  );
}

module.exports = {
  ANCHORS,
  SCALE_SOURCE,
  estimateFromTable,
  MIN_SCORE,
  MAX_SCORE,
  MAX_TOTAL,
  estimateToeic,
  estimateToeicTotal,
  usesToeicScale,
  formatToeicEstimate,
  toeicResultLine,
  formatToeicTotal,
  formatToeicTotalFromSubs,
};
