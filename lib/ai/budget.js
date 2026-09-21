// Giới hạn tiền AI mỗi tháng. Trước mỗi lần gọi LLM: đã tiêu >= giới hạn thì
// chặn, giáo viên thấy thông báo liên hệ admin; admin nâng giới hạn ở
// /admin/system là dùng tiếp được ngay. Tháng tính theo giờ Việt Nam, tự sang
// tháng mới là bộ đếm về 0.
// Có thể vượt giới hạn 1 chút: kiểm tra xảy ra TRƯỚC lần gọi, và nhiều lần
// gọi cùng lúc đều có thể lọt qua khi còn sát mép.

const mongoose = require("mongoose");
const AppSetting = require("../models/AppSetting");
const AiSpend = require("../models/AiSpend");
const { DEFAULT_PRICES, sanitizePrices, computeCost } = require("./pricing");

const SETTINGS_KEY = "aiBudget";
const DEFAULT_USD_TO_VND = 26000;
const TZ = "Asia/Ho_Chi_Minh";

const dbReady = () => mongoose.connection && mongoose.connection.readyState === 1;

function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}`;
}

async function getAiBudgetSettings() {
  const doc = await AppSetting.findOne({ key: SETTINGS_KEY }).lean();
  const overrides = sanitizePrices(doc && doc.aiPrices);
  const limit = doc ? doc.aiMonthlyLimitUsd : null;
  return {
    monthlyLimitUsd: Number.isFinite(limit) && limit >= 0 ? limit : null,
    usdToVnd: doc && doc.aiUsdToVnd > 0 ? doc.aiUsdToVnd : DEFAULT_USD_TO_VND,
    prices: { ...DEFAULT_PRICES, ...overrides },
    overrides,
  };
}

// monthlyLimitUsd: số >= 0, hoặc null/"" = không giới hạn.
async function saveAiBudgetSettings({ monthlyLimitUsd, usdToVnd, prices }) {
  const $set = { updatedAt: new Date() };
  if (monthlyLimitUsd !== undefined) {
    if (monthlyLimitUsd === null || monthlyLimitUsd === "") $set.aiMonthlyLimitUsd = null;
    else {
      const n = Number(monthlyLimitUsd);
      if (!Number.isFinite(n) || n < 0) {
        const e = new Error("Monthly limit must be a number ≥ 0 (or empty for no limit)");
        e.status = 400;
        throw e;
      }
      $set.aiMonthlyLimitUsd = Math.round(n * 100) / 100;
    }
  }
  if (usdToVnd !== undefined) {
    const n = Number(usdToVnd);
    if (!Number.isFinite(n) || n <= 0) {
      const e = new Error("Exchange rate must be a positive number");
      e.status = 400;
      throw e;
    }
    $set.aiUsdToVnd = Math.round(n);
  }
  if (prices !== undefined) {
    // Chỉ lưu dòng khác giá mặc định — giá mặc định sau này cập nhật trong
    // code thì vẫn tự áp dụng cho các model admin không sửa.
    const clean = sanitizePrices(prices);
    const diff = {};
    for (const [id, p] of Object.entries(clean)) {
      const d = DEFAULT_PRICES[id];
      if (!d || d.input !== p.input || d.audio !== p.audio || d.output !== p.output) diff[id] = p;
    }
    $set.aiPrices = diff;
  }
  await AppSetting.findOneAndUpdate({ key: SETTINGS_KEY }, { $set }, { upsert: true });
  return getAiBudgetSettings();
}

async function getMonthSpend(key = monthKey()) {
  const doc = await AiSpend.findById(key).lean();
  return { month: key, costUsd: (doc && doc.costUsd) || 0, calls: (doc && doc.calls) || 0, blocked: (doc && doc.blocked) || 0 };
}

function budgetError(spentUsd, limitUsd) {
  const e = new Error(
    `This month's AI budget is used up ($${spentUsd.toFixed(2)} of $${limitUsd.toFixed(2)}). ` +
      "Please contact the admin to raise the limit."
  );
  e.code = "AI_BUDGET_EXCEEDED";
  e.status = 429;
  return e;
}

// Trả { allowed, spentUsd, limitUsd, settings }. Không kết nối được DB (vd
// script chạy tay) thì cho qua — không có dữ liệu để chặn.
async function checkBudget() {
  const open = { allowed: true, spentUsd: 0, limitUsd: null, settings: null };
  if (!dbReady()) return open;
  try {
    const settings = await getAiBudgetSettings();
    if (settings.monthlyLimitUsd == null) return { ...open, settings };
    const { costUsd } = await getMonthSpend();
    return { allowed: costUsd < settings.monthlyLimitUsd, spentUsd: costUsd, limitUsd: settings.monthlyLimitUsd, settings };
  } catch (e) {
    // Đọc DB lỗi thoáng qua thì cho chạy tiếp, không làm hỏng việc chấm bài.
    console.error("[ai-budget] check failed, allowing call:", e.message);
    return open;
  }
}

// Tính tiền 1 lần gọi + cộng vào tổng tháng. Không bao giờ throw.
async function chargeUsage(model, usage, settings) {
  const prices = settings ? settings.prices : DEFAULT_PRICES;
  const { costUsd, priced } = computeCost(model, usage, prices);
  if (dbReady() && usage) {
    try {
      await AiSpend.updateOne(
        { _id: monthKey() },
        { $inc: { costUsd, calls: 1 }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error("[ai-budget] could not record spend:", e.message);
    }
  }
  return { costUsd, priced };
}

async function countBlocked() {
  if (!dbReady()) return;
  try {
    await AiSpend.updateOne({ _id: monthKey() }, { $inc: { blocked: 1 }, $set: { updatedAt: new Date() } }, { upsert: true });
  } catch (e) {
    console.error("[ai-budget] could not count blocked call:", e.message);
  }
}

module.exports = {
  DEFAULT_USD_TO_VND,
  monthKey,
  getAiBudgetSettings,
  saveAiBudgetSettings,
  getMonthSpend,
  checkBudget,
  chargeUsage,
  countBlocked,
  budgetError,
};
