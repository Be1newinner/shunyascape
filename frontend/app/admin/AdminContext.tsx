"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isVerified: boolean;
  google: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

interface AdminContextProps {
  currentUser: AdminUser | null;
  setCurrentUser: (user: AdminUser | null) => void;
  users: UserItem[];
  setUsers: (users: UserItem[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loading: boolean;
  error: string;
  setError: (e: string) => void;
  successMsg: string;
  setSuccessMsg: (s: string) => void;
  refreshing: boolean;
  fetchUsers: () => Promise<void>;
  runAdminAction: (action: "changeRole" | "delete", targetUserId: string, payload?: Record<string, unknown>) => Promise<void>;
}

const AdminContext = createContext<AdminContextProps | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const sessionExpired = () => {
    localStorage.removeItem("shunyascape_user");
    setCurrentUser(null);
    setError("Session expired or logged out from another system.");
  };

  const fetchUsers = async () => {
    if (users.length === 0) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401) {
        sessionExpired();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to fetch players");
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

  const runAdminAction = async (
    action: "changeRole" | "delete",
    targetUserId: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (!currentUser) return;
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetUserId, ...payload }),
      });
      if (res.status === 401) {
        sessionExpired();
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
      } else if (data.user) {
        setUsers(users.map((u) => (u._id === targetUserId ? { ...u, role: data.user.role } : u)));
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
        loading,
        error, setError,
        successMsg, setSuccessMsg,
        refreshing,
        fetchUsers,
        runAdminAction,
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
