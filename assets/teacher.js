// ============================================================
//  LOGIC DASHBOARD GIÁO VIÊN (IELTS with Ms Nhi)
// ============================================================
(function () {
  let audioCache = [];
  let imagesCache = [];
  let testsCache = [];
  let allSubmissions = [];
  let builderSections = []; // state for the test being created/edited
  let editingTestId = null;
  let builderSubject = "listening"; // 'listening' | 'reading'

  // ---------- Đăng nhập ----------
  document.getElementById("btnLogin").addEventListener("click", tryLogin);
  document.getElementById("pw").addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
  document.getElementById("btnLogout").addEventListener("click", (e) => {
    e.preventDefault();
    Api.clearToken();
    location.reload();
  });

  function tryLogin() {
    const val = document.getElementById("pw").value;
    const errEl = document.getElementById("loginError");
    errEl.style.display = "none";
    Api.login(val)
      .then((data) => {
        Api.setToken(data.token);
        enterDashboard();
      })
      .catch((err) => {
        errEl.textContent = err.message;
        errEl.style.display = "block";
      });
  }

  function enterDashboard() {
    document.getElementById("step-login").style.display = "none";
    document.getElementById("step-dashboard").style.display = "block";
    document.getElementById("btnLogout").style.display = "inline";
    loadOverview();
    loadAudioList();
    loadImagesList();
    loadTestsList();
    loadSubmissions();
    loadStudentsList();
  }

  // Nếu đã đăng nhập từ trước trong phiên trình duyệt này -> vào thẳng dashboard
  if (Api.getToken()) enterDashboard();

  // ---------- Tabs ----------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    });
  });

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ============================================================
  //  TỔNG QUAN
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
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function statCard(icon, value, label) {
    return `<div class="stat-card">
      <svg class="icon icon-lg"><use href="#icon-${icon}"></use></svg>
      <div class="value">${value}</div>
      <div class="label">${label}</div>
    </div>`;
  }

  function renderStatGrid(s) {
    document.getElementById("statGrid").innerHTML = [
      statCard("clipboard", s.publishedTests + "/" + s.totalTests, "Bài kiểm tra đã công bố"),
      statCard("headphones", s.totalAudio, "Bài nghe trong thư viện"),
      statCard("list", s.totalSubmissions, "Lượt nộp bài"),
      statCard("student", s.uniqueStudents, "Học sinh đã làm bài"),
      statCard("chart-bar", s.avgScorePct + "%", "Điểm trung bình")
    ].join("");
  }

  function renderByTest(rows) {
    const body = document.getElementById("byTestBody");
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--muted);">Chưa có dữ liệu</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map((r) => {
        const test = testsCache.find((t) => t._id === r.testId || t.title === r.testTitle);
        const subText = test ? (test.subject === "listening" ? "Nghe" : "Đọc") : "-";
        return `<tr>
          <td>${escapeHtml(r.testTitle)}</td>
          <td>${subText}</td>
          <td>${r.submissions}</td>
          <td>${r.avgScorePct}%</td>
        </tr>`;
      })
      .join("");
  }

  function renderRecent(rows) {
    const el = document.getElementById("recentList");
    if (!rows || !rows.length) {
      el.innerHTML = '<div class="empty-state">Chưa có bài nộp nào.</div>';
      return;
    }
    el.innerHTML = rows
      .map((r) => {
        const time = r.submittedAt ? new Date(r.submittedAt).toLocaleString("vi-VN") : "";
        return `<div class="list-item">
          <div class="meta">
            <h4>${escapeHtml(r.studentName)} — ${escapeHtml(r.testTitle)}</h4>
            <p>${time} · Điểm ${r.score}/${r.total}</p>
          </div>
        </div>`;
      })
      .join("");
  }

  // ============================================================
  //  BÀI NGHE (AUDIO LIBRARY)
  // ============================================================
  document.getElementById("btnUploadAudio").addEventListener("click", uploadAudio);

  function uploadAudio() {
    const title = document.getElementById("audioTitle").value.trim();
    const unit = document.getElementById("audioUnit").value.trim();
    const fileInput = document.getElementById("audioFile");
    const file = fileInput.files[0];
    const statusEl = document.getElementById("audioUploadStatus");

    if (!title || !file) {
      statusEl.style.display = "block";
      statusEl.className = "notice error";
      statusEl.textContent = "Vui lòng nhập tiêu đề và chọn file âm thanh.";
      return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("unit", unit);
    fd.append("audio", file);

    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.innerHTML = '<span class="spinner"></span> Đang tải lên...';

    Api.admin
      .uploadAudio(fd)
      .then(() => {
        statusEl.className = "notice success";
        statusEl.textContent = "Đã tải lên thành công.";
        document.getElementById("audioTitle").value = "";
        document.getElementById("audioUnit").value = "";
        fileInput.value = "";
        loadAudioList();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function loadAudioList() {
    const statusEl = document.getElementById("audioListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Đang tải...";

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
      listEl.innerHTML = '<div class="empty-state">Chưa có bài nghe nào. Tải lên ở form phía trên.</div>';
      return;
    }
    listEl.innerHTML = "";
    audioCache.forEach((a) => {
      const row = document.createElement("div");
      row.className = "audio-item";
      row.innerHTML = `
        <div class="meta">
          <h4>${escapeHtml(a.unit ? a.unit + " · " : "") + escapeHtml(a.title)}</h4>
          <p>${new Date(a.uploadedAt).toLocaleDateString("vi-VN")}</p>
        </div>
        <audio controls src="${a.cloudinaryUrl}"></audio>
        <div class="actions">
          <button class="icon-btn danger" title="Xoá"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector(".danger").addEventListener("click", () => deleteAudio(a._id));
      listEl.appendChild(row);
    });
  }

  function deleteAudio(id) {
    if (!confirm("Xoá bài nghe này? Không thể hoàn tác.")) return;
    Api.admin
      .deleteAudio(id)
      .then(() => loadAudioList())
      .catch((err) => alert("Không xoá được: " + err.message));
  }

  // ============================================================
  //  THƯ VIỆN ẢNH MINH HOẠ (IMAGE LIBRARY)
  // ============================================================
  document.getElementById("btnUploadImage").addEventListener("click", uploadImage);

  function uploadImage() {
    const title = document.getElementById("imageTitle").value.trim();
    const unit = document.getElementById("imageUnit").value.trim();
    const fileInput = document.getElementById("imageFile");
    const file = fileInput.files[0];
    const statusEl = document.getElementById("imageUploadStatus");

    if (!title || !file) {
      statusEl.style.display = "block";
      statusEl.className = "notice error";
      statusEl.textContent = "Vui lòng nhập tiêu đề và chọn file ảnh.";
      return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("unit", unit);
    fd.append("image", file);

    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.innerHTML = '<span class="spinner"></span> Đang tải lên...';

    Api.admin
      .uploadImage(fd)
      .then(() => {
        statusEl.className = "notice success";
        statusEl.textContent = "Đã tải lên thành công.";
        document.getElementById("imageTitle").value = "";
        document.getElementById("imageUnit").value = "";
        fileInput.value = "";
        loadImagesList();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " " + escapeHtml(err.message);
      });
  }

  function loadImagesList() {
    const statusEl = document.getElementById("imageListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Đang tải...";

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
      listEl.innerHTML = '<div class="empty-state">Chưa có hình ảnh nào. Tải lên ở form phía trên.</div>';
      return;
    }
    listEl.innerHTML = "";
    imagesCache.forEach((img) => {
      const row = document.createElement("div");
      row.className = "audio-item";
      row.innerHTML = `
        <div class="meta" style="flex: 1;">
          <h4>${escapeHtml(img.unit ? img.unit + " · " : "") + escapeHtml(img.title)}</h4>
          <p>${new Date(img.uploadedAt).toLocaleDateString("vi-VN")}</p>
        </div>
        <img src="${img.cloudinaryUrl}" style="height:48px; border-radius:4px; object-fit:contain; margin-right:12px; max-width: 100px;" />
        <div class="actions">
          <button class="icon-btn danger" title="Xoá"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector(".danger").addEventListener("click", () => deleteImage(img._id));
      listEl.appendChild(row);
    });
  }

  function deleteImage(id) {
    if (!confirm("Xoá hình ảnh này? Không thể hoàn tác.")) return;
    Api.admin
      .deleteImage(id)
      .then(() => loadImagesList())
      .catch((err) => alert("Không xoá được: " + err.message));
  }

  // ============================================================
  //  BÀI KIỂM TRA (TEST BUILDER)
  // ============================================================
  document.getElementById("btnNewTest").addEventListener("click", () => openBuilder(null));
  document.getElementById("btnCancelBuilder").addEventListener("click", closeBuilder);
  document.getElementById("btnAddSection").addEventListener("click", () => {
    builderSections.push({ name: "", audioId: "", passageText: "", imageId: "", matchOptionsText: "", fields: [] });
    renderBuilder();
  });
  document.getElementById("btnSaveDraft").addEventListener("click", () => saveTest("draft"));
  document.getElementById("btnPublish").addEventListener("click", () => saveTest("published"));

  // Subject selector inside builder
  const subjectToggleButtons = document.querySelectorAll("#builderSubjectToggle button");
  subjectToggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      subjectToggleButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      builderSubject = btn.dataset.subject;
      renderBuilder();
    });
  });

  function loadTestsList() {
    const statusEl = document.getElementById("testsListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Đang tải...";

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
      listEl.innerHTML = '<div class="empty-state">Chưa có bài kiểm tra nào.</div>';
      return;
    }
    listEl.innerHTML = "";
    testsCache.forEach((t) => {
      const totalQuestions = (t.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);
      const row = document.createElement("div");
      row.className = "test-item";
      const subLabel = t.subject === "reading" ? "Đọc (Reading)" : "Nghe (Listening)";
      row.innerHTML = `
        <div class="meta">
          <h4>${escapeHtml(t.unit ? t.unit + " · " : "") + escapeHtml(t.title)}
            <span class="status-pill ${t.status}">${t.status === "published" ? "Đã công bố" : "Nháp"}</span>
          </h4>
          <p>${subLabel} · ${(t.sections || []).length} phần · ${totalQuestions} câu</p>
        </div>
        <div class="actions">
          <button class="icon-btn" title="Sửa"><svg class="icon"><use href="#icon-edit"></use></svg></button>
          <button class="icon-btn danger" title="Xoá"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
      `;
      row.querySelector('[title="Sửa"]').addEventListener("click", () => openBuilder(t._id));
      row.querySelector(".danger").addEventListener("click", () => deleteTest(t._id));
      listEl.appendChild(row);
    });
  }

  function deleteTest(id) {
    if (!confirm("Xoá bài kiểm tra này? Không thể hoàn tác.")) return;
    Api.admin
      .deleteTest(id)
      .then(() => loadTestsList())
      .catch((err) => alert("Không xoá được: " + err.message));
  }

  function openBuilder(testId) {
    editingTestId = testId;
    document.getElementById("testBuilder").style.display = "block";
    document.getElementById("builderStatus").style.display = "none";
    document.getElementById("builderHeading").textContent = testId ? "Sửa bài kiểm tra" : "Tạo bài kiểm tra mới";

    if (!testId) {
      document.getElementById("tbTitle").value = "";
      document.getElementById("tbUnit").value = "";
      document.getElementById("tbInstructions").value = "";
      subjectToggleButtons.forEach((b) => {
        if (b.dataset.subject === "listening") b.classList.add("active");
        else b.classList.remove("active");
      });
      builderSubject = "listening";
      builderSections = [];
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
        document.getElementById("tbInstructions").value = t.instructions || "";
        
        builderSubject = t.subject || "listening";
        subjectToggleButtons.forEach((b) => {
          if (b.dataset.subject === builderSubject) b.classList.add("active");
          else b.classList.remove("active");
        });

        builderSections = (t.sections || []).map((s) => ({
          name: s.name || "",
          audioId: s.audioId && (s.audioId._id || s.audioId),
          passageText: s.passageText || "",
          imageId: s.imageId && (s.imageId._id || s.imageId),
          matchOptionsText: (s.matchOptions || []).map((o) => o.value + "|" + o.label).join("\n"),
          fields: (s.fields || []).map((f) => {
            const isMatchOptions = f.type === "choice" && (!f.options || f.options.length === 0);
            return {
              id: f.id,
              label: f.label || "",
              type: f.type || "fill",
              pre: f.pre || "",
              post: f.post || "",
              selectCount: f.selectCount || 1,
              useMatchOptions: isMatchOptions,
              optionsText: isMatchOptions ? "" : (f.options || []).map((o) => o.value + "|" + o.label).join("\n"),
              answersText: (f.answers || []).join(", ")
            };
          })
        }));
        renderBuilder();
        document.getElementById("testBuilder").scrollIntoView({ behavior: "smooth" });
      })
      .catch((err) => alert("Không tải được bài kiểm tra: " + err.message));
  }

  function closeBuilder() {
    document.getElementById("testBuilder").style.display = "none";
    editingTestId = null;
  }

  function nextFieldId() {
    const ids = builderSections.flatMap((s) => s.fields.map((f) => Number(f.id) || 0));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  function renderAudioSelectOptions() {
    document.querySelectorAll(".section-audio-select").forEach((sel) => {
      const current = sel.value;
      sel.innerHTML =
        '<option value="">— Chọn bài nghe —</option>' +
        audioCache.map((a) => `<option value="${a._id}">${escapeHtml(a.unit ? a.unit + " · " : "") + escapeHtml(a.title)}</option>`).join("");
      if (current) sel.value = current;
    });
  }

  function renderImageSelectOptions() {
    document.querySelectorAll(".section-image-select").forEach((sel) => {
      const current = sel.value;
      sel.innerHTML =
        '<option value="">— Không có ảnh minh hoạ —</option>' +
        imagesCache.map((img) => `<option value="${img._id}">${escapeHtml(img.unit ? img.unit + " · " : "") + escapeHtml(img.title)}</option>`).join("");
      if (current) sel.value = current;
    });
  }

  function renderBuilder() {
    const wrap = document.getElementById("tbSections");
    wrap.innerHTML = "";

    if (!builderSections.length) {
      wrap.innerHTML = '<div class="empty-state">Chưa có phần nào — bấm "Thêm phần" để bắt đầu.</div>';
      return;
    }

    builderSections.forEach((sec, secIdx) => {
      const box = document.createElement("div");
      box.className = "builder-section";

      let mediaHtml = "";
      if (builderSubject === "listening") {
        mediaHtml = `
          <div class="form-row" style="margin-bottom:10px;">
            <label>Bài nghe dùng cho phần này</label>
            <select class="select-inline section-audio-select" style="width:100%;"></select>
          </div>
        `;
      } else {
        mediaHtml = `
          <div class="form-row" style="margin-bottom:10px;">
            <label>Đoạn văn (Passage text)</label>
            <textarea class="sec-passage-text" rows="5" placeholder="Nhập nội dung văn bản cho bài Đọc...">${escapeHtml(sec.passageText || "")}</textarea>
          </div>
        `;
      }

      box.innerHTML = `
        <div class="builder-section-head">
          <input type="text" placeholder="Tên phần (ví dụ: Section 1 / Paragraph 1-5)" style="flex:1;" class="sec-name" value="${escapeHtml(sec.name)}" />
          <button class="icon-btn danger" title="Xoá phần"><svg class="icon"><use href="#icon-trash"></use></svg></button>
        </div>
        ${mediaHtml}
        <div class="form-row" style="margin-bottom:10px;">
          <label>Ảnh minh hoạ (Diagram / Map - tuỳ chọn)</label>
          <select class="select-inline section-image-select" style="width:100%;"></select>
        </div>
        <div class="form-row" style="margin-bottom:10px;">
          <label>Danh sách đáp án dùng chung cho phần này (Ghép nối / Matching headings - tuỳ chọn)</label>
          <textarea class="sec-match-options" rows="3" placeholder="Mỗi dòng dạng: giá_trị|nhãn (Ví dụ: A|Heading I hoặc LH|Library Hall)...">${escapeHtml(sec.matchOptionsText || "")}</textarea>
        </div>
        <div class="fields-wrap"></div>
        <button class="btn secondary btn-add-field" style="margin-top:8px; padding:8px 14px; font-size:.85rem;">
          <svg class="icon"><use href="#icon-plus"></use></svg> Thêm câu hỏi
        </button>
      `;

      box.querySelector(".sec-name").addEventListener("input", (e) => (sec.name = e.target.value));
      box.querySelector(".danger").addEventListener("click", () => {
        builderSections.splice(secIdx, 1);
        renderBuilder();
      });

      if (builderSubject === "listening") {
        const audioSel = box.querySelector(".section-audio-select");
        audioSel.addEventListener("change", (e) => (sec.audioId = e.target.value));
      } else {
        const passageTextarea = box.querySelector(".sec-passage-text");
        passageTextarea.addEventListener("input", (e) => (sec.passageText = e.target.value));
      }

      const imageSel = box.querySelector(".section-image-select");
      imageSel.addEventListener("change", (e) => (sec.imageId = e.target.value));

      const matchOptionsTextarea = box.querySelector(".sec-match-options");
      matchOptionsTextarea.addEventListener("input", (e) => (sec.matchOptionsText = e.target.value));

      const fieldsWrap = box.querySelector(".fields-wrap");
      sec.fields.forEach((f, fIdx) => {
        fieldsWrap.appendChild(renderFieldRow(sec, f, fIdx));
      });

      box.querySelector(".btn-add-field").addEventListener("click", () => {
        sec.fields.push({ id: nextFieldId(), label: "", type: "fill", pre: "", post: "", selectCount: 1, useMatchOptions: false, optionsText: "", answersText: "" });
        renderBuilder();
      });

      wrap.appendChild(box);
    });

    renderAudioSelectOptions();
    renderImageSelectOptions();
    
    // Set selected values
    builderSections.forEach((sec, secIdx) => {
      const box = wrap.children[secIdx];
      if (builderSubject === "listening" && sec.audioId) {
        box.querySelector(".section-audio-select").value = sec.audioId;
      }
      if (sec.imageId) {
        box.querySelector(".section-image-select").value = sec.imageId;
      }
    });
  }

  function renderFieldRow(sec, f, fIdx) {
    const row = document.createElement("div");
    row.className = "builder-field";
    
    row.innerHTML = `
      <div class="f-group"><label>Câu số</label><input type="text" class="f-id" value="${f.id}" style="width:50px;" /></div>
      <div class="f-group"><label>Nhãn / câu hỏi</label><input type="text" class="f-label" value="${escapeHtml(f.label)}" style="min-width:180px;" /></div>
      <div class="f-group"><label>Dạng</label>
        <select class="f-type">
          <option value="fill" ${f.type === "fill" ? "selected" : ""}>Điền từ</option>
          <option value="choice" ${f.type === "choice" ? "selected" : ""}>Trắc nghiệm</option>
        </select>
      </div>
      <div class="f-group fill-only" style="${f.type === "choice" ? "display:none;" : ""}"><label>Trước chỗ trống</label><input type="text" class="f-pre" value="${escapeHtml(f.pre)}" style="width:110px;" /></div>
      <div class="f-group fill-only" style="${f.type === "choice" ? "display:none;" : ""}"><label>Sau chỗ trống</label><input type="text" class="f-post" value="${escapeHtml(f.post)}" style="width:110px;" /></div>
      
      <div class="f-group choice-only" style="${f.type === "fill" ? "display:none;" : ""} min-width:220px;">
        <label>Lựa chọn (mỗi dòng: giá_trị|nhãn)</label>
        <textarea class="f-options" rows="3" style="min-width:220px; font-family:inherit; font-size:.85rem; padding:6px; ${f.useMatchOptions ? "display:none;" : ""}">${escapeHtml(f.optionsText || "")}</textarea>
        <button type="button" class="btn-tfng" style="padding:3px 6px; font-size:.7rem; margin-top:3px; background:var(--blue-light); border:1px solid var(--border); border-radius:4px; cursor:pointer; color:var(--navy); font-weight:600; ${f.useMatchOptions ? "display:none;" : ""}">Chèn Đúng/Sai/NG</button>
        <label style="font-size: .78rem; font-weight: normal; margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; color: var(--muted);">
          <input type="checkbox" class="f-use-match" ${f.useMatchOptions ? "checked" : ""} /> Dùng đáp án ghép nối chung của phần
        </label>
      </div>
      
      <div class="f-group choice-only" style="${f.type === "fill" ? "display:none;" : ""}"><label>Số đáp án chọn</label><input type="number" class="f-select-count" value="${f.selectCount || 1}" min="1" style="width:60px;" /></div>
      
      <div class="f-group"><label>Đáp án đúng (ngăn cách bởi dấu phẩy)</label><input type="text" class="f-answers" value="${escapeHtml(f.answersText)}" style="min-width:160px;" /></div>
      <button class="icon-btn danger f-remove" title="Xoá câu"><svg class="icon"><use href="#icon-trash"></use></svg></button>
    `;

    row.querySelector(".f-id").addEventListener("input", (e) => (f.id = e.target.value));
    row.querySelector(".f-label").addEventListener("input", (e) => (f.label = e.target.value));
    row.querySelector(".f-pre").addEventListener("input", (e) => (f.pre = e.target.value));
    row.querySelector(".f-post").addEventListener("input", (e) => (f.post = e.target.value));
    row.querySelector(".f-options").addEventListener("input", (e) => (f.optionsText = e.target.value));
    row.querySelector(".f-answers").addEventListener("input", (e) => (f.answersText = e.target.value));
    
    const selectCountInput = row.querySelector(".f-select-count");
    if (selectCountInput) {
      selectCountInput.addEventListener("input", (e) => (f.selectCount = Number(e.target.value) || 1));
    }

    const tfngBtn = row.querySelector(".btn-tfng");
    if (tfngBtn) {
      tfngBtn.addEventListener("click", () => {
        const textarea = row.querySelector(".f-options");
        textarea.value = "true|TRUE\nfalse|FALSE\nng|NOT GIVEN";
        f.optionsText = textarea.value;
      });
    }

    const useMatchCb = row.querySelector(".f-use-match");
    if (useMatchCb) {
      useMatchCb.addEventListener("change", (e) => {
        f.useMatchOptions = e.target.checked;
        const textarea = row.querySelector(".f-options");
        const btn = row.querySelector(".btn-tfng");
        if (f.useMatchOptions) {
          textarea.style.display = "none";
          btn.style.display = "none";
        } else {
          textarea.style.display = "block";
          btn.style.display = "block";
        }
      });
    }

    row.querySelector(".f-type").addEventListener("change", (e) => {
      f.type = e.target.value;
      renderBuilder();
    });
    
    row.querySelector(".f-remove").addEventListener("click", () => {
      sec.fields.splice(fIdx, 1);
      renderBuilder();
    });

    return row;
  }

  function parseOptionsText(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [value, ...rest] = line.split("|");
        return { value: (value || "").trim(), label: (rest.join("|") || value || "").trim() };
      });
  }

  function buildSectionsPayload() {
    return builderSections.map((sec) => ({
      name: sec.name,
      audioId: builderSubject === "listening" ? (sec.audioId || null) : null,
      passageText: builderSubject === "reading" ? sec.passageText : "",
      imageId: sec.imageId || null,
      matchOptions: parseOptionsText(sec.matchOptionsText),
      fields: sec.fields.map((f) => ({
        id: Number(f.id),
        label: f.label,
        type: f.type,
        pre: f.pre,
        post: f.post,
        selectCount: f.type === "choice" ? (f.selectCount || 1) : 1,
        options: (f.type === "choice" && !f.useMatchOptions) ? parseOptionsText(f.optionsText) : [],
        answers: String(f.answersText || "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      }))
    }));
  }

  function saveTest(status) {
    const statusEl = document.getElementById("builderStatus");
    statusEl.style.display = "none";

    const payload = {
      subject: builderSubject,
      title: document.getElementById("tbTitle").value.trim(),
      unit: document.getElementById("tbUnit").value.trim(),
      instructions: document.getElementById("tbInstructions").value.trim(),
      sections: buildSectionsPayload()
    };

    if (!payload.title) {
      statusEl.style.display = "block";
      statusEl.textContent = "Vui lòng nhập tên bài kiểm tra.";
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
  //  BÀI NỘP (SUBMISSIONS)
  // ============================================================
  document.getElementById("btnRefresh").addEventListener("click", loadSubmissions);
  document.getElementById("searchBox").addEventListener("input", () => renderResultsTable());
  document.getElementById("filterTest").addEventListener("change", loadSubmissions);
  document.getElementById("filterSubject").addEventListener("change", () => renderResultsTable());

  function renderTestFilterOptions() {
    const sel = document.getElementById("filterTest");
    const current = sel.value;
    sel.innerHTML =
      '<option value="">Tất cả bài kiểm tra</option>' +
      testsCache.map((t) => `<option value="${t._id}">${escapeHtml(t.unit ? t.unit + " · " : "") + escapeHtml(t.title)}</option>`).join("");
    sel.value = current;
  }

  function loadSubmissions() {
    const statusEl = document.getElementById("loadStatus");
    const table = document.getElementById("resultsTable");
    table.style.display = "none";
    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.innerHTML = '<span class="spinner"></span> Đang tải dữ liệu...';

    const testId = document.getElementById("filterTest").value;
    Api.admin
      .listSubmissions(testId ? { testId } : {})
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
        const test = testsCache.find((t) => t._id === r.testId || t.title === r.testTitle);
        return test && test.subject === sub;
      });
    }
    return filtered;
  }

  function renderSummary(rows) {
    const box = document.getElementById("summaryBox");
    if (!rows.length) {
      box.textContent = "Chưa có học sinh nào nộp bài.";
      return;
    }
    const uniqueNames = new Set(rows.map((r) => r.studentName)).size;
    const avg = rows.reduce((sum, r) => sum + (Number(r.score) / Math.max(Number(r.total), 1)) * 100, 0) / rows.length;
    box.textContent = `Tổng số lượt nộp bài: ${rows.length} · Số học sinh: ${uniqueNames} · Điểm trung bình: ${avg.toFixed(0)}%`;
  }

  function renderResultsTable() {
    const rows = filterRows();
    const body = document.getElementById("resultsBody");
    body.innerHTML = "";
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--muted);">Không có dữ liệu</td></tr>';
      return;
    }
    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      const time = r.submittedAt ? new Date(r.submittedAt).toLocaleString("vi-VN") : "";
      tr.innerHTML = `
        <td>${time}</td>
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(r.testTitle || "")}</td>
        <td><b>${r.score}</b> / ${r.total}</td>
        <td>${r.replayCount != null ? r.replayCount : "-"}</td>
        <td><button class="btn secondary" style="padding:6px 12px; font-size:.8rem;" data-idx="${idx}">Chi tiết</button></td>
      `;
      body.appendChild(tr);

      const detailTr = document.createElement("tr");
      detailTr.style.display = "none";
      const td = document.createElement("td");
      td.colSpan = 6;
      td.style.background = "#fafcfe";
      td.innerHTML = formatAnswers(r.answers);
      detailTr.appendChild(td);
      body.appendChild(detailTr);

      tr.querySelector("button").addEventListener("click", () => {
        detailTr.style.display = detailTr.style.display === "none" ? "table-row" : "none";
      });
    });
  }

  function formatAnswers(answers) {
    if (!answers) return "<em>Không có chi tiết</em>";
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
        return `<div><b>Câu ${escapeHtml(k)}:</b> ${escapeHtml(displayVal || "(bỏ trống)")}</div>`;
      })
      .join("");
    return `<div style="padding:10px 14px;">${items}</div>`;
  }

  // ============================================================
  //  HỌC VIÊN (STUDENT MANAGEMENT)
  // ============================================================
  function loadStudentsList() {
    const statusEl = document.getElementById("studentsListStatus");
    statusEl.style.display = "block";
    statusEl.textContent = "Đang tải...";

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
      document.getElementById("studentsListStatus").textContent = "Không có học viên nào.";
      table.style.display = "none";
      return;
    }

    document.getElementById("studentsListStatus").style.display = "none";
    table.style.display = "table";

    students.forEach((s) => {
      const tr = document.createElement("tr");
      const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString("vi-VN") : "-";
      tr.innerHTML = `
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.username)}</td>
        <td>${date}</td>
        <td>${s.submissionCount != null ? s.submissionCount : 0}</td>
        <td>
          <button class="btn secondary btn-reset-pw" style="padding:4px 8px; font-size:.8rem; margin-right:6px;">Đặt lại mật khẩu</button>
          <button class="btn secondary danger btn-del-student" style="padding:4px 8px; font-size:.8rem; border-color: var(--red); color: var(--red);">Xoá</button>
        </td>
      `;
      tr.querySelector(".btn-reset-pw").addEventListener("click", () => resetStudentPassword(s._id, s.name));
      tr.querySelector(".btn-del-student").addEventListener("click", () => deleteStudent(s._id, s.name));
      body.appendChild(tr);
    });
  }

  function resetStudentPassword(id, name) {
    const pw = prompt(`Nhập mật khẩu mới cho học viên ${name} (tối thiểu 6 ký tự):`);
    if (pw === null) return;
    if (pw.trim().length < 6) {
      alert("Mật khẩu mới quá ngắn.");
      return;
    }
    Api.admin
      .resetStudentPassword(id, pw.trim())
      .then(() => alert("Đặt lại mật khẩu thành công."))
      .catch((err) => alert("Không đặt lại được: " + err.message));
  }

  function deleteStudent(id, name) {
    if (!confirm(`Xoá tài khoản học viên ${name}? Tất cả lịch sử làm bài sẽ bị mất và không thể khôi phục.`)) return;
    Api.admin
      .deleteStudent(id)
      .then(() => {
        loadStudentsList();
        loadOverview();
      })
      .catch((err) => alert("Không xoá được học viên: " + err.message));
  }

})();
