// Chống vòng lặp chuyển phiên: ở domain gốc chỉ THỬ chuyển sang subdomain tối đa 1 lần / 30 giây
// trên mỗi trình duyệt. Nếu bước giữa thất bại, người dùng quay lại domain gốc và ở yên đó thay vì
// bị đẩy qua lại. Dùng sessionStorage (của domain gốc); lỗi lưu trữ -> coi như không được thử.
const KEY = "handoffTriedAt";
const WINDOW_MS = 30 * 1000;

export function shouldAttemptHandoff() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
