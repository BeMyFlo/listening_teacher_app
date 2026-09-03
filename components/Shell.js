"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "@/lib/nav";
import { clearSession } from "@/lib/client/session";
import { useShellBadges } from "@/lib/client/shellBadges";
import NotificationBell from "./NotificationBell";

function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return (parts[parts.length - 1] || "?").slice(0, 2);
}

export default function Shell({ role, userName, userSub, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const cfg = NAV[role];
  const badges = useShellBadges();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    if (!userMenu) return;
    const close = () => setUserMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [userMenu]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const isMobileDrawer = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 680px)").matches;

  function onNav() {
    if (isMobileDrawer()) setCollapsed(false);
  }

  return (
    <div className={"app-shell" + (collapsed ? " collapsed" : "")} id="appShell">
      <div className="sidebar-backdrop" onClick={() => setCollapsed(false)} />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="logo" src="/logo.svg" alt="Ms Nhi" />
          <button
            type="button"
            className="sidebar-collapse-btn"
            title="Toggle navigation sidebar"
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg className="icon"><use href="#icon-arrow-left" /></svg>
          </button>
        </div>

        {cfg.groups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            {group.label && <div className="sidebar-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const badge = badges[item.href];
              const show = badge && badge.value != null && String(badge.value) !== "" && Number(badge.value) !== 0;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    router.push(item.href);
                    onNav();
                  }}
                  className={"sidebar-link" + (active ? " active" : "")}
                  data-nav={item.href}
                >
                  <svg className="icon"><use href={"#icon-" + item.icon} /></svg>
                  <span className="link-label">{item.label}</span>
                  <span
                    className={"sidebar-badge" + (badge && badge.warn ? " warn" : "")}
                    style={show ? undefined : { display: "none" }}
                  >
                    {show ? String(badge.value) : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {cfg.promo && (
          <div className="sidebar-promo">
            <svg className="icon sidebar-promo-icon"><use href="#icon-sparkles" /></svg>
            <div className="sidebar-promo-title">{cfg.promo.title}</div>
            <div className="sidebar-promo-text">{cfg.promo.text}</div>
          </div>
        )}

        <div className="sidebar-user">
          <div className="avatar">{initials(userName)}</div>
          <div className="user-meta">
            <div className="user-name">{userName || ""}</div>
            <div className="user-role">{userSub || cfg.userSub || cfg.roleLabel}</div>
          </div>
          <button type="button" className="icon-btn" data-action="logout" title="Log out" onClick={logout}>
            <svg className="icon"><use href="#icon-logout" /></svg>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar-v2">
          <button
            type="button"
            className="icon-btn topbar-menu-btn"
            data-action="toggle-sidebar"
            title="Toggle navigation sidebar"
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg className="icon"><use href="#icon-menu" /></svg>
          </button>
          <div className="topbar-search">
            <svg className="icon"><use href="#icon-search" /></svg>
            <input type="text" placeholder={cfg.searchPlaceholder || "Search..."} readOnly />
            <span className="kbd-hint">Ctrl K</span>
          </div>
          <NotificationBell role={role} />
          <div
            className={"topbar-user" + (userMenu ? " open" : "")}
            data-action="toggle-user-menu"
            onClick={(e) => {
              e.stopPropagation();
              setUserMenu((v) => !v);
            }}
          >
            <div className="avatar avatar-sm">{initials(userName)}</div>
            <div className="topbar-user-meta">
              <span className="role-pill">{cfg.roleLabel}</span>
              <span className="name">{userName || ""}</span>
            </div>
            <svg className="icon topbar-user-chevron"><use href="#icon-chevron-down" /></svg>
            <div className="topbar-user-menu" id="topbarUserMenu">
              <button type="button" className="topbar-user-menu-item" data-action="logout" onClick={logout}>
                <svg className="icon"><use href="#icon-logout" /></svg> Log out
              </button>
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
