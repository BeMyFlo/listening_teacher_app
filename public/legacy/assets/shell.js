// ============================================================
//  DASHBOARD SHELL — sidebar + topbar dùng chung cho
//  teacher.html và student.html (Phase 2).
//  Shell chỉ render khung điều hướng; việc chuyển panel/step
//  vẫn do teacher.js / student.js quyết định qua onNavigate(key).
// ============================================================
const Shell = (function () {
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    const last = parts[parts.length - 1] || "?";
    return last.slice(0, 2);
  }

  /**
   * mount({
   *   root:        phần tử .app-shell (chứa <aside class="sidebar"> và <header class="topbar-v2">)
   *   navGroups:   [{ label: "MAIN", items: [{ key, label, icon, badge?, badgeWarn? }] }, ...]
   *   activeKey:   key đang active
   *   userName:    tên hiển thị
   *   roleLabel:   "GIÁO VIÊN" | "HỌC SINH" ...
   *   userSub:     dòng phụ dưới tên (vd "Administrator", "Level 1")
   *   promo:       { title, text } — thẻ khuyến khích nhỏ cuối sidebar (tuỳ chọn)
   *   onNavigate:  (key) => void
   *   onLogout:    () => void
   *   searchPlaceholder: placeholder ô search (trang trí)
   * })
   * Trả về { setActive(key), setBadge(key, value, warn) }
   */
  function mount(opts) {
    const root = opts.root;
    const sidebar = root.querySelector(".sidebar");
    const topbar = root.querySelector(".topbar-v2");

    // ---------- Sidebar ----------
    let html =
      '<div class="sidebar-brand"><div class="logo">' + Icon("student") + '</div><span class="brand-text">IELTS with Ms Nhi</span>' +
      '<button type="button" class="sidebar-collapse-btn" title="Toggle navigation sidebar">' + Icon("arrow-left") + "</button></div>";

    (opts.navGroups || []).forEach((group) => {
      html += '<div class="sidebar-group">';
      if (group.label) html += '<div class="sidebar-group-label">' + escapeHtml(group.label) + "</div>";
      (group.items || []).forEach((item) => {
        const badgeVal = item.badge != null ? String(item.badge) : "";
        const badge =
          '<span class="sidebar-badge' + (item.badgeWarn ? " warn" : "") + '" data-badge="' + escapeHtml(item.key) + '"' +
          (badgeVal ? "" : ' style="display:none"') + ">" + escapeHtml(badgeVal) + "</span>";
        html +=
          '<button type="button" class="sidebar-link" data-nav="' + escapeHtml(item.key) + '">' +
          Icon(item.icon || "home") +
          '<span class="link-label">' + escapeHtml(item.label) + "</span>" +
          badge +
          "</button>";
      });
      html += "</div>";
    });

    if (opts.promo) {
      html +=
        '<div class="sidebar-promo">' +
        Icon("sparkles", "sidebar-promo-icon") +
        '<div class="sidebar-promo-title">' + escapeHtml(opts.promo.title || "") + "</div>" +
        '<div class="sidebar-promo-text">' + escapeHtml(opts.promo.text || "") + "</div>" +
        "</div>";
    }

    html +=
      '<div class="sidebar-user">' +
      '<div class="avatar">' + escapeHtml(initials(opts.userName)) + "</div>" +
      '<div class="user-meta"><div class="user-name">' + escapeHtml(opts.userName || "") + "</div>" +
      '<div class="user-role">' + escapeHtml(opts.userSub || opts.roleLabel || "") + "</div></div>" +
      '<button type="button" class="icon-btn" data-action="logout" title="Log out">' + Icon("logout") + "</button>" +
      "</div>";

    sidebar.innerHTML = html;

    // Lớp phủ tối phía sau sidebar khi nó trượt ra dạng drawer trên điện
    // thoại (xem @media max-width:680px trong style.css) — bấm vào để đóng.
    let backdrop = root.querySelector(".sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "sidebar-backdrop";
      root.insertBefore(backdrop, sidebar);
    }

    // ---------- Topbar ----------
    topbar.innerHTML =
      '<button type="button" class="icon-btn topbar-menu-btn" data-action="toggle-sidebar" title="Toggle navigation sidebar">' + Icon("menu") + "</button>" +
      '<div class="topbar-search">' + Icon("search") +
      '<input type="text" placeholder="' + escapeHtml(opts.searchPlaceholder || "Search...") + '" readonly />' +
      '<span class="kbd-hint">Ctrl K</span>' +
      "</div>" +
      '<button type="button" class="icon-btn topbar-bell" title="Notifications">' + Icon("bell") + '<span class="notify-dot"></span></button>' +
      '<div class="topbar-user" data-action="toggle-user-menu">' +
      '<div class="avatar avatar-sm">' + escapeHtml(initials(opts.userName)) + "</div>" +
      '<div class="topbar-user-meta">' +
      '<span class="role-pill">' + escapeHtml(opts.roleLabel || "") + "</span>" +
      '<span class="name">' + escapeHtml(opts.userName || "") + "</span>" +
      "</div>" +
      Icon("chevron-down", "topbar-user-chevron") +
      '<div class="topbar-user-menu" id="topbarUserMenu">' +
      '<button type="button" class="topbar-user-menu-item" data-action="logout">' + Icon("logout") + " Log out</button>" +
      "</div>" +
      "</div>";

    // ---------- Listeners ----------
    function setActive(key) {
      sidebar.querySelectorAll(".sidebar-link").forEach((l) => {
        l.classList.toggle("active", l.dataset.nav === key);
      });
    }

    const isMobileDrawer = () => window.matchMedia("(max-width: 680px)").matches;

    sidebar.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActive(btn.dataset.nav);
        if (opts.onNavigate) opts.onNavigate(btn.dataset.nav);
        // Trên điện thoại, ".collapsed" nghĩa là drawer đang mở đè lên nội
        // dung — chọn xong mục nào thì tự đóng lại. Trên desktop ".collapsed"
        // lại có nghĩa khác (thu gọn còn icon, do người dùng chủ động bật),
        // nên không được tự tắt ở đó.
        if (isMobileDrawer()) root.classList.remove("collapsed");
      });
    });

    function doLogout() {
      if (opts.onLogout) opts.onLogout();
    }
    const logoutBtn = sidebar.querySelector('[data-action="logout"]');
    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
    const topbarLogoutBtn = topbar.querySelector('.topbar-user-menu [data-action="logout"]');
    if (topbarLogoutBtn) topbarLogoutBtn.addEventListener("click", doLogout);

    function toggleSidebar() { root.classList.toggle("collapsed"); }
    const collapseBtn = sidebar.querySelector(".sidebar-collapse-btn");
    if (collapseBtn) collapseBtn.addEventListener("click", toggleSidebar);
    const menuBtn = topbar.querySelector('[data-action="toggle-sidebar"]');
    if (menuBtn) menuBtn.addEventListener("click", toggleSidebar);
    backdrop.addEventListener("click", () => root.classList.remove("collapsed"));

    // Dropdown user: bấm để mở/đóng, bấm ra ngoài để đóng.
    const userBox = topbar.querySelector('[data-action="toggle-user-menu"]');
    if (userBox) {
      userBox.addEventListener("click", (e) => {
        e.stopPropagation();
        userBox.classList.toggle("open");
      });
      document.addEventListener("click", () => userBox.classList.remove("open"));
    }

    // Cập nhật badge đếm trên nav (vd: số Unit, số bài chờ chấm)
    function setBadge(key, value, warn) {
      const el = sidebar.querySelector('[data-badge="' + key + '"]');
      if (!el) return;
      const n = Number(value);
      const has = value != null && String(value) !== "" && !(Number.isFinite(n) && n === 0);
      el.style.display = has ? "" : "none";
      el.textContent = has ? String(value) : "";
      el.classList.toggle("warn", !!warn);
    }

    setActive(opts.activeKey);

    return { setActive, setBadge };
  }

  return { mount };
})();
