import type { TaskStatus, TaskPriority } from '../types';

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  submitted:  { label: 'Submitted',  className: 'badge bg-blue-100 text-blue-700' },
  in_review:  { label: 'In Review',  className: 'badge bg-yellow-100 text-yellow-700' },
  approved:   { label: 'Approved',   className: 'badge bg-green-100 text-green-700' },
  rejected:   { label: 'Rejected',   className: 'badge bg-red-100 text-red-700' },
  completed:  { label: 'Completed',  className: 'badge bg-gray-200 text-gray-700' },
};

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  low:      { label: 'Low',      className: 'badge bg-gray-100 text-gray-600' },
  medium:   { label: 'Medium',   className: 'badge bg-blue-100 text-blue-700' },
  high:     { label: 'High',     className: 'badge bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', className: 'badge bg-red-100 text-red-700' },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status] ?? { label: status, className: 'badge bg-gray-100 text-gray-600' };
  return <span className={cfg.className}>{cfg.label}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = priorityConfig[priority] ?? { label: priority, className: 'badge bg-gray-100 text-gray-600' };
  return <span className={cfg.className}>{cfg.label}</span>;
}
