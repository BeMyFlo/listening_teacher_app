// Câu hỏi Reflection Log — cố định theo kind, giáo viên không cấu hình được.
const REFLECTION_QUESTIONS = {
  speaking: [
    { key: "mistake", label: "Lỗi/điểm yếu mà em mắc nhiều nhất khi nói", type: "text" },
    { key: "focusTags", label: "Từ vựng / cách phát âm cần luyện thêm", type: "tags" },
    { key: "nextAction", label: "Ở lần ghi âm sau, em sẽ...", type: "text" },
  ],
  writing: [
    { key: "mistake", label: "Lỗi mà em sai nhiều nhất trong bài", type: "text" },
    { key: "focusTags", label: "Từ vựng cần thiết", type: "tags" },
    { key: "nextAction", label: "Ở bài viết sau, em sẽ...", type: "text" },
  ],
};

function getReflectionQuestions(kind) {
  return REFLECTION_QUESTIONS[kind] || [];
}

module.exports = { REFLECTION_QUESTIONS, getReflectionQuestions };
