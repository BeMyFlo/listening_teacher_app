// ============================================================
//  LOGIC TRANG HỌC SINH (IELTS with Ms Nhi)
// ============================================================
(function () {
  let studentName = "";
  let studentLevel = 1;
  let currentTest = null; // full test detail from API (public shape, no answers)
  let currentSkill = null; // 'listening' | 'reading' — kỹ năng đang làm trong step-test
  let testReplayCount = 0;
  let countdownTimer = null; // Phase 4 — đồng hồ đếm ngược khi test có durationMinutes
  let shell = null; // dashboard shell (Phase 2)
  let testRowsCache = []; // danh sách rút gọn từ /api/tests (không có nội dung câu hỏi/đề bài)
  let testDetailCache = {}; // testId -> full test detail (lấy khi mở rộng 1 kỹ năng), cache tránh gọi lại API

  const sections = ["step-lessons", "step-picker", "step-test", "step-result"];

  function show(id) {
    sections.forEach((s) => (document.getElementById(s).style.display = s === id ? "block" : "none"));
    if (shell) shell.setActive(id === "step-lessons" ? "lessons" : "tests");
    window.scrollTo(0, 0);
  }

  // Helper giải mã JWT để lấy thông tin học sinh
  function decodeJwt(token) {
    try {
      const base64Url = token.split(".")[1];
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
      return null;
    }
  }

  // Kiểm tra quyền và trạng thái đăng nhập học sinh
  // (đăng nhập đã chuyển sang trang chủ / — không còn form nhúng ở đây)
  function checkAuth() {
    const token = Api.getStudentToken();
    if (!token) {
      location.href = "/";
      return;
    }
    const payload = decodeJwt(token);
    if (!payload || payload.role !== "student") {
      Api.clearStudentToken();
      location.href = "/";
      return;
    }
    studentName = payload.name || payload.username;
    studentLevel = payload.level || 1;

    // Mount sidebar + topbar (Phase 2 shell)
    shell = Shell.mount({
      root: document.getElementById("appShell"),
      navGroups: [
        { label: "MAIN", items: [{ key: "lessons", label: "Lessons", icon: "book-open" }] },
        { label: "PRACTICE", items: [{ key: "tests", label: "Mock Tests", icon: "clipboard" }] }
      ],
      activeKey: "tests",
      userName: studentName,
      roleLabel: "STUDENT",
      userSub: "Level " + studentLevel,
      searchPlaceholder: "Search lessons, mock tests...",
      onNavigate: (key) => {
        if (key === "lessons") {
          show("step-lessons");
        } else {
          show("step-picker");
          renderTestList();
        }
      },
      onLogout: () => {
        Api.clearStudentToken();
        location.href = "/";
      }
    });

    loadLessons();
    show("step-picker");
    renderTestList();
  }

  document.getElementById("backToPickerFromTest").addEventListener("click", () => {
    stopCountdown();
    show("step-picker");
    renderTestList();
  });
  document.getElementById("btnBackList").addEventListener("click", () => {
    show("step-picker");
    renderTestList();
  });

  const SKILL_TABS = [
    { key: "listening", label: "Listening", icon: "headphones" },
    { key: "reading", label: "Reading", icon: "book-open" },
    { key: "writing", label: "Writing", icon: "writing" },
    { key: "speaking", label: "Speaking", icon: "mic" }
  ];

  // ---------- DANH SÁCH MOCK TEST (4 kỹ năng, khoá tới khi opensAt) ----------
  function renderTestList() {
    const statusEl = document.getElementById("testStatus");
    const testList = document.getElementById("testList");
    testList.innerHTML = "";
    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.textContent = "Loading mock test list...";

    Api.listTests()
      .then((data) => {
        testRowsCache = data.rows || [];
        statusEl.style.display = "none";
        if (!testRowsCache.length) {
          testList.innerHTML = '<div class="empty-state">No mock tests published yet.</div>';
          return;
        }
        testRowsCache.forEach((row) => testList.appendChild(renderTestCard(row)));
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " Failed to load mock test list: " + escapeHtml(err.message);
      });
  }

  function renderTestCard(row) {
    const card = document.createElement("div");
    card.className = "test-exam-card" + (row.locked ? " locked" : "");

    if (row.locked) {
      const opensText = row.opensAt ? new Date(row.opensAt).toLocaleString("en-US") : "";
      card.innerHTML = `
        <div class="meta">
          <h4>${Icon("lock")} ${escapeHtml(row.unit ? row.unit + " · " : "") + escapeHtml(row.title)}</h4>
          <p>Locked — opens ${escapeHtml(opensText)}</p>
        </div>
      `;
      return card;
    }

    const summaryLine = examResultSummary(row);
    card.innerHTML = `
      <div class="meta">
        <h4>${escapeHtml(row.unit ? row.unit + " · " : "") + escapeHtml(row.title)}${row.closed ? ' <span class="pill pill-muted">Closed</span>' : ""}</h4>
        ${summaryLine ? `<p class="exam-result-summary">${summaryLine}</p>` : ""}
      </div>
      <div class="exam-skill-grid"></div>
    `;
    const grid = card.querySelector(".exam-skill-grid");
    SKILL_TABS.forEach((tab) => {
      const skillMeta = row.skills && row.skills[tab.key];
      if (!skillMeta || !skillMeta.present) return;
      grid.appendChild(renderExamSkillBox(row, tab));
    });
    return card;
  }

  // Dòng tóm tắt kết quả chung hiện trên đầu thẻ — gộp từ mySubmissionsCache,
  // chỉ hiện khi đã có ít nhất 1 kỹ năng có kết quả.
  function examResultSummary(row) {
    const bits = [];
    SKILL_TABS.forEach((tab) => {
      const sub = latestExamSubmission(row.id, tab.key);
      if (!sub) return;
      if (tab.key === "listening" || tab.key === "reading") {
        bits.push(`${tab.label}: ${sub.score}/${sub.total}`);
      } else if (sub.gradingStatus === "graded") {
        bits.push(`${tab.label}: ${sub.manualScore} pts`);
      }
    });
    return bits.length ? "Results — " + escapeHtml(bits.join(" · ")) : "";
  }

  function latestExamSubmission(testId, skill) {
    return mySubmissionsCache.find((s) => String(s.testId) === String(testId) && s.testSkill === skill) || null;
  }

  function renderExamSkillBox(row, tab) {
    const box = document.createElement("div");
    box.className = "exam-skill-box";
    const sub = latestExamSubmission(row.id, tab.key);
    const isQuestionSkill = tab.key === "listening" || tab.key === "reading";
    const skillMeta = row.skills[tab.key];

    let statusHtml;
    let ctaLabel;
    if (!sub) {
      statusHtml = isQuestionSkill ? `<span class="muted">0/${skillMeta.count} questions done</span>` : `<span class="muted">Not started</span>`;
      ctaLabel = "Start";
    } else if (isQuestionSkill) {
      statusHtml = `<span class="muted">${skillMeta.count}/${skillMeta.count} questions done</span><br><b>Score: ${sub.score}/${sub.total}</b>`;
      ctaLabel = "Retake";
    } else if (sub.gradingStatus === "graded") {
      statusHtml = `<b>Graded: ${sub.manualScore} pts</b>`;
      ctaLabel = "Redo";
    } else {
      statusHtml = `<span class="muted">Submitted — pending review</span>`;
      ctaLabel = "Redo";
    }

    box.innerHTML = `
      <div class="exam-skill-head">${Icon(tab.icon)} <b>${tab.label}</b></div>
      <div class="exam-skill-status">${statusHtml}</div>
      <button type="button" class="btn secondary exam-skill-cta" style="margin-top:8px; padding:6px 14px; font-size:.82rem;">${ctaLabel}</button>
      <div class="exam-skill-work" style="display:none; margin-top:12px;"></div>
    `;

    const ctaBtn = box.querySelector(".exam-skill-cta");
    const workEl = box.querySelector(".exam-skill-work");
    ctaBtn.addEventListener("click", () => {
      if (isQuestionSkill) {
        startTest(row.id, tab.key);
        return;
      }
      // Writing/Speaking: mở rộng form ngay trong thẻ, giống Lesson prompts.
      const opening = workEl.style.display === "none";
      workEl.style.display = opening ? "block" : "none";
      if (opening) loadExamPrompts(workEl, row.id, tab.key);
    });

    return box;
  }

  function loadExamPrompts(workEl, testId, skill) {
    workEl.innerHTML = '<div class="notice info">Loading...</div>';
    const ready = testDetailCache[testId]
      ? Promise.resolve(testDetailCache[testId])
      : Api.getTest(testId).then((data) => {
          testDetailCache[testId] = data.test;
          return data.test;
        });
    ready
      .then((test) => {
        const skillData = test.skills[skill];
        workEl.innerHTML = "";
        if (!skillData.prompts.length) {
          workEl.innerHTML = '<div class="empty-state">No prompts available.</div>';
          return;
        }
        skillData.prompts.forEach((p) => {
          const last = mySubmissionsCache.find((s) => String(s.promptId) === String(p.id) && String(s.testId) === String(testId));
          const box = document.createElement("div");
          box.className = "lesson-block";
          box.innerHTML = `
            <h4 style="margin:0 0 8px;">${escapeHtml(p.title || "Prompt")}</h4>
            ${p.instructions ? `<div class="lesson-text">${escapeHtml(p.instructions)}</div>` : ""}
            ${p.imageUrl ? `<img src="${p.imageUrl}" class="diagram-image" style="margin:10px 0;" />` : ""}
            <div class="prompt-work" style="margin-top:12px;"></div>
            <div class="prompt-status" style="margin-top:12px;"></div>
          `;
          const statusEl = box.querySelector(".prompt-status");
          if (last) {
            statusEl.innerHTML =
              last.gradingStatus === "graded"
                ? `<div class="notice success">${Icon("check-circle")} Graded: <b>${last.manualScore} pts</b>${last.manualFeedback ? " — Feedback: " + escapeHtml(last.manualFeedback) : ""}</div>`
                : '<div class="notice info">Submitted — pending teacher review.</div>';
          }
          const work = box.querySelector(".prompt-work");
          const submitContext = { testId, skill };
          const onSubmitted = () => renderTestList();
          if (skill === "writing") wireWritingPrompt(work, p, submitContext, onSubmitted);
          else wireSpeakingPrompt(work, p, submitContext, onSubmitted);
          workEl.appendChild(box);
        });
      })
      .catch((err) => {
        workEl.innerHTML = `<div class="notice error">${Icon("warning")} ${escapeHtml(err.message)}</div>`;
      });
  }

  // ---------- TESTING FLOW (Listening/Reading — câu hỏi tự chấm) ----------
  function startTest(testId, skill) {
    const formEl = document.getElementById("testForm");
    formEl.innerHTML = '<div class="notice info">Loading test...</div>';
    currentSkill = skill;
    show("step-test");

    Api.getTest(testId)
      .then((data) => {
        currentTest = data.test;
        testDetailCache[testId] = data.test;
        testReplayCount = 0;
        renderTestForm(currentTest, skill);
        const skillData = currentTest.skills[skill];
        if (skillData.durationMinutes) {
          startCountdown(Number(skillData.durationMinutes));
        } else {
          stopCountdown();
        }
      })
      .catch((err) => {
        formEl.innerHTML = `<div class="notice error">${Icon("warning")} Failed to load test: ${escapeHtml(err.message)}</div>`;
      });
  }

  function renderTestForm(test, skill) {
    const skillData = test.skills[skill];
    const tabInfo = SKILL_TABS.find((t) => t.key === skill);
    document.getElementById("testTitle").textContent = `${test.unit} · ${test.title}`;
    document.getElementById("testInstructions").textContent = skillData.instructions;

    const testSubjectBadge = document.getElementById("testSubjectBadge");
    testSubjectBadge.textContent = tabInfo.label + " Test";
    testSubjectBadge.className = "badge test " + skill;

    const formEl = document.getElementById("testForm");
    formEl.innerHTML = "";

    skillData.sections.forEach((sec, secIdx) => renderSectionBlock(sec, secIdx, skill, formEl));
  }

  // Render 1 section (layout Nghe hoặc Đọc) — dùng chung cho cả Test lẫn
  // Exercise trong Bài học (Phase 3, tái dùng thay vì viết lại UI).
  // Ảnh sơ đồ/map cho câu hỏi labelling — nếu section có labelPoints thì
  // bọc ảnh trong khung position:relative và vẽ số thứ tự câu hỏi tại vị
  // trí pin (%) đã giáo viên đặt. Chỉ mang tính minh hoạ, không click để
  // trả lời — học sinh vẫn chọn đáp án ở danh sách câu hỏi bên dưới.
  function renderDiagramImage(sec) {
    const img = document.createElement("img");
    img.src = sec.imageUrl;
    img.className = "diagram-image";
    if (!sec.labelPoints || !sec.labelPoints.length) return img;

    const wrap = document.createElement("div");
    wrap.className = "diagram-pin-wrap";
    wrap.appendChild(img);
    sec.labelPoints.forEach((lp) => {
      const marker = document.createElement("span");
      marker.className = "pin-marker";
      marker.style.left = lp.x + "%";
      marker.style.top = lp.y + "%";
      marker.textContent = lp.fieldId;
      wrap.appendChild(marker);
    });
    return wrap;
  }

  function renderSectionBlock(sec, secIdx, subject, parentEl) {
    const secWrapper = document.createElement("div");
    secWrapper.style.marginBottom = "30px";

    if (subject === "reading") {
        // Layout Đọc: Chia đôi màn hình (bên trái đoạn văn/ảnh, bên phải câu hỏi)
        secWrapper.className = "reading-layout";

        const passagePane = document.createElement("div");
        passagePane.className = "passage-pane";

        // Tên section
        const secTitle = document.createElement("h3");
        secTitle.style.color = "var(--navy)";
        secTitle.style.marginTop = "0";
        secTitle.textContent = sec.name;
        passagePane.appendChild(secTitle);

        // Ảnh diagram/map nếu có
        if (sec.imageUrl) {
          passagePane.appendChild(renderDiagramImage(sec));
        }

        // Nội dung đoạn văn
        if (sec.passageText) {
          const textDiv = document.createElement("div");
          textDiv.style.marginTop = "10px";
          textDiv.style.whiteSpace = "pre-line";
          textDiv.textContent = sec.passageText;
          passagePane.appendChild(textDiv);
        }

        const questionsPane = document.createElement("div");
        questionsPane.className = "questions-pane";

        // Render các field câu hỏi vào questionsPane
        renderSectionFields(sec, secIdx, questionsPane);

        secWrapper.appendChild(passagePane);
        secWrapper.appendChild(questionsPane);
      } else {
        // Layout Nghe: Dọc, có trình phát âm thanh phía trên
        const secTitle = document.createElement("div");
        secTitle.className = "section-title";
        secTitle.textContent = sec.name;
        secWrapper.appendChild(secTitle);

        if (sec.audioUrl) {
          const player = document.createElement("div");
          player.className = "player";
          const replayId = "replay-" + secIdx;
          player.innerHTML = `
            <svg class="icon"><use href="#icon-speaker"></use></svg>
            <audio controls src="${sec.audioUrl}"></audio>
            <span class="replay-count" id="${replayId}">Listened: 0 times</span>
          `;
          
          // Audio error handling
          const audioEl = player.querySelector("audio");
          const replayEl = player.querySelector("#" + replayId);
          let secCount = 0;

          audioEl.addEventListener("play", () => {
            secCount++;
            testReplayCount++;
            replayEl.textContent = "Listened: " + secCount + " times";
          });

          audioEl.addEventListener("error", () => {
            if (player.parentNode) {
              const errNotice = document.createElement("div");
              errNotice.className = "notice error";
              errNotice.style.marginTop = "8px";
              errNotice.style.width = "100%";
              errNotice.innerHTML = Icon("warning") + " Error: Unable to load audio file. Please notify your teacher.";
              player.parentNode.insertBefore(errNotice, player.nextSibling);
            }
          });

          secWrapper.appendChild(player);
        }

        // Sơ đồ hoặc hình vẽ phụ trợ bài nghe (nếu có)
        if (sec.imageUrl) {
          const diagramEl = renderDiagramImage(sec);
          diagramEl.style.margin = "0 auto 16px";
          secWrapper.appendChild(diagramEl);
        }

        // Render các field câu hỏi trực tiếp vào wrapper
        renderSectionFields(sec, secIdx, secWrapper);
      }

    parentEl.appendChild(secWrapper);
  }

  // Hàm render các field câu hỏi cho Section
  function renderSectionFields(sec, secIdx, parentEl) {
    sec.fields.forEach((f) => {
      const row = document.createElement("div");
      row.className = "field-row";
      row.id = "row-" + f.id;

      if (f.type === "choice") {
        // Xác định options: riêng của field hoặc fallback matchOptions của section
        const options = (f.options && f.options.length > 0) ? f.options : (sec.matchOptions || []);
        const selectCount = f.selectCount || 1;

        let optionsHtml = "";
        if (selectCount > 1) {
          // Checkbox (Chọn nhiều)
          optionsHtml = options.map((o) => `
            <label style="display:flex; align-items:center; gap:6px; font-weight:400;">
              <input type="checkbox" name="ans-${f.id}" value="${escapeHtml(o.value)}" />
              ${escapeHtml(o.label)}
            </label>
          `).join("");
        } else {
          // Radio button (Chọn một)
          optionsHtml = options.map((o) => `
            <label style="display:flex; align-items:center; gap:6px; font-weight:400;">
              <input type="radio" name="ans-${f.id}" value="${escapeHtml(o.value)}" />
              ${escapeHtml(o.label)}
            </label>
          `).join("");
        }

        row.innerHTML = `
          <span class="num">${f.id}.</span>
          <div style="flex:1;">
            <div class="label" style="margin-bottom:6px;">
              ${escapeHtml(f.label)}
              ${selectCount > 1 ? `<span class="select-hint">(Select up to ${selectCount} answers)</span>` : ""}
              ${f.hint ? `<span class="field-hint">${escapeHtml(f.hint)}</span>` : ""}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">${optionsHtml}</div>
          </div>
        `;

        // Giới hạn số lượng checkbox được tick client-side
        if (selectCount > 1) {
          const checkboxes = row.querySelectorAll(`input[name="ans-${f.id}"]`);
          checkboxes.forEach((cb) => {
            cb.addEventListener("change", () => {
              const checked = row.querySelectorAll(`input[name="ans-${f.id}"]:checked`);
              if (checked.length >= selectCount) {
                checkboxes.forEach((other) => {
                  if (!other.checked) other.disabled = true;
                });
              } else {
                checkboxes.forEach((other) => {
                  other.disabled = false;
                });
              }
            });
          });
        }
      } else {
        // Điền ô trống
        row.innerHTML = `
          <span class="num">${f.id}.</span>
          <span class="label">${escapeHtml(f.label)}${f.pre ? ": " + escapeHtml(f.pre) : ""}${f.hint ? ` <span class="field-hint">${escapeHtml(f.hint)}</span>` : ""}</span>
          <input type="text" id="ans-${f.id}" autocomplete="off" />
          <span class="tail">${escapeHtml(f.post || "")}</span>
        `;
      }

      parentEl.appendChild(row);
    });
  }

  function getFieldValue(f) {
    if (f.type === "choice") {
      const selectCount = f.selectCount || 1;
      if (selectCount > 1) {
        // Lấy danh sách checkbox được tick dạng Array
        const checked = document.querySelectorAll(`input[name="ans-${f.id}"]:checked`);
        return Array.from(checked).map((cb) => cb.value);
      } else {
        const checked = document.querySelector(`input[name="ans-${f.id}"]:checked`);
        return checked ? checked.value : "";
      }
    }
    const input = document.getElementById("ans-" + f.id);
    return input ? input.value.trim() : "";
  }

  document.getElementById("btnSubmitTest").addEventListener("click", submitTest);

  // Phase 4 — đếm ngược client-side; hết giờ tự động gọi nộp bài.
  function startCountdown(minutes) {
    stopCountdown();
    const timerEl = document.getElementById("testTimer");
    let remaining = Math.max(1, minutes) * 60;
    timerEl.style.display = "flex";
    const tick = () => {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      timerEl.innerHTML = Icon("clock") + " Time remaining: " + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      timerEl.classList.toggle("urgent", remaining <= 60);
      if (remaining <= 0) {
        stopCountdown();
        submitTest();
        return;
      }
      remaining--;
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    const timerEl = document.getElementById("testTimer");
    if (timerEl) {
      timerEl.style.display = "none";
      timerEl.classList.remove("urgent");
    }
  }

  function submitTest() {
    const test = currentTest;
    const skill = currentSkill;
    if (!test || !skill) return;
    const sections = test.skills[skill].sections;

    const answers = {};
    sections.forEach((sec) => sec.fields.forEach((f) => (answers[f.id] = getFieldValue(f))));

    const btn = document.getElementById("btnSubmitTest");
    btn.disabled = true;

    Api.submit({
      kind: "test",
      testId: test.id,
      skill,
      answers,
      replayCount: testReplayCount
    })
      .then((res) => {
        stopCountdown();
        refreshMySubmissions();
        renderResult(test, skill, answers, res);
      })
      .catch((err) => {
        alert("Submission failed: " + err.message);
      })
      .finally(() => {
        btn.disabled = false;
      });
  }

  // Đánh dấu đúng/sai trực tiếp lên các row câu hỏi đang hiển thị —
  // dùng chung cho Test và Exercise (Phase 3).
  function markRowsInline(sections, detail) {
    const detailById = {};
    (detail || []).forEach((d) => (detailById[d.id] = d));

    sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        const d = detailById[f.id];
        const row = document.getElementById("row-" + f.id);
        if (!row || !d) return;

        row.classList.remove("correct", "wrong");
        row.classList.add(d.correct ? "correct" : "wrong");

        let mark = row.querySelector(".result-mark");
        if (!mark) {
          mark = document.createElement("span");
          mark.className = "result-mark";
          row.appendChild(mark);
        }
        mark.className = "result-mark " + (d.correct ? "correct" : "wrong");
        mark.innerHTML = d.correct ? Icon("check") : Icon("cross");

        let note = row.querySelector(".correct-answer-note");
        if (!d.correct) {
          if (!note) {
            note = document.createElement("div");
            note.className = "correct-answer-note";
            row.appendChild(note);
          }
          note.textContent = "Correct answer: " + (d.answer || "");
        } else if (note) {
          note.remove();
        }
      });
    });
    return detailById;
  }

  function renderResult(test, skill, answers, res) {
    const sections = test.skills[skill].sections;
    const detailById = markRowsInline(sections, res.detail);

    const tabInfo = SKILL_TABS.find((t) => t.key === skill);
    document.getElementById("resultTitle").textContent = `${test.unit} · ${test.title} — ${tabInfo.label} — ${studentName}`;
    document.getElementById("scoreValue").textContent = res.score;
    document.getElementById("scoreTotal").textContent = res.total;

    const detail = document.getElementById("resultDetail");
    detail.innerHTML = "";

    sections.forEach((sec) => {
      const secWrapper = document.createElement("div");
      secWrapper.style.marginBottom = "24px";

      const h = document.createElement("div");
      h.className = "section-title";
      h.textContent = sec.name;
      secWrapper.appendChild(h);

      sec.fields.forEach((f) => {
        const d = detailById[f.id];
        if (!d) return;
        
        const submittedVal = answers[f.id];
        const shown = answerLabel(f, submittedVal, sec) || "(blank)";
        
        const row = document.createElement("div");
        row.className = "field-row " + (d.correct ? "correct" : "wrong");
        row.innerHTML = `
          <span class="num">${f.id}.</span>
          <span class="label">${escapeHtml(f.label)}</span>
          <span class="tail" style="flex:1;">Your answer: <b>${escapeHtml(shown)}</b>
          ${!d.correct ? " · Correct answer: <b>" + escapeHtml(d.answer || "") + "</b>" : ""}</span>
          <span class="result-mark ${d.correct ? "correct" : "wrong"}">${d.correct ? Icon("check") : Icon("cross")}</span>
        `;
        secWrapper.appendChild(row);
      });
      detail.appendChild(secWrapper);
    });

    const statusEl = document.getElementById("submitStatus");
    statusEl.className = "notice success";
    statusEl.innerHTML = Icon("check-circle") + " Test results submitted to teacher successfully.";
    show("step-result");
  }

  function answerLabel(field, value, section) {
    const options = (field.options && field.options.length > 0) ? field.options : (section.matchOptions || []);
    if (Array.isArray(value)) {
      if (!value.length) return "";
      return value.map((val) => {
        const opt = options.find((o) => o.value === val);
        return opt ? opt.label : val;
      }).join(", ");
    }
    if (field.type === "choice") {
      const opt = options.find((o) => o.value === value);
      return opt ? opt.label : value;
    }
    return value;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Theory content hỗ trợ cú pháp markdown tối giản **đậm** / *nghiêng*
  // giáo viên gõ ở ô soạn — escape trước rồi mới chèn <b>/<i> nên an toàn.
  function renderTheoryText(raw) {
    let html = escapeHtml(raw);
    html = html.replace(/\*\*([^\n]+?)\*\*/g, "<b>$1</b>");
    html = html.replace(/\*([^\n*]+?)\*/g, "<i>$1</i>");
    return html;
  }

  document.getElementById("btnRetake").addEventListener("click", () => startTest(currentTest.id, currentSkill));

  // ============================================================
  //  BÀI HỌC (LESSONS — Phase 3)
  // ============================================================
  const LESSON_CAT_ORDER = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];
  const LESSON_CAT_LABELS = {
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
    speaking: "Speaking"
  };
  const LESSON_CAT_ICONS = {
    grammar: "grammar",
    vocabulary: "vocabulary",
    listening: "headphones",
    reading: "book-open",
    writing: "writing",
    speaking: "mic"
  };
  const LESSON_CAT_COLORS = {
    grammar: "#16a34a",
    vocabulary: "#7c3aed",
    listening: "#0ea5e9",
    reading: "#f59e0b",
    writing: "#ec4899",
    speaking: "#ef4444"
  };
  let unitsCache = [];
  let unitsSortMode = "order";
  let selectedUnitId = null; // click 1 dòng trong "All Units" -> chọn hiện lên thẻ trên, không mở luôn

  let currentUnit = null;
  let lessonCatKey = "grammar";
  let lessonSubTab = "learn"; // 'learn' | 'practice'
  const LESSON_CAT_DESC = {
    grammar: "Learn grammar rules and practice exercises to improve accuracy.",
    vocabulary: "Build vocabulary with topic word lists and practice.",
    listening: "Practice listening sections with audio recordings.",
    reading: "Practice reading skills with passages and questions.",
    writing: "Practice writing tasks — submit for teacher feedback.",
    speaking: "Practice speaking tasks — record and submit for feedback."
  };
  let mySubmissionsCache = [];
  let openExerciseId = null;

  document.getElementById("backToUnitsList").addEventListener("click", () => {
    document.getElementById("lessonsDetail").style.display = "none";
    document.getElementById("lessonsList").style.display = "block";
    openExerciseId = null;
    // mySubmissionsCache có thể vừa đổi (làm bài xong quay lại) — vẽ lại
    // progress ngay, không cần gọi API lại vì unitsCache đã có sẵn.
    if (unitsCache.length) renderLessonsList();
  });

  function refreshMySubmissions() {
    return Api.mySubmissions()
      .then((d) => {
        mySubmissionsCache = d.rows || [];
        renderStudentStats();
      })
      .catch(() => {});
  }

  // Phase 4 — stat cards cho dashboard học sinh (đồng bộ style Phase 2).
  function renderStudentStats() {
    const grid = document.getElementById("studentStatGrid");
    if (!grid) return;
    const testSubs = mySubmissionsCache.filter((s) => (s.kind || "test") === "test");
    const pending = mySubmissionsCache.filter((s) => (s.kind === "writing" || s.kind === "speaking") && s.gradingStatus !== "graded").length;
    const avg = testSubs.length
      ? Math.round(testSubs.reduce((sum, s) => sum + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0) / testSubs.length)
      : null;
    if (!testSubs.length && !pending) {
      grid.style.display = "none";
      return;
    }
    const card = (icon, value, label, tone) =>
      `<div class="stat-card-v2${tone ? " tone-" + tone : ""}"><div class="stat-top"><span class="label">${label}</span><span class="stat-icon">${Icon(icon)}</span></div><div class="value">${value}</div></div>`;
    grid.style.display = "grid";
    grid.innerHTML =
      card("clipboard", testSubs.length, "Mock Tests Taken") +
      card("chart-bar", avg != null ? avg + "%" : "-", "Average Score", "success") +
      card("warning", pending, "Pending Teacher Review", pending > 0 ? "warn" : "");
  }

  function loadLessons() {
    const statusEl = document.getElementById("unitsStatus");
    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.textContent = "Loading lesson units...";
    document.getElementById("unitsFeatured").innerHTML = "";
    document.getElementById("unitsList").innerHTML = "";
    document.getElementById("unitsListHead").style.display = "none";

    Promise.all([refreshMySubmissions(), Api.listUnits()])
      .then(([, data]) => {
        unitsCache = data.rows || [];
        statusEl.style.display = "none";
        if (!unitsCache.length) {
          document.getElementById("unitsList").innerHTML = '<div class="empty-state">No lesson units available for your level.</div>';
          return;
        }
        document.getElementById("unitsListHead").style.display = "flex";
        renderLessonsList();
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " Failed to load lesson units: " + escapeHtml(err.message);
      });
  }

  // % hoàn thành 1 Unit dựa trên số item (exercise+prompt) học sinh đã có
  // ít nhất 1 lần nộp bài — không có field "lessons"/"XP" nào trong data
  // model nên không bịa, chỉ suy ra từ Submission thật đã có sẵn.
  function unitProgress(u) {
    const totalItems = (u.categories || []).reduce((n, c) => n + (c.itemCount || 0), 0);
    const attempted = new Set();
    mySubmissionsCache.forEach((s) => {
      if (String(s.unitId) !== String(u.id)) return;
      if (s.kind === "exercise") attempted.add("ex:" + s.exerciseId);
      else if (s.kind === "writing" || s.kind === "speaking") attempted.add("pr:" + s.promptId);
    });
    const completed = Math.min(attempted.size, totalItems);
    const pct = totalItems ? Math.round((completed / totalItems) * 100) : 0;
    return { totalItems, completed, pct };
  }

  function categoryBadgesHtml(u) {
    return LESSON_CAT_ORDER.map((key) => {
      const cat = (u.categories || []).find((c) => c.key === key);
      const has = cat && cat.hasContent;
      const color = LESSON_CAT_COLORS[key];
      return has
        ? `<span class="cat-badge" style="background:${color}22; color:${color};">${escapeHtml(LESSON_CAT_LABELS[key])}</span>`
        : `<span class="cat-badge cat-badge-empty">${escapeHtml(LESSON_CAT_LABELS[key])}</span>`;
    }).join("");
  }

  function sortedUnits() {
    const arr = unitsCache.slice();
    if (unitsSortMode === "newest") {
      arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return arr;
  }

  function renderLessonsList() {
    renderFeaturedUnit();
    renderUnitsListRows();
  }

  // Unit nào đang được xem ở thẻ trên: ưu tiên Unit vừa click chọn ở "All
  // Units" (selectedUnitId); chưa chọn gì thì mặc định Unit đang làm dở
  // (0%<x<100%), rồi Unit chưa bắt đầu đầu tiên, cuối cùng fallback Unit
  // đầu danh sách. Tính 1 lần, dùng chung cho cả thẻ trên lẫn highlight
  // dòng đang chọn bên dưới — tránh gọi unitProgress() lặp lại nhiều lần.
  function getFeaturedUnitEntry() {
    const withProgress = unitsCache.map((u) => ({ u, p: unitProgress(u) }));
    return (
      (selectedUnitId && withProgress.find((x) => String(x.u.id) === String(selectedUnitId))) ||
      withProgress.find((x) => x.p.pct > 0 && x.p.pct < 100) ||
      withProgress.find((x) => x.p.pct === 0) ||
      withProgress[0] ||
      null
    );
  }

  // Thẻ nổi bật trên đầu — chỉ mang tính xem trước; bấm nút trong thẻ này
  // mới thật sự mở bài (xem renderUnitsListRows: click 1 dòng chỉ đổi thẻ
  // này sang Unit đó, không mở thẳng).
  function renderFeaturedUnit() {
    const wrap = document.getElementById("unitsFeatured");
    const featured = getFeaturedUnitEntry();
    if (!featured) {
      wrap.innerHTML = "";
      return;
    }
    const { u, p } = featured;
    const ctaLabel = p.pct === 0 ? "Start Lesson" : p.pct === 100 ? "Review Lesson" : "Continue Lesson";
    wrap.innerHTML = `
      <div class="unit-featured-card">
        <div class="unit-featured-icon">${Icon("book-open")}</div>
        <div style="flex:1; min-width:220px;">
          <h3 style="margin:0 0 4px;">${escapeHtml(u.name)}</h3>
          <div class="unit-overview-badges">${categoryBadgesHtml(u)}</div>
        </div>
        <div class="unit-featured-progress">
          <span class="label">Overall Progress</span>
          <span class="pct">${p.pct}%</span>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${p.pct}%;"></div></div>
          <span class="sub">${p.completed}/${p.totalItems} item(s) completed</span>
        </div>
        <button class="btn unit-featured-cta">${Icon("play")} ${ctaLabel}</button>
      </div>
    `;
    wrap.querySelector(".unit-featured-cta").addEventListener("click", () => openUnit(u.id));
  }

  function renderUnitsListRows() {
    const listEl = document.getElementById("unitsList");
    listEl.innerHTML = "";
    const featuredEntry = getFeaturedUnitEntry();
    const featuredId = featuredEntry && featuredEntry.u.id;
    sortedUnits().forEach((u, idx) => {
      const p = unitProgress(u);
      const skillsWithContent = (u.categories || []).filter((c) => c.hasContent).length;
      const statusLabel = p.pct === 100 ? "Completed" : p.pct === 0 ? "Not started" : "In progress";
      const statusColor = p.pct === 100 ? "var(--green)" : p.pct === 0 ? "var(--muted)" : "var(--blue)";
      const isSelected = String(u.id) === String(featuredId);
      const row = document.createElement("div");
      row.className = "unit-list-row" + (isSelected ? " selected" : "");
      row.innerHTML = `
        <div class="unit-list-num">${String(idx + 1).padStart(2, "0")}</div>
        <div class="unit-list-meta">
          <h4>${escapeHtml(u.name)}</h4>
          <p>${skillsWithContent}/${LESSON_CAT_ORDER.length} skills · ${p.totalItems} item(s)</p>
        </div>
        <div class="unit-list-progress">
          <span style="color:${statusColor}; font-weight:700;">${p.pct}%</span>
          <span style="color:${statusColor};">${statusLabel}</span>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${p.pct}%; background:${statusColor};"></div></div>
        </div>
        <button type="button" class="icon-btn unit-list-goto">${Icon("chevron-right")}</button>
      `;
      // Click 1 dòng chỉ CHỌN để xem preview ở thẻ trên — bấm nút trong thẻ
      // đó mới thật sự mở bài, không mở thẳng ngay khi click dòng.
      row.addEventListener("click", () => {
        selectedUnitId = u.id;
        renderLessonsList();
        document.getElementById("unitsFeatured").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      listEl.appendChild(row);
    });
  }

  document.getElementById("unitsSortSelect").addEventListener("change", (e) => {
    unitsSortMode = e.target.value;
    renderUnitsListRows();
  });

  function openUnit(unitId) {
    document.getElementById("unitsStatus").style.display = "block";
    document.getElementById("unitsStatus").className = "notice info";
    document.getElementById("unitsStatus").textContent = "Loading lesson...";

    Api.getUnit(unitId)
      .then((data) => {
        currentUnit = data.unit;
        lessonCatKey = "grammar";
        lessonSubTab = "learn";
        openExerciseId = null;
        document.getElementById("unitsStatus").style.display = "none";
        document.getElementById("lessonsList").style.display = "none";
        document.getElementById("lessonsDetail").style.display = "block";
        document.getElementById("lessonUnitTitle").textContent = currentUnit.name;
        renderLessonCatTabs();
        renderLessonCatContent();
        window.scrollTo(0, 0);
      })
      .catch((err) => {
        const statusEl = document.getElementById("unitsStatus");
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " Failed to load lesson: " + escapeHtml(err.message);
      });
  }

  function renderLessonCatTabs() {
    const wrap = document.getElementById("lessonCatTabs");
    wrap.innerHTML = "";
    Object.keys(LESSON_CAT_LABELS).forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "unit-cat-tab" + (key === lessonCatKey ? " active" : "");
      btn.innerHTML = Icon(LESSON_CAT_ICONS[key]) + " " + LESSON_CAT_LABELS[key];
      btn.addEventListener("click", () => {
        lessonCatKey = key;
        lessonSubTab = "learn";
        openExerciseId = null;
        renderLessonCatTabs();
        renderLessonCatContent();
      });
      wrap.appendChild(btn);
    });
  }

  function currentLessonCategory() {
    if (!currentUnit) return null;
    return currentUnit.categories.find((c) => c.key === lessonCatKey) || null;
  }

  function latestSubmissionOf(match) {
    return mySubmissionsCache.find(match) || null;
  }

  // Dùng dữ liệu đã có sẵn (mySubmissionsCache) để tính nhanh — không thêm
  // tracking mới (không có "Study Time", không có "Locked" tuần tự).
  function lessonCatStats(cat) {
    const isPromptCat = lessonCatKey === "writing" || lessonCatKey === "speaking";
    const items = isPromptCat ? cat.prompts : cat.exercises;
    const topics = items.length;
    let completed = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    if (isPromptCat) {
      cat.prompts.forEach((p) => {
        const last = latestSubmissionOf((s) => (s.kind === "writing" || s.kind === "speaking") && String(s.promptId) === String(p.id));
        if (last) completed++;
      });
    } else {
      cat.exercises.forEach((ex) => {
        const last = latestSubmissionOf((s) => s.kind === "exercise" && String(s.exerciseId) === String(ex.id));
        if (last) {
          completed++;
          if (last.total > 0) {
            scoreSum += (last.score / last.total) * 100;
            scoreCount++;
          }
        }
      });
    }
    return {
      topics,
      completed,
      avgScorePct: scoreCount ? Math.round(scoreSum / scoreCount) : null
    };
  }

  function renderLessonCatContent() {
    const wrap = document.getElementById("lessonCatContent");
    wrap.innerHTML = "";
    const cat = currentLessonCategory();
    if (!cat) return;

    const isPromptCat = lessonCatKey === "writing" || lessonCatKey === "speaking";
    const stats = lessonCatStats(cat);

    const header = document.createElement("div");
    header.className = "lesson-header-card";
    header.innerHTML = `
      <div class="lesson-header-top">
        <span class="lesson-header-icon">${Icon(LESSON_CAT_ICONS[lessonCatKey])}</span>
        <div>
          <h3 style="margin:0;">${escapeHtml(LESSON_CAT_LABELS[lessonCatKey])}</h3>
          <p style="margin:2px 0 0; color:var(--muted); font-size:.86rem;">${escapeHtml(LESSON_CAT_DESC[lessonCatKey] || "")}</p>
        </div>
      </div>
      <div class="lesson-stat-row">
        <div class="lesson-stat"><span class="value">${stats.topics}</span><span class="label">${isPromptCat ? "Prompts" : "Exercises"}</span></div>
        <div class="lesson-stat"><span class="value">${stats.completed}</span><span class="label">Completed</span></div>
        ${!isPromptCat ? `<div class="lesson-stat"><span class="value">${stats.avgScorePct != null ? stats.avgScorePct + "%" : "—"}</span><span class="label">Avg Score</span></div>` : ""}
      </div>
      <div class="lesson-subtabs">
        <button type="button" class="lesson-subtab ${lessonSubTab === "learn" ? "active" : ""}" data-sub="learn">${Icon("book-open")} Learn</button>
        <button type="button" class="lesson-subtab ${lessonSubTab === "practice" ? "active" : ""}" data-sub="practice">${Icon("edit")} Practice</button>
      </div>
    `;
    header.querySelectorAll(".lesson-subtab").forEach((btn) => {
      btn.addEventListener("click", () => {
        lessonSubTab = btn.dataset.sub;
        renderLessonCatContent();
      });
    });
    wrap.appendChild(header);

    if (lessonSubTab === "learn") {
      const theoryBox = document.createElement("div");
      const hasTheory = (cat.theory.html || "").trim() || cat.theory.audioUrl || cat.theory.imageUrl;
      theoryBox.innerHTML = `<h3 style="margin-top:6px;">Theory</h3>` + (
        hasTheory
          ? `
            ${(cat.theory.html || "").trim() ? `<div class="lesson-text">${renderTheoryText(cat.theory.html)}</div>` : ""}
            ${cat.theory.audioUrl ? `<audio controls src="${cat.theory.audioUrl}" style="width:100%; margin:10px 0;"></audio>` : ""}
            ${cat.theory.imageUrl ? `<img src="${cat.theory.imageUrl}" class="diagram-image" />` : ""}
          `
          : '<div class="empty-state">No theory content available for this section.</div>'
      );
      wrap.appendChild(theoryBox);
    } else if (isPromptCat) {
      renderLessonPrompts(wrap, cat);
    } else {
      renderLessonExercises(wrap, cat);
    }
  }

  function renderLessonExercises(wrap, cat) {
    if (!cat.exercises.length) {
      wrap.insertAdjacentHTML("beforeend", '<div class="empty-state">No exercises available for this section.</div>');
      return;
    }
    cat.exercises.forEach((ex, exIdx) => {
      const last = latestSubmissionOf((s) => s.kind === "exercise" && String(s.exerciseId) === String(ex.id));
      const isOpen = openExerciseId === ex.id;
      const statusBadge = isOpen
        ? '<span class="pill pill-warn">In Progress</span>'
        : last
          ? `<span class="pill pill-ok">Completed · ${Math.round((last.score / Math.max(last.total, 1)) * 100)}%</span>`
          : '<span class="pill pill-muted">Not started</span>';
      const ctaLabel = isOpen ? "Continue" : last ? "Review" : "Start";
      const box = document.createElement("div");
      box.className = "lesson-block";
      box.innerHTML = `
        <div class="lesson-block-head">
          <div>
            <h4 style="margin:0;">${exIdx + 1}. ${escapeHtml(ex.title || "Exercise")}</h4>
            <p style="margin:4px 0 0; color:var(--muted); font-size:.85rem;">${ex.totalQuestions} questions ${statusBadge}</p>
          </div>
          <button class="btn" style="padding:8px 16px;">${ctaLabel}</button>
        </div>
        <div class="lesson-ex-form" style="display:${openExerciseId === ex.id ? "block" : "none"}; margin-top:16px;"></div>
      `;

      const formSlot = box.querySelector(".lesson-ex-form");
      if (openExerciseId === ex.id) {
        ex.sections.forEach((sec, secIdx) => {
          renderSectionBlock(sec, secIdx, cat.key === "reading" ? "reading" : "other", formSlot);
        });
        const submitBtn = document.createElement("button");
        submitBtn.className = "btn";
        submitBtn.textContent = "Submit Exercise";
        submitBtn.addEventListener("click", () => submitExercise(ex, cat, submitBtn));
        formSlot.appendChild(submitBtn);
      }

      box.querySelector(".lesson-block-head button").addEventListener("click", () => {
        openExerciseId = openExerciseId === ex.id ? null : ex.id;
        renderLessonCatContent();
      });
      wrap.appendChild(box);
    });
  }

  function submitExercise(ex, cat, btn) {
    const answers = {};
    ex.sections.forEach((sec) => sec.fields.forEach((f) => (answers[f.id] = getFieldValue(f))));
    btn.disabled = true;

    Api.submit({
      kind: "exercise",
      unitId: currentUnit.id,
      categoryKey: cat.key,
      exerciseId: ex.id,
      answers
    })
      .then((res) => {
        markRowsInline(ex.sections, res.detail);
        alert(`Score: ${res.score}/${res.total} correct.`);
        refreshMySubmissions();
      })
      .catch((err) => alert("Submission failed: " + err.message))
      .finally(() => {
        btn.disabled = false;
        openExerciseId = null;
      });
  }

  function renderLessonPrompts(wrap, cat) {
    if (!cat.prompts.length) {
      wrap.insertAdjacentHTML("beforeend", '<div class="empty-state">No prompts available for this section.</div>');
      return;
    }
    cat.prompts.forEach((p, pIdx) => {
      const last = latestSubmissionOf((s) => (s.kind === "writing" || s.kind === "speaking") && String(s.promptId) === String(p.id));
      const statusBadge = !last
        ? '<span class="pill pill-muted">Not started</span>'
        : last.gradingStatus === "graded"
          ? `<span class="pill pill-ok">Graded · ${last.manualScore} pts</span>`
          : '<span class="pill pill-warn">Pending review</span>';
      const box = document.createElement("div");
      box.className = "lesson-block";
      box.innerHTML = `
        <h4 style="margin:0 0 8px;">${pIdx + 1}. ${escapeHtml(p.title || "Prompt")} ${statusBadge}</h4>
        ${p.instructions ? `<div class="lesson-text">${escapeHtml(p.instructions)}</div>` : ""}
        ${p.imageUrl ? `<img src="${p.imageUrl}" class="diagram-image" style="margin:10px 0;" />` : ""}
        <div class="prompt-work" style="margin-top:12px;"></div>
        <div class="prompt-status" style="margin-top:12px;"></div>
      `;
      const statusEl = box.querySelector(".prompt-status");
      if (last) {
        statusEl.innerHTML =
          last.gradingStatus === "graded"
            ? `<div class="notice success">${Icon("check-circle")} Graded: <b>${last.manualScore} pts</b>${last.manualFeedback ? " — Feedback: " + escapeHtml(last.manualFeedback) : ""}</div>`
            : '<div class="notice info">Submitted — pending teacher review.</div>';
      }
      const work = box.querySelector(".prompt-work");
      const submitContext = { unitId: currentUnit.id, categoryKey: cat.key };
      if (cat.key === "writing") {
        wireWritingPrompt(work, p, submitContext, () => renderLessonCatContent());
      } else {
        wireSpeakingPrompt(work, p, submitContext, () => renderLessonCatContent());
      }
      wrap.appendChild(box);
    });
  }

  // submitContext: {unitId, categoryKey} khi prompt thuộc Lesson Unit, hoặc
  // {testId, skill:"writing"} khi thuộc Mock Test — dùng chung 1 form.
  function wireWritingPrompt(work, p, submitContext, onSubmitted) {
    work.innerHTML = `
      <textarea rows="8" class="essay-input" placeholder="Type your essay here..." style="width:100%;"></textarea>
      <button class="btn btn-essay-submit" style="margin-top:10px;">Submit Essay</button>
    `;
    const ta = work.querySelector(".essay-input");
    const btn = work.querySelector(".btn-essay-submit");
    btn.addEventListener("click", () => {
      const essayText = ta.value.trim();
      if (!essayText) {
        alert("Please type your essay before submitting.");
        return;
      }
      btn.disabled = true;
      Api.submit({
        kind: "writing",
        ...submitContext,
        promptId: p.id,
        essayText
      })
        .then((res) => {
          ta.value = "";
          void res;
          return refreshMySubmissions();
        })
        .then(() => onSubmitted())
        .catch((err) => alert("Submission failed: " + err.message))
        .finally(() => (btn.disabled = false));
    });
  }

  // ---------- Speaking recording (MediaRecorder → Cloudinary unsigned) ----------
  let activeRecorder = null; // { mediaRecorder, chunks, stream, blob, promptId }

  function stopActiveRecorder() {
    if (activeRecorder && activeRecorder.mediaRecorder && activeRecorder.mediaRecorder.state !== "inactive") {
      activeRecorder.mediaRecorder.stop();
    }
  }

  function wireSpeakingPrompt(work, p, submitContext, onSubmitted) {
    work.innerHTML = `
      <button class="btn btn-rec-toggle">${Icon("mic")} Start Recording</button>
      <span class="rec-hint" style="margin-left:10px; color:var(--muted); font-size:.85rem;"></span>
      <div class="rec-preview" style="display:none; margin-top:12px;">
        <audio controls class="rec-audio" style="width:100%;"></audio>
        <button class="btn btn-rec-submit" style="margin-top:10px;">Submit Recording</button>
      </div>
    `;
    const toggleBtn = work.querySelector(".btn-rec-toggle");
    const hint = work.querySelector(".rec-hint");
    const preview = work.querySelector(".rec-preview");
    const audioEl = work.querySelector(".rec-audio");
    const submitBtn = work.querySelector(".btn-rec-submit");

    toggleBtn.addEventListener("click", () => {
      if (activeRecorder && activeRecorder.promptId === p.id && activeRecorder.mediaRecorder && activeRecorder.mediaRecorder.state === "recording") {
        activeRecorder.mediaRecorder.stop();
        return;
      }
      stopActiveRecorder();
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        alert("Your browser does not support audio recording.");
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const mr = new MediaRecorder(stream);
          const state = { mediaRecorder: mr, chunks: [], stream, blob: null, promptId: p.id };
          activeRecorder = state;
          mr.ondataavailable = (e) => {
            if (e.data && e.data.size) state.chunks.push(e.data);
          };
          mr.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            state.blob = new Blob(state.chunks, { type: mr.mimeType || "audio/webm" });
            audioEl.src = URL.createObjectURL(state.blob);
            preview.style.display = "block";
            toggleBtn.innerHTML = Icon("mic") + " Record Again";
            hint.textContent = "";
          };
          mr.start();
          toggleBtn.innerHTML = Icon("cross") + " Stop Recording";
          hint.textContent = "Recording...";
          preview.style.display = "none";
        })
        .catch((err) => alert("Unable to access microphone: " + err.message));
    });

    submitBtn.addEventListener("click", () => {
      const blob = activeRecorder && activeRecorder.blob;
      if (!blob) {
        alert("Please record audio before submitting.");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Uploading...";
      Api.uploadSpeakingAudio(blob)
        .then(({ audioUrl, audioPublicId }) =>
          Api.submit({
            kind: "speaking",
            ...submitContext,
            promptId: p.id,
            audioUrl,
            audioPublicId
          })
        )
        .then(() => {
          activeRecorder = null;
          return refreshMySubmissions();
        })
        .then(() => onSubmitted())
        .catch((err) => {
          alert("Submission failed: " + err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Recording";
        });
    });
  }

  // Khởi tạo chạy ban đầu
  checkAuth();
})();
