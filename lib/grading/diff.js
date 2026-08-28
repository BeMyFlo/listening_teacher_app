// Diff cấp TỪ giữa bài gốc và bản giáo viên sửa tay -> mảng annotation
// (insert / delete / replace) neo vào offset trong bài gốc.
//
// Dùng cho chế độ "Edit text": giáo viên gõ sửa như Google Docs, hệ thống tự
// tính chỗ thêm (xanh) / chỗ bỏ (đỏ gạch).

const { rid } = require("./annotate");

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

// So khớp trên token KHÔNG phải khoảng trắng, rồi gộp các run del/add liền nhau.
function diffToAnnotations(essayText, editedText) {
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
      anns.push(mk("replace", start, end, essayText.slice(start, end), (start < dels[0].start ? " " : "") + addText));
    } else if (dels.length) {
      let start = dels[0].start;
      const end = dels[dels.length - 1].end;
      if (start > 0 && /\s/.test(essayText[start - 1])) start -= 1;
      anns.push(mk("delete", start, end, essayText.slice(start, end), ""));
    } else {
      // chèn: neo vào cuối token "eq" gần nhất phía trước (hoặc đầu bài)
      let at = 0;
      for (let p = k - adds.length - 1; p >= 0; p--) {
        if (ops[p] && ops[p].type === "eq") {
          at = Aw[ops[p].ai].end;
          break;
        }
      }
      anns.push(mk("insert", at, at, "", " " + addText));
    }
  }
  return anns;
}

function mk(action, start, end, quote, insertText) {
  return {
    id: rid(),
    action,
    start,
    end,
    quote,
    insertText,
    category: "other",
    criterion: null,
    comment: "",
    severity: null,
    source: "teacher",
  };
}

module.exports = { diffToAnnotations, tokenize };
