import express from 'express';
import {
  getEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  sendTestEmail,
  getVariables,
  createDefaults
} from '../controllers/emailTemplateController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Get variables for a category (before :id routes)
router.get('/variables/:category', getVariables);

// Create default templates
router.post('/create-defaults', createDefaults);

// Template CRUD
router.route('/')
  .get(getEmailTemplates)
  .post(createEmailTemplate);

router.route('/:id')
  .get(getEmailTemplate)
  .put(updateEmailTemplate)
  .delete(deleteEmailTemplate);

// Preview and test
router.post('/:id/preview', previewEmailTemplate);
router.post('/:id/send-test', sendTestEmail);

export default router;
