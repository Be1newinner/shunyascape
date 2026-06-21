"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mail, Lock, User, ArrowRight, Loader2, KeyRound } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
}

type AuthMode = "login" | "register" | "verify" | "forgot" | "reset";

export default function AuthModal({ onClose }: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.requiresVerification) {
            setMode("verify");
            setSuccess("An OTP has been sent to your email.");
            throw new Error(data.error || "Please verify your email.");
          }
          throw new Error(data.error || "Login failed");
        }
        router.push("/world");
      } 
      
      else if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");
        
        setMode("verify");
        setSuccess("Registration successful! Please check your email for the OTP.");
      } 
      
      else if (mode === "verify") {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Verification failed");
        
        router.push("/world");
      }

      else if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send reset email");
        
        setMode("reset");
        setSuccess("Password reset OTP sent to your email.");
      }

      else if (mode === "reset") {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Password reset failed");
        
        setMode("login");
        setSuccess("Password reset successfully. Please log in.");
        setPassword("");
        setOtp("");
      }

    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => {
    switch (mode) {
      case "login": return "Welcome Back";
      case "register": return "Create Account";
      case "verify": return "Verify Email";
      case "forgot": return "Reset Password";
      case "reset": return "Set New Password";
    }
  };

  const renderDescription = () => {
    switch (mode) {
      case "login": return "Enter your credentials to access the simulation.";
      case "register": return "Join thousands of players in ShunyaScape.";
      case "verify": return `Enter the 6-digit code sent to ${email || "your email"}.`;
      case "forgot": return "Enter your email to receive a reset code.";
      case "reset": return "Enter the OTP and your new password.";
    }
  };

  const renderButtonText = () => {
    if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;
    switch (mode) {
      case "login": return "Enter World";
      case "register": return "Start Journey";
      case "verify": return "Verify Account";
      case "forgot": return "Send Code";
      case "reset": return "Update Password";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl animate-scale-up overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -z-10 -translate-x-1/2 translate-y-1/2" />

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-3xl font-black text-white mb-2">
          {renderHeader()}
        </h2>
        <p className="text-slate-400 text-sm mb-8">
          {renderDescription()}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center font-medium animate-shake">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center font-medium animate-fade-in">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {mode === "register" && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
            </div>
          )}

          {(mode === "verify" || mode === "reset") && (
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="6-Digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono tracking-widest text-center text-lg"
              />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "reset") && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                placeholder={mode === "reset" ? "New Password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              />
            </div>
          )}

          {mode === "login" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden mt-2"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {renderButtonText()}
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </span>
          </button>
        </form>

        <div className="mt-6 text-center space-x-4">
          {(mode === "register" || mode === "verify" || mode === "forgot" || mode === "reset") && (
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Back to Login
            </button>
          )}
          {mode === "login" && (
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Don't have an account? Sign up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
