#!/usr/bin/env node

/**
 * Migration Script v2 for swigs-workflow
 *
 * Migrations:
 * 1. Drop duplicate 'status' collection (keep 'statuses')
 * 2. Migrate invoice numbers from R0001 to FAC-YEAR-XXX format
 * 3. Add invoiceType field to existing invoices (default: 'standard')
 *
 * Usage: node backend/src/scripts/migrate-v2.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

// MongoDB URI from env or fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swigs-workflow';

/**
 * Logger utility
 */
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`)
};

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    log.success(`Connected to MongoDB: ${MONGODB_URI}`);
  } catch (error) {
    log.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Migration 1: SKIPPED - Status collections
 * NOTE: The Mongoose Status model uses collection 'status' (singular, legacy).
 * Both 'status' and 'statuses' collections exist but 'status' is the one used by Mongoose.
 * DO NOT DROP 'status' collection.
 */
const migration1_dropStatusCollection = async () => {
  log.info('Migration 1: SKIPPED (status collection is used by Mongoose model)');
};

/**
 * Migration 2: Migrate invoice numbers from R0001 to FAC-YEAR-XXX
 */
const migration2_migrateInvoiceNumbers = async () => {
  log.info('Starting Migration 2: Migrate invoice numbers to FAC-YEAR-XXX format');

  try {
    const db = mongoose.connection.db;
    const invoices = await db.collection('invoices').find({
      number: /^R\d+$/
    }).toArray();

    if (invoices.length === 0) {
      log.info('No invoices with old format (R####) found. Skipping.');
      return;
    }

    log.info(`Found ${invoices.length} invoices to migrate`);

    let migratedCount = 0;
    for (const invoice of invoices) {
      const createdYear = new Date(invoice.createdAt).getFullYear();
      const oldNumber = invoice.number;

      // Extract number part (e.g., R0001 → 0001)
      const numberPart = oldNumber.replace('R', '');

      // New format: FAC-YEAR-XXX
      const newNumber = `FAC-${createdYear}-${numberPart}`;

      // Check if new number already exists (avoid duplicates)
      const existing = await db.collection('invoices').findOne({ number: newNumber });
      if (existing) {
        log.warn(`Invoice number ${newNumber} already exists. Skipping ${oldNumber}.`);
        continue;
      }

      // Update invoice number
      await db.collection('invoices').updateOne(
        { _id: invoice._id },
        { $set: { number: newNumber } }
      );

      log.info(`Migrated ${oldNumber} → ${newNumber}`);
      migratedCount++;
    }

    log.success(`Migration 2 complete: ${migratedCount} invoices migrated`);
  } catch (error) {
    log.error(`Migration 2 failed: ${error.message}`);
    throw error;
  }
};

/**
 * Migration 3: Add invoiceType field to existing invoices
 */
const migration3_addInvoiceType = async () => {
  log.info('Starting Migration 3: Add invoiceType field to invoices');

  try {
    const db = mongoose.connection.db;
    const result = await db.collection('invoices').updateMany(
      { invoiceType: { $exists: false } },
      { $set: { invoiceType: 'standard' } }
    );

    if (result.modifiedCount === 0) {
      log.info('All invoices already have invoiceType field. Skipping.');
    } else {
      log.success(`Migration 3 complete: ${result.modifiedCount} invoices updated`);
    }
  } catch (error) {
    log.error(`Migration 3 failed: ${error.message}`);
    throw error;
  }
};

/**
 * Main migration runner
 */
const runMigrations = async () => {
  log.info('========================================');
  log.info('SWIGS Workflow - Migration v2');
  log.info('========================================');

  try {
    await connectDB();

    // Run all migrations in sequence
    await migration1_dropStatusCollection();
    await migration2_migrateInvoiceNumbers();
    await migration3_addInvoiceType();

    log.info('========================================');
    log.success('All migrations completed successfully!');
    log.info('========================================');

    process.exit(0);
  } catch (error) {
    log.error('Migration failed. Please review errors above.');
    log.error(`Details: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Run migrations
runMigrations();
