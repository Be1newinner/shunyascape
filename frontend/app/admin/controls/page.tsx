"use client";

import React from "react";
import { useAdmin } from "../AdminContext";

export default function ControlsPage() {
  const {
    isPlaying,
    updateGlobalSettings,
    settingsLoading,
    localTimeOfDay,
    setLocalTimeOfDay,
    setIsDragging,
    localTimeSpeed,
    setLocalTimeSpeed,
  } = useAdmin();

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
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-xl dark:shadow-2xl rounded-3xl p-6 flex flex-col gap-6 transition-colors duration-300">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60 pb-3 transition-colors duration-300">
        <div>
          <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            Global Simulation Environment Controls
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            Modify time, day cycle progression, and simulation play/pause
            state for all connected players.
          </p>
        </div>

        <button
          type="button"
          onClick={() => updateGlobalSettings({ isPlaying: !isPlaying })}
          disabled={settingsLoading}
          className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all cursor-pointer ${
            isPlaying
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
              : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
          }`}
        >
          {isPlaying ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              Simulation Playing
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" />
              Simulation Paused
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Time of Day Slider Card */}
        <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850/60 rounded-2xl p-4 flex flex-col gap-3 transition-colors duration-300">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Time of Day
            </span>
            <span className="text-sm font-mono font-black text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/30 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800/20">
              {formatTime(localTimeOfDay)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="23.9"
            step="0.1"
            value={localTimeOfDay}
            onChange={(e) => setLocalTimeOfDay(parseFloat(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={(e) => {
              setIsDragging(false);
              const val = parseFloat((e.target as HTMLInputElement).value);
              updateGlobalSettings({ timeOfDay: val });
            }}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={(e) => {
              setIsDragging(false);
              const val = parseFloat((e.target as HTMLInputElement).value);
              updateGlobalSettings({ timeOfDay: val });
            }}
            disabled={settingsLoading}
            className="w-full h-2 bg-slate-200 dark:bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-500 dark:accent-cyan-400 disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-550 font-bold">
            <span>00:00 (Midnight)</span>
            <span>12:00 (Noon)</span>
            <span>23:00 (Night)</span>
          </div>
        </div>

        {/* Day Cycle Speed Slider Card */}
        <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850/60 rounded-2xl p-4 flex flex-col gap-3 transition-colors duration-300">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Day Cycle Speed
            </span>
            <span className="text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/30 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/20">
              {isPlaying ? `${localTimeSpeed.toFixed(1)}x` : "Paused"}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={localTimeSpeed}
            onChange={(e) => setLocalTimeSpeed(parseFloat(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={(e) => {
              setIsDragging(false);
              const val = parseFloat((e.target as HTMLInputElement).value);
              updateGlobalSettings({ timeSpeed: val });
            }}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={(e) => {
              setIsDragging(false);
              const val = parseFloat((e.target as HTMLInputElement).value);
              updateGlobalSettings({ timeSpeed: val });
            }}
            disabled={settingsLoading || !isPlaying}
            className="w-full h-2 bg-slate-200 dark:bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500 dark:accent-indigo-400 disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-550 font-bold">
            <span>0.1x (Slowest)</span>
            <span>1.0x (Normal)</span>
            <span>3.0x (Fastest)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
