"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import {
  ArrowLeft,
  LayoutDashboard,
  Sliders,
  Compass,
  Store,
  Users,
  RefreshCw,
  Moon,
  Sun,
  Lock,
  Mail,
  Key
} from "lucide-react";
import { AdminProvider, useAdmin } from "./AdminContext";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 bg-slate-200/50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-300 dark:hover:bg-slate-850 rounded-xl transition-all shadow"
      title="Toggle Theme"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600" />
      )}
    </button>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentUser,
    setCurrentUser,
    setUsers,
    fetchUsers,
    refreshing,
    loading
  } = useAdmin();

  // Login form state (local to layout when not authenticated)
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || "Login failed");
        setLoginLoading(false);
        return;
      }

      const user = data.user;
      if (user.role !== "admin") {
        setLoginError("Forbidden: Only administrators can access this panel.");
        setLoginLoading(false);
        return;
      }

      localStorage.setItem("dreamcity_user", JSON.stringify(user));
      setCurrentUser(user);
      setLoginLoading(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setLoginError("Server connection failed");
      setLoginLoading(false);
    }
  };

  if (loading && !currentUser) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">Loading admin session...</div>;
  }

  // If not logged in as Admin, show the login panel
  if (!currentUser) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-200/50 via-slate-50 to-indigo-200/50 dark:from-cyan-950/20 dark:via-slate-950 dark:to-indigo-950/20 z-0" />
        <div className="w-full max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-3xl p-6 md:p-8 flex flex-col gap-6 text-center z-10 relative">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Lock className="w-6 h-6 text-white animate-pulse" />
            </div>
            <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 dark:from-red-400 dark:via-orange-350 dark:to-amber-300 bg-clip-text text-transparent uppercase tracking-wider">
              ShunyaScape Admin Portal
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-slate-450 max-w-xs leading-normal">
              Authentication required. Only registered admin users can access
              these controls.
            </p>
          </div>

          {loginError && (
            <div className="px-3 py-2 bg-red-100/80 dark:bg-red-950/40 border border-red-300/80 dark:border-red-800/40 text-red-700 dark:text-red-400 text-xs font-medium rounded-lg text-left">
              {loginError}
            </div>
          )}

          <form
            onSubmit={handleAdminLogin}
            className="flex flex-col gap-4 text-left"
          >
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-550" />
                <input
                  type="email"
                  required
                  placeholder="admin@domain.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-red-500/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-550" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-red-500/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-500 dark:to-orange-600 hover:from-red-500 hover:to-orange-500 dark:hover:from-red-400 dark:hover:to-orange-500 text-white font-bold rounded-lg text-xs shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? "Authenticating..." : "Enter Admin Panel"}
            </button>
          </form>

          <Link
            href="/"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 transition-all mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Simulation</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col overflow-hidden relative transition-colors duration-300">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Fixed Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 z-20 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 bg-slate-200/50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-300 dark:hover:bg-slate-850 rounded-xl transition-all shadow"
            title="Return to City Builder"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Link>
          <ThemeToggle />
          <div>
            <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 dark:from-cyan-400 dark:via-sky-300 dark:to-indigo-300 bg-clip-text text-transparent animate-pulse">
              ShunyaScape Dashboard
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-450">
              Administrative Control Panel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {currentUser.name}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-end">
              <span>💰</span>
              <span>{currentUser.shunyaCoins || 0} SC</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchUsers()}
              disabled={refreshing || loading}
              className="px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-semibold rounded-lg shadow transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 text-slate-700 dark:text-slate-300"
              title="Refresh simulator data manually"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden md:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>

            <button
              onClick={() => {
                localStorage.removeItem("shunyascape_user");
                setCurrentUser(null);
                setUsers([]);
              }}
              className="px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold rounded-lg shadow transition-all cursor-pointer text-slate-700 dark:text-slate-300"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Fixed Sidebar */}
        <aside className="w-64 border-r border-slate-200 dark:border-slate-900 bg-white/40 dark:bg-slate-950/40 backdrop-blur-xl flex flex-col justify-between shrink-0 transition-colors duration-300">
          <div className="p-4 flex flex-col gap-1.5">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
              Navigation
            </div>
            
            <Link
              href="/admin/dashboard"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                pathname === "/admin/dashboard" || pathname === "/admin"
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "border border-transparent text-slate-600 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </Link>

            <Link
              href="/admin/controls"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                pathname === "/admin/controls"
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "border border-transparent text-slate-600 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Simulation Controls</span>
            </Link>

            <Link
              href="/admin/quests"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                pathname === "/admin/quests"
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "border border-transparent text-slate-600 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Quests & Economy</span>
            </Link>

            <Link
              href="/admin/outlets"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                pathname === "/admin/outlets"
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "border border-transparent text-slate-600 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Commercial Outlets</span>
            </Link>

            <Link
              href="/admin/residents"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                pathname === "/admin/residents"
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400"
                  : "border border-transparent text-slate-600 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Residents Directory</span>
            </Link>
          </div>

          {/* Sidebar Status Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-900/60 bg-slate-50 dark:bg-slate-950/20 flex flex-col gap-1">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              System Status
            </div>
            <div className="flex items-center gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>Database Connected</span>
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-600 mt-1">
              v1.2.0 • ShunyaScape Admin
            </div>
          </div>
        </aside>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AdminProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </AdminProvider>
    </ThemeProvider>
  );
}
