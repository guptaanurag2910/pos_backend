import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Mail, Lock, AlertCircle, Building2, UploadCloud, User } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { bootstrapStoreImport, createStore } from '../service/storeService';
import { patchUser } from '../service/authService';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, register, loadUserFromToken, isAuthenticated, settings } = useAuthStore();

  const [flow, setFlow] = useState<'existing' | 'new'>('existing');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
  const [strictImport, setStrictImport] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [setupError, setSetupError] = useState('');
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
    if (!storeName || !storeCode || !storeAddress || !storeCity || !storeState || !storePincode || !storePhone) {
      setSetupError('Please fill all mandatory store fields');
      return;
    }
    if (!importFile) {
      setSetupError('Please upload the setup Excel file');
      return;
    }

    setIsSetupInProgress(true);
    setIsLoading(true);

    try {
      const registered = await register(ownerName, ownerEmail, ownerPassword);
      if (!registered) {
        setSetupError('Unable to register user. Try a different email.');
        return;
      }
      await loadUserFromToken();

      const newStore = await createStore({
        name: storeName,
        code: storeCode,
        address: storeAddress,
        city: storeCity,
        state: storeState,
        pincode: storePincode,
        phone: storePhone,
        email: storeEmail || null,
        is_main: true,
        is_active: true,
      });

      const currentUserId = Number(useAuthStore.getState().user?.id || 0);
      if (currentUserId > 0) {
        await patchUser(currentUserId, { store: newStore.id, role: 'admin' });
      }

      await bootstrapStoreImport(newStore.id, importFile, strictImport);
      await loadUserFromToken();
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setSetupError(err?.response?.data?.detail || 'Initial setup failed. Please verify store data and file format.');
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

          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => setFlow('existing')}
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
              onClick={() => setFlow('new')}
              className={`py-2 rounded-md text-sm font-medium transition-colors ${
                flow === 'new'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              New Store Setup
            </button>
          </div>

          {flow === 'existing' && (
            <>
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
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    placeholder="Store email (optional)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-gray-100 md:col-span-2"
                  />
                </div>

                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide pt-2">Initial Data Upload</h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="/bootstrap/store_bootstrap_designed_template.xlsx"
                      download
                      className="inline-flex items-center px-3 py-2 text-sm border border-primary-300 text-primary-700 dark:text-primary-300 dark:border-primary-500 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30"
                    >
                      Download Designed Template
                    </a>
                    <a
                      href="/bootstrap/store_bootstrap_sample.xlsx"
                      download
                      className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Download Sample File
                    </a>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <UploadCloud size={16} />
                    Upload setup Excel file (.xlsx)
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-700 dark:text-gray-200"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={strictImport} onChange={(e) => setStrictImport(e.target.checked)} />
                    Strict import mode (stop on invalid rows)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? 'Setting up store...' : 'Create Store and Import Data'}
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
