module.exports = {
  apps: [
    {
      name: "proposta",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        // Datas geradas no Node (data da proposta, logs, PDFs) em horário de Brasília, independente do servidor
        TZ: "America/Sao_Paulo",
        PORT: 3005
      }
    }
  ]
};
