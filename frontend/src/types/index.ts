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
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  created_by_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name?: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  task_id: string;
  changed_by: string;
  changed_by_name?: string;
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

export interface TasksResponse {
  data: Task[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  total: number;
  by_status: { status: TaskStatus; count: string }[];
  by_priority: { priority: TaskPriority; count: string }[];
  recent: Task[];
}

export interface AuthResponse {
  user: User;
  token: string;
}
