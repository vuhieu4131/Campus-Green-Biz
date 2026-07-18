import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Text, Icon, Modal, Spinner } from "zmp-ui";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";

const isWithin15Days = (createdAt: any) => {
  if (!createdAt) return true;
  const date = createdAt.toDate ? createdAt.toDate() : (createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt));
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  return date >= fifteenDaysAgo;
};

const calculateMemberRankInfo = (points: number) => {
  const p = points || 0;
  if (p < 100) return { name: "Thành viên mới", icon: "zi-user", target: 100 };
  if (p < 500) return { name: "Hạng Đồng", icon: "zi-star", target: 500 };
  if (p < 1000) return { name: "Hạng Bạc", icon: "zi-star-solid", target: 1000 };
  if (p < 2000) return { name: "Hạng Vàng", icon: "zi-star-solid", target: 2000 };
  return { name: "Hạng Kim Cương", icon: "zi-star-solid", target: 999999 };
};

const WalletPage: FC = () => {
  const [activeTab, setActiveTab] = useState<'rank' | 'promo' | 'interaction'>('rank');
  const [points, setPoints] = useState(0);
  const [spendingPoints, setSpendingPoints] = useState(0);
  const [interactionPoints, setInteractionPoints] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Lịch sử giao dịch
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [eligiblePoints, setEligiblePoints] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPoints(data.rankPoints || data.points || 0);
          setSpendingPoints(data.spendingPoints || 0);
          setInteractionPoints(data.interactionPoints || 0);

          // Tính toán điểm tương tác khả dụng (>48h)
          try {
            const q = query(
              collection(db, "point_transactions"),
              where("userId", "==", user.uid),
              where("walletType", "==", "interaction")
            );
            const snap = await getDocs(q);
            const now = new Date();
            let plusSum = 0;
            let minusSum = 0;

            snap.forEach(d => {
              const tx = d.data();
              const isPlus = tx.type === "plus";
              if (isPlus) {
                const created = tx.createdAt?.toDate ? tx.createdAt.toDate() : (tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000) : null);
                if (created) {
                  const diffInHours = (now.getTime() - created.getTime()) / 3600000;
                  if (diffInHours >= 48) {
                    plusSum += tx.amount || 0;
                  }
                }
              } else {
                minusSum += tx.amount || 0;
              }
            });
            setEligiblePoints(Math.max(0, plusSum - minusSum));
          } catch (e) {
            console.error("Lỗi tính điểm khả dụng:", e);
          }
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
      const q = query(
        collection(db, "point_transactions"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs
        .map(doc => doc.data() as any)
        .filter(item => {
          const type = item.walletType || 'main';
          if (activeTab === 'rank') {
            return type === 'main' || type === 'all';
          } else if (activeTab === 'promo') {
            return type === 'promo' || type === 'main' || type === 'all';
          } else {
            return type === 'interaction';
          }
        })
        .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
        });
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
      <Box className="flex justify-center space-x-2.5 mt-6 mx-4">
        <Box 
          onClick={() => setActiveTab('rank')}
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border cursor-pointer ${activeTab === 'rank' ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-gray-100 text-gray-500'} transition-all shadow-sm`}
        >
          <CustomIcon icon="zi-poll" className={activeTab === 'rank' ? 'text-orange-600' : 'text-gray-500'} />
          <Text size="small" bold className="mt-1">Ví Tính Hạng</Text>
        </Box>
        <Box 
          onClick={() => setActiveTab('promo')}
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border cursor-pointer ${activeTab === 'promo' ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white border-gray-100 text-gray-500'} transition-all shadow-sm`}
        >
          <CustomIcon icon="zi-star-solid" className={activeTab === 'promo' ? 'text-blue-600' : 'text-gray-500'} />
          <Text size="small" bold className="mt-1">Ví Ưu Đãi</Text>
        </Box>
        <Box 
          onClick={() => setActiveTab('interaction')}
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border cursor-pointer ${activeTab === 'interaction' ? 'bg-[#288F4E]/10 border-[#288F4E] text-[#288F4E]' : 'bg-white border-gray-100 text-gray-500'} transition-all shadow-sm`}
        >
          <CustomIcon icon="zi-chat" className={activeTab === 'interaction' ? 'text-[#288F4E]' : 'text-gray-500'} />
          <Text size="small" bold className="mt-1">Ví Tương Tác</Text>
        </Box>
      </Box>

      {/* Card Content */}
      <Box className="mx-4 mt-6">
        {activeTab === 'rank' && (
          <Box className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl p-5 text-white shadow-md">
            <Box className="flex justify-between items-start mb-6">
              <Box>
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">HẠNG THÀNH VIÊN</Text>
                <Box className="flex items-center">
                  <CustomIcon icon="zi-user" className="mr-2" />
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
              <Text size="small" className="flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 font-bold">
                <CustomIcon icon="zi-clock-2" className="mr-1" /> Xem lịch sử giao dịch
              </Text>
            </Box>
          </Box>
        )}

        {activeTab === 'promo' && (
          <Box className="bg-gradient-to-r from-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-md">
            <Box className="flex justify-between items-start mb-6">
              <Box>
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">ĐIỂM CÓ THỂ DÙNG</Text>
                <Text.Title className="font-bold mt-1">Đổi quà tặng</Text.Title>
              </Box>
              <Box className="text-right">
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">SỐ DƯ KHẢ DỤNG</Text>
                <Text.Title className="font-bold text-xl">{spendingPoints.toLocaleString()}</Text.Title>
              </Box>
            </Box>

            <Text size="xxSmall" className="opacity-80 italic mb-4">* Điểm sẽ bị trừ khi bạn quy đổi Voucher.</Text>

            <Box className="border-t border-white/20 pt-3 text-center" onClick={handleOpenHistory}>
              <Text size="small" className="flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 font-bold">
                <CustomIcon icon="zi-clock-2" className="mr-1" /> Xem lịch sử giao dịch
              </Text>
            </Box>
          </Box>
        )}

        {activeTab === 'interaction' && (
          <Box className="bg-gradient-to-r from-[#14502e] to-[#288F4E] rounded-2xl p-5 text-white shadow-md">
            <Box className="flex justify-between items-start mb-6">
              <Box>
                <Text size="xSmall" className="uppercase opacity-80 mb-1 tracking-wider">TÍCH LŨY TƯƠNG TÁC</Text>
                <Text.Title className="font-bold mt-1">Ví Tương Tác</Text.Title>
              </Box>
              <Box className="text-right flex space-x-3 items-center">
                <Box>
                  <Text size="xxxxSmall" className="opacity-75 block text-right">Tổng điểm</Text>
                  <Text.Title className="font-bold text-base mt-0.5 block text-right">{interactionPoints.toLocaleString()}</Text.Title>
                </Box>
                <Box className="border-l border-white/20 pl-3">
                  <Text size="xxxxSmall" className="opacity-90 block text-right font-bold text-yellow-300">{"Khả dụng (>48h)"}</Text>
                  <Text.Title className="font-bold text-base mt-0.5 block text-right text-yellow-300">{eligiblePoints.toLocaleString()}</Text.Title>
                </Box>
              </Box>
            </Box>

            <Box className="w-full bg-white/30 h-1.5 rounded-full mb-4">
              <Box className="bg-white h-1.5 rounded-full" style={{ width: `${Math.min(100, (interactionPoints / 500) * 100)}%` }}></Box>
            </Box>

            <Text size="xxSmall" className="opacity-80 italic mb-4">* Điểm khả dụng là điểm đã tích lũy đủ 48 giờ và không bị hoàn tác.</Text>

            <Box className="border-t border-white/20 pt-3 text-center" onClick={handleOpenHistory}>
              <Text size="small" className="flex items-center justify-center cursor-pointer opacity-90 hover:opacity-100 font-bold">
                <CustomIcon icon="zi-clock-2" className="mr-1" /> Xem lịch sử giao dịch
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
        title={activeTab === 'rank' ? "Lịch sử Ví Tính Hạng" : activeTab === 'promo' ? "Lịch sử Ví Ưu Đãi" : "Lịch sử Ví Tương Tác"}
        onClose={() => setShowHistoryModal(false)}
        actions={[{ text: "Đóng", onClick: () => setShowHistoryModal(false), highLight: true }]}
      >
        <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {historyLoading ? <Spinner /> : historyList.filter(item => isWithin15Days(item.createdAt)).length > 0 ? (
            historyList.filter(item => isWithin15Days(item.createdAt)).map((item, idx) => (
              <Box key={idx} className="mb-3 pb-3 border-b border-gray-100 flex justify-between items-center">
                <Box>
                  <Text size="small" bold>{item.description}</Text>
                  <Text size="xxSmall">{formatDate(item.createdAt)}</Text>
                </Box>
                <Text size="small" className={item.type === 'plus' ? "text-[#288F4E]" : "text-red-600"}>
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
