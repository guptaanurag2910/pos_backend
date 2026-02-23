import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, ChevronDown, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const Header = () => {
  const navigate = useNavigate();
  const { user, logout, settings, toggleTheme } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isDarkMode = settings.general.theme === 'dark';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm py-4 px-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Welcome, {user?.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Today is {new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex items-center space-x-4">
        <button 
          onClick={toggleTheme}
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          <Bell size={20} />
          <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">
            3
          </span>
        </button>

        <div className="relative">
          <button
            onClick={toggleProfile}
            className="flex items-center space-x-2 focus:outline-none"
          >
            <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
              {user?.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">
              {user?.name}
            </span>
            <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 animate-fade-in">
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <User size={16} className="mr-2" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;