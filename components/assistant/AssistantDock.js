"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { readSession } from "@/lib/client/session";
import { unitProgress } from "@/lib/student/submissions";
import { buildStudentHome } from "@/lib/student/dashboard";
import AssistantMascot from "./AssistantMascot";

const NOTIF_POLL_MS = 60000;
const GRADING_POLL_MS = 120000;
const PEEK_DURATION_MS = 6000;
const PEEK_STORAGE_KEY = "asst-last-peek";
const MIN_STORAGE_KEY = "asst-min";
// Không có gì mới và không ai đụng tới bot trong khoảng này -> bot ngủ gật.
const SLEEP_AFTER_MS = 90000;

function timeAgoVi(d) {
  if (!d) return "";
  const ts = new Date(d).getTime();
  if (Number.isNaN(ts)) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} ngày trước`;
  return new Date(ts).toLocaleDateString("vi-VN");
}

function getFirstName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "bạn";
  if (parts.length === 2 && /^(cô|thầy|ms\.?|mr\.?|mrs\.?)$/i.test(parts[0])) {
    return parts.join(" ");
  }
  return parts[parts.length - 1];
}

export default function AssistantDock({ role }) {
  const isAllowedRole = role === "teacher" || role === "student";
  const router = useRouter();
  const pathname = usePathname();
  const dockRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [firstName, setFirstName] = useState("bạn");
  const [hover, setHover] = useState(false);
  const [sleepy, setSleepy] = useState(false);
  const [lastActivity, setLastActivity] = useState(0);

  // Thông báo chung (student & teacher)
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [freshUnreadIds, setFreshUnreadIds] = useState(() => new Set());

  // Bong bóng "peek"
  const [peek, setPeek] = useState(null); // { id, text }
  const prevUnreadRef = useRef(0);
  const firstNotifPollRef = useRef(false);

  // Changelog ("Có gì mới")
  const [changelogEntries, setChangelogEntries] = useState(null);
  const changelogShownRef = useRef(false);

  // Student: Bài đang làm (units + submissions)
  const [studentUnits, setStudentUnits] = useState(null);
  const [studentSubs, setStudentSubs] = useState(null);
  const studentWorkLoadedRef = useRef(false);
  const studentWorkLoadingRef = useRef(false);

  // Teacher: Cần chấm điểm + Gửi thông báo cho lớp
  const [gradingData, setGradingData] = useState(null);
  const prevGradingCountRef = useRef(0);
  const firstGradingPollRef = useRef(false);

  // Panel giáo viên chia 2 tab: "inbox" (thông báo mới) | "compose" (gửi cho lớp)
  const [teacherTab, setTeacherTab] = useState("inbox");
  const [classes, setClasses] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annSending, setAnnSending] = useState(false);
  const [annStatus, setAnnStatus] = useState(null); // { tone: "success"|"error", text }
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const teacherComposerLoadedRef = useRef(false);

  const feed = role === "teacher" ? api.teacher : role === "student" ? api.student : null;

  // Ngủ gật sau SLEEP_AFTER_MS không tương tác; rê chuột / có tin mới là tỉnh.
  useEffect(() => {
    setSleepy(false);
    const t = setTimeout(() => setSleepy(true), SLEEP_AFTER_MS);
    return () => clearTimeout(t);
  }, [lastActivity, open, unread]);

  // Đọc tên người dùng + trạng thái thu gọn
  useEffect(() => {
    if (!isAllowedRole) return;
    const sess = readSession(role);
    setFirstName(getFirstName(sess && sess.name));
    try {
      if (localStorage.getItem(MIN_STORAGE_KEY) === "1") {
        setMinimised(true);
      }
    } catch {}
  }, [role, isAllowedRole]);

  // Hàm bật bong bóng peek (mỗi item chỉ hiện tối đa 1 lần trong sessionStorage)
  const triggerPeek = useCallback((id, text) => {
    if (!id || !text) return;
    let lastId = null;
    try {
      lastId = sessionStorage.getItem(PEEK_STORAGE_KEY);
    } catch {}
    if (lastId === id) return;
    try {
      sessionStorage.setItem(PEEK_STORAGE_KEY, id);
    } catch {}
    setPeek({ id, text });
  }, []);

  // Tự tắt peek sau ~6 giây
  useEffect(() => {
    if (!peek) return;
    const timer = setTimeout(() => setPeek(null), PEEK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [peek]);

  // Tải thông báo (60s + khi đổi pathname)
  const loadNotifications = useCallback(() => {
    if (!feed) return;
    feed
      .notifications()
      .then((d) => {
        const list = d.rows || [];
        const unreadFromRows = list.filter((n) => !n.read).length;
        const nextUnread = Math.max(d.unreadCount || 0, unreadFromRows);

        setRows(list);
        setUnread(nextUnread);

        const isFirst = !firstNotifPollRef.current;
        firstNotifPollRef.current = true;
        const increased = nextUnread > prevUnreadRef.current;
        prevUnreadRef.current = nextUnread;

        if ((isFirst && nextUnread > 0) || increased) {
          const newest = list.find((n) => !n.read) || list[0];
          if (newest) {
            const peekId = `notif:${newest._id || newest.id || newest.createdAt || newest.title}`;
            const peekText =
              newest.type === "teacher_announcement" && newest.senderName
                ? `${newest.senderName}: ${newest.title}`
                : newest.title;
            triggerPeek(peekId, peekText);
          }
        }
      })
      .catch(() => {});
  }, [feed, triggerPeek]);

  useEffect(() => {
    if (!feed) return;
    loadNotifications();
    const id = setInterval(loadNotifications, NOTIF_POLL_MS);
    return () => clearInterval(id);
  }, [feed, loadNotifications, pathname]);

  // Kiểm tra Changelog 1 lần khi mount
  useEffect(() => {
    if (!isAllowedRole) return;
    api.changelog
      .check(role)
      .then((d) => {
        if (d.unseen && d.entries && d.entries.length) {
          setChangelogEntries(d.entries);
        }
      })
      .catch(() => {});
  }, [role, isAllowedRole]);

  // Khi panel đang mở và có phần "Có gì mới", ghi nhận đã hiển thị để lúc đóng tự markSeen
  useEffect(() => {
    if (open && changelogEntries && changelogEntries.length > 0) {
      changelogShownRef.current = true;
    }
  }, [open, changelogEntries]);

  // Student: tải danh sách unit + bài nộp (lười: sau 2s khi mount và khi mở panel lần đầu)
  const loadStudentWork = useCallback(() => {
    if (role !== "student" || studentWorkLoadedRef.current || studentWorkLoadingRef.current) return;
    studentWorkLoadingRef.current = true;
    Promise.all([
      api.student.listUnits().catch(() => ({ rows: [] })),
      api.student.mySubmissions().catch(() => ({ rows: [] })),
    ])
      .then(([uRes, sRes]) => {
        setStudentUnits(uRes.rows || []);
        setStudentSubs(sRes.rows || []);
        studentWorkLoadedRef.current = true;
      })
      .finally(() => {
        studentWorkLoadingRef.current = false;
      });
  }, [role]);

  useEffect(() => {
    if (role !== "student") return;
    const t = setTimeout(loadStudentWork, 2000);
    return () => clearTimeout(t);
  }, [role, loadStudentWork]);

  // Teacher: tải hàng đợi chấm điểm khi mount + mỗi 120s
  const loadGradingQueue = useCallback(() => {
    if (role !== "teacher") return;
    api.teacher
      .gradingQueue()
      .then((d) => {
        setGradingData(d);
        const count = (d && d.rows && d.rows.length) || 0;
        const isFirst = !firstGradingPollRef.current;
        firstGradingPollRef.current = true;
        const increased = count > prevGradingCountRef.current;
        prevGradingCountRef.current = count;

        if (((isFirst && count > 0) || increased) && prevUnreadRef.current === 0) {
          const topId = d.rows?.[0]?._id || count;
          triggerPeek(`grading:${count}:${topId}`, `Bạn có ${count} bài cần chấm`);
        }
      })
      .catch(() => {});
  }, [role, triggerPeek]);

  useEffect(() => {
    if (role !== "teacher") return;
    loadGradingQueue();
    const id = setInterval(loadGradingQueue, GRADING_POLL_MS);
    return () => clearInterval(id);
  }, [role, loadGradingQueue]);

  // Teacher: tải danh sách lớp + lịch sử thông báo đã gửi khi mở panel
  const loadTeacherAnnouncements = useCallback(() => {
    if (role !== "teacher" || typeof api.teacher.announcements !== "function") return;
    api.teacher
      .announcements()
      .then((d) => setRecentAnnouncements(d.rows || []))
      .catch(() => {});
  }, [role]);

  const loadTeacherComposerData = useCallback(() => {
    if (role !== "teacher") return;
    if (!teacherComposerLoadedRef.current) {
      teacherComposerLoadedRef.current = true;
      api.teacher
        .listClasses()
        .then((d) => setClasses(d.rows || []))
        .catch(() => {});
    }
    loadTeacherAnnouncements();
  }, [role, loadTeacherAnnouncements]);

  // Đóng panel (và tự động đánh dấu đã xem changelog nếu mục đó đã hiện)
  const closePanel = useCallback(() => {
    setOpen(false);
    if (changelogShownRef.current && changelogEntries && changelogEntries.length > 0) {
      changelogShownRef.current = false;
      setChangelogEntries(null);
      api.changelog.markSeen(role).catch(() => {});
    }
  }, [changelogEntries, role]);

  // Mở panel (đánh dấu đã đọc thông báo giống NotificationBell)
  const openPanel = useCallback(() => {
    setPeek(null);
    setOpen(true);
    if (role === "student") {
      loadStudentWork();
    } else if (role === "teacher") {
      loadTeacherComposerData();
    }
    if (unread > 0 && feed) {
      const currentUnreadIds = new Set(
        rows.filter((n) => !n.read).map((n) => n._id || n.id)
      );
      setFreshUnreadIds(currentUnreadIds);
      setUnread(0);
      prevUnreadRef.current = 0;
      setRows((prev) => prev.map((n) => ({ ...n, read: true })));
      feed.markNotifications({ markAllRead: true }).catch(() => {});
    }
  }, [role, loadStudentWork, loadTeacherComposerData, unread, feed, rows]);

  function togglePanel(e) {
    if (e) e.stopPropagation();
    if (open) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function handleMinimise(e) {
    if (e) e.stopPropagation();
    closePanel();
    setMinimised(true);
    try {
      localStorage.setItem(MIN_STORAGE_KEY, "1");
    } catch {}
  }

  function handleRestoreFromMin(e) {
    if (e) e.stopPropagation();
    setMinimised(false);
    try {
      localStorage.removeItem(MIN_STORAGE_KEY);
    } catch {}
    openPanel();
  }

  function handleMarkChangelogSeen(e) {
    if (e) e.stopPropagation();
    changelogShownRef.current = false;
    setChangelogEntries(null);
    api.changelog.markSeen(role).catch(() => {});
  }

  // Đóng khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (dockRef.current && !dockRef.current.contains(e.target)) {
        closePanel();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closePanel]);

  // Ẩn (×) thông báo: 1 cái hoặc cả mục. Lạc quan — bỏ khỏi danh sách ngay.
  function dismissNotifs(ids) {
    const set = new Set(ids.map(String));
    if (!set.size || !feed) return;
    setRows((prev) => prev.filter((n) => !set.has(String(n._id || n.id))));
    feed.markNotifications({ dismiss: true, ids: [...set] }).catch(() => loadNotifications());
  }

  // Chuyển trang từ dòng trong panel
  function navigateTo(dest) {
    closePanel();
    if (dest) router.push(dest);
  }

  function openNotificationItem(n) {
    const dest =
      n.link ||
      (n.unitId
        ? role === "student"
          ? "/student/lessons/" + n.unitId
          : "/teacher/lessons/" + n.unitId
        : "");
    navigateTo(dest);
  }

  // --- Dữ liệu các mục của HỌC SINH ---
  const studentAnnouncements = useMemo(
    () => (role === "student" ? rows.filter((n) => n.type === "teacher_announcement") : []),
    [role, rows]
  );

  const studentOtherNotifs = useMemo(
    () => (role === "student" ? rows.filter((n) => n.type !== "teacher_announcement") : []),
    [role, rows]
  );

  const studentWorkItems = useMemo(() => {
    if (role !== "student" || !studentUnits || !studentSubs) return [];
    const items = [];
    const seenHrefs = new Set();

    // Các unit đang làm dở (0 < pct < 100)
    for (const u of studentUnits) {
      const p = unitProgress(u, studentSubs);
      if (p.pct > 0 && p.pct < 100) {
        const href = `/student/lessons/${u.id}`;
        seenHrefs.add(href);
        items.push({
          id: `unit-${u.id}`,
          name: u.name,
          pct: p.pct,
          completed: p.completed,
          totalItems: p.totalItems,
          isOverdue: Boolean(u.isOverdue),
          tone: u.isOverdue ? "danger" : "",
          href,
        });
      }
    }

    // Bổ sung các việc quá hạn từ buildStudentHome (tone === "danger") nếu chưa có trong danh sách
    const home = buildStudentHome({ units: studentUnits, subs: studentSubs });
    for (const todo of home.todos || []) {
      if (todo.tone === "danger" && !seenHrefs.has(todo.href)) {
        seenHrefs.add(todo.href);
        const matchUnit = studentUnits.find((u) => `/student/lessons/${u.id}` === todo.href);
        const p = matchUnit ? unitProgress(matchUnit, studentSubs) : null;
        items.unshift({
          id: `todo-${todo.href}`,
          name: matchUnit ? matchUnit.name : todo.title,
          pct: p ? p.pct : 0,
          completed: p ? p.completed : 0,
          totalItems: p ? p.totalItems : 0,
          subtitle: todo.subtitle,
          isOverdue: true,
          tone: "danger",
          href: todo.href,
        });
      }
    }

    return items;
  }, [role, studentUnits, studentSubs]);

  // --- Dữ liệu các mục của GIÁO VIÊN ---
  const gradingRows = useMemo(() => (gradingData && gradingData.rows) || [], [gradingData]);

  function toggleClassChip(classId) {
    const idStr = String(classId);
    setSelectedClassIds((prev) =>
      prev.includes(idStr) ? prev.filter((x) => x !== idStr) : [...prev, idStr]
    );
    setAnnStatus(null);
  }

  async function handleSendAnnouncement(e) {
    e.preventDefault();
    if (!selectedClassIds.length || !annTitle.trim() || annSending) return;
    if (typeof api.teacher.sendAnnouncement !== "function") {
      setAnnStatus({ tone: "error", text: "Chức năng gửi thông báo đang được cập nhật." });
      return;
    }
    setAnnSending(true);
    setAnnStatus(null);
    try {
      const res = await api.teacher.sendAnnouncement({
        classIds: selectedClassIds,
        title: annTitle.trim(),
        body: annBody.trim(),
      });
      const count = res && res.recipients != null ? res.recipients : 0;
      setAnnStatus({ tone: "success", text: `Đã gửi tới ${count} học sinh` });
      setAnnTitle("");
      setAnnBody("");
      loadTeacherAnnouncements();
    } catch (err) {
      setAnnStatus({
        tone: "error",
        text: (err && err.message) || "Không thể gửi thông báo. Vui lòng thử lại.",
      });
    } finally {
      setAnnSending(false);
    }
  }

  if (!isAllowedRole) return null;

  const hasChangelog = Boolean(changelogEntries && changelogEntries.length > 0);
  const changelogBulletCount = hasChangelog
    ? changelogEntries.reduce((sum, e) => sum + ((e.items && e.items.length) || 0), 0)
    : 0;

  // Badge: tổng số chưa đọc (notifications + announcements + 1 nếu có changelog mới)
  // hoặc nhãn "NEW" khi chỉ có duy nhất changelog là mới.
  const totalUnreadBadge = unread + (hasChangelog ? 1 : 0);
  const showNewSticker = unread === 0 && hasChangelog;

  // Tư thế + biểu cảm của bot theo trạng thái (ảnh ở public/assistant/).
  const hasNews = totalUnreadBadge > 0 || Boolean(peek);
  const [mascotPose, mascotExpr] = open
    ? ["idle", "happy"]
    : hasNews
    ? ["greet", "excited"]
    : hover
    ? ["idle", "happy"]
    : sleepy
    ? ["idle", "sleepy"]
    : ["idle", "neutral"];

  const isNotifRowUnread = (n) => !n.read || freshUnreadIds.has(n._id || n.id);

  const studentAllEmpty =
    role === "student" &&
    studentAnnouncements.length === 0 &&
    studentWorkItems.length === 0 &&
    studentOtherNotifs.length === 0 &&
    !hasChangelog;

  const teacherFeedsEmpty =
    role === "teacher" &&
    gradingRows.length === 0 &&
    rows.length === 0 &&
    !hasChangelog;

  return (
    <div
      ref={dockRef}
      className={
        "asst-dock" +
        (open ? " is-open" : "") +
        (minimised ? " is-minimised" : "")
      }
    >
      {/* Panel thông báo mở phía trên mascot */}
      {open && (
        <div className="asst-panel" role="dialog" aria-label="Trợ lý thông báo">
          <div className="asst-panel-head">
            <div className="asst-panel-greet">
              <span className="asst-panel-avatar">
                <AssistantMascot pose="read" expression="neutral" size={44} />
              </span>
              <div className="asst-panel-greet-text">
                <strong>Xin chào, {firstName}!</strong>
                <span>
                  {role === "teacher"
                    ? "Trợ lý quản lý lớp học"
                    : "Trợ lý học tập của bạn"}
                </span>
              </div>
            </div>
            <div className="asst-panel-actions">
              <button
                type="button"
                className="asst-head-btn"
                title="Thu gọn trợ lý"
                aria-label="Thu gọn trợ lý"
                onClick={handleMinimise}
              >
                <svg className="icon"><use href="#icon-chevron-down" /></svg>
              </button>
              <button
                type="button"
                className="asst-head-btn"
                title="Đóng"
                aria-label="Đóng"
                onClick={closePanel}
              >
                <svg className="icon"><use href="#icon-cross" /></svg>
              </button>
            </div>
          </div>

          {role === "teacher" && (
            <div className="asst-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={teacherTab === "inbox"}
                className={"asst-tab" + (teacherTab === "inbox" ? " active" : "")}
                onClick={() => setTeacherTab("inbox")}
              >
                <svg className="icon"><use href="#icon-bell" /></svg>
                Thông báo mới
                {gradingRows.length + rows.length > 0 && (
                  <span className="asst-tab-count">{gradingRows.length + rows.length}</span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={teacherTab === "compose"}
                className={"asst-tab" + (teacherTab === "compose" ? " active" : "")}
                onClick={() => setTeacherTab("compose")}
              >
                <svg className="icon"><use href="#icon-send" /></svg>
                Gửi thông báo
              </button>
            </div>
          )}

          <div className="asst-panel-body">
            {/* ==================== GIAO DIỆN HỌC SINH ==================== */}
            {role === "student" && (
              <>
                {studentAllEmpty && (
                  <div className="asst-empty">
                    <AssistantMascot pose="celebrate" expression="happy" size={88} />
                    <p>Mọi thứ đều ổn — không có gì mới!</p>
                  </div>
                )}

                {/* 1. Từ giáo viên */}
                {studentAnnouncements.length > 0 && (
                  <section className="asst-sec">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-accent">
                        <svg className="icon"><use href="#icon-speaker" /></svg>
                      </span>
                      <h4>Từ giáo viên</h4>
                      <span className="asst-sec-count">{studentAnnouncements.length}</span>
                      <button
                        type="button"
                        className="asst-sec-clear"
                        onClick={() => dismissNotifs(studentAnnouncements.map((n) => n._id || n.id))}
                      >
                        Xóa hết
                      </button>
                    </div>
                    <div className="asst-sec-list">
                      {studentAnnouncements.map((n) => (
                        <div key={n._id || n.id} className="asst-row-wrap">
                          <button
                            type="button"
                            className={"asst-row" + (isNotifRowUnread(n) ? " unread" : "")}
                            onClick={() => openNotificationItem(n)}
                          >
                          <div className="asst-row-top">
                            <span className="asst-sender-pill">
                              {n.senderName || "Giáo viên"}
                            </span>
                            <span className="asst-row-time">{timeAgoVi(n.createdAt)}</span>
                          </div>
                          <div className="asst-row-title">{n.title}</div>
                          {n.body && <div className="asst-row-body">{n.body}</div>}
                          </button>
                          <button
                            type="button"
                            className="asst-row-x"
                            title="Xóa thông báo này"
                            aria-label="Xóa thông báo này"
                            onClick={() => dismissNotifs([n._id || n.id])}
                          >
                            <svg className="icon"><use href="#icon-cross" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 2. Bài đang làm */}
                {studentWorkItems.length > 0 && (
                  <section className="asst-sec">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-mint">
                        <svg className="icon"><use href="#icon-book-open" /></svg>
                      </span>
                      <h4>Bài đang làm</h4>
                      <span className="asst-sec-count">{studentWorkItems.length}</span>
                    </div>
                    <div className="asst-sec-list">
                      {studentWorkItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={
                            "asst-row asst-work-row" +
                            (item.tone === "danger" ? " tone-danger" : "")
                          }
                          onClick={() => navigateTo(item.href)}
                        >
                          <div className="asst-row-top">
                            <span className="asst-row-title">{item.name}</span>
                            {item.isOverdue && (
                              <span className="asst-tag asst-tag-danger">Quá hạn</span>
                            )}
                          </div>
                          <div className="asst-work-progress">
                            <div className="progress-bar">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${item.pct}%`,
                                  background:
                                    item.tone === "danger" ? "var(--red)" : undefined,
                                }}
                              />
                            </div>
                            <span className="asst-work-ratio">
                              {item.totalItems > 0
                                ? `${item.completed}/${item.totalItems}`
                                : item.subtitle || `${item.pct}%`}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Thông báo */}
                {studentOtherNotifs.length > 0 && (
                  <section className="asst-sec">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-navy">
                        <svg className="icon"><use href="#icon-bell" /></svg>
                      </span>
                      <h4>Thông báo</h4>
                      <span className="asst-sec-count">{studentOtherNotifs.length}</span>
                      <button
                        type="button"
                        className="asst-sec-clear"
                        onClick={() => dismissNotifs(studentOtherNotifs.map((n) => n._id || n.id))}
                      >
                        Xóa hết
                      </button>
                    </div>
                    <div className="asst-sec-list">
                      {studentOtherNotifs.map((n) => (
                        <div key={n._id || n.id} className="asst-row-wrap">
                          <button
                            type="button"
                            className={"asst-row" + (isNotifRowUnread(n) ? " unread" : "")}
                            onClick={() => openNotificationItem(n)}
                          >
                          <div className="asst-row-top">
                            <span className="asst-row-title">{n.title}</span>
                            <span className="asst-row-time">{timeAgoVi(n.createdAt)}</span>
                          </div>
                          {n.body && <div className="asst-row-body">{n.body}</div>}
                          </button>
                          <button
                            type="button"
                            className="asst-row-x"
                            title="Xóa thông báo này"
                            aria-label="Xóa thông báo này"
                            onClick={() => dismissNotifs([n._id || n.id])}
                          >
                            <svg className="icon"><use href="#icon-cross" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Có gì mới */}
                {hasChangelog && (
                  <section className="asst-sec asst-sec-changelog">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-accent">
                        <svg className="icon"><use href="#icon-sparkles" /></svg>
                      </span>
                      <h4>Có gì mới</h4>
                      <span className="asst-sec-count">{changelogBulletCount}</span>
                    </div>
                    <div className="asst-changelog-box">
                      {changelogEntries.map((entry) => (
                        <div key={entry.version} className="asst-changelog-entry">
                          {changelogEntries.length > 1 && (
                            <div className="asst-changelog-date">{entry.date}</div>
                          )}
                          <ul>
                            {(entry.items || []).map((txt, idx) => (
                              <li key={idx}>{txt}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="asst-changelog-btn"
                        onClick={handleMarkChangelogSeen}
                      >
                        <svg className="icon"><use href="#icon-check" /></svg> Đã xem
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ==================== GIAO DIỆN GIÁO VIÊN ==================== */}
            {role === "teacher" && teacherTab === "inbox" && (
              <>
                {teacherFeedsEmpty && (
                  <div className="asst-empty">
                    <AssistantMascot pose="celebrate" expression="happy" size={88} />
                    <p>Mọi thứ đều ổn — không có gì mới!</p>
                  </div>
                )}

                {/* 1. Cần chấm điểm */}
                {gradingRows.length > 0 && (
                  <section className="asst-sec">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-accent">
                        <svg className="icon"><use href="#icon-writing" /></svg>
                      </span>
                      <h4>Cần chấm điểm</h4>
                      <span className="asst-sec-count">{gradingRows.length}</span>
                    </div>
                    <div className="asst-sec-list">
                      {gradingRows.slice(0, 5).map((r) => {
                        const skillLabel = r.kind === "speaking" ? "Speaking" : "Writing";
                        const dest =
                          r.href ||
                          (r.unitId
                            ? `/teacher/lessons/${r.unitId}/submissions/${r.studentId}`
                            : `/teacher/tests/${r.testId}/submissions/${r.studentId}?tab=${r.testSkill || r.kind || ""}`);
                        return (
                          <button
                            key={r._id}
                            type="button"
                            className="asst-row"
                            onClick={() => navigateTo(dest)}
                          >
                            <div className="asst-row-top">
                              <span className="asst-row-title">{r.studentName}</span>
                              <span className="asst-row-time">{timeAgoVi(r.submittedAt)}</span>
                            </div>
                            <div className="asst-row-meta">
                              <span className="asst-tag asst-tag-mint">{skillLabel}</span>
                              <span className="asst-row-where">
                                {r.where}
                                {r.promptTitle ? ` · ${r.promptTitle}` : ""}
                              </span>
                              {r.isLate && (
                                <span className="asst-tag asst-tag-danger">Trễ hạn</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="asst-sec-foot"
                      onClick={() => navigateTo("/teacher/grading")}
                    >
                      Xem tất cả ({gradingRows.length}) →
                    </button>
                  </section>
                )}

                {/* 2. Thông báo */}
                {rows.length > 0 && (
                  <section className="asst-sec">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-navy">
                        <svg className="icon"><use href="#icon-bell" /></svg>
                      </span>
                      <h4>Thông báo</h4>
                      <span className="asst-sec-count">{rows.length}</span>
                      <button
                        type="button"
                        className="asst-sec-clear"
                        onClick={() => dismissNotifs(rows.map((n) => n._id || n.id))}
                      >
                        Xóa hết
                      </button>
                    </div>
                    <div className="asst-sec-list">
                      {rows.map((n) => (
                        <div key={n._id || n.id} className="asst-row-wrap">
                          <button
                            type="button"
                            className={"asst-row" + (isNotifRowUnread(n) ? " unread" : "")}
                            onClick={() => openNotificationItem(n)}
                          >
                          <div className="asst-row-top">
                            <span className="asst-row-title">{n.title}</span>
                            <span className="asst-row-time">{timeAgoVi(n.createdAt)}</span>
                          </div>
                          {n.body && <div className="asst-row-body">{n.body}</div>}
                          </button>
                          <button
                            type="button"
                            className="asst-row-x"
                            title="Xóa thông báo này"
                            aria-label="Xóa thông báo này"
                            onClick={() => dismissNotifs([n._id || n.id])}
                          >
                            <svg className="icon"><use href="#icon-cross" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Có gì mới */}
                {hasChangelog && (
                  <section className="asst-sec asst-sec-changelog">
                    <div className="asst-sec-head">
                      <span className="asst-sec-ico tone-accent">
                        <svg className="icon"><use href="#icon-sparkles" /></svg>
                      </span>
                      <h4>Có gì mới</h4>
                      <span className="asst-sec-count">{changelogBulletCount}</span>
                    </div>
                    <div className="asst-changelog-box">
                      {changelogEntries.map((entry) => (
                        <div key={entry.version} className="asst-changelog-entry">
                          {changelogEntries.length > 1 && (
                            <div className="asst-changelog-date">{entry.date}</div>
                          )}
                          <ul>
                            {(entry.items || []).map((txt, idx) => (
                              <li key={idx}>{txt}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="asst-changelog-btn"
                        onClick={handleMarkChangelogSeen}
                      >
                        <svg className="icon"><use href="#icon-check" /></svg> Đã xem
                      </button>
                    </div>
                  </section>
                )}

              </>
            )}

            {role === "teacher" && teacherTab === "compose" && (
              <>
                {/* Gửi thông báo cho lớp */}
                <section className="asst-sec asst-sec-compose">
                  <div className="asst-sec-head">
                    <span className="asst-sec-ico tone-mint">
                      <svg className="icon"><use href="#icon-send" /></svg>
                    </span>
                    <h4>Gửi thông báo cho lớp</h4>
                    {classes.length > 0 && (
                      <span className="asst-sec-count">{classes.length} lớp</span>
                    )}
                  </div>

                  <form className="asst-compose-form" onSubmit={handleSendAnnouncement}>
                    <div className="asst-chip-label">Chọn lớp nhận thông báo:</div>
                    {classes.length === 0 ? (
                      <div className="asst-compose-empty">Chưa có lớp học nào.</div>
                    ) : (
                      <div className="asst-chips">
                        {classes.map((c) => {
                          const idStr = String(c._id);
                          const active = selectedClassIds.includes(idStr);
                          return (
                            <button
                              key={idStr}
                              type="button"
                              className={"asst-chip" + (active ? " active" : "")}
                              onClick={() => toggleClassChip(idStr)}
                            >
                              <span>{c.name}</span>
                              {c.studentCount != null && (
                                <small>({c.studentCount})</small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <input
                      type="text"
                      className="asst-input"
                      placeholder="Tiêu đề thông báo (tối đa 120 ký tự)"
                      maxLength={120}
                      value={annTitle}
                      onChange={(e) => {
                        setAnnTitle(e.target.value);
                        if (annStatus) setAnnStatus(null);
                      }}
                    />

                    <textarea
                      className="asst-textarea"
                      rows={3}
                      placeholder="Nội dung nhắn gửi tới học sinh (tối đa 1000 ký tự)..."
                      maxLength={1000}
                      value={annBody}
                      onChange={(e) => setAnnBody(e.target.value)}
                    />

                    {annStatus && (
                      <div className={`asst-compose-msg tone-${annStatus.tone}`}>
                        {annStatus.tone === "success" && (
                          <AssistantMascot pose="celebrate" expression="love" size={40} />
                        )}
                        <span>{annStatus.text}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn asst-send-btn"
                      disabled={
                        selectedClassIds.length === 0 ||
                        !annTitle.trim() ||
                        annSending
                      }
                    >
                      <svg className="icon"><use href="#icon-send" /></svg>{" "}
                      {annSending ? "Đang gửi..." : "Gửi thông báo"}
                    </button>
                  </form>

                  {recentAnnouncements.length > 0 && (
                    <div className="asst-recent-ann">
                      <div className="asst-recent-head">Đã gửi gần đây</div>
                      <div className="asst-recent-list">
                        {recentAnnouncements.slice(0, 5).map((a) => (
                          <div
                            key={a.announcementId || a._id || a.createdAt}
                            className="asst-recent-item"
                          >
                            <div className="asst-recent-title">{a.title}</div>
                            <div className="asst-recent-meta">
                              <span>{timeAgoVi(a.createdAt)}</span>
                              <span className="asst-recent-read">
                                đã đọc {a.readCount ?? 0}/{a.recipients ?? 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bong bóng thoại "peek" hiện ~6s khi có thông báo mới */}
      {!open && peek && (
        <div
          className="asst-peek"
          role="status"
          onClick={openPanel}
          title="Bấm để mở bảng thông báo"
        >
          <span className="asst-peek-text">{peek.text}</span>
          <button
            type="button"
            className="asst-peek-close"
            aria-label="Đóng thông báo nhanh"
            onClick={(e) => {
              e.stopPropagation();
              setPeek(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Nút thu gọn hoặc nút Mascot chính */}
      {minimised && !open ? (
        <button
          type="button"
          className="asst-min-btn"
          title="Mở trợ lý thông báo"
          aria-label="Mở trợ lý thông báo"
          onClick={handleRestoreFromMin}
        >
          <img src="/logo.png" alt="" className="asst-min-logo" />
          {showNewSticker ? (
            <span className="asst-badge asst-badge-new">NEW</span>
          ) : (
            totalUnreadBadge > 0 && (
              <span className="asst-badge">
                {totalUnreadBadge > 99 ? "99+" : totalUnreadBadge}
              </span>
            )
          )}
        </button>
      ) : (
        <button
          type="button"
          className="asst-mascot-btn"
          title="Trợ lý thông báo"
          aria-label="Trợ lý thông báo"
          aria-expanded={open}
          onClick={togglePanel}
          onMouseEnter={() => {
            setHover(true);
            setLastActivity(Date.now());
          }}
          onMouseLeave={() => setHover(false)}
        >
          <AssistantMascot pose={mascotPose} expression={mascotExpr} size={96} boxAspect={0.96} />
          {showNewSticker ? (
            <span className="asst-badge asst-badge-new">NEW</span>
          ) : (
            totalUnreadBadge > 0 && (
              <span className="asst-badge">
                {totalUnreadBadge > 99 ? "99+" : totalUnreadBadge}
              </span>
            )
          )}
        </button>
      )}
    </div>
  );
}
