# PLAN — Phase 3 bước 4–5: GV tự tạo lớp + cron/thông báo theo workspace

> Tài liệu thi hành cho **bước 4 và 5 của Phase 3** trong [PLAN-MULTI-TENANT.md](PLAN-MULTI-TENANT.md).
> **NGƯỜI THI HÀNH: đây là mô hình rẻ tiền, KHÔNG được tự suy luận thêm.**
> Mọi đoạn code dưới đây đã viết SẴN, NGUYÊN VĂN — công việc của bạn là:
> 1. Đọc đúng đoạn "TRƯỚC" trong file thật để xác nhận khớp
> 2. Thay bằng đúng đoạn "SAU" — copy-paste nguyên văn, không sửa gì thêm
> 3. Chạy `node --check <file>` sau MỖI file
> 4. Không tự thêm comment, không tự "cải thiện" code, không đổi tên biến
>
> Nếu đoạn "TRƯỚC" trong tài liệu KHÔNG khớp với file thật (dù chỉ khác 1 ký
> tự) — DỪNG LẠI, không đoán, không tự sửa cho khớp. Ghi lại chỗ khác biệt và
> báo cáo, đừng tự ý tiếp tục.

Trạng thái: ☐ chưa bắt đầu · Ngày lập: 2026-09-25
Tiền đề: Phase 3 bước 1/2/3/6 đã chạy trên live (commit `a09c909`). Working tree sạch.

---

## 0. Luật chơi

### 0.1 Phạm vi — CHỈ 2 việc

1. **Bước 4**: giáo viên bị `teacherScope` giới hạn (`Teacher.classIds` không rỗng) được
   phép tự tạo lớp mới trong workspace mình — lớp mới đó phải tự động thêm vào
   `classIds` của chính họ.
2. **Bước 5**: 2 chỗ rò rỉ cross-workspace trong luồng thông báo — `recipientsForClass`
   (đang gửi thông báo bài nộp cho MỌI giáo viên toàn hệ thống khi không khớp lớp) và
   `generateDeadlineNotifications` (Unit.find thiếu lọc workspace, hiện chưa rò vì V1 chỉ
   có 1 workspace, nhưng phải vá phòng khi có workspace thứ 2).

**KHÔNG làm gì khác** — không đụng Phase 4/5/6, không đụng file nào ngoài danh sách ở
mục 1 và 2 dưới đây.

### 0.2 Vì sao bước 4 phức tạp hơn nhìn tưởng

Route `admin/classes.js` hiện có dòng chặn:

```js
if (!scope.all) {
  return res.status(403).json({ ok: false, error: "Only an admin can create a new class" });
}
```

`scope.all === true` nghĩa là `Teacher.classIds` đang **rỗng** (giáo viên "toàn quyền",
chưa bị giới hạn lớp cụ thể). Bỏ guard này đi mà KHÔNG làm gì thêm sẽ tái diễn đúng bug đã
phát hiện 2026-09-25 (ghi trong PLAN-MULTI-TENANT.md, Phase 3 bước 4): giáo viên tạo lớp
mới xong **tự làm mù chính mình** — lớp tồn tại trong DB nhưng biến mất khỏi màn hình
Classes của người vừa tạo ra nó, vì `Class` không có field sở hữu và không có gì tự động
đồng bộ `Teacher.classIds`.

**Vì vậy hai việc PHẢI làm CÙNG LÚC, trong CÙNG MỘT ĐOẠN CODE:** bỏ guard, VÀ ngay sau khi
tạo `Class` thành công, nếu giáo viên đang bị scope (`!scope.all`) thì tự động
`$addToSet` `_id` của lớp mới vào `Teacher.classIds` của chính họ.

### 0.3 Kiểm tra trước khi bắt đầu

Chạy đúng 2 lệnh này, phải ra kết quả y hệt bên dưới. Nếu khác — DỪNG LẠI, báo cáo, đừng
tự sửa gì:

```bash
git status --short
```
Phải in ra: (không có gì — dòng trống, working tree sạch)

```bash
git log --oneline -1
```
Phải in ra dòng bắt đầu bằng: `a09c909 Phase 3 step 3: verify cross-references...`

---

## 1. Bước 4 — `pages/api/admin/classes.js`

### 1.1 Mở file, tìm đúng đoạn này (dòng 39–53 hiện tại)

```js
  if (req.method === "POST") {
    // Giáo viên bị giới hạn lớp thì tạo lớp mới cũng vô nghĩa (tạo xong không
    // thấy) — để admin làm việc đó rồi gán lớp.
    if (!scope.all) {
      return res.status(403).json({ ok: false, error: "Only an admin can create a new class" });
    }
    const name = String((req.body && req.body.name) || "").trim();
    const level = Number(req.body && req.body.level);
    if (!name) return res.status(400).json({ ok: false, error: "Missing class name" });
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }
    const cls = await Class.create({ name, level, workspaceId: req.ws.workspaceId });
    return res.status(201).json({ ok: true, class: cls });
  }
```

### 1.2 Thay bằng ĐÚNG đoạn này — copy nguyên văn

```js
  if (req.method === "POST") {
    const name = String((req.body && req.body.name) || "").trim();
    const level = Number(req.body && req.body.level);
    if (!name) return res.status(400).json({ ok: false, error: "Missing class name" });
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }
    const cls = await Class.create({ name, level, workspaceId: req.ws.workspaceId });
    // Giáo viên đang bị teacherScope giới hạn (classIds không rỗng) tự tạo
    // lớp mới -> PHẢI tự động thêm lớp đó vào classIds của chính họ, nếu
    // không lớp vừa tạo sẽ biến mất khỏi màn hình Classes của chính người
    // tạo ra nó (Class không có field sở hữu, không có gì tự đồng bộ).
    // Bug thật đã phát hiện 2026-09-25 — xem PLAN-MULTI-TENANT.md Phase 3
    // bước 4. Giáo viên "toàn quyền" (scope.all=true, classIds rỗng) thì
    // không cần đụng gì — rỗng vẫn có nghĩa là thấy hết.
    if (!scope.all && req.auth && req.auth.teacherId) {
      await Teacher.updateOne(
        { _id: req.auth.teacherId },
        { $addToSet: { classIds: cls._id } }
      );
    }
    return res.status(201).json({ ok: true, class: cls });
  }
```

### 1.3 Thêm import `Teacher` ở đầu file

Tìm đúng dòng này (gần đầu file, trong khối `require`):

```js
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
```

Thay bằng:

```js
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");
```

### 1.4 Kiểm tra ngay

```bash
node --check pages/api/admin/classes.js
```
Phải không in ra gì (không lỗi).

```bash
grep -n "Only an admin can create" pages/api/admin/classes.js
```
Phải KHÔNG in ra dòng nào (chuỗi đó không còn tồn tại trong file — đã xoá guard).

```bash
grep -n "addToSet" pages/api/admin/classes.js
```
Phải in ra đúng 1 dòng chứa `$addToSet: { classIds: cls._id }`.

---

## 2. Bước 5 — thông báo theo workspace

### 2.1 `lib/notifications/teacher.js` — đảo fallback cross-workspace

Đây là lỗ hổng nghiêm trọng nhất: khi một lớp chưa gán giáo viên nào, thông báo "học sinh
X vừa nộp bài Y" hiện đang gửi cho **MỌI giáo viên trên TOÀN HỆ THỐNG**, kể cả giáo viên ở
workspace khác — lộ tên học sinh + nội dung bài nộp sang workspace không liên quan.

**Mở file `lib/notifications/teacher.js`, thay TOÀN BỘ nội dung file bằng đúng nội dung
dưới đây** (file ngắn, thay toàn bộ cho chắc chắn, không tìm-và-thay từng đoạn):

```js
const Teacher = require("../models/Teacher");
const { tenantFilter } = require("../tenant");
const { emit, fmtDateTime } = require("./index");

const SKILL_LABELS = { writing: "Writing", speaking: "Speaking" };

// Giáo viên nhận thông báo cho 1 học sinh: người phụ trách đúng lớp của em,
// TRONG CÙNG WORKSPACE. Không ai khớp lớp -> mọi giáo viên CỦA WORKSPACE ĐÓ
// (KHÔNG PHẢI mọi giáo viên toàn hệ thống — đó là lỗ hổng cross-tenant đã vá
// ở Phase 3 bước 5, xem PLAN-MULTI-TENANT.md). Ở V1 một workspace luôn đúng
// 1 giáo viên nên "mọi giáo viên của workspace" và "owner của workspace" là
// cùng một người; Phase 9 (nhiều giáo viên/workspace) cần xem lại có nên
// giới hạn đúng owner hay giữ nguyên broadcast nội bộ workspace.
async function recipientsForClass(ws, classId) {
  const teachers = await Teacher.find(tenantFilter(ws)).select("_id email classIds").lean();
  if (!teachers.length) return [];
  const cid = String(classId || "");
  const matched = teachers.filter(
    (t) => Array.isArray(t.classIds) && t.classIds.some((c) => String(c) === cid)
  );
  return matched.length ? matched : teachers;
}

// Học sinh vừa nộp 1 bài Writing/Speaking cần chấm tay -> báo giáo viên phụ
// trách. 1 thông báo / submission / giáo viên (dedupeKey). Lỗi ở đây không
// được làm hỏng response nộp bài — caller tự bọc try/catch.
async function notifyTeachersOfSubmission({ ws, student, submission, unitOrTestName, skill, itemLabel }) {
  const teachers = await recipientsForClass(ws, student && student.classId);
  if (!teachers.length) return;

  const skillLabel = SKILL_LABELS[skill] || "a task";
  const where = unitOrTestName ? ` in ${unitOrTestName}` : "";
  const lateTag = submission.isLate ? " (late)" : "";
  // Bài trong Lesson Unit -> trang chấm theo unit; bài trong Mock Test -> Mock Test Results.
  const link = submission.unitId
    ? `/teacher/lessons/${submission.unitId}/submissions`
    : `/teacher/submissions`;

  for (const t of teachers) {
    await emit({
      teacherId: t._id,
      workspaceId: ws.workspaceId,
      type: "submission_received",
      dedupeKey: `${submission._id}:submission_received:${t._id}`,
      submissionId: submission._id,
      unitId: submission.unitId,
      link,
      title: `New ${skillLabel} submission${lateTag}`,
      body:
        `${student.name} submitted ${skillLabel}${itemLabel ? ` "${itemLabel}"` : ""}${where} ` +
        `on ${fmtDateTime(submission.submittedAt || submission.createdAt || new Date())}. Pending your review.`,
    });
  }
}

module.exports = { notifyTeachersOfSubmission };
```

**Kiểm tra ngay:**

```bash
node --check lib/notifications/teacher.js
```
Phải không in ra gì.

### 2.2 `pages/api/submissions.js` — truyền `ws` vào cả 2 lần gọi

File này có đúng **2 chỗ** gọi `notifyTeachersSafe({...})`. Object truyền vào hiện có 5
field (`student`, `submission`, `unitOrTestName`, `skill`, `itemLabel`). Cần thêm field
`ws: req.ws` vào object đó, ở **cả 2 chỗ**.

**Chỗ 1** — tìm đúng đoạn này:

```js
      await notifyTeachersSafe({
        student,
        submission,
        unitOrTestName: submission.testTitle,
        skill: kind,
        itemLabel: prompt.title,
      });
```

Thay bằng:

```js
      await notifyTeachersSafe({
        ws: req.ws,
        student,
        submission,
        unitOrTestName: submission.testTitle,
        skill: kind,
        itemLabel: prompt.title,
      });
```

**Chỗ 2** — tìm đúng đoạn này (khác chỗ 1 ở dòng `unitOrTestName: unit.name`):

```js
    await notifyTeachersSafe({
      student,
      submission,
      unitOrTestName: unit.name,
      skill: kind,
      itemLabel: prompt.title,
    });
```

Thay bằng:

```js
    await notifyTeachersSafe({
      ws: req.ws,
      student,
      submission,
      unitOrTestName: unit.name,
      skill: kind,
      itemLabel: prompt.title,
    });
```

**Kiểm tra ngay:**

```bash
node --check pages/api/submissions.js
grep -c "ws: req.ws" pages/api/submissions.js
```
Lệnh `grep -c` phải in ra đúng số **2**.

### 2.3 `lib/notifications/generate.js` — lọc Unit theo workspace

Tìm đúng đoạn này:

```js
  const units = await Unit.find({
    status: "published",
    level: cls.level,
    "deadlines.classId": student.classId,
  }).lean();
```

Thay bằng:

```js
  const units = await Unit.find(tenantFilter({ workspaceId: student.workspaceId }, {
    status: "published",
    level: cls.level,
    "deadlines.classId": student.classId,
  })).lean();
```

Thêm import ở đầu file. Tìm đúng dòng này (dòng đầu tiên của file):

```js
const Unit = require("../models/Unit");
```

Thay bằng:

```js
const Unit = require("../models/Unit");
const { tenantFilter } = require("../tenant");
```

**Kiểm tra ngay:**

```bash
node --check lib/notifications/generate.js
```
Phải không in ra gì.

---

## 3. Nghiệm thu

### 3.1 Tĩnh — chạy đủ, đúng thứ tự

```bash
node --check pages/api/admin/classes.js
node --check lib/notifications/teacher.js
node --check pages/api/submissions.js
node --check lib/notifications/generate.js
```
Cả 4 lệnh không được in ra bất kỳ dòng nào.

```bash
node scripts/check-tenant-scope.js --strict
```
Phải in dòng `Không có file nào vi phạm.` — nếu có dòng "⚠ ... file KHÔNG có
tenantFilter..." thì DỪNG LẠI, báo cáo, đừng tự sửa.

### 3.2 Nạp module — bắt lỗi cú pháp/import sai ngay

```bash
node -e "require('./lib/notifications/teacher.js'); console.log('teacher.js: nạp OK')"
node -e "require('./lib/notifications/generate.js'); console.log('generate.js: nạp OK')"
node -e "require('./pages/api/admin/classes.js'); console.log('classes.js: nạp OK')"
```
Cả 3 lệnh phải in đúng dòng "... nạp OK". Nếu có lỗi (throw) — DỪNG LẠI, đọc kỹ thông báo
lỗi, đối chiếu lại đúng đoạn "TRƯỚC"/"SAU" đã copy có khớp 100% không.

### 3.3 KHÔNG được tự viết thêm test/kiểm tra bằng dữ liệu thật

Việc gọi API thật lên DB (dev hay live) để kiểm chứng — **KHÔNG PHẢI việc của bạn**.
Người review (sếp) sẽ tự làm việc đó sau khi bạn báo cáo xong bước 3.1–3.2.
**Tuyệt đối không tự ý chạy bất kỳ script nào có chữ `--live` hay `--apply`.**

### 3.4 Báo cáo cuối cùng

Sau khi xong 3.1 và 3.2, in ra:

```bash
git status --short
git diff --stat
```

Và dừng lại — không tự `git add`, không tự `git commit`, không tự `git push`. Việc đó là
của sếp.

---

## 4. Nếu có bất cứ điều gì không khớp

Nếu đoạn "TRƯỚC" ở bất kỳ mục nào không khớp 100% với file thật, hoặc `node --check`
báo lỗi mà bạn không hiểu tại sao, hoặc `check-tenant-scope.js --strict` báo vi phạm:

**DỪNG NGAY LẬP TỨC.** Không tự đoán, không tự "sửa cho có vẻ đúng", không tự bỏ qua
bước nào. Ghi rõ: đang ở mục nào, nội dung thật của file khác gì so với tài liệu, rồi kết
thúc và chờ chỉ đạo tiếp.
