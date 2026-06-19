// Tệp: src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, increment, setDoc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // Nếu dự án của bạn có dùng Auth

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