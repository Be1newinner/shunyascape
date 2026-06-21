import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    BACKEND_API_URL: process.env.BACKEND_API_URL || '',
  },
  async rewrites() {
    // In development mode, always route to local backend unless explicitly overridden.
    // In production, use the BACKEND_API_URL.
    const isDev = process.env.NODE_ENV === 'development';
    const backendUrl = isDev 
      ? 'http://localhost:8005' 
      : (process.env.BACKEND_API_URL || process.env.BACKEND_URL || 'http://localhost:8005');
      
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
