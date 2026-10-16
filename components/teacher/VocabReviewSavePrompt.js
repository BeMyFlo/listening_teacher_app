"use client";

import { useState } from "react";
import { VocabReviewOptions } from "./AiVocabOptions";

// Nội dung hộp thoại hỏi sau khi bấm Save ("Create Vocab Review?"). Được đưa vào
// dialog.confirm({ message }) nên tự giữ state của các tuỳ chọn và báo ra ngoài
// qua onChange (trang editor đọc giá trị cuối khi giáo viên bấm "Save & generate").
//   items     [{ label, state: "empty" | "stale" }]
//   initial   tuỳ chọn AI điền sẵn (lần dùng trước)
export default function VocabReviewSavePrompt({ items, initial, onChange, program }) {
  const [opts, setOpts] = useState(initial);
  const patch = (p) => {
    const next = { ...opts, ...p };
    setOpts(next);
    onChange(next);
  };
  return (
    // Enter trong ô nhập không được kích hoạt nút xác nhận của dialog.
    <div style={{ whiteSpace: "normal" }} onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
        {items.map((it) => (
          <li key={it.label}>
            <b>{it.label}</b> —{" "}
            {it.state === "stale"
              ? "the exercises changed since the words were made; the AI will suggest new words."
              : "no words yet; the AI will read the exercises and suggest words to review."}
          </li>
        ))}
      </ul>
      <p style={{ margin: "0 0 8px" }}>
        The unit is saved either way. You review the suggestions before anything reaches students.
      </p>
      <details>
        <summary style={{ cursor: "pointer", color: "var(--ink)", fontWeight: 600, fontSize: ".86rem" }}>Options</summary>
        <div style={{ marginTop: 10 }}>
          <VocabReviewOptions opts={opts} onChange={patch} idSuffix="-save" program={program} />
        </div>
      </details>
    </div>
  );
}
