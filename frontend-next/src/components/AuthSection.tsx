"use client";

import { useState, useRef, FormEvent, DragEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/api";
import { LogoSvg } from "./LogoSvg";
import type { LoginResponse } from "@/lib/types";

export default function AuthSection() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragover, setDragover] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast("Please upload your resume before creating an account.", "error");
      return;
    }
    setLoading(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData();
      formData.append("email", (form.elements.namedItem("email") as HTMLInputElement).value);
      formData.append("username", (form.elements.namedItem("username") as HTMLInputElement).value);
      formData.append("password", (form.elements.namedItem("password") as HTMLInputElement).value);
      if (selectedFile) formData.append("resume", selectedFile);

      await apiFetch("/register", { method: "POST", body: formData });
      showToast("Account created successfully! Please login.", "success");

      const email = (form.elements.namedItem("email") as HTMLInputElement).value;
      setMode("login");
      setTimeout(() => {
        if (emailRef.current) emailRef.current.value = email;
      }, 50);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = e.currentTarget;
      const data = await apiFetch<LoginResponse>("/login", {
        method: "POST",
        body: JSON.stringify({
          email: (form.elements.namedItem("email") as HTMLInputElement).value,
          password: (form.elements.namedItem("password") as HTMLInputElement).value,
        }),
      });
      login(data.access_token, {
        id: data.user_id,
        unique_id: data.unique_id,
        username: data.username,
      });
      showToast(`Welcome back, ${data.username}!`, "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  return (
    <section className="auth-container">
      <div className="brand-header">
        <div className="logo">
          <div className="logo-icon">
            <LogoSvg size={32} id="logo-grad" />
          </div>
          <h1 className="logo-text">
            BrandForge<span className="accent">AI</span>
          </h1>
        </div>
        <p className="brand-tagline">Your AI-powered personal branding studio</p>
      </div>

      {mode === "register" ? (
        <div className="auth-card glass-card">
          <h2 className="card-title">Create Account</h2>
          <p className="card-subtitle">Upload your resume and let AI build your brand</p>

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input type="email" name="email" placeholder="you@example.com" required />
              </div>
            </div>
            <div className="form-group">
              <label>Username</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" name="username" placeholder="johndoe" required />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type={showPassword ? "text" : "password"} name="password" placeholder="••••••••" required minLength={6} />
                <button
                  type="button"
                  className={`password-toggle ${showPassword ? "active" : ""}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Resume / LinkedIn Profile</label>
              <div
                className={`file-upload ${dragover ? "dragover" : ""} ${selectedFile ? "has-file" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
                onDrop={handleDrop}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-icon">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="upload-text">Drop your file here or <span className="upload-link">browse</span></p>
                <p className="upload-hint">PDF, DOC, or DOCX — Max 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                  }}
                />
                {selectedFile && <p className="file-name">{selectedFile.name}</p>}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <span className="btn-loader"><span className="spinner" /> Creating...</span>
              ) : (
                <span className="btn-text">Create Account & Upload</span>
              )}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account?{" "}
            <a onClick={() => setMode("login")}>Sign In</a>
          </div>
        </div>
      ) : (
        <div className="auth-card glass-card">
          <h2 className="card-title">Welcome Back</h2>
          <p className="card-subtitle">Sign in to your branding studio</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input ref={emailRef} type="email" name="email" placeholder="you@example.com" required />
              </div>
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type={showPassword ? "text" : "password"} name="password" placeholder="••••••••" required />
                <button
                  type="button"
                  className={`password-toggle ${showPassword ? "active" : ""}`}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <span className="btn-loader"><span className="spinner" /> Signing in...</span>
              ) : (
                <span className="btn-text">Sign In</span>
              )}
            </button>
          </form>

          <div className="auth-switch">
            Don&apos;t have an account?{" "}
            <a onClick={() => setMode("register")}>Create Account</a>
          </div>
        </div>
      )}
    </section>
  );
}
