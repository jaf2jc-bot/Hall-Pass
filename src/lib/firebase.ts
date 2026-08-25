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
  orderBy, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';
import { HallPass, Student, Teacher, DestinationType, UserProfile } from '../types';
import { INITIAL_JMMS_STUDENTS, INITIAL_JMMS_TEACHERS } from './seedData';

// Ensure Firebase is initialized
const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the designated firestore database id if present, or default
export const db = firebaseConfigData.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

export const USERS_COLLECTION = 'users';
export const STUDENTS_COLLECTION = 'students';
export const TEACHERS_COLLECTION = 'teachers';
export const HALL_PASSES_COLLECTION = 'hallPasses';

// Google Workspace domain restriction
export const ALLOWED_DOMAIN = 'bearworks.jackson.sparcc.org';

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    hd: ALLOWED_DOMAIN,
    prompt: 'select_account'
  });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutFromApp(): Promise<void> {
  await signOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching user profile:', err);
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, profile.uid);
  await setDoc(userDocRef, {
    ...profile,
    updatedAt: Date.now()
  }, { merge: true });
}

// Sign in anonymously fallback for initial load/preview if not signed in
export const ensureAuthenticated = async (): Promise<User> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          unsubscribe();
          resolve(cred.user);
        } catch (err) {
          console.warn('Anonymous auth note:', err);
          unsubscribe();
          if (auth.currentUser) {
            resolve(auth.currentUser);
          } else {
            resolve({ uid: 'guest-' + Math.random().toString(36).substring(2, 9) } as User);
          }
        }
      }
    });
  });
};

// ==========================================
// SEEDING UTILITY
// ==========================================
export async function seedInitialJMMSData(): Promise<{ studentsSeeded: number; teachersSeeded: number }> {
  try {
    await ensureAuthenticated();
    
    // Check students
    const studentsSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    let studentsSeeded = 0;
    if (studentsSnap.empty) {
      const batch = writeBatch(db);
      for (const student of INITIAL_JMMS_STUDENTS) {
        const newDocRef = doc(collection(db, STUDENTS_COLLECTION));
        batch.set(newDocRef, student);
      }
      await batch.commit();
      studentsSeeded = INITIAL_JMMS_STUDENTS.length;
    }

    // Check teachers
    const teachersSnap = await getDocs(collection(db, TEACHERS_COLLECTION));
    let teachersSeeded = 0;
    if (teachersSnap.empty) {
      const batch = writeBatch(db);
      for (const teacher of INITIAL_JMMS_TEACHERS) {
        const newDocRef = doc(collection(db, TEACHERS_COLLECTION));
        batch.set(newDocRef, teacher);
      }
      await batch.commit();
      teachersSeeded = INITIAL_JMMS_TEACHERS.length;
    }

    // Check sample historical passes if completely empty
    const passesSnap = await getDocs(collection(db, HALL_PASSES_COLLECTION));
    if (passesSnap.empty && studentsSnap.docs.length > 0) {
      const studentDocs = studentsSnap.docs;
      const samplePasses = [
        {
          studentDocId: studentDocs[0]?.id || 's1',
          studentId: "80101",
          studentName: "Liam Miller",
          teacher: "Mrs. Sarah Mitchell",
          teacherRoom: "Room 204",
          destination: "Restroom" as DestinationType,
          status: 'COMPLETED' as const,
          timeOut: Date.now() - 3600000 * 2,
          timeIn: Date.now() - 3600000 * 2 + 300000,
          durationSeconds: 300,
          durationMinutes: 5,
          createdAt: Date.now() - 3600000 * 2,
          createdBy: 'student' as const,
          endedBy: 'student' as const
        },
        {
          studentDocId: studentDocs[1]?.id || 's2',
          studentId: "80102",
          studentName: "Emma Davis",
          teacher: "Mr. David Robinson",
          teacherRoom: "Room 208",
          destination: "Library" as DestinationType,
          status: 'COMPLETED' as const,
          timeOut: Date.now() - 3600000 * 4,
          timeIn: Date.now() - 3600000 * 4 + 720000,
          durationSeconds: 720,
          durationMinutes: 12,
          createdAt: Date.now() - 3600000 * 4,
          createdBy: 'student' as const,
          endedBy: 'student' as const
        },
        {
          studentDocId: studentDocs[2]?.id || 's3',
          studentId: "80103",
          studentName: "Noah Wilson",
          teacher: "Ms. Clara Harper",
          teacherRoom: "Room 212",
          destination: "Office" as DestinationType,
          status: 'COMPLETED' as const,
          timeOut: Date.now() - 3600000 * 5,
          timeIn: Date.now() - 3600000 * 5 + 480000,
          durationSeconds: 480,
          durationMinutes: 8,
          createdAt: Date.now() - 3600000 * 5,
          createdBy: 'teacher' as const,
          endedBy: 'teacher' as const
        }
      ];

      const batch = writeBatch(db);
      for (const pass of samplePasses) {
        const passRef = doc(collection(db, HALL_PASSES_COLLECTION));
        batch.set(passRef, pass);
      }
      await batch.commit();
    }

    return { studentsSeeded, teachersSeeded };
  } catch (err) {
    console.error('Error seeding JMMS initial data:', err);
    return { studentsSeeded: 0, teachersSeeded: 0 };
  }
}

// ==========================================
// REAL-TIME FIRESTORE LISTENERS
// ==========================================

export function subscribeToStudents(callback: (students: Student[]) => void) {
  const q = collection(db, STUDENTS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const list: Student[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        studentId: data.studentId || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        grade: data.grade || 8,
        active: data.active !== false,
        email: data.email || '',
        homeroom: data.homeroom || '',
        createdAt: data.createdAt || 0,
      });
    });
    list.sort((a, b) => a.lastName.localeCompare(b.lastName));
    callback(list);
  }, (err) => {
    console.error('Error subscribing to students:', err);
  });
}

export function subscribeToTeachers(callback: (teachers: Teacher[]) => void) {
  const q = collection(db, TEACHERS_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const list: Teacher[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        name: data.name || '',
        room: data.room || '',
        subject: data.subject || '',
        email: data.email || '',
        active: data.active !== false,
        department: data.department || '',
      });
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    callback(list);
  }, (err) => {
    console.error('Error subscribing to teachers:', err);
  });
}

export function subscribeToActivePasses(callback: (passes: HallPass[]) => void) {
  const q = query(
    collection(db, HALL_PASSES_COLLECTION),
    where('status', '==', 'ACTIVE')
  );
  return onSnapshot(q, (snapshot) => {
    const list: HallPass[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        studentDocId: data.studentDocId || '',
        studentId: data.studentId || '',
        studentName: data.studentName || '',
        teacher: data.teacher || '',
        teacherRoom: data.teacherRoom || '',
        destination: data.destination || 'Restroom',
        destinationDetails: data.destinationDetails || '',
        status: data.status || 'ACTIVE',
        timeOut: Number(data.timeOut) || Date.now(),
        timeIn: data.timeIn ? Number(data.timeIn) : null,
        durationSeconds: data.durationSeconds || 0,
        durationMinutes: data.durationMinutes || 0,
        createdAt: Number(data.createdAt) || Date.now(),
        createdBy: data.createdBy || 'student',
        endedBy: data.endedBy,
        notes: data.notes || '',
        flagged: !!data.flagged
      });
    });
    list.sort((a, b) => b.timeOut - a.timeOut);
    callback(list);
  }, (err) => {
    console.error('Error subscribing to active passes:', err);
  });
}

export function subscribeToAllPasses(callback: (passes: HallPass[]) => void, maxLimit = 200) {
  const q = collection(db, HALL_PASSES_COLLECTION);
  return onSnapshot(q, (snapshot) => {
    const list: HallPass[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        studentDocId: data.studentDocId || '',
        studentId: data.studentId || '',
        studentName: data.studentName || '',
        studentEmail: data.studentEmail,
        teacher: data.teacher || '',
        teacherRoom: data.teacherRoom || '',
        destination: data.destination || 'Restroom',
        destinationDetails: data.destinationDetails || '',
        status: data.status || 'COMPLETED',
        timeOut: Number(data.timeOut) || Date.now(),
        timeIn: data.timeIn ? Number(data.timeIn) : null,
        durationSeconds: data.durationSeconds || 0,
        durationMinutes: data.durationMinutes || 0,
        createdAt: Number(data.createdAt) || Date.now(),
        createdBy: data.createdBy || 'student',
        endedBy: data.endedBy,
        notes: data.notes || '',
        flagged: !!data.flagged
      });
    });
    list.sort((a, b) => b.timeOut - a.timeOut);
    callback(list.slice(0, maxLimit));
  }, (err) => {
    console.error('Error subscribing to all passes:', err);
  });
}

// Student-scoped pass listener: Only fetches passes belonging to the authenticated student
export function subscribeToStudentPasses(studentId: string, callback: (passes: HallPass[]) => void) {
  const q = query(
    collection(db, HALL_PASSES_COLLECTION),
    where('studentId', '==', studentId)
  );
  return onSnapshot(q, (snapshot) => {
    const list: HallPass[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        studentDocId: data.studentDocId || '',
        studentId: data.studentId || '',
        studentName: data.studentName || '',
        studentEmail: data.studentEmail,
        teacher: data.teacher || '',
        teacherRoom: data.teacherRoom || '',
        destination: data.destination || 'Restroom',
        destinationDetails: data.destinationDetails || '',
        status: data.status || 'COMPLETED',
        timeOut: Number(data.timeOut) || Date.now(),
        timeIn: data.timeIn ? Number(data.timeIn) : null,
        durationSeconds: data.durationSeconds || 0,
        durationMinutes: data.durationMinutes || 0,
        createdAt: Number(data.createdAt) || Date.now(),
        createdBy: data.createdBy || 'student',
        endedBy: data.endedBy,
        notes: data.notes || '',
        flagged: !!data.flagged
      });
    });
    list.sort((a, b) => b.timeOut - a.timeOut);
    callback(list);
  }, (err) => {
    console.error(`Error subscribing to passes for student ${studentId}:`, err);
  });
}

// Student-scoped active pass listener
export function subscribeToStudentActivePass(studentId: string, callback: (pass: HallPass | null) => void) {
  const q = query(
    collection(db, HALL_PASSES_COLLECTION),
    where('studentId', '==', studentId),
    where('status', '==', 'ACTIVE')
  );
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
      return;
    }
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    callback({
      id: docSnap.id,
      studentDocId: data.studentDocId || '',
      studentId: data.studentId || '',
      studentName: data.studentName || '',
      studentEmail: data.studentEmail,
      teacher: data.teacher || '',
      teacherRoom: data.teacherRoom || '',
      destination: data.destination || 'Restroom',
      destinationDetails: data.destinationDetails || '',
      status: data.status || 'ACTIVE',
      timeOut: Number(data.timeOut) || Date.now(),
      timeIn: data.timeIn ? Number(data.timeIn) : null,
      durationSeconds: data.durationSeconds || 0,
      durationMinutes: data.durationMinutes || 0,
      createdAt: Number(data.createdAt) || Date.now(),
      createdBy: data.createdBy || 'student',
      endedBy: data.endedBy,
      notes: data.notes || '',
      flagged: !!data.flagged
    });
  }, (err) => {
    console.error(`Error subscribing to active pass for student ${studentId}:`, err);
  });
}

// Single student profile listener
export function subscribeToStudentDoc(studentDocId: string, callback: (student: Student | null) => void) {
  const docRef = doc(db, STUDENTS_COLLECTION, studentDocId);
  return onSnapshot(docRef, (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    const data = docSnap.data();
    callback({
      id: docSnap.id,
      studentId: data.studentId || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      grade: data.grade || 8,
      active: data.active !== false,
      email: data.email || '',
      homeroom: data.homeroom || '',
      createdAt: data.createdAt || 0,
    });
  }, (err) => {
    console.error(`Error subscribing to student doc ${studentDocId}:`, err);
  });
}

// ==========================================
// HALL PASS ACTIONS
// ==========================================

export async function requestHallPass(params: {
  studentDocId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  teacher: string;
  teacherRoom?: string;
  destination: DestinationType;
  destinationDetails?: string;
  createdBy?: 'student' | 'teacher' | 'admin';
  notes?: string;
}): Promise<string> {
  await ensureAuthenticated();

  // Strict check: Verify student does NOT have an active pass
  const existingActiveQuery = query(
    collection(db, HALL_PASSES_COLLECTION),
    where('studentId', '==', params.studentId),
    where('status', '==', 'ACTIVE')
  );
  
  const existingSnap = await getDocs(existingActiveQuery);
  if (!existingSnap.empty) {
    throw new Error(`Active pass already exists for ${params.studentName}. Please return to class before requesting a new pass.`);
  }

  const now = Date.now();
  const passData: Omit<HallPass, 'id'> = {
    studentDocId: params.studentDocId,
    studentId: params.studentId,
    studentName: params.studentName,
    studentEmail: params.studentEmail,
    teacher: params.teacher,
    teacherRoom: params.teacherRoom || '',
    destination: params.destination,
    destinationDetails: params.destinationDetails || '',
    status: 'ACTIVE',
    timeOut: now,
    timeIn: null,
    createdAt: now,
    createdBy: params.createdBy || 'student',
    notes: params.notes || '',
  };

  const docRef = await addDoc(collection(db, HALL_PASSES_COLLECTION), passData);
  return docRef.id;
}

export async function endHallPass(passId: string, endedBy: 'student' | 'teacher' | 'admin' = 'student'): Promise<void> {
  await ensureAuthenticated();
  const passDocRef = doc(db, HALL_PASSES_COLLECTION, passId);
  const passSnap = await getDoc(passDocRef);

  if (!passSnap.exists()) {
    throw new Error('Hall pass not found.');
  }

  const data = passSnap.data();
  const timeOut = Number(data.timeOut) || Date.now();
  const timeIn = Date.now();
  const durationSeconds = Math.max(1, Math.round((timeIn - timeOut) / 1000));
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  await updateDoc(passDocRef, {
    status: 'COMPLETED',
    timeIn: timeIn,
    durationSeconds: durationSeconds,
    durationMinutes: durationMinutes,
    endedBy: endedBy
  });
}

export async function cancelHallPass(passId: string, reason?: string): Promise<void> {
  await ensureAuthenticated();
  const passDocRef = doc(db, HALL_PASSES_COLLECTION, passId);
  await updateDoc(passDocRef, {
    status: 'CANCELLED',
    timeIn: Date.now(),
    notes: reason ? `Cancelled: ${reason}` : 'Cancelled'
  });
}

export async function flagHallPass(passId: string, flagged: boolean): Promise<void> {
  await ensureAuthenticated();
  const passDocRef = doc(db, HALL_PASSES_COLLECTION, passId);
  await updateDoc(passDocRef, { flagged });
}

// ==========================================
// STUDENT ROSTER MANAGEMENT
// ==========================================

export async function addStudent(studentData: Omit<Student, 'id'>): Promise<string> {
  await ensureAuthenticated();
  // Check studentId uniqueness
  const existingQ = query(
    collection(db, STUDENTS_COLLECTION), 
    where('studentId', '==', studentData.studentId)
  );
  const snap = await getDocs(existingQ);
  if (!snap.empty) {
    throw new Error(`Student ID #${studentData.studentId} is already registered.`);
  }

  const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), {
    ...studentData,
    createdAt: Date.now()
  });
  return docRef.id;
}

export async function updateStudent(id: string, studentData: Partial<Student>): Promise<void> {
  await ensureAuthenticated();
  const studentRef = doc(db, STUDENTS_COLLECTION, id);
  await updateDoc(studentRef, studentData);
}

export async function deleteStudent(id: string): Promise<void> {
  await ensureAuthenticated();
  const studentRef = doc(db, STUDENTS_COLLECTION, id);
  await deleteDoc(studentRef);
}

// ==========================================
// TEACHER ROSTER MANAGEMENT
// ==========================================

export async function addTeacher(teacherData: Omit<Teacher, 'id'>): Promise<string> {
  await ensureAuthenticated();
  const docRef = await addDoc(collection(db, TEACHERS_COLLECTION), teacherData);
  return docRef.id;
}

export async function updateTeacher(id: string, teacherData: Partial<Teacher>): Promise<void> {
  await ensureAuthenticated();
  const teacherRef = doc(db, TEACHERS_COLLECTION, id);
  await updateDoc(teacherRef, teacherData);
}

export async function deleteTeacher(id: string): Promise<void> {
  await ensureAuthenticated();
  const teacherRef = doc(db, TEACHERS_COLLECTION, id);
  await deleteDoc(teacherRef);
}
