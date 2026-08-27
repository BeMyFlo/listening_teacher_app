"use client";

import { useEffect, useReducer } from "react";

// Badge đếm trên sidebar (số Unit, số bài chờ chấm…) — trang Overview gọi
// setBadge(href, value, warn); Shell đọc qua useShellBadges().
let badges = {};
const listeners = new Set();

export function setBadge(href, value, warn = false) {
  badges = { ...badges, [href]: { value, warn } };
  listeners.forEach((l) => l());
}

export function useShellBadges() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => listeners.delete(force);
  }, []);
  return badges;
}
