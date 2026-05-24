import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { User, UserRole } from '../types';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('user');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/users');
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string; role: UserRole }) => {
      const { data } = await api.put<User>(`/users/${payload.id}`, {
        name: payload.name,
        role: payload.role,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
      toast.success('User updated');
    },
    onError: () => toast.error('Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted');
    },
    onError: () => toast.error('Failed to delete user'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">Manage roles and access</p>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-500">Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isEditing = editing === u.id;
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {isEditing ? (
                          <input title="User name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                        ) : (
                          u.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {isEditing ? (
                          <select title="User role" className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                            <option value="user">User</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          u.role
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                className="btn-primary px-3 py-1"
                                onClick={() => updateMutation.mutate({ id: u.id, name, role })}
                              >
                                Save
                              </button>
                              <button className="btn-secondary px-3 py-1" onClick={() => setEditing(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn-secondary px-3 py-1"
                                onClick={() => {
                                  setEditing(u.id);
                                  setName(u.name);
                                  setRole(u.role);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-danger px-3 py-1"
                                onClick={() => deleteMutation.mutate(u.id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
