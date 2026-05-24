import { useQuery } from '@tanstack/react-query';
import { taskService } from '../services/task.service';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import Spinner from '../components/Spinner';
import { CheckSquare, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import type { TaskStatus } from '../types';

const statusColors: Record<TaskStatus, string> = {
  submitted: 'bg-blue-500',
  in_review: 'bg-yellow-500',
  approved:  'bg-green-500',
  rejected:  'bg-red-500',
  completed: 'bg-gray-400',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: taskService.getStats,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner size="lg" />
      </div>
    );
  }

  const byStatus = Object.fromEntries(
    (stats?.by_status ?? []).map(({ status, count }) => [status, parseInt(count)])
  ) as Record<TaskStatus, number>;

  const summaryCards = [
    { label: 'Total Tasks', value: stats?.total ?? 0, icon: CheckSquare, color: 'text-brand-600 bg-brand-50' },
    { label: 'In Review',   value: byStatus.in_review ?? 0, icon: Clock,        color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Approved',    value: byStatus.approved  ?? 0, icon: TrendingUp,   color: 'text-green-600 bg-green-50' },
    { label: 'Rejected',    value: byStatus.rejected  ?? 0, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of all workflow activity</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Status Breakdown</h2>
          <div className="space-y-3">
            {(stats?.by_status ?? []).map(({ status, count }) => {
              const pct = stats && stats.total > 0 ? Math.round((parseInt(count) / stats.total) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium text-gray-700">{status.replace('_', ' ')}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <progress
                      value={pct}
                      max={100}
                      className={`w-full h-2 rounded-full overflow-hidden ${statusColors[status as TaskStatus] ?? 'bg-gray-400'}`}
                      title={`${status} ${pct}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent tasks */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">Recent Tasks</h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-sm text-brand-600 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {stats?.recent.length === 0 && (
              <p className="text-gray-500 text-sm">No tasks yet.</p>
            )}
            {stats?.recent.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.created_by_name}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
