"use client";

import React from "react";
import { Search, Trash2, ShieldAlert } from "lucide-react";
import { useAdmin } from "../AdminContext";

export default function PlayersPage() {
  const {
    users,
    searchQuery,
    setSearchQuery,
    currentUser,
    runAdminAction,
  } = useAdmin();

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-xl dark:shadow-2xl rounded-3xl overflow-hidden flex flex-col transition-colors duration-300">
        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors duration-300">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200">
              Registered players
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-500">
              Every account, how it signs in, and its role.
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
                <th className="py-4 px-6 font-bold">Player</th>
                <th className="py-4 px-6 font-bold">Role</th>
                <th className="py-4 px-6 font-bold">Sign-in</th>
                <th className="py-4 px-6 font-bold">Registered</th>
                <th className="py-4 px-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 transition-colors duration-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500 font-semibold border-b border-dashed border-slate-200 dark:border-slate-800">
                    No players found matching your search.
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
                            backgroundColor: `hsl(${[...user._id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 360}, 60%, 45%)`,
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
                          Player
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {user.google ? "Google" : "Email"}{user.isVerified ? "" : " · unverified"}
                    </td>
                    <td className="py-4 px-6 text-[11px] text-slate-500 dark:text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {user._id !== currentUser?.id && (
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
                                    `Are you sure you want to permanently delete player ${user.name}?`,
                                  )
                                ) {
                                  runAdminAction("delete", user._id);
                                }
                              }}
                              className="p-1.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg text-red-600 dark:text-red-400 transition-colors shadow-sm"
                              title="Delete player"
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

    </>
  );
}
