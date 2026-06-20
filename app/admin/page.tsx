'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  ShieldAlert, 
  MapPin, 
  Trash2, 
  ArrowLeft, 
  Shield, 
  Locate, 
  Search,
  Lock,
  Mail,
  Key,
  Database
} from 'lucide-react';

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  x: number;
  z: number;
  lastX: number;
  lastZ: number;
  clothingColor: number;
  createdAt: string;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Global simulation states
  const [timeOfDay, setTimeOfDay] = useState<number>(8.0);
  const [timeSpeed, setTimeSpeed] = useState<number>(0.5);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [localTimeOfDay, setLocalTimeOfDay] = useState<number>(8.0);
  const [localTimeSpeed, setLocalTimeSpeed] = useState<number>(0.5);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Login form for admin page if accessed directly without session
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Teleport dialog state
  const [teleportingUser, setTeleportingUser] = useState<UserItem | null>(null);
  const [teleportX, setTeleportX] = useState<string>('0');
  const [teleportZ, setTeleportZ] = useState<string>('0');

  // Load user session on mount and poll database
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let pollInterval: NodeJS.Timeout;
    
    const checkSession = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user && data.user.role === 'admin') {
            localStorage.setItem('dreamcity_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            fetchUsers(data.user.email);
            
            // Polling loop
            pollInterval = setInterval(() => {
              fetchUsers(data.user.email);
            }, 4000);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      localStorage.removeItem('dreamcity_user');
      setCurrentUser(null);
      setLoading(false);
    };
    checkSession();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const fetchUsers = async (adminEmail: string) => {
    if (users.length === 0) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/users');
      if (res.status === 401) {
        localStorage.removeItem('dreamcity_user');
        setCurrentUser(null);
        setError('Session expired or logged out from another system.');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        if (data.settings) {
          if (!isDragging) {
            setTimeOfDay(data.settings.timeOfDay);
            setLocalTimeOfDay(data.settings.timeOfDay);
          }
          setTimeSpeed(data.settings.timeSpeed);
          setLocalTimeSpeed(data.settings.timeSpeed);
          setIsPlaying(data.settings.isPlaying);
        }
      } else {
        setError(data.error || 'Failed to fetch registered avatars');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to reach server database');
    } finally {
      setLoading(false);
    }
  };

  const updateGlobalSettings = async (updates: { timeOfDay?: number; timeSpeed?: number; isPlaying?: boolean }) => {
    if (!currentUser) return;
    setSettingsLoading(true);
    
    // Optimistic local state update
    if (updates.timeOfDay !== undefined) {
      setTimeOfDay(updates.timeOfDay);
      setLocalTimeOfDay(updates.timeOfDay);
    }
    if (updates.timeSpeed !== undefined) {
      setTimeSpeed(updates.timeSpeed);
      setLocalTimeSpeed(updates.timeSpeed);
    }
    if (updates.isPlaying !== undefined) setIsPlaying(updates.isPlaying);
 
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.status === 401) {
        localStorage.removeItem('dreamcity_user');
        setCurrentUser(null);
        setError('Session expired or logged out from another system.');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update global simulation settings');
        fetchUsers(currentUser.email);
      } else {
        setSuccessMsg(data.message || 'Simulation settings synced globally!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setError('Communication with settings API failed');
    } finally {
      setSettingsLoading(false);
    }
  };

  // Local time ticking for admin panel view
  useEffect(() => {
    if (!isPlaying || isDragging) return;

    const interval = setInterval(() => {
      setTimeOfDay((prevTime) => {
        const nextTime = (prevTime + 0.1 * timeSpeed) % 24;
        setLocalTimeOfDay(nextTime);
        return nextTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, timeSpeed, isDragging]);

  const formatTime = (time: number) => {
    const hours24 = Math.floor(time);
    const minutes = Math.floor((time - hours24) * 60);
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const padMin = minutes.toString().padStart(2, '0');
    const padHr = hours12.toString().padStart(2, '0');
    return `${padHr}:${padMin} ${ampm}`;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Login failed');
        setLoginLoading(false);
        return;
      }

      const user = data.user;
      if (user.role !== 'admin') {
        setLoginError('Forbidden: Only administrators can access this panel.');
        setLoginLoading(false);
        return;
      }

      localStorage.setItem('dreamcity_user', JSON.stringify(user));
      setCurrentUser(user);
      setLoginLoading(false);
      fetchUsers(user.email);
    } catch (err) {
      console.error(err);
      setLoginError('Server connection failed');
      setLoginLoading(false);
    }
  };

  // Perform admin actions (teleport, changeRole, delete)
  const runAdminAction = async (action: 'teleport' | 'changeRole' | 'delete', targetUserId: string, payload: any = {}) => {
    if (!currentUser) return;
    setError('');
    setSuccessMsg('');
 
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetUserId,
          ...payload
        })
      });
      if (res.status === 401) {
        localStorage.removeItem('dreamcity_user');
        setCurrentUser(null);
        setError('Session expired or logged out from another system.');
        return;
      }
      const data = await res.json();
 
      if (!res.ok) {
        setError(data.error || `Failed to perform ${action}`);
        return;
      }
 
      setSuccessMsg(data.message || 'Action executed successfully!');
      
      // Update local state lists
      if (action === 'delete') {
        setUsers(users.filter(u => u._id !== targetUserId));
      } else {
        setUsers(users.map(u => u._id === targetUserId ? { ...u, ...data.user } : u));
      }
      
      // Clear popup dialog
      setTeleportingUser(null);
    } catch (err) {
      console.error(err);
      setError('Communication with server failed');
    }
  };

  const handleTeleportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teleportingUser) return;
    runAdminAction('teleport', teleportingUser._id, {
      x: Number(teleportX),
      z: Number(teleportZ)
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If not logged in as Admin, show the login panel
  if (!currentUser) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-slate-950 to-indigo-950/20 z-0" />
        <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 shadow-2xl rounded-3xl p-6 md:p-8 flex flex-col gap-6 text-center z-10 relative">
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Lock className="w-6 h-6 text-white animate-pulse" />
            </div>
            <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-red-400 via-orange-350 to-amber-300 bg-clip-text text-transparent uppercase tracking-wider">
              DreamCity Admin Portal
            </h2>
            <p className="text-[11px] text-slate-450 max-w-xs leading-normal">
              Authentication required. Only registered admin users can access these controls.
            </p>
          </div>

          {loginError && (
            <div className="px-3 py-2 bg-red-950/40 border border-red-800/40 text-red-400 text-xs font-medium rounded-lg text-left">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-550" />
                <input
                  type="email"
                  required
                  placeholder="admin@domain.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/50 border border-slate-850 rounded-lg text-xs font-semibold text-slate-100 placeholder-slate-650 focus:outline-none focus:border-red-500/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-550" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950/50 border border-slate-850 rounded-lg text-xs font-semibold text-slate-100 placeholder-slate-650 focus:outline-none focus:border-red-500/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 text-white font-bold rounded-lg text-xs shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? 'Authenticating...' : 'Enter Admin Panel'}
            </button>
          </form>

          <a 
            href="/"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-450 hover:text-slate-200 transition-all mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Simulation</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 relative overflow-y-auto">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10">
        
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-xl transition-all shadow"
              title="Return to City Builder"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
            </a>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                DreamCity Dashboard
              </h1>
              <p className="text-xs text-slate-450">Administrative Control Panel & User Coordination</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-slate-200">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Super Administrator</div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('dreamcity_user');
                setCurrentUser(null);
                setUsers([]);
              }}
              className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 hover:border-red-500/30 hover:text-red-400 text-xs font-semibold rounded-lg shadow transition-all cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Info Alerts */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/40 text-red-400 text-sm font-semibold rounded-2xl">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-sm font-semibold rounded-2xl animate-pulse">
            {successMsg}
          </div>
        )}

        {/* Stats Summary Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Avatars</div>
              <div className="text-2xl font-black text-slate-100">{users.length}</div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Administrators</div>
              <div className="text-2xl font-black text-slate-100">{users.filter(u => u.role === 'admin').length}</div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-4 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Database State</div>
              <div className="text-xs font-semibold mt-1 text-emerald-400">Connected</div>
            </div>
          </div>
        </div>

        {/* Global Environment Controls Card */}
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-2xl rounded-3xl p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                Global Simulation Environment Controls
              </h3>
              <p className="text-[11px] text-slate-500">Modify time, day cycle progression, and simulation play/pause state for all connected players.</p>
            </div>
            
            <button
              type="button"
              onClick={() => updateGlobalSettings({ isPlaying: !isPlaying })}
              disabled={settingsLoading}
              className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              }`}
            >
              {isPlaying ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Simulation Playing
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Simulation Paused
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Time of Day Slider Card */}
            <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Time of Day</span>
                <span className="text-sm font-mono font-black text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded-lg border border-cyan-800/20">
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
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-550 font-bold">
                <span>00:00 (Midnight)</span>
                <span>12:00 (Noon)</span>
                <span>23:00 (Night)</span>
              </div>
            </div>

            {/* Day Cycle Speed Slider Card */}
            <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Day Cycle Speed</span>
                <span className="text-sm font-mono font-black text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded-lg border border-indigo-800/20">
                  {isPlaying ? `${localTimeSpeed.toFixed(1)}x` : 'Paused'}
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
                className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-400 disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-slate-550 font-bold">
                <span>0.1x (Slowest)</span>
                <span>1.0x (Normal)</span>
                <span>3.0x (Fastest)</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Table Card */}
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
          
          {/* Table Header Filter Row */}
          <div className="p-4 md:p-6 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm md:text-base font-bold text-slate-200">Registered City Residents</h3>
            
            {/* Search */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
              />
            </div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500 font-semibold">
              Loading resident database...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500 font-semibold">
              No registered avatars found.
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/45 text-slate-400 border-b border-slate-850/60">
                    <th className="p-4 font-bold">Resident Profile</th>
                    <th className="p-4 font-bold">User Role</th>
                    <th className="p-4 font-bold">Current Position (X, Z)</th>
                    <th className="p-4 font-bold">Last Position (X, Z)</th>
                    <th className="p-4 font-bold text-right">Moderator Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-850/20 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full border border-slate-700/60 flex items-center justify-center font-bold text-slate-100 uppercase"
                          style={{ backgroundColor: user.clothingColor ? `#${user.clothingColor.toString(16).padStart(6, '0')}` : '#4287f5' }}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200">{user.name}</div>
                          <div className="text-[10px] text-slate-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          user.role === 'admin' 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-slate-800 text-slate-450 border border-slate-700/40'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[10px] text-slate-400">
                        ({user.x.toFixed(2)}, {user.z.toFixed(2)})
                      </td>
                      <td className="p-4 font-mono text-[10px] text-slate-500">
                        ({user.lastX.toFixed(2)}, {user.lastZ.toFixed(2)})
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* Teleport Trigger */}
                          <button
                            onClick={() => {
                              setTeleportingUser(user);
                              setTeleportX(user.x.toFixed(2));
                              setTeleportZ(user.z.toFixed(2));
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-sky-400 border border-slate-700/60 rounded-lg shadow-sm transition-all cursor-pointer"
                            title="Teleport Avatar"
                          >
                            <Locate className="w-3.5 h-3.5" />
                          </button>

                          {/* Role Toggle Trigger */}
                          <button
                            onClick={() => {
                              const nextRole = user.role === 'admin' ? 'user' : 'admin';
                              if (confirm(`Are you sure you want to change ${user.name}'s role to ${nextRole}?`)) {
                                runAdminAction('changeRole', user._id, { role: nextRole });
                              }
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-amber-400 border border-slate-700/60 rounded-lg shadow-sm transition-all cursor-pointer"
                            title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Trigger */}
                          <button
                            onClick={() => {
                              if (confirm(`CRITICAL: Are you sure you want to delete ${user.name} and banish them from the simulation?`)) {
                                runAdminAction('delete', user._id);
                              }
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-350 hover:text-red-400 border border-slate-700/60 rounded-lg shadow-sm transition-all cursor-pointer"
                            title="Delete Resident"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Teleport Coordinate Picker Modal */}
      {teleportingUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleTeleportSubmit}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative pointer-events-auto"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Teleport Resident</h3>
              <p className="text-xs text-slate-500">
                Instantly relocate <span className="text-slate-350 font-bold">{teleportingUser.name}</span> in the 3D simulation.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-1.5">
              <span className="text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Preset Coordinate Sectors
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setTeleportX('0'); setTeleportZ('0'); }}
                  className="py-1 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-300"
                >
                  Map Center (0,0)
                </button>
                <button
                  type="button"
                  onClick={() => { setTeleportX('1.5'); setTeleportZ('1.5'); }}
                  className="py-1 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-300"
                >
                  Junction (1.5,1.5)
                </button>
                <button
                  type="button"
                  onClick={() => { setTeleportX('-25.0'); setTeleportZ('2.0'); }}
                  className="py-1 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-300"
                >
                  Water Bay (-25,2)
                </button>
              </div>
            </div>

            {/* Custom Coordinates Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                  World X
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="-30"
                  max="30"
                  required
                  value={teleportX}
                  onChange={(e) => setTeleportX(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-850 rounded-lg text-xs font-semibold text-center text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                  World Z
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="-30"
                  max="30"
                  required
                  value={teleportZ}
                  onChange={(e) => setTeleportZ(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-850 rounded-lg text-xs font-semibold text-center text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setTeleportingUser(null)}
                className="py-2.5 bg-slate-950 hover:bg-slate-850 text-slate-400 font-semibold rounded-lg text-xs border border-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-lg text-xs shadow-lg shadow-sky-500/10 transition-all cursor-pointer"
              >
                Teleport Resident
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
