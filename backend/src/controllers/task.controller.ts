import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { TaskStatus, TaskPriority } from '../types';
import { createNotification, sendWorkflowEmailToUser } from '../services/notification.service';

export const createTaskValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('due_date').optional().isISO8601(),
];

export async function createTask(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { title, description, priority = 'medium', assigned_to, due_date, tags } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, priority, created_by, assigned_to, due_date, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [title, description ?? null, priority, req.user!.id, assigned_to ?? null, due_date ?? null, tags ?? null]
  );

  const task = rows[0];

  // Audit log
  await pool.query(
    `INSERT INTO status_history (task_id, changed_by, new_status, note)
     VALUES ($1,$2,$3,$4)`,
    [task.id, req.user!.id, 'submitted', 'Task created']
  );

  // Notify assigned reviewer if set
  if (assigned_to) {
    await createNotification(assigned_to, `You have been assigned task: "${title}"`, task.id);
    await sendWorkflowEmailToUser(
      assigned_to,
      `Task assigned: ${title}`,
      `You have been assigned a task.\n\nTitle: ${title}\nStatus: submitted\nPriority: ${priority}`
    );

    await pool.query(
      `INSERT INTO status_history (task_id, changed_by, old_status, new_status, note) VALUES ($1,$2,$3,$4,$5)`,
      [task.id, req.user!.id, task.status, task.status, `Email notification sent to assignee (${assigned_to})`]
    );
  }

  // Notify all reviewers/admins a new task was submitted
  const { rows: reviewers } = await pool.query(
    `SELECT id FROM users WHERE role IN ('reviewer','admin') AND id != $1`,
    [req.user!.id]
  );
  await Promise.all(
    reviewers.map((r: { id: string }) =>
      createNotification(r.id, `New task submitted: "${title}"`, task.id)
    )
  );

  await Promise.all(
    reviewers.map((r: { id: string }) =>
      sendWorkflowEmailToUser(
        r.id,
        `New task submitted: ${title}`,
        `A new task was submitted and may require review.\n\nTitle: ${title}`
      )
    )
  );

  await pool.query(
    `INSERT INTO status_history (task_id, changed_by, old_status, new_status, note) VALUES ($1,$2,$3,$4,$5)`,
    [task.id, req.user!.id, task.status, task.status, `Email notifications sent to ${reviewers.length} reviewer/admin recipient(s)`]
  );

  res.status(201).json(task);
}

export async function getTasks(req: Request, res: Response): Promise<void> {
  const {
    status,
    priority,
    search,
    assigned_to,
    page = '1',
    limit = '20',
    sort_by = 'created_at',
    sort_dir = 'desc',
  } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  // Regular users only see their own tasks
  if (req.user!.role === 'user') {
    conditions.push(`(t.created_by = $${idx} OR t.assigned_to = $${idx})`);
    params.push(req.user!.id);
    idx++;
  }

  if (status) {
    conditions.push(`t.status = $${idx}`);
    params.push(status);
    idx++;
  }

  if (priority) {
    conditions.push(`t.priority = $${idx}`);
    params.push(priority);
    idx++;
  }

  if (assigned_to) {
    conditions.push(`t.assigned_to = $${idx}`);
    params.push(assigned_to);
    idx++;
  }

  if (search) {
    conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const sortMap: Record<string, string> = {
    created_at: 't.created_at',
    updated_at: 't.updated_at',
    title: 't.title',
    priority: 't.priority',
    status: 't.status',
  };
  const orderBy = sortMap[sort_by] ?? 't.created_at';
  const orderDir = sort_dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countQuery = `SELECT COUNT(*) FROM tasks t ${whereClause}`;
  const dataQuery = `
    SELECT
      t.*,
      u1.name AS created_by_name,
      u2.name AS assigned_to_name
    FROM tasks t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.assigned_to = u2.id
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const [countRes, dataRes] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, parseInt(limit), offset]),
  ]);

  res.json({
    data: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: parseInt(page),
    limit: parseInt(limit),
  });
}

export async function getTaskById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT t.*, u1.name AS created_by_name, u2.name AS assigned_to_name
     FROM tasks t
     LEFT JOIN users u1 ON t.created_by = u1.id
     LEFT JOIN users u2 ON t.assigned_to = u2.id
     WHERE t.id = $1`,
    [id]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const task = rows[0];

  // Regular users can only see their own tasks
  if (req.user!.role === 'user' && task.created_by !== req.user!.id && task.assigned_to !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json(task);
}

export async function updateTaskStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, note } = req.body as { status: TaskStatus; note?: string };

  const validStatuses: TaskStatus[] = ['submitted', 'in_review', 'approved', 'rejected', 'completed'];
  if (!validStatuses.includes(status)) {
    res.status(422).json({ error: 'Invalid status' });
    return;
  }

  // Fetch task
  const { rows } = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const task = rows[0];

  // Permission check: users can only submit/complete their own tasks
  if (req.user!.role === 'user') {
    const allowed: TaskStatus[] = ['submitted', 'completed'];
    if (!allowed.includes(status) || task.created_by !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const oldStatus = task.status;

  await pool.query(`UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);

  // Audit log
  await pool.query(
    `INSERT INTO status_history (task_id, changed_by, old_status, new_status, note) VALUES ($1,$2,$3,$4,$5)`,
    [id, req.user!.id, oldStatus, status, note ?? null]
  );

  // Notify task owner
  if (task.created_by !== req.user!.id) {
    await createNotification(
      task.created_by,
      `Your task "${task.title}" status changed to ${status}`,
      id
    );
    await sendWorkflowEmailToUser(
      task.created_by,
      `Task status updated: ${task.title}`,
      `Your task status changed from ${oldStatus} to ${status}.${note ? `\n\nNote: ${note}` : ''}`
    );

    await pool.query(
      `INSERT INTO status_history (task_id, changed_by, old_status, new_status, note) VALUES ($1,$2,$3,$4,$5)`,
      [id, req.user!.id, status, status, `Email notification sent to task owner (${task.created_by})`]
    );
  }

  res.json({ ...task, status, updated_at: new Date().toISOString() });
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { title, description, priority, assigned_to, due_date, tags } = req.body as {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    assigned_to?: string;
    due_date?: string;
    tags?: string[];
  };

  const { rows } = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const task = rows[0];

  // Only creator or admin can edit task details
  if (req.user!.role === 'user' && task.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updated = await pool.query(
    `UPDATE tasks SET
       title       = COALESCE($1, title),
       description = COALESCE($2, description),
       priority    = COALESCE($3, priority),
       assigned_to = COALESCE($4, assigned_to),
       due_date    = COALESCE($5, due_date),
       tags        = COALESCE($6, tags),
       updated_at  = NOW()
     WHERE id = $7 RETURNING *`,
    [title ?? null, description ?? null, priority ?? null, assigned_to ?? null, due_date ?? null, tags ?? null, id]
  );

  if (assigned_to && assigned_to !== task.assigned_to) {
    await createNotification(assigned_to, `You have been assigned task: "${updated.rows[0].title}"`, id);
    await sendWorkflowEmailToUser(
      assigned_to,
      `Task reassigned: ${updated.rows[0].title}`,
      `A task has been reassigned to you.\n\nTitle: ${updated.rows[0].title}\nStatus: ${updated.rows[0].status}`
    );

    await pool.query(
      `INSERT INTO status_history (task_id, changed_by, old_status, new_status, note) VALUES ($1,$2,$3,$4,$5)`,
      [id, req.user!.id, updated.rows[0].status, updated.rows[0].status, `Email notification sent for reassignment to (${assigned_to})`]
    );
  }

  res.json(updated.rows[0]);
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { rows } = await pool.query(`SELECT * FROM tasks WHERE id = $1`, [id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (req.user!.role === 'user' && rows[0].created_by !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  res.status(204).send();
}

export async function getTaskHistory(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT sh.*, u.name AS changed_by_name
     FROM status_history sh
     JOIN users u ON sh.changed_by = u.id
     WHERE sh.task_id = $1
     ORDER BY sh.created_at ASC`,
    [id]
  );

  res.json(rows);
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role !== 'user';
  const userId = req.user!.id;

  const baseFilter = isAdmin ? '' : `WHERE created_by = '${userId}' OR assigned_to = '${userId}'`;

  const [total, byStatus, byPriority, recent] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM tasks ${baseFilter}`),
    pool.query(
      `SELECT status, COUNT(*) AS count FROM tasks ${baseFilter} GROUP BY status`
    ),
    pool.query(
      `SELECT priority, COUNT(*) AS count FROM tasks ${baseFilter} GROUP BY priority`
    ),
    pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.created_at, u.name AS created_by_name
       FROM tasks t JOIN users u ON t.created_by = u.id
       ${baseFilter}
       ORDER BY t.created_at DESC LIMIT 5`
    ),
  ]);

  res.json({
    total: parseInt(total.rows[0].count),
    by_status: byStatus.rows,
    by_priority: byPriority.rows,
    recent: recent.rows,
  });
}
