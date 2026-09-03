"use client";
// Placeholder cho các trang admin chưa dựng xong (phase sau).
export default function Soon({ title, note }) {
  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-settings" /></svg></div>
          <div>
            <h1>{title}</h1>
            <p className="page-sub">{note || "Coming soon."}</p>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="dash-empty">
          <span className="dash-empty-ico"><svg className="icon"><use href="#icon-clock" /></svg></span>
          <div><h4>Not ready yet</h4><p>This admin screen is being built. {note || ""}</p></div>
        </div>
      </div>
    </section>
  );
}
