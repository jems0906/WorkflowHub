import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { taskService } from '../services/task.service';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useState } from 'react';

const statusOptions = ['submitted', 'in_review', 'approved', 'rejected', 'completed'] as const;

export default function TaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [comment, setComment] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<(typeof statusOptions)[number]>('in_review');

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => taskService.getTask(id),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['task', id, 'comments'],
    queryFn: () => taskService.getComments(id),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['task', id, 'history'],
    queryFn: () => taskService.getHistory(id),
    enabled: !!id,
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => taskService.addComment(id, content),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['task', id, 'comments'] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (payload: { status: string; note?: string }) =>
      taskService.updateStatus(id, payload.status, payload.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['task', id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
      setStatusNote('');
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => taskService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] });
      toast.success('Task deleted');
      navigate('/tasks');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!task) {
    return <p className="text-gray-500">Task not found.</p>;
  }

  const canReview = user?.role === 'reviewer' || user?.role === 'admin';
  const canDelete = user?.role === 'admin' || task.created_by === user?.id;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
            <p className="text-gray-600 mt-2 whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
            <div className="flex items-center gap-2 mt-4">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="mt-4 text-sm text-gray-500 space-y-1">
              <p>Created by: <span className="text-gray-700">{task.created_by_name ?? '-'}</span></p>
              <p>Assigned to: <span className="text-gray-700">{task.assigned_to_name ?? '-'}</span></p>
              <p>Due date: <span className="text-gray-700">{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}</span></p>
            </div>
          </div>
          {canDelete && (
            <button
              onClick={() => deleteTaskMutation.mutate()}
              className="btn-danger"
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete Task'}
            </button>
          )}
        </div>
      </div>

      {canReview && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Review Action</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label">New Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as (typeof statusOptions)[number])}
                title="New task status"
                className="input"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Note (optional)</label>
              <input
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                className="input"
                placeholder="Add a review note..."
              />
            </div>
          </div>
          <button
            onClick={() => updateStatusMutation.mutate({ status: selectedStatus, note: statusNote || undefined })}
            className="btn-primary mt-3"
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Comments</h2>
          <div className="space-y-3 max-h-80 overflow-auto pr-1">
            {comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-700">{c.user_name ?? 'Unknown'}</span>
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="label">Add Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="input min-h-24"
              placeholder="Write a comment..."
            />
            <button
              className="btn-primary mt-2"
              onClick={() => {
                if (!comment.trim()) return;
                addCommentMutation.mutate(comment.trim());
              }}
              disabled={addCommentMutation.isPending}
            >
              {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Audit Log</h2>
          <div className="space-y-3 max-h-96 overflow-auto pr-1">
            {history.length === 0 && <p className="text-sm text-gray-500">No history entries yet.</p>}
            {history.map((entry) => (
              <div key={entry.id} className="relative pl-4">
                <span className="absolute left-0 top-2 w-2 h-2 rounded-full bg-brand-500" />
                <p className="text-sm text-gray-800">
                  <span className="font-medium">{entry.changed_by_name ?? 'Unknown'}</span>{' '}
                  changed status to{' '}
                  <span className="font-medium">{entry.new_status.replace('_', ' ')}</span>
                </p>
                {entry.note && <p className="text-sm text-gray-600 mt-0.5">{entry.note}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
