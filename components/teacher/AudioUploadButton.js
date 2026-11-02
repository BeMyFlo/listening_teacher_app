"use client";

// Tải audio ngay trong lúc soạn bài, không phải sang Audio Library rồi quay lại chọn.
// File đi thẳng từ trình duyệt lên Cloudinary (như MediaLibrary), xong thì chọn sẵn audio vừa tải.
import { useRef, useState } from "react";
import { api, uploadToCloudinary } from "@/lib/client/api";
import { useBranding } from "@/lib/client/branding";
import { audioTitleFromFile } from "@/lib/teacher/audioTitle";

export default function AudioUploadButton({ media, unit = "", onUploaded }) {
  const brand = useBranding();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Upload lâu, giáo viên có thể sửa bài trong lúc chờ: phải gọi callback của lần render MỚI NHẤT,
  // gọi bản cũ sẽ ghi đè những gì vừa sửa.
  const latest = useRef(onUploaded);
  latest.current = onUploaded;

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const folder = /^[a-z0-9-]+$/.test(brand?.slug) ? `workspaces/${brand.slug}/audio` : "ielts-listening";
      const up = await uploadToCloudinary(file, { resourceType: "video", folder });
      const res = await api.teacher.createAudio({ title: audioTitleFromFile(file.name), unit, ...up });
      if (media?.reload) await media.reload();
      latest.current(String(res.audio._id));
    } catch (e) {
      setErr(e.message || "Could not upload the audio");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        aria-label="Audio file"
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <button type="button" className="btn secondary sm" disabled={busy} onClick={() => fileRef.current?.click()}>
        <svg className="icon"><use href="#icon-upload" /></svg> {busy ? "Uploading audio…" : "Upload new audio"}
      </button>
      {err && <p className="notice error" style={{ marginTop: 6, padding: "6px 10px", fontSize: ".82rem" }}>{err}</p>}
    </div>
  );
}
