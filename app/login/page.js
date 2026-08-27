"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { storeLoginResult } from "@/lib/client/session";
import { NAV } from "@/lib/nav";

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = form.loginUsername.value.trim();
    const password = form.loginPassword.value;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const data = await api.login(username, password);
      storeLoginResult(data, remember);
      router.replace(NAV[data.role].home);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-skills">
        <span className="login-skill-pill sk-blue">
          <svg className="icon"><use href="#icon-headphones" /></svg> Listening
        </span>
        <span className="login-skill-pill sk-green">
          <svg className="icon"><use href="#icon-book-open" /></svg> Reading
        </span>
        <span className="login-skill-pill sk-purple">
          <svg className="icon"><use href="#icon-writing" /></svg> Writing
        </span>
        <span className="login-skill-pill sk-red">
          <svg className="icon"><use href="#icon-mic" /></svg> Speaking
        </span>
        <span className="login-skill-pill sk-indigo">
          <svg className="icon"><use href="#icon-grammar" /></svg> Grammar
        </span>
        <span className="login-skill-pill sk-amber">
          <svg className="icon"><use href="#icon-vocabulary" /></svg> Vocabulary
        </span>
      </div>

      <div className="login-stage">
        <div className="login-deco login-deco-left">
          <div className="login-tagline">
            Learn.<br />Practice.<br />Achieve.
          </div>
          <svg className="login-arrow" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 5 C 40 5, 60 40, 110 45" stroke="#a9b8e0" strokeWidth="2" strokeDasharray="5 5" fill="none" markerEnd="url(#arrowhead)" />
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" fill="#a9b8e0" />
              </marker>
            </defs>
          </svg>
          <svg className="login-books" viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g transform="translate(2,60)">
              <path d="M10 90 L50 90 L46 130 L14 130 Z" fill="#e7e2f7" />
              <ellipse cx="30" cy="90" rx="20" ry="5" fill="#d6cff2" />
              <path d="M30 90 C10 70 8 40 20 20 C24 45 28 60 30 90Z" fill="#5fa86a" />
              <path d="M30 90 C50 65 55 35 42 15 C36 42 32 60 30 90Z" fill="#79c084" />
              <path d="M30 90 C15 75 10 55 16 40 C22 58 27 72 30 90Z" fill="#8fd39a" />
            </g>
            <g transform="translate(50,40)">
              <rect x="0" y="118" width="150" height="26" rx="6" fill="#8b9ce8" />
              <rect x="6" y="88" width="138" height="26" rx="6" fill="#4a9b6e" />
              <rect x="0" y="58" width="150" height="26" rx="6" fill="#e8a23a" />
              <rect x="8" y="24" width="134" height="32" rx="8" fill="#4653d6" />
              <text x="75" y="45" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Segoe UI, sans-serif">IELTS</text>
            </g>
          </svg>
        </div>

        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-brand">
            <img className="logo" src="/logo.svg" alt="Ms Nhi" />
          </div>
          <p className="login-sub">Sign in to continue — role is detected automatically (Teacher / Student).</p>

          <div className="form-row login-field">
            <label htmlFor="loginUsername">Username</label>
            <svg className="icon"><use href="#icon-user" /></svg>
            <input id="loginUsername" name="loginUsername" type="text" placeholder="Enter your username" autoComplete="username" required />
          </div>
          <div className="form-row login-field" style={{ marginBottom: 0 }}>
            <label htmlFor="loginPassword">Password</label>
            <svg className="icon"><use href="#icon-lock" /></svg>
            <input
              id="loginPassword"
              name="loginPassword"
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="toggle-pw"
              tabIndex={-1}
              aria-label="Show/hide password"
              onClick={() => setShowPw((v) => !v)}
            >
              <svg className="icon"><use href={showPw ? "#icon-eye-off" : "#icon-eye"} /></svg>
            </button>
          </div>

          <div className="login-row-between">
            <label className="login-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <button
              type="button"
              className="login-forgot"
              onClick={() => {
                setError("");
                setInfo("Passwords are managed by your teacher — please contact them to reset your password.");
              }}
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="notice error" style={{ display: "block" }}>
              {error}
            </div>
          )}
          {info && (
            <div className="notice info" style={{ display: "block" }}>
              {info}
            </div>
          )}
          <button type="submit" className="btn login-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> Signing in...
              </>
            ) : (
              <>
                Sign In <svg className="icon flip"><use href="#icon-arrow-left" /></svg>
              </>
            )}
          </button>

          <div className="login-divider">OR</div>
          <button
            type="button"
            className="btn login-google"
            onClick={() => {
              setInfo("Google sign-in isn't set up yet — please sign in with your username and password.");
              setError("");
            }}
          >
            <span className="login-google-g" /> Continue with Google
          </button>

          <div className="login-footnote">
            <svg className="icon"><use href="#icon-shield" /></svg>
            <span>
              Each student uses a unique account created by their teacher. Test results are saved and displayed in the
              teacher dashboard.
            </span>
          </div>
        </form>

        <div className="login-deco login-deco-right">
          <div className="floating-card progress-card">
            <div className="fc-label">Progress</div>
            <svg className="progress-ring" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e8ecfb" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#4653d6"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="264"
                strokeDashoffset="40"
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="57" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1c2733" fontFamily="Segoe UI, sans-serif">
                85%
              </text>
            </svg>
            <div className="fc-sub">Great job! 🎉</div>
          </div>
          <div className="floating-card trophy-card">
            <div className="trophy-chip">
              <svg className="icon"><use href="#icon-trophy" /></svg>
            </div>
            <div className="trophy-lines">
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
