import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { createNotification, sendWorkflowEmailToUser } from '../services/notification.service';

export const commentValidation = [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
];

export async function getComments(req: Request, res: Response): Promise<void> {
  const { taskId } = req.params;

  const { rows } = await pool.query(
    `SELECT c.*, u.name AS user_name, u.avatar_url
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.task_id = $1
     ORDER BY c.created_at ASC`,
    [taskId]
  );

  res.json(rows);
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { taskId } = req.params;
  const { content } = req.body as { content: string };

  // Verify task exists
  const taskCheck = await pool.query(`SELECT id, title, created_by, status FROM tasks WHERE id = $1`, [taskId]);
  if (taskCheck.rows.length === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO comments (task_id, user_id, content) VALUES ($1,$2,$3)
     RETURNING *`,
    [taskId, req.user!.id, content]
  );

  const comment = rows[0];

  // Notify task owner if commenter is different
  const task = taskCheck.rows[0];
  if (task.created_by !== req.user!.id) {
    await createNotification(
      task.created_by,
      `${req.user!.name} commented on your task "${task.title}"`,
      taskId
    );
    await sendWorkflowEmailToUser(
      task.created_by,
      `New comment on task: ${task.title}`,
      `${req.user!.name} added a comment on your task.\n\nComment: ${content}`
    );

    await pool.query(
      `INSERT INTO status_history (task_id, changed_by, old_status, new_status, note) VALUES ($1,$2,$3,$4,$5)`,
      [taskId, req.user!.id, task.status, task.status, `Email notification sent to task owner (${task.created_by}) for new comment`]
    );
  }

  const userRes = await pool.query(
    `SELECT name, avatar_url FROM users WHERE id = $1`,
    [req.user!.id]
  );

  res.status(201).json({ ...comment, user_name: userRes.rows[0]?.name, avatar_url: userRes.rows[0]?.avatar_url });
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { content } = req.body as { content: string };

  const { rows } = await pool.query(`SELECT * FROM comments WHERE id = $1`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (rows[0].user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updated = await pool.query(
    `UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [content, id]
  );

  res.json(updated.rows[0]);
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { rows } = await pool.query(`SELECT * FROM comments WHERE id = $1`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }

  if (rows[0].user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  await pool.query(`DELETE FROM comments WHERE id = $1`, [id]);
  res.status(204).send();
}
