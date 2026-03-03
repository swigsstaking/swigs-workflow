/**
 * Migration: Link existing projects to Client collection via clientRef
 * and merge missing data (email, phone, etc.) in both directions.
 *
 * Usage: node scripts/migrate-client-refs.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swigs-workflow';

const CLIENT_SYNC_FIELDS = ['name', 'email', 'phone', 'address', 'street', 'zip', 'city', 'country', 'che', 'company', 'siret'];

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to', MONGO_URI);

  const db = mongoose.connection.db;
  const projects = db.collection('projects');
  const clients = db.collection('clients');

  // Get all projects without clientRef
  const unlinkedProjects = await projects.find({
    $or: [{ clientRef: null }, { clientRef: { $exists: false } }]
  }).toArray();

  console.log(`Found ${unlinkedProjects.length} projects without clientRef`);

  let linked = 0;
  let created = 0;
  let merged = 0;

  for (const project of unlinkedProjects) {
    const embedded = project.client;
    if (!embedded?.name) {
      console.log(`  SKIP project ${project.name} — no client name`);
      continue;
    }

    // Try to find matching client by name (same user)
    const matchQuery = { userId: project.userId, name: embedded.name };
    if (embedded.company) matchQuery.company = embedded.company;

    let client = await clients.findOne(matchQuery);

    if (client) {
      // Merge: copy missing fields from embedded → client
      const clientUpdates = {};
      for (const field of CLIENT_SYNC_FIELDS) {
        if (embedded[field] && !client[field]) {
          clientUpdates[field] = embedded[field];
        }
      }
      if (Object.keys(clientUpdates).length > 0) {
        await clients.updateOne({ _id: client._id }, { $set: clientUpdates });
        console.log(`  MERGE → Client "${client.name}": added ${Object.keys(clientUpdates).join(', ')}`);
        merged++;
      }

      // Merge: copy missing fields from client → project embedded
      const projectUpdates = {};
      for (const field of CLIENT_SYNC_FIELDS) {
        if (client[field] && !embedded[field]) {
          projectUpdates[`client.${field}`] = client[field];
        }
      }
      projectUpdates.clientRef = client._id;
      await projects.updateOne({ _id: project._id }, { $set: projectUpdates });

      if (Object.keys(projectUpdates).length > 1) {
        console.log(`  LINK + SYNC → Project "${project.name}" → Client "${client.name}" (synced ${Object.keys(projectUpdates).length - 1} fields)`);
      } else {
        console.log(`  LINK → Project "${project.name}" → Client "${client.name}"`);
      }
      linked++;
    } else {
      // Create new client from embedded data
      const newClientData = { userId: project.userId, createdAt: new Date(), updatedAt: new Date() };
      for (const field of CLIENT_SYNC_FIELDS) {
        if (embedded[field]) newClientData[field] = embedded[field];
      }
      const result = await clients.insertOne(newClientData);
      await projects.updateOne({ _id: project._id }, { $set: { clientRef: result.insertedId } });
      console.log(`  CREATE + LINK → Project "${project.name}" → new Client "${embedded.name}"`);
      created++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Linked to existing clients: ${linked}`);
  console.log(`Created new clients: ${created}`);
  console.log(`Merged fields: ${merged}`);
  console.log(`Total projects processed: ${unlinkedProjects.length}`);

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
