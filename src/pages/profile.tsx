import React, { FC, useState, useEffect, startTransition } from "react";
import { Box, Header, Icon, Page, Text, Avatar, Button, List } from "zmp-ui";
import subscriptionDecor from "static/subscription-decor.svg";
import { AuthOverlay } from "./auth";
import { useNavigate } from "react-router-dom"; // THÊM DÒNG NÀY

// IMPORT CÔNG CỤ FIREBASE
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"; // THÊM CÁC LỆNH TRUY VẤN

// --- COMPONENT CHƯA ĐĂNG NHẬP (LỜI MỜI) ---
const Subscription: FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => {
  return (
    <Box className="m-4" onClick={onOpenAuth}>
      <Box
        className="bg-green text-white rounded-xl p-4 space-y-2"
        style={{
          backgroundImage: `url(${subscriptionDecor})`,
          backgroundPosition: "right 8px center",
          backgroundRepeat: "no-repeat",
          cursor: "pointer"
        }}
      >
        <Text.Title className="font-bold">Đăng ký / Đăng nhập</Text.Title>
        <Text size="xxSmall">Tạo tài khoản để nhận ưu đãi và quản lý đơn hàng</Text>
      </Box>
    </Box>
  );
};

// --- CÁC KHỐI GIAO DIỆN KHI ĐÃ ĐĂNG NHẬP ---
const UserInfo: FC<{ name: string; phone: string }> = ({ name, phone }) => (
  <Box className="bg-white p-4 flex items-center border-b border-gray-100">
    <Avatar size={60} src="https://i.pravatar.cc/150?img=11" className="mr-4" />
    <Box>
      <Text.Title className="text-xl font-bold">{name}</Text.Title>
      <Text className="text-gray-600 mt-1">{phone}</Text>
    </Box>
  </Box>
);

const UserMembership: FC = () => (
  <Box className="px-4 py-3">
    <Box className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
      <Box className="flex items-center">
        <Box className="bg-orange-50 w-12 h-12 rounded-full flex items-center justify-center mr-3">
          <Icon icon="zi-check" className="text-orange-500" />
        </Box>
        <Box>
          <Text className="font-bold text-gray-800 text-base">Ví điểm & Thành viên</Text>
          <Text className="text-gray-500 text-sm mt-1">79 điểm - Hạng Bạc</Text>
        </Box>
      </Box>
      <Text className="text-blue-600 font-semibold">Chi tiết</Text>
    </Box>
  </Box>
);

const UserPersonalMenu: FC = () => (
  <Box className="mx-4 mb-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Cá nhân</Text.Title></Box>
    <List>
      <List.Item title="Thông tin tài khoản" prefix={<Icon icon="zi-user" className="text-gray-600" />} />
      <List.Item title="Thông báo" prefix={<Icon icon="zi-notif" className="text-blue-500" />} />
      <List.Item title="Lịch sử đặt hẹn" prefix={<Icon icon="zi-clock-1" className="text-gray-700" />} suffix={<span className="bg-red-400 text-white text-xs px-2 py-1 rounded-full">5 cuộc hẹn</span>} />
      <List.Item title="Người được giới thiệu" prefix={<Icon icon="zi-group" className="text-gray-700" />} />
      <List.Item title="Chia sẻ ứng dụng" prefix={<Icon icon="zi-share" className="text-gray-700" />} />
      <List.Item title="Đổi mật khẩu" prefix={<Icon icon="zi-lock" className="text-gray-700" />} />
      <List.Item title="Gửi phản hồi / Hỗ trợ" prefix={<Icon icon="zi-chat" className="text-gray-700" />} />
    </List>
  </Box>
);

const UserUtilities: FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <Box className="mx-4 mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Tiện ích khác</Text.Title></Box>
    <List>
      <List.Item title="Liên hệ hỗ trợ" prefix={<Icon icon="zi-call" className="text-blue-500" />} />
      <List.Item title="Điều khoản sử dụng" prefix={<Icon icon="zi-note" className="text-gray-800" />} />
      <List.Item title="Đăng xuất" prefix={<Icon icon="zi-leave" className="text-red-500" />} onClick={onLogout} className="text-red-500 font-medium" />
    </List>
  </Box>
);

// --- TRANG PROFILE CHÍNH ---
// --- TRANG PROFILE CHÍNH ---
const ProfilePage: FC = () => {
  const [authVisible, setAuthVisible] = useState(false);
  const navigate = useNavigate(); // Công cụ chuyển trang
  
  // Trạng thái quản lý User
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Lắng nghe trạng thái đăng nhập từ Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 1. Kích hoạt giao diện đã đăng nhập ngay lập tức để chống "nháy" màn hình
        setCurrentUser(user); 

        // Lấy SĐT từ email
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        const finalPhone = phoneFromEmail || localPhone;

        if (finalPhone) {
          // 2. CHỐT SỐ ĐIỆN THOẠI VÀO BỘ NHỚ TRƯỚC KHI CHUYỂN TRANG
          // (Để tệp distributor.tsx không đá văng người dùng ra ngoài)
          if (!localPhone) {
            localStorage.setItem("user_phone", finalPhone);
          }

          try {
            // Dò tìm SĐT trong bảng "shops"
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);

            if (!shopSnap.empty) {
              // NẾU LÀ SHOP: Bẻ lái sang trang quản lý một cách an toàn!
              startTransition(() => {
                navigate("/distributor", { replace: true });
              });
              return; 
            }
          } catch (error) {
            console.error("Lỗi kiểm tra quyền Shop:", error);
          }

          // 3. NẾU LÀ KHÁCH HÀNG: Tải dữ liệu từ bảng "users" (Dùng finalPhone làm ID)
          const docRef = doc(db, "users", finalPhone);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        }
      } else {
        // Chưa đăng nhập hoặc vừa đăng xuất
        setCurrentUser(null);
        setUserData(null);
        localStorage.removeItem("user_phone"); // Dọn dẹp rác bộ nhớ
      }
    });

    return () => unsubscribe(); 
  }, [navigate]);

  // Hàm xử lý Đăng xuất
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("user_phone"); // Xóa dữ liệu tạm
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  return (
    <Page className="relative bg-gray-50 pb-4 overflow-y-auto">
      <Header showBackIcon={false} title="Hồ sơ cá nhân" />
      
      {/* HIỂN THỊ DỰA TRÊN TRẠNG THÁI ĐĂNG NHẬP */}
      {currentUser ? (
        <>
          <UserInfo 
            name={userData?.fullName || "Thành viên Campus"} 
            phone={userData?.phone || currentUser.email?.replace("@campus.com", "")} 
          />
          <UserMembership />
          <UserPersonalMenu />
          <UserUtilities onLogout={handleLogout} /> 
        </>
      ) : (
        <>
          <Subscription onOpenAuth={() => setAuthVisible(true)} />
        </>
      )}

      {/* Lớp phủ đăng nhập/đăng ký */}
      {!currentUser && authVisible && (
  <AuthOverlay 
    visible={authVisible} 
    onClose={() => setAuthVisible(false)} 
  />
)}
    </Page>
  );
};

export default ProfilePage;