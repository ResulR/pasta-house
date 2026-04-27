module.exports = {
  apps: [
    {
      name: "pasta-house-server",
      script: "src/server.js",
      cwd: "/var/www/pasta-house/server",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};