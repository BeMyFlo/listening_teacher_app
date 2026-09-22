// Giới hạn số lần thử trong một khoảng thời gian, giữ trong bộ nhớ tiến trình.
//
// Giới hạn cần biết: serverless chạy nhiều instance, mỗi instance đếm riêng,
// và container nguội đi là mất sạch bộ đếm. Nên đây KHÔNG phải hàng rào tuyệt
// đối — nó chặn kiểu dò mật khẩu bằng script trong một phiên, chứ không chặn
// được kẻ tấn công phân tán. Muốn chắc thì phải đếm ở tầng dùng chung
// (MongoDB / Redis / WAF của Vercel).
//
// Bộ đếm gắn vào `global` để sống sót qua hot-reload của Next dev.

const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_ATTEMPTS = 10;

let store = global._rateLimitStore;
if (!store) {
  store = global._rateLimitStore = new Map();
}

// Dọn rác định kỳ để Map không phình mãi (mỗi lần gọi dọn tối đa 50 key cũ).
function sweep(now) {
  let n = 0;
  for (const [k, v] of store) {
    if (v.resetAt <= now) {
      store.delete(k);
      if (++n >= 50) break;
    }
  }
}

// IP người gọi. Sau proxy của Vercel thì x-forwarded-for là thứ đáng tin nhất
// có được; lấy IP đầu tiên trong chuỗi.
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// Ghi nhận 1 lần thử. Trả { limited, remaining, retryAfterSec }.
function hit(key, { max = MAX_ATTEMPTS, windowMs = WINDOW_MS } = {}) {
  const now = Date.now();
  sweep(now);

  const cur = store.get(key);
  if (!cur || cur.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: max - 1, retryAfterSec: 0 };
  }

  cur.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
  if (cur.count > max) {
    return { limited: true, remaining: 0, retryAfterSec };
  }
  return { limited: false, remaining: max - cur.count, retryAfterSec };
}

// Xoá bộ đếm — gọi sau khi đăng nhập thành công để người gõ nhầm vài lần rồi
// vào được không bị dính hạn mức.
function reset(key) {
  store.delete(key);
}

module.exports = { hit, reset, clientIp, MAX_ATTEMPTS, WINDOW_MS };
