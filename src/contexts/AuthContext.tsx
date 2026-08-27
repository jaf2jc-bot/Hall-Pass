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

  // 1. Listen for Auth State Changes
  useEffect(() => {
    let unsubStudents: (() => void) | undefined;
    let unsubTeachers: (() => void) | undefined;
    


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

const emailLower = email.toLowerCase();

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
} else if (!profile) {
      let role: UserRole | null = null;
      let teacherDocId: string | undefined;
      let studentId: string | undefined;
      let studentDocId: string | undefined;
      let room: string | undefined;
      let grade: number | undefined;

// DETERMINE USER ROLE
if (
  emailLower === 'jaf2jc@bearworks.jackson.sparcc.org' ||
  emailLower.includes('admin') ||
  emailLower.startsWith('principal')
) {
  role = 'admin';
  room = 'Main Administrative Office';
} else {
  // All other new school accounts default to student.
  role = 'student';
}

      // If this email already exists in the student roster,
      // associate the new user profile with that student.
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
        ...(teacherDocId ? { teacherDocId } : {}),
        ...(grade !== undefined ? { grade } : {}),
        ...(room ? { room } : {})
      };

      await saveUserProfile(profile);
    }

    setCurrentUser(profile);
    setCurrentRole(profile.role);
    
// Now that authentication and role are confirmed,
    // subscribe to the school rosters.
    unsubTeachers = subscribeToTeachers((teacherList) => {
      setTeachers(teacherList);
    });

    unsubStudents = subscribeToStudents((studentList) => {
      setStudents(studentList);

      if (studentList.length === 0) {
        seedInitialJMMSData().catch(console.error);
      }
    });
    
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
    // No authenticated Google user yet.
    // Do NOT attempt anonymous authentication.
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
      if (unsubStudents) unsubStudents();
      if (unsubTeachers) unsubTeachers();
    };
  }, []);



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
};

const selectTeacher = (teacher: Teacher) => {
  setActiveTeacher(teacher);
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

 const logout = async () => {
  setAuthReady(false);
  setCurrentRole(null);
  setCurrentUser(null);
  setActiveStudent(null);
  setActiveTeacher(null);

  await signOutFromApp();
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
