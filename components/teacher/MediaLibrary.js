"use client";

import { useEffect, useRef, useState } from "react";
import { api, uploadToCloudinary } from "@/lib/client/api";

const CFG = {
  audio: {
    icon: "headphones",
    heading: "Audio Library",
    sub: "Upload and manage audio files for Listening tests",
    uploadHeading: "Upload New Audio Track",
    titleLabel: "Title",
    titlePh: "e.g. Listening 2A – Course Registration",
    fileLabel: "Audio file (mp3, wav...)",
    accept: "audio/*",
    resourceType: "video",
    folder: "ielts-listening",
    list: () => api.teacher.listAudio(),
    create: (d) => api.teacher.createAudio(d),
    remove: (id) => api.teacher.deleteAudio(id),
  },
  image: {
    icon: "image",
    heading: "Image Library",
    sub: "Diagram and map images for labelling tasks",
    uploadHeading: "Upload New Image (for Diagrams / Maps)",
    titleLabel: "Image Title",
    titlePh: "e.g. Section 3 – Library Map",
    fileLabel: "Image file (png, jpg, jpeg, gif...)",
    accept: "image/*",
    resourceType: "image",
    folder: "ielts-images",
    list: () => api.teacher.listImages(),
    create: (d) => api.teacher.createImage(d),
    remove: (id) => api.teacher.deleteImage(id),
  },
};

export default function MediaLibrary({ kind }) {
  const cfg = CFG[kind];
  const [rows, setRows] = useState(null);
  const [listErr, setListErr] = useState("");
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  function load() {
    cfg
      .list()
      .then((d) => setRows(d.rows || []))
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!title.trim() || !file) {
      setStatus({ cls: "error", msg: "Please enter a title and select a file." });
      return;
    }
    setBusy(true);
    setStatus({ cls: "info", msg: "Uploading..." });
    try {
      const up = await uploadToCloudinary(file, { resourceType: cfg.resourceType, folder: cfg.folder });
      await cfg.create({ title: title.trim(), unit: unit.trim(), ...up });
      setStatus({ cls: "success", msg: "Uploaded successfully." });
      setTitle("");
      setUnit("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      setStatus({ cls: "error", msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this item? This action cannot be undone.")) return;
    try {
      await cfg.remove(id);
      load();
    } catch (e) {
      window.alert("Failed to delete: " + e.message);
    }
  }

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href={"#icon-" + cfg.icon} /></svg></div>
          <div>
            <h1>{cfg.heading}</h1>
            <p className="page-sub">{cfg.sub}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>{cfg.uploadHeading}</h3>
        <div className="form-row">
          <label>{cfg.titleLabel}</label>
          <input type="text" placeholder={cfg.titlePh} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Unit (optional)</label>
          <input type="text" placeholder="e.g. Unit 2" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="form-row">
          <label>{cfg.fileLabel}</label>
          <input ref={fileRef} type="file" accept={cfg.accept} />
        </div>
        <button type="button" className="btn" disabled={busy} onClick={upload}>
          <svg className="icon"><use href="#icon-upload" /></svg> Upload
        </button>
        {status && (
          <p className={"notice " + status.cls} style={{ marginTop: 14 }}>
            {status.msg}
          </p>
        )}
      </div>

      <div className="card">
        <h3>{cfg.heading}</h3>
        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {!rows && !listErr && <div className="notice info">Loading...</div>}
        <div id="mediaList">
          {rows && rows.length === 0 && (
            <div className="empty-state">
              No {kind === "audio" ? "audio tracks" : "images"} yet. Upload one using the form above.
            </div>
          )}
          {(rows || []).map((r) => (
            <div className="audio-item" key={r._id}>
              <div className="meta" style={kind === "image" ? { flex: 1 } : undefined}>
                <h4>{(r.unit ? r.unit + " · " : "") + r.title}</h4>
                <p>{r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString("en-US") : ""}</p>
              </div>
              {kind === "audio" ? (
                <audio controls src={r.cloudinaryUrl} />
              ) : (
                <img
                  src={r.cloudinaryUrl}
                  alt=""
                  style={{
                    height: 48,
                    borderRadius: 4,
                    objectFit: "contain",
                    marginRight: 12,
                    maxWidth: 100,
                  }}
                />
              )}
              <div className="actions">
                <button type="button" className="icon-btn danger" title="Delete" onClick={() => remove(r._id)}>
                  <svg className="icon"><use href="#icon-trash" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
