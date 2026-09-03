"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { CardHead } from "@/components/dash/DashKit";

function mb(bytes) {
  if (bytes == null) return "—";
  const m = bytes / (1024 * 1024);
  return m >= 1024 ? (m / 1024).toFixed(2) + " GB" : m.toFixed(1) + " MB";
}
function Bar({ used, total, tone }) {
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct > 85 ? "var(--red)" : pct > 60 ? "var(--amber)" : "var(--green)";
  return (
    <div>
      <div className="progress-bar" style={{ height: 10 }}>
        <div className="progress-bar-fill" style={{ width: pct + "%", background: tone || color }} />
      </div>
      <div style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: 4 }}>
        {mb(used)} {total ? `of ${mb(total)} (${pct}%)` : ""}
      </div>
    </div>
  );
}

export default function AdminStoragePage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.admin.storage().then(setData).catch((e) => setErr(e.message));
  }, []);

  const cl = data?.cloudinary;

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-chart-bar" /></svg></div>
          <div>
            <h1>Database & Storage</h1>
            <p className="page-sub">Usage across MongoDB and Cloudinary. Read-only — cleanup tools come later.</p>
          </div>
        </div>
      </div>

      {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}
      {!data && !err && <div className="notice info">Loading…</div>}

      {data && (
        <>
          <div className="dash-row-2">
            <div className="card">
              <CardHead icon="chart-bar" title={`MongoDB — ${data.db.name}`} />
              <p style={{ margin: "4px 0 10px", fontWeight: 700 }}>Data + indexes</p>
              <Bar used={data.db.dataSize + data.db.indexSize} total={data.db.limitBytes} />
              <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap", fontSize: ".85rem" }}>
                <div><b>{data.db.objects.toLocaleString()}</b><div style={{ color: "var(--muted)" }}>documents</div></div>
                <div><b>{mb(data.db.dataSize)}</b><div style={{ color: "var(--muted)" }}>data</div></div>
                <div><b>{mb(data.db.indexSize)}</b><div style={{ color: "var(--muted)" }}>indexes</div></div>
                <div><b>{mb(data.db.storageSize)}</b><div style={{ color: "var(--muted)" }}>on disk</div></div>
              </div>
            </div>

            <div className="card">
              <CardHead icon="image" title="Cloudinary" />
              {!cl ? (
                <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>Not configured.</p>
              ) : cl.error ? (
                <p style={{ color: "var(--red)", fontSize: ".9rem" }}>{cl.error}</p>
              ) : (
                <>
                  <p style={{ margin: "4px 0 6px", fontWeight: 700 }}>Storage</p>
                  <Bar used={cl.storage?.usage} total={cl.storage?.limit} tone="var(--blue)" />
                  <p style={{ margin: "12px 0 6px", fontWeight: 700 }}>Bandwidth (this cycle)</p>
                  <Bar used={cl.bandwidth?.usage} total={cl.bandwidth?.limit} tone="var(--purple)" />
                  <div style={{ fontSize: ".82rem", color: "var(--muted)", marginTop: 10 }}>
                    {cl.resources ?? "—"} assets · {cl.derived_resources ?? "—"} derived · plan: {cl.plan || "—"}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <CardHead icon="list" title="Collections" />
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead><tr><th>Collection</th><th>Docs</th><th>Data</th><th>Indexes</th><th>Avg doc</th></tr></thead>
                <tbody>
                  {data.collections.map((c) => (
                    <tr key={c.name}>
                      <td><b>{c.name}</b></td>
                      <td>{c.count.toLocaleString()}</td>
                      <td>{mb(c.size)}</td>
                      <td>{mb(c.totalIndexSize)}</td>
                      <td>{c.avgObjSize ? (c.avgObjSize / 1024).toFixed(1) + " KB" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <CardHead icon="warning" title="Orphaned data (informational)" />
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: ".9rem" }}>
              <div><b>{data.orphans.submissions.toLocaleString()}</b><div style={{ color: "var(--muted)" }}>submissions from deleted students</div></div>
              <div><b>{data.media.audio}</b><div style={{ color: "var(--muted)" }}>audio library items</div></div>
              <div><b>{data.media.images}</b><div style={{ color: "var(--muted)" }}>image library items</div></div>
            </div>
            <p style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: 10 }}>Cleanup actions will be added in a later update.</p>
          </div>
        </>
      )}
    </section>
  );
}
