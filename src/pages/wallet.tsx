import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Text, Icon, Modal, Spinner } from "zmp-ui";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";

const calculateMemberRankInfo = (points: number) => {
  const p = points || 0;
  if (p < 5) return { name: "Thành viên mới", icon: "zi-user", target: 5 };
  if (p <= 100) return { name: "Hạng Đồng", icon: "zi-star", target: 101 };
  if (p <= 300) return { name: "Hạng Bạc", icon: "zi-star-solid", target: 301 };
  return { name: "Hạng Vàng", icon: "zi-star-solid", target: 1000 };
};

const WalletPage: FC = () => {
  const [activeTab, setActiveTab] = useState<'rank' | 'promo'>('rank');
  const [points, setPoints] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Lịch sử giao dịch
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          setPoints(docSnap.data().points || 0);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleOpenHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const walletType = activeTab === 'rank' ? 'main' : 'promo';
      const q = query(
        collection(db, "point_transactions"),
        where("userId", "==", userId),
        where("walletType", "==", walletType),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => doc.data());
      setHistoryList(docs);
    } catch (error) {
      console.error("Lỗi tải lịch sử:", error);
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

  const rankInfo = calculateMemberRankInfo(points);
  const progressPercent = Math.min(100, (points / rankInfo.target) * 100);

  return (
    <Page className="overflow-y-auto">
      <Header title="Ví tích điểm" showBackIcon={true} />

      {/* Tabs */}
      <Box className="flex justify-center space-x-4 mt-6 mx-4">
        <Box 
          onClick={() => setActiveTab('rank')}
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border ${activeTab === 'rank' ? 'bg-orange-50 border-orange-300' : 'bg-white border-green-100'} transition-all shadow-md`}
        >
          <Icon icon="zi-poll" className={activeTab === 'rank' ? 'text-orange-600' : 'text-gray-600'} />
          <Text size="small" bold className={`mt-1 ${activeTab === 'rank' ? 'text-orange-600' : 'text-gray-600'}`}>Ví Tính Hạng</Text>
        </Box>
        <Box 
          onClick={() => setActiveTab('promo')}
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border ${activeTab === 'promo' ? 'bg-blue-50 border-blue-300' : 'bg-white border-green-100'} transition-all shadow-md`}
        >
          <Icon icon="zi-star-solid" className={activeTab === 'promo' ? 'text-blue-600' : 'text-gray-600'} />
          <Text size="small" bold className={`mt-1 ${activeTab === 'promo' ? 'text-blue-600' : 'text-gray-600'}`}>Ví Ưu Đãi</Text>
        </Box>
      </Box>

      {/* Card Content */}
      <Box className="mx-4 mt-6">
        {activeTab === 'rank' ? (
          <Box className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl p-5 text-white shadow-md">
            <Box className="flex justify-between items-start mb-6">
              <Box>
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">HẠNG THÀNH VIÊN</Text>
                <Box className="flex items-center">
                  <Icon icon="zi-user" className="mr-2" />
                  <Text.Title className="font-bold">{rankInfo.name}</Text.Title>
                </Box>
              </Box>
              <Box className="text-right">
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">ĐIỂM TRỌN ĐỜI</Text>
                <Text.Title className="font-bold text-xl">{points.toLocaleString()}</Text.Title>
              </Box>
            </Box>
            
            <Box className="w-full bg-white/30 h-1.5 rounded-full mb-4">
              <Box className="bg-white h-1.5 rounded-full" style={{ width: `${progressPercent}%` }}></Box>
            </Box>

            <Text size="xxSmall" className="opacity-80 italic mb-4">* Điểm hạng không bao giờ bị trừ đi</Text>

            <Box className="border-t border-white/20 pt-3 text-center" onClick={handleOpenHistory}>
              <Text size="small" className="flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100">
                <Icon icon="zi-clock-2" className="mr-1" /> Xem lịch sử giao dịch
              </Text>
            </Box>
          </Box>
        ) : (
          <Box className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-md">
            <Box className="flex justify-between items-start mb-6">
              <Box>
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">ĐIỂM CÓ THỂ DÙNG</Text>
                <Text.Title className="font-bold mt-1">Đổi quà tặng</Text.Title>
              </Box>
              <Box className="text-right">
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">SỐ DƯ KHẢ DỤNG</Text>
                <Text.Title className="font-bold text-xl">0</Text.Title>
              </Box>
            </Box>

            <Text size="xxSmall" className="opacity-80 italic mb-4">* Điểm sẽ bị trừ khi bạn quy đổi Voucher.</Text>

            <Box className="border-t border-white/20 pt-3 text-center" onClick={handleOpenHistory}>
              <Text size="small" className="flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100">
                <Icon icon="zi-clock-2" className="mr-1" /> Xem lịch sử giao dịch
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Cửa hàng Voucher */}
      {activeTab === 'promo' && (
        <Box className="mx-4 mt-8">
          <Text className="font-bold text-[#14502e] text-lg mb-2">Cửa hàng đổi Voucher</Text>
          <Box className="border border-dashed border-green-300 rounded-2xl p-8 bg-white text-center shadow-md">
            <Text bold className="text-gray-800 mb-2">Chưa có đợt đổi quà</Text>
            <Text size="small" className="text-gray-500">Cửa hàng Voucher hiện đang đóng. Vui lòng theo dõi và quay lại vào đợt sau nhé!</Text>
          </Box>
        </Box>
      )}

      {/* Modal Lịch Sử */}
      <Modal
        visible={showHistoryModal}
        title={activeTab === 'rank' ? "Lịch sử Ví Tính Hạng" : "Lịch sử Ví Ưu Đãi"}
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
    </Page>
  );
};

export default WalletPage;
