import { Router } from 'express';
import multer from 'multer';
import {
  importCamt,
  getImports,
  getImportTransactions,
  getUnmatched,
  matchTransaction,
  ignoreTransaction,
  testImap,
  fetchImapNow
} from '../controllers/bankController.js';

const router = Router();

const upload = multer({
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

router.post('/import', upload.single('file'), importCamt);
router.get('/imports', getImports);
router.get('/imports/:importId/transactions', getImportTransactions);
router.get('/unmatched', getUnmatched);
router.patch('/transactions/:id/match', matchTransaction);
router.patch('/transactions/:id/ignore', ignoreTransaction);
router.post('/imap/test', testImap);
router.post('/imap/fetch', fetchImapNow);

export default router;
