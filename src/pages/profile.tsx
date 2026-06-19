import React, { FC, useState, useEffect } from "react";
import { Box, Header, Icon, Page, Text, Avatar, Button, List } from "zmp-ui";
import subscriptionDecor from "static/subscription-decor.svg";
import { AuthOverlay } from "./auth";

// IMPORT CÔNG CỤ FIREBASE
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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
const ProfilePage: FC = () => {
  const [authVisible, setAuthVisible] = useState(false);
  
  // Trạng thái quản lý User
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Lắng nghe trạng thái đăng nhập từ Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user); // Đã đăng nhập
        // Lên Firestore lấy thông tin chi tiết (Họ tên, SĐT...)
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        // Chưa đăng nhập hoặc vừa đăng xuất
        setCurrentUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe(); // Dọn dẹp bộ nhớ khi chuyển trang
  }, []);

  // Hàm xử lý Đăng xuất
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Firebase sẽ tự động cập nhật currentUser về null và giao diện sẽ đổi
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
          {/* KỊCH BẢN 1: ĐÃ ĐĂNG NHẬP -> Hiển thị thông tin Khách hàng */}
          <UserInfo 
            name={userData?.fullName || "Thành viên Campus"} 
            phone={userData?.phone || currentUser.email?.replace("@campus.com", "")} 
          />
          <UserMembership />
          <UserPersonalMenu />
          {/* Truyền hàm đăng xuất vào nút tiện ích */}
          <UserUtilities onLogout={handleLogout} /> 
        </>
      ) : (
        <>
          {/* KỊCH BẢN 2: CHƯA ĐĂNG NHẬP (hoặc vừa đăng xuất) -> Hiển thị khối màu xanh */}
          <Subscription onOpenAuth={() => setAuthVisible(true)} />
        </>
      )}

      {/* Lớp phủ đăng nhập/đăng ký */}
      <AuthOverlay 
        visible={authVisible} 
        onClose={() => setAuthVisible(false)} 
      />
    </Page>
  );
};

export default ProfilePage;