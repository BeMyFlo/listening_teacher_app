// Phase 8B bước 6 — máy trạng thái thuần của Mock Test Speaking TOEIC.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PHASES,
  MIC_CHECK_SECONDS,
  MAX_UPLOAD_ATTEMPTS,
  storageKeyFor,
  createInitialFlowState,
  startMicCheck,
  failMicCheck,
  finishMicCheck,
  startTest,
  continueResume,
  onAudioEnded,
  onAudioError,
  onPrepEnded,
  onRecordEnded,
  onUploadSuccess,
  onUploadFailure,
  startRetryUploads,
  forceFinishFlow,
  remainingSeconds,
  progressPct,
  uploadAndSubmitWithRetry,
} = require("../lib/toeicSpeakingFlow");

const samplePrompts = () => [
  { id: "q1", title: "Question 1", instructions: "Read aloud", taskType: "toeic.s.read", prepSeconds: 45, responseSeconds: 45 },
  { id: "q5", title: "Question 5", instructions: "Respond", taskType: "toeic.s.respond", audioUrl: "https://example.com/q5.mp3", audioPlays: 1, prepSeconds: 3, responseSeconds: 15 },
  { id: "q10", title: "Question 10", instructions: "Use info", taskType: "toeic.s.info", imageUrl: "https://example.com/i.png", audioUrl: "https://example.com/q10.mp3", audioPlays: 2, prepSeconds: 45, responseSeconds: 30 },
  { id: "q0prep", title: "Zero Prep", instructions: "Immediate", taskType: "toeic.s.respond", prepSeconds: 0, responseSeconds: 15 },
];

test("khởi tạo mới + kiểm micro: chặn Start test khi chưa kiểm hoặc micro bị chặn", () => {
  assert.equal(storageKeyFor("stu1", "test9"), "toeic-speaking:stu1:test9");
  let s = createInitialFlowState(samplePrompts());
  assert.equal(s.phase, PHASES.INTRO);
  assert.equal(s.micChecked, false);

  // Bấm Start test khi chưa kiểm micro -> giữ ở INTRO và báo lỗi
  const blocked = startTest(s);
  assert.equal(blocked.phase, PHASES.INTRO);
  assert.match(blocked.micError, /microphone check/i);

  // Bắt đầu thu thử 3s -> bị từ chối quyền micro
  s = startMicCheck(s);
  assert.equal(s.phase, PHASES.MIC_RECORDING);
  assert.equal(s.secondsLeft, MIC_CHECK_SECONDS);

  s = failMicCheck(s, "Permission denied");
  assert.equal(s.phase, PHASES.INTRO);
  assert.equal(s.micChecked, false);
  assert.equal(s.micError, "Permission denied");
  assert.equal(startTest(s).phase, PHASES.INTRO);

  // Thu thử 3s thành công -> cho phép Start test
  s = startMicCheck(s);
  s = finishMicCheck(s);
  assert.equal(s.phase, PHASES.MIC_READY);
  assert.equal(s.micChecked, true);

  s = startTest(s);
  assert.equal(s.started, true);
  assert.equal(s.currentIndex, 0);
  // Q1 không có audio -> vào thẳng PREP
  assert.equal(s.phase, PHASES.PREP);
  assert.equal(s.secondsLeft, 45);
});

test("luồng từng câu: không audio -> prep -> record; có audio 1 lần & 2 lần; prep = 0 vào ghi ngay", () => {
  let s = createInitialFlowState(samplePrompts());
  s = finishMicCheck(startMicCheck(s));
  s = startTest(s);

  // Q1: prep -> record -> xong câu 1
  assert.equal(s.currentIndex, 0);
  assert.equal(s.phase, PHASES.PREP);
  s = onPrepEnded(s);
  assert.equal(s.phase, PHASES.RECORD);
  assert.equal(s.secondsLeft, 45);
  s = onRecordEnded(s, { hasBlob: true });
  assert.deepEqual(s.inflightIds, ["q1"]);

  // Q5: có audio (audioPlays = 1) -> AUDIO -> PREP (3s) -> RECORD (15s)
  assert.equal(s.currentIndex, 1);
  assert.equal(s.phase, PHASES.AUDIO);
  assert.equal(s.audioPlay, 1);
  assert.equal(s.audioPlaysMax, 1);
  s = onAudioEnded(s);
  assert.equal(s.phase, PHASES.PREP);
  assert.equal(s.secondsLeft, 3);
  s = onPrepEnded(s);
  assert.equal(s.phase, PHASES.RECORD);
  assert.equal(s.secondsLeft, 15);
  s = onRecordEnded(s, { hasBlob: true });

  // Q10: có audio (audioPlays = 2) -> phát đủ 2 lần mới sang PREP
  assert.equal(s.currentIndex, 2);
  assert.equal(s.phase, PHASES.AUDIO);
  assert.equal(s.audioPlay, 1);
  assert.equal(s.audioPlaysMax, 2);
  s = onAudioEnded(s);
  assert.equal(s.phase, PHASES.AUDIO);
  assert.equal(s.audioPlay, 2);
  s = onAudioEnded(s);
  assert.equal(s.phase, PHASES.PREP);
  assert.equal(s.secondsLeft, 45);
  s = onPrepEnded(s);
  assert.equal(s.phase, PHASES.RECORD);
  assert.equal(s.secondsLeft, 30);
  s = onRecordEnded(s, { hasBlob: true });

  // Q0prep: không có audio và prepSeconds = 0 -> vào RECORD ngay
  assert.equal(s.currentIndex, 3);
  assert.equal(s.phase, PHASES.RECORD);
  assert.equal(s.secondsLeft, 15);
  s = onRecordEnded(s, { hasBlob: true });

  // Hết câu cuối nhưng còn inflightIds -> UPLOADING
  assert.equal(s.phase, PHASES.UPLOADING);
  for (const id of ["q1", "q5", "q10", "q0prep"]) {
    s = onUploadSuccess(s, id);
  }
  assert.equal(s.phase, PHASES.DONE);
  assert.equal(s.finished, true);
  assert.equal(s.recordedCount, 4);
});

test("audio lỗi / đồ giả: báo lỗi và chuyển ngay sang prep (hoặc record nếu prep = 0), không treo", () => {
  let s = createInitialFlowState([
    { id: "q5", title: "Q5", instructions: "I", taskType: "toeic.s.respond", audioUrl: "https://bad/audio.mp3", audioPlays: 2, prepSeconds: 3, responseSeconds: 15 },
    { id: "q6", title: "Q6", instructions: "I", taskType: "toeic.s.respond", audioUrl: "https://bad/audio2.mp3", audioPlays: 1, prepSeconds: 0, responseSeconds: 15 },
  ]);
  s = startTest(finishMicCheck(startMicCheck(s)));
  assert.equal(s.phase, PHASES.AUDIO);

  s = onAudioError(s, "Audio failed to load");
  assert.equal(s.phase, PHASES.PREP);
  assert.equal(s.secondsLeft, 3);
  assert.match(s.audioError, /Audio failed to load/);

  s = onRecordEnded(onPrepEnded(s), { hasBlob: true });
  assert.equal(s.currentIndex, 1);
  assert.equal(s.phase, PHASES.AUDIO);

  // Đề có prepSeconds = 0 khi audio lỗi thì sang thẳng RECORD
  s = onAudioError(s, "Corrupt audio");
  assert.equal(s.phase, PHASES.RECORD);
  assert.equal(s.secondsLeft, 15);
});

test("tải lại trang giữa chừng (E6): chỉ tin bài nộp trên server, đề đang dở làm lại từ prep", () => {
  const prompts = samplePrompts();
  // localStorage khai đã nộp q1 + q5, nhưng trên server chỉ có q1 -> chỉ bỏ qua q1,
  // và q5 (đang làm dở) làm lại từ PREP (bỏ qua phát lại audio để vào thẳng phần chuẩn bị).
  const savedState = { started: true, currentIndex: 2, submittedIds: ["q1", "q5"], finished: false };
  let s = createInitialFlowState(prompts, {
    serverSubmittedIds: ["q1"],
    savedState,
  });

  assert.equal(s.resumed, true);
  assert.equal(s.started, true);
  assert.deepEqual(s.submittedIds, ["q1"]);
  assert.equal(s.currentIndex, 1); // q5
  // Chờ học sinh bấm "Continue" (cần thao tác chạm để mở khoá audio/micro), chưa chạy đồng hồ.
  assert.equal(s.phase, PHASES.RESUME);
  assert.equal(s.secondsLeft, 0);
  const notResume = { ...s, phase: PHASES.PREP };
  assert.equal(continueResume(notResume), notResume); // pha khác RESUME thì bỏ qua
  s = continueResume(s);
  assert.equal(s.phase, PHASES.PREP);
  assert.equal(s.currentIndex, 1);
  assert.equal(s.secondsLeft, 3);

  // Sau khi làm xong q5, sang q10 (đề mới tiếp theo) thì vẫn phát audio như bình thường
  s = onRecordEnded(onPrepEnded(s), { hasBlob: true });
  assert.equal(s.currentIndex, 2); // q10
  assert.equal(s.phase, PHASES.AUDIO);

  // Nếu tất cả đề đã nộp trên server -> alreadyFinished = true, phase = DONE
  const doneState = createInitialFlowState(prompts, {
    serverSubmittedIds: ["q1", "q5", "q10", "q0prep"],
    savedState: null,
  });
  assert.equal(doneState.phase, PHASES.DONE);
  assert.equal(doneState.alreadyFinished, true);
});

test("upload lỗi: thử lại 2 lần (tổng 3 lần), giữ kết quả upload nếu submit lỗi, không nộp trùng, Retry upload ở cuối", async () => {
  let uploadCalls = 0;
  let submitCalls = 0;

  // Ca 1: upload thành công ngay lần 1, submit lỗi 2 lần rồi lần 3 thành công -> không upload lại, chỉ 1 bài nộp được tạo
  const res1 = await uploadAndSubmitWithRetry({
    blob: { size: 100 },
    promptId: "q1",
    retryDelayMs: 1,
    uploadFn: async () => {
      uploadCalls++;
      return { audioUrl: "https://res.cloudinary.com/oqczcg2z/video/upload/v1/a.webm", audioPublicId: "a" };
    },
    submitFn: async () => {
      submitCalls++;
      if (submitCalls < 3) throw new Error("Network error");
      return { ok: true };
    },
  });
  assert.equal(res1.ok, true);
  assert.equal(res1.attempts, MAX_UPLOAD_ATTEMPTS);
  assert.equal(uploadCalls, 1);
  assert.equal(submitCalls, 3);

  // Ca 2: lỗi cả 3 lần -> trả ok: false và giữ cachedUpload
  let failAttempts = 0;
  const res2 = await uploadAndSubmitWithRetry({
    blob: { size: 100 },
    promptId: "q5",
    retryDelayMs: 1,
    uploadFn: async () => {
      failAttempts++;
      throw new Error("Upload failed");
    },
    submitFn: async () => {},
  });
  assert.equal(res2.ok, false);
  assert.equal(res2.attempts, MAX_UPLOAD_ATTEMPTS);
  assert.equal(failAttempts, 3);

  // Máy trạng thái chuyển sang RETRY khi còn đề lỗi ở cuối, rồi sang DONE sau khi Retry thành công
  let s = createInitialFlowState([samplePrompts()[0]]);
  s = startTest(finishMicCheck(startMicCheck(s)));
  s = onRecordEnded(onPrepEnded(s), { hasBlob: true });
  assert.equal(s.phase, PHASES.UPLOADING);

  s = onUploadFailure(s, "q1");
  assert.equal(s.phase, PHASES.RETRY);
  assert.deepEqual(s.failedIds, ["q1"]);

  s = startRetryUploads(s);
  assert.equal(s.phase, PHASES.UPLOADING);
  assert.deepEqual(s.inflightIds, ["q1"]);

  s = onUploadSuccess(s, "q1");
  assert.equal(s.phase, PHASES.DONE);
  assert.equal(s.recordedCount, 1);

  // Force finish (hết giờ cấp kỹ năng / tab switch)
  const forced = forceFinishFlow(s);
  assert.equal(forced.phase, PHASES.DONE);
  assert.equal(forced.finished, true);
});

test("remainingSeconds & progressPct: tính theo mốc thời gian tuyệt đối", () => {
  const now = 1_000_000;
  const deadline = now + 15_000;
  assert.equal(remainingSeconds(deadline, now), 15);
  assert.equal(remainingSeconds(deadline, now + 7_200), 8);
  assert.equal(remainingSeconds(deadline, now + 15_000), 0);
  assert.equal(remainingSeconds(deadline, now + 20_000), 0);

  assert.equal(progressPct(deadline, 15, now), 0);
  assert.equal(progressPct(deadline, 15, now + 7_500), 50);
  assert.equal(progressPct(deadline, 15, now + 15_000), 100);
});
