
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authenticate, resetAdminPassword, getPublicCredentials } from '../services/db';
import { Eye, EyeOff, X } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal State
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Verify Username, 2: New Password
  const [forgotUsername, setForgotUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Admin Username Hint State
  const [adminHint, setAdminHint] = useState('');

  useEffect(() => {
    const fetchHint = async () => {
      const creds = await getPublicCredentials();
      setAdminHint(creds.adminUsername);
    };
    fetchHint();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const result = await authenticate(username, password);
      if (result.success && result.role) {
        if (result.role !== role) {
          setError(`Invalid credentials`);
        } else {
          onLogin({ 
            username: username, 
            role: result.role,
            originalRole: result.role === 'admin' ? 'admin' : undefined
          });
        }
      } else {
        setError(result.error || 'Invalid username or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerify = async () => {
    setForgotError('');
    if (!forgotUsername) {
      setForgotError('Please enter your username');
      return;
    }
    setForgotStep(2);
  };

  const handleForgotSubmit = async () => {
    if (!newPassword) {
      setForgotError('Please enter a new password');
      return;
    }

    const success = await resetAdminPassword(forgotUsername, newPassword);
    if (success) {
      setForgotSuccess('Password reset successfully! Please login.');
      setTimeout(() => {
        setShowForgot(false);
        setForgotSuccess('');
        setForgotStep(1);
        setForgotUsername('');
        setNewPassword('');
      }, 2000);
    } else {
      setForgotError('Username does not match our Admin records.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#004f94] to-[#002a5c] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-[420px]">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-32 h-32 rounded-full bg-white mb-4 overflow-hidden shadow-lg relative flex items-center justify-center">
            {imgError ? (
              <div className="w-full h-full bg-[#004f94] flex items-center justify-center text-white">
                  <span className="text-3xl font-bold">HMS</span>
              </div>
            ) : (
              <img 
                src="https://drive.google.com/thumbnail?id=1CjfPyJTGK_HWGqORXdEbTvEHUl4dZR7i&sz=w1000" 
                alt="HMS Logo" 
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <h2 className="text-2xl font-bold text-center text-[#004f94]">HMS Finance Management</h2>
          <p className="text-[#004f94] text-sm font-medium mt-1">Hayatian's Mathematical Society</p>
        </div>
        
        <div className="flex gap-2 mb-6">
          <div 
            onClick={() => setRole('admin')}
            className={`flex-1 text-center p-2 border-2 rounded-lg cursor-pointer transition-all font-medium text-sm
              ${role === 'admin' ? 'border-[#004f94] bg-[rgba(0,79,148,0.1)] text-[#004f94]' : 'border-gray-200 text-gray-500 hover:border-[#004f94]'}`}
          >
            Admin
          </div>
          <div 
            onClick={() => setRole('assistant')}
            className={`flex-1 text-center p-2 border-2 rounded-lg cursor-pointer transition-all font-medium text-sm
              ${role === 'assistant' ? 'border-[#004f94] bg-[rgba(0,79,148,0.1)] text-[#004f94]' : 'border-gray-200 text-gray-500 hover:border-[#004f94]'}`}
          >
            Assistant
          </div>
          <div 
            onClick={() => setRole('user')}
            className={`flex-1 text-center p-2 border-2 rounded-lg cursor-pointer transition-all font-medium text-sm
              ${role === 'user' ? 'border-[#004f94] bg-[rgba(0,79,148,0.1)] text-[#004f94]' : 'border-gray-200 text-gray-500 hover:border-[#004f94]'}`}
          >
            User
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-semibold mb-1 text-[#212529] text-sm">Username</label>
            <input 
              type="text" 
              className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="relative">
            <label className="block font-semibold mb-1 text-[#212529] text-sm">Password</label>
            <input 
              type={showPassword ? "text" : "password"}
              className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button 
              type="button"
              className="absolute right-3 top-[34px] text-gray-400 hover:text-[#004f94]"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {error && <div className="text-[#f72585] text-sm text-center font-medium bg-red-50 p-2 rounded border border-red-100">{error}</div>}

          <button 
            disabled={loading}
            className="w-full py-3 bg-[#004f94] text-white rounded-lg font-bold shadow-lg hover:bg-[#00386b] transition-colors disabled:opacity-70"
          >
            {loading ? 'Logging in...' : 'Login to System'}
          </button>
        </form>

        {role === 'admin' && (
          <div className="mt-4 text-center">
            <button 
              onClick={() => setShowForgot(true)}
              className="text-sm text-[#6c757d] hover:text-[#004f94] hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
          <p>HMS Finance Management System &copy; 2025</p>
          <p className="text-[10px] text-white select-text mt-1">{adminHint}</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1000] backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-[400px] shadow-2xl relative">
             <button onClick={() => setShowForgot(false)} className="absolute top-4 right-4 text-gray-400 hover:text-[#f72585]">
               <X size={20} />
             </button>
             <h3 className="text-xl font-bold text-[#004f94] mb-4">Reset Admin Password</h3>
             
             {forgotSuccess ? (
               <div className="bg-green-50 text-green-700 p-4 rounded text-center font-medium mb-4">
                 {forgotSuccess}
               </div>
             ) : (
               <>
                 {forgotStep === 1 ? (
                   <div className="space-y-4">
                     <p className="text-sm text-gray-600">Please enter your Admin Username to verify your identity.</p>
                     <input 
                        type="text" 
                        className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                        placeholder="Admin Username"
                        value={forgotUsername}
                        onChange={(e) => setForgotUsername(e.target.value)}
                     />
                     <button 
                       onClick={handleForgotVerify}
                       className="w-full py-3 bg-[#004f94] text-white rounded-lg font-bold shadow-lg hover:bg-[#00386b] transition-colors"
                     >
                       Next
                     </button>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     <p className="text-sm text-gray-600">Identity verified. Enter new password for <strong>{forgotUsername}</strong>.</p>
                     <input 
                        type="password" 
                        className="w-full p-3 border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:bg-white focus:border-[#004f94] focus:ring-2 focus:ring-[#004f94] focus:ring-opacity-20 outline-none transition-all"
                        placeholder="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                     />
                     <button 
                       onClick={handleForgotSubmit}
                       className="w-full py-3 bg-[#004f94] text-white rounded-lg font-bold shadow-lg hover:bg-[#00386b] transition-colors"
                     >
                       Reset Password
                     </button>
                   </div>
                 )}
                 {forgotError && <div className="text-[#f72585] text-sm text-center mt-4 font-medium">{forgotError}</div>}
               </>
             )}
          </div>
        </div>
      )}
    </div>
  );
};