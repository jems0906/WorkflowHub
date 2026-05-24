import { Request, Response } from 'express';
import { pool } from '../db/pool';
import {
  getNotifications,
  markRead,
  markAllRead,
} from '../services/notification.service';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const notifications = await getNotifications(req.user!.id);
  res.json(notifications);
}

export async function readNotification(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const updated = await markRead(id, req.user!.id);
  if (!updated) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ success: true });
}

export async function readAllNotifications(req: Request, res: Response): Promise<void> {
  await markAllRead(req.user!.id);
  res.json({ success: true });
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [req.user!.id]
  );
  res.json({ count: parseInt(rows[0].count) });
}
