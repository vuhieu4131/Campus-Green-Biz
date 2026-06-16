// Tệp: src/firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // 1. Thêm thư viện Database

// Cấu hình Firebase thực tế trích xuất từ dự án "campus-green-biz" của bạn
const firebaseConfig = {
  apiKey: "AIzaSyBqjmQY_ED4l0jTSQgGN325oGOxUVFqBBU",
  authDomain: "campus-green-biz.firebaseapp.com",
  projectId: "campus-green-biz",
  storageBucket: "campus-green-biz.firebasestorage.app",
  messagingSenderId: "279440017514",
  appId: "1:279440017514:web:2a0c5e21770ca0cb642213"
};

// Khởi tạo ứng dụng Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo công cụ Xác thực (Authentication) và xuất ra
export const auth = getAuth(app);

// 2. Khởi tạo và xuất công cụ Database (db) ra để auth.tsx có thể dùng
export const db = getFirestore(app);