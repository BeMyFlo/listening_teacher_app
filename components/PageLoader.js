"use client";

import { PLATFORM_NAME, PLATFORM_LOGO } from "@/lib/platform";

// Màn hình chờ toàn trang: logo app + vòng xoay. Dùng khi chưa biết phiên đăng
// nhập / màu workspace, để không hiện giao diện sai màu hay trang trắng.
export default function PageLoader({ text = "Connecting to your class…" }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <img src={PLATFORM_LOGO} alt={PLATFORM_NAME} style={{ width: 84, height: 84, objectFit: "contain" }} />
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "3px solid #E1E8F0",
          borderTopColor: "#4DBFA9",
          animation: "spin .8s linear infinite",
        }}
      />
      <div style={{ color: "#66758C", fontSize: ".95rem", fontWeight: 600 }}>{text}</div>
    </div>
  );
}
