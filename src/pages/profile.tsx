import React, { FC, useState } from "react";
import { Box, Header, Icon, Page, Text, Button, Input, useNavigate, Switch, Avatar } from "zmp-ui";
import subscriptionDecor from "static/subscription-decor.svg";
import { ListRenderer } from "components/list-renderer";
import { useRecoilValue } from "recoil";
import { userState } from "state"; // Lấy dữ liệu người dùng Zalo

// --- 1. COMPONENT ĐĂNG KÝ THÀNH VIÊN ---
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

// --- 2. COMPONENT CÁ NHÂN & KHÁC ---
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

// --- 3. TRANG PROFILE CHÍNH ---
const ProfilePage: FC = () => {
  const navigate = useNavigate();
  const userInfo = useRecoilValue(userState);

  // Trạng thái Quản lý lớp phủ toàn màn hình
  const [authVisible, setAuthVisible] = useState(false);
  const [formType, setFormType] = useState<"login" | "register">("login");

  // Dữ liệu Form
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isShopConfig, setIsShopConfig] = useState(false);

  // Xử lý gửi Form Đăng nhập
  const handleLoginSubmit = () => {
    if (phone === "0000869131" && password === "123456") {
      setAuthVisible(false);
      navigate("/admin");
      return;
    }
    console.log("Đăng nhập:", { phone, password });
    alert("Đăng nhập thành công!");
    setAuthVisible(false);
  };

  // Xử lý gửi Form Đăng ký
  const handleRegisterSubmit = () => {
    if (password !== confirmPassword) {
      alert("Mật khẩu nhập lại không khớp!");
      return;
    }
    console.log("Đăng ký:", { phone, fullName, referralCode, isShopConfig });
    alert("Đăng ký thành công!");
    setAuthVisible(false);
  };

  return (
    <Page className="relative">
      <Header showBackIcon={false} title="Cá nhân" />
      
      {/* Nút mở lớp phủ Đăng nhập */}
      <Subscription onOpenAuth={() => setAuthVisible(true)} />
      
      <Personal />
      <Other />

      {/* --- LỚP PHỦ XÁC THỰC TOÀN MÀN HÌNH --- */}
      {authVisible && (
        <Box className="fixed inset-0 bg-white z-50 flex flex-col w-full h-full">
          
          {/* Nút Đóng (Góc trên bên phải) */}
          <Box className="flex justify-end p-4">
            <div onClick={() => setAuthVisible(false)} className="cursor-pointer p-2 bg-gray-100 rounded-full">
              <Icon icon="zi-close" className="text-gray-600 text-2xl" />
            </div>
          </Box>

          {/* Nội dung Form có thể cuộn */}
          <Box className="flex-1 overflow-y-auto px-6 pb-8">
            
            {/* Khu vực Avatar và Lời chào */}
            <Box className="flex flex-col items-center mb-6">
              <Avatar src={userInfo?.avatar} size={80} className="mb-4 shadow-sm" />
              {formType === "login" ? (
                <>
                  <Text.Title className="text-2xl font-bold mb-1">Xin chào {userInfo?.name || "bạn"}!</Text.Title>
                  <Text className="text-gray-500">Đăng nhập để quản lý hồ sơ</Text>
                </>
              ) : (
                <>
                  <Text.Title className="text-2xl font-bold mb-1">Đăng ký thành viên</Text.Title>
                  <Text className="text-gray-500">Tạo tài khoản để nhận ưu đãi</Text>
                </>
              )}
            </Box>

            {/* Các trường nhập liệu */}
            <Box className="w-full space-y-4">
              <Input type="text" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="bg-gray-100 border-none rounded-xl py-3 px-4" />
              
              {formType === "register" && (
                <Input type="text" placeholder="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="bg-gray-100 border-none rounded-xl py-3 px-4" />
              )}

              <Input.Password placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-100 border-none rounded-xl py-3 px-4" />

              {formType === "register" && (
                <>
                  <Input.Password placeholder="Nhập lại mật khẩu" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-gray-100 border-none rounded-xl py-3 px-4" />
                  <Input type="text" placeholder="Mã giới thiệu (SĐT người giới thiệu)" value={referralCode} onChange={(e) => setReferralCode(e.target.value)}
                    className="bg-gray-100 border-none rounded-xl py-3 px-4" />
                  
                  <Box className="flex justify-between items-center py-2">
                    <Box>
                      <Text className="font-semibold text-gray-800">Đăng ký mở Gian hàng</Text>
                      <Text size="xSmall" className="text-gray-500">Dành cho chủ cửa hàng/đối tác</Text>
                    </Box>
                    <Switch checked={isShopConfig} onChange={(e) => setIsShopConfig(e.target.checked)} />
                  </Box>
                </>
              )}

              {formType === "login" && (
                <Box className="flex justify-end">
                  <Text className="text-blue-500 text-sm">Quên mật khẩu?</Text>
                </Box>
              )}

              {/* Nút Submit */}
              <Button 
                fullWidth 
                className="mt-4 py-3 rounded-full font-bold text-white text-lg border-none"
                style={{ backgroundColor: "#8b191b" }} 
                onClick={formType === "login" ? handleLoginSubmit : handleRegisterSubmit}
              >
                {formType === "login" ? "Đăng nhập" : "Đăng ký"}
              </Button>

              {/* Chuyển đổi giữa Đăng nhập / Đăng ký */}
              <Box className="flex justify-center mt-6">
                <Text className="text-gray-600">
                  {formType === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                  <span 
                    className="text-blue-600 font-bold underline cursor-pointer"
                    onClick={() => setFormType(formType === "login" ? "register" : "login")}
                  >
                    {formType === "login" ? "Đăng ký mới" : "Đăng nhập ngay"}
                  </span>
                </Text>
              </Box>
              
            </Box>
          </Box>
        </Box>
      )}
    </Page>
  );
};

export default ProfilePage;