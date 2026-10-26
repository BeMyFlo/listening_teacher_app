"use client";

// Pill nhỏ ghi chương trình của một lớp / đề / bài nộp (PLAN-PHASE8-TOEIC.md 4.2).
// Chỉ render khi workspace dùng >= 2 chương trình: truyền `isMulti` nếu trang đã
// có sẵn (đỡ phải đăng ký thêm), không thì tự đọc từ usePrograms().
import { PROGRAMS, isProgram } from "@/lib/curriculum";
import { usePrograms } from "@/lib/client/program";

export default function ProgramBadge({ program, isMulti }) {
  const hook = usePrograms();
  const multi = isMulti === undefined ? hook.isMulti : isMulti;
  if (!multi || !isProgram(program)) return null;
  return <span className={"program-badge program-" + program}>{PROGRAMS[program].label}</span>;
}
