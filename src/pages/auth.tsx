import React, { FC, useState } from "react";
import { Page, Header, Box, Text, Input, Button, Switch, Avatar, useNavigate } from "zmp-ui";
import { useRecoilValue } from "recoil";
import { userState } from "state";

const AuthPage: FC = () => {
  const navigate = useNavigate();
  const userInfo = useRecoilValue(userState);

  // Quản lý trạng thái Form
  const [formType, setFormType] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isShopConfig, setIsShopConfig] = useState(false);

  // Xử lý Gửi Form Đăng nhập
  const handleLoginSubmit = () => {
    if (phone === "0000869131" && password === "123456") {
      navigate("/admin"); // Đăng nhập Admin
      return;
    }
    console.log("Khách hàng Đăng nhập:", { phone, password });
    alert("Đăng nhập thành công!");
    navigate(-1); // Quay lại trang Profile sau khi thành công
  };

  // Xử lý Gửi Form Đăng ký
  const handleRegisterSubmit = () => {
    if (password !== confirmPassword) {
      alert("Mật khẩu nhập lại không khớp!");
      return;
    }
    console.log("Khách hàng Đăng ký:", { phone, fullName, referralCode, isShopConfig });
    alert("Đăng ký thành công!");
    navigate(-1); // Quay lại trang Profile sau khi thành công
  };

  return (
    <Page className="bg-white">
      {/* Thanh Header có nút quay lại (Back) */}
      <Header title={formType === "login" ? "Đăng nhập" : "Đăng ký"} />

      <Box className="flex flex-col items-center px-6 pb-8 pt-4 overflow-y-auto">
        {/* Khu vực Avatar và Lời chào */}
        <Box className="flex flex-col items-center mb-8">
          <Avatar src={userInfo?.avatar} size={80} className="mb-4 shadow-sm" />
          {formType === "login" ? (
            <>
              <Text.Title className="text-2xl font-bold mb-1 text-center">Xin chào {userInfo?.name || "bạn"}!</Text.Title>
              <Text className="text-gray-500">Đăng nhập để quản lý hồ sơ</Text>
            </>
          ) : (
            <>
              <Text.Title className="text-2xl font-bold mb-1 text-center">Đăng ký thành viên</Text.Title>
              <Text className="text-gray-500">Tạo tài khoản để nhận ưu đãi</Text>
            </>
          )}
        </Box>

        {/* Khu vực Điền Form */}
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

          <Button 
            fullWidth 
            className="mt-4 py-3 rounded-full font-bold text-white text-lg border-none"
            style={{ backgroundColor: "#8b191b" }} 
            onClick={formType === "login" ? handleLoginSubmit : handleRegisterSubmit}
          >
            {formType === "login" ? "Đăng nhập" : "Đăng ký"}
          </Button>

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
    </Page>
  );
};

export default AuthPage;