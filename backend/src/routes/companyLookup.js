import { Router } from 'express';
import { searchCompany } from '../services/companyLookup.service.js';

const router = Router();

/**
 * GET /api/company-lookup?q=SWIGS
 * Search Swiss companies by name (UID Register)
 */
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 3) {
      return res.json({ success: true, data: [] });
    }

    const results = await searchCompany(q, 8);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Company lookup error:', err.message);
    res.status(500).json({ success: false, error: 'Erreur lors de la recherche' });
  }
});

export default router;
