// Đọc file "Bài học" của Grammar (Grammar_LyThuyet) và Vocab (Tu_vung).
// Trả về Map<extId, {...}> để nối với file bài tập qua Grammar_ID/Unit_ID.

function norm(h) {
  return String(h || "").trim().toLowerCase();
}

// Tìm cột theo danh sách tên có thể có (đã normalize). -1 nếu không thấy.
function findCol(header, names) {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

// Grammar_LyThuyet: Grammar_ID, Ten_chu_diem, Cong_thuc, Khi_nao_dung,
// Loi_thuong_gap, Vi_du, Link_video
function parseGrammarLesson(rows) {
  const map = new Map();
  if (!rows || rows.length < 2) return map;
  const h = rows[0].map(norm);
  const c = {
    id: findCol(h, ["grammar_id", "id"]),
    name: findCol(h, ["ten_chu_diem", "chu_diem", "name"]),
    formula: findCol(h, ["cong_thuc", "formula"]),
    when: findCol(h, ["khi_nao_dung"]),
    mistakes: findCol(h, ["loi_thuong_gap"]),
    examples: findCol(h, ["vi_du", "vi_du_mau"]),
    video: findCol(h, ["link_video", "video"]),
  };
  if (c.id === -1) return map;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const g = (i) => (i !== -1 ? String(row[i] || "").trim() : "");
    const id = g(c.id);
    if (!id) continue;
    map.set(id, {
      name: g(c.name) || id,
      lesson: {
        formula: g(c.formula),
        whenToUse: g(c.when),
        commonMistakes: g(c.mistakes),
        examples: g(c.examples),
        videoUrl: sanitizeYouTube(g(c.video)),
      },
    });
  }
  return map;
}

// Tu_vung: Unit_ID, Tu_vung, Loai_tu, Phien_am, Nghia, Dinh_nghia_TA,
// Vi_du, Collocation, Dong_nghia, Chu_de
function parseVocabList(rows) {
  const map = new Map();
  if (!rows || rows.length < 2) return map;
  const h = rows[0].map(norm);
  const c = {
    id: findCol(h, ["unit_id", "id"]),
    word: findCol(h, ["tu_vung", "word"]),
    pos: findCol(h, ["loai_tu"]),
    ipa: findCol(h, ["phien_am", "ipa"]),
    meaning: findCol(h, ["nghia"]),
    defEn: findCol(h, ["dinh_nghia_ta", "definition"]),
    example: findCol(h, ["vi_du"]),
    colloc: findCol(h, ["collocation"]),
    syn: findCol(h, ["dong_nghia", "synonyms"]),
    topic: findCol(h, ["chu_de", "topic"]),
  };
  if (c.id === -1 || c.word === -1) return map;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const g = (i) => (i !== -1 ? String(row[i] || "").trim() : "");
    const id = g(c.id);
    const word = g(c.word);
    if (!id || !word) continue;
    if (!map.has(id)) map.set(id, { name: g(c.topic) || id, words: [] });
    map.get(id).words.push({
      word,
      partOfSpeech: g(c.pos),
      ipa: g(c.ipa),
      meaning: g(c.meaning),
      definitionEn: g(c.defEn),
      example: g(c.example),
      collocation: g(c.colloc),
      synonyms: g(c.syn),
    });
  }
  return map;
}

// Chỉ chấp nhận URL YouTube; trả "" nếu không phải.
function sanitizeYouTube(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(u)) return u;
  return "";
}

// Trích id video YouTube từ nhiều dạng URL. "" nếu không nhận ra.
function youTubeId(url) {
  const u = String(url || "").trim();
  let m = u.match(/[?&]v=([\w-]{11})/);
  if (m) return m[1];
  m = u.match(/youtu\.be\/([\w-]{11})/);
  if (m) return m[1];
  m = u.match(/youtube\.com\/(?:embed|shorts)\/([\w-]{11})/);
  if (m) return m[1];
  return "";
}

module.exports = { parseGrammarLesson, parseVocabList, sanitizeYouTube, youTubeId };
