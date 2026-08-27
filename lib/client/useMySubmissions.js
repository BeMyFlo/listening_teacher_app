"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useMySubmissions() {
  const [subs, setSubs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await api.student.mySubmissions();
      setSubs(d.rows || []);
    } catch {
      /* im lặng — tiến độ chỉ là phụ trợ */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subs, loaded, refresh };
}
