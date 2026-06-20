'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  TreePine, 
  Home, 
  Building2, 
  Trash2, 
  Eye, 
  EyeOff,
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
  Compass,
  LogOut,
  X
} from 'lucide-react';
import { ThreeCity } from './simulation/ThreeCity';
import { BuildType, CityStats } from './simulation/Types';

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
  const [timeSpeed, setTimeSpeed] = useState<number>(1.0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [showDeveloperPopup, setShowDeveloperPopup] = useState<boolean>(false);
  const [showProfilePopup, setShowProfilePopup] = useState<boolean>(false);

  // Authentication & Session states
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasSpawned, setHasSpawned] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [isStuck, setIsStuck] = useState<boolean>(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setResetSuccessMsg('');
    setAuthLoading(true);

    if (authMode === 'reset') {
      try {
        const res = await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
          setAuthError(data.error || 'Password reset failed');
          setAuthLoading(false);
          return;
        }

        setResetSuccessMsg('Password reset successfully! Please sign in with your new password.');
        setPassword('');
        setAuthMode('login');
        setAuthLoading(false);
      } catch (err) {
        console.error(err);
        setAuthError('Connection failed. Please verify database availability.');
        setAuthLoading(false);
      }
      return;
    }

    const url = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = authMode === 'register' 
      ? { name: playerName, email, password }
      : { email, password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        setAuthLoading(false);
        return;
      }

      const user = data.user;
      localStorage.setItem('shunyascape_user', JSON.stringify(user));
      setCurrentUser(user);
      setHasSpawned(true);
      setShowAuthModal(false);
      setAuthLoading(false);

      if (cityRef.current) {
        cityRef.current.isAdmin = user.role === 'admin';
        cityRef.current.spawnPlayer(user.name, user.x, user.z, user.email, user.clothingColor);
        setSoundEnabled(true);
        cityRef.current.audio.toggle(true);
      }
    } catch (err) {
      console.error(err);
      setAuthError('Connection failed. Please verify database availability.');
      setAuthLoading(false);
    }
  };

  const saveAdminSettings = async (updates: { timeOfDay?: number; timeSpeed?: number; isPlaying?: boolean }) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('auth-unauthorized'));
      }
    } catch (err) {
      console.error('Failed to save admin settings:', err);
    }
  };

  // When spawned, show the controls HUD and start the 10-second fade timer
  useEffect(() => {
    if (hasSpawned) {
      setShowControls(true);
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [hasSpawned]);

  // Establish WebSocket connection & do initial syncs
  useEffect(() => {
    // 1. Initial HTTP fetches for bootstrap
    const initialSync = async () => {
      try {
        const gridRes = await fetch('/api/grid');
        if (gridRes.ok && cityRef.current) {
          const gridData = await gridRes.json();
          if (gridData.cells) {
            cityRef.current.syncGrid(gridData.cells);
          }
        }
      } catch (err) {
        console.error('Failed to run initial grid sync:', err);
      }
    };
    initialSync();

    // 2. Open WebSocket connection
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      const isProd = process.env.NODE_ENV === 'production';
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = isProd 
        ? `${wsProto}//${window.location.host}/ws` 
        : `ws://localhost:8005/ws`;

      console.log('Connecting to WebSocket:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connection established.');
        if (cityRef.current) {
          cityRef.current.ws = socket;
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!cityRef.current) return;

          switch (data.type) {
            case 'init':
              // Load users
              const playerEmail = currentUser?.email || '';
              cityRef.current.loadAllDatabaseUsers(data.users, playerEmail);
              
              // Load NPCs
              const isAdmin = currentUser?.role === 'admin';
              cityRef.current.syncNpcs(data.npcs, isAdmin);

              // Load settings
              if (data.settings) {
                const { timeOfDay: dbTime, timeSpeed: dbSpeed, isPlaying: dbPlaying } = data.settings;
                const isDifferent = Math.abs(cityRef.current.timeOfDay - dbTime) > 0.5 || isPlaying !== dbPlaying;
                if (!isAdmin || isDifferent) {
                  cityRef.current.timeOfDay = dbTime;
                  cityRef.current.timeSpeed = dbPlaying ? dbSpeed : 0.0;
                  setTimeOfDay(dbTime);
                  setTimeSpeed(dbSpeed);
                  setIsPlaying(dbPlaying);
                }
              }
              break;

            case 'player-moved':
              cityRef.current.updateOtherPlayerPosition(data.userId, data.x, data.z);
              break;

            case 'npcs-updated':
              const isUserAdmin = currentUser?.role === 'admin';
              cityRef.current.syncNpcs(data.npcs, isUserAdmin);
              break;

            case 'settings-updated':
              const userIsAdmin = currentUser?.role === 'admin';
              const { timeOfDay: dbTime, timeSpeed: dbSpeed, isPlaying: dbPlaying } = data.settings;
              const diff = Math.abs(cityRef.current.timeOfDay - dbTime) > 0.5 || isPlaying !== dbPlaying;
              if (!userIsAdmin || diff) {
                cityRef.current.timeOfDay = dbTime;
                cityRef.current.timeSpeed = dbPlaying ? dbSpeed : 0.0;
                setTimeOfDay(dbTime);
                setTimeSpeed(dbSpeed);
                setIsPlaying(dbPlaying);
              }
              break;

            case 'grid-updated':
              cityRef.current.syncGrid([data.cell]);
              break;

            case 'player-disconnected':
              cityRef.current.removePlayerAvatar(data.userId);
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      socket.onclose = (e) => {
        console.log('WebSocket closed. Attempting reconnect in 3s...', e.reason);
        if (cityRef.current) {
          cityRef.current.ws = null;
        }
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket?.close();
      };
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [currentUser]);

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
    citySim.timeSpeed = 1.0;
    citySim.audio.toggle(false);

    // Verify session dynamically with /api/auth/me on page load
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            localStorage.setItem('shunyascape_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            setHasSpawned(true);
            citySim.isAdmin = data.user.role === 'admin';
            citySim.spawnPlayer(data.user.name, data.user.x, data.user.z, data.user.email, data.user.clothingColor);
            setSoundEnabled(true);
            citySim.audio.toggle(true);
            return;
          }
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      }
      localStorage.removeItem('shunyascape_user');
    };
    checkSession();

    // Sync time of day from the animation loop to the state slider and check if player is stuck
    const timeSyncInterval = setInterval(() => {
      if (cityRef.current) {
        setTimeOfDay(cityRef.current.timeOfDay);
        setIsStuck(cityRef.current.isPlayerInsideBlockedCell());
      }
    }, 100);

    // Global unauthorized event handler (used to force log out when single system login fails)
    const handleUnauthorized = () => {
      setAuthError('You have been logged out because another system logged in or session expired.');
      localStorage.removeItem('shunyascape_user');
      setCurrentUser(null);
      setHasSpawned(false);
      setShowAuthModal(true);
      setShowProfilePopup(false);
      if (cityRef.current) {
        cityRef.current.destroy();
        // Reinitialize clean city simulator
        if (containerRef.current) {
          const newCity = new ThreeCity(containerRef.current, (newStats) => {
            setStats({ ...newStats });
          });
          cityRef.current = newCity;
          newCity.buildMode = 'road';
          newCity.timeSpeed = 1.0;
          newCity.audio.toggle(false);
        }
      }
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);

    return () => {
      clearInterval(timeSyncInterval);
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
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
      cityRef.current.updateCameraControls();
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
    saveAdminSettings({ isPlaying: nextPlay });
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseFloat(e.target.value);
    setTimeSpeed(speed);
    if (cityRef.current && isPlaying) {
      cityRef.current.timeSpeed = speed;
    }
    saveAdminSettings({ timeSpeed: speed });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTimeOfDay(val);
    if (cityRef.current) {
      cityRef.current.timeOfDay = val;
    }
    saveAdminSettings({ timeOfDay: val });
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
      <div className="absolute inset-x-0 top-0 p-4 md:p-6 flex flex-row items-start justify-between gap-4 pointer-events-none z-10">
        
        {/* Left Side: Logo Button and Stats Grid */}
        <div className="flex flex-col gap-4 pointer-events-auto max-w-sm md:max-w-md w-full items-start">
          {/* Minimised Logo Icon Button */}
          <button
            onClick={() => setShowDeveloperPopup(true)}
            className="w-12 h-12 rounded-2xl bg-slate-900/75 backdrop-blur-xl flex items-center justify-center shadow-lg hover:shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all duration-300 pointer-events-auto border border-slate-700/50"
            title="Developer Details"
          >
            <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
          </button>

        </div>

        {/* Right Side: Profile icon and/or simulation controller */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto max-w-sm w-full md:w-auto">
          {/* User Icon Avatar (if logged in) */}
          {hasSpawned && currentUser ? (
            <button
              onClick={() => setShowProfilePopup(true)}
              className="w-12 h-12 rounded-full border border-slate-700/50 shadow-2xl flex items-center justify-center font-bold text-sm text-white uppercase transition-all duration-300 hover:scale-105 active:scale-95 hover:border-sky-500/50 pointer-events-auto"
              style={{
                backgroundColor: currentUser.clothingColor 
                  ? `#${currentUser.clothingColor.toString(16).padStart(6, '0')}` 
                  : '#ef4444'
              }}
              title="View Profile Details"
            >
              {currentUser.name.charAt(0)}
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-95 transition-all duration-300 pointer-events-auto border border-cyan-400/30 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}

          {/* Time & Environment Controller */}
          {currentUser?.role === 'admin' ? (
            <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 w-64 text-left">
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
          ) : (
            <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-3 flex items-center justify-between gap-4 w-44">
              <div className="flex items-center gap-2">
                {timeOfDay >= 6 && timeOfDay < 18 ? (
                  <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
                <span className="text-xs font-bold">{formatTime(timeOfDay)}</span>
              </div>
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
          )}
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
        {currentUser?.role === 'admin' && hasSpawned && (
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
        )}
      </div>

      {/* Onboarding Login / Register Modal */}
      {!hasSpawned && showAuthModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleAuthSubmit}
            className="relative w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center pointer-events-auto"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/40"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Users className="w-6 h-6 text-white animate-pulse" />
              </div>
              <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                ShunyaScape 3D Avatar
              </h2>
              <p className="text-[11px] text-slate-400 max-w-xs leading-normal">
                Sign in or register to persist your avatar in the persistent simulation.
              </p>
            </div>

            {/* Mode Switch Tabs */}
            {authMode !== 'reset' ? (
              <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); setResetSuccessMsg(''); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    authMode === 'login' 
                      ? 'bg-sky-500 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); setResetSuccessMsg(''); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    authMode === 'register' 
                      ? 'bg-sky-500 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register
                </button>
              </div>
            ) : (
              <div className="text-center bg-slate-950/40 py-2.5 px-3 rounded-2xl border border-slate-800/40">
                <h3 className="text-xs font-bold text-slate-200">Reset Your Password</h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Provide your email address and new password to reset it.
                </p>
              </div>
            )}

            {authError && (
              <div className="px-3 py-2 bg-red-950/40 border border-red-800/40 text-red-400 text-xs font-medium rounded-lg text-left">
                {authError}
              </div>
            )}

            {resetSuccessMsg && (
              <div className="px-3 py-2 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-medium rounded-lg text-left">
                {resetSuccessMsg}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {authMode === 'register' && (
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="authName" className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                    Your Name
                  </label>
                  <input
                    id="authName"
                    type="text"
                    required
                    placeholder="Enter name..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="authEmail" className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                  Email Address
                </label>
                <input
                  id="authEmail"
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="authPass" className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                  {authMode === 'reset' ? 'New Password' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="authPass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {authMode === 'login' && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('reset'); setAuthError(''); setResetSuccessMsg(''); }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {authMode === 'reset' && (
              <div className="text-center -mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); setResetSuccessMsg(''); }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-lg text-xs shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {authLoading 
                ? 'Connecting to Server...' 
                : authMode === 'register' 
                  ? 'Register & Spawn' 
                  : authMode === 'reset'
                    ? 'Reset Password'
                    : 'Log In & Spawn'
              }
            </button>

            {/* Quick overview of controls */}
            <div className="border-t border-slate-800/60 pt-3 flex flex-col gap-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Shortcut Controls
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-450 text-left px-2 max-w-sm mx-auto">
                <div>WASD: <span className="text-slate-350 font-medium">Move</span></div>
                <div>Space: <span className="text-slate-350 font-medium">Jump</span></div>
                <div>U key: <span className="text-slate-350 font-medium">Punch</span></div>
                <div>I key: <span className="text-slate-350 font-medium">Kick</span></div>
                <div className="col-span-2 text-center mt-0.5">J key: <span className="text-slate-350 font-medium">Sit / Stand Toggle</span></div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* City Live Statistics List in bottom left */}
      {hasSpawned && currentUser?.role === 'admin' && (
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-30 flex flex-col items-start gap-2 pointer-events-auto">
          <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-3.5 flex flex-col gap-2 w-44">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-0.5">
              City Statistics
            </h4>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Population</span>
                </div>
                <span className="font-semibold text-slate-100">{stats.population}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <TreePine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Forestry</span>
                </div>
                <span className="font-semibold text-slate-100">{stats.trees}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 text-slate-400 font-bold border border-slate-500 rounded-sm text-[7px] flex items-center justify-center">R</div>
                  <span>Roads</span>
                </div>
                <span className="font-semibold text-slate-100">{stats.roads}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>Houses</span>
                </div>
                <span className="font-semibold text-slate-100">{stats.houses}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Towers</span>
                </div>
                <span className="font-semibold text-slate-100">{stats.skyscrapers}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Hammer className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                  <span>Building</span>
                </div>
                <span className="font-semibold text-yellow-400">{stats.activeConstruction}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Controls Floating HUD & Info Button in bottom right */}
      {hasSpawned && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-30 flex flex-col items-end gap-2 pointer-events-auto">
          {/* Expanded Controls Card */}
          <div 
            className={`bg-slate-900/90 backdrop-blur-2xl border border-slate-750/80 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 transition-all duration-500 ease-out transform ${
              showControls 
                ? 'opacity-100 scale-100 translate-y-0 w-64' 
                : 'opacity-0 scale-90 translate-y-4 pointer-events-none w-0 h-0 p-0 border-none overflow-hidden'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent uppercase tracking-wider">
                Avatar Controls
              </h3>
              <button 
                type="button"
                onClick={() => setShowControls(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-750 px-1.5 py-0.5 rounded border border-slate-700 transition-all font-semibold"
              >
                Hide
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5 text-[11px] text-slate-350">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">WASD</kbd>
                <span>Move</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">Space</kbd>
                <span>Jump</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">U key</kbd>
                <span>Punch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">I key</kbd>
                <span>Kick</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 mt-0.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">J key</kbd>
                <span>Sit / Stand Toggle</span>
              </div>
            </div>
          </div>

          {/* Trigger Info "i" Button */}
          <button
            type="button"
            onClick={() => setShowControls(!showControls)}
            className={`w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-850 backdrop-blur-xl border border-slate-750/80 shadow-2xl flex items-center justify-center text-sky-400 hover:text-sky-300 transition-all duration-300 transform active:scale-95 ${
              !showControls ? 'opacity-100 scale-100' : 'opacity-80 scale-90'
            }`}
            title="Show Controls Info"
          >
            <span className="font-serif text-lg font-black italic">i</span>
          </button>
        </div>
      )}

      {/* Developer Details Modal */}
      {showDeveloperPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative">
            <button
              onClick={() => setShowDeveloperPopup(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ✕
            </button>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                ShunyaScape 3D
              </h2>
              <p className="text-xs text-slate-400 font-medium">Interactive Agentic Simulation</p>
            </div>

            <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3 text-left">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Developer</span>
                <span className="text-sm font-semibold text-slate-200">Vijay Kumar</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">GitHub ID</span>
                <a 
                  href="https://github.com/be1enewinner" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-cyan-400 hover:underline flex items-center gap-1.5"
                >
                  be1enewinner
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-200">View profile</span>
                </a>
              </div>
            </div>

            <button
              onClick={() => setShowDeveloperPopup(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs transition-all active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfilePopup && currentUser && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative">
            <button
              onClick={() => setShowProfilePopup(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ✕
            </button>
            <div className="flex flex-col items-center gap-3">
              <div 
                className="w-20 h-20 rounded-full border-4 border-slate-750 flex items-center justify-center font-black text-3xl text-white uppercase shadow-2xl"
                style={{
                  backgroundColor: currentUser.clothingColor 
                    ? `#${currentUser.clothingColor.toString(16).padStart(6, '0')}` 
                    : '#ef4444'
                }}
              >
                {currentUser.name.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-slate-100">{currentUser.name}</h2>
              <span className="text-[10px] bg-sky-500/20 text-sky-400 px-3 py-1 rounded-full border border-sky-400/25 font-bold uppercase tracking-wider">
                {currentUser.role} Account
              </span>
            </div>

            <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3 text-left">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Email Address</span>
                <span className="text-sm font-semibold text-slate-200">{currentUser.email}</span>
              </div>
              
              {currentUser.role === 'admin' && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Administrative Utilities</span>
                  <a 
                    href="/admin" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-lg shadow-lg active:scale-95 transition-all"
                  >
                    Open Admin Control Center
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Logout on server
                  fetch('/api/auth/logout', { method: 'POST' }).catch(err => console.error(err));
                  // Logout / Reset session
                  localStorage.removeItem('shunyascape_user');
                  setCurrentUser(null);
                  setHasSpawned(false);
                  setShowProfilePopup(false);
                  if (cityRef.current) {
                    cityRef.current.destroy();
                    // Reinitialize clean city simulator
                    if (containerRef.current) {
                      const newCity = new ThreeCity(containerRef.current, (newStats) => {
                        setStats({ ...newStats });
                      });
                      cityRef.current = newCity;
                      newCity.buildMode = 'road';
                      newCity.timeSpeed = 1.0;
                      newCity.audio.toggle(false);
                    }
                  }
                }}
                className="flex-1 py-2.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 font-bold rounded-lg text-xs transition-all active:scale-[0.98]"
              >
                Log Out
              </button>
              
              <button
                onClick={() => setShowProfilePopup(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs transition-all active:scale-[0.98]"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stuck Exit Button */}
      {isStuck && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-40 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (cityRef.current) {
                cityRef.current.teleportPlayerToSafeCell();
                setIsStuck(false);
              }
            }}
            className="flex flex-col items-center justify-center gap-2 w-20 h-20 bg-red-600/90 hover:bg-red-500/95 backdrop-blur-xl text-white font-bold rounded-2xl shadow-2xl border border-red-400/50 hover:scale-105 active:scale-95 transition-all duration-300 animate-bounce"
            title="Exit Building Box"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] uppercase tracking-wider text-center">Exit Box</span>
          </button>
        </div>
      )}

    </div>
  );
}
