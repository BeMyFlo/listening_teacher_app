// Registry dạng đề TOEIC Speaking & Writing (Phase 8B) — dùng chung server và
// client, giống lib/curriculum.js: CommonJS thuần, KHÔNG import mongoose/DB.
// Xem docs/plans/multi-tenant/PLAN-PHASE8B-TOEIC-SW.md mục 2.1.
//
// `descriptors`: mô tả từng mức điểm (en + vi) do người lập trình VIẾT LẠI BẰNG LỜI MÌNH
// dựa trên thang chấm công khai của TOEIC Speaking/Writing — KHÔNG phải rubric chính thức
// của ETS và không chép nguyên văn. CHỜ CHỦ DỰ ÁN ĐỌC DUYỆT trước khi merge.
// Nguồn tham khảo:
//   https://www.ets.org/toeic/about/speaking-writing.html
//   https://iibc-global.org/english/toeic/test/speaking/about/format.html
//   https://www.iibc-global.org/english/toeic/test/lr/about/format.html
//   https://www.in.ets.org/toeic/test-takers/about/listening-reading.html
//
// Thời gian (giây) là MẶC ĐỊNH điền sẵn khi giáo viên chọn dạng đề; mỗi đề sửa được
// (prompt.prepSeconds / prompt.responseSeconds, null = lấy mặc định ở đây).

// Khía cạnh để giáo viên/AI nhận xét (không chấm điểm riêng). Key khớp CRITERIA của annotate.js (bước 2).
const ASPECT_LABELS = {
  TK: "Task / relevance",
  OR: "Organization",
  VO: "Vocabulary",
  GR: "Grammar",
  PN: "Pronunciation",
  IN: "Intonation & stress",
  FL: "Fluency",
  CT: "Content",
};

// Tạo descriptor từ danh sách [en, vi] theo thứ tự mức 0..max.
function levels(pairs) {
  const out = {};
  pairs.forEach(([en, vi], i) => (out[String(i)] = { en, vi }));
  return out;
}

const TOEIC_TASKS = {
  "toeic.s.read": {
    key: "toeic.s.read",
    skill: "speaking",
    label: "Read a text aloud",
    shortLabel: "Read aloud",
    maxScore: 3,
    prepSeconds: 45,
    responseSeconds: 45,
    needsImage: false,
    needsAudio: false,
    needsRequiredWords: false,
    wordTarget: null,
    aspects: ["PN", "IN", "FL"],
    descriptors: levels([
      ["No response, or nothing intelligible or related to the text.", "Không trả lời, hoặc không hiểu được / không liên quan đến đoạn văn."],
      ["Very hard to understand; many words are mispronounced and the delivery is halting or flat.", "Rất khó hiểu; nhiều từ phát âm sai, đọc ngắt quãng hoặc đều đều."],
      ["Mostly understandable, but some words, stress or intonation are off and there are noticeable pauses.", "Phần lớn hiểu được, nhưng còn vài từ, trọng âm hay ngữ điệu chưa đúng và có chỗ ngập ngừng."],
      ["Clear and natural: words are pronounced well, stress and intonation fit the text, and the pace is steady.", "Rõ ràng, tự nhiên: phát âm tốt, trọng âm và ngữ điệu phù hợp bài đọc, nhịp đều."],
    ]),
  },
  "toeic.s.picture": {
    key: "toeic.s.picture",
    skill: "speaking",
    label: "Describe a picture",
    shortLabel: "Describe picture",
    maxScore: 3,
    prepSeconds: 45,
    responseSeconds: 30,
    needsImage: true,
    needsAudio: false,
    needsRequiredWords: false,
    wordTarget: null,
    aspects: ["TK", "VO", "GR", "PN", "FL"],
    descriptors: levels([
      ["No response, or nothing that relates to the picture.", "Không trả lời, hoặc không liên quan đến bức ảnh."],
      ["Only a few words or fragments about the picture; hard to follow because of errors or long pauses.", "Chỉ vài từ hoặc cụm rời rạc về bức ảnh; khó theo dõi vì lỗi hoặc ngừng lâu."],
      ["Describes the main parts of the picture, but with limited detail, some grammar or vocabulary errors and uneven flow.", "Mô tả được các phần chính của ảnh nhưng ít chi tiết, còn lỗi ngữ pháp/từ vựng và nói chưa trôi chảy."],
      ["Describes the picture well with relevant detail, accurate language and a smooth, easy-to-follow delivery.", "Mô tả ảnh tốt, có chi tiết phù hợp, ngôn ngữ chính xác và nói trôi chảy, dễ theo dõi."],
    ]),
  },
  "toeic.s.respond": {
    key: "toeic.s.respond",
    skill: "speaking",
    label: "Respond to questions",
    shortLabel: "Respond",
    maxScore: 3,
    prepSeconds: 3,
    // Đề thật: câu 5–6 nói 15s, câu 7 nói 30s. Mặc định 15; giáo viên đặt 30 cho câu cuối
    // (bộ đề chuẩn ở bước 4 tự làm việc này).
    responseSeconds: 15,
    needsImage: false,
    needsAudio: true,
    needsRequiredWords: false,
    wordTarget: null,
    aspects: ["TK", "CT", "GR", "FL"],
    descriptors: levels([
      ["No response, or the answer has nothing to do with the question.", "Không trả lời, hoặc câu trả lời không liên quan đến câu hỏi."],
      ["Barely answers the question; very short or hard to understand.", "Hầu như không trả lời được câu hỏi; quá ngắn hoặc khó hiểu."],
      ["Answers the question, but the content is thin or the language has errors that sometimes get in the way.", "Trả lời được câu hỏi nhưng nội dung còn sơ sài hoặc lỗi ngôn ngữ đôi lúc gây khó hiểu."],
      ["Answers fully and directly in clear, correct language, with enough detail for the time allowed.", "Trả lời đầy đủ, trực tiếp, ngôn ngữ rõ và đúng, đủ ý trong thời gian cho phép."],
    ]),
  },
  "toeic.s.info": {
    key: "toeic.s.info",
    skill: "speaking",
    label: "Respond using information provided",
    shortLabel: "Use information",
    maxScore: 3,
    // Đề thật: 45s đọc tài liệu + 3s chuẩn bị sau khi nghe câu hỏi -> lưu 45 (phần đọc).
    prepSeconds: 45,
    // 15s cho câu 8–9, 30s cho câu 10 (giáo viên đặt 30 cho câu cuối).
    responseSeconds: 15,
    needsImage: true,
    needsAudio: true,
    needsRequiredWords: false,
    wordTarget: null,
    aspects: ["TK", "CT", "GR", "FL"],
    descriptors: levels([
      ["No response, or nothing that uses the information provided.", "Không trả lời, hoặc không dùng thông tin được cho."],
      ["Gives little or wrong information from the document; hard to understand.", "Nêu rất ít hoặc sai thông tin từ tài liệu; khó hiểu."],
      ["Gives some correct information from the document, but misses details or is unclear in places.", "Nêu được một phần thông tin đúng từ tài liệu nhưng thiếu chi tiết hoặc có chỗ chưa rõ."],
      ["Gives accurate, complete information from the document in a clear and well-paced answer.", "Nêu thông tin chính xác, đầy đủ từ tài liệu, trả lời rõ ràng và nhịp độ tốt."],
    ]),
  },
  "toeic.s.opinion": {
    key: "toeic.s.opinion",
    skill: "speaking",
    label: "Express an opinion",
    shortLabel: "Opinion",
    maxScore: 5,
    prepSeconds: 45,
    responseSeconds: 60,
    needsImage: false,
    needsAudio: false,
    needsRequiredWords: false,
    wordTarget: null,
    aspects: ["TK", "OR", "VO", "GR", "PN", "FL"],
    descriptors: levels([
      ["No response, or unrelated to the topic.", "Không trả lời, hoặc lạc đề."],
      ["Little relevant content; speech is very hard to follow.", "Ít nội dung liên quan; rất khó theo dõi."],
      ["States an opinion, but with little support; frequent errors or pauses make it effortful to follow.", "Nêu được quan điểm nhưng ít lý lẽ; lỗi hoặc ngập ngừng nhiều khiến người nghe vất vả."],
      ["Gives an opinion with some reasons; generally understandable, though ideas are loosely organized and language is limited.", "Nêu quan điểm kèm vài lý do; nhìn chung hiểu được nhưng ý chưa liên kết chặt và ngôn ngữ còn hạn chế."],
      ["Clear opinion with relevant reasons or examples; organized, with mostly accurate language and a steady pace.", "Quan điểm rõ, có lý do/ví dụ phù hợp; có tổ chức, ngôn ngữ phần lớn chính xác, nói đều."],
      ["Well-developed, convincing opinion with logical structure, varied and accurate language, and natural delivery.", "Quan điểm được phát triển tốt, thuyết phục, bố cục logic, ngôn ngữ đa dạng và chính xác, nói tự nhiên."],
    ]),
  },
  "toeic.w.picture": {
    key: "toeic.w.picture",
    skill: "writing",
    label: "Write a sentence based on a picture",
    shortLabel: "Picture sentence",
    maxScore: 3,
    prepSeconds: 0,
    // Đề thật: 8 phút cho cả 5 câu -> 480/5 = 96 giây mỗi câu.
    responseSeconds: 96,
    needsImage: true,
    needsAudio: false,
    needsRequiredWords: true,
    wordTarget: null,
    aspects: ["TK", "GR"],
    descriptors: levels([
      ["Blank, unrelated to the picture, or neither required word is used.", "Để trống, không liên quan đến ảnh, hoặc không dùng từ bắt buộc nào."],
      ["Does not use both required words, or the sentence is unclear or does not fit the picture.", "Không dùng đủ 2 từ bắt buộc, hoặc câu không rõ / không phù hợp với ảnh."],
      ["Uses both words and relates to the picture, but has grammar or word-choice errors.", "Dùng đủ 2 từ và liên quan đến ảnh nhưng còn lỗi ngữ pháp hoặc chọn từ."],
      ["One correct, well-formed sentence that uses both words and fits the picture.", "Một câu đúng, hoàn chỉnh, dùng đủ 2 từ và phù hợp với ảnh."],
    ]),
  },
  "toeic.w.email": {
    key: "toeic.w.email",
    skill: "writing",
    label: "Respond to a written request",
    shortLabel: "Email",
    maxScore: 4,
    prepSeconds: 0,
    responseSeconds: 600,
    needsImage: false,
    needsAudio: false,
    needsRequiredWords: false,
    wordTarget: null,
    aspects: ["TK", "OR", "VO", "GR"],
    descriptors: levels([
      ["Blank, copied from the prompt, or not in English / unrelated.", "Để trống, chép lại đề, hoặc không phải tiếng Anh / lạc đề."],
      ["Little relevant content; the message is hard to understand.", "Ít nội dung liên quan; khó hiểu."],
      ["Partly completes the request; some ideas are unclear or missing, with errors that sometimes get in the way.", "Hoàn thành một phần yêu cầu; vài ý chưa rõ hoặc thiếu, lỗi đôi lúc gây khó hiểu."],
      ["Completes the request in a mostly clear and organized message; minor errors do not block meaning.", "Hoàn thành yêu cầu, thư khá rõ và có tổ chức; lỗi nhỏ không cản trở ý nghĩa."],
      ["Fully completes every part of the request in a well-organized, polite message with varied, accurate language.", "Hoàn thành đủ mọi phần của yêu cầu, thư có tổ chức, lịch sự, ngôn ngữ đa dạng và chính xác."],
    ]),
  },
  "toeic.w.essay": {
    key: "toeic.w.essay",
    skill: "writing",
    label: "Write an opinion essay",
    shortLabel: "Essay",
    maxScore: 5,
    prepSeconds: 0,
    responseSeconds: 1800,
    needsImage: false,
    needsAudio: false,
    needsRequiredWords: false,
    wordTarget: 300,
    aspects: ["TK", "OR", "VO", "GR"],
    descriptors: levels([
      ["Blank, copied, or unrelated to the question.", "Để trống, chép lại, hoặc không liên quan đến câu hỏi."],
      ["Very little relevant content; hard to follow because of serious language problems.", "Rất ít nội dung liên quan; khó theo dõi do lỗi ngôn ngữ nghiêm trọng."],
      ["States an opinion but with weak support and loose organization; frequent errors affect clarity.", "Nêu quan điểm nhưng lý lẽ yếu, bố cục lỏng; lỗi thường xuyên làm giảm độ rõ."],
      ["Opinion with some relevant reasons or examples; understandable, though development, organization or language are uneven.", "Có quan điểm kèm một số lý do/ví dụ; hiểu được nhưng phát triển ý, bố cục hoặc ngôn ngữ chưa đều."],
      ["Well-supported opinion in an organized essay with generally accurate and varied language.", "Quan điểm được lập luận tốt trong bài có tổ chức, ngôn ngữ nhìn chung chính xác và đa dạng."],
      ["Fully developed, convincing essay with clear structure, apt examples and consistently accurate, varied language.", "Bài viết phát triển đầy đủ, thuyết phục, bố cục rõ, ví dụ phù hợp, ngôn ngữ luôn chính xác và đa dạng."],
    ]),
  },
};

const TOEIC_TASK_KEYS = Object.keys(TOEIC_TASKS);

function isToeicTaskType(v) {
  // hasOwnProperty để "constructor", "__proto__"... không lọt qua.
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(TOEIC_TASKS, v);
}

function toeicTask(key) {
  return isToeicTaskType(key) ? TOEIC_TASKS[key] : null;
}

function tasksForSkill(skill) {
  return TOEIC_TASK_KEYS.filter((k) => TOEIC_TASKS[k].skill === skill).map((k) => TOEIC_TASKS[k]);
}

// Thời gian hiệu lực của 1 đề: giá trị đề đặt, không có thì mặc định của dạng đề.
function effectivePrep(prompt) {
  if (prompt && prompt.prepSeconds != null) return prompt.prepSeconds;
  const t = toeicTask(prompt && prompt.taskType);
  return t ? t.prepSeconds : null;
}
function effectiveResponse(prompt) {
  if (prompt && prompt.responseSeconds != null) return prompt.responseSeconds;
  const t = toeicTask(prompt && prompt.taskType);
  return t ? t.responseSeconds : null;
}

// Field TOEIC thêm vào payload học sinh của 1 prompt (audioId đã populate cloudinaryUrl).
// Prompt IELTS (không taskType) -> {} : shape cũ {id,title,instructions,imageUrl} y nguyên.
function publicTaskFields(p) {
  if (!p || !p.taskType) return {};
  return {
    taskType: p.taskType,
    requiredWords: p.requiredWords || [],
    audioUrl: (p.audioId && p.audioId.cloudinaryUrl) || null,
    audioPlays: p.audioPlays || 1,
    prepSeconds: p.prepSeconds == null ? null : p.prepSeconds,
    responseSeconds: p.responseSeconds == null ? null : p.responseSeconds,
  };
}

module.exports = {
  publicTaskFields,
  ASPECT_LABELS,
  TOEIC_TASKS,
  TOEIC_TASK_KEYS,
  isToeicTaskType,
  toeicTask,
  tasksForSkill,
  effectivePrep,
  effectiveResponse,
};
