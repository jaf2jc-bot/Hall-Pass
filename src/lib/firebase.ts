import { initializeApp, getApps, getApp } from 'firebase/app';

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';

import firebaseConfigData from '../../firebase-applet-config.json';

import {
  HallPass,
  Student,
  Teacher,
  DestinationType,
  UserProfile,
  UserRole,
  ConflictPair,
  StudentRequest
} from '../types';

import {
  INITIAL_JMMS_STUDENTS,
  INITIAL_JMMS_TEACHERS
} from './seedData';


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();


// Use designated Firestore database if supplied.
export const db =
  firebaseConfigData.firestoreDatabaseId
    ? getFirestore(
        app,
        firebaseConfigData.firestoreDatabaseId
      )
    : getFirestore(app);

export const auth = getAuth(app);


// ============================================================
// COLLECTION NAMES
// ============================================================

export const USERS_COLLECTION = 'users';
export const STUDENTS_COLLECTION = 'students';
export const TEACHERS_COLLECTION = 'teachers';
export const HALL_PASSES_COLLECTION = 'hallPasses';
export const CONFLICT_PAIRS_COLLECTION = 'conflictPairs';
export const STUDENT_REQUESTS_COLLECTION = 'studentRequests';


// ============================================================
// GOOGLE WORKSPACE DOMAIN
// ============================================================

export const ALLOWED_DOMAIN =
  'bearworks.jackson.sparcc.org';


// ============================================================
// AUTHENTICATION
// ============================================================

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    hd: ALLOWED_DOMAIN,
    prompt: 'select_account'
  });

  const result =
    await signInWithPopup(auth, provider);

  return result.user;
}


export async function signOutFromApp(): Promise<void> {
  await signOut(auth);
}


/**
 * Returns the currently authenticated Firebase user.
 *
 * IMPORTANT:
 * We no longer silently create an anonymous user.
 *
 * Your Firestore data is intended to be accessed by
 * authenticated JMMS users. Anonymous authentication can
 * cause Firestore security rules to reject roster reads.
 */
export async function ensureAuthenticated(): Promise<User> {
  // Already authenticated.
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve, reject) => {
    let finished = false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (finished) return;

          finished = true;
          unsubscribe();

          if (user) {
            resolve(user);
          } else {
            reject(
              new Error(
                'You must be signed in to access JMMS data.'
              )
            );
          }
        },
        (error) => {
          if (finished) return;

          finished = true;
          unsubscribe();
          reject(error);
        }
      );
  });
}


/**
 * Checks whether a Firebase user belongs to the
 * approved Google Workspace domain.
 */
export function isAllowedDomain(
  user: User | null
): boolean {
  if (!user?.email) {
    return false;
  }

  return user.email
    .toLowerCase()
    .endsWith(`@${ALLOWED_DOMAIN}`);
}


// ============================================================
// USER PROFILES
// ============================================================

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(
      db,
      USERS_COLLECTION,
      uid
    );

    const snap =
      await getDoc(userDocRef);

    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    return null;

  } catch (err) {
    console.error(
      'Error fetching user profile:',
      err
    );

    return null;
  }
}


export async function saveUserProfile(
  profile: UserProfile
): Promise<void> {

  const userDocRef = doc(
    db,
    USERS_COLLECTION,
    profile.uid
  );

  await setDoc(
    userDocRef,
    {
      ...profile,
      updatedAt: Date.now()
    },
    {
      merge: true
    }
  );
}


/**
 * Subscribe to ALL user profiles.
 *
 * These are authorization/application users.
 *
 * IMPORTANT:
 * This is NOT the student/teacher roster.
 *
 * TeacherDashboard can use users where:
 *
 * role === 'teacher'
 *
 * while the actual teacher roster continues to come
 * from the teachers collection.
 */
export function subscribeToUserProfiles(
  callback: (users: UserProfile[]) => void
) {
  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      unsubscribeSnapshot =
        onSnapshot(
          collection(
            db,
            USERS_COLLECTION
          ),

          (snapshot) => {

            const list: UserProfile[] = [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data();

                list.push({
                  ...(data as UserProfile),

                  uid:
                    data.uid ||
                    docSnap.id,

                  email:
                    data.email || '',

                  displayName:
                    data.displayName ||
                    data.email ||
                    'JMMS User',

                  role:
                    data.role ||
                    'student'
                });
              }
            );

            list.sort(
              (a, b) =>
                a.displayName.localeCompare(
                  b.displayName
                )
            );

            callback(list);
          },

          (err) => {
            console.error(
              'Error subscribing to user profiles:',
              err
            );

            callback([]);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading user profiles:',
        err
      );

      callback([]);
    });


  return () => {
    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


export async function updateUserRole(
  uid: string,
  role: UserRole
): Promise<void> {

  await ensureAuthenticated();

  const userDocRef = doc(
    db,
    USERS_COLLECTION,
    uid
  );

  await setDoc(
    userDocRef,
    {
      role,
      updatedAt: Date.now()
    },
    {
      merge: true
    }
  );
}


// ============================================================
// STUDENT CONFLICT PAIRS
// ============================================================

export async function addConflictPair(
  student1: Student,
  student2: Student
): Promise<string> {

  await ensureAuthenticated();

  if (
    student1.studentId ===
    student2.studentId
  ) {
    throw new Error(
      'A student cannot be paired with themselves.'
    );
  }

  const [first, second] =
    student1.studentId <
    student2.studentId
      ? [student1, student2]
      : [student2, student1];

  const existingQuery = query(
    collection(
      db,
      CONFLICT_PAIRS_COLLECTION
    ),
    where(
      'studentId1',
      '==',
      first.studentId
    ),
    where(
      'studentId2',
      '==',
      second.studentId
    )
  );

  const existing =
    await getDocs(existingQuery);

  if (!existing.empty) {
    throw new Error(
      `${first.firstName} ${first.lastName} and ${second.firstName} ${second.lastName} are already a conflict pair.`
    );
  }

  const docRef = await addDoc(
    collection(
      db,
      CONFLICT_PAIRS_COLLECTION
    ),
    {
      studentId1:
        first.studentId,

      studentId2:
        second.studentId,

      studentName1:
        `${first.firstName} ${first.lastName}`,

      studentName2:
        `${second.firstName} ${second.lastName}`,

      createdAt:
        Date.now()
    }
  );

  return docRef.id;
}


export async function deleteConflictPair(
  conflictPairId: string
): Promise<void> {

  await ensureAuthenticated();

  await deleteDoc(
    doc(
      db,
      CONFLICT_PAIRS_COLLECTION,
      conflictPairId
    )
  );
}


export function subscribeToConflictPairs(
  callback: (pairs: ConflictPair[]) => void
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      unsubscribeSnapshot =
        onSnapshot(
          collection(
            db,
            CONFLICT_PAIRS_COLLECTION
          ),

          (snapshot) => {

            const list: ConflictPair[] = [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data();

                list.push({
                  id:
                    docSnap.id,

                  studentId1:
                    data.studentId1 || '',

                  studentId2:
                    data.studentId2 || '',

                  studentName1:
                    data.studentName1 || '',

                  studentName2:
                    data.studentName2 || '',

                  createdAt:
                    Number(
                      data.createdAt
                    ) || Date.now()
                });
              }
            );

            list.sort(
              (a, b) =>
                a.studentName1.localeCompare(
                  b.studentName1
                )
            );

            callback(list);
          },

          (err) => {

            console.error(
              'Error subscribing to conflict pairs:',
              err
            );

            callback([]);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading conflict pairs:',
        err
      );

      callback([]);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// SEEDING
// ============================================================

export async function seedInitialJMMSData(): Promise<{
  studentsSeeded: number;
  teachersSeeded: number;
}> {

  try {

    await ensureAuthenticated();

    // --------------------------------------------------------
    // STUDENTS
    // --------------------------------------------------------

    const studentsSnap =
      await getDocs(
        collection(
          db,
          STUDENTS_COLLECTION
        )
      );

    let studentsSeeded = 0;

    if (studentsSnap.empty) {

      const batch =
        writeBatch(db);

      for (
        const student
        of INITIAL_JMMS_STUDENTS
      ) {

        const newDocRef =
          doc(
            collection(
              db,
              STUDENTS_COLLECTION
            )
          );

        batch.set(
          newDocRef,
          {
            ...student,
            createdAt:
              student.createdAt ||
              Date.now()
          }
        );
      }

      await batch.commit();

      studentsSeeded =
        INITIAL_JMMS_STUDENTS.length;
    }


    // --------------------------------------------------------
    // TEACHERS
    // --------------------------------------------------------

    const teachersSnap =
      await getDocs(
        collection(
          db,
          TEACHERS_COLLECTION
        )
      );

    let teachersSeeded = 0;

    if (teachersSnap.empty) {

      const batch =
        writeBatch(db);

      for (
        const teacher
        of INITIAL_JMMS_TEACHERS
      ) {

        const newDocRef =
          doc(
            collection(
              db,
              TEACHERS_COLLECTION
            )
          );

        batch.set(
          newDocRef,
          {
            ...teacher,
            createdAt:
              teacher.createdAt ||
              Date.now()
          }
        );
      }

      await batch.commit();

      teachersSeeded =
        INITIAL_JMMS_TEACHERS.length;
    }


    // --------------------------------------------------------
    // SAMPLE PASSES
    // --------------------------------------------------------

    const passesSnap =
      await getDocs(
        collection(
          db,
          HALL_PASSES_COLLECTION
        )
      );

    if (
      passesSnap.empty &&
      studentsSnap.docs.length > 0
    ) {

      const studentDocs =
        studentsSnap.docs;

      const samplePasses = [

        {
          studentDocId:
            studentDocs[0]?.id || 's1',

          studentId:
            '80101',

          studentName:
            'Liam Miller',

          teacher:
            'Mrs. Sarah Mitchell',

          teacherRoom:
            'Room 204',

          destination:
            'Restroom' as DestinationType,

          status:
            'COMPLETED' as const,

          timeOut:
            Date.now() -
            3600000 * 2,

          timeIn:
            Date.now() -
            3600000 * 2 +
            300000,

          durationSeconds:
            300,

          durationMinutes:
            5,

          createdAt:
            Date.now() -
            3600000 * 2,

          createdBy:
            'student' as const,

          endedBy:
            'student' as const
        },

        {
          studentDocId:
            studentDocs[1]?.id || 's2',

          studentId:
            '80102',

          studentName:
            'Emma Davis',

          teacher:
            'Mr. David Robinson',

          teacherRoom:
            'Room 208',

          destination:
            'Library' as DestinationType,

          status:
            'COMPLETED' as const,

          timeOut:
            Date.now() -
            3600000 * 4,

          timeIn:
            Date.now() -
            3600000 * 4 +
            720000,

          durationSeconds:
            720,

          durationMinutes:
            12,

          createdAt:
            Date.now() -
            3600000 * 4,

          createdBy:
            'student' as const,

          endedBy:
            'student' as const
        },

        {
          studentDocId:
            studentDocs[2]?.id || 's3',

          studentId:
            '80103',

          studentName:
            'Noah Wilson',

          teacher:
            'Ms. Clara Harper',

          teacherRoom:
            'Room 212',

          destination:
            'Office' as DestinationType,

          status:
            'COMPLETED' as const,

          timeOut:
            Date.now() -
            3600000 * 5,

          timeIn:
            Date.now() -
            3600000 * 5 +
            480000,

          durationSeconds:
            480,

          durationMinutes:
            8,

          createdAt:
            Date.now() -
            3600000 * 5,

          createdBy:
            'teacher' as const,

          endedBy:
            'teacher' as const
        }
      ];

      const batch =
        writeBatch(db);

      for (
        const pass
        of samplePasses
      ) {

        const passRef =
          doc(
            collection(
              db,
              HALL_PASSES_COLLECTION
            )
          );

        batch.set(
          passRef,
          pass
        );
      }

      await batch.commit();
    }


    return {
      studentsSeeded,
      teachersSeeded
    };

  } catch (err) {

    console.error(
      'Error seeding JMMS initial data:',
      err
    );

    return {
      studentsSeeded: 0,
      teachersSeeded: 0
    };
  }
}


// ============================================================
// STUDENT LISTENER
// ============================================================

export function subscribeToStudents( callback: (students: Student[]) => void ) { const studentsRef = collection(db, STUDENTS_COLLECTION); return onSnapshot( studentsRef, (snapshot) => { const list: Student[] = []; snapshot.forEach((docSnap) => { 
  const data = docSnap.data(); list.push({ id: docSnap.id, studentId: String(data.studentId || ''), firstName: String(data.firstName || ''), lastName: String(data.lastName || ''), grade: Number(data.grade) || 8, active: data.active !== false, email: String(data.email || ''), homeroom: String(data.homeroom || ''), createdAt: Number(data.createdAt) || 0, 
   }); 
 }); list.sort((a, b) => { const lastNameCompare = a.lastName.localeCompare(b.lastName); if (lastNameCompare !== 0) { return lastNameCompare; } return a.firstName.localeCompare(b.firstName); }); console.log( `[Firebase] Students loaded from Firestore: ${list.length}` ); callback(list); }, (error) => { console.error( '[Firebase] Error subscribing to students:', error ); // IMPORTANT: // Do not replace the current roster with an empty array // when Firestore temporarily fails. } ); }


// ============================================================
// TEACHER LISTENER
// ============================================================

export function subscribeToTeachers( callback: (teachers: Teacher[]) => void ) { const teachersRef = collection(db, TEACHERS_COLLECTION); return onSnapshot( teachersRef, (snapshot) => { const list: Teacher[] = []; snapshot.forEach((docSnap) => { const data = docSnap.data(); list.push({ id: docSnap.id, name: String(data.name || ''), room: String(data.room || ''), subject: String(data.subject || ''), email: String(data.email || ''), active: data.active !== false, department: String(data.department || ''), }); }); list.sort((a, b) => a.name.localeCompare(b.name) ); console.log( `[Firebase] Teachers loaded from Firestore: ${list.length}` ); callback(list); }, (error) => { console.error( '[Firebase] Error subscribing to teachers:', error ); // IMPORTANT: // Do not replace the current roster with an empty array // when Firestore temporarily fails. } ); }


// ============================================================
// ACTIVE HALL PASSES
// ============================================================

export function subscribeToActivePasses(
  callback: (passes: HallPass[]) => void
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      const q =
        query(
          collection(
            db,
            HALL_PASSES_COLLECTION
          ),
          where(
            'status',
            '==',
            'ACTIVE'
          )
        );

      unsubscribeSnapshot =
        onSnapshot(
          q,

          (snapshot) => {

            const list: HallPass[] = [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data();

                list.push({

                  id:
                    docSnap.id,

                  studentDocId:
                    data.studentDocId || '',

                  studentId:
                    data.studentId || '',

                  studentName:
                    data.studentName || '',

                  teacher:
                    data.teacher || '',

                  teacherUid:
                    data.teacherUid || '',

                  teacherRoom:
                    data.teacherRoom || '',

                  destination:
                    data.destination ||
                    'Restroom',

                  destinationDetails:
                    data.destinationDetails ||
                    '',

                  status:
                    data.status ||
                    'ACTIVE',

                  timeOut:
                    Number(
                      data.timeOut
                    ) || Date.now(),

                  timeIn:
                    data.timeIn
                      ? Number(
                          data.timeIn
                        )
                      : null,

                  durationSeconds:
                    data.durationSeconds ||
                    0,

                  durationMinutes:
                    data.durationMinutes ||
                    0,

                  createdAt:
                    Number(
                      data.createdAt
                    ) || Date.now(),

                  createdBy:
                    data.createdBy ||
                    'student',

                  endedBy:
                    data.endedBy,

                  notes:
                    data.notes || '',

                  flagged:
                    !!data.flagged
                });
              }
            );

            list.sort(
              (a, b) =>
                b.timeOut -
                a.timeOut
            );

            callback(list);
          },

          (err) => {

            console.error(
              'Error subscribing to active passes:',
              err
            );

            callback([]);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading active passes:',
        err
      );

      callback([]);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// ALL HALL PASSES
// ============================================================

export function subscribeToAllPasses(
  callback: (passes: HallPass[]) => void,
  maxLimit = 200
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      unsubscribeSnapshot =
        onSnapshot(
          collection(
            db,
            HALL_PASSES_COLLECTION
          ),

          (snapshot) => {

            const list: HallPass[] = [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data();

                list.push({

                  id:
                    docSnap.id,

                  studentDocId:
                    data.studentDocId || '',

                  studentId:
                    data.studentId || '',

                  studentName:
                    data.studentName || '',

                  studentEmail:
                    data.studentEmail,

                  teacher:
                    data.teacher || '',

                  teacherUid:
                    data.teacherUid || '',

                  teacherRoom:
                    data.teacherRoom || '',

                  destination:
                    data.destination ||
                    'Restroom',

                  destinationDetails:
                    data.destinationDetails ||
                    '',

                  status:
                    data.status ||
                    'COMPLETED',

                  timeOut:
                    Number(
                      data.timeOut
                    ) || Date.now(),

                  timeIn:
                    data.timeIn
                      ? Number(
                          data.timeIn
                        )
                      : null,

                  durationSeconds:
                    data.durationSeconds ||
                    0,

                  durationMinutes:
                    data.durationMinutes ||
                    0,

                  createdAt:
                    Number(
                      data.createdAt
                    ) || Date.now(),

                  createdBy:
                    data.createdBy ||
                    'student',

                  endedBy:
                    data.endedBy,

                  notes:
                    data.notes || '',

                  flagged:
                    !!data.flagged,

                  requestId:
                    data.requestId ||
                    undefined,

                  isStudentRequest:
                    !!data.isStudentRequest
                });
              }
            );

            list.sort(
              (a, b) =>
                b.timeOut -
                a.timeOut
            );

            callback(
              list.slice(
                0,
                maxLimit
              )
            );
          },

          (err) => {

            console.error(
              'Error subscribing to all passes:',
              err
            );

            callback([]);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading all passes:',
        err
      );

      callback([]);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// STUDENT PASSES
// ============================================================

export function subscribeToStudentPasses(
  studentId: string,
  callback: (passes: HallPass[]) => void
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      const q =
        query(
          collection(
            db,
            HALL_PASSES_COLLECTION
          ),
          where(
            'studentId',
            '==',
            studentId
          )
        );

      unsubscribeSnapshot =
        onSnapshot(
          q,

          (snapshot) => {

            const list: HallPass[] = [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data();

                list.push({

                  id:
                    docSnap.id,

                  studentDocId:
                    data.studentDocId || '',

                  studentId:
                    data.studentId || '',

                  studentName:
                    data.studentName || '',

                  studentEmail:
                    data.studentEmail,

                  teacher:
                    data.teacher || '',

                  teacherUid:
                    data.teacherUid || '',

                  teacherRoom:
                    data.teacherRoom || '',

                  destination:
                    data.destination ||
                    'Restroom',

                  destinationDetails:
                    data.destinationDetails ||
                    '',

                  status:
                    data.status ||
                    'COMPLETED',

                  timeOut:
                    Number(
                      data.timeOut
                    ) || Date.now(),

                  timeIn:
                    data.timeIn
                      ? Number(
                          data.timeIn
                        )
                      : null,

                  durationSeconds:
                    data.durationSeconds ||
                    0,

                  durationMinutes:
                    data.durationMinutes ||
                    0,

                  createdAt:
                    Number(
                      data.createdAt
                    ) || Date.now(),

                  createdBy:
                    data.createdBy ||
                    'student',

                  endedBy:
                    data.endedBy,

                  notes:
                    data.notes || '',

                  flagged:
                    !!data.flagged,

                  requestId:
                    data.requestId ||
                    undefined,

                  isStudentRequest:
                    !!data.isStudentRequest
                });
              }
            );

            list.sort(
              (a, b) =>
                b.timeOut -
                a.timeOut
            );

            callback(list);
          },

          (err) => {

            console.error(
              `Error subscribing to passes for student ${studentId}:`,
              err
            );

            callback([]);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading student passes:',
        err
      );

      callback([]);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// STUDENT ACTIVE PASS
// ============================================================

export function subscribeToStudentActivePass(
  studentId: string,
  callback: (pass: HallPass | null) => void
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      const q =
        query(
          collection(
            db,
            HALL_PASSES_COLLECTION
          ),
          where(
            'studentId',
            '==',
            studentId
          ),
          where(
            'status',
            '==',
            'ACTIVE'
          )
        );

      unsubscribeSnapshot =
        onSnapshot(
          q,

          (snapshot) => {

            if (snapshot.empty) {
              callback(null);
              return;
            }

            const docSnap =
              snapshot.docs[0];

            const data =
              docSnap.data();

            callback({

              id:
                docSnap.id,

              studentDocId:
                data.studentDocId || '',

              studentId:
                data.studentId || '',

              studentName:
                data.studentName || '',

              studentEmail:
                data.studentEmail,

              teacher:
                data.teacher || '',

              teacherUid:
                data.teacherUid || '',

              teacherRoom:
                data.teacherRoom || '',

              destination:
                data.destination ||
                'Restroom',

              destinationDetails:
                data.destinationDetails ||
                '',

              status:
                data.status ||
                'ACTIVE',

              timeOut:
                Number(
                  data.timeOut
                ) || Date.now(),

              timeIn:
                data.timeIn
                  ? Number(
                      data.timeIn
                    )
                  : null,

              durationSeconds:
                data.durationSeconds ||
                0,

              durationMinutes:
                data.durationMinutes ||
                0,

              createdAt:
                Number(
                  data.createdAt
                ) || Date.now(),

              createdBy:
                data.createdBy ||
                'student',

              endedBy:
                data.endedBy,

              notes:
                data.notes || '',

              flagged:
                !!data.flagged,

              requestId:
                data.requestId ||
                undefined,

              isStudentRequest:
                !!data.isStudentRequest
            });
          },

          (err) => {

            console.error(
              `Error subscribing to active pass for student ${studentId}:`,
              err
            );

            callback(null);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading active student pass:',
        err
      );

      callback(null);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// SINGLE STUDENT
// ============================================================

export function subscribeToStudentDoc(
  studentDocId: string,
  callback: (student: Student | null) => void
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      const docRef =
        doc(
          db,
          STUDENTS_COLLECTION,
          studentDocId
        );

      unsubscribeSnapshot =
        onSnapshot(
          docRef,

          (docSnap) => {

            if (!docSnap.exists()) {
              callback(null);
              return;
            }

            const data =
              docSnap.data();

            callback({

              id:
                docSnap.id,

              studentId:
                data.studentId || '',

              firstName:
                data.firstName || '',

              lastName:
                data.lastName || '',

              grade:
                data.grade || 8,

              active:
                data.active !== false,

              email:
                data.email || '',

              homeroom:
                data.homeroom || '',

              createdAt:
                data.createdAt || 0
            });
          },

          (err) => {

            console.error(
              `Error subscribing to student doc ${studentDocId}:`,
              err
            );

            callback(null);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading student:',
        err
      );

      callback(null);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// HALL PASS ACTIONS
// ============================================================

export async function requestHallPass(
  params: {
    studentDocId: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;

    teacher: string;
    teacherUid?: string;
    teacherRoom?: string;

    destination: DestinationType;
    destinationDetails?: string;

    createdBy?:
      | 'student'
      | 'teacher'
      | 'admin';

    notes?: string;
  }
): Promise<string> {

  const authenticatedUser =
    await ensureAuthenticated();

  const existingActiveQuery =
    query(
      collection(
        db,
        HALL_PASSES_COLLECTION
      ),
      where(
        'studentId',
        '==',
        params.studentId
      ),
      where(
        'status',
        '==',
        'ACTIVE'
      )
    );

  const existingSnap =
    await getDocs(
      existingActiveQuery
    );

  if (!existingSnap.empty) {

    throw new Error(
      `Active pass already exists for ${params.studentName}. Please return to class before requesting a new pass.`
    );
  }

  const now =
    Date.now();

  const passData:
    Omit<HallPass, 'id'> = {

    studentDocId:
      params.studentDocId,

    studentId:
      params.studentId,

    studentName:
      params.studentName,

    studentEmail:
      params.studentEmail,

    teacher:
      params.teacher,

    teacherUid:
      params.teacherUid ||
      authenticatedUser.uid,

    teacherRoom:
      params.teacherRoom ||
      '',

    destination:
      params.destination,

    destinationDetails:
      params.destinationDetails ||
      '',

    status:
      'ACTIVE',

    timeOut:
      now,

    timeIn:
      null,

    createdAt:
      now,

    createdBy:
      params.createdBy ||
      'student',

    notes:
      params.notes ||
      ''
  };

  const docRef =
    await addDoc(
      collection(
        db,
        HALL_PASSES_COLLECTION
      ),
      passData
    );

  return docRef.id;
}


export async function endHallPass(
  passId: string,
  endedBy:
    | 'student'
    | 'teacher'
    | 'admin' = 'student'
): Promise<void> {

  await ensureAuthenticated();

  const passDocRef =
    doc(
      db,
      HALL_PASSES_COLLECTION,
      passId
    );

  const passSnap =
    await getDoc(
      passDocRef
    );

  if (!passSnap.exists()) {
    throw new Error(
      'Hall pass not found.'
    );
  }

  const data =
    passSnap.data();

  const timeOut =
    Number(
      data.timeOut
    ) || Date.now();

  const timeIn =
    Date.now();

  const durationSeconds =
    Math.max(
      1,
      Math.round(
        (timeIn - timeOut) /
        1000
      )
    );

  const durationMinutes =
    Math.max(
      1,
      Math.round(
        durationSeconds / 60
      )
    );

  await updateDoc(
    passDocRef,
    {
      status:
        'COMPLETED',

      timeIn:
        timeIn,

      durationSeconds:
        durationSeconds,

      durationMinutes:
        durationMinutes,

      endedBy:
        endedBy
    }
  );
}


export async function cancelHallPass(
  passId: string,
  reason?: string
): Promise<void> {

  await ensureAuthenticated();

  const passDocRef =
    doc(
      db,
      HALL_PASSES_COLLECTION,
      passId
    );

  await updateDoc(
    passDocRef,
    {
      status:
        'CANCELLED',

      timeIn:
        Date.now(),

      notes:
        reason
          ? `Cancelled: ${reason}`
          : 'Cancelled'
    }
  );
}


export async function flagHallPass(
  passId: string,
  flagged: boolean
): Promise<void> {

  await ensureAuthenticated();

  const passDocRef =
    doc(
      db,
      HALL_PASSES_COLLECTION,
      passId
    );

  await updateDoc(
    passDocRef,
    {
      flagged
    }
  );
}


// ============================================================
// STUDENT REQUESTS
// ============================================================

export async function createStudentRequest(
  params: {
    studentDocId: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;

    requestingTeacherId: string;
    requestingTeacher: string;
    requestingTeacherRoom?: string;

    receivingTeacherId: string;
    receivingTeacher: string;
    receivingTeacherRoom?: string;

    requestDate: string;
    period: string;

    reason?: string;
    notes?: string;
  }
): Promise<string> {

  await ensureAuthenticated();

  if (!params.requestingTeacherId) {
    throw new Error(
      'Requesting teacher could not be identified.'
    );
  }

  if (!params.receivingTeacherId) {
    throw new Error(
      'Please select the teacher you are requesting the student from.'
    );
  }

  if (
    params.requestingTeacherId ===
    params.receivingTeacherId
  ) {
    throw new Error(
      'You cannot request a student from yourself.'
    );
  }

  if (
    !params.studentDocId ||
    !params.studentId
  ) {
    throw new Error(
      'A valid student is required.'
    );
  }

  const existingRequestQuery =
    query(
      collection(
        db,
        STUDENT_REQUESTS_COLLECTION
      ),
      where(
        'studentId',
        '==',
        params.studentId
      ),
      where(
        'status',
        'in',
        [
          'PENDING',
          'ACCEPTED'
        ]
      )
    );

  const existingRequestSnap =
    await getDocs(
      existingRequestQuery
    );

  if (!existingRequestSnap.empty) {
    throw new Error(
      `${params.studentName} already has an active student request.`
    );
  }

  const now =
    Date.now();

  const requestData:
    Omit<StudentRequest, 'id'> = {

    studentDocId:
      params.studentDocId,

    studentId:
      params.studentId,

    studentName:
      params.studentName,

    studentEmail:
      params.studentEmail,

    requestingTeacherId:
      params.requestingTeacherId,

    requestingTeacher:
      params.requestingTeacher,

    requestingTeacherRoom:
      params.requestingTeacherRoom ||
      '',

    receivingTeacherId:
      params.receivingTeacherId,

    receivingTeacher:
      params.receivingTeacher,

    receivingTeacherRoom:
      params.receivingTeacherRoom ||
      '',

    requestDate:
      params.requestDate,

    period:
      params.period,

    reason:
      params.reason ||
      '',

    notes:
      params.notes ||
      '',

    status:
      'PENDING',

    createdAt:
      now
  };

  const docRef =
    await addDoc(
      collection(
        db,
        STUDENT_REQUESTS_COLLECTION
      ),
      requestData
    );

  return docRef.id;
}


// ============================================================
// STUDENT REQUEST LISTENER
// ============================================================

export function subscribeToStudentRequests(
  callback: (
    requests: StudentRequest[]
  ) => void
) {

  let unsubscribeSnapshot:
    | (() => void)
    | null = null;

  let cancelled = false;

  ensureAuthenticated()
    .then(() => {

      if (cancelled) return;

      unsubscribeSnapshot =
        onSnapshot(
          collection(
            db,
            STUDENT_REQUESTS_COLLECTION
          ),

          (snapshot) => {

            const list:
              StudentRequest[] = [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data();

                list.push({

                  id:
                    docSnap.id,

                  studentDocId:
                    data.studentDocId ||
                    '',

                  studentId:
                    data.studentId ||
                    '',

                  studentName:
                    data.studentName ||
                    '',

                  studentEmail:
                    data.studentEmail ||
                    '',

                  requestingTeacherId:
                    data.requestingTeacherId ||
                    '',

                  requestingTeacher:
                    data.requestingTeacher ||
                    '',

                  requestingTeacherRoom:
                    data.requestingTeacherRoom ||
                    '',

                  receivingTeacherId:
                    data.receivingTeacherId ||
                    '',

                  receivingTeacher:
                    data.receivingTeacher ||
                    '',

                  receivingTeacherRoom:
                    data.receivingTeacherRoom ||
                    '',

                  requestDate:
                    data.requestDate ||
                    '',

                  period:
                    data.period ||
                    '',

                  reason:
                    data.reason ||
                    '',

                  notes:
                    data.notes ||
                    '',

                  status:
                    data.status ||
                    'PENDING',

                  hallPassId:
                    data.hallPassId ||
                    undefined,

                  createdAt:
                    Number(
                      data.createdAt
                    ) || Date.now(),

                  acceptedAt:
                    data.acceptedAt
                      ? Number(
                          data.acceptedAt
                        )
                      : undefined,

                  arrivedAt:
                    data.arrivedAt
                      ? Number(
                          data.arrivedAt
                        )
                      : undefined,

                  completedAt:
                    data.completedAt
                      ? Number(
                          data.completedAt
                        )
                      : undefined,

                  cancelledAt:
                    data.cancelledAt
                      ? Number(
                          data.cancelledAt
                        )
                      : undefined
                });
              }
            );

            list.sort(
              (a, b) =>
                b.createdAt -
                a.createdAt
            );

            callback(list);
          },

          (err) => {

            console.error(
              'Error subscribing to student requests:',
              err
            );

            callback([]);
          }
        );

    })
    .catch((err) => {

      console.error(
        'Unable to authenticate before loading student requests:',
        err
      );

      callback([]);
    });


  return () => {

    cancelled = true;

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
  };
}


// ============================================================
// ACCEPT STUDENT REQUEST
// ============================================================

export async function acceptStudentRequest(
  requestId: string
): Promise<string> {

  await ensureAuthenticated();

  const requestRef =
    doc(
      db,
      STUDENT_REQUESTS_COLLECTION,
      requestId
    );

  const requestSnap =
    await getDoc(
      requestRef
    );

  if (!requestSnap.exists()) {
    throw new Error(
      'Student request not found.'
    );
  }

  const request =
    requestSnap.data() as Omit<
      StudentRequest,
      'id'
    >;

  if (
    request.status !==
    'PENDING'
  ) {
    throw new Error(
      'This student request has already been handled.'
    );
  }

  const existingPassQuery =
    query(
      collection(
        db,
        HALL_PASSES_COLLECTION
      ),
      where(
        'studentId',
        '==',
        request.studentId
      ),
      where(
        'status',
        '==',
        'ACTIVE'
      )
    );

  const existingPassSnap =
    await getDocs(
      existingPassQuery
    );

  if (!existingPassSnap.empty) {
    throw new Error(
      `${request.studentName} already has an active hall pass.`
    );
  }

  const now =
    Date.now();

  const passData:
    Omit<HallPass, 'id'> = {

    studentDocId:
      request.studentDocId,

    studentId:
      request.studentId,

    studentName:
      request.studentName,

    studentEmail:
      request.studentEmail,

    teacher:
      request.receivingTeacher,

    /*
     * IMPORTANT:
     * We deliberately do not put the receiving teacher's
     * Firebase UID here because the request system already
     * identifies the teacher by receivingTeacherId.
     */
    teacherUid:
      undefined,

    teacherRoom:
      request.receivingTeacherRoom ||
      '',

    destination:
      'Another Classroom',

    destinationDetails:
      `Report to ${request.requestingTeacher} — ${request.requestingTeacherRoom || 'classroom'}`,

    status:
      'ACTIVE',

    timeOut:
      now,

    timeIn:
      null,

    createdAt:
      now,

    createdBy:
      'teacher',

    notes:
      request.reason
        ? `Student request: ${request.reason}`
        : 'Student requested by another teacher.',

    requestId:
      requestId,

    isStudentRequest:
      true
  };

  const passRef =
    await addDoc(
      collection(
        db,
        HALL_PASSES_COLLECTION
      ),
      passData
    );

  await updateDoc(
    requestRef,
    {
      status:
        'ACCEPTED',

      hallPassId:
        passRef.id,

      acceptedAt:
        now
    }
  );

  return passRef.id;
}


// ============================================================
// MARK STUDENT REQUEST ARRIVED
// ============================================================

export async function markStudentRequestArrived(
  requestId: string
): Promise<void> {

  await ensureAuthenticated();

  const requestRef =
    doc(
      db,
      STUDENT_REQUESTS_COLLECTION,
      requestId
    );

  const requestSnap =
    await getDoc(
      requestRef
    );

  if (!requestSnap.exists()) {
    throw new Error(
      'Student request not found.'
    );
  }

  const request =
    requestSnap.data() as Omit<
      StudentRequest,
      'id'
    >;

  if (
    request.status !==
    'ACCEPTED'
  ) {
    throw new Error(
      'This student is not currently traveling to your classroom.'
    );
  }

  const now =
    Date.now();

  if (request.hallPassId) {

    const passRef =
      doc(
        db,
        HALL_PASSES_COLLECTION,
        request.hallPassId
      );

    const passSnap =
      await getDoc(
        passRef
      );

    if (passSnap.exists()) {

      const passData =
        passSnap.data();

      const timeOut =
        Number(
          passData.timeOut
        ) || now;

      const durationSeconds =
        Math.max(
          1,
          Math.round(
            (now - timeOut) /
            1000
          )
        );

      const durationMinutes =
        Math.max(
          1,
          Math.round(
            durationSeconds / 60
          )
        );

      await updateDoc(
        passRef,
        {
          status:
            'COMPLETED',

          timeIn:
            now,

          durationSeconds,

          durationMinutes,

          endedBy:
            'teacher'
        }
      );
    }
  }

  await updateDoc(
    requestRef,
    {
      status:
        'COMPLETED',

      arrivedAt:
        now,

      completedAt:
        now
    }
  );
}


// ============================================================
// CANCEL STUDENT REQUEST
// ============================================================

export async function cancelStudentRequest(
  requestId: string
): Promise<void> {

  await ensureAuthenticated();

  const requestRef =
    doc(
      db,
      STUDENT_REQUESTS_COLLECTION,
      requestId
    );

  const requestSnap =
    await getDoc(
      requestRef
    );

  if (!requestSnap.exists()) {
    throw new Error(
      'Student request not found.'
    );
  }

  const request =
    requestSnap.data() as Omit<
      StudentRequest,
      'id'
    >;

  const now =
    Date.now();

  if (
    request.status ===
      'ACCEPTED' &&
    request.hallPassId
  ) {

    const passRef =
      doc(
        db,
        HALL_PASSES_COLLECTION,
        request.hallPassId
      );

    const passSnap =
      await getDoc(
        passRef
      );

    if (passSnap.exists()) {

      await updateDoc(
        passRef,
        {
          status:
            'CANCELLED',

          timeIn:
            now,

          endedBy:
            'teacher',

          notes:
            'Cancelled with student request.'
        }
      );
    }
  }

  await updateDoc(
    requestRef,
    {
      status:
        'CANCELLED',

      cancelledAt:
        now
    }
  );
}


// ============================================================
// COMPLETE STUDENT REQUEST
// ============================================================

export async function completeStudentRequest(
  requestId: string
): Promise<void> {

  await ensureAuthenticated();

  const requestRef =
    doc(
      db,
      STUDENT_REQUESTS_COLLECTION,
      requestId
    );

  const requestSnap =
    await getDoc(
      requestRef
    );

  if (!requestSnap.exists()) {
    throw new Error(
      'Student request not found.'
    );
  }

  const request =
    requestSnap.data() as Omit<
      StudentRequest,
      'id'
    >;

  if (
    request.status ===
    'ACCEPTED'
  ) {

    await markStudentRequestArrived(
      requestId
    );

    return;
  }

  await updateDoc(
    requestRef,
    {
      status:
        'COMPLETED',

      completedAt:
        Date.now()
    }
  );
}


// ============================================================
// STUDENT ROSTER MANAGEMENT
// ============================================================

export async function addStudent(
  studentData: Omit<Student, 'id'>
): Promise<string> {

  await ensureAuthenticated();

  const existingQ =
    query(
      collection(
        db,
        STUDENTS_COLLECTION
      ),
      where(
        'studentId',
        '==',
        studentData.studentId
      )
    );

  const snap =
    await getDocs(existingQ);

  if (!snap.empty) {
    throw new Error(
      `Student ID #${studentData.studentId} is already registered.`
    );
  }

  const docRef =
    await addDoc(
      collection(
        db,
        STUDENTS_COLLECTION
      ),
      {
        ...studentData,
        createdAt:
          Date.now()
      }
    );

  return docRef.id;
}


export async function updateStudent(
  id: string,
  studentData: Partial<Student>
): Promise<void> {

  await ensureAuthenticated();

  const studentRef =
    doc(
      db,
      STUDENTS_COLLECTION,
      id
    );

  await updateDoc(
    studentRef,
    studentData
  );
}


export async function deleteStudent(
  id: string
): Promise<void> {

  await ensureAuthenticated();

  const studentRef =
    doc(
      db,
      STUDENTS_COLLECTION,
      id
    );

  await deleteDoc(
    studentRef
  );
}


// ============================================================
// TEACHER ROSTER MANAGEMENT
// ============================================================

export async function addTeacher(
  teacherData: Omit<Teacher, 'id'>
): Promise<string> {

  await ensureAuthenticated();

  const docRef =
    await addDoc(
      collection(
        db,
        TEACHERS_COLLECTION
      ),
      {
        ...teacherData,
        createdAt:
          Date.now()
      }
    );

  return docRef.id;
}


export async function updateTeacher(
  id: string,
  teacherData: Partial<Teacher>
): Promise<void> {

  await ensureAuthenticated();

  const teacherRef =
    doc(
      db,
      TEACHERS_COLLECTION,
      id
    );

  await updateDoc(
    teacherRef,
    teacherData
  );
}


export async function deleteTeacher(
  id: string
): Promise<void> {

  await ensureAuthenticated();

  const teacherRef =
    doc(
      db,
      TEACHERS_COLLECTION,
      id
    );

  await deleteDoc(
    teacherRef
  );
}
