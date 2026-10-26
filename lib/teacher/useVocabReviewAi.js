"use client";

// Trạng thái gọi AI Vocab Review theo từng skill. Nằm ở trang editor (không phải
// trong tab) để "Save & generate" khởi chạy được cho cả 2 skill song song và kết
// quả vẫn còn khi giáo viên chuyển tab/skill.

import { useCallback, useState } from "react";
import { api } from "@/lib/client/api";
import { reviewSourceCat, sourceHashOf } from "./vocabReviewClient";
import { levelWordOf } from "@/lib/curriculum";

// states[skill] = { busy, err, draft: { words, removed, model, hash } | null, picked: bool[] }
export default function useVocabReviewAi() {
  const [states, setStates] = useState({});

  const patch = useCallback((skill, p) => {
    setStates((s) => ({ ...s, [skill]: { busy: false, err: "", draft: null, picked: [], ...(s[skill] || {}), ...p } }));
  }, []);

  // cat: category của state editor; ctx: { unitId, level, unitName, program }; opts: tuỳ chọn AI.
  const run = useCallback(
    async (skill, cat, ctx, opts) => {
      const src = reviewSourceCat(cat);
      patch(skill, { busy: true, err: "", draft: null, picked: [] });
      try {
        const r = await api.teacher.aiVocabReview({
          unitId: ctx.unitId,
          // Chỉ gửi khi không phải IELTS -> request IELTS giữ nguyên như cũ.
          ...(ctx.program && ctx.program !== "ielts" ? { program: ctx.program } : {}),
          skill,
          level: ctx.level ? `${levelWordOf(ctx.program)} ${ctx.level}` : "",
          unitName: ctx.unitName || "",
          exercises: src.exercises,
          existingWords: ((cat.vocabReview && cat.vocabReview.words) || []).map((w) => w.word),
          wordCount: opts.wordCount,
          columns: opts.columns,
          language: opts.language,
          studentLevel: opts.studentLevel,
          notes: opts.notes,
        });
        const words = r.words || [];
        patch(skill, {
          busy: false,
          draft: { words, removed: r.removed || [], model: r.model || "", hash: sourceHashOf(src) },
          picked: words.map(() => true),
        });
      } catch (e) {
        patch(skill, { busy: false, err: e.message || "AI request failed" });
      }
    },
    [patch]
  );

  const setPicked = useCallback((skill, picked) => patch(skill, { picked }), [patch]);
  const clear = useCallback((skill) => patch(skill, { draft: null, picked: [], err: "" }), [patch]);

  return { states, run, setPicked, clear };
}
