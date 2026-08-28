"use client";

import { useRef, useState } from "react";
import { uploadToCloudinary } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";

const MAX_IMG = 10 * 1024 * 1024;
const MAX_VID = 100 * 1024 * 1024;

export default function Composer({ classId, onSend }) {
  const dialog = useDialog();
  const [text, setText] = useState("");
  const [pending, setPending] = useState([]); // {name, url, publicId, type, width, height, bytes} | {name, uploading:true}
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const taRef = useRef(null);

  async function pickFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    for (const f of files) {
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      if (!isImg && !isVid) {
        dialog.toast(`"${f.name}" is not an image or video`, "error");
        continue;
      }
      if (isImg && f.size > MAX_IMG) return dialog.toast("Image must be ≤ 10 MB", "error");
      if (isVid && f.size > MAX_VID) return dialog.toast("Video must be ≤ 100 MB", "error");

      const key = Math.random().toString(36).slice(2);
      setPending((p) => [...p, { key, name: f.name, uploading: true }]);
      try {
        const r = await uploadToCloudinary(f, { resourceType: isVid ? "video" : "image", folder: "chat/" + classId });
        setPending((p) =>
          p.map((x) =>
            x.key === key
              ? {
                  key,
                  name: f.name,
                  type: isVid ? "video" : "image",
                  url: r.cloudinaryUrl,
                  publicId: r.cloudinaryPublicId,
                  width: r.width,
                  height: r.height,
                  bytes: r.bytes,
                }
              : x
          )
        );
      } catch (err) {
        setPending((p) => p.filter((x) => x.key !== key));
        dialog.toast("Upload failed: " + err.message, "error");
      }
    }
  }

  async function submit() {
    const atts = pending.filter((p) => !p.uploading);
    if (pending.some((p) => p.uploading)) return dialog.toast("Wait for uploads to finish", "info");
    if (!text.trim() && !atts.length) return;
    setBusy(true);
    try {
      await onSend(text.trim(), atts.map(({ type, url, publicId, width, height, bytes }) => ({ type, url, publicId, width, height, bytes })));
      setText("");
      setPending([]);
      taRef.current && (taRef.current.style.height = "auto");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not send", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-composer">
      {pending.length > 0 && (
        <div className="chat-composer-atts">
          {pending.map((p) => (
            <div key={p.key} className={"chat-att-chip" + (p.uploading ? " uploading" : "")}>
              {p.uploading ? (
                <span className="chat-att-spin" />
              ) : p.type === "video" ? (
                <svg className="icon"><use href="#icon-play" /></svg>
              ) : (
                <img src={p.url} alt="" />
              )}
              <span className="chat-att-name">{p.name}</span>
              {!p.uploading && (
                <button type="button" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                  <svg className="icon"><use href="#icon-cross" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="chat-composer-row">
        <button type="button" className="chat-attach-btn" title="Attach photo / video" onClick={() => fileRef.current?.click()}>
          <svg className="icon"><use href="#icon-image" /></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={pickFiles} />
        <textarea
          ref={taRef}
          rows={1}
          placeholder="Write a message…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="chat-send-btn" disabled={busy} onClick={submit}>
          <svg className="icon"><use href="#icon-send" /></svg>
        </button>
      </div>
    </div>
  );
}
