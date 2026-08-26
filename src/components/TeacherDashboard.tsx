import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Clock,
  RotateCcw,
  CheckCircle2,
  GraduationCap,
  Users,
  Trash2,
  UserPlus,
  UserMinus,
  ChevronDown
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import {
  HallPass,
  Student,
  TeacherRoster
} from '../types';

import {
  endHallPass,
  subscribeToTeacherRosters,
  createTeacherRoster,
  deleteTeacherRoster,
  addStudentToTeacherRoster,
  removeStudentFromTeacherRoster
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

  // ==========================================
  // ROSTER STATE
  // ==========================================

  const [rosters, setRosters] = useState<TeacherRoster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string>('');

  const [showCreateRoster, setShowCreateRoster] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterDescription, setNewRosterDescription] = useState('');

  const [rosterSearch, setRosterSearch] = useState('');

  const [showManageStudents, setShowManageStudents] = useState(false);
  const [studentPickerSearch, setStudentPickerSearch] = useState('');

  const [savingRoster, setSavingRoster] = useState(false);
  const [rosterError, setRosterError] = useState('');

  // ==========================================
  // LOAD TEACHER ROSTERS
  // ==========================================

  useEffect(() => {
    if (!activeTeacher?.id) {
      setRosters([]);
      setSelectedRosterId('');
      return;
    }

    const unsubscribe = subscribeToTeacherRosters(
      activeTeacher.id,
      (loadedRosters) => {
        setRosters(loadedRosters);

        // Keep current selection if it still exists
        setSelectedRosterId((currentId) => {
          if (
            currentId &&
            loadedRosters.some((roster) => roster.id === currentId)
          ) {
            return currentId;
          }

          return loadedRosters[0]?.id || '';
        });
      }
    );

    return () => unsubscribe();
  }, [activeTeacher?.id]);

  // ==========================================
  // SELECTED ROSTER
  // ==========================================

  const selectedRoster = useMemo(() => {
    return rosters.find(
      (roster) => roster.id === selectedRosterId
    ) || null;
  }, [rosters, selectedRosterId]);

  // ==========================================
  // STUDENTS IN SELECTED ROSTER
  // ==========================================

  const rosterStudents = useMemo(() => {
    if (!selectedRoster) {
      return [];
    }

    return students.filter((student) =>
      selectedRoster.studentIds.includes(student.id)
    );
  }, [students, selectedRoster]);

  // ==========================================
  // SEARCH ROSTER STUDENTS
  // ==========================================

  const filteredRosterStudents = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();

    if (!q) {
      return rosterStudents;
    }

    return rosterStudents.filter((student) => {
      return (
        student.firstName.toLowerCase().includes(q) ||
        student.lastName.toLowerCase().includes(q) ||
        student.studentId.toLowerCase().includes(q)
      );
    });
  }, [rosterStudents, rosterSearch]);

  // ==========================================
  // STUDENT PICKER
  // ==========================================

  const availableStudents = useMemo(() => {
    if (!selectedRoster) {
      return [];
    }

    const q = studentPickerSearch.trim().toLowerCase();

    return students
      .filter((student) => {
        if (selectedRoster.studentIds.includes(student.id)) {
          return false;
        }

        if (!q) {
          return true;
        }

        return (
          student.firstName.toLowerCase().includes(q) ||
          student.lastName.toLowerCase().includes(q) ||
          student.studentId.toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`
        )
      );
  }, [
    students,
    selectedRoster,
    studentPickerSearch
  ]);

  // ==========================================
  // ACTIVE PASSES
  // ==========================================

  const myClassroomActivePasses = activePasses.filter(
    (p) =>
      activeTeacher &&
      p.teacher === activeTeacher.name
  );

  const otherClassroomActivePasses = activePasses.filter(
    (p) =>
      !activeTeacher ||
      p.teacher !== activeTeacher.name
  );

  // ==========================================
  // CREATE ROSTER
  // ==========================================

  const handleCreateRoster = async () => {
    if (!activeTeacher?.id) {
      setRosterError('No teacher account is currently selected.');
      return;
    }

    const name = newRosterName.trim();

    if (!name) {
      setRosterError('Please enter a roster name.');
      return;
    }

    try {
      setSavingRoster(true);
      setRosterError('');

      const rosterId = await createTeacherRoster(
        activeTeacher.id,
        activeTeacher.name,
        name,
        newRosterDescription
      );

      setNewRosterName('');
      setNewRosterDescription('');
      setShowCreateRoster(false);
      setSelectedRosterId(rosterId);
    } catch (error) {
      console.error('Failed to create roster:', error);
      setRosterError('Unable to create roster.');
    } finally {
      setSavingRoster(false);
    }
  };

  // ==========================================
  // DELETE ROSTER
  // ==========================================

  const handleDeleteRoster = async () => {
    if (!selectedRoster) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the roster "${selectedRoster.name}"? This will not delete any students or hall passes.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingRoster(true);

      await deleteTeacherRoster(
        selectedRoster.id
      );

      setSelectedRosterId('');
    } catch (error) {
      console.error('Failed to delete roster:', error);
      setRosterError('Unable to delete roster.');
    } finally {
      setSavingRoster(false);
    }
  };

  // ==========================================
  // ADD STUDENT
  // ==========================================

  const handleAddStudent = async (
    student: Student
  ) => {
    if (!selectedRoster) {
      return;
    }

    try {
      await addStudentToTeacherRoster(
        selectedRoster.id,
        student.id
      );
    } catch (error) {
      console.error('Failed to add student:', error);
      setRosterError('Unable to add student.');
    }
  };

  // ==========================================
  // REMOVE STUDENT
  // ==========================================

  const handleRemoveStudent = async (
    student: Student
  ) => {
    if (!selectedRoster) {
      return;
    }

    try {
      await removeStudentFromTeacherRoster(
        selectedRoster.id,
        student.id
      );
    } catch (error) {
      console.error('Failed to remove student:', error);
      setRosterError('Unable to remove student.');
    }
  };

  // ==========================================
  // END PASS
  // ==========================================

  const handleEndPass = async (
    passId: string
  ) => {
    setEndingPassId(passId);

    try {
      await endHallPass(
        passId,
        'teacher'
      );

      if (soundEnabled) {
        playNotificationTone('end');
      }
    } catch (error) {
      console.error(
        'Failed to end pass:',
        error
      );
    } finally {
      setEndingPassId(null);
    }
  };

  // ==========================================
  // STUDENT STATS
  // ==========================================

  const getStudentStats = (
    student: Student
  ) => {
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

    const completedPasses =
      studentPasses.filter(
        (p) =>
          typeof p.durationMinutes === 'number' &&
          p.durationMinutes > 0
      );

    const totalMins =
      completedPasses.reduce(
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
        : '0.0';

    return {
      total: studentPasses.length,
      today: todayPasses.length,
      avgDuration,
      activePass
    };
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ======================================
          TEACHER PROFILE
      ====================================== */}

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
                {activeTeacher?.room || 'Room'}
                {' • '}
                {activeTeacher?.subject || 'Subject'}
              </span>

            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {activeTeacher?.name || 'Staff Educator'}
            </h2>

          </div>

        </div>

        <button
          id="btn-issue-pass-teacher"
          type="button"
          onClick={() =>
            onOpenRequestModal()
          }
          className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-black text-sm rounded-xl shadow-lg flex items-center gap-2 transition transform active:scale-95 border border-amber-200"
        >
          <Plus className="w-5 h-5" />
          Send Student Out
        </button>

      </div>

      {/* ======================================
          CLASS ROSTERS
      ====================================== */}

      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          <div>

            <h3 className="text-lg font-bold text-purple-950 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-700" />
              My Class Rosters
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Create and manage your class lists so you can quickly issue passes.
            </p>

          </div>

          <button
            type="button"
            onClick={() => {
              setRosterError('');
              setShowCreateRoster(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Roster
          </button>

        </div>

        {rosterError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {rosterError}
          </div>
        )}

        {rosters.length === 0 ? (

          <div className="mt-5 p-8 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center">

            <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />

            <h4 className="font-bold text-slate-800">
              No rosters yet
            </h4>

            <p className="text-sm text-slate-500 mt-1">
              Create your first roster for a class, period, or homeroom.
            </p>

          </div>

        ) : (

          <div className="mt-5">

            <div className="flex flex-col sm:flex-row gap-3">

              <div className="relative flex-1">

                <select
                  value={selectedRosterId}
                  onChange={(e) =>
                    setSelectedRosterId(
                      e.target.value
                    )
                  }
                  className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-slate-300 bg-white font-bold text-purple-950 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none"
                >

                  {rosters.map((roster) => (
                    <option
                      key={roster.id}
                      value={roster.id}
                    >
                      {roster.name} ({roster.studentIds.length} students)
                    </option>
                  ))}

                </select>

                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowManageStudents(
                    !showManageStudents
                  )
                }
                disabled={!selectedRoster}
                className="px-4 py-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-purple-950 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                Manage Students
              </button>

              <button
                type="button"
                onClick={handleDeleteRoster}
                disabled={
                  !selectedRoster ||
                  savingRoster
                }
                className="px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>

            </div>

            {selectedRoster?.description && (
              <p className="text-sm text-slate-500 mt-3">
                {selectedRoster.description}
              </p>
            )}

          </div>

        )}

      </div>

      {/* ======================================
          CREATE ROSTER MODAL
      ====================================== */}

      {showCreateRoster && (

        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">

            <h3 className="text-xl font-black text-purple-950">
              Create Class Roster
            </h3>

            <p className="text-sm text-slate-500 mt-1">
              Give your roster a name such as Period 1, Period 3, or Homeroom.
            </p>

            <div className="space-y-4 mt-5">

              <div>

                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Roster Name
                </label>

                <input
                  type="text"
                  value={newRosterName}
                  onChange={(e) =>
                    setNewRosterName(
                      e.target.value
                    )
                  }
                  placeholder="Example: Period 1"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none"
                  autoFocus
                />

              </div>

              <div>

                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>

                <input
                  type="text"
                  value={newRosterDescription}
                  onChange={(e) =>
                    setNewRosterDescription(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none"
                />

              </div>

            </div>

            <div className="flex gap-3 mt-6">

              <button
                type="button"
                onClick={() => {
                  setShowCreateRoster(false);
                  setRosterError('');
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateRoster}
                disabled={savingRoster}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-900 hover:bg-purple-950 text-white font-bold disabled:opacity-50"
              >
                {savingRoster
                  ? 'Creating...'
                  : 'Create Roster'}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================
          MANAGE STUDENTS
      ====================================== */}

      {showManageStudents && selectedRoster && (

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

            <div>

              <h3 className="text-lg font-bold text-purple-950">
                Manage Students — {selectedRoster.name}
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                Add students to or remove students from this roster.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                setShowManageStudents(false)
              }
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              Done
            </button>

          </div>

          <div className="mt-4">

            <input
              type="text"
              value={studentPickerSearch}
              onChange={(e) =>
                setStudentPickerSearch(
                  e.target.value
                )
              }
              placeholder="Search students to add..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none"
            />

          </div>

          <div className="mt-4 max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">

            {availableStudents.length === 0 ? (

              <div className="p-6 text-center text-sm text-slate-500">
                No additional students found.
              </div>

            ) : (

              availableStudents.map((student) => (

                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 hover:bg-purple-50"
                >

                  <div>

                    <div className="font-semibold text-slate-900">
                      {student.firstName} {student.lastName}
                    </div>

                    <div className="text-xs text-slate-500 font-mono">
                      #{student.studentId}
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleAddStudent(
                        student
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add
                  </button>

                </div>

              ))

            )}

          </div>

          <div className="mt-5">

            <h4 className="font-bold text-purple-950 mb-2">
              Students in this roster ({rosterStudents.length})
            </h4>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">

              {rosterStudents.length === 0 ? (

                <div className="p-6 text-center text-sm text-slate-500">
                  No students have been added yet.
                </div>

              ) : (

                rosterStudents.map((student) => (

                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3"
                  >

                    <div>

                      <div className="font-semibold text-slate-900">
                        {student.firstName} {student.lastName}
                      </div>

                      <div className="text-xs text-slate-500 font-mono">
                        #{student.studentId}
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveStudent(
                          student
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Remove
                    </button>

                  </div>

                ))

              )}

            </div>

          </div>

        </div>

      )}

      {/* ======================================
          STUDENTS OUT FROM MY CLASS
      ====================================== */}

      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 space-y-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="w-3 h-3 rounded-full bg-purple-700 animate-pulse" />

            <h3 className="text-lg font-bold text-purple-950">
              Students Out From My Class
              {' '}
              ({activeTeacher?.room || 'My Room'})
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

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

            {myClassroomActivePasses.map((pass) => {

              const urgency =
                getPassUrgency(
                  pass.timeOut
                );

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

                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${urgency.badgeClass}`}>
                      {urgency.label}
                    </span>

                  </div>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80 mb-3 text-xs">

                    <span className="font-bold text-purple-950">
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
                        {formatElapsedTime(
                          pass.timeOut
                        )}
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleEndPass(
                          pass.id
                        )
                      }
                      disabled={isEnding}
                      className="px-3 py-1.5 bg-purple-900 hover:bg-purple-950 text-white font-bold text-xs rounded-lg shadow flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-300" />

                      {isEnding
                        ? 'Ending...'
                        : 'End Pass'}

                    </button>

                  </div>

                </div>

              );

            })}

          </div>

        )}

      </div>

      {/* ======================================
          ROSTER STUDENT DIRECTORY
      ====================================== */}

      {selectedRoster && (

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 sm:p-6 space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">

            <div>

              <h3 className="text-lg font-bold text-purple-950 flex items-center gap-2">

                <GraduationCap className="w-5 h-5 text-purple-700" />

                {selectedRoster.name} — Students

              </h3>

              <p className="text-xs text-slate-500">
                {rosterStudents.length} students in this roster.
              </p>

            </div>

            <div className="relative w-full sm:w-72">

              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                type="text"
                placeholder="Search this roster..."
                value={rosterSearch}
                onChange={(e) =>
                  setRosterSearch(
                    e.target.value
                  )
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
                    Student
                  </th>

                  <th className="py-3 px-3">
                    Status
                  </th>

                  <th className="py-3 px-3">
                    Today
                  </th>

                  <th className="py-3 px-3">
                    Total
                  </th>

                  <th className="py-3 px-3">
                    Avg
                  </th>

                  <th className="py-3 px-3 text-right">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredRosterStudents.map(
                  (student) => {

                    const stats =
                      getStudentStats(
                        student
                      );

                    return (

                      <tr
                        key={student.id}
                        className="hover:bg-purple-50/50"
                      >

                        <td className="py-3 px-3">

                          <div className="flex items-center gap-2">

                            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-900 font-bold text-xs flex items-center justify-center">
                              {student.firstName[0]}
                              {student.lastName[0]}
                            </div>

                            <div>

                              <div className="font-semibold text-slate-900">
                                {student.firstName}{' '}
                                {student.lastName}
                              </div>

                              <div className="text-xs text-slate-500 font-mono">
                                #{student.studentId}
                              </div>

                            </div>

                          </div>

                        </td>

                        <td className="py-3 px-3">

                          {stats.activePass ? (

                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">

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
                          {stats.total}
                        </td>

                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {stats.avgDuration} min
                        </td>

                        <td className="py-3 px-3 text-right space-x-1.5">

                          {!stats.activePass && (

                            <button
                              type="button"
                              onClick={() =>
                                onOpenRequestModal(
                                  student
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-purple-950 font-bold text-xs"
                            >
                              Issue Pass
                            </button>

                          )}

                          <button
                            type="button"
                            onClick={() =>
                              onOpenStudentDetail(
                                student
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs"
                          >
                            History
                          </button>

                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

            </table>

          </div>

          {filteredRosterStudents.length === 0 && (

            <div className="p-8 text-center text-slate-500">
              No students found in this roster.
            </div>

          )}

        </div>

      )}

    </div>
  );
};

export default TeacherDashboard;
