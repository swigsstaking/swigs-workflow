/**
 * Migration: Create BankAccount entries from existing data
 *
 * 1. For each user with Settings.company.iban → create a BankAccount (isDefault)
 * 2. Find all distinct BankImport.statementIban per user → create a BankAccount for each unknown IBAN
 * 3. Backfill bankAccountId on BankTransaction and BankImport
 *
 * Usage: node backend/scripts/migrate-bank-accounts.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import BankAccount from '../src/models/BankAccount.js';
import BankImport from '../src/models/BankImport.js';
import BankTransaction from '../src/models/BankTransaction.js';
import Settings from '../src/models/Settings.js';

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Get all users that have settings
  const allSettings = await Settings.find({}).lean();
  let totalAccountsCreated = 0;
  let totalImportsUpdated = 0;
  let totalTxUpdated = 0;

  for (const settings of allSettings) {
    const userId = settings.userId;
    if (!userId) continue;

    console.log(`\nProcessing user ${userId}...`);

    // 1. Create BankAccount from Settings.company.iban
    const companyIban = settings.company?.iban?.replace(/\s/g, '').toUpperCase();
    if (companyIban) {
      const exists = await BankAccount.findOne({ userId, iban: companyIban });
      if (!exists) {
        await BankAccount.create({
          name: 'Compte principal',
          iban: companyIban,
          qrIban: settings.company?.qrIban?.replace(/\s/g, '').toUpperCase() || undefined,
          bankName: '',
          currency: 'CHF',
          isDefault: true,
          color: '#6366f1',
          userId
        });
        totalAccountsCreated++;
        console.log(`  Created default BankAccount for IBAN ${companyIban}`);
      }
    }

    // 2. Find distinct IBANs from BankImport
    const distinctIbans = await BankImport.distinct('statementIban', {
      userId,
      statementIban: { $ne: null }
    });

    for (const iban of distinctIbans) {
      const cleanIban = iban.replace(/\s/g, '').toUpperCase();
      if (!cleanIban) continue;

      const exists = await BankAccount.findOne({ userId, iban: cleanIban });
      if (!exists) {
        await BankAccount.create({
          name: `Compte ${cleanIban.slice(-4)}`,
          iban: cleanIban,
          bankName: '',
          currency: 'CHF',
          isDefault: false,
          color: '#8b5cf6',
          userId
        });
        totalAccountsCreated++;
        console.log(`  Created BankAccount for IBAN ${cleanIban}`);
      }
    }

    // 3. Backfill bankAccountId on BankImport
    const userAccounts = await BankAccount.find({ userId }).lean();
    const ibanToAccount = new Map();
    for (const acc of userAccounts) {
      ibanToAccount.set(acc.iban, acc._id);
    }

    for (const [iban, accountId] of ibanToAccount) {
      const result = await BankImport.updateMany(
        {
          userId,
          statementIban: iban,
          bankAccountId: { $exists: false }
        },
        { bankAccountId: accountId }
      );
      totalImportsUpdated += result.modifiedCount;

      // Find all importIds for this IBAN
      const relatedImports = await BankImport.find({
        userId,
        statementIban: iban
      }).select('importId').lean();

      const importIds = relatedImports.map(i => i.importId);
      if (importIds.length > 0) {
        const txResult = await BankTransaction.updateMany(
          {
            userId,
            importId: { $in: importIds },
            bankAccountId: { $exists: false }
          },
          { bankAccountId: accountId }
        );
        totalTxUpdated += txResult.modifiedCount;
      }
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Accounts created: ${totalAccountsCreated}`);
  console.log(`Imports updated: ${totalImportsUpdated}`);
  console.log(`Transactions updated: ${totalTxUpdated}`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
