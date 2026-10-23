// Dựng runAiGrade với mọi phụ thuộc (DB, Gemini, fetch) được thay bằng bản giả — không mạng,
// không MongoDB. Dùng chung cho tests/toeicGrade.test.js (ghim request IELTS + chạy nhánh TOEIC).
const path = require("node:path");

function stub(rel, exports) {
  const file = require.resolve(path.join(__dirname, "..", "..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// Mongoose chain giả: findById(...).select(...).populate(...).lean() -> doc
const chain = (doc) => {
  const c = { select: () => c, populate: () => c, lean: async () => doc };
  return c;
};

let singleton = null;

// runAiGrade được require một lần (cache) nên state dùng chung; mỗi lần gọi createHarness() reset lại.
function createHarness() {
  if (singleton) {
    Object.assign(singleton.state, { submission: null, unit: null, test: null, raw: null, calls: [], flagged: [] });
    return singleton;
  }
  const state = { submission: null, unit: null, test: null, raw: null, calls: [], flagged: [] };

  stub("lib/models/Submission.js", { findById: () => chain(state.submission) });
  stub("lib/models/Unit.js", { findById: () => chain(state.unit) });
  stub("lib/models/Test.js", { findById: () => chain(state.test) });
  stub("lib/ai/aiLog.js", { flagAiLog: async (id, msg) => state.flagged.push([id, msg]), recordAiCall: async () => {} });
  stub("lib/grading/aiModels.js", { getGradingModels: async () => ["stub-model"] });
  stub("lib/gemini.js", {
    generateJSON: async (args) => {
      state.calls.push(args);
      return { data: state.raw, model: "stub-model", logId: "log1" };
    },
  });
  global.fetch = async (url) => ({
    ok: true,
    headers: { get: () => "image/png" },
    arrayBuffer: async () => Buffer.from("BYTES:" + url),
  });

  const { runAiGrade } = require("../../lib/grading/runAiGrade");
  singleton = { state, runAiGrade };
  return singleton;
}

// Phần request không phụ thuộc dữ liệu nhị phân (bỏ base64 của audio/ảnh, giữ mimeType).
function requestShape(call) {
  return {
    systemInstruction: call.systemInstruction,
    prompt: call.prompt,
    schema: call.schema,
    image: call.image ? { mimeType: call.image.mimeType, hasData: !!call.image.base64 } : null,
    audio: call.audio ? { mimeType: call.audio.mimeType, hasData: !!call.audio.base64 } : null,
    models: call.models,
    purpose: call.log && call.log.purpose,
  };
}

module.exports = { createHarness, requestShape };
