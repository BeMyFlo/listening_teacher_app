# MsNhi chat-server

Realtime fan-out cho group chat theo lớp. **Không deploy được lên Vercel** (serverless,
không giữ websocket). Deploy lên **Railway** (khuyến nghị, luôn chạy, ~$5/tháng) hoặc
**Render** / **Fly.io** (free — Render ngủ sau 15 phút không dùng, lần kết nối đầu chậm,
nhưng app có cơ chế polling dự phòng).

## Chạy local

```bash
cd chat-server
cp .env.example .env   # điền JWT_SECRET, MONGODB_URI (giống Vercel), tự sinh EMIT_SECRET
npm install
npm run dev
```

## Deploy (Railway)

1. New Project → Deploy from GitHub repo → chọn repo, **Root Directory = `chat-server`**.
2. Variables: `JWT_SECRET`, `MONGODB_URI` (giống hệt Vercel), `EMIT_SECRET` (tự sinh),
   `CLIENT_ORIGIN` = `https://ieltswithnhi.vercel.app`. (Railway tự set `PORT`.)
3. Sau khi có domain (vd `msnhi-chat.up.railway.app`), thêm trên **Vercel**:
   - `CHAT_SERVER_URL` = `https://msnhi-chat.up.railway.app`
   - `NEXT_PUBLIC_CHAT_SERVER_URL` = `https://msnhi-chat.up.railway.app`
   - `EMIT_SECRET` = (giống chat-server)
   rồi Redeploy.

## API

| | |
|---|---|
| `GET /health` | uptime check |
| `POST /emit` | header `x-emit-secret`; body `{ classId, event, payload }` — app Next gọi để phát |
| WebSocket | client kết nối `io(url, { auth: { token } })`; nhận event `message`, `message-deleted` |
