// Tệp: src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, increment, setDoc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // Nếu dự án của bạn có dùng Auth

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
export const storage = getStorage(app);
// Khởi tạo công cụ Xác thực (Authentication) và xuất ra
export const auth = getAuth(app);

// 2. Khởi tạo và xuất công cụ Database (db) ra để auth.tsx có thể dùng
export const db = getFirestore(app);

// =========================================================
// CÁC HÀM XỬ LÝ TIỆN ÍCH DÀNH CHO DỰ ÁN CAMPUS
// =========================================================

/**
 * Hàm xử lý tạo ví điểm khi khách hàng mới tham gia hệ thống
 */
 export const initializeUser = async (user: { id: string; name: string; avatar: string }) => {
  const userRef = doc(db, "users", user.id);
  const userSnap = await getDoc(userRef);

  // Nếu khách hàng này chưa từng có trong hệ thống Firebase
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: user.name,
      avatar: user.avatar,
      rankPoints: 0,      // Ví A: Điểm hạng (Chỉ cộng dồn để lên cấp)
      spendingPoints: 0,  // Ví B: Điểm tiêu dùng (Có thể trừ khi đổi quà/mua hàng)
      rank: "Mới",        // Đổi từ "Đồng" thành "Mới" cho chuẩn logic dự án mới
      createdAt: new Date()
    });
    console.log("Đã tạo ví điểm mới cho khách!");
  }
};

/**
 * Hàm xử lý tích điểm khi khách sử dụng dịch vụ
 */
export const addPoints = async (userId: string, points: number) => {
  const userRef = doc(db, "users", userId);
  
  try {
    await updateDoc(userRef, {
      rankPoints: increment(points),      // Cộng vào ví cộng dồn
      spendingPoints: increment(points)   // Cộng vào ví tiêu dùng
    });
    console.log(`Tích thành công ${points} điểm cho user ${userId}!`);
  } catch (error) {
    console.error("Lỗi khi tích điểm:", error);
  }
};