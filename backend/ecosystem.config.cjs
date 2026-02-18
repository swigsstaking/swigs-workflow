/**
 * PM2 Ecosystem Configuration for swigs-workflow
 *
 * Cluster mode configuration for SW6C-1 (i5-8500, 6 cores, 16GB RAM)
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs  # Zero-downtime reload
 *   pm2 stop swigs-workflow
 *   pm2 delete swigs-workflow
 *
 * Scaling:
 *   pm2 scale swigs-workflow 4  # Scale to 4 instances
 */

module.exports = {
  apps: [{
    name: 'swigs-workflow',
    script: './server.js',
    interpreter: '/usr/bin/node',

    // ==========================================================================
    // CLUSTER MODE CONFIGURATION
    // ==========================================================================
    // 2 instances for swigs-workflow (main app, gets more traffic)
    // This leaves cores for other SWIGS apps (hub, task, ai-builder)
    instances: 2,
    exec_mode: 'cluster',

    // ==========================================================================
    // MEMORY & RESTART CONFIGURATION
    // ==========================================================================
    max_memory_restart: '400M',  // Restart if memory exceeds 400MB
    autorestart: true,
    restart_delay: 1000,  // Wait 1s between restarts
    max_restarts: 10,     // Max 10 restarts in a row
    min_uptime: 5000,     // Consider app started after 5s

    // ==========================================================================
    // GRACEFUL SHUTDOWN
    // ==========================================================================
    kill_timeout: 10000,   // 10s to gracefully shutdown
    wait_ready: true,      // Wait for process.send('ready')
    listen_timeout: 10000, // Timeout for app to listen

    // ==========================================================================
    // ENVIRONMENT
    // ==========================================================================
    env: {
      NODE_ENV: 'production',
      PORT: 3004
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3003
    },

    // ==========================================================================
    // LOGGING
    // ==========================================================================
    error_file: '/home/swigs/.pm2/logs/swigs-workflow-error.log',
    out_file: '/home/swigs/.pm2/logs/swigs-workflow-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // ==========================================================================
    // MONITORING (for pm2 monit / pm2 plus)
    // ==========================================================================
    instance_var: 'INSTANCE_ID',

    // ==========================================================================
    // ADVANCED OPTIONS
    // ==========================================================================
    // Watch is disabled in production (use pm2 reload for updates)
    watch: false,
    // Ignore watching node_modules
    ignore_watch: ['node_modules', 'logs', '.git'],
    // Source map support for better error traces
    source_map_support: true,

    // Node.js arguments for better performance
    node_args: [
      '--max-old-space-size=384',  // Limit heap to 384MB per instance
      '--optimize-for-size'         // Optimize for memory over speed
    ]
  }]
};
