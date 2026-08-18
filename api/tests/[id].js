const { connectDB } = require("../../lib/db");
const Test = require("../../lib/models/Test");

// Strips answer keys before the test is sent to a student's browser. The
// match-options bank isn't secret — only which option is correct is.
function toPublicTest(test) {
  return {
    id: test._id,
    subject: test.subject,
    title: test.title,
    unit: test.unit,
    instructions: test.instructions,
    sections: (test.sections || []).map((s) => ({
      name: s.name,
      audioUrl: s.audioId && s.audioId.cloudinaryUrl,
      passageText: s.passageText || "",
      imageUrl: s.imageId && s.imageId.cloudinaryUrl,
      matchOptions: s.matchOptions || [],
      fields: (s.fields || []).map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        pre: f.pre,
        post: f.post,
        options: f.options,
        selectCount: f.selectCount || 1
      }))
    }))
  };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const { id } = req.query;

  let test;
  try {
    test = await Test.findOne({ _id: id, status: "published" })
      .populate("sections.audioId", "cloudinaryUrl")
      .populate("sections.imageId", "cloudinaryUrl");
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
  }
  if (!test) {
    return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
  }

  return res.status(200).json({ ok: true, test: toPublicTest(test) });
};
