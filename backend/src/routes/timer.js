import express from 'express';
import { getActive, start, pause, resume, stop, discard } from '../controllers/timerController.js';

const router = express.Router();

router.get('/active', getActive);
router.post('/start', start);
router.patch('/pause', pause);
router.patch('/resume', resume);
router.post('/stop', stop);
router.delete('/discard', discard);

export default router;
