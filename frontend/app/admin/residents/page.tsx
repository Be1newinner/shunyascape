"use client";

import React, { useState } from "react";
import { Search, MapPin, Trash2, ShieldAlert } from "lucide-react";
import { useAdmin } from "../AdminContext";

export default function ResidentsPage() {
  const {
    users,
    searchQuery,
    setSearchQuery,
    currentUser,
    runAdminAction,
  } = useAdmin();

  const [teleportingUser, setTeleportingUser] = useState<any>(null);
  const [teleportX, setTeleportX] = useState<string>("0");
  const [teleportZ, setTeleportZ] = useState<string>("0");

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleTeleportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teleportingUser) return;
    runAdminAction("teleport", teleportingUser._id, {
      x: Number(teleportX),
      z: Number(teleportZ),
    });
    setTeleportingUser(null);
  };

  return (
    <>
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-xl dark:shadow-2xl rounded-3xl overflow-hidden flex flex-col transition-colors duration-300">
        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-300">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">
              Registered City Residents
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-500">
              Moderate, teleport, and view roles and spatial coordinates of active users.
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-550" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800/60 transition-colors duration-300">
                <th className="py-4 px-6 font-bold">Resident</th>
                <th className="py-4 px-6 font-bold">Role</th>
                <th className="py-4 px-6 font-bold">Location (X, Z)</th>
                <th className="py-4 px-6 font-bold">Registered</th>
                <th className="py-4 px-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 transition-colors duration-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 font-semibold border-b border-dashed border-slate-200 dark:border-slate-800">
                    No residents found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user._id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner"
                          style={{
                            backgroundColor: `hsl(${user.clothingColor % 360}, 70%, 50%)`,
                          }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {user.role === "admin" ? (
                        <span className="px-2 py-1 rounded-md text-[9px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 uppercase tracking-widest">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-widest">
                          Resident
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs font-medium text-slate-600 dark:text-slate-400 font-mono">
                      {user.x?.toFixed(1) || "0.0"}, {user.z?.toFixed(1) || "0.0"}
                    </td>
                    <td className="py-4 px-6 text-[11px] text-slate-500 dark:text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setTeleportingUser(user)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shadow-sm"
                          title="Teleport Resident"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>

                        {user._id !== currentUser?._id && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                runAdminAction("changeRole", user._id, {
                                  role: user.role === "admin" ? "user" : "admin",
                                })
                              }
                              className="p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shadow-sm"
                              title={`Toggle ${user.role === "admin" ? "User" : "Admin"} Role`}
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to permanently delete resident ${user.name}?`,
                                  )
                                ) {
                                  runAdminAction("delete", user._id);
                                }
                              }}
                              className="p-1.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400 transition-colors shadow-sm"
                              title="Delete Resident"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Teleport Coordinate Picker Modal */}
      {teleportingUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-colors duration-300">
          <form
            onSubmit={handleTeleportSubmit}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6 flex flex-col gap-5 text-center relative pointer-events-auto transition-colors duration-300"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Teleport Resident
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                Instantly relocate{" "}
                <span className="text-slate-800 dark:text-slate-350 font-bold">
                  {teleportingUser.name}
                </span>{" "}
                in the 3D simulation.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-left text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                Preset Coordinate Sectors
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTeleportX("0");
                    setTeleportZ("0");
                  }}
                  className="py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Map Center (0,0)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeleportX("1.5");
                    setTeleportZ("1.5");
                  }}
                  className="py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Junction (1.5,1.5)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTeleportX("-25.0");
                    setTeleportZ("2.0");
                  }}
                  className="py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Water Bay (-25,2)
                </button>
              </div>
            </div>

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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-semibold text-center text-slate-800 dark:text-slate-100 focus:outline-none"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-semibold text-center text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTeleportingUser(null)}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-cyan-600 dark:bg-cyan-500 hover:bg-cyan-700 dark:hover:bg-cyan-400 rounded-xl text-xs font-bold text-white dark:text-slate-950 shadow-lg shadow-cyan-500/20 transition-all"
              >
                Teleport Now
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
