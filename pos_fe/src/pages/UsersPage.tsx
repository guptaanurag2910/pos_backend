import { useEffect, useState } from 'react';
import { Users, UserPlus, Search, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/authStore';

type UserRole = 'admin' | 'manager' | 'cashier';

const defaultCreateForm = {
  name: '',
  email: '',
  role: 'cashier' as UserRole,
  password: '',
};

const defaultEditForm = {
  name: '',
  email: '',
  role: 'cashier' as UserRole,
};

const getErrorMessage = (err: unknown, fallback: string) => {
  const error = err as { response?: { data?: unknown } };
  const data = error?.response?.data;

  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;

    const firstFieldError = Object.values(data as Record<string, unknown>).find(
      (value) => Array.isArray(value) && value.length > 0 && typeof value[0] === 'string'
    ) as string[] | undefined;
    if (firstFieldError?.[0]) return firstFieldError[0];
  }

  return fallback;
};

const coerceRole = (role: string): UserRole => {
  if (role === 'admin' || role === 'manager' || role === 'cashier') return role;
  return 'cashier';
};

const UsersPage = () => {
  const {
    users,
    user: currentUser,
    addUser,
    updateUserDetails,
    resetUserPassword,
    toggleUserStatus,
    loadUsers,
  } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [passwordTargetUserId, setPasswordTargetUserId] = useState<string | null>(null);

  const [newUser, setNewUser] = useState(defaultCreateForm);
  const [editUser, setEditUser] = useState(defaultEditForm);
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const currentStoreLabel = currentUser?.storeId
    ? `Store #${currentUser.storeId} (Logged-in)`
    : 'Logged-in Store';

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newUser.password && newUser.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsAdding(true);
    try {
      const creds = await addUser({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        password: newUser.password || undefined,
      });
      setShowAddModal(false);
      setCreatedCreds(creds);
      setNewUser(defaultCreateForm);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add user'));
    } finally {
      setIsAdding(false);
    }
  };

  const openEditModal = (userId: string) => {
    const target = users.find((user) => String(user.id) === String(userId));
    if (!target) return;
    setError('');
    setEditingUserId(target.id);
    setEditUser({
      name: target.name,
      email: target.email,
      role: coerceRole(target.role),
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setError('');
    setIsUpdating(true);
    try {
      await updateUserDetails(editingUserId, editUser);
      setEditingUserId(null);
      setEditUser(defaultEditForm);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update user'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUserId) return;
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setIsResettingPassword(true);
    try {
      await resetUserPassword(passwordTargetUserId, newPassword);
      setPasswordTargetUserId(null);
      setNewPassword('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    setError('');
    try {
      await toggleUserStatus(userId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update user status'));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-gray-600">Manage system users and permissions</p>
        </div>

        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => {
              setError('');
              setShowAddModal(true);
            }}
            className="flex items-center py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <UserPlus size={18} className="mr-2" />
            Add User
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-50 text-error-700 rounded-lg flex items-center">
          <AlertCircle size={18} className="mr-2" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users by name, email or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Store
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium">
                        {user.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin'
                          ? 'bg-primary-100 text-primary-800'
                          : user.role === 'manager'
                            ? 'bg-secondary-100 text-secondary-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{currentStoreLabel}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.active ? 'bg-success-100 text-success-800' : 'bg-error-100 text-error-800'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEditModal(user.id)} className="text-primary-600 hover:text-primary-800">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setError('');
                          setPasswordTargetUserId(user.id);
                          setNewPassword('');
                        }}
                        className="text-secondary-700 hover:text-secondary-900"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        className={user.active ? 'text-error-600 hover:text-error-800' : 'text-success-600 hover:text-success-800'}
                      >
                        {user.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                <Users size={32} />
              </div>
              <p className="text-gray-500 font-medium">No users found</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery ? 'Try adjusting your search' : 'Add users to see them here'}
              </p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">Add New User</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: coerceRole(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password (Optional)</label>
                  <input
                    type="text"
                    value={newUser.password}
                    placeholder="Leave blank to auto-generate"
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <input
                    type="text"
                    disabled
                    value={currentStoreLabel}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {isAdding ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">Update User</h2>
              <button
                onClick={() => {
                  setEditingUserId(null);
                  setError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: coerceRole(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <input
                  type="text"
                  disabled
                  value={currentStoreLabel}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUserId(null);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {isUpdating ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordTargetUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">Reset Password</h2>
              <button
                onClick={() => {
                  setPasswordTargetUserId(null);
                  setError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <p className="text-xs text-gray-500">Minimum 8 characters.</p>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordTargetUserId(null);
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdCreds && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">Login Credentials</h2>
              <button
                onClick={() => setCreatedCreds(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">Share these credentials with the new user.</p>
              <div className="rounded border p-3">
                <div className="text-xs text-gray-500">Email</div>
                <div className="font-medium text-gray-900">{createdCreds.email}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-xs text-gray-500">Password</div>
                <div className="font-medium text-gray-900">{createdCreds.password}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
