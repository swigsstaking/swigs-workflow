/**
 * Sync clients for Moontain Studio (info@moontain.ch)
 * Creates Client documents from Project.client embedded data
 *
 * Usage: cd backend && node scripts/sync-clients-moontain.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../src/models/User.js';
import Project from '../src/models/Project.js';
import Client from '../src/models/Client.js';

async function syncClients() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swigs-workflow';
  console.log(`Connecting to ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected\n');

  // Find user
  const user = await User.findOne({ email: 'info@moontain.ch' });
  if (!user) {
    console.error('User info@moontain.ch not found');
    process.exit(1);
  }
  const userId = user._id;
  console.log(`User: ${user.email} (${userId})`);

  // Get all projects for this user
  const projects = await Project.find({ userId });
  console.log(`Found ${projects.length} projects\n`);

  // Get existing clients
  const existingClients = await Client.find({ userId });
  console.log(`Existing clients in collection: ${existingClients.length}`);

  // Build a set of existing client keys to avoid duplicates
  const existingKeys = new Set();
  for (const c of existingClients) {
    // Key by email (lowercase) or name
    if (c.email) existingKeys.add(`email:${c.email.toLowerCase()}`);
    existingKeys.add(`name:${c.name.toLowerCase()}`);
  }

  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    const pc = project.client;
    if (!pc || !pc.name) {
      console.log(`  ⚠ Project "${project.name}" has no client data, skipping`);
      skipped++;
      continue;
    }

    // Check if already exists
    const emailKey = pc.email ? `email:${pc.email.toLowerCase()}` : null;
    const nameKey = `name:${pc.name.toLowerCase()}`;

    if ((emailKey && existingKeys.has(emailKey)) || existingKeys.has(nameKey)) {
      console.log(`  → Already exists: ${pc.name}`);
      skipped++;
      continue;
    }

    // Create client
    const clientData = {
      userId,
      name: pc.name,
      email: pc.email || undefined,
      phone: pc.phone || undefined,
      company: pc.company || undefined,
      street: pc.street || undefined,
      zip: pc.zip || undefined,
      city: pc.city || undefined,
      che: pc.che || undefined,
      country: 'CH'
    };

    // If only address (old format), keep it
    if (!pc.street && pc.address) {
      clientData.address = pc.address;
    }

    const client = await Client.create(clientData);
    console.log(`  ✓ Created: ${client.name}${client.company ? ` (${client.company})` : ''}`);

    // Track to avoid duplicates within this run
    if (emailKey) existingKeys.add(emailKey);
    existingKeys.add(nameKey);
    created++;
  }

  console.log(`\n====================================`);
  console.log(`Sync complete: ${created} created, ${skipped} skipped`);
  console.log(`Total clients now: ${existingClients.length + created}`);
  console.log(`====================================`);

  await mongoose.disconnect();
}

syncClients().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
