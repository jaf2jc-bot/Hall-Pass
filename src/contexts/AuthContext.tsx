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
   * FIREBASE AUTHENTICATION + SCHOOL DATA
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
     * ------------------------------------------------------------
     * PROCESS AUTHENTICATED USER
     * ------------------------------------------------------------
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
          email.toLowerCase();


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
         * --------------------------------------------------------
         * CHECK FOR ADMIN
         * --------------------------------------------------------
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


          setIsLoading(false);

          return;
        }


        /*
         * --------------------------------------------------------
         * FIND TEACHER BY EMAIL
         * --------------------------------------------------------
         *
         * THIS IS THE IMPORTANT PART.
         *
         * We do NOT need to know the teacher's Firebase UID
         * ahead of time.
         *
         * We use their school email address to find the
         * teacher record.
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
         * --------------------------------------------------------
         * FIND STUDENT BY EMAIL
         * --------------------------------------------------------
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
         * --------------------------------------------------------
         * GET EXISTING USER PROFILE
         * --------------------------------------------------------
         */

        let profile =
          await getUserProfile(
            user.uid
          );


        /*
         * ========================================================
         * TEACHER FOUND
         * ========================================================
         */

        if (matchingTeacher) {

          console.log(
            '[AuthContext] Teacher recognized by email:',
            matchingTeacher.name
          );


          /*
           * The teacher is ALWAYS treated as a teacher
           * when their email exists in the Teachers collection.
           *
           * This also fixes an existing user profile that was
           * previously created as "student".
           */

          profile = {

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
           * Save the authenticated user.
           *
           * The Firebase UID belongs in the USERS profile.
           *
           * The teacher record can continue using the teacher's
           * email as its document ID.
           */

          await saveUserProfile(
            profile
          );


          if (!isMounted) {
            return;
          }


          setCurrentUser(
            profile
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
            '[AuthContext] Student recognized by email:',
            matchingStudent.firstName,
            matchingStudent.lastName
          );


          profile = {

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
            profile
          );


          if (!isMounted) {
            return;
          }


          setCurrentUser(
            profile
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
         * EXISTING USER WHO IS NOT IN TEACHERS/STUDENTS
         * ========================================================
         */

        if (profile) {

          console.log(
            '[AuthContext] Existing user profile found:',
            profile.email,
            profile.role
          );


          /*
           * Keep the existing role unless the user was identified
           * above as a teacher or student.
           */

          setCurrentUser(
            profile
          );

          setCurrentRole(
            profile.role
          );


          /*
           * Try to reconnect their student profile.
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


          /*
           * Try to reconnect their teacher profile.
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
          }


          setIsLoading(false);

          return;
        }


        /*
         * ========================================================
         * BRAND NEW USER
         * ========================================================
         *
         * They are not in Teachers and not in Students.
         *
         * Default them to student for safety.
         */

        console.log(
          '[AuthContext] New user. Defaulting to student.'
        );


        profile = {

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
          profile
        );


        if (!isMounted) {
          return;
        }


        setCurrentUser(
          profile
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
     * AUTH LISTENER
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
             * AUTHENTICATED
             * ----------------------------------------------------
             */

            console.log(
              '[AuthContext] Firebase authentication successful:',
              user.email
            );


            setIsLoading(true);


            /*
             * ----------------------------------------------------
             * LOAD STUDENTS
             * ----------------------------------------------------
             */

            let loadedStudents:
              Student[] = [];


            let loadedTeachers:
              Teacher[] = [];


            /*
             * Students subscription
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


                  setStudents(
                    loadedStudents
                  );


                  /*
                   * If teachers have already loaded,
                   * process the authenticated user.
                   */

                  if (
                    loadedTeachers.length > 0 ||
                    teacherListHasLoaded
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
             * Teachers subscription
             */

            let teacherListHasLoaded =
              false;


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


                  teacherListHasLoaded =
                    true;


                  setTeachers(
                    loadedTeachers
                  );


                  /*
                   * Process user AFTER teacher data is loaded.
                   *
                   * This is important because Firebase data may
                   * arrive after Google authentication.
                   */

                  processAuthenticatedUser(
                    user,
                    loadedStudents,
                    loadedTeachers
                  );
                }
              );


            /*
             * USERS COLLECTION
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

      isMounted = false;

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


      if (
        role === 'admin'
      ) {

        loginAsAdmin();

        return;
      }


      if (
        role === 'teacher'
      ) {

        if (
          activeTeacher
        ) {

          setActiveTeacher(
            activeTeacher
          );

        } else {

          /*
           * IMPORTANT:
           *
           * Do NOT randomly assign the first teacher anymore.
           *
           * A teacher must be matched to their own email.
           */

          const matchingTeacher =
            teachers.find(
              (teacher) =>
                teacher.email &&
                firebaseUser?.email &&
                teacher.email
                  .toLowerCase() ===
                firebaseUser.email
                  .toLowerCase()
            );


          if (
            matchingTeacher
          ) {

            setActiveTeacher(
              matchingTeacher
            );
          }
        }

        return;
      }


      if (
        role === 'student'
      ) {

        if (
          activeStudent
        ) {

          setActiveStudent(
            activeStudent
          );

        } else {

          const matchingStudent =
            students.find(
              (student) =>
                student.email &&
                firebaseUser?.email &&
                student.email
                  .toLowerCase() ===
                firebaseUser.email
                  .toLowerCase()
            );


          if (
            matchingStudent
          ) {

            setActiveStudent(
              matchingStudent
            );
          }
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
