// Ảnh riêng của từng câu (field.imageId, Phase 8 bước 5.4) cho các trang review của
// giáo viên: gom id ảnh trong một Unit / Test, tra URL (đúng workspace), rồi gắn
// `imageUrl` vào từng dòng chi tiết. Học sinh không đi qua đây — API học sinh
// (pages/api/tests.js, pages/api/units.js) populate trực tiếp.
const { tenantFilter } = require("./tenant");

const S = (v) => (v == null ? "" : String(v));
const idOf = (v) => S(v && typeof v === "object" && v._id ? v._id : v);

// sectionsLists: mảng các mảng sections. Trả mảng id (string, không trùng).
function collectFieldImageIds(sectionsLists) {
  const ids = new Set();
  for (const secs of sectionsLists || []) {
    for (const s of secs || []) {
      for (const f of (s && s.fields) || []) {
        if (f && f.imageId) ids.add(idOf(f.imageId));
      }
    }
  }
  return [...ids].filter(Boolean);
}

// Mọi danh sách sections của một Unit (exercises, topics.exercises, groups.exercises).
function unitSectionLists(unit) {
  const out = [];
  for (const cat of (unit && unit.categories) || []) {
    (cat.exercises || []).forEach((ex) => out.push(ex.sections));
    (cat.topics || []).forEach((t) => (t.exercises || []).forEach((ex) => out.push(ex.sections)));
    (cat.groups || []).forEach((g) => (g.exercises || []).forEach((ex) => out.push(ex.sections)));
  }
  return out;
}

function testSectionLists(test) {
  const skills = (test && test.skills) || {};
  return [skills.listening, skills.reading].map((s) => (s && s.sections) || []);
}

// { [imageId]: cloudinaryUrl } — chỉ ảnh thuộc workspace `ws`.
async function loadImageUrls(ws, ids) {
  if (!ids || !ids.length) return {};
  const Image = require("./models/Image");
  const rows = await Image.find(tenantFilter(ws, { _id: { $in: ids } })).select("cloudinaryUrl").lean();
  const out = {};
  rows.forEach((r) => {
    if (r.cloudinaryUrl) out[S(r._id)] = r.cloudinaryUrl;
  });
  return out;
}

// { [fieldId]: url } cho một khối (exercise hoặc skill) có `sections`.
function imageUrlsByFieldId(block, urlById) {
  const out = {};
  if (!urlById) return out;
  ((block && block.sections) || []).forEach((s) =>
    (s.fields || []).forEach((f) => {
      const url = f && f.imageId ? urlById[idOf(f.imageId)] : "";
      if (url) out[f.id] = url;
    })
  );
  return out;
}

module.exports = { collectFieldImageIds, unitSectionLists, testSectionLists, loadImageUrls, imageUrlsByFieldId };
