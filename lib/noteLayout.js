// Parsing cho "Note / Summary completion" — dùng chung giữa trình soạn của giáo
// viên (xem trước trực tiếp) và trình hiển thị bài làm của học sinh, để hai bên
// không bao giờ lệch nhau.
//
// Cú pháp 1 dòng:
//   # ...     -> tiêu đề in đậm căn giữa
//   ## ...    -> tiêu đề phụ
//   - ...     -> gạch đầu dòng (các dòng "- " liên tiếp gộp thành 1 danh sách)
//   ---       -> ranh giới giữa phần hướng dẫn (ngoài khung) và phần ghi chú
//   [[n]]     -> chỗ trống đánh số n (nằm bất kỳ đâu trong dòng)

export function parseNoteInline(text) {
  const re = /\[\[(\d+)\]\]/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    parts.push({ type: "blank", id: Number(m[1]) });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

export function parseNoteLayout(noteText) {
  const lines = (noteText || "").split("\n");
  const dividerIdx = lines.findIndex((l) => l.trim() === "---");
  const introLines = (dividerIdx >= 0 ? lines.slice(0, dividerIdx) : []).filter((l) => l.trim());
  const boxLines = dividerIdx >= 0 ? lines.slice(dividerIdx + 1) : lines;

  const blocks = [];
  let curList = null;
  boxLines.forEach((line) => {
    const trimmed = line.trim();
    if (/^-\s+/.test(trimmed)) {
      if (!curList) {
        curList = { type: "ul", items: [] };
        blocks.push(curList);
      }
      curList.items.push(trimmed.replace(/^-\s+/, ""));
      return;
    }
    curList = null;
    if (/^##\s+/.test(trimmed)) blocks.push({ type: "h4", text: trimmed.replace(/^##\s+/, "") });
    else if (/^#\s+/.test(trimmed)) blocks.push({ type: "h3", text: trimmed.replace(/^#\s+/, "") });
    else if (!trimmed) blocks.push({ type: "spacer" });
    else blocks.push({ type: "p", text: line });
  });

  return { introLines, blocks };
}
