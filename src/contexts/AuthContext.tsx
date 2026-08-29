import React, {
  createContext,
  useContext,
  useState,
  useEffect
} from 'react';

import {
  UserProfile,
  UserRole,
  Student,
  Teacher
} from '../types';

import {
  auth,
  signInWithGoogle,
  signOutFromApp,
  provisionUserProfile,
  subscribeToStudents,
  subscribeToTeachers,
  subscribeToUserProfiles,
  seedInitialJMMSData,
  ALLOWED_DOMAIN
} from '../lib/firebase';

import {
  onAuthStateChanged,
  User
} from 'firebase/auth';


interface AuthContextType {

  firebaseUser: User | null;

  currentUser: UserProfile | null;

  currentRole: UserRole | null;

  students: Student[];

  teachers: Teacher[];

  userProfiles: UserProfile[];

  isLoading: boolean;

  activeStudent: Student | null;

  activeTeacher: Teacher | null;

  authError: string | null;

  setAuthError: (err: string | null) => void;

  loginWithGoogle: () => Promise<boolean>;

  selectStudent: (student: Student) => void;

  selectTeacher: (teacher: Teacher) => void;

  logout: () => Promise<void>;

  seedData: () => Promise<void>;
}



const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );


export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {

  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [currentRole, setCurrentRole] =
    useState<UserRole | null>(null);

  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(null);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [teachers, setTeachers] =
    useState<Teacher[]>([]);

  const [userProfiles, setUserProfiles] =
    useState<UserProfile[]>([]);

  const [activeStudent, setActiveStudent] =
    useState<Student | null>(null);

  const [activeTeacher, setActiveTeacher] =
    useState<Teacher | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState<string | null>(null);


  // ============================================================
  // FIREBASE AUTHENTICATION
  // ============================================================

  useEffect(() => {

    let unsubStudents:
      (() => void) | undefined;

    let unsubTeachers:
      (() => void) | undefined;

    let unsubUsers:
      (() => void) | undefined;


    const startRosterSubscriptions = () => {

      console.log(
        '[AuthContext] Starting authenticated data subscriptions.'
      );


      unsubStudents =
        subscribeToStudents(
          (studentList) => {

            console.log(
              '[AuthContext] Students loaded:',
              studentList.length
            );

            setStudents(
              [...studentList].sort(
                (a, b) => {

                  const lastNameCompare =
                    a.lastName.localeCompare(
                      b.lastName
                    );

                  if (
                    lastNameCompare !== 0
                  ) {
                    return lastNameCompare;
                  }

                  return a.firstName.localeCompare(
                    b.firstName
                  );
                }
              )
            );
          }
        );


      unsubTeachers =
        subscribeToTeachers(
          (teacherList) => {

            console.log(
              '[AuthContext] Teachers loaded:',
              teacherList.length
            );

            setTeachers(
              [...teacherList].sort(
                (a, b) =>
                  a.name.localeCompare(
                    b.name
                  )
              )
            );
          }
        );


      unsubUsers =
        subscribeToUserProfiles(
          (userList) => {

            console.log(
              '[AuthContext] User profiles loaded:',
              userList.length
            );

            setUserProfiles(
              [...userList].sort(
                (a, b) =>
                  a.displayName.localeCompare(
                    b.displayName
                  )
              )
            );
          }
        );
    };


    // ============================================================
    // PROCESS AUTHENTICATED USER
    // ============================================================

    const processAuthenticatedUser =
      async (
        user: User | null
      ) => {

        setFirebaseUser(user);


        // --------------------------------------------------------
        // NO USER
        // --------------------------------------------------------

        if (
          !user ||
          user.isAnonymous
        ) {

          console.log(
            '[AuthContext] No authenticated user.'
          );

          setCurrentUser(null);

          setCurrentRole(null);

          setActiveStudent(null);

          setActiveTeacher(null);

          setStudents([]);

          setTeachers([]);

          setUserProfiles([]);

          setIsLoading(false);

          return;
        }


        // --------------------------------------------------------
        // USER IS AUTHENTICATED
        // --------------------------------------------------------

        console.log(
          '[AuthContext] Firebase user authenticated:',
          user.email
        );

        console.log(
          '[AuthContext] Firebase UID:',
          user.uid
        );


        // --------------------------------------------------------
        // CHECK EMAIL DOMAIN (fast client-side pre-check for UX only)
        // --------------------------------------------------------
        //
        // This is NOT the real security boundary — it just avoids an
        // unnecessary round trip for obviously-wrong accounts. The
        // provisionUserProfile Cloud Function re-checks the domain
        // (and the full roster) server-side, and that's what actually
        // decides the user's role. The client can no longer assign
        // its own role or write directly to /users/{uid}.

        const email = (user.email || '').trim();
        const emailLower = email.toLowerCase();
        const emailDomain = emailLower.split('@')[1];

        if (emailDomain && emailDomain !== ALLOWED_DOMAIN.toLowerCase()) {
          setAuthError(
            `Access restricted: Please sign in with your Jackson Memorial Middle School account (@${ALLOWED_DOMAIN}).`
          );
          await signOutFromApp();
          setIsLoading(false);
          return;
        }

        setAuthError(null);

        // --------------------------------------------------------
        // START SCHOOL DATA LISTENERS
        // --------------------------------------------------------

        startRosterSubscriptions();

        // --------------------------------------------------------
        // PROVISION USER PROFILE (server-side)
        // --------------------------------------------------------
        //
        // Replaces all the old client-side role-detection/write logic.
        // The Cloud Function looks the user up in the students/teachers
        // roster (or the admin allowlist) and writes their /users/{uid}
        // doc itself, using the Admin SDK. If no roster match exists,
        // it throws and the user is signed back out below.

        let profile: UserProfile;

        try {
          profile = await provisionUserProfile();
        } catch (err: unknown) {
          const error = err as Error;

          console.error(
            '[AuthContext] Failed to provision user profile:',
            error
          );

          setAuthError(
            error.message ||
            'Your account could not be set up. Please contact the school office.'
          );

          await signOutFromApp();
          setIsLoading(false);
          return;
        }


        // ========================================================
        // SAFETY CHECK
        // ========================================================

        if (
          !profile
        ) {

          throw new Error(
            'Unable to create or load your JMMS user profile.'
          );
        }


        // ========================================================
        // SET CURRENT USER
        // ========================================================

        setCurrentUser(
          profile
        );

        setCurrentRole(
          profile.role
        );


        console.log(
          '[AuthContext] Final role:',
          profile.role
        );


        // ========================================================
        // MATCH ACTIVE STUDENT
        // ========================================================

        if (
          profile.role === 'student'
        ) {

          let matchedStudent:
            Student | undefined;


          if (
            profile.studentId
          ) {

            matchedStudent =
              students.find(
                (student) =>
                  student.studentId ===
                  profile.studentId
              );
          }


          if (
            !matchedStudent
          ) {

            matchedStudent =
              students.find(
                (student) =>
                  student.email &&
                  profile.email &&
                  student.email
                    .toLowerCase() ===
                    profile.email
                      .toLowerCase()
              );
          }


          if (
            matchedStudent
          ) {

            setActiveStudent(
              matchedStudent
            );
          }
        }


        // ========================================================
        // MATCH ACTIVE TEACHER
        // ========================================================

        if (
          profile.role === 'teacher'
        ) {

          let matchedTeacher:
            Teacher | undefined;


          /*
           * First try the saved teacher document ID.
           */

          if (
            profile.teacherDocId
          ) {

            matchedTeacher =
              teachers.find(
                (teacher) =>
                  teacher.id ===
                  profile.teacherDocId
              );
          }


          /*
           * If the listener hasn't loaded the teacher yet,
           * look directly by email.
           */

          if (
            !matchedTeacher
          ) {

            matchedTeacher =
              teachers.find(
                (teacher) =>
                  teacher.email &&
                  profile.email &&
                  teacher.email
                    .toLowerCase() ===
                    profile.email
                      .toLowerCase()
              );
          }


          if (
            matchedTeacher
          ) {

            setActiveTeacher(
              matchedTeacher
            );
          }
          else {

            /*
             * The teacher was found by email above, but the
             * listener may not have finished loading yet.
             *
             * Create a temporary active teacher from the
             * profile so the dashboard can still open.
             */

            setActiveTeacher({

              id:
                profile.teacherDocId ||
                profile.uid,

              name:
                profile.displayName,

              room:
                profile.room ||
                '',

              subject:
                'Teacher',

              email:
                profile.email,

              active:
                true
            });
          }
        }


        // ========================================================
        // ADMIN ACTIVE PROFILE
        // ========================================================

        if (
          profile.role === 'admin'
        ) {

          setActiveTeacher({

            id:
              profile.uid,

            name:
              profile.displayName,

            room:
              profile.room ||
              'Main Administrative Office',

            subject:
              'Administration',

            email:
              profile.email,

            active:
              true,

            department:
              'Administration'
          });
        }


        setIsLoading(false);
      };


    // ============================================================
    // FIREBASE AUTH LISTENER
    // ============================================================

    const unsubAuth =
      onAuthStateChanged(
        auth,

        async (user) => {

          try {

            await processAuthenticatedUser(
              user
            );

          } catch (error) {

            console.error(
              '[AuthContext] Authentication processing error:',
              error
            );

            setAuthError(
              error instanceof Error
                ? error.message
                : 'There was a problem loading your account. Please try signing in again.'
            );

            setIsLoading(false);
          }
        }
      );


    // ============================================================
    // CLEANUP
    // ============================================================

    return () => {

      unsubAuth();

      if (
        unsubStudents
      ) {
        unsubStudents();
      }

      if (
        unsubTeachers
      ) {
        unsubTeachers();
      }

      if (
        unsubUsers
      ) {
        unsubUsers();
      }
    };

  }, []);


  // ============================================================
  // GOOGLE LOGIN
  // ============================================================

  const loginWithGoogle =
    async (): Promise<boolean> => {

      try {

        setIsLoading(true);

        setAuthError(null);

        await signInWithGoogle();

        return true;

      } catch (
        err: unknown
      ) {

        const error =
          err as Error;


        console.error(
          '[AuthContext] Google Sign-In Error:',
          error
        );


        if (
          error.message?.includes(
            'popup-closed-by-user'
          )
        ) {

          setAuthError(
            'Sign-in cancelled.'
          );

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


  // ============================================================
  // SELECT STUDENT
  // ============================================================

  const selectStudent =
    (
      student: Student
    ) => {

      setActiveStudent(
        student
      );
    };


  // ============================================================
  // SELECT TEACHER
  // ============================================================

  const selectTeacher =
    (
      teacher: Teacher
    ) => {

      setActiveTeacher(
        teacher
      );
    };



  // ============================================================
  // LOGOUT
  // ============================================================

  const logout =
    async () => {

      setCurrentRole(null);

      setCurrentUser(null);

      setActiveStudent(null);

      setActiveTeacher(null);

      setStudents([]);

      setTeachers([]);

      setUserProfiles([]);

      await signOutFromApp();
    };


  // ============================================================
  // SEED DATA
  // ============================================================

  const seedData =
    async () => {

      setIsLoading(true);

      try {

        await seedInitialJMMSData();

      } catch (
        error
      ) {

        console.error(
          '[AuthContext] Failed to seed data:',
          error
        );

        throw error;

      } finally {

        setIsLoading(false);
      }
    };


  // ============================================================
  // PROVIDER
  // ============================================================

  return (

    <AuthContext.Provider
      value={{

        firebaseUser,

        currentUser,

        currentRole,

        students,

        teachers,

        userProfiles,

        isLoading,

        activeStudent,

        activeTeacher,

        authError,

        setAuthError,

        loginWithGoogle,

        selectStudent,

        selectTeacher,

        logout,

        seedData

      }}
    >

      {children}

    </AuthContext.Provider>
  );
};


// ============================================================
// USE AUTH HOOK
// ============================================================

export const useAuth = () => {

  const context =
    useContext(
      AuthContext
    );


  if (
    !context
  ) {

    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }


  return context;
};
