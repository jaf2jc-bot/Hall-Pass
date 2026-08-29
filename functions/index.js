const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

// Must match the Firestore database ID in firebase-applet-config.json.
// If your project uses the DEFAULT Firestore database instead of a named
// one, change this to: const db = getFirestore();
const FIRESTORE_DATABASE_ID = 'ai-studio-jmmsehallpass-394265b5-b2f3-45dd-9143-fee8b65077db';
const db = getFirestore(FIRESTORE_DATABASE_ID);

const ALLOWED_DOMAIN = 'bearworks.jackson.sparcc.org';

// Explicit allowlist — replaces the old client-side
// email.includes('admin') / startsWith('principal') substring check.
const ADMIN_EMAILS = [
  'admin@bearworks.jackson.sparcc.org',
  'jaf2jc@bearworks.jackson.sparcc.org'
];

/**
 * provisionUserProfile
 *
 * Runs entirely on Firebase's servers using the Admin SDK, which
 * bypasses Firestore security rules. This is the ONLY place role
 * assignment happens now. The client never writes its own role.
 *
 * Call this once, right after a successful sign-in.
 */
exports.provisionUserProfile = onCall(async (request) => {
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const uid = auth.uid;
  const email = (auth.token.email || '').trim();
  const emailLower = email.toLowerCase();
  const emailDomain = emailLower.split('@')[1] || '';

  const isAdminEmail = ADMIN_EMAILS.includes(emailLower);
  const isAuthorizedDomain = emailDomain === ALLOWED_DOMAIN.toLowerCase() || isAdminEmail;

  if (!isAuthorizedDomain) {
    throw new HttpsError(
      'permission-denied',
      `Access restricted to @${ALLOWED_DOMAIN} accounts.`
    );
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  // --------------------------------------------------------
  // ADMIN ACCOUNT — explicit allowlist only
  // --------------------------------------------------------
  if (isAdminEmail) {
    const profile = {
      uid,
      email,
      displayName: auth.token.name || email.split('@')[0] || 'JMMS Administrator',
      photoURL: auth.token.picture || null,
      role: 'admin',
      room: 'Main Administrative Office',
      updatedAt: Date.now()
    };

    await userRef.set(profile, { merge: true });
    return profile;
  }

  // --------------------------------------------------------
  // CHECK TEACHER ROSTER BY EMAIL
  // --------------------------------------------------------
  const teacherQuery = await db
    .collection('teachers')
    .where('email', '==', emailLower)
    .limit(1)
    .get();

  if (!teacherQuery.empty) {
    const teacherDoc = teacherQuery.docs[0];
    const teacherData = teacherDoc.data();

    // Keep the teacher roster doc's uid in sync, same as the old attachTeacherUid().
    await teacherDoc.ref.update({ uid, updatedAt: Date.now() });

    const profile = {
      uid,
      email,
      displayName: auth.token.name || teacherData.name || email.split('@')[0],
      photoURL: auth.token.picture || null,
      role: 'teacher',
      teacherDocId: teacherDoc.id,
      room: teacherData.room || '',
      updatedAt: Date.now()
    };

    await userRef.set(profile, { merge: true });
    return profile;
  }

  // --------------------------------------------------------
  // CHECK STUDENT ROSTER BY EMAIL
  // --------------------------------------------------------
  const studentQuery = await db
    .collection('students')
    .where('email', '==', emailLower)
    .limit(1)
    .get();

  if (!studentQuery.empty) {
    const studentDoc = studentQuery.docs[0];
    const studentData = studentDoc.data();

    const profile = {
      uid,
      email,
      displayName: auth.token.name || `${studentData.firstName} ${studentData.lastName}`,
      photoURL: auth.token.picture || null,
      role: 'student',
      studentId: studentData.studentId,
      studentDocId: studentDoc.id,
      grade: studentData.grade,
      room: studentData.homeroom || '',
      updatedAt: Date.now()
    };

    await userRef.set(profile, { merge: true });
    return profile;
  }

  // --------------------------------------------------------
  // NO ROSTER MATCH — do not grant an unmatched account access.
  // Previously this fell back to role: 'student' automatically, which
  // let anyone with an @bearworks.jackson.sparcc.org address in — even
  // if they weren't actually on the roster. That's now a hard stop
  // instead of a silent default.
  // --------------------------------------------------------
  if (userSnap.exists) {
    // Returning the existing profile keeps a previously-provisioned
    // user working even if their roster entry was later removed/edited.
    return userSnap.data();
  }

  throw new HttpsError(
    'permission-denied',
    'Your account was not found on the student or staff roster. Please contact the school office.'
  );
});
