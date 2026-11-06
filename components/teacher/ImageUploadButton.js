"use client";

// Tải ảnh ngay trong lúc soạn bài (nút, kéo-thả hoặc dán Ctrl+V), không phải sang Image Library
// rồi quay lại chọn. Giống AudioUploadButton: file đi thẳng từ trình duyệt lên Cloudinary (cùng
// thư mục, cùng API createImage như trang Image Library), xong thì chọn sẵn ảnh vừa tải.
// Kèm ảnh xem trước của ảnh đang chọn + nút bỏ chọn.
import { useRef, useState } from "react";
import { api, uploadToCloudinary } from "@/lib/client/api";
import { useBranding } from "@/lib/client/branding";
import { imageTitleFromFile } from "@/lib/teacher/audioTitle";

export default function ImageUploadButton({ media, value, onChange, unit = "" }) {
  const brand = useBranding();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  // Upload lâu, giáo viên có thể sửa bài trong lúc chờ: phải gọi callback của lần render MỚI NHẤT.
  const latest = useRef(onChange);
  latest.current = onChange;

  const img = value ? (media?.images || []).find((im) => String(im._id) === String(value)) : null;

  async function upload(file) {
    if (!file || busy) return;
    // Trang Image Library nhận accept="image/*" — giữ đúng giới hạn đó cho kéo-thả/dán.
    if (!String(file.type || "").startsWith("image/")) {
      setErr("Please choose an image file (png, jpg, jpeg, gif...).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const folder = /^[a-z0-9-]+$/.test(brand?.slug) ? `workspaces/${brand.slug}/images` : "ielts-images";
      const up = await uploadToCloudinary(file, { resourceType: "image", folder });
      const res = await api.teacher.createImage({ title: imageTitleFromFile(file.name), unit, ...up });
      if (media?.reload) await media.reload();
      latest.current(String(res.image._id));
    } catch (e) {
      setErr(e.message || "Could not upload the image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function fromItems(items) {
    for (const it of items || []) {
      if (it.kind === "file" && String(it.type).startsWith("image/")) return it.getAsFile();
    }
    return null;
  }

  return (
    <div className="image-upload">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        aria-label="Image file"
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div
        className={"image-upload-zone" + (over ? " over" : "")}
        tabIndex={0}
        title="Click here, then paste an image (Ctrl+V) — or drop an image file"
        onPaste={(e) => {
          const f = fromItems(e.clipboardData?.items);
          if (f) {
            e.preventDefault();
            upload(f);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer?.files?.[0]);
        }}
      >
        <button type="button" className="btn secondary sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <svg className="icon"><use href="#icon-upload" /></svg> {busy ? "Uploading image…" : "Upload image"}
        </button>
        <span className="image-upload-hint">or drop / paste an image here · saved to your Image Library</span>
      </div>
      {err && <p className="notice error" style={{ marginTop: 6, padding: "6px 10px", fontSize: ".82rem" }}>{err}</p>}
      {img && (
        <div className="image-upload-preview">
          <img src={img.cloudinaryUrl} alt={img.title || ""} />
          <button type="button" className="icon-btn danger" title="Remove image" onClick={() => latest.current("")}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
