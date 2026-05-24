import api from './api';
import type {
  Task,
  TasksResponse,
  DashboardStats,
  StatusHistoryEntry,
  Comment,
} from '../types';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  search?: string;
  assigned_to?: string;
  page?: number;
  limit?: number;
}

export const taskService = {
  async getTasks(filters: TaskFilters = {}): Promise<TasksResponse> {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
    );
    const { data } = await api.get<TasksResponse>('/tasks', { params });
    return data;
  },

  async getTask(id: string): Promise<Task> {
    const { data } = await api.get<Task>(`/tasks/${id}`);
    return data;
  },

  async createTask(input: CreateTaskInput): Promise<Task> {
    const { data } = await api.post<Task>('/tasks', input);
    return data;
  },

  async updateTask(id: string, input: Partial<CreateTaskInput>): Promise<Task> {
    const { data } = await api.put<Task>(`/tasks/${id}`, input);
    return data;
  },

  async updateStatus(id: string, status: string, note?: string): Promise<Task> {
    const { data } = await api.patch<Task>(`/tasks/${id}/status`, { status, note });
    return data;
  },

  async deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  async getHistory(taskId: string): Promise<StatusHistoryEntry[]> {
    const { data } = await api.get<StatusHistoryEntry[]>(`/tasks/${taskId}/history`);
    return data;
  },

  async getComments(taskId: string): Promise<Comment[]> {
    const { data } = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
    return data;
  },

  async addComment(taskId: string, content: string): Promise<Comment> {
    const { data } = await api.post<Comment>(`/tasks/${taskId}/comments`, { content });
    return data;
  },

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
  },

  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>('/tasks/stats');
    return data;
  },
};
