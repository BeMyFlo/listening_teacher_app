// Gợi ý Vocab Review cho 1 skill (Reading / Listening) bằng AI (Gemini): đọc text
// bài tập giáo viên đang soạn (gửi lên từ editor, kể cả chưa Save) và đề xuất từ
// đáng học (lib/ai/vocabReview.js). Trả bản nháp để giáo viên xem trước — KHÔNG
// ghi gì vào DB; giáo viên bấm thêm vào danh sách rồi Save như bình thường.

const { requireAuth } = require("../../../lib/auth");
const { withTenant, assertOwned } = require("../../../lib/tenant");
const { connectDB } = require("../../../lib/db");
const { generateJSON, isEnabled } = require("../../../lib/gemini");
const { getGradingModels } = require("../../../lib/grading/aiModels");
const { lessonModels } = require("../../../lib/ai/common");
const Unit = require("../../../lib/models/Unit");
const mod = require("../../../lib/ai/vocabReview");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  // Workspace demo công khai: tắt AI để người lạ không tiêu ngân sách AI dùng chung.
  // if (req.ws.demo) {
  //   return res.status(403).json({ ok: false, error: "AI features are turned off in the demo workspace." });
  // }
  if (!isEnabled()) {
    return res.status(503).json({ ok: false, error: "AI is not configured (GEMINI_API_KEY missing)" });
  }
  const body = req.body || {};
  const { input, error } = mod.parseInput(body);
  if (error) return res.status(400).json({ ok: false, error });

  await connectDB();
  // unitId chỉ dùng để ghi log; nếu có thì phải là Unit của workspace này.
  const unitId = /^[a-f0-9]{24}$/i.test(String(body.unitId || "")) ? String(body.unitId) : "";
  if (unitId) await assertOwned(req.ws, Unit, unitId, { message: "Unit not found", lean: true });

  const models = lessonModels(await getGradingModels());
  let result;
  try {
    result = await generateJSON({
      systemInstruction: mod.systemFor(input.program),
      prompt: mod.buildPrompt(input),
      schema: mod.buildSchema(input),
      temperature: 0.3,
      thinkingBudget: mod.GEN_THINKING_BUDGET,
      models,
      log: {
        purpose: mod.PURPOSE,
        actor: req.auth,
        workspaceId: req.ws.workspaceId,
        source: req.url,
        context: {
          ...(unitId ? { unitId } : {}),
          unitName: input.unitName,
          studentLevel: input.studentLevel,
          language: input.language,
          ...(input.program && input.program !== "ielts" ? { program: input.program } : {}),
          ...mod.logContext(input),
        },
      },
    });
  } catch (e) {
    if (e.code === "AI_BUDGET_EXCEEDED") return res.status(429).json({ ok: false, error: e.message });
    console.error("[ai-vocab-review] failed:", e.message);
    return res.status(502).json({ ok: false, error: `AI request failed: ${e.message}` });
  }

  const { words, removed } = mod.normalizeResult(result.data, input);
  if (!words.length) {
    return res.status(502).json({
      ok: false,
      error: "The AI returned no usable words from this text — try again, or add the words by hand.",
    });
  }
  return res.json({ ok: true, words, removed, model: result.model });
}

module.exports = requireAuth(withTenant(handler));
module.exports.default = module.exports;
module.exports.config = { maxDuration: 60 };
