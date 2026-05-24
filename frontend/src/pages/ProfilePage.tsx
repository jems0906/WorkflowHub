import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      await api.put(`/users/${user.id}`, { name, avatar_url: avatarUrl || null });
      await refreshUser();
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || newPassword.length < 8) {
      toast.error('Enter valid password values');
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed');
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account information</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Basic Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-name" className="label">Name</label>
            <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="profile-email" className="label">Email</label>
            <input id="profile-email" title="Email" value={user?.email ?? ''} className="input bg-gray-50" disabled />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="profile-avatar" className="label">Avatar URL</label>
            <input id="profile-avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="input" />
          </div>
        </div>
        <button onClick={saveProfile} className="btn-primary" disabled={savingProfile}>
          {savingProfile ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Change Password</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-current-password" className="label">Current password</label>
            <input
              id="profile-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="profile-new-password" className="label">New password</label>
            <input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              minLength={8}
            />
          </div>
        </div>
        <button onClick={changePassword} className="btn-primary" disabled={savingPassword}>
          {savingPassword ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}
