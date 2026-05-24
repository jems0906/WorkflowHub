import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';

export async function listUsers(req: Request, res: Response): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, avatar_url, created_at FROM users ORDER BY created_at DESC`
  );
  res.json(rows);
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(rows[0]);
}

export const updateUserValidation = [
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['user', 'reviewer', 'admin']),
];

export async function updateUser(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { id } = req.params;
  const { name, role, avatar_url } = req.body as { name?: string; role?: string; avatar_url?: string };

  // Non-admins can only edit their own profile and cannot change role
  if (req.user!.role !== 'admin') {
    if (id !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (role) {
      res.status(403).json({ error: 'Cannot change own role' });
      return;
    }
  }

  const { rows } = await pool.query(
    `UPDATE users SET
       name       = COALESCE($1, name),
       role       = COALESCE($2, role),
       avatar_url = COALESCE($3, avatar_url),
       updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, email, role, avatar_url, created_at`,
    [name ?? null, role ?? null, avatar_url ?? null, id]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(rows[0]);
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (id === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }

  const { rowCount } = await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
  if ((rowCount ?? 0) === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(204).send();
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(422).json({ error: 'Invalid password data' });
    return;
  }

  const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, req.user!.id]);

  res.json({ success: true });
}
