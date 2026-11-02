"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { parseUnderline } from "@/lib/underline";
import { underlineModeOf } from "@/lib/generalFormats";

// Bản in của đề (G4 bước 4): cùng dữ liệu shuffleExam với file Word (lấy qua route test-export dạng JSON).
// Đáp án chỉ tải khi giáo viên bật "Answer key".

const DOTS = "……………………………………………………………………………………………";

function U({ text, on }) {
  const t = String(text || "").replace(/<u>(.*?)<\/u>/gi, "__$1__");
  if (!on) return <>{t}</>;
  return (
    <>
      {parseUnderline(t).map((s, i) => (s.u ? <u key={i}>{s.text}</u> : <span key={i}>{s.text}</span>))}
    </>
  );
}

// Error identification: chữ (A), (B)... ngay sau từng phần gạch chân.
function ErrorLabel({ text }) {
  const t = String(text || "").replace(/<u>(.*?)<\/u>/gi, "__$1__");
  let k = 0;
  return (
    <>
      {parseUnderline(t).map((s, i) =>
        s.u ? (
          <span key={i}>
            <u>{s.text}</u> ({String.fromCharCode(65 + k++)})
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

function Question({ q }) {
  const mode = underlineModeOf(q.formatLabel);
  const blank = /_{3,}|\.{4,}|…/.test(q.label + q.pre + q.post);
  return (
    <div className="pq">
      <div>
        <b>{q.numberEnd ? `${q.number}-${q.numberEnd}.` : `${q.number}.`}</b> {q.errorLetters ? <ErrorLabel text={q.label} /> : <U text={q.label} on={mode === "label"} />}
      </div>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="pimg" />}
      {q.type === "fill" && (q.pre || q.post) && (
        <div className="pind">
          {q.pre} {blank ? "" : "………………………"} {q.post}
        </div>
      )}
      {q.tokens && q.tokens.length > 0 && <div className="pind">{q.tokens.join("  /  ")}</div>}
      {q.hint && <div className="pind"><i>({q.hint})</i></div>}
      {q.type === "choice" && q.options.length > 0 && (
        <div className="popts">
          {q.options.map((o) => (
            <span key={o.letter} className="popt">
              {o.label && o.label !== o.letter ? (
                <>
                  {o.letter}. <U text={o.label} on={mode === "options"} />
                </>
              ) : (
                o.letter + "."
              )}
            </span>
          ))}
        </div>
      )}
      {q.type === "fill" && !blank && <div className="pind">{DOTS}</div>}
    </div>
  );
}

function PrintInner() {
  const { testId } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const codeParam = search.get("code");
  const code = /^[0-4]$/.test(codeParam || "") ? Number(codeParam) : 0;
  const [data, setData] = useState(null);
  const [key, setKey] = useState(null);
  const [showKey, setShowKey] = useState(search.get("answers") === "1");
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    setKey(null);
    api.teacher.exportTestJson(testId, code, "exam").then(setData).catch((e) => setErr(e.message));
  }, [testId, code]);

  // Đáp án chỉ tải khi bật.
  useEffect(() => {
    if (!showKey || key) return;
    api.teacher.exportTestJson(testId, code, "key").then(setKey).catch((e) => setErr(e.message));
  }, [showKey, key, testId, code]);

  function setCode(c) {
    router.replace(`/teacher/tests/${testId}/print?code=${c}${showKey ? "&answers=1" : ""}`);
  }

  if (err) return <div className="tab-panel active"><div className="notice error">{err}</div></div>;
  if (!data) return <div className="tab-panel active"><div className="notice info">Loading...</div></div>;
  const { meta, exam } = data;
  const prompts = exam.prompts || [];

  return (
    <div className="tab-panel active">
      <style>{`
        .print-sheet { background:#fff; color:#000; font-family:"Times New Roman",serif; font-size:12pt; max-width:210mm; margin:0 auto; padding:12mm 15mm; }
        .print-sheet h1 { font-size:16pt; text-align:center; margin:4px 0; }
        .print-sheet h2 { font-size:13pt; margin:16px 0 6px; }
        .print-sheet .pmeta { text-align:center; margin:4px 0 10px; }
        .print-sheet .pq { margin:0 0 10px; break-inside:avoid; }
        .print-sheet .pind { margin-left:18px; }
        .print-sheet .popts { display:flex; flex-wrap:wrap; gap:4px 28px; margin-left:18px; }
        .print-sheet .popt { min-width:90px; }
        .print-sheet .pimg { max-width:14cm; max-height:8cm; display:block; margin:6px 0 6px 18px; }
        .print-sheet .ppass { white-space:pre-wrap; margin:6px 0; }
        .print-sheet .pnote { font-style:italic; }
        .print-sheet .pkey { break-before:page; }
        @media print {
          body * { visibility:hidden !important; }
          .print-sheet, .print-sheet * { visibility:visible !important; }
          .print-sheet { position:absolute; left:0; top:0; width:100%; max-width:none; padding:0; }
          .no-print { display:none !important; }
          @page { size:A4; margin:15mm; }
        }
      `}</style>

      <div className="card no-print" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Exam code{" "}
          <select className="select-inline" value={code} onChange={(e) => setCode(e.target.value)}>
            <option value={0}>Original</option>
            {[1, 2, 3, 4].map((c) => (
              <option key={c} value={c}>{100 + c}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> Answer key
        </label>
        <button type="button" className="btn" onClick={() => window.print()}>Print</button>
        <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>To save as PDF, choose Save as PDF in the print dialog.</span>
      </div>

      <div className="print-sheet">
        <div style={{ minHeight: 18 }} />
        <h1>{meta.title}</h1>
        <div className="pmeta">Grade: {meta.grade || "____"} &nbsp;&nbsp; Time: {meta.time || "____"} &nbsp;&nbsp; Code: {meta.code}</div>
        <div style={{ marginBottom: 12 }}>Name: ______________________________ &nbsp;&nbsp; Class: ____________</div>

        {exam.parts.map((p, i) => (
          <div key={i}>
            {p.name && <h2>{p.name}</h2>}
            {p.skill === "listening" && <div className="pnote">Listening: audio not included</div>}
            {p.imageUrl && <img src={p.imageUrl} alt="" className="pimg" />}
            {p.instruction && <div className="pnote" style={{ margin: "6px 0" }}>{p.instruction}</div>}
            {p.passageText && <div className="ppass"><U text={p.passageText} on /></div>}
            {(p.matchOptions || []).map((o) => (
              <div key={o.letter} className="pind">{o.letter}. {o.label}</div>
            ))}
            {p.questions.map((q) => (
              <Question key={q.number} q={q} />
            ))}
          </div>
        ))}

        {prompts.map((p, i) => (
          <div key={"p" + i}>
            {(i === 0 || prompts[i - 1].skill !== p.skill) && <h2>{p.skill === "speaking" ? "Speaking" : "Writing"}</h2>}
            {p.title && <div><b>{p.title}</b></div>}
            {p.imageUrl && <img src={p.imageUrl} alt="" className="pimg" />}
            <div className="ppass">{p.instructions}</div>
            {p.skill !== "speaking" &&
              Array.from({ length: 8 }, (_, k) => <div key={k} style={{ margin: "10px 0" }}>{DOTS}</div>)}
          </div>
        ))}

        {showKey && key && (
          <div className="pkey">
            <h1>{meta.title}</h1>
            <div className="pmeta">Answer key — Code: {meta.code}</div>
            {["listening", "reading"].map((sk) => {
              const list = key.answers.filter((a) => a.skill === sk);
              if (!list.length) return null;
              return (
                <div key={sk}>
                  <h2>{sk === "listening" ? "Listening" : "Reading"}</h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px" }}>
                    {list.map((a) => (
                      <span key={a.number}><b>{a.number}.</b> {a.answer}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <PrintInner />
    </Suspense>
  );
}
