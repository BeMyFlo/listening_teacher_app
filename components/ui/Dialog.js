"use client";

// Hệ thống popup dùng chung — thay cho window.alert / confirm / prompt.
//
//   const dialog = useDialog();
//   await dialog.alert({ title, message, tone });      // 1 nút OK
//   const ok = await dialog.confirm({ title, message, danger });  // -> boolean
//   const v  = await dialog.prompt({ title, label, validate });   // -> string | null
//   dialog.toast("Saved");                              // toast góc phải, tự ẩn
//
// DialogProvider được bọc trong RoleGate nên mọi trang /teacher, /student đều dùng được.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DialogCtx = createContext(null);

export function useDialog() {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog must be used inside <DialogProvider>");
  return ctx;
}

let _id = 0;
const nextId = () => ++_id;

export function DialogProvider({ children }) {
  const [stack, setStack] = useState([]); // hàng đợi popup (hiện cái trên cùng)
  const [toasts, setToasts] = useState([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const close = useCallback((id, result) => {
    setStack((s) => {
      const d = s.find((x) => x.id === id);
      if (d) d.resolve(result);
      return s.filter((x) => x.id !== id);
    });
  }, []);

  const push = useCallback((spec) => {
    return new Promise((resolve) => {
      setStack((s) => [...s, { ...spec, id: nextId(), resolve }]);
    });
  }, []);

  const api = useMemo(() => {
    const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));
    return {
      alert: ({ title, message, tone = "info", okText = "OK" } = {}) =>
        push({ kind: "alert", title, message, tone, okText }),
      confirm: ({ title, message, confirmText = "Confirm", cancelText = "Cancel", danger = false } = {}) =>
        push({ kind: "confirm", title, message, confirmText, cancelText, danger }),
      confirmDelete: (message, title = "Delete") =>
        push({ kind: "confirm", title, message, confirmText: "Delete", cancelText: "Cancel", danger: true }),
      prompt: ({ title, message, label, placeholder, type = "text", initialValue = "", validate } = {}) =>
        push({ kind: "prompt", title, message, label, placeholder, type, initialValue, validate }),
      toast: (message, tone = "success", ms = 3000) => {
        const id = nextId();
        setToasts((t) => [...t.slice(-3), { id, message, tone }]);
        setTimeout(() => dismissToast(id), ms);
      },
    };
  }, [push]);

  // Khoá cuộn nền khi có popup.
  useEffect(() => {
    if (!stack.length) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [stack.length]);

  const top = stack[stack.length - 1];

  return (
    <DialogCtx.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <>
            {top && <DialogView key={top.id} spec={top} onClose={(r) => close(top.id, r)} />}
            {toasts.length > 0 && (
              <div className="ui-toast-wrap" role="status" aria-live="polite">
                {toasts.map((t) => (
                  <div key={t.id} className={"ui-toast tone-" + t.tone}>
                    <svg className="icon">
                      <use href={"#icon-" + (t.tone === "error" ? "warning" : t.tone === "info" ? "info" : "check-circle")} />
                    </svg>
                    <span>{t.message}</span>
                  </div>
                ))}
              </div>
            )}
          </>,
          document.body
        )}
    </DialogCtx.Provider>
  );
}

function DialogView({ spec, onClose }) {
  const { kind, title, message, tone, okText, confirmText, cancelText, danger, label, placeholder, type, initialValue, validate } = spec;
  const [value, setValue] = useState(initialValue || "");
  const [err, setErr] = useState("");
  const primaryRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    (kind === "prompt" ? inputRef : primaryRef).current?.focus();
  }, [kind]);

  const cancelValue = kind === "confirm" ? false : kind === "prompt" ? null : undefined;

  function accept() {
    if (kind === "prompt") {
      const e = validate ? validate(value) : "";
      if (e) {
        setErr(e);
        return;
      }
      onClose(value);
    } else if (kind === "confirm") {
      onClose(true);
    } else {
      onClose();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(cancelValue);
    } else if (e.key === "Enter" && kind !== "prompt") {
      e.preventDefault();
      accept();
    }
  }

  const toneIcon = tone === "error" ? "warning" : tone === "success" ? "check-circle" : "info";

  return (
    <div
      className="modal-overlay ui-dialog-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose(cancelValue)}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-box ui-dialog">
        <div className="ui-dialog-body">
          {title && (
            <div className="ui-dialog-title">
              {(kind === "alert" || kind === "confirm") && (
                <span className={"ui-dialog-ico tone-" + (danger ? "error" : tone || "info")}>
                  <svg className="icon"><use href={"#icon-" + (danger ? "warning" : toneIcon)} /></svg>
                </span>
              )}
              <span>{title}</span>
            </div>
          )}
          {message && <p className="ui-dialog-msg">{message}</p>}
          {kind === "prompt" && (
            <div className="ui-dialog-field">
              {label && <label>{label}</label>}
              <input
                ref={inputRef}
                type={type}
                className="ui-dialog-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (err) setErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    accept();
                  }
                }}
              />
              {err && <p className="ui-dialog-err">{err}</p>}
            </div>
          )}
        </div>
        <div className="ui-dialog-actions">
          {(kind === "confirm" || kind === "prompt") && (
            <button type="button" className="btn secondary" onClick={() => onClose(cancelValue)}>
              {kind === "prompt" ? "Cancel" : cancelText}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className={"btn" + (danger ? " btn-danger-solid" : "")}
            onClick={accept}
          >
            {kind === "alert" ? okText : kind === "confirm" ? confirmText : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
