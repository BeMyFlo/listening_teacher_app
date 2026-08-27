"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

// Tải danh sách audio + image 1 lần cho các <select> trong editor và cho
// widget đặt pin (cần URL ảnh).
export function useMediaLibraries() {
  const [audio, setAudio] = useState([]);
  const [images, setImages] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.teacher.listAudio().catch(() => ({ rows: [] })),
      api.teacher.listImages().catch(() => ({ rows: [] })),
    ]).then(([a, i]) => {
      setAudio(a.rows || []);
      setImages(i.rows || []);
      setLoaded(true);
    });
  }, []);

  return { audio, images, loaded };
}
