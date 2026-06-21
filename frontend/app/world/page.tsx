"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Import 3D simulator dynamically to disable SSR rendering for WebGL
const CitySimulator = dynamic(() => import("../components/CitySimulator"), {
  ssr: false,
});

export default function WorldPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push("/");
        }
      } catch (err) {
        setIsAuthenticated(false);
        router.push("/");
      }
    };

    checkAuth();
  }, [router]);

  // While checking auth, show a blank or loading state so the 3D canvas doesn't render
  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-slate-950">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Initializing ShunyaScape Engine...</p>
      </div>
    );
  }

  // If not authenticated, we redirect, but we return null here to prevent flashing
  if (isAuthenticated === false) {
    return null;
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <CitySimulator />
    </main>
  );
}
