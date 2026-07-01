// Tệp: src/firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 1. Thêm thư viện Database

// Cấu hình Firebase thực tế trích xuất từ dự án "campusbizproject" của bạn
const firebaseConfig = {
  apiKey: "AIzaSyDF4jBlhobzytz0xphXgH_VzSNn7c_TpZc",
  authDomain: "campusbizproject.firebaseapp.com",
  projectId: "campusbizproject",
  storageBucket: "campusbizproject.firebasestorage.app",
  messagingSenderId: "981136546059",
  appId: "1:981136546059:web:47f3a7b8a6c0c49766aa0e",
  measurementId: "G-FJKCT56XNN"
};

// Khởi tạo ứng dụng Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo công cụ Xác thực (Authentication) và xuất ra
export const auth = getAuth(app);

// 2. Khởi tạo và xuất công cụ Database (db) ra để auth.tsx có thể dùng
export const db = getFirestore(app);

// 3. Khởi tạo và xuất công cụ Storage để lưu trữ hình ảnh
import { getStorage } from "firebase/storage";
export const storage = getStorage(app);