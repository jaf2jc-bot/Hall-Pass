import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Clock, 
  MapPin, 
  UserCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Sparkles,
  Bath,
  Building2,
  HeartPulse,
  DoorOpen,
  BookOpen,
  HelpCircle,
  ShieldAlert,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../contexts/AuthContext';
import { HallPass, DestinationType, Teacher } from '../types';
import { requestHallPass, endHallPass } from '../lib/firebase';
import { DESTINATIONS, formatElapsedTime, formatTimeAmPm, playNotificationTone, getPassUrgency } from '../lib/constants';

interface StudentDashboardProps {
  activePasses: HallPass[];
  allPasses: HallPass[];
  soundEnabled: boolean;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activePasses,
  allPasses,
  soundEnabled
}) => {
  const { currentUser, activeStudent, students, teachers, selectStudent } = useAuth();

  // Find if this student has an active pass
  const myActivePass = activePasses.find(
    (p) => activeStudent && (p.studentId === activeStudent.studentId || p.studentDocId === activeStudent.id)
  );

  // Pass Request Form State
  const [selectedDestination, setSelectedDestination] = useState<DestinationType>('Restroom');
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>('');
  const [destinationDetails, setDestinationDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live timer tick for active pass
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!myActivePass) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [myActivePass]);

  // Set default teacher when teachers load
  useEffect(() => {
    if (teachers.length > 0 && !selectedTeacherName) {
      setSelectedTeacherName(teachers[0].name);
    }
  }, [teachers, selectedTeacherName]);

  // Student's recent passes
  const myRecentPasses = allPasses.filter(
    (p) => activeStudent && (p.studentId === activeStudent.studentId || p.studentDocId === activeStudent.id)
  );

  const myPassesToday = myRecentPasses.filter(
    (p) => new Date(p.timeOut).toDateString() === new Date().toDateString()
  );

  // Handle Request Pass
  const handleStartPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudent) {
      setErrorMsg('No student profile selected.');
      return;
    }

    if (myActivePass) {
      setErrorMsg('You already have an active hall pass. Please return to class first.');
      return;
    }

    if (!selectedTeacherName) {
      setErrorMsg('Please select your authorizing teacher.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const teacherObj = teachers.find((t) => t.name === selectedTeacherName);
      await requestHallPass({
        studentDocId: activeStudent.id,
        studentId: activeStudent.studentId,
        studentName: `${activeStudent.firstName} ${activeStudent.lastName}`,
        studentEmail: activeStudent.email || currentUser?.email,
        teacher: selectedTeacherName,
        teacherRoom: teacherObj?.room || '',
        destination: selectedDestination,
        destinationDetails: destinationDetails.trim() || undefined,
        createdBy: 'student'
      });

      if (soundEnabled) playNotificationTone('start');
      setSuccessMsg(`Hall pass to ${selectedDestination} started! Have a great day.`);
      setDestinationDetails('');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Failed to start hall pass. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Return to Class
  const handleReturnToClass = async () => {
    if (!myActivePass) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await endHallPass(myActivePass.id, 'student');
      if (soundEnabled) playNotificationTone('end');

      // Trigger celebratory micro-confetti
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#581c87', '#f59e0b', '#ffffff']
      });

      setSuccessMsg('Returned to class successfully! Welcome back.');
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Failed to complete pass.');
    } finally {
      setIsSubmitting(false);
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

  if (!activeStudent) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-900 mx-auto flex items-center justify-center mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-purple-950 mb-2">Student Pass Login</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Select your 8th-grade student profile to request or view your hall passes.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto text-left">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => selectStudent(student)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition"
              >
                <div>
                  <span className="font-semibold text-slate-800">{student.firstName} {student.lastName}</span>
                  <span className="block text-xs text-slate-500">ID #{student.studentId} • Grade {student.grade}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-600" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const urgency = myActivePass ? getPassUrgency(myActivePass.timeOut) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Student Profile Header Card */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-950 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border-2 border-amber-400/40 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-purple-950 font-black text-xl flex items-center justify-center shadow-lg border-2 border-amber-200">
              {activeStudent.firstName[0]}{activeStudent.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Grade {activeStudent.grade}
                </span>
                <span className="text-xs text-purple-200 font-mono">
                  Student ID: #{activeStudent.studentId}
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">
                {activeStudent.firstName} {activeStudent.lastName}
              </h2>
              <p className="text-xs text-purple-200">
                Homeroom: {activeStudent.homeroom || 'Room 204'} • Jackson Memorial Middle School
              </p>
            </div>
          </div>

          {/* Current Status Badge */}
          <div className="flex items-center gap-3">
            {myActivePass ? (
              <div className="bg-amber-400 text-purple-950 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg animate-pulse">
                <Clock className="w-5 h-5" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-extrabold">Current Status</div>
                  <div className="text-sm">Pass Active ({myActivePass.destination})</div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-200">Current Status</div>
                  <div className="text-sm text-emerald-100">In Classroom</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Daily Stats Summary */}
        <div className="mt-4 pt-4 border-t border-purple-800/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-purple-900/60 rounded-lg p-2.5">
            <span className="text-purple-300 block">Passes Today</span>
            <span className="text-lg font-bold text-amber-300">{myPassesToday.length} passes</span>
          </div>
          <div className="bg-purple-900/60 rounded-lg p-2.5">
            <span className="text-purple-300 block">Total Passes (This Month)</span>
            <span className="text-lg font-bold text-white">{myRecentPasses.length} passes</span>
          </div>
          <div className="bg-purple-900/60 rounded-lg p-2.5 col-span-2 sm:col-span-1">
            <span className="text-purple-300 block">Average Duration</span>
            <span className="text-lg font-bold text-white">
              {myRecentPasses.length > 0 
                ? `${Math.round(myRecentPasses.reduce((a, b) => a + (b.durationMinutes || 4), 0) / myRecentPasses.length)} min`
                : '4.5 min'}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications / Feedback Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-rose-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Notice</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl text-emerald-900 flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Success</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {/* ========================================================
          CASE 1: STUDENT HAS AN ACTIVE PASS (SHOW ACTIVE PASS CARD)
         ======================================================== */}
      {myActivePass ? (
        <div className="bg-white rounded-2xl shadow-xl border-4 border-amber-400 p-6 sm:p-8 relative overflow-hidden text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-purple-950 text-amber-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Official Jackson Memorial Hall Pass
          </div>

          <div className="space-y-2">
            <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider">
              Authorized Destination
            </div>
            <div className="flex items-center justify-center gap-3 text-3xl sm:text-4xl font-black text-purple-950">
              <span className="p-3 rounded-2xl bg-purple-100 text-purple-900">
                {getDestinationIcon(myActivePass.destination)}
              </span>
              <span>{myActivePass.destination}</span>
            </div>
            {myActivePass.destinationDetails && (
              <p className="text-slate-600 font-medium italic text-sm">
                "{myActivePass.destinationDetails}"
              </p>
            )}
          </div>

          {/* Large Live Timer & Urgency */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 max-w-md mx-auto space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              Time Out In Hallway
            </div>
            <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-purple-950">
              {formatElapsedTime(myActivePass.timeOut)}
            </div>
            <div className="text-xs text-slate-500">
              Started at <span className="font-semibold text-slate-700">{formatTimeAmPm(myActivePass.timeOut)}</span>
            </div>

            {/* Urgency Badge */}
            {urgency && (
              <div className="pt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs ${urgency.badgeClass}`}>
                  {urgency.label}
                </span>
              </div>
            )}
          </div>

          {/* Authorizing Teacher Details */}
          <div className="text-xs text-slate-600 max-w-sm mx-auto bg-purple-50/70 p-3 rounded-xl border border-purple-100 flex items-center justify-between">
            <span className="text-slate-500">Authorizing Teacher:</span>
            <span className="font-bold text-purple-950">{myActivePass.teacher} {myActivePass.teacherRoom ? `(${myActivePass.teacherRoom})` : ''}</span>
          </div>

          {/* Big Return To Class Button */}
          <div className="pt-2">
            <button
              id="btn-return-to-class"
              type="button"
              onClick={handleReturnToClass}
              disabled={isSubmitting}
              className="w-full max-w-md mx-auto py-4 px-8 bg-gradient-to-r from-purple-900 via-purple-800 to-amber-600 hover:from-purple-950 hover:to-amber-700 text-white rounded-2xl font-black text-lg sm:text-xl shadow-xl shadow-purple-900/20 hover:shadow-2xl transition transform active:scale-95 flex items-center justify-center gap-3 border-2 border-amber-300"
            >
              <RotateCcw className="w-6 h-6 text-amber-300" />
              <span>RETURN TO CLASS</span>
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Tap immediately when you walk back into your classroom.
            </p>
          </div>
        </div>
      ) : (
        /* ========================================================
           CASE 2: STUDENT IS IN CLASS (SHOW REQUEST FORM)
           ======================================================== */
        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-bold text-purple-950 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Request New Hall Pass
            </h3>
            <p className="text-sm text-slate-600">
              Select your destination and teacher to start a pass. Only 1 active pass is permitted.
            </p>
          </div>

          <form onSubmit={handleStartPass} className="space-y-6">
            
            {/* 1. Destination Selection Grid */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                1. Select Destination <span className="text-purple-600">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {Object.values(DESTINATIONS).map((dest) => {
                  const isSelected = selectedDestination === dest.name;
                  return (
                    <button
                      key={dest.name}
                      type="button"
                      onClick={() => setSelectedDestination(dest.name)}
                      className={`p-3.5 rounded-xl border-2 text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'border-purple-800 bg-purple-50 text-purple-950 shadow-md ring-2 ring-purple-300'
                          : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`p-2 rounded-lg ${isSelected ? 'bg-purple-900 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                          {getDestinationIcon(dest.name)}
                        </span>
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-700" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm leading-tight">{dest.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{dest.defaultMaxMinutes} min target</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Teacher Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">
                  2. Authorizing Teacher <span className="text-purple-600">*</span>
                </label>
                <select
                  id="select-authorizing-teacher"
                  value={selectedTeacherName}
                  onChange={(e) => setSelectedTeacherName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-700 focus:ring-2 focus:ring-purple-200 outline-none text-sm font-medium text-slate-800 bg-white"
                >
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.name}>
                      {teacher.name} — {teacher.room} ({teacher.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Optional Details / Specific Room */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">
                  3. Reason / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="input-destination-notes"
                  type="text"
                  placeholder={
                    selectedDestination === 'Another Classroom' 
                      ? 'e.g., Returning Chromebook to Mrs. Harper'
                      : selectedDestination === 'Other'
                      ? 'e.g., Locker trip for binder'
                      : 'Add any specific notes...'
                  }
                  value={destinationDetails}
                  onChange={(e) => setDestinationDetails(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-700 focus:ring-2 focus:ring-purple-200 outline-none text-sm text-slate-800"
                />
              </div>
            </div>

            {/* Giant Submit Button */}
            <button
              id="btn-submit-hall-pass"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-950 via-purple-900 to-amber-500 hover:from-purple-900 hover:to-amber-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-purple-950/20 hover:shadow-2xl transition transform active:scale-[0.98] flex items-center justify-center gap-3 border border-amber-300"
            >
              <Send className="w-5 h-5 text-amber-300" />
              <span>REQUEST & START HALL PASS</span>
            </button>
          </form>
        </div>
      )}

      {/* Pass History for Current Student */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-purple-950 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" />
            My Recent Pass Activity
          </h4>
          <span className="text-xs text-slate-500 font-medium">
            {myRecentPasses.length} total logged
          </span>
        </div>

        {myRecentPasses.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            No hall passes recorded yet for {activeStudent.firstName}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden">
            {myRecentPasses.slice(0, 5).map((pass) => (
              <div key={pass.id} className="py-3 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-900">
                    {getDestinationIcon(pass.destination)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">{pass.destination}</span>
                    <span className="text-slate-500 text-xs block">
                      Teacher: {pass.teacher} • {new Date(pass.timeOut).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {formatTimeAmPm(pass.timeOut)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                    pass.status === 'ACTIVE' 
                      ? 'bg-amber-100 text-amber-800 animate-pulse' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {pass.status === 'ACTIVE' ? 'Out Now' : `${pass.durationMinutes || 4} min`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
