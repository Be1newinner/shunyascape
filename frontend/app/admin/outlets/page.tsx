"use client";

import React from "react";
import { Locate } from "lucide-react";
import { useAdmin } from "../AdminContext";

export default function OutletsPage() {
  const { gridCells, currentUser, runAdminAction, setCurrentUser, setSuccessMsg } = useAdmin();

  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-xl dark:shadow-2xl rounded-3xl p-6 flex flex-col gap-6 transition-colors duration-300">
      <div>
        <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          City Commercial Outlets & Treasury Revenue
        </h3>
        <p className="text-[11px] text-slate-600 dark:text-slate-500">
          Track built commercial stores, inspect their location coordinates,
          and collect accumulated tax treasury/revenue.
        </p>
      </div>

      {gridCells.filter(
        (c) =>
          [
            "restaurant",
            "clothshop",
            "barbershop",
            "policestation",
          ].includes(c.type) ||
          (c.type === "construction" &&
            [
              "restaurant",
              "clothshop",
              "barbershop",
              "policestation",
            ].includes(c.targetType)),
      ).length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-500 font-semibold border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
          No commercial stores built in the city yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gridCells
            .filter(
              (c) =>
                [
                  "restaurant",
                  "clothshop",
                  "barbershop",
                  "policestation",
                ].includes(c.type) ||
                (c.type === "construction" &&
                  [
                    "restaurant",
                    "clothshop",
                    "barbershop",
                    "policestation",
                  ].includes(c.targetType)),
            )
            .map((cell, idx) => {
              const isUnderConstruction = cell.type === "construction";
              const activeType = isUnderConstruction
                ? cell.targetType
                : cell.type;

              const storeInfo = (() => {
                switch (activeType) {
                  case "restaurant":
                    return {
                      name: "🍔 Fast Food Restaurant (McDonald's)",
                      desc: "McDonald's style fast food joint",
                      taxRate: "15 SC per meal",
                    };
                  case "clothshop":
                    return {
                      name: "👕 Clothing Boutique",
                      desc: "Outfits & custom clothing shop",
                      taxRate: "50 SC per outfit",
                    };
                  case "barbershop":
                    return {
                      name: "✂️ Barber Shop",
                      desc: "Custom hairstyles salon",
                      taxRate: "30 SC per haircut",
                    };
                  case "policestation":
                    return {
                      name: "🚔 Central Police Station",
                      desc: "Safety patrol headquarters",
                      taxRate: "N/A (Public Facility)",
                    };
                  default:
                    return {
                      name: "🏪 Commercial Shop",
                      desc: "Commercial store outlet",
                      taxRate: "10 SC",
                    };
                }
              })();

              const halfGrid = (32 * 2.25) / 2;
              const worldX = cell.x * 2.25 - halfGrid + 2.25 / 2;
              const worldZ = cell.z * 2.25 - halfGrid + 2.25 / 2;

              const isPublicFacility = activeType === "policestation";
              const baseAccrued = isPublicFacility
                ? 0
                : 20 + ((cell.x * cell.z) % 40);
              const accrued = isUnderConstruction ? 0 : baseAccrued;

              return (
                <div
                  key={`${cell.x}_${cell.z}_${idx}`}
                  className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 dark:hover:border-slate-800 transition-all animate-fade-in"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {storeInfo.name}
                      </span>
                      {isUnderConstruction ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 uppercase tracking-wider">
                          Construction {cell.constructionProgress}%
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {storeInfo.desc}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                      <div>
                        <span className="text-slate-700 dark:text-slate-550 font-bold">
                          Grid:
                        </span>{" "}
                        ({cell.x}, {cell.z})
                      </div>
                      <div>
                        <span className="text-slate-700 dark:text-slate-550 font-bold">
                          World:
                        </span>{" "}
                        ({worldX.toFixed(2)}, {worldZ.toFixed(2)})
                      </div>
                      {!isPublicFacility && (
                        <div>
                          <span className="text-slate-700 dark:text-slate-550 font-bold">
                            Tax Rate:
                          </span>{" "}
                          {storeInfo.taxRate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const adminId = currentUser._id || currentUser.id;
                        runAdminAction("teleport", adminId, {
                          x: worldX,
                          z: worldZ,
                        });
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-sky-500/30 hover:text-sky-600 dark:hover:text-sky-400 text-[10px] font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 text-slate-700 dark:text-slate-300"
                      title="Teleport your avatar to this shop location"
                    >
                      <Locate className="w-3.5 h-3.5" />
                      <span>Teleport</span>
                    </button>

                    {!isPublicFacility && (
                      <button
                        type="button"
                        disabled={accrued === 0 || isUnderConstruction}
                        onClick={async () => {
                          const adminId = currentUser._id || currentUser.id;
                          const newCoins =
                            (currentUser.shunyaCoins || 0) + accrued;
                          await runAdminAction("modifyCoins", adminId, {
                            shunyaCoins: newCoins,
                          });
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setCurrentUser((prev: any) => ({
                            ...prev,
                            shunyaCoins: newCoins,
                          }));
                          setSuccessMsg(
                            `💰 Successfully collected ${accrued} SC tax from ${storeInfo.name.split("(")[0].trim()}!`,
                          );
                          setTimeout(() => setSuccessMsg(""), 4000);
                        }}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          accrued > 0 && !isUnderConstruction
                            ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
                            : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span>Collect {accrued} SC</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
