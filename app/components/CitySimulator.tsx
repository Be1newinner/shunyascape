'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  TreePine, 
  Home, 
  Building2, 
  Trash2, 
  Eye, 
  Sun, 
  Moon, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Users, 
  Hammer, 
  Construction, 
  Sparkles,
  Play,
  Pause,
  Compass
} from 'lucide-react';
import { ThreeCity, BuildType, CityStats } from './three-city';

export default function CitySimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<ThreeCity | null>(null);

  // States
  const [buildMode, setBuildMode] = useState<BuildType>('road');
  const [stats, setStats] = useState<CityStats>({
    population: 0,
    houses: 0,
    skyscrapers: 0,
    trees: 0,
    roads: 0,
    activeConstruction: 0,
  });

  const [timeOfDay, setTimeOfDay] = useState<number>(8.0);
  const [timeSpeed, setTimeSpeed] = useState<number>(0.5);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Initialize Simulation Engine
  useEffect(() => {
    if (!containerRef.current) return;

    // Create simulator instance
    const citySim = new ThreeCity(containerRef.current, (newStats) => {
      setStats({ ...newStats });
    });

    cityRef.current = citySim;

    // Set initial configuration
    citySim.buildMode = 'road';
    citySim.timeSpeed = 0.5;
    citySim.audio.toggle(false);

    // Sync time of day from the animation loop to the state slider
    const timeSyncInterval = setInterval(() => {
      if (cityRef.current) {
        setTimeOfDay(cityRef.current.timeOfDay);
      }
    }, 100);

    return () => {
      clearInterval(timeSyncInterval);
      if (cityRef.current) {
        cityRef.current.destroy();
        cityRef.current = null;
      }
    };
  }, []);

  // Update build mode
  const handleModeChange = (mode: BuildType) => {
    setBuildMode(mode);
    if (cityRef.current) {
      cityRef.current.buildMode = mode;
    }
  };

  // Toggle Sound
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (cityRef.current) {
      cityRef.current.audio.toggle(nextState);
      // Play a quick test sound if enabled
      if (nextState) {
        cityRef.current.audio.playPop();
      }
    }
  };

  // Update Simulation speed / pause
  const handleTogglePlay = () => {
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    if (cityRef.current) {
      cityRef.current.timeSpeed = nextPlay ? timeSpeed : 0.0;
    }
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    setTimeSpeed(speed);
    if (cityRef.current && isPlaying) {
      cityRef.current.timeSpeed = speed;
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTimeOfDay(val);
    if (cityRef.current) {
      cityRef.current.timeOfDay = val;
    }
  };

  // Helper to format time (e.g. 14.5 -> "02:30 PM")
  const formatTime = (time: number) => {
    const hours24 = Math.floor(time);
    const minutes = Math.floor((time - hours24) * 60);
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const padMin = minutes.toString().padStart(2, '0');
    const padHr = hours12.toString().padStart(2, '0');
    return `${padHr}:${padMin} ${ampm}`;
  };

  // Determine current day-night phase string for UI background tints
  const getSkyPhaseColor = () => {
    if (timeOfDay >= 18.0 && timeOfDay < 20.0) return 'from-orange-500/20 to-purple-900/20'; // Sunset
    if (timeOfDay >= 20.0 || timeOfDay < 4.0) return 'from-indigo-950/40 to-slate-900/40'; // Night
    if (timeOfDay >= 4.0 && timeOfDay < 6.0) return 'from-purple-900/20 to-orange-500/20'; // Sunrise
    return 'from-sky-400/10 to-blue-500/10'; // Day
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Ambient sky overlay color mask for premium cinematic overlay */}
      <div className={`absolute inset-0 pointer-events-none transition-colors duration-1000 bg-gradient-to-t ${getSkyPhaseColor()} z-5`} />

      {/* Sleek Floating Dashboard Overlay */}
      <div className="absolute inset-x-0 top-0 p-4 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 pointer-events-none z-10">
        
        {/* Left Side: Title & Status Stats Panel */}
        <div className="flex flex-col gap-4 pointer-events-auto max-w-sm md:max-w-md w-full">
          {/* Logo / Header */}
          <div className="flex items-center gap-3 bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 transition-all duration-300 hover:border-sky-500/30">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                DreamCity 3D
              </h1>
              <p className="text-xs text-slate-400 font-medium">Interactive Agentic Simulation</p>
            </div>
          </div>

          {/* City Live Statistics Grid */}
          <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 grid grid-cols-3 gap-3">
            {/* Pop */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60">
              <Users className="w-4 h-4 text-cyan-400 mb-1" />
              <span className="text-xs text-slate-400">Population</span>
              <span className="text-sm font-semibold mt-0.5">{stats.population}</span>
            </div>

            {/* Trees */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60">
              <TreePine className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-xs text-slate-400">Forestry</span>
              <span className="text-sm font-semibold mt-0.5">{stats.trees}</span>
            </div>

            {/* Roads */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60">
              <div className="w-4 h-4 text-slate-400 font-bold border border-slate-400 rounded-sm text-[8px] flex items-center justify-center mb-1">R</div>
              <span className="text-xs text-slate-400">Roads</span>
              <span className="text-sm font-semibold mt-0.5">{stats.roads}</span>
            </div>

            {/* Houses */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60">
              <Home className="w-4 h-4 text-amber-400 mb-1" />
              <span className="text-xs text-slate-400">Houses</span>
              <span className="text-sm font-semibold mt-0.5">{stats.houses}</span>
            </div>

            {/* Skyscrapers */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60">
              <Building2 className="w-4 h-4 text-indigo-400 mb-1" />
              <span className="text-xs text-slate-400">Towers</span>
              <span className="text-sm font-semibold mt-0.5">{stats.skyscrapers}</span>
            </div>

            {/* Under construction */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all hover:bg-slate-800/60">
              <Hammer className="w-4 h-4 text-yellow-500 mb-1 animate-bounce" />
              <span className="text-xs text-slate-400">Building</span>
              <span className="text-sm font-semibold mt-0.5 text-yellow-400">{stats.activeConstruction}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Simulation Time & Controls */}
        <div className="flex flex-col gap-3 pointer-events-auto max-w-sm w-full md:w-auto">
          {/* Time & Environment Controller */}
          <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
            {/* Clock & Sun icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {timeOfDay >= 6 && timeOfDay < 18 ? (
                  <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
                ) : (
                  <Moon className="w-5 h-5 text-indigo-400" />
                )}
                <span className="text-sm font-bold">{formatTime(timeOfDay)}</span>
              </div>
              
              {/* Play / Pause time */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleTogglePlay}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isPlaying 
                      ? 'bg-sky-500/20 border-sky-400/40 text-sky-300 hover:bg-sky-500/30' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title={isPlaying ? "Pause Cycle" : "Play Cycle"}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>

                <button 
                  onClick={handleToggleSound}
                  className={`p-1.5 rounded-lg border transition-all ${
                    soundEnabled 
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30' 
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400'
                  }`}
                  title={soundEnabled ? "Mute Sounds" : "Unmute Sounds"}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Time of Day Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>Time of Day</span>
                <span>{Math.floor(timeOfDay)}:00</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="23.9" 
                step="0.1"
                value={timeOfDay}
                onChange={handleTimeChange}
                className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            {/* Speed slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>Day Cycle Speed</span>
                <span>{isPlaying ? `${timeSpeed.toFixed(1)}x` : 'Paused'}</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="3.0" 
                step="0.1"
                value={timeSpeed}
                onChange={handleSpeedChange}
                disabled={!isPlaying}
                className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-sky-400 disabled:opacity-30"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Interface: Tool Drawer & Quick Instructions */}
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 flex flex-col items-center gap-4 pointer-events-none z-10">
        
        {/* Instructions Banner */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/40 rounded-xl px-4 py-2 flex items-center gap-4 text-xs text-slate-300 shadow-xl max-w-lg pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
            <span className="font-semibold text-slate-200">3D Navigation:</span>
          </div>
          <span>Drag Left-Click to rotate | Drag Right-Click to pan | Scroll to zoom</span>
        </div>

        {/* Construction Tool Selector Drawer */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-2xl p-3 flex items-center gap-2 pointer-events-auto max-w-full overflow-x-auto">
          
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 border-r border-slate-800 hidden sm:inline-block">
            Tools
          </span>

          {/* Inspect / View Mode */}
          <button
            onClick={() => handleModeChange(null)}
            className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              buildMode === null
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Inspect View</span>
          </button>

          {/* Road Segment */}
          <button
            onClick={() => handleModeChange('road')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              buildMode === 'road'
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="w-4 h-4 border-2 border-current rounded-sm text-[8px] flex items-center justify-center font-bold">R</div>
            <span className="hidden sm:inline">Build Road</span>
          </button>

          {/* Plant Tree */}
          <button
            onClick={() => handleModeChange('tree')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              buildMode === 'tree'
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <TreePine className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Plant Tree</span>
          </button>

          {/* Build House */}
          <button
            onClick={() => handleModeChange('house')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              buildMode === 'house'
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Build House</span>
          </button>

          {/* Build Skyscraper */}
          <button
            onClick={() => handleModeChange('skyscraper')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              buildMode === 'skyscraper'
                ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Skyscraper</span>
          </button>

          <div className="w-[1px] h-6 bg-slate-800 mx-1 hidden sm:block" />

          {/* Demolish Tool */}
          <button
            onClick={() => handleModeChange('delete')}
            className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              buildMode === 'delete'
                ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20'
                : 'bg-slate-800/50 border-slate-700/30 hover:bg-red-950/20 hover:border-red-900/50 hover:text-red-400 text-slate-300'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Demolish</span>
          </button>

        </div>
      </div>
    </div>
  );
}
