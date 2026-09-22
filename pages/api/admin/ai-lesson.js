// Soạn bài bằng AI (Gemini) theo các phần giáo viên tick:
//   kind="grammar" -> lý thuyết và/hoặc bài tập (lib/ai/grammarLesson.js)
//   kind="vocab"   -> bảng từ và/hoặc bài tập   (lib/ai/vocabLesson.js)
// Trả về bản nháp để giáo viên xem trước — KHÔNG ghi gì vào DB; giáo viên
// bấm thêm vào bài rồi Save như bình thường.

const { requireAuth } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const { connectDB } = require("../../../lib/db");
const { generateJSON, isEnabled } = require("../../../lib/gemini");
const { getGradingModels } = require("../../../lib/grading/aiModels");
const { lessonModels, CHECK_SYSTEM, CHECK_SCHEMA } = require("../../../lib/ai/common");
const { flagAiLog } = require("../../../lib/ai/aiLog");

// Mỗi module có cùng giao diện: parseInput, buildSchema, buildPrompt,
// normalizeTopic, buildCheckPrompt, checkQuestions, finalizeTopic, PURPOSE...
const MODULES = {
  grammar: require("../../../lib/ai/grammarLesson"),
  vocab: require("../../../lib/ai/vocabLesson"),
};

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!isEnabled()) {
    return res.status(503).json({ ok: false, error: "AI is not configured (GEMINI_API_KEY missing)" });
  }
  const body = req.body || {};
  const mod = MODULES[body.kind];
  if (!mod) return res.status(400).json({ ok: false, error: "Unknown lesson kind" });

  const { input, error } = mod.parseInput(body);
  if (error) return res.status(400).json({ ok: false, error });

  await connectDB();
  const models = lessonModels(await getGradingModels());

  const unitId = /^[a-f0-9]{24}$/i.test(String(body.unitId || "")) ? String(body.unitId) : "";
  const baseContext = {
    ...(unitId ? { unitId } : {}),
    unitName: input.unitName,
    level: input.level,
    studentLevel: input.studentLevel,
    language: input.language,
    ...mod.logContext(input),
  };
  const schema = mod.buildSchema(input);

  // Mỗi chủ đề 1 lần gọi, chạy song song — chủ đề nào lỗi thì vẫn trả các
  // chủ đề còn lại cho giáo viên.
  async function one(topic) {
    const { data, model, logId } = await generateJSON({
      systemInstruction: mod.SYSTEM,
      prompt: mod.buildPrompt(input, topic),
      schema,
      temperature: 0.4,
      thinkingBudget: mod.GEN_THINKING_BUDGET,
      models,
      log: {
        purpose: mod.PURPOSE,
        actor: req.auth,
        source: req.url,
        context: { ...baseContext, topics: [topic] },
      },
    });
    const t = mod.normalizeTopic(data, input, topic);
    if (!t) {
      await flagAiLog(logId, "No usable content in the AI response");
      throw new Error("The AI returned no usable content");
    }
    if (input.parts.includes("exercises") && !t.questions.length) {
      await flagAiLog(logId, "No valid exercise questions in the AI response");
    }

    // Lượt 2: giám khảo độc lập soát đáp án — lượt soạn vẫn lọt ~1–2/8 câu
    // sai hoặc có 2 lựa chọn đúng (đã test). Lượt này lỗi thì vẫn trả bài,
    // nhưng đánh dấu "chưa kiểm tra" để giáo viên soát kỹ.
    let questions = t.questions;
    let check = null;
    if (questions.length) {
      try {
        const { data: verdict, model: checkModel } = await generateJSON({
          systemInstruction: CHECK_SYSTEM,
          prompt: mod.buildCheckPrompt(questions, t),
          schema: CHECK_SCHEMA,
          temperature: 0,
          models,
          log: {
            purpose: `${mod.PURPOSE}.check`,
            actor: req.auth,
            source: req.url,
            context: { ...baseContext, topics: [topic], questions: questions.length },
          },
        });
        const r = mod.checkQuestions(questions, verdict, t);
        questions = r.kept;
        check = { verified: true, model: checkModel, removed: r.removed };
      } catch (e) {
        check = { verified: false, error: e.message };
      }
    }
    return { ...mod.finalizeTopic(t, questions, input), model, check };
  }

  const results = await Promise.allSettled(input.topics.map(one));
  const topics = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") topics.push(r.value);
    else failed.push({ topic: input.topics[i], error: r.reason && r.reason.message, code: r.reason && r.reason.code });
  });

  if (!topics.length) {
    const budget = failed.find((f) => f.code === "AI_BUDGET_EXCEEDED");
    if (!budget) console.error("[ai-lesson] all topics failed:", failed);
    return res.status(budget ? 429 : 502).json({
      ok: false,
      error: budget ? budget.error : `AI request failed: ${failed[0] ? failed[0].error : "unknown error"}`,
    });
  }
  return res.json({
    ok: true,
    topics,
    failed: failed.map(({ topic, error }) => ({ topic, error })),
    models: [...new Set(topics.map((t) => t.model))],
  });
}

module.exports = requireAuth(withTenant(handler));
module.exports.default = module.exports;
module.exports.config = { maxDuration: 60 };
