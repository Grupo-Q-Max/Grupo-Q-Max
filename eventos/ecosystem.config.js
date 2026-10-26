const path = require('path');

module.exports = {
  apps: [
    {
      name: 'finora-api',
      cwd: path.join(__dirname, 'apps/api'),
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 1500,
      listen_timeout: 8000,
      kill_timeout: 5000,
      max_memory_restart: '512M',
      node_args: '--max-old-space-size=512',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3334,
        DATABASE_CONNECTION_LIMIT: 10,
        DISABLE_WHATSAPP: 'true',
      },
    },
    {
      name: 'finora-web',
      cwd: path.join(__dirname, 'apps/web'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 1500,
      listen_timeout: 10000,
      kill_timeout: 5000,
      max_memory_restart: '768M',
      node_args: '--max-old-space-size=768',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};

