// PM2 process definitions (handoff §3/§10). Two long-lived processes share the
// repo and node_modules: the Next web server and the forensic worker.
//   pm2 start deploy/ecosystem.config.js
// Secrets come from a file OUTSIDE the repo (handoff §4); point env_file at it
// or export the vars before starting PM2.
module.exports = {
  apps: [
    {
      name: "bundlescan-web",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "bundlescan-worker",
      cwd: __dirname + "/..",
      script: "node_modules/.bin/tsx",
      args: "worker/index.ts",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: { NODE_ENV: "production", WORKER_MODE: "all" },
    },
  ],
};
