"use client";

// Chương trình (IELTS / TOEIC) workspace đang dùng — PLAN-PHASE8-TOEIC.md 3.5, C2.
//
// Server suy ra từ dữ liệu (Lớp + Unit + Test) và trả qua /api/teacher/me.
// Store module-level nhỏ: nhiều component trên cùng một trang dùng chung 1
// request; refresh() tải lại rồi báo cho mọi nơi đang đăng ký. KHÔNG có React
// context, KHÔNG lưu localStorage — bộ lọc chương trình nằm trên URL (?program=).
//
// Lỗi (mạng, 401...) -> coi như workspace chỉ có IELTS (isMulti=false), tức là
// giao diện y hệt trước Phase 8.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { getTeacherToken } from "./session";
import { DEFAULT_PROGRAM, isProgram } from "../curriculum";
import { levelLabel as fmtLevelLabel, levelNameOf, namedLevelsOf } from "../levelNames";

const NO_NAMES = Object.freeze([]);
const FALLBACK = Object.freeze({ programs: Object.freeze([DEFAULT_PROGRAM]), isMulti: false, loaded: false, levelNames: NO_NAMES });
const STALE_MS = 30 * 1000;

let state = FALLBACK;
let fetchedAt = 0;
let cacheToken = null; // token giáo viên của lần tải gần nhất — đổi tài khoản thì bỏ cache
let inflight = null;
const listeners = new Set();

function emit(next) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function fromResponse(d) {
  const list = Array.isArray(d && d.programs) ? d.programs.filter(isProgram) : [];
  const programs = list.length ? list : [DEFAULT_PROGRAM];
  // Tên level theo chương trình (xem lib/levelNames.js). Thiếu/sai -> không có tên -> nhãn "Level N" như cũ.
  const levelNames = Array.isArray(d && d.levelNames)
    ? d.levelNames.filter((x) => x && isProgram(x.program) && Number.isInteger(x.level) && typeof x.name === "string" && x.name)
    : NO_NAMES;
  return { programs, isMulti: programs.length >= 2, loaded: true, levelNames };
}

// Tải (hoặc dùng chung request đang bay). force=true luôn tải lại.
function load(force) {
  const token = getTeacherToken();
  if (token !== cacheToken) {
    // Đổi tài khoản/workspace trong cùng tab: không dùng lại dữ liệu cũ.
    cacheToken = token;
    fetchedAt = 0;
    if (state !== FALLBACK) emit(FALLBACK);
  }
  if (inflight) return inflight;
  if (!force && state.loaded && Date.now() - fetchedAt < STALE_MS) return Promise.resolve(state);
  inflight = api.teacher
    .me()
    .then((d) => fromResponse(d))
    .catch(() => ({ ...FALLBACK, loaded: true }))
    .then((next) => {
      fetchedAt = Date.now();
      // Tránh render lại khi kết quả không đổi.
      if (
        !state.loaded ||
        state.isMulti !== next.isMulti ||
        state.programs.join(",") !== next.programs.join(",") ||
        JSON.stringify(state.levelNames) !== JSON.stringify(next.levelNames)
      ) {
        emit(next);
      }
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function refreshPrograms() {
  return load(true);
}

export function usePrograms() {
  const snap = useSyncExternalStore(subscribe, () => state, () => FALLBACK);
  useEffect(() => {
    load(false);
  }, []);
  const refresh = useCallback(() => load(true), []);
  const levelNames = snap.levelNames;
  // Nhãn level: "Level 1 · Band 3.5–5.0", hoặc "Level 1" khi chưa đặt tên.
  const levelLabel = useCallback((program, level) => fmtLevelLabel(levelNames, program, level), [levelNames]);
  const levelName = useCallback((program, level) => levelNameOf(levelNames, program, level), [levelNames]);
  const namedLevels = useCallback((program) => namedLevelsOf(levelNames, program), [levelNames]);
  return { programs: snap.programs, isMulti: snap.isMulti, loaded: snap.loaded, refresh, levelNames, levelLabel, levelName, namedLevels };
}

// Đọc `?program=` từ URLSearchParams / ReadonlyURLSearchParams -> "ielts" | "toeic" | null (All).
export function programParam(search) {
  const v = search && typeof search.get === "function" ? search.get("program") : null;
  return isProgram(v) ? v : null;
}
