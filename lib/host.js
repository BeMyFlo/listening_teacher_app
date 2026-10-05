// Nhận ra "trung tâm nào" từ tên miền truy cập (PLAN-MULTI-TENANT.md Phase 10).
//
// NGUYÊN TẮC: tên miền chỉ dùng để ĐỊNH TUYẾN và HIỆN THƯƠNG HIỆU, không bao giờ
// để cấp quyền. Quyền truy cập luôn lấy từ token (lib/tenant.js); tên miền chỉ
// được phép THU HẸP thêm.
//
// Cấu hình: APP_BASE_DOMAIN (server) / NEXT_PUBLIC_APP_BASE_DOMAIN (client),
// vd "bemyflo.com". Không đặt = tính năng tắt, mọi host coi là chế độ gốc.
// Dev trên máy: APP_BASE_DOMAIN=localhost -> msnhi.localhost:3000.

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function baseDomain() {
  const raw = process.env.NEXT_PUBLIC_APP_BASE_DOMAIN || process.env.APP_BASE_DOMAIN || "";
  return String(raw).trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

// -> { kind: "root" } | { kind: "tenant", slug } | { kind: "invalid" }
//   root    : domain gốc, www, host lạ (vd *.vercel.app của bản preview) hoặc tính năng tắt
//             -> hành vi như trước Phase 10.
//   tenant  : đúng MỘT nhãn trước ".<base>" -> tên workspace.
//   invalid : nhiều nhãn (a.b.<base>) hoặc nhãn sai định dạng -> coi như không có trung tâm.
function parseHost(host, base = baseDomain()) {
  if (!base) return { kind: "root" };
  const h = normalizeHost(host);
  if (!h || h === base || h === `www.${base}`) return { kind: "root" };
  if (!h.endsWith(`.${base}`)) return { kind: "root" };
  const label = h.slice(0, -(base.length + 1));
  if (label === "www") return { kind: "root" };
  if (label.includes(".") || !LABEL_RE.test(label)) return { kind: "invalid" };
  return { kind: "tenant", slug: label };
}

// Từ request của Next (server). Chỉ tin header Host (Vercel đặt), không tin x-forwarded-*.
function hostFromReq(req) {
  return parseHost(req && req.headers && req.headers.host);
}

// Địa chỉ gốc của 1 workspace, vd https://msnhi.bemyflo.com. null nếu chưa cấu hình
// hoặc đang dev trên localhost (khi đó người gọi dùng APP_URL như trước).
function workspaceOrigin(slug) {
  const base = baseDomain();
  if (!base || base === "localhost" || !slug) return null;
  return `https://${slug}.${base}`;
}

module.exports = { baseDomain, normalizeHost, parseHost, hostFromReq, workspaceOrigin };
