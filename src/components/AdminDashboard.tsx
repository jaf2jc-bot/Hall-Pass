import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users,  
  Clock, 
  History, 
  BarChart3, 
  Plus, 
  Trash2,  
  CheckCircle2, 
  AlertCircle,  
  RefreshCw, 
  Search, 
  TrendingUp,
  School,
  UserX,
} from 'lucide-react';
import { Student, Teacher, HallPass, UserProfile, ConflictPair } from '../types';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  seedInitialJMMSData,
  subscribeToUserProfiles,
  updateUserRole,
  saveUserProfile,
  subscribeToConflictPairs,
  addConflictPair,
  deleteConflictPair
} from '../lib/firebase';
import { computeStatistics, DESTINATIONS, formatElapsedTime, formatTimeAmPm } from '../lib/constants';

interface AdminDashboardProps {
  students: Student[];
  teachers: Teacher[];
  activePasses: HallPass[];
  allPasses: HallPass[];
  onOpenStudentDetail: (student: Student) => void;
  onOpenHistoryTab: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  teachers,
  activePasses,
  allPasses,
  onOpenStudentDetail,
  onOpenHistoryTab
}) => {
const [adminTab, setAdminTab] = useState<
  'analytics' | 'students' | 'teachers' | 'users' | 'conflicts'
>('analytics');

const [studentSearch, setStudentSearch] = useState('');
const [teacherSearch, setTeacherSearch] = useState('');
const [users, setUsers] = useState<UserProfile[]>([]);
const [userSearch, setUserSearch] = useState('');

// Hallway Conflict Pair State
const [conflictPairs, setConflictPairs] = useState<ConflictPair[]>([]);
const [showAddConflictPair, setShowAddConflictPair] = useState(false);
const [conflictStudent1, setConflictStudent1] = useState('');
const [conflictStudent2, setConflictStudent2] = useState('');

  // Add Student Modal State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newGrade, setNewGrade] = useState(8);
  const [newHomeroom, setNewHomeroom] = useState('Room 204');
  const [newEmail, setNewEmail] = useState('');

  // Add Teacher Modal State
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherRoom, setNewTeacherRoom] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherDept, setNewTeacherDept] = useState('General');

  // Operation status message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const stats = computeStatistics(allPasses);
  // Subscribe to all registered user profiles
React.useEffect(() => {
  const unsubscribe = subscribeToUserProfiles((userList) => {
    setUsers(userList);
  });

  return () => unsubscribe();
}, []);

  // Real-time hallway conflict pair listener
useEffect(() => {
  const unsubscribe = subscribeToConflictPairs((pairs) => {
    setConflictPairs(pairs);
  });

  return () => unsubscribe();
}, []);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase();
    return s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q) || s.studentId.includes(q);
  });

  // Filter teachers
  const filteredTeachers = teachers.filter((t) => {
    const q = teacherSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.room.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
  });
const filteredUsers = users.filter((user) => {
  const q = userSearch.toLowerCase();

  return (
    user.displayName.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    user.role.toLowerCase().includes(q)
  );
});

const handleToggleTeacherRole = async (user: UserProfile) => {
  const makeTeacher = user.role !== 'teacher';

  if (user.role === 'admin') {
    setFeedback({
      type: 'error',
      message: 'Administrator accounts cannot be changed from this screen.'
    });
    return;
  }

  const actionText = makeTeacher
    ? 'grant teacher status to'
    : 'remove teacher status from';

  if (
    !window.confirm(
      `Are you sure you want to ${actionText} ${user.displayName}?`
    )
  ) {
    return;
  }

  setIsProcessing(true);
  setFeedback(null);

  try {
    if (makeTeacher) {
      // Look for an existing teacher roster record with the same email.
      const matchingTeacher = teachers.find(
        (teacher) =>
          teacher.email?.toLowerCase() === user.email.toLowerCase()
      );

      await updateUserRole(user.uid, 'teacher');

      // Link the user's account to the existing teacher roster record.
      if (matchingTeacher) {
        await saveUserProfile({
          ...user,
          role: 'teacher',
          teacherDocId: matchingTeacher.id,
          room: matchingTeacher.room
        });
      }

      setFeedback({
        type: 'success',
        message: `${user.displayName} has been granted Teacher status.`
      });
    } else {
      await updateUserRole(user.uid, 'student');

      setFeedback({
        type: 'success',
        message: `${user.displayName} has been changed back to Student status.`
      });
    }
  } catch (err: unknown) {
    const error = err as Error;

    setFeedback({
      type: 'error',
      message: error.message || 'Failed to update user role.'
    });
  } finally {
    setIsProcessing(false);
  }
};
  
  // Add Student Handler
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId.trim() || !newFirstName.trim() || !newLastName.trim()) {
      setFeedback({ type: 'error', message: 'Please fill in student ID, first name, and last name.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      await addStudent({
        studentId: newStudentId.trim(),
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        grade: Number(newGrade) || 8,
        active: true,
        homeroom: newHomeroom.trim() || 'Room 204',
        email: newEmail.trim() || `${newFirstName.toLowerCase()[0]}${newLastName.toLowerCase()}26@bearworks.jackson.sparcc.org`
      });

      setFeedback({ type: 'success', message: `Student ${newFirstName} ${newLastName} added successfully!` });
      setShowAddStudentModal(false);
      setNewStudentId('');
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
    } catch (err: unknown) {
      const error = err as Error;
      setFeedback({ type: 'error', message: error.message || 'Failed to add student.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Add Teacher Handler
  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherRoom.trim()) {
      setFeedback({ type: 'error', message: 'Please provide teacher name and classroom room number.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      await addTeacher({
        name: newTeacherName.trim(),
        room: newTeacherRoom.trim(),
        subject: newTeacherSubject.trim() || '8th Grade',
        email: newTeacherEmail.trim() || `${newTeacherName.toLowerCase().replace(/[^a-z]/g, '')}@bearworks.jackson.sparcc.org`,
        department: newTeacherDept.trim() || 'Instruction',
        active: true
      });

      setFeedback({ type: 'success', message: `Teacher ${newTeacherName} added successfully!` });
      setShowAddTeacherModal(false);
      setNewTeacherName('');
      setNewTeacherRoom('');
      setNewTeacherSubject('');
      setNewTeacherEmail('');
    } catch (err: unknown) {
      const error = err as Error;
      setFeedback({ type: 'error', message: error.message || 'Failed to add teacher.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStudentActive = async (student: Student) => {
    try {
      await updateStudent(student.id, { active: !student.active });
      setFeedback({ 
        type: 'success', 
        message: `${student.firstName} ${student.lastName} status updated to ${!student.active ? 'Active' : 'Inactive'}.` 
      });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update student status.' });
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to remove ${student.firstName} ${student.lastName} from the roster?`)) {
      return;
    }
    try {
      await deleteStudent(student.id);
      setFeedback({ type: 'success', message: 'Student removed from directory.' });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete student.' });
    }
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (!window.confirm(`Are you sure you want to remove ${teacher.name}?`)) {
      return;
    }
    try {
      await deleteTeacher(teacher.id);
      setFeedback({ type: 'success', message: 'Teacher removed from directory.' });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete teacher.' });
    }
  };

  const handleReSeed = async () => {
    if (!window.confirm('Seed JMMS initial student and teacher rosters? Existing records will be preserved.')) return;
    setIsProcessing(true);
    try {
      const result = await seedInitialJMMSData();
      setFeedback({ 
        type: 'success', 
        message: `Roster check complete. Seeded ${result.studentsSeeded} students and ${result.teachersSeeded} teachers.` 
      });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Error seeding data.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl border-2 border-amber-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Administration Office
            </span>
            <span className="text-xs text-purple-200">
              Jackson Memorial Middle School Control Panel
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center gap-2">
            <Shield className="w-7 h-7 text-amber-400" />
            e-Hall Pass Administrator Suite
          </h2>
          <p className="text-xs sm:text-sm text-purple-200 mt-0.5">
            Full school oversight, live hall monitoring, user management, and pass analytics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleReSeed}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 text-xs font-semibold border border-purple-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Verify Rosters</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistoryTab}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-purple-950 font-extrabold text-xs sm:text-sm rounded-xl shadow flex items-center gap-2 transition"
          >
            <History className="w-4 h-4" />
            <span>Audit History & Logs</span>
          </button>
        </div>
      </div>

      {/* Operation Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' 
            : 'bg-rose-50 text-rose-900 border border-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline opacity-80 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards (Core Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-purple-200 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <span>Total Students</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-purple-950">
            {students.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {students.filter(s => s.active).length} active 8th graders
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-amber-300 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
            <span>Currently Out</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-amber-900">
            {activePasses.length}
          </div>
          <div className="text-xs text-amber-700 mt-1 font-semibold">
            {stats.overdueCount > 0 ? `${stats.overdueCount} overdue (>12m)` : 'All within time limit'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-purple-200 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <span>Passes Today</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-purple-950">
            {stats.totalToday}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {teachers.length} classrooms
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border-2 border-purple-200 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <span>Avg Duration</span>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl sm:text-4xl font-black text-purple-950">
            {stats.avgDurationMinutes} <span className="text-lg font-bold text-slate-500">min</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Top spot: <span className="font-semibold text-purple-950">{stats.mostCommonDestination}</span>
          </div>
        </div>
      </div>

      {/* Admin Sub-Tabs Navigation */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setAdminTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            adminTab === 'analytics'
              ? 'bg-purple-950 text-amber-300 shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Analytics & Distribution
        </button>
        <button
          onClick={() => setAdminTab('students')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            adminTab === 'students'
              ? 'bg-purple-950 text-amber-300 shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Student Management ({students.length})
        </button>
        <button
          onClick={() => setAdminTab('teachers')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            adminTab === 'teachers'
              ? 'bg-purple-950 text-amber-300 shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Teacher Management ({teachers.length})
        </button>
        <button
  onClick={() => setAdminTab('users')}
  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
    adminTab === 'users'
      ? 'bg-purple-950 text-amber-300 shadow-md'
      : 'text-slate-600 hover:bg-slate-100'
  }`}
>
  User Accounts ({users.length})
</button>
        <button
  onClick={() => setAdminTab('conflicts')}
  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
    adminTab === 'conflicts'
      ? 'bg-purple-950 text-amber-300 shadow-md'
      : 'text-slate-600 hover:bg-slate-100'
  }`}
>
  Hallway Conflicts ({conflictPairs.length})
</button>
      </div>

      {/* TAB 1: ANALYTICS & CHARTS */}
      {adminTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Passes by Destination */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
            <h3 className="text-base font-bold text-purple-950 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-700" />
              Today's Passes by Destination
            </h3>
            
            <div className="space-y-3 pt-2">
              {Object.keys(DESTINATIONS).map((dest) => {
                const count = stats.passesByDestination[dest] || 0;
                const total = Math.max(1, stats.totalToday);
                const percentage = Math.round((count / total) * 100);

                return (
                  <div key={dest} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{dest}</span>
                      <span className="font-bold text-purple-950">{count} passes ({percentage}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-800 to-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* School-Wide Hall Pass Rules & Guidelines */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-purple-950 flex items-center gap-2">
                <School className="w-5 h-5 text-purple-700" />
                JMMS 8th Grade Hallway Guidelines
              </h3>
              <div className="mt-3 space-y-2.5 text-xs text-slate-600">
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-2">
                  <span className="font-bold text-purple-900">1.</span>
                  <span><strong>One Pass Limit:</strong> Students are strictly restricted from holding multiple active passes simultaneously.</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-2">
                  <span className="font-bold text-purple-900">2.</span>
                  <span><strong>Time Caps:</strong> Target restroom time is 7 minutes. Flags are raised automatically at 12 minutes.</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-2">
                  <span className="font-bold text-purple-900">3.</span>
                  <span><strong>Audit Trail:</strong> All pass starts, completions, durations, and authorizing staff are recorded in Cloud Firestore.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Database Source: Cloud Firestore</span>
              <button
                type="button"
                onClick={onOpenHistoryTab}
                className="text-xs font-bold text-purple-900 hover:text-purple-700 underline"
              >
                View Complete Historical Log →
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================
    TAB 5: HALLWAY CONFLICT MANAGEMENT
   ======================================================== */}
{adminTab === 'conflicts' && (
  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-5">

    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div>
        <h3 className="text-lg font-bold text-purple-950 flex items-center gap-2">
          <UserX className="w-5 h-5 text-rose-600" />
          Hallway Conflict Pairs
        </h3>

        <p className="text-xs text-slate-500 mt-1">
          Staff will receive an alert when both students in a pair
          are simultaneously out of class.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowAddConflictPair(true)}
        className="px-4 py-2 rounded-xl bg-purple-950 text-amber-300 text-xs font-bold hover:bg-purple-900 transition flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Conflict Pair
      </button>
    </div>

    {/* Existing Conflict Pairs */}
    {conflictPairs.length === 0 ? (
      <div className="py-12 text-center">
        <UserX className="w-12 h-12 mx-auto text-slate-300 mb-3" />

        <h4 className="font-bold text-slate-700">
          No Conflict Pairs Set
        </h4>

        <p className="text-xs text-slate-400 mt-1">
          Add students who should trigger an alert when they are
          both in the hallway.
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {conflictPairs.map((pair) => (
          <div
            key={pair.id}
            className="border border-rose-200 bg-rose-50/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <UserX className="w-5 h-5" />
              </div>

              <div>
                <div className="font-bold text-slate-900">
                  {pair.studentName1}
                </div>

                <div className="text-xs text-slate-400 font-bold my-0.5">
                  SHOULD NOT BE OUT WITH
                </div>

                <div className="font-bold text-slate-900">
                  {pair.studentName2}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Remove the hallway conflict between ${pair.studentName1} and ${pair.studentName2}?`
                  )
                ) {
                  return;
                }

                setIsProcessing(true);

                try {
                  await deleteConflictPair(pair.id);

                  setFeedback({
                    type: 'success',
                    message: `Conflict pair removed: ${pair.studentName1} and ${pair.studentName2}.`
                  });
                } catch (err: unknown) {
                  const error = err as Error;

                  setFeedback({
                    type: 'error',
                    message:
                      error.message ||
                      'Failed to remove conflict pair.'
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              Remove
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Add Conflict Pair */}
    {showAddConflictPair && (
      <div className="border-t border-slate-200 pt-5">
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">

          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-purple-950">
                Add Hallway Conflict Pair
              </h4>

              <p className="text-xs text-slate-500 mt-1">
                Select the two students who should trigger an alert
                when they are both out.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddConflictPair(false);
                setConflictStudent1('');
                setConflictStudent2('');
              }}
              className="text-slate-400 hover:text-slate-700 text-xl"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Student 1 */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Student 1
              </label>

              <select
                value={conflictStudent1}
                onChange={(e) => setConflictStudent1(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600"
              >
                <option value="">
                  Select student...
                </option>

                {students
                  .filter(
                    (student) =>
                      student.studentId !== conflictStudent2
                  )
                  .map((student) => (
                    <option
                      key={student.studentId}
                      value={student.studentId}
                    >
                      {student.firstName} {student.lastName} — {student.studentId}
                    </option>
                  ))}
              </select>
            </div>

            {/* Student 2 */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Student 2
              </label>

              <select
                value={conflictStudent2}
                onChange={(e) => setConflictStudent2(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600"
              >
                <option value="">
                  Select student...
                </option>

                {students
                  .filter(
                    (student) =>
                      student.studentId !== conflictStudent1
                  )
                  .map((student) => (
                    <option
                      key={student.studentId}
                      value={student.studentId}
                    >
                      {student.firstName} {student.lastName} — {student.studentId}
                    </option>
                  ))}
              </select>
            </div>

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-4">

            <button
              type="button"
              onClick={() => {
                setShowAddConflictPair(false);
                setConflictStudent1('');
                setConflictStudent2('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={async () => {
                if (!conflictStudent1 || !conflictStudent2) {
                  setFeedback({
                    type: 'error',
                    message: 'Please select two students.'
                  });
                  return;
                }

                if (conflictStudent1 === conflictStudent2) {
                  setFeedback({
                    type: 'error',
                    message: 'Please select two different students.'
                  });
                  return;
                }

                const student1 = students.find(
                  (student) =>
                    student.studentId === conflictStudent1
                );

                const student2 = students.find(
                  (student) =>
                    student.studentId === conflictStudent2
                );

                if (!student1 || !student2) {
                  setFeedback({
                    type: 'error',
                    message: 'Could not find both students.'
                  });
                  return;
                }

                setIsProcessing(true);

                try {
                  await addConflictPair(student1, student2);

                  setFeedback({
                    type: 'success',
                    message: `${student1.firstName} ${student1.lastName} and ${student2.firstName} ${student2.lastName} are now a hallway conflict pair.`
                  });

                  setConflictStudent1('');
                  setConflictStudent2('');
                  setShowAddConflictPair(false);
                } catch (err: unknown) {
                  const error = err as Error;

                  setFeedback({
                    type: 'error',
                    message:
                      error.message ||
                      'Failed to add conflict pair.'
                  });
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="px-4 py-2 rounded-xl bg-purple-950 text-amber-300 text-xs font-bold hover:bg-purple-900 disabled:opacity-50"
            >
              {isProcessing ? 'Saving...' : 'Add Conflict Pair'}
            </button>

          </div>
        </div>
      </div>
    )}

  </div>
)}
      
      {/* TAB 2: STUDENT MANAGEMENT */}
      {adminTab === 'students' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-purple-950">
                Student Roster ({students.length} Registered)
              </h3>
              <p className="text-xs text-slate-500">
                Manage 8th grade student accounts, active status, and hall pass permissions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-48 sm:w-60 outline-none focus:border-purple-600"
                />
              </div>

              <button
                id="btn-add-student-modal"
                type="button"
                onClick={() => setShowAddStudentModal(true)}
                className="px-3.5 py-2 bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Student ID</th>
                  <th className="py-3 px-3">Grade</th>
                  <th className="py-3 px-3">Homeroom</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-purple-50/40 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      #{student.studentId}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      Grade {student.grade}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {student.homeroom || 'Room 204'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        student.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {student.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => onOpenStudentDetail(student)}
                        className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs rounded-lg transition"
                      >
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStudentActive(student)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
                      >
                        {student.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student)}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                        title="Delete student"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TEACHER MANAGEMENT */}
      {adminTab === 'teachers' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-purple-950">
                Staff & Teacher Directory ({teachers.length} Staff)
              </h3>
              <p className="text-xs text-slate-500">
                Manage JMMS 8th-grade faculty, room numbers, and pass authorization privileges.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search faculty..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-48 sm:w-60 outline-none focus:border-purple-600"
                />
              </div>

              <button
                id="btn-add-teacher-modal"
                type="button"
                onClick={() => setShowAddTeacherModal(true)}
                className="px-3.5 py-2 bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Add Teacher</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3 px-3">Faculty Name</th>
                  <th className="py-3 px-3">Room</th>
                  <th className="py-3 px-3">Subject / Role</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-purple-50/40 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {teacher.name}
                    </td>
                    <td className="py-3 px-3 font-semibold text-purple-950">
                      {teacher.room}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {teacher.subject}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-500">
                      {teacher.email}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTeacher(teacher)}
                        className="p-1 text-rose-500 hover:text-rose-700 transition"
                        title="Delete teacher"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
 {/* TAB 4: USER ACCOUNT MANAGEMENT */}
      {adminTab === 'users' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-md space-y-4">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-purple-950">
                User Account Management ({users.length} Accounts)
              </h3>
              <p className="text-xs text-slate-500">
                Manage account roles and grant Teacher access to approved staff members.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-48 sm:w-60 outline-none focus:border-purple-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Current Role</th>
                  <th className="py-3 px-3">Linked Profile</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const matchingTeacher = teachers.find(
                    (teacher) =>
                      teacher.email?.toLowerCase() === user.email.toLowerCase()
                  );

                  return (
                    <tr
                      key={user.uid}
                      className="hover:bg-purple-50/40 transition"
                    >
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {user.displayName}
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono">
                          {user.uid}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-xs text-slate-500">
                        {user.email}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-900'
                              : user.role === 'teacher'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {user.role.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-xs">
                        {user.role === 'teacher' ? (
                          user.teacherDocId ? (
                            <span className="text-emerald-700 font-semibold">
                              Teacher roster linked
                            </span>
                          ) : matchingTeacher ? (
                            <span className="text-amber-700 font-semibold">
                              Teacher roster match found
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              No teacher roster match
                            </span>
                          )
                        ) : user.role === 'student' ? (
                          <span className="text-slate-500">
                            {user.studentId
                              ? `Student #${user.studentId}`
                              : 'Student account'}
                          </span>
                        ) : (
                          <span className="text-purple-700 font-semibold">
                            Administrator
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {user.role === 'admin' ? (
                          <span className="text-xs text-slate-400 font-semibold">
                            Protected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTeacherRole(user)}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                              user.role === 'teacher'
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-purple-900 hover:bg-purple-950 text-white'
                            }`}
                          >
                            {user.role === 'teacher'
                              ? 'Remove Teacher'
                              : 'Make Teacher'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-sm text-slate-400"
                    >
                      No user accounts match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}
      {/* ========================================================
          ADD STUDENT MODAL
         ======================================================== */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-purple-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-purple-950">Add 8th Grade Student</h3>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Student ID Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 80115"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="First name"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Last name"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grade</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none bg-white"
                  >
                    <option value={8}>8th Grade</option>
                    <option value={7}>7th Grade</option>
                    <option value={6}>6th Grade</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Homeroom</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204"
                    value={newHomeroom}
                    onChange={(e) => setNewHomeroom(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">School Email (Optional)</label>
                <input
                  type="email"
                  placeholder="student@bearworks.jackson.sparcc.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-purple-950 hover:bg-purple-900 text-amber-300 font-bold shadow"
                >
                  {isProcessing ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD TEACHER MODAL
         ======================================================== */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-purple-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-purple-950">Add JMMS Faculty Member</h3>
              <button onClick={() => setShowAddTeacherModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddTeacherSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name & Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mrs. Emily Bennett"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room / Office *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Room 218"
                    value={newTeacherRoom}
                    onChange={(e) => setNewTeacherRoom(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={newTeacherDept}
                    onChange={(e) => setNewTeacherDept(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject / Role Description</label>
                <input
                  type="text"
                  placeholder="e.g. 8th Grade Honors Math"
                  value={newTeacherSubject}
                  onChange={(e) => setNewTeacherSubject(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="teacher@bearworks.jackson.sparcc.org"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-purple-600 outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-purple-950 hover:bg-purple-900 text-amber-300 font-bold shadow"
                >
                  {isProcessing ? 'Saving...' : 'Save Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
