// PM2 Ecosystem Config — used by the Oracle VPS
// Run: pm2 start ecosystem.config.cjs  (first time)
// Run: pm2 reload ecosystem.config.cjs (zero-downtime reload)

module.exports = {
  apps: [
    // ── Backend: Express + WebSocket server (esbuild bundle) ─────────────────
    {
      name: 'unthikable-backend',
      script: 'dist/index.js',
      cwd: './backend',
      instances: 1,            // single instance (WS state is in-memory)
      exec_mode: 'fork',       // fork mode required for WebSocket sticky sessions
      watch: false,            // never watch in production
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,     // wait 3s between restart attempts
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8005,
      },
      error_file: './logs/backend-error.log',
      out_file:   './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
