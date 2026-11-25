// PM2 — PakHotels on the live server (/home/pakhotelspk/htdocs/pakhotels.pk).
//
//   pm2 start ecosystem.config.js && pm2 save      (deploy/deploy.sh does this)
//
// The website listens on 3119 (the port the domain points to in CloudPanel);
// the API on 3120, bound to 127.0.0.1 and reached only through the website's
// /api, /uploads and /img rewrites. Names are prefixed so they never clash
// with another site's PM2 processes on the same server.
module.exports = {
  apps: [
    {
      name: 'pakhotels-api',
      cwd: './apps/api', // the API reads apps/api/.env and serves ../../uploads
      script: 'dist/apps/api/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3120,
        HOST: '127.0.0.1',
      },
    },
    {
      name: 'pakhotels-web',
      cwd: './apps/web',
      // next is installed at the workspace root, not inside apps/web.
      script: '../../node_modules/next/dist/bin/next',
      args: 'start -p 3119',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3119,
      },
    },
  ],
};
