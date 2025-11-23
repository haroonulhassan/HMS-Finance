import React, { useState } from 'react';
import { LogOut, Settings, Bell } from 'lucide-react';
import { User, UserRole } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenSettings?: () => void;
  onOpenRequests?: () => void;
  notificationCount?: number;
  onSwitchRole?: (role: UserRole) => void;
  testingMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
  onLogout, 
  onOpenSettings, 
  onOpenRequests,
  notificationCount = 0,
  onSwitchRole,
  testingMode = false
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 border-t-4 border-[#004f94]">
      <div className="max-w-[1200px] mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* Logo Icon */}
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden">
             {imgError ? (
               <div className="w-full h-full bg-[#004f94] flex items-center justify-center text-white text-[10px] font-bold">
                 HMS
               </div>
             ) : (
               <img 
                src="https://drive.google.com/thumbnail?id=1CjfPyJTGK_HWGqORXdEbTvEHUl4dZR7i&sz=w200" 
                alt="HMS" 
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
             )}
          </div>
          <div className="text-xl font-bold text-[#004f94] hidden sm:block">
            HMS Finance Management
          </div>
          <div className="text-xl font-bold text-[#004f94] sm:hidden">
            HMS
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* Admin Role Switcher - Visible only if Admin AND Testing Mode is enabled */}
          {(user?.originalRole === 'admin' && testingMode) && (
            <div className="flex items-center bg-blue-50 rounded-lg px-2 py-1 border border-blue-200">
              <span className="text-xs font-bold text-[#004f94] mr-1 sm:mr-2 hidden xs:inline">View As:</span>
              <select 
                value={user.role} 
                onChange={(e) => onSwitchRole && onSwitchRole(e.target.value as any)}
                className="bg-transparent text-xs sm:text-sm text-[#212529] font-semibold focus:outline-none cursor-pointer"
              >
                <option value="admin">Admin</option>
                <option value="assistant">Assistant</option>
                <option value="user">User</option>
              </select>
            </div>
          )}

          <span className="text-[#212529] hidden md:inline">
            Welcome, <span className="font-semibold text-[#212529]">{user?.username || 'User'}</span>
            {user?.role === 'assistant' && <span className="ml-2 text-xs bg-blue-100 text-[#004f94] px-2 py-0.5 rounded-full">Assistant</span>}
          </span>
          
          {user?.role === 'admin' && (
            <>
              {onOpenRequests && (
                <button
                  onClick={onOpenRequests}
                  className="p-2 text-[#004f94] bg-blue-50 rounded-full hover:bg-blue-100 transition-colors relative"
                  title="Requests"
                >
                  <Bell size={20} />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold border-2 border-white">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
              )}
              {onOpenSettings && (
                <button 
                  onClick={onOpenSettings}
                  className="p-2 text-[#004f94] bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>
              )}
            </>
          )}

          <button 
            onClick={onLogout}
            className="text-red-600 hover:text-red-700 flex items-center gap-2 text-sm transition-colors font-bold"
            title="Logout"
          >
            <LogOut size={20} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};