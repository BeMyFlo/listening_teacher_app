"use strict";

// MsNhi chat server — CHỈ làm fan-out realtime. Lưu tin nhắn / auth / upload
// đều do app Next.js (Vercel) lo. Server này:
//   - client kết nối kèm JWT -> verify -> join room "class:<id>" theo lớp của user
//   - app Next gọi POST /emit (kèm EMIT_SECRET) -> broadcast vào room
//
// KHÔNG chạy được trên Vercel (serverless). Deploy Railway / Render / Fly.
//
// Env: JWT_SECRET, MONGODB_URI, EMIT_SECRET, CLIENT_ORIGIN, PORT

require("dotenv").config();
const http = require("http");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const { JWT_SECRET, MONGODB_URI, EMIT_SECRET, CLIENT_ORIGIN, PORT = 4000 } = process.env;
for (const [k, v] of Object.entries({ JWT_SECRET, MONGODB_URI, EMIT_SECRET })) {
  if (!v) {
    console.error(`Missing env ${k}`);
    process.exit(1);
  }
}

// ---- Mongo: chỉ đọc lớp của user ----
const Student = mongoose.model(
  "Student",
  new mongoose.Schema({ classId: mongoose.Schema.Types.ObjectId }, { strict: false }),
  "students"
);
const Teacher = mongoose.model(
  "Teacher",
  new mongoose.Schema({ classIds: [mongoose.Schema.Types.ObjectId] }, { strict: false }),
  "teachers"
);
const Class = mongoose.model("Class", new mongoose.Schema({}, { strict: false }), "classes");

async function classIdsForUser(user) {
  if (user.role === "student") {
    const s = await Student.findById(user.id).select("classId").lean();
    return s && s.classId ? [String(s.classId)] : [];
  }
  if (user.role === "teacher") {
    const t = await Teacher.findById(user.id).select("classIds").lean();
    if (t && Array.isArray(t.classIds) && t.classIds.length) return t.classIds.map(String);
    // giáo viên chưa gán lớp -> vào tất cả
    const all = await Class.find().select("_id").lean();
    return all.map((c) => String(c._id));
  }
  return [];
}

// ---- HTTP + Socket.IO ----
const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN ? CLIENT_ORIGIN.split(",") : "*", methods: ["GET", "POST"] },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const p = jwt.verify(String(token || ""), JWT_SECRET);
    const id = p.studentId || p.teacherId;
    if (!id || !p.role) return next(new Error("bad token"));
    socket.data.user = { id: String(id), role: p.role, name: p.name || "" };
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", async (socket) => {
  const { user } = socket.data;
  try {
    const ids = await classIdsForUser(user);
    ids.forEach((cid) => socket.join("class:" + cid));
    socket.emit("ready", { classIds: ids });
  } catch (e) {
    console.error("join error", e.message);
  }
});

// App Next gọi để phát tin
app.post("/emit", (req, res) => {
  if (req.get("x-emit-secret") !== EMIT_SECRET) return res.status(403).json({ ok: false });
  const { classId, event, payload } = req.body || {};
  if (!classId || !event) return res.status(400).json({ ok: false });
  io.to("class:" + String(classId)).emit(event, payload);
  res.json({ ok: true });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`chat-server on :${PORT}`));
  })
  .catch((e) => {
    console.error("mongo connect failed", e.message);
    process.exit(1);
  });
