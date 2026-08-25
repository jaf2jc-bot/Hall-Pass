import { Student, Teacher } from '../types';

export const INITIAL_JMMS_STUDENTS: Omit<Student, 'id'>[] = [
  {
    studentId: "80101",
    firstName: "Liam",
    lastName: "Miller",
    grade: 8,
    active: true,
    email: "lmiller26@bearworks.jackson.sparcc.org",
    homeroom: "Room 204",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80102",
    firstName: "Emma",
    lastName: "Davis",
    grade: 8,
    active: true,
    email: "edavis26@bearworks.jackson.sparcc.org",
    homeroom: "Room 208",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80103",
    firstName: "Noah",
    lastName: "Wilson",
    grade: 8,
    active: true,
    email: "nwilson26@bearworks.jackson.sparcc.org",
    homeroom: "Room 212",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80104",
    firstName: "Olivia",
    lastName: "Johnson",
    grade: 8,
    active: true,
    email: "ojohnson26@bearworks.jackson.sparcc.org",
    homeroom: "Room 204",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80105",
    firstName: "Jackson",
    lastName: "Smith",
    grade: 8,
    active: true,
    email: "jsmith26@bearworks.jackson.sparcc.org",
    homeroom: "Room 216",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80106",
    firstName: "Sophia",
    lastName: "Martinez",
    grade: 8,
    active: true,
    email: "smartinez26@bearworks.jackson.sparcc.org",
    homeroom: "Room 208",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80107",
    firstName: "Lucas",
    lastName: "Brown",
    grade: 8,
    active: true,
    email: "lbrown26@bearworks.jackson.sparcc.org",
    homeroom: "Room 212",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80108",
    firstName: "Ava",
    lastName: "Taylor",
    grade: 8,
    active: true,
    email: "ataylor26@bearworks.jackson.sparcc.org",
    homeroom: "Room 216",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80109",
    firstName: "Mason",
    lastName: "Anderson",
    grade: 8,
    active: true,
    email: "manderson26@bearworks.jackson.sparcc.org",
    homeroom: "Room 204",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80110",
    firstName: "Isabella",
    lastName: "Thomas",
    grade: 8,
    active: true,
    email: "ithomas26@bearworks.jackson.sparcc.org",
    homeroom: "Room 208",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80111",
    firstName: "Ethan",
    lastName: "White",
    grade: 8,
    active: true,
    email: "ewhite26@bearworks.jackson.sparcc.org",
    homeroom: "Room 212",
    createdAt: Date.now() - 86400000 * 30
  },
  {
    studentId: "80112",
    firstName: "Mia",
    lastName: "Harris",
    grade: 8,
    active: true,
    email: "mharris26@bearworks.jackson.sparcc.org",
    homeroom: "Room 216",
    createdAt: Date.now() - 86400000 * 30
  }
];

export const INITIAL_JMMS_TEACHERS: Omit<Teacher, 'id'>[] = [
  {
    name: "Mrs. Sarah Mitchell",
    room: "Room 204",
    subject: "8th Grade Physical Science",
    email: "smitchell@bearworks.jackson.sparcc.org",
    department: "Science",
    active: true
  },
  {
    name: "Mr. David Robinson",
    room: "Room 208",
    subject: "8th Grade Algebra & Math",
    email: "drobinson@bearworks.jackson.sparcc.org",
    department: "Mathematics",
    active: true
  },
  {
    name: "Ms. Clara Harper",
    room: "Room 212",
    subject: "8th Grade English Language Arts",
    email: "charper@bearworks.jackson.sparcc.org",
    department: "Language Arts",
    active: true
  },
  {
    name: "Mr. Carlos Garcia",
    room: "Room 216",
    subject: "8th Grade US History",
    email: "cgarcia@bearworks.jackson.sparcc.org",
    department: "Social Studies",
    active: true
  },
  {
    name: "Mrs. Linda Jenkins, RN",
    room: "Nurse Clinic",
    subject: "School Health & Wellness",
    email: "ljenkins@bearworks.jackson.sparcc.org",
    department: "Health Services",
    active: true
  },
  {
    name: "Mr. Tyler Walker",
    room: "Guidance Office 102",
    subject: "8th Grade School Counselor",
    email: "twalker@bearworks.jackson.sparcc.org",
    department: "Counseling",
    active: true
  },
  {
    name: "Mrs. Karen Adams",
    room: "Main Office",
    subject: "Assistant Principal / Attendance",
    email: "kadams@bearworks.jackson.sparcc.org",
    department: "Administration",
    active: true
  },
  {
    name: "Mr. Robert Foster",
    room: "Media Center",
    subject: "Library & Information Media",
    email: "rfoster@bearworks.jackson.sparcc.org",
    department: "Media / Technology",
    active: true
  }
];
