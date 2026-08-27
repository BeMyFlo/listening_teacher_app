// Giải mã payload JWT phía client (KHÔNG xác thực chữ ký — chỉ để lấy
// name/role/exp hiển thị. Server vẫn verify thật ở mỗi request).
export function decodeJwt(token) {
  try {
    const base64Url = String(token || "").split(".")[1];
    if (!base64Url) return {};
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function isExpired(payload) {
  return !!(payload && payload.exp && payload.exp * 1000 < Date.now());
}
