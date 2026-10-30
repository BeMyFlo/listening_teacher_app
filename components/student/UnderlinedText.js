"use client";

// Render văn bản có gạch chân dạng `__chữ__` cho học sinh và giáo viên xem bài.
// Không dùng dangerouslySetInnerHTML — React tự escape XSS.
// errorLetters = true: gắn thêm <sup>(A)</sup>, <sup>(B)</sup>... sau mỗi phần gạch chân.
import { parseUnderline, hasUnderline } from "@/lib/underline";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function UnderlinedText({ text, errorLetters = false, className, style }) {
  if (text == null || text === "") return null;
  const str = String(text);
  if (!hasUnderline(str)) {
    return className || style ? <span className={className} style={style}>{str}</span> : <>{str}</>;
  }

  const segments = parseUnderline(str);
  let uIndex = 0;

  const content = (
    <>
      {segments.map((seg, idx) => {
        if (!seg.u) {
          return <span key={idx}>{seg.text}</span>;
        }
        const letter = LETTERS[uIndex] || String.fromCharCode(65 + uIndex);
        uIndex += 1;
        return (
          <span key={idx} className="u-part">
            <u>{seg.text}</u>
            {errorLetters && (
              <sup className="error-letter">
                ({letter})
              </sup>
            )}
          </span>
        );
      })}
    </>
  );

  return className || style ? <span className={className} style={style}>{content}</span> : content;
}
