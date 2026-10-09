"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";

// Form xin dùng thử. Không tạo tài khoản: chỉ gửi yêu cầu để admin liên hệ lại.
export default function LeadForm() {
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const f = e.currentTarget;
    // FormData, không dùng f.name: HTMLFormElement.name là thuộc tính của chính <form>, không phải ô "name".
    const fd = new FormData(f);
    const val = (k) => String(fd.get(k) || "");
    const body = {
      name: val("name").trim(),
      email: val("email").trim(),
      phone: val("phone").trim(),
      organization: val("organization").trim(),
      message: val("message").trim(),
      website: val("website"), // ô bẫy
    };
    if (body.name.length < 2) { setState("error"); setMsg("Vui lòng nhập họ tên."); return; }
    if (!/^\S+@\S+\.\S{2,}$/.test(body.email)) { setState("error"); setMsg("Vui lòng nhập email hợp lệ."); return; }
    setState("sending");
    setMsg("");
    try {
      await api.signupRequest(body);
      setState("done");
      f.reset();
    } catch (err) {
      setState("error");
      setMsg(
        err.status === 429
          ? "Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau hoặc liên hệ trực tiếp qua email/điện thoại."
          : err.status === 400
          ? "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại email và số điện thoại."
          : "Chưa gửi được. Vui lòng thử lại hoặc liên hệ trực tiếp qua email/điện thoại."
      );
    }
  }

  if (state === "done") {
    return (
      <div className="lp-form-done" role="status">
        <h3>Cảm ơn bạn!</h3>
        <p>Chúng tôi đã nhận được thông tin và sẽ liên hệ lại qua email hoặc số điện thoại bạn để lại trong thời gian sớm nhất.</p>
      </div>
    );
  }

  return (
    <form className="lp-form" onSubmit={onSubmit} noValidate>
      <div className="lp-field">
        <label htmlFor="lp-name">Họ và tên *</label>
        <input id="lp-name" name="name" type="text" autoComplete="name" maxLength={100} required />
      </div>
      <div className="lp-field">
        <label htmlFor="lp-email">Email *</label>
        <input id="lp-email" name="email" type="email" autoComplete="email" maxLength={200} required />
      </div>
      <div className="lp-field">
        <label htmlFor="lp-phone">Số điện thoại / Zalo</label>
        <input id="lp-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
      </div>
      <div className="lp-field">
        <label htmlFor="lp-org">Tên trung tâm / lớp học</label>
        <input id="lp-org" name="organization" type="text" maxLength={120} />
      </div>
      <div className="lp-field lp-wide">
        <label htmlFor="lp-msg">Bạn muốn dùng BeMyFlo để làm gì?</label>
        <textarea id="lp-msg" name="message" rows={3} maxLength={1000} />
      </div>
      {/* Ô bẫy cho bot: người thật không thấy và không điền. */}
      <div className="lp-hp" aria-hidden="true">
        <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state === "error" && <p className="lp-form-error" role="alert">{msg}</p>}
      <div className="lp-wide">
        <button className="lp-btn lp-btn-primary" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Đang gửi…" : "Đăng ký dùng thử miễn phí"}
        </button>
        <p className="lp-fineprint">Chúng tôi chỉ dùng thông tin này để liên hệ lại với bạn về BeMyFlo.</p>
      </div>
    </form>
  );
}
