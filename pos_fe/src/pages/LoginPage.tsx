import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Mail, Lock, AlertCircle, Building2, User } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import {
  changePasswordWithCredentials,
  requestPasswordResetOtp,
  confirmPasswordResetOtp,
} from '../service/authService';

const parseApiError = (err: any, fallback: string) => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.detail === 'string') return data.detail;

  const walk = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }
    if (typeof value === 'object') {
      for (const key of Object.keys(value)) {
        const found = walk(value[key]);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(data) || fallback;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, registerWithStore, loadUserFromToken, isAuthenticated, settings } = useAuthStore();

  const [flow, setFlow] = useState<'existing' | 'new' | 'change' | 'forgot'>('existing');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [storeState, setStoreState] = useState('');
  const [storePincode, setStorePincode] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [setupError, setSetupError] = useState('');
  const [changeEmail, setChangeEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeError, setChangeError] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);

  const isDarkMode = settings.general.theme === 'dark';

  useEffect(() => {
    if (isAuthenticated && !isSetupInProgress) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isSetupInProgress, navigate]);

  const handleExistingUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid email or password');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    setInfoMessage('');

    if (!changeEmail || !currentPassword || !newPassword || !confirmNewPassword) {
      setChangeError('Please fill all fields');
      return;
    }
    if (newPassword.length < 8) {
      setChangeError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangeError('New password and confirm password must match');
      return;
    }
    if (newPassword === currentPassword) {
      setChangeError('New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePasswordWithCredentials(changeEmail, currentPassword, newPassword);
      setChangeEmail('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setFlow('existing');
      setEmail(changeEmail);
      setPassword('');
      setInfoMessage('Password changed successfully. Sign in with your new password.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const oldPasswordError = err?.response?.data?.old_password?.[0];
      if (oldPasswordError) {
        setChangeError(oldPasswordError);
      } else if (typeof detail === 'string') {
        setChangeError(detail);
      } else {
        setChangeError('Unable to change password. Please verify your current credentials.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRequestForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotInfo('');

    if (!forgotEmail) {
      setForgotError('Please enter your login email.');
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await requestPasswordResetOtp(forgotEmail);
      setOtpRequested(true);
      setForgotInfo(
        res?.detail || 'If the account exists, an OTP has been sent to the store recovery email.'
      );
    } catch (err: any) {
      setForgotError(err?.response?.data?.detail || 'Unable to request OTP. Please try again.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleConfirmForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotInfo('');

    if (!forgotEmail || !forgotOtp || !forgotNewPassword || !forgotConfirmPassword) {
      setForgotError('Please fill all fields.');
      return;
    }
    if (forgotOtp.length !== 6 || !/^\d{6}$/.test(forgotOtp)) {
      setForgotError('OTP must be a 6-digit number.');
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError('New password must be at least 8 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('New password and confirm password must match.');
      return;
    }

    setIsForgotLoading(true);
    try {
      await confirmPasswordResetOtp(forgotEmail, forgotOtp, forgotNewPassword);
      setForgotOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setOtpRequested(false);
      setFlow('existing');
      setEmail(forgotEmail);
      setPassword('');
      setInfoMessage('Password reset successfully. Sign in with your new password.');
    } catch (err: any) {
      setForgotError(err?.response?.data?.detail || 'Invalid or expired OTP.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleNewUserSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!ownerName || !ownerEmail || !ownerPassword) {
      setSetupError('Please enter owner name, email and password');
      return;
    }
    if (ownerPassword.length < 8) {
      setSetupError('Password must be at least 8 characters long');
      return;
    }
    if (ownerPassword !== confirmPassword) {
      setSetupError('Password and confirm password must match');
      return;
    }
    if (
      !storeName ||
      !storeCode ||
      !storeAddress ||
      !storeCity ||
      !storeState ||
      !storePincode ||
      !storePhone ||
      !recoveryEmail
    ) {
      setSetupError('Please fill all mandatory store fields');
      return;
    }
    setIsSetupInProgress(true);
    setIsLoading(true);

    try {
      const registered = await registerWithStore({
        name: ownerName,
        email: ownerEmail,
        password: ownerPassword,
        store: {
          name: storeName,
          code: storeCode,
          address: storeAddress,
          city: storeCity,
          state: storeState,
          pincode: storePincode,
          phone: storePhone,
          recovery_email: recoveryEmail,
          email: storeEmail || ownerEmail || null,
          is_active: true,
        },
      });
      if (!registered.ok || !registered.storeId) {
        setSetupError('Unable to register user. Try a different email.');
        return;
      }

      await loadUserFromToken();
      navigate('/initial-upload');
    } catch (err: any) {
      console.error(err);
      setSetupError(parseApiError(err, 'Initial setup failed. Please verify store data and file format.'));
    } finally {
      setIsLoading(false);
      setIsSetupInProgress(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 ${
        isDarkMode ? 'dark' : ''
      }`}
    >
      <div className="max-w-3xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden animate-fade-in">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 mb-3">
                <Wallet size={32} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">BillSathi</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Choose your flow to continue</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setFlow('existing');
                setError('');
                setSetupError('');
                setChangeError('');
                setForgotError('');
                setForgotInfo('');
              }}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                flow === 'existing'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Existing User Login
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow('new');
                setError('');
                setSetupError('');
                setChangeError('');
                setForgotError('');
                setForgotInfo('');
                setInfoMessage('');
              }}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                flow === 'new'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              New Store Setup
            </button>
          </div>

          {flow !== 'new' && (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setFlow('existing');
                  setError('');
                  setChangeError('');
                  setForgotError('');
                  setForgotInfo('');
                  setInfoMessage('');
                }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  flow === 'existing'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                Login
              </button>
            <button
              type="button"
              onClick={() => {
                setChangeError('');
                setFlow('change');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                flow === 'change'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotError('');
                setForgotInfo('');
                setFlow('forgot');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                flow === 'forgot'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Forgot Password
            </button>
            </div>
          )}

          {flow === 'existing' && (
            <>
              {infoMessage && (
                <div className="mb-4 p-3 bg-success-50 dark:bg-success-900/50 text-success-700 dark:text-success-400 rounded-lg animate-fade-in">
                  {infoMessage}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/50 text-error-700 dark:text-error-400 rounded-lg flex items-center animate-fade-in">
                  <AlertCircle size={18} className="mr-2" />
                  {error}
                </div>
              )}

              <form onSubmit={handleExistingUserLogin}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setFlow('forgot');
                        setError('');
                        setSetupError('');
                        setChangeError('');
                        setForgotError('');
                        setForgotInfo('');
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {flow === 'change' && (
            <>
              {changeError && (
                <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/50 text-error-700 dark:text-error-400 rounded-lg flex items-center animate-fade-in">
                  <AlertCircle size={18} className="mr-2" />
                  {changeError}
                </div>
              )}

              <form onSubmit={handleChangePassword}>
                <div className="mb-4">
                  <label htmlFor="change-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="change-email"
                      type="email"
                      value={changeEmail}
                      onChange={(e) => setChangeEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="Current password"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="New password (min 8 chars)"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="confirm-new-password"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className={`w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isChangingPassword ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isChangingPassword ? 'Updating password...' : 'Change Password'}
                </button>
              </form>

              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Forgot current password? Ask your admin to reset it from the Users page.
              </p>
            </>
          )}

          {flow === 'forgot' && (
            <>
              {forgotInfo && (
                <div className="mb-4 p-3 bg-success-50 dark:bg-success-900/50 text-success-700 dark:text-success-400 rounded-lg animate-fade-in">
                  {forgotInfo}
                </div>
              )}

              {forgotError && (
                <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/50 text-error-700 dark:text-error-400 rounded-lg flex items-center animate-fade-in">
                  <AlertCircle size={18} className="mr-2" />
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleRequestForgotOtp}>
                <div className="mb-4">
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Login Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={16} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className={`w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isForgotLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isForgotLoading ? 'Sending OTP...' : otpRequested ? 'Resend OTP' : 'Send OTP'}
                </button>
              </form>

              {otpRequested && (
                <form onSubmit={handleConfirmForgotOtp} className="mt-4 border-t pt-4 border-gray-200 dark:border-gray-700">
                  <div className="mb-4">
                    <label htmlFor="forgot-otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      OTP
                    </label>
                    <input
                      id="forgot-otp"
                      type="text"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                      placeholder="6-digit OTP"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="forgot-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={16} className="text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="forgot-new-password"
                        type="password"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                        placeholder="New password (min 8 chars)"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="forgot-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={16} className="text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="forgot-confirm-password"
                        type="password"
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-gray-100 transition-colors"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isForgotLoading}
                    className={`w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      isForgotLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {isForgotLoading ? 'Resetting password...' : 'Reset Password'}
                  </button>
                </form>
              )}

              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                OTP is sent to the store recovery email configured during setup.
              </p>
            </>
          )}

          {flow === 'new' && (
            <>
              {setupError && (
                <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/50 text-error-700 dark:text-error-400 rounded-lg flex items-center animate-fade-in">
                  <AlertCircle size={18} className="mr-2" />
                  {setupError}
                </div>
              )}

              <form onSubmit={handleNewUserSetup} className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Owner Account</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Owner name"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                    />
                  </div>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="Owner email"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                    />
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Password (min 8 chars)"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                    />
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide pt-2">Store Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Store name"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                    />
                  </div>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    placeholder="Store code (e.g. BLR01)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="Address"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100 md:col-span-2"
                  />
                  <input
                    type="text"
                    value={storeCity}
                    onChange={(e) => setStoreCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={storeState}
                    onChange={(e) => setStoreState(e.target.value)}
                    placeholder="State"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={storePincode}
                    onChange={(e) => setStorePincode(e.target.value)}
                    placeholder="Pincode"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                  />
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100"
                  />
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="Recovery email (mandatory)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100 md:col-span-2"
                  />
                  <input
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    placeholder="Store email (optional)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100 md:col-span-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Setting up store...' : 'Create Store and Continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
