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
        ],
      },
      {
        label: "MANAGEMENT",
        items: [
          { href: "/teacher/submissions", label: "Submissions", icon: "list" },
          { href: "/teacher/classes", label: "Classes", icon: "student" },
          { href: "/teacher/students", label: "Students", icon: "user" },
        ],
      },
    ],
  },
  student: {
    home: "/student/lessons",
    roleLabel: "STUDENT",
    searchPlaceholder: "Search lessons, mock tests...",
    groups: [
      { label: "MAIN", items: [{ href: "/student/lessons", label: "Lessons", icon: "book-open" }] },
      { label: "PRACTICE", items: [{ href: "/student/tests", label: "Mock Tests", icon: "clipboard" }] },
    ],
  },
};

export const ROLE_LABEL = { teacher: "TEACHER", student: "STUDENT" };
