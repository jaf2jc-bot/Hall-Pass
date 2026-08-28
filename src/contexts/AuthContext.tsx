import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

import {
  UserProfile,
  UserRole,
  Student,
  Teacher,
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
  ALLOWED_DOMAIN,
} from '../lib/firebase';

import {
  onAuthStateChanged,
  User,
} from 'firebase/auth';


// ============================================================
// AUTH CONTEXT TYPE
// ============================================================

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


// ============================================================
// CONTEXT
// ============================================================

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );


// ============================================================
// AUTH PROVIDER
// ============================================================

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {

  // ==========================================================
  // STATE
  // ==========================================================

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


  // ==========================================================
  // IMPORTANT:
  // KEEP CURRENT ROSTERS IN REFS
  //
  // This prevents the authentication callback from using the
  // OLD empty arrays captured when the component first mounted.
  // ==========================================================

  const studentsRef =
    useRef<Student[]>([]);

  const teachersRef =
    useRef<Teacher[]>([]);


  // ==========================================================
  // KEEP TRACK OF ROSTER SUBSCRIPTIONS
  // ==========================================================

  const unsubStudentsRef =
    useRef<(() => void) | null>(null);

  const unsubTeachersRef =
    useRef<(() => void) | null>(null);


  // ==========================================================
  // KEEP TRACK OF WHETHER WE ARE STILL MOUNTED
  // ==========================================================

  const mountedRef =
    useRef(true);


  // ==========================================================
  // CLEAN UP ON UNMOUNT
  // ==========================================================

  useEffect(() => {

    mountedRef.current = true;

    return () => {

      mountedRef.current = false;

      if (unsubStudentsRef.current) {
        unsubStudentsRef.current();
        unsubStudentsRef.current = null;
      }

      if (unsubTeachersRef.current) {
        unsubTeachersRef.current();
        unsubTeachersRef.current = null;
      }
    };

  }, []);


  // ============================================================
  // PROCESS AUTHENTICATED USER
  // ============================================================

  const processAuthenticatedUser =
    async (
      user: User
    ): Promise<void> => {

      if (!mountedRef.current) {
        return;
      }


      console.log(
        '[AuthContext] Processing authenticated user:',
        user.email
      );


      setFirebaseUser(user);

      setAuthError(null);


      // ========================================================
      // EMAIL
      // ========================================================

      const email =
        user.email || '';

      const emailLower =
        email.toLowerCase();

      const emailDomain =
        email.split('@')[1]?.toLowerCase() || '';


      // ========================================================
      // ADMIN ACCOUNT
      // ========================================================

      const isAdminAccount =
        emailLower ===
          'jaf2jc@bearworks.jackson.sparcc.org' ||

        emailLower.includes('admin') ||

        emailLower.startsWith('principal');


      // ========================================================
      // DOMAIN CHECK
      //
      // Admin account is explicitly allowed even if domain
      // settings change.
      // ========================================================

      const isAuthorizedDomain =
        emailDomain ===
          ALLOWED_DOMAIN.toLowerCase() ||

        emailLower ===
          'jaf2jc@bearworks.jackson.sparcc.org';


      if (
        !isAuthorizedDomain &&
        !isAdminAccount
      ) {

        const errorMessage =
          `Access restricted: Please sign in with your Jackson Memorial Middle School account (@${ALLOWED_DOMAIN}).`;

        console.error(
          '[AuthContext]',
          errorMessage
        );

        setAuthError(
          errorMessage
        );

        try {
          await signOutFromApp();
        } catch (error) {
          console.error(
            '[AuthContext] Error signing out unauthorized user:',
            error
          );
        }

        return;
      }


      // ========================================================
      // ADMIN
      //
      // Admin does not need to wait for the teacher/student
      // roster to determine their role.
      // ========================================================

      if (isAdminAccount) {

        const adminProfile: UserProfile = {

          uid:
            user.uid,

          email:
            user.email || '',

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
            'Main Administrative Office',
        };


        try {

          await saveUserProfile(
            adminProfile
          );

        } catch (error) {

          console.error(
            '[AuthContext] Could not save admin profile:',
            error
          );
        }


        if (!mountedRef.current) {
          return;
        }


        setCurrentUser(
          adminProfile
        );

        setCurrentRole(
          'admin'
        );


        setActiveStudent(
          null
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
            'Administration',
        });


        setIsLoading(false);

        return;
      }


      // ========================================================
      // GET EXISTING PROFILE
      // ========================================================

      let profile =
        await getUserProfile(
          user.uid
        );


      // ========================================================
      // CURRENT ROSTERS
      //
      // ALWAYS READ FROM REFS, NOT FROM THE STATE VARIABLES.
      // ========================================================

      const currentStudents =
        studentsRef.current;

      const currentTeachers =
        teachersRef.current;


      console.log(
        '[AuthContext] Current student roster:',
        currentStudents.length
      );

      console.log(
        '[AuthContext] Current teacher roster:',
        currentTeachers.length
      );


      // ========================================================
      // FIND MATCHING TEACHER
      // ========================================================

      const matchingTeacher =
        currentTeachers.find(
          (teacher) =>
            !!teacher.email &&
            teacher.email
              .toLowerCase()
              .trim() ===
            emailLower.trim()
        );


      // ========================================================
      // FIND MATCHING STUDENT
      // ========================================================

      const matchingStudent =
        currentStudents.find(
          (student) =>
            !!student.email &&
            student.email
              .toLowerCase()
              .trim() ===
            emailLower.trim()
        );


      // ========================================================
      // EXISTING PROFILE
      //
      // If the roster identifies this person differently from
      // an old profile, update the profile automatically.
      // ========================================================

      if (profile) {

        let profileChanged =
          false;


        // ------------------------------------------------------
        // Teacher roster match
        // ------------------------------------------------------

        if (matchingTeacher) {

          if (
            profile.role !==
            'teacher'
          ) {

            profile = {
              ...profile,
              role: 'teacher',
            };

            profileChanged = true;
          }


          if (
            profile.teacherDocId !==
            matchingTeacher.id
          ) {

            profile = {
              ...profile,
              teacherDocId:
                matchingTeacher.id,
            };

            profileChanged = true;
          }


          if (
            profile.room !==
            matchingTeacher.room
          ) {

            profile = {
              ...profile,
              room:
                matchingTeacher.room,
            };

            profileChanged = true;
          }
        }


        // ------------------------------------------------------
        // Student roster match
        // ------------------------------------------------------

        if (matchingStudent) {

          if (
            profile.role !==
            'student'
          ) {

            profile = {
              ...profile,
              role: 'student',
            };

            profileChanged = true;
          }


          if (
            profile.studentId !==
            matchingStudent.studentId
          ) {

            profile = {
              ...profile,
              studentId:
                matchingStudent.studentId,
            };

            profileChanged = true;
          }


          if (
            profile.studentDocId !==
            matchingStudent.id
          ) {

            profile = {
              ...profile,
              studentDocId:
                matchingStudent.id,
            };

            profileChanged = true;
          }


          if (
            profile.grade !==
            matchingStudent.grade
          ) {

            profile = {
              ...profile,
              grade:
                matchingStudent.grade,
            };

            profileChanged = true;
          }


          if (
            profile.room !==
            matchingStudent.homeroom
          ) {

            profile = {
              ...profile,
              room:
                matchingStudent.homeroom,
            };

            profileChanged = true;
          }
        }


        // ------------------------------------------------------
        // Save changes
        // ------------------------------------------------------

        if (profileChanged) {

          try {

            await saveUserProfile(
              profile
            );

          } catch (error) {

            console.error(
              '[AuthContext] Could not update user profile:',
              error
            );
          }
        }
      }


      // ========================================================
      // NEW USER
      //
      // This is where automatic teacher authorization happens.
      // ========================================================

      else {

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


        // ------------------------------------------------------
        // TEACHER MATCH
        // ------------------------------------------------------

        if (matchingTeacher) {

          console.log(
            '[AuthContext] Teacher matched by email:',
            matchingTeacher.name
          );


          role =
            'teacher';


          teacherDocId =
            matchingTeacher.id;


          room =
            matchingTeacher.room;
        }


        // ------------------------------------------------------
        // STUDENT MATCH
        //
        // Student takes priority if an email somehow appears
        // in both rosters.
        // ------------------------------------------------------

        if (matchingStudent) {

          console.log(
            '[AuthContext] Student matched by email:',
            `${matchingStudent.firstName} ${matchingStudent.lastName}`
          );


          role =
            'student';


          studentId =
            matchingStudent.studentId;


          studentDocId =
            matchingStudent.id;


          grade =
            matchingStudent.grade;


          room =
            matchingStudent.homeroom;
        }


        // ------------------------------------------------------
        // CREATE PROFILE
        // ------------------------------------------------------

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
            ? {
                studentId,
              }
            : {}),

          ...(studentDocId
            ? {
                studentDocId,
              }
            : {}),

          ...(teacherDocId
            ? {
                teacherDocId,
              }
            : {}),

          ...(grade !== undefined
            ? {
                grade,
              }
            : {}),

          ...(room
            ? {
                room,
              }
            : {}),
        };


        console.log(
          '[AuthContext] Creating new profile:',
          {
            email:
              profile.email,

            role:
              profile.role,

            studentId:
              profile.studentId,

            teacherDocId:
              profile.teacherDocId,
          }
        );


        try {

          await saveUserProfile(
            profile
          );

        } catch (error) {

          console.error(
            '[AuthContext] Could not save new profile:',
            error
          );
        }
      }


      // ========================================================
      // SET CURRENT USER
      // ========================================================

      if (!mountedRef.current) {
        return;
      }


      setCurrentUser(
        profile
      );


      setCurrentRole(
        profile.role
      );


      // ========================================================
      // ACTIVE STUDENT
      // ========================================================

      if (
        profile.role ===
        'student'
      ) {

        let matchedStudent:
          Student | undefined;


        // ------------------------------------------------------
        // Match by student ID
        // ------------------------------------------------------

        if (
          profile.studentId
        ) {

          matchedStudent =
            studentsRef.current.find(
              (student) =>
                student.studentId ===
                profile.studentId
            );
        }


        // ------------------------------------------------------
        // Match by document ID
        // ------------------------------------------------------

        if (
          !matchedStudent &&
          profile.studentDocId
        ) {

          matchedStudent =
            studentsRef.current.find(
              (student) =>
                student.id ===
                profile.studentDocId
            );
        }


        // ------------------------------------------------------
        // Match by email
        // ------------------------------------------------------

        if (
          !matchedStudent
        ) {

          matchedStudent =
            studentsRef.current.find(
              (student) =>
                student.email &&
                profile.email &&
                student.email
                  .toLowerCase()
                  .trim() ===
                profile.email
                  .toLowerCase()
                  .trim()
            );
        }


        if (matchedStudent) {

          console.log(
            '[AuthContext] Active student:',
            matchedStudent.firstName,
            matchedStudent.lastName
          );


          setActiveStudent(
            matchedStudent
          );

        } else {

          console.warn(
            '[AuthContext] Student profile exists but no roster match was found.'
          );


          setActiveStudent(
            null
          );
        }


        setActiveTeacher(
          null
        );
      }


      // ========================================================
      // ACTIVE TEACHER
      // ========================================================

      if (
        profile.role ===
        'teacher'
      ) {

        let matchedTeacher:
          Teacher | undefined;


        // ------------------------------------------------------
        // Match by teacher document ID
        // ------------------------------------------------------

        if (
          profile.teacherDocId
        ) {

          matchedTeacher =
            teachersRef.current.find(
              (teacher) =>
                teacher.id ===
                profile.teacherDocId
            );
        }


        // ------------------------------------------------------
        // Match by email
        // ------------------------------------------------------

        if (
          !matchedTeacher
        ) {

          matchedTeacher =
            teachersRef.current.find(
              (teacher) =>
                teacher.email &&
                profile.email &&
                teacher.email
                  .toLowerCase()
                  .trim() ===
                profile.email
                  .toLowerCase()
                  .trim()
            );
        }


        if (matchedTeacher) {

          console.log(
            '[AuthContext] Active teacher:',
            matchedTeacher.name
          );


          setActiveTeacher(
            matchedTeacher
          );

        } else {

          console.warn(
            '[AuthContext] Teacher profile exists but no roster match was found.'
          );


          setActiveTeacher(
            null
          );
        }


        setActiveStudent(
          null
        );
      }


      // ========================================================
      // FINISHED
      // ========================================================

      setIsLoading(
        false
      );
    };


  // ============================================================
  // START ROSTER LISTENERS
  //
  // CRITICAL:
  // These are NOT started until Firebase says the user is
  // authenticated.
  // ============================================================

  const startRosterSubscriptions =
    () => {

      // --------------------------------------------------------
      // Prevent duplicate listeners
      // --------------------------------------------------------

      if (
        unsubStudentsRef.current ||
        unsubTeachersRef.current
      ) {

        return;
      }


      console.log(
        '[AuthContext] Starting authenticated roster subscriptions.'
      );


      // ========================================================
      // STUDENTS
      // ========================================================

      unsubStudentsRef.current =
        subscribeToStudents(
          (studentList) => {

            if (!mountedRef.current) {
              return;
            }


            console.log(
              '[AuthContext] Students loaded:',
              studentList.length
            );


            studentsRef.current =
              studentList;


            setStudents(
              studentList
            );
          }
        );


      // ========================================================
      // TEACHERS
      // ========================================================

      unsubTeachersRef.current =
        subscribeToTeachers(
          (teacherList) => {

            if (!mountedRef.current) {
              return;
            }


            console.log(
              '[AuthContext] Teachers loaded:',
              teacherList.length
            );


            teachersRef.current =
              teacherList;


            setTeachers(
              teacherList
            );
          }
        );
    };


  // ============================================================
  // FIREBASE AUTH LISTENER
  // ============================================================

  useEffect(() => {

    console.log(
      '[AuthContext] Starting Firebase auth listener.'
    );


    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        async (user) => {

          try {

            // ==================================================
            // LOGGED OUT
            // ==================================================

            if (
              !user ||
              user.isAnonymous
            ) {

              console.log(
                '[AuthContext] No authenticated user.'
              );


              setFirebaseUser(
                null
              );

              setCurrentUser(
                null
              );

              setCurrentRole(
                null
              );

              setActiveStudent(
                null
              );

              setActiveTeacher(
                null
              );

              studentsRef.current =
                [];

              teachersRef.current =
                [];

              setStudents(
                []
              );

              setTeachers(
                []
              );


              setIsLoading(
                false
              );


              return;
            }


            // ==================================================
            // AUTHENTICATED
            // ==================================================

            console.log(
              '[AuthContext] Firebase user authenticated:',
              user.email
            );


            setFirebaseUser(
              user
            );


            setIsLoading(
              true
            );


            // --------------------------------------------------
            // IMPORTANT:
            // Start Firestore roster listeners ONLY NOW.
            // --------------------------------------------------

            startRosterSubscriptions();


            // --------------------------------------------------
            // Give the Firestore listeners a chance to establish
            // their initial snapshots before trying to match a
            // brand-new teacher/student.
            //
            // Existing profiles are still processed immediately.
            // --------------------------------------------------

            let attempts = 0;

            const waitForRoster =
              async (): Promise<void> => {

                // ------------------------------------------------
                // Existing admin account does not need roster.
                // ------------------------------------------------

                const email =
                  user.email?.toLowerCase() || '';


                const isAdminAccount =
                  email ===
                    'jaf2jc@bearworks.jackson.sparcc.org' ||

                  email.includes('admin') ||

                  email.startsWith('principal');


                if (isAdminAccount) {

                  await processAuthenticatedUser(
                    user
                  );

                  return;
                }


                // ------------------------------------------------
                // Existing profile can be processed even while
                // the roster is loading.
                // ------------------------------------------------

                const existingProfile =
                  await getUserProfile(
                    user.uid
                  );


                if (
                  existingProfile ||
                  studentsRef.current.length > 0 ||
                  teachersRef.current.length > 0
                ) {

                  await processAuthenticatedUser(
                    user
                  );

                  return;
                }


                // ------------------------------------------------
                // Wait for initial roster snapshot.
                //
                // 20 attempts x 250ms = 5 seconds maximum.
                // ------------------------------------------------

                if (
                  attempts < 20
                ) {

                  attempts++;

                  await new Promise(
                    (resolve) =>
                      setTimeout(
                        resolve,
                        250
                      )
                  );


                  await waitForRoster();

                  return;
                }


                // ------------------------------------------------
                // If the roster is genuinely empty, still allow
                // the user to authenticate.
                // ------------------------------------------------

                console.warn(
                  '[AuthContext] Roster did not load within 5 seconds. Continuing authentication.'
                );


                await processAuthenticatedUser(
                  user
                );
              };


            await waitForRoster();

          } catch (error) {

            console.error(
              '[AuthContext] Authentication processing error:',
              error
            );


            if (
              mountedRef.current
            ) {

              setAuthError(
                error instanceof Error
                  ? error.message
                  : 'There was a problem loading your account. Please try signing in again.'
              );


              setIsLoading(
                false
              );
            }
          }
        }
      );


    return () => {

      unsubscribeAuth();

    };

  }, []);


  // ============================================================
  // GOOGLE LOGIN
  // ============================================================

  const loginWithGoogle =
    async (): Promise<boolean> => {

      try {

        setIsLoading(
          true
        );

        setAuthError(
          null
        );


        await signInWithGoogle();


        /*
         * onAuthStateChanged handles the rest.
         */

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


        setIsLoading(
          false
        );


        return false;
      }
    };


  // ============================================================
  // SELECT STUDENT
  // ============================================================

  const selectStudent =
    (student: Student) => {

      setActiveStudent(
        student
      );
    };


  // ============================================================
  // SELECT TEACHER
  // ============================================================

  const selectTeacher =
    (teacher: Teacher) => {

      setActiveTeacher(
        teacher
      );
    };


  // ============================================================
  // LOGIN AS ADMIN
  // ============================================================

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
          'jaf2jc@bearworks.jackson.sparcc.org',

        displayName:
          firebaseUser?.displayName ||
          'Principal / Admin Office',

        photoURL:
          firebaseUser?.photoURL ||
          undefined,

        role:
          'admin',

        room:
          'Main Office',
      };


      setCurrentUser(
        profile
      );


      setActiveStudent(
        null
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
          'Administration',
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


  // ============================================================
  // LOGIN AS STUDENT BY ID
  // ============================================================

  const loginAsStudentById =
    (
      studentId: string
    ): boolean => {

      const cleanId =
        studentId.trim();


      const found =
        studentsRef.current.find(
          (student) =>
            student.studentId ===
            cleanId
        );


      if (found) {

        selectStudent(
          found
        );


        setCurrentRole(
          'student'
        );


        return true;
      }


      return false;
    };


  // ============================================================
  // SET ROLE
  // ============================================================

  const setRole =
    (
      role: UserRole
    ) => {

      setCurrentRole(
        role
      );


      // --------------------------------------------------------
      // ADMIN
      // --------------------------------------------------------

      if (
        role === 'admin'
      ) {

        loginAsAdmin();

        return;
      }


      // --------------------------------------------------------
      // TEACHER
      // --------------------------------------------------------

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
          teachersRef.current.length > 0
        ) {

          setActiveTeacher(
            teachersRef.current[0]
          );
        }

        return;
      }


      // --------------------------------------------------------
      // STUDENT
      // --------------------------------------------------------

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
          studentsRef.current.length > 0
        ) {

          setActiveStudent(
            studentsRef.current[0]
          );
        }

        return;
      }
    };


  // ============================================================
  // LOGOUT
  // ============================================================

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

      setFirebaseUser(
        null
      );


      setStudents(
        []
      );

      setTeachers(
        []
      );


      studentsRef.current =
        [];

      teachersRef.current =
        [];


      /*
       * Stop roster listeners.
       */

      if (
        unsubStudentsRef.current
      ) {

        unsubStudentsRef.current();

        unsubStudentsRef.current =
          null;
      }


      if (
        unsubTeachersRef.current
      ) {

        unsubTeachersRef.current();

        unsubTeachersRef.current =
          null;
      }


      await signOutFromApp();
    };


  // ============================================================
  // SEED DATA
  // ============================================================

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


  // ============================================================
  // PROVIDER
  // ============================================================

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

        seedData,
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


  if (!context) {

    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }


  return context;
};
