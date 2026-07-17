import CustomIcon from '../custom-icon';
import React, { FC, useState } from "react";
import { Box, Text, Avatar, Icon, Modal, Progress, Spinner, useNavigate, Button } from "zmp-ui";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

const calculateMemberRankInfo = (points: number) => {
  const p = points || 0;
  if (p < 100) return { name: "Thành viên mới", icon: "zi-user", target: 100 };
  if (p < 500) return { name: "Hạng Đồng", icon: "zi-star", target: 500 };
  if (p < 1000) return { name: "Hạng Bạc", icon: "zi-star-solid", target: 1000 };
  if (p < 2000) return { name: "Hạng Vàng", icon: "zi-star-solid", target: 2000 };
  return { name: "Hạng Kim Cương", icon: "zi-star-solid", target: 999999 };
};

export const MemberView: FC<{ user: any; points: number }> = ({ user, points }) => {
  const navigate = useNavigate();
  const [activeWallet, setActiveWallet] = useState<'main' | 'promo'>('main');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Tạo mã giới thiệu từ ID người dùng
  const referralCode = user?.id ? user.id.substring(0, 8).toUpperCase() : "CHUA-CO-MA";

  const handleOpenHistory = async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const targetWallet = activeWallet;
      const q = query(
        collection(db, "point_transactions"),
        where("userId", "==", user.id)
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs
        .map(doc => doc.data() as any)
        .filter(item => item.walletType === targetWallet)
        .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
        });
      setHistoryList(docs);
    } catch (error) {
      console.error("Lỗi:", error);
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("vi-VN") + " " + date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
  };

  // Hàm xử lý Copy mã giới thiệu
  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    alert("Đã sao chép mã giới thiệu: " + referralCode);
  };

  return (
    <Box className="pb-4">
      {/* SECTION 1: THÔNG TIN TÀI KHOẢN & 2 VÍ */}
      <Box className="bg-white p-4 flex flex-col items-center border-b shadow-md">
        <Avatar src={user?.avatar} size={64} className="mb-2 border-2 border-orange-400" />
        <Text bold size="large">{user?.name || "Khách hàng"}</Text>
        
        <Box flex justifyContent="space-around" className="w-full mt-6 border-t pt-4">
          <Box 
            flex flexDirection="column" alignItems="center" 
            className={`p-3 rounded-xl transition-all w-5/12 ${activeWallet === 'main' ? 'bg-orange-50 border-2 border-orange-400' : 'bg-gray-50'}`}
            onClick={() => setActiveWallet('main')}
          >
            <Icon
              icon="zi-plus-circle"
              className={
                activeWallet === "main" ? "text-orange-600" : "text-gray-400"
              }
            />
            <Text
              size="xxSmall"
              bold
              className={`mt-1 ${
                activeWallet === "main" ? "text-orange-600" : "text-gray-400"
              }`}
            >
              Ví Tích Điểm
            </Text>
            <Text bold size="normal">
              {points.toLocaleString()}
            </Text>
          </Box>

          <Box 
            flex flexDirection="column" alignItems="center"
            className={`p-3 rounded-xl transition-all w-5/12 ${activeWallet === 'promo' ? 'bg-blue-50 border-2 border-blue-400' : 'bg-gray-50'}`}
            onClick={() => setActiveWallet('promo')}
          >
            <Icon
              icon="zi-star"
              className={
                activeWallet === "promo" ? "text-blue-600" : "text-gray-400"
              }
            />
            <Text
              size="xxSmall"
              bold
              className={`mt-1 ${
                activeWallet === "promo" ? "text-blue-600" : "text-gray-400"
              }`}
            >
              Ví Ưu Đãi
            </Text>
            <Text bold size="normal">
              0
            </Text>
          </Box>
        </Box>
      </Box>

      {/* SECTION 2: THẺ TRẠNG THÁI */}
      <Box className={`m-4 p-5 rounded-2xl text-white shadow-xl transition-all ${activeWallet === 'main' ? 'bg-orange-500' : 'bg-blue-600'}`}>
        <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-6">
          <Box>
            <Text size="small" className="opacity-80 uppercase">{activeWallet === 'main' ? "Member Rank" : "Promo Status"}</Text>
            <Box flex alignItems="center" className="mt-1">
              <Icon
                icon={calculateMemberRankInfo(points).icon as any}
                size={24}
                className="mr-2"
              />
              <Text bold size="xLarge">
                {calculateMemberRankInfo(points).name}
              </Text>
            </Box>
          </Box>
          <Box className="text-right">
             <Text size="small" className="opacity-80">Số dư</Text>
             <Text bold size="xLarge">{activeWallet === 'main' ? points.toLocaleString() : "0"}</Text>
          </Box>
        </Box>
        <Progress completed={activeWallet === 'main' ? Math.min(100, (points / calculateMemberRankInfo(points).target) * 100) : 0} maxCompleted={100} showLabel={false} strokeColor="#ffffff" />
      </Box>

      {/* SECTION 3: CHIA SẺ ỨNG DỤNG & MÃ GIỚI THIỆU (MỚI BỔ SUNG) */}
      <Box className="m-4 p-4 bg-white rounded-xl shadow-md border border-orange-100">
        <Box flex alignItems="center" className="mb-3">
          <Icon icon="zi-share-external-1" className="text-orange-500 mr-2" />
          <Text bold size="small">
            Chia sẻ & Nhận quà
          </Text>
        </Box>
        <Box className="bg-orange-50 p-3 rounded-lg border border-dashed border-orange-300 flex justify-between items-center">
            <Box>
                <Text size="xxSmall" className="text-gray-500 uppercase">Mã giới thiệu của bạn</Text>
                <Text bold size="large" className="text-orange-600 letter-spacing-2">{referralCode}</Text>
            </Box>
            <Button 
                size="small" 
                variant="secondary" 
                type="highlight"
                onClick={handleCopyCode}
                className="h-8"
            >
                Sao chép
            </Button>
        </Box>
        <Text size="xxSmall" className="mt-2 text-gray-400 italic">
            * Chia sẻ mã này cho bạn bè khi đăng ký để nhận thêm điểm thưởng ưu đãi.
        </Text>
      </Box>

      {/* SECTION 4: LỊCH SỬ & THAO TÁC */}
      <Box className="mx-4 space-y-3">
          <Box className="bg-white flex justify-between items-center p-4 rounded-xl shadow-md" onClick={handleOpenHistory}>
              <Box flex alignItems="center">
                  <CustomIcon icon="zi-clock-2" className="mr-2 text-gray-500" />
                  <Text size="small" bold>Lịch sử {activeWallet === 'main' ? "tích điểm" : "ưu đãi"}</Text>
              </Box>
              <CustomIcon icon="zi-chevron-right" className="text-gray-400" />
          </Box>
      </Box>

      {/* MODAL LỊCH SỬ */}
      <Modal
          visible={showHistoryModal}
          title={activeWallet === 'main' ? "Lịch sử Ví Tích Điểm" : "Lịch sử Ví Ưu Đãi"}
          onClose={() => setShowHistoryModal(false)}
          actions={[{ text: "Đóng", onClick: () => setShowHistoryModal(false), highLight: true }]}
      >
          <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {historyLoading ? <Spinner /> : historyList.length > 0 ? (
                  historyList.map((item, idx) => (
                      <Box key={idx} className="mb-3 pb-3 border-b border-gray-100 flex justify-between items-center">
                          <Box>
                              <Text size="small" bold>{item.description}</Text>
                              <Text size="xxSmall">{formatDate(item.createdAt)}</Text>
                          </Box>
                          <Text size="small" className={item.type === 'plus' ? "text-green-600" : "text-red-600"}>
                              {item.type === 'plus' ? '+' : '-'}{item.amount?.toLocaleString()}
                          </Text>
                      </Box>
                  ))
              ) : <Text size="small" className="text-center text-gray-400">Không có dữ liệu.</Text>}
          </Box>
      </Modal>
    </Box>
  );
};

export default MemberView;