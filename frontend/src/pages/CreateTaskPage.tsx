import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../services/task.service';
import api from '../services/api';
import type { User } from '../types';
import toast from 'react-hot-toast';

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users', 'assignable'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/users');
      return data;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: taskService.createTask,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
      toast.success('Task created');
      navigate(`/tasks/${task.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create task';
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    createTaskMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assigned_to: assignedTo || undefined,
      due_date: dueDate || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Task</h1>
        <p className="text-gray-500 text-sm mt-1">Submit a new request into the workflow</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
            <label htmlFor="task-title" className="label">Title</label>
          <input
              id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="e.g. Approve Q3 marketing budget"
            required
          />
        </div>

        <div>
            <label htmlFor="task-description" className="label">Description</label>
          <textarea
              id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-32"
            placeholder="Provide context and details..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="task-priority" className="label">Priority</label>
            <select id="task-priority" title="Task priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="task-assignee" className="label">Assign To (optional)</label>
            <select id="task-assignee" title="Assigned user" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input">
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-due-date" className="label">Due Date (optional)</label>
            <input id="task-due-date" title="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="input" />
          </div>

          <div>
            <label htmlFor="task-tags" className="label">Tags (optional)</label>
            <input
              id="task-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input"
              placeholder="budget, legal, urgent"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={createTaskMutation.isPending}>
            {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </div>
  );
}
