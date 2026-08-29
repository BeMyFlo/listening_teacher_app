// Diff cấp TỪ giữa bài gốc và bản giáo viên sửa tay -> mảng annotation
// (insert / delete / replace) neo vào offset trong bài gốc.
//
// Dùng cho chế độ "Edit text": giáo viên gõ sửa như Google Docs, hệ thống tự
// tính chỗ thêm (xanh) / chỗ bỏ (đỏ gạch).

const { rid, MUTATING } = require("./annotate");

// Tách thành token GIỮ offset: xen kẽ [khoảng trắng][từ][khoảng trắng]...
// Mỗi token = { text, start, end }. Nối lại đúng chuỗi gốc.
function tokenize(s) {
  const toks = [];
  const re = /\s+|\S+/g;
  let m;
  while ((m = re.exec(s))) {
    toks.push({ text: m[0], start: m.index, end: m.index + m[0].length, ws: /^\s+$/.test(m[0]) });
  }
  return toks;
}

// LCS trên mảng chuỗi -> danh sách thao tác {type:"eq"|"del"|"add", a?, b?}
function lcsOps(a, b) {
  const n = a.length;
  const k = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(k + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < k) {
    if (a[i] === b[j]) {
      ops.push({ type: "eq", ai: i, bj: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", ai: i });
      i++;
    } else {
      ops.push({ type: "add", bj: j });
      j++;
    }
  }
  while (i < n) ops.push({ type: "del", ai: i++ });
  while (j < k) ops.push({ type: "add", bj: j++ });
  return ops;
}

// diffToAnnotations diff trên bản TEXT GỐC (essayText, trước khi áp bất kỳ
// annotation nào) — nên khi giáo viên chỉ sửa 1 chữ trong bản đã áp hết sửa
// của AI, nó tính lại diff cho TOÀN BỘ đoạn văn, không chỉ chỗ vừa gõ. Nếu
// không làm gì thêm, mọi annotation cũ (category/criterion/comment/severity
// AI đã gắn) sẽ mất sạch, thay bằng annotation "other" không phân loại —
// priorAnnotations dùng để khớp lại theo VỊ TRÍ (cùng hệ toạ độ essayText
// gốc) và thừa hưởng category/criterion/comment/severity của annotation cũ
// che đúng đoạn đó, thay vì luôn rơi về "other".
function bestPriorMatch(start, end, priorMuts) {
  let best = null;
  let bestOverlap = -1;
  for (const p of priorMuts) {
    const overlap = Math.min(end, p.end) - Math.max(start, p.start);
    // Với insert (start===end), coi là khớp khi cùng điểm neo.
    const hit = start === end ? p.start <= start && start <= p.end : overlap > 0;
    if (!hit) continue;
    const score = start === end ? 1 : overlap;
    if (score > bestOverlap) {
      bestOverlap = score;
      best = p;
    }
  }
  return best;
}

// So khớp trên token KHÔNG phải khoảng trắng, rồi gộp các run del/add liền nhau.
function diffToAnnotations(essayText, editedText, priorAnnotations = []) {
  const priorMuts = (priorAnnotations || []).filter((a) => MUTATING.has(a.action));
  const A = tokenize(essayText);
  const B = tokenize(editedText);
  const Aw = A.filter((t) => !t.ws);
  const Bw = B.filter((t) => !t.ws);
  const ops = lcsOps(Aw.map((t) => t.text), Bw.map((t) => t.text));

  const anns = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].type === "eq") {
      k++;
      continue;
    }
    // gom 1 run del*/add*
    const dels = [];
    const adds = [];
    while (k < ops.length && ops[k].type !== "eq") {
      if (ops[k].type === "del") dels.push(Aw[ops[k].ai]);
      else adds.push(Bw[ops[k].bj]);
      k++;
    }
    const addText = adds.map((t) => t.text).join(" ");
    if (dels.length && adds.length) {
      let start = dels[0].start;
      const end = dels[dels.length - 1].end;
      if (start > 0 && /\s/.test(essayText[start - 1])) start -= 1; // nuốt 1 khoảng trắng phía trước
      anns.push(mk("replace", start, end, essayText.slice(start, end), (start < dels[0].start ? " " : "") + addText, bestPriorMatch(start, end, priorMuts)));
    } else if (dels.length) {
      let start = dels[0].start;
      const end = dels[dels.length - 1].end;
      if (start > 0 && /\s/.test(essayText[start - 1])) start -= 1;
      anns.push(mk("delete", start, end, essayText.slice(start, end), "", bestPriorMatch(start, end, priorMuts)));
    } else {
      // chèn: neo vào cuối token "eq" gần nhất phía trước (hoặc đầu bài)
      let at = 0;
      for (let p = k - adds.length - 1; p >= 0; p--) {
        if (ops[p] && ops[p].type === "eq") {
          at = Aw[ops[p].ai].end;
          break;
        }
      }
      anns.push(mk("insert", at, at, "", " " + addText, bestPriorMatch(at, at, priorMuts)));
    }
  }
  return anns;
}

function mk(action, start, end, quote, insertText, prior) {
  return {
    id: rid(),
    action,
    start,
    end,
    quote,
    insertText,
    category: prior ? prior.category : "other",
    criterion: prior ? prior.criterion : null,
    comment: prior ? prior.comment : "",
    severity: prior ? prior.severity : null,
    source: "teacher",
  };
}

// ---------------------------------------------------------------------
// reconcileEdits — cách "Edit text" NÊN hoạt động: chỉ xử lý đúng phần giáo
// viên vừa gõ, không đụng tới annotation khác. diffToAnnotations() ở trên
// diff lại TOÀN BỘ bài so với bản gốc mỗi lần Apply — dù bestPriorMatch cố
// khớp lại category theo overlap, ranh giới của các run vẫn có thể xê dịch
// (LCS không ổn định khi 1 bên đã đổi gần hết nội dung), khiến annotation
// "nhảy" màu sang chỗ không liên quan. reconcileEdits tránh việc đó bằng
// cách: chỉ tìm phần THỰC SỰ thay đổi (prefix/suffix chung), rồi vá đúng
// annotation bị đụng — annotation không liên quan giữ nguyên y hệt object cũ.

// Bản văn đã áp hết annotation (giống applyAnnotations) NHƯNG kèm bản đồ vị
// trí: mỗi đoạn biết mình ứng với đâu trong essayText gốc (đoạn "keep") hay
// thuộc annotation nào (đoạn "ins" — nội dung insertText của 1 mutation).
function buildBaselineMap(essayText, mutAnns) {
  const muts = mutAnns.slice().sort((a, b) => a.start - b.start || a.end - b.end);
  const segs = [];
  let cur = 0;
  let b = 0;
  let text = "";
  const pushKeep = (os, oe) => {
    if (oe <= os) return;
    segs.push({ bStart: b, bEnd: b + (oe - os), kind: "keep", os, oe });
    text += essayText.slice(os, oe);
    b += oe - os;
  };
  for (const m of muts) {
    if (m.start > cur) pushKeep(cur, m.start);
    cur = Math.max(cur, m.start);
    if (m.action === "delete") {
      cur = m.end;
    } else {
      const t = m.insertText || "";
      segs.push({ bStart: b, bEnd: b + t.length, kind: "ins", annId: m.id });
      text += t;
      b += t.length;
      if (m.action === "replace") cur = m.end;
    }
  }
  pushKeep(cur, essayText.length);
  return { baselineText: text, segs };
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}
function commonSuffixLen(a, b, maxA, maxB) {
  let i = 0;
  while (i < maxA && i < maxB && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

// -> mảng annotation MỚI (neo vào essayText gốc), giữ nguyên annotation nào
// không bị đụng tới; chỉ tạo/sửa đúng (các) annotation trùng vùng vừa gõ.
function reconcileEdits(essayText, anns, newText) {
  const mutAnns = anns.filter((a) => MUTATING.has(a.action));
  const commentAnns = anns.filter((a) => a.action === "comment");
  const { baselineText, segs } = buildBaselineMap(essayText, mutAnns);

  if (baselineText === newText) return anns; // không đổi gì thật sự

  const P = commonPrefixLen(baselineText, newText);
  const S = commonSuffixLen(baselineText, newText, baselineText.length - P, newText.length - P);
  const oldStart = P;
  const oldEnd = baselineText.length - S;
  const newChunk = newText.slice(P, newText.length - S);

  // Đoạn nào (trong baseline) bị vùng thay đổi chạm vào.
  const touched = segs.filter((s) => (oldStart === oldEnd ? s.bStart <= oldStart && oldStart <= s.bEnd : s.bStart < oldEnd && s.bEnd > oldStart));
  // Chèn thuần tại đúng ranh giới 2 đoạn (oldStart===oldEnd) -> ưu tiên đoạn
  // "ins" kết thúc tại đó (gõ tiếp vào cuối 1 correction) trước đoạn sau.
  let target = touched[0];
  if (oldStart === oldEnd && touched.length > 1) {
    target = touched.find((s) => s.bEnd === oldStart && s.kind === "ins") || touched[0];
  }

  const singleSegHandles = touched.length <= 1 || (oldStart === oldEnd && !!target);

  if (singleSegHandles && target) {
    const relStart = oldStart - target.bStart;
    const relEnd = oldEnd - target.bStart;

    if (target.kind === "ins") {
      const m = mutAnns.find((a) => a.id === target.annId);
      const oldInsert = m.insertText || "";
      const nextInsert = oldInsert.slice(0, relStart) + newChunk + oldInsert.slice(relEnd);
      const nextMuts = mutAnns
        .map((a) => {
          if (a.id !== m.id) return a;
          if (!nextInsert && a.action === "insert") return null; // gõ xoá sạch phần chèn -> bỏ annotation
          if (!nextInsert && a.action === "replace") return { ...a, action: "delete", insertText: "" };
          return { ...a, insertText: nextInsert };
        })
        .filter(Boolean);
      return [...commentAnns, ...nextMuts];
    }

    // target.kind === "keep" -> vùng chưa từng được AI/giáo viên đánh dấu,
    // tạo 1 annotation MỚI (chưa phân loại) đúng đoạn vừa gõ, không đụng gì khác.
    const os = target.os + relStart;
    const oe = target.os + relEnd;
    const created = newChunk
      ? mk(os === oe ? "insert" : "replace", os, oe, essayText.slice(os, oe), newChunk, null)
      : mk("delete", os, oe, essayText.slice(os, oe), "", null);
    return [...commentAnns, ...mutAnns, created];
  }

  // Vùng sửa chạm nhiều annotation/đoạn cùng lúc — hiếm gặp (gõ đè qua ranh
  // giới nhiều correction liền nhau). Fallback: diff lại toàn bài nhưng vẫn
  // cố khớp category theo overlap thay vì mất trắng.
  return [...commentAnns, ...diffToAnnotations(essayText, newText, anns)];
}

module.exports = { diffToAnnotations, reconcileEdits, tokenize };
