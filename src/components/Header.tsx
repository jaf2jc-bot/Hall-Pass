import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Clock,
  Eye,
  History,
  Shield,
  UserCheck,
  Volume2,
  VolumeX,
  ChevronDown,
  School,
  LogOut,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ALLOWED_DOMAIN } from '../lib/firebase';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activePassCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activePassCount,
  soundEnabled,
  setSoundEnabled
}) => {
  const {
    firebaseUser,
    currentUser,
    currentRole,
    loginWithGoogle,
    logout,
    authError,
    setAuthError,
    isLoading
  } = useAuth();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentPeriod, setCurrentPeriod] =
    useState<string>('Period 3');
  const [showUserSwitcher, setShowUserSwitcher] =
    useState(false);

  // ============================================================
  // LIVE SCHOOL CLOCK
  // ============================================================
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );

      const hours = now.getHours();
      const mins = now.getMinutes();
      const totalMins = hours * 60 + mins;

      if (totalMins < 460) {
        setCurrentPeriod('Before School');
      } else if (totalMins < 515) {
        setCurrentPeriod('Period 1 (8:00 - 8:45)');
      } else if (totalMins < 570) {
        setCurrentPeriod('Period 2 (8:50 - 9:35)');
      } else if (totalMins < 625) {
        setCurrentPeriod('Period 3 (9:40 - 10:25)');
      } else if (totalMins < 680) {
        setCurrentPeriod('Period 4 (10:30 - 11:15)');
      } else if (totalMins < 735) {
        setCurrentPeriod('Period 5 / Lunch (11:20 - 12:05)');
      } else if (totalMins < 790) {
        setCurrentPeriod('Period 6 (12:10 - 12:55)');
      } else if (totalMins < 845) {
        setCurrentPeriod('Period 7 (1:00 - 1:45)');
      } else if (totalMins < 900) {
        setCurrentPeriod('Period 8 (1:50 - 2:35)');
      } else {
        setCurrentPeriod('After School');
      }
    };

    updateTime();

    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // NAVIGATION ITEMS
  // ============================================================
  const allNavItems = [
    {
      id: 'student',
      label: 'My Hall Pass',
      icon: GraduationCap,
      roles: ['student', 'teacher', 'admin']
    },
    {
      id: 'currently-out',
      label: 'Live Hallway Monitor',
      icon: Eye,
      roles: ['teacher', 'admin'],
      badge:
        activePassCount > 0
          ? activePassCount
          : undefined
    },
    {
      id: 'teacher',
      label: 'Teacher Desk',
      icon: UserCheck,
      roles: ['teacher', 'admin']
    },
    {
      id: 'admin',
      label: 'Admin Security & Rosters',
      icon: Shield,
      roles: ['admin']
    },
    {
      id: 'history',
      label: 'Pass History',
      icon: History,
      roles: ['teacher', 'admin']
    }
  ];

  const visibleNavItems = allNavItems.filter(
    (item) => item.roles.includes(currentRole)
  );

  // ============================================================
  // HEADER
  // ============================================================
  return (
    <header className="sticky top-0 z-40 bg-purple-950 text-white shadow-lg border-b-4 border-amber-400">

      {/* ======================================================
          TOP SCHOOL BAR
          ====================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-purple-900/60">

        {/* School Crest & Title */}
        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-purple-950 font-black shadow-md border border-amber-200">
            <School className="w-6 h-6" />
          </div>

          <div>

            <div className="flex items-center gap-2">

              <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-purple-900/80 px-2 py-0.5 rounded">
                JMMS BEARS
              </span>

              <span className="text-[11px] text-purple-300 font-semibold hidden sm:flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                @{ALLOWED_DOMAIN}
              </span>

            </div>

            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight flex items-center gap-1.5">
              Jackson Memorial
              <span className="text-amber-400 font-extrabold">
                e-Hall Pass
              </span>
            </h1>

          </div>
        </div>

        {/* ==================================================
            LIVE CLOCK
            ================================================== */}
        <div className="hidden md:flex items-center gap-3 bg-purple-900/70 border border-purple-800/80 px-3.5 py-1.5 rounded-lg text-xs">

          <div className="flex items-center gap-1.5 text-amber-300 font-semibold font-mono text-sm">

            <Clock className="w-4 h-4 text-amber-400" />

            <span>
              {currentTime || '09:20 AM'}
            </span>

          </div>

          <span className="text-purple-400">
            |
          </span>

          <span className="text-purple-200 font-medium">
            {currentPeriod}
          </span>

        </div>

        {/* ==================================================
            AUTH CONTROLS
            ================================================== */}
        <div className="flex items-center gap-2">

          {/* Sound Toggle */}
          <button
            id="btn-toggle-sound"
            type="button"
            onClick={() =>
              setSoundEnabled(!soundEnabled)
            }
            className="p-2 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-200 hover:text-amber-300 transition-colors border border-purple-800"
            title={
              soundEnabled
                ? 'Alert sounds active'
                : 'Alert sounds muted'
            }
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-purple-400" />
            )}
          </button>

          {/* ==================================================
              LOGGED IN
              ================================================== */}
          {firebaseUser &&
          !firebaseUser.isAnonymous ? (

            <div className="relative">

              <button
                id="btn-user-account"
                type="button"
                onClick={() =>
                  setShowUserSwitcher(
                    !showUserSwitcher
                  )
                }
                className="flex items-center gap-2.5 bg-gradient-to-r from-purple-900 to-purple-800 hover:from-purple-800 hover:to-purple-700 text-white px-3 py-1.5 rounded-lg border border-amber-400/40 text-xs sm:text-sm font-medium transition shadow-sm"
              >

                {/* Profile Image */}
                {firebaseUser.photoURL ? (

                  <img
                    src={firebaseUser.photoURL}
                    alt="User Avatar"
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full border border-amber-300 object-cover"
                  />

                ) : (

                  <div className="w-6 h-6 rounded-full bg-amber-400 text-purple-950 font-bold flex items-center justify-center text-xs">
                    {currentUser?.displayName?.charAt(0) ||
                      'U'}
                  </div>

                )}

                {/* User Information */}
                <div className="text-left hidden sm:block">

                  <div className="flex items-center gap-1.5">

                    <span className="font-bold text-white text-xs truncate max-w-[130px]">
                      {currentUser?.displayName ||
                        firebaseUser.displayName}
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        currentRole === 'admin'
                          ? 'bg-rose-500 text-white'
                          : currentRole === 'teacher'
                          ? 'bg-amber-400 text-purple-950'
                          : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {currentRole}
                    </span>

                  </div>

                  <span className="text-[10px] text-purple-300 font-mono truncate max-w-[150px] block">
                    {currentUser?.email ||
                      firebaseUser.email}
                  </span>

                </div>

                <ChevronDown className="w-4 h-4 text-purple-300" />

              </button>

              {/* ==================================================
                  ACCOUNT DROPDOWN
                  ================================================== */}
              {showUserSwitcher && (

                <div
                  className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-purple-200 text-slate-800 z-50 p-3"
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                >

                  {/* Profile */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">

                    {firebaseUser.photoURL ? (

                      <img
                        src={firebaseUser.photoURL}
                        alt="Avatar"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full border-2 border-purple-300"
                      />

                    ) : (

                      <div className="w-10 h-10 rounded-full bg-purple-900 text-amber-400 font-bold flex items-center justify-center text-sm">
                        {currentUser?.displayName?.charAt(0) ||
                          'U'}
                      </div>

                    )}

                    <div className="overflow-hidden">

                      <p className="font-bold text-sm text-slate-900 truncate">
                        {currentUser?.displayName ||
                          firebaseUser.displayName}
                      </p>

                      <p className="text-xs text-slate-500 font-mono truncate">
                        {currentUser?.email ||
                          firebaseUser.email}
                      </p>

                      <div className="mt-1 flex items-center gap-1">

                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-purple-100 text-purple-900 rounded">
                          Role:{' '}
                          {currentRole?.toUpperCase()}
                        </span>

                        {currentUser?.studentId && (
                          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            ID #{currentUser.studentId}
                          </span>
                        )}

                      </div>

                    </div>

                  </div>

                  {/* Account Information */}
                  <div className="py-2.5">

                    <p className="text-[11px] text-slate-500">
                      Authenticated via Google Workspace
                      SSO. Access permissions are securely
                      scoped to your middle-school role.
                    </p>

                  </div>

                  {/* Logout */}
                  <button
                    id="btn-logout"
                    onClick={async () => {
                      setShowUserSwitcher(false);
                      await logout();
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-rose-50 text-rose-700 hover:text-rose-800 font-semibold text-xs rounded-lg transition"
                  >

                    <LogOut className="w-4 h-4" />

                    <span>
                      Sign Out from JMMS e-Pass
                    </span>

                  </button>

                </div>

              )}

            </div>

          ) : (

            /* ==================================================
               LOGGED OUT — GOOGLE SIGN IN
               ================================================== */
            <button
              id="btn-google-signin"
              type="button"
              onClick={() => loginWithGoogle()}
              disabled={isLoading}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-purple-950 font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition shadow-md hover:shadow-lg disabled:opacity-50"
            >

              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />

                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />

                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />

                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>

              <span className="hidden sm:inline">
                Google Sign-In
              </span>

              <span className="sm:hidden">
                Sign In
              </span>

            </button>

          )}

        </div>

      </div>

      {/* ======================================================
          AUTH ERROR
          ====================================================== */}
      {authError && (

        <div className="bg-rose-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-inner">

          <div className="flex items-center gap-2 max-w-4xl mx-auto">

            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-300" />

            <span className="font-semibold">
              {authError}
            </span>

          </div>

          <button
            onClick={() => setAuthError(null)}
            className="text-white hover:text-rose-200 text-xs font-bold underline ml-2"
          >
            Dismiss
          </button>

        </div>

      )}

      {/* ======================================================
          MAIN NAVIGATION
          ====================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">

          {visibleNavItems.map((item) => {

            const Icon = item.icon;
            const isActive =
              activeTab === item.id;

            return (

              <button
                id={`nav-tab-${item.id}`}
                key={item.id}
                type="button"
                onClick={() =>
                  setActiveTab(item.id)
                }
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'bg-purple-900 text-amber-300 border-amber-400 shadow-sm'
                    : 'text-purple-200 hover:text-white hover:bg-purple-900/50 border-transparent'
                }`}
              >

                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-amber-400'
                      : 'text-purple-300'
                  }`}
                />

                <span>
                  {item.label}
                </span>

                {item.badge !== undefined && (

                  <span className="ml-1 bg-amber-400 text-purple-950 font-extrabold text-[11px] px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                    {item.badge}
                  </span>

                )}

              </button>

            );
          })}

        </nav>

      </div>

    </header>
  );
};
