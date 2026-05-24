import { Router } from 'express';
import {
  listNotifications,
  readNotification,
  readAllNotifications,
  getUnreadCount,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', readNotification);
router.patch('/read-all', readAllNotifications);

export default router;
