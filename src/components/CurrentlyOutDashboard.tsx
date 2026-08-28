import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Clock, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  RotateCcw, 
  MapPin, 
  Building2, 
  Bath, 
  HeartPulse, 
  UserCheck, 
  DoorOpen, 
  BookOpen, 
  HelpCircle,
  Flag,
  UserX,
  X
} from 'lucide-react';
import {
  HallPass,
  DestinationType,
  Teacher,
  ConflictPair
} from '../types';
import {
  endHallPass,
  flagHallPass,
  subscribeToConflictPairs
} from '../lib/firebase';
import { formatElapsedTime, formatTimeAmPm, getPassUrgency, playNotificationTone, DESTINATION_LIST } from '../lib/constants';

interface CurrentlyOutDashboardProps {
  activePasses: HallPass[];
  teachers: Teacher[];
  soundEnabled: boolean;
}

export const CurrentlyOutDashboard: React.FC<CurrentlyOutDashboardProps> = ({
  activePasses,
  teachers,
  soundEnabled
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDestination, setFilterDestination] = useState<string>('ALL');
  const [filterTeacher, setFilterTeacher] = useState<string>('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  const previousConflictCount = React.useRef(0);
  
// Conflict pairs managed from the Admin Dashboard
const [conflictPairs, setConflictPairs] = useState<ConflictPair[]>([]);
  
  // Live timer tick every second for smooth, real-time counters
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

// Listen for hallway conflict pairs managed by the Admin Dashboard
useEffect(() => {
  const unsubscribe = subscribeToConflictPairs((pairs) => {
    setConflictPairs(pairs);
  });

  return () => unsubscribe();
}, []);
  
  // Filtered passes
  const filteredPasses = activePasses.filter((pass) => {
    const matchesSearch = 
      pass.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pass.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pass.teacher.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDest = filterDestination === 'ALL' || pass.destination === filterDestination;
    const matchesTeacher = filterTeacher === 'ALL' || pass.teacher === filterTeacher;

    return matchesSearch && matchesDest && matchesTeacher;
  });

  // Urgency counts
  const overduePasses = activePasses.filter((p) => (Date.now() - p.timeOut) > 12 * 60 * 1000);
  const extendedPasses = activePasses.filter((p) => {
    const elapsed = Date.now() - p.timeOut;
    return elapsed >= 7 * 60 * 1000 && elapsed <= 12 * 60 * 1000;
  });
  const normalPasses = activePasses.filter((p) => (Date.now() - p.timeOut) < 7 * 60 * 1000);

// ============================================================
// STUDENT CONFLICT DETECTION
// ============================================================

const conflictAlerts = conflictPairs
  .map((pair) => {
    const pass1 = activePasses.find(
      (pass) => pass.studentId === pair.studentId1
    );

    const pass2 = activePasses.find(
      (pass) => pass.studentId === pair.studentId2
    );

    if (!pass1 || !pass2) {
      return null;
    }

    return {
      student1: pass1,
      student2: pass2
    };
  })
  .filter(
    (
      alert
    ): alert is {
      student1: HallPass;
      student2: HallPass;
    } => alert !== null
  );

// Play a short double-beep when a new hallway conflict appears
useEffect(() => {
  if (
    soundEnabled &&
    conflictAlerts.length > previousConflictCount.current
  ) {
    const audioContext = new (
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext: typeof AudioContext;
      }).webkitAudioContext
    )();

    const playBeep = (delay: number) => {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 880;

        gainNode.gain.setValueAtTime(0.18, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.12
        );

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
      }, delay);
    };

    // Short double beep: beep → pause → beep
    playBeep(0);
    playBeep(180);

    setTimeout(() => {
      audioContext.close();
    }, 500);
  }

  previousConflictCount.current = conflictAlerts.length;
}, [conflictAlerts.length, soundEnabled]);
  
  // End pass action from teacher/staff monitor
  const handleMarkReturned = async (pass: HallPass) => {
    setActionLoadingId(pass.id);
    try {
      await endHallPass(pass.id, 'teacher');
      if (soundEnabled) playNotificationTone('end');
    } catch (err) {
      console.error('Failed to end pass:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleFlag = async (pass: HallPass) => {
    try {
      await flagHallPass(pass.id, !pass.flagged);
    } catch (err) {
      console.error('Failed to flag pass:', err);
    }
  };

  const getDestinationIcon = (dest: DestinationType) => {
    switch (dest) {
      case 'Restroom': return <Bath className="w-5 h-5" />;
      case 'Office': return <Building2 className="w-5 h-5" />;
      case 'Nurse': return <HeartPulse className="w-5 h-5" />;
      case 'Counselor': return <UserCheck className="w-5 h-5" />;
      case 'Another Classroom': return <DoorOpen className="w-5 h-5" />;
      case 'Library': return <BookOpen className="w-5 h-5" />;
      default: return <HelpCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>

       {/* ========================================================
          STUDENT CONFLICT ALERTS
         ======================================================== */}
      {conflictAlerts.length > 0 && (
        <div className="space-y-3">
          {conflictAlerts.map((alert) => (
            <div
              key={`${alert.student1.studentId}-${alert.student2.studentId}`}
              className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4 sm:p-5 shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-rose-900">
                      HALLWAY CONFLICT ALERT
                    </h3>
                  </div>

                  <p className="text-sm font-semibold text-rose-800 mt-1">
                    These students are currently in the hallway at the same time:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded-xl border border-rose-200 p-3">
                      <div className="font-bold text-slate-900">
                        {alert.student1.studentName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {alert.student1.destination}
                        {alert.student1.destinationDetails
                          ? ` • ${alert.student1.destinationDetails}`
                          : ''}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Out since {formatTimeAmPm(alert.student1.timeOut)}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-rose-200 p-3">
                      <div className="font-bold text-slate-900">
                        {alert.student2.studentName}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {alert.student2.destination}
                        {alert.student2.destinationDetails
                          ? ` • ${alert.student2.destinationDetails}`
                          : ''}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Out since {formatTimeAmPm(alert.student2.timeOut)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border-2 border-amber-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-purple-950 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              LIVE MONITOR
            </span>
            <span className="text-xs text-purple-300">
              Jackson Memorial Middle School • Real-Time Firestore Sync
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Students Currently Out in Hallways
          </h2>
          <p className="text-xs sm:text-sm text-purple-200 mt-1">
            Displaying all active passes. Updates continuously every second.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          

          <button
            id="btn-toggle-fullscreen"
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3.5 py-2.5 bg-purple-800/80 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-semibold border border-purple-700 flex items-center gap-1.5 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Smartboard Fullscreen Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Status Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border-2 border-purple-200 shadow-md">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Active Out</div>
          <div className="text-3xl font-black text-purple-950 mt-1 flex items-baseline gap-2">
            <span>{activePasses.length}</span>
            <span className="text-xs font-semibold text-slate-400">students</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border-2 border-emerald-200 shadow-md">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Normal (&lt; 7 min)
          </div>
          <div className="text-3xl font-black text-emerald-800 mt-1">
            {normalPasses.length}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border-2 border-amber-200 shadow-md">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Extended (7-12 min)
          </div>
          <div className="text-3xl font-black text-amber-800 mt-1">
            {extendedPasses.length}
          </div>
        </div>

        <div className={`rounded-2xl p-4 border-2 shadow-md ${
          overduePasses.length > 0 ? 'bg-rose-50 border-rose-400 animate-pulse' : 'bg-white border-slate-200'
        }`}>
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Overdue (&gt; 12 min)
          </div>
          <div className="text-3xl font-black text-rose-800 mt-1">
            {overduePasses.length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-currently-out"
            type="text"
            placeholder="Search student or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none text-xs sm:text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            id="filter-destination"
            value={filterDestination}
            onChange={(e) => setFilterDestination(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:border-purple-600 outline-none"
          >
            <option value="ALL">All Destinations</option>
            {DESTINATION_LIST.map((dest) => (
              <option key={dest} value={dest}>{dest}</option>
            ))}
          </select>

          <select
            id="filter-teacher"
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:border-purple-600 outline-none"
          >
            <option value="ALL">All Teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Currently Out List / Cards Grid */}
      {filteredPasses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">No Students Currently Out</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
            {activePasses.length > 0 
              ? 'No active passes match your current search filters.'
              : 'All 8th-grade students are accounted for in their classrooms.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPasses.map((pass) => {
            const urgency = getPassUrgency(pass.timeOut);
            const isLoadingThis = actionLoadingId === pass.id;

            return (
              <div
                key={pass.id}
                className={`rounded-2xl p-5 border-2 shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${urgency.cardClass}`}
              >
                {/* Top header of card */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-950 text-amber-300 font-black text-sm flex items-center justify-center shadow">
                        {pass.studentName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-slate-900 leading-tight">
                          {pass.studentName}
                        </h4>
                        <span className="text-xs text-slate-500 font-mono">
                          ID #{pass.studentId}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${urgency.badgeClass}`}>
                      {urgency.label}
                    </span>
                  </div>

                  {/* Destination Row */}
                  <div className="bg-white/80 p-3 rounded-xl border border-slate-200/80 mb-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-purple-950 font-bold text-sm">
                      <span className="p-1 rounded bg-purple-100 text-purple-800">
                        {getDestinationIcon(pass.destination)}
                      </span>
                      <span>{pass.destination}</span>
                    </div>
                    {pass.destinationDetails && (
                      <p className="text-xs text-slate-600 italic">
                        "{pass.destinationDetails}"
                      </p>
                    )}
                    <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span>Authorizing Teacher:</span>
                      <span className="font-semibold text-slate-700">{pass.teacher}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Timer and Actions */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Elapsed Time
                    </div>
                    <div className="text-2xl font-black font-mono text-purple-950">
                      {formatElapsedTime(pass.timeOut)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Left at {formatTimeAmPm(pass.timeOut)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleFlag(pass)}
                      className={`p-2 rounded-xl text-xs transition border ${
                        pass.flagged 
                          ? 'bg-rose-500 text-white border-rose-600' 
                          : 'bg-white hover:bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      title={pass.flagged ? 'Flagged for follow-up' : 'Flag student'}
                    >
                      <Flag className="w-4 h-4" />
                    </button>

                    <button
                      id={`btn-end-pass-${pass.id}`}
                      type="button"
                      onClick={() => handleMarkReturned(pass)}
                      disabled={isLoadingThis}
                      className="px-3.5 py-2 bg-purple-900 hover:bg-purple-950 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                      <span>{isLoadingThis ? 'Ending...' : 'Mark Returned'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
