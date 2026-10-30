import { PROGRAMS } from "./curriculum.js";

// Cấu hình điều hướng cho từng vai trò — khớp với sidebar bản legacy
// (shell.js / teacher.js / student.js).
export const NAV = {
  teacher: {
    home: "/teacher/overview",
    roleLabel: "TEACHER",
    userSub: "Administrator",
    searchPlaceholder: "Search students, mock tests...",
    promo: {
      title: "Have a productive teaching day!",
      text: "Create new lessons and mock tests for your students to practice.",
    },
    groups: [
      { label: "MAIN", items: [{ href: "/teacher/overview", label: "Overview", icon: "home" }] },
      {
        label: "LEARNING",
        items: [
          { href: "/teacher/lessons", label: "Lessons", icon: "book-open" },
          { href: "/teacher/tests", label: "Mock Tests", icon: "clipboard" },
        ],
      },
      {
        label: "LIBRARY",
        items: [
          { href: "/teacher/audio", label: "Audio Library", icon: "headphones" },
          { href: "/teacher/images", label: "Image Library", icon: "image" },
          // requires = cờ trong registry chương trình (PROGRAMS[p][cờ]); workspace không có chương trình nào bật thì ẩn.
          { href: "/teacher/question-bank", label: "Question Bank", icon: "list", requires: "questionBank" },
        ],
      },
      {
        label: "MANAGEMENT",
        items: [
          { href: "/teacher/grading", label: "Grading Queue", icon: "check-circle" },
          { href: "/teacher/classes", label: "Classes", icon: "student" },
          { href: "/teacher/students", label: "Students", icon: "user" },
          { href: "/teacher/settings", label: "Notifications", icon: "bell", exact: true },
          { href: "/teacher/settings/workspace", label: "Workspace", icon: "settings" },
          { href: "/teacher/tickets", label: "Support", icon: "inbox" },
        ],
      },
    ],
  },
  admin: {
    home: "/admin",
    roleLabel: "ADMIN",
    userSub: "System Admin",
    searchPlaceholder: "Search users, classes...",
    groups: [
      { label: "MAIN", items: [{ href: "/admin", label: "Dashboard", icon: "home", exact: true }] },
      {
        label: "PEOPLE",
        items: [
          { href: "/admin/users", label: "Users", icon: "user" },
          { href: "/admin/workspaces", label: "Workspaces", icon: "shield" },
          { href: "/admin/signups", label: "Sign-up requests", icon: "user-plus" },
          { href: "/admin/classes", label: "Classes", icon: "student" },
        ],
      },
      {
        label: "SUPPORT",
        items: [{ href: "/admin/tickets", label: "Tickets", icon: "inbox" }],
      },
      {
        label: "MONITOR",
        items: [
          { href: "/admin/audit", label: "Activity Log", icon: "list" },
          { href: "/admin/ai-logs", label: "AI Log", icon: "sparkles" },
          { href: "/admin/notifications", label: "Notifications Log", icon: "bell" },
        ],
      },
      {
        label: "SYSTEM",
        items: [
          { href: "/admin/storage", label: "Database & Storage", icon: "chart-bar" },
          { href: "/admin/system", label: "System", icon: "settings" },
        ],
      },
    ],
  },
  student: {
    home: "/student",
    roleLabel: "STUDENT",
    searchPlaceholder: "Search lessons, mock tests...",
    groups: [
      {
        label: "MAIN",
        items: [
          { href: "/student", label: "Dashboard", icon: "home", exact: true },
          { href: "/student/lessons", label: "Lessons", icon: "book-open" },
          { href: "/student/notebook", label: "Notebook", icon: "notebook" },
        ],
      },
      { label: "PRACTICE", items: [{ href: "/student/tests", label: "Mock Tests", icon: "clipboard" }] },
      { label: "HELP", items: [{ href: "/student/tickets", label: "Support", icon: "inbox" }] },
    ],
  },
};

// Lọc menu theo chương trình của workspace: mục có `requires` chỉ hiện khi có chương trình bật cờ đó.
// Mục không có `requires` giữ nguyên -> workspace chỉ IELTS/TOEIC thấy đúng menu cũ. Nhóm hết mục thì bỏ.
export function visibleNavGroups(groups, programs) {
  const list = Array.isArray(programs) ? programs : [];
  const ok = (item) => !item.requires || list.some((p) => PROGRAMS[p] && PROGRAMS[p][item.requires]);
  return (groups || [])
    .map((g) => ({ ...g, items: g.items.filter(ok) }))
    .filter((g) => g.items.length > 0);
}

export const ROLE_LABEL = { admin: "ADMIN", teacher: "TEACHER", student: "STUDENT" };
