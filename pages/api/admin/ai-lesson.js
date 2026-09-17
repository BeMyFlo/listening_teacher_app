// Soạn lý thuyết bài học bằng AI (Gemini). Hiện hỗ trợ kind="grammar".
// Trả về bản nháp để giáo viên xem trước — KHÔNG ghi gì vào DB; giáo viên
// bấm thêm vào bài rồi Save như bình thường.

const { requireAuth } = require("../../../lib/auth");
const { connectDB } = require("../../../lib/db");
const { generateJSON, isEnabled } = require("../../../lib/gemini");
const { getGradingModels } = require("../../../lib/grading/aiModels");
const grammar = require("../../../lib/ai/grammarLesson");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!isEnabled()) {
    return res.status(503).json({ ok: false, error: "AI is not configured (GEMINI_API_KEY missing)" });
  }
  const body = req.body || {};
  if (body.kind !== "grammar") {
    return res.status(400).json({ ok: false, error: "Only grammar theory is supported for now" });
  }

  const { input, error } = grammar.parseInput(body);
  if (error) return res.status(400).json({ ok: false, error });

  await connectDB();
  const models = grammar.lessonModels(await getGradingModels());

  try {
    const { data, model } = await generateJSON({
      systemInstruction: grammar.SYSTEM,
      prompt: grammar.buildPrompt(input),
      schema: grammar.SCHEMA,
      temperature: 0.4,
      models,
    });
    const topics = grammar.normalizeTopics(data);
    if (!topics.length) {
      return res.status(502).json({ ok: false, error: "The AI returned no usable content — please try again." });
    }
    return res.json({ ok: true, topics, model });
  } catch (e) {
    console.error("[ai-lesson]", e);
    return res.status(502).json({ ok: false, error: e.message || "AI request failed" });
  }
}

module.exports = requireAuth(handler);
module.exports.default = module.exports;
module.exports.config = { maxDuration: 60 };
