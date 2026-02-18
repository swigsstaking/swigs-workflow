import express from 'express';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient
} from '../controllers/clientController.js';
import { validate, sanitizeBody } from '../middleware/validate.js';

const router = express.Router();

router.route('/')
  .get(getClients)
  .post(
    sanitizeBody('name', 'email', 'phone', 'company', 'address', 'siret', 'notes'),
    validate({ body: { name: 'required|string' } }),
    createClient
  );

router.route('/:id')
  .get(getClient)
  .put(
    sanitizeBody('name', 'email', 'phone', 'company', 'address', 'siret', 'notes'),
    updateClient
  )
  .delete(deleteClient);

export default router;
