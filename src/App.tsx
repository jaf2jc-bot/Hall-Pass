/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { StudentDashboard } from './components/StudentDashboard';
import { CurrentlyOutDashboard } from './components/CurrentlyOutDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { PassHistoryView } from './components/PassHistoryView';
import { RequestPassModal } from './components/RequestPassModal';
import { StudentDetailModal } from './components/StudentDetailModal';
import { HallPass, Student } from './types';
import {
  subscribeToActivePasses,
  subscribeToAllPasses,
  subscribeToStudentPasses,
  subscribeToStudentActivePass
} from './lib/firebase';
import { School, ShieldCheck } from 'lucide-react';

function MainApp() {
  const {
    currentRole,
    currentUser,
    activeStudent,
    students,
    teachers,
    activeTeacher,
    isLoading
  } = useAuth();

  // Real-time Firestore pass state
  const [activePasses, setActivePasses] = useState<HallPass[]>([]);
  const [allPasses, setAllPasses] = useState<HallPass[]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<string>('student');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestModalStudent, setRequestModalStudent] =
    useState<Student | null>(null);
  const [detailModalStudent, setDetailModalStudent] =
    useState<Student | null>(null);

  // ============================================================
  // REAL-TIME FIRESTORE PASS SUBSCRIPTIONS
  // ============================================================
  useEffect(() => {
    let unsubActive: (() => void) | undefined;
    let unsubAll: (() => void) | undefined;

    // Logged out
    if (!currentUser || !currentRole) {
      setActivePasses([]);
      setAllPasses([]);
      return () => {};
    }

    // Student
    if (currentRole === 'student') {
      const studentId =
        activeStudent?.studentId || currentUser?.studentId;

      if (studentId) {
        unsubActive = subscribeToStudentActivePass(
          studentId,
          (pass) => {
            setActivePasses(pass ? [pass] : []);
          }
        );

        unsubAll = subscribeToStudentPasses(
          studentId,
          (passes) => {
            setAllPasses(passes);
          }
        );
      } else {
        setActivePasses([]);
        setAllPasses([]);
      }
    }

    // Teacher/Admin
    else if (
      currentRole === 'teacher' ||
      currentRole === 'admin'
    ) {
      unsubActive = subscribeToActivePasses((passes) => {
        setActivePasses(passes);
      });

      unsubAll = subscribeToAllPasses((passes) => {
        setAllPasses(passes);
      });
    }

    return () => {
      if (unsubActive) {
        unsubActive();
      }

      if (unsubAll) {
        unsubAll();
      }
    };
  }, [
    currentRole,
    currentUser,
    activeStudent?.studentId
  ]);

  // ============================================================
  // ROLE-BASED NAVIGATION
  // ============================================================
useEffect(() => {
  if (currentRole === 'student') {
    setActiveTab('student');
  } else if (currentRole === 'teacher') {
    setActiveTab('teacher');
  } else if (currentRole === 'admin') {
    setActiveTab('admin');
  }
}, [currentRole]);

  // ============================================================
  // MODAL FUNCTIONS
  // ============================================================
  const handleOpenRequestModal = (student?: Student) => {
    setRequestModalStudent(student || null);
    setIsRequestModalOpen(true);
  };

  const handleOpenStudentDetail = (student: Student) => {
    setDetailModalStudent(student);
  };

  // ============================================================
  // LOADING SCREEN
  // ============================================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-purple-200 text-center max-w-sm w-full space-y-4">

          <div className="w-16 h-16 rounded-2xl bg-purple-950 text-amber-400 font-black text-2xl flex items-center justify-center mx-auto animate-bounce shadow-lg">
            <School className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-purple-950">
              Jackson Memorial Middle School
            </h2>

            <p className="text-xs text-amber-600 font-bold tracking-wider uppercase mt-1">
              Connecting e-Hall Pass...
            </p>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-900 to-amber-400 animate-pulse w-3/4 rounded-full" />
          </div>

        </div>
      </div>
    );
  }

  // ============================================================
  // LOGGED OUT BASE PAGE
  // ============================================================
  if (!currentUser || !currentRole) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased">

        {/* Header */}
        <Header
          activeTab=""
          setActiveTab={setActiveTab}
          activePassCount={0}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
        />

        {/* Base Page */}
        <main className="flex-1 flex items-center justify-center px-4 py-16">

          <div className="bg-white rounded-2xl shadow-xl border-2 border-purple-200 max-w-lg w-full p-8 text-center">

            <div className="w-20 h-20 rounded-2xl bg-purple-950 text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-lg">
              <School className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-purple-950">
              Jackson Memorial Middle School
            </h2>

            <p className="text-lg font-extrabold text-amber-500 mt-1">
              e-Hall Pass
            </p>

            <p className="text-sm text-slate-500 mt-4">
              Please sign in with your Jackson Memorial Google
              Workspace account to access the e-Hall Pass system.
            </p>

            <div className="mt-6 px-4 py-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-purple-800 font-medium">
                Use the Google Sign-In button in the upper-right
                corner to continue.
              </p>
            </div>

          </div>

        </main>

        {/* Logged Out Footer */}
        <footer className="bg-purple-950 text-purple-300 border-t border-purple-900 py-4 text-center text-xs mt-auto">

          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">

            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">
                Jackson Memorial Middle School
              </span>

              <span>•</span>

              <span>
                8th Grade Hallway Pass System
              </span>
            </div>

            <div className="flex items-center gap-3 text-purple-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                RBAC Hardened Security & Google SSO
              </span>
            </div>

          </div>

        </footer>

      </div>
    );
  }

  // ============================================================
  // LOGGED-IN APPLICATION
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">

      {/* Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePassCount={activePasses.length}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      {/* Main Application */}
      <main className="flex-1 pb-16">

        {/* Student Dashboard — Students Only */}
{activeTab === 'student' && currentRole === 'student' && (
  <StudentDashboard
    activePasses={activePasses}
    allPasses={allPasses}
    soundEnabled={soundEnabled}
  />
)}

        {/* Live Hallway Monitor */}
        {activeTab === 'currently-out' &&
          currentRole !== 'student' && (
           <CurrentlyOutDashboard
  activePasses={activePasses}
  teachers={teachers}
  soundEnabled={soundEnabled}
/>
          )}

        {/* Teacher Dashboard */}
        {activeTab === 'teacher' &&
          currentRole !== 'student' && (
            <TeacherDashboard
              activePasses={activePasses}
              allPasses={allPasses}
              onOpenRequestModal={(student) =>
                handleOpenRequestModal(student)
              }
              onOpenStudentDetail={handleOpenStudentDetail}
              soundEnabled={soundEnabled}
            />
          )}

        {/* Admin Dashboard */}
        {activeTab === 'admin' &&
          currentRole === 'admin' && (
            <AdminDashboard
              students={students}
              teachers={teachers}
              activePasses={activePasses}
              allPasses={allPasses}
              onOpenStudentDetail={handleOpenStudentDetail}
              onOpenHistoryTab={() =>
                setActiveTab('history')
              }
            />
          )}

        {/* Pass History */}
        {activeTab === 'history' &&
          currentRole !== 'student' && (
            <PassHistoryView
              allPasses={allPasses}
              teachers={teachers}
            />
          )}

      </main>

      {/* Request Pass Modal */}
      <RequestPassModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        students={students}
        preSelectedStudent={requestModalStudent}
        activeTeacher={activeTeacher}
        activePasses={activePasses}
        soundEnabled={soundEnabled}
      />

      {/* Student Detail Modal */}
      {detailModalStudent && (
        <StudentDetailModal
          isOpen={!!detailModalStudent}
          onClose={() => setDetailModalStudent(null)}
          student={detailModalStudent}
          allPasses={allPasses}
          activePasses={activePasses}
          onRequestPass={() => {
            const student = detailModalStudent;

            setDetailModalStudent(null);

            handleOpenRequestModal(student);
          }}
        />
      )}

      {/* Logged In Footer */}
      <footer className="bg-purple-950 text-purple-300 border-t border-purple-900 py-4 text-center text-xs mt-auto">

        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">

          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">
              Jackson Memorial Middle School
            </span>

            <span>•</span>

            <span>
              8th Grade Hallway Pass System
            </span>
          </div>

          <div className="flex items-center gap-3 text-purple-400">

            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              RBAC Hardened Security & Google SSO
            </span>

          </div>

        </div>

      </footer>

    </div>
  );
}

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
