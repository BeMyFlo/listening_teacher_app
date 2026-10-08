"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { readSession, storeLoginResult } from "@/lib/client/session";
import { NAV } from "@/lib/nav";
import { parseHost, baseDomain } from "@/lib/host";
import PageLoader from "@/components/PageLoader";

// Chuyển phiên đăng nhập từ domain gốc sang subdomain của trung tâm (PLAN Phase 10B).
// Cùng một trang chạy ở HAI nơi:
//   Subdomain, chưa có #code : sinh `state`, giữ trong sessionStorage, nhảy về domain gốc.
//   Domain gốc, có ?state    : (đã đăng nhập) xin mã dùng-một-lần, nhảy về subdomain kèm #code.
//   Subdomain, có #code      : khớp state -> đổi mã lấy phiên -> vào trang chính.
// Không bao giờ chuyển hướng tới địa chỉ do query/fragment chỉ định: địa chỉ đích do server trả về.
const STATE_KEY = "handoffState";
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function HandoffPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const kind = parseHost(window.location.host).kind;
    const fail = (msg) => setError(msg || "We could not sign you in automatically.");

    if (kind === "root") {
      const state = new URLSearchParams(window.location.search).get("state") || "";
      const role = readSession("teacher") ? "teacher" : readSession("student") ? "student" : null;
      if (!TOKEN_RE.test(state) || !role) {
        router.replace("/login");
        return;
      }
      // "remember" của phiên gốc: học sinh luôn lưu lâu dài; giáo viên tuỳ ô "Remember me".
      const remember = role === "student" || !!localStorage.getItem("teacherToken");
      api
        .handoffStart(role, state)
        .then(({ origin, code }) => {
          window.location.replace(`${origin}/handoff#code=${code}&state=${state}&r=${remember ? 1 : 0}`);
        })
        .catch(() => router.replace(NAV[role].home));
      return;
    }

    if (kind !== "tenant") {
      router.replace("/login");
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = hash.get("code");
    const state = hash.get("state");

    if (!code && !state) {
      // Bắt đầu: đã có phiên ở đây thì vào luôn, chưa thì xin phiên từ domain gốc.
      const have = readSession("teacher") ? "teacher" : readSession("student") ? "student" : null;
      if (have) {
        router.replace(NAV[have].home);
        return;
      }
      const fresh = randomState();
      sessionStorage.setItem(STATE_KEY, fresh);
      window.location.replace(`https://${baseDomain()}/handoff?state=${fresh}`);
      return;
    }

    // Có #code: xoá khỏi thanh địa chỉ NGAY, rồi kiểm state do chính trình duyệt này đã sinh.
    const remember = hash.get("r") === "1";
    window.history.replaceState(null, "", "/handoff");
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (!expected || expected !== state || !TOKEN_RE.test(code || "")) {
      fail("This sign-in link did not start from this browser.");
      return;
    }
    api
      .handoffExchange(code, state)
      .then((res) => {
        storeLoginResult(res, remember);
        router.replace(NAV[res.role].home);
      })
      .catch((e) => fail(e.message));
  }, [router]);

  // Đang chuyển: dùng cùng màn chờ với phần còn lại của app (logo + vòng xoay).
  if (!error) return <PageLoader text="Signing you in…" />;

  // Lỗi: một thẻ ở giữa (login-stage mặc định chia 2 cột nên phải ép 1 cột).
  return (
    <div className="login-page">
      <div className="login-stage" style={{ gridTemplateColumns: "1fr", maxWidth: 430 }}>
        <div className="login-card">
          <p className="login-sub">{error}</p>
          <a className="btn login-submit" href="/login" style={{ textAlign: "center" }}>Sign in</a>
        </div>
      </div>
    </div>
  );
}
