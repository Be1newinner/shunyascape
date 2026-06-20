'use client';

import dynamic from 'next/dynamic';

// Import 3D simulator dynamically to disable SSR rendering for WebGL
const CitySimulator = dynamic(() => import('./components/CitySimulator'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <CitySimulator />
    </main>
  );
}


