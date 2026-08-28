import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  Send,
  GraduationCap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bath,
  Building2,
  HeartPulse,
  UserCheck,
  DoorOpen,
  BookOpen,
  HelpCircle,
  Search
} from 'lucide-react';
import { Student, Teacher, DestinationType, HallPass } from '../types';
import { requestHallPass } from '../lib/firebase';
import { DESTINATIONS, playNotificationTone } from '../lib/constants';

interface RequestPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  preSelectedStudent?: Student | null;
  activeTeacher?: Teacher | null;
  activePasses: HallPass[];
  soundEnabled: boolean;
}

export const RequestPassModal: React.FC<RequestPassModalProps> = ({
  isOpen,
  onClose,
  students,
  preSelectedStudent,
  activeTeacher,
  activePasses,
  soundEnabled
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedDestination, setSelectedDestination] =
    useState<DestinationType>('Restroom');

  const [destinationDetails, setDestinationDetails] =
    useState<string>('');
  const [studentSearch, setStudentSearch] =
    useState<string>('');
  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // ============================================================
  // STUDENT LIST — SORT BY LAST NAME
  // ============================================================
  const sortedStudents = [...students].sort((a, b) => {
    const lastNameCompare = a.lastName.localeCompare(
      b.lastName,
      undefined,
      { sensitivity: 'base' }
    );

    if (lastNameCompare !== 0) {
      return lastNameCompare;
    }

    return a.firstName.localeCompare(
      b.firstName,
      undefined,
      { sensitivity: 'base' }
    );
  });

  // ============================================================
  // STUDENT SEARCH
  // Searches first name, last name, full name, and student ID
  // ============================================================
  const filteredStudents = sortedStudents.filter((student) => {
    const search = studentSearch.trim().toLowerCase();

    if (!search) {
      return true;
    }

    const firstName = student.firstName.toLowerCase();
    const lastName = student.lastName.toLowerCase();
    const fullName =
      `${student.firstName} ${student.lastName}`.toLowerCase();
    const reverseName =
      `${student.lastName} ${student.firstName}`.toLowerCase();
    const studentId =
      student.studentId.toLowerCase();

    return (
      firstName.includes(search) ||
      lastName.includes(search) ||
      fullName.includes(search) ||
      reverseName.includes(search) ||
      studentId.includes(search)
    );
  });

  // ============================================================
  // INITIAL STUDENT SELECTION
  // ============================================================
  useEffect(() => {
    if (preSelectedStudent) {
      setSelectedStudentId(preSelectedStudent.studentId);
      setStudentSearch('');
    } else if (
      students.length > 0 &&
      !selectedStudentId
    ) {
      const sorted = [...students].sort((a, b) => {
        const lastNameCompare = a.lastName.localeCompare(
          b.lastName,
          undefined,
          { sensitivity: 'base' }
        );

        if (lastNameCompare !== 0) {
          return lastNameCompare;
        }

        return a.firstName.localeCompare(
          b.firstName,
          undefined,
          { sensitivity: 'base' }
        );
      });

      setSelectedStudentId(sorted[0].studentId);
    }
  }, [preSelectedStudent, students]);

  // If the current selected student is hidden by the search,
  // keep the selection intact rather than changing it.
  useEffect(() => {
    if (!isOpen) {
      setStudentSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ============================================================
  // SUBMIT PASS
  // ============================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const student = students.find(
      (s) => s.studentId === selectedStudentId
    );

    if (!student) {
      setErrorMsg('Please choose a valid student.');
      return;
    }

    // Check active pass
    const hasActive = activePasses.some(
      (p) => p.studentId === student.studentId
    );

    if (hasActive) {
      setErrorMsg(
        `${student.firstName} ${student.lastName} already has an active pass in the hallway.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (!activeTeacher) {
        setErrorMsg(
          'Unable to identify the logged-in teacher. Please sign in again.'
        );
        return;
      }

      await requestHallPass({
        studentDocId: student.id,
        studentId: student.studentId,
        studentName: `${student.firstName} ${student.lastName}`,
        studentEmail: student.email,
        teacher: activeTeacher.name,
        teacherRoom: activeTeacher.room || '',
        destination: selectedDestination,
        destinationDetails:
          destinationDetails.trim() || undefined,
        createdBy: 'teacher'
      });

      if (soundEnabled) {
        playNotificationTone('start');
      }

      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(
        error.message || 'Failed to issue hall pass.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // DESTINATION ICON
  // ============================================================
  const getDestinationIcon = (
    dest: DestinationType
  ) => {
    switch (dest) {
      case 'Restroom':
        return <Bath className="w-4 h-4" />;
      case 'Office':
        return <Building2 className="w-4 h-4" />;
      case 'Nurse':
        return <HeartPulse className="w-4 h-4" />;
      case 'Counselor':
        return <UserCheck className="w-4 h-4" />;
      case 'Another Classroom':
        return <DoorOpen className="w-4 h-4" />;
      case 'Library':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-purple-200 space-y-4 max-h-[90vh] overflow-y-auto">

        {/* ====================================================
            HEADER
            ==================================================== */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-purple-950 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-purple-950 leading-tight">
                Issue Hall Pass
              </h3>

              <p className="text-xs text-slate-500">
                Teacher / Administrator Authorization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ====================================================
            ERROR
            ==================================================== */}
        {errorMsg && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 text-xs sm:text-sm"
        >

          {/* ==================================================
              STUDENT SEARCH + SELECTOR
              ================================================== */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Select Student *
            </label>

            {/* Search Box */}
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                id="input-search-student"
                type="text"
                placeholder="Search first name, last name, or ID..."
                value={studentSearch}
                onChange={(e) =>
                  setStudentSearch(e.target.value)
                }
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-none text-slate-800"
              />
            </div>

            {/* Result Count */}
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-[10px] text-slate-400">
                {studentSearch.trim()
                  ? `${filteredStudents.length} student${
                      filteredStudents.length === 1
                        ? ''
                        : 's'
                    } found`
                  : `${sortedStudents.length} students`}
              </span>

              <span className="text-[10px] text-slate-400">
                Sorted by last name
              </span>
            </div>

            {/* Student Selector */}
            <select
              id="select-student"
              value={selectedStudentId}
              onChange={(e) =>
                setSelectedStudentId(e.target.value)
              }
              required
              size={Math.min(
                Math.max(filteredStudents.length, 1),
                6
              )}
              className="w-full p-2 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none font-medium bg-white text-slate-800"
            >
              {filteredStudents.length === 0 ? (
                <option value="" disabled>
                  No students found
                </option>
              ) : (
                filteredStudents.map((s) => (
                  <option
                    key={s.id}
                    value={s.studentId}
                  >
                    {s.lastName}, {s.firstName} (#
                    {s.studentId} • Gr. {s.grade})
                  </option>
                ))
              )}
            </select>

            {filteredStudents.length > 6 && (
              <p className="text-[10px] text-slate-400 mt-1">
                Showing first 6 results. Continue typing to
                narrow your search.
              </p>
            )}
          </div>

          {/* ==================================================
              DESTINATION
              ================================================== */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Destination *
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(DESTINATIONS).map((d) => {
                const isSelected =
                  selectedDestination === d.name;

                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() =>
                      setSelectedDestination(d.name)
                    }
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                      isSelected
                        ? 'border-purple-800 bg-purple-100 text-purple-950 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`p-1.5 rounded-lg ${
                        isSelected
                          ? 'bg-purple-900 text-amber-300'
                          : 'bg-slate-100'
                      }`}
                    >
                      {getDestinationIcon(d.name)}
                    </span>

                    <span className="text-xs">
                      {d.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ==================================================
              AUTHORIZING TEACHER
              ================================================== */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Authorizing Teacher
            </label>

            <div className="w-full p-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium">
              {activeTeacher ? (
                <>
                  {activeTeacher.name}
                  {activeTeacher.room
                    ? ` — ${activeTeacher.room}`
                    : ''}
                </>
              ) : (
                <span className="text-rose-600">
                  Unable to identify logged-in teacher
                </span>
              )}
            </div>
          </div>

          {/* ==================================================
              OPTIONAL NOTES
              ================================================== */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Specific Reason / Notes{' '}
              <span className="text-slate-400 font-normal">
                (Optional)
              </span>
            </label>

            <input
              type="text"
              placeholder="e.g. Taking attendance slip to main office"
              value={destinationDetails}
              onChange={(e) =>
                setDestinationDetails(e.target.value)
              }
              className="w-full p-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 outline-none text-slate-800"
            />
          </div>

          {/* ==================================================
              ACTIONS
              ================================================== */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-950 via-purple-900 to-amber-500 hover:from-purple-900 hover:to-amber-600 text-white font-black rounded-xl shadow-lg flex items-center gap-2"
            >
              <Send className="w-4 h-4 text-amber-300" />

              <span>
                {isSubmitting
                  ? 'Starting...'
                  : 'Issue Pass Now'}
              </span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

