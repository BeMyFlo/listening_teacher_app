// ============================================================
//  LOGIC TRANG HỌC SINH (IELTS with Ms Nhi)
// ============================================================
(function () {
  let studentName = "";
  let currentSubject = ""; // 'listening' | 'reading'
  let currentTest = null; // full test detail from API (public shape, no answers)
  let testReplayCount = 0;

  const sections = ["step-auth", "step-subject", "step-picker", "step-test", "step-result"];

  function show(id) {
    sections.forEach((s) => (document.getElementById(s).style.display = s === id ? "block" : "none"));
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
  function checkAuth() {
    const token = Api.getStudentToken();
    if (!token) {
      document.getElementById("studentNavInfo").style.display = "none";
      document.getElementById("btnStudentLogout").style.display = "none";
      show("step-auth");
      return;
    }

    const payload = decodeJwt(token);
    if (!payload || payload.role !== "student") {
      Api.clearStudentToken();
      document.getElementById("studentNavInfo").style.display = "none";
      document.getElementById("btnStudentLogout").style.display = "none";
      show("step-auth");
      return;
    }

    studentName = payload.name || payload.username;
    document.getElementById("studentNavName").textContent = studentName;
    document.getElementById("studentNavInfo").style.display = "inline";
    document.getElementById("btnStudentLogout").style.display = "inline";

    if (!currentSubject) {
      show("step-subject");
    } else {
      show("step-picker");
    }
  }

  // ---------- XỬ LÝ AUTHENTICATION (Đăng nhập / Đăng ký) ----------
  const tabBtnLogin = document.getElementById("tabBtnLogin");
  const tabBtnRegister = document.getElementById("tabBtnRegister");
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");
  const authError = document.getElementById("authError");

  tabBtnLogin.addEventListener("click", () => {
    tabBtnLogin.classList.add("active");
    tabBtnRegister.classList.remove("active");
    formLogin.style.display = "block";
    formRegister.style.display = "none";
    authError.style.display = "none";
  });

  tabBtnRegister.addEventListener("click", () => {
    tabBtnRegister.classList.add("active");
    tabBtnLogin.classList.remove("active");
    formLogin.style.display = "none";
    formRegister.style.display = "block";
    authError.style.display = "none";
  });

  // Đăng nhập
  document.getElementById("btnLoginSubmit").addEventListener("click", async () => {
    authError.style.display = "none";
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) {
      authError.textContent = "Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.";
      authError.style.display = "block";
      return;
    }

    try {
      const res = await Api.studentLogin({ username, password });
      Api.setStudentToken(res.token);
      checkAuth();
    } catch (err) {
      authError.textContent = err.message;
      authError.style.display = "block";
    }
  });

  // Đăng ký
  document.getElementById("btnRegisterSubmit").addEventListener("click", async () => {
    authError.style.display = "none";
    const name = document.getElementById("regName").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;

    if (!name || !username || !password) {
      authError.textContent = "Vui lòng điền đầy đủ thông tin.";
      authError.style.display = "block";
      return;
    }

    if (password.length < 6) {
      authError.textContent = "Mật khẩu phải tối thiểu 6 ký tự.";
      authError.style.display = "block";
      return;
    }

    try {
      await Api.studentRegister({ name, username, password });
      // Đăng ký xong tự động đăng nhập luôn
      const res = await Api.studentLogin({ username, password });
      Api.setStudentToken(res.token);
      checkAuth();
    } catch (err) {
      authError.textContent = err.message;
      authError.style.display = "block";
    }
  });

  // Đăng xuất
  document.getElementById("btnStudentLogout").addEventListener("click", (e) => {
    e.preventDefault();
    Api.clearStudentToken();
    currentSubject = "";
    currentTest = null;
    checkAuth();
  });

  // ---------- CHỌN KỸ NĂNG (SUBJECT PICKER) ----------
  document.getElementById("btnChooseListening").addEventListener("click", (e) => {
    e.preventDefault();
    currentSubject = "listening";
    renderPicker();
    show("step-picker");
  });

  document.getElementById("btnChooseReading").addEventListener("click", (e) => {
    e.preventDefault();
    currentSubject = "reading";
    renderPicker();
    show("step-picker");
  });

  document.getElementById("backToSubject").addEventListener("click", () => {
    currentSubject = "";
    show("step-subject");
  });

  document.getElementById("backToPickerFromTest").addEventListener("click", () => show("step-picker"));
  document.getElementById("btnBackList").addEventListener("click", () => show("step-picker"));

  // ---------- DANH SÁCH BÀI KIỂM TRA (TEST LIST) ----------
  function renderPicker() {
    const pickerSubjectText = document.getElementById("pickerSubjectText");
    pickerSubjectText.textContent = currentSubject === "listening" ? "(Nghe - Listening)" : "(Đọc - Reading)";
    renderTestList();
  }

  function renderTestList() {
    const statusEl = document.getElementById("testStatus");
    const testList = document.getElementById("testList");
    testList.innerHTML = "";
    statusEl.style.display = "block";
    statusEl.className = "notice info";
    statusEl.textContent = "Đang tải danh sách bài kiểm tra...";

    Api.listTests({ subject: currentSubject })
      .then((data) => {
        const rows = data.rows || [];
        statusEl.style.display = "none";
        if (!rows.length) {
          testList.innerHTML = '<div class="empty-state">Giáo viên chưa công bố bài kiểm tra nào cho kỹ năng này.</div>';
          return;
        }
        rows.forEach((test) => {
          const item = document.createElement("div");
          item.className = "list-item";
          item.innerHTML = `
            <div class="meta">
              <h4>${escapeHtml(test.unit)} · ${escapeHtml(test.title)}</h4>
              <p>${test.totalQuestions} câu · Thời gian làm bài linh hoạt</p>
            </div>
            <button class="btn">Làm bài</button>`;
          item.querySelector("button").addEventListener("click", () => startTest(test.id));
          testList.appendChild(item);
        });
      })
      .catch((err) => {
        statusEl.className = "notice error";
        statusEl.innerHTML = Icon("warning") + " Không tải được danh sách bài kiểm tra: " + escapeHtml(err.message);
      });
  }

  // ---------- LÀM BÀI KIỂM TRA (TESTING FLOW) ----------
  function startTest(testId) {
    const formEl = document.getElementById("testForm");
    formEl.innerHTML = '<div class="notice info">Đang tải bài kiểm tra...</div>';
    show("step-test");

    Api.getTest(testId)
      .then((data) => {
        currentTest = data.test;
        testReplayCount = 0;
        renderTestForm(currentTest);
      })
      .catch((err) => {
        formEl.innerHTML = `<div class="notice error">${Icon("warning")} Không tải được bài kiểm tra: ${escapeHtml(err.message)}</div>`;
      });
  }

  function renderTestForm(test) {
    document.getElementById("testTitle").textContent = `${test.unit} · ${test.title}`;
    document.getElementById("testInstructions").textContent = test.instructions;

    const testSubjectBadge = document.getElementById("testSubjectBadge");
    testSubjectBadge.textContent = test.subject === "listening" ? "Listening Test" : "Reading Test";
    testSubjectBadge.className = "badge test " + (test.subject === "listening" ? "listening" : "reading");

    const formEl = document.getElementById("testForm");
    formEl.innerHTML = "";

    test.sections.forEach((sec, secIdx) => {
      // Wrapper cho mỗi Section
      const secWrapper = document.createElement("div");
      secWrapper.style.marginBottom = "30px";

      if (test.subject === "reading") {
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
          const img = document.createElement("img");
          img.src = sec.imageUrl;
          img.className = "diagram-image";
          passagePane.appendChild(img);
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
            <span class="replay-count" id="${replayId}">Đã nghe: 0 lần</span>
          `;
          
          // Audio error handling
          const audioEl = player.querySelector("audio");
          const replayEl = player.querySelector("#" + replayId);
          let secCount = 0;

          audioEl.addEventListener("play", () => {
            secCount++;
            testReplayCount++;
            replayEl.textContent = "Đã nghe: " + secCount + " lần";
          });

          audioEl.addEventListener("error", () => {
            if (player.parentNode) {
              const errNotice = document.createElement("div");
              errNotice.className = "notice error";
              errNotice.style.marginTop = "8px";
              errNotice.style.width = "100%";
              errNotice.innerHTML = Icon("warning") + " Lỗi: Không tải được file âm thanh này. Vui lòng báo lại giáo viên.";
              player.parentNode.insertBefore(errNotice, player.nextSibling);
            }
          });

          secWrapper.appendChild(player);
        }

        // Sơ đồ hoặc hình vẽ phụ trợ bài nghe (nếu có)
        if (sec.imageUrl) {
          const img = document.createElement("img");
          img.src = sec.imageUrl;
          img.className = "diagram-image";
          img.style.margin = "0 auto 16px";
          secWrapper.appendChild(img);
        }

        // Render các field câu hỏi trực tiếp vào wrapper
        renderSectionFields(sec, secIdx, secWrapper);
      }

      formEl.appendChild(secWrapper);
    });
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
              ${selectCount > 1 ? `<span class="select-hint">(Chọn tối đa ${selectCount} đáp án)</span>` : ""}
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
          <span class="label">${escapeHtml(f.label)}${f.pre ? ": " + escapeHtml(f.pre) : ""}</span>
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

  function submitTest() {
    const test = currentTest;
    if (!test) return;

    const answers = {};
    test.sections.forEach((sec) => sec.fields.forEach((f) => (answers[f.id] = getFieldValue(f))));

    const btn = document.getElementById("btnSubmitTest");
    btn.disabled = true;

    Api.submit({
      testId: test.id,
      answers,
      replayCount: testReplayCount
    })
      .then((res) => {
        renderResult(test, answers, res);
      })
      .catch((err) => {
        alert("Nộp bài thất bại: " + err.message);
      })
      .finally(() => {
        btn.disabled = false;
      });
  }

  function renderResult(test, answers, res) {
    const detailById = {};
    (res.detail || []).forEach((d) => (detailById[d.id] = d));

    test.sections.forEach((sec) => {
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
            // Chèn vào cuối hàng
            row.appendChild(note);
          }
          note.textContent = "Đáp án đúng: " + (d.answer || "");
        } else if (note) {
          note.remove();
        }
      });
    });

    document.getElementById("resultTitle").textContent = `${test.unit} · ${test.title} — ${studentName}`;
    document.getElementById("scoreValue").textContent = res.score;
    document.getElementById("scoreTotal").textContent = res.total;

    const detail = document.getElementById("resultDetail");
    detail.innerHTML = "";

    test.sections.forEach((sec) => {
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
        const shown = answerLabel(f, submittedVal, sec) || "(bỏ trống)";
        
        const row = document.createElement("div");
        row.className = "field-row " + (d.correct ? "correct" : "wrong");
        row.innerHTML = `
          <span class="num">${f.id}.</span>
          <span class="label">${escapeHtml(f.label)}</span>
          <span class="tail" style="flex:1;">Bạn chọn/viết: <b>${escapeHtml(shown)}</b>
          ${!d.correct ? " · Đáp án đúng: <b>" + escapeHtml(d.answer || "") + "</b>" : ""}</span>
          <span class="result-mark ${d.correct ? "correct" : "wrong"}">${d.correct ? Icon("check") : Icon("cross")}</span>
        `;
        secWrapper.appendChild(row);
      });
      detail.appendChild(secWrapper);
    });

    const statusEl = document.getElementById("submitStatus");
    statusEl.className = "notice success";
    statusEl.innerHTML = Icon("check-circle") + " Đã gửi kết quả cho giáo viên thành công.";
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

  document.getElementById("btnRetake").addEventListener("click", () => startTest(currentTest.id));

  // Khởi tạo chạy ban đầu
  checkAuth();
})();
