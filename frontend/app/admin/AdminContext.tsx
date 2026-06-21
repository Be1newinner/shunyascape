"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  x: number;
  z: number;
  lastX: number;
  lastZ: number;
  clothingColor: number;
  shunyaCoins?: number;
  createdAt: string;
}

interface AdminContextProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
  users: UserItem[];
  setUsers: (users: UserItem[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  error: string;
  setError: (e: string) => void;
  successMsg: string;
  setSuccessMsg: (s: string) => void;
  gridCells: any[];
  setGridCells: (cells: any[]) => void;
  refreshing: boolean;
  
  // Global simulation states
  timeOfDay: number;
  setTimeOfDay: (t: number | ((prev: number) => number)) => void;
  timeSpeed: number;
  setTimeSpeed: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  settingsLoading: boolean;
  localTimeOfDay: number;
  setLocalTimeOfDay: (t: number) => void;
  localTimeSpeed: number;
  setLocalTimeSpeed: (t: number) => void;
  isDragging: boolean;
  setIsDragging: (d: boolean) => void;

  // Economics states
  hungerDecayRate: number;
  setHungerDecayRate: (v: number) => void;
  housingRentRate: number;
  setHousingRentRate: (v: number) => void;
  utilityBillRate: number;
  setUtilityBillRate: (v: number) => void;
  energyDrainRate: number;
  setEnergyDrainRate: (v: number) => void;
  transactionTaxRate: number;
  setTransactionTaxRate: (v: number) => void;

  fetchUsers: () => Promise<void>;
  updateGlobalSettings: (updates: any) => Promise<void>;
  runAdminAction: (action: "teleport" | "changeRole" | "delete" | "modifyCoins", targetUserId: string, payload?: any) => Promise<void>;
}

const AdminContext = createContext<AdminContextProps | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [gridCells, setGridCells] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Global simulation states
  const [timeOfDay, setTimeOfDay] = useState<number>(8.0);
  const [timeSpeed, setTimeSpeed] = useState<number>(0.5);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [localTimeOfDay, setLocalTimeOfDay] = useState<number>(8.0);
  const [localTimeSpeed, setLocalTimeSpeed] = useState<number>(0.5);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Economics states
  const [hungerDecayRate, setHungerDecayRate] = useState<number>(1.0);
  const [housingRentRate, setHousingRentRate] = useState<number>(10);
  const [utilityBillRate, setUtilityBillRate] = useState<number>(5);
  const [energyDrainRate, setEnergyDrainRate] = useState<number>(1.5);
  const [transactionTaxRate, setTransactionTaxRate] = useState<number>(10);

  const fetchUsers = async () => {
    if (users.length === 0) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const res = await fetch("/api/users");
      if (res.status === 401) {
        localStorage.removeItem("shunyascape_user");
        setCurrentUser(null);
        setError("Session expired or logged out from another system.");
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
          // Load economics settings
          if (data.settings.hungerDecayRate !== undefined) setHungerDecayRate(data.settings.hungerDecayRate);
          if (data.settings.housingRentRate !== undefined) setHousingRentRate(data.settings.housingRentRate);
          if (data.settings.utilityBillRate !== undefined) setUtilityBillRate(data.settings.utilityBillRate);
          if (data.settings.energyDrainRate !== undefined) setEnergyDrainRate(data.settings.energyDrainRate);
          if (data.settings.transactionTaxRate !== undefined) setTransactionTaxRate(data.settings.transactionTaxRate);
        }
      } else {
        setError(data.error || "Failed to fetch registered avatars");
      }

      // Fetch Grid Cells as well
      const gridRes = await fetch("/api/grid");
      if (gridRes.ok) {
        const gridData = await gridRes.json();
        setGridCells(gridData.cells || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to reach server database");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkSession = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user && data.user.role === "admin") {
            localStorage.setItem("shunyascape_user", JSON.stringify(data.user));
            setCurrentUser(data.user);
            fetchUsers();
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      localStorage.removeItem("shunyascape_user");
      setCurrentUser(null);
      setLoading(false);
    };
    checkSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateGlobalSettings = async (updates: any) => {
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
    if (updates.hungerDecayRate !== undefined) setHungerDecayRate(updates.hungerDecayRate);
    if (updates.housingRentRate !== undefined) setHousingRentRate(updates.housingRentRate);
    if (updates.utilityBillRate !== undefined) setUtilityBillRate(updates.utilityBillRate);
    if (updates.energyDrainRate !== undefined) setEnergyDrainRate(updates.energyDrainRate);
    if (updates.transactionTaxRate !== undefined) setTransactionTaxRate(updates.transactionTaxRate);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        localStorage.removeItem("shunyascape_user");
        setCurrentUser(null);
        setError("Session expired or logged out from another system.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update global simulation settings");
        fetchUsers();
      } else {
        setSuccessMsg(data.message || "Simulation settings synced globally!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Communication with settings API failed");
    } finally {
      setSettingsLoading(false);
    }
  };

  const runAdminAction = async (
    action: "teleport" | "changeRole" | "delete" | "modifyCoins",
    targetUserId: string,
    payload: any = {},
  ) => {
    if (!currentUser) return;
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          targetUserId,
          ...payload,
        }),
      });
      if (res.status === 401) {
        localStorage.removeItem("shunyascape_user");
        setCurrentUser(null);
        setError("Session expired or logged out from another system.");
        return;
      }
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Failed to perform ${action}`);
        return;
      }

      setSuccessMsg(data.message || "Action executed successfully!");

      if (action === "delete") {
        setUsers(users.filter((u) => u._id !== targetUserId));
      } else {
        setUsers(
          users.map((u) =>
            u._id === targetUserId ? { ...u, ...data.user } : u,
          ),
        );
      }
    } catch (err) {
      console.error(err);
      setError("Communication with server failed");
    }
  };

  return (
    <AdminContext.Provider
      value={{
        currentUser, setCurrentUser,
        users, setUsers,
        searchQuery, setSearchQuery,
        loading, setLoading,
        error, setError,
        successMsg, setSuccessMsg,
        gridCells, setGridCells,
        refreshing,
        timeOfDay, setTimeOfDay,
        timeSpeed, setTimeSpeed,
        isPlaying, setIsPlaying,
        settingsLoading,
        localTimeOfDay, setLocalTimeOfDay,
        localTimeSpeed, setLocalTimeSpeed,
        isDragging, setIsDragging,
        hungerDecayRate, setHungerDecayRate,
        housingRentRate, setHousingRentRate,
        utilityBillRate, setUtilityBillRate,
        energyDrainRate, setEnergyDrainRate,
        transactionTaxRate, setTransactionTaxRate,
        fetchUsers,
        updateGlobalSettings,
        runAdminAction
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
