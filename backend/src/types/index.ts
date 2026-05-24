export type UserRole = 'user' | 'reviewer' | 'admin';
export type TaskStatus = 'submitted' | 'in_review' | 'approved' | 'rejected' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface StatusHistory {
  id: string;
  task_id: string;
  changed_by: string;
  old_status?: TaskStatus;
  new_status: TaskStatus;
  note?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id?: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole; email: string; name: string };
    }
  }
}
