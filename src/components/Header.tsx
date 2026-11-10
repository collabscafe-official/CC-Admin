
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/actions/authAction';
import collabs from '../config/collabs';
import { toast } from 'react-toastify';

interface HeaderProps {
  toggleSidebar: () => void;
}

const SunIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
    </svg>
);

const MoonIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
    </svg>
);

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const user = useSelector((state: any) => state.user);
  const dispatch = useDispatch();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same rule as the login form, or the new password could never sign in.
    if (!/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,50}$/.test(pw.next)) {
      toast.error('New password needs 8 to 50 characters with an uppercase letter, a lowercase letter, a number and a symbol, and no spaces');
      return;
    }
    if (pw.next !== pw.confirm) { toast.error('New passwords do not match'); return; }
    setPwSaving(true);
    try {
      const res = await collabs.post('/admin/account/change-password', { current_password: pw.current, new_password: pw.next });
      if (res.data?.success) {
        toast.success('Password changed');
        setPwOpen(false);
        setPw({ current: '', next: '', confirm: '' });
      } else {
        toast.error(res.data?.message || 'Could not change password');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not change password');
    } finally {
      setPwSaving(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="relative z-10 flex items-center justify-between flex-shrink-0 h-16 px-6 bg-white border-b dark:bg-dark-800 dark:border-dark-700">
      <button onClick={toggleSidebar} className="text-gray-500 md:hidden focus:outline-none">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6H20M4 12H20M4 18H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="flex items-center justify-end w-full space-x-4">
         <button
          onClick={toggleTheme}
          className="p-2 text-gray-500 rounded-full transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-dark-700 dark:text-gray-300 focus:outline-none"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-3 focus:outline-none">
            <span className="hidden text-sm font-medium text-gray-700 md:block dark:text-gray-300">{user?.name}</span>
            {!imageError && user?.avatarUrl ? (
              <img 
                className="object-cover w-10 h-10 rounded-full" 
                src={user?.avatarUrl} 
                alt="Your avatar"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white text-sm font-semibold">
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 w-48 mt-2 py-2 bg-white rounded-md shadow-xl dark:bg-dark-700">
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-800">
                Profile
              </a>
              <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-800">
                Settings
              </a>
              <button
                onClick={() => { setPwOpen(true); setDropdownOpen(false); }}
                className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-800"
              >
                Change password
              </button>
              <button
                onClick={() => {
                  dispatch(logout() as any);
                  setDropdownOpen(false);
                }}
                className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-800"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !pwSaving && setPwOpen(false)}>
          <form onSubmit={savePassword} onClick={e => e.stopPropagation()} className="w-full max-w-sm p-6 space-y-4 bg-white rounded-xl dark:bg-dark-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change password</h2>
            {([['current', 'Current password', 'current-password'], ['next', 'New password (8+ chars: A-Z, a-z, 0-9, symbol)', 'new-password'], ['confirm', 'Repeat new password', 'new-password']] as const).map(([key, label, ac]) => (
              <label key={key} className="block">
                <span className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <input
                  type="password"
                  autoComplete={ac}
                  value={pw[key]}
                  onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border rounded-lg border-gray-300 dark:bg-dark-900 dark:border-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPwOpen(false)} disabled={pwSaving} className="px-4 py-2 text-sm text-gray-600 rounded-lg dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700">Cancel</button>
              <button type="submit" disabled={pwSaving} className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-primary hover:opacity-90 disabled:opacity-50">{pwSaving ? 'Saving…' : 'Change password'}</button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
};

export default Header;
