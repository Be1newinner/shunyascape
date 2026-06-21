"use client";

import React, { useState } from 'react';
import { Sparkles, Globe, Users, Building, ArrowRight, Shield, Zap, Activity } from 'lucide-react';
import AuthModal from './components/AuthModal';

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <main className="relative min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden selection:bg-cyan-500/30">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/20 blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-blue-600/10 blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
        
        {/* Hexagonal Grid Overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">Shunya<span className="text-cyan-400">Scape</span></span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAuthModal(true)}
            className="text-sm font-bold text-slate-300 hover:text-white transition-colors"
          >
            Log In
          </button>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="relative overflow-hidden group bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all duration-300"
          >
            <span className="relative z-10 flex items-center gap-2">
              Join World
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-32 pb-24 px-4 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold mb-8 animate-fade-in-up">
          <Sparkles className="w-3.5 h-3.5" />
          <span>v2.0 Multiplayer Engine Live</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight leading-tight mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Build The Future.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500">Together.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Dive into a massively multiplayer 3D simulation. Architect skyscrapers, form syndicates, manage complex economies, and shape the destiny of a breathing digital metropolis.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="group relative flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-xl shadow-cyan-500/25 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            Enter Simulation
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="relative z-10 py-24 px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Building className="w-6 h-6 text-cyan-400" />}
            title="Real-time City Builder"
            description="Construct massive skyscrapers, residential blocks, and parks in a fully persistent 3D world."
            color="cyan"
          />
          <FeatureCard 
            icon={<Users className="w-6 h-6 text-fuchsia-400" />}
            title="Multiplayer Syndicates"
            description="Form permanent groups of up to 8 players. Complete massive weekly raid quests and build together."
            color="fuchsia"
          />
          <FeatureCard 
            icon={<Activity className="w-6 h-6 text-amber-400" />}
            title="Dynamic Economy"
            description="Experience a living economy where stamina, hunger, rent, and utility bills drive your daily choices."
            color="amber"
          />
        </div>
      </section>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </main>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: 'cyan' | 'fuchsia' | 'amber' }) {
  const bgColors = {
    cyan: 'bg-cyan-500/5 group-hover:bg-cyan-500/10',
    fuchsia: 'bg-fuchsia-500/5 group-hover:bg-fuchsia-500/10',
    amber: 'bg-amber-500/5 group-hover:bg-amber-500/10',
  };
  
  const borderColors = {
    cyan: 'border-cyan-500/10 group-hover:border-cyan-500/30',
    fuchsia: 'border-fuchsia-500/10 group-hover:border-fuchsia-500/30',
    amber: 'border-amber-500/10 group-hover:border-amber-500/30',
  };

  return (
    <div className={`group relative flex flex-col p-8 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 overflow-hidden`}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${bgColors[color]}`} />
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${borderColors[color]} bg-[#0a0a0a]`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3 relative z-10">{title}</h3>
      <p className="text-slate-400 leading-relaxed relative z-10">{description}</p>
    </div>
  );
}
