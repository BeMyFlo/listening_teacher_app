"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import TicketDialog from "./TicketDialog";
import { KIND_LABEL, STATUS_LABEL, STATUS_PILL, timeAgo } from "./ticketMeta";

// Trang "Support" cho học sinh / giáo viên. role = "student" | "teacher".
export default function ReporterTickets({ role }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("id");

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [active, setActive] = useState(null); // ticket đầy đủ
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef(null);

  const loadList = useCallback(() => {
    api.tickets
      .mine(role)
      .then((d) => setRows(d.rows || []))
      .catch((e) => setErr(e.message));
  }, [role]);

  useEffect(loadList, [loadList]);

  useEffect(() => {
    if (!openId) {
      setActive(null);
      return;
    }
    api.tickets
      .get(role, openId)
      .then((d) => setActive(d.ticket))
      .catch((e) => setErr(e.message));
  }, [role, openId]);

  useEffect(() => {
    if (active && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [active]);

  function open(id) {
    router.push(pathname + "?id=" + id);
  }
  function back() {
    router.push(pathname);
    loadList();
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const d = await api.tickets.reply(role, active._id, { body: reply.trim() });
      setActive(d.ticket);
      setReply("");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  // ---- Chi tiết 1 phiếu ----
  if (active) {
    return (
      <section>
        <button type="button" className="back-link" onClick={back}>
          <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to tickets
        </button>
        <div className="page-head" style={{ marginTop: 8 }}>
          <div className="head-left">
            <div>
              <h1 style={{ marginBottom: 4 }}>{active.title}</h1>
              <p className="page-sub">
                <span className={"pill " + STATUS_PILL[active.status]}>{STATUS_LABEL[active.status]}</span>{" "}
                <span className="pill pill-muted">{KIND_LABEL[active.kind]}</span>{" "}
                opened {timeAgo(active.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {err && <div className="notice error">{err}</div>}

        <div className="card tkt-thread" ref={threadRef}>
          <Bubble
            msg={{ authorRole: role, authorName: "You", body: active.body, images: active.images, createdAt: active.createdAt }}
            me={role}
          />
          {active.messages.map((m) => (
            <Bubble key={m._id} msg={m} me={role} />
          ))}
          {active.status === "resolved" && (
            <p className="tkt-sys">This ticket was marked resolved. Reply to reopen it.</p>
          )}
        </div>

        <form className="tkt-reply" onSubmit={sendReply}>
          <textarea
            rows={2}
            placeholder="Add a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button type="submit" className="btn" disabled={busy || !reply.trim()}>
            <svg className="icon"><use href="#icon-send" /></svg> Send
          </button>
        </form>
      </section>
    );
  }

  // ---- Danh sách ----
  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-inbox" /></svg></div>
          <div>
            <h1>Support</h1>
            <p className="page-sub">Report a bug or request a feature. We&apos;ll reply here.</p>
          </div>
        </div>
        <button type="button" className="btn" onClick={() => setShowNew(true)}>
          <svg className="icon"><use href="#icon-plus" /></svg> New ticket
        </button>
      </div>

      {err && <div className="notice error">{err}</div>}
      {!rows && !err && <div className="notice info">Loading…</div>}

      {rows && rows.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          No tickets yet. Hit “New ticket” or the help button to send your first one.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Type</th><th>Status</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r._id}
                  className={"tkt-row" + (r.reporterUnread ? " unread" : "")}
                  onClick={() => open(r._id)}
                >
                  <td>
                    {r.reporterUnread && <span className="tkt-dot" />}
                    {r.title}
                    {r.replies > 0 && <span className="tkt-count"> · {r.replies} repl{r.replies === 1 ? "y" : "ies"}</span>}
                  </td>
                  <td>{KIND_LABEL[r.kind]}</td>
                  <td><span className={"pill " + STATUS_PILL[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{timeAgo(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <TicketDialog
          role={role}
          pageUrl=""
          onClose={() => setShowNew(false)}
          onCreated={(t) => {
            setShowNew(false);
            open(t._id);
          }}
        />
      )}
    </section>
  );
}

function Bubble({ msg, me }) {
  const mine = msg.authorRole === me;
  const who =
    msg.authorRole === "admin" ? "Support" : mine ? "You" : msg.authorName || msg.authorRole;
  return (
    <div className={"tkt-bubble" + (mine ? " mine" : "")}>
      <div className="tkt-bubble-head">
        <b>{who}</b> <span>{timeAgo(msg.createdAt)}</span>
      </div>
      {msg.body && <div className="tkt-bubble-body">{msg.body}</div>}
      {msg.images && msg.images.length > 0 && (
        <div className="tkt-shots">
          {msg.images.map((im) => (
            <a className="tkt-shot" key={im.url} href={im.url} target="_blank" rel="noreferrer">
              <img src={im.url} alt="" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
