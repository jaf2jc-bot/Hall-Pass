import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo
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
  getTeacherByEmail,
  getStudentByEmail,
  attachTeacherUid,
  addTeacher,
  addStudent,
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

// ============================================================
// ADMIN ALLOW-LIST
// ============================================================
//
// Exact-match only. Do NOT use .includes()/.startsWith() checks
// here — a substring match would let any account whose email
// happens to contain "admin" (e.g. a student email) be granted
// admin access.
//
// Add every real admin's full email address below.
// ============================================================

const ADMIN_EMAILS: string[] = [
  'jaf2jc@bearworks.jackson.sparcc.org',
  'admin@bearworks.jackson.sparcc.org'
];

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

  loginAsStudentById: (
    studentId: string
  ) => boolean;

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

  // ============================================================
  // MERGED STUDENT DIRECTORY (students collection + users collection)
  // ============================================================
  //
  // Normally every student-role user has a matching doc in the
  // `students` roster (self-provisioned at login). This merge is
  // a safety net for accounts that exist in `users` but, for
  // whatever reason (created before self-provisioning existed,
  // created by hand directly in Firestore, a failed provisioning
  // call, etc.), have no matching roster record — without this,
  // those people are invisible in every "select a student"
  // dropdown across the app even though they can log in fine.
  //
  // IMPORTANT: this must be declared AFTER both `students` and
  // `userProfiles` above, since its dependency array references
  // both. Declaring it earlier throws
  // "Cannot access '<var>' before initialization" — the
  // dependency array is evaluated immediately when useMemo() is
  // called, and `const` bindings are in the temporal dead zone
  // until their own declaration line runs.
  //
  // This does NOT create any new Firestore documents — it just
  // presents a synthetic Student object, built from their
  // UserProfile, everywhere the real roster is used.
  // ============================================================

  const mergedStudents =
    useMemo(() => {

      const combined =
        new Map<string, Student>();

      // Seed with the real, authoritative roster records first.
      for (const student of students) {
        combined.set(
          student.id,
          student
        );
      }

      const realStudentDocIds =
        new Set(
          students.map(
            (student) => student.id
          )
        );

      const realEmails =
        new Set(
          students
            .filter(
              (student) => !!student.email
            )
            .map(
              (student) =>
                student.email!.toLowerCase()
            )
        );

      for (const profile of userProfiles) {

        if (
          profile.role !== 'student'
        ) {
          continue;
        }

        // Already represented by a real roster doc — skip so we
        // never show the same person twice.
        if (
          profile.studentDocId &&
          realStudentDocIds.has(
            profile.studentDocId
          )
        ) {
          continue;
        }

        if (
          profile.email &&
          realEmails.has(
            profile.email.toLowerCase()
          )
        ) {
          continue;
        }

        const syntheticId =
          `user:${profile.uid}`;

        if (
          combined.has(syntheticId)
        ) {
          continue;
        }

        const nameParts =
          (
            profile.displayName ||
            profile.email.split('@')[0] ||
            'Student'
          )
            .trim()
            .split(/\s+/);

        const firstName =
          nameParts[0] ||
          'Student';

        const lastName =
          nameParts
            .slice(1)
            .join(' ') ||
          '';

        combined.set(
          syntheticId,
          {

            id:
              syntheticId,

            studentId:
              profile.studentId ||
              profile.uid
                .slice(0, 8)
                .toUpperCase(),

            firstName,

            lastName,

            grade:
              profile.grade ?? 0,

            active:
              true,

            email:
              profile.email,

            homeroom:
              profile.room
          }
        );
      }

      return Array.from(
        combined.values()
      ).sort(
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

    }, [students, userProfiles]);


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
        // CHECK EMAIL
        // --------------------------------------------------------

        const email =
          (
            user.email ||
            ''
          ).trim();

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

        // --------------------------------------------------------
        // START SCHOOL DATA LISTENERS
        // --------------------------------------------------------

        startRosterSubscriptions();

        // --------------------------------------------------------
        // GET EXISTING USER PROFILE
        // --------------------------------------------------------

        let profile =
          await getUserProfile(
            user.uid
          );

        // ========================================================
        // ADMIN ACCOUNT
        // ========================================================

        const isAdminAccount =
          ADMIN_EMAILS.includes(
            emailLower
          );

        if (
          isAdminAccount
        ) {

          profile = {

            uid:
              user.uid,

            email:
              email,

            displayName:
              user.displayName ||
              email.split('@')[0] ||
              'JMMS Administrator',

            photoURL:
              user.photoURL ||
              undefined,

            role:
              'admin',

            room:
              'Main Administrative Office'
          };

          // ------------------------------------------------------
          // LINK (OR CREATE) A TEACHERS RECORD FOR THIS ADMIN
          // ------------------------------------------------------
          //
          // The student "request a hall pass" dropdown reads from
          // the `teachers` collection, not `users`. Without a
          // matching teachers doc, students have no way to select
          // the admin as the recipient of a request. This block
          // finds an existing teachers doc for this email, or
          // creates one, and stores its id on the admin's profile
          // as teacherDocId so subscribeToTeacherHallPassRequests
          // can be called with it later.
          // ------------------------------------------------------

          try {

            let adminTeacherRecord =
              await getTeacherByEmail(
                emailLower
              );

            if (
              !adminTeacherRecord
            ) {

              console.log(
                '[AuthContext] No teachers record found for admin. Creating one.'
              );

              const newTeacherId =
                await addTeacher({

                  name:
                    profile.displayName,

                  room:
                    profile.room ||
                    'Main Administrative Office',

                  subject:
                    'Administration',

                  email:
                    emailLower,

                  active:
                    true,

                  department:
                    'Administration'
                });

              adminTeacherRecord = {

                id:
                  newTeacherId,

                name:
                  profile.displayName,

                room:
                  profile.room ||
                  'Main Administrative Office',

                subject:
                  'Administration',

                email:
                  emailLower,

                active:
                  true,

                department:
                  'Administration'
              };
            }

            await attachTeacherUid(
              adminTeacherRecord.id,
              user.uid
            );

            profile = {

              ...profile,

              teacherDocId:
                adminTeacherRecord.id,

              room:
                adminTeacherRecord.room ||
                profile.room
            };

          } catch (
            teacherLinkError
          ) {

            console.error(
              '[AuthContext] Failed to link admin to a teachers record:',
              teacherLinkError
            );
          }

          await saveUserProfile(
            profile
          );
        }

        // ========================================================
        // EXISTING USER
        // ========================================================

        else if (
          profile
        ) {

          const matchingTeacher =
            await getTeacherByEmail(
              emailLower
            );

          if (
            matchingTeacher
          ) {

            console.log(
              '[AuthContext] Teacher found by email:',
              matchingTeacher.name
            );

            await attachTeacherUid(
              matchingTeacher.id,
              user.uid
            );

            profile = {

              ...profile,

              uid:
                user.uid,

              email:
                email,

              displayName:
                profile.displayName ||
                matchingTeacher.name,

              role:
                'teacher',

              teacherDocId:
                matchingTeacher.id,

              room:
                matchingTeacher.room
            };

            await saveUserProfile(
              profile
            );
          }
        }

        // ========================================================
        // NEW USER
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
          // CHECK TEACHER BY EMAIL
          // ------------------------------------------------------

          const matchingTeacher =
            await getTeacherByEmail(
              emailLower
            );

          if (
            matchingTeacher
          ) {

            console.log(
              '[AuthContext] NEW USER IS A TEACHER:',
              matchingTeacher.name
            );

            role =
              'teacher';

            teacherDocId =
              matchingTeacher.id;

            room =
              matchingTeacher.room;

            await attachTeacherUid(
              matchingTeacher.id,
              user.uid
            );
          }

          // ------------------------------------------------------
          // CHECK STUDENT BY EMAIL
          // ------------------------------------------------------
          //
          // Queries Firestore directly (not the local `students`
          // array) since that array is populated by an async
          // subscription and may still be empty/stale the very
          // first time a brand-new user signs in.
          // ------------------------------------------------------

          let matchingStudent =
            role !== 'teacher'
              ? await getStudentByEmail(
                  emailLower
                )
              : null;

          // ------------------------------------------------------
          // SELF-PROVISION A STUDENT RECORD
          // ------------------------------------------------------
          //
          // No manually pre-built roster entry exists for this
          // person, and they're not a recognized teacher either.
          // Rather than requiring an admin to hand-enter every
          // student (160, 1,000, whatever the enrollment is),
          // auto-create their students doc from what Google
          // already told us: name and email. Grade/homeroom are
          // left as placeholders — an admin can correct those
          // later from the student directory if needed, but the
          // person is immediately visible and selectable in every
          // dropdown either way.
          // ------------------------------------------------------

          if (
            !matchingStudent &&
            role !== 'teacher'
          ) {

            console.log(
              '[AuthContext] No roster record found. Self-provisioning a student record for:',
              email
            );

            const nameParts =
              (
                user.displayName ||
                email.split('@')[0] ||
                'New Student'
              )
                .trim()
                .split(/\s+/);

            const firstName =
              nameParts[0] ||
              'New';

            const lastName =
              nameParts
                .slice(1)
                .join(' ') ||
              'Student';

            // Best-effort human-readable id. Schools that already
            // put an ID number in front of the "@" in the email
            // (e.g. 80124@school.org) get that number for free;
            // otherwise this falls back to the uid so it's always
            // unique, and an admin can overwrite it later.
            const emailLocalPart =
              email.split('@')[0];

            const fallbackStudentId =
              /^[0-9]+$/.test(
                emailLocalPart
              )
                ? emailLocalPart
                : user.uid.slice(0, 8).toUpperCase();

            try {

              const newStudentDocId =
                await addStudent({

                  studentId:
                    fallbackStudentId,

                  firstName,

                  lastName,

                  grade:
                    0,

                  active:
                    true,

                  // Stored lowercased, consistent with every
                  // other email field/query in this codebase
                  // (getTeacherByEmail, getStudentByEmail, etc).
                  // The Firestore rule lowercases its side of
                  // the comparison to match.
                  email:
                    emailLower
                });

              matchingStudent = {

                id:
                  newStudentDocId,

                studentId:
                  fallbackStudentId,

                firstName,

                lastName,

                grade:
                  0,

                active:
                  true,

                email:
                  emailLower
              };

            } catch (
              selfProvisionError
            ) {

              console.error(
                '[AuthContext] Failed to self-provision student record:',
                selfProvisionError
              );
            }
          }

          if (
            matchingStudent &&
            role !== 'teacher'
          ) {

            console.log(
              '[AuthContext] NEW USER IS A STUDENT:',
              matchingStudent.firstName,
              matchingStudent.lastName
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
          // CREATE USER PROFILE
          // ------------------------------------------------------

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

            role,

            ...(studentId
              ? {
                  studentId
                }
              : {}),

            ...(studentDocId
              ? {
                  studentDocId
                }
              : {}),

            ...(teacherDocId
              ? {
                  teacherDocId
                }
              : {}),

            ...(grade !== undefined
              ? {
                  grade
                }
              : {}),

            ...(room
              ? {
                  room
                }
              : {})
          };

          console.log(
            '[AuthContext] Creating user profile:',
            profile
          );

          await saveUserProfile(
            profile
          );
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

          } else {

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

          // --------------------------------------------------------
          // IMPORTANT:
          //
          // activeTeacher.id must be the `teachers` collection
          // document id — NOT the Firebase Auth uid — because
          // that's the id students pick from the "Who is your
          // current teacher?" dropdown, and it's what gets stored
          // as `teacherId` on studentHallPassRequests documents.
          //
          // subscribeToTeacherHallPassRequests(activeTeacher.id)
          // filters by that same field, so if this ever falls
          // back to profile.uid, incoming requests silently never
          // match and nothing shows up on the dashboard.
          // --------------------------------------------------------

          let matchedAdminTeacher:
            Teacher | undefined;

          if (
            profile.teacherDocId
          ) {

            matchedAdminTeacher =
              teachers.find(
                (teacher) =>
                  teacher.id ===
                  profile.teacherDocId
              );
          }

          if (
            !matchedAdminTeacher
          ) {

            matchedAdminTeacher =
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
            matchedAdminTeacher
          ) {

            setActiveTeacher(
              matchedAdminTeacher
            );

          } else {

            // No matching teachers doc found yet (e.g. teachers
            // list hasn't finished loading, or the auto-create
            // step failed). Falls back to profile.teacherDocId if
            // we have it so the id is still correct once the
            // teachers list catches up on the next render.
            console.warn(
              '[AuthContext] No matching teachers record found for admin — incoming hall pass requests may not appear until this resolves.'
            );

            setActiveTeacher({

              id:
                profile.teacherDocId ||
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

          /*
           * IMPORTANT:
           *
           * Admins do NOT become students.
           *
           * We simply give the admin a test student so the
           * StudentDashboard can be previewed and tested.
           *
           * The student is selected again below whenever the
           * roster listener finishes loading.
           */
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
  // ADMIN TEST STUDENT
  // ============================================================

  /*
   * Once the student roster is loaded, automatically give the
   * admin a test student if one has not already been selected.
   *
   * This runs separately from authentication because the roster
   * is loaded by a real-time Firestore listener.
   */

  useEffect(() => {

    if (
      currentRole !== 'admin'
    ) {
      return;
    }

    if (
      students.length === 0
    ) {
      return;
    }

    if (
      !activeStudent
    ) {

      console.log(
        '[AuthContext] Admin test mode student selected:',
        students[0].firstName,
        students[0].lastName,
        students[0].studentId
      );

      setActiveStudent(
        students[0]
      );
    }

  }, [
    currentRole,
    students,
    activeStudent
  ]);

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

      /*
       * If the roster has already loaded, immediately select
       * the first student for admin test mode.
       */

      if (
        students.length > 0
      ) {

        setActiveStudent(
          students[0]
        );
      }

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

        } else if (
          teachers.length > 0
        ) {

          setActiveTeacher(
            teachers[0]
          );
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

        setRole,

        // Exposed as `students` (same key every consumer already
        // uses) but backed by the merged roster+users list so
        // orphaned user-only accounts still show up everywhere.
        students:
          mergedStudents,

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
