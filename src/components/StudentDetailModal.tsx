import React from 'react';
import { 
  X, 
  GraduationCap, 
  Clock, 
  History, 
  CheckCircle2, 
  TrendingUp, 
  Calendar,
  Bath,
  Building2,
  HeartPulse,
  UserCheck,
  DoorOpen,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { Student, HallPass, DestinationType } from '../types';
import { formatElapsedTime, formatTimeAmPm, formatDateShort } from '../lib/constants';

interface StudentDetailModalProps {
  student: Student | null;
  onClose: () => void;
  allPasses: HallPass[];
  activePasses: HallPass[];
  onIssuePass: (student: Student) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  allPasses,
  activePasses,
  onIssuePass
}) => {
  if (!student) return null;

  const studentPasses = allPasses.filter(
    (p) => p.studentId === student.studentId || p.studentDocId === student.id
  );

  const activePass = activePasses.find(
    (p) => p.studentId === student.studentId || p.studentDocId === student.id
  );

  const completedPasses = studentPasses.filter((p) => p.durationMinutes);
  const totalMinutes = completedPasses.reduce((acc, p) => acc + (p.durationMinutes || 0), 0);
  const avgDuration = completedPasses.length > 0 ? (totalMinutes / completedPasses.length).toFixed(1) : '4.5';

  const todayPasses = studentPasses.filter(
    (p) => new Date(p.timeOut).toDateString() === new Date().toDateString()
  );

  const getDestinationIcon = (dest: DestinationType) => {
    switch (dest) {
      case 'Restroom': return <Bath className="w-4 h-4" />;
      case 'Office': return <Building2 className="w-4 h-4" />;
      case 'Nurse': return <HeartPulse className="w-4 h-4" />;
      case 'Counselor': return <UserCheck className="w-4 h-4" />;
      case 'Another Classroom': return <DoorOpen className="w-4 h-4" />;
      case 'Library': return <BookOpen className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border-2 border-purple-200 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-950 text-amber-400 font-black text-lg flex items-center justify-center shadow">
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2 py-0.5 rounded-full uppercase">
                  Grade {student.grade}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ID #{student.studentId}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {student.firstName} {student.lastName}
              </h3>
              <p className="text-xs text-slate-500">
                Homeroom: {student.homeroom || 'Room 204'} • {student.email}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status alert if active */}
        {activePass && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>Currently in hallway ({activePass.destination}) — Out for {formatElapsedTime(activePass.timeOut)}</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
            <div className="text-xs text-purple-700 font-semibold">Passes Today</div>
            <div className="text-2xl font-black text-purple-950 mt-0.5">{todayPasses.length}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
            <div className="text-xs text-purple-700 font-semibold">Total Passes</div>
            <div className="text-2xl font-black text-purple-950 mt-0.5">{studentPasses.length}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
            <div className="text-xs text-purple-700 font-semibold">Avg Duration</div>
            <div className="text-2xl font-black text-purple-950 mt-0.5">{avgDuration} min</div>
          </div>
        </div>

        {/* Individual Pass History */}
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
            <History className="w-4 h-4 text-purple-700" />
            Complete Pass History ({studentPasses.length} records)
          </h4>

          {studentPasses.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
              No historical passes recorded for this student yet.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {studentPasses.map((pass) => (
                <div key={pass.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-purple-100 text-purple-900">
                      {getDestinationIcon(pass.destination)}
                    </span>
                    <div>
                      <span className="font-bold text-slate-800">{pass.destination}</span>
                      <span className="text-slate-500 block text-[11px]">
                        Authorized by: {pass.teacher} • {formatDateShort(pass.timeOut)} at {formatTimeAmPm(pass.timeOut)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-purple-950 block">
                      {pass.status === 'ACTIVE' ? 'Active Out' : `${pass.durationMinutes || 4} min`}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {pass.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            Close
          </button>
          {!activePass && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onIssuePass(student);
              }}
              className="px-4 py-2 rounded-xl bg-purple-950 hover:bg-purple-900 text-amber-300 text-xs font-bold shadow"
            >
              Issue New Pass
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
