// ============================================================
//  LOGIC DASHBOARD GIÁO VIÊN (IELTS with Ms Nhi)
// ============================================================
(function () {
  let audioCache = [];
  let imagesCache = [];
  let testsCache = [];
  let allSubmissions = [];
  // Mock Test giờ luôn đủ 4 kỹ năng trong 1 lần soạn — builderSkills là
  // state cho cả 4 tab cùng lúc, builderActiveSkill chỉ quyết định tab nào
  // đang hiển thị (không loại trừ nhau như subject cũ).
  let builderSkills = null;
  let builderActiveSkill = "listening";
  let editingTestId = null;

  const TEST_SKILL_TABS = [
    { key: "listening", label: "Listening", icon: "headphones" },
    { key: "reading", label: "Reading", icon: "book-open" },
    { key: "writing", label: "Writing", icon: "writing" },
    { key: "speaking", label: "Speaking", icon: "mic" }
  ];
  const TEST_QUESTION_SKILLS = ["listening", "reading"];

  function emptyBuilderSkills() {
    return {
      listening: { sections: [], instructions: "", durationMinutes: null },
      reading: { sections: [], instructions: "", durationMinutes: null },
      writing: { prompts: [], instructions: "", durationMinutes: null },
      speaking: { prompts: [], instructions: "", durationMinutes: null }
    };
  }

  function skillHasBuilderContent(skill, key) {
    return TEST_QUESTION_SKILLS.includes(key) ? skill.sections.length > 0 : skill.prompts.length > 0;
  }

  // ---------- Đăng nhập / Đăng xuất ----------
  // Đăng nhập đã chuyển sang trang chủ (/) — ở đây chỉ kiểm tra token có sẵn.
  function decodeJwt(token) {
    try {
      const base64Url = String(token || "").split(".")[1];
      if (!base64Url) return {};
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return {};
    }
  }

  // Chuyển panel theo key điều hướng của sidebar (Phase 2 shell)
  let shellApi = null;

  function showPanel(key) {
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    const panel = document.getElementById("panel-" + key);
    if (panel) panel.classList.add("active");
    window.scrollTo({ top: 0 });
    if (key === "overview") loadOverview();
  }

  function enterDashboard() {
    document.getElementById("step-dashboard").style.display = "block";

    const payload = decodeJwt(Api.getToken());
    shellApi = Shell.mount({
      root: document.getElementById("appShell"),
      navGroups: [
        { label: "MAIN", items: [{ key: "overview", label: "Overview", icon: "home" }] },
        {
          label: "LEARNING",
          items: [
            { key: "lessons", label: "Lessons", icon: "book-open" },
            { key: "tests", label: "Mock Tests", icon: "clipboard" }
          ]
        },
        {
          label: "LIBRARY",
          items: [
            { key: "audio", label: "Audio Library", icon: "headphones" },
            { key: "images", label: "Image Library", icon: "image" }
          ]
        },
        {
          label: "MANAGEMENT",
          items: [
            { key: "submissions", label: "Submissions", icon: "list" },
            { key: "students", label: "Students", icon: "student" }
          ]
        }
      ],
      activeKey: "overview",
      userName: payload.name || "Teacher",
      roleLabel: "TEACHER",
      userSub: "Administrator",
      searchPlaceholder: "Search students, mock tests...",
      promo: {
        title: "Have a productive teaching day!",
        text: "Create new lessons and mock tests for your students to practice."
      },
      onNavigate: (key) => showPanel(key),
      onLogout: () => {
        Api.clearToken();
        location.href = "/";
      }
    });

    const heroName = document.getElementById("heroGreetName");
    if (heroName) heroName.textContent = payload.name || "Teacher";

    [
      ["btnHeroCreate", "tests"],
      ["btnEmptyCreateTest", "tests"],
      ["linkViewAllSubmissions", "submissions"]
    ].forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", (e) => {
        e.preventDefault();
        shellApi.setActive(key);
        showPanel(key);
      });
    });

    loadOverview();
    loadAudioList();
    loadImagesList();
    loadTestsList();
    loadUnitsList();
    loadSubmissions();
    loadStudentsList();
  }

  // If already logged in during this session -> enter dashboard
  if (Api.getToken()) {
    enterDashboard();
  } else {
    location.href = "/";
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------- Generic read-only preview modal ----------
  function showModal(title, bodyHtml) {
    const old = document.querySelector(".modal-overlay");
    if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="icon-btn" data-close><svg class="icon"><use href="#icon-cross"></use></svg></button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    `;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest("[data-close]")) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  // Đọc dữ liệu sections đang soạn (dạng editor) thành HTML xem trước, dùng
  // chung cho cả Preview bài kiểm tra và Preview bài tập trong Unit.
  function fieldAnswerPreviewText(sec, f) {
    if (f.kind === "fill") {
      return String(f.answersText || "").split(/[\n,]/).map((a) => a.trim()).filter(Boolean).join(", ") || "—";
    }
    if (f.kind === "matching" || f.kind === "labelling") {
      const bank = sec.matchBank || [];
      const item = bank.find((b) => b.id === f.matchingAnswerId);
      return item ? item.text || "(untitled)" : "—";
    }
    // mcq / tfng
    const correct = (f.options || []).filter((o) => (f.correctOptionIds || []).includes(o.id));
    return correct.length ? correct.map((o) => o.text || "(untitled)").join(", ") : "—";
  }

  function previewSectionsHtml(sectionsArr) {
    if (!sectionsArr.length) return '<div class="empty-state">No sections yet.</div>';
    return sectionsArr
      .map((sec) => {
        const qHtml = (sec.fields || [])
          .map((f) => {
            const answers = fieldAnswerPreviewText(sec, f);
            return `<div class="preview-q">
              <div class="pq-label">${escapeHtml(f.id)}. ${escapeHtml(f.label) || "<em>(no question text)</em>"}</div>
              <div class="pq-meta"><span>${QUESTION_KIND_LABELS[f.kind] || f.kind}</span><span>Score: ${f.score || 1}</span><span>Answer: ${escapeHtml(answers)}</span></div>
            </div>`;
          })
          .join("");
        return `<div class="preview-section-title">${escapeHtml(sec.name) || "(untitled section)"}</div>${qHtml || '<div class="empty-state">No questions yet.</div>'}`;
      })
      .join("");
  }

  // ============================================================
  //  OVERVIEW
  // ============================================================
  function loadOverview() {
    const statusEl = document.getElementById("overviewStatus");
    const content = document.getElementById("overviewContent");
    statusEl.style.display = "block";
    content.style.display = "none";

    Api.admin
      .dashboard()
      .then((data) => {
        statusEl.style.display = "none";
        content.style.display = "block";
        renderStatGrid(data.summary);
        renderByTest(data.byTest);
        renderRecent(data.recent);
        if (shellApi && data.summary) {
          const s = data.summary;
          shellApi.setBadge("lessons", s.totalUnits != null ? s.totalUnits : 0, false);
          shellApi.setBadge("tests", s.totalTests != null ? s.totalTests : 0, false);
          shellApi.setBadge("submissions", s.pendingGrading != null ? s.pendingGrading : 0, true);
        }
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function statCard(opts) {
    const { icon, value, label, sub, tone, navKey, featured } = opts;
    return `<div class="stat-card-v2${tone ? " tone-" + tone : ""}${featured ? " featured" : ""}">
      <div class="stat-top"><span class="label">${label}</span><span class="stat-icon">${Icon(icon)}</span></div>
      <div class="value">${value}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ""}
      ${navKey ? `<button type="button" class="stat-link" data-goto="${navKey}">View details ${Icon("arrow-left", "flip")}</button>` : ""}
    </div>`;
  }

  function renderStatGrid(s) {
    const pending = s.pendingGrading != null ? s.pendingGrading : 0;
    document.getElementById("statGrid").innerHTML = [
      statCard({ icon: "clipboard", value: s.publishedTests + "/" + s.totalTests, label: "Published Mock Tests", navKey: "tests" }),
      statCard({ icon: "book-open", value: s.totalUnits != null ? s.totalUnits : 0, label: "Lesson Units", tone: "teal", navKey: "lessons" }),
      statCard({ icon: "headphones", value: s.totalAudio, label: "Audio Library Tracks", tone: "sky", navKey: "audio" }),
      statCard({ icon: "list", value: s.totalSubmissions, label: "Total Submissions", tone: "pink", navKey: "submissions" }),
      statCard({ icon: "clock", value: s.submissionsThisWeek != null ? s.submissionsThisWeek : 0, label: "Submissions (7 Days)", tone: "warn", navKey: "submissions" }),
      statCard({ icon: "trophy", value: s.uniqueStudents, label: "Active Students", tone: "success", navKey: "students" }),
      pending > 0
        ? statCard({ icon: "warning", value: pending, label: "Pending Review", sub: "Requires manual grading", tone: "warn", navKey: "submissions", featured: true })
        : statCard({ icon: "check-circle", value: pending, label: "Pending Review", sub: "All graded", tone: "success", navKey: "submissions", featured: true }),
      statCard({ icon: "chart-bar", value: s.avgScorePct + "%", label: "Average Score", tone: "success", navKey: "submissions", featured: true })
    ].join("");

    document.querySelectorAll(".stat-link[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        shellApi.setActive(btn.dataset.goto);
        showPanel(btn.dataset.goto);
      });
    });
  }

  function scorePill(pct) {
    const n = Number(pct) || 0;
    const tone = n >= 70 ? "pill-ok" : n >= 40 ? "pill-warn" : "pill-danger";
    return `<span class="pill ${tone}">${n}%</span>`;
  }

  function renderByTest(rows) {
    const wrap = document.getElementById("byTestTableWrap");
    const emptyEl = document.getElementById("byTestEmpty");
    const body = document.getElementById("byTestBody");
    if (!rows || !rows.length) {
      wrap.style.display = "none";
      emptyEl.style.display = "block";
      return;
    }
    wrap.style.display = "block";
    emptyEl.style.display = "none";
    body.innerHTML = rows
      .map((r) => {
        const skillLabel = r.testSkill ? r.testSkill[0].toUpperCase() + r.testSkill.slice(1) : "—";
        return `<tr>
          <td><span class="cell-title">${escapeHtml(r.testTitle)}</span></td>
          <td><span class="pill pill-info">${escapeHtml(skillLabel)}</span></td>
          <td>${r.submissions}</td>
          <td>${scorePill(r.avgScorePct)}</td>
          <td><button type="button" class="icon-btn" data-goto="submissions" title="View submissions">${Icon("external")}</button></td>
        </tr>`;
      })
      .join("");
    body.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => { shellApi.setActive("submissions"); showPanel("submissions"); });
    });
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    return (parts[parts.length - 1] || "?").slice(0, 2);
  }

  function renderRecent(rows) {
    const el = document.getElementById("recentList");
    if (!rows || !rows.length) {
      el.innerHTML = `<div class="empty-state-v2">
        <div class="empty-icon-circle">${Icon("send")}</div>
        <h4>No submissions yet</h4>
        <p>Student submissions will appear here once submitted.</p>
      </div>`;
      return;
    }
    el.innerHTML = rows
      .map((r) => {
        const time = r.submittedAt ? new Date(r.submittedAt).toLocaleString("en-US") : "";
        return `<div class="list-item">
          <div class="meta">
            <div class="avatar">${escapeHtml(initials(r.studentName))}</div>
            <div class="meta-text">
              <h4>${escapeHtml(r.studentName)}</h4>
              <p>${escapeHtml(r.testTitle)} · ${time}</p>
            </div>
          </div>
          <div class="list-value">${scorePill(r.total ? Math.round((r.score / r.total) * 100) : 0)}</div>
        </div>`;
      })
      .join("");
  }

  // ============================================================
  //  AUDIO LIBRARY
  // ============================================================
  document.getElementById("btnUploadAudio").addEventListener("click", uploadAudio);

  async function uploadAudio() {
    const title = document.getElementById("audioTitle").value.trim();
    const unit = document.getElementById("audioUnit").value.trim();
    const fileInput = document.getElementById("audioFile");
    const file = fileInput.files[0];
    const statusEl = document.getElementById("audioUploadStatus");

    if (!title || !file) {
      statusEl.style.display = "block";
      statusEl.className = "notice error";
      statusEl.textContent = "Please enter a title and select an audio file.";
      return;
    }

    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.innerHTML = '<span class="spinner"></span> Uploading...';

    try {
      const { cloudinaryUrl, cloudinaryPublicId } = await Api.uploadToCloudinary(file, { resourceType: "video", folder: "ielts-listening" });
      await Api.admin.uploadAudio({ title, unit, cloudinaryUrl, cloudinaryPublicId });
      statusEl.className = "notice success";
      statusEl.textContent = "Uploaded successfully.";
      document.getElementById("audioTitle").value = "";
      document.getElementById("audioUnit").value = "";
      fileInput.value = "";
      loadAudioList();
    } catch (err) {
      statusEl.className = "notice error";
      statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
    }
  }

  function loadAudioList() {
    const statusEl = document.getElementById("audioListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Loading...";

    Api.admin
      .listAudio()
      .then((data) => {
        audioCache = data.rows || [];
        statusEl.style.display = "none";
        renderAudioList();
        renderAudioSelectOptions();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function renderAudioList() {
    const listEl = document.getElementById("audioList");
    if (!audioCache.length) {
      listEl.innerHTML = '<div class="empty-state">No audio tracks yet. Upload one using the form above.</div>';
      return;
    }
    listEl.innerHTML = "";
    audioCache.forEach((a) => {
      const row = document.createElement("div");
      row.className = "audio-item";
      row.innerHTML = `
        <div class="meta">
          <h4>${escapeHtml(a.unit ? a.unit + " · " : "") + escapeHtml(a.title)}</h4>
          <p>${new Date(a.uploadedAt).toLocaleDateString("en-US")}</p>
        </div>
        <audio controls src="${a.cloudinaryUrl}"></audio>
        <div class="actions">
          <button class="icon-btn danger" title="Delete"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector(".danger").addEventListener("click", () => deleteAudio(a._id));
      listEl.appendChild(row);
    });
  }

  function deleteAudio(id) {
    if (!confirm("Delete this audio track? This action cannot be undone.")) return;
    Api.admin
      .deleteAudio(id)
      .then(() => loadAudioList())
      .catch((err) => alert("Failed to delete: " + err.message));
  }

  // ============================================================
  //  IMAGE LIBRARY
  // ============================================================
  document.getElementById("btnUploadImage").addEventListener("click", uploadImage);

  async function uploadImage() {
    const title = document.getElementById("imageTitle").value.trim();
    const unit = document.getElementById("imageUnit").value.trim();
    const fileInput = document.getElementById("imageFile");
    const file = fileInput.files[0];
    const statusEl = document.getElementById("imageUploadStatus");

    if (!title || !file) {
      statusEl.style.display = "block";
      statusEl.className = "notice error";
      statusEl.textContent = "Please enter a title and select an image file.";
      return;
    }

    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.innerHTML = '<span class="spinner"></span> Uploading...';

    try {
      const { cloudinaryUrl, cloudinaryPublicId } = await Api.uploadToCloudinary(file, { resourceType: "image", folder: "ielts-images" });
      await Api.admin.uploadImage({ title, unit, cloudinaryUrl, cloudinaryPublicId });
      statusEl.className = "notice success";
      statusEl.textContent = "Uploaded successfully.";
      document.getElementById("imageTitle").value = "";
      document.getElementById("imageUnit").value = "";
      fileInput.value = "";
      loadImagesList();
    } catch (err) {
      statusEl.className = "notice error";
      statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
    }
  }

  function loadImagesList() {
    const statusEl = document.getElementById("imageListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Loading...";

    Api.admin
      .listImages()
      .then((data) => {
        imagesCache = data.rows || [];
        statusEl.style.display = "none";
        renderImagesList();
        renderImageSelectOptions();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function renderImagesList() {
    const listEl = document.getElementById("imageList");
    if (!imagesCache.length) {
      listEl.innerHTML = '<div class="empty-state">No images yet. Upload one using the form above.</div>';
      return;
    }
    listEl.innerHTML = "";
    imagesCache.forEach((img) => {
      const row = document.createElement("div");
      row.className = "audio-item";
      row.innerHTML = `
        <div class="meta" style="flex: 1;">
          <h4>${escapeHtml(img.unit ? img.unit + " · " : "") + escapeHtml(img.title)}</h4>
          <p>${new Date(img.uploadedAt).toLocaleDateString("en-US")}</p>
        </div>
        <img src="${img.cloudinaryUrl}" style="height:48px; border-radius:4px; object-fit:contain; margin-right:12px; max-width: 100px;" />
        <div class="actions">
          <button class="icon-btn danger" title="Delete"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector(".danger").addEventListener("click", () => deleteImage(img._id));
      listEl.appendChild(row);
    });
  }

  function deleteImage(id) {
    if (!confirm("Delete this image? This action cannot be undone.")) return;
    Api.admin
      .deleteImage(id)
      .then(() => loadImagesList())
      .catch((err) => alert("Failed to delete: " + err.message));
  }

  // ============================================================
  //  BÀI KIỂM TRA (TEST BUILDER) — 4 kỹ năng soạn chung 1 lần, khoá/mở
  //  cùng 1 lịch. Listening/Reading dùng lại renderSectionsEditor (câu hỏi
  //  tự chấm); Writing/Speaking dùng renderPromptsEditor (đề bài, chấm tay).
  // ============================================================
  document.getElementById("btnNewTest").addEventListener("click", () => openBuilder(null));
  document.getElementById("btnCancelBuilder").addEventListener("click", closeBuilder);
  document.getElementById("btnSaveDraft").addEventListener("click", () => saveTest("draft"));
  document.getElementById("btnPublish").addEventListener("click", () => saveTest("published"));
  document.getElementById("btnPreviewTest").addEventListener("click", () => {
    const title = document.getElementById("tbTitle").value.trim() || "(untitled test)";
    showModal(title, previewTestSkillsHtml(builderSkills));
  });

  function previewTestSkillsHtml(skills) {
    return TEST_SKILL_TABS.map((tab) => {
      const skill = skills[tab.key];
      const body = TEST_QUESTION_SKILLS.includes(tab.key)
        ? previewSectionsHtml(skill.sections)
        : (skill.prompts.length
          ? skill.prompts.map((p) => `<div class="preview-q">
              <div class="pq-label">${escapeHtml(p.title) || "<em>(untitled prompt)</em>"}</div>
              <div class="pq-meta" style="white-space:pre-line; color:var(--ink);">${escapeHtml(p.instructions)}</div>
            </div>`).join("")
          : '<div class="empty-state">No prompts yet.</div>');
      return `<div class="preview-section-title">${tab.label}</div>${body}`;
    }).join("");
  }

  function renderSkillTabs() {
    const wrap = document.getElementById("tbSkillTabs");
    wrap.innerHTML = TEST_SKILL_TABS.map((tab) => {
      const has = skillHasBuilderContent(builderSkills[tab.key], tab.key);
      return `<button type="button" class="${tab.key === builderActiveSkill ? "active" : ""}" data-skill="${tab.key}">
        ${Icon(tab.icon)} ${tab.label}${has ? ` <span class="cat-done">${Icon("check")}</span>` : ""}
      </button>`;
    }).join("");
    wrap.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        builderActiveSkill = btn.dataset.skill;
        renderBuilder();
      });
    });
  }

  function renderSkillPanel() {
    const wrap = document.getElementById("tbSkillPanels");
    wrap.innerHTML = "";
    const key = builderActiveSkill;
    const skill = builderSkills[key];
    const tabInfo = TEST_SKILL_TABS.find((t) => t.key === key);

    const head = document.createElement("div");
    head.className = "builder-2col";
    head.innerHTML = `
      <div class="form-row" style="margin-bottom:0;">
        <label>${tabInfo.label} instructions</label>
        <input type="text" class="skill-instructions" value="${escapeHtml(skill.instructions)}" placeholder="e.g. Listen to the conversation and fill in the blanks..." />
      </div>
      <div class="form-row" style="margin-bottom:0;">
        <label>Time limit for this skill (minutes)</label>
        <input type="number" class="skill-duration" min="1" step="1" value="${skill.durationMinutes || ""}" placeholder="Unlimited" />
      </div>
    `;
    head.querySelector(".skill-instructions").addEventListener("input", (e) => (skill.instructions = e.target.value));
    head.querySelector(".skill-duration").addEventListener("input", (e) => (skill.durationMinutes = e.target.value ? Number(e.target.value) : null));
    wrap.appendChild(head);

    if (TEST_QUESTION_SKILLS.includes(key)) {
      const toolbar = document.createElement("div");
      toolbar.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:22px;";
      toolbar.innerHTML = `<h4 style="margin:0;">Sections</h4><button type="button" class="btn secondary btn-skill-import" style="padding:8px 14px; font-size:.85rem;">${Icon("upload")} Import from spreadsheet</button>`;
      wrap.appendChild(toolbar);

      const sectionsWrap = document.createElement("div");
      wrap.appendChild(sectionsWrap);
      const rerenderSections = () => {
        renderSectionsEditor(sectionsWrap, skill.sections, key);
        renderSkillTabs();
      };
      rerenderSections();

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "dashed-add-btn";
      addBtn.style.marginTop = "8px";
      addBtn.innerHTML = Icon("plus") + " Add Section";
      addBtn.addEventListener("click", () => {
        skill.sections.push(emptySection());
        rerenderSections();
      });
      wrap.appendChild(addBtn);

      toolbar.querySelector(".btn-skill-import").addEventListener("click", () => {
        openSpreadsheetImportModal(skill.sections, rerenderSections);
      });
    } else {
      const heading = document.createElement("h4");
      heading.style.marginTop = "22px";
      heading.textContent = "Prompts";
      wrap.appendChild(heading);

      const promptsWrap = document.createElement("div");
      wrap.appendChild(promptsWrap);
      const rerenderPrompts = () => {
        renderPromptsEditor(promptsWrap, skill.prompts, rerenderPrompts);
        renderSkillTabs();
      };
      rerenderPrompts();
    }
  }

  function renderBuilder() {
    renderSkillTabs();
    renderSkillPanel();
  }

  function loadTestsList() {
    const statusEl = document.getElementById("testsListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Loading...";

    Api.admin
      .listTests()
      .then((data) => {
        testsCache = data.rows || [];
        statusEl.style.display = "none";
        renderTestsList();
        renderTestFilterOptions();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function renderTestsList() {
    const listEl = document.getElementById("testsList");
    if (!testsCache.length) {
      listEl.innerHTML = '<div class="empty-state">No mock tests found.</div>';
      return;
    }
    listEl.innerHTML = "";
    testsCache.forEach((t) => {
      const skills = t.skills || {};
      const skillLabels = TEST_SKILL_TABS
        .filter((tab) => {
          const s = skills[tab.key] || {};
          return TEST_QUESTION_SKILLS.includes(tab.key) ? (s.sections || []).length > 0 : (s.prompts || []).length > 0;
        })
        .map((tab) => tab.label);
      const scheduleBits = [];
      if (t.opensAt) scheduleBits.push("Opens: " + new Date(t.opensAt).toLocaleString("en-US"));
      if (t.closesAt) scheduleBits.push("Closes: " + new Date(t.closesAt).toLocaleString("en-US"));
      const row = document.createElement("div");
      row.className = "test-item";
      row.innerHTML = `
        <div class="meta">
          <h4>${escapeHtml(t.unit ? t.unit + " · " : "") + escapeHtml(t.title)}
            <span class="status-pill ${t.status}">${t.status === "published" ? "Published" : "Draft"}</span>
          </h4>
          <p>Level ${t.level != null ? t.level : "-"} · Skills: ${skillLabels.length ? escapeHtml(skillLabels.join(", ")) : "none yet"}${scheduleBits.length ? " · " + scheduleBits.join(" · ") : ""}</p>
        </div>
        <div class="actions">
          <button class="icon-btn" title="Edit"><svg class="icon"><use href="#icon-edit"></use></svg></button>
          <button class="icon-btn danger" title="Delete"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector('[title="Edit"]').addEventListener("click", () => openBuilder(t._id));
      row.querySelector(".danger").addEventListener("click", () => deleteTest(t._id));
      listEl.appendChild(row);
    });
  }

  function deleteTest(id) {
    if (!confirm("Delete this mock test? This action cannot be undone.")) return;
    Api.admin
      .deleteTest(id)
      .then(() => loadTestsList())
      .catch((err) => alert("Failed to delete: " + err.message));
  }

  // Chuyển 1 khối skill từ API (raw, có thể thiếu nếu test cũ mới migrate)
  // sang dạng editor.
  function promptSkillToEditor(raw) {
    raw = raw || {};
    return {
      prompts: (raw.prompts || []).map((p) => ({
        _id: p._id,
        title: p.title || "",
        instructions: p.instructions || "",
        imageId: p.imageId && (p.imageId._id || p.imageId)
      })),
      instructions: raw.instructions || "",
      durationMinutes: raw.durationMinutes || null
    };
  }
  function questionSkillToEditor(raw) {
    raw = raw || {};
    return {
      sections: sectionsToEditor(raw.sections),
      instructions: raw.instructions || "",
      durationMinutes: raw.durationMinutes || null
    };
  }

  function openBuilder(testId) {
    editingTestId = testId;
    document.getElementById("testBuilder").style.display = "block";
    document.getElementById("builderStatus").style.display = "none";
    document.getElementById("builderHeading").textContent = testId ? "Edit Mock Test" : "Create New Mock Test";

    if (!testId) {
      document.getElementById("tbTitle").value = "";
      document.getElementById("tbUnit").value = "";
      document.getElementById("tbLevel").value = 1;
      document.getElementById("tbOpensAt").value = "";
      document.getElementById("tbClosesAt").value = "";
      builderSkills = emptyBuilderSkills();
      builderActiveSkill = "listening";
      renderBuilder();
      document.getElementById("testBuilder").scrollIntoView({ behavior: "smooth" });
      return;
    }

    Api.admin
      .getTest(testId)
      .then((data) => {
        const t = data.test;
        document.getElementById("tbTitle").value = t.title || "";
        document.getElementById("tbUnit").value = t.unit || "";
        document.getElementById("tbLevel").value = t.level || 1;
        document.getElementById("tbOpensAt").value = toDatetimeLocalValue(t.opensAt);
        document.getElementById("tbClosesAt").value = toDatetimeLocalValue(t.closesAt);

        const ts = t.skills || {};
        builderSkills = {
          listening: questionSkillToEditor(ts.listening),
          reading: questionSkillToEditor(ts.reading),
          writing: promptSkillToEditor(ts.writing),
          speaking: promptSkillToEditor(ts.speaking)
        };
        builderActiveSkill = "listening";
        renderBuilder();
        document.getElementById("testBuilder").scrollIntoView({ behavior: "smooth" });
      })
      .catch((err) => alert("Failed to load mock test: " + err.message));
  }

  function closeBuilder() {
    document.getElementById("testBuilder").style.display = "none";
    editingTestId = null;
  }

  // ISO/Date -> datetime-local input value
  function toDatetimeLocalValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function nextFieldIdFor(sectionsArr) {
    const ids = sectionsArr.flatMap((s) => s.fields.map((f) => Number(f.id) || 0));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }
  let optionIdSeq = 0;
  function newOptionId() {
    optionIdSeq += 1;
    return "opt" + Date.now().toString(36) + optionIdSeq;
  }

  function emptySection() {
    return { name: "", audioId: "", passageText: "", imageId: "", matchBank: [], fields: [] };
  }

  // kind: 'fill' | 'mcq' | 'tfng' | 'matching' — cách chấm chỉ suy ra từ đây,
  // giáo viên không bao giờ phải gõ cú pháp value|label thủ công.
  function emptyField(id) {
    return {
      id, label: "", kind: "fill", pre: "", post: "", hint: "", score: 1,
      answersText: "", options: [], correctOptionIds: [], matchingAnswerId: "", selectCount: 1,
      pinX: null, pinY: null
    };
  }

  function tfngOptions() {
    return [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
      { id: "ng", text: "Not Given" }
    ];
  }

  function ynngOptions() {
    return [
      { id: "yes", text: "Yes" },
      { id: "no", text: "No" },
      { id: "ng", text: "Not Given" }
    ];
  }

  // true nếu options hiện tại đúng là bộ id của tfng hoặc ynng — dùng để
  // tránh ghi đè mất dữ liệu khi giáo viên đổi kind đi rồi đổi lại.
  function isFixedChoiceShape(options, ids) {
    return options.length === 3 && options.every((o) => ids.includes(o.id));
  }

  function renderAudioSelectOptions(root) {
    (root || document).querySelectorAll(".section-audio-select").forEach((sel) => {
      const current = sel.value;
      sel.innerHTML =
        '<option value="">— Select audio track —</option>' +
        audioCache.map((a) => `<option value="${a._id}">${escapeHtml(a.unit ? a.unit + " · " : "") + escapeHtml(a.title)}</option>`).join("");
      if (current) sel.value = current;
    });
  }

  function renderImageSelectOptions(root) {
    (root || document).querySelectorAll(".section-image-select").forEach((sel) => {
      const current = sel.value;
      sel.innerHTML =
        '<option value="">— No diagram/map image —</option>' +
        imagesCache.map((img) => `<option value="${img._id}">${escapeHtml(img.unit ? img.unit + " · " : "") + escapeHtml(img.title)}</option>`).join("");
      if (current) sel.value = current;
    });
  }

  // Editor section/field
  function renderSectionsEditor(wrap, sectionsArr, subject) {
    wrap.innerHTML = "";
    const rerender = () => renderSectionsEditor(wrap, sectionsArr, subject);

    if (!sectionsArr.length) {
      wrap.innerHTML = '<div class="empty-state">No sections added — click "Add Section" to start.</div>';
      return;
    }

    sectionsArr.forEach((sec, secIdx) => {
      const box = document.createElement("div");
      box.className = "builder-section";

      let mediaHtml = "";
      if (subject === "listening") {
        mediaHtml = `
          <div class="form-row" style="margin-bottom:10px;">
            <label>Audio track for this section</label>
            <select class="select-inline section-audio-select" style="width:100%;"></select>
          </div>
        `;
      } else if (subject === "reading") {
        mediaHtml = `
          <div class="form-row" style="margin-bottom:10px;">
            <label>Passage text</label>
            <textarea class="sec-passage-text" rows="5" placeholder="Enter reading passage text here...">${escapeHtml(sec.passageText || "")}</textarea>
          </div>
        `;
      }

      box.innerHTML = `
        <div class="builder-section-head">
          <input type="text" placeholder="Section title (e.g. Section 1 / Paragraphs 1-5)" style="flex:1;" class="sec-name" value="${escapeHtml(sec.name)}" />
          <button class="icon-btn danger" title="Delete section"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
        ${mediaHtml}
        <div class="builder-2col">
          <div class="form-row" style="margin-bottom:0;">
            <label>Illustration (Diagram / Map — optional)</label>
            <select class="select-inline section-image-select" style="width:100%;"></select>
          </div>
          <div class="form-row" style="margin-bottom:0;">
            <label>Shared answer bank (for Matching questions — optional)</label>
            <div class="match-bank-box"><div class="match-bank-rows"></div></div>
          </div>
        </div>

        <div class="questions-card">
          <div class="questions-card-head">
            <div class="head-left">
              <span class="icon-chip"><svg class="icon"><use href="#icon-list"></use></svg></span>
              <div>
                <h4>Questions</h4>
                <div class="head-sub">Add questions and correct answers</div>
              </div>
            </div>
            <button type="button" class="btn secondary btn-import-questions" style="padding:8px 14px; font-size:.85rem;">
              <svg class="icon"><use href="#icon-upload"></use></svg> Import questions
            </button>
          </div>
          <div class="questions-card-body">
            <div class="question-grid-cols question-grid-head">
              <span></span><span></span>
              <span>Question / Prompt</span>
              <span>Type</span>
              <span>Score</span>
              <span>Order</span>
              <span></span>
            </div>
            <div class="fields-wrap"></div>
            <button type="button" class="btn secondary btn-add-field" style="margin-top:10px; padding:8px 14px; font-size:.85rem;">
              <svg class="icon"><use href="#icon-plus"></use></svg> Add Question
            </button>
          </div>
        </div>
      `;

      box.querySelector(".sec-name").addEventListener("input", (e) => (sec.name = e.target.value));
      box.querySelector(".danger").addEventListener("click", () => {
        sectionsArr.splice(secIdx, 1);
        rerender();
      });

      if (subject === "listening") {
        const audioSel = box.querySelector(".section-audio-select");
        audioSel.addEventListener("change", (e) => (sec.audioId = e.target.value));
      } else if (subject === "reading") {
        const passageTextarea = box.querySelector(".sec-passage-text");
        passageTextarea.addEventListener("input", (e) => (sec.passageText = e.target.value));
      }

      const imageSel = box.querySelector(".section-image-select");
      imageSel.addEventListener("change", (e) => (sec.imageId = e.target.value));

      renderMatchBank(box.querySelector(".match-bank-rows"), sec, rerender);

      const fieldsWrap = box.querySelector(".fields-wrap");
      sec.fields.forEach((f, fIdx) => {
        fieldsWrap.appendChild(renderFieldRow(sec, f, fIdx, rerender));
      });

      box.querySelector(".btn-add-field").addEventListener("click", () => {
        sec.fields.push(emptyField(nextFieldIdFor(sectionsArr)));
        rerender();
      });

      box.querySelector(".btn-import-questions").addEventListener("click", () => {
        showImportQuestionsModal((rows) => {
          rows.forEach((r) => {
            const field = emptyField(nextFieldIdFor(sectionsArr));
            field.label = r.label;
            field.answersText = r.answersText;
            sec.fields.push(field);
          });
          rerender();
        });
      });

      wrap.appendChild(box);
    });

    renderAudioSelectOptions(wrap);
    renderImageSelectOptions(wrap);

    // Set selected values
    sectionsArr.forEach((sec, secIdx) => {
      const box = wrap.children[secIdx];
      if (subject === "listening" && sec.audioId) {
        box.querySelector(".section-audio-select").value = sec.audioId;
      }
      if (sec.imageId) {
        box.querySelector(".section-image-select").value = sec.imageId;
      }
    });
  }


  // Kho đáp án dùng chung cho câu hỏi dạng "Matching" trong 1 section —
  // giáo viên chỉ gõ nội dung từng đáp án, không cần đặt mã/value.
  function renderMatchBank(container, sec, rerender) {
    if (!sec.matchBank.length) {
      container.innerHTML = '<div class="match-bank-empty">No shared answers yet — add them here, then pick from the list on any "Matching" question below.</div>';
    } else {
      container.innerHTML = "";
      sec.matchBank.forEach((b, bIdx) => {
        const row = document.createElement("div");
        row.className = "option-row";
        row.innerHTML = `
          <input type="text" placeholder="Answer text (e.g. Heading I, Library Hall...)" value="${escapeHtml(b.text)}" />
          <button type="button" class="icon-btn danger option-remove" title="Remove"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        `;
        row.querySelector("input").addEventListener("input", (e) => (b.text = e.target.value));
        row.querySelector(".option-remove").addEventListener("click", () => {
          sec.matchBank.splice(bIdx, 1);
          rerender();
        });
        container.appendChild(row);
      });
    }
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "option-add-btn";
    addBtn.innerHTML = Icon("plus") + " Add answer";
    addBtn.addEventListener("click", () => {
      sec.matchBank.push({ id: newOptionId(), text: "" });
      rerender();
    });
    container.appendChild(addBtn);
  }

  const QUESTION_KIND_LABELS = {
    fill: "Fill in the blank",
    mcq: "Multiple choice",
    tfng: "True / False / Not Given",
    ynng: "Yes / No / Not Given",
    matching: "Matching (section answer bank)",
    labelling: "Diagram/Map Labelling"
  };

  function renderFieldRow(sec, f, fIdx, rerender) {
    if (f.score == null) f.score = 1;
    const row = document.createElement("div");
    row.className = "question-row";

    row.innerHTML = `
      <div class="question-grid-cols">
        <span class="question-drag" title="Reorder by Order number"><svg class="icon"><use href="#icon-menu"></use></svg></span>
        <span class="question-num">${fIdx + 1}</span>
        <textarea class="f-label" rows="1" placeholder="Enter the question or prompt...">${escapeHtml(f.label)}</textarea>
        <select class="f-kind">
          ${Object.keys(QUESTION_KIND_LABELS).map((k) => `<option value="${k}" ${f.kind === k ? "selected" : ""}>${QUESTION_KIND_LABELS[k]}</option>`).join("")}
        </select>
        <input type="number" class="f-score" value="${f.score}" min="1" title="Score (points)" />
        <input type="text" class="f-id" value="${escapeHtml(String(f.id))}" title="Order / Question No." />
        <button type="button" class="icon-btn danger f-remove" title="Delete question"><svg class="icon"><use href="#icon-trash"></use></svg></button>
      </div>
      <div class="question-hint-row">
        <input type="text" class="f-hint" value="${escapeHtml(f.hint || "")}" placeholder="Hint / instruction (optional), e.g. NO MORE THAN TWO WORDS" />
      </div>
      <div class="question-detail"></div>
    `;

    row.querySelector(".f-id").addEventListener("input", (e) => (f.id = e.target.value));
    row.querySelector(".f-label").addEventListener("input", (e) => (f.label = e.target.value));
    row.querySelector(".f-score").addEventListener("input", (e) => (f.score = Number(e.target.value) || 1));
    row.querySelector(".f-hint").addEventListener("input", (e) => (f.hint = e.target.value));
    row.querySelector(".f-kind").addEventListener("change", (e) => {
      const isTfngShape = isFixedChoiceShape(f.options, ["true", "false", "ng"]);
      const isYnngShape = isFixedChoiceShape(f.options, ["yes", "no", "ng"]);
      f.kind = e.target.value;
      if (f.kind === "tfng" && !isTfngShape) {
        f.options = tfngOptions();
        f.correctOptionIds = [];
      }
      if (f.kind === "ynng" && !isYnngShape) {
        f.options = ynngOptions();
        f.correctOptionIds = [];
      }
      if (f.kind === "mcq" && (!f.options.length || isTfngShape || isYnngShape)) {
        f.options = [];
        f.correctOptionIds = [];
      }
      renderQuestionDetail(row.querySelector(".question-detail"), sec, f, rerender);
    });
    row.querySelector(".f-remove").addEventListener("click", () => {
      sec.fields.splice(fIdx, 1);
      rerender();
    });

    renderQuestionDetail(row.querySelector(".question-detail"), sec, f, rerender);

    return row;
  }

  // Dùng chung cho tfng và ynng — chỉ khác bộ 3 lựa chọn cố định truyền vào.
  function renderFixedChoiceDetail(el, f, fixedOptions) {
    if (!isFixedChoiceShape(f.options, fixedOptions.map((o) => o.id))) f.options = fixedOptions;
    el.innerHTML = `<div class="question-detail-inner"></div>`;
    const inner = el.querySelector(".question-detail-inner");
    f.options.forEach((o) => {
      const row = document.createElement("div");
      row.className = "option-row";
      row.innerHTML = `
        <input type="radio" name="fixedchoice-${f.id}" ${f.correctOptionIds[0] === o.id ? "checked" : ""} />
        <span class="tfng-label">${escapeHtml(o.text)}</span>
      `;
      row.querySelector("input").addEventListener("change", () => {
        f.correctOptionIds = [o.id];
      });
      inner.appendChild(row);
    });
    const hint = document.createElement("div");
    hint.className = "kind-hint" + (f.correctOptionIds.length ? " ok" : " warn");
    hint.textContent = f.correctOptionIds.length ? "Correct answer selected." : "Pick the correct answer above.";
    el.appendChild(hint);
  }

  // Phần chi tiết bên dưới mỗi câu hỏi — nội dung khác nhau tuỳ "kind",
  // nhưng luôn là chọn/tick, không có ô nào yêu cầu gõ cú pháp value|label.
  function renderQuestionDetail(el, sec, f, rerender) {
    if (f.kind === "fill") {
      el.innerHTML = `
        <div class="question-row-extra">
          <div class="f-group"><label>Before blank</label><input type="text" class="f-pre" value="${escapeHtml(f.pre)}" style="width:120px;" /></div>
          <div class="f-group"><label>After blank</label><input type="text" class="f-post" value="${escapeHtml(f.post)}" style="width:120px;" /></div>
          <div class="f-group" style="flex:1; min-width:220px;">
            <label>Correct answer(s) — one per line, add more if several wordings are OK</label>
            <textarea class="f-answers" rows="2" placeholder="Paris
9am">${escapeHtml(f.answersText || "")}</textarea>
          </div>
        </div>
      `;
      el.querySelector(".f-pre").addEventListener("input", (e) => (f.pre = e.target.value));
      el.querySelector(".f-post").addEventListener("input", (e) => (f.post = e.target.value));
      el.querySelector(".f-answers").addEventListener("input", (e) => (f.answersText = e.target.value));
      return;
    }

    if (f.kind === "tfng" || f.kind === "ynng") {
      renderFixedChoiceDetail(el, f, f.kind === "tfng" ? tfngOptions() : ynngOptions());
      return;
    }

    if (f.kind === "mcq") {
      el.innerHTML = `<div class="question-detail-inner"></div>`;
      const inner = el.querySelector(".question-detail-inner");
      const renderRows = () => {
        inner.innerHTML = "";
        f.options.forEach((o, oIdx) => {
          const row = document.createElement("div");
          row.className = "option-row";
          const checked = f.correctOptionIds.includes(o.id);
          row.innerHTML = `
            <input type="checkbox" ${checked ? "checked" : ""} title="Mark as correct answer" />
            <input type="text" placeholder="Option ${oIdx + 1} text" value="${escapeHtml(o.text)}" />
            <button type="button" class="icon-btn danger option-remove" title="Remove option"><svg class="icon"><use href="#icon-trash"></use></svg></button>
          `;
          row.querySelector('input[type=checkbox]').addEventListener("change", (e) => {
            if (e.target.checked) f.correctOptionIds.push(o.id);
            else f.correctOptionIds = f.correctOptionIds.filter((id) => id !== o.id);
            renderHint();
          });
          row.querySelector('input[type=text]').addEventListener("input", (e) => (o.text = e.target.value));
          row.querySelector(".option-remove").addEventListener("click", () => {
            f.options.splice(oIdx, 1);
            f.correctOptionIds = f.correctOptionIds.filter((id) => id !== o.id);
            renderRows();
            renderHint();
          });
          inner.appendChild(row);
        });
      };
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "option-add-btn";
      addBtn.innerHTML = Icon("plus") + " Add option";
      addBtn.addEventListener("click", () => {
        f.options.push({ id: newOptionId(), text: "" });
        renderRows();
        renderHint();
      });
      const hint = document.createElement("div");
      function renderHint() {
        const n = f.correctOptionIds.length;
        hint.className = "kind-hint" + (n ? " ok" : " warn");
        hint.textContent = n === 0
          ? "Tick the box next to each correct option."
          : n === 1
            ? "1 correct answer — students pick one."
            : n + " correct answers — students must pick exactly " + n + ".";
      }
      renderRows();
      renderHint();
      el.appendChild(addBtn);
      el.appendChild(hint);
      return;
    }

    // matching / labelling — cùng cách chọn đáp án đúng từ answer bank của
    // section, labelling chỉ có thêm widget đặt pin lên ảnh sơ đồ bên dưới.
    const bank = sec.matchBank || [];
    if (!bank.length) {
      el.innerHTML = `<div class="kind-hint warn">This section has no shared answer bank yet — add answers above first, then come back here to pick one.</div>`;
    } else {
      el.innerHTML = `
        <div class="f-group">
          <label>Correct answer</label>
          <select class="f-matching-answer" style="min-width:240px;">
            <option value="">— Select the correct answer —</option>
            ${bank.map((b) => `<option value="${escapeHtml(b.id)}" ${f.matchingAnswerId === b.id ? "selected" : ""}>${escapeHtml(b.text) || "(untitled)"}</option>`).join("")}
          </select>
        </div>
      `;
      el.querySelector(".f-matching-answer").addEventListener("change", (e) => (f.matchingAnswerId = e.target.value));
    }
    if (f.kind === "labelling") {
      const pinWrap = document.createElement("div");
      pinWrap.className = "label-pin-wrap";
      el.appendChild(pinWrap);
      renderLabelPointPicker(pinWrap, sec, f, rerender);
    }
  }

  // Widget đặt pin lên ảnh sơ đồ cho câu hỏi dạng labelling — click vào
  // ảnh để đặt vị trí pin (lưu dạng % để không phụ thuộc độ phân giải).
  function renderLabelPointPicker(container, sec, f, rerender) {
    const img = sec.imageId ? imagesCache.find((i) => i._id === sec.imageId) : null;
    if (!img) {
      container.innerHTML = `<div class="kind-hint warn">Add a diagram/map image to this section first (see "Illustration" above).</div>`;
      return;
    }
    container.innerHTML = `
      <div class="f-group">
        <label>Pin position — click on the image where this question's numbered label should sit</label>
        <div class="label-pin-imgwrap"><img src="${img.cloudinaryUrl}" draggable="false" /></div>
      </div>
    `;
    const wrap = container.querySelector(".label-pin-imgwrap");
    const imgEl = wrap.querySelector("img");

    function drawMarkers() {
      wrap.querySelectorAll(".pin-marker").forEach((m) => m.remove());
      (sec.fields || []).forEach((other) => {
        if (other.kind !== "labelling" || other.pinX == null || other.pinY == null) return;
        const marker = document.createElement("span");
        marker.className = "pin-marker" + (other.id === f.id ? " current" : "");
        marker.style.left = other.pinX + "%";
        marker.style.top = other.pinY + "%";
        marker.textContent = other.id;
        wrap.appendChild(marker);
      });
    }

    wrap.addEventListener("click", (e) => {
      const rect = imgEl.getBoundingClientRect();
      f.pinX = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
      f.pinY = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
      drawMarkers();
    });

    if (imgEl.complete) drawMarkers();
    else imgEl.addEventListener("load", drawMarkers);
  }

  // Nhập nhanh nhiều câu hỏi dạng "fill in the blank" cùng lúc: mỗi dòng
  // "câu hỏi | đáp án đúng (cách nhau bằng dấu chấm phẩy)".
  function showImportQuestionsModal(onImport) {
    showModal("Import questions", `
      <p style="color:var(--muted); font-size:.86rem; margin-top:0;">
        One question per line, format: <code>question text | correct answer(s)</code>.
        Separate multiple accepted answers with <code>;</code>. Imported questions default to "Fill in the blank" — you can change the type afterwards.
      </p>
      <textarea id="importQuestionsText" rows="8" style="width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font-family:inherit; font-size:.88rem;" placeholder="What is the capital of France? | Paris
The train departs at ___. | 9am; nine o'clock"></textarea>
      <div style="margin-top:14px; text-align:right;">
        <button type="button" class="btn" id="btnDoImportQuestions">Import</button>
      </div>
    `);
    document.getElementById("btnDoImportQuestions").addEventListener("click", () => {
      const lines = document.getElementById("importQuestionsText").value.split("\n").map((l) => l.trim()).filter(Boolean);
      const rows = lines.map((line) => {
        const [label, answers] = line.split("|");
        return {
          label: (label || "").trim(),
          answersText: (answers || "").split(";").map((a) => a.trim()).filter(Boolean).join("\n")
        };
      }).filter((r) => r.label);
      if (rows.length) onImport(rows);
      document.querySelector(".modal-overlay").remove();
    });
  }

  const QUESTION_KIND_BADGE = { fill: "Fill", mcq: "MCQ", tfng: "TFNG", ynng: "YNNG", matching: "Matching", labelling: "Labelling" };

  // Import hàng loạt section + câu hỏi từ file CSV giáo viên tải lên. Chỉ
  // parse & xem trước ở đây (gọi api/admin/import, KHÔNG ghi DB) — sau khi
  // giáo viên bấm "Import into builder", dữ liệu được đổ thẳng vào
  // sectionsArr đang mở (Test builder hoặc 1 Exercise trong Unit) để họ
  // xem/sửa như bình thường rồi mới bấm Lưu — đó chính là bước "review".
  function openSpreadsheetImportModal(sectionsArr, rerender) {
    showModal("Import from spreadsheet (CSV)", `
      <p style="color:var(--muted); font-size:.86rem; margin-top:0;">
        Upload a CSV file to create several sections and questions at once. Each row is one question.
        Columns: <code>Section, Question, Type, Option 1-8, Correct Answer, Score</code>.
        <b>Type</b> is one of <code>Fill</code>, <code>MCQ</code>, <code>TFNG</code>, <code>YNNG</code>, <code>Matching</code>, <code>Labelling</code> — see the sample for exact examples of each.
      </p>
      <p style="color:var(--muted); font-size:.86rem;">
        This only imports questions — for a <b>Listening</b> or <b>Reading</b> mock test, remember to still pick an audio track / paste the passage text on each imported section afterwards (required before you can publish),
        unless you also attach a content file below.
      </p>
      <a href="assets/templates/question-import-template.csv" download class="btn secondary" style="display:inline-flex;"><svg class="icon"><use href="#icon-upload"></use></svg> Download sample template</a>
      <div class="form-row" style="margin-top:16px; margin-bottom:0;">
        <label>CSV file (questions)</label>
        <input type="file" id="importCsvFile" accept=".csv,text/csv" />
      </div>
      <div class="form-row" style="margin-top:12px; margin-bottom:0;">
        <label>Content file (optional) — passage text / track info</label>
        <input type="file" id="importContentCsvFile" accept=".csv,text/csv" />
        <span style="color:var(--muted); font-size:.8rem;">Columns: <code>Passage_ID/Track_ID, Tieu_de, Noi_dung</code> (Reading) — join by matching the <b>Section</b> column above to this file's ID column.</span>
      </div>
      <div id="importCsvStatus" class="notice error" style="display:none; margin-top:14px;"></div>
      <div style="margin-top:16px; text-align:right;">
        <button type="button" class="btn" id="btnImportCsvUpload">Upload &amp; Preview</button>
      </div>
    `);

    document.getElementById("btnImportCsvUpload").addEventListener("click", async () => {
      const fileInput = document.getElementById("importCsvFile");
      const contentFileInput = document.getElementById("importContentCsvFile");
      const statusEl = document.getElementById("importCsvStatus");
      const file = fileInput.files[0];
      const contentFile = contentFileInput.files[0];
      statusEl.style.display = "none";
      if (!file) {
        statusEl.textContent = "Please choose a CSV file first.";
        statusEl.style.display = "block";
        return;
      }
      const btn = document.getElementById("btnImportCsvUpload");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Uploading...';
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (contentFile) fd.append("contentFile", contentFile);
        const data = await Api.admin.importQuestions(fd);
        renderImportReview(data.sections || [], data.warnings || [], sectionsArr, rerender, !!contentFile);
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Upload & Preview";
      }
    });
  }

  function renderImportReview(sections, warnings, sectionsArr, rerender, contentFileUsed) {
    const totalQuestions = sections.reduce((n, s) => n + s.fields.length, 0);
    const warnHtml = warnings.length
      ? `<div class="notice error" style="margin-top:0;"><b>${warnings.length} warning(s):</b><br>${warnings.map((w) => escapeHtml(w)).join("<br>")}</div>`
      : "";
    const listHtml = sections
      .map((s) => {
        const passageBadge = contentFileUsed
          ? (s.passageText
            ? '<span class="pill pill-ok">Passage text auto-filled</span>'
            : '<span class="pill pill-warn">Attach manually</span>')
          : "";
        return `<div class="preview-section-title">${escapeHtml(s.name)} ${passageBadge}</div>` +
        s.fields.map((f) => `<div class="preview-q">
          <div class="pq-label">${escapeHtml(f.label)}</div>
          <div class="pq-meta"><span class="pill pill-info">${QUESTION_KIND_BADGE[f.kind] || f.kind}</span><span>Score: ${f.score}</span></div>
        </div>`).join("");
      })
      .join("");

    const modalBody = document.querySelector(".modal-body");
    modalBody.innerHTML = `
      ${warnHtml}
      <p style="font-weight:700; color:var(--ink);">${sections.length} section(s), ${totalQuestions} question(s) ready to import.</p>
      <div style="max-height:340px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; padding:0 14px;">
        ${listHtml || '<div class="empty-state">Nothing to import.</div>'}
      </div>
      <div style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn secondary" id="btnImportCancel">Cancel</button>
        <button type="button" class="btn" id="btnImportConfirm" ${totalQuestions ? "" : "disabled"}>Import into builder</button>
      </div>
    `;
    document.getElementById("btnImportCancel").addEventListener("click", () => document.querySelector(".modal-overlay").remove());
    document.getElementById("btnImportConfirm").addEventListener("click", () => {
      // Tính id bắt đầu 1 lần rồi tự tăng dần — không gọi lại nextFieldIdFor()
      // trong lúc lặp vì sectionsArr chưa được cập nhật nên sẽ trả về cùng
      // 1 giá trị, gây trùng id giữa các câu hỏi mới import.
      let nextId = nextFieldIdFor(sectionsArr);
      sections.forEach((s) => {
        const matchBank = (s.matchBankTexts || []).map((text) => ({ id: newOptionId(), text }));
        const fields = s.fields.map((f) => {
          const field = { ...f, id: nextId++ };
          if (f.kind === "matching" || f.kind === "labelling") {
            const bankEntry = matchBank.find((b) => b.text.toLowerCase() === (f.matchingBankText || "").toLowerCase());
            field.matchingAnswerId = bankEntry ? bankEntry.id : "";
          }
          delete field.matchingBankText;
          return field;
        });
        const sec = emptySection();
        sec.name = s.name;
        sec.passageText = s.passageText || "";
        sec.matchBank = matchBank;
        sec.fields = fields;
        sectionsArr.push(sec);
      });
      document.querySelector(".modal-overlay").remove();
      rerender();
    });
  }

  // Chuyển 1 field dạng editor (kind-based, không còn cú pháp value|label)
  // sang shape API {type, options, answers, selectCount} mà server hiểu.
  function fieldToServer(f) {
    const base = {
      id: Number(f.id),
      label: f.label,
      hint: f.hint || "",
      score: Math.max(1, Number(f.score) || 1)
    };
    if (f.kind === "fill") {
      return {
        ...base,
        type: "fill",
        pre: f.pre,
        post: f.post,
        selectCount: 1,
        options: [],
        answers: String(f.answersText || "")
          .split(/[\n,]/)
          .map((a) => a.trim())
          .filter(Boolean)
      };
    }
    if (f.kind === "matching" || f.kind === "labelling") {
      return {
        ...base,
        type: "choice",
        pre: "",
        post: "",
        selectCount: 1,
        options: [],
        answers: f.matchingAnswerId ? [f.matchingAnswerId] : []
      };
    }
    // mcq / tfng — đúng-sai suy ra trực tiếp từ những ô đã tick, giáo viên
    // không cần tự đếm hay tự đồng bộ "select count".
    const correct = (f.options || []).filter((o) => (f.correctOptionIds || []).includes(o.id));
    return {
      ...base,
      type: "choice",
      pre: "",
      post: "",
      selectCount: Math.max(1, correct.length),
      options: (f.options || []).map((o) => ({ value: o.id, label: o.text })),
      answers: correct.map((o) => o.id)
    };
  }

  // Chuyển 1 field từ API về dạng editor — tự suy luận kind từ shape dữ
  // liệu (0 options -> matching/labelling tuỳ labelPoints; đúng 3 options
  // true/false/ng hoặc yes/no/ng -> tfng/ynng; ngược lại -> mcq) để tương
  // thích ngược với dữ liệu đã lưu trước đây. `s` (section) cần để tra
  // labelPoints — labelPoints nằm ở section, không phải ở field.
  function fieldFromServer(f, s) {
    const type = f.type || "fill";
    const score = f.score || 1;
    if (type === "fill") {
      return {
        id: f.id, label: f.label || "", kind: "fill", pre: f.pre || "", post: f.post || "", hint: f.hint || "", score,
        answersText: (f.answers || []).join("\n"), options: [], correctOptionIds: [], matchingAnswerId: "", selectCount: 1,
        pinX: null, pinY: null
      };
    }
    const opts = f.options || [];
    if (opts.length === 0) {
      // Phân biệt matching / labelling bằng tra cứu chính xác theo fieldId
      // trong labelPoints của section — không đoán theo shape vì cả hai
      // đều lưu cùng dạng {type:"choice", options:[]}.
      const labelPoint = (s && s.labelPoints || []).find((lp) => String(lp.fieldId) === String(f.id));
      return {
        id: f.id, label: f.label || "", kind: labelPoint ? "labelling" : "matching", pre: "", post: "", hint: f.hint || "", score,
        answersText: "", options: [], correctOptionIds: [], matchingAnswerId: (f.answers || [])[0] || "", selectCount: f.selectCount || 1,
        pinX: labelPoint ? labelPoint.x : null, pinY: labelPoint ? labelPoint.y : null
      };
    }
    const valueSet = opts.map((o) => String(o.value || "").toLowerCase()).sort().join(",");
    const isTFNG = opts.length === 3 && valueSet === "false,ng,true";
    const isYNNG = opts.length === 3 && valueSet === "ng,no,yes";
    const kind = isTFNG ? "tfng" : isYNNG ? "ynng" : "mcq";
    return {
      id: f.id, label: f.label || "", kind, pre: "", post: "", hint: f.hint || "", score,
      answersText: "", options: opts.map((o) => ({ id: o.value, text: o.label })), correctOptionIds: f.answers || [],
      matchingAnswerId: "", selectCount: f.selectCount || 1,
      pinX: null, pinY: null
    };
  }

  // Chuyển sections dạng editor sang payload API — dùng chung cho cả Test
  // builder và Exercise trong Unit.
  function sectionsPayloadFrom(sectionsArr, subject) {
    return sectionsArr.map((sec) => ({
      name: sec.name,
      audioId: subject === "listening" ? (sec.audioId || null) : null,
      passageText: subject === "reading" ? sec.passageText : "",
      imageId: sec.imageId || null,
      matchOptions: (sec.matchBank || []).filter((b) => b.text.trim()).map((b) => ({ value: b.id, label: b.text.trim() })),
      // Rebuild fresh từ field list hiện tại mỗi lần lưu — xoá câu hỏi
      // labelling thì pin của nó tự động biến mất theo, không cần dọn riêng.
      labelPoints: (sec.fields || [])
        .filter((f) => f.kind === "labelling" && f.pinX != null && f.pinY != null)
        .map((f) => ({ fieldId: Number(f.id), x: f.pinX, y: f.pinY })),
      fields: sec.fields.map(fieldToServer)
    }));
  }

  // Chuyển sections từ API sang dạng editor (khi mở Test/Unit đã có).
  function sectionsToEditor(serverSections) {
    return (serverSections || []).map((s) => ({
      name: s.name || "",
      audioId: s.audioId && (s.audioId._id || s.audioId),
      passageText: s.passageText || "",
      imageId: s.imageId && (s.imageId._id || s.imageId),
      matchBank: (s.matchOptions || []).map((o) => ({ id: o.value, text: o.label })),
      fields: (s.fields || []).map((f) => fieldFromServer(f, s))
    }));
  }

  function buildTestSkillsPayload() {
    const out = {};
    TEST_QUESTION_SKILLS.forEach((key) => {
      const skill = builderSkills[key];
      out[key] = {
        durationMinutes: skill.durationMinutes || null,
        instructions: skill.instructions || "",
        sections: sectionsPayloadFrom(skill.sections, key)
      };
    });
    ["writing", "speaking"].forEach((key) => {
      const skill = builderSkills[key];
      out[key] = {
        durationMinutes: skill.durationMinutes || null,
        instructions: skill.instructions || "",
        prompts: skill.prompts.map((p) => ({ _id: p._id, title: p.title, instructions: p.instructions, imageId: p.imageId || null }))
      };
    });
    return out;
  }

  function saveTest(status) {
    const statusEl = document.getElementById("builderStatus");
    statusEl.style.display = "none";

    const payload = {
      title: document.getElementById("tbTitle").value.trim(),
      unit: document.getElementById("tbUnit").value.trim(),
      level: Number(document.getElementById("tbLevel").value) || 1,
      opensAt: document.getElementById("tbOpensAt").value ? new Date(document.getElementById("tbOpensAt").value).toISOString() : null,
      closesAt: document.getElementById("tbClosesAt").value ? new Date(document.getElementById("tbClosesAt").value).toISOString() : null,
      skills: buildTestSkillsPayload()
    };

    if (!payload.title) {
      statusEl.style.display = "block";
      statusEl.textContent = "Please enter a test title.";
      return;
    }

    if (payload.opensAt && payload.closesAt && payload.opensAt >= payload.closesAt) {
      statusEl.className = "notice error";
      statusEl.style.display = "block";
      statusEl.textContent = "Opening time must be before closing time.";
      return;
    }

    const save = editingTestId ? Api.admin.updateTest(editingTestId, payload) : Api.admin.createTest(payload);

    save
      .then((data) => {
        const id = editingTestId || data.test._id;
        return Api.admin.updateTest(id, { status });
      })
      .then(() => {
        closeBuilder();
        loadTestsList();
        loadOverview();
      })
      .catch((err) => {
        statusEl.style.display = "block";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  // ============================================================
  //  SUBMISSIONS
  // ============================================================
  document.getElementById("btnRefresh").addEventListener("click", loadSubmissions);
  document.getElementById("searchBox").addEventListener("input", () => renderResultsTable());
  document.getElementById("filterTest").addEventListener("change", loadSubmissions);
  document.getElementById("filterSubject").addEventListener("change", () => renderResultsTable());
  document.getElementById("filterKind").addEventListener("change", loadSubmissions);

  function renderTestFilterOptions() {
    const sel = document.getElementById("filterTest");
    const current = sel.value;
    sel.innerHTML =
      '<option value="">All Mock Tests</option>' +
      testsCache.map((t) => `<option value="${t._id}">${escapeHtml(t.unit ? t.unit + " · " : "") + escapeHtml(t.title)}</option>`).join("");
    sel.value = current;
  }

  function loadSubmissions() {
    const statusEl = document.getElementById("loadStatus");
    const table = document.getElementById("resultsTable");
    table.style.display = "none";
    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.innerHTML = '<span class="spinner"></span> Loading data...';

    const testId = document.getElementById("filterTest").value;
    const kind = document.getElementById("filterKind").value;
    const params = {};
    if (testId) params.testId = testId;
    if (kind) params.kind = kind;
    Api.admin
      .listSubmissions(params)
      .then((data) => {
        allSubmissions = data.rows || [];
        statusEl.style.display = "none";
        table.style.display = "table";
        renderSummary(allSubmissions);
        renderResultsTable();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function filterRows() {
    const q = (document.getElementById("searchBox").value || "").trim().toLowerCase();
    const sub = document.getElementById("filterSubject").value;

    let filtered = allSubmissions;
    if (q) {
      filtered = filtered.filter((r) => String(r.studentName || "").toLowerCase().includes(q));
    }
    if (sub) {
      filtered = filtered.filter((r) => {
        if (r.testSkill) return r.testSkill === sub;
        if (r.categoryKey) return r.categoryKey === sub;
        return false;
      });
    }
    return filtered;
  }

  function renderSummary(rows) {
    const box = document.getElementById("summaryBox");
    if (!rows.length) {
      box.textContent = "No student submissions found.";
      return;
    }
    const uniqueNames = new Set(rows.map((r) => r.studentName)).size;
    const avg = rows.reduce((sum, r) => sum + (Number(r.score) / Math.max(Number(r.total), 1)) * 100, 0) / rows.length;
    box.textContent = `Total submissions: ${rows.length} · Unique students: ${uniqueNames} · Average score: ${avg.toFixed(0)}%`;
  }

  const KIND_LABELS = { test: "Mock Test", exercise: "Lesson Exercise", writing: "Writing", speaking: "Speaking" };

  function renderResultsTable() {
    const rows = filterRows();
    const body = document.getElementById("resultsBody");
    body.innerHTML = "";
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--muted);">No data available</td></tr>';
      return;
    }
    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      const time = r.submittedAt ? new Date(r.submittedAt).toLocaleString("en-US") : "";
      const kind = r.kind || "test";
      const title =
        kind === "test" ? (r.testTitle || "")
        : kind === "exercise" ? (r.exerciseTitle || "")
        // writing/speaking từ Mock Test có testTitle; từ Lesson Unit thì không.
        : r.testTitle ? `${r.testTitle} — ${kind === "writing" ? "Writing" : "Speaking"} Prompt`
        : (kind === "writing" ? "Writing Prompt" : "Speaking Prompt");
      let scoreHtml;
      if (kind === "writing" || kind === "speaking") {
        scoreHtml = r.gradingStatus === "graded"
          ? "<b>" + r.manualScore + "</b>"
          : '<span class="pill pill-warn">Pending Review</span>';
      } else {
        scoreHtml = "<b>" + r.score + "</b> / " + r.total;
      }
      tr.innerHTML = `
        <td>${time}</td>
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(title)}</td>
        <td><span class="pill pill-muted">${KIND_LABELS[kind] || kind}</span></td>
        <td>${scoreHtml}</td>
        <td>${kind === "test" && r.replayCount != null ? r.replayCount : "-"}</td>
        <td><button class="btn secondary" style="padding:6px 12px; font-size:.8rem;" data-idx="${idx}">Details</button></td>
      `;
      body.appendChild(tr);

      const detailTr = document.createElement("tr");
      detailTr.style.display = "none";
      const td = document.createElement("td");
      td.colSpan = 7;
      td.style.background = "#fafcfe";
      td.innerHTML = formatSubmissionDetail(r);
      detailTr.appendChild(td);
      body.appendChild(detailTr);

      tr.querySelector("button").addEventListener("click", () => {
        detailTr.style.display = detailTr.style.display === "none" ? "table-row" : "none";
      });

      if (kind === "writing" || kind === "speaking") {
        wireGradingForm(td, r);
      }
    });
  }

  function formatSubmissionDetail(r) {
    const kind = r.kind || "test";
    if (kind === "writing") {
      return `<div style="padding:10px 14px;"><b>Student Essay:</b>
        <div style="white-space:pre-wrap; margin:8px 0 12px; padding:10px; background:#fff; border:1px solid var(--border); border-radius:6px;">${escapeHtml(r.essayText || "(empty)")}</div>
        ${gradingFormHtml(r)}</div>`;
    }
    if (kind === "speaking") {
      return `<div style="padding:10px 14px;"><b>Student Audio Recording:</b>
        <div style="margin:8px 0 12px;"><audio controls src="${r.audioUrl || ""}"></audio></div>
        ${gradingFormHtml(r)}</div>`;
    }
    return formatAnswers(r.answers);
  }

  function gradingFormHtml(r) {
    if (r.gradingStatus === "graded") {
      return `<div class="pill pill-ok">Graded: ${r.manualScore} pts</div>
        <div style="margin-top:6px; color:var(--muted);">Feedback: ${escapeHtml(r.manualFeedback || "(none)")}</div>`;
    }
    return `<div class="grading-form">
      <input type="number" class="grade-score" step="0.5" min="0" placeholder="Score" style="width:90px;" />
      <textarea class="grade-feedback" rows="2" placeholder="Feedback for student..." style="flex:1; min-width:200px;"></textarea>
      <button type="button" class="btn btn-grade-save" style="padding:8px 16px;">Save Grade</button>
    </div>`;
  }

  function wireGradingForm(td, r) {
    const btn = td.querySelector(".btn-grade-save");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const manualScore = td.querySelector(".grade-score").value;
      const manualFeedback = td.querySelector(".grade-feedback").value;
      if (manualScore === "") {
        alert("Please enter a score.");
        return;
      }
      btn.disabled = true;
      Api.admin
        .gradeSubmission(r._id, { manualScore: Number(manualScore), manualFeedback })
        .then(() => loadSubmissions())
        .catch((err) => {
          alert("Failed to save grade: " + err.message);
          btn.disabled = false;
        });
    });
  }

  function formatAnswers(answers) {
    if (!answers) return "<em>No details available</em>";
    let obj = answers;
    if (typeof answers === "string") {
      try {
        obj = JSON.parse(answers);
      } catch (e) {
        return escapeHtml(answers);
      }
    }
    const items = Object.keys(obj)
      .map((k) => {
        const val = obj[k];
        const displayVal = Array.isArray(val) ? val.join(", ") : val;
        return `<div><b>Question ${escapeHtml(k)}:</b> ${escapeHtml(displayVal || "(blank)")}</div>`;
      })
      .join("");
    return `<div style="padding:10px 14px;">${items}</div>`;
  }

  // ============================================================
  //  STUDENT MANAGEMENT
  // ============================================================
  document.getElementById("btnCreateStudent").addEventListener("click", createStudent);

  function createStudent() {
    const statusEl = document.getElementById("createStudentStatus");
    statusEl.style.display = "none";

    const payload = {
      name: document.getElementById("newStudentName").value.trim(),
      username: document.getElementById("newStudentUsername").value.trim(),
      password: document.getElementById("newStudentPassword").value,
      level: Number(document.getElementById("newStudentLevel").value) || 1
    };

    Api.admin
      .createStudent(payload)
      .then(() => {
        statusEl.className = "notice success";
        statusEl.textContent = "Student account created successfully.";
        statusEl.style.display = "block";
        document.getElementById("newStudentName").value = "";
        document.getElementById("newStudentUsername").value = "";
        document.getElementById("newStudentPassword").value = "";
        document.getElementById("newStudentLevel").value = 1;
        loadStudentsList();
        loadOverview();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.textContent = err.message;
        statusEl.style.display = "block";
      });
  }

  function loadStudentsList() {
    const statusEl = document.getElementById("studentsListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Loading...";

    Api.admin
      .listStudents()
      .then((data) => {
        statusEl.style.display = "none";
        renderStudentsTable(data.rows || []);
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function renderStudentsTable(students) {
    const table = document.getElementById("studentsTable");
    const body = document.getElementById("studentsBody");
    body.innerHTML = "";

    if (!students.length) {
      document.getElementById("studentsListStatus").style.display = "block";
      document.getElementById("studentsListStatus").textContent = "No student accounts found.";
      table.style.display = "none";
      return;
    }

    document.getElementById("studentsListStatus").style.display = "none";
    table.style.display = "table";

    students.forEach((s) => {
      const tr = document.createElement("tr");
      const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US") : "-";
      tr.innerHTML = `
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.username)}</td>
        <td>${s.level != null ? "Level " + s.level : "-"}</td>
        <td>${date}</td>
        <td>${s.submissionCount != null ? s.submissionCount : 0}</td>
        <td>
          <button class="btn secondary btn-reset-pw" style="padding:4px 8px; font-size:.8rem; margin-right:6px;">Reset Password</button>
          <button class="btn secondary danger btn-del-student" style="padding:4px 8px; font-size:.8rem; border-color: var(--red); color: var(--red);">Delete</button>
        </td>
      `;
      tr.querySelector(".btn-reset-pw").addEventListener("click", () => resetStudentPassword(s._id, s.name));
      tr.querySelector(".btn-del-student").addEventListener("click", () => deleteStudent(s._id, s.name));
      body.appendChild(tr);
    });
  }

  function resetStudentPassword(id, name) {
    const pw = prompt(`Enter new password for student ${name} (minimum 6 characters):`);
    if (pw === null) return;
    if (pw.trim().length < 6) {
      alert("New password is too short.");
      return;
    }
    Api.admin
      .resetStudentPassword(id, pw.trim())
      .then(() => alert("Password reset successfully."))
      .catch((err) => alert("Failed to reset password: " + err.message));
  }

  function deleteStudent(id, name) {
    if (!confirm(`Delete student account for ${name}? All submission history will be lost and cannot be restored.`)) return;
    Api.admin
      .deleteStudent(id)
      .then(() => {
        loadStudentsList();
        loadOverview();
      })
      .catch((err) => alert("Failed to delete student: " + err.message));
  }

  // ============================================================
  //  UNIT MANAGEMENT
  // ============================================================
  const CATEGORY_KEYS = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];
  const CATEGORY_LABELS = {
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
    speaking: "Speaking"
  };
  const CATEGORY_ICONS = {
    grammar: "grammar",
    vocabulary: "vocabulary",
    listening: "headphones",
    reading: "book-open",
    writing: "writing",
    speaking: "mic"
  };

  let unitsCache = [];
  let unitEditing = null; // editor copy
  let unitCatKey = "grammar";
  let unitSubTab = "theory";

  document.getElementById("btnCreateUnit").addEventListener("click", createUnit);
  document.getElementById("btnSaveUnit").addEventListener("click", () => saveUnit(null));
  document.getElementById("btnPublishUnit").addEventListener("click", () => saveUnit("published"));
  document.getElementById("btnCancelUnit").addEventListener("click", closeUnitEditor);
  document.getElementById("btnPreviewUnit").addEventListener("click", () => {
    if (!unitEditing) return;
    showModal(unitEditing.name || "(untitled unit)", previewUnitHtml(unitEditing));
  });

  function previewUnitHtml(unit) {
    return CATEGORY_KEYS
      .map((key) => {
        const cat = unit.categories.find((c) => c.key === key);
        if (!cat || !categoryHasContent(cat)) return "";
        let body = "";
        if ((cat.theory.html || "").trim()) {
          body += `<div class="preview-q"><div class="pq-label">Theory</div><div class="pq-meta" style="white-space:pre-line; color:var(--ink);">${escapeHtml(cat.theory.html)}</div></div>`;
        }
        (cat.exercises || []).forEach((ex) => {
          body += `<div class="preview-q"><div class="pq-label">${escapeHtml(ex.title) || "(untitled exercise)"}</div></div>` + previewSectionsHtml(ex._sections || []);
        });
        (cat.prompts || []).forEach((p) => {
          body += `<div class="preview-q"><div class="pq-label">${escapeHtml(p.title) || "(untitled prompt)"}</div><div class="pq-meta" style="white-space:pre-line; color:var(--ink);">${escapeHtml(p.instructions)}</div></div>`;
        });
        return `<div class="preview-section-title">${CATEGORY_LABELS[key]}</div>${body}`;
      })
      .join("") || '<div class="empty-state">No content added yet.</div>';
  }

  function createUnit() {
    const statusEl = document.getElementById("createUnitStatus");
    statusEl.style.display = "none";

    const name = document.getElementById("newUnitName").value.trim();
    const level = Number(document.getElementById("newUnitLevel").value) || 1;

    if (!name) {
      statusEl.style.display = "block";
      statusEl.className = "notice error";
      statusEl.textContent = "Please enter a Unit name.";
      return;
    }

    Api.admin
      .createUnit({ name, level })
      .then((data) => {
        statusEl.className = "notice success";
        statusEl.textContent = "Unit created — opening editor.";
        statusEl.style.display = "block";
        document.getElementById("newUnitName").value = "";
        loadUnitsList();
        loadOverview();
        openUnitEditor(data.unit._id);
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.textContent = err.message;
        statusEl.style.display = "block";
      });
  }

  function loadUnitsList() {
    const statusEl = document.getElementById("unitsListStatus");
    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.textContent = "Loading...";

    Api.admin
      .listUnits()
      .then((data) => {
        unitsCache = data.rows || [];
        statusEl.style.display = "none";
        renderUnitsList();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function renderUnitsList() {
    const listEl = document.getElementById("unitsList");
    if (!unitsCache.length) {
      listEl.innerHTML = '<div class="empty-state">No units found. Create a new Unit using the form above.</div>';
      return;
    }
    listEl.innerHTML = "";
    unitsCache.forEach((u) => {
      const exerciseCount = (u.categories || []).reduce((n, c) => n + (c.exercises || []).length, 0);
      const promptCount = (u.categories || []).reduce((n, c) => n + (c.prompts || []).length, 0);
      const row = document.createElement("div");
      row.className = "test-item";
      row.innerHTML = `
        <div class="meta">
          <h4>${escapeHtml(u.name)}
            <span class="status-pill ${u.status}">${u.status === "published" ? "Published" : "Draft"}</span>
          </h4>
          <p>Level ${u.level != null ? u.level : "-"} · ${exerciseCount} exercises · ${promptCount} prompts</p>
        </div>
        <div class="actions">
          <button class="icon-btn" title="Edit"><svg class="icon"><use href="#icon-edit"></use></svg></button>
          <button class="icon-btn danger" title="Delete"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector('[title="Edit"]').addEventListener("click", () => openUnitEditor(u._id));
      row.querySelector(".danger").addEventListener("click", () => deleteUnit(u._id, u.name));
      listEl.appendChild(row);
    });
  }

  function deleteUnit(id, name) {
    if (!confirm(`Delete Unit "${name}"? This action cannot be undone.`)) return;
    Api.admin
      .deleteUnit(id)
      .then(() => {
        loadUnitsList();
        loadOverview();
      })
      .catch((err) => alert("Failed to delete Unit: " + err.message));
  }

  function openUnitEditor(unitId) {
    Api.admin
      .getUnit(unitId)
      .then((data) => {
        const u = data.unit;
        const refId = (v) => (v && typeof v === "object" ? v._id : v) || "";
        unitEditing = {
          _id: u._id,
          name: u.name || "",
          level: u.level,
          status: u.status,
          categories: (u.categories || []).map((c) => ({
            _id: c._id,
            key: c.key,
            theory: {
              html: (c.theory && c.theory.html) || "",
              audioId: refId(c.theory && c.theory.audioId),
              imageId: refId(c.theory && c.theory.imageId)
            },
            exercises: (c.exercises || []).map((ex) => ({
              _id: ex._id,
              title: ex.title || "",
              _sections: sectionsToEditor(ex.sections)
            })),
            prompts: (c.prompts || []).map((p) => ({
              _id: p._id,
              title: p.title || "",
              instructions: p.instructions || "",
              imageId: refId(p.imageId)
            }))
          }))
        };
        unitCatKey = CATEGORY_KEYS[0];
        unitSubTab = "theory";
        document.getElementById("unitListCard").style.display = "none";
        document.getElementById("unitEditor").style.display = "block";
        document.getElementById("unitEditorStatus").style.display = "none";
        renderUnitEditor();
        document.getElementById("unitEditor").scrollIntoView({ behavior: "smooth" });
      })
      .catch((err) => alert("Failed to load Unit: " + err.message));
  }

  function closeUnitEditor() {
    unitEditing = null;
    document.getElementById("unitEditor").style.display = "none";
    document.getElementById("unitListCard").style.display = "block";
  }

  function currentUnitCategory() {
    if (!unitEditing) return null;
    return unitEditing.categories.find((c) => c.key === unitCatKey) || null;
  }

  function renderUnitEditor() {
    if (!unitEditing) return;
    document.getElementById("unitEditorHeading").textContent = "Edit Unit: " + unitEditing.name;
    renderUnitCatTabs();
    renderUnitSubTabs();
    renderUnitCatContent();
  }

  function categoryHasContent(cat) {
    if (!cat) return false;
    if ((cat.theory.html || "").trim()) return true;
    if ((cat.exercises || []).length) return true;
    if ((cat.prompts || []).length) return true;
    return false;
  }

  function renderUnitCatTabs() {
    const wrap = document.getElementById("unitCatTabs");
    wrap.innerHTML = "";
    CATEGORY_KEYS.forEach((key) => {
      const cat = unitEditing.categories.find((c) => c.key === key);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "unit-cat-tab" + (key === unitCatKey ? " active" : "");
      btn.innerHTML =
        Icon(CATEGORY_ICONS[key]) + " " + CATEGORY_LABELS[key] +
        (categoryHasContent(cat) ? `<span class="cat-done">${Icon("check")}</span>` : "");
      btn.addEventListener("click", () => {
        unitCatKey = key;
        unitSubTab = "theory";
        renderUnitEditor();
      });
      wrap.appendChild(btn);
    });
  }

  function renderUnitSubTabs() {
    const wrap = document.getElementById("unitSubTabs");
    wrap.innerHTML = "";
    const isPromptCat = unitCatKey === "writing" || unitCatKey === "speaking";
    const tabs = [
      { key: "theory", label: "Theory" },
      { key: "practice", label: isPromptCat ? "Prompts" : "Exercises" }
    ];
    tabs.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "unit-subtab" + (t.key === unitSubTab ? " active" : "");
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        unitSubTab = t.key;
        renderUnitSubTabs();
        renderUnitCatContent();
      });
      wrap.appendChild(btn);
    });
  }

  function renderUnitCatContent() {
    const content = document.getElementById("unitCatContent");
    const cat = currentUnitCategory();
    content.innerHTML = "";
    if (!cat) return;

    const nameRow = document.createElement("div");
    nameRow.className = "form-row";
    nameRow.innerHTML = `<label>Unit Name</label><input type="text" class="unit-name-input" value="${escapeHtml(unitEditing.name)}" />`;
    nameRow.querySelector("input").addEventListener("input", (e) => {
      unitEditing.name = e.target.value;
      document.getElementById("unitEditorHeading").textContent = "Edit Unit: " + unitEditing.name;
    });
    content.appendChild(nameRow);

    if (unitSubTab === "theory") {
      renderTheoryTab(content, cat);
    } else if (unitCatKey === "writing" || unitCatKey === "speaking") {
      renderPromptsTab(content, cat);
    } else {
      renderExercisesTab(content, cat);
    }
  }

  function renderTheoryTab(content, cat) {
    const box = document.createElement("div");
    box.innerHTML = `
      <div class="form-row">
        <label>Theory Content</label>
        <textarea rows="8" class="theory-html" placeholder="Theory content for ${CATEGORY_LABELS[unitCatKey]}...">${escapeHtml(cat.theory.html)}</textarea>
      </div>
      <div class="form-row">
        <label>Audio Illustration (optional)</label>
        <select class="select-inline section-audio-select" style="width:100%;"></select>
      </div>
      <div class="form-row">
        <label>Image Illustration (optional)</label>
        <select class="select-inline section-image-select" style="width:100%;"></select>
      </div>
    `;
    box.querySelector(".theory-html").addEventListener("input", (e) => (cat.theory.html = e.target.value));
    box.querySelector(".section-audio-select").addEventListener("change", (e) => (cat.theory.audioId = e.target.value));
    box.querySelector(".section-image-select").addEventListener("change", (e) => (cat.theory.imageId = e.target.value));
    content.appendChild(box);
    renderAudioSelectOptions(content);
    renderImageSelectOptions(content);
    if (cat.theory.audioId) box.querySelector(".section-audio-select").value = cat.theory.audioId;
    if (cat.theory.imageId) box.querySelector(".section-image-select").value = cat.theory.imageId;
  }

  function renderExercisesTab(content, cat) {
    const rerender = () => renderUnitCatContent();
    cat.exercises.forEach((ex, exIdx) => {
      const box = document.createElement("div");
      box.className = "builder-section";
      box.innerHTML = `
        <div class="builder-section-head">
          <input type="text" class="ex-title" placeholder="Exercise Title (e.g. Exercise 1)" style="flex:1;" value="${escapeHtml(ex.title)}" />
          <button class="icon-btn danger" title="Delete exercise"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
        <div class="ex-sections"></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          <button type="button" class="dashed-add-btn btn-add-ex-section" style="flex:1;">
            <svg class="icon"><use href="#icon-plus"></use></svg> Add Section
          </button>
          <button type="button" class="btn secondary btn-import-ex-spreadsheet" style="padding:8px 14px; font-size:.85rem;">
            <svg class="icon"><use href="#icon-upload"></use></svg> Import from spreadsheet
          </button>
        </div>
      `;
      box.querySelector(".ex-title").addEventListener("input", (e) => (ex.title = e.target.value));
      box.querySelector(".danger").addEventListener("click", () => {
        if (!confirm("Delete this exercise?")) return;
        cat.exercises.splice(exIdx, 1);
        rerender();
      });
      const rerenderExSections = () => renderSectionsEditor(box.querySelector(".ex-sections"), ex._sections, cat.key);
      rerenderExSections();
      box.querySelector(".btn-add-ex-section").addEventListener("click", () => {
        ex._sections.push(emptySection());
        rerenderExSections();
      });
      box.querySelector(".btn-import-ex-spreadsheet").addEventListener("click", () => {
        openSpreadsheetImportModal(ex._sections, rerenderExSections);
      });
      content.appendChild(box);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "dashed-add-btn";
    addBtn.style.marginTop = "10px";
    addBtn.innerHTML = '<svg class="icon"><use href="#icon-plus"></use></svg> Add Exercise';
    addBtn.addEventListener("click", () => {
      cat.exercises.push({ title: "", _sections: [] });
      rerender();
    });
    content.appendChild(addBtn);
  }

  // Trình soạn "prompts" (Writing/Speaking — đề bài, chấm tay) dùng chung
  // cho cả Lesson Unit và Mock Test 4-kỹ-năng: chỉ thao tác trên 1 mảng
  // prompts + 1 hàm rerender do nơi gọi cung cấp, không biết gì về context.
  function renderPromptsEditor(container, promptsArr, rerender) {
    container.innerHTML = "";
    promptsArr.forEach((p, pIdx) => {
      const box = document.createElement("div");
      box.className = "builder-section";
      box.innerHTML = `
        <div class="builder-section-head">
          <input type="text" class="p-title" placeholder="Prompt Title (e.g. Task 1)" style="flex:1;" value="${escapeHtml(p.title)}" />
          <button class="icon-btn danger" title="Delete prompt"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
        <div class="form-row" style="margin-bottom:10px;">
          <label>Instructions / Prompt details</label>
          <textarea class="p-instructions" rows="4" placeholder="Prompt details and instructions for students...">${escapeHtml(p.instructions)}</textarea>
        </div>
        <div class="form-row" style="margin-bottom:0;">
          <label>Image Illustration (optional)</label>
          <select class="select-inline section-image-select" style="width:100%;"></select>
        </div>
      `;
      box.querySelector(".p-title").addEventListener("input", (e) => (p.title = e.target.value));
      box.querySelector(".p-instructions").addEventListener("input", (e) => (p.instructions = e.target.value));
      box.querySelector(".section-image-select").addEventListener("change", (e) => (p.imageId = e.target.value));
      box.querySelector(".danger").addEventListener("click", () => {
        if (!confirm("Delete this prompt?")) return;
        promptsArr.splice(pIdx, 1);
        rerender();
      });
      container.appendChild(box);
      renderImageSelectOptions(box);
      if (p.imageId) box.querySelector(".section-image-select").value = p.imageId;
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "dashed-add-btn";
    addBtn.style.marginTop = "10px";
    addBtn.innerHTML = '<svg class="icon"><use href="#icon-plus"></use></svg> Add Prompt';
    addBtn.addEventListener("click", () => {
      promptsArr.push({ title: "", instructions: "", imageId: "" });
      rerender();
    });
    container.appendChild(addBtn);
  }

  function renderPromptsTab(content, cat) {
    renderPromptsEditor(content, cat.prompts, () => renderUnitCatContent());
  }

  function saveUnit(forceStatus) {
    const statusEl = document.getElementById("unitEditorStatus");
    statusEl.style.display = "none";
    if (!unitEditing) return;

    if (!unitEditing.name.trim()) {
      statusEl.className = "notice error";
      statusEl.textContent = "Please enter a Unit name.";
      statusEl.style.display = "block";
      return;
    }

    const payload = {
      name: unitEditing.name.trim(),
      categories: unitEditing.categories.map((cat) => ({
        _id: cat._id,
        key: cat.key,
        theory: {
          html: cat.theory.html,
          audioId: cat.theory.audioId || null,
          imageId: cat.theory.imageId || null
        },
        exercises: cat.exercises.map((ex) => ({
          _id: ex._id,
          title: ex.title,
          sections: sectionsPayloadFrom(ex._sections, cat.key)
        })),
        prompts: cat.prompts.map((p) => ({
          _id: p._id,
          title: p.title,
          instructions: p.instructions,
          imageId: p.imageId || null
        }))
      }))
    };
    if (forceStatus) payload.status = forceStatus;

    Api.admin
      .updateUnit(unitEditing._id, payload)
      .then(() => {
        closeUnitEditor();
        loadUnitsList();
        loadOverview();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
        statusEl.style.display = "block";
      });
  }

})();
