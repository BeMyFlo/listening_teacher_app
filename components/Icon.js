// Bộ icon SVG dùng chung — port nguyên từ public/legacy/assets/icons.js.
// <IconSprite/> chèn 1 sprite ẩn (đặt 1 lần trong layout); <Icon name/> hoặc
// icon(name) trả về <svg class="icon"><use href="#icon-name"/></svg> để CSS
// .icon trong legacy.css áp dụng y hệt bản cũ.

export const ICON_SYMBOLS = {
  headphones:
    '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/>',
  student:
    '<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5"/><path d="M22 8v6"/>',
  teacher:
    '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8"/><path d="M12 16v4"/><path d="M7 8.5l3 3 3-4 4 5"/>',
  "arrow-left": '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
  refresh:
    '<path d="M3 12a9 9 0 0 1 15.3-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.3L3 16"/><path d="M3 21v-5h5"/>',
  wave:
    '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M10 10.5V4a1.5 1.5 0 0 1 3 0v7"/><path d="M13 11V6a1.5 1.5 0 0 1 3 0v7"/><path d="M16 12v-3a1.5 1.5 0 0 1 3 0v6c0 3.3-2.7 6-6 6h-1.5c-2 0-3.9-1-5-2.7L4.3 14.8a1.3 1.3 0 0 1 2.1-1.5L8 15"/>',
  clipboard:
    '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6"/><path d="M9 15h6"/>',
  speaker:
    '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 7a7.5 7.5 0 0 1 0 10"/>',
  warning: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5 5-5.5"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  cross: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  upload:
    '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6 7l1 13a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  edit: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 6.5l3 3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  logout:
    '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  "chart-bar": '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  list:
    '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  "book-open":
    '<path d="M12 6.5c-1.8-1.3-4.2-2-6.5-2A2.5 2.5 0 0 0 3 7v11c2.3 0 4.7.7 6.5 2 .5.4 1.5.4 2 0 1.8-1.3 4.2-2 6.5-2A2.5 2.5 0 0 0 21 15.5V7c0-1.4-1.1-2.5-2.5-2.5-2.3 0-4.7.7-6.5 2Z"/><path d="M12 6.5V20"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4.5 4.5"/><path d="m13 15 2.5-2.5L20 17"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  "user-plus":
    '<path d="M6 20.5V19a5 5 0 0 1 5-5h1.5"/><circle cx="10.5" cy="8" r="4"/><path d="M18 9v6"/><path d="M15 12h6"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z"/><path d="M10 19a2.2 2.2 0 0 0 4 0"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3.5 10h17"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  grammar:
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M9 7h7"/><path d="M9 11h5"/>',
  vocabulary:
    '<rect x="7.5" y="3.5" width="13" height="13" rx="2"/><rect x="3.5" y="7.5" width="13" height="13" rx="2"/><path d="M7 12h6"/><path d="M7 15.5h4"/>',
  writing:
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h5v-6h2v6h5V10"/>',
  external:
    '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 13v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off":
    '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.2 4"/><path d="M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.5 9.7a3 3 0 0 0 4.2 4.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="M8 5v14l11-7-11-7Z"/>',
  sparkles:
    '<path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M6 6l2.5 2.5"/><path d="M15.5 15.5 18 18"/><path d="M18 6l-2.5 2.5"/><path d="M8.5 15.5 6 18"/>',
  trophy:
    '<path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a3 3 0 0 0 3 5"/><path d="M16 5h3a3 3 0 0 1-3 5"/><path d="M12 14v3"/><path d="M9 21h6"/><path d="M9.5 21c0-2 1-3 2.5-4 1.5 1 2.5 2 2.5 4"/>',
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/>',
  inbox:
    '<path d="M4 12h4l2 3h4l2-3h4"/><path d="M5.5 5h13l2 7v7a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19v-7l2-7Z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
};

export function IconSprite() {
  const inner = Object.keys(ICON_SYMBOLS)
    .map((name) => `<symbol id="icon-${name}" viewBox="0 0 24 24">${ICON_SYMBOLS[name]}</symbol>`)
    .join("");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "none" }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export default function Icon({ name, flip = false, className = "" }) {
  const cls = "icon" + (flip ? " flip" : "") + (className ? " " + className : "");
  return (
    <svg className={cls} aria-hidden="true">
      <use href={"#icon-" + name} />
    </svg>
  );
}

// Chuỗi HTML cho các nơi cần chèn qua dangerouslySetInnerHTML (giữ tương
// thích với Icon("name") của bản cũ).
export function iconHtml(name, extraClass) {
  return `<svg class="icon${extraClass ? " " + extraClass : ""}"><use href="#icon-${name}"></use></svg>`;
}
