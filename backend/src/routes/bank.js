import { Router } from 'express';
import multer from 'multer';
import {
  importCamt,
  getImports,
  deleteImport,
  getImportTransactions,
  getUnmatched,
  getTransactions,
  getTransaction,
  getDuplicates,
  mergeTransactions,
  matchTransaction,
  ignoreTransaction,
  categorizeTransaction,
  setTransactionVat,
  addAttachment,
  removeAttachment,
  testImap,
  fetchImapNow,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  previewCsv,
  confirmCsvImport,
  getRecurringCharges,
  createRecurringCharge,
  updateRecurringCharge,
  deleteRecurringCharge
} from '../controllers/bankController.js';

const router = Router();

const uploadXml = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/xml' || file.mimetype === 'application/xml' || file.originalname.endsWith('.xml')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers XML sont acceptés'), false);
    }
  }
});

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'text/plain' || file.originalname.endsWith('.csv') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers CSV sont acceptés'), false);
    }
  }
});

const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formats acceptés : PDF, JPG, PNG'), false);
    }
  }
});

// Import
router.post('/import', uploadXml.single('file'), importCamt);
router.get('/imports', getImports);
router.delete('/imports/:importId', deleteImport);
router.get('/imports/:importId/transactions', getImportTransactions);

// CRUD Transactions
router.post('/transactions', createTransaction);
router.get('/transactions/:id', getTransaction);
router.put('/transactions/:id', updateTransaction);
router.delete('/transactions/:id', deleteTransaction);

// CSV Import
router.post('/import-csv/preview', uploadCsv.single('file'), previewCsv);
router.post('/import-csv/confirm', uploadCsv.single('file'), confirmCsvImport);

// Transactions
router.get('/transactions', getTransactions);
router.get('/unmatched', getUnmatched);
router.get('/duplicates', getDuplicates);
router.post('/transactions/merge', mergeTransactions);
router.patch('/transactions/:id/match', matchTransaction);
router.patch('/transactions/:id/ignore', ignoreTransaction);
router.patch('/transactions/:id/categorize', categorizeTransaction);
router.patch('/transactions/:id/vat', setTransactionVat);

// Attachments
router.post('/transactions/:id/attachments', uploadAttachment.single('file'), addAttachment);
router.delete('/transactions/:id/attachments/:aid', removeAttachment);

// IMAP
router.post('/imap/test', testImap);
router.post('/imap/fetch', fetchImapNow);

// Recurring Charges
router.get('/recurring', getRecurringCharges);
router.post('/recurring', createRecurringCharge);
router.put('/recurring/:id', updateRecurringCharge);
router.delete('/recurring/:id', deleteRecurringCharge);

export default router;
