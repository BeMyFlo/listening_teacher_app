# Tài liệu dự án

## Tổng quan & bàn giao

- [APP-SUMMARY.md](APP-SUMMARY.md): tóm tắt sản phẩm và mô hình kinh doanh (BeMyFlo)
- [HANDOFF.md](HANDOFF.md): bàn giao giữa các phiên AI, nên đọc trước khi code
- [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md): hướng dẫn cài đặt cho giáo viên
- [CODE-REVIEW-FINDINGS.md](CODE-REVIEW-FINDINGS.md): nhật ký lỗi tìm được khi review code

## Kế hoạch tính năng (`plans/`)

- [PLAN-DASHBOARD-RESTRUCTURE.md](plans/PLAN-DASHBOARD-RESTRUCTURE.md): tái cấu trúc thành dashboard
- [PLAN-DEADLINE-EMAIL-JOB.md](plans/PLAN-DEADLINE-EMAIL-JOB.md): email học sinh khi giao deadline
- [PLAN-GRAMMAR-VOCAB-LESSONS.md](plans/PLAN-GRAMMAR-VOCAB-LESSONS.md): bài học Grammar & Vocabulary, flashcard, import
- [PLAN-IELTS-QUESTION-TYPES.md](plans/PLAN-IELTS-QUESTION-TYPES.md): đủ dạng câu hỏi IELTS Reading/Listening + import CSV
- [PLAN-MOCK-TEST-4-SKILLS.md](plans/PLAN-MOCK-TEST-4-SKILLS.md): Mock Test gộp 4 kỹ năng
- [PLAN-UNIT-VOCAB-REVIEW.md](plans/PLAN-UNIT-VOCAB-REVIEW.md): Vocab Review theo từng skill Reading / Listening (AI + nhập tay)
- [PLAN-LEVEL-NAMES.md](plans/PLAN-LEVEL-NAMES.md): tên cho từng Level theo trung tâm và chương trình (Band 3.5–5.0, 300–450...)
- [PLAN-LANDING-PAGE.md](plans/PLAN-LANDING-PAGE.md): Phase 11, trang giới thiệu www.bemyflo.com
- [PLAN-PHASE12-GENERAL-ENGLISH.md](plans/PLAN-PHASE12-GENERAL-ENGLISH.md): Phase 12, chương trình General English lớp 6–12 (phân tích + lộ trình, đã chốt Q1–Q10)
- [PLAN-PHASE12-G0.md](plans/PLAN-PHASE12-G0.md): Phase 12 đợt G0, bản thi hành (registry General, 27 chỗ `=== "toeic"`, level Grade 6–12, điểm thang 10)
- [PLAN-PHASE12-G1.md](plans/PLAN-PHASE12-G1.md): Phase 12 đợt G1, đủ dạng bài phổ thông (gạch chân, sắp xếp từ, viết lại câu, Accept this answer)
- [PLAN-PHASE12-G3.md](plans/PLAN-PHASE12-G3.md): Phase 12 đợt G3, AI soạn bài theo dạng đề phổ thông + import đề Word (.docx)
- [PLAN-PHASE12-G2.md](plans/PLAN-PHASE12-G2.md): Phase 12 đợt G2, đề thi theo khuôn (THPT, vào 10 HCM, kiểm tra trên lớp), chặn xuất bản đề dở, kết quả theo phần
- [PLAN-PHASE12-G5.md](plans/PLAN-PHASE12-G5.md): Phase 12 đợt G5, Writing/Speaking thang 10 (rubric + AI chấm theo khối lớp)

## Multi-tenant (`plans/multi-tenant/`)

- [PLAN-MULTI-TENANT.md](plans/multi-tenant/PLAN-MULTI-TENANT.md): kế hoạch tổng, đọc trước
- [PLAN-PHASE2-TENANT-READ.md](plans/multi-tenant/PLAN-PHASE2-TENANT-READ.md): Phase 2, lọc mọi route đọc
- [PLAN-PHASE3-STEP12-WRITE-STAMP.md](plans/multi-tenant/PLAN-PHASE3-STEP12-WRITE-STAMP.md): Phase 3 bước 1–2, gán `workspaceId` khi ghi
- [PLAN-PHASE3-STEP45-CLASS-CRON.md](plans/multi-tenant/PLAN-PHASE3-STEP45-CLASS-CRON.md): Phase 3 bước 4–5, GV tự tạo lớp + cron theo workspace
- [PLAN-PHASE8-TOEIC.md](plans/multi-tenant/PLAN-PHASE8-TOEIC.md): Phase 8, chương trình TOEIC (8A Nghe/Đọc, 8B Nói/Viết)
- [PLAN-PHASE8B-TOEIC-SW.md](plans/multi-tenant/PLAN-PHASE8B-TOEIC-SW.md): Phase 8B chi tiết, TOEIC Speaking & Writing
