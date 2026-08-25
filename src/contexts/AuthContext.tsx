import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, Student, Teacher } from '../types';
import { 
  auth,
  signInWithGoogle, 
  signOutFromApp, 
  ensureAuthenticated, 
  getUserProfile, 
  saveUserProfile, 
  subscribeToStudents, 
  subscribeToTeachers, 
  seedInitialJMMSData,
  ALLOWED_DOMAIN
} from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AuthContextType {
  firebaseUser: User | null;
  currentUser: UserProfile | null;
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  students: Student[];
  teachers: Teacher[];
  isLoading: boolean;
  activeStudent: Student | null;
  activeTeacher: Teacher | null;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  loginWithGoogle: () => Promise<boolean>;
  selectStudent: (student: Student) => void;
  selectTeacher: (teacher: Teacher) => void;
  loginAsAdmin: () => void;
  loginAsStudentById: (studentId: string) => boolean;
  logout: () => Promise<void>;
  seedData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('student');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    let unsubStudents: (() => void) | undefined;
    let unsubTeachers: (() => void) | undefined;
    
  let teachersLoaded = false;
  let studentsLoaded = false;
  let pendingAuthUser: User | null = null;

const processAuthenticatedUser = async (user: User) => {
  setFirebaseUser(user);

  if (user && !user.isAnonymous) {
    const email = user.email || '';
    const emailDomain = email.split('@')[1]?.toLowerCase();

    const isAuthorizedDomain =
      emailDomain === ALLOWED_DOMAIN.toLowerCase() ||
      email.toLowerCase() === 'jaf2jc@bearworks.jackson.sparcc.org';

    if (!isAuthorizedDomain && emailDomain) {
      setAuthError(
        `Access restricted: Please sign in with your Jackson Memorial Middle School account (@${ALLOWED_DOMAIN}).`
      );
      await signOutFromApp();
      return;
    }

    setAuthError(null);

    let profile = await getUserProfile(user.uid);

    if (!profile) {
      let role: UserRole | null = null;
      let teacherDocId: string | undefined;
      let studentId: string | undefined;
      let studentDocId: string | undefined;
      let room: string | undefined;
      let grade: number | undefined;

      const emailLower = email.toLowerCase();

      // ADMIN
      if (
        emailLower === 'jaf2jc@bearworks.jackson.sparcc.org' ||
        emailLower.includes('admin') ||
        emailLower.startsWith('principal')
      ) {
        role = 'admin';
        room = 'Main Administrative Office';
      }

      // TEACHER
      if (!role) {
        const matchingTeacher = teachers.find(
          (t) => t.email?.toLowerCase() === emailLower
        );

        if (matchingTeacher) {
          role = 'teacher';
          teacherDocId = matchingTeacher.id;
          room = matchingTeacher.room;
        }
      }

      // STUDENT
      if (!role) {
        const matchingStudent = students.find(
          (s) => s.email?.toLowerCase() === emailLower
        );

        if (matchingStudent) {
          role = 'student';
          studentId = matchingStudent.studentId;
          studentDocId = matchingStudent.id;
          grade = matchingStudent.grade;
          room = matchingStudent.homeroom;
        }
      }

      // NO ROLE
      if (!role) {
        setAuthError(
          'Your school account has not been assigned a role yet. Please contact a JMMS administrator.'
        );
        await signOutFromApp();
        return;
      }

      profile = {
        uid: user.uid,
        email: user.email || '',
        displayName:
          user.displayName ||
          user.email?.split('@')[0] ||
          'JMMS User',
        photoURL: user.photoURL || undefined,
        role,
        ...(studentId ? { studentId } : {}),
        ...(studentDocId ? { studentDocId } : {}),
        ...(teacherDocId ? { teacherDocId } : {}),
        ...(grade !== undefined ? { grade } : {}),
        ...(room ? { room } : {})
      };

      await saveUserProfile(profile);
    }

    setCurrentUser(profile);
    setCurrentRole(profile.role);

    if (profile.role === 'student' && profile.studentId) {
      const matched = students.find(
        (s) => s.studentId === profile.studentId
      );

      if (matched) {
        setActiveStudent(matched);
      }
    }

    if (profile.role === 'teacher' && profile.teacherDocId) {
      const matched = teachers.find(
        (t) => t.id === profile.teacherDocId
      );

      if (matched) {
        setActiveTeacher(matched);
      }
    }
  } else {
    if (!currentUser) {
      await ensureAuthenticated();
    }
  }

  setIsLoading(false);
};

const unsubAuth = onAuthStateChanged(auth, async (user) => {
  pendingAuthUser = user;

  if (user && !user.isAnonymous && (!teachersLoaded || !studentsLoaded)) {
    return;
  }

  await processAuthenticatedUser(user);
});

    // Subscribe to teachers directory (readable by all roles for destination selection)
    unsubTeachers = subscribeToTeachers((teacherList) => {
  setTeachers(teacherList);
  teachersLoaded = true;

  if (pendingAuthUser && !pendingAuthUser.isAnonymous && studentsLoaded) {
    processAuthenticatedUser(pendingAuthUser);
  }
});

    // Subscribe to student roster (teachers & admins)
    unsubStudents = subscribeToStudents((studentList) => {
  setStudents(studentList);
  studentsLoaded = true;

  if (studentList.length === 0) {
    seedInitialJMMSData().catch(console.error);
  }

  if (pendingAuthUser && !pendingAuthUser.isAnonymous && teachersLoaded) {
    processAuthenticatedUser(pendingAuthUser);
  }
});

    return () => {
      unsubAuth();
      if (unsubStudents) unsubStudents();
      if (unsubTeachers) unsubTeachers();
    };
  }, []);

  // Update default active student/teacher for demo / student mode
  useEffect(() => {
    if (students.length > 0 && !activeStudent && currentRole === 'student') {
      const firstActive = students.find(s => s.active) || students[0];
      if (firstActive) {
        selectStudent(firstActive);
      }
    }
    if (teachers.length > 0 && !activeTeacher && currentRole === 'teacher') {
      const firstTeacher = teachers.find(t => t.active) || teachers[0];
      if (firstTeacher) {
        selectTeacher(firstTeacher);
      }
    }
  }, [students, teachers, currentRole]);

  const loginWithGoogle = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setAuthError(null);
      await signInWithGoogle();
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Google Sign-In Error:', error);
      if (error.message?.includes('popup-closed-by-user')) {
        setAuthError('Sign-in cancelled.');
      } else {
        setAuthError(error.message || 'Google Workspace sign-in failed. Please try again.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const selectStudent = (student: Student) => {
    setActiveStudent(student);
    setCurrentRole('student');
    const profile: UserProfile = {
      uid: firebaseUser ? firebaseUser.uid : `student-${student.studentId}`,
      email: student.email || `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}@bearworks.jackson.sparcc.org`,
      displayName: `${student.firstName} ${student.lastName}`,
      photoURL: firebaseUser?.photoURL || undefined,
      role: 'student',
      studentId: student.studentId,
      studentDocId: student.id,
      grade: student.grade,
      room: student.homeroom
    };
    setCurrentUser(profile);
    if (firebaseUser && !firebaseUser.isAnonymous) {
      saveUserProfile(profile).catch(console.error);
    }
  };

  const selectTeacher = (teacher: Teacher) => {
    setActiveTeacher(teacher);
    setCurrentRole('teacher');
    const profile: UserProfile = {
      uid: firebaseUser ? firebaseUser.uid : `teacher-${teacher.id}`,
      email: teacher.email,
      displayName: teacher.name,
      photoURL: firebaseUser?.photoURL || undefined,
      role: 'teacher',
      teacherDocId: teacher.id,
      room: teacher.room
    };
    setCurrentUser(profile);
    if (firebaseUser && !firebaseUser.isAnonymous) {
      saveUserProfile(profile).catch(console.error);
    }
  };

  const loginAsAdmin = () => {
    setCurrentRole('admin');
    const profile: UserProfile = {
      uid: firebaseUser ? firebaseUser.uid : 'admin-jmms-principal',
      email: firebaseUser?.email || 'admin@bearworks.jackson.sparcc.org',
      displayName: firebaseUser?.displayName || 'Principal / Admin Office',
      photoURL: firebaseUser?.photoURL || undefined,
      role: 'admin',
      room: 'Main Office'
    };
    setCurrentUser(profile);
    if (firebaseUser) {
      saveUserProfile(profile).catch(console.error);
    }
  };

  const loginAsStudentById = (studentId: string): boolean => {
    const cleanId = studentId.trim();
    const found = students.find(s => s.studentId === cleanId);
    if (found) {
      selectStudent(found);
      return true;
    }
    return false;
  };

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
    if (role === 'admin') {
      loginAsAdmin();
    } else if (role === 'teacher' && teachers.length > 0) {
      selectTeacher(activeTeacher || teachers[0]);
    } else if (role === 'student' && students.length > 0) {
      selectStudent(activeStudent || students[0]);
    }
  };

  const logout = async () => {
    await signOutFromApp();
    if (students.length > 0) {
      selectStudent(students[0]);
    }
  };

  const seedData = async () => {
    setIsLoading(true);
    await seedInitialJMMSData();
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        currentRole,
        setRole,
        students,
        teachers,
        isLoading,
        activeStudent,
        activeTeacher,
        authError,
        setAuthError,
        loginWithGoogle,
        selectStudent,
        selectTeacher,
        loginAsAdmin,
        loginAsStudentById,
        logout,
        seedData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
