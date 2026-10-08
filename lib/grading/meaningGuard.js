// Chốt chặn xác định (không phụ thuộc LLM) cho Writing Task 1: một correction
// kiểu "replace" KHÔNG được làm đổi nghĩa số liệu. Nếu đổi -> hạ xuống "comment"
// (giữ nguyên vùng bôi + giải thích, chỉ bỏ chữ thay thế) — cấu trúc annotation
// không đổi, frontend render như bình thường.
//
// Bắt 3 loại lỗi: (1) mất/đổi con số, (2) mất/đổi từ chỉ mức độ ("almost never"
// -> "never", "over" -> "under"), (3) đảo chiều xu hướng (increase <-> decrease).

const NUM_RE = /\d+(?:[.,]\d+)?/g;

// Mỗi nhóm = một "nghĩa". Từ cùng nhóm thay được cho nhau
// (approximate -> approximately, roughly -> around ...).
const QUALIFIER_GROUPS = [
  ["approx", /\b(approximately|approximate|roughly|around|about|circa|some)\b/],
  ["almost", /\b(almost|nearly)\b/],
  ["over", /\b(over|more than|above|exceeding|exceeded)\b/],
  ["under", /\b(under|less than|below|fewer than)\b/],
  ["slightly", /\b(slightly|marginally|a little)\b/],
  ["sharply", /\b(sharply|dramatically|significantly|substantially|considerably|rapidly)\b/],
  ["only", /\b(only|just|merely)\b/],
  ["never", /\bnever\b/],
  ["always", /\balways\b/],
  ["hardly", /\b(hardly|rarely|seldom)\b/],
  ["most", /\b(most|majority)\b/],
  ["minority", /\b(minority|few)\b/],
  ["all", /\b(all|always|entirely|completely)\b/],
  ["exactly", /\b(exactly|precisely|identical|the same)\b/],
];

const DIRECTION_GROUPS = [
  ["up", /\b(increase[ds]?|increasing|rise[ns]?|rose|rising|grow[ns]?|grew|growing|climb(?:s|ed|ing)?|surge[ds]?|higher|highest|peak(?:s|ed)?)\b/],
  ["down", /\b(decrease[ds]?|decreasing|decline[ds]?|declining|fall[s]?|fell|fallen|falling|drop(?:s|ped|ping)?|lower|lowest|dip(?:s|ped)?|reduce[ds]?)\b/],
  ["flat", /\b(stable|stabili[sz]e[ds]?|unchanged|remain(?:s|ed)? (?:constant|steady|stable))\b/],
];

function numbers(s) {
  return (String(s || "").match(NUM_RE) || []).map((n) => n.replace(",", "."));
}

function groups(s, table) {
  const t = String(s || "").toLowerCase();
  // "almost never" là một nghĩa riêng: nuốt luôn "never" để không tính là "never" trơn.
  const masked = t.replace(/\b(almost|nearly) never\b/g, " almostnever ");
  const hit = new Set();
  if (/\balmostnever\b/.test(masked)) hit.add("almostnever");
  for (const [name, re] of table) if (re.test(masked)) hit.add(name);
  return hit;
}

// Thứ tự xuất hiện của số + tên riêng (Japan, Canada...) — dùng để bắt đảo chiều
// so sánh ("Japan higher than Canada" -> "Canada higher than Japan").
const COMPARATOR_RE = /\b(higher|lower|more|less|greater|fewer|than|followed|exceed\w*|outnumber\w*|ahead|behind)\b/i;
function entityOrder(s) {
  return (String(s || "").match(/\d+(?:[.,]\d+)?|[A-Z][a-z]+/g) || []).map((x) => x.replace(",", ".").toLowerCase());
}
function reversed(a, b) {
  if (!COMPARATOR_RE.test(a) || !COMPARATOR_RE.test(b)) return false;
  const x = entityOrder(a);
  const y = entityOrder(b);
  if (x.length < 2 || x.length !== y.length) return false;
  return x.join("|") !== y.join("|") && [...x].sort().join("|") === [...y].sort().join("|");
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// true nếu việc thay `original` bằng `replacement` giữ nguyên số liệu + mức độ + chiều hướng.
function preservesMeaning(original, replacement) {
  const a = numbers(original).sort();
  const b = numbers(replacement).sort();
  if (a.join("|") !== b.join("|")) return false;
  // Chỉ so khi cụm gốc ĐÃ mang từ chỉ mức/chiều: sửa lỗi chính tả quanh đó vẫn ổn,
  // nhưng mất/đổi chúng thì không.
  for (const table of [QUALIFIER_GROUPS, DIRECTION_GROUPS]) {
    const ga = groups(original, table);
    const gb = groups(replacement, table);
    if (ga.size && !sameSet(ga, gb)) return false;
    // thêm mới một từ chỉ mức/chiều mà bản gốc không có cũng là đổi nghĩa
    for (const g of gb) if (!ga.has(g) && ga.size === 0 && table === DIRECTION_GROUPS) return false;
  }
  if (groups(original, QUALIFIER_GROUPS).has("almostnever") !== groups(replacement, QUALIFIER_GROUPS).has("almostnever")) return false;
  if (reversed(original, replacement)) return false;
  return true;
}

// annotations: mảng đã có offset (output resolveAnnotationsFromQuotes).
// -> { annotations, demoted }
function guardAnnotations(annotations) {
  let demoted = 0;
  const out = (annotations || []).map((a) => {
    if (a.action !== "replace" || preservesMeaning(a.quote, a.insertText)) return a;
    demoted++;
    return { ...a, action: "comment", insertText: "" };
  });
  return { annotations: out, demoted };
}

// improvedSample không được đưa vào con số mà bài của học sinh / đề không có.
// -> mảng con số lạ (rỗng = ổn).
function inventedNumbers(sample, ...sources) {
  const known = new Set(sources.flatMap((s) => numbers(s)));
  return [...new Set(numbers(sample))].filter((n) => !known.has(n));
}

// "all students", "always", "everyone"... — bản mẫu không được tự thêm khi bài gốc không có.
// ("all four", "in all countries" là cách nói bình thường nên không bắt.)
const ABSOLUTE_RE = /\b(always|entirely|completely|everyone|all (?:of )?(?:the )?(?:students|people|adults|respondents|learners|pupils|undergraduates))\b/i;
const sentences = (t) => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean);

// Chặn improvedSample làm sai nghĩa so với bài gốc. Bảo thủ: chỉ bắt các trường hợp
// rõ ràng. -> mảng lý do (rỗng = ổn). Nếu có lý do, caller bỏ improvedSample thay vì
// hiện một bản viết lại gây hiểu lầm.
function improvedSampleProblems(sample, essay, taskText = "") {
  const out = [];
  if (!String(sample || "").trim()) return out;
  const bad = inventedNumbers(sample, essay, taskText);
  if (bad.length) out.push("new figures: " + bad.join(", "));

  const ge = groups(essay, QUALIFIER_GROUPS);
  const gs = groups(sample, QUALIFIER_GROUPS);
  // từ mạnh hơn bài gốc: "all"/"always"/"entirely" mà học sinh không hề viết
  if (ABSOLUTE_RE.test(sample) && !ABSOLUTE_RE.test(essay) && !/\bevery\b/i.test(essay)) out.push("adds absolute wording (all students/always)");
  if (gs.has("exactly") && !ge.has("exactly") && !groups(taskText, QUALIFIER_GROUPS).has("exactly")) out.push("adds 'exactly/identical'");
  // mất từ giảm nhẹ mà bài gốc có
  for (const g of ["almostnever", "slightly", "almost"]) {
    if (ge.has(g) && !gs.has(g)) out.push(`drops qualifier '${g}'`);
  }
  if (gs.has("never") && !gs.has("almostnever") && ge.has("almostnever") && !ge.has("never")) out.push("'almost never' became 'never'");

  // từng câu của bản mẫu có CÙNG tập số với 1 câu gốc -> nghĩa/chiều không được đổi
  const orig = sentences(essay);
  for (const sent of sentences(sample)) {
    const n = numbers(sent).sort().join("|");
    if (!n) continue;
    const match = orig.find((o) => numbers(o).sort().join("|") === n);
    if (!match) continue;
    if (reversed(match, sent)) out.push("comparison reversed: " + sent.slice(0, 60));
    const da = groups(match, DIRECTION_GROUPS);
    const db = groups(sent, DIRECTION_GROUPS);
    if (da.size && db.size && !sameSet(da, db)) out.push("trend direction changed: " + sent.slice(0, 60));
  }
  return out;
}

module.exports = { preservesMeaning, guardAnnotations, inventedNumbers, improvedSampleProblems };
