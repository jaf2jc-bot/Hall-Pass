import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  Search,
  Plus,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  ClipboardList,
  Check,
  X,
  Send,
  History,
  CalendarDays
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import {
  HallPass,
  Student,
  StudentRequest
} from '../types';

import {
  endHallPass,
  createStudentRequest,
  subscribeToStudentRequests,
  completeStudentRequest,
  cancelStudentRequest
} from '../lib/firebase';

import {
  formatElapsedTime,
  getPassUrgency,
  playNotificationTone
} from '../lib/constants';

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
  const {
    activeTeacher,
    students
  } = useAuth();

  const [studentSearch, setStudentSearch] = useState('');
  const [endingPassId, setEndingPassId] = useState<string | null>(null);

  // ============================================================
  // STUDENT REQUEST STATE
  // ============================================================

  const [studentRequests, setStudentRequests] =
    useState<StudentRequest[]>([]);

  const [isRequestStudentOpen, setIsRequestStudentOpen] =
    useState(false);

  const [requestStudentSearch, setRequestStudentSearch] =
    useState('');

  const [selectedRequestStudent, setSelectedRequestStudent] =
    useState<Student | null>(null);

  const [requestDate, setRequestDate] = useState('');

  const [requestPeriod, setRequestPeriod] =
    useState('1');

  const [requestReason, setRequestReason] =
    useState('');

  const [requestNotes, setRequestNotes] =
    useState('');

  const [requestSubmitting, setRequestSubmitting] =
    useState(false);

  const [requestError, setRequestError] =
    useState<string | null>(null);

  const [requestActionLoadingId, setRequestActionLoadingId] =
    useState<string | null>(null);

  // ============================================================
  // PERIOD OPTIONS
  // ============================================================

  const periodOptions = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    'Polar Time',
    '9',
    '10'
  ];

  // ============================================================
  // REQUEST SUBSCRIPTION
  // ============================================================

  useEffect(() => {
    const unsubscribe = subscribeToStudentRequests((requests) => {
      setStudentRequests(requests);
    });

    return () => unsubscribe();
  }, []);

  // ============================================================
  // DEFAULT REQUEST DATE
  // ============================================================

  useEffect(() => {
    if (!requestDate) {
      const today = new Date();

      const localDate =
        today.getFullYear() +
        '-' +
        String(today.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(today.getDate()).padStart(2, '0');

      setRequestDate(localDate);
    }
  }, [requestDate]);

  // ============================================================
  // MY CLASSROOM ACTIVE PASSES
  // ============================================================

  const myClassroomActivePasses = activePasses.filter(
    (p) =>
      activeTeacher &&
      p.teacher === activeTeacher.name
  );

  // ============================================================
  // OTHER ACTIVE PASSES
  // ============================================================

  const otherClassroomActivePasses = activePasses.filter(
    (p) =>
      !activeTeacher ||
      p.teacher !== activeTeacher.name
  );

  // ============================================================
  // STUDENT DIRECTORY SEARCH
  // ============================================================

  const filteredStudents = students
    .filter((s) => {
      const q = studentSearch.toLowerCase().trim();

      if (!q) return true;

      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`
          .toLowerCase()
          .includes(q) ||
        `${s.lastName}, ${s.firstName}`
          .toLowerCase()
          .includes(q) ||
        s.studentId.includes(q) ||
        (s.homeroom &&
          s.homeroom.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const lastNameCompare =
        a.lastName.localeCompare(b.lastName);

      if (lastNameCompare !== 0) {
        return lastNameCompare;
      }

      return a.firstName.localeCompare(b.firstName);
    });

  // ============================================================
  // REQUEST STUDENT SEARCH
  // ============================================================

  const filteredRequestStudents = useMemo(() => {
    const q = requestStudentSearch.toLowerCase().trim();

    return students
      .filter((s) => {
        if (!q) return true;

        return (
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          `${s.firstName} ${s.lastName}`
            .toLowerCase()
            .includes(q) ||
          `${s.lastName}, ${s.firstName}`
            .toLowerCase()
            .includes(q) ||
          s.studentId.includes(q)
        );
      })
      .sort((a, b) => {
        const lastNameCompare =
          a.lastName.localeCompare(b.lastName);

        if (lastNameCompare !== 0) {
          return lastNameCompare;
        }

        return a.firstName.localeCompare(b.firstName);
      });
  }, [students, requestStudentSearch]);

  // ============================================================
  // OPEN REQUEST FORM
  // ============================================================

  const openRequestStudentForm = (student?: Student) => {
    setSelectedRequestStudent(student || null);

    setRequestStudentSearch(
      student
        ? `${student.lastName}, ${student.firstName}`
        : ''
    );

    setRequestError(null);

    const today = new Date();

    const localDate =
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0');

    setRequestDate(localDate);

    setRequestPeriod('1');
    setRequestReason('');
    setRequestNotes('');

    setIsRequestStudentOpen(true);
  };

  // ============================================================
  // CLOSE REQUEST FORM
  // ============================================================

  const closeRequestStudentForm = () => {
    if (requestSubmitting) return;

    setIsRequestStudentOpen(false);
    setRequestError(null);
  };

  // ============================================================
  // CREATE STUDENT REQUEST
  // ============================================================

  const handleCreateStudentRequest = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!selectedRequestStudent) {
      setRequestError('Please select a student.');
      return;
    }

    if (!activeTeacher) {
      setRequestError(
        'Unable to identify the logged-in teacher. Please sign in again.'
      );
      return;
    }

    if (!requestDate) {
      setRequestError('Please select a date.');
      return;
    }

    if (!requestPeriod) {
      setRequestError('Please select a period.');
      return;
    }

    setRequestSubmitting(true);
    setRequestError(null);

    try {
      /*
       * IMPORTANT:
       *
       * The requesting teacher does NOT choose the student's teacher.
       *
       * The student record is passed to Firebase and Firebase should
       * determine which teacher/classroom is responsible for that
       * student.
       *
       * The request is then visible on the receiving teacher's dashboard.
       */

      await createStudentRequest({
        studentDocId: selectedRequestStudent.id,
        studentId: selectedRequestStudent.studentId,
        studentName: `${selectedRequestStudent.firstName} ${selectedRequestStudent.lastName}`,
        studentEmail: selectedRequestStudent.email,

        requestingTeacherId: activeTeacher.id,
        requestingTeacher: activeTeacher.name,
        requestingTeacherRoom: activeTeacher.room,

        requestDate,
        period: requestPeriod,

        reason: requestReason.trim() || undefined,
        notes: requestNotes.trim() || undefined
      });

      if (soundEnabled) {
        playNotificationTone('start');
      }

      setIsRequestStudentOpen(false);
      setSelectedRequestStudent(null);
      setRequestStudentSearch('');
      setRequestReason('');
      setRequestNotes('');
    } catch (err: unknown) {
      const error = err as Error;

      setRequestError(
        error.message ||
        'Failed to save student request.'
      );
    } finally {
      setRequestSubmitting(false);
    }
  };

  // ============================================================
  // COMPLETE REQUEST
  // ============================================================

  const handleCompleteRequest = async (
    request: StudentRequest
  ) => {
    setRequestActionLoadingId(request.id);

    try {
      await completeStudentRequest(request.id);

      if (soundEnabled) {
        playNotificationTone('end');
      }
    } catch (err) {
      console.error(
        'Failed to complete student request:',
        err
      );
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  // ============================================================
  // CANCEL REQUEST
  // ============================================================

  const handleCancelRequest = async (
    request: StudentRequest
  ) => {
    setRequestActionLoadingId(request.id);

    try {
      await cancelStudentRequest(request.id);
    } catch (err) {
      console.error(
        'Failed to cancel student request:',
        err
      );
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  // ============================================================
  // END ACTIVE PASS
  // ============================================================

  const handleEndPass = async (passId: string) => {
    setEndingPassId(passId);

    try {
      await endHallPass(passId, 'teacher');

      if (soundEnabled) {
        playNotificationTone('end');
      }
    } catch (err) {
      console.error(
        'Failed to end pass:',
        err
      );
    } finally {
      setEndingPassId(null);
    }
  };

  // ============================================================
  // STUDENT STATS
  // ============================================================

  const getStudentStats = (student: Student) => {
    const studentPasses = allPasses.filter(
      (p) =>
        p.studentId === student.studentId ||
        p.studentDocId === student.id
    );

    const activePass = activePasses.find(
      (p) =>
        p.studentId === student.studentId ||
        p.studentDocId === student.id
    );

    const todayPasses = studentPasses.filter(
      (p) =>
        new Date(p.timeOut).toDateString() ===
        new Date().toDateString()
    );

    const completedPasses = studentPasses.filter(
      (p) => p.durationMinutes
    );

    const totalMins = completedPasses.reduce(
      (acc, p) =>
        acc + (p.durationMinutes || 0),
      0
    );

    const avgDuration =
      completedPasses.length > 0
        ? (
            totalMins /
            completedPasses.length
          ).toFixed(1)
        : '4.5';

    return {
      total: studentPasses.length,
      today: todayPasses.length,
      avgDuration,
      activePass
    };
  };

  // ============================================================
  // REQUEST GROUPING
  // ============================================================

  const todayString = (() => {
    const today = new Date();

    return (
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0')
    );
  })();

  /*
   * The receiving teacher's dashboard should only display requests
   * assigned to the logged-in teacher.
   *
   * This assumes createStudentRequest stores the responsible teacher
   * on the request as receivingTeacherId.
   */

  const myRequests = studentRequests.filter(
    (request) =>
      request.receivingTeacherId === activeTeacher?.id
  );

  const upcomingRequests = myRequests.filter(
    (request) =>
      request.status === 'PENDING' &&
      request.requestDate > todayString
  );

  const todayRequests = myRequests.filter(
    (request) =>
      request.status === 'PENDING' &&
      request.requestDate === todayString
  );

  const pastRequests = myRequests.filter(
    (request) =>
      request.status === 'PENDING' &&
      request.requestDate < todayString
  );

  const completedRequests = myRequests.filter(
    (request) =>
      request.status === 'COMPLETED'
  );

  const cancelledRequests = myRequests.filter(
    (request) =>
      request.status === 'CANCELLED'
  );

  const requestHistory = [
    ...completedRequests,
    ...cancelledRequests
  ].sort((a, b) =>
    b.requestDate.localeCompare(a.requestDate)
  );

  // ============================================================
  // REQUEST CARD
  // ============================================================

  const renderRequestCard = (
    request: StudentRequest
  ) => {
    const isLoading =
      requestActionLoadingId === request.id;

    const isToday =
      request.requestDate === todayString;

    const isPast =
      request.requestDate < todayString;

    return (
      <div
        key={request.id}
        className={`rounded-xl border-2 p-4 shadow-sm ${
          request.status === 'COMPLETED'
            ? 'bg-emerald-50 border-emerald-200'
            : request.status === 'CANCELLED'
            ? 'bg-slate-50 border-slate-200'
            : isPast
            ? 'bg-rose-50 border-rose-300'
            : isToday
            ? 'bg-amber-50 border-amber-300'
            : 'bg-white border-purple-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          <div className="flex items-start gap-3 min-w-0">

            <div className="w-10 h-10 rounded-xl bg-purple-950 text-amber-300 font-black flex items-center justify-center shrink-0">
              {request.studentName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>

            <div className="min-w-0">

              <h4 className="font-extrabold text-slate-900">
                {request.studentName}
              </h4>

              <div className="text-xs text-slate-500 mt-0.5">
                ID #{request.studentId}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">

                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 text-purple-900 text-xs font-bold">
                  <CalendarDays className="w-3 h-3" />
                  {request.requestDate}
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                  <Clock className="w-3 h-3" />
                  Period {request.period}
                </span>

              </div>

              {request.reason && (
                <p className="text-xs text-slate-600 mt-2">
                  <strong>Reason:</strong>{' '}
                  {request.reason}
                </p>
              )}

              {request.notes && (
                <p className="text-xs text-slate-500 mt-1">
                  <strong>Notes:</strong>{' '}
                  {request.notes}
                </p>
              )}

              <p className="text-[11px] text-slate-400 mt-2">
                Requested by:{' '}
                <span className="font-semibold">
                  {request.requestingTeacher}
                </span>

                {request.requestingTeacherRoom
                  ? ` • ${request.requestingTeacherRoom}`
                  : ''}
              </p>

            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">

            {request.status === 'COMPLETED' && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                <Check className="w-3 h-3" />
                Completed
              </span>
            )}

            {request.status === 'CANCELLED' && (
              <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1">
                <X className="w-3 h-3" />
                Cancelled
              </span>
            )}

            {request.status === 'PENDING' && (
              <>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isPast
                      ? 'bg-rose-100 text-rose-800'
                      : isToday
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {isPast
                    ? 'Past Due'
                    : isToday
                    ? 'Today'
                    : 'Upcoming'}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    handleCompleteRequest(request)
                  }
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />

                  {isLoading
                    ? 'Saving...'
                    : 'Complete'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCancelRequest(request)
                  }
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN DASHBOARD
  // ============================================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ========================================================
          TEACHER PROFILE
         ======================================================== */}

      <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border-2 border-amber-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">

        <div className="flex items-center gap-4">

          <div className="w-14 h-14 rounded-2xl bg-amber-400 text-purple-950 font-black text-xl flex items-center justify-center shadow-lg border-2 border-amber-200">
            {activeTeacher
              ? activeTeacher.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
              : 'T'}
          </div>

          <div>

            <div className="flex items-center gap-2">

              <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Teacher Desk
              </span>

              <span className="text-xs text-purple-200">
                {activeTeacher?.room || 'Room 204'} •{' '}
                {activeTeacher?.subject ||
                  '8th Grade Science'}
              </span>

            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {activeTeacher?.name ||
                'Staff Educator'}
            </h2>

          </div>

        </div>

        <div className="flex items-center gap-3 flex-wrap">

          <button
            id="btn-request-student"
            type="button"
            onClick={() =>
              openRequestStudentForm()
            }
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm rounded-xl shadow-lg flex items-center gap-2 transition transform active:scale-95 border border-emerald-300"
          >
            <ClipboardList className="w-5 h-5" />
            <span>Request Student</span>
          </button>

          <button
            id="btn-issue-pass-teacher"
            type="button"
            onClick={() =>
              onOpenRequestModal()
            }
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-black text-sm rounded-xl shadow-lg flex items-center gap-2 transition transform active:scale-95 border border-amber-200"
          >
            <Plus className="w-5 h-5" />
            <span>Send Student Out</span>
          </button>

        </div>

      </div>

      {/* ========================================================
          REQUEST STUDENT MODAL
         ======================================================== */}

      {isRequestStudentOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border-2 border-purple-200 max-h-[90vh] overflow-y-auto">

            <div className="p-5 border-b border-slate-100 flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>

                <div>

                  <h3 className="text-xl font-black text-purple-950">
                    Request Student
                  </h3>

                  <p className="text-xs text-slate-500">
                    Request a student to report to your classroom.
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={closeRequestStudentForm}
                className="p-2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <form
              onSubmit={handleCreateStudentRequest}
              className="p-5 space-y-5"
            >

              {requestError && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}

              {/* REQUESTING TEACHER */}

              <div>

                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Requesting Teacher
                </label>

                <div className="p-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-sm font-semibold text-slate-800">
                  {activeTeacher?.name ||
                    'Unable to identify teacher'}

                  {activeTeacher?.room
                    ? ` — ${activeTeacher.room}`
                    : ''}
                </div>

              </div>

              {/* STUDENT */}

              <div>

                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Student *
                </label>

                <div className="relative">

                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                  <input
                    type="text"
                    value={requestStudentSearch}
                    onChange={(e) => {
                      setRequestStudentSearch(
                        e.target.value
                      );

                      setSelectedRequestStudent(null);
                    }}
                    placeholder="Search first name, last name, or ID..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none text-sm"
                  />

                </div>

                {!selectedRequestStudent &&
                  requestStudentSearch.trim() && (

                    <div className="mt-2 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">

                      {filteredRequestStudents
                        .slice(0, 12)
                        .map((student) => (

                          <button
                            key={student.id}
                            type="button"
                            onClick={() => {
                              setSelectedRequestStudent(student);

                              setRequestStudentSearch(
                                `${student.lastName}, ${student.firstName}`
                              );
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-purple-50 border-b border-slate-100 last:border-0"
                          >

                            <div className="font-bold text-sm text-slate-900">
                              {student.lastName},{' '}
                              {student.firstName}
                            </div>

                            <div className="text-xs text-slate-500">
                              #{student.studentId} • Grade {student.grade}
                            </div>

                          </button>

                        ))}

                      {filteredRequestStudents.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No students found.
                        </div>
                      )}

                    </div>
                  )}

                {selectedRequestStudent && (
                  <div className="mt-2 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-between">

                    <div>

                      <div className="font-bold text-emerald-900 text-sm">
                        {selectedRequestStudent.lastName},{' '}
                        {selectedRequestStudent.firstName}
                      </div>

                      <div className="text-xs text-emerald-700">
                        #{selectedRequestStudent.studentId}
                      </div>

                    </div>

                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />

                  </div>
                )}

              </div>

              {/* DATE */}

              <div>

                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Date *
                </label>

                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) =>
                    setRequestDate(e.target.value)
                  }
                  required
                  className="w-full p-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none text-sm"
                />

              </div>

              {/* PERIOD */}

              <div>

                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Period *
                </label>

                <select
                  value={requestPeriod}
                  onChange={(e) =>
                    setRequestPeriod(e.target.value)
                  }
                  className="w-full p-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none text-sm bg-white"
                >
                  {periodOptions.map((period) => (
                    <option
                      key={period}
                      value={period}
                    >
                      {period === 'Polar Time'
                        ? 'Polar Time'
                        : `Period ${period}`}
                    </option>
                  ))}
                </select>

              </div>

              {/* REASON */}

              <div>

                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Reason{' '}
                  <span className="font-normal text-slate-400">
                    (Optional)
                  </span>
                </label>

                <input
                  type="text"
                  value={requestReason}
                  onChange={(e) =>
                    setRequestReason(e.target.value)
                  }
                  placeholder="e.g. Group project, make-up work..."
                  className="w-full p-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none text-sm"
                />

              </div>

              {/* NOTES */}

              <div>

                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Notes{' '}
                  <span className="font-normal text-slate-400">
                    (Optional)
                  </span>
                </label>

                <textarea
                  value={requestNotes}
                  onChange={(e) =>
                    setRequestNotes(e.target.value)
                  }
                  placeholder="Additional information..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none text-sm resize-none"
                />

              </div>

              {/* ACTIONS */}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">

                <button
                  type="button"
                  onClick={closeRequestStudentForm}
                  disabled={requestSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    requestSubmitting ||
                    !selectedRequestStudent
                  }
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />

                  {requestSubmitting
                    ? 'Saving...'
                    : 'Send Request'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ========================================================
          STUDENT REQUESTS
         ======================================================== */}

      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 space-y-5">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

          <div>

            <h3 className="text-lg font-bold text-purple-950 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Student Requests
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Requests from other teachers for students assigned to you.
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              openRequestStudentForm()
            }
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Request Student
          </button>

        </div>

        {/* TODAY */}

        <div className="space-y-3">

          <div className="flex items-center gap-2">

            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />

            <h4 className="font-black text-purple-950">
              Today's Requests
            </h4>

            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {todayRequests.length}
            </span>

          </div>

          {todayRequests.length === 0 ? (

            <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">

              <p className="text-sm text-slate-500">
                No requests for today.
              </p>

            </div>

          ) : (

            <div className="space-y-2">
              {todayRequests.map(renderRequestCard)}
            </div>

          )}

        </div>

        {/* UPCOMING */}

        <div className="space-y-3 pt-2">

          <div className="flex items-center gap-2">

            <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />

            <h4 className="font-black text-purple-950">
              Upcoming Requests
            </h4>

            <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
              {upcomingRequests.length}
            </span>

          </div>

          {upcomingRequests.length === 0 ? (

            <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">

              <p className="text-sm text-slate-500">
                No upcoming requests.
              </p>

            </div>

          ) : (

            <div className="space-y-2">
              {upcomingRequests.map(renderRequestCard)}
            </div>

          )}

        </div>

        {/* PAST DUE */}

        {pastRequests.length > 0 && (

          <div className="space-y-3 pt-2">

            <div className="flex items-center gap-2">

              <AlertTriangle className="w-4 h-4 text-rose-600" />

              <h4 className="font-black text-rose-900">
                Past Due / Not Completed
              </h4>

              <span className="text-xs font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                {pastRequests.length}
              </span>

            </div>

            <div className="space-y-2">
              {pastRequests.map(renderRequestCard)}
            </div>

          </div>

        )}

        {/* HISTORY */}

        {requestHistory.length > 0 && (

          <details className="pt-3 border-t border-slate-200">

            <summary className="cursor-pointer list-none">

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">

                <div className="flex items-center gap-3">

                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-900 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>

                  <div>

                    <h4 className="font-black text-purple-950">
                      Request History
                    </h4>

                    <p className="text-xs text-slate-500">
                      Completed and cancelled student requests
                    </p>

                  </div>

                </div>

                <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full">
                  {requestHistory.length}
                </span>

              </div>

            </summary>

            <div className="mt-3 space-y-3">

              <div className="flex flex-wrap gap-2 px-1">

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <Check className="w-3 h-3" />
                  {completedRequests.length} Completed
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                  <X className="w-3 h-3" />
                  {cancelledRequests.length} Cancelled
                </span>

              </div>

              {requestHistory.map(renderRequestCard)}

            </div>

          </details>

        )}

        {requestHistory.length === 0 && (
          <div className="pt-3 border-t border-slate-200">

            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">

              <History className="w-5 h-5 text-slate-400 mx-auto mb-1" />

              <p className="text-xs text-slate-500">
                No completed or cancelled requests yet.
              </p>

            </div>

          </div>
        )}

      </div>

      {/* ========================================================
          STUDENTS CURRENTLY OUT
         ======================================================== */}

      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 space-y-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="w-3 h-3 rounded-full bg-purple-700 animate-pulse" />

            <h3 className="text-lg font-bold text-purple-950">
              Students Out From My Class (
              {activeTeacher?.room || 'My Room'})
            </h3>

          </div>

          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-900">
            {myClassroomActivePasses.length} Active Now
          </span>

        </div>

        {myClassroomActivePasses.length === 0 ? (

          <div className="p-6 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200">

            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />

            <p className="text-slate-700 font-semibold text-sm">
              No students currently out from your classroom.
            </p>

            <p className="text-xs text-slate-400 mt-0.5">
              Use the "Send Student Out" button above to issue a pass.
            </p>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

            {myClassroomActivePasses.map((pass) => {

              const urgency =
                getPassUrgency(pass.timeOut);

              const isEnding =
                endingPassId === pass.id;

              return (

                <div
                  key={pass.id}
                  className={`p-4 rounded-xl border-2 shadow-sm flex flex-col justify-between ${urgency.cardClass}`}
                >

                  <div className="flex items-start justify-between mb-2">

                    <div>

                      <h4 className="font-extrabold text-slate-900 text-base">
                        {pass.studentName}
                      </h4>

                      <span className="text-xs text-slate-500 font-mono">
                        ID #{pass.studentId}
                      </span>

                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${urgency.badgeClass}`}
                    >
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

                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        Time Out
                      </div>

                      <div className="font-mono font-bold text-purple-950 text-lg">
                        {formatElapsedTime(pass.timeOut)}
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleEndPass(pass.id)
                      }
                      disabled={isEnding}
                      className="px-3 py-1.5 bg-purple-900 hover:bg-purple-950 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1.5 active:scale-95"
                    >

                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />

                      <span>
                        {isEnding
                          ? 'Ending...'
                          : 'End Pass'}
                      </span>

                    </button>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>

      {/* ========================================================
          STUDENT DIRECTORY
         ======================================================== */}

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
              placeholder="Search first name, last name, or ID..."
              value={studentSearch}
              onChange={(e) =>
                setStudentSearch(e.target.value)
              }
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none text-xs sm:text-sm"
            />

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs sm:text-sm">

            <thead>

              <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">

                <th className="py-3 px-3">
                  Student Name
                </th>

                <th className="py-3 px-3">
                  Student ID
                </th>

                <th className="py-3 px-3">
                  Current Status
                </th>

                <th className="py-3 px-3">
                  Passes Today
                </th>

                <th className="py-3 px-3">
                  Total Passes
                </th>

                <th className="py-3 px-3">
                  Avg Duration
                </th>

                <th className="py-3 px-3 text-right">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {filteredStudents.map((student) => {

                const stats =
                  getStudentStats(student);

                return (

                  <tr
                    key={student.id}
                    className="hover:bg-purple-50/50 transition"
                  >

                    <td className="py-3 px-3 font-semibold text-slate-900">

                      <div className="flex items-center gap-2">

                        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-center">
                          {student.firstName[0]}
                          {student.lastName[0]}
                        </div>

                        <span>
                          {student.lastName},{' '}
                          {student.firstName}
                        </span>

                      </div>

                    </td>

                    <td className="py-3 px-3 font-mono text-slate-600">
                      #{student.studentId}
                    </td>

                    <td className="py-3 px-3">

                      {stats.activePass ? (

                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse inline-flex items-center gap-1">

                          <Clock className="w-3 h-3" />

                          Out:{' '}
                          {stats.activePass.destination}

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
                          onClick={() =>
                            onOpenRequestModal(student)
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-purple-950 font-bold text-xs transition"
                          title="Issue pass for student"
                        >
                          Issue Pass
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openRequestStudentForm(student)
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs transition"
                      >
                        Request
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenStudentDetail(student)
                        }
                        className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs transition"
                      >
                        View History
                      </button>

                    </td>

                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-slate-500"
                  >
                    No students found.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
};
