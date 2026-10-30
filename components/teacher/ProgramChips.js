"use client";

// Chip lọc chương trình `All · IELTS · TOEIC` (PLAN-PHASE8-TOEIC.md 4.1, C2).
// Giá trị nằm trên URL (?program=ielts|toeic, không có = All) nên reload/chia sẻ
// link giữ đúng, và sang trang khác thì không "dính" theo. Workspace chỉ có 1
// chương trình (isMulti=false) -> không render gì, trang y như trước Phase 8.
//
// Dùng useSearchParams nên trang chứa nó phải bọc trong <Suspense>.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PROGRAMS } from "@/lib/curriculum";
import { programParam, usePrograms } from "@/lib/client/program";

// Đổi/xoá ?program= nhưng giữ nguyên các tham số khác.
function useSetProgram() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (key) => {
    const p = new URLSearchParams(search ? search.toString() : "");
    if (key) p.set("program", key);
    else p.delete("program");
    const qs = p.toString();
    router.replace(pathname + (qs ? "?" + qs : ""), { scroll: false });
  };
}

export default function ProgramChips() {
  const { isMulti, programs } = usePrograms();
  const search = useSearchParams();
  const setProgram = useSetProgram();
  if (!isMulti) return null;
  const current = programParam(search);
  const chips = [{ key: null, label: "All" }, ...programs.map((k) => ({ key: k, label: (PROGRAMS[k] || {}).label || k }))];
  return (
    <div className="program-chips" role="group" aria-label="Filter by program">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          className={"program-chip" + (current === c.key ? " active" : "")}
          aria-pressed={current === c.key}
          onClick={() => setProgram(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

// Trạng thái trống khi đang lọc: "No TOEIC classes yet." + link "Show all".
// `what` là phần sau tên chương trình, vd "classes yet", "mock tests yet".
export function ProgramEmpty({ program, what }) {
  const setProgram = useSetProgram();
  const label = (PROGRAMS[program] && PROGRAMS[program].label) || "";
  return (
    <div className="empty-state">
      No {label} {what}.{" "}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setProgram(null);
        }}
      >
        Show all
      </a>
    </div>
  );
}
