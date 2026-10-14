"use client";

import { useState } from "react";
import { VocabFlashcards, VocabWordList } from "./VocabFlashcards";

// Sub-tab "Review" của Reading / Listening: từ vựng giáo viên chọn từ bài tập của
// skill. Khoá tới khi học sinh làm xong mọi bài của skill (tính ở client từ
// categoryStats — danh sách từ không nhạy cảm như đáp án).
//   words        [{ word, meaning, ..., context }]
//   done / total số bài đã làm / tổng số bài của skill
export default function VocabReviewPane({ words, done, total, skillLabel }) {
  const [view, setView] = useState("cards"); // cards | list

  if (done < total) {
    return (
      <div className="empty-state locked-skill" style={{ marginTop: 12 }}>
        <svg className="icon"><use href="#icon-lock" /></svg>
        <div>
          Finish all {skillLabel} exercises to unlock the vocabulary review ({done}/{total}).
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 6 }}>Vocab Review</h3>
      <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: ".86rem" }}>
        {words.length} word{words.length === 1 ? "" : "s"} from the {skillLabel} exercises you just did.
      </p>
      <div className="lesson-subtabs" style={{ marginTop: 0 }}>
        <button
          type="button"
          className={"lesson-subtab" + (view === "cards" ? " active" : "")}
          onClick={() => setView("cards")}
        >
          Flashcard
        </button>
        <button
          type="button"
          className={"lesson-subtab" + (view === "list" ? " active" : "")}
          onClick={() => setView("list")}
        >
          Word table
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        {view === "cards" ? (
          <VocabFlashcards words={words} showContext />
        ) : (
          <VocabWordList words={words} showContext />
        )}
      </div>
    </div>
  );
}
