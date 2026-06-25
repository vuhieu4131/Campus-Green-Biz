import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Text, List, Icon, useNavigate, Modal, Button, Input } from "zmp-ui";
import { auth, db } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { SectionBox } from "../components/section-box";

interface UserPersonalMenuProps {
  onReferralClick: () => void;
  onShareClick: () => void;
  onChangePasswordClick: () => void;
}

const UserPersonalMenu: FC<UserPersonalMenuProps> = ({ onReferralClick, onShareClick, onChangePasswordClick }) => {
  const navigate = useNavigate();
  return (
    <SectionBox title="Cá nhân">
      <List>
        <List.Item onClick={() => navigate('/account-info')} title="Thông tin tài khoản" prefix={<Icon icon="zi-user" className="text-gray-600" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/notification')} title="Thông báo" prefix={<Icon icon="zi-notif" className="text-blue-500" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/appointments')} title="Lịch sử đặt hẹn" prefix={<Icon icon="zi-clock-1" className="text-gray-700" />} suffix={<Box className="flex items-center"><span className="bg-red-400 text-white text-xs px-2 py-1 rounded-full mr-2">5 cuộc hẹn</span><Icon icon="zi-chevron-right" /></Box>} />
        <List.Item onClick={onReferralClick} title="Người được giới thiệu" prefix={<Icon icon="zi-group" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={onShareClick} title="Chia sẻ ứng dụng" prefix={<Icon icon="zi-share" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={onChangePasswordClick} title="Đổi mật khẩu" prefix={<Icon icon="zi-lock" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/support')} title="Gửi phản hồi / Hỗ trợ" prefix={<Icon icon="zi-chat" className="text-gray-700" />} suffix={<Icon icon="zi-chevron-right" />} />
      </List>
    </SectionBox>
  );
};

const UserUtilities: FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  return (
    <SectionBox title="Tiện ích khác">
      <List>
        <List.Item onClick={() => navigate('/contact')} title="Liên hệ hỗ trợ" prefix={<Icon icon="zi-call" className="text-blue-500" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/terms')} title="Điều khoản sử dụng" prefix={<Icon icon="zi-note" className="text-gray-800" />} suffix={<Icon icon="zi-chevron-right" />} />
        <List.Item title="Đăng xuất" prefix={<Icon icon="zi-leave" className="text-red-500" />} onClick={onLogout} className="text-red-500 font-medium" />
      </List>
    </SectionBox>
  );
};

const SettingsPage: FC = () => {
  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mã giới thiệu động lấy từ Firebase
  const [referralCode, setReferralCode] = useState("Đang tải...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Cố gắng lấy SĐT từ Firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().phone) {
          setReferralCode(docSnap.data().phone);
        } else if (user.phoneNumber) {
          setReferralCode(user.phoneNumber);
        } else if (user.email) {
          // Lấy username từ email (ví dụ: 0989022120@campus.com -> 0989022120)
          setReferralCode(user.email.split('@')[0]);
        } else {
          setReferralCode(user.uid.substring(0, 10)); // Dự phòng
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    alert("Đã sao chép mã giới thiệu: " + referralCode);
  };

  return (
    <Page className="overflow-y-auto">
      <Header title="Cài đặt" showBackIcon={true} />
      <UserPersonalMenu 
        onReferralClick={() => setShowRefModal(true)} 
        onShareClick={() => setShowShareModal(true)} 
        onChangePasswordClick={() => setShowPasswordModal(true)}
      />
      <UserUtilities onLogout={handleLogout} />

      {/* Modal Chia sẻ ứng dụng */}
      <Modal
        visible={showShareModal}
        title="Chia sẻ ứng dụng"
        onClose={() => setShowShareModal(false)}
        actions={[{ text: "Đóng", onClick: () => setShowShareModal(false) }]}
      >
        <Box className="flex flex-col items-center">
          <Text size="small" className="text-gray-500 mb-4">Mời bạn bè để nhận điểm thưởng!</Text>
          
          <Box className="border-2 border-green-500 p-2 rounded-xl mb-6">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${referralCode}`} 
              alt="QR Code" 
              width={150} height={150} 
            />
          </Box>

          <Box className="w-full bg-[#f0fdf4] border border-green-300 border-dashed rounded-xl p-4 flex justify-between items-center mb-3">
            <Box>
              <Text size="xSmall" className="text-gray-500 mb-1">MÃ GIỚI THIỆU</Text>
              <Text.Title className="text-[#15803d] font-bold tracking-widest">{referralCode}</Text.Title>
            </Box>
            <Box 
              className="bg-[#15803d] text-black px-4 py-2 rounded-full text-sm font-medium cursor-pointer shadow-sm"
              onClick={handleCopy}
            >
              Sao chép
            </Box>
          </Box>
          
          <Text size="xSmall" className="italic text-gray-500 text-center">
            * Người được giới thiệu nhận 5 điểm, bạn nhận 10 điểm.
          </Text>
        </Box>
      </Modal>

      {/* Modal Danh sách giới thiệu */}
      <Modal
        visible={showRefModal}
        title="Danh sách giới thiệu"
        onClose={() => setShowRefModal(false)}
        actions={[{ text: "Đóng", onClick: () => setShowRefModal(false), highLight: true }]}
      >
        <Box className="flex flex-col items-center py-4">
          <Box className="bg-blue-50 w-full py-4 rounded-xl text-center mb-4">
            <Text className="text-blue-600 font-medium">Tổng số: 0 người</Text>
          </Box>
        </Box>
      </Modal>

      {/* Modal Đổi mật khẩu */}
      <Modal
        visible={showPasswordModal}
        title="Đổi mật khẩu"
        onClose={() => setShowPasswordModal(false)}
      >
        <Box className="flex flex-col space-y-4 mt-2">
          <Box>
            <Text size="small" className="text-gray-600 mb-2">Mật khẩu cũ</Text>
            <Input.Password 
              placeholder="Nhập mật khẩu cũ" 
              value={oldPassword} 
              onChange={(e) => setOldPassword(e.target.value)} 
            />
          </Box>
          <Box>
            <Text size="small" className="text-gray-600 mb-2">Mật khẩu mới</Text>
            <Input.Password 
              placeholder="Nhập mật khẩu mới" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
            />
          </Box>
          <Box>
            <Text size="small" className="text-gray-600 mb-2">Xác nhận</Text>
            <Input.Password 
              placeholder="Xác nhận mật khẩu mới" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
            />
          </Box>
          
          <Box 
            className="w-full bg-[#15803d] text-black py-3 rounded-xl text-center font-bold mt-4 cursor-pointer shadow-sm"
            onClick={() => {
              if (newPassword !== confirmPassword) {
                alert("Mật khẩu xác nhận không khớp!");
                return;
              }
              alert("Đổi mật khẩu thành công!");
              setShowPasswordModal(false);
              setOldPassword("");
              setNewPassword("");
              setConfirmPassword("");
            }}
          >
            Cập nhật
          </Box>
        </Box>
      </Modal>
    </Page>
  );
};

export default SettingsPage;
