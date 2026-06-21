"use client";

import React from "react";
import { Users, Shield, Database } from "lucide-react";
import { useAdmin } from "../AdminContext";

export default function DashboardPage() {
  const { users, gridCells, isPlaying, localTimeOfDay } = useAdmin();

  const formatTime = (time: number) => {
    const hours24 = Math.floor(time);
    const minutes = Math.floor((time - hours24) * 60);
    const ampm = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const padMin = minutes.toString().padStart(2, "0");
    const padHr = hours12.toString().padStart(2, "0");
    return `${padHr}:${padMin} ${ampm}`;
  };

  return (
    <>
      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-850 p-4 rounded-2xl flex items-center gap-4 animate-fade-in transition-colors duration-300">
          <div className="w-12 h-12 bg-sky-100 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold">
              Total Avatars
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {users.length}
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-850 p-4 rounded-2xl flex items-center gap-4 transition-colors duration-300">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Administrators
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {users.filter((u) => u.role === "admin").length}
            </div>
          </div>
        </div>

        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-850 p-4 rounded-2xl flex items-center gap-4 transition-colors duration-300">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Database State
            </div>
            <div className="text-xs font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
              Connected
            </div>
          </div>
        </div>
      </div>

      {/* Overview Details */}
      <div className="bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-xl dark:shadow-2xl rounded-3xl p-6 flex flex-col gap-4 transition-colors duration-300">
        <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">
          Welcome to the Admin Command Center
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Use the navigation sidebar to manage different aspects of ShunyaScape.
          You can control global environments, view commercial outlet tax/revenue status,
          and moderate/teleport active residents in real time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col gap-1.5 transition-colors duration-300">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Environment Info</span>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Current Simulation Time: <span className="text-cyan-600 dark:text-cyan-400 font-mono">{formatTime(localTimeOfDay)}</span>
            </div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Status: <span className={isPlaying ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{isPlaying ? "Active (Playing)" : "Paused"}</span>
            </div>
          </div>
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col gap-1.5 transition-colors duration-300">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Commerce Info</span>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Built Stores: <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {gridCells.filter(
                  (c) =>
                    [
                      "restaurant",
                      "clothshop",
                      "barbershop",
                      "policestation",
                    ].includes(c.type) ||
                    (c.type === "construction" &&
                      [
                        "restaurant",
                        "clothshop",
                        "barbershop",
                        "policestation",
                      ].includes(c.targetType)),
                ).length}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Active Residents: <span className="text-sky-600 dark:text-sky-400 font-bold">{users.length}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
