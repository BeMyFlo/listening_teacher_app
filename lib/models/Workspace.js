const mongoose = require("mongoose");

// Một Workspace = một "trung tâm" độc lập: kho bài học, lớp, học sinh, bài nộp
// của riêng nó. Đây là RANH GIỚI CÔ LẬP của toàn hệ thống — xem
// PLAN-MULTI-TENANT.md mục 0.3.
//
// Vì sao là Workspace chứ không phải gắn thẳng `ownerTeacherId` lên từng model:
// sau này một trung tâm sẽ có nhiều giáo viên. Gắn quyền sở hữu vào teacherId
// thì tới lúc đó phải migrate lại toàn bộ dữ liệu. `workspaceId` là một lớp
// gián tiếp rẻ tiền — thêm ngay từ đầu, sau chỉ cần thêm member vào workspace.
//
// V1: mỗi workspace đúng 1 owner. Quan hệ thành viên nằm ở WorkspaceMember.
const STATUSES = ["active", "suspended"];

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    // Dùng cho URL và folder Cloudinary (`workspaces/<slug>/audio`). Chỉ
    // a-z, 0-9 và dấu gạch ngang — xem `slugify` ở cuối file.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // "" = dùng logo mặc định của platform.
    logoUrl: { type: String, default: "" },
    locale: { type: String, default: "vi" },
    timezone: { type: String, default: "Asia/Ho_Chi_Minh" },

    // Phase 8 (taxonomy) dùng tới. Mặc định đúng bằng hiện trạng nên dữ liệu
    // cũ không phải migrate khi tới phase đó.
    subjects: { type: [String], default: ["english"] },
    programs: { type: [String], default: ["ielts"] },

    status: { type: String, enum: STATUSES, default: "active", index: true },

    // Chỗ chứa cấu hình riêng của workspace về sau (rubric, tuỳ chọn AI...).
    // Cố ý để Mixed: chưa biết hình dạng, và ép schema sớm sẽ phải migrate.
    // LƯU Ý: ngân sách AI KHÔNG nằm ở đây — nó dùng chung toàn platform
    // (AiSpend, quyết định 0.3.4 trong PLAN-MULTI-TENANT.md).
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Biến tên tự do thành slug dùng được cho URL/folder. Bỏ dấu tiếng Việt vì
// slug đi vào đường dẫn Cloudinary.
function slugify(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "workspace";
}

WorkspaceSchema.statics.STATUSES = STATUSES;
WorkspaceSchema.statics.slugify = slugify;

module.exports = mongoose.models.Workspace || mongoose.model("Workspace", WorkspaceSchema);
