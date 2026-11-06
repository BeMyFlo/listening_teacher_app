"use client";

import { POLICY_PATH } from "@/lib/privacy";

// Ô xác nhận khi giáo viên tạo tài khoản học viên. Trung tâm là bên kiểm soát dữ liệu học viên
// (Luật BVDLCN 91/2025 Đ.9; Đ.24 với trẻ em) nên phải có đồng ý trước khi tạo. Không tick sẵn.
export default function ConsentCheck({ checked, onChange, id = "student-consent" }) {
  return (
    <label htmlFor={id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: ".9rem", lineHeight: 1.45 }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
      />
      <span>
        I confirm the student has agreed to their data being processed as described in the{" "}
        <a href={POLICY_PATH} target="_blank" rel="noopener">privacy policy</a> (and a parent/guardian has agreed if the student is under 16).
      </span>
    </label>
  );
}
