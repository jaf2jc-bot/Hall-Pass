export type DestinationType = 
  | 'Restroom'
  | 'Office'
  | 'Nurse'
  | 'Counselor'
  | 'Another Classroom'
  | 'Library'
  | 'Other';

export interface DestinationConfig {
  name: DestinationType;
  icon: string;
  color: string;
  defaultMaxMinutes: number;
  description: string;
}

export type PassStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface HallPass {
  id: string;
  studentDocId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;

  teacher: string;
  teacherUid: string;
  teacherRoom?: string;

  destination: DestinationType;
  destinationDetails?: string;
  status: PassStatus;
  timeOut: number; // timestamp in ms
  timeIn?: number | null; // timestamp in ms
  durationSeconds?: number;
  durationMinutes?: number;
  createdAt: number;
  createdBy: 'student' | 'teacher' | 'admin';
  endedBy?: 'student' | 'teacher' | 'admin';
  notes?: string;
  flagged?: boolean;
}

export interface Student {
  id: string; // Firestore document ID
  studentId: string; // e.g. "80124"
  firstName: string;
  lastName: string;
  grade: number; // 8
  active: boolean;
  email?: string;
  homeroom?: string;
  periodRoom?: string;
  createdAt?: number;
}

export interface Teacher {
  id: string;
  name: string;
  room: string;
  subject: string;
  email: string;
  active: boolean;
  department?: string;
}

export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  studentId?: string;
  studentDocId?: string;
  teacherDocId?: string;
  grade?: number;
  room?: string;
}

export interface PassStatistics {
  totalActive: number;
  totalToday: number;
  avgDurationMinutes: number;
  overdueCount: number;
  mostCommonDestination: string;
  passesByDestination: Record<string, number>;
  passesByHour: Record<string, number>;
}

export interface ConflictPair {
  id: string;
  studentId1: string;
  studentId2: string;
  studentName1: string;
  studentName2: string;
  createdAt: number;
}
