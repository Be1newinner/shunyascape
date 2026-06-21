"use client";

import React, { useMemo } from "react";
import { Coins, Flame, Home, Zap, TrendingUp, Percent, Trophy, Clock, Calendar, CalendarDays, Users, Pizza, TreePine, Activity, Building, Scissors, ShieldAlert, Store, Compass, MessageCircle, Hammer, Camera, MapPin } from "lucide-react";
import { useAdmin } from "../AdminContext";
import { questsData, Quest } from "./questsData";

const iconMap: Record<string, React.ReactNode> = {
  TreePine: <TreePine className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  Pizza: <Pizza className="w-4 h-4" />,
  MessageCircle: <MessageCircle className="w-4 h-4" />,
  Moon: <MapPin className="w-4 h-4" />, // Fallback to MapPin if Moon isn't imported, but wait I'll import MapPin instead of Moon for night
  Users: <Users className="w-4 h-4" />,
  Utensils: <Pizza className="w-4 h-4" />,
  Hammer: <Hammer className="w-4 h-4" />,
  Scissors: <Scissors className="w-4 h-4" />,
  Camera: <Camera className="w-4 h-4" />,
  Building: <Building className="w-4 h-4" />,
  Coins: <Coins className="w-4 h-4" />,
  ShieldAlert: <ShieldAlert className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Compass: <Compass className="w-4 h-4" />,
  Store: <Store className="w-4 h-4" />,
  Trophy: <Trophy className="w-4 h-4" />
};

function QuestCard({ quest }: { quest: Quest }) {
  return (
    <div className={`p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden transition-colors duration-300 border ${quest.bgColorClass} ${quest.borderColorClass}`}>
      <div className="absolute top-0 right-0 bg-slate-900/10 dark:bg-slate-100/10 text-slate-800 dark:text-slate-200 text-[8px] font-bold px-2 py-0.5 rounded-bl border-l border-b border-slate-900/10 dark:border-slate-100/10">
        Level {quest.levelReq} Required
      </div>
      
      {quest.minPartySize && (
        <div className="absolute bottom-0 right-0 bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 text-[8px] font-black px-2 py-0.5 rounded-tl border-t border-l border-fuchsia-500/30 flex items-center gap-1 shadow-fuchsia-500/20">
          <Users className="w-2.5 h-2.5" />
          Party of {quest.minPartySize}+
        </div>
      )}

      <div className={`font-bold text-xs flex items-center gap-1.5 ${quest.textColorClass}`}>
        {iconMap[quest.icon] || <Trophy className="w-4 h-4" />}
        <span className="text-slate-800 dark:text-slate-200">{quest.title}</span>
      </div>
      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal mb-4">
        {descriptionFormat(quest.description)}
      </p>
      
      <div className="mt-auto flex justify-between items-center pt-2 border-t border-slate-900/10 dark:border-slate-100/10">
        <span className="text-[9px] font-bold text-slate-600 dark:text-slate-500">Goal: {quest.goal}</span>
        <span className={`text-[10px] font-black ${quest.textColorClass}`}>
          +{quest.rewardSC.toLocaleString()} SC · +{quest.rewardXP.toLocaleString()} XP
        </span>
      </div>
    </div>
  );
}

function descriptionFormat(desc: string) {
  return desc.length > 90 ? desc.substring(0, 90) + "..." : desc;
}

export default function QuestsPage() {
  const {
    hungerDecayRate,
    housingRentRate,
    utilityBillRate,
    energyDrainRate,
    transactionTaxRate,
    updateGlobalSettings,
  } = useAdmin();

  const dailyQuests = useMemo(() => questsData.filter(q => q.type === "daily"), []);
  const weeklyQuests = useMemo(() => questsData.filter(q => q.type === "weekly"), []);
  const monthlyQuests = useMemo(() => questsData.filter(q => q.type === "monthly"), []);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn transition-colors duration-300">
      {/* Economics Sliders */}
      <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Coin Economics & Drain Rates</h2>
            <p className="text-xs text-slate-600 dark:text-slate-500">Configure parameters to control how fast players lose coins, incentivizing active gameplay.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hunger Decay Rate */}
          <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900/60 p-4 rounded-xl flex flex-col gap-3 transition-colors duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Hunger Decay Rate</span>
              </div>
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">{hungerDecayRate.toFixed(1)}% / hr</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={hungerDecayRate}
              onChange={(e) => updateGlobalSettings({ hungerDecayRate: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-500">Speed of players' hunger decay. Higher rates cause hunger levels to drop faster.</p>
          </div>

          {/* Housing Rent Rate */}
          <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900/60 p-4 rounded-xl flex flex-col gap-3 transition-colors duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Housing Rent Rate</span>
              </div>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{housingRentRate} SC / midnight</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={housingRentRate}
              onChange={(e) => updateGlobalSettings({ housingRentRate: parseInt(e.target.value) })}
              className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-500">Rent amount deducted automatically from residents at midnight in-game time.</p>
          </div>

          {/* Utility Bill Rate */}
          <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900/60 p-4 rounded-xl flex flex-col gap-3 transition-colors duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Utility Bill Rate</span>
              </div>
              <span className="text-xs font-black text-yellow-600 dark:text-yellow-400">{utilityBillRate} SC / noon</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={utilityBillRate}
              onChange={(e) => updateGlobalSettings({ utilityBillRate: parseInt(e.target.value) })}
              className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-500">Utilities (water/electricity) bill deducted from residents at noon in-game time.</p>
          </div>

          {/* Energy Drain Rate */}
          <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900/60 p-4 rounded-xl flex flex-col gap-3 transition-colors duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Energy Drain Multiplier</span>
              </div>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{energyDrainRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={energyDrainRate}
              onChange={(e) => updateGlobalSettings({ energyDrainRate: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-500">Multiplier applied to stamina drain when players are sprinting.</p>
          </div>
        </div>
      </div>

      {/* Quests System View */}
      <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-none transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">Simulation Quests Directory</h2>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                Overview of all {questsData.length} active quests in the engine.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {/* Daily Quests */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                Daily Challenges ({dailyQuests.length})
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyQuests.map((q) => <QuestCard key={q.id} quest={q} />)}
            </div>
          </div>

          {/* Weekly Quests */}
          <div>
            <div className="flex items-center gap-2 mb-3 pt-4 border-t border-slate-200 dark:border-slate-900/60">
              <Calendar className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                Weekly Milestones ({weeklyQuests.length})
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weeklyQuests.map((q) => <QuestCard key={q.id} quest={q} />)}
            </div>
          </div>

          {/* Monthly Quests */}
          <div>
            <div className="flex items-center gap-2 mb-3 pt-4 border-t border-slate-200 dark:border-slate-900/60">
              <CalendarDays className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                Monthly Expeditions ({monthlyQuests.length})
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthlyQuests.map((q) => <QuestCard key={q.id} quest={q} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
