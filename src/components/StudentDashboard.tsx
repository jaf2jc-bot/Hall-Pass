import React, { useEffect, useState } from 'react';


import {
  GraduationCap,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Bath,
  Building2,
  HeartPulse,
  DoorOpen,
  BookOpen,
  HelpCircle,
  Send,
  ShieldCheck,
  X
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import {
  HallPass,
  DestinationType,
  StudentHallPassRequest,
  Teacher
} from '../types';

import {
  createStudentHallPassRequest,
  subscribeToStudentHallPassRequests,
  cancelStudentHallPassRequest
} from '../lib/firebase';

import {
  DESTINATIONS,
  formatElapsedTime,
  formatTimeAmPm,
  playNotificationTone,
  getPassUrgency
} from '../lib/constants';

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

  const {
    currentUser,
    currentRole,
    activeStudent,
    teachers
  } = useAuth();

  const [selectedDestination, setSelectedDestination] =
    useState<DestinationType>('Restroom');

  const [selectedTeacherId, setSelectedTeacherId] =
    useState<string>('');

  const [destinationDetails, setDestinationDetails] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState<string | null>(null);

  const [successMsg, setSuccessMsg] =
    useState<string | null>(null);

  const [pendingRequest, setPendingRequest] =
    useState<StudentHallPassRequest | null>(null);

  const [requestLoading, setRequestLoading] =
    useState(true);

  const [isCancellingRequest, setIsCancellingRequest] =
    useState(false);

  const [cancelError, setCancelError] =
    useState<string | null>(null);

  const [, setTick] =
    useState(0);

  // ============================================================
  // ADMIN TEST MODE
  // ============================================================

  const isAdminTestMode =
    currentRole === 'admin';

  // ============================================================
  // FIND CURRENT STUDENT'S ACTIVE PASS
  // ============================================================

  const myActivePass =
    activePasses.find(
      (pass) =>
        activeStudent &&
        (
          pass.studentId ===
            activeStudent.studentId ||
          pass.studentDocId ===
            activeStudent.id
        )
    ) || null;

  // ============================================================
  // LISTEN FOR THIS STUDENT'S PENDING REQUEST
  // ============================================================

  useEffect(() => {

    if (!activeStudent) {

      setPendingRequest(null);
      setRequestLoading(false);

      return;
    }

    setRequestLoading(true);

    const unsubscribe =
      subscribeToStudentHallPassRequests(
        activeStudent.studentId,
        (requests) => {

          const pending =
            requests
              .filter(
                (request) =>
                  request.status === 'PENDING'
              )
              .sort(
                (a, b) =>
                  b.createdAt - a.createdAt
              )[0] || null;

          setPendingRequest(
            pending
          );

          setRequestLoading(false);
        }
      );

    return () =>
      unsubscribe();

  }, [activeStudent]);

  // ============================================================
  // DEFAULT SELECTED TEACHER
  // ============================================================

  useEffect(() => {
    if (teachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [teachers, selectedTeacherId]);

  // ============================================================
  // LIVE ACTIVE-PASS TIMER
  // ============================================================

  useEffect(() => {

    if (!myActivePass) {
      return;
    }

    const timer =
      setInterval(
        () =>
          setTick(
            (value) =>
              value + 1
          ),
        1000
      );

    return () =>
      clearInterval(timer);

  }, [myActivePass]);

  // ============================================================
  // STUDENT'S PASS HISTORY
  // ============================================================

  const myRecentPasses =
    allPasses.filter(
      (pass) =>
        activeStudent &&
        (
          pass.studentId ===
            activeStudent.studentId ||
          pass.studentDocId ===
            activeStudent.id
        )
    );

  const myPassesToday =
    myRecentPasses.filter(
      (pass) =>
        new Date(
          pass.timeOut
        ).toDateString() ===
        new Date().toDateString()
    );

  // ============================================================
  // SUBMIT STUDENT REQUEST
  // ============================================================

  const handleRequestPass = async (
    e: React.FormEvent
  ) => {

    e.preventDefault();

    if (!activeStudent) {

      setErrorMsg(
        'Your student profile could not be identified.'
      );

      return;
    }

    if (myActivePass) {

      setErrorMsg(
        'You already have an active hall pass.'
      );

      return;
    }

    if (pendingRequest) {

      setErrorMsg(
        'You already have a hall pass request waiting for teacher approval.'
      );

      return;
    }

    const selectedTeacher =
      teachers.find(
        (teacher) => teacher.id === selectedTeacherId
      );

    if (!selectedTeacher) {

      setErrorMsg(
        'Please select your current teacher.'
      );

      return;
    }

    setIsSubmitting(true);

    setErrorMsg(null);

    setSuccessMsg(null);

    try {

      await createStudentHallPassRequest({

        studentDocId:
          activeStudent.id,

        studentId:
          activeStudent.studentId,

        studentName:
          `${activeStudent.firstName} ${activeStudent.lastName}`,

        studentEmail:
          activeStudent.email ||
          currentUser?.email ||
          '',

        teacherId:
          selectedTeacher.id,

        teacherName:
          selectedTeacher.name,

        teacherRoom:
          selectedTeacher.room ||
          '',

        destination:
          selectedDestination,

        destinationDetails:
          destinationDetails.trim() ||
          '',

        notes:
          destinationDetails.trim() ||
          ''
      });

      if (soundEnabled) {

        playNotificationTone(
          'start'
        );
      }

      setSuccessMsg(
        'Your hall pass request has been sent to your teacher for approval.'
      );

      setDestinationDetails('');

    } catch (
      err: unknown
    ) {

      const error =
        err as Error;

      setErrorMsg(
        error.message ||
        'Unable to send your hall pass request.'
      );

    } finally {

      setIsSubmitting(false);
    }
  };

  // ============================================================
  // CANCEL PENDING REQUEST
  // ============================================================

  const handleCancelRequest = async () => {

    if (!pendingRequest) {
      return;
    }

    setIsCancellingRequest(true);
    setCancelError(null);

    try {

      await cancelStudentHallPassRequest(
        pendingRequest.id
      );

      // The subscribeToStudentHallPassRequests listener will pick
      // up the status change and clear pendingRequest on its own,
      // but clearing it here too keeps the UI feeling instant
      // instead of waiting on the round trip.
      setPendingRequest(null);

    } catch (
      err: unknown
    ) {

      const error =
        err as Error;

      setCancelError(
        error.message ||
        'Unable to cancel your request. Please try again.'
      );

    } finally {

      setIsCancellingRequest(false);
    }
  };

  // ============================================================
  // DESTINATION ICON
  // ============================================================

  const getDestinationIcon = (
    destination: DestinationType
  ) => {

    switch (destination) {

      case 'Restroom':
        return (
          <Bath className="w-5 h-5" />
        );

      case 'Office':
        return (
          <Building2 className="w-5 h-5" />
        );

      case 'Nurse':
        return (
          <HeartPulse className="w-5 h-5" />
        );

      case 'Counselor':
        return (
          <GraduationCap className="w-5 h-5" />
        );

      case 'Another Classroom':
        return (
          <DoorOpen className="w-5 h-5" />
        );

      case 'Library':
        return (
          <BookOpen className="w-5 h-5" />
        );

      default:
        return (
          <HelpCircle className="w-5 h-5" />
        );
    }
  };

  // ============================================================
  // NO STUDENT PROFILE
  // ============================================================

  if (!activeStudent) {

    return (

      <div className="max-w-xl mx-auto py-12 px-4 text-center">

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">

          <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-900 mx-auto flex items-center justify-center mb-4">

            <GraduationCap className="w-8 h-8" />

          </div>

          <h2 className="text-2xl font-bold text-purple-950 mb-2">
            Student Account
          </h2>

          <p className="text-slate-600 text-sm">

            {isAdminTestMode
              ? 'The student roster is still loading. Please wait a moment and try again.'
              : 'Your student profile could not be loaded. Please sign out and sign back in.'}

          </p>

        </div>

      </div>
    );
  }

  const urgency =
    myActivePass
      ? getPassUrgency(
          myActivePass.timeOut
        )
      : null;

  // ============================================================
  // MAIN STUDENT VIEW
  // ============================================================

  return (

    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ======================================================
          ADMIN TEST MODE CARD
      ====================================================== */}

      {isAdminTestMode && (

        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-md">

          <div className="flex items-start gap-3">

            <div className="w-10 h-10 rounded-xl bg-amber-400 text-purple-950 flex items-center justify-center flex-shrink-0">

              <ShieldCheck className="w-5 h-5" />

            </div>

            <div className="flex-1">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">

                <h3 className="font-black text-purple-950">
                  ADMIN TEST MODE
                </h3>

                <span className="text-xs font-bold bg-purple-950 text-amber-300 px-2.5 py-1 rounded-full">

                  Acting as Student

                </span>

              </div>

              <p className="text-sm text-amber-900 mt-1">

                You are viewing the student experience as:

                <span className="font-black ml-1">
                  {activeStudent.firstName}{' '}
                  {activeStudent.lastName}
                </span>

                <span className="text-amber-700 ml-1">
                  (#{activeStudent.studentId})
                </span>

              </p>

              <p className="text-xs text-amber-800 mt-1">

                Your administrator account and permissions have
                not changed. This is only a testing view.

              </p>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          STUDENT HEADER
      ====================================================== */}

      <div className="bg-gradient-to-r from-purple-900 via-purple-950 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border-2 border-amber-400/40">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          <div className="flex items-center gap-4">

            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-purple-950 font-black text-xl flex items-center justify-center shadow-lg">

              {activeStudent.firstName[0]}
              {activeStudent.lastName[0]}

            </div>

            <div>

              <div className="flex items-center gap-2">

                <span className="text-xs font-bold bg-amber-400 text-purple-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider">

                  Grade {activeStudent.grade}

                </span>

                <span className="text-xs text-purple-200 font-mono">

                  #{activeStudent.studentId}

                </span>

              </div>

              <h2 className="text-2xl font-black text-white mt-1">

                {activeStudent.firstName}{' '}
                {activeStudent.lastName}

              </h2>

              <p className="text-xs text-purple-200">

                Hall Pass System

              </p>

            </div>

          </div>

          <div>

            {myActivePass ? (

              <div className="bg-amber-400 text-purple-950 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg animate-pulse">

                <Clock className="w-5 h-5" />

                <div>

                  <div className="text-[10px] uppercase tracking-wider font-extrabold">
                    Current Status
                  </div>

                  <div className="text-sm">
                    Pass Active
                  </div>

                </div>

              </div>

            ) : pendingRequest ? (

              <div className="bg-blue-500/20 border border-blue-300/50 text-blue-100 px-4 py-2 rounded-xl font-bold flex items-center gap-2">

                <Clock className="w-5 h-5 text-blue-300" />

                <div>

                  <div className="text-[10px] uppercase tracking-wider font-semibold">
                    Current Status
                  </div>

                  <div className="text-sm">
                    Waiting for Approval
                  </div>

                </div>

              </div>

            ) : (

              <div className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-4 py-2 rounded-xl font-bold flex items-center gap-2">

                <CheckCircle2 className="w-5 h-5 text-emerald-400" />

                <div>

                  <div className="text-[10px] uppercase tracking-wider font-semibold">
                    Current Status
                  </div>

                  <div className="text-sm">
                    In Classroom
                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

        <div className="mt-4 pt-4 border-t border-purple-800/80 grid grid-cols-2 gap-3 text-xs">

          <div className="bg-purple-900/60 rounded-lg p-2.5">

            <span className="text-purple-300 block">
              Passes Today
            </span>

            <span className="text-lg font-bold text-amber-300">
              {myPassesToday.length}
            </span>

          </div>

          <div className="bg-purple-900/60 rounded-lg p-2.5">

            <span className="text-purple-300 block">
              Total Passes
            </span>

            <span className="text-lg font-bold text-white">
              {myRecentPasses.length}
            </span>

          </div>

        </div>

      </div>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {errorMsg && (

        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-rose-800 flex items-start gap-3 shadow-sm">

          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />

          <div className="text-sm">

            <p className="font-bold">
              Notice
            </p>

            <p>
              {errorMsg}
            </p>

          </div>

        </div>

      )}

      {/* ======================================================
          SUCCESS
      ====================================================== */}

      {successMsg && (

        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl text-emerald-900 flex items-start gap-3 shadow-sm">

          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />

          <div className="text-sm">

            <p className="font-bold">
              Request Sent
            </p>

            <p>
              {successMsg}
            </p>

          </div>

        </div>

      )}

      {/* ======================================================
          ACTIVE PASS
      ====================================================== */}

      {myActivePass ? (

        <div className="bg-white rounded-2xl shadow-xl border-4 border-amber-400 p-6 sm:p-8 text-center space-y-6">

          <div className="inline-flex items-center gap-2 bg-purple-950 text-amber-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">

            <Sparkles className="w-4 h-4" />

            Official Hall Pass

          </div>

          <div>

            <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider">
              Authorized Destination
            </div>

            <div className="flex items-center justify-center gap-3 text-3xl sm:text-4xl font-black text-purple-950 mt-2">

              <span className="p-3 rounded-2xl bg-purple-100 text-purple-900">

                {getDestinationIcon(
                  myActivePass.destination
                )}

              </span>

              <span>
                {myActivePass.destination}
              </span>

            </div>

            {myActivePass.destinationDetails && (

              <p className="text-slate-600 font-medium italic text-sm mt-2">

                "{myActivePass.destinationDetails}"

              </p>

            )}

          </div>

          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 max-w-md mx-auto">

            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1.5">

              <Clock className="w-4 h-4 text-purple-600" />

              Time Out

            </div>

            <div className="text-5xl sm:text-6xl font-black font-mono text-purple-950 mt-2">

              {formatElapsedTime(
                myActivePass.timeOut
              )}

            </div>

            <div className="text-xs text-slate-500 mt-1">

              Started at{' '}

              <span className="font-semibold text-slate-700">

                {formatTimeAmPm(
                  myActivePass.timeOut
                )}

              </span>

            </div>

            {urgency && (

              <div className="pt-3">

                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs ${urgency.badgeClass}`}
                >
                  {urgency.label}
                </span>

              </div>

            )}

          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-md mx-auto">

            <p className="text-sm font-bold text-amber-900">
              Your teacher approved this pass.
            </p>

            <p className="text-xs text-amber-800 mt-1">
              When you return to class, your teacher will end the pass.
            </p>

          </div>

        </div>

      ) : pendingRequest ? (

        <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-300 p-6 sm:p-8 text-center space-y-6">

          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 mx-auto flex items-center justify-center">

            <Clock className="w-8 h-8 animate-pulse" />

          </div>

          <div>

            <h3 className="text-2xl font-black text-purple-950">
              Waiting for Teacher Approval
            </h3>

            <p className="text-sm text-slate-600 mt-2">
              Your request has been sent to your teacher.
              Please wait for approval before leaving the classroom.
            </p>

          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-md mx-auto text-left space-y-3">

            <div className="flex items-center justify-between">

              <span className="text-xs font-bold text-slate-500 uppercase">
                Destination
              </span>

              <span className="font-bold text-purple-950 flex items-center gap-2">

                {getDestinationIcon(
                  pendingRequest.destination
                )}

                {pendingRequest.destination}

              </span>

            </div>

            {pendingRequest.destinationDetails && (

              <div>

                <span className="text-xs font-bold text-slate-500 uppercase">
                  Reason / Details
                </span>

                <p className="text-sm text-slate-700 mt-1">
                  {pendingRequest.destinationDetails}
                </p>

              </div>

            )}

          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-blue-700 font-semibold">

            <Clock className="w-4 h-4" />

            Do not leave the classroom until your teacher approves the request.

          </div>

          {cancelError && (

            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 rounded-lg text-rose-800 text-xs flex items-center gap-2 max-w-md mx-auto text-left">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{cancelError}</span>
            </div>

          )}

          <button
            type="button"
            onClick={handleCancelRequest}
            disabled={isCancellingRequest}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-rose-700 font-bold text-sm flex items-center gap-2 mx-auto border border-slate-200 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            {isCancellingRequest
              ? 'Cancelling...'
              : 'Cancel Request'}
          </button>

        </div>

      ) : (

        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 sm:p-8 space-y-6">

          <div className="border-b border-slate-100 pb-4">

            <h3 className="text-xl font-bold text-purple-950 flex items-center gap-2">

              <MapPin className="w-5 h-5 text-amber-500" />

              Request a Hall Pass

            </h3>

            <p className="text-sm text-slate-600 mt-1">
              Choose where you need to go and send your request to your teacher.
            </p>

          </div>

          {requestLoading ? (

            <div className="py-8 text-center text-sm text-slate-500">
              Checking for existing requests...
            </div>

          ) : (

            <form
              onSubmit={handleRequestPass}
              className="space-y-6"
            >

              <div>

                <label className="block text-sm font-bold text-slate-800 mb-2">
                  Where do you need to go?
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

                  {Object.values(DESTINATIONS).map(
                    (destination) => {

                      const isSelected =
                        selectedDestination ===
                        destination.name;

                      return (

                        <button
                          key={destination.name}
                          type="button"
                          onClick={() =>
                            setSelectedDestination(
                              destination.name
                            )
                          }
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-purple-800 bg-purple-50 text-purple-950 shadow-md ring-2 ring-purple-300'
                              : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50 text-slate-700'
                          }`}
                        >

                          <div className="flex items-center justify-between mb-3">

                            <span
                              className={`p-2 rounded-lg ${
                                isSelected
                                  ? 'bg-purple-900 text-amber-300'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {getDestinationIcon(
                                destination.name
                              )}
                            </span>

                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-purple-700" />
                            )}

                          </div>

                          <div className="font-bold text-sm">
                            {destination.name}
                          </div>

                        </button>

                      );
                    }
                  )}

                </div>

              </div>

              <div>

                <label className="block text-sm font-bold text-slate-800 mb-1.5">
                  Who is your current teacher?
                </label>

                <select
                  id="select-authorizing-teacher"
                  value={selectedTeacherId}
                  onChange={(e) =>
                    setSelectedTeacherId(e.target.value)
                  }
                  required
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-700 focus:ring-2 focus:ring-purple-200 outline-none text-sm font-medium text-slate-800 bg-white"
                >

                  {teachers.length === 0 && (
                    <option value="">
                      No teachers found
                    </option>
                  )}

                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} — {teacher.room} ({teacher.subject})
                    </option>
                  ))}

                </select>

              </div>

              <div>

                <label className="block text-sm font-bold text-slate-800 mb-1.5">

                  Reason / Details

                  <span className="font-normal text-slate-400">
                    {' '}(Optional)
                  </span>

                </label>

                <textarea
                  id="input-destination-notes"
                  value={destinationDetails}
                  onChange={(e) =>
                    setDestinationDetails(
                      e.target.value
                    )
                  }
                  placeholder="Tell your teacher why you need to leave..."
                  rows={3}
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-700 focus:ring-2 focus:ring-purple-200 outline-none text-sm text-slate-800 resize-none"
                />

              </div>

              <button
                id="btn-submit-hall-pass"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-950 via-purple-900 to-amber-500 hover:from-purple-900 hover:to-amber-600 disabled:opacity-50 text-white rounded-2xl font-black text-lg shadow-xl transition flex items-center justify-center gap-3 border border-amber-300"
              >

                <Send className="w-5 h-5 text-amber-300" />

                <span>

                  {isSubmitting
                    ? 'SENDING REQUEST...'
                    : 'REQUEST HALL PASS'}

                </span>

              </button>

              <p className="text-center text-xs text-slate-500">
                Your teacher must approve your request before you leave the classroom.
              </p>

            </form>

          )}

        </div>

      )}

      {/* ======================================================
          RECENT HISTORY
      ====================================================== */}

      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5 space-y-4">

        <div className="flex items-center justify-between">

          <h4 className="text-base font-bold text-purple-950 flex items-center gap-2">

            <Clock className="w-4 h-4 text-purple-600" />

            My Recent Pass Activity

          </h4>

          <span className="text-xs text-slate-500 font-medium">
            {myRecentPasses.length} total
          </span>

        </div>

        {myRecentPasses.length === 0 ? (

          <div className="text-center py-6 text-slate-400 text-sm">
            No hall passes recorded yet.
          </div>

        ) : (

          <div className="divide-y divide-slate-100">

            {myRecentPasses
              .slice(0, 5)
              .map((pass) => (

                <div
                  key={pass.id}
                  className="py-3 flex items-center justify-between"
                >

                  <div className="flex items-center gap-3">

                    <div className="p-2 rounded-lg bg-purple-50 text-purple-900">

                      {getDestinationIcon(
                        pass.destination
                      )}

                    </div>

                    <div>

                      <span className="font-bold text-slate-800 text-sm">
                        {pass.destination}
                      </span>

                      <span className="text-slate-500 text-xs block">

                        {new Date(
                          pass.timeOut
                        ).toLocaleDateString(
                          [],
                          {
                            month: 'short',
                            day: 'numeric'
                          }
                        )}{' '}

                        at{' '}

                        {formatTimeAmPm(
                          pass.timeOut
                        )}

                      </span>

                    </div>

                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                      pass.status === 'ACTIVE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >

                    {pass.status === 'ACTIVE'
                      ? 'Out Now'
                      : `${pass.durationMinutes || 1} min`}

                  </span>

                </div>

              ))}

          </div>

        )}

      </div>

    </div>
  );
};
