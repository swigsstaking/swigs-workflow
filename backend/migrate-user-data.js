import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import Client from './src/models/Client.js';
import Status from './src/models/Status.js';
import Service from './src/models/Service.js';
import PlannedBlock from './src/models/PlannedBlock.js';
import Settings from './src/models/Settings.js';
import User from './src/models/User.js';
import Project from './src/models/Project.js';

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the main user (corentin@swigs.ch)
    const mainUser = await User.findOne({ email: 'corentin@swigs.ch' });

    if (!mainUser) {
      console.error('Main user corentin@swigs.ch not found');
      process.exit(1);
    }

    console.log(`Found main user: ${mainUser.email} (${mainUser._id})`);

    // Migration stats
    const stats = {
      clients: 0,
      statuses: 0,
      services: 0,
      plannedBlocks: 0,
      settings: 0
    };

    // Migrate Clients
    console.log('\n--- Migrating Clients ---');
    const clients = await Client.find({ userId: { $exists: false } });
    console.log(`Found ${clients.length} clients without userId`);

    for (const client of clients) {
      client.userId = mainUser._id;
      await client.save();
      stats.clients++;
    }
    console.log(`Migrated ${stats.clients} clients`);

    // Migrate Statuses
    console.log('\n--- Migrating Statuses ---');
    const statuses = await Status.find({ userId: { $exists: false } });
    console.log(`Found ${statuses.length} statuses without userId`);

    for (const status of statuses) {
      status.userId = mainUser._id;
      await status.save();
      stats.statuses++;
    }
    console.log(`Migrated ${stats.statuses} statuses`);

    // Migrate Services
    console.log('\n--- Migrating Services ---');
    const services = await Service.find({ userId: { $exists: false } });
    console.log(`Found ${services.length} services without userId`);

    for (const service of services) {
      service.userId = mainUser._id;
      await service.save();
      stats.services++;
    }
    console.log(`Migrated ${stats.services} services`);

    // Migrate PlannedBlocks
    console.log('\n--- Migrating PlannedBlocks ---');
    const blocks = await PlannedBlock.find({ userId: { $exists: false } });
    console.log(`Found ${blocks.length} planned blocks without userId`);

    for (const block of blocks) {
      block.userId = mainUser._id;
      await block.save();
      stats.plannedBlocks++;
    }
    console.log(`Migrated ${stats.plannedBlocks} planned blocks`);

    // Migrate Settings
    console.log('\n--- Migrating Settings ---');
    const settings = await Settings.find({ userId: { $exists: false } });
    console.log(`Found ${settings.length} settings without userId`);

    for (const setting of settings) {
      setting.userId = mainUser._id;
      await setting.save();
      stats.settings++;
    }
    console.log(`Migrated ${stats.settings} settings`);

    // Summary
    console.log('\n=== Migration Complete ===');
    console.log(`Clients: ${stats.clients}`);
    console.log(`Statuses: ${stats.statuses}`);
    console.log(`Services: ${stats.services}`);
    console.log(`PlannedBlocks: ${stats.plannedBlocks}`);
    console.log(`Settings: ${stats.settings}`);

    // Verify
    console.log('\n=== Verification ===');
    const remainingClients = await Client.countDocuments({ userId: { $exists: false } });
    const remainingStatuses = await Status.countDocuments({ userId: { $exists: false } });
    const remainingServices = await Service.countDocuments({ userId: { $exists: false } });
    const remainingBlocks = await PlannedBlock.countDocuments({ userId: { $exists: false } });
    const remainingSettings = await Settings.countDocuments({ userId: { $exists: false } });

    console.log(`Remaining clients without userId: ${remainingClients}`);
    console.log(`Remaining statuses without userId: ${remainingStatuses}`);
    console.log(`Remaining services without userId: ${remainingServices}`);
    console.log(`Remaining planned blocks without userId: ${remainingBlocks}`);
    console.log(`Remaining settings without userId: ${remainingSettings}`);

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
