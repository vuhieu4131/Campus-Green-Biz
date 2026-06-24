import React, { FC } from "react";
import { Page, Header, Box, Text, List, Icon, useNavigate } from "zmp-ui";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

const UserPersonalMenu: FC = () => {
  const navigate = useNavigate();
  return (
    <Box className="mx-4 mb-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Cá nhân</Text.Title></Box>
      <List>
        <List.Item onClick={() => navigate('/account-info')} title="Thông tin tài khoản" prefix={<Icon icon="zi-user" className="text-gray-600" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/notification')} title="Thông báo" prefix={<Icon icon="zi-notif" className="text-blue-500" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/appointments')} title="Lịch sử đặt hẹn" prefix={<Icon icon="zi-clock-1" className="text-gray-700" />} suffix={<Box className="flex items-center"><span className="bg-red-400 text-white text-xs px-2 py-1 rounded-full mr-2">5 cuộc hẹn</span><Icon icon="zi-chevron-right" /></Box>} />
        <List.Item onClick={() => navigate('/referrals')} title="Người được giới thiệu" prefix={<Icon icon="zi-group" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/share')} title="Chia sẻ ứng dụng" prefix={<Icon icon="zi-share" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/change-password')} title="Đổi mật khẩu" prefix={<Icon icon="zi-lock" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/support')} title="Gửi phản hồi / Hỗ trợ" prefix={<Icon icon="zi-chat" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
      </List>
    </Box>
  );
};

const UserUtilities: FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  return (
    <Box className="mx-4 mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Tiện ích khác</Text.Title></Box>
      <List>
        <List.Item onClick={() => navigate('/contact')} title="Liên hệ hỗ trợ" prefix={<Icon icon="zi-call" className="text-blue-500" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/terms')} title="Điều khoản sử dụng" prefix={<Icon icon="zi-note" className="text-gray-800" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item title="Đăng xuất" prefix={<Icon icon="zi-leave" className="text-red-500" />} onClick={onLogout} className="text-red-500 font-medium" />
      </List>
    </Box>
  );
};

const SettingsPage: FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  return (
    <Page className="bg-gray-50 overflow-y-auto">
      <Header title="Cài đặt" showBackIcon={true} />
      <UserPersonalMenu />
      <UserUtilities onLogout={handleLogout} />
    </Page>
  );
};

export default SettingsPage;
