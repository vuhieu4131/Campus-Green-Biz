import CustomIcon from '../components/custom-icon';
import React, { FC } from "react";
import { Page, Header, Box, Text, Icon, List, Avatar } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

// 1. KHỐI HỒ SƠ CỬA HÀNG
const ShopProfileHeader: FC = () => (
  <Box className="m-4 p-4 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center relative">
    <Box className="absolute top-4 right-4 flex space-x-3 text-gray-600">
      <CustomIcon icon="zi-notif" />
      <CustomIcon icon="zi-edit" />
    </Box>
    <Avatar size={70} className="mr-4 border border-blue-100" />
    <Box>
      <Text.Title className="text-xl font-bold flex items-center">
        THỜI TRAN... <CustomIcon icon="zi-check-circle-solid" className="text-gray-800 ml-1 text-sm" />
      </Text.Title>
      <Text size="small" className="text-gray-600 flex items-center mt-1">
        <CustomIcon icon="zi-star" className="text-gray-400 mr-1 text-xs" /> THẠCH ANH SHOP
      </Text>
      <Text size="xSmall" className="text-gray-500 mt-1">Yên Nghĩa, Hà Đông, Hà Nội</Text>
      <Box className="bg-blue-50 text-blue-600 inline-block px-2 py-1 rounded mt-2 text-sm font-semibold">
        0834869131
      </Box>
    </Box>
  </Box>
);

// 2. KHỐI THỐNG KÊ TỔNG QUAN
const ShopStatistics: FC = () => (
  <Box className="m-4 p-4 bg-white rounded-2xl shadow-md border border-gray-100">
    <Box className="flex justify-between items-center mb-4">
      <Text.Title className="font-bold text-lg">Thống kê tổng quan</Text.Title>
      <Box className="bg-gray-100 px-3 py-1 rounded-lg flex items-center text-sm font-medium">
        Tháng 6... <CustomIcon icon="zi-chevron-down" className="ml-1 text-xs" />
      </Box>
    </Box>
    
    <Box className="bg-blue-50 text-blue-800 px-3 py-2 rounded-lg flex justify-between items-center mb-4">
      <Box className="flex items-center"><CustomIcon icon="zi-location" className="mr-2" /> Tất cả cơ sở</Box>
      <CustomIcon icon="zi-chevron-down" />
    </Box>

    <Box className="grid grid-cols-2 gap-3 mb-3">
      <Box className="bg-blue-500 text-white p-3 rounded-xl">
        <Text size="small" className="opacity-90">DOANH THU THÁNG</Text>
        <Text.Title className="text-xl font-bold mt-1">630.000đ</Text.Title>
      </Box>
      <Box className="bg-blue-500 text-white p-3 rounded-xl">
        <Text size="small" className="opacity-90 flex items-center">
          <CustomIcon icon="zi-check-circle" className="mr-1 text-xs" /> ĐÃ PHỤC VỤ
        </Text>
        <Text.Title className="text-xl font-bold mt-1">1 đơn</Text.Title>
      </Box>
    </Box>

    <Box className="bg-red-50 p-3 rounded-xl flex justify-between items-center mb-3">
      <Text className="text-gray-800 font-medium">Chi phí nền tảng <br/><span className="font-normal text-sm">(Còn nợ):</span></Text>
      <Text className="text-red-500 font-bold">-63.000đ <CustomIcon icon="zi-chevron-right" className="text-sm ml-1" /></Text>
    </Box>

    <Box className="bg-orange-50 p-3 rounded-xl flex justify-between items-center">
      <Text className="text-gray-800 font-medium flex items-center">
        <CustomIcon icon="zi-clock-1" className="text-orange-500 mr-2" /> Tổng doanh thu lũy kế:
      </Text>
      <Text className="text-orange-600 font-bold">1.340.000đ</Text>
    </Box>
  </Box>
);

// 3. KHỐI DỊCH VỤ & BÀI ĐĂNG
const ShopServices: FC = () => (
  <Box className="m-4 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
    <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Dịch vụ & Bài đăng</Text.Title></Box>
    <List>
      <List.Item title="Quản lý hệ thống cơ sở" subTitle="1 cơ sở trực thuộc" prefix={<CustomIcon icon="zi-location" className="text-blue-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
      <List.Item title="Đăng dịch vụ mới" prefix={<CustomIcon icon="zi-plus-circle" className="text-gray-600" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
      <List.Item title="Quản lý đơn hàng" subTitle="Theo dõi tất cả đơn đặt lịch" prefix={<CustomIcon icon="zi-note" className="text-blue-400" />} 
        suffix={<Box className="flex items-center"><span className="bg-red-400 text-white text-xs px-2 py-1 rounded-full mr-2">3 mới</span><CustomIcon icon="zi-chevron-right" /></Box>} 
      />
      <List.Item title="Xem trang cửa hàng" subTitle="Xem giao diện khách hàng" prefix={<CustomIcon icon="zi-list-1" className="text-blue-300" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
    </List>
  </Box>
);

// 4. KHỐI QUẢN LÝ & HỖ TRỢ
const ShopManagement: FC = () => (
  <Box className="m-4 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
    <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Quản lý & Hỗ trợ</Text.Title></Box>
    <List>
      <List.Item title="Danh sách khách hàng" subTitle="Người dùng do Shop giới thiệu" prefix={<CustomIcon icon="zi-group" className="text-orange-400" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
      <List.Item title="Chia sẻ ứng dụng" subTitle="QR Code + Mã giới thiệu" prefix={<CustomIcon icon="zi-share" className="text-purple-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
      <List.Item title="Đổi mật khẩu" prefix={<CustomIcon icon="zi-lock" className="text-red-400" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
      <List.Item title="Gửi phản hồi" prefix={<CustomIcon icon="zi-chat" className="text-teal-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
    </List>
  </Box>
);

// 5. KHỐI TIỆN ÍCH KHÁC
const ShopUtilities: FC = () => {
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/"); // Trở về trang chủ sau khi đăng xuất
  };

  return (
    <Box className="m-4 mb-8 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      <Box className="p-4 pb-0"><Text.Title className="font-bold text-lg">Tiện ích khác</Text.Title></Box>
      <List>
        <List.Item title="Liên hệ hỗ trợ" prefix={<CustomIcon icon="zi-call" className="text-blue-500" />} />
        <List.Item title="Điều khoản sử dụng" prefix={<CustomIcon icon="zi-note" className="text-gray-800" />} />
        <List.Item 
          title="Đăng xuất" 
          prefix={<CustomIcon icon="zi-leave" className="text-red-500" />} 
          onClick={handleLogout}
          className="text-red-500 font-medium"
        />
      </List>
    </Box>
  );
};

// COMPONENT GỐC: RÁP TẤT CẢ LẠI VỚI NHAU
const AdminDashboardPage: FC = () => {
  return (
    <Page className="bg-gray-50 overflow-y-auto pb-16">
      <Header title="Bảng Điều Khiển Quản Trị" />
      
      <ShopProfileHeader />
      <ShopStatistics />
      <ShopServices />
      <ShopManagement />
      <ShopUtilities />
      
    </Page>
  );
};

export default AdminDashboardPage;
