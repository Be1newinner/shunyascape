"use client";

/* eslint-disable react-hooks/purity */

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ThreeCity } from "./simulation/ThreeCity";
import {
  BuildType,
  CityStats,
  EquippedClothes,
  HumanAgent,
} from "./simulation/Types";
import {
  LandExpansionManager,
  LandPlot,
  PLOT_COST_RING1,
} from "./simulation/LandExpansion";

// Lightweight custom hook to make modals/HUD elements draggable by their headers/handles
function useDraggable() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const startDrag = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      // Avoid dragging when clicking on buttons, inputs, links, or items with .no-drag class
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("a") ||
        target.closest(".no-drag")
      ) {
        return false;
      }
      isDragging.current = true;
      dragStart.current = {
        x: clientX - position.x,
        y: clientY - position.y,
      };
      return true;
    },
    [position],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.button !== 0) return; // Only drag with left mouse button
      const target = e.target as HTMLElement;
      if (!startDrag(e.clientX, e.clientY, target)) return;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        setPosition({
          x: moveEvent.clientX - dragStart.current.x,
          y: moveEvent.clientY - dragStart.current.y,
        });
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [startDrag],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const touch = e.touches[0];
      const target = e.target as HTMLElement;
      if (!startDrag(touch.clientX, touch.clientY, target)) return;

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (!isDragging.current) return;
        const moveTouch = moveEvent.touches[0];
        setPosition({
          x: moveTouch.clientX - dragStart.current.x,
          y: moveTouch.clientY - dragStart.current.y,
        });
      };

      const handleTouchEnd = () => {
        isDragging.current = false;
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove, {
        passive: true,
      });
      document.addEventListener("touchend", handleTouchEnd);
    },
    [startDrag],
  );

  const reset = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return {
    handleMouseDown,
    handleTouchStart,
    reset,
    style: {
      transform: `translate(${position.x}px, ${position.y}px)`,
    },
  };
}

export default function CitySimulator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<ThreeCity | null>(null);

  // States
  const [buildMode, setBuildMode] = useState<BuildType>("road");
  const [selectedBuildScale, setSelectedBuildScale] = useState<number>(1.0);
  const [stats, setStats] = useState<CityStats>({
    population: 0,
    houses: 0,
    skyscrapers: 0,
    trees: 0,
    roads: 0,
    activeConstruction: 0,
  });

  const [timeOfDay, setTimeOfDay] = useState<number>(8.0);
  const [timeSpeed, setTimeSpeed] = useState<number>(1 / 120);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [showDeveloperPopup, setShowDeveloperPopup] = useState<boolean>(false);

  // Simulation Loading Screen States
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingText, setLoadingText] = useState<string>(
    "Initializing terrain...",
  );
  const [showProfilePopup, setShowProfilePopup] = useState<boolean>(false);

  // ── Settings Panel State ────────────────────────────────────────────────────
  const [settingsTab, setSettingsTab] = useState<
    "profile" | "controls" | "achievements" | "fps"
  >("profile");
  const [settingsEditName, setSettingsEditName] = useState<string>("");
  const [settingsNewPassword, setSettingsNewPassword] = useState<string>("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] =
    useState<string>("");
  const [settingsGender, setSettingsGender] = useState<
    "male" | "female" | "other" | "skip"
  >("skip");
  const [settingsDob, setSettingsDob] = useState<string>("");
  const [settingsFpsCap, setSettingsFpsCap] = useState<number>(60);
  const [settingsGraphicsPreset, setSettingsGraphicsPreset] = useState<"low" | "medium" | "high">("low");
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string>("");

  // Progression & Economy States
  const [shunyaCoins, setShunyaCoins] = useState<number>(100);
  const [wood, setWood] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [xp, setXp] = useState<number>(0);
  const [unlockedPermits, setUnlockedPermits] = useState<string[]>([]);
  const [completedAchievements, setCompletedAchievements] = useState<string[]>(
    [],
  );

  // Quest Tracker States
  const [fidoQuestState, setFidoQuestState] = useState<
    "not_started" | "active" | "fido_found" | "completed"
  >("not_started");
  const [treesPlantedCount, setTreesPlantedCount] = useState<number>(0);
  const [skyscraperClimbed, setSkyscraperClimbed] = useState<boolean>(false);

  // Telemetry statistics
  const [distanceWalked, setDistanceWalked] = useState<number>(0);
  const [jumpsCount, setJumpsCount] = useState<number>(0);
  const [worksCount, setWorksCount] = useState<number>(0);
  const [buildsCount, setBuildsCount] = useState<number>(0);

  // Multiplayer Telemetry
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);
  const [party, setParty] = useState<any>(null);
  const [partyInvites, setPartyInvites] = useState<any[]>([]);

  // UI Dialog overlays & popups
  const [toasts, setToasts] = useState<
    { id: string; message: string; type: "info" | "success" | "warning" }[]
  >([]);
  const [activeNpcDialog, setActiveNpcDialog] = useState<{
    npcName: string;
    text: string;
    options: { text: string; action: () => void }[];
  } | null>(null);
  const [standingCell, setStandingCell] = useState<{
    type: string;
    x: number;
    z: number;
  } | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(-1); // -1 means idle
  const [showPermitStore, setShowPermitStore] = useState<boolean>(false);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showAchievements, setShowAchievements] = useState<boolean>(false);
  const [showLandShop, setShowLandShop] = useState<boolean>(false);
  const [availablePlots, setAvailablePlots] = useState<LandPlot[]>([]);
  const [cityGridSize, setCityGridSize] = useState<number>(32);
  const [showBuildMenu, setShowBuildMenu] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // ── Hunger & survival system ────────────────────────────────────────────────
  const [hungerLevel, setHungerLevel] = useState<number>(100); // 0–100
  const [dayCount, setDayCount] = useState<number>(0);
  const lastDayRef = useRef<number>(8.0); // tracks previous timeOfDay
  const lastHungerDrainRef = useRef<number>(0); // real-time guard (ms)

  // ── Shop modals ─────────────────────────────────────────────────────────────
  const [showDeathScreen, setShowDeathScreen] = useState<boolean>(false);
  const [showFoodShop, setShowFoodShop] = useState<boolean>(false);
  const [showClothShop, setShowClothShop] = useState<boolean>(false);
  const [showBarberShop, setShowBarberShop] = useState<boolean>(false);
  const [showPoliceStation, setShowPoliceStation] = useState<boolean>(false);
  const [activeStore, setActiveStore] = useState<{
    type: string;
    storeName: string;
    emoji: string;
    ownerName: string | null;
    ownerEmail: string | null;
    price: number;
    isPurchased: boolean;
    x: number;
    z: number;
  } | null>(null);
  const [showMinimapFull, setShowMinimapFull] = useState<boolean>(false);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapFullCanvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const fullMapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const lastRenderedVersionRef = useRef<{ mini: number; full: number }>({
    mini: -1,
    full: -1,
  });
  const [equippedClothes, setEquippedClothes] = useState<EquippedClothes>({
    shirtColor: 0xff3b30,
    pantColor: 0x111111,
    shoeColor: 0x111111,
  });
  const [playerHairColor, setPlayerHairColor] = useState<string>("#1a1a1a");

  // Toast notifier helper
  const showToast = (
    message: string,
    type: "info" | "success" | "warning" = "info",
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Authentication & Session states
  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">(
    "login",
  );
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasSpawned, setHasSpawned] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [isStuck, setIsStuck] = useState<boolean>(false);

  // Draggable HUD & Modals
  const mapDrag = useDraggable();
  const statsDrag = useDraggable();
  const permitDrag = useDraggable();
  const leaderboardDrag = useDraggable();
  const achievementsDrag = useDraggable();
  const landDrag = useDraggable();
  const profileDrag = useDraggable();
  const developerDrag = useDraggable();
  const foodDrag = useDraggable();
  const clothDrag = useDraggable();
  const barberDrag = useDraggable();
  const policeDrag = useDraggable();
  const hungerDrag = useDraggable();
  const questsDrag = useDraggable();
  const minimapDrag = useDraggable();
  const cameraHudDrag = useDraggable();

  // Reset draggable positions when modals/HUDs close
  const { reset: resetMap } = mapDrag;
  const { reset: resetPermit } = permitDrag;
  const { reset: resetLeaderboard } = leaderboardDrag;
  const { reset: resetAchievements } = achievementsDrag;
  const { reset: resetLand } = landDrag;
  const { reset: resetProfile } = profileDrag;
  const { reset: resetDeveloper } = developerDrag;
  const { reset: resetFood } = foodDrag;
  const { reset: resetCloth } = clothDrag;
  const { reset: resetBarber } = barberDrag;
  const { reset: resetPolice } = policeDrag;
  const { reset: resetHunger } = hungerDrag;
  const { reset: resetQuests } = questsDrag;
  const { reset: resetMinimap } = minimapDrag;
  const { reset: resetCameraHud } = cameraHudDrag;

  useEffect(() => {
    if (!showMinimapFull) resetMap();
  }, [showMinimapFull, resetMap]);

  useEffect(() => {
    if (!showPermitStore) resetPermit();
  }, [showPermitStore, resetPermit]);

  useEffect(() => {
    if (!showLeaderboard) resetLeaderboard();
  }, [showLeaderboard, resetLeaderboard]);

  useEffect(() => {
    if (!showAchievements) resetAchievements();
  }, [showAchievements, resetAchievements]);

  useEffect(() => {
    if (!showLandShop) resetLand();
  }, [showLandShop, resetLand]);

  useEffect(() => {
    if (!showProfilePopup) {
      resetProfile();
    } else if (currentUser) {
      // Pre-fill form from existing user data
      setSettingsEditName(currentUser.name || "");
      setSettingsGender(currentUser.gender || "skip");
      setSettingsDob(currentUser.dob || "");
      setSettingsTab("profile");
      setSettingsSaveMsg("");
      setSettingsNewPassword("");
      setSettingsConfirmPassword("");
    }
  }, [showProfilePopup, resetProfile, currentUser]);

  useEffect(() => {
    if (!showDeveloperPopup) resetDeveloper();
  }, [showDeveloperPopup, resetDeveloper]);

  useEffect(() => {
    if (!showFoodShop) resetFood();
  }, [showFoodShop, resetFood]);

  useEffect(() => {
    if (!showClothShop) resetCloth();
  }, [showClothShop, resetCloth]);

  useEffect(() => {
    if (!showBarberShop) resetBarber();
  }, [showBarberShop, resetBarber]);

  useEffect(() => {
    if (!showPoliceStation) resetPolice();
  }, [showPoliceStation, resetPolice]);

  useEffect(() => {
    if (!hasSpawned) {
      resetHunger();
      resetQuests();
      resetMinimap();
      resetCameraHud();
    }
  }, [hasSpawned, resetHunger, resetQuests, resetMinimap, resetCameraHud]);

  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [joystickActive, setJoystickActive] = useState(false);
  const joystickDragActive = useRef(false);
  const joystickLastPos = useRef({ x: 0, y: 0 });
  const joystickAccum = useRef({ x: 0, y: 0 });

  const handleJoystickStart = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    ) => {
      e.stopPropagation();

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      joystickDragActive.current = true;
      setJoystickActive(true);
      joystickLastPos.current = { x: clientX, y: clientY };
      joystickAccum.current = { x: 0, y: 0 };

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!joystickDragActive.current) return;

        const curX =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientX
            : moveEvent.clientX;
        const curY =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientY
            : moveEvent.clientY;

        const dx = curX - joystickLastPos.current.x;
        const dy = curY - joystickLastPos.current.y;

        joystickLastPos.current = { x: curX, y: curY };

        if (cityRef.current) {
          cityRef.current.rotateCamera(dx * 0.007, dy * 0.007);
        }

        joystickAccum.current.x += dx;
        joystickAccum.current.y += dy;

        const dist = Math.sqrt(
          joystickAccum.current.x ** 2 + joystickAccum.current.y ** 2,
        );
        const maxRadius = 24;
        if (dist === 0) {
          setJoystickKnob({ x: 0, y: 0 });
        } else {
          const capDist = Math.min(maxRadius, dist);
          const ratio = capDist / dist;
          setJoystickKnob({
            x: joystickAccum.current.x * ratio,
            y: joystickAccum.current.y * ratio,
          });
        }
      };

      const handleEnd = () => {
        joystickDragActive.current = false;
        setJoystickActive(false);
        setJoystickKnob({ x: 0, y: 0 });

        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleEnd);
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove, { passive: true });
      document.addEventListener("touchend", handleEnd);
    },
    [],
  );

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setResetSuccessMsg("");
    setAuthLoading(true);

    if (authMode === "reset") {
      try {
        const res = await fetch("/api/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setAuthError(data.error || "Password reset failed");
          setAuthLoading(false);
          return;
        }

        setResetSuccessMsg(
          "Password reset successfully! Please sign in with your new password.",
        );
        setPassword("");
        setAuthMode("login");
        setAuthLoading(false);
      } catch (err) {
        console.error(err);
        setAuthError("Connection failed. Please verify database availability.");
        setAuthLoading(false);
      }
      return;
    }

    const url =
      authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    const body =
      authMode === "register"
        ? { name: playerName, email, password }
        : { email, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Authentication failed");
        setAuthLoading(false);
        return;
      }

      const user = data.user;
      localStorage.setItem("shunyascape_user", JSON.stringify(user));
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
      showToast(`Welcome back, ${user.name}!`, "success");

      if (cityRef.current) {
        cityRef.current.isAdmin = user.role === "admin";
        cityRef.current.spawnPlayer(
          user.name,
          user.x,
          user.z,
          user.email,
          user.clothingColor,
          user.id,
          user.level || 1,
        );
        setSoundEnabled(true);
        cityRef.current.audio.toggle(true);
      }
    } catch (err) {
      console.error(err);
      setAuthError("Connection failed. Please verify database availability.");
      setAuthLoading(false);
    }
  };

  // Helper to add player coins/XP/wood and sync them
  const addProgress = (
    coinsGained: number,
    xpGained: number,
    woodGained: number = 0,
    achievementsOverride?: string[],
    permitsOverride?: string[],
  ) => {
    setShunyaCoins((prevCoins) => {
      const nextCoins = prevCoins + coinsGained;

      setXp((prevXp) => {
        let nextXp = prevXp + xpGained;

        setLevel((prevLevel) => {
          let nextLevel = prevLevel;
          let xpNeeded = nextLevel * 100;

          while (nextXp >= xpNeeded) {
            nextLevel += 1;
            nextXp -= xpNeeded;
            showToast(`Level Up! Reached Level ${nextLevel}!`, "success");
            if (cityRef.current) {
              cityRef.current.audio.playSpawn(); // level up sound
              cityRef.current.updatePlayerLevel(nextLevel);
            }
            xpNeeded = nextLevel * 100;
          }

          setWood((prevWood) => {
            const nextWood = prevWood + woodGained;

            // Sync with backend websocket
            const permits =
              permitsOverride !== undefined ? permitsOverride : unlockedPermits;
            const achs =
              achievementsOverride !== undefined
                ? achievementsOverride
                : completedAchievements;

            if (
              cityRef.current?.ws &&
              cityRef.current.ws.readyState === WebSocket.OPEN
            ) {
              cityRef.current.ws.send(
                JSON.stringify({
                  type: "progress-update",
                  shunyaCoins: nextCoins,
                  level: nextLevel,
                  xp: nextXp,
                  wood: nextWood,
                  unlockedPermits: permits,
                  completedAchievements: achs,
                }),
              );
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
    showToast(
      `Purchased ${permitKey.charAt(0).toUpperCase() + permitKey.slice(1)} Permit!`,
      "success",
    );
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
      showToast(
        `🗺️ Land expanded ${LandExpansionManager.directionLabel(plot.direction)}! New area revealed.`,
        "success",
      );
    } else {
      showToast("Could not expand land in that direction.", "warning");
    }
  };

  // ── Hunger System ────────────────────────────────────────────────────────────
  /**
   * Called when an in-game day passes. Drains hunger by 34 pts (3 days = dead).
   * Guard: real-time minimum of 5 minutes per drain to prevent speed abuse.
   */
  const drainHunger = () => {
    const now = Date.now();
    // 1 real in-game day = 8 real hours = 28 800 s; guard at 7 h to allow tolerance
    const minRealMs = 7 * 60 * 60 * 1000; // 7 real hours minimum per drain
    if (now - lastHungerDrainRef.current < minRealMs) return;
    lastHungerDrainRef.current = now;

    setHungerLevel((prev) => {
      const next = Math.max(0, prev - 34);
      setDayCount((d) => d + 1);

      if (next <= 0) {
        setShowDeathScreen(true);
      } else if (next <= 33) {
        // Day 3 starvation warning — will appear persistently in UI
        showToast(
          "☠️ CRITICAL: You will die today if you don't eat! Go to a Restaurant!",
          "warning",
        );
        setTimeout(
          () =>
            showToast("🍔 Find a Restaurant and press R to eat!", "warning"),
          4000,
        );
      } else if (next <= 66) {
        showToast("🟡 You're getting hungry! Visit a Restaurant soon.", "info");
      }
      return next;
    });
  };

  /** Full death reset — wipes all progression */
  const triggerDeath = () => {
    setHungerLevel(100);
    setDayCount(0);
    lastDayRef.current = 8.0;
    lastHungerDrainRef.current = 0;
    setShunyaCoins(0);
    setXp(0);
    setLevel(1);
    setWood(0);
    setUnlockedPermits([]);
    setCompletedAchievements([]);
    setShowDeathScreen(false);

    // Sync reset to backend
    if (
      cityRef.current?.ws &&
      cityRef.current.ws.readyState === WebSocket.OPEN
    ) {
      cityRef.current.ws.send(
        JSON.stringify({
          type: "progress-update",
          shunyaCoins: 0,
          level: 1,
          xp: 0,
          wood: 0,
          unlockedPermits: [],
          completedAchievements: [],
        }),
      );
    }

    // Teleport player back to city centre
    if (cityRef.current?.player) {
      cityRef.current.player.mesh.position.set(0, 0, 0);
    }

    showToast(
      "💀 You died from starvation. All progress has been reset. Start fresh!",
      "warning",
    );
  };

  // ── Admin Revenue Helper ─────────────────────────────────────────────────────
  const sendAdminRevenue = (amount: number) => {
    if (
      cityRef.current?.ws &&
      cityRef.current.ws.readyState === WebSocket.OPEN
    ) {
      cityRef.current.ws.send(
        JSON.stringify({ type: "admin-revenue", amount }),
      );
    }
  };

  // ── Food Shop ────────────────────────────────────────────────────────────────
  const buyFood = (item: {
    name: string;
    cost: number;
    hungerRestore: number;
  }) => {
    if (shunyaCoins < item.cost) {
      showToast(`Not enough ShunyaCoins! Need ${item.cost} SC.`, "warning");
      return;
    }
    addProgress(-item.cost, 5);
    sendAdminRevenue(item.cost);
    setHungerLevel((prev) => Math.min(100, prev + item.hungerRestore));
    setShowFoodShop(false);
    showToast(`🍔 Enjoyed ${item.name}! Hunger restored.`, "success");
    cityRef.current?.audio.playPop();
  };

  // ── Cloth Shop ────────────────────────────────────────────────────────────────
  const buyClothing = (
    slot: "shirt" | "pant" | "shoe",
    hexColor: number,
    label: string,
    cost: number,
  ) => {
    if (shunyaCoins < cost) {
      showToast(`Not enough ShunyaCoins! Need ${cost} SC.`, "warning");
      return;
    }
    addProgress(-cost, 5);
    sendAdminRevenue(cost);
    const hexStr = "#" + hexColor.toString(16).padStart(6, "0");
    setEquippedClothes((prev) => ({
      ...prev,
      [`${slot}Color`]: hexColor,
    }));
    cityRef.current?.updatePlayerClothing(slot, hexStr);
    showToast(`👕 Equipped new ${label}!`, "success");
    cityRef.current?.audio.playPop();
  };

  // ── Barber Shop ────────────────────────────────────────────────────────────────
  const changeHairColor = (hexColor: string, label: string, cost: number) => {
    if (shunyaCoins < cost) {
      showToast(`Not enough ShunyaCoins! Need ${cost} SC.`, "warning");
      return;
    }
    addProgress(-cost, 5);
    sendAdminRevenue(cost);
    setPlayerHairColor(hexColor);
    cityRef.current?.updatePlayerHairColor(hexColor);
    showToast(`✂️ New hairstyle: ${label}! Looking fresh!`, "success");
    cityRef.current?.audio.playPop();
  };

  const triggerUnlock = (achKey: string, title: string, xpReward: number) => {
    if (completedAchievements.includes(achKey)) return;
    const nextAchs = [...completedAchievements, achKey];
    setCompletedAchievements(nextAchs);
    showToast(`Achievement Unlocked: ${title}! (+${xpReward} XP)`, "success");
    addProgress(0, xpReward, 0, nextAchs);
    if (cityRef.current) {
      cityRef.current.audio.playPop();
    }
  };

  const startJob = (
    duration: number,
    title: string,
    onComplete: () => void,
  ) => {
    if (cityRef.current) {
      cityRef.current.startWorking();
    }
    setJobProgress(0);
    showToast(title, "info");

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
    const npcName =
      npc.playerName || `Citizen ${npc.id.split("_")[1] || npc.id}`;

    if (fidoQuestState === "not_started") {
      setActiveNpcDialog({
        npcName,
        text: `Hello there! My voxel dog Fido ran away into the corners of the city. If you find him and walk near him, he'll follow you back. I'll reward you with 150 ShunyaCoins!`,
        options: [
          {
            text: "Sure, I'll search for Fido!",
            action: () => {
              setFidoQuestState("active");
              showToast("Quest Started: Find Fido", "info");
              setActiveNpcDialog(null);
              cityRef.current?.setFidoQuestOwner(npc.id);
            },
          },
          {
            text: "Maybe another time.",
            action: () => setActiveNpcDialog(null),
          },
        ],
      });
    } else if (fidoQuestState === "active") {
      setActiveNpcDialog({
        npcName,
        text: `Have you found Fido yet? He's a brown dog. Look around the city outskirts!`,
        options: [
          {
            text: "Still looking...",
            action: () => setActiveNpcDialog(null),
          },
        ],
      });
    } else if (fidoQuestState === "fido_found") {
      setActiveNpcDialog({
        npcName,
        text: `Oh! Fido! You found him! Thank you so much! Here is your reward as promised.`,
        options: [
          {
            text: "You're welcome!",
            action: () => {
              setFidoQuestState("completed");
              triggerUnlock("npc_helper", "NPC Helper", 50);
              addProgress(150, 0); // Quest reward coins
              setActiveNpcDialog(null);
              cityRef.current?.stopFidoFollowing();
            },
          },
        ],
      });
    } else {
      const lines = [
        "What a beautiful persistent city we are building!",
        "Check out the Permit Store if you want to unlock building tools.",
        "Ensure you don't get trapped inside buildings! Use the stuck button to teleport out.",
        "Collect glowing energy crystals to gain huge experience boosts!",
        "Kicking or punching trees drops wood resource crates.",
      ];
      const randomLine = lines[Math.floor(Math.random() * lines.length)];
      setActiveNpcDialog({
        npcName,
        text: randomLine,
        options: [
          {
            text: "Nice chatting with you!",
            action: () => setActiveNpcDialog(null),
          },
        ],
      });
    }
  };

  // Achievement logic triggers
  useEffect(() => {
    if (!hasSpawned) return;
    if (distanceWalked >= 150) {
      setTimeout(() => triggerUnlock("first_steps", "First Steps", 50), 0);
    }
    if (shunyaCoins >= 500) {
      setTimeout(
        () => triggerUnlock("wealthy_citizen", "Wealthy Citizen", 50),
        0,
      );
    }
    if (jumpsCount >= 30) {
      setTimeout(() => triggerUnlock("high_flyer", "High Flyer", 50), 0);
    }
    if (wood >= 25 || treesPlantedCount >= 5) {
      setTimeout(() => triggerUnlock("green_guard", "Green Guard", 50), 0);
    }
    if (buildsCount >= 10) {
      setTimeout(
        () => triggerUnlock("dev_extraordinaire", "Dev Extraordinaire", 100),
        0,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    distanceWalked,
    shunyaCoins,
    jumpsCount,
    wood,
    buildsCount,
    treesPlantedCount,
    hasSpawned,
  ]);

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
      setBuildsCount((prev) => prev + 1);
    };

    const handleTreePlanted = () => {
      setTreesPlantedCount((prev) => {
        if (prev >= 3) return prev;
        const nextCount = prev + 1;
        if (nextCount === 3) {
          addProgress(100, 30);
          showToast(
            "Quest Completed: Plant 3 Trees! (+100 SC, +30 XP)",
            "success",
          );
        }
        return nextCount;
      });
    };

    const handleWalked = (e: Event) => {
      const { distance } = (e as CustomEvent).detail;
      setDistanceWalked((prev) => prev + distance);
    };

    const handleJumped = () => {
      setJumpsCount((prev) => prev + 1);
    };

    const handleCellChange = (e: Event) => {
      const { type, x, z } = (e as CustomEvent).detail;
      setStandingCell({ type, x, z });
      if (type === "skyscraper") {
        triggerUnlock("skyscraper_climber", "Skyscraper Climber", 100);
        if (!skyscraperClimbed) {
          setSkyscraperClimbed(true);
          addProgress(200, 100);
          showToast(
            "Quest Completed: Skyscraper Climber! (+200 SC, +100 XP)",
            "success",
          );
        }
        setActiveStore(null);
      } else if (type === "house") {
        triggerUnlock("skyscraper_climber", "Skyscraper Climber", 100);
        setActiveStore(null);
      } else if (
        ["restaurant", "clothshop", "barbershop", "policestation"].includes(
          type,
        )
      ) {
        // Show store notification when player walks near
        const storeInfo: Record<string, { name: string; emoji: string }> = {
          restaurant: { name: "Mac D Fast Food", emoji: "🍔" },
          clothshop: { name: "Cloth Shop", emoji: "👕" },
          barbershop: { name: "Barber Shop", emoji: "✂️" },
          policestation: { name: "Police Station", emoji: "🚔" },
        };
        const info = storeInfo[type];
        if (cityRef.current) {
          const cell = cityRef.current.grid[x]?.[z];
          setActiveStore({
            type,
            storeName: info?.name ?? type,
            emoji: info?.emoji ?? "🏪",
            ownerName: cell?.ownerName ?? null,
            ownerEmail: cell?.ownerEmail ?? null,
            price: cell?.price ?? 0,
            isPurchased: cell?.isPurchased ?? false,
            x,
            z,
          });
        }
      } else {
        setActiveStore(null);
      }
    };

    const handleFidoNear = () => {
      if (fidoQuestState === "active") {
        setFidoQuestState("fido_found");
        showToast("You found Fido! Bring him back to his owner.", "success");
        if (cityRef.current) {
          cityRef.current.audio.playPop();
        }
      }
    };

    const handleFidoReturned = () => {
      if (fidoQuestState === "fido_found") {
        setFidoQuestState("completed");
        triggerUnlock("npc_helper", "NPC Helper", 50);
        addProgress(150, 0); // Quest reward coins
        showToast(
          "Quest Completed: Returned Fido safely! (+150 SC)",
          "success",
        );
        if (cityRef.current) {
          cityRef.current.audio.playPop();
          cityRef.current.stopFidoFollowing();
        }
      }
    };

    const handleCoinsSpent = (e: Event) => {
      const { coins } = (e as CustomEvent).detail;
      addProgress(-coins, 0);
    };

    const handleToast = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail;
      showToast(message, type);
    };

    const handleZoomChange = (e: Event) => {
      const { zoomScale } = (e as CustomEvent).detail;
      setZoomScale(zoomScale);
    };

    window.addEventListener("shunya-collect", handleCollect);
    window.addEventListener("shunya-harvest", handleHarvest);
    window.addEventListener("shunya-build-completed", handleBuildCompleted);
    window.addEventListener("shunya-tree-planted", handleTreePlanted);
    window.addEventListener("shunya-walked", handleWalked);
    window.addEventListener("shunya-jumped", handleJumped);
    window.addEventListener("shunya-cell-change", handleCellChange);
    window.addEventListener("shunya-fido-near", handleFidoNear);
    window.addEventListener("shunya-fido-returned", handleFidoReturned);
    window.addEventListener("shunya-coins-spent", handleCoinsSpent);
    window.addEventListener("shunya-toast", handleToast);
    window.addEventListener("shunya-zoom-change", handleZoomChange);

    return () => {
      window.removeEventListener("shunya-collect", handleCollect);
      window.removeEventListener("shunya-harvest", handleHarvest);
      window.removeEventListener(
        "shunya-build-completed",
        handleBuildCompleted,
      );
      window.removeEventListener("shunya-tree-planted", handleTreePlanted);
      window.removeEventListener("shunya-walked", handleWalked);
      window.removeEventListener("shunya-jumped", handleJumped);
      window.removeEventListener("shunya-cell-change", handleCellChange);
      window.removeEventListener("shunya-fido-near", handleFidoNear);
      window.removeEventListener("shunya-fido-returned", handleFidoReturned);
      window.removeEventListener("shunya-coins-spent", handleCoinsSpent);
      window.removeEventListener("shunya-toast", handleToast);
      window.removeEventListener("shunya-zoom-change", handleZoomChange);
    };
  }, [
    hasSpawned,
    shunyaCoins,
    level,
    xp,
    wood,
    unlockedPermits,
    completedAchievements,
    fidoQuestState,
    skyscraperClimbed,
  ]);

  // Keypress listener for R (interaction key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key && e.key.toLowerCase() === "r") {
        // 1. Standing cell interaction
        if (standingCell && jobProgress === -1) {
          const type = standingCell.type;

          if (type === "restaurant") {
            setShowFoodShop(true);
            return;
          } else if (type === "clothshop") {
            setShowClothShop(true);
            return;
          } else if (type === "barbershop") {
            setShowBarberShop(true);
            return;
          } else if (type === "policestation") {
            setShowPoliceStation(true);
            return;
          } else if (type === "skyscraper") {
            startJob(5000, "Working in Tech Office...", () => {
              addProgress(50, 20);
              showToast(
                "Worked at Tech Office! Earned +50 SC, +20 XP",
                "success",
              );
            });
          } else if (type === "house") {
            startJob(4000, "Helping Renovate House...", () => {
              addProgress(30, 15);
              showToast("Finished Repairs! Earned +30 SC, +15 XP", "success");
            });
          } else if (type === "construction") {
            startJob(3000, "Accelerating Construction...", () => {
              addProgress(20, 10);
              if (cityRef.current) {
                const cell =
                  cityRef.current.grid[standingCell.x][standingCell.z];
                if (cell && cell.type === "construction") {
                  cell.constructionProgress = Math.min(
                    100,
                    cell.constructionProgress + 40,
                  );
                  if (cell.constructionProgress >= 100) {
                    cityRef.current.completeConstruction(
                      standingCell.x,
                      standingCell.z,
                    );
                  } else {
                    if (
                      cityRef.current.ws &&
                      cityRef.current.ws.readyState === WebSocket.OPEN
                    ) {
                      cityRef.current.ws.send(
                        JSON.stringify({
                          type: "grid-update",
                          cell: {
                            x: standingCell.x,
                            z: standingCell.z,
                            type: "construction",
                            targetType: cell.targetType,
                            constructionProgress: cell.constructionProgress,
                            height: cell.height,
                          },
                        }),
                      );
                    }
                  }
                }
              }
              showToast(
                "Accelerated Construction! Earned +20 SC, +10 XP",
                "success",
              );
            });
          }
        }

        // 2. NPC dialogue trigger
        if (activeNpcDialog === null) {
          if (cityRef.current) {
            const playerPos = cityRef.current.player?.mesh.position;
            if (playerPos) {
              const npcs = cityRef.current.humans.filter((h) => !h.isPlayer);
              let closestNpc: HumanAgent | null = null;
              let minDist = Infinity;
              npcs.forEach((n) => {
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    standingCell,
    jobProgress,
    activeNpcDialog,
    shunyaCoins,
    level,
    xp,
    wood,
    unlockedPermits,
    completedAchievements,
    fidoQuestState,
    showFoodShop,
    showClothShop,
    showBarberShop,
    showPoliceStation,
  ]);

  const saveAdminSettings = async (updates: {
    timeOfDay?: number;
    timeSpeed?: number;
    isPlaying?: boolean;
  }) => {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("auth-unauthorized"));
      }
    } catch (err) {
      console.error("Failed to save admin settings:", err);
    }
  };

  // When spawned, show the controls HUD and start the 10-second fade timer
  useEffect(() => {
    if (hasSpawned) {
      setTimeout(() => setShowControls(true), 0);
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [hasSpawned]);

  // Synchronize Fido Quest state to ThreeCity
  useEffect(() => {
    if (cityRef.current) {
      cityRef.current.fidoQuestState = fidoQuestState;
    }
  }, [fidoQuestState]);

  // Establish WebSocket connection & do initial syncs
  useEffect(() => {
    // 1. Initial HTTP fetches for bootstrap
    const initialSync = async () => {
      try {
        const gridRes = await fetch("/api/grid");
        if (gridRes.ok && cityRef.current) {
          const gridData = await gridRes.json();
          if (gridData.cells) {
            cityRef.current.syncGrid(gridData.cells);
          }
        }
      } catch (err) {
        console.error("Failed to run initial grid sync:", err);
      }
    };
    initialSync();

    // 2. Open WebSocket connection
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      let wsUrl = "";
      const backendApiUrl = process.env.BACKEND_API_URL;
      if (backendApiUrl) {
        try {
          let urlStr = backendApiUrl;
          if (!/^https?:\/\//i.test(urlStr)) {
            urlStr = `${window.location.protocol}//${urlStr}`;
          }
          const url = new URL(urlStr);
          const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
          wsUrl = `${wsProto}//${url.host}/ws`;
        } catch (urlErr) {
          console.error(
            "Failed to parse BACKEND_API_URL as URL:",
            backendApiUrl,
            urlErr,
          );
          const isProd = process.env.NODE_ENV === "production";
          const wsProto =
            window.location.protocol === "https:" ? "wss:" : "ws:";
          wsUrl = isProd
            ? `${wsProto}//${window.location.host}/ws`
            : `ws://localhost:8005/ws`;
        }
      } else {
        const isProd = process.env.NODE_ENV === "production";
        const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = isProd
          ? `${wsProto}//${window.location.host}/ws`
          : `ws://localhost:8005/ws`;
      }

      console.log("Connecting to WebSocket:", wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connection established.");
        if (cityRef.current) {
          cityRef.current.ws = socket;
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!cityRef.current) return;

          switch (data.type) {
            case "init":
              // Load users
              const playerEmail = currentUser?.email || "";
              cityRef.current.loadAllDatabaseUsers(data.users, playerEmail);
              setOtherPlayers(
                data.users.filter((u: any) => u.email !== playerEmail),
              );

              // Load NPCs
              const isAdmin = currentUser?.role === "admin";
              cityRef.current.syncNpcs(data.npcs, isAdmin);

              // Extract party info
              const myDbUser = data.users.find((u: any) => u.email === playerEmail);
              if (myDbUser && myDbUser.groupId) {
                // To fetch party data, we request it via WS or REST. We'll do WS later.
              }

              // Load settings
              if (data.settings) {
                const {
                  timeOfDay: dbTime,
                  timeSpeed: dbSpeed,
                  isPlaying: dbPlaying,
                } = data.settings;
                const isDifferent =
                  Math.abs(cityRef.current.timeOfDay - dbTime) > 0.5 ||
                  isPlaying !== dbPlaying;
                if (!isAdmin || isDifferent) {
                  cityRef.current.timeOfDay = dbTime;
                  cityRef.current.timeSpeed = dbPlaying ? dbSpeed : 0.0;
                  setTimeOfDay(dbTime);
                  setTimeSpeed(dbSpeed);
                  setIsPlaying(dbPlaying);
                }
              }
              break;

            case "player-connected":
              const currentEmail = currentUser?.email || "";
              cityRef.current.addDatabaseUser(data.user, currentEmail);
              if (data.user.email !== currentEmail) {
                setOtherPlayers((prev) => [
                  ...prev.filter((p) => p._id !== data.user._id),
                  data.user,
                ]);
                showToast(
                  `${data.user.name} joined the simulation!`,
                  "success",
                );
              }
              break;

            case "player-moved":
              cityRef.current.updateOtherPlayerPosition(
                data.userId,
                data.x,
                data.z,
              );
              break;

            case "npcs-updated":
              const isUserAdmin = currentUser?.role === "admin";
              cityRef.current.syncNpcs(data.npcs, isUserAdmin);
              break;

            case "settings-updated":
              const userIsAdmin = currentUser?.role === "admin";
              const {
                timeOfDay: dbTime,
                timeSpeed: dbSpeed,
                isPlaying: dbPlaying,
              } = data.settings;
              const diff =
                Math.abs(cityRef.current.timeOfDay - dbTime) > 0.5 ||
                isPlaying !== dbPlaying;
              if (!userIsAdmin || diff) {
                cityRef.current.timeOfDay = dbTime;
                cityRef.current.timeSpeed = dbPlaying ? dbSpeed : 0.0;
                setTimeOfDay(dbTime);
                setTimeSpeed(dbSpeed);
                setIsPlaying(dbPlaying);
              }
              break;

            case "grid-updated":
              cityRef.current.syncGrid([data.cell]);
              break;

            case "player-disconnected":
              cityRef.current.removePlayerAvatar(data.userId);
              setOtherPlayers((prev) =>
                prev.filter((p) => p._id !== data.userId),
              );
              break;

            case "player-progressed":
              setOtherPlayers((prev) =>
                prev.map((p) =>
                  p._id === data.userId
                    ? {
                        ...p,
                        shunyaCoins: data.shunyaCoins,
                        level: data.level,
                        xp: data.xp,
                        wood: data.wood,
                        unlockedPermits: data.unlockedPermits,
                        completedAchievements: data.completedAchievements,
                      }
                    : p,
                ),
              );
              cityRef.current.updateOtherPlayerLevel(data.userId, data.level);
              break;

            case "admin-coins-updated":
              // Admin received revenue from a shop purchase
              if (currentUser?.role === "admin") {
                setShunyaCoins(data.shunyaCoins);
                showToast(
                  `💰 Shop revenue: +${data.amount} SC from ${data.fromUser}!`,
                  "success",
                );
              }
              break;

            case "party-updated":
              setParty(data.group);
              if (data.kicked) {
                showToast("You were kicked from the party.", "warning");
              }
              break;

            case "party-invite-received":
              setPartyInvites((prev) => [...prev, { fromUserId: data.fromUserId, fromUserName: data.fromUserName, groupId: data.groupId }]);
              showToast(`Party invite from ${data.fromUserName}!`, "info");
              break;

            case "player-party-changed":
              setOtherPlayers((prev) =>
                prev.map((p) =>
                  p._id === data.userId ? { ...p, groupId: data.groupId } : p
                )
              );
              break;

            default:
              break;
          }
        } catch (err) {
          console.error("Error handling WebSocket message:", err);
        }
      };

      socket.onclose = (e) => {
        console.log(
          "WebSocket closed. Attempting reconnect in 3s...",
          e.reason,
        );
        if (cityRef.current) {
          cityRef.current.ws = null;
        }
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = (err) => {
        console.error(
          `WebSocket error connecting to ${wsUrl} (BACKEND_API_URL: "${process.env.BACKEND_API_URL || ""}"):`,
          err,
        );
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
    citySim.fpsCap = settingsFpsCap;
    citySim.graphicsPreset = settingsGraphicsPreset;
    citySim.buildMode = "road";
    citySim.timeSpeed = 1 / 120; // 1 in-game day = 8 real hours (24 / (8*3600*0.1))
    citySim.audio.toggle(false);

    // Asynchronously load grid, park, models, trees, and NPCs
    const startLoad = async () => {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingText("Initializing terrain...");
      try {
        await citySim.loadCity((progress, text) => {
          setLoadingProgress(progress);
          setLoadingText(text);
        });
      } catch (err) {
        console.error("Failed to load city simulator:", err);
      } finally {
        setLoading(false);
      }
    };
    startLoad();

    // Verify session dynamically with /api/auth/me on page load
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            localStorage.setItem("shunyascape_user", JSON.stringify(data.user));
            setCurrentUser(data.user);
            setShunyaCoins(data.user.shunyaCoins || 100);
            setWood(data.user.wood || 0);
            setLevel(data.user.level || 1);
            setXp(data.user.xp || 0);
            setUnlockedPermits(data.user.unlockedPermits || []);
            setCompletedAchievements(data.user.completedAchievements || []);
            setHasSpawned(true);
            citySim.isAdmin = data.user.role === "admin";
            citySim.spawnPlayer(
              data.user.name,
              data.user.x,
              data.user.z,
              data.user.email,
              data.user.clothingColor,
              data.user.id,
              data.user.level || 1,
            );
            setSoundEnabled(true);
            citySim.audio.toggle(true);
            return;
          }
        }
      } catch (err) {
        console.error("Session restore failed:", err);
      }
      localStorage.removeItem("shunyascape_user");
    };
    checkSession();

    // Sync time of day from the animation loop to the state slider and check if player is stuck
    const timeSyncInterval = setInterval(() => {
      if (cityRef.current) {
        const tod = cityRef.current.timeOfDay;
        setTimeOfDay(tod);
        setIsStuck(cityRef.current.isPlayerInsideBlockedCell());

        // In-game day detection: when timeOfDay wraps from >20 back to <2 → new day
        if (tod < 2 && lastDayRef.current > 20) {
          drainHunger();
        }
        lastDayRef.current = tod;

        // ── Minimap render ─────────────────────────────────────────────────────
        const drawMinimap = (canvas: HTMLCanvasElement, size: number) => {
          const ctx = canvas.getContext("2d");
          if (!ctx || !cityRef.current) return;
          const city = cityRef.current;
          const isFullMap = size >= 300;
          const currentVersion = city.gridVersion;

          // Get or create offscreen cache canvas
          let cacheCanvas = isFullMap
            ? fullMapCacheRef.current
            : miniMapCacheRef.current;
          let lastVersion = isFullMap
            ? lastRenderedVersionRef.current.full
            : lastRenderedVersionRef.current.mini;

          if (!cacheCanvas) {
            cacheCanvas = document.createElement("canvas");
            cacheCanvas.width = size;
            cacheCanvas.height = size;
            if (isFullMap) {
              fullMapCacheRef.current = cacheCanvas;
            } else {
              miniMapCacheRef.current = cacheCanvas;
            }
            lastVersion = -1; // force draw
          }

          const cacheCtx = cacheCanvas.getContext("2d");
          if (
            cacheCtx &&
            (lastVersion === -1 || lastVersion !== currentVersion)
          ) {
            const gridSize = city.gridSize ?? 32;
            const cellPx = size / gridSize;

            cacheCtx.clearRect(0, 0, size, size);

            // Background — dark ground
            cacheCtx.fillStyle = "#111827";
            cacheCtx.fillRect(0, 0, size, size);

            // ── Draw grid cells ─────────────────────────────────────────────────
            const cellColorMap: Record<string, string> = {
              road: "#4b5563", // medium gray
              tree: "#166534", // dark green
              house: "#b45309", // amber
              skyscraper: "#4f46e5", // indigo
              restaurant: "#dc2626", // bright red
              clothshop: "#2563eb", // blue
              barbershop: "#7c3aed", // purple
              policestation: "#1d4ed8", // dark blue + brighter
              park: "#16a34a", // bright green
              river: "#1d4ed8", // blue
              mountain: "#6b7280", // gray
              construction: "#d97706", // orange
            };

            for (let x = 0; x < gridSize; x++) {
              for (let z = 0; z < gridSize; z++) {
                const cell = city.grid?.[x]?.[z];
                if (!cell || cell.type === "empty") continue;
                const color = cellColorMap[cell.type];
                if (!color) continue;
                cacheCtx.fillStyle = color;
                cacheCtx.fillRect(
                  Math.floor(x * cellPx),
                  Math.floor(z * cellPx),
                  Math.ceil(cellPx),
                  Math.ceil(cellPx),
                );
              }
            }

            // ── Shop POI dots (shown on both sizes) ─────────────────────────────
            const shopColors: Record<string, string> = {
              restaurant: "#fca5a5", // red glow
              clothshop: "#93c5fd", // blue glow
              barbershop: "#c4b5fd", // purple glow
              policestation: "#60a5fa", // blue glow
            };
            const shopEmojis: Record<string, string> = {
              restaurant: "🍔",
              clothshop: "👕",
              barbershop: "✂️",
              policestation: "🚔",
            };

            for (let x = 0; x < gridSize; x++) {
              for (let z = 0; z < gridSize; z++) {
                const cell = city.grid?.[x]?.[z];
                if (!cell) continue;
                const dotColor = shopColors[cell.type];
                if (!dotColor) continue;

                const cx = x * cellPx + cellPx / 2;
                const cz = z * cellPx + cellPx / 2;
                const r = Math.max(3.5, cellPx * 0.6);

                // Glow halo
                const grad = cacheCtx.createRadialGradient(
                  cx,
                  cz,
                  0,
                  cx,
                  cz,
                  r * 2,
                );
                grad.addColorStop(0, dotColor + "cc");
                grad.addColorStop(1, dotColor + "00");
                cacheCtx.beginPath();
                cacheCtx.arc(cx, cz, r * 2, 0, Math.PI * 2);
                cacheCtx.fillStyle = grad;
                cacheCtx.fill();

                // Solid dot
                cacheCtx.beginPath();
                cacheCtx.arc(cx, cz, r, 0, Math.PI * 2);
                cacheCtx.fillStyle = dotColor;
                cacheCtx.fill();

                // Emoji label (full map only)
                if (size >= 300) {
                  cacheCtx.font = `${Math.max(9, cellPx * 0.9)}px serif`;
                  cacheCtx.textAlign = "center";
                  cacheCtx.textBaseline = "middle";
                  cacheCtx.fillText(shopEmojis[cell.type], cx, cz);
                }
              }
            }

            // Update last rendered version
            if (isFullMap) {
              lastRenderedVersionRef.current.full = currentVersion;
            } else {
              lastRenderedVersionRef.current.mini = currentVersion;
            }
          }

          // Clear target canvas
          ctx.clearRect(0, 0, size, size);

          // Draw cached background
          ctx.drawImage(cacheCanvas, 0, 0);

          // ── Player direction arrow ──────────────────────────────────────────
          const player = city.player;
          if (player) {
            const gridSize = city.gridSize ?? 32;
            const cellPx = size / gridSize;
            const CELL_SIZE = 2.25; // must match ThreeCity.cellSize
            const halfGrid = (gridSize * CELL_SIZE) / 2;

            // Convert Three.js world coords → grid index → canvas px
            const worldX = player.mesh.position.x;
            const worldZ = player.mesh.position.z;
            const gx = (worldX + halfGrid) / CELL_SIZE;
            const gz = (worldZ + halfGrid) / CELL_SIZE;
            const cx = gx * cellPx;
            const cz = gz * cellPx;
            const angle = player.mesh.rotation.y;
            const r = Math.max(5, cellPx * 1.2);

            // Outer glow
            ctx.beginPath();
            ctx.arc(cx, cz, r * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(59,130,246,0.3)";
            ctx.fill();

            // Arrow triangle
            ctx.save();
            ctx.translate(cx, cz);
            ctx.rotate(-angle);
            ctx.beginPath();
            ctx.moveTo(0, -r * 1.5); // nose (forward)
            ctx.lineTo(r * 0.8, r); // right base
            ctx.lineTo(-r * 0.8, r); // left base
            ctx.closePath();
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        };

        if (minimapCanvasRef.current) {
          drawMinimap(minimapCanvasRef.current, 140);
        }
        if (minimapFullCanvasRef.current) {
          drawMinimap(minimapFullCanvasRef.current, 480);
        }
      }
    }, 150);

    // Global unauthorized event handler (used to force log out when single system login fails)
    const handleUnauthorized = () => {
      setAuthError(
        "You have been logged out because another system logged in or session expired.",
      );
      localStorage.removeItem("shunyascape_user");
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
          newCity.fpsCap = settingsFpsCap;
          newCity.graphicsPreset = settingsGraphicsPreset;
          newCity.buildMode = "road";
          newCity.timeSpeed = 1.0;
          newCity.audio.toggle(false);
          newCity.loadCity();
        }
      }
    };

    window.addEventListener("auth-unauthorized", handleUnauthorized);

    return () => {
      clearInterval(timeSyncInterval);
      window.removeEventListener("auth-unauthorized", handleUnauthorized);
      if (cityRef.current) {
        cityRef.current.destroy();
        cityRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync unlockedPermits with the simulation engine
  useEffect(() => {
    if (cityRef.current) {
      cityRef.current.unlockedPermits = unlockedPermits;
      cityRef.current.updateCameraControls();
    }
  }, [unlockedPermits]);

  // Sync selectedBuildScale with the simulation engine
  useEffect(() => {
    if (cityRef.current) {
      cityRef.current.selectedBuildScale = selectedBuildScale;
    }
  }, [selectedBuildScale]);

  // Sync shunyaCoins with the simulation engine
  useEffect(() => {
    if (cityRef.current) {
      cityRef.current.shunyaCoins = shunyaCoins;
    }
  }, [shunyaCoins]);

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
    if (mode === "delete" && currentUser?.role !== "admin") {
      showToast("Only administrators can demolish structures!", "warning");
      return;
    }
    if (
      mode !== null &&
      mode !== "delete" &&
      currentUser?.role !== "admin" &&
      !unlockedPermits.includes(mode)
    ) {
      showToast(
        `You need a ${mode.toUpperCase()} permit to construct this! Opening Permit Shop.`,
        "warning",
      );
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
  const baseCostMap: Record<string, number> = {
    road: 5,
    tree: 10,
    house: 50,
    skyscraper: 150,
    restaurant: 100,
    clothshop: 80,
    barbershop: 60,
    policestation: 120,
  };

  // Build menu items — all 8 placeable types shown in the popup
  const buildMenuItems = [
    { key: "road", emoji: "🛣️", label: "Road" },
    { key: "tree", emoji: "🌲", label: "Tree" },
    { key: "house", emoji: "🏠", label: "House" },
    { key: "skyscraper", emoji: "🏙️", label: "Skyscraper" },
    { key: "restaurant", emoji: "🍔", label: "Restaurant" },
    { key: "clothshop", emoji: "👕", label: "Cloth Shop" },
    { key: "barbershop", emoji: "✂️", label: "Barber" },
    { key: "policestation", emoji: "🚔", label: "Police Stn" },
  ] as const;

  const formatTime = (time: number) => {
    const hours24 = Math.floor(time);
    const minutes = Math.floor((time - hours24) * 60);
    const ampm = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const padMin = minutes.toString().padStart(2, "0");
    const padHr = hours12.toString().padStart(2, "0");
    return `${padHr}:${padMin} ${ampm}`;
  };

  // Determine current day-night phase string for UI background tints
  const getSkyPhaseColor = () => {
    if (timeOfDay >= 18.0 && timeOfDay < 20.0)
      return "from-orange-500/20 to-purple-900/20"; // Sunset
    if (timeOfDay >= 20.0 || timeOfDay < 4.0)
      return "from-indigo-950/40 to-slate-900/40"; // Night
    if (timeOfDay >= 4.0 && timeOfDay < 6.0)
      return "from-purple-900/20 to-orange-500/20"; // Sunrise
    return "from-sky-400/10 to-blue-500/10"; // Day
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* 3D Canvas Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-0"
        style={{ touchAction: "none" }}
      />

      {/* Ambient sky overlay color mask for premium cinematic overlay */}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-1000 bg-gradient-to-t ${getSkyPhaseColor()} z-5`}
      />

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
                  onClick={() => setShowAchievements((prev) => !prev)}
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
                <span className="text-slate-400 text-[10px]">
                  {xp} / {level * 100} XP
                </span>
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
                <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center font-black text-[9px] text-slate-950 animate-bounce">
                  S
                </div>
                <span className="text-xs font-bold text-amber-400">
                  {shunyaCoins} SC
                </span>
              </div>

              {/* Wood */}
              <div className="px-3 py-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 rounded-xl flex items-center gap-2 shadow-lg">
                <div className="w-4 h-4 rounded-sm bg-amber-700 flex items-center justify-center text-[9px] text-white">
                  W
                </div>
                <span className="text-xs font-bold text-orange-400">
                  {wood} Wood
                </span>
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
                  ? `#${currentUser.clothingColor.toString(16).padStart(6, "0")}`
                  : "#ef4444",
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
          {currentUser?.role === "admin" ? (
            <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 w-64 text-left">
              {/* Clock & Sun icon */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {timeOfDay >= 6 && timeOfDay < 18 ? (
                    <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
                  ) : (
                    <Moon className="w-5 h-5 text-indigo-400" />
                  )}
                  <span className="text-sm font-bold">
                    {formatTime(timeOfDay)}
                  </span>
                </div>

                {/* Play / Pause time */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleTogglePlay}
                    className={`p-1.5 rounded-lg border transition-all ${
                      isPlaying
                        ? "bg-sky-500/20 border-sky-400/40 text-sky-300 hover:bg-sky-500/30"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                    title={isPlaying ? "Pause Cycle" : "Play Cycle"}
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={handleToggleSound}
                    className={`p-1.5 rounded-lg border transition-all ${
                      soundEnabled
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                        : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400"
                    }`}
                    title={soundEnabled ? "Mute Sounds" : "Unmute Sounds"}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
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
                  <span>
                    {isPlaying
                      ? `${(8 / (timeSpeed * 120)).toFixed(1)}h/day`
                      : "Paused"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.00417"
                  max="0.0833"
                  step="0.00417"
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
                <span className="text-xs font-bold">
                  {formatTime(timeOfDay)}
                </span>
              </div>
              <button
                onClick={handleToggleSound}
                className={`p-1.5 rounded-lg border transition-all ${
                  soundEnabled
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                    : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400"
                }`}
                title={soundEnabled ? "Mute Sounds" : "Unmute Sounds"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Interface: Tool Drawer & Quick Instructions */}
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 flex flex-col items-center gap-4 pointer-events-none z-10">
        {/* Construction Tool Selector Drawer */}
        {hasSpawned && (
          <div className="relative bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-2xl p-2.5 flex items-center gap-2 pointer-events-auto">
            {/* Inspect / View Mode */}
            <button
              onClick={() => {
                handleModeClick(null);
                setShowBuildMenu(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                buildMode === null
                  ? "bg-sky-500 text-white border-sky-400 shadow-lg shadow-sky-500/20"
                  : "bg-slate-800/50 border-slate-700/30 hover:bg-slate-800 hover:border-slate-700 text-slate-300"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Inspect</span>
            </button>

            {/* ── BUILD BUTTON ── */}
            <button
              onClick={() => setShowBuildMenu((prev) => !prev)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold border transition-all relative ${
                buildMode !== null && buildMode !== "delete"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-500/25"
                  : "bg-slate-800/60 border-slate-700/40 hover:bg-slate-700/60 hover:border-slate-600 text-slate-200"
              }`}
            >
              <Hammer className="w-4 h-4" />
              <span>
                {buildMode && buildMode !== "delete"
                  ? (buildMenuItems.find((i) => i.key === buildMode)?.label ??
                    "Build")
                  : "Build"}
              </span>
              <span
                className={`transition-transform duration-200 text-[10px] ${showBuildMenu ? "rotate-180" : ""}`}
              >
                ▲
              </span>
              {buildMode !== null && buildMode !== "delete" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-900" />
              )}
            </button>

            {/* Admin-only demolish button */}
            {currentUser?.role === "admin" && (
              <button
                onClick={() => {
                  handleModeClick("delete");
                  setShowBuildMenu(false);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  buildMode === "delete"
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20"
                    : "bg-slate-800/50 border-slate-700/30 hover:bg-red-950/30 hover:border-red-800/50 hover:text-red-400 text-slate-300"
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Demolish</span>
              </button>
            )}

            {/* Area Size Selector (Visible only when placing a buildable item) */}
            {buildMode !== null && buildMode !== "delete" && (
              <div className="flex items-center gap-1.5 bg-slate-950/40 border border-slate-800/80 rounded-xl px-2.5 py-1.5">
                <span className="text-[10px] font-black text-slate-400 mr-1 tracking-wider uppercase">
                  Area:
                </span>
                {[
                  { label: "Small (0.5x)", value: 0.5, short: "S" },
                  { label: "Medium (1.0x)", value: 1.0, short: "M" },
                  { label: "Large (1.5x)", value: 1.5, short: "L" },
                  { label: "Huge (2.0x)", value: 2.0, short: "XL" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedBuildScale(opt.value)}
                    title={opt.label}
                    className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
                      selectedBuildScale === opt.value
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 scale-105"
                        : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
            )}

            {/* ── BUILD POPUP MENU ── floats above the toolbar ── */}
            {showBuildMenu && (
              <div
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-2xl p-4 w-80">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-200 uppercase tracking-widest">
                      What do you want to build?
                    </span>
                    <button
                      onClick={() => setShowBuildMenu(false)}
                      className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Grid of buildable items */}
                  <div className="grid grid-cols-4 gap-2">
                    {buildMenuItems.map((item) => {
                      const owned =
                        currentUser?.role === "admin" ||
                        unlockedPermits.includes(item.key);
                      const active = buildMode === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            handleModeClick(item.key as BuildType);
                            setShowBuildMenu(false);
                          }}
                          title={item.label + (owned ? "" : " (Need Permit)")}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all cursor-pointer active:scale-95 relative ${
                            active
                              ? "bg-cyan-500/20 border-cyan-400/60 shadow-md shadow-cyan-500/10"
                              : owned
                                ? "bg-slate-800/60 border-slate-700/40 hover:bg-slate-700/60 hover:border-slate-500/60"
                                : "bg-slate-900/40 border-slate-800/40 opacity-60 hover:opacity-80"
                          }`}
                        >
                          <span className="text-xl leading-none">
                            {item.emoji}
                          </span>
                          <span
                            className={`text-[9px] font-bold leading-tight ${
                              active
                                ? "text-cyan-300"
                                : owned
                                  ? "text-slate-300"
                                  : "text-slate-500"
                            }`}
                          >
                            {item.label}
                          </span>
                          {!owned && (
                            <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-black px-0.5 py-0 rounded-full font-black leading-tight">
                              🔒
                            </span>
                          )}
                          {active && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Current mode label */}
                  {buildMode && buildMode !== "delete" && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60 text-center text-[10px] text-slate-400">
                      Active:{" "}
                      <span className="text-cyan-300 font-bold">
                        {buildMenuItems.find((i) => i.key === buildMode)?.emoji}{" "}
                        {buildMenuItems.find((i) => i.key === buildMode)?.label}
                      </span>
                      <span className="ml-1 text-amber-400 font-extrabold">
                        (
                        {Math.round(
                          (baseCostMap[buildMode] || 0) * selectedBuildScale,
                        )}{" "}
                        SC)
                      </span>
                      <span className="ml-1.5 text-slate-500">
                        — click map to place
                      </span>
                    </div>
                  )}
                </div>
                {/* Arrow pointer */}
                <div className="flex justify-center">
                  <div className="w-3 h-3 bg-slate-900/95 border-r border-b border-slate-700/60 rotate-45 -mt-1.5" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invisible backdrop to close build menu on outside click */}
      {showBuildMenu && (
        <div
          className="fixed inset-0 z-[25] pointer-events-auto"
          onClick={() => setShowBuildMenu(false)}
        />
      )}

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
                Sign in or register to persist your avatar in the persistent
                simulation.
              </p>
            </div>

            {/* Mode Switch Tabs */}
            {authMode !== "reset" ? (
              <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setResetSuccessMsg("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    authMode === "login"
                      ? "bg-sky-500 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                    setResetSuccessMsg("");
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    authMode === "register"
                      ? "bg-sky-500 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Register
                </button>
              </div>
            ) : (
              <div className="text-center bg-slate-950/40 py-2.5 px-3 rounded-2xl border border-slate-800/40">
                <h3 className="text-xs font-bold text-slate-200">
                  Reset Your Password
                </h3>
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
              {authMode === "register" && (
                <div className="flex flex-col gap-1 text-left">
                  <label
                    htmlFor="authName"
                    className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1"
                  >
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
                <label
                  htmlFor="authEmail"
                  className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1"
                >
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
                <label
                  htmlFor="authPass"
                  className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1"
                >
                  {authMode === "reset" ? "New Password" : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="authPass"
                    type={showPassword ? "text" : "password"}
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

            {authMode === "login" && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("reset");
                    setAuthError("");
                    setResetSuccessMsg("");
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {authMode === "reset" && (
              <div className="text-center -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setResetSuccessMsg("");
                  }}
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
                ? "Connecting to Server..."
                : authMode === "register"
                  ? "Register & Spawn"
                  : authMode === "reset"
                    ? "Reset Password"
                    : "Log In & Spawn"}
            </button>

            {/* Quick overview of controls */}
            <div className="border-t border-slate-800/60 pt-3 flex flex-col gap-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Shortcut Controls
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-450 text-left px-2 max-w-sm mx-auto">
                <div>
                  WASD: <span className="text-slate-350 font-medium">Move</span>
                </div>
                <div>
                  Space:{" "}
                  <span className="text-slate-350 font-medium">Jump</span>
                </div>
                <div>
                  U key:{" "}
                  <span className="text-slate-350 font-medium">Punch</span>
                </div>
                <div>
                  I key:{" "}
                  <span className="text-slate-350 font-medium">Kick</span>
                </div>
                <div className="col-span-2 text-center mt-0.5">
                  J key:{" "}
                  <span className="text-slate-350 font-medium">
                    Sit / Stand Toggle
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* City Live Statistics List in bottom left */}
      {hasSpawned && currentUser?.role === "admin" && (
        <div
          className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-30 flex flex-col items-start gap-2 pointer-events-auto"
          style={statsDrag.style}
        >
          <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-3.5 flex flex-col gap-2 w-44">
            <h4
              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-0.5 select-none cursor-grab active:cursor-grabbing w-full"
              onMouseDown={statsDrag.handleMouseDown}
              onTouchStart={statsDrag.handleTouchStart}
            >
              City Statistics
            </h4>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Population</span>
                </div>
                <span className="font-semibold text-slate-100">
                  {stats.population}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <TreePine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Forestry</span>
                </div>
                <span className="font-semibold text-slate-100">
                  {stats.trees}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 text-slate-400 font-bold border border-slate-500 rounded-sm text-[7px] flex items-center justify-center">
                    R
                  </div>
                  <span>Roads</span>
                </div>
                <span className="font-semibold text-slate-100">
                  {stats.roads}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>Houses</span>
                </div>
                <span className="font-semibold text-slate-100">
                  {stats.houses}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Towers</span>
                </div>
                <span className="font-semibold text-slate-100">
                  {stats.skyscrapers}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <Hammer className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                  <span>Building</span>
                </div>
                <span className="font-semibold text-yellow-400">
                  {stats.activeConstruction}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAGGABLE 3D CAMERA CONTROLLER (Middle Left) ────────────────────────── */}
      {hasSpawned && (
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 z-35 flex flex-col items-center gap-2 pointer-events-auto"
          style={cameraHudDrag.style}
        >
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 shadow-2xl rounded-2xl p-3 flex flex-col items-center gap-3 w-32">
            <h4
              className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 select-none cursor-grab active:cursor-grabbing w-full text-center flex items-center justify-center gap-1"
              onMouseDown={cameraHudDrag.handleMouseDown}
              onTouchStart={cameraHudDrag.handleTouchStart}
            >
              ✥ Camera
            </h4>

            {/* Circular Orbit Joystick Pad */}
            <div
              className="relative w-16 h-16 rounded-full border border-slate-700/60 bg-slate-950/60 flex items-center justify-center cursor-grab active:cursor-grabbing hover:border-cyan-500/50 transition-colors select-none"
              onMouseDown={handleJoystickStart}
              onTouchStart={handleJoystickStart}
              title="Drag in any direction to rotate 3D view"
            >
              {/* Compass ticks decoration */}
              <div className="absolute w-full h-px bg-slate-800/40 pointer-events-none" />
              <div className="absolute w-px h-full bg-slate-800/40 pointer-events-none" />
              <div className="absolute w-12 h-12 rounded-full border border-dashed border-slate-800/40 pointer-events-none" />

              {/* Floating metallic joystick knob */}
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20 border border-cyan-300/30 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`,
                  transition: joystickActive
                    ? "none"
                    : "transform 0.15s ease-out",
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white/25 border border-white/10" />
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex gap-2 w-full">
              <button
                onClick={() => cityRef.current?.zoomCamera(true)}
                className="flex-1 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-white border border-slate-700/50 flex items-center justify-center transition-all cursor-pointer shadow active:scale-95"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => cityRef.current?.zoomCamera(false)}
                className="flex-1 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-white border border-slate-700/50 flex items-center justify-center transition-all cursor-pointer shadow active:scale-95"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Reset view button */}
            <button
              onClick={() => cityRef.current?.resetCamera()}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/50 text-slate-355 hover:text-white font-bold rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer active:scale-95 hover:border-cyan-500/30"
              title="Reset to default camera angle"
            >
              Reset View
            </button>
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
                ? "opacity-100 scale-100 translate-y-0 w-64"
                : "opacity-0 scale-90 translate-y-4 pointer-events-none w-0 h-0 p-0 border-none overflow-hidden"
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
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  Arrows
                </kbd>
                <span>Move</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  WASD
                </kbd>
                <span>Orbit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  Q / E
                </kbd>
                <span>Zoom</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  R key
                </kbd>
                <span>Interact</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  Space
                </kbd>
                <span>Jump</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  U / I
                </kbd>
                <span>Punch/Kick</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 mt-0.5">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-sky-400 font-semibold font-mono text-[9px] shadow">
                  J key
                </kbd>
                <span>Sit / Stand Toggle</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Scale Badge */}
            <div className="h-10 px-3 bg-slate-900/90 backdrop-blur-xl border border-slate-750/80 shadow-2xl rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-300 hover:border-sky-500/30 transition-all duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zoom:</span>
              <span className="text-sky-400 font-bold font-mono">{zoomScale.toFixed(2)}x</span>
            </div>

            {/* Trigger Info "i" Button */}
            <button
              type="button"
              onClick={() => setShowControls(!showControls)}
              className={`w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-850 backdrop-blur-xl border border-slate-750/80 shadow-2xl flex items-center justify-center text-sky-400 hover:text-sky-300 transition-all duration-300 transform active:scale-95 ${
                !showControls ? "opacity-100 scale-100" : "opacity-80 scale-90"
              }`}
              title="Show Controls Info"
            >
              <span className="font-serif text-lg font-black italic">i</span>
            </button>
          </div>
        </div>
      )}

      {/* Developer Details Modal */}
      {showDeveloperPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 pointer-events-auto">
          <div
            className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative"
            style={developerDrag.style}
          >
            <button
              onClick={() => setShowDeveloperPopup(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors z-10"
            >
              ✕
            </button>
            <div
              className="flex flex-col items-center gap-2 select-none cursor-grab active:cursor-grabbing w-full"
              onMouseDown={developerDrag.handleMouseDown}
              onTouchStart={developerDrag.handleTouchStart}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 pointer-events-none">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent pointer-events-none">
                ShunyaScape 3D
              </h2>
              <p className="text-xs text-slate-400 font-medium pointer-events-none">
                Interactive Agentic Simulation
              </p>
            </div>

            <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3 text-left">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Developer
                </span>
                <span className="text-sm font-semibold text-slate-200">
                  Vijay Kumar
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  GitHub ID
                </span>
                <a
                  href="https://github.com/be1enewinner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-cyan-400 hover:underline flex items-center gap-1.5"
                >
                  be1enewinner
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-200">
                    View profile
                  </span>
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

      {/* ──────────────────── Settings / Profile Modal ──────────────────── */}
      {showProfilePopup && currentUser && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 pointer-events-auto">
          <div
            className="w-full max-w-lg bg-slate-900/95 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl flex flex-col overflow-hidden relative"
            style={{ maxHeight: "90vh", ...profileDrag.style }}
          >
            {/* ── Draggable Header ── */}
            <div
              className="flex items-center gap-4 px-5 pt-5 pb-4 border-b border-slate-800/70 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={profileDrag.handleMouseDown}
              onTouchStart={profileDrag.handleTouchStart}
            >
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white uppercase shadow-lg flex-shrink-0 pointer-events-none"
                style={{
                  backgroundColor: currentUser.clothingColor
                    ? `#${currentUser.clothingColor.toString(16).padStart(6, "0")}`
                    : "#6366f1",
                }}
              >
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex flex-col flex-1 min-w-0 pointer-events-none">
                <span className="text-base font-bold text-slate-100 truncate">
                  {currentUser.name}
                </span>
                <span className="text-[11px] text-slate-400">
                  {currentUser.email}
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-400/25 font-bold uppercase tracking-wider w-fit mt-0.5">
                  {currentUser.role} · Lv {level}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowProfilePopup(false);
                  setSettingsSaveMsg("");
                }}
                className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 pointer-events-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Tab Bar ── */}
            <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-800/60">
              {(
                [
                  { key: "profile", label: "Profile", icon: "👤" },
                  { key: "controls", label: "Controls", icon: "🎮" },
                  { key: "fps", label: "Graphics", icon: "⚡" },
                  { key: "achievements", label: "Achievements", icon: "🏆" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSettingsTab(tab.key);
                    setSettingsSaveMsg("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all duration-200 border-b-2 -mb-px ${
                    settingsTab === tab.key
                      ? "text-indigo-400 border-indigo-400 bg-indigo-500/10"
                      : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/40"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:block">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
              {/* ─── PROFILE TAB ─── */}
              {settingsTab === "profile" && (
                <>
                  {/* Display Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder={currentUser.name}
                      value={settingsEditName}
                      onChange={(e) => setSettingsEditName(e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Gender */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Gender
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          { val: "male", icon: "♂️", label: "Male" },
                          { val: "female", icon: "♀️", label: "Female" },
                          { val: "other", icon: "⚧️", label: "Other" },
                          { val: "skip", icon: "—", label: "Skip" },
                        ] as const
                      ).map((g) => (
                        <button
                          key={g.val}
                          onClick={() => setSettingsGender(g.val)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold transition-all duration-200 ${
                            settingsGender === g.val
                              ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-300"
                              : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                          }`}
                        >
                          <span className="text-base">{g.icon}</span>
                          <span>{g.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={settingsDob}
                      onChange={(e) => setSettingsDob(e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  {/* Save Profile */}
                  <button
                    disabled={settingsSaving}
                    onClick={async () => {
                      setSettingsSaving(true);
                      setSettingsSaveMsg("");
                      try {
                        const res = await fetch("/api/auth/profile", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: settingsEditName || undefined,
                            gender: settingsGender,
                            dob: settingsDob || undefined,
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setSettingsSaveMsg("✅ Profile saved!");
                          if (
                            settingsEditName &&
                            settingsEditName !== currentUser.name
                          ) {
                            setCurrentUser((u: any) => ({
                              ...u,
                              name: settingsEditName,
                            }));
                            const stored =
                              localStorage.getItem("shunyascape_user");
                            if (stored) {
                              try {
                                const parsed = JSON.parse(stored);
                                parsed.name = settingsEditName;
                                localStorage.setItem(
                                  "shunyascape_user",
                                  JSON.stringify(parsed),
                                );
                              } catch {}
                            }
                          }
                        } else {
                          setSettingsSaveMsg(
                            `❌ ${data.error || "Save failed"}`,
                          );
                        }
                      } catch {
                        setSettingsSaveMsg("❌ Network error");
                      }
                      setSettingsSaving(false);
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/30"
                  >
                    {settingsSaving ? "Saving…" : "Save Profile"}
                  </button>

                  {/* Divider */}
                  <div className="border-t border-slate-800/70 my-1" />

                  {/* Reset Password */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Change Password
                    </label>
                    <input
                      type="password"
                      placeholder="New password"
                      value={settingsNewPassword}
                      onChange={(e) => setSettingsNewPassword(e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={settingsConfirmPassword}
                      onChange={(e) =>
                        setSettingsConfirmPassword(e.target.value)
                      }
                      className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                    <button
                      disabled={
                        settingsSaving ||
                        !settingsNewPassword ||
                        settingsNewPassword !== settingsConfirmPassword
                      }
                      onClick={async () => {
                        if (settingsNewPassword !== settingsConfirmPassword) {
                          setSettingsSaveMsg("❌ Passwords do not match");
                          return;
                        }
                        setSettingsSaving(true);
                        setSettingsSaveMsg("");
                        try {
                          const res = await fetch("/api/auth/reset", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: currentUser.email,
                              password: settingsNewPassword,
                            }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setSettingsSaveMsg(
                              "✅ Password changed! Please log in again.",
                            );
                            setSettingsNewPassword("");
                            setSettingsConfirmPassword("");
                          } else {
                            setSettingsSaveMsg(`❌ ${data.error || "Failed"}`);
                          }
                        } catch {
                          setSettingsSaveMsg("❌ Network error");
                        }
                        setSettingsSaving(false);
                      }}
                      className="w-full py-2.5 bg-rose-900/50 hover:bg-rose-800/60 disabled:opacity-40 text-rose-300 border border-rose-800/40 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
                    >
                      {settingsSaving ? "Changing…" : "Change Password"}
                    </button>
                  </div>

                  {settingsSaveMsg && (
                    <p
                      className={`text-[11px] font-semibold text-center ${settingsSaveMsg.startsWith("✅") ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      {settingsSaveMsg}
                    </p>
                  )}

                  {/* Admin Shortcut */}
                  {currentUser.role === "admin" && (
                    <a
                      href="/admin"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                    >
                      🛡 Open Admin Control Center
                    </a>
                  )}
                </>
              )}

              {/* ─── CONTROLS TAB ─── */}
              {settingsTab === "controls" && (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Movement
                    </p>
                    {[
                      { key: "↑", action: "Move Forward" },
                      { key: "↓", action: "Move Backward" },
                      { key: "←", action: "Move Left" },
                      { key: "→", action: "Move Right" },
                      { key: "Space", action: "Jump" },
                      { key: "Shift", action: "Sprint (hold)" },
                    ].map((b) => (
                      <div
                        key={b.key}
                        className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2 border border-slate-800/60"
                      >
                        <span className="text-[11px] text-slate-300">
                          {b.action}
                        </span>
                        <kbd className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-lg shadow">
                          {b.key}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                      Camera
                    </p>
                    {[
                      { key: "W / S", action: "Tilt Camera Up / Down" },
                      { key: "A / D", action: "Rotate Camera Left / Right" },
                      { key: "Q / E", action: "Zoom In / Out" },
                      { key: "Mouse Drag", action: "Rotate Camera" },
                      { key: "Scroll", action: "Zoom In / Out" },
                      { key: "Middle Click", action: "Reset Camera" },
                    ].map((b) => (
                      <div
                        key={b.key}
                        className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2 border border-slate-800/60"
                      >
                        <span className="text-[11px] text-slate-300">
                          {b.action}
                        </span>
                        <kbd className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-lg shadow">
                          {b.key}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                      Interactions
                    </p>
                    {[
                      { key: "R", action: "Interact / Enter Building / Talk" },
                      { key: "F", action: "Plant Tree / Pick Item" },
                      { key: "B", action: "Open Build Menu" },
                      { key: "M", action: "Open Full Map" },
                      { key: "Esc", action: "Close Popup / Cancel" },
                      { key: "Tab", action: "Toggle Leaderboard" },
                    ].map((b) => (
                      <div
                        key={b.key}
                        className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2 border border-slate-800/60"
                      >
                        <span className="text-[11px] text-slate-300">
                          {b.action}
                        </span>
                        <kbd className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-lg shadow">
                          {b.key}
                        </kbd>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 p-3 rounded-2xl bg-indigo-950/30 border border-indigo-800/30 text-[10px] text-indigo-300 leading-relaxed">
                    💡 <strong>Tip:</strong> Hold{" "}
                    <kbd className="bg-slate-900/80 border border-slate-700 px-1 py-0.5 rounded text-[9px]">
                      Shift
                    </kbd>{" "}
                    while moving for a faster sprint. Use mouse scroll to zoom
                    in for more precision.
                  </div>
                </>
              )}

              {/* ─── GRAPHICS / FPS TAB ─── */}
              {settingsTab === "fps" && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      FPS Cap
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[30, 45, 60, 90, 120].map((fps) => (
                        <button
                          key={fps}
                          onClick={() => {
                            setSettingsFpsCap(fps);
                            if (cityRef.current) {
                              cityRef.current.fpsCap = fps;
                            }
                          }}
                          className={`py-2.5 rounded-xl border text-sm font-bold transition-all duration-200 cursor-pointer ${
                            settingsFpsCap === fps
                              ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-300 shadow-lg shadow-indigo-900/20"
                              : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                          }`}
                        >
                          {fps}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Current target:{" "}
                      <span className="text-indigo-400 font-bold">
                        {settingsFpsCap} FPS
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 mt-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Rendering Preset
                    </label>
                    {(
                      [
                        {
                          id: "low",
                          label: "Low",
                          desc: "Lambert materials, no shadows. Best for CPU-only.",
                          icon: "🔋",
                        },
                        {
                          id: "medium",
                          label: "Medium",
                          desc: "Lambert + soft shadows. Good for integrated GPUs.",
                          icon: "⚖️",
                        },
                        {
                          id: "high",
                          label: "High",
                          desc: "Full shadows and fog. Requires dedicated GPU.",
                          icon: "🚀",
                        },
                      ] as const
                    ).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSettingsGraphicsPreset(preset.id);
                          if (cityRef.current) {
                            cityRef.current.setGraphicsPreset(preset.id);
                          }
                        }}
                        className={`flex items-start text-left gap-3 p-3 rounded-2xl border transition-all duration-200 w-full cursor-pointer ${
                          settingsGraphicsPreset === preset.id
                            ? "bg-indigo-500/10 border-indigo-400/60 shadow-lg shadow-indigo-900/10 text-slate-200"
                            : "bg-slate-800/30 border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        <span className="text-xl mt-0.5">{preset.icon}</span>
                        <div>
                          <p className={`text-xs font-bold ${settingsGraphicsPreset === preset.id ? "text-indigo-300" : "text-slate-300"}`}>
                            {preset.label}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-snug">
                            {preset.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                    <p className="text-[10px] text-slate-500 italic">
                      Select a rendering preset. &apos;Low&apos; is recommended for machines without a dedicated GPU.
                    </p>
                  </div>
                </>
              )}

              {/* ─── ACHIEVEMENTS TAB ─── */}
              {settingsTab === "achievements" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Your Achievements
                    </p>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {completedAchievements.length} / 7 unlocked
                    </span>
                  </div>
                  {/* XP Bar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Level {level}</span>
                      <span>
                        {xp} / {level * 100} XP
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.floor((xp / (level * 100)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {[
                    {
                      id: "first_steps",
                      title: "First Steps",
                      desc: "Walk 150 units",
                      icon: "👣",
                      current: Math.floor(distanceWalked),
                      target: 150,
                    },
                    {
                      id: "wealthy_citizen",
                      title: "Wealthy Citizen",
                      desc: "Accumulate 500 ShunyaCoins",
                      icon: "💰",
                      current: shunyaCoins,
                      target: 500,
                    },
                    {
                      id: "green_guard",
                      title: "Green Guard",
                      desc: "Plant 5 trees",
                      icon: "🌳",
                      current: treesPlantedCount,
                      target: 5,
                    },
                    {
                      id: "npc_helper",
                      title: "NPC Helper",
                      desc: "Complete Lost Dog quest",
                      icon: "🐕",
                      current: fidoQuestState === "completed" ? 1 : 0,
                      target: 1,
                    },
                    {
                      id: "high_flyer",
                      title: "High Flyer",
                      desc: "Perform 30 jumps",
                      icon: "🏃",
                      current: jumpsCount,
                      target: 30,
                    },
                    {
                      id: "skyscraper_climber",
                      title: "Sky Climber",
                      desc: "Climb a skyscraper roof",
                      icon: "🏙️",
                      current: completedAchievements.includes(
                        "skyscraper_climber",
                      )
                        ? 1
                        : 0,
                      target: 1,
                    },
                    {
                      id: "dev_extraordinaire",
                      title: "City Builder",
                      desc: "Build 10 structures",
                      icon: "🏗️",
                      current: buildsCount,
                      target: 10,
                    },
                  ].map((ach) => {
                    const completed = completedAchievements.includes(ach.id);
                    const pct = Math.min(
                      100,
                      Math.floor((ach.current / ach.target) * 100),
                    );
                    return (
                      <div
                        key={ach.id}
                        className={`flex flex-col gap-1.5 p-3 rounded-2xl border transition-all duration-300 ${
                          completed
                            ? "bg-emerald-950/20 border-emerald-500/25"
                            : "bg-slate-900/30 border-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{ach.icon}</span>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span
                              className={`text-[11px] font-bold ${completed ? "text-emerald-400" : "text-slate-200"}`}
                            >
                              {ach.title}
                            </span>
                            <span className="text-[9px] text-slate-400 truncate">
                              {ach.desc}
                            </span>
                          </div>
                          {completed ? (
                            <span className="text-emerald-400 text-base">
                              ✅
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                              {ach.current}/{ach.target}
                            </span>
                          )}
                        </div>
                        {!completed && (
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-300 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer: Logout + Close ── */}
            <div className="flex gap-3 px-5 py-4 border-t border-slate-800/70">
              <button
                onClick={() => {
                  fetch("/api/auth/logout", { method: "POST" }).catch((err) =>
                    console.error(err),
                  );
                  localStorage.removeItem("shunyascape_user");
                  setCurrentUser(null);
                  setHasSpawned(false);
                  setShowProfilePopup(false);
                  if (cityRef.current) {
                    cityRef.current.destroy();
                    if (containerRef.current) {
                      const newCity = new ThreeCity(
                        containerRef.current,
                        (newStats) => {
                          setStats({ ...newStats });
                        },
                      );
                      cityRef.current = newCity;
                      newCity.fpsCap = settingsFpsCap;
                      newCity.graphicsPreset = settingsGraphicsPreset;
                      newCity.buildMode = "road";
                      newCity.timeSpeed = 1 / 120;
                      newCity.audio.toggle(false);
                      newCity.loadCity();
                    }
                  }
                }}
                className="flex-1 py-2.5 bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/30 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
              >
                🚪 Log Out
              </button>
              <button
                onClick={() => {
                  setShowProfilePopup(false);
                  setSettingsSaveMsg("");
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
              >
                Close
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
            <span className="text-[10px] uppercase tracking-wider text-center">
              Exit Box
            </span>
          </button>
        </div>
      )}

      {/* Quest Tracker Sidebar (Floating Right) */}
      {hasSpawned && (
        <div
          className="absolute right-4 top-48 md:right-6 z-25 flex flex-col items-end gap-3 pointer-events-auto"
          style={questsDrag.style}
        >
          <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 w-64 flex flex-col gap-3 text-left">
            <div
              className="flex items-center gap-2 border-b border-slate-800 pb-2 select-none cursor-grab active:cursor-grabbing w-full"
              onMouseDown={questsDrag.handleMouseDown}
              onTouchStart={questsDrag.handleTouchStart}
            >
              <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow pointer-events-none" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider pointer-events-none">
                Active Quests
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {/* Quest 1: Lost Dog */}
              <div className="flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-amber-400 text-left">🐶 Find Fido</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      fidoQuestState === "completed"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/30"
                        : fidoQuestState === "fido_found"
                          ? "bg-indigo-950 text-indigo-400 border border-indigo-800/30 animate-pulse"
                          : fidoQuestState === "active"
                            ? "bg-sky-950 text-sky-400 border border-sky-800/30"
                            : "bg-slate-950 text-slate-500"
                    }`}
                  >
                    {fidoQuestState === "completed"
                      ? "Completed"
                      : fidoQuestState === "fido_found"
                        ? "Fido Found"
                        : fidoQuestState === "active"
                          ? "Active"
                          : "Talk to Owner"}
                  </span>
                </div>
                <p className="text-slate-400 leading-normal text-left">
                  {fidoQuestState === "completed" &&
                    "Returned Fido safely! Quest complete."}
                  {fidoQuestState === "fido_found" &&
                    "Return Fido to the owner citizen."}
                  {fidoQuestState === "active" &&
                    "Find the brown voxel dog around the outskirts."}
                  {fidoQuestState === "not_started" &&
                    "Walk up to a citizen NPC and press R to check for quests."}
                </p>
              </div>

              {/* Quest 2: Arborist */}
              <div className="flex flex-col gap-1 text-[11px] border-t border-slate-850 pt-2.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-emerald-400 text-left">
                    🌲 Green Forestry
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      treesPlantedCount >= 3
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/30"
                        : "bg-sky-950 text-sky-400 border border-sky-800/30"
                    }`}
                  >
                    {treesPlantedCount >= 3
                      ? "Completed"
                      : `${treesPlantedCount}/3 Planted`}
                  </span>
                </div>
                <p className="text-slate-400 leading-normal text-left">
                  Plant at least 3 trees in the grid using the arborist permit.
                </p>
              </div>

              {/* Quest 3: Skyscraper Climber */}
              <div className="flex flex-col gap-1 text-[11px] border-t border-slate-850 pt-2.5">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-indigo-400 text-left">
                    🌇 Skyscraper Climber
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      skyscraperClimbed
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/30"
                        : "bg-sky-950 text-sky-400 border border-sky-800/30"
                    }`}
                  >
                    {skyscraperClimbed ? "Completed" : "0/1 Climbed"}
                  </span>
                </div>
                <p className="text-slate-400 leading-normal text-left">
                  Walk onto the roof cell of a skyscraper to complete this
                  challenge.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Sidebar (Floating Left) */}
      {hasSpawned && showAchievements && (
        <div
          className="absolute left-4 top-48 md:left-6 z-25 flex flex-col items-start gap-3 pointer-events-auto"
          style={achievementsDrag.style}
        >
          <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 w-72 flex flex-col gap-3 text-left">
            <div
              className="flex items-center justify-between border-b border-slate-800 pb-2 select-none cursor-grab active:cursor-grabbing w-full"
              onMouseDown={achievementsDrag.handleMouseDown}
              onTouchStart={achievementsDrag.handleTouchStart}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Achievements
                </h3>
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
                {
                  id: "first_steps",
                  title: "First Steps",
                  desc: "Walk 150 units",
                  current: Math.floor(distanceWalked),
                  target: 150,
                  unit: "m",
                },
                {
                  id: "wealthy_citizen",
                  title: "Wealthy Citizen",
                  desc: "Accumulate 500 ShunyaCoins",
                  current: shunyaCoins,
                  target: 500,
                  unit: "SC",
                },
                {
                  id: "green_guard",
                  title: "Green Guard",
                  desc: "Plant 5 trees",
                  current: treesPlantedCount,
                  target: 5,
                  unit: "trees",
                },
                {
                  id: "npc_helper",
                  title: "NPC Helper",
                  desc: "Complete 1 quest (Lost Dog)",
                  current: fidoQuestState === "completed" ? 1 : 0,
                  target: 1,
                  unit: "",
                },
                {
                  id: "high_flyer",
                  title: "High Flyer",
                  desc: "Perform 30 jumps",
                  current: jumpsCount,
                  target: 30,
                  unit: "jumps",
                },
                {
                  id: "skyscraper_climber",
                  title: "Skyscraper Climber",
                  desc: "Climb a skyscraper roof",
                  current: completedAchievements.includes("skyscraper_climber")
                    ? 1
                    : 0,
                  target: 1,
                  unit: "",
                },
                {
                  id: "dev_extraordinaire",
                  title: "Dev Extraordinaire",
                  desc: "Build 10 structures",
                  current: buildsCount,
                  target: 10,
                  unit: "structures",
                },
              ].map((ach) => {
                const completed = completedAchievements.includes(ach.id);
                const percent = Math.min(
                  100,
                  Math.floor((ach.current / ach.target) * 100),
                );

                return (
                  <div
                    key={ach.id}
                    className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-all duration-300 ${
                      completed
                        ? "bg-emerald-950/20 border-emerald-500/20"
                        : "bg-slate-950/40 border-slate-850/60"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col text-left">
                        <span
                          className={`text-[11px] font-bold ${completed ? "text-emerald-400" : "text-slate-200"}`}
                        >
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
                <span className="text-xs font-bold text-slate-100">
                  {activeNpcDialog.npcName}
                </span>
                <span className="text-[9px] text-cyan-400 font-semibold tracking-wider uppercase">
                  Citizen
                </span>
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
          <div
            className="w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl border border-green-700/40 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto"
            style={landDrag.style}
          >
            <button
              onClick={() => setShowLandShop(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer z-10"
              title="Close Land Shop"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div
              className="flex flex-col items-center gap-2 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={landDrag.handleMouseDown}
              onTouchStart={landDrag.handleTouchStart}
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 pointer-events-none">
                <Map className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-green-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent pointer-events-none">
                Land Expansion
              </h2>
              <p className="text-[11px] text-slate-400 text-center max-w-sm pointer-events-none">
                Purchase new 8×8 plots to grow your city beyond its current
                borders. Each expansion reveals new terrain, trees, and building
                opportunities!
              </p>
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/40 mt-1 pointer-events-none">
                <span className="text-slate-400">Current World Size:</span>
                <span className="text-green-400 font-bold">
                  {cityGridSize} × {cityGridSize} cells
                </span>
                <span className="text-slate-550">·</span>
                <span className="text-slate-400">Balance:</span>
                <span className="text-amber-400 font-bold">
                  {shunyaCoins} SC
                </span>
              </div>
            </div>

            {/* Mini city map visualization */}
            <div className="flex justify-center">
              <div className="relative w-40 h-40">
                {/* Center city */}
                <div className="absolute inset-0 m-auto w-16 h-16 bg-gradient-to-br from-emerald-600/60 to-green-700/60 border-2 border-green-500/50 rounded-lg flex items-center justify-center z-10">
                  <span className="text-[9px] text-green-300 font-bold text-center leading-tight">
                    YOUR
                    <br />
                    CITY
                  </span>
                </div>
                {/* Expansion indicators */}
                {availablePlots.map((plot) => (
                  <div
                    key={plot.id}
                    className={`absolute border border-dashed rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer ${shunyaCoins >= plot.cost ? "border-green-500 bg-green-900/30" : "border-red-700 bg-red-900/20"}`}
                    style={{
                      width: 52,
                      height: 52,
                      top:
                        plot.direction === "north"
                          ? 0
                          : plot.direction === "south"
                            ? 88
                            : 44,
                      left:
                        plot.direction === "west"
                          ? 0
                          : plot.direction === "east"
                            ? 88
                            : 44,
                    }}
                    onClick={() =>
                      shunyaCoins >= plot.cost && buyLandPlot(plot)
                    }
                    title={`${LandExpansionManager.directionLabel(plot.direction)} — ${plot.cost} SC`}
                  >
                    <span className="text-[8px] text-green-400 font-bold">
                      +8
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plot Cards */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                Available Plots
              </h3>
              {availablePlots.length === 0 && (
                <div className="text-center text-slate-500 text-xs py-4">
                  No plots available — you have max expansion!
                </div>
              )}
              {availablePlots.map((plot) => {
                const canAfford = shunyaCoins >= plot.cost;
                const dirIcon = (
                  {
                    north: <ArrowUp className="w-4 h-4" />,
                    south: <ArrowDown className="w-4 h-4" />,
                    east: <ArrowRight className="w-4 h-4" />,
                    west: <ArrowLeft className="w-4 h-4" />,
                    northeast: <ArrowUp className="w-4 h-4" />,
                    northwest: <ArrowUp className="w-4 h-4" />,
                    southeast: <ArrowDown className="w-4 h-4" />,
                    southwest: <ArrowDown className="w-4 h-4" />,
                  } as Record<string, React.ReactNode>
                )[plot.direction] ?? <Map className="w-4 h-4" />;

                return (
                  <div
                    key={plot.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                      canAfford
                        ? "border-green-700/40 bg-green-900/20 hover:border-green-500/60 hover:bg-green-900/30"
                        : "border-slate-700/30 bg-slate-800/20 opacity-60"
                    }`}
                  >
                    {/* Direction icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${canAfford ? "bg-green-600/30 text-green-400" : "bg-slate-700/30 text-slate-500"}`}
                    >
                      {dirIcon}
                    </div>

                    {/* Plot info */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold text-slate-200">
                        {LandExpansionManager.directionLabel(plot.direction)}{" "}
                        Expansion
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
                          ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/20 active:scale-95"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
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
              🌟 Each expansion also spawns new trees and triggers a golden
              land-reveal animation!
            </p>
          </div>
        </div>
      )}

      {/* Permit Store Modal */}
      {hasSpawned && showPermitStore && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 pointer-events-auto">
          <div
            className="w-full max-w-md bg-slate-900/85 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative max-h-[90vh] overflow-y-auto"
            style={permitDrag.style}
          >
            <button
              onClick={() => setShowPermitStore(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer z-10"
              title="Close Permit Shop"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="flex flex-col items-center gap-1.5 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={permitDrag.handleMouseDown}
              onTouchStart={permitDrag.handleTouchStart}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 pointer-events-none">
                <Award className="w-6 h-6 text-slate-950 font-bold" />
              </div>
              <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-300 bg-clip-text text-transparent pointer-events-none">
                Permit Store
              </h2>
              <p className="text-[10px] text-slate-400 max-w-xs pointer-events-none">
                Unlock permanent building permits using ShunyaCoins to construct
                on the map.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {[
                {
                  key: "road",
                  name: "Road Builder Permit",
                  cost: 50,
                  desc: "Enables construction of asphalt roads to link intersections.",
                  color: "from-slate-700 to-slate-850",
                },
                {
                  key: "tree",
                  name: "Arborist Permit",
                  cost: 100,
                  desc: "Enables planting decorative pine trees which can be harvested for wood.",
                  color: "from-emerald-800 to-emerald-950",
                },
                {
                  key: "house",
                  name: "Residential Permit",
                  cost: 250,
                  desc: "Allows building houses which generate citizen NPCs and work opportunities.",
                  color: "from-amber-700 to-amber-900",
                },
                {
                  key: "skyscraper",
                  name: "Commercial Permit",
                  cost: 500,
                  desc: "Allows building towering skyscrapers for advanced technology office jobs.",
                  color: "from-indigo-800 to-indigo-950",
                },
                {
                  key: "restaurant",
                  name: "🍔 Restaurant Permit",
                  cost: 200,
                  desc: "Build Mac D-style restaurants where players can buy food to survive hunger.",
                  color: "from-red-800 to-red-950",
                },
                {
                  key: "clothshop",
                  name: "👕 Cloth Shop Permit",
                  cost: 150,
                  desc: "Build fashion stores where players can buy shirts, pants and shoes.",
                  color: "from-blue-800 to-blue-950",
                },
                {
                  key: "barbershop",
                  name: "✂️ Barber Shop Permit",
                  cost: 100,
                  desc: "Build barber shops where players can change hair color and style.",
                  color: "from-purple-800 to-purple-950",
                },
                {
                  key: "policestation",
                  name: "🚔 Police Station Permit",
                  cost: 300,
                  desc: "Build police stations where players can report rule-breakers.",
                  color: "from-blue-900 to-slate-950",
                },
              ].map((permit) => {
                const owned =
                  unlockedPermits.includes(permit.key) ||
                  currentUser?.role === "admin";
                return (
                  <div
                    key={permit.key}
                    className="p-3.5 bg-slate-950/60 border border-slate-800/60 rounded-2xl flex items-center justify-between gap-4 text-left"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-slate-200">
                        {permit.name}
                      </span>
                      <span className="text-[9px] text-slate-400 leading-relaxed">
                        {permit.desc}
                      </span>
                    </div>

                    <button
                      onClick={() => buyPermit(permit.key, permit.cost)}
                      disabled={owned || shunyaCoins < permit.cost}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold tracking-wide w-24 text-center border shadow transition-all active:scale-95 cursor-pointer ${
                        owned
                          ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400 cursor-not-allowed shadow-none"
                          : shunyaCoins >= permit.cost
                            ? "bg-amber-500 border-amber-400 text-slate-950 hover:bg-amber-400"
                            : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {owned ? "Unlocked" : `${permit.cost} SC`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850 text-[10px] text-slate-455">
              Your balance:{" "}
              <span className="text-amber-400 font-bold">{shunyaCoins} SC</span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {hasSpawned && showLeaderboard && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 pointer-events-auto">
          <div
            className="w-full max-w-sm bg-slate-900/85 backdrop-blur-2xl border border-slate-700/60 shadow-2xl rounded-3xl p-6 flex flex-col gap-4 text-center relative max-h-[90vh] overflow-y-auto"
            style={leaderboardDrag.style}
          >
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800/40 cursor-pointer z-10"
              title="Close Leaderboard"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className="flex flex-col items-center gap-1.5 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={leaderboardDrag.handleMouseDown}
              onTouchStart={leaderboardDrag.handleTouchStart}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 pointer-events-none">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-black bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent pointer-events-none">
                Simulation Leaderboard
              </h2>
              <p className="text-[10px] text-slate-400 pointer-events-none">
                Rankings of active players by level and wealth.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
              {[
                {
                  _id: currentUser?.id || "local",
                  name: currentUser?.name || "You",
                  level,
                  shunyaCoins,
                  isLocal: true,
                  clothingColor: currentUser?.clothingColor,
                },
                ...otherPlayers,
              ]
                .sort((a, b) =>
                  b.level !== a.level
                    ? b.level - a.level
                    : b.shunyaCoins - a.shunyaCoins,
                )
                .map((p, idx) => (
                  <div
                    key={p._id}
                    className={`p-2.5 border rounded-2xl flex items-center justify-between gap-3 ${
                      p.isLocal
                        ? "bg-cyan-950/20 border-cyan-500/30 font-bold"
                        : "bg-slate-950/60 border-slate-850/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-500 w-4">
                        {idx + 1}
                      </span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white uppercase shadow"
                        style={{
                          backgroundColor: p.clothingColor
                            ? `#${p.clothingColor.toString(16).padStart(6, "0")}`
                            : "#ef4444",
                        }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                          {p.name}{" "}
                          {p.isLocal && (
                            <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1 py-0.2 rounded border border-cyan-500/30">
                              You
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {p.shunyaCoins} SC
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-black text-cyan-400">
                      Level {p.level}
                    </span>
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
              <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                Executing City Job...
              </h3>
              <p className="text-[10px] text-slate-450">
                Locking character animation. Please wait.
              </p>
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

      {/* ── MULTIPLAYER PARTY HUD ────────────────────────────────────────────────── */}
      {hasSpawned && (
        <div className="absolute top-20 right-4 z-40 flex flex-col gap-2 pointer-events-auto w-64">
          {partyInvites.map((invite, idx) => (
            <div key={idx} className="bg-slate-900/90 backdrop-blur-md border border-fuchsia-500/50 p-3 rounded-xl shadow-lg shadow-fuchsia-500/20 animate-fade-in flex flex-col gap-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-fuchsia-400" />
                Party Invite
              </div>
              <p className="text-[10px] text-slate-300">
                <span className="font-bold text-fuchsia-300">{invite.fromUserName}</span> invited you to join their party!
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    cityRef.current?.ws?.send(JSON.stringify({ type: "party-accept", groupId: invite.groupId }));
                    setPartyInvites(prev => prev.filter(i => i.groupId !== invite.groupId));
                  }}
                  className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => setPartyInvites(prev => prev.filter(i => i.groupId !== invite.groupId))}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}

          {party && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-fuchsia-500/30 p-3 rounded-xl shadow-lg flex flex-col gap-2">
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs font-bold text-fuchsia-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Users className="w-4 h-4" />
                  {party.name}
                </div>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to leave the party?")) {
                      cityRef.current?.ws?.send(JSON.stringify({ type: "party-leave" }));
                    }
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 bg-red-500/10 rounded"
                >
                  Leave
                </button>
              </div>
              
              <div className="flex flex-col gap-1.5">
                {party.members.map((memberId: string, idx: number) => {
                  const isLeader = party.leaderId === memberId;
                  const isMe = memberId === currentUser?._id;
                  let mName = "Unknown";
                  if (isMe) mName = currentUser.name + " (You)";
                  else {
                    const p = otherPlayers.find(op => op._id === memberId);
                    if (p) mName = p.name;
                  }
                  
                  return (
                    <div key={idx} className="flex justify-between items-center bg-slate-950/50 px-2 py-1.5 rounded border border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${isLeader ? 'bg-amber-400' : 'bg-fuchsia-400'}`} />
                        <span className="text-[10px] font-medium text-slate-200 truncate max-w-[120px]">
                          {mName}
                        </span>
                      </div>
                      {party.leaderId === currentUser?._id && !isMe && (
                        <button
                          onClick={() => cityRef.current?.ws?.send(JSON.stringify({ type: "party-kick", targetUserId: memberId }))}
                          className="text-[9px] text-slate-500 hover:text-red-400"
                        >
                          Kick
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!party && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-3 rounded-xl shadow-lg flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity">
              <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                <span>Not in a party</span>
                <button
                  onClick={() => {
                    const name = prompt("Enter a name for your new party:", "My Party");
                    if (name) cityRef.current?.ws?.send(JSON.stringify({ type: "party-create", name }));
                  }}
                  className="bg-fuchsia-500/20 hover:bg-fuchsia-500/40 text-fuchsia-400 px-2 py-1 rounded cursor-pointer"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* Party Invite Nearby Section */}
          {party && party.leaderId === currentUser?._id && party.members.length < 8 && (
            <div className="mt-1">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-1">Nearby Players</div>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {otherPlayers.filter(p => !party.members.includes(p._id)).length === 0 ? (
                  <div className="text-[9px] text-slate-600 px-1">No other players online</div>
                ) : (
                  otherPlayers.filter(p => !party.members.includes(p._id)).map(p => (
                    <div key={p._id} className="flex justify-between items-center bg-slate-900/80 px-2 py-1.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-300 truncate max-w-[100px]">{p.name}</span>
                      <button
                        onClick={() => {
                          cityRef.current?.ws?.send(JSON.stringify({ type: "party-invite", targetUserId: p._id }));
                          showToast(`Invite sent to ${p.name}`, "info");
                        }}
                        className="text-[9px] font-bold bg-fuchsia-500 hover:bg-fuchsia-400 text-white px-2 py-0.5 rounded cursor-pointer"
                      >
                        Invite
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HUNGER HUD BAR ───────────────────────────────────────────────────────── */}
      {hasSpawned && (
        <div
          className="absolute left-4 bottom-32 z-20 flex flex-col gap-1 pointer-events-auto"
          style={hungerDrag.style}
        >
          <div
            className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 px-3 py-2 rounded-xl shadow-xl w-44 select-none cursor-grab active:cursor-grabbing"
            onMouseDown={hungerDrag.handleMouseDown}
            onTouchStart={hungerDrag.handleTouchStart}
          >
            <span className="text-base leading-none pointer-events-none">
              {hungerLevel > 66 ? "🍗" : hungerLevel > 33 ? "😐" : "😵"}
            </span>
            <div className="flex flex-col flex-1 gap-0.5 pointer-events-none">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                  Hunger
                </span>
                <span
                  className={`text-[9px] font-bold ${hungerLevel > 66 ? "text-emerald-400" : hungerLevel > 33 ? "text-amber-400" : "text-red-400"}`}
                >
                  {Math.round(hungerLevel)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    hungerLevel > 66
                      ? "bg-gradient-to-r from-emerald-500 to-green-400"
                      : hungerLevel > 33
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                        : "bg-gradient-to-r from-red-600 to-rose-400 animate-pulse"
                  }`}
                  style={{ width: `${hungerLevel}%` }}
                />
              </div>
            </div>
          </div>
          {hungerLevel <= 33 && (
            <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-500/50 px-3 py-1.5 rounded-xl text-[9px] font-bold text-red-300 animate-pulse shadow-lg shadow-red-900/40">
              <span>☠️</span>
              <span>STARVING! Go eat now!</span>
            </div>
          )}
        </div>
      )}

      {/* ── MINIMAP ───────────────────────────────────────────────────────────────── */}
      {hasSpawned && (
        <div
          className="absolute bottom-36 right-4 z-20 flex flex-col items-center gap-1 pointer-events-auto"
          style={minimapDrag.style}
        >
          {/* Circle minimap */}
          <div
            className="relative cursor-pointer group"
            onClick={() => setShowMinimapFull(true)}
            title="Click to expand map"
          >
            <canvas
              ref={minimapCanvasRef}
              width={140}
              height={140}
              className="rounded-full border-2 border-slate-600/80 shadow-2xl shadow-black/60 ring-1 ring-white/10 transition-all duration-300 group-hover:border-cyan-500/60 group-hover:ring-cyan-500/20 group-hover:scale-105"
              style={{ display: "block", width: "140px", height: "140px" }}
            />
            {/* Expand icon */}
            <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 border border-slate-600/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg
                className="w-2.5 h-2.5 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </div>
          </div>
          <span
            className="text-[8px] font-bold text-slate-400 hover:text-cyan-400 uppercase tracking-widest select-none cursor-grab active:cursor-grabbing flex items-center gap-0.5"
            onMouseDown={minimapDrag.handleMouseDown}
            onTouchStart={minimapDrag.handleTouchStart}
            title="Drag to move map"
          >
            ✥ Map
          </span>
        </div>
      )}

      {/* ── FULLSCREEN MAP OVERLAY ────────────────────────────────────────────────── */}
      {showMinimapFull && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={() => setShowMinimapFull(false)}
        >
          <div
            className="relative bg-slate-950/95 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={mapDrag.style}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={mapDrag.handleMouseDown}
              onTouchStart={mapDrag.handleTouchStart}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🗺️</span>
                <span className="text-sm font-black text-slate-200 tracking-wide">
                  City Map
                </span>
                <span className="text-[9px] text-slate-500 ml-1">
                  Click a location to zoom camera there
                </span>
              </div>
              <button
                onClick={() => setShowMinimapFull(false)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas */}
            <div className="p-3">
              <canvas
                ref={minimapFullCanvasRef}
                width={480}
                height={480}
                className="rounded-xl border border-slate-700/40 cursor-crosshair block"
                onClick={(e) => {
                  // Teleport camera to clicked position
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mapX = e.clientX - rect.left;
                  const mapZ = e.clientY - rect.top;
                  const gridSize = cityRef.current?.gridSize ?? 32;
                  const cellPx = 480 / gridSize;
                  const worldX = (mapX / cellPx - gridSize / 2) * 2;
                  const worldZ = (mapZ / cellPx - gridSize / 2) * 2;
                  if (cityRef.current) {
                    cityRef.current.camera.position.x = worldX;
                    cityRef.current.camera.position.z = worldZ;
                    cityRef.current.camera.position.y = 30;
                    cityRef.current.controls?.target.set(worldX, 0, worldZ);
                    cityRef.current.controls?.update();
                  }
                  setShowMinimapFull(false);
                }}
              />
            </div>

            {/* Legend */}
            <div className="px-5 pb-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {[
                { color: "#374151", label: "Road" },
                { color: "#1a4d2e", label: "Tree" },
                { color: "#92400e", label: "House" },
                { color: "#312e81", label: "Skyscraper" },
                { color: "#7f1d1d", label: "🍔 Restaurant" },
                { color: "#1e3a5f", label: "👕 Cloth Shop / 🚔 Police" },
                { color: "#4a1d96", label: "✂️ Barber" },
                { color: "#14532d", label: "Park" },
                { color: "#1e40af", label: "River" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="text-[10px] text-slate-400">{l.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white flex-shrink-0" />
                <span className="text-[10px] text-slate-400">You</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-cyan-400 flex-shrink-0" />
                <span className="text-[10px] text-slate-400">
                  Other Players
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEATH SCREEN ─────────────────────────────────────────────────────────── */}
      {showDeathScreen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6 max-w-md text-center px-6 py-10 bg-slate-950/90 border border-red-800/50 rounded-3xl shadow-2xl shadow-red-900/40">
            <div className="text-8xl animate-bounce">💀</div>
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-black text-red-400 tracking-wide">
                YOU DIED
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                You starved for{" "}
                <strong className="text-red-300">3 in-game days</strong> without
                eating.
                <br />
                All your progress has been permanently wiped.
              </p>
            </div>
            <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>ShunyaCoins</span>
                <span className="text-red-400 font-bold">→ 0 SC</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Level / XP</span>
                <span className="text-red-400 font-bold">→ Lvl 1, 0 XP</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Wood</span>
                <span className="text-red-400 font-bold">→ 0</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Permits</span>
                <span className="text-red-400 font-bold">→ None</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">
              Tip: Visit a 🍔 Restaurant and press{" "}
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">
                E
              </kbd>{" "}
              to eat before you starve again.
            </p>
            <button
              onClick={triggerDeath}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-red-700/30 active:scale-95 transition-all cursor-pointer"
            >
              Respawn &amp; Start Over
            </button>
          </div>
        </div>
      )}

      {/* ── STORE PROXIMITY NOTIFICATION ────────────────────────────────────────── */}
      {activeStore &&
        !showFoodShop &&
        !showClothShop &&
        !showBarberShop &&
        !showPoliceStation && (
          <div
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[120] w-full max-w-sm mx-4 pointer-events-auto"
            style={{ animation: "slideUpFade 0.35s ease forwards" }}
          >
            <div
              className="bg-slate-950/90 border rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
              style={{
                borderColor: activeStore.isPurchased
                  ? "rgba(45,212,191,0.35)"
                  : "rgba(245,158,11,0.35)",
                boxShadow: activeStore.isPurchased
                  ? "0 0 30px rgba(20,184,166,0.25), 0 8px 32px rgba(0,0,0,0.6)"
                  : "0 0 30px rgba(245,158,11,0.2), 0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {/* Top bar */}
              <div
                className="flex items-center gap-3 px-4 pt-4 pb-3"
                style={{
                  background: activeStore.isPurchased
                    ? "linear-gradient(135deg, rgba(15,118,110,0.6), rgba(6,78,59,0.6))"
                    : "linear-gradient(135deg, rgba(146,64,14,0.6), rgba(120,53,15,0.6))",
                }}
              >
                <span className="text-3xl">{activeStore.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-white leading-tight truncate">
                    {activeStore.isPurchased && activeStore.ownerName
                      ? `${activeStore.ownerName}'s ${activeStore.storeName}`
                      : activeStore.storeName}
                  </h3>
                  <p
                    className="text-xs mt-0.5"
                    style={{
                      color: activeStore.isPurchased ? "#5eead4" : "#fcd34d",
                    }}
                  >
                    {activeStore.isPurchased
                      ? `Owner: ${activeStore.ownerName ?? "Unknown"}  ·  Paid ${activeStore.price > 0 ? `${activeStore.price} SC` : "Free"}`
                      : `For Sale · Price: ${activeStore.price > 0 ? `${activeStore.price} SC` : "Free"}`}
                  </p>
                </div>
                <button
                  onClick={() => setActiveStore(null)}
                  className="text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Info row */}
              <div className="px-4 py-3 flex gap-3 border-b border-slate-800/60">
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Type
                  </p>
                  <p className="text-sm font-bold text-white capitalize">
                    {activeStore.type
                      .replace("policestation", "Police Station")
                      .replace("clothshop", "Cloth Shop")
                      .replace("barbershop", "Barber Shop")
                      .replace("restaurant", "Restaurant")}
                  </p>
                </div>
                <div className="w-px bg-slate-800" />
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Status
                  </p>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: activeStore.isPurchased ? "#34d399" : "#fbbf24",
                    }}
                  >
                    {activeStore.isPurchased ? "✓ Owned" : "🏷 Available"}
                  </p>
                </div>
                <div className="w-px bg-slate-800" />
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Price
                  </p>
                  <p className="text-sm font-bold text-amber-400">
                    {activeStore.price > 0 ? `${activeStore.price} SC` : "Free"}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-3 flex gap-2">
                <button
                  id={`store-enter-btn-${activeStore.x}-${activeStore.z}`}
                  onClick={() => {
                    setActiveStore(null);
                    if (activeStore.type === "restaurant")
                      setShowFoodShop(true);
                    else if (activeStore.type === "clothshop")
                      setShowClothShop(true);
                    else if (activeStore.type === "barbershop")
                      setShowBarberShop(true);
                    else if (activeStore.type === "policestation")
                      setShowPoliceStation(true);
                  }}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95 cursor-pointer"
                  style={{
                    background: activeStore.isPurchased
                      ? "linear-gradient(135deg, #0f766e, #0d9488)"
                      : "linear-gradient(135deg, #b45309, #d97706)",
                  }}
                >
                  {activeStore.type === "restaurant"
                    ? "🍽 Enter & Order"
                    : activeStore.type === "clothshop"
                      ? "👔 Browse Clothes"
                      : activeStore.type === "barbershop"
                        ? "✂️ Get a Haircut"
                        : activeStore.type === "policestation"
                          ? "🚔 Enter Station"
                          : "🚪 Enter"}
                </button>
                <button
                  onClick={() => setActiveStore(null)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 bg-slate-800/80 hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
                >
                  Skip
                </button>
              </div>

              {/* Press R hint */}
              <p className="text-center text-[10px] text-slate-600 pb-2">
                Press{" "}
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                  R
                </kbd>{" "}
                to interact
              </p>
            </div>
          </div>
        )}

      {/* ── FOOD SHOP MODAL ───────────────────────────────────────────────────────── */}
      {showFoodShop && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowFoodShop(false)}
        >
          <div
            className="bg-slate-950/95 border border-red-800/40 rounded-3xl shadow-2xl shadow-red-900/30 max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={foodDrag.style}
          >
            {/* Header */}
            <div
              className="bg-gradient-to-r from-red-900/80 to-amber-900/80 p-5 flex items-center justify-between border-b border-red-800/30 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={foodDrag.handleMouseDown}
              onTouchStart={foodDrag.handleTouchStart}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <span className="text-3xl">🍔</span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Mac D Fast Food
                  </h3>
                  <p className="text-xs text-amber-300">
                    Eat to survive! Hunger: {Math.round(hungerLevel)}%
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFoodShop(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Hunger bar */}
            <div className="px-5 pt-4">
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full transition-all ${hungerLevel > 66 ? "bg-emerald-500" : hungerLevel > 33 ? "bg-amber-500" : "bg-red-500 animate-pulse"}`}
                  style={{ width: `${hungerLevel}%` }}
                />
              </div>
              {hungerLevel <= 33 && (
                <p className="text-[10px] text-red-400 font-bold text-center mb-2 animate-pulse">
                  ⚠️ Critical! You will die today without eating!
                </p>
              )}
            </div>
            {/* Menu */}
            <div className="p-5 flex flex-col gap-3">
              {[
                {
                  name: "Burger Meal",
                  emoji: "🍔",
                  cost: 25,
                  hungerRestore: 100,
                  desc: "Fully restores hunger — the best choice!",
                },
                {
                  name: "Chicken Snack",
                  emoji: "🍗",
                  cost: 10,
                  hungerRestore: 40,
                  desc: "A quick bite. Restores 40% hunger.",
                },
                {
                  name: "Bottled Water",
                  emoji: "💧",
                  cost: 5,
                  hungerRestore: 15,
                  desc: "Minimal. Buys a little time.",
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between bg-slate-900/60 border border-slate-800/60 rounded-2xl p-3.5 hover:border-red-700/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => buyFood(item)}
                    disabled={shunyaCoins < item.cost}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer shadow whitespace-nowrap"
                  >
                    {item.cost} SC
                  </button>
                </div>
              ))}
              <p className="text-center text-[10px] text-slate-500 mt-1">
                You have{" "}
                <span className="text-amber-400 font-bold">
                  {shunyaCoins} SC
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── CLOTH SHOP MODAL ──────────────────────────────────────────────────────── */}
      {showClothShop && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowClothShop(false)}
        >
          <div
            className="bg-slate-950/95 border border-blue-800/40 rounded-3xl shadow-2xl shadow-blue-900/30 max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={clothDrag.style}
          >
            <div
              className="bg-gradient-to-r from-blue-900/80 to-indigo-900/80 p-5 flex items-center justify-between border-b border-blue-800/30 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={clothDrag.handleMouseDown}
              onTouchStart={clothDrag.handleTouchStart}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <span className="text-3xl">👕</span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Fashion Store
                  </h3>
                  <p className="text-xs text-blue-300">
                    Change your style instantly
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClothShop(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {/* Shirts */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  👕 Shirts — 30 SC each
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Red", hex: 0xcc2200 },
                    { label: "Blue", hex: 0x1565c0 },
                    { label: "Green", hex: 0x2e7d32 },
                    { label: "Black", hex: 0x111111 },
                    { label: "White", hex: 0xf0f0f0 },
                    { label: "Orange", hex: 0xe65100 },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() =>
                        buyClothing("shirt", c.hex, `${c.label} Shirt`, 30)
                      }
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-blue-500/50 active:scale-95 transition-all cursor-pointer"
                    >
                      <div
                        className="w-7 h-7 rounded-full border-2 border-slate-700"
                        style={{
                          backgroundColor: `#${c.hex.toString(16).padStart(6, "0")}`,
                        }}
                      />
                      <span className="text-[8px] text-slate-400">
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Pants */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  👖 Pants — 25 SC each
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Black", hex: 0x111111 },
                    { label: "Navy", hex: 0x1a2a5e },
                    { label: "Brown", hex: 0x5d3a1a },
                    { label: "Gray", hex: 0x444444 },
                    { label: "Khaki", hex: 0x8b7355 },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() =>
                        buyClothing("pant", c.hex, `${c.label} Pants`, 25)
                      }
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-blue-500/50 active:scale-95 transition-all cursor-pointer"
                    >
                      <div
                        className="w-7 h-7 rounded-full border-2 border-slate-700"
                        style={{
                          backgroundColor: `#${c.hex.toString(16).padStart(6, "0")}`,
                        }}
                      />
                      <span className="text-[8px] text-slate-400">
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Shoes */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  👟 Shoes — 20 SC each
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Black", hex: 0x111111 },
                    { label: "White", hex: 0xf0f0f0 },
                    { label: "Red", hex: 0xcc1111 },
                    { label: "Blue", hex: 0x1565c0 },
                    { label: "Gold", hex: 0xffcc00 },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() =>
                        buyClothing("shoe", c.hex, `${c.label} Shoes`, 20)
                      }
                      className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-blue-500/50 active:scale-95 transition-all cursor-pointer"
                    >
                      <div
                        className="w-7 h-7 rounded-full border-2 border-slate-700"
                        style={{
                          backgroundColor: `#${c.hex.toString(16).padStart(6, "0")}`,
                        }}
                      />
                      <span className="text-[8px] text-slate-400">
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-center text-[10px] text-slate-500">
                You have{" "}
                <span className="text-amber-400 font-bold">
                  {shunyaCoins} SC
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── BARBER SHOP MODAL ─────────────────────────────────────────────────────── */}
      {showBarberShop && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowBarberShop(false)}
        >
          <div
            className="bg-slate-950/95 border border-purple-800/40 rounded-3xl shadow-2xl shadow-purple-900/30 max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={barberDrag.style}
          >
            <div
              className="bg-gradient-to-r from-purple-900/80 to-slate-900/80 p-5 flex items-center justify-between border-b border-purple-800/30 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={barberDrag.handleMouseDown}
              onTouchStart={barberDrag.handleTouchStart}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <span className="text-3xl">✂️</span>
                <div>
                  <h3 className="text-lg font-black text-white">City Barber</h3>
                  <p className="text-xs text-purple-300">
                    Change your hair color — 30–40 SC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBarberShop(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-400 mb-3">
                Current hair:{" "}
                <span className="font-bold" style={{ color: playerHairColor }}>
                  ■
                </span>{" "}
                {playerHairColor}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Classic Dark", hex: "#1a1a1a", cost: 30 },
                  { label: "Auburn", hex: "#4a2f13", cost: 30 },
                  { label: "Blonde", hex: "#d9a752", cost: 30 },
                  { label: "Red", hex: "#b83b1d", cost: 30 },
                  { label: "Blue Punk", hex: "#1a44bb", cost: 40 },
                  { label: "Silver", hex: "#c0c0c0", cost: 40 },
                  { label: "Green", hex: "#1a8b1a", cost: 40 },
                  { label: "Pink", hex: "#e91e8c", cost: 40 },
                ].map((h) => (
                  <button
                    key={h.hex}
                    onClick={() => changeHairColor(h.hex, h.label, h.cost)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all cursor-pointer active:scale-95 hover:scale-105 ${playerHairColor === h.hex ? "border-purple-400 bg-purple-900/30" : "border-slate-800/60 bg-slate-900/60 hover:border-purple-700/50"}`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-slate-700 shadow-inner"
                      style={{ backgroundColor: h.hex }}
                    />
                    <span className="text-[8px] text-slate-300 font-semibold text-center leading-tight">
                      {h.label}
                    </span>
                    <span className="text-[8px] text-amber-400">
                      {h.cost} SC
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-center text-[10px] text-slate-500 mt-4">
                You have{" "}
                <span className="text-amber-400 font-bold">
                  {shunyaCoins} SC
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── POLICE STATION MODAL ──────────────────────────────────────────────────── */}
      {showPoliceStation && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPoliceStation(false)}
        >
          <div
            className="bg-slate-950/95 border border-blue-900/40 rounded-3xl shadow-2xl shadow-blue-950/50 max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={policeDrag.style}
          >
            <div
              className="bg-gradient-to-r from-blue-950/90 to-slate-950/90 p-5 flex items-center justify-between border-b border-blue-900/30 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={policeDrag.handleMouseDown}
              onTouchStart={policeDrag.handleTouchStart}
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <span className="text-3xl">🚔</span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    Police Station
                  </h3>
                  <p className="text-xs text-blue-300">Report rule-breakers</p>
                </div>
              </div>
              <button
                onClick={() => setShowPoliceStation(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="bg-blue-950/30 border border-blue-800/30 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed">
                <p className="font-bold text-blue-300 mb-1">
                  📋 Online Players
                </p>
                {otherPlayers.length === 0 ? (
                  <p className="text-slate-500 text-xs italic">
                    No other players online right now.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 mt-2">
                    {otherPlayers.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-center justify-between bg-slate-900/60 border border-slate-800/50 rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{
                              backgroundColor: p.clothingColor
                                ? `#${p.clothingColor.toString(16).padStart(6, "0")}`
                                : "#3b82f6",
                            }}
                          >
                            {p.name?.charAt(0) ?? "?"}
                          </div>
                          <span className="text-xs font-semibold text-slate-200">
                            {p.name}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            Lvl {p.level ?? 1}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            showToast(
                              `🚔 Reported ${p.name} to police! (Session-only report)`,
                              "warning",
                            );
                            setShowPoliceStation(false);
                          }}
                          className="px-2 py-1 rounded-lg text-[9px] font-bold bg-red-900/40 border border-red-800/40 text-red-400 hover:bg-red-800/50 active:scale-95 transition-all cursor-pointer"
                        >
                          Report
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-900/40 border border-slate-800/40 rounded-2xl p-3 text-[10px] text-slate-500 leading-relaxed">
                <p>
                  <strong className="text-slate-300">ℹ️ Note:</strong> Reports
                  are session-only and visible only to you. Backend enforcement
                  coming soon.
                </p>
              </div>
              <button
                onClick={() => setShowPoliceStation(false)}
                className="py-2.5 rounded-xl bg-blue-900/40 border border-blue-800/30 text-blue-300 text-sm font-bold hover:bg-blue-800/50 active:scale-95 transition-all cursor-pointer"
              >
                Close Station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="absolute top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-3 text-xs font-semibold pointer-events-auto transition-all duration-300 ${
              toast.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300"
                : toast.type === "warning"
                  ? "bg-amber-950/80 border-amber-500/30 text-amber-300"
                  : "bg-slate-900/80 border-slate-700/40 text-sky-400"
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="text-slate-450 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Loading Screen Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 pointer-events-auto select-none">
          <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6">
            {/* Pulsing & Spinning Logo Container */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              {/* Outer rotating/pulsing ring */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 opacity-20 blur-xl animate-pulse" />
              <div className="absolute w-16 h-16 rounded-2xl border-2 border-dashed border-cyan-500/30 animate-spin [animation-duration:10s]" />
              <div className="absolute w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
            </div>

            {/* Typography */}
            <div className="text-center">
              <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent mb-1">
                ShunyaScape 3D
              </h2>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Interactive Agentic Simulation
              </p>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            {/* Status texts */}
            <div className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className="animate-pulse">{loadingText}</span>
              <span className="text-cyan-400">{loadingProgress}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
