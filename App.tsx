import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { EventDetail } from './pages/EventDetail';
import { Login } from './pages/Login';
import { User, UserRole } from './types';
import { WifiOff, RefreshCw } from 'lucide-react';
import { checkHealth } from './services/db';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [testingMode, setTestingMode] = useState(false);
  const [connectionError, setConnectionError] = useState<{isError: boolean, message: string}>({ isError: false, message: '' });
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail.isOnline) {
        setConnectionError({ isError: true, message: customEvent.detail.message });
      } else {
        setConnectionError({ isError: false, message: '' });
      }
    };

    window.addEventListener('hms-connection-status', handleStatusChange);
    return () => window.removeEventListener('hms-connection-status', handleStatusChange);
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    setUser(null);
    setTestingMode(false); // Reset testing mode on logout
  };

  const handleSwitchRole = (newRole: UserRole) => {
    if (user && user.originalRole === 'admin') {
      setUser({ ...user, role: newRole });
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await checkHealth();
      // If successful, checkHealth calls api(), which dispatches isOnline: true
    } catch (e) {
      // Ignore, status remains error
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Router>
      {connectionError.isError && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white py-3 px-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[200] flex flex-col sm:flex-row items-center justify-center gap-4 transition-transform duration-300">
          <div className="flex items-center gap-2 font-bold text-sm">
             <WifiOff size={20} />
             <span>{connectionError.message || "Connection Lost. Please check your internet or server."}</span>
          </div>
          <button 
            onClick={handleRetry}
            disabled={isRetrying}
            className="bg-white text-red-600 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRetrying ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isRetrying ? 'Checking...' : 'Retry Connection'}
          </button>
        </div>
      )}
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/" 
          element={user ? <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            onSwitchRole={handleSwitchRole} 
            testingMode={testingMode}
            onToggleTestingMode={() => setTestingMode(!testingMode)}
          /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/event/:id" 
          element={user ? <EventDetail 
            user={user} 
            onLogout={handleLogout} 
            onSwitchRole={handleSwitchRole} 
            testingMode={testingMode}
          /> : <Navigate to="/login" />} 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;