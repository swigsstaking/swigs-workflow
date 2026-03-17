// Load environment variables FIRST (before any other imports that depend on env vars)
import 'dotenv/config';

// Validate critical environment variables
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'APP_SECRET'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import projectRoutes from './src/routes/projects.js';
import statusRoutes from './src/routes/statuses.js';
import eventRoutes from './src/routes/events.js';
import invoiceRoutes from './src/routes/invoices.js';
import quoteRoutes from './src/routes/quotes.js';
import settingsRoutes from './src/routes/settings.js';
import clientRoutes from './src/routes/clients.js';
import { getIcalFeed as icalFeedHandler } from './src/controllers/icalController.js';
import analyticsRoutes from './src/routes/analytics.js';
import serviceRoutes from './src/routes/services.js';
import serviceCategoryRoutes from './src/routes/serviceCategories.js';
import authRoutes from './src/routes/auth.js';
import dashboardRoutes from './src/routes/dashboard.js';
import portalRoutes from './src/routes/portal.js';
import exportRoutes from './src/routes/exports.js';
import reminderRoutes from './src/routes/reminders.js';
import abaninjaRoutes from './src/routes/abaninja.js';
import bankRoutes from './src/routes/bank.js';
import bankAccountRoutes from './src/routes/bankAccounts.js';
import expenseCategoryRoutes from './src/routes/expenseCategories.js';
import counterpartyRuleRoutes from './src/routes/counterpartyRules.js';
import timerRoutes from './src/routes/timer.js';
import recurringInvoiceRoutes from './src/routes/recurringInvoices.js';
import quoteTemplateRoutes from './src/routes/quoteTemplates.js';
import aiRoutes from './src/routes/ai.js';
import Invoice from './src/models/Invoice.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { requireAuth } from './src/middleware/auth.js';
import { requireComptaPlus, checkComptaPlus } from './src/middleware/requireComptaPlus.js';
import { initEventBus, eventBus } from './src/services/eventBus.service.js';
import { initialize as initReminders } from './src/services/reminder.service.js';
import { initBankImapCron } from './src/services/bankImapFetcher.service.js';
import { initRecurringInvoices } from './src/services/recurringInvoice.service.js';

const app = express();

// Trust proxy (required when behind Nginx/reverse proxy for rate limiting)
app.set('trust proxy', 1);

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some API integrations
}));

// CORS - Configure allowed origins
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.110.59:3003',
      'https://workflow.swigs.ch',
      'https://workflow.swigs.online'
    ];

app.use(cors({
  origin: (origin, callback) => {
    // No-origin requests: iCal clients, PM2 health checks, server-to-server
    // CSRF mitigated by Bearer token requirement on all protected routes
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
}));

// =============================================================================
// RATE LIMITING
// =============================================================================

// Global rate limiter - 100 requests per minute
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: 'Trop de requêtes, veuillez réessayer dans une minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health'
});

// Strict limiter for auth routes - 10 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Trop de tentatives de connexion, veuillez réessayer dans une minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});



// Apply global limiter
app.use(globalLimiter);

// =============================================================================
// PERFORMANCE MIDDLEWARE
// =============================================================================

// Compression for responses
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Body parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Sanitize MongoDB query injection
app.use(mongoSanitize());

// =============================================================================
// REQUEST LOGGING (Development only)
// =============================================================================

if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
      }
    });
    next();
  });
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'swigs-workflow',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
});

// =============================================================================
// API ROUTES
// =============================================================================

// Auth routes with strict rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// Protected routes - REQUIRE authentication for data isolation
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/statuses', requireAuth, statusRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/invoices', requireAuth, invoiceRoutes);
app.use('/api/quotes', requireAuth, quoteRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/clients', requireAuth, clientRoutes);
// iCal feed — public (token-authenticated), kept for external calendar subscriptions
app.get('/api/planning/ical/:token', icalFeedHandler);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/services', requireAuth, serviceRoutes);
app.use('/api/service-categories', requireAuth, serviceCategoryRoutes);

// Portal routes (mix of public and private routes)
app.use('/api/portal', portalRoutes);

// Export routes (protected)
app.use('/api/exports', requireAuth, exportRoutes);

// Reminder routes (protected)
app.use('/api/reminders', requireAuth, reminderRoutes);

// AbaNinja integration routes (protected)
app.use('/api/abaninja', requireAuth, abaninjaRoutes);

// Bank import routes (protected, soft check for Compta Plus features)
app.use('/api/bank', requireAuth, checkComptaPlus, bankRoutes);

// Bank accounts (Compta Plus required)
app.use('/api/bank-accounts', requireAuth, requireComptaPlus, bankAccountRoutes);

// Expense categories & counterparty rules (Compta Plus required)
app.use('/api/expense-categories', requireAuth, requireComptaPlus, expenseCategoryRoutes);
app.use('/api/counterparty-rules', requireAuth, requireComptaPlus, counterpartyRuleRoutes);

// Timer routes (protected)
app.use('/api/timer', requireAuth, timerRoutes);

// Recurring invoice routes (protected)
app.use('/api/recurring-invoices', requireAuth, recurringInvoiceRoutes);

// Quote template routes (protected)
app.use('/api/quote-templates', requireAuth, quoteTemplateRoutes);

// AI routes (auth handled internally — /health is public, rest requires auth)
app.use('/api/ai', aiRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} non trouvée`
  });
});

// Global error handler
app.use(errorHandler);

// =============================================================================
// DATABASE & SERVER STARTUP
// =============================================================================

// MongoDB connection options
const mongoOptions = {
  maxPoolSize: 10, // Default for single server
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4 // Use IPv4
};

mongoose.connect(process.env.MONGODB_URI, mongoOptions)
  .then(async () => {
    console.log('MongoDB connected');

    // Sync invoice counter (migrates per-user counters to global)
    await Invoice.syncCounter();

    // Initialize Event Bus connection to Hub
    await initEventBus();

    // Initialize reminder service
    initReminders();

    // Initialize bank IMAP auto-fetch
    initBankImapCron();

    // Initialize recurring invoice generation
    initRecurringInvoices();

    const PORT = process.env.PORT || 3003;
    const server = app.listen(PORT, () => {
      console.log(`Swigs Workflow API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');

      // Disconnect Event Bus
      eventBus.disconnect();

      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log('Server closed');
          process.exit(0);
        });
      });
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});
