import React, { FC, useState, useEffect } from "react";
import { Box, Header, Icon, Page, Text, Avatar, Button } from "zmp-ui";
import subscriptionDecor from "static/subscription-decor.svg";
import { ListRenderer } from "components/list-renderer";
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

// --- COMPONENT MENU DANH SÁCH ---
const Personal: FC = () => (
  <Box className="m-4">
    <ListRenderer
      title="Cá nhân"
      items={[
        { left: <Icon icon="zi-user" />, right: <Box flex><Text.Header className="flex-1 font-normal">Thông tin tài khoản</Text.Header><Icon icon="zi-chevron-right" /></Box> },
        { left: <Icon icon="zi-clock-2" />, right: <Box flex><Text.Header className="flex-1 font-normal">Lịch sử đơn hàng</Text.Header><Icon icon="zi-chevron-right" /></Box> },
      ]}
      renderLeft={(item) => item.left} renderRight={(item) => item.right}
    />
  </Box>
);

const Other: FC = () => (
  <Box className="m-4">
    <ListRenderer
      title="Khác"
      items={[
        { left: <Icon icon="zi-star" />, right: <Box flex><Text.Header className="flex-1 font-normal">Đánh giá đơn hàng</Text.Header><Icon icon="zi-chevron-right" /></Box> },
        { left: <Icon icon="zi-call" />, right: <Box flex><Text.Header className="flex-1 font-normal">Liên hệ và góp ý</Text.Header><Icon icon="zi-chevron-right" /></Box> },
      ]}
      renderLeft={(item) => item.left} renderRight={(item) => item.right}
    />
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
    <Page className="relative bg-gray-50 pb-4">
      <Header showBackIcon={false} title="Cá nhân" />
      
      {/* HIỂN THỊ THEO TRẠNG THÁI ĐĂNG NHẬP */}
      {currentUser ? (
        // UI KHI ĐÃ ĐĂNG NHẬP
        <Box className="m-4 p-5 bg-white rounded-xl shadow-sm flex flex-col items-center">
          <Avatar size={72} className="mb-3 shadow-sm border-2 border-green-500" />
          <Text.Title className="font-bold text-xl mb-1 text-gray-800">
            {userData?.fullName || "Thành viên Campus"}
          </Text.Title>
          <Text className="text-gray-500 mb-5 font-medium">
            {userData?.phone || currentUser.email?.replace("@campus.com", "")}
          </Text>
          <Button 
            fullWidth
            variant="secondary" 
            onClick={handleLogout}
            className="text-red-500 font-bold bg-red-50 hover:bg-red-100 border-none"
          >
            Đăng xuất tài khoản
          </Button>
        </Box>
      ) : (
        // UI KHI CHƯA ĐĂNG NHẬP
        <Subscription onOpenAuth={() => setAuthVisible(true)} />
      )}
      
      <Personal />
      <Other />

      {/* Lớp phủ AuthOverlay (Sẽ tự đóng khi đăng nhập thành công nhờ logic bên auth.tsx) */}
      <AuthOverlay 
        visible={authVisible} 
        onClose={() => setAuthVisible(false)} 
      />
    </Page>
  );
};

export default ProfilePage;