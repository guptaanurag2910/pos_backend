import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle } from 'lucide-react';
import { signupAPI } from '../service/authService';
import { useAuthStore } from '../stores/authStore';

const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !name || !password) {
      setError('Please fill all fields');
      return;
    }

    setIsLoading(true);

    try {
      await signupAPI(email, password, name);
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Signup failed. Try a different email.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900 flex items-center justify-center rounded-full">
            <UserPlus size={28} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="mt-3 text-xl font-semibold text-gray-800 dark:text-white">Create your account</h2>
        </div>

        {error && (
          <div className="mb-4 text-sm flex items-center bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-2 rounded">
            <AlertCircle size={18} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mb-3 px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-3 px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-6 px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition"
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <a href="/login" className="text-primary-600 dark:text-primary-400 underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
