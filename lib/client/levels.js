"use client";

// Levels của workspace cho giao diện giáo viên: danh sách (gộp tên + level đang dùng) và
// tạo / đổi tên / xoá. Nguồn sự thật là server (Workspace.levelNames); sau mỗi thay đổi hook
// tải lại danh sách VÀ gọi usePrograms().refresh() để nhãn "Level N · Tên" ở mọi trang cập nhật.
// Xem docs/plans/PLAN-LEVEL-NAMES.md.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { usePrograms } from "./program";
import { NAME_MAX } from "../levelNames";

export function useLevels() {
  const { refresh } = usePrograms();
  const [levels, setLevels] = useState(null); // { ielts: [...], toeic: [...] } | null khi đang tải
  const [error, setError] = useState("");

  const reload = useCallback(
    () =>
      api.teacher
        .listLevels()
        .then((d) => {
          setLevels(d.levels || {});
          setError("");
        })
        .catch((e) => setError(e.message)),
    []
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const afterChange = useCallback(() => Promise.all([reload(), refresh()]), [reload, refresh]);

  const addLevel = useCallback(
    async (program, name) => {
      const d = await api.teacher.createLevel({ program, name });
      await afterChange();
      return d.level; // { program, level, name }
    },
    [afterChange]
  );
  const renameLevel = useCallback(
    async (program, level, name) => {
      await api.teacher.renameLevel({ program, level, name });
      await afterChange();
    },
    [afterChange]
  );
  const deleteLevel = useCallback(
    async (program, level) => {
      await api.teacher.deleteLevel(program, level);
      await afterChange();
    },
    [afterChange]
  );

  return { levels, loaded: levels !== null, error, reload, addLevel, renameLevel, deleteLevel };
}

// Kiểm tra tên level cho dialog.prompt (cùng luật với server: bắt buộc, tối đa NAME_MAX).
export function validateLevelName(v) {
  const t = String(v || "").trim();
  if (!t) return "Please enter a name.";
  if (t.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`;
  return "";
}
