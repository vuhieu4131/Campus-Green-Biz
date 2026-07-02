import CustomIcon from '../components/custom-icon';
import React, { FC, useState } from "react";
// Đã GỘP useNavigate vào thư viện chuẩn zmp-ui để sửa lỗi trắng màn hình[cite: 7]
import { Box, Text, Input, Button, Switch, Avatar, Icon, useNavigate } from "zmp-ui"; 
import { useRecoilValue } from "recoil";
import { userState } from "state";
import { auth, db } from "../firebase"; 
// BỔ SUNG: Nhập thêm hàm deleteUser để dọn dẹp tài khoản lỗi
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore"; // Bổ sung getDoc 

interface AuthOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthOverlay: FC<AuthOverlayProps> = ({ visible, onClose }) => {
  const navigate = useNavigate(); 
  const userInfo = useRecoilValue(userState);

  const [formType, setFormType] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isShopConfig, setIsShopConfig] = useState(false);

  if (!visible) return null;

  const handleLoginSubmit = async () => {
    // Luồng cho Admin cứng
    if (phone === "0000869131" && password === "123456") {
      onClose(); 
      navigate("/admin");
      return;
    }

    try {
      const email = `${phone}@campus.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 1. ƯU TIÊN TÌM TRONG NGĂN TỦ "shops" TRƯỚC
      const shopRef = doc(db, "shops", user.uid);
      const shopSnap = await getDoc(shopRef);

      if (shopSnap.exists()) {
        alert("Chào mừng Nhà phân phối quay trở lại!");
        onClose(); 
        navigate("/distributor"); 
        return; // Kết thúc sớm nếu đã tìm thấy Shop
      }

      // 2. NẾU KHÔNG THẤY Ở "shops", TÌM TIẾP TRONG "users"
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        alert("Đăng nhập thành công!");
        onClose(); 
      } else {
        alert("Đăng nhập thành công!");
        onClose();
      }

    } catch (error: any) {
      alert("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!");
      console.error("Lỗi đăng nhập:", error.message);
    }
  };

  const handleRegisterSubmit = async () => {
    if (password !== confirmPassword) {
      alert("Mật khẩu nhập lại không khớp!");
      return;
    }
    
    if (phone.length < 9) {
      alert("Số điện thoại không hợp lệ!");
      return;
    }

    try {
      const email = `${phone}@campus.com`;
      
      // 1. Tạo tài khoản đăng nhập bên Xác thực (Auth)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. TẠO BIẾN QUYẾT ĐỊNH NƠI LƯU TRỮ DỮ LIỆU
      // Nếu isShopConfig là true -> chọn "shops", ngược lại chọn "users"
      const collectionName = isShopConfig ? "shops" : "users";

      // 3. Lưu thông tin vào đúng ngăn tủ đã chọn trên Firestore
      await setDoc(doc(db, collectionName, user.uid), {
        phone: phone,
        fullName: fullName,
        referralCode: referralCode,
        isShopConfig: isShopConfig, // Vẫn lưu lại cờ này để dễ kiểm tra sau này
        zaloName: userInfo?.name || "",
        createdAt: new Date().toISOString()
      });

      // 4. Hiển thị thông báo phù hợp với lựa chọn của khách
      if (isShopConfig) {
        alert("Đăng ký mở Gian hàng (Nhà phân phối) thành công!");
      } else {
        alert("Đăng ký thành viên thành công!");
      }
      
      onClose(); // Đóng popup
    } catch (error: any) {
      console.error("LỖI CHI TIẾT CỦA FIREBASE:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Số điện thoại này đã được đăng ký. Vui lòng đăng nhập!");
      } else {
        alert("Đăng ký thất bại. Lỗi: " + error.message);
      }
    }
  };

  return (
    <Box className="fixed inset-0 bg-white z-50 flex flex-col w-full h-full">
      <Box className="flex justify-end p-4">
        <div onClick={onClose} className="cursor-pointer p-2 bg-gray-100 rounded-full">
          <CustomIcon icon="zi-close" className="text-gray-600 text-2xl" />
        </div>
      </Box>

      <Box className="flex-1 overflow-y-auto px-6 pb-8">
        <Box className="flex flex-col items-center mb-6">
          <Avatar src={userInfo?.avatar} size={80} className="mb-4 shadow-md" />
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
    </Box>
  );
};