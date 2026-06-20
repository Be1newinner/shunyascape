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
  Users, 
  Hammer, 
  Sparkles,
  Play,
  Pause,
  Compass,
  LogOut,
  X,
  Trophy,
  Award,
  Map,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { ThreeCity } from './simulation/ThreeCity';
import { BuildType, CityStats } from './simulation/Types';
import { LandExpansionManager, LandPlot, PLOT_COST_RING1 } from './simulation/LandExpansion';

export default function CitySimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<ThreeCity | null>(null);

  // States
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

  // Progression & Economy States
  const [shunyaCoins, setShunyaCoins] = useState<number>(100);
  const [wood, setWood] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [unlockedPermits, setUnlockedPermits] = useState<string[]>([]);
  const [completedAchievements, setCompletedAchievements] = useState<string[]>([]);

  // Quest Tracker States
  const [fidoQuestState, setFidoQuestState] = useState<'not_started' | 'active' | 'fido_found' | 'completed'>('not_started');
  const [treesPlantedCount, setTreesPlantedCount] = useState<number>(0);
  const [skyscraperClimbed, setSkyscraperClimbed] = useState<boolean>(false);

  // Telemetry statistics
  const [distanceWalked, setDistanceWalked] = useState<number>(0);
  const [jumpsCount, setJumpsCount] = useState<number>(0);
  const [worksCount, setWorksCount] = useState<number>(0);
  const [buildsCount, setBuildsCount] = useState<number>(0);

  // Multiplayer Telemetry
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);

  // UI Dialog overlays & popups
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'info' | 'success' | 'warning' }[]>([]);
  const [activeNpcDialog, setActiveNpcDialog] = useState<{ npcName: string; text: string; options: { text: string; action: () => void }[] } | null>(null);
  const [standingCell, setStandingCell] = useState<{ type: string; x: number; z: number } | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(-1); // -1 means idle
  const [showPermitStore, setShowPermitStore] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showAchievements, setShowAchievements] = useState<boolean>(false);
  const [showLandShop, setShowLandShop] = useState<boolean>(false);
  const [availablePlots, setAvailablePlots] = useState<LandPlot[]>([]);
  const [cityGridSize, setCityGridSize] = useState<number>(32);

  // Toast notifier helper
  const showToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

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
      setShunyaCoins(user.shunyaCoins || 100);
      setWood(user.wood || 0);
      setLevel(user.level || 1);
      setXp(user.xp || 0);
      setUnlockedPermits(user.unlockedPermits || []);
      setCompletedAchievements(user.completedAchievements || []);
      setHasSpawned(true);
      setShowAuthModal(false);
      setAuthLoading(false);
      showToast(`Welcome back, ${user.name}!`, 'success');

      if (cityRef.current) {
        cityRef.current.isAdmin = user.role === 'admin';
        cityRef.current.spawnPlayer(user.name, user.x, user.z, user.email, user.clothingColor, user.id, user.level || 1);
        setSoundEnabled(true);
        cityRef.current.audio.toggle(true);
      }
    } catch (err) {
      console.error(err);
      setAuthError('Connection failed. Please verify database availability.');
      setAuthLoading(false);
    }
  };

  // Helper to add player coins/XP/wood and sync them
  const addProgress = (coinsGained: number, xpGained: number, woodGained: number = 0, achievementsOverride?: string[], permitsOverride?: string[]) => {
    setShunyaCoins(prevCoins => {
      const nextCoins = prevCoins + coinsGained;
      
      setXp(prevXp => {
        let nextXp = prevXp + xpGained;
        
        setLevel(prevLevel => {
          let nextLevel = prevLevel;
          let xpNeeded = nextLevel * 100;
          
          while (nextXp >= xpNeeded) {
            nextLevel += 1;
            nextXp -= xpNeeded;
            showToast(`Level Up! Reached Level ${nextLevel}!`, 'success');
            if (cityRef.current) {
              cityRef.current.audio.playSpawn(); // level up sound
              cityRef.current.updatePlayerLevel(nextLevel);
            }
            xpNeeded = nextLevel * 100;
          }
          
          setWood(prevWood => {
            const nextWood = prevWood + woodGained;
            
            // Sync with backend websocket
            const permits = permitsOverride !== undefined ? permitsOverride : unlockedPermits;
            const achs = achievementsOverride !== undefined ? achievementsOverride : completedAchievements;
            
            if (cityRef.current?.ws && cityRef.current.ws.readyState === WebSocket.OPEN) {
              cityRef.current.ws.send(JSON.stringify({
                type: 'progress-update',
                shunyaCoins: nextCoins,
                level: nextLevel,
                xp: nextXp,
                wood: nextWood,
                unlockedPermits: permits,
                completedAchievements: achs
              }));
            }
            
            return nextWood;
          });
          
          return nextLevel;
        });
        
        return nextXp;
      });
      
      return nextCoins;
    });
  };

  const buyPermit = (permitKey: string, cost: number) => {
    if (shunyaCoins < cost) {
      showToast("Not enough ShunyaCoins!", "warning");
      return;
    }
    const nextPermits = [...unlockedPermits, permitKey];
    setUnlockedPermits(nextPermits);
    addProgress(-cost, 10, 0, undefined, nextPermits);
    showToast(`Purchased ${permitKey.charAt(0).toUpperCase() + permitKey.slice(1)} Permit!`, 'success');
  };

  const openLandShop = () => {
    if (cityRef.current) {
      const plots = cityRef.current.landExpansionManager.getAvailablePlots();
      setAvailablePlots(plots);
    }
    setShowLandShop(true);
  };

  const buyLandPlot = (plot: LandPlot) => {
    if (shunyaCoins < plot.cost) {
      showToast("Not enough ShunyaCoins to buy this land plot!", "warning");
      return;
    }
    if (!cityRef.current) return;

    const success = cityRef.current.expandGrid(plot.id);
    if (success) {
      addProgress(-plot.cost, 25); // Deduct coins, give 25 XP for expansion
      setCityGridSize(cityRef.current.gridSize);
      // Refresh available plots after purchase
      const newPlots = cityRef.current.landExpansionManager.getAvailablePlots();
      setAvailablePlots(newPlots);
      showToast(`🗺️ Land expanded ${LandExpansionManager.directionLabel(plot.direction)}! New area revealed.`, 'success');
    } else {
      showToast("Could not expand land in that direction.", "warning");
    }
  };


  const triggerUnlock = (achKey: string, title: string, xpReward: number) => {
    if (completedAchievements.includes(achKey)) return;
    const nextAchs = [...completedAchievements, achKey];
    setCompletedAchievements(nextAchs);
    showToast(`Achievement Unlocked: ${title}! (+${xpReward} XP)`, 'success');
    addProgress(0, xpReward, 0, nextAchs);
    if (cityRef.current) {
      cityRef.current.audio.playPop();
    }
  };

  const startJob = (duration: number, title: string, onComplete: () => void) => {
    if (cityRef.current) {
      cityRef.current.startWorking();
    }
    setJobProgress(0);
    showToast(title, 'info');
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setJobProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        setJobProgress(-1);
        if (cityRef.current) {
          cityRef.current.stopWorking();
        }
        onComplete();
      }
    }, 100);
  };

  const openNpcDialogue = (npc: any) => {
    const npcName = npc.playerName || `Citizen ${npc.id.split('_')[1] || npc.id}`;
    
    if (fidoQuestState === 'not_started') {
      setActiveNpcDialog({
        npcName,
        text: `Hello there! My voxel dog Fido ran away into the corners of the city. If you find him and walk near him, he'll follow you back. I'll reward you with 150 ShunyaCoins!`,
        options: [
          {
            text: "Sure, I'll search for Fido!",
            action: () => {
              setFidoQuestState('active');
              showToast("Quest Started: Find Fido", 'info');
              setActiveNpcDialog(null);
            }
          },
          {
            text: "Maybe another time.",
            action: () => setActiveNpcDialog(null)
          }
        ]
      });
    } else if (fidoQuestState === 'active') {
      setActiveNpcDialog({
        npcName,
        text: `Have you found Fido yet? He's a brown dog. Look around the city outskirts!`,
        options: [
          {
            text: "Still looking...",
            action: () => setActiveNpcDialog(null)
          }
        ]
      });
    } else if (fidoQuestState === 'fido_found') {
      setActiveNpcDialog({
        npcName,
        text: `Oh! Fido! You found him! Thank you so much! Here is your reward as promised.`,
        options: [
          {
            text: "You're welcome!",
            action: () => {
              setFidoQuestState('completed');
              triggerUnlock('npc_helper', 'NPC Helper', 50);
              addProgress(150, 0); // Quest reward coins
              setActiveNpcDialog(null);
            }
          }
        ]
      });
    } else {
      const lines = [
        "What a beautiful persistent city we are building!",
        "Check out the Permit Store if you want to unlock building tools.",
        "Ensure you don't get trapped inside buildings! Use the stuck button to teleport out.",
        "Collect glowing energy crystals to gain huge experience boosts!",
        "Kicking or punching trees drops wood resource crates."
      ];
      const randomLine = lines[Math.floor(Math.random() * lines.length)];
      setActiveNpcDialog({
        npcName,
        text: randomLine,
        options: [
          {
            text: "Nice chatting with you!",
            action: () => setActiveNpcDialog(null)
          }
        ]
      });
    }
  };

  // Achievement logic triggers
  useEffect(() => {
    if (!hasSpawned) return;
    if (distanceWalked >= 150) triggerUnlock('first_steps', 'First Steps', 50);
    if (shunyaCoins >= 500) triggerUnlock('wealthy_citizen', 'Wealthy Citizen', 50);
    if (jumpsCount >= 30) triggerUnlock('high_flyer', 'High Flyer', 50);
    if (wood >= 25 || treesPlantedCount >= 5) triggerUnlock('green_guard', 'Green Guard', 50);
    if (buildsCount >= 10) triggerUnlock('dev_extraordinaire', 'Dev Extraordinaire', 100);
  }, [distanceWalked, shunyaCoins, jumpsCount, wood, buildsCount, treesPlantedCount, hasSpawned]);

  // Listeners for simulation custom events
  useEffect(() => {
    if (!hasSpawned) return;

    const handleCollect = (e: Event) => {
      const { coins, xp: x, wood: w } = (e as CustomEvent).detail;
      addProgress(coins, x, w);
    };

    const handleHarvest = (e: Event) => {
      const { coins, xp: x, wood: w } = (e as CustomEvent).detail;
      addProgress(coins, x, w);
    };

    const handleBuildCompleted = () => {
      setBuildsCount(prev => prev + 1);
    };

    const handleTreePlanted = () => {
      setTreesPlantedCount(prev => {
        if (prev >= 3) return prev;
        const nextCount = prev + 1;
        if (nextCount === 3) {
          addProgress(100, 30);
          showToast("Quest Completed: Plant 3 Trees! (+100 SC, +30 XP)", 'success');
        }
        return nextCount;
      });
    };

    const handleWalked = (e: Event) => {
      const { distance } = (e as CustomEvent).detail;
      setDistanceWalked(prev => prev + distance);
    };

    const handleJumped = () => {
      setJumpsCount(prev => prev + 1);
    };

    const handleCellChange = (e: Event) => {
      const { type, x, z } = (e as CustomEvent).detail;
      setStandingCell({ type, x, z });
      if (type === 'skyscraper') {
        triggerUnlock('skyscraper_climber', 'Skyscraper Climber', 100);
        if (!skyscraperClimbed) {
          setSkyscraperClimbed(true);
          addProgress(200, 100);
          showToast("Quest Completed: Skyscraper Climber! (+200 SC, +100 XP)", 'success');
        }
      } else if (type === 'house') {
        triggerUnlock('skyscraper_climber', 'Skyscraper Climber', 100);
      }
    };

    const handleFidoNear = () => {
      if (fidoQuestState === 'active') {
        setFidoQuestState('fido_found');
        showToast("You found Fido! Bring him back to his owner.", 'success');
        if (cityRef.current) {
          cityRef.current.audio.playPop();
        }
      }
    };

    window.addEventListener('shunya-collect', handleCollect);
    window.addEventListener('shunya-harvest', handleHarvest);
    window.addEventListener('shunya-build-completed', handleBuildCompleted);
    window.addEventListener('shunya-tree-planted', handleTreePlanted);
    window.addEventListener('shunya-walked', handleWalked);
    window.addEventListener('shunya-jumped', handleJumped);
    window.addEventListener('shunya-cell-change', handleCellChange);
    window.addEventListener('shunya-fido-near', handleFidoNear);

    return () => {
      window.removeEventListener('shunya-collect', handleCollect);
      window.removeEventListener('shunya-harvest', handleHarvest);
      window.removeEventListener('shunya-build-completed', handleBuildCompleted);
      window.removeEventListener('shunya-tree-planted', handleTreePlanted);
      window.removeEventListener('shunya-walked', handleWalked);
      window.removeEventListener('shunya-jumped', handleJumped);
      window.removeEventListener('shunya-cell-change', handleCellChange);
      window.removeEventListener('shunya-fido-near', handleFidoNear);
    };
  }, [hasSpawned, shunyaCoins, level, xp, wood, unlockedPermits, completedAchievements, fidoQuestState, skyscraperClimbed]);

  // Keypress listener for E (interaction key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'e') {
        // 1. Standing cell interaction
        if (standingCell && jobProgress === -1) {
          const type = standingCell.type;
          
          if (type === 'skyscraper') {
            startJob(5000, "Working in Tech Office...", () => {
              addProgress(50, 20);
              showToast("Worked at Tech Office! Earned +50 SC, +20 XP", 'success');
            });
          } else if (type === 'house') {
            startJob(4000, "Helping Renovate House...", () => {
              addProgress(30, 15);
              showToast("Finished Repairs! Earned +30 SC, +15 XP", 'success');
            });
          } else if (type === 'construction') {
            startJob(3000, "Accelerating Construction...", () => {
              addProgress(20, 10);
              if (cityRef.current) {
                const cell = cityRef.current.grid[standingCell.x][standingCell.z];
                if (cell && cell.type === 'construction') {
                  cell.constructionProgress = Math.min(100, cell.constructionProgress + 40);
                  if (cell.constructionProgress >= 100) {
                    cityRef.current.completeConstruction(standingCell.x, standingCell.z);
                  } else {
                    if (cityRef.current.ws && cityRef.current.ws.readyState === WebSocket.OPEN) {
                      cityRef.current.ws.send(JSON.stringify({
                        type: 'grid-update',
                        cell: {
                          x: standingCell.x,
                          z: standingCell.z,
                          type: 'construction',
                          targetType: cell.targetType,
                          constructionProgress: cell.constructionProgress,
                          height: cell.height
                        }
                      }));
                    }
                  }
                }
              }
              showToast("Accelerated Construction! Earned +20 SC, +10 XP", 'success');
            });
          }
        }
        
        // 2. NPC dialogue trigger
        if (activeNpcDialog === null) {
          if (cityRef.current) {
            const playerPos = cityRef.current.player?.mesh.position;
            if (playerPos) {
              const npcs = cityRef.current.humans.filter(h => !h.isPlayer);
              let closestNpc: any = null;
              let minDist = Infinity;
              npcs.forEach(n => {
                const dx = playerPos.x - n.mesh.position.x;
                const dz = playerPos.z - n.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 2.0 && dist < minDist) {
                  minDist = dist;
                  closestNpc = n;
                }
              });
              
              if (closestNpc) {
                openNpcDialogue(closestNpc);
              }
            }
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [standingCell, jobProgress, activeNpcDialog, shunyaCoins, level, xp, wood, unlockedPermits, completedAchievements, fidoQuestState]);

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
              setOtherPlayers(data.users.filter((u: any) => u.email !== playerEmail));
              
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

            case 'player-connected':
              const currentEmail = currentUser?.email || '';
              cityRef.current.addDatabaseUser(data.user, currentEmail);
              if (data.user.email !== currentEmail) {
                setOtherPlayers(prev => [...prev.filter(p => p._id !== data.user._id), data.user]);
                showToast(`${data.user.name} joined the simulation!`, 'success');
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
              setOtherPlayers(prev => prev.filter(p => p._id !== data.userId));
              break;

            case 'player-progressed':
              setOtherPlayers(prev => prev.map(p => p._id === data.userId ? {
                ...p,
                shunyaCoins: data.shunyaCoins,
                level: data.level,
                xp: data.xp,
                wood: data.wood,
                unlockedPermits: data.unlockedPermits,
                completedAchievements: data.completedAchievements
              } : p));
              cityRef.current.updateOtherPlayerLevel(data.userId, data.level);
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
            setShunyaCoins(data.user.shunyaCoins || 100);
            setWood(data.user.wood || 0);
            setLevel(data.user.level || 1);
            setXp(data.user.xp || 0);
            setUnlockedPermits(data.user.unlockedPermits || []);
            setCompletedAchievements(data.user.completedAchievements || []);
            setHasSpawned(true);
            citySim.isAdmin = data.user.role === 'admin';
            citySim.spawnPlayer(data.user.name, data.user.x, data.user.z, data.user.email, data.user.clothingColor, data.user.id, data.user.level || 1);
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

  // Sync unlockedPermits with the simulation engine
  useEffect(() => {
    if (cityRef.current) {
      cityRef.current.unlockedPermits = unlockedPermits;
      cityRef.current.updateCameraControls();
    }
  }, [unlockedPermits]);

  // Update build mode
  const handleModeChange = (mode: BuildType) => {
    setBuildMode(mode);
    if (cityRef.current) {
      cityRef.current.buildMode = mode;
      cityRef.current.updateCameraControls();
    }
  };

  // Check building permits and role before changing modes
  const handleModeClick = (mode: BuildType) => {
    if (mode === 'delete' && currentUser?.role !== 'admin') {
      showToast("Only administrators can demolish structures!", 'warning');
      return;
    }
    if (mode !== null && mode !== 'delete' && currentUser?.role !== 'admin' && !unlockedPermits.includes(mode)) {
      showToast(`You need a ${mode.toUpperCase()} permit to construct this! Opening Permit Shop.`, 'warning');
      setShowPermitStore(true);
      return;
    }
    handleModeChange(mode);
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
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" style={{ touchAction: 'none' }} />

      {/* Ambient sky overlay color mask for premium cinematic overlay */}
      <div className={`absolute inset-0 pointer-events-none transition-colors duration-1000 bg-gradient-to-t ${getSkyPhaseColor()} z-5`} />

      {/* Sleek Floating Dashboard Overlay */}
      <div className="absolute inset-x-0 top-0 p-4 md:p-6 flex flex-row items-start justify-between gap-4 pointer-events-none z-10">
        
        {/* Left Side: Level, Coins, Permit Shop & Leaderboard */}
        <div className="flex flex-col gap-3 pointer-events-auto max-w-sm md:max-w-md w-full items-start">
          {/* Developer Details & Shops Buttons */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowDeveloperPopup(true)}
              className="w-10 h-10 rounded-xl bg-slate-900/80 backdrop-blur-xl flex items-center justify-center shadow-lg border border-slate-700/40 hover:scale-105 active:scale-95 transition-all duration-300 pointer-events-auto"
              title="Developer Details"
            >
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            </button>
            
            {hasSpawned && (
              <>
                <button
                  onClick={() => setShowPermitStore(true)}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 hover:border-amber-500/50 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-amber-400 flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Hammer className="w-3.5 h-3.5" />
                  <span>Permit Shop</span>
                </button>

                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 hover:border-cyan-500/50 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-cyan-400 flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Leaderboard</span>
                </button>

                <button
                  onClick={() => setShowAchievements(prev => !prev)}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 hover:border-emerald-500/50 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-emerald-400 flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Achievements</span>
                </button>

                <button
                  onClick={openLandShop}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 hover:border-green-500/50 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-green-400 flex items-center gap-1.5 shadow-lg cursor-pointer relative"
                  title="Buy more land to expand your city!"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Expand Land</span>
                  <span className="absolute -top-1 -right-1 text-[8px] bg-green-600 text-white px-1 py-0.5 rounded-full font-bold">
                    {cityGridSize}²
                  </span>
                </button>
              </>
            )}
          </div>


          {/* Level and XP progress bar (Glassmorphic) */}
          {hasSpawned && (
            <div className="w-64 bg-slate-900/80 backdrop-blur-xl border border-slate-700/45 p-3 rounded-2xl flex flex-col gap-1.5 shadow-xl">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-sky-400">Level {level}</span>
                <span className="text-slate-400 text-[10px]">{xp} / {level * 100} XP</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-300"
                  style={{ width: `${(xp / (level * 100)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Currency / Resources Bar */}
          {hasSpawned && (
            <div className="flex gap-2">
              {/* ShunyaCoins */}
              <div className="px-3 py-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 rounded-xl flex items-center gap-2 shadow-lg">
                <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center font-black text-[9px] text-slate-950 animate-bounce">S</div>
                <span className="text-xs font-bold text-amber-400">{shunyaCoins} SC</span>
              </div>
              
              {/* Wood */}
              <div className="px-3 py-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 rounded-xl flex items-center gap-2 shadow-lg">
                <div className="w-4 h-4 rounded-sm bg-amber-700 flex items-center justify-center text-[9px] text-white">W</div>
                <span className="text-xs font-bold text-orange-400">{wood} Wood</span>
              </div>
            </div>
          )}
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
        {hasSpawned && (
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-2xl p-3 flex items-center gap-2 pointer-events-auto max-w-full overflow-x-auto">
            
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 border-r border-slate-800 hidden sm:inline-block">
              Tools
            </span>

            {/* Inspect / View Mode */}
            <button
              onClick={() => handleModeClick(null)}
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
              onClick={() => handleModeClick('road')}
              className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all relative ${
                buildMode === 'road'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="w-4 h-4 border-2 border-current rounded-sm text-[8px] flex items-center justify-center font-bold">R</div>
              <span className="hidden sm:inline">Build Road</span>
              {currentUser?.role !== 'admin' && !unlockedPermits.includes('road') && (
                <span className="absolute -top-1 -right-1 text-[9px] bg-slate-950 px-1 py-0.5 rounded-full border border-slate-800">🔒</span>
              )}
            </button>

            {/* Plant Tree */}
            <button
              onClick={() => handleModeClick('tree')}
              className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all relative ${
                buildMode === 'tree'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <TreePine className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Plant Tree</span>
              {currentUser?.role !== 'admin' && !unlockedPermits.includes('tree') && (
                <span className="absolute -top-1 -right-1 text-[9px] bg-slate-950 px-1 py-0.5 rounded-full border border-slate-800">🔒</span>
              )}
            </button>

            {/* Build House */}
            <button
              onClick={() => handleModeClick('house')}
              className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all relative ${
                buildMode === 'house'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <Home className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Build House</span>
              {currentUser?.role !== 'admin' && !unlockedPermits.includes('house') && (
                <span className="absolute -top-1 -right-1 text-[9px] bg-slate-950 px-1 py-0.5 rounded-full border border-slate-800">🔒</span>
              )}
            </button>

            {/* Build Skyscraper */}
            <button
              onClick={() => handleModeClick('skyscraper')}
              className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all relative ${
                buildMode === 'skyscraper'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Skyscraper</span>
              {currentUser?.role !== 'admin' && !unlockedPermits.includes('skyscraper') && (
                <span className="absolute -top-1 -right-1 text-[9px] bg-slate-950 px-1 py-0.5 rounded-full border border-slate-800">🔒</span>
              )}
            </button>

            {currentUser?.role === 'admin' && (
              <>
                <div className="w-[1px] h-6 bg-slate-800 mx-1 hidden sm:block" />

                {/* Demolish Tool */}
                <button
                  onClick={() => handleModeClick('delete')}
                  className={`flex flex-col sm:flex-row items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    buildMode === 'delete'
                      ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20'
                      : 'bg-slate-800/50 border-slate-700/30 hover:bg-red-950/20 hover:border-red-900/50 hover:text-red-400 text-slate-300'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Demolish</span>
                </button>
              </>
            )}

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

      {/* Quest Tracker Sidebar (Floating Right) */}
      {hasSpawned && (
        <div className="absolute right-4 top-48 md:right-6 z-25 flex flex-col items-end gap-3 pointer-events-none">
          <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 w-64 flex flex-col gap-3 pointer-events-auto text-left">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Active Quests</h3>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* Quest 1: Lost Dog */}
              <div className="flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-amber-400 text-left">🐶 Find Fido</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                    fidoQuestState === 'completed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' :
                    fidoQuestState === 'fido_found' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/30 animate-pulse' :
                    fidoQuestState === 'active' ? 'bg-sky-950 text-sky-400 border border-sky-800/30' : 'bg-slate-950 text-slate-500'
                  }`}>
                    {fidoQuestState === 'completed' ? 'Completed' :
                     fidoQuestState === 'fido_found' ? 'Fido Found' :
                     fidoQuestState === 'active' ? 'Active' : 'Talk to Owner'}
                  </span>
                </div>
                <p className="text-slate-400 leading-normal text-left">
                  {fidoQuestState === 'completed' && "Returned Fido safely! Quest complete."}
                  {fidoQuestState === 'fido_found' && "Return Fido to the owner citizen."}
                  {fidoQuestState === 'active' && "Find the brown voxel dog around the outskirts."}
                  {fidoQuestState === 'not_started' && "Walk up to a citizen NPC and press E to check for quests."}
                </p>
              </div>

              {/* Quest 2: Arborist */}
              <div className="flex flex-col gap-1 text-[11px] border-t border-slate-850 pt-2.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-emerald-400 text-left">🌲 Green Forestry</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                    treesPlantedCount >= 3 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' : 'bg-sky-950 text-sky-400 border border-sky-800/30'
                  }`}>
                    {treesPlantedCount >= 3 ? 'Completed' : `${treesPlantedCount}/3 Planted`}
                  </span>
                </div>
                <p className="text-slate-400 leading-normal text-left">
                  Plant at least 3 trees in the grid using the arborist permit.
                </p>
              </div>

              {/* Quest 3: Skyscraper Climber */}
              <div className="flex flex-col gap-1 text-[11px] border-t border-slate-850 pt-2.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-indigo-400 text-left">🌇 Skyscraper Climber</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                    skyscraperClimbed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/30' : 'bg-sky-950 text-sky-400 border border-sky-800/30'
                  }`}>
                    {skyscraperClimbed ? 'Completed' : '0/1 Climbed'}
                  </span>
                </div>
                <p className="text-slate-400 leading-normal text-left">
                  Walk onto the roof cell of a skyscraper to complete this challenge.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Sidebar (Floating Left) */}
      {hasSpawned && showAchievements && (
        <div className="absolute left-4 top-48 md:left-6 z-25 flex flex-col items-start gap-3 pointer-events-auto">
          <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 w-72 flex flex-col gap-3 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Achievements</h3>
              </div>
              <button
                onClick={() => setShowAchievements(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
              {[
                { id: 'first_steps', title: 'First Steps', desc: 'Walk 150 units', current: Math.floor(distanceWalked), target: 150, unit: 'm' },
                { id: 'wealthy_citizen', title: 'Wealthy Citizen', desc: 'Accumulate 500 ShunyaCoins', current: shunyaCoins, target: 500, unit: 'SC' },
                { id: 'green_guard', title: 'Green Guard', desc: 'Plant 5 trees', current: treesPlantedCount, target: 5, unit: 'trees' },
                { id: 'npc_helper', title: 'NPC Helper', desc: 'Complete 1 quest (Lost Dog)', current: fidoQuestState === 'completed' ? 1 : 0, target: 1, unit: '' },
                { id: 'high_flyer', title: 'High Flyer', desc: 'Perform 30 jumps', current: jumpsCount, target: 30, unit: 'jumps' },
                { id: 'skyscraper_climber', title: 'Skyscraper Climber', desc: 'Climb a skyscraper roof', current: completedAchievements.includes('skyscraper_climber') ? 1 : 0, target: 1, unit: '' },
                { id: 'dev_extraordinaire', title: 'Dev Extraordinaire', desc: 'Build 10 structures', current: buildsCount, target: 10, unit: 'structures' }
              ].map(ach => {
                const completed = completedAchievements.includes(ach.id);
                const percent = Math.min(100, Math.floor((ach.current / ach.target) * 100));
                
                return (
                  <div key={ach.id} className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-all duration-300 ${
                    completed ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-slate-950/40 border-slate-850/60'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col text-left">
                        <span className={`text-[11px] font-bold ${completed ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {ach.title}
                        </span>
                        <span className="text-[9px] text-slate-400 leading-tight">
                          {ach.desc}
                        </span>
                      </div>
                      {completed ? (
                        <span className="text-[10px] text-emerald-400">✔️</span>
                      ) : (
                        <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                          {ach.current}/{ach.target} {ach.unit}
                        </span>
                      )}
                    </div>
                    {!completed && (
                      <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* NPC Interaction Dialog Box (Bottom Center) */}
      {hasSpawned && activeNpcDialog && (
        <div className="absolute inset-x-0 bottom-32 z-40 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-5 shadow-2xl max-w-lg w-full flex flex-col gap-4 pointer-events-auto text-left animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-600 border border-cyan-400 flex items-center justify-center font-bold text-white text-sm">
                {activeNpcDialog.npcName.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-100">{activeNpcDialog.npcName}</span>
                <span className="text-[9px] text-cyan-400 font-semibold tracking-wider uppercase">Citizen</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-3 rounded-2xl border border-slate-850/50">
              {activeNpcDialog.text}
            </p>
            
            <div className="flex flex-wrap gap-2 justify-end">
              {activeNpcDialog.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={opt.action}
                  className="px-3.5 py-1.5 rounded-xl text-[11px] font-bold bg-sky-600 hover:bg-sky-500 active:scale-95 text-white shadow transition-all border border-sky-400/20 cursor-pointer"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Land Expansion Shop Modal */}
      {hasSpawned && showLandShop && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 pointer-events-auto">
          <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl border border-green-700/40 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowLandShop(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer"
              title="Close Land Shop"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <Map className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
                Land Expansion
              </h2>
              <p className="text-[11px] text-slate-400 text-center max-w-sm">
                Purchase new 8×8 plots to grow your city beyond its current borders.
                Each expansion reveals new terrain, trees, and building opportunities!
              </p>
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/40 mt-1">
                <span className="text-slate-400">Current World Size:</span>
                <span className="text-green-400 font-bold">{cityGridSize} × {cityGridSize} cells</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">Balance:</span>
                <span className="text-amber-400 font-bold">{shunyaCoins} SC</span>
              </div>
            </div>

            {/* Mini city map visualization */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                {/* Center city */}
                <div className="absolute inset-0 m-auto w-16 h-16 bg-gradient-to-br from-emerald-600/60 to-green-700/60 border-2 border-green-500/50 rounded-lg flex items-center justify-center z-10">
                  <span className="text-[9px] text-green-300 font-bold text-center leading-tight">YOUR<br/>CITY</span>
                </div>
                {/* Expansion indicators */}
                {availablePlots.map(plot => (
                  <div
                    key={plot.id}
                    className={`absolute border border-dashed rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer ${shunyaCoins >= plot.cost ? 'border-green-500 bg-green-900/30' : 'border-red-700 bg-red-900/20'}`}
                    style={{
                      width: 52, height: 52,
                      top: plot.direction === 'north' ? 0 : plot.direction === 'south' ? 88 : 44,
                      left: plot.direction === 'west' ? 0 : plot.direction === 'east' ? 88 : 44,
                    }}
                    onClick={() => shunyaCoins >= plot.cost && buyLandPlot(plot)}
                    title={`${LandExpansionManager.directionLabel(plot.direction)} — ${plot.cost} SC`}
                  >
                    <span className="text-[8px] text-green-400 font-bold">+8</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plot Cards */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Available Plots</h3>
              {availablePlots.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-4">No plots available — you have max expansion!</div>
              )}
              {availablePlots.map(plot => {
                const canAfford = shunyaCoins >= plot.cost;
                const dirIcon = ({
                  north: <ArrowUp className="w-4 h-4" />,
                  south: <ArrowDown className="w-4 h-4" />,
                  east: <ArrowRight className="w-4 h-4" />,
                  west: <ArrowLeft className="w-4 h-4" />,
                  northeast: <ArrowUp className="w-4 h-4" />,
                  northwest: <ArrowUp className="w-4 h-4" />,
                  southeast: <ArrowDown className="w-4 h-4" />,
                  southwest: <ArrowDown className="w-4 h-4" />,
                } as Record<string, React.ReactNode>)[plot.direction] ?? <Map className="w-4 h-4" />;

                return (
                  <div
                    key={plot.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      canAfford
                        ? 'border-green-700/40 bg-green-900/20 hover:border-green-500/60 hover:bg-green-900/30'
                        : 'border-slate-700/30 bg-slate-800/20 opacity-60'
                    }`}
                  >
                    {/* Direction icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${canAfford ? 'bg-green-600/30 text-green-400' : 'bg-slate-700/30 text-slate-500'}`}>
                      {dirIcon}
                    </div>

                    {/* Plot info */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold text-slate-200">
                        {LandExpansionManager.directionLabel(plot.direction)} Expansion
                      </div>
                      <div className="text-[10px] text-slate-400">
                        +8×8 cells of buildable land · Ring {plot.ring}
                      </div>
                    </div>

                    {/* Buy button */}
                    <button
                      onClick={() => buyLandPlot(plot)}
                      disabled={!canAfford}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        canAfford
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-amber-400 font-black">⬡</span>
                      {plot.cost} SC
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer note */}
            <p className="text-[10px] text-slate-500 text-center">
              🌟 Each expansion also spawns new trees and triggers a golden land-reveal animation!
            </p>
          </div>
        </div>
      )}

      {/* Permit Store Modal */}
      {hasSpawned && showPermitStore && (

        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 pointer-events-auto">
          <div className="w-full max-w-md bg-slate-900/85 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPermitStore(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer"
              title="Close Permit Shop"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Award className="w-6 h-6 text-slate-950 font-bold" />
              </div>
              <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent">
                Permit Store
              </h2>
              <p className="text-[10px] text-slate-400 max-w-xs">
                Unlock permanent building permits using ShunyaCoins to construct on the map.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { key: 'road', name: 'Road Builder Permit', cost: 50, desc: 'Enables construction of asphalt roads to link intersections.', color: 'from-slate-700 to-slate-850' },
                { key: 'tree', name: 'Arborist Permit', cost: 100, desc: 'Enables planting decorative pine trees which can be harvested for wood.', color: 'from-emerald-800 to-emerald-950' },
                { key: 'house', name: 'Residential Permit', cost: 250, desc: 'Allows building houses which generate citizen NPCs and work opportunities.', color: 'from-amber-700 to-amber-900' },
                { key: 'skyscraper', name: 'Commercial Permit', cost: 500, desc: 'Allows building towering skyscrapers for advanced technology office jobs.', color: 'from-indigo-800 to-indigo-950' },
              ].map(permit => {
                const owned = unlockedPermits.includes(permit.key) || currentUser?.role === 'admin';
                return (
                  <div key={permit.key} className="p-3.5 bg-slate-950/60 border border-slate-800/60 rounded-2xl flex items-center justify-between gap-4 text-left">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-slate-200">{permit.name}</span>
                      <span className="text-[9px] text-slate-400 leading-relaxed">{permit.desc}</span>
                    </div>
                    
                    <button
                      onClick={() => buyPermit(permit.key, permit.cost)}
                      disabled={owned || shunyaCoins < permit.cost}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold tracking-wide w-24 text-center border shadow transition-all active:scale-95 cursor-pointer ${
                        owned 
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 cursor-not-allowed shadow-none' 
                          : shunyaCoins >= permit.cost 
                            ? 'bg-amber-500 border-amber-400 text-slate-950 hover:bg-amber-400' 
                            : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {owned ? 'Unlocked' : `${permit.cost} SC`}
                    </button>
                  </div>
                );
              })}
            </div>
            
            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850 text-[10px] text-slate-455">
              Your balance: <span className="text-amber-400 font-bold">{shunyaCoins} SC</span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {hasSpawned && showLeaderboard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 pointer-events-auto">
          <div className="w-full max-w-sm bg-slate-900/85 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-4 text-center relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer"
              title="Close Leaderboard"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-black bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                Simulation Leaderboard
              </h2>
              <p className="text-[10px] text-slate-400">
                Rankings of active players by level and wealth.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
              {[
                { 
                  _id: currentUser?.id || 'local', 
                  name: currentUser?.name || 'You', 
                  level, 
                  shunyaCoins, 
                  isLocal: true,
                  clothingColor: currentUser?.clothingColor 
                },
                ...otherPlayers
              ]
                .sort((a, b) => b.level !== a.level ? b.level - a.level : b.shunyaCoins - a.shunyaCoins)
                .map((p, idx) => (
                  <div 
                    key={p._id} 
                    className={`p-2.5 border rounded-2xl flex items-center justify-between gap-3 ${
                      p.isLocal 
                        ? 'bg-cyan-950/20 border-cyan-500/30 font-bold' 
                        : 'bg-slate-950/60 border-slate-850/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-500 w-4">{idx + 1}</span>
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white uppercase shadow"
                        style={{
                          backgroundColor: p.clothingColor 
                            ? `#${p.clothingColor.toString(16).padStart(6, '0')}` 
                            : '#ef4444'
                        }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                          {p.name} {p.isLocal && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1 py-0.2 rounded border border-cyan-500/30">You</span>}
                        </span>
                        <span className="text-[9px] text-slate-400">{p.shunyaCoins} SC</span>
                      </div>
                    </div>
                    
                    <span className="text-xs font-black text-cyan-400">Level {p.level}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Job Progress Loading Bar */}
      {jobProgress > -1 && (
        <div className="absolute inset-0 z-40 bg-slate-950/30 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-750 p-6 rounded-3xl w-80 shadow-2xl flex flex-col gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-sky-500/25 border border-sky-400/30 flex items-center justify-center text-sky-400 animate-spin-slow">
                <Hammer className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 tracking-wide">Executing City Job...</h3>
              <p className="text-[10px] text-slate-450">Locking character animation. Please wait.</p>
            </div>
            <div className="relative w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                style={{ width: `${jobProgress}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white mix-blend-difference">
                {jobProgress}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="absolute top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-3 text-xs font-semibold pointer-events-auto transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : toast.type === 'warning'
                ? 'bg-amber-950/80 border-amber-500/30 text-amber-300'
                : 'bg-slate-900/80 border-slate-700/40 text-sky-400'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-450 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
