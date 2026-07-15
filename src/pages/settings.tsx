import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Text, List, Icon, useNavigate, Modal, Button, Input, Spinner } from "zmp-ui";
import { auth, db } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
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

const calculateMemberRankInfo = (points: number) => {
  const p = points || 0;
  if (p < 100) return { name: "Thành viên mới", sub: "NEW MEMBER", target: 100, nextName: "Hạng Đồng" };
  if (p < 500) return { name: "Hạng Đồng", sub: "KHÁCH HÀNG THÂN THIẾT", target: 500, nextName: "Hạng Bạc" };
  if (p < 1000) return { name: "Hạng Bạc", sub: "SILVER STATUS", target: 1000, nextName: "Hạng Vàng" };
  if (p < 2000) return { name: "Hạng Vàng", sub: "ELITE STATUS", target: 2000, nextName: "Hạng Kim Cương" };
  return { name: "Hạng Kim Cương", sub: "DIAMOND STATUS", target: 999999, nextName: "" };
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

  // Wallet states
  const [userData, setUserData] = useState<any>(null);
  const [points, setPoints] = useState(0);
  const [isWalletExpanded, setIsWalletExpanded] = useState(true);
  const [activeWalletTab, setActiveWalletTab] = useState<'rank' | 'promo'>('rank');
  const [showWalletHistoryModal, setShowWalletHistoryModal] = useState(false);
  const [walletHistoryList, setWalletHistoryList] = useState<any[]>([]);
  const [loadingWalletHistory, setLoadingWalletHistory] = useState(false);

  const handleOpenHistory = async () => {
    if (!userData?.id) return;
    setLoadingWalletHistory(true);
    setShowWalletHistoryModal(true);
    try {
      const q = query(
        collection(db, "point_transactions"),
        where("userId", "==", userData.id),
        where("walletType", "==", activeWalletTab === 'rank' ? 'main' : 'promo'),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => doc.data());
      setWalletHistoryList(docs);
    } catch (error) {
      console.error("Lỗi tải lịch sử giao dịch:", error);
      setWalletHistoryList([]);
    } finally {
      setLoadingWalletHistory(false);
    }
  };

  const handleRankClick = () => {
    const info = calculateMemberRankInfo(points);
    if (!info.nextName) {
      alert("Bạn đang ở hạng thành viên cao nhất (Hạng Kim Cương)!");
    } else {
      const diff = info.target - points;
      alert(`Bạn cần ${diff} điểm để lên ${info.nextName} tiếp theo.`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email !== "guest@campus.com") {
        // Cố gắng lấy thông tin
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        const finalPhone = phoneFromEmail || localPhone;

        let foundData = null;

        if (finalPhone) {
          try {
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);
            if (!shopSnap.empty) {
              const shopData = shopSnap.docs[0].data();
              foundData = { id: shopSnap.docs[0].id, ...shopData, role: "provider" };
            }
          } catch (e) {
            console.error("Lỗi lấy dữ liệu shop:", e);
          }
        }

        if (!foundData) {
          try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              foundData = { id: docSnap.id, ...data, role: data.role || "user" };
            }
          } catch (e) {
            console.error("Lỗi lấy dữ liệu user:", e);
          }
        }

        // Fallback nếu không tìm thấy document nào trong DB
        if (!foundData) {
          foundData = {
            id: user.uid,
            phone: finalPhone || user.phoneNumber || "",
            fullName: user.displayName || "Thành viên",
            role: "user",
            rankPoints: 0,
            spendingPoints: 0
          };
        }

        setUserData(foundData);
        setPoints(foundData.rankPoints || 0);

        if (foundData.phone) {
          setReferralCode(foundData.phone);
        } else if (user.phoneNumber) {
          setReferralCode(user.phoneNumber);
        } else if (user.email) {
          setReferralCode(user.email.split('@')[0]);
        } else {
          setReferralCode(user.uid.substring(0, 10));
        }
      } else {
        setUserData(null);
        setPoints(0);
        setReferralCode("Đang tải...");
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
      
      {/* Ví điểm & Thành viên */}
      {userData && (
        <Box className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <Box 
            flex 
            alignItems="center" 
            justifyContent="space-between" 
            className="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
            onClick={() => setIsWalletExpanded(!isWalletExpanded)}
          >
            <Box flex alignItems="center" className="space-x-3">
              <Box className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </Box>
              <Box>
                <Text bold size="normal" className="text-gray-800">Ví điểm & Thành viên</Text>
                <Text size="xSmall" className="text-gray-500">
                  {points.toLocaleString()} điểm - {calculateMemberRankInfo(points).name}
                </Text>
              </Box>
            </Box>
            <Box flex alignItems="center" className="text-[#14502e] font-semibold text-sm">
              <span>{isWalletExpanded ? "Thu gọn" : "Mở rộng"}</span>
              <Icon icon={isWalletExpanded ? "zi-chevron-up" : "zi-chevron-down"} className="ml-1" size={16} />
            </Box>
          </Box>

          {/* Content */}
          {isWalletExpanded && (
            <Box className="px-4 pb-4 border-t border-gray-50 pt-4 bg-transparent">
              {/* Wallet Selectors */}
              <Box flex className="space-x-3 mb-4">
                <button 
                  className={`flex-1 py-2 px-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    activeWalletTab === 'rank' 
                      ? 'border-orange-400 bg-orange-50/30 text-orange-600 font-semibold' 
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                  onClick={() => setActiveWalletTab('rank')}
                >
                  <Icon icon="zi-poll" className="mb-1 text-lg" />
                  <span className="text-[12px]">Ví Tính Hạng</span>
                </button>

                <button 
                  className={`flex-1 py-2 px-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    activeWalletTab === 'promo' 
                      ? 'border-blue-400 bg-blue-50/30 text-blue-600 font-semibold' 
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                  onClick={() => setActiveWalletTab('promo')}
                >
                  <Icon icon="zi-star" className="mb-1 text-lg" />
                  <span className="text-[12px]">Ví Ưu Đãi</span>
                </button>
              </Box>

              {/* Wallet Card */}
              {activeWalletTab === 'rank' ? (
                <Box className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-6">
                    <Box className="cursor-pointer active:opacity-75" onClick={handleRankClick}>
                      <Text size="xxSmall" className="opacity-80 uppercase tracking-wider">Hạng Thành Viên</Text>
                      <Box flex alignItems="center" className="mt-1">
                        <Icon icon="zi-star-solid" size={20} className="mr-1 text-yellow-300" />
                        <Text bold size="large" className="text-white">{calculateMemberRankInfo(points).name}</Text>
                      </Box>
                    </Box>
                    <Box className="text-right">
                      <Text size="xxSmall" className="opacity-80">Điểm Trọn Đời</Text>
                      <Text bold size="xLarge" className="text-white mt-1 block">{points.toLocaleString()}</Text>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
                  <Box className="mb-4">
                    <Box className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <Box 
                        className="h-full bg-white rounded-full" 
                        style={{ width: `${Math.min(100, (points / calculateMemberRankInfo(points).target) * 100)}%` }} 
                      />
                    </Box>
                    <Box flex justifyContent="space-between" className="mt-1.5 opacity-80 text-[10px]">
                      <span>0</span>
                      <span>Mục tiêu: {calculateMemberRankInfo(points).target} điểm</span>
                    </Box>
                  </Box>

                  <Box flex justifyContent="space-between" alignItems="center" className="border-t border-white/20 pt-3 mt-1">
                    <Text size="xxSmall" className="italic opacity-85">* Điểm hạng chỉ bị trừ khi bị Admin phạt.</Text>
                    <Box 
                      flex 
                      alignItems="center" 
                      className="cursor-pointer active:opacity-75 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
                      onClick={handleOpenHistory}
                    >
                      <Icon icon="zi-clock-1" className="mr-1" size={12} />
                      <span>Xem lịch sử giao dịch</span>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-6">
                    <Box>
                      <Text size="xxSmall" className="opacity-80 uppercase tracking-wider">Ưu Đãi Thành Viên</Text>
                      <Box flex alignItems="center" className="mt-1">
                        <Icon icon="zi-star" size={20} className="mr-1 text-blue-200" />
                        <Text bold size="large" className="text-white">Ví Ưu Đãi</Text>
                      </Box>
                    </Box>
                    <Box className="text-right">
                      <Text size="xxSmall" className="opacity-80">Số Dư Hiện Tại</Text>
                      <Text bold size="xLarge" className="text-white mt-1 block">{(userData.spendingPoints || 0).toLocaleString()}</Text>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
                  <Box className="mb-4">
                    <Box className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <Box 
                        className="h-full bg-white rounded-full" 
                        style={{ width: `${Math.min(100, ((userData.spendingPoints || 0) / 1000) * 100)}%` }} 
                      />
                    </Box>
                    <Box flex justifyContent="space-between" className="mt-1.5 opacity-80 text-[10px]">
                      <span>0</span>
                      <span>1,000 điểm</span>
                    </Box>
                  </Box>

                  <Box flex justifyContent="space-between" alignItems="center" className="border-t border-white/20 pt-3 mt-1">
                    <Text size="xxSmall" className="italic opacity-85">* Điểm tiêu dùng dùng để đổi Voucher.</Text>
                    <Box 
                      flex 
                      alignItems="center" 
                      className="cursor-pointer active:opacity-75 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
                      onClick={handleOpenHistory}
                    >
                      <Icon icon="zi-clock-1" className="mr-1" size={12} />
                      <span>Xem lịch sử giao dịch</span>
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

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

      {/* Wallet History Modal */}
      <Modal
        visible={showWalletHistoryModal}
        title={activeWalletTab === 'rank' ? "Lịch sử Ví Tính Hạng" : "Lịch sử Ví Ưu Đãi"}
        onClose={() => setShowWalletHistoryModal(false)}
        actions={[{ text: "Đóng", onClick: () => setShowWalletHistoryModal(false), highLight: true }]}
      >
        <Box p={4} className="max-h-[60vh] overflow-y-auto hide-scroll">
          {loadingWalletHistory ? (
            <Box className="flex justify-center items-center py-10">
              <Spinner />
            </Box>
          ) : walletHistoryList.length > 0 ? (
            walletHistoryList.map((item, idx) => (
              <Box key={idx} className="mb-3 pb-3 border-b border-gray-100 flex justify-between items-center">
                <Box>
                  <Text size="small" bold className="text-gray-800">{item.description}</Text>
                  <Text size="xxSmall" className="text-gray-400">
                    {item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleString() : new Date(item.createdAt.seconds * 1000).toLocaleString()) : 'N/A'}
                  </Text>
                </Box>
                <Text size="small" bold className={item.type === 'plus' ? "text-green-600" : "text-red-600"}>
                  {item.type === 'plus' ? '+' : '-'}{item.amount?.toLocaleString()}
                </Text>
              </Box>
            ))
          ) : (
            <Text size="small" className="text-center text-gray-400 py-10">Không có dữ liệu giao dịch.</Text>
          )}
        </Box>
      </Modal>
    </Page>
  );
};

export default SettingsPage;
