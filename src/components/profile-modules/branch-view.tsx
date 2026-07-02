import React, { FC, useState, useEffect } from "react";
// 👉 Đã import thêm Avatar, Spinner để dùng cho danh sách khách hàng
import { Box, Text, Icon, Button, List, Modal, Input, useSnackbar, Avatar, Spinner, Select } from "zmp-ui";
const { Option } = Select;
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, limit, where, getDocs, increment, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase"; 
// 👉 Import API chia sẻ của Zalo
import { openShareSheet } from "zmp-sdk/apis";

const { Item } = List;
const { TextArea } = Input;

// Thay bằng App ID Zalo Mini App của bạn
const YOUR_APP_ID = "2196212719506893777"; 

interface BranchViewProps {
  userData: any;
  onLogout: () => void;
}
// --- 1. HÀM TÍNH RANK (Đồng bộ với Shop chính) ---
const calculateRank = (points: number) => {
  const p = points || 0;
  if (p < 100) return { name: "Thành viên", color: "#94a3b8", next: 100, min: 0, icon: "zi-user" };
  if (p < 500) return { name: "Đồng", color: "#b45309", next: 500, min: 100, icon: "zi-star-solid" };
  if (p < 2000) return { name: "Bạc", color: "#64748b", next: 2000, min: 500, icon: "zi-medal-solid" };
  return { name: "Vàng", color: "#fbbf24", next: p, min: 2000, icon: "zi-trophy-solid" };
};
export const BranchView: FC<BranchViewProps> = ({ userData, onLogout }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();

  const branchInfo = userData?.branchInfo || {};

  // Các State quản lý Modal cơ bản
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTab, setFeedbackTab] = useState("new"); 
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);

  // Lắng nghe real-time số lượng phản hồi Admin đã trả lời nhưng chưa đọc
  useEffect(() => {
      if (!userData.phone) return;
      const q = query(collection(db, "feedbacks"), where("userId", "==", userData.phone));
      const unsubscribe = onSnapshot(q, (snap) => {
          let count = 0;
          snap.docs.forEach(doc => {
              const data = doc.data();
              // Nếu Admin đã trả lời (done) và user chưa đọc (chưa có userRead hoặc userRead = false)
              if (data.status === 'done' && !data.userRead) {
                  count++;
              }
          });
          setUnreadFeedbackCount(count);
      });
      return () => unsubscribe();
  }, [userData]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralList, setReferralList] = useState<any[]>([]);
  const [referralTab, setReferralTab] = useState("month"); // 👉 BƯỚC 1: State cho Tab của Modal khách hàng
  const [showShareModal, setShowShareModal] = useState(false);

  // 👉 Tự động tải danh sách khách hàng do Quản lý giới thiệu
  useEffect(() => {
      const fetchReferrals = async () => {
          if (!userData.phone) return;
          try {
              const q = query(collection(db, "users"), where("referrer", "==", userData.phone));
              const snap = await getDocs(q);
              const list = snap.docs.map(doc => doc.data());
              // Sắp xếp người mới nhất lên đầu
              list.sort((a: any, b: any) => {
                  const timeA = a.createdAt?.seconds || new Date(a.createdAt).getTime() / 1000 || 0;
                  const timeB = b.createdAt?.seconds || new Date(b.createdAt).getTime() / 1000 || 0;
                  return timeB - timeA;
              });
              setReferralList(list);
          } catch (error) { console.error("Lỗi tải khách hàng:", error); }
      };
      fetchReferrals();
  }, [userData]);

  // 👉 Lọc ra khách hàng tham gia trong THÁNG NÀY
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const newMembersThisMonth = referralList.filter(user => {
      if (!user.createdAt) return false;
      const dateObj = user.createdAt.toDate ? user.createdAt.toDate() : 
                     (user.createdAt.seconds ? new Date(user.createdAt.seconds * 1000) : new Date(user.createdAt));
                     
      const userMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      return userMonth === currentMonthStr;
  });

  // --- CÁC HÀM XỬ LÝ ---
  const handleChangePassword = async () => {
      if (!userData.phone) return;
      if (!oldPass || !newPass || !confirmPass) return openSnackbar({ text: "Nhập đủ thông tin", type: "warning" });
      if (newPass !== confirmPass) return openSnackbar({ text: "Mật khẩu không khớp", type: "error" });
      if (oldPass !== userData.password) return openSnackbar({ text: "Mật khẩu cũ sai", type: "error" });
      setPassLoading(true);
      try {
          await updateDoc(doc(db, "users", userData.phone), { password: newPass });
          openSnackbar({ text: "Đổi mật khẩu thành công!", type: "success" });
          setShowChangePassModal(false); setOldPass(""); setNewPass(""); setConfirmPass("");
      } catch (error) { openSnackbar({ text: "Lỗi hệ thống", type: "error" }); } finally { setPassLoading(false); }
  };

  const handleSendFeedback = async () => {
      if (!userData.phone) return;
      if (!feedbackContent.trim()) return openSnackbar({ text: "Nhập nội dung", type: "warning" });
      setFeedbackLoading(true);
      try {
        await addDoc(collection(db, "feedbacks"), { 
            userId: userData.phone, userName: userData.name, userPhone: userData.phone, 
            role: "user", // (Hoặc provider/branch_manager tùy file)
            content: feedbackContent, createdAt: serverTimestamp(), status: "new" 
        });
        openSnackbar({ text: "Đã gửi phản hồi!", type: "success" });
        setFeedbackContent("");
        setFeedbackTab("history"); // Chuyển sang tab lịch sử
        fetchMyFeedbacks();        // Tải lại dữ liệu mới nhất
    } catch (error) { openSnackbar({ text: "Lỗi gửi", type: "error" }); } finally { setFeedbackLoading(false); }
  };
  const fetchMyFeedbacks = async () => {
    setLoadingFeedbacks(true);
    try {
        const q = query(collection(db, "feedbacks"), where("userId", "==", userData.phone));
        const snap = await getDocs(q);
        
        let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sắp xếp tin mới lên đầu
        list.sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
        
        setFeedbackList(list);

        // 👉 Đánh dấu "Đã đọc" cho các tin Admin đã trả lời để tắt chấm đỏ
        const unreadDocs = snap.docs.filter(doc => doc.data().status === 'done' && !doc.data().userRead);
        unreadDocs.forEach(async (d) => {
            await updateDoc(doc(db, "feedbacks", d.id), { userRead: true }).catch(err => console.log(err));
        });

    } catch (error) {
        console.error("Lỗi tải lịch sử phản hồi:", error);
    } finally {
        setLoadingFeedbacks(false);
    }
  };
  const fetchHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, "points_history"),
        where("userId", "==", userData.phone),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map(d => d.data()));
    } catch (e) { 
      console.error("Lỗi lấy lịch sử:", e); 
    } finally { 
      setHistoryLoading(false); 
    }
  };

  // 👉 THÊM MỚI: STATE QUẢN LÝ ĐƠN HÀNG (CHI NHÁNH)
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderList, setOrderList] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  // 👇 THÊM MỚI: Các State dùng cho chức năng Hủy Đơn có lý do
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  // 👉 BƯỚC 1: Thêm State cho Tab và Thanh tìm kiếm
  const [orderTab, setOrderTab] = useState("pending"); // Mặc định mở tab "Mới"
  const [searchQuery, setSearchQuery] = useState("");
  // 👉 THÊM MỚI: Đếm số đơn hàng Chi nhánh cần xử lý (pending & confirmed)
  // 👉 BƯỚC 2: STATE CHO THỐNG KÊ & LẤY DỮ LIỆU TỰ ĐỘNG
  const [statsMonth, setStatsMonth] = useState<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  // 👉 BƯỚC 1: State mở Modal Chi tiết Doanh thu tháng
  const [showMonthlyStatsModal, setShowMonthlyStatsModal] = useState(false);
  // Tự động tải TẤT CẢ đơn hàng của chi nhánh khi vừa vào App
  useEffect(() => {
      const fetchAllBranchOrders = async () => {
          if (!userData.phone) return;
          try {
              const q = query(collection(db, "orders"), where("location.managerPhone", "==", userData.phone));
              const snap = await getDocs(q);
              const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              orders.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              setOrderList(orders);
          } catch (error) { console.error("Lỗi tải đơn:", error); }
      };
      fetchAllBranchOrders();
  }, [userData]);

  // Tự động đếm đơn chờ xử lý
  const actionableCount = orderList.filter(o => o.status === "pending" || o.status === "confirmed").length;

  // Tự động tính thống kê theo tháng được chọn
  const monthlyStats = orderList.reduce((acc, o) => {
      if (o.status !== 'completed' && o.status !== 'success') return acc;
      if (!o.createdAt) return acc;
      const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt.seconds * 1000);
      const orderMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (orderMonth === statsMonth) {
          acc.revenue += Number(o.totalAmount || o.totalPrice || o.total || 0);
          acc.count += 1;
      }
      return acc;
  }, { revenue: 0, count: 0 });

  // Tạo danh sách 12 tháng gần nhất cho Dropdown
  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
          value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
      };
  });

  // 👉 ĐÃ NÂNG CẤP: Xử lý cộng điểm khi hoàn thành đơn
  // 👉 ĐÃ NÂNG CẤP: Chốt Chi phí nền tảng & Cộng điểm khi hoàn thành đơn
  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
        let updateData: any = { status: newStatus };

        // NẾU LÀ HOÀN THÀNH -> TÍNH CHI PHÍ NỀN TẢNG VÀ ĐIỂM
        if (newStatus === 'completed') {
            const totalAmount = Number(order.totalAmount || order.totalPrice || order.total || 0);

            // 1. TÍNH CHI PHÍ NỀN TẢNG
            let platformFeeRate = 10; // Mặc định là 10%
            
            // Lấy tỷ lệ phí do Admin cài đặt từ hệ thống (nếu có)
            try {
                const configRef = doc(db, "system_config", "admin_settings");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().platformFeeRate !== undefined) {
                    platformFeeRate = Number(configSnap.data().platformFeeRate);
                }
            } catch (e) { console.log("Lỗi lấy tỷ lệ phí Admin:", e); }

            // Tính ra số tiền phí nền tảng và gán vào dữ liệu cần cập nhật
            const platformFee = Math.floor(totalAmount * (platformFeeRate / 100));
            updateData.platformFee = platformFee;
            updateData.platformFeeRate = platformFeeRate;

            // 2. TỰ ĐỘNG CỘNG ĐIỂM TÍCH LŨY (Quy đổi: 10.000đ = 1 điểm)
            const pointsEarned = Math.floor(totalAmount / 10000); 
            if (pointsEarned > 0) {
                if (order.userId) {
                    const userRef = doc(db, "users", order.userId);
                    await updateDoc(userRef, { spendingPoints: increment(pointsEarned), rankPoints: increment(pointsEarned) }).catch(e => console.log("Lỗi", e));
                    await addDoc(collection(db, "point_transactions"), { userId: order.userId, type: "plus", amount: pointsEarned, description: `Tích điểm từ đơn hàng #${order.id.slice(0,6).toUpperCase()}`, walletType: "main", createdAt: serverTimestamp() });
                }
                if (order.shopId) {
                    const shopRef = doc(db, "users", order.shopId);
                    await updateDoc(shopRef, { spendingPoints: increment(pointsEarned), rankPoints: increment(pointsEarned) }).catch(e => console.log("Lỗi", e));
                }
            }
        }

        // 3. LƯU TẤT CẢ VÀO FIREBASE (Cập nhật trạng thái + Phí nền tảng trong 1 lần)
        await updateDoc(doc(db, "orders", order.id), updateData);

        // Cập nhật lại giao diện ngay lập tức
        setOrderList(prev => prev.map(o => o.id === order.id ? { ...o, ...updateData } : o));
        openSnackbar({ text: "Đã xử lý đơn hàng thành công!", type: "success" });
    } catch (error) {
        console.error(error);
        openSnackbar({ text: "Lỗi cập nhật", type: "error" });
    }
};

  // 👇 THÊM MỚI: Hàm xử lý Hủy đơn và lưu lý do
  const handleConfirmCancelOrder = async () => {
    if (!cancelReason.trim()) {
        return openSnackbar({ text: "Vui lòng nhập lý do hủy đơn!", type: "warning" });
    }
    setCancelLoading(true);
    try {
        await updateDoc(doc(db, "orders", selectedOrderToCancel.id), {
            status: 'cancelled',
            cancelReason: cancelReason,
            cancelledAt: serverTimestamp(),
            cancelledBy: userData.phone // Lưu lại SĐT người thao tác hủy
        });

        // Cập nhật lại danh sách trên màn hình ngay lập tức
        setOrderList(prev => prev.map(o => 
            o.id === selectedOrderToCancel.id 
                ? { ...o, status: 'cancelled', cancelReason: cancelReason } 
                : o
        ));
        
        openSnackbar({ text: "Đã hủy đơn hàng thành công!", type: "success" });
        // Đóng pop-up và reset dữ liệu
        setShowCancelModal(false);
        setCancelReason("");
        setSelectedOrderToCancel(null);
    } catch (error) {
        console.error(error);
        openSnackbar({ text: "Lỗi khi hủy đơn", type: "error" });
    } finally {
        setCancelLoading(false);
    }
};
  // Tính toán rank hiện tại của Quản lý
  const rank = calculateRank(userData.spendingPoints || 0);
  
  // 👉 THÊM MỚI: Các hàm xử lý chia sẻ
  const getShareLink = () => `https://zalo.me/s/${YOUR_APP_ID}/?referral=${userData.phone}`;
  const handleSystemShare = async () => { 
      try { 
          await openShareSheet({ 
              type: "zmp_deep_link", 
              data: { 
                  title: `Ghé thăm ${branchInfo.branchName || "cơ sở của chúng tôi"}!`, 
                  description: "Đặt lịch dịch vụ chăm sóc sức khỏe uy tín & nhận ưu đãi.", 
                  thumbnail: userData.avatar || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png", 
              }, 
          } as any); 
      } catch (err) { console.log(err); } 
  };
  const copyShareLink = () => { 
      if(!navigator.clipboard) return openSnackbar({text:"Thiết bị không hỗ trợ copy", type:"warning"}); 
      navigator.clipboard.writeText(getShareLink()).then(() => openSnackbar({ text: "Đã sao chép link!", type: "success" })); 
  };

  return (
    <Box className="animate-fade-in pb-10 min-h-screen bg-gray-50">
      
      {/* 1. HEADER THÔNG TIN CHI NHÁNH */}
      <Box 
        className="p-6 m-4 rounded-2xl shadow-md text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" }} 
      >
        <Box className="relative z-10 flex flex-col gap-1">
           <Text size="xSmall" className="text-blue-100 uppercase tracking-wider font-semibold">
               Trực thuộc: {branchInfo.mainShopName || "Hệ thống trung tâm"}
           </Text>
           <Text.Title size="large" className="font-bold text-white drop-shadow-md">
               {branchInfo.branchName || "Chi nhánh trực thuộc"}
           </Text.Title>
           <Box flex alignItems="center" className="mt-1 text-gray-300">
               <Icon icon={"zi-call" as any} size={14} className="mr-1" />
               <Text size="small" bold>{userData.phone}</Text>
           </Box>
           <Box flex alignItems="center" className="text-blue-50 mt-1">
               <Icon icon={"zi-location-solid" as any} size={16} className="mt-0.5 mr-1" />
               <Text size="small" className="line-clamp-2 leading-tight">
                   {branchInfo.branchAddress || "Chưa cập nhật địa chỉ"}
               </Text>
           </Box>
        </Box>
        <Icon icon={"zi-home" as any} className="absolute -bottom-6 -right-4 opacity-20 text-white" style={{ fontSize: 100 }} />
      </Box>
      
      {/* 👉 BƯỚC 3: THỐNG KÊ TỔNG QUAN & QUẢN LÝ ĐƠN */}
      <Box className="mx-4 mb-5">
          {/* Ô Thống kê doanh thu */}
          <Box className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 mb-4">
              <Box flex justifyContent="space-between" alignItems="center" className="mb-4">
                  <Text bold size="normal" className="text-gray-800">Thống kê tổng quan</Text>
                  <Box className="w-36">
                      <Select
                          value={statsMonth}
                          onChange={(val) => setStatsMonth(val as string)}
                          closeOnSelect
                      >
                          {monthOptions.map(opt => (
                              <Option key={opt.value} value={opt.value} title={opt.label} />
                          ))}
                      </Select>
                  </Box>
              </Box>
              
              <Box className="grid grid-cols-2 gap-3">
                  {/* 👉 BƯỚC 2: Thêm onClick và hiệu ứng bấm cho ô Doanh thu */}
                  <Box 
                      className="bg-green-50 p-3 rounded-xl border border-green-100 flex flex-col justify-center items-center cursor-pointer active:opacity-70 transition"
                      onClick={() => setShowMonthlyStatsModal(true)}
                  >
                      <Text size="xSmall" className="text-green-600 mb-1">Doanh thu tháng</Text>
                      <Text bold size="large" className="text-green-700">{monthlyStats.revenue.toLocaleString()}đ</Text>
                  </Box>

                  {/* 👉 Thêm onClick và hiệu ứng bấm cho ô Đã phục vụ */}
                  <Box 
                      className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col justify-center items-center cursor-pointer active:opacity-70 transition"
                      onClick={() => setShowMonthlyStatsModal(true)}
                  >
                      <Text size="xSmall" className="text-blue-600 mb-1">Đã phục vụ</Text>
                      <Text bold size="large" className="text-blue-700">{monthlyStats.count} đơn</Text>
                  </Box>
              </Box>
          </Box>

          {/* Nút Quản lý Đơn hàng (Kéo dài toàn màn hình) */}
          <Box 
              className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 flex flex-row items-center justify-between cursor-pointer active:bg-gray-50 transition" 
              onClick={() => navigate('/branch-orders')} // 👇 Đổi thành lệnh navigate
          >
              <Box flex alignItems="center">
                  <Box className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mr-3 relative border border-orange-100">
                      <Icon icon={"zi-note" as any} className="text-orange-600" size={24}/>
                      {actionableCount > 0 && (
                          <Box className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-md">
                              {actionableCount}
                          </Box>
                      )}
                  </Box>
                  <Box>
                      <Text size="normal" bold className="text-gray-800">Quản lý Đơn hàng</Text>
                      <Text size="xSmall" className="text-gray-500">Xác nhận đơn & Nhận khách</Text>
                  </Box>
              </Box>
              <Box className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                  <Icon icon="zi-chevron-right" className="text-gray-400" size={20} />
              </Box>
          </Box>
      </Box>

     {/* 3. MENU QUẢN LÝ TÀI KHOẢN */}
<Box className="mx-4 mb-4">
  <Box className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
    <Text.Title size="small" className="p-4 pb-2 text-gray-500 font-bold bg-gray-50">Cài đặt & Hỗ trợ</Text.Title>
    
    {/* 👉 PHẦN THÔNG TIN QUẢN LÝ: Tách riêng khỏi List để tránh lỗi subTitle (không dùng Item) */}
    <Box className="p-4 border-b border-gray-100 active:bg-gray-50 cursor-pointer transition" onClick={fetchHistory}>
      <Box flex alignItems="center" className="mb-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-50 mr-3">
          <Icon icon={"zi-user" as any} className="text-indigo-600" size={20}/>
        </div>
        <Box>
          <Text size="small" bold className="text-gray-700">Thông tin Quản lý</Text>
          <Text size="xSmall" className="text-gray-500">{userData.name} - {userData.phone}</Text>
        </Box>
      </Box>

      {/* 👉 BƯỚC 2: KHU VỰC VÍ ĐIỂM (GỘP HẠNG) VÀ THỐNG KÊ KHÁCH MỚI */}
      <Box flex className="mt-3 p-3 bg-gray-50 rounded-t-xl border-x border-t border-gray-100 divide-x divide-gray-200">
        
        {/* Cột 1: Điểm & Hạng (Bấm vào mở Lịch sử) */}
        <Box className="flex-1 flex flex-col items-center justify-center px-2 cursor-pointer active:opacity-70" onClick={fetchHistory}>
          <Text size="xxSmall" className="text-gray-400 font-bold uppercase mb-1">Điểm & Hạng</Text>
          <Box flex alignItems="baseline">
            <Icon icon="zi-star-solid" size={14} className="text-orange-500 mr-1" />
            <Text bold size="large" className="text-gray-800">
              {(userData.spendingPoints || 0).toLocaleString()}
            </Text>
          </Box>
          <Text size="xSmall" bold style={{ color: rank.color }}>{rank.name}</Text>
        </Box>

        {/* Cột 2: Khách mới tháng này (Bấm vào mở Danh sách) */}
        <Box className="flex-1 flex flex-col items-center justify-center px-2 cursor-pointer active:opacity-70" onClick={() => { setReferralTab("month"); setShowReferralModal(true); }}>
          <Text size="xxSmall" className="text-gray-400 font-bold uppercase mb-1">Khách mới (Tháng)</Text>
          <Box flex alignItems="baseline">
            <Icon icon="zi-user" size={14} className="text-blue-500 mr-1" />
            <Text bold size="large" className="text-blue-600">{newMembersThisMonth.length}</Text>
          </Box>
          <Text size="xSmall" className="text-gray-500">Xem danh sách</Text>
        </Box>

      </Box>

      {/* THANH TIẾN TRÌNH */}
      <Box className="p-2 bg-gray-50 rounded-b-xl border-x border-b border-gray-100">
        {(userData.spendingPoints || 0) < 2000 ? (
          <Box>
            <Box className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-1.5">
              <Box 
                className="h-full transition-all duration-500" 
                style={{ 
                  width: `${Math.max(0, Math.min(100, (((userData.spendingPoints || 0) - rank.min) / (rank.next - rank.min)) * 100))}%`,
                  backgroundColor: rank.color 
                }} 
              />
            </Box>
            <Text size="xxSmall" className="text-gray-500 italic">
              Bạn còn <span className="font-bold text-blue-600">{(rank.next - (userData.spendingPoints || 0)).toLocaleString()} điểm</span> để đạt hạng tiếp theo
            </Text>
          </Box>
        ) : (
          <Box flex alignItems="center" className="py-1">
            <Icon icon="zi-check-circle-solid" size={14} className="text-orange-500 mr-1" />
            <Text size="xxSmall" className="text-orange-600 font-bold uppercase tracking-tight">
              Bạn đã đạt cấp bậc cao nhất (Vàng)
            </Text>
          </Box>
        )}
      </Box>
    </Box>

    {/* 👉 CÁC MỤC MENU CÒN LẠI: Giữ trong List và dùng kiểu dữ liệu string */}
    <List className="px-1 py-1">
      <Item 
        title="Danh sách khách hàng"
        subTitle="Người dùng do bạn giới thiệu"
        prefix={<div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100/50"><Icon icon={"zi-group" as any} className="text-orange-600" size={20}/></div>} 
        suffix={<Icon icon={"zi-chevron-right" as any} className="text-gray-400"/>} 
        onClick={() => { setReferralTab("all"); setShowReferralModal(true); }} 
        className="p-3 m-1 rounded-xl cursor-pointer active:bg-gray-50 transition"
      />

      <Item 
        title="Chia sẻ ứng dụng"
        subTitle="QR Code + Mã giới thiệu"
        prefix={<div className="w-10 h-10 rounded-full flex items-center justify-center bg-pink-100/50"><Icon icon={"zi-share-external-1" as any} className="text-pink-600" size={20}/></div>} 
        suffix={<Icon icon={"zi-chevron-right" as any} className="text-gray-400"/>} 
        onClick={() => setShowShareModal(true)} 
        className="p-3 m-1 rounded-xl cursor-pointer active:bg-gray-50 transition"
      />

      <Item 
        title="Đổi mật khẩu đăng nhập"
        prefix={<div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100/50"><Icon icon="zi-lock" className="text-red-600" size={20}/></div>} 
        suffix={<Icon icon={"zi-chevron-right" as any} className="text-gray-400"/>} 
        onClick={() => setShowChangePassModal(true)} 
        className="p-3 m-1 rounded-xl cursor-pointer active:bg-gray-50 transition"
      />

<Item 
    title="Gửi phản hồi / Yêu cầu hỗ trợ"
    prefix={<div className="w-10 h-10 rounded-full flex items-center justify-center bg-teal-100/50"><Icon icon="zi-chat" className="text-teal-600" size={20}/></div>} 
    suffix={
        <Box flex alignItems="center">
            {unreadFeedbackCount > 0 && (
                <Box className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 shadow-md animate-pulse">
                    {unreadFeedbackCount} mới
                </Box>
            )}
            <Icon icon={"zi-chevron-right" as any} className="text-gray-400"/>
        </Box>
    } 
    onClick={() => { setShowFeedbackModal(true); fetchMyFeedbacks(); }} 
    className="p-3 m-1 rounded-xl cursor-pointer active:bg-gray-50 transition"
/>

      <Item 
        title="Đăng xuất"
        prefix={<div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100/50"><Icon icon="zi-leave" className="text-red-500" size={20}/></div>} 
        onClick={onLogout} 
        className="p-3 m-1 rounded-xl cursor-pointer active:bg-gray-50 transition"
      />
    </List>
  </Box>
</Box>

      {/* --- CÁC MODAL --- */}
      {/* 👉 THÊM MỚI: MODAL DANH SÁCH KHÁCH HÀNG */}
      {/* 👉 BƯỚC 4: MODAL DANH SÁCH KHÁCH HÀNG (CÓ TAB) */}
      <Modal visible={showReferralModal} title="Khách hàng giới thiệu" onClose={() => setShowReferralModal(false)} actions={[{ text: "Đóng", onClick: () => setShowReferralModal(false) }]}>
          <Box p={0}>
              {/* THANH TAB */}
              <Box flex className="border-b border-gray-200 px-2 pt-2 bg-white">
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${referralTab==="month"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setReferralTab("month")}>
                      Tháng này ({newMembersThisMonth.length})
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${referralTab==="all"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setReferralTab("all")}>
                      Tất cả ({referralList.length})
                  </Box>
              </Box>

              {/* DANH SÁCH */}
              <Box p={4} className="bg-gray-50 hide-scroll" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                  {(() => {
                      const listToRender = referralTab === "month" ? newMembersThisMonth : referralList;
                      
                      if (listToRender.length === 0) {
                          return (
                              <Box flex flexDirection="column" alignItems="center" py={5}>
                                  <Icon icon="zi-group" size={40} className="text-gray-300 mb-2"/>
                                  <Text size="small" className="text-center text-gray-400">Chưa có khách hàng nào.</Text>
                              </Box>
                          );
                      }

                      return listToRender.map((cus, idx) => {
                          const dateObj = cus.createdAt?.toDate ? cus.createdAt.toDate() : 
                                         (cus.createdAt?.seconds ? new Date(cus.createdAt.seconds * 1000) : new Date(cus.createdAt));
                          
                          return (
                              <Box key={idx} flex alignItems="center" className="mb-3 p-3 bg-white border border-gray-100 rounded-xl shadow-md animate-fade-in-up">
                                  <Avatar src={cus.avatar || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"} size={44} className="border border-gray-200" />
                                  <Box ml={3} className="flex-1">
                                      <Text size="small" bold className="text-gray-800">{cus.name}</Text>
                                      <Text size="xSmall" className="text-gray-500">{cus.phone}</Text>
                                  </Box>
                                  <Box className="text-right">
                                      <Text size="xxxxSmall" className="text-gray-400 uppercase">Tham gia</Text>
                                      <Text size="xSmall" bold className="text-blue-600">
                                          {dateObj ? dateObj.toLocaleDateString('vi-VN') : "Gần đây"}
                                      </Text>
                                  </Box>
                              </Box>
                          );
                      });
                  })()}
              </Box>
          </Box>
      </Modal>

      {/* 👉 THÊM MỚI: MODAL CHIA SẺ ỨNG DỤNG */}
      <Modal visible={showShareModal} title="Chia sẻ ứng dụng" onClose={() => setShowShareModal(false)}>
        <Box p={5} flex flexDirection="column" alignItems="center" className="text-center animate-fade-in">
            <Text size="small" className="text-gray-600 mb-5">Quét mã QR hoặc gửi link để mời khách!</Text>
            <Box className="border-2 border-blue-400 rounded-2xl p-2 mb-6 shadow-md bg-white">
    <img 
        src="https://firebasestorage.googleapis.com/v0/b/nlyv-care.firebasestorage.app/o/Banner%2FTam%20An_QR.jpg?alt=media&token=657b5a1a-3784-4e75-9d07-dc760e5e07a2" 
        alt="Mã QR Tam An" 
        style={{ width: 180, height: 180 }} 
    />
</Box>
            <Box className="bg-gray-50 p-3 rounded-xl w-full text-center mb-5 border border-gray-200">
                <Text size="xSmall" className="text-gray-500 mb-1 uppercase tracking-wider">Mã giới thiệu (SĐT của bạn)</Text>
                <Text size="large" bold className="text-blue-600 tracking-wider">{userData.phone}</Text>
            </Box>
            <Button fullWidth onClick={copyShareLink} prefixIcon={<Icon icon={"zi-copy" as any}/>} className="mb-3">Sao chép liên kết</Button>
            <Button fullWidth variant="secondary" className="text-blue-600 bg-blue-50 border-none" onClick={handleSystemShare} prefixIcon={<Icon icon={"zi-chat" as any}/>}>Gửi qua Zalo</Button>
        </Box>
      </Modal>

      {/* CÁC MODAL CŨ */}
      <Modal visible={showChangePassModal} title="Đổi mật khẩu bảo mật" onClose={() => setShowChangePassModal(false)} actions={[{text:"Đóng", onClick:()=>setShowChangePassModal(false)}]}>
        <Box p={5} className="flex flex-col gap-1.5">
            <Box mb={4}><Input.Password label="Mật khẩu hiện tại" value={oldPass} onChange={(e) => setOldPass(e.target.value)} clearable /></Box>
            <Box mb={4}><Input.Password label="Mật khẩu mới" value={newPass} onChange={(e) => setNewPass(e.target.value)} clearable /></Box>
            <Box mb={4}><Input.Password label="Xác nhận mật khẩu mới" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} clearable /></Box>
            <Button fullWidth loading={passLoading} onClick={handleChangePassword}>Cập nhật mật khẩu</Button>
        </Box>
      </Modal>

      <Modal visible={showFeedbackModal} title="Phản hồi & Hỗ trợ" onClose={() => setShowFeedbackModal(false)}>
          <Box p={0} className="bg-gray-50 flex flex-col" style={{ height: '70vh' }}>
              
              {/* THANH TAB */}
              {/* 2. THANH TAB CHUYỂN ĐỔI (Vuốt ngang thông minh) */}
              <Box className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0 flex flex-nowrap overflow-x-auto hide-scroll">
                  <Box className={`flex-none px-3 whitespace-nowrap text-center py-2 border-b-2 cursor-pointer transition-all ${orderTab==="pending"?"border-orange-500 text-orange-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("pending")}>
                      Mới ({orderList.filter(o=>o.status==='pending').length})
                  </Box>
                  <Box className={`flex-none px-3 whitespace-nowrap text-center py-2 border-b-2 cursor-pointer transition-all ${orderTab==="confirmed"?"border-blue-500 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("confirmed")}>
                      Chờ khách ({orderList.filter(o=>o.status==='confirmed').length})
                  </Box>
                  <Box className={`flex-none px-3 whitespace-nowrap text-center py-2 border-b-2 cursor-pointer transition-all ${orderTab==="history"?"border-gray-500 text-gray-800 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("history")}>
                      Lịch sử
                  </Box>
                  <Box className={`flex-none px-3 whitespace-nowrap text-center py-2 border-b-2 cursor-pointer transition-all ${orderTab==="cancelled"?"border-red-500 text-red-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("cancelled")}>
                      Đơn hủy ({orderList.filter(o=>o.status==='cancelled').length})
                  </Box>
              </Box>

              {/* NỘI DUNG */}
              <Box p={4} className="flex-1 overflow-y-auto hide-scroll">
                  {feedbackTab === "new" ? (
                      <Box className="animate-fade-in">
                          <Text size="small" className="mb-4 text-gray-600">Gửi các ý kiến góp ý hoặc yêu cầu hỗ trợ kỹ thuật đến Admin hệ thống.</Text>
                          <Box mb={4}>
                              <Input.TextArea label="Nội dung" value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} rows={5} placeholder="Nhập chi tiết yêu cầu của bạn..." />
                          </Box>
                          <Button fullWidth loading={feedbackLoading} onClick={handleSendFeedback} prefixIcon={<Icon icon="zi-send-solid" className="text-white"/>}>
                              Gửi yêu cầu
                          </Button>
                      </Box>
                  ) : (
                      <Box className="animate-fade-in-up">
                          {loadingFeedbacks ? (
                              <Box flex justifyContent="center" py={5}><Spinner /></Box>
                          ) : feedbackList.length === 0 ? (
                              <Box flex flexDirection="column" alignItems="center" py={5}>
                                  <Icon icon="zi-chat" size={40} className="text-gray-300 mb-2"/>
                                  <Text className="text-center text-gray-500">Bạn chưa gửi yêu cầu nào.</Text>
                              </Box>
                          ) : (
                              feedbackList.map((fb, idx) => {
                                  // Xử lý an toàn ngày giờ
                                  const dateObj = fb.createdAt?.toDate ? fb.createdAt.toDate() : (fb.createdAt?.seconds ? new Date(fb.createdAt.seconds * 1000) : null);
                                  
                                  return (
                                  <Box key={idx} className="mb-4 p-3 bg-white rounded-xl border border-gray-200 shadow-md relative overflow-hidden">
                                      {/* Viền màu trạng thái bên trái */}
                                      <div className={`absolute top-0 left-0 bottom-0 w-1 ${fb.status === 'done' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                      
                                      <Box flex justifyContent="space-between" mb={2} pl={2}>
                                          <Text size="xxxxSmall" className="text-gray-500">
                                              {dateObj ? `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')} - ${dateObj.toLocaleDateString('vi-VN')}` : "Vừa xong"}
                                          </Text>
                                          <Text size="xxxxSmall" bold className={fb.status === 'done' ? "text-green-600 bg-green-50 px-2 py-0.5 rounded" : "text-orange-600 bg-orange-50 px-2 py-0.5 rounded"}>
                                              {fb.status === 'done' ? "Đã phản hồi" : "Đang chờ Admin"}
                                          </Text>
                                      </Box>
                                      
                                      <Box pl={2} mb={2}>
                                          <Text size="small" className="text-gray-800">"{fb.content}"</Text>
                                      </Box>
                                      
                                      {/* Câu trả lời của Admin */}
                                      {fb.status === 'done' && fb.adminNote && (
                                          <Box className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mt-3 ml-2 relative">
                                              <Box flex alignItems="center" mb={1}>
                                                  <Box className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center mr-1.5">
                                                      <Icon icon="zi-user" size={12} className="text-white"/>
                                                  </Box>
                                                  <Text size="xSmall" bold className="text-blue-800">Admin trả lời:</Text>
                                              </Box>
                                              <Text size="small" className="text-gray-800 leading-relaxed pl-6">
                                                  {fb.adminNote}
                                              </Text>
                                          </Box>
                                      )}
                                  </Box>
                              )})
                          )}
                      </Box>
                  )}
              </Box>
              
              {/* Nút đóng */}
              <Box p={3} className="border-t border-gray-200 bg-white shrink-0">
                  <Button fullWidth variant="secondary" onClick={() => setShowFeedbackModal(false)}>Đóng bảng hỗ trợ</Button>
              </Box>
          </Box>
      </Modal>
      {/* MODAL LỊCH SỬ GIAO DỊCH (Đặt ở cuối file) */}
      <Modal 
  visible={showHistoryModal} 
  title="Chi tiết tài khoản" 
  onClose={() => setShowHistoryModal(false)}
  actions={[{ text: "Đóng", onClick: () => setShowHistoryModal(false) }]}
>
  <Box p={4} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      
      {/* 1. BẢNG LỘ TRÌNH HẠNG THÀNH VIÊN */}
      <Text size="small" bold className="mb-3">Lộ trình thăng hạng:</Text>
      <Box className="bg-gray-50 rounded-2xl p-3 mb-5 border border-gray-100">
          {[
              { name: "Thành viên", points: "0", color: "#94a3b8" },
              { name: "Hạng Đồng", points: "100", color: "#b45309" },
              { name: "Hạng Bạc", points: "500", color: "#64748b" },
              { name: "Hạng Vàng", points: "2.000", color: "#fbbf24" }
          ].map((item, index) => {
              const isCurrent = rank.name.includes(item.name) || (item.name === "Thành viên" && rank.name === "Thành viên");
              return (
                  <Box key={index} flex alignItems="center" justifyContent="space-between" className="py-2.5 border-b border-gray-200 last:border-0">
                      <Box flex alignItems="center">
                          <Box 
                            className="w-2 h-2 rounded-full mr-3" 
                            style={{ backgroundColor: item.color, boxShadow: isCurrent ? `0 0 8px ${item.color}` : 'none' }} 
                          />
                          <Text size="small" bold={isCurrent} className={isCurrent ? "text-gray-800" : "text-gray-500"}>
                              {item.name}
                          </Text>
                      </Box>
                      <Box flex alignItems="center">
                          <Text size="xSmall" bold={isCurrent} className={isCurrent ? "text-blue-600" : "text-gray-400"}>
                              {item.points} điểm
                          </Text>
                          {isCurrent && <Icon icon="zi-check-circle-solid" size={16} className="text-green-500 ml-2" />}
                      </Box>
                  </Box>
              );
          })}
      </Box>

      {/* 2. QUYỀN LỢI HẠNG HIỆN TẠI */}
      <Box className="bg-blue-50 p-4 rounded-xl mb-5 border border-blue-100">
          <Text size="small" bold className="text-blue-800 flex alignItems-center">
             <Icon icon="zi-info-circle-solid" size={16} className="mr-1"/> Quyền lợi {rank.name}:
          </Text>
          <Text size="xSmall" className="text-blue-700 mt-2 leading-relaxed">
             • Tích lũy điểm thưởng từ đơn hàng giới thiệu.<br/>
             • Ưu tiên hỗ trợ kỹ thuật và vận hành chi nhánh.<br/>
             • Nhận mã giảm giá riêng cho khách hàng của bạn.
          </Text>
      </Box>
      
      {/* 3. LỊCH SỬ GIAO DỊCH */}
      <Text size="small" bold className="mb-3">Lịch sử nhận/tiêu điểm:</Text>
      {historyLoading ? (
          <Box flex justifyContent="center" py={4}><Spinner /></Box>
      ) : (
          <Box>
              {history.length > 0 ? history.map((item, i) => (
                  <Box key={i} className="flex justify-between items-center py-2.5 border-b border-gray-100">
                      <Box>
                          <Text size="xSmall" bold className="text-gray-700">{item.reason || "Thưởng giới thiệu"}</Text>
                          <Text size="xxSmall" className="text-gray-400">
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('vi-VN') : "Vừa xong"}
                          </Text>
                      </Box>
                      <Text size="small" bold className={item.type === 'plus' ? "text-green-600" : "text-red-600"}>
                          {item.type === 'plus' ? '+' : '-'}{item.amount}
                      </Text>
                  </Box>
              )) : (
                  <Text size="xSmall" className="text-center text-gray-400 py-8 italic bg-gray-50 rounded-xl">Chưa có dữ liệu lịch sử.</Text>
              )}
          </Box>
      )}
  </Box>
</Modal>
      {/* 👉 BƯỚC 2: MODAL QUẢN LÝ ĐƠN HÀNG PHIÊN BẢN PRO */}
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <Modal 
          visible={showOrdersModal} 
          title="Quản lý Đơn hàng" 
          onClose={() => setShowOrdersModal(false)}
      >
          <Box className="bg-gray-50 flex flex-col" style={{ height: '75vh' }}>
              
              {/* 1. THANH TÌM KIẾM NHANH */}
              <Box p={3} className="bg-white border-b border-gray-200 shrink-0">
                  <Input
                      placeholder="Tìm theo Tên hoặc Số điện thoại..."
                      clearable
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      prefix={<Icon icon="zi-search" className="text-gray-400" />}
                  />
              </Box>

              {/* 2. THANH TAB CHUYỂN ĐỔI (Vuốt ngang thông minh) */}
              <Box flex className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0">
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="pending"?"border-orange-500 text-orange-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("pending")}>
                      Mới ({orderList.filter(o=>o.status==='pending').length})
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="confirmed"?"border-blue-500 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("confirmed")}>
                      Chờ khách ({orderList.filter(o=>o.status==='confirmed').length})
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="history"?"border-gray-500 text-gray-800 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("history")}>
                      Lịch sử
                  </Box>
              </Box>
              
              {/* 3. DANH SÁCH ĐƠN HÀNG (Đã ẩn thanh cuộn) */}
              <Box p={3} className="flex-1 overflow-y-auto hide-scroll">
                  {loadingOrders ? (
                      <Box flex justifyContent="center" py={5}><Spinner /></Box>
                  ) : (
                      (() => {
                          // THUẬT TOÁN 1: Lọc theo từ khóa tìm kiếm
                          let filtered = orderList;
                          if (searchQuery.trim()) {
                              const q = searchQuery.toLowerCase();
                              filtered = filtered.filter(o => 
                                  (o.userName && o.userName.toLowerCase().includes(q)) || 
                                  (o.userId && o.userId.includes(q))
                              );
                          }

                          // THUẬT TOÁN 2: Lọc theo Tab đang chọn
                          if (orderTab === 'pending') filtered = filtered.filter(o => o.status === 'pending');
                          else if (orderTab === 'confirmed') filtered = filtered.filter(o => o.status === 'confirmed');
                          else if (orderTab === 'cancelled') filtered = filtered.filter(o => o.status === 'cancelled');
                          else filtered = filtered.filter(o => o.status === 'completed' || o.status === 'success');

                          if (filtered.length === 0) {
                              return (
                                  <Box flex flexDirection="column" alignItems="center" py={8}>
                                      <Icon icon="zi-note" size={40} className="text-gray-300 mb-2"/>
                                      <Text className="text-center text-gray-500">Chưa có đơn hàng nào.</Text>
                                  </Box>
                              );
                          }

                          return filtered.map((order, idx) => {
                              const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                              const originalAmount = Number(order.originalAmount || total);
                              const discountAmount = Number(order.discountAmount || 0);
                              const extrasTotal = (order.extras || []).reduce((sum: number, ex: any) => sum + Number(ex.price || 0), 0);
                              const mainServicePrice = originalAmount - extrasTotal;

                              return (
                                  <Box key={order.id} className="bg-white p-3 rounded-xl mb-3 border border-gray-200 shadow-md relative animate-fade-in-up">
                                      
                                      {/* 👉 NÚT GỌI ĐIỆN THOẠI NHANH CHO KHÁCH */}
                                      <a href={`tel:${order.userId}`} className="absolute top-12 right-3 w-9 h-9 rounded-full bg-green-100 border border-green-200 flex items-center justify-center cursor-pointer active:opacity-70 shadow-md z-10">
                                          <Icon icon="zi-call" size={16} className="text-green-600" />
                                      </a>

                                      {/* Dòng Mã đơn & Trạng thái */}
                                      <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                                          <Text size="small" bold className="text-gray-800">#{order.id.slice(0,6).toUpperCase()}</Text>
                                          <Text size="xSmall" bold className={
                                              order.status === 'pending' ? 'text-orange-600 bg-orange-50 px-2 py-0.5 rounded' :
                                              order.status === 'confirmed' ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded' :
                                              order.status === 'cancelled' ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-green-600 bg-green-50 px-2 py-0.5 rounded'
                                          }>
                                              {order.status === 'pending' ? 'Mới - Chờ duyệt' : 
                                               order.status === 'confirmed' ? 'Đã chốt - Chờ khách' : 
                                               order.status === 'cancelled' ? 'Đã hủy' : 'Hoàn thành'}
                                          </Text>
                                      </Box>
                                      
                                      {/* Thông tin khách hàng */}
                                      <Box flex alignItems="center" mb={3}>
                                          <Box className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center mr-2 border border-blue-100">
                                              <Icon icon="zi-user" size={16} className="text-blue-600" />
                                          </Box>
                                          <Box>
                                              <Text size="small" bold className="text-blue-800">{order.userName}</Text>
                                              <Text size="xSmall" className="text-gray-500">{order.userId}</Text>
                                          </Box>
                                      </Box>
                                      {/* 👉 BỔ SUNG: Thông tin người nhận (Tên + SĐT để ship hàng) */}
                                        {(order.receiverName || order.receiverPhone || order.shippingName || order.shippingPhone) && (
                                            <Box flex alignItems="flex-start" mb={2} className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-100">
                                                <Icon icon="zi-user-circle" size={16} className="text-blue-600 mr-2 mt-0.5 shrink-0" />
                                                <Box>
                                                    <Text size="xSmall" bold className="text-blue-800 mb-0.5">Thông tin người nhận:</Text>
                                                    <Text size="xSmall" className="text-gray-700">
                                                        {/* Hiển thị Tên người nhận */}
                                                        <span className="font-bold">
                                                            {order.receiverName || order.shippingName || order.userName || "Chưa có tên"}
                                                        </span>
                                                        {/* Hiển thị SĐT người nhận */}
                                                        {(order.receiverPhone || order.shippingPhone || order.userId) && (
                                                            <span className="ml-1 text-blue-700 font-medium">
                                                                - {order.receiverPhone || order.shippingPhone || order.userId}
                                                            </span>
                                                        )}
                                                    </Text>
                                                </Box>
                                            </Box>
                                        )}
                                        {/* 👉 BỔ SUNG: Thông tin địa chỉ nhận hàng của khách (nếu có) */}
                                        {(order.address || order.deliveryAddress || order.shippingAddress) && (
                                            <Box flex alignItems="flex-start" mb={3} className="bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">
                                                <Icon icon="zi-location" size={16} className="text-orange-600 mr-2 mt-0.5 shrink-0" />
                                                <Box>
                                                    <Text size="xSmall" bold className="text-orange-800 mb-0.5">Địa chỉ nhận hàng:</Text>
                                                    <Text size="xSmall" className="text-gray-700 leading-relaxed">
                                                        {typeof (order.address || order.deliveryAddress || order.shippingAddress) === 'string' 
                                                            ? (order.address || order.deliveryAddress || order.shippingAddress)
                                                            : ((order.address?.address || order.address?.fullAddress || order.deliveryAddress?.address) || "Chưa xác định rõ")}
                                                    </Text>
                                                </Box>
                                            </Box>
                                        )}
                                      {/* Dịch vụ & Giá tiền */}
                                      <Box className="bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2">
                                          {/* 👉 BỔ SUNG LƯỚI CHI TIẾT SẢN PHẨM & PHÂN LOẠI CHO CHI NHÁNH */}
                                          {order.cartItems && order.cartItems.length > 0 ? (
                                              <Box className="mb-2">
                                                  {order.cartItems.map((item: any, i: number) => (
                                                      <Box key={i} className="mb-1.5 border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
                                                          <Box flex justifyContent="space-between" alignItems="flex-start">
                                                              <Text size="small" bold className="text-gray-800 pr-2 line-clamp-2">
                                                                  <span className="text-blue-600 mr-1">x{item.quantity}</span> 
                                                                  {item.product?.title || item.product?.name || item.name}
                                                              </Text>
                                                              <Text size="small" className="text-gray-800 font-medium whitespace-nowrap">
                                                                  {(Number(item.product?.price || item.price || 0) * item.quantity).toLocaleString()}đ
                                                              </Text>
                                                          </Box>
                                                          {item.options && Object.keys(item.options).length > 0 && (
                                                              <Text size="xxxxSmall" className="text-gray-500 flex items-center mt-0.5 italic">
                                                                  <Icon icon="zi-note" size={12} className="mr-1" />
                                                                  {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                              </Text>
                                                          )}
                                                      </Box>
                                                  ))}
                                              </Box>
                                          ) : (
                                              <>
                                                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-1">
                                                      <Text size="small" bold className="text-gray-800 pr-2 line-clamp-2">{order.productName}</Text>
                                                      <Text size="small" className="text-gray-800 font-medium whitespace-nowrap">
                                                          {mainServicePrice.toLocaleString()}đ
                                                      </Text>
                                                  </Box>

                                                  {order.selectedVariants && Object.keys(order.selectedVariants).length > 0 ? (
                                                      <Text size="xSmall" className="text-gray-600 font-medium flex items-center bg-white border border-gray-200 w-fit px-2 py-0.5 rounded mt-1 mb-2">
                                                          <Icon icon="zi-note" size={12} className="mr-1 text-gray-500" />
                                                          {Object.entries(order.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                      </Text>
                                                  ) : (order.bookingTime || order.bookingDate) ? (
                                                      <Box flex alignItems="center" className="mb-1">
                                                          <Icon icon="zi-clock-1" size={12} className="text-orange-500 mr-1 mt-0.5" />
                                                          <Text size="xSmall" bold className="text-orange-600">
                                                              Hẹn: {order.bookingTime} {order.bookingDate ? `- ${order.bookingDate}` : ''}
                                                          </Text>
                                                      </Box>
                                                  ) : null}
                                              </>
                                          )}

                                          {order.extras && order.extras.length > 0 && (
                                              <Box mt={1} pt={1} className="border-t border-dashed border-gray-200">
                                                  {order.extras.map((ex: any, i: number) => (
                                                      <Box key={i} flex justifyContent="space-between" alignItems="center">
                                                          <Text size="xSmall" className="text-gray-500 line-clamp-1 pr-2">+ {ex.name || ex.title}</Text>
                                                          <Text size="xSmall" className="text-gray-500 whitespace-nowrap">{Number(ex.price || 0).toLocaleString()}đ</Text>
                                                      </Box>
                                                  ))}
                                              </Box>
                                          )}
                                      </Box>

                                      {/* 👉 HIỂN THỊ RÕ RÀNG TIỀN GỐC, VOUCHER VÀ THỰC THU */}
                                      <Box flex flexDirection="column" alignItems="flex-end" mb={2} pt={2} className="border-t border-gray-100">
                                          {discountAmount > 0 && (
                                              <>
                                                  <Text size="xSmall" className="text-gray-400">Tổng gốc: <span className="line-through">{originalAmount.toLocaleString()}đ</span></Text>
                                                  <Text size="xSmall" className="text-green-600 font-medium mb-0.5">Voucher giảm: -{discountAmount.toLocaleString()}đ</Text>
                                              </>
                                          )}
                                          <Box flex alignItems="baseline">
                                              <Text size="small" className="text-gray-600 mr-2">Thu khách:</Text>
                                              <Text bold size="xLarge" className="text-red-600 leading-none">
                                                  {total.toLocaleString()}đ
                                              </Text>
                                          </Box>
                                      </Box>

                                      {order.note && <Text size="xSmall" className="italic text-gray-500 mb-2 p-2 bg-yellow-50 rounded border border-yellow-100">Ghi chú: {order.note}</Text>}

                                      {/* Nút thao tác theo Tab */}
                                      {order.status === 'pending' && (
                                         <Box flex className="gap-2 mt-2">
                                           <Button size="small" variant="secondary" className="flex-1 bg-red-50 text-red-600 border border-red-200" onClick={() => handleUpdateOrderStatus(order, 'cancelled')}>Từ chối</Button>
                                           <Button size="small" className="flex-1 bg-blue-600" onClick={() => handleUpdateOrderStatus(order, 'confirmed')}>Nhận khách</Button>
                                         </Box>
                                      )}

                                      {/* Hiển thị lý do nếu là Đơn Hủy */}
                                      {order.status === 'cancelled' && order.cancelReason && (
                                          <Text size="xSmall" className="text-red-600 bg-red-50 p-2 rounded mt-2 border border-red-100 italic">
                                              Lý do hủy: {order.cancelReason}
                                          </Text>
                                      )}

                                      {order.status === 'pending' && (
                                         <Box flex className="gap-2 mt-2">
                                           {/* Sửa nút Từ chối dùng chung pop-up lý do cho đồng bộ */}
                                           <Button size="small" variant="secondary" className="flex-1 bg-red-50 text-red-600 border border-red-200" onClick={() => { setSelectedOrderToCancel(order); setShowCancelModal(true); }}>Từ chối</Button>
                                           <Button size="small" className="flex-1 bg-blue-600" onClick={() => handleUpdateOrderStatus(order, 'confirmed')}>Nhận khách</Button>
                                         </Box>
                                      )}

                                      {/* 👇 CẬP NHẬT: Thêm nút Hủy đơn bên cạnh nút Đã phục vụ */}
                                      {order.status === 'confirmed' && (
                                        <Box mt={2} flex className="gap-2">
                                            <Button size="small" variant="secondary" className="bg-red-50 text-red-600 border border-red-200 whitespace-nowrap" onClick={() => { setSelectedOrderToCancel(order); setShowCancelModal(true); }}>
                                                Hủy đơn
                                            </Button>
                                            <Button size="small" className="flex-1 bg-green-500 border-none" onClick={() => handleUpdateOrderStatus(order, 'completed')} prefixIcon={<Icon icon="zi-check-circle-solid" className="text-white"/>}>
                                                Đã phục vụ xong
                                            </Button>
                                        </Box>
                                      )}
                                  </Box>
                              );
                          });
                      })()
                  )}
              </Box>
              
              {/* Nút đóng */}
              <Box p={3} className="border-t border-gray-200 bg-white shrink-0">
                  <Button fullWidth variant="secondary" onClick={() => setShowOrdersModal(false)}>Đóng bảng quản lý</Button>
              </Box>
          </Box>
      </Modal>
      {/* 👉 BƯỚC 3: MODAL CHI TIẾT DOANH THU THÁNG */}
      <Modal 
          visible={showMonthlyStatsModal} 
          title={`Chi tiết Tháng ${statsMonth.split('-')[1]}/${statsMonth.split('-')[0]}`} 
          onClose={() => setShowMonthlyStatsModal(false)}
          actions={[{ text: "Đóng", onClick: () => setShowMonthlyStatsModal(false) }]}
      >
          <Box p={4} className="bg-gray-50 hide-scroll" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {(() => {
                  // Lọc ra các đơn hàng HOÀN THÀNH trong tháng được chọn
                  const monthlyOrders = orderList.filter(o => {
                      if (o.status !== 'completed' && o.status !== 'success') return false;
                      if (!o.createdAt) return false;
                      const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt.seconds * 1000);
                      const orderMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      return orderMonth === statsMonth;
                  });

                  if (monthlyOrders.length === 0) {
                      return (
                          <Box flex flexDirection="column" alignItems="center" py={5}>
                              <Icon icon="zi-note" size={40} className="text-gray-300 mb-2"/>
                              <Text className="text-center text-gray-500">Chưa có doanh thu trong tháng này.</Text>
                          </Box>
                      );
                  }

                  return monthlyOrders.map((order, idx) => {
                      const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                      return (
                          <Box key={idx} className="bg-white p-3 rounded-xl mb-3 border border-gray-200 shadow-md animate-fade-in-up">
                              <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                                  <Text size="small" bold className="text-blue-600">#{order.id.slice(0,6).toUpperCase()}</Text>
                                  <Text size="xSmall" className="text-gray-500">
                                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('vi-VN') : ""}
                                  </Text>
                              </Box>
                              
                              <Text size="small" bold className="text-gray-800 mb-1">{order.productName}</Text>
                              
                              <Box flex alignItems="center" mb={2}>
                                  <Icon icon="zi-user" size={14} className="text-gray-400 mr-1" />
                                  <Text size="xSmall" className="text-gray-600">{order.userName} - {order.userId}</Text>
                              </Box>
                              
                              <Box flex justifyContent="space-between" alignItems="center" pt={2} className="border-t border-gray-50">
                                  <Text size="xSmall" className="text-gray-500">Thực thu:</Text>
                                  <Text size="small" bold className="text-green-600">+{total.toLocaleString()}đ</Text>
                              </Box>
                          </Box>
                      );
                  });
              })()}
          </Box>
      </Modal>
      {/* 👇 THÊM MỚI: Pop-up nhập lý do hủy đơn 👇 */}
      <Modal 
          visible={showCancelModal} 
          title="Xác nhận Hủy/Từ chối đơn" 
          onClose={() => { setShowCancelModal(false); setCancelReason(""); }}
      >
          <Box p={4}>
              <Text size="small" className="mb-3 text-gray-700">
                  Vui lòng nhập lý do hủy đơn hàng <Text bold as="span" className="text-blue-600">#{selectedOrderToCancel?.id?.slice(0,6).toUpperCase()}</Text> để lưu lại lịch sử:
              </Text>
              <Input.TextArea
                  placeholder="VD: Khách báo bận không đến được, Khách đặt nhầm..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
              />
              <Box mt={4} flex className="gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => { setShowCancelModal(false); setCancelReason(""); }}>Đóng</Button>
                  <Button className="flex-1 bg-red-600 border-none" loading={cancelLoading} onClick={handleConfirmCancelOrder}>Xác nhận hủy</Button>
              </Box>
          </Box>
      </Modal>
    </Box>
  );
};