"use client";

import { useEffect, useState } from "react";
import { useBranding } from "@/lib/client/branding";
import { parseHost, workspaceOrigin } from "@/lib/host";

const KEY = "addressBannerDismissed";

// Người đang ở domain gốc (bemyflo.com) mà trung tâm đã có địa chỉ riêng -> gợi ý chuyển
// sang đó. Không tự chuyển hướng (token đăng nhập nằm theo từng địa chỉ).
export default function AddressBanner() {
  const brand = useBranding();
  const [dismissed, setDismissed] = useState(true);
  const [onRoot, setOnRoot] = useState(false);

  useEffect(() => {
    setOnRoot(parseHost(window.location.host).kind === "root");
    try {
      setDismissed(localStorage.getItem(KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const origin = brand.isWorkspace ? workspaceOrigin(brand.slug) : null;
  if (!onRoot || dismissed || !origin) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* không lưu được thì chỉ ẩn trong lần này */
    }
  }

  return (
    <div className="notice info" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <span>
        <svg className="icon"><use href="#icon-info" /></svg>{" "}
        {brand.name} now has its own address: <a href={origin}><b>{origin.replace("https://", "")}</b></a>.
        You will need to sign in again there.
      </span>
      <button type="button" className="btn secondary sm" onClick={dismiss}>Dismiss</button>
    </div>
  );
}
