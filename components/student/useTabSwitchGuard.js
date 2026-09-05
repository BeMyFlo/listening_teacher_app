"use client";

import { useEffect, useRef } from "react";

// Phát hiện học sinh rời tab/ứng dụng khi đang làm bài thi (Page Visibility
// API — không dùng "blur" vì nó bắn cả khi mở devtools/click ra ngoài
// browser, dễ báo nhầm). Mỗi lần rời rồi quay lại tính là 1 lần vi phạm;
// đến lần thứ `max` thì gọi onExceeded (ví dụ: tự nộp bài).
//
//   useTabSwitchGuard({ enabled, dialog, onExceeded, label: "bài Listening" });
//
// `dialog`/`onExceeded`/`label` được đọc qua ref trong effect (không đưa vào
// dependency array) vì các component gọi hook này re-render liên tục (mỗi
// lần học sinh gõ/chọn đáp án) và tạo hàm `onExceeded` mới mỗi lần — nếu để
// effect phụ thuộc vào chúng thì listener bị gỡ/gắn lại liên tục, làm mất
// bộ đếm vi phạm đã tích luỹ.
export function useTabSwitchGuard({ enabled, max = 3, dialog, onExceeded, label = "bài thi" }) {
  const awayRef = useRef(false);
  const countRef = useRef(0);
  const doneRef = useRef(false);
  const latest = useRef({ dialog, onExceeded, label, max });
  latest.current = { dialog, onExceeded, label, max };

  useEffect(() => {
    if (!enabled) return;
    // Reset khi hook được bật lại cho 1 phiên làm bài mới.
    awayRef.current = false;
    countRef.current = 0;
    doneRef.current = false;

    function onVisibility() {
      if (doneRef.current) return;
      if (document.hidden) {
        awayRef.current = true;
        return;
      }
      if (!awayRef.current) return;
      awayRef.current = false;
      countRef.current += 1;
      const n = countRef.current;
      const { dialog, onExceeded, label, max } = latest.current;
      if (n >= max) {
        doneRef.current = true;
        dialog
          .alert({
            tone: "error",
            title: "Bài làm đã được tự động nộp",
            message: `Bạn đã rời khỏi ${label} ${n} lần. Theo quy định, bài làm sẽ được tự động nộp với các câu trả lời hiện có.`,
          })
          .then(() => onExceeded && onExceeded());
      } else {
        dialog.alert({
          tone: "error",
          title: `Cảnh báo rời tab (${n}/${max})`,
          message: `Không được chuyển sang tab hoặc ứng dụng khác khi đang làm ${label}. Vi phạm đủ ${max} lần, bài làm sẽ tự động được nộp.`,
        });
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);
}
