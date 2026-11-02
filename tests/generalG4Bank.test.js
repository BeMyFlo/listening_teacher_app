// Phase 12 G4 bước 1: nhãn chủ điểm/mức độ trên câu, registry questionBank, API ngân hàng câu hỏi.
// Model giả áp dụng ĐÚNG bộ lọc truyền vào -> route quên tenantFilter thì test rớt.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { PROGRAMS } = require("../lib/curriculum");
const { GENERAL_TOPICS, DIFFICULTIES, isDifficulty, topicLabel } = require("../lib/generalTopics");
const { normalizeSections } = require("../lib/testSections");
const { emptyField, fieldToServer, fieldFromServer } = require("../lib/teacher/sectionTransforms");
const { pickItems } = require("../lib/questionBank");
const QuestionItem = require("../lib/models/QuestionItem");
const Image = require("../lib/models/Image");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const AuditLog = require("../lib/models/AuditLog");
const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

// ---------------------------------------------------------------- registry + nhãn

test("registry: chỉ General có questionBank", () => {
  assert.equal(PROGRAMS.general.questionBank, true);
  assert.equal(PROGRAMS.ielts.questionBank, false);
  assert.equal(PROGRAMS.toeic.questionBank, false);
});

test("generalTopics: khoá chủ điểm duy nhất, mức độ nb/th/vd/vdc, topicLabel", () => {
  const keys = GENERAL_TOPICS.flatMap((g) => g.topics.map((t) => t.key));
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(GENERAL_TOPICS.map((g) => g.group), ["grammar", "vocabulary", "skills"]);
  assert.deepEqual(DIFFICULTIES.map((d) => d.key), ["nb", "th", "vd", "vdc"]);
  assert.ok(isDifficulty("vdc"));
  assert.ok(!isDifficulty("hard") && !isDifficulty("") && !isDifficulty("constructor"));
  assert.equal(topicLabel("gr-passive"), "Passive voice");
  assert.equal(topicLabel("  My own topic "), "My own topic");
  assert.equal(topicLabel("constructor"), "constructor");
  assert.equal(topicLabel(null), "");
});

test("payload IELTS không đổi: fieldToServer không gửi topic/difficulty khi rỗng", () => {
  const f = emptyField(1);
  f.label = "Q";
  f.answersText = "x";
  const keys = Object.keys(fieldToServer(f));
  assert.ok(!keys.includes("topic") && !keys.includes("difficulty"));
  assert.deepEqual(keys, ["id", "idEnd", "formatLabel", "label", "hint", "explanation", "score", "type", "pre", "post", "selectCount", "options", "answers"]);
  // normalizeSections cũng không thêm khoá mới cho câu không nhãn.
  const norm = normalizeSections([{ fields: [fieldToServer(f)] }])[0].fields[0];
  assert.ok(!("topic" in norm) && !("difficulty" in norm));
});

test("nhãn General: round trip editor -> server -> normalize -> editor, cắt dài, bỏ mức độ lạ", () => {
  const f = emptyField(1);
  f.label = "Q";
  f.answersText = "x";
  f.topic = "gr-passive";
  f.difficulty = "th";
  const server = fieldToServer(f);
  assert.equal(server.topic, "gr-passive");
  assert.equal(server.difficulty, "th");
  const norm = normalizeSections([{ fields: [server] }])[0].fields[0];
  assert.equal(norm.topic, "gr-passive");
  assert.equal(norm.difficulty, "th");
  const back = fieldFromServer(norm, {});
  assert.equal(back.topic, "gr-passive");
  assert.equal(back.difficulty, "th");

  const odd = normalizeSections([{ fields: [{ ...server, topic: "  " + "t".repeat(200), difficulty: "extreme" }] }])[0].fields[0];
  assert.equal(odd.topic.length, 80);
  assert.ok(!("difficulty" in odd));
});

test("API học sinh không liệt kê topic/difficulty", () => {
  for (const file of ["../pages/api/tests.js", "../pages/api/units.js"]) {
    const src = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.ok(src.includes("fields: (s.fields || []).map((f) => ({"), file + " liệt kê field tường minh");
    assert.ok(!/difficulty|f\.topic\b/.test(src), file + " không đụng topic/difficulty");
  }
});

// ---------------------------------------------------------------- model giả

const idOf = (v) => String(v && typeof v === "object" && v._id !== undefined ? v._id : v);

function valuesAt(doc, p) {
  let cur = [doc];
  for (const part of p.split(".")) {
    cur = cur.flatMap((c) => (c == null ? [] : Array.isArray(c) ? c.map((x) => x && x[part]) : [c[part]]));
  }
  return cur.flatMap((v) => (Array.isArray(v) ? v : [v]));
}

function matches(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === "$or") return cond.some((f) => matches(doc, f));
    const vals = valuesAt(doc, k);
    if (cond instanceof RegExp) return vals.some((v) => typeof v === "string" && cond.test(v));
    if (cond && typeof cond === "object" && !(cond instanceof Date) && ("$in" in cond || "$nin" in cond)) {
      if (cond.$in) return vals.some((v) => cond.$in.map(idOf).includes(idOf(v)));
      return !vals.some((v) => cond.$nin.map(idOf).includes(idOf(v)));
    }
    return vals.some((v) => idOf(v) === idOf(cond));
  });
}

let seq = 0;
function installFakes() {
  const store = [];
  const images = [
    { _id: "img1", workspaceId: "ws1" },
    { _id: "img2", workspaceId: "ws2" },
  ];
  const orig = {};
  for (const m of ["find", "findOne", "findOneAndUpdate", "countDocuments", "aggregate", "create", "deleteOne", "deleteMany"]) orig[m] = QuestionItem[m];
  orig.imageExists = Image.exists;
  orig.wmFindOne = WorkspaceMember.findOne;
  orig.wsFindById = Workspace.findById;
  orig.auditCreate = AuditLog.create;

  const query = (compute) => {
    const st = { skip: 0, limit: Infinity, select: null, sort: false };
    const q = {
      select(s) { st.select = String(s).split(/\s+/); return q; },
      sort() { st.sort = true; return q; },
      skip(n) { st.skip = n; return q; },
      limit(n) { st.limit = n; return q; },
      lean() { return q; },
      then(res, rej) {
        return Promise.resolve()
          .then(() => {
            let rows = compute();
            if (!Array.isArray(rows)) return rows;
            if (st.sort) rows = rows.slice().reverse();
            rows = rows.slice(st.skip, st.skip + st.limit);
            if (st.select) rows = rows.map((r) => Object.fromEntries(st.select.map((k) => [k, r[k]])));
            return rows.map((r) => structuredClone(r));
          })
          .then(res, rej);
      },
    };
    return q;
  };

  QuestionItem.find = (f) => query(() => store.filter((d) => matches(d, f)));
  QuestionItem.findOne = (f) => query(() => store.find((d) => matches(d, f)) || null);
  QuestionItem.countDocuments = async (f) => store.filter((d) => matches(d, f)).length;
  QuestionItem.aggregate = async (pipe) => {
    const rows = store.filter((d) => matches(d, pipe[0].$match));
    const groups = new Map();
    for (const d of rows) {
      const key = JSON.stringify({ format: d.format, difficulty: d.difficulty });
      const g = groups.get(key) || { _id: { format: d.format, difficulty: d.difficulty }, items: 0, questions: 0 };
      g.items += 1;
      g.questions += d.questionCount;
      groups.set(key, g);
    }
    return [...groups.values()];
  };
  QuestionItem.create = async (docs) =>
    docs.map((d) => {
      const doc = { _id: String(++seq).padStart(24, "0"), ...structuredClone(d) };
      store.push(doc);
      return doc;
    });
  QuestionItem.findOneAndUpdate = (f, upd) =>
    query(() => {
      const d = store.find((x) => matches(x, f));
      if (!d) return null;
      Object.assign(d, upd.$set || {});
      for (const k of Object.keys(upd.$unset || {})) delete d[k];
      return d;
    });
  QuestionItem.deleteOne = async (f) => {
    const i = store.findIndex((d) => matches(d, f));
    if (i >= 0) store.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  };
  QuestionItem.deleteMany = async (f) => {
    let n = 0;
    for (let i = store.length - 1; i >= 0; i--) if (matches(store[i], f)) { store.splice(i, 1); n++; }
    return { deletedCount: n };
  };
  Image.exists = async (f) => (images.some((i) => matches(i, f)) ? { _id: f._id } : null);

  const members = { uA: "ws1", uB: "ws2", uDemo: "wsDemo" };
  WorkspaceMember.findOne = (q) => ({ select: () => ({ lean: async () => ({ workspaceId: members[String(q.userId)], role: "teacher" }) }) });
  Workspace.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id, status: "active", settings: { demo: id === "wsDemo" } }) }) });
  AuditLog.create = async () => {};

  process.env.JWT_SECRET = "test-secret-g4-bank";
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};
  clearTenantCache();

  const route = require("../pages/api/admin/question-bank");
  const call = async (userId, method, { query: qs = {}, body } = {}) => {
    const token = signUserToken({ _id: userId, role: "teacher", name: "T" });
    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) { statusCode = c; return this; },
      json(p) { payload = p; return this; },
    };
    await route({ method, query: qs, body, headers: { authorization: "Bearer " + token }, url: "/api/admin/question-bank" }, res);
    return { status: statusCode, body: payload };
  };

  const restore = () => {
    for (const m of Object.keys(orig)) if (!["imageExists", "wmFindOne", "wsFindById", "auditCreate"].includes(m)) QuestionItem[m] = orig[m];
    Image.exists = orig.imageExists;
    WorkspaceMember.findOne = orig.wmFindOne;
    Workspace.findById = orig.wsFindById;
    AuditLog.create = orig.auditCreate;
    clearTenantCache();
  };
  return { store, call, restore };
}

const mcq = (id, label = "She ___ to school every day.") => ({
  id,
  formatLabel: "Multiple choice",
  label,
  type: "choice",
  options: [
    { value: "a", label: "go" },
    { value: "b", label: "goes" },
  ],
  answers: ["b"],
  selectCount: 1,
});
const single = (extra = {}) => ({ level: 10, format: "g-mcq", difficulty: "nb", kind: "single", fields: [mcq(1)], ...extra });
const group = (n, extra = {}) => ({
  level: 10,
  format: "g-mcq",
  difficulty: "nb",
  kind: "group",
  passageText: "A short passage about school life in Vietnam.",
  fields: Array.from({ length: n }, (_, i) => mcq(i + 1, "Question " + (i + 1) + "?")),
  ...extra,
});
const P = "general";

async function withFakes(fn) {
  const fx = installFakes();
  try {
    await fn(fx);
  } finally {
    fx.restore();
  }
}

// ---------------------------------------------------------------- CRUD + validate

test("tạo, đọc, sửa nhãn, xoá: vòng đời cơ bản trong 1 workspace", () =>
  withFakes(async ({ call, store }) => {
    const c = await call("uA", "POST", { body: { program: P, items: [single({ topic: "gr-passive" }), group(3)] } });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    assert.equal(c.body.created, 2);
    assert.equal(store[0].workspaceId, "ws1");
    assert.equal(store[0].questionCount, 1);
    assert.equal(store[1].questionCount, 3);

    const list = await call("uA", "GET", { query: { program: P, level: "10", difficulty: "nb" } });
    assert.equal(list.body.total, 2);
    assert.equal((await call("uA", "GET", { query: { program: P, level: "9" } })).body.total, 0);
    assert.equal((await call("uA", "GET", { query: { program: P, topic: "gr-passive" } })).body.total, 1);

    const upd = await call("uA", "PUT", { body: { id: c.body.ids[0], difficulty: "vd", topic: "gr-conditionals" } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.item.difficulty, "vd");
    assert.equal(upd.body.item.fields.length, 1);

    const del = await call("uA", "DELETE", { query: { id: c.body.ids[0] } });
    assert.equal(del.status, 200);
    assert.equal(store.length, 1);
  }));

test("GET: tìm chữ có ký tự regex không gây lỗi và lọc đúng; limit bị chặn trần", () =>
  withFakes(async ({ call }) => {
    await call("uA", "POST", { body: { program: P, items: [single({ fields: [mcq(1, "Choose (the) best answer?")] }), single()] } });
    const hit = await call("uA", "GET", { query: { program: P, q: "(the)" } });
    assert.equal(hit.status, 200);
    assert.equal(hit.body.total, 1);
    assert.equal((await call("uA", "GET", { query: { program: P, q: "(" } })).status, 200);
    assert.equal((await call("uA", "GET", { query: { program: P, limit: "5000" } })).body.limit, 50);
  }));

test("counts: gộp theo (dạng, mức độ) của đúng workspace", () =>
  withFakes(async ({ call }) => {
    await call("uA", "POST", { body: { program: P, items: [single(), single(), group(3), single({ difficulty: "vd" })] } });
    await call("uB", "POST", { body: { program: P, items: [single(), single()] } });
    const r = await call("uA", "GET", { query: { action: "counts", program: P, level: "10" } });
    const nb = r.body.counts.find((c) => c.format === "g-mcq" && c.difficulty === "nb");
    assert.deepEqual([nb.items, nb.questions], [3, 5]);
    assert.equal(r.body.counts.find((c) => c.difficulty === "vd").items, 1);
  }));

test("câu dở bị từ chối kèm lý do; nhóm cần đoạn văn thật hoặc ảnh; trần 100 mục", () =>
  withFakes(async ({ call, store }) => {
    const noAnswer = single({ fields: [{ ...mcq(1), answers: [] }] });
    const r1 = await call("uA", "POST", { body: { program: P, items: [single(), noAnswer] } });
    assert.equal(r1.status, 400);
    assert.match(r1.body.error, /^Item 2: Question 1 is not finished: no correct answer/);

    const r2 = await call("uA", "POST", { body: { program: P, items: [group(2, { passageText: "  " })] } });
    assert.equal(r2.status, 400);
    const r3 = await call("uA", "POST", { body: { program: P, items: [group(2, { passageText: "Paste the passage here." })] } });
    assert.equal(r3.status, 400);
    assert.match(r3.body.error, /passage/);

    const r4 = await call("uA", "POST", { body: { program: P, items: [single({ difficulty: "extreme" })] } });
    assert.equal(r4.status, 400);
    const r5 = await call("uA", "POST", { body: { program: P, items: Array.from({ length: 101 }, () => single()) } });
    assert.equal(r5.status, 400);
    assert.equal(store.length, 0); // không mục nào được lưu khi có lỗi
  }));

test("imageId phải thuộc workspace: nhóm và từng câu", () =>
  withFakes(async ({ call }) => {
    const other = await call("uA", "POST", { body: { program: P, items: [group(2, { imageId: "img2" })] } });
    assert.equal(other.status, 400);
    assert.match(other.body.error, /image/i);
    const otherField = await call("uA", "POST", { body: { program: P, items: [single({ fields: [{ ...mcq(1), imageId: "img2" }] })] } });
    assert.equal(otherField.status, 400);
    const own = await call("uA", "POST", { body: { program: P, items: [group(2, { imageId: "img1" })] } });
    assert.equal(own.status, 201);
    // sửa sang ảnh của workspace khác cũng bị chặn
    const upd = await call("uA", "PUT", { body: { id: own.body.ids[0], imageId: "img2" } });
    assert.equal(upd.status, 400);
  }));

test("chương trình không có questionBank (IELTS/TOEIC/lạ) -> 400 ở mọi thao tác", () =>
  withFakes(async ({ call }) => {
    for (const program of ["ielts", "toeic", "nope"]) {
      assert.equal((await call("uA", "GET", { query: { program } })).status, 400);
      assert.equal((await call("uA", "GET", { query: { action: "counts", program, level: "10" } })).status, 400);
      assert.equal((await call("uA", "POST", { body: { program, items: [single()] } })).status, 400);
      assert.equal((await call("uA", "POST", { query: { action: "pick" }, body: { program, level: 10, rows: [{ format: "g-mcq", difficulty: "nb", count: 1 }] } })).status, 400);
    }
  }));

test("workspace demo ghi bình thường như các route giáo viên khác", () =>
  withFakes(async ({ call, store }) => {
    const r = await call("uDemo", "POST", { body: { program: P, items: [single()] } });
    assert.equal(r.status, 201);
    assert.equal(store[0].workspaceId, "wsDemo");
  }));

// ---------------------------------------------------------------- tenant

test("workspace B không đọc/sửa/xoá/bốc được câu của workspace A", () =>
  withFakes(async ({ call, store }) => {
    const c = await call("uA", "POST", { body: { program: P, items: [single(), single(), group(3)] } });
    const id = c.body.ids[0];

    assert.equal((await call("uB", "GET", { query: { id } })).status, 404);
    const list = await call("uB", "GET", { query: { program: P, level: "10" } });
    assert.equal(list.body.total, 0);
    assert.deepEqual((await call("uB", "GET", { query: { action: "counts", program: P, level: "10" } })).body.counts, []);

    const upd = await call("uB", "PUT", { body: { id, difficulty: "vdc" } });
    assert.equal(upd.status, 404);
    assert.equal(store[0].difficulty, "nb");

    assert.equal((await call("uB", "DELETE", { query: { id } })).status, 404);
    const bulk = await call("uB", "DELETE", { body: { ids: c.body.ids } });
    assert.equal(bulk.body.deleted, 0);
    assert.equal(store.length, 3);

    const pick = await call("uB", "POST", { query: { action: "pick" }, body: { program: P, level: 10, rows: [{ format: "g-mcq", difficulty: "nb", count: 4 }] } });
    assert.equal(pick.status, 200);
    assert.equal(pick.body.items.length, 0);
    assert.equal(pick.body.shortage, 4);

    // A vẫn bốc được
    const pickA = await call("uA", "POST", { query: { action: "pick" }, body: { program: P, level: 10, rows: [{ format: "g-mcq", difficulty: "nb", count: 5 }] } });
    assert.equal(pickA.body.shortage, 0);
  }));

// ---------------------------------------------------------------- bốc câu

async function seedPick(call) {
  const r = await call("uA", "POST", { body: { program: P, items: [...Array.from({ length: 5 }, () => single()), group(3)] } });
  assert.equal(r.status, 201);
}
const pickBody = (rows, extra = {}) => ({ query: { action: "pick" }, body: { program: P, level: 10, rows, ...extra } });
const countQuestions = (items) => items.reduce((n, i) => n + i.fields.length, 0);

test("pick: đủ câu, không trùng, nhóm không bị tách", () =>
  withFakes(async ({ call }) => {
    await seedPick(call);
    for (let run = 0; run < 20; run++) {
      const r = await call("uA", "POST", pickBody([{ format: "g-mcq", difficulty: "nb", count: 4 }]));
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.shortage, 0);
      assert.equal(r.body.rows[0].picked, 4);
      assert.equal(countQuestions(r.body.items), 4);
      const ids = r.body.items.map((i) => i._id);
      assert.equal(new Set(ids).size, ids.length);
      for (const it of r.body.items) assert.equal(it.fields.length, it.questionCount); // nhóm nguyên vẹn
    }
  }));

test("pick: thiếu câu báo theo từng ô, vẫn bốc phần có; nhóm quá lớn bị bỏ qua", () =>
  withFakes(async ({ call }) => {
    await seedPick(call); // 5 câu lẻ + nhóm 3 = 8 câu nb
    const r = await call("uA", "POST", pickBody([
      { format: "g-mcq", difficulty: "nb", count: 10 },
      { format: "g-mcq", difficulty: "vd", count: 2 },
    ]));
    assert.equal(r.body.rows[0].picked, 8);
    assert.equal(r.body.rows[0].shortage, 2);
    assert.equal(r.body.rows[1].picked, 0);
    assert.equal(r.body.rows[1].shortage, 2);
    assert.equal(r.body.shortage, 4);
    assert.equal(countQuestions(r.body.items), 8);
  }));

test("pick: nhóm 3 câu không vừa chỗ còn lại thì bỏ qua và lấy câu lẻ", () =>
  withFakes(async ({ call }) => {
    await call("uA", "POST", { body: { program: P, items: [group(3), single()] } });
    const r = await call("uA", "POST", pickBody([{ format: "g-mcq", difficulty: "nb", count: 2 }]));
    assert.equal(r.body.rows[0].picked, 1);
    assert.equal(r.body.rows[0].shortage, 1);
    assert.equal(r.body.items.length, 1);
    assert.equal(r.body.items[0].kind, "single");
  }));

test("pick: nhiều hàng cùng ô không bốc trùng; excludeIds được tôn trọng; difficulty rỗng = mọi mức", () =>
  withFakes(async ({ call }) => {
    const c = await call("uA", "POST", { body: { program: P, items: [...Array.from({ length: 4 }, () => single()), single({ difficulty: "vd" })] } });
    const r = await call("uA", "POST", pickBody([
      { format: "g-mcq", difficulty: "nb", count: 3 },
      { format: "g-mcq", difficulty: "nb", count: 3 },
    ]));
    assert.equal(r.body.rows[0].picked, 3);
    assert.equal(r.body.rows[1].picked, 1);
    const all = r.body.rows.flatMap((x) => x.itemIds);
    assert.equal(new Set(all).size, all.length);

    const ex = await call("uA", "POST", pickBody([{ format: "g-mcq", difficulty: "nb", count: 4 }], { excludeIds: c.body.ids.slice(0, 2) }));
    assert.equal(ex.body.items.length, 2);
    for (const it of ex.body.items) assert.ok(!c.body.ids.slice(0, 2).includes(it._id));

    const any = await call("uA", "POST", pickBody([{ format: "g-mcq", difficulty: "", count: 5 }]));
    assert.equal(any.body.shortage, 0);
  }));

test("pick: kiểm hàng ma trận và trần 100 câu", () =>
  withFakes(async ({ call }) => {
    const bad = async (rows) => (await call("uA", "POST", pickBody(rows))).status;
    assert.equal(await bad([]), 400);
    assert.equal(await bad([{ format: "g-mcq", difficulty: "nb", count: 0 }]), 400);
    assert.equal(await bad([{ format: "mcq", difficulty: "nb", count: 1 }]), 400);
    assert.equal(await bad([{ format: "g-mcq", difficulty: "zz", count: 1 }]), 400);
    assert.equal(await bad([{ format: "g-mcq", difficulty: "nb", count: 101 }]), 400);
    assert.equal(await bad([{ format: "g-mcq", difficulty: "nb", count: 60 }, { format: "g-wform", difficulty: "nb", count: 41 }]), 400);
    assert.equal(await bad([{ format: "g-mcq", difficulty: "nb", count: 60 }, { format: "g-wform", difficulty: "nb", count: 40 }]), 200);
    const lv = await call("uA", "POST", { query: { action: "pick" }, body: { program: P, level: 5, rows: [{ format: "g-mcq", difficulty: "nb", count: 1 }] } });
    assert.equal(lv.status, 400);
  }));

test("pickItems (thuần): chỉ chọn mục vừa chỗ, bỏ id đã dùng", () => {
  const cands = [
    { _id: "a", questionCount: 5 },
    { _id: "b", questionCount: 2 },
    { _id: "c", questionCount: 1 },
  ];
  const used = new Set(["c"]);
  const r = pickItems(cands, 3, used, () => 0.5);
  assert.deepEqual(r.chosen, ["b"]);
  assert.equal(r.shortage, 1);
  assert.ok(used.has("b") && !used.has("a"));
});
