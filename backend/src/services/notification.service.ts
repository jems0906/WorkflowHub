import { pool } from '../db/pool';
import { Notification } from '../types';
import nodemailer from 'nodemailer';

export async function createNotification(
  userId: string,
  message: string,
  taskId?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (user_id, task_id, message) VALUES ($1, $2, $3)`,
    [userId, taskId ?? null, message]
  );
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { rows } = await pool.query<Notification>(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return rows;
}

export async function markRead(notificationId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
    [userId]
  );
}

const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10);
const smtpEnabled = !!process.env.SMTP_HOST && !!process.env.SMTP_FROM;

const transporter = smtpEnabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    })
  : null;

export async function sendWorkflowEmailToUser(
  userId: string,
  subject: string,
  message: string
): Promise<void> {
  if (!transporter) return;

  try {
    const { rows } = await pool.query<{ email: string; name: string }>(
      `SELECT email, name FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!rows.length) return;

    const recipient = rows[0];
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipient.email,
      subject,
      text: `Hello ${recipient.name},\n\n${message}\n\n- WorkflowHub`,
    });
  } catch (err) {
    // Email is best-effort. Do not fail API requests if SMTP is unavailable.
    console.warn('Email send failed:', err);
  }
}
