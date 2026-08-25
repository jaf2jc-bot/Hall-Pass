import React, { useState } from 'react';
import { 
  UserCheck, 
  Search, 
  Plus, 
  Clock, 
  History, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  GraduationCap, 
  BarChart3, 
  ChevronRight,
  Sparkles,
  Bath,
  Building2,
  HeartPulse,
  DoorOpen,
  BookOpen,
  HelpCircle,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { HallPass, Student, Teacher, DestinationType } from '../types';
import { endHallPass } from '../lib/firebase';
import { formatElapsedTime, formatTimeAmPm, getPassUrgency, DESTINATION_LIST, playNotificationTone } from '../lib/constants';

interface TeacherDashboardProps {
  activePasses: HallPass[];
  allPasses: HallPass[];
  onOpenRequestModal: (student?: Student) => void;
  onOpenStudentDetail: (student: Student) => void;
  soundEnabled: boolean;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  activePasses,
  allPasses,
  onOpenRequestModal,
  onOpenStudentDetail,
  soundEnabled
}) => {
  const { activeTeacher, teachers, students, selectTeacher } = useAuth();
  const [studentSearch, setStudentSearch] = useState('');
  const [endingPassId, setEndingPassId] = useState<string | null>(null);

  // Passes originating from this teacher's classroom
  const myClassroomActivePasses = activePasses.filter(
    (p) => activeTeacher && p.teacher === activeTeacher.name
  );

  // All active passes across the school
  const otherClassroomActivePasses = activePasses.filter(
    (p) => !activeTeacher || p.teacher !== activeTeacher.name
  );

  // Filter students for directory search
  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentId.includes(q) ||
      (s.homeroom && s.homeroom.toLowerCase().includes(q))
    );
  });

  const handleEndPass = async (passId: string) => {
    setEndingPassId(passId);
    try {
      await endHallPass(passId, 'teacher');
      if (soundEnabled) playNotificationTone('end');
    } catch (err) {
      console.error('Failed to end pass:', err);
    } finally {
      setEndingPassId(null);
    }
  };

  const getStudentStats = (student: Student) => {
    const studentPasses = allPasses.filter(
      (p) => p.studentId === student.studentId || p.studentDocId === student.id
    );
    const activePass = activePasses.find(
      (p) => p.studentId === student.studentId || p.studentDocId === student.id
    );
    const todayPasses = studentPasses.filter(
      (p) => new Date(p.timeOut).toDateString() === new Date().toDateString()
    );
    const completedPasses = studentPasses.filter((p) => p.durationMinutes);
    const totalMins = completedPasses.reduce((acc, p) => acc + (p.durationMinutes || 0), 0);
    const avgDuration = completedPasses.length > 0 ? (totalMins / completedPasses.length).toFixed(1) : '4.5';

    return {
      total: studentPasses.length,
      today: todayPasses.length,
      avgDuration,
      activePass
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Teacher Profile Bar */}
      <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border-2 border-amber-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400 text-purple-950 font-black text-xl flex items-center justify-center shadow-lg border-2 border-amber-200">
            {activeTeacher ? activeTeacher.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'T'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Teacher Desk
              </span>
              <span className="text-xs text-purple-200">
                {activeTeacher?.room || 'Room 204'} • {activeTeacher?.subject || '8th Grade Science'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {activeTeacher?.name || 'Staff Educator'}
            </h2>
          </div>
        </div>

        {/* Quick Launch Button */}
        <div className="flex items-center gap-3">
          <button
            id="btn-issue-pass-teacher"
            type="button"
            onClick={() => onOpenRequestModal()}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-black text-sm rounded-xl shadow-lg flex items-center gap-2 transition transform active:scale-95 border border-amber-200"
          >
            <Plus className="w-5 h-5" />
            <span>Send Student Out (New Pass)</span>
          </button>
        </div>
      </div>

      {/* Section 1: Students Currently Out From My Classroom */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-700 animate-pulse" />
            <h3 className="text-lg font-bold text-purple-950">
              Students Out From My Class ({activeTeacher?.room || 'My Room'})
            </h3>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-900">
            {myClassroomActivePasses.length} Active Now
          </span>
        </div>

        {myClassroomActivePasses.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-slate-700 font-semibold text-sm">No students currently out from your classroom.</p>
            <p className="text-xs text-slate-400 mt-0.5">Use the "Send Student Out" button above to issue a pass.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myClassroomActivePasses.map((pass) => {
              const urgency = getPassUrgency(pass.timeOut);
              const isEnding = endingPassId === pass.id;

              return (
                <div 
                  key={pass.id}
                  className={`p-4 rounded-xl border-2 shadow-sm flex flex-col justify-between ${urgency.cardClass}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">{pass.studentName}</h4>
                      <span className="text-xs text-slate-500 font-mono">ID #{pass.studentId}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${urgency.badgeClass}`}>
                      {urgency.label}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80 mb-3 text-xs">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5">
                      {pass.destination}
                    </span>
                    {pass.destinationDetails && (
                      <span className="text-slate-600 italic block mt-0.5 text-[11px]">
                        "{pass.destinationDetails}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Time Out</div>
                      <div className="font-mono font-bold text-purple-950 text-lg">
                        {formatElapsedTime(pass.timeOut)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEndPass(pass.id)}
                      disabled={isEnding}
                      className="px-3 py-1.5 bg-purple-900 hover:bg-purple-950 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1.5 active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                      <span>{isEnding ? 'Ending...' : 'End Pass'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Student Directory, Pass History, & Average Durations */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-purple-950 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-700" />
              8th-Grade Student Directory & Usage Stats
            </h3>
            <p className="text-xs text-slate-500">
              Search students to inspect pass frequency, average durations, and full history.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student by name or ID..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Student ID</th>
                <th className="py-3 px-3">Current Status</th>
                <th className="py-3 px-3">Passes Today</th>
                <th className="py-3 px-3">Total Passes</th>
                <th className="py-3 px-3">Avg Duration</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const stats = getStudentStats(student);
                return (
                  <tr key={student.id} className="hover:bg-purple-50/50 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-center">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <span>{student.firstName} {student.lastName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      #{student.studentId}
                    </td>
                    <td className="py-3 px-3">
                      {stats.activePass ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Out: {stats.activePass.destination}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          In Class
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-purple-950">
                      {stats.today}
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {stats.total} passes
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {stats.avgDuration} min
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      {!stats.activePass && (
                        <button
                          type="button"
                          onClick={() => onOpenRequestModal(student)}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-purple-950 font-bold text-xs transition"
                          title="Issue pass for student"
                        >
                          Issue Pass
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenStudentDetail(student)}
                        className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs transition"
                      >
                        View History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
