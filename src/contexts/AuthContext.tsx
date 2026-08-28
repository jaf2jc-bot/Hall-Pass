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

  setRole: (role: UserRole) => void;

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

  loginAsAdmin: () => void;
  loginAsStudentById: (studentId: string) => boolean;

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


  /*
   * ============================================================
   * FIREBASE AUTHENTICATION
   * ============================================================
   */

  useEffect(() => {

    let unsubStudents:
      (() => void) | undefined;

    let unsubTeachers:
      (() => void) | undefined;

    let unsubUsers:
      (() => void) | undefined;

    let isMounted = true;


    /*
     * These variables keep track of the school data while
     * Firebase subscriptions are loading.
     *
     * This is important because Google authentication can finish
     * before the Teachers collection has finished loading.
     */

    let loadedStudents:
      Student[] = [];

    let loadedTeachers:
      Teacher[] = [];

    let studentsLoaded =
      false;

    let teachersLoaded =
      false;


    /*
     * ============================================================
     * PROCESS AUTHENTICATED USER
     * ============================================================
     */

    const processAuthenticatedUser =
      async (
        user: User,
        studentList: Student[],
        teacherList: Teacher[]
      ) => {

        if (!isMounted) {
          return;
        }


        console.log(
          '[AuthContext] Processing authenticated user:',
          user.email
        );


        const email =
          user.email || '';

        const emailLower =
          email.trim().toLowerCase();


        /*
         * --------------------------------------------------------
         * CHECK SCHOOL EMAIL DOMAIN
         * --------------------------------------------------------
         */

        const emailDomain =
          email.split('@')[1]?.toLowerCase();


        const isAuthorizedDomain =
          emailDomain ===
            ALLOWED_DOMAIN.toLowerCase() ||
          emailLower ===
            'jaf2jc@bearworks.jackson.sparcc.org';


        if (
          !isAuthorizedDomain
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

          const adminProfile:
            UserProfile = {

            uid:
              user.uid,

            email:
              email,

            displayName:
              user.displayName ||
              user.email?.split('@')[0] ||
              'JMMS Administrator',

            photoURL:
              user.photoURL ||
              undefined,

            role:
              'admin',

            room:
              'Main Administrative Office'
          };


          await saveUserProfile(
            adminProfile
          );


          if (!isMounted) {
            return;
          }


          setCurrentUser(
            adminProfile
          );

          setCurrentRole(
            'admin'
          );


          setActiveTeacher({

            id:
              adminProfile.uid,

            name:
              adminProfile.displayName,

            room:
              adminProfile.room ||
              'Main Administrative Office',

            subject:
              'Administration',

            email:
              adminProfile.email,

            active:
              true,

            department:
              'Administration'
          });


          setActiveStudent(null);

          setIsLoading(false);

          return;
        }


        /*
         * ========================================================
         * FIND TEACHER BY EMAIL
         * ========================================================
         *
         * THIS IS THE MAIN CHANGE.
         *
         * We do NOT need the teacher's Firebase UID.
         *
         * The teacher is identified by their school email.
         *
         * Example:
         *
         * teachers/
         *   manderson26@bearworks.jackson.sparcc.org
         *
         * When that person logs in with Google, Firebase gives
         * us their email and we find the teacher record.
         */

        const matchingTeacher =
          teacherList.find(
            (teacher) =>
              teacher.email &&
              teacher.email
                .trim()
                .toLowerCase() ===
              emailLower
          );


        /*
         * ========================================================
         * FIND STUDENT BY EMAIL
         * ========================================================
         */

        const matchingStudent =
          studentList.find(
            (student) =>
              student.email &&
              student.email
                .trim()
                .toLowerCase() ===
              emailLower
          );


        /*
         * ========================================================
         * TEACHER FOUND
         * ========================================================
         */

        if (matchingTeacher) {

          console.log(
            '[AuthContext] TEACHER MATCH FOUND:',
            matchingTeacher.name,
            matchingTeacher.email
          );


          /*
           * The teacher's Firebase UID is NOT needed in advance.
           *
           * We create/update the Users profile using the UID
           * Firebase just gave us.
           */

          const teacherProfile:
            UserProfile = {

            uid:
              user.uid,

            email:
              email,

            displayName:
              user.displayName ||
              matchingTeacher.name ||
              email.split('@')[0],

            photoURL:
              user.photoURL ||
              undefined,

            role:
              'teacher',

            teacherDocId:
              matchingTeacher.id,

            room:
              matchingTeacher.room,

            ...(matchingTeacher.subject
              ? {
                  subject:
                    matchingTeacher.subject
                }
              : {})
          };


          /*
           * Save/update the Users document.
           *
           * This means an account that previously existed as a
           * student will automatically be corrected to teacher.
           */

          await saveUserProfile(
            teacherProfile
          );


          if (!isMounted) {
            return;
          }


          setCurrentUser(
            teacherProfile
          );

          setCurrentRole(
            'teacher'
          );

          setActiveTeacher(
            matchingTeacher
          );

          setActiveStudent(null);

          setIsLoading(false);

          return;
        }


        /*
         * ========================================================
         * STUDENT FOUND
         * ========================================================
         */

        if (matchingStudent) {

          console.log(
            '[AuthContext] STUDENT MATCH FOUND:',
            matchingStudent.firstName,
            matchingStudent.lastName
          );


          const studentProfile:
            UserProfile = {

            uid:
              user.uid,

            email:
              email,

            displayName:
              user.displayName ||
              `${matchingStudent.firstName} ${matchingStudent.lastName}`,

            photoURL:
              user.photoURL ||
              undefined,

            role:
              'student',

            studentId:
              matchingStudent.studentId,

            studentDocId:
              matchingStudent.id,

            grade:
              matchingStudent.grade,

            room:
              matchingStudent.homeroom
          };


          await saveUserProfile(
            studentProfile
          );


          if (!isMounted) {
            return;
          }


          setCurrentUser(
            studentProfile
          );

          setCurrentRole(
            'student'
          );

          setActiveStudent(
            matchingStudent
          );

          setActiveTeacher(null);

          setIsLoading(false);

          return;
        }


        /*
         * ========================================================
         * EXISTING USER
         * ========================================================
         */

        const existingProfile =
          await getUserProfile(
            user.uid
          );


        if (existingProfile) {

          console.log(
            '[AuthContext] Existing user profile found:',
            existingProfile.email,
            existingProfile.role
          );


          /*
           * If the person was previously saved as a teacher
           * or student, reconnect their school record.
           */

          let profile =
            existingProfile;


          /*
           * ------------------------------------------------------
           * EXISTING TEACHER
           * ------------------------------------------------------
           */

          if (
            profile.role === 'teacher'
          ) {

            let matchedTeacher:
              Teacher | undefined;


            if (
              profile.teacherDocId
            ) {

              matchedTeacher =
                teacherList.find(
                  (teacher) =>
                    teacher.id ===
                    profile.teacherDocId
                );
            }


            if (
              !matchedTeacher
            ) {

              matchedTeacher =
                teacherList.find(
                  (teacher) =>
                    teacher.email &&
                    profile.email &&
                    teacher.email
                      .trim()
                      .toLowerCase() ===
                    profile.email
                      .trim()
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
          }


          /*
           * ------------------------------------------------------
           * EXISTING STUDENT
           * ------------------------------------------------------
           */

          if (
            profile.role === 'student'
          ) {

            let matchedStudent:
              Student | undefined;


            if (
              profile.studentId
            ) {

              matchedStudent =
                studentList.find(
                  (student) =>
                    student.studentId ===
                    profile.studentId
                );
            }


            if (
              !matchedStudent
            ) {

              matchedStudent =
                studentList.find(
                  (student) =>
                    student.email &&
                    profile.email &&
                    student.email
                      .trim()
                      .toLowerCase() ===
                    profile.email
                      .trim()
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


          /*
           * ------------------------------------------------------
           * EXISTING ADMIN
           * ------------------------------------------------------
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


          setCurrentUser(
            profile
          );

          setCurrentRole(
            profile.role
          );

          setIsLoading(false);

          return;
        }


        /*
         * ========================================================
         * BRAND NEW USER
         * ========================================================
         *
         * If their email isn't in Teachers or Students,
         * default them to student.
         *
         * This is the safest fallback.
         */

        console.log(
          '[AuthContext] No teacher or student match found.'
        );

        console.log(
          '[AuthContext] Creating new user as student.'
        );


        const newProfile:
          UserProfile = {

          uid:
            user.uid,

          email:
            email,

          displayName:
            user.displayName ||
            email.split('@')[0] ||
            'JMMS User',

          photoURL:
            user.photoURL ||
            undefined,

          role:
            'student'
        };


        await saveUserProfile(
          newProfile
        );


        if (!isMounted) {
          return;
        }


        setCurrentUser(
          newProfile
        );

        setCurrentRole(
          'student'
        );

        setActiveStudent(null);

        setActiveTeacher(null);

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

            setFirebaseUser(
              user
            );


            /*
             * ----------------------------------------------------
             * LOGGED OUT
             * ----------------------------------------------------
             */

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


            /*
             * ----------------------------------------------------
             * LOGGED IN
             * ----------------------------------------------------
             */

            console.log(
              '[AuthContext] Firebase user authenticated:',
              user.email
            );


            setIsLoading(true);


            /*
             * ----------------------------------------------------
             * STUDENTS SUBSCRIPTION
             * ----------------------------------------------------
             */

            unsubStudents =
              subscribeToStudents(
                (studentList) => {

                  console.log(
                    '[AuthContext] Students loaded:',
                    studentList.length
                  );


                  loadedStudents =
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
                    );


                  studentsLoaded =
                    true;


                  setStudents(
                    loadedStudents
                  );


                  /*
                   * Wait until BOTH collections are loaded.
                   */

                  if (
                    studentsLoaded &&
                    teachersLoaded
                  ) {

                    processAuthenticatedUser(
                      user,
                      loadedStudents,
                      loadedTeachers
                    );
                  }
                }
              );


            /*
             * ----------------------------------------------------
             * TEACHERS SUBSCRIPTION
             * ----------------------------------------------------
             */

            unsubTeachers =
              subscribeToTeachers(
                (teacherList) => {

                  console.log(
                    '[AuthContext] Teachers loaded:',
                    teacherList.length
                  );


                  loadedTeachers =
                    [...teacherList].sort(
                      (a, b) =>
                        a.name.localeCompare(
                          b.name
                        )
                    );


                  teachersLoaded =
                    true;


                  setTeachers(
                    loadedTeachers
                  );


                  /*
                   * Wait until BOTH collections are loaded.
                   */

                  if (
                    studentsLoaded &&
                    teachersLoaded
                  ) {

                    processAuthenticatedUser(
                      user,
                      loadedStudents,
                      loadedTeachers
                    );
                  }
                }
              );


            /*
             * ----------------------------------------------------
             * USERS SUBSCRIPTION
             * ----------------------------------------------------
             */

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


    /*
     * ============================================================
     * CLEANUP
     * ============================================================
     */

    return () => {

      isMounted =
        false;


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

  const loginAsAdmin =
    () => {

      setCurrentRole(
        'admin'
      );


      const profile:
        UserProfile = {

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


      if (
        firebaseUser
      ) {

        saveUserProfile(
          profile
        ).catch(
          console.error
        );
      }
    };


  /*
   * ============================================================
   * LOGIN AS STUDENT BY ID
   * ============================================================
   */

  const loginAsStudentById =
    (
      studentId: string
    ): boolean => {

      const cleanId =
        studentId.trim();


      const found =
        students.find(
          (student) =>
            student.studentId ===
            cleanId
        );


      if (
        found
      ) {

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
       * --------------------------------------------------------
       * ADMIN
       * --------------------------------------------------------
       */

      if (
        role === 'admin'
      ) {

        loginAsAdmin();

        return;
      }


      /*
       * --------------------------------------------------------
       * TEACHER
       * --------------------------------------------------------
       */

      if (
        role === 'teacher'
      ) {

        /*
         * Find the logged-in teacher by email.
         *
         * Do NOT use teachers[0].
         */

        const matchingTeacher =
          teachers.find(
            (teacher) =>
              teacher.email &&
              firebaseUser?.email &&
              teacher.email
                .trim()
                .toLowerCase() ===
              firebaseUser.email
                .trim()
                .toLowerCase()
          );


        if (
          matchingTeacher
        ) {

          setActiveTeacher(
            matchingTeacher
          );
        }


        return;
      }


      /*
       * --------------------------------------------------------
       * STUDENT
       * --------------------------------------------------------
       */

      if (
        role === 'student'
      ) {

        const matchingStudent =
          students.find(
            (student) =>
              student.email &&
              firebaseUser?.email &&
              student.email
                .trim()
                .toLowerCase() ===
              firebaseUser.email
                .trim()
                .toLowerCase()
          );


        if (
          matchingStudent
        ) {

          setActiveStudent(
            matchingStudent
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

      setCurrentRole(null);

      setCurrentUser(null);

      setActiveStudent(null);

      setActiveTeacher(null);

      setStudents([]);

      setTeachers([]);

      setUserProfiles([]);


      await signOutFromApp();
    };


  /*
   * ============================================================
   * SEED DATA
   * ============================================================
   */

  const seedData =
    async () => {

      setIsLoading(true);


      try {

        await seedInitialJMMSData();

      } catch (error) {

        console.error(
          '[AuthContext] Failed to seed data:',
          error
        );

        throw error;

      } finally {

        setIsLoading(false);
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

        userProfiles,

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
