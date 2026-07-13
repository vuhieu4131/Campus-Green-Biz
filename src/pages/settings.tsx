import CustomIcon from '../components/custom-icon';
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
  onSupportClick: () => void;
}

const UserPersonalMenu: FC<UserPersonalMenuProps> = ({ onReferralClick, onShareClick, onChangePasswordClick, onSupportClick }) => {
  const navigate = useNavigate();
  return (
    <SectionBox title="Cá nhân">
      <List>
        <List.Item onClick={() => navigate('/account-info')} title="Thông tin tài khoản" prefix={<CustomIcon icon="zi-user" className="text-gray-600" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/notification')} title="Thông báo" prefix={<CustomIcon icon="zi-notif" className="text-blue-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/appointments')} title="Lịch sử đặt hẹn" prefix={<CustomIcon icon="zi-clock-1" className="text-gray-700" />} suffix={<Box className="flex items-center"><span className="bg-red-400 text-white text-xs px-2 py-1 rounded-full mr-2">5 cuộc hẹn</span><CustomIcon icon="zi-chevron-right" /></Box>} />
        <List.Item onClick={onReferralClick} title="Người được giới thiệu" prefix={<CustomIcon icon="zi-group" className="text-gray-700" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={onShareClick} title="Chia sẻ ứng dụng" prefix={<CustomIcon icon="zi-share" className="text-gray-700" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={onChangePasswordClick} title="Đổi mật khẩu" prefix={<CustomIcon icon="zi-lock" className="text-gray-700" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={onSupportClick} title="Gửi phản hồi / Hỗ trợ" prefix={<CustomIcon icon="zi-chat" className="text-gray-700" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
      </List>
    </SectionBox>
  );
};

const UserUtilities: FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  return (
    <SectionBox title="Tiện ích khác">
      <List>
        <List.Item onClick={() => navigate('/contact')} title="Liên hệ hỗ trợ" prefix={<CustomIcon icon="zi-call" className="text-blue-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/terms')} title="Điều khoản sử dụng" prefix={<CustomIcon icon="zi-note" className="text-gray-800" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item title="Đăng xuất" prefix={<CustomIcon icon="zi-leave" className="text-red-500" />} onClick={onLogout} className="text-red-500 font-medium" />
      </List>
    </SectionBox>
  );
};

const SettingsPage: FC = () => {
  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportTab, setSupportTab] = useState<'send' | 'history'>('send');

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
        onSupportClick={() => setShowSupportModal(true)}
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
              <Text.Title className="text-[#14502e] font-bold tracking-widest">{referralCode}</Text.Title>
            </Box>
            <Box 
              className="bg-[#14502e] text-black px-4 py-2 rounded-full text-sm font-medium cursor-pointer shadow-md"
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
            className="w-full bg-[#14502e] text-black py-3 rounded-xl text-center font-bold mt-4 cursor-pointer shadow-md"
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

      {/* Modal Phản hồi & Hỗ trợ */}
      <Modal
        visible={showSupportModal}
        title="Phản hồi & Hỗ trợ"
        onClose={() => setShowSupportModal(false)}
      >
        <Box className="flex flex-col mt-2">
          {/* Tabs */}
          <Box className="flex border-b border-gray-200 mb-4">
            <Box 
              className={`flex-1 text-center py-2 font-medium cursor-pointer ${supportTab === 'send' ? 'text-[#14502e] border-b-2 border-[#14502e]' : 'text-gray-500'}`}
              onClick={() => setSupportTab('send')}
            >
              Gửi yêu cầu
            </Box>
            <Box 
              className={`flex-1 text-center py-2 font-medium cursor-pointer ${supportTab === 'history' ? 'text-[#14502e] border-b-2 border-[#14502e]' : 'text-gray-500'}`}
              onClick={() => setSupportTab('history')}
            >
              Lịch sử (0)
            </Box>
          </Box>

          {supportTab === 'send' ? (
            <Box>
              <Text size="small" className="text-gray-600 mb-4 leading-relaxed">
                Gửi các ý kiến góp ý hoặc yêu cầu hỗ trợ kỹ thuật đến Admin hệ thống.
              </Text>
              
              <Text size="small" className="text-gray-600 mb-2">Nội dung</Text>
              <textarea 
                className="w-full bg-gray-50 border-none rounded-xl p-3 outline-none resize-none mb-4" 
                rows={4} 
                placeholder="Nhập chi tiết yêu cầu của bạn..."
              ></textarea>

              <Box 
                className="w-full bg-[#14502e] text-black py-3 rounded-xl flex items-center justify-center font-bold cursor-pointer shadow-md"
                onClick={() => {
                  alert("Gửi yêu cầu thành công!");
                  setShowSupportModal(false);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
                Gửi yêu cầu
              </Box>
            </Box>
          ) : (
            <Box className="py-8 text-center">
              <Text size="small" className="text-gray-400">Chưa có yêu cầu hỗ trợ nào.</Text>
            </Box>
          )}

          <Box className="w-full h-px bg-gray-200 my-4"></Box>

          <Box 
            className="w-full bg-[#dbeafe] text-blue-600 py-3 rounded-xl text-center font-medium cursor-pointer"
            onClick={() => setShowSupportModal(false)}
          >
            Đóng bảng hỗ trợ
          </Box>
        </Box>
      </Modal>
    </Page>
  );
};

export default SettingsPage;
