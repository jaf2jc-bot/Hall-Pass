import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, Student, Teacher } from '../types';
import { 
  auth,
  signInWithGoogle, 
  signOutFromApp,  
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
  currentRole: UserRole | null;
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
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  useEffect(() => {
    let unsubStudents: (() => void) | undefined;
    let unsubTeachers: (() => void) | undefined;

    const processAuthenticatedUser = async (user: User | null) => {
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

        const emailLower = email.toLowerCase();

        // ==========================================
        // ADMIN DETECTION
        // ==========================================

        const isAdminAccount =
          emailLower === 'jaf2jc@bearworks.jackson.sparcc.org' ||
          emailLower.includes('admin') ||
          emailLower.startsWith('principal');

        if (isAdminAccount) {
          profile = {
            uid: user.uid,
            email: user.email || '',
            displayName:
              user.displayName ||
              user.email?.split('@')[0] ||
              'JMMS Administrator',
            photoURL: user.photoURL || undefined,
            role: 'admin',
            room: 'Main Administrative Office'
          };

          await saveUserProfile(profile);
        }

        // ==========================================
        // NEW USER
        // ==========================================

        else if (!profile) {
          let role: UserRole = 'student';

          let studentId: string | undefined;
          let studentDocId: string | undefined;
          let grade: number | undefined;
          let room: string | undefined;

          // If this email already exists in the student roster,
          // connect the Google account to that student.
          const matchingStudent = students.find(
            (s) => s.email?.toLowerCase() === emailLower
          );

          if (matchingStudent) {
            studentId = matchingStudent.studentId;
            studentDocId = matchingStudent.id;
            grade = matchingStudent.grade;
            room = matchingStudent.homeroom;
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
            ...(grade !== undefined ? { grade } : {}),
            ...(room ? { room } : {})
          };

          await saveUserProfile(profile);
        }

        setCurrentUser(profile);
        setCurrentRole(profile.role);

        // ==========================================
        // SCHOOL ROSTERS
        // ==========================================

        unsubTeachers = subscribeToTeachers((teacherList) => {
          setTeachers(teacherList);
        });

        unsubStudents = subscribeToStudents((studentList) => {
          setStudents(studentList);

          if (studentList.length === 0) {
            seedInitialJMMSData().catch(console.error);
          }
        });

        // ==========================================
        // ACTIVE STUDENT
        // ==========================================

        if (profile.role === 'student' && profile.studentId) {
          const matched = students.find(
            (s) => s.studentId === profile.studentId
          );

          if (matched) {
            setActiveStudent(matched);
          }
        }

        // ==========================================
        // ACTIVE TEACHER
        // ==========================================

        if (profile.role === 'teacher' && profile.teacherDocId) {
          const matched = teachers.find(
            (t) => t.id === profile.teacherDocId
          );

          if (matched) {
            setActiveTeacher(matched);
          }
        }

        // ==========================================
        // ADMIN AS ACTIVE TEACHER
        // ==========================================

        if (profile.role === 'admin') {
          setActiveTeacher({
            id: profile.uid,
            name: profile.displayName,
            room: profile.room || 'Main Administrative Office',
            subject: 'Administration',
            email: profile.email,
            active: true,
            department: 'Administration'
          });
        }

      } else {
        // No authenticated Google user.
        setCurrentUser(null);
        setCurrentRole(null);
        setActiveStudent(null);
        setActiveTeacher(null);
      }

      setIsLoading(false);
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      await processAuthenticatedUser(user);
    });

    return () => {
      unsubAuth();

      if (unsubStudents) {
        unsubStudents();
      }

      if (unsubTeachers) {
        unsubTeachers();
      }
    };
  }, []);

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

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
        setAuthError(
          error.message ||
          'Google Workspace sign-in failed. Please try again.'
        );
      }

      return false;

    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // SELECTION
  // ==========================================

  const selectStudent = (student: Student) => {
    setActiveStudent(student);
  };

  const selectTeacher = (teacher: Teacher) => {
    setActiveTeacher(teacher);
  };

  // ==========================================
  // ADMIN LOGIN
  // ==========================================

  const loginAsAdmin = () => {
    setCurrentRole('admin');

    const profile: UserProfile = {
      uid: firebaseUser
        ? firebaseUser.uid
        : 'admin-jmms-principal',

      email:
        firebaseUser?.email ||
        'admin@bearworks.jackson.sparcc.org',

      displayName:
        firebaseUser?.displayName ||
        'Principal / Admin Office',

      photoURL:
        firebaseUser?.photoURL ||
        undefined,

      role: 'admin',

      room: 'Main Office'
    };

    setCurrentUser(profile);

    if (firebaseUser) {
      saveUserProfile(profile).catch(console.error);
    }
  };

  // ==========================================
  // LOGIN AS STUDENT BY ID
  // ==========================================

  const loginAsStudentById = (studentId: string): boolean => {
    const cleanId = studentId.trim();

    const found = students.find(
      (s) => s.studentId === cleanId
    );

    if (found) {
      selectStudent(found);
      return true;
    }

    return false;
  };

  // ==========================================
  // ROLE
  // ==========================================

  const setRole = (role: UserRole) => {
    setCurrentRole(role);

    if (role === 'admin') {

      loginAsAdmin();

    } else if (role === 'teacher') {

      if (activeTeacher) {
        setActiveTeacher(activeTeacher);

      } else if (teachers.length > 0) {
        setActiveTeacher(teachers[0]);
      }

    } else if (role === 'student') {

      if (activeStudent) {
        setActiveStudent(activeStudent);

      } else if (students.length > 0) {
        setActiveStudent(students[0]);
      }
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = async () => {
    setAuthReady(false);

    setCurrentRole(null);
    setCurrentUser(null);

    setActiveStudent(null);
    setActiveTeacher(null);

    await signOutFromApp();
  };

  // ==========================================
  // SEED DATA
  // ==========================================

  const seedData = async () => {
    setIsLoading(true);

    await seedInitialJMMSData();

    setIsLoading(false);
  };

  // ==========================================
  // PROVIDER
  // ==========================================

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

// ==========================================
// USE AUTH
// ==========================================

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};
