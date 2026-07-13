import * as admin from 'firebase-admin';

// Khởi tạo Firebase Admin SDK (Chỉ khởi tạo 1 lần duy nhất)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth, admin };
