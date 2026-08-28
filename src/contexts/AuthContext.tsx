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
  getUserProfile,
  saveUserProfile,
  subscribeToStudents,
  subscribeToTeachers,
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

const AuthContext =
  createContext<AuthContextType | undefined>(undefined);

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

  const [activeStudent, setActiveStudent] =
    useState<Student | null>(null);

  const [activeTeacher, setActiveTeacher] =
    useState<Teacher | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState<string | null>(null);

  /*
   * ============================================================
   * AUTH + SCHOOL DATA
   * ============================================================
   */

  useEffect(() => {

    let unsubStudents:
      (() => void) | undefined;

    let unsubTeachers:
      (() => void) | undefined;

    /*
     * ------------------------------------------------------------
     * SUBSCRIBE TO SCHOOL ROSTERS
     *
     * IMPORTANT:
     * These subscriptions are intentionally started independently
     * of the logged-in user.
     *
     * This makes sure:
     *
     * - Fake students appear
     * - Fake teachers appear
     * - Real students appear
     * - Real teachers appear
     * - Admin management can see the seeded roster
     * - Request Student dropdown can see the roster
     * ------------------------------------------------------------
     */

    const startRosterSubscriptions = () => {

      /*
       * STUDENTS
       */

      unsubStudents = subscribeToStudents(
        (studentList) => {

          console.log(
            '[AuthContext] Students loaded:',
            studentList.length
          );

          setStudents(
            [...studentList].sort((a, b) => {

              const lastNameCompare =
                a.lastName.localeCompare(
                  b.lastName
                );

              if (lastNameCompare !== 0) {
                return lastNameCompare;
              }

              return a.firstName.localeCompare(
                b.firstName
              );
            })
          );
        }
      );

      /*
       * TEACHERS
       */

      unsubTeachers = subscribeToTeachers(
        (teacherList) => {

          console.log(
            '[AuthContext] Teachers loaded:',
            teacherList.length
          );

          setTeachers(
            [...teacherList].sort((a, b) =>
              a.name.localeCompare(b.name)
            )
          );
        }
      );
    };

    /*
     * Start the roster listeners immediately.
     *
     * This is important because the rosters should NOT depend
     * on whether the user is an admin, teacher, or student.
     */

    startRosterSubscriptions();


    /*
     * ============================================================
     * AUTHENTICATED USER
     * ============================================================
     */

    const processAuthenticatedUser =
      async (user: User | null) => {

        setFirebaseUser(user);

        /*
         * --------------------------------------------------------
         * NO USER
         * --------------------------------------------------------
         */

        if (!user || user.isAnonymous) {

          setCurrentUser(null);
          setCurrentRole(null);
          setActiveStudent(null);
          setActiveTeacher(null);

          setIsLoading(false);

          return;
        }


        /*
         * --------------------------------------------------------
         * CHECK SCHOOL EMAIL DOMAIN
         * --------------------------------------------------------
         */

        const email =
          user.email || '';

        const emailLower =
          email.toLowerCase();

        const emailDomain =
          email.split('@')[1]?.toLowerCase();


        const isAuthorizedDomain =
          emailDomain ===
            ALLOWED_DOMAIN.toLowerCase() ||
          emailLower ===
            'jaf2jc@bearworks.jackson.sparcc.org';


        if (
          !isAuthorizedDomain &&
          emailDomain
        ) {

          setAuthError(
            `Access restricted: Please sign in with your Jackson Memorial Middle School account (@${ALLOWED_DOMAIN}).`
          );

          await signOutFromApp();

          setIsLoading(false);

          return;
        }


        setAuthError(null);


        /*
         * --------------------------------------------------------
         * GET EXISTING PROFILE
         * --------------------------------------------------------
         */

        let profile =
          await getUserProfile(user.uid);


        /*
         * ========================================================
         * ADMIN ACCOUNT
         * ========================================================
         */

        const isAdminAccount =
          emailLower ===
            'jaf2jc@bearworks.jackson.sparcc.org' ||
          emailLower.includes('admin') ||
          emailLower.startsWith('principal');


        if (isAdminAccount) {

          profile = {

            uid: user.uid,

            email:
              user.email || '',

            displayName:
              user.displayName ||
              user.email?.split('@')[0] ||
              'JMMS Administrator',

            photoURL:
              user.photoURL ||
              undefined,

            role: 'admin',

            room:
              'Main Administrative Office'
          };

          /*
           * Save admin profile.
           */

          await saveUserProfile(profile);

        }


        /*
         * ========================================================
         * EXISTING / NEW NON-ADMIN USER
         * ========================================================
         */

        else if (!profile) {

          let role:
            UserRole = 'student';

          let studentId:
            string | undefined;

          let studentDocId:
            string | undefined;

          let teacherDocId:
            string | undefined;

          let room:
            string | undefined;

          let grade:
            number | undefined;


          /*
           * ------------------------------------------------------
           * DETERMINE WHETHER EMAIL BELONGS TO A TEACHER
           *
           * We DO NOT automatically make every new school account
           * a teacher.
           *
           * A matching teacher roster record is required.
           * ------------------------------------------------------
           */

          const matchingTeacher =
            teachers.find(
              (teacher) =>
                teacher.email &&
                teacher.email.toLowerCase() ===
                  emailLower
            );


          if (matchingTeacher) {

            role = 'teacher';

            teacherDocId =
              matchingTeacher.id;

            room =
              matchingTeacher.room;

          }

          else {

            /*
             * Default new school accounts to student.
             */

            role = 'student';
          }


          /*
           * ------------------------------------------------------
           * MATCH STUDENT ROSTER
           * ------------------------------------------------------
           */

          const matchingStudent =
            students.find(
              (student) =>
                student.email &&
                student.email.toLowerCase() ===
                  emailLower
            );


          if (matchingStudent) {

            role = 'student';

            studentId =
              matchingStudent.studentId;

            studentDocId =
              matchingStudent.id;

            grade =
              matchingStudent.grade;

            room =
              matchingStudent.homeroom;
          }


          /*
           * ------------------------------------------------------
           * CREATE PROFILE
           * ------------------------------------------------------
           */

          profile = {

            uid:
              user.uid,

            email:
              user.email || '',

            displayName:
              user.displayName ||
              user.email?.split('@')[0] ||
              'JMMS User',

            photoURL:
              user.photoURL ||
              undefined,

            role,

            ...(studentId
              ? { studentId }
              : {}),

            ...(studentDocId
              ? { studentDocId }
              : {}),

            ...(teacherDocId
              ? { teacherDocId }
              : {}),

            ...(grade !== undefined
              ? { grade }
              : {}),

            ...(room
              ? { room }
              : {})
          };


          await saveUserProfile(
            profile
          );
        }


        /*
         * ========================================================
         * SET CURRENT USER
         * ========================================================
         */

        setCurrentUser(profile);

        setCurrentRole(
          profile.role
        );


        /*
         * ========================================================
         * MATCH ACTIVE STUDENT
         * ========================================================
         */

        if (
          profile.role === 'student'
        ) {

          /*
           * Try studentId first.
           */

          let matchedStudent =
            profile.studentId
              ? students.find(
                  (student) =>
                    student.studentId ===
                    profile.studentId
                )
              : undefined;


          /*
           * If that didn't work, try the email.
           */

          if (!matchedStudent) {

            matchedStudent =
              students.find(
                (student) =>
                  student.email &&
                  profile.email &&
                  student.email.toLowerCase() ===
                    profile.email.toLowerCase()
              );
          }


          if (matchedStudent) {

            setActiveStudent(
              matchedStudent
            );
          }
        }


        /*
         * ========================================================
         * MATCH ACTIVE TEACHER
         * ========================================================
         */

        if (
          profile.role === 'teacher'
        ) {

          let matchedTeacher =
            profile.teacherDocId
              ? teachers.find(
                  (teacher) =>
                    teacher.id ===
                    profile.teacherDocId
                )
              : undefined;


          /*
           * If teacher ID wasn't available,
           * match by email.
           */

          if (!matchedTeacher) {

            matchedTeacher =
              teachers.find(
                (teacher) =>
                  teacher.email &&
                  profile.email &&
                  teacher.email.toLowerCase() ===
                    profile.email.toLowerCase()
              );
          }


          if (matchedTeacher) {

            setActiveTeacher(
              matchedTeacher
            );
          }
        }


        /*
         * ========================================================
         * ADMIN ACTIVE PROFILE
         * ========================================================
         */

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


    /*
     * ============================================================
     * FIREBASE AUTH LISTENER
     * ============================================================
     */

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
              'There was a problem loading your account. Please try signing in again.'
            );

            setIsLoading(false);
          }
        }
      );


    /*
     * ============================================================
     * CLEANUP
     * ============================================================
     */

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


  /*
   * ============================================================
   * GOOGLE LOGIN
   * ============================================================
   */

  const loginWithGoogle =
    async (): Promise<boolean> => {

      try {

        setIsLoading(true);
        setAuthError(null);

        await signInWithGoogle();

        return true;

      } catch (err: unknown) {

        const error =
          err as Error;

        console.error(
          'Google Sign-In Error:',
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


  /*
   * ============================================================
   * SELECT STUDENT
   * ============================================================
   */

  const selectStudent =
    (student: Student) => {

      setActiveStudent(
        student
      );
    };


  /*
   * ============================================================
   * SELECT TEACHER
   * ============================================================
   */

  const selectTeacher =
    (teacher: Teacher) => {

      setActiveTeacher(
        teacher
      );
    };


  /*
   * ============================================================
   * LOGIN AS ADMIN
   * ============================================================
   */

  const loginAsAdmin = () => {

    setCurrentRole(
      'admin'
    );


    const profile: UserProfile = {

      uid:
        firebaseUser
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

      role:
        'admin',

      room:
        'Main Office'
    };


    setCurrentUser(
      profile
    );


    setActiveTeacher({

      id:
        profile.uid,

      name:
        profile.displayName,

      room:
        profile.room ||
        'Main Office',

      subject:
        'Administration',

      email:
        profile.email,

      active:
        true,

      department:
        'Administration'
    });


    if (firebaseUser) {

      saveUserProfile(
        profile
      ).catch(console.error);
    }
  };


  /*
   * ============================================================
   * LOGIN AS STUDENT BY ID
   * ============================================================
   */

  const loginAsStudentById =
    (studentId: string): boolean => {

      const cleanId =
        studentId.trim();


      const found =
        students.find(
          (student) =>
            student.studentId ===
            cleanId
        );


      if (found) {

        selectStudent(
          found
        );

        return true;
      }


      return false;
    };


  /*
   * ============================================================
   * SET ROLE
   * ============================================================
   */

  const setRole =
    (role: UserRole) => {

      setCurrentRole(
        role
      );


      /*
       * ADMIN
       */

      if (
        role === 'admin'
      ) {

        loginAsAdmin();

        return;
      }


      /*
       * TEACHER
       */

      if (
        role === 'teacher'
      ) {

        if (
          activeTeacher
        ) {

          setActiveTeacher(
            activeTeacher
          );

        } else if (
          teachers.length > 0
        ) {

          setActiveTeacher(
            teachers[0]
          );
        }

        return;
      }


      /*
       * STUDENT
       */

      if (
        role === 'student'
      ) {

        if (
          activeStudent
        ) {

          setActiveStudent(
            activeStudent
          );

        } else if (
          students.length > 0
        ) {

          setActiveStudent(
            students[0]
          );
        }

        return;
      }
    };


  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  const logout =
    async () => {

      setCurrentRole(
        null
      );

      setCurrentUser(
        null
      );

      setActiveStudent(
        null
      );

      setActiveTeacher(
        null
      );

      await signOutFromApp();
    };


  /*
   * ============================================================
   * SEED DATA
   * ============================================================
   */

  const seedData =
    async () => {

      setIsLoading(
        true
      );

      try {

        await seedInitialJMMSData();

      } catch (error) {

        console.error(
          '[AuthContext] Failed to seed data:',
          error
        );

        throw error;

      } finally {

        setIsLoading(
          false
        );
      }
    };


  /*
   * ============================================================
   * PROVIDER
   * ============================================================
   */

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


/*
 * ==============================================================
 * USE AUTH HOOK
 * ==============================================================
 */

export const useAuth = () => {

  const context =
    useContext(
      AuthContext
    );


  if (!context) {

    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }


  return context;
};
