import CustomIcon from '../custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Box, Text, Icon, Button, Avatar, List, Modal, Input, Spinner, useSnackbar, Progress, Select } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, setDoc, serverTimestamp, orderBy, limit, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase"; 
import { openShareSheet } from "zmp-sdk/apis";

const { Item } = List;
const { TextArea } = Input;
const { Option } = Select;
// 👉 Placeholder cho App ID của bạn
const YOUR_APP_ID = "2196212719506893777"; 

// 👉 1. HÀM TÍNH RANK SHOP & LOGIC LÊN HẠNG (CẬP NHẬT)
const calculateShopRankInfo = (points: number) => {
  const p = points || 0;
  // Cấu trúc trả về: { Rank hiện tại, Rank kế tiếp, Mục tiêu điểm }
  if (p < 300) return { 
      name: "Thạch Anh", color: "bg-gray-100 text-gray-600", icon: "zi-star", 
      nextRank: "Ngọc Bích", target: 300 
  };
  if (p < 1000) return { 
      name: "Ngọc Bích", color: "bg-green-100 text-green-700", icon: "zi-shield-solid", 
      nextRank: "Hồng Ngọc", target: 1000 
  };
  if (p < 2000) return { 
      name: "Hồng Ngọc", color: "bg-red-100 text-red-600", icon: "zi-heart-solid", 
      nextRank: "Lam Ngọc", target: 2000 
  };
  if (p < 5000) return { 
      name: "Lam Ngọc", color: "bg-blue-100 text-blue-600", icon: "zi-diamond", 
      nextRank: "Kim Cương", target: 5000 
  };
  return { 
      name: "Kim Cương", color: "bg-purple-100 text-purple-600", icon: "zi-diamond-solid", 
      nextRank: "Max Level", target: 0 
  };
};

// Hàm format ngày giờ đơn giản
const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes()}`;
};

interface ProviderProps {
  userData: any;
  onBackToProfile?: () => void; // Dấu ? nghĩa là hàm này có thể có hoặc không
  onLogout?: () => void;        // Định nghĩa thêm hàm đăng xuất
}

export const ProviderView: FC<ProviderProps> = ({ userData, onBackToProfile, onLogout }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();

  // --- STATE QUẢN LÝ MODALS CŨ ---
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralList, setReferralList] = useState<any[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);

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

  const [showShareModal, setShowShareModal] = useState(false);
  // 👉 THÊM MỚI: STATE QUẢN LÝ ĐƠN HÀNG (CHỦ SHOP)
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderList, setOrderList] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // State Thông tin Shop
  const [showShopInfoModal, setShowShopInfoModal] = useState(false);
  const [editName, setEditName] = useState(userData.name || "");
  const [editAddress, setEditAddress] = useState(userData.address || "");
  const [editManager, setEditManager] = useState(userData.managerName || "");
  const [updatingInfo, setUpdatingInfo] = useState(false);
  const [editDescription, setEditDescription] = useState(userData.description || "");
  const [editAvatar, setEditAvatar] = useState(userData.avatar || "");
  const [editCover, setEditCover] = useState(userData.cover || "");
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [locations, setLocations] = useState<any[]>(userData.locations || []);
  const [newLocName, setNewLocName] = useState("");
  const [newLocPhone, setNewLocPhone] = useState("");
  const [newLocManagerPhone, setNewLocManagerPhone] = useState("");
  const [newLocAddress, setNewLocAddress] = useState("");
  const [editingLocIndex, setEditingLocIndex] = useState<number | null>(null);
  const [editLocName, setEditLocName] = useState("");
  const [editLocPhone, setEditLocPhone] = useState("");
  const [editLocManagerPhone, setEditLocManagerPhone] = useState("");
  const [editLocAddress, setEditLocAddress] = useState("");
  const [savingLocations, setSavingLocations] = useState(false);
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  const [selectedProvince, setSelectedProvince] = useState<{code: string, name: string} | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<{code: string, name: string} | null>(null);
  const [selectedWard, setSelectedWard] = useState<{code: string, name: string} | null>(null);

  // 1. Lấy danh sách Tỉnh/Thành phố khi mở Modal
  useEffect(() => {
    if (showLocationsModal && provinces.length === 0) {
      fetch("https://provinces.open-api.vn/api/p/")
        .then(res => res.json())
        .then(data => setProvinces(data))
        .catch(err => console.error("Lỗi tải Tỉnh/Thành:", err));
    }
  }, [showLocationsModal]);

  // 2. Lấy danh sách Quận/Huyện khi chọn Tỉnh/Thành phố
  useEffect(() => {
    if (selectedProvince) {
      fetch(`https://provinces.open-api.vn/api/p/${selectedProvince.code}?depth=2`)
        .then(res => res.json())
        .then(data => {
          setDistricts(data.districts || []);
          setSelectedDistrict(null); // Reset Huyện khi Tỉnh thay đổi
          setWards([]); 
          setSelectedWard(null);
        });
    }
  }, [selectedProvince]);

  // 3. Lấy danh sách Phường/Xã khi chọn Quận/Huyện
  useEffect(() => {
    if (selectedDistrict) {
      fetch(`https://provinces.open-api.vn/api/d/${selectedDistrict.code}?depth=2`)
        .then(res => res.json())
        .then(data => {
          setWards(data.wards || []);
          setSelectedWard(null); // Reset Xã khi Huyện thay đổi
        });
    }
  }, [selectedDistrict]);
  // 👉 STATE MỚI: RANK & LỊCH SỬ TIÊU DÙNG
  const [showRankDetailModal, setShowRankDetailModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
      setEditName(userData.name || "");
      setEditAddress(userData.address || "");
      setEditManager(userData.managerName || "");
      setEditDescription(userData.description || "");
      setEditAvatar(userData.avatar || "");
      setEditCover(userData.cover || "");
      setLocations(userData.locations || []);
  }, [userData]);

  // Tính toán thông tin Rank
  const shopRankInfo = calculateShopRankInfo(userData.rankPoints || 0);

  // --- 1. XỬ LÝ CHUYỂN TRANG SHOP ---
  const goToShopDetail = () => {
    // Dùng userData thay vì user. Lấy id hoặc phone làm định danh của Shop
    const shopId = userData?.id || userData?.phone;

    if (shopId) {
      navigate(`/shop-details/${shopId}`, {
        state: {
          preloadName: userData.shopName || userData.name,
          preloadAvatar: userData.avatar,
          preloadCover: userData.cover
        }
      });
    } else {
      openSnackbar({ 
        text: "Không tìm thấy thông tin định danh của Shop", 
        type: "countdown" 
      });
    }
  };

  // --- 2. XỬ LÝ DANH SÁCH KHÁCH HÀNG ---
  const handleShowReferrals = async () => {
      if(!userData.phone) return;
      setShowReferralModal(true); setReferralLoading(true);
      try {
          const q = query(collection(db, "users"), where("referrer", "==", userData.phone));
          const snapshot = await getDocs(q);
          setReferralList(snapshot.docs.map(doc => doc.data()));
      } catch (error) { openSnackbar({ text: "Lỗi tải dữ liệu", type: "error" }); } finally { setReferralLoading(false); }
  };

  // 👉 3. LẤY LỊCH SỬ TIÊU DÙNG (GIẢM ĐIỂM)
  const handleShowSpendingHistory = async () => {
      setShowHistoryModal(true);
      setHistoryLoading(true);
      try {
          // Tìm trong collection 'point_history' các giao dịch trừ điểm của user này
          const q = query(
              collection(db, "point_history"), 
              where("userId", "==", userData.phone),
              where("type", "==", "minus"), // Lọc loại giao dịch trừ điểm
              orderBy("createdAt", "desc"),
              limit(20)
          );
          
          const snapshot = await getDocs(q);
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setHistoryList(list);
      } catch (error) {
          console.error("Lỗi tải lịch sử:", error);
          // Nếu chưa có collection thì để trống
          setHistoryList([]);
      } finally {
          setHistoryLoading(false);
      }
  };

  //👉 4. Hàm lấy danh sách TẤT CẢ đơn hàng của Shop
  // Hàm lấy danh sách TẤT CẢ đơn hàng của Shop (ĐÃ NÂNG CẤP ĐỂ TÌM THEO 2 LOẠI ID)
  //👉 4. Hàm lấy danh sách TẤT CẢ đơn hàng của Shop (ĐÃ SỬA LỖI NHẦM SHOP)
  const fetchShopOrders = async () => {
    if (!userData.phone) return; // Bảo vệ: Chắc chắn có SĐT mới cho phép lấy dữ liệu

    setShowOrdersModal(true);
    setLoadingOrders(true);
    try {
        const ordersRef = collection(db, "orders");
        let allOrders: any[] = [];

        // 👉 CHỈ TÌM THEO SỐ ĐIỆN THOẠI (LOẠI BỎ TÌM THEO ZALO ID ĐỂ TRÁNH TRÙNG LẶP DO TEST)
        const qPhone = query(ordersRef, where("shopId", "==", userData.phone));
        const snapPhone = await getDocs(qPhone);
        snapPhone.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));

        // (Dự phòng cho dữ liệu cũ lỡ lưu nhầm vào trường providerId)
        const qProvider = query(ordersRef, where("providerId", "==", userData.phone));
        const snapProvider = await getDocs(qProvider);
        snapProvider.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));
        
        // Gộp danh sách và loại bỏ các đơn bị trùng lặp
        const uniqueOrders = Array.from(new Set(allOrders.map(o => o.id)))
            .map(id => allOrders.find(o => o.id === id));

        // Sắp xếp để đơn nào mới đặt lên đầu tiên
        uniqueOrders.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        
        setOrderList(uniqueOrders);
    } catch (error) {
        console.error("Lỗi tải đơn hàng:", error);
        openSnackbar({ text: "Lỗi tải đơn hàng", type: "error" });
    } finally {
        setLoadingOrders(false);
    }
  };

  //👉 5. Hàm cập nhật trạng thái đơn hàng
const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        // Cập nhật lại state giao diện
        setOrderList(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        openSnackbar({ text: "Đã cập nhật trạng thái!", type: "success" });
    } catch (error) {
        openSnackbar({ text: "Lỗi cập nhật", type: "error" });
    }
};
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState({ totalRevenue: 0, monthlyRevenue: 0, completedCount: 0, monthlyFee: 0, totalFee: 0 });
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [allLocationsCompletedOrders, setAllLocationsCompletedOrders] = useState<any[]>([]);
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeTab, setFeeTab] = useState("unpaid");
  const [adminBankInfoText, setAdminBankInfoText] = useState("");
  const [adminBankQrLink, setAdminBankQrLink] = useState("");
  // 👉 BƯỚC 1: STATE & HÀM XỬ LÝ "BÁO CÁO CHUYỂN KHOẢN"
  const [reportingPayment, setReportingPayment] = useState(false);

  const handleReportPayment = async (unpaidOrdersToReport: any[]) => {
      setReportingPayment(true);
      try {
          // Lặp qua tất cả đơn chưa thanh toán và gắn cờ "Đã báo cáo"
          const updatePromises = unpaidOrdersToReport.map(order => 
              updateDoc(doc(db, "orders", order.id), {
                  feePaymentReported: true,
                  feePaymentReportedAt: serverTimestamp()
              })
          );
          await Promise.all(updatePromises); // Chạy song song cho nhanh

          // Cập nhật lại giao diện ngay lập tức mà không cần tải lại trang
          const updatedAllLocs = allLocationsCompletedOrders.map(o => {
              if (unpaidOrdersToReport.find(uo => uo.id === o.id)) {
                  return { ...o, feePaymentReported: true };
              }
              return o;
          });
          setAllLocationsCompletedOrders(updatedAllLocs);

          openSnackbar({ text: "Đã gửi báo cáo! Vui lòng chờ Admin xác nhận.", type: "success" });
      } catch (error) {
          console.error("Lỗi gửi báo cáo:", error);
          openSnackbar({ text: "Lỗi hệ thống khi gửi yêu cầu", type: "error" });
      } finally {
          setReportingPayment(false);
      }
  };
  // 👉 STATE QUẢN LÝ THÔNG BÁO VÀ POP-UP NHẮC NỢ TỰ ĐỘNG
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showDebtAlert, setShowDebtAlert] = useState(false); // State cho Pop-up tự động
  
  // Tính số lượng thông báo chưa đọc
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Lắng nghe thông báo real-time từ Firebase
  // Lắng nghe thông báo real-time từ Firebase (ĐÃ FIX LỖI FIREBASE INDEX)
  useEffect(() => {
    if (!userData.phone) return;
    
    // 👉 BƯỚC 1: Xóa bỏ orderBy để Firebase không chặn lệnh truy vấn nữa
    const q = query(
        collection(db, "notifications"),
        where("userId", "==", userData.phone)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        
        // 👉 BƯỚC 2: Tự động sắp xếp tin nhắn mới nhất lên đầu bằng JavaScript
        notifs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        
        setNotifications(notifs);

        // 👉 LOGIC POP-UP: Nếu có thông báo nhắc nợ chưa đọc, tự động bật Pop-up
        const hasUnreadReminder = notifs.some((n: any) => !n.isRead && n.type === "fee_reminder");
        if (hasUnreadReminder) {
            setShowDebtAlert(true);
        }
    }, (error) => {
        console.error("Lỗi tải thông báo:", error);
    });
    
    return () => unsubscribe();
}, [userData]);

  // Hàm xử lý khi bấm vào đọc thông báo
  const handleReadNotification = async (notif: any) => {
      if (!notif.isRead) {
          try {
              await updateDoc(doc(db, "notifications", notif.id), { isRead: true });
          } catch (error) { console.error("Lỗi cập nhật", error); }
      }
      if (notif.type === "fee_reminder") {
          setShowNotifModal(false);
          setShowFeeModal(true); 
      }
  };
  // 👉 THÊM MỚI: State lưu tháng đang chọn và List 12 tháng gần nhất
  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    return { month: d.getMonth(), year: d.getFullYear() };
});

const monthOptions = React.useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return { label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`, value: `${d.getMonth()}-${d.getFullYear()}` };
    });
}, []);

// 👉 BƯỚC 1: Thêm State lọc theo Cơ sở và Tab Đơn hàng
const [filterLocation, setFilterLocation] = useState<string>("all");
const [orderTab, setOrderTab] = useState("pending");

// 👉 BƯỚC 2: KÉO THÔNG TIN NGÂN HÀNG CỦA ADMIN VỀ MÁY
useEffect(() => {
  const fetchAdminConfig = async () => {
      try {
          const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
          if (configSnap.exists()) {
              const data = configSnap.data();
              setAdminBankInfoText(data.bankInfoText || "");
              setAdminBankQrLink(data.bankQrLink || "");
          }
      } catch (e) {
          console.error("Lỗi lấy thông tin ngân hàng:", e);
      }
  };
  fetchAdminConfig();
}, []);

// 👉 Cập nhật thuật toán: Lọc doanh thu & đếm đơn theo Cơ sở
// 👉 BƯỚC 2: CẬP NHẬT THUẬT TOÁN TÁCH LUỒNG DỮ LIỆU CƠ SỞ
useEffect(() => {
  const fetchStatsAndCounts = async () => {
      if (!userData.phone) return;

      let pCount = 0; let tRev = 0; let mRev = 0; let cCount = 0;
      let mFee = 0; let tFee = 0; 

      try {
          const ordersRef = collection(db, "orders");
          let allDocs: any[] = [];

          const qPhone = query(ordersRef, where("shopId", "==", userData.phone));
          const snapPhone = await getDocs(qPhone);
          snapPhone.forEach(doc => allDocs.push(doc));

          const qProvider = query(ordersRef, where("providerId", "==", userData.phone));
          const snapProvider = await getDocs(qProvider);
          snapProvider.forEach(doc => allDocs.push(doc));

          const uniqueIds = new Set();
          let cOrders: any[] = [];
          let allLocOrders: any[] = []; // 👉 Dành riêng cho Modal đối soát

          allDocs.forEach(doc => {
              if (!uniqueIds.has(doc.id)) {
                  uniqueIds.add(doc.id);
                  const data = doc.data();
                  
                  const locName = data.location?.name || "";
                  const isMatchLocation = filterLocation === "all" || locName === filterLocation;
                  
                  if (isMatchLocation && (data.status === "pending" || data.status === "confirmed")) {
                      pCount++;
                  }
                  
                  if (data.status === "completed" || data.status === "success") {
                    const amount = Number(data.totalAmount || data.totalPrice || data.total || 0);
                    const fee = data.platformFee !== undefined ? Number(data.platformFee) : Math.floor(amount * 10 / 100);

                    if (isMatchLocation) {
                        tRev += amount; 
                        // 👉 BƯỚC 1: Chỉ cộng dồn phí nền tảng tổng nếu đơn CHƯA thanh toán
                        if (!data.isFeePaid) {
                            tFee += fee;
                        }
                    }

                    let orderDate: Date | null = null;
                    if (data.createdAt?.toDate) orderDate = data.createdAt.toDate();
                    else if (data.createdAt?.seconds) orderDate = new Date(data.createdAt.seconds * 1000);
                    else if (data.createdAt) orderDate = new Date(data.createdAt);

                    if (orderDate && orderDate.getMonth() === filterDate.month && orderDate.getFullYear() === filterDate.year) {
                        const orderItem = { id: doc.id, ...data };
                        
                        // 👉 LUÔN LƯU VÀO DANH SÁCH "TẤT CẢ CƠ SỞ" (Cho Modal)
                        allLocOrders.push(orderItem);

                        // 👉 CHỈ LƯU VÀO cOrders (Cho Bảng ngoài) NẾU KHỚP BỘ LỌC
                        if (isMatchLocation) {
                            mRev += amount;
                            
                            // 👉 BƯỚC 1: Chỉ cộng dồn phí nền tảng theo tháng nếu đơn CHƯA thanh toán
                            if (!data.isFeePaid) {
                                mFee += fee;
                            }
                            
                            cCount++; 
                            cOrders.push(orderItem);
                        }
                    }
                }
              }
          });
          
          cOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          allLocOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

          setCompletedOrders(cOrders);
          setAllLocationsCompletedOrders(allLocOrders); // 👉 Cập nhật state mới
          setPendingCount(pCount);
          setStats({ totalRevenue: tRev, monthlyRevenue: mRev, completedCount: cCount, monthlyFee: mFee, totalFee: tFee });
      } catch (error) { console.error("Lỗi đếm đơn:", error); }
  };

  fetchStatsAndCounts();
}, [userData, orderList, filterDate, filterLocation]);

  // --- CÁC HÀM XỬ LÝ KHÁC (GIỮ NGUYÊN) ---
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
      // Sửa lại từ dòng try { ... } của hàm handleSendFeedback thành thế này:
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
  const handleUpdateShopInfo = async () => {
      if (!editName.trim()) return openSnackbar({ text: "Tên Shop không được để trống", type: "warning" });
      setUpdatingInfo(true);
      try {
          await updateDoc(doc(db, "users", userData.phone), { name: editName, address: editAddress, managerName: editManager, description: editDescription, avatar: editAvatar, cover: editCover });
          openSnackbar({ text: "Cập nhật thành công!", type: "success" });
          setShowShopInfoModal(false);
          window.dispatchEvent(new Event("authStateChanged"));
      } catch (error) { openSnackbar({ text: "Lỗi cập nhật", type: "error" }); } finally { setUpdatingInfo(false); }
  };

 // --- 1. TẠO ĐƯỜNG LINK CHUẨN ZALO MINI APP VÀO TRANG SHOP ---
 const getShopDirectLink = () => {
  const shopId = userData?.id || userData?.phone;
  
  // ĐÃ SỬA: Thêm lại dấu "/" ở đầu để giống hệt với lệnh handleSystemShare đã thành công
  const innerPath = `/shop-details/${shopId}`;
  
  // LƯU Ý NHỎ: Nếu bạn đang test thẳng trên bản Live (chính thức), 
  // hãy xóa đoạn "env=TEST&" đi để đường link thành:
   return `https://zalo.me/s/${YOUR_APP_ID}/?path=${encodeURIComponent(innerPath)}`;
  
  //return `https://zalo.me/s/${YOUR_APP_ID}/?env=TEST&path=${encodeURIComponent(innerPath)}`;
};

  // --- 2. XỬ LÝ CHIA SẺ QUA TIN NHẮN ZALO ---
  const handleSystemShare = async () => { 
      try { 
          await openShareSheet({ 
              type: "zmp_deep_link", 
              data: { 
                  title: `Ghé thăm Shop ${userData.name}!`, 
                  description: "Đặt lịch dịch vụ chăm sóc sức khỏe uy tín.", 
                  thumbnail: userData.avatar || "https://h5.zdn.vn/static/images/avatar.png", 
                  path: `/shop-details/${userData?.id || userData?.phone}` // Mở đúng trang Shop
              }, 
          } as any); 
      } catch (err) { console.log(err); } 
  };

  // --- 3. XỬ LÝ NÚT COPY LINK ---
  const copyShareLink = async () => { 
      try {
        const link = getShopDirectLink();
        // Cố gắng copy link vào bộ nhớ tạm
        await navigator.clipboard.writeText(link);
        openSnackbar({ text: "Đã sao chép link cửa hàng!", type: "success" });
      } catch (error) {
        // Trong trường hợp trình duyệt chặn quyền copy (như khi test trên localhost)
        console.error("Lỗi copy:", error);
        openSnackbar({ text: "Không thể sao chép tự động", type: "error" });
      }
  };
  // 👉 SỬA LẠI HÀM NÀY ĐỂ GHÉP ĐỊA CHỈ TỪ API
  const handleAddLocation = async () => {
    // 1. Kiểm tra xem đã nhập/chọn đủ thông tin chưa
    if (!newLocName || !newLocPhone || !selectedProvince || !selectedDistrict || !selectedWard || !newLocAddress) {
      return openSnackbar({ text: "Vui lòng nhập đủ thông tin và chọn đầy đủ địa chỉ", type: "warning" });
    }

    // 👉 BƯỚC BỔ SUNG: Kiểm tra xem SĐT Quản lý đã tồn tại trên Firebase chưa
    if (newLocManagerPhone) {
      try {
        // Do bạn đang dùng SĐT làm ID của document trong collection "users", 
        // nên ta dùng getDoc để check trực tiếp ID này (cách này chạy rất nhanh)
        const managerRef = doc(db, "users", newLocManagerPhone);
        const managerSnap = await getDoc(managerRef);

        if (managerSnap.exists()) {
          return openSnackbar({ 
            text: `SĐT Quản lý (${newLocManagerPhone}) đã được đăng ký trên hệ thống. Vui lòng dùng số khác!`, 
            type: "error" 
          });
        }
      } catch (error) {
        console.error("Lỗi kiểm tra SĐT Quản lý:", error);
        return openSnackbar({ text: "Lỗi kiểm tra dữ liệu, vui lòng thử lại!", type: "error" });
      }
    }

    // 👉 TÙY CHỌN: Kiểm tra luôn SĐT Hotline cơ sở (nếu bạn không muốn Hotline bị trùng với user nào)
    if (newLocPhone) {
      try {
        const phoneRef = doc(db, "users", newLocPhone);
        const phoneSnap = await getDoc(phoneRef);

        if (phoneSnap.exists()) {
          return openSnackbar({ 
            text: `SĐT Hotline (${newLocPhone}) đã có người sử dụng. Vui lòng dùng số khác!`, 
            type: "error" 
          });
        }
      } catch (error) {
        console.error("Lỗi kiểm tra Hotline:", error);
        return openSnackbar({ text: "Lỗi kiểm tra dữ liệu, vui lòng thử lại!", type: "error" });
      }
    }

    // 2. Ghép chuỗi địa chỉ hoàn chỉnh
    const fullAddress = `${newLocAddress}, ${selectedWard.name}, ${selectedDistrict.name}, ${selectedProvince.name}`;

    const newLoc = { name: newLocName, phone: newLocPhone, address: fullAddress, managerPhone: newLocManagerPhone };
    setLocations([...locations, newLoc]);
    
    // 3. Reset toàn bộ form sau khi thêm thành công
    setNewLocName(""); 
    setNewLocPhone("");
    setNewLocManagerPhone(""); 
    setNewLocAddress("");
    setSelectedProvince(null);
    setSelectedDistrict(null);
    setSelectedWard(null);
    setDistricts([]);
    setWards([]);

    openSnackbar({ text: "Đã thêm cơ sở vào danh sách. Nhấn Lưu để hoàn tất!", type: "success" });
  };

  const handleRemoveLocation = (indexToRemove: number) => {
    setLocations(locations.filter((_, index) => index !== indexToRemove));
  };
  const handleOpenEditLocation = (index: number) => {
    const loc = locations[index];
    setEditLocName(loc.name || "");
    setEditLocPhone(loc.phone || "");
    setEditLocManagerPhone(loc.managerPhone || "");
    setEditLocAddress(loc.address || "");
    setEditingLocIndex(index); // Mở Modal sửa
  };

  const handleSaveEditLocation = async () => {
    // 1. Kiểm tra đầu vào cơ bản
    if (!editLocName || !editLocPhone || !editLocAddress) {
      return openSnackbar({ text: "Vui lòng nhập đủ thông tin cơ bản", type: "warning" });
    }

    // Lấy thông tin của cơ sở đang được sửa (trước khi thay đổi)
    const currentLocation = locations[editingLocIndex as number];

    // 👉 2. KIỂM TRA SĐT QUẢN LÝ
    // (Chỉ gọi Firebase nếu có nhập SĐT mới VÀ SĐT này khác với SĐT cũ)
    if (editLocManagerPhone && editLocManagerPhone !== currentLocation.managerPhone) {
      try {
        const managerRef = doc(db, "users", editLocManagerPhone);
        const managerSnap = await getDoc(managerRef);

        if (managerSnap.exists()) {
          return openSnackbar({ 
            text: `SĐT Quản lý (${editLocManagerPhone}) đã có người đăng ký. Vui lòng dùng số khác!`, 
            type: "error" 
          });
        }
      } catch (error) {
        console.error("Lỗi kiểm tra SĐT Quản lý:", error);
        return openSnackbar({ text: "Lỗi kiểm tra dữ liệu, vui lòng thử lại!", type: "error" });
      }
    }

    // 👉 3. KIỂM TRA SĐT HOTLINE
    // (Chỉ gọi Firebase nếu có nhập SĐT mới VÀ SĐT này khác với SĐT cũ)
    if (editLocPhone && editLocPhone !== currentLocation.phone) {
      try {
        const phoneRef = doc(db, "users", editLocPhone);
        const phoneSnap = await getDoc(phoneRef);

        if (phoneSnap.exists()) {
          return openSnackbar({ 
            text: `SĐT Hotline (${editLocPhone}) đã có người sử dụng. Vui lòng dùng số khác!`, 
            type: "error" 
          });
        }
      } catch (error) {
        console.error("Lỗi kiểm tra Hotline:", error);
        return openSnackbar({ text: "Lỗi kiểm tra dữ liệu, vui lòng thử lại!", type: "error" });
      }
    }

    // 4. Cập nhật dữ liệu vào danh sách tạm
    const updatedLocations = [...locations];
    updatedLocations[editingLocIndex as number] = {
      ...updatedLocations[editingLocIndex as number],
      name: editLocName,
      phone: editLocPhone,
      managerPhone: editLocManagerPhone,
      address: editLocAddress
    };

    setLocations(updatedLocations);
    setEditingLocIndex(null); // Đóng Modal sửa
    openSnackbar({ text: "Đã cập nhật cơ sở. Nhấn Lưu hệ thống để hoàn tất!", type: "success" });
  };
  const handleSaveLocations = async () => {
    setSavingLocations(true);
    try {
      // 1. Lưu danh sách cơ sở vào data của Shop chính
      await updateDoc(doc(db, "users", userData.phone), { locations: locations });

      // 2. Tự động tạo tài khoản mặc định cho các Quản lý (nếu họ chưa có tài khoản)
      for (const loc of locations) {
          if (loc.managerPhone) {
              const managerRef = doc(db, "users", loc.managerPhone);
              // Lệnh setDoc với { merge: true } nghĩa là: 
              // - Nếu SĐT này chưa đăng ký -> Tạo mới với pass 123456
              // - Nếu họ đã có tài khoản rồi -> Giữ nguyên pass của họ, không làm gì cả
              await setDoc(managerRef, {
                  phone: loc.managerPhone,
                  name: `Quản lý ${loc.name}`, // Tên mặc định
                  password: "123456",          // Mật khẩu mặc định
                  role: "member",              // Cứ để là member, hàm "Gác cổng" sẽ tự bẻ lái sang BranchView
                  status: "active",
                  address: loc.address,
                  branchInfo: {
                    branchName: loc.name,
                    branchAddress: loc.address,
                    mainShopName: userData.name,
                    mainShopId: userData.phone
                },
                  createdAt: serverTimestamp()
              }, { merge: true });
          }
      }

      openSnackbar({ text: "Đã lưu hệ thống cơ sở!", type: "success" });
      setShowLocationsModal(false);
      window.dispatchEvent(new Event("authStateChanged"));
    } catch (error) {
      console.error(error);
      openSnackbar({ text: "Lỗi lưu dữ liệu", type: "error" });
    } finally {
      setSavingLocations(false);
    }
  };

  if (userData.status === "pending") {
    return (
      <Box className="m-4 p-6 bg-white rounded-xl flex flex-col items-center text-center shadow-md border border-yellow-100">
        <CustomIcon icon="zi-warning-solid" className="text-yellow-500 text-5xl mb-3" />
        <Text.Title size="small">Hồ sơ chờ phê duyệt</Text.Title>
        <Text size="small" className="text-gray-500 mt-2">Hồ sơ Nhà cung cấp của bạn đang được Admin xét duyệt. Chúng tôi sẽ thông báo khi tài khoản được kích hoạt.</Text>
      </Box>
    );
  }

  // --- GIAO DIỆN CHÍNH ---
  return (
    <Box className="animate-fade-in pb-10">
      {/* 0. NÚT QUAY LẠI */}
      {onBackToProfile && (
        <Box className="px-4 pt-4 flex items-center cursor-pointer active:opacity-70" onClick={onBackToProfile}>
          <Icon icon="zi-arrow-left" className="text-gray-800 text-2xl mr-2" />
          <Text.Title size="large" className="font-bold text-gray-800">Quản lý Cửa Hàng</Text.Title>
        </Box>
      )}

      {/* 1. HEADER THÔNG TIN SHOP */}
      <Box 
        className="bg-white p-4 m-4 rounded-xl flex items-center shadow-md border border-gray-100 relative overflow-hidden active:opacity-80 cursor-pointer"
        onClick={() => setShowShopInfoModal(true)}
      >
        <Avatar src={userData.avatar} size={64} className="border-2 border-blue-500 shadow" />
        <Box ml={4} className="flex-1 z-10">
        <Box flex alignItems="center">
               <Text.Title size="normal" className="line-clamp-1 flex-1">{userData.name}</Text.Title>
               <CustomIcon icon="zi-check-circle-solid" className="text-green-500 mx-1.5 shrink-0" size={18} />
               
               <Box className="ml-auto flex items-center shrink-0">
                   {/* 👉 QUẢ CHUÔNG THÔNG BÁO VỚI HIỆU ỨNG CHẤM ĐỎ */}
                   <Box 
                       className="relative mr-3 p-1 rounded-full bg-white/80 border border-gray-100 shadow-md active:bg-gray-100"
                       onClick={(e) => { e.stopPropagation(); setShowNotifModal(true); }}
                   >
                       <CustomIcon icon="zi-notif" size={20} className="text-gray-600"/>
                       {unreadCount > 0 && (
                           <Box className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex justify-center items-center rounded-full font-bold border border-white shadow-md animate-pulse">
                               {unreadCount > 9 ? '9+' : unreadCount}
                           </Box>
                       )}
                   </Box>
                   <CustomIcon icon="zi-edit-text" className="text-gray-400" size={20}/>
               </Box>
           </Box>
           <Box flex alignItems="center" className={`mt-1 mb-2 px-2 py-0.5 rounded-full w-fit ${shopRankInfo.color} border border-white/50 shadow-md`}>
               <CustomIcon icon={shopRankInfo.icon as any} size={12} className="mr-1"/>
               <Text size="xxxxSmall" className="font-bold uppercase tracking-wide">{shopRankInfo.name} Shop</Text>
           </Box>
           <Text size="xxSmall" className="text-gray-500 mb-1 line-clamp-1">{userData.address || "Chạm để cập nhật địa chỉ"}</Text>
           <Text size="xxSmall" className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md inline-block">{userData.phone}</Text>
        </Box>
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-50/50 rounded-full"></div>
      </Box>
      {/* 👉 👉 👉 DÁN TOÀN BỘ KHỐI THỐNG KÊ DOANH THU VÀO ĐÂY 👈 👈 👈 */}
      <Box className="m-4 bg-white rounded-2xl shadow-md border border-gray-100 p-4 animate-fade-in-down">
      <Box flex flexDirection="column" mb={3}>
              <Box flex justifyContent="space-between" alignItems="center" mb={2}>
                  <Text bold size="normal" className="text-gray-800">Thống kê tổng quan</Text>
                  <Box className="w-[140px]">
                      <Select
                          value={`${filterDate.month}-${filterDate.year}`}
                          onChange={(val) => {
                              const [m, y] = (val as string).split('-');
                              setFilterDate({ month: parseInt(m), year: parseInt(y) });
                          }}
                          closeOnSelect
                      >
                          {monthOptions.map(opt => <Option key={opt.value} value={opt.value} title={opt.label} />)}
                      </Select>
                  </Box>
              </Box>

              {/* 👉 BƯỚC 2: BỘ LỌC CƠ SỞ */}
              {locations.length > 0 && (
                  <Box flex alignItems="center" className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                      <CustomIcon icon="zi-location" size={16} className="text-blue-500 mr-2" />
                      <Box className="flex-1">
                          <Select value={filterLocation} onChange={(val) => setFilterLocation(val as string)} closeOnSelect>
                              <Option value="all" title="Tất cả cơ sở" />
                              {locations.map((loc, idx) => (
                                  <Option key={idx} value={loc.name} title={loc.name} />
                              ))}
                          </Select>
                      </Box>
                  </Box>
              )}
          </Box>

          <Box flex style={{ gap: '12px' }}>
          <Box className="flex-1 bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl text-white shadow-md">
                  <Box flex alignItems="center" mb={1} className="opacity-80">
                      <CustomIcon icon="zi-poll" size={16} className="mr-1"/>
                      <Text size="xSmall" className="uppercase tracking-wider">Doanh thu tháng</Text>
                  </Box>
                  <Text bold size="large">{stats.monthlyRevenue.toLocaleString()}đ</Text>
              </Box>

              <Box 
      className="flex-1 bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl text-white shadow-md cursor-pointer active:opacity-80 transition-opacity"
      onClick={() => setShowCompletedModal(true)}
  >
                  <Box flex alignItems="center" mb={1} className="opacity-80">
                      <CustomIcon icon="zi-check-circle" size={16} className="mr-1"/>
                      <Text size="xSmall" className="uppercase tracking-wider">Đã phục vụ</Text>
                  </Box>
                  <Text bold size="large">{stats.completedCount} đơn</Text>
              </Box>
          </Box>
          {/* 👉 BƯỚC 2: Ô CHI PHÍ NỀN TẢNG CÓ THỂ CLICK VÀO */}
          <Box 
              mt={3} p={3} 
              className="bg-red-50 rounded-xl border border-red-100 flex justify-between items-center cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => setShowFeeModal(true)}
          >
              <Box flex alignItems="center">
                  <Box className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 shadow-md">
                      <CustomIcon icon="zi-poll" className="text-red-500" size={16}/>
                  </Box>
                  <Text size="small" className="text-gray-700 font-medium">Chi phí nền tảng (Còn nợ):</Text>
              </Box>
              <Box flex alignItems="center">
                  <Text bold size="normal" className="text-red-500 mr-2">-{stats.monthlyFee.toLocaleString()}đ</Text>
                  <CustomIcon icon="zi-chevron-right" className="text-red-400" size={16}/>
              </Box>
          </Box>

          <Box mt={3} p={3} className="bg-orange-50 rounded-xl border border-orange-100 flex justify-between items-center">
              <Box flex alignItems="center">
                  <Box className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 shadow-md">
                      <CustomIcon icon="zi-memory" className="text-orange-600" size={16}/>
                  </Box>
                  <Text size="small" className="text-gray-700 font-medium">Tổng doanh thu lũy kế:</Text>
              </Box>
              <Text bold size="normal" className="text-orange-600">{stats.totalRevenue.toLocaleString()}đ</Text>
          </Box>
      </Box>
      {/* 2. MENU QUẢN LÝ */}
      <Box className="mx-4 mb-4">
          <Box className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-50 mb-4">
              <Text.Title size="small" className="p-4 pb-2 text-gray-500 font-bold bg-gray-50">Dịch vụ & Bài đăng</Text.Title>
              <List>
                  <Item title="Đăng Sản phẩm/Dịch vụ mới" prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-50"><Icon icon="zi-plus-circle" className="text-green-600" size={18}/></div>} suffix={<Icon icon="zi-chevron-right" className="text-gray-400"/>} onClick={() => navigate("/post-service")} />
                  <Item 
    title="Quản lý đơn hàng" 
    subTitle="Theo dõi tất cả đơn đặt lịch" 
    prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50"><CustomIcon icon="zi-note" className="text-blue-600" size={18}/></div>} 
    suffix={
      <Box flex alignItems="center">
          {pendingCount > 0 && (
              <Box className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 shadow-md animate-pulse">
                  {pendingCount} mới
              </Box>
          )}
          <CustomIcon icon="zi-chevron-right" className="text-gray-400"/>
      </Box>
  } 
  onClick={fetchShopOrders} 
/>
                  <Item title="Xem trang cửa hàng" subTitle="Xem giao diện khách hàng" prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50"><CustomIcon icon="zi-list-1" className="text-blue-600" size={18}/></div>} suffix={<CustomIcon icon="zi-chevron-right" className="text-gray-400"/>} onClick={goToShopDetail} />
                  <Item title="Trang cá nhân (Bài đăng)" subTitle="Xem hồ sơ và bài đăng của Shop" prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-50"><CustomIcon icon="zi-user" className="text-teal-600" size={18}/></div>} suffix={<CustomIcon icon="zi-chevron-right" className="text-gray-400"/>} onClick={() => {
                      if (onBackToProfile) {
                          onBackToProfile();
                      } else {
                          const shopId = userData?.id || userData?.phone;
                          if (shopId) navigate(`/profile?id=${shopId}`);
                      }
                  }} />
              </List>
          </Box>
          <Box className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-50 mb-4">
              <Text.Title size="small" className="p-4 pb-2 text-gray-500 font-bold bg-gray-50">Quản lý & Hỗ trợ</Text.Title>
              <List>
                  <Item title="Danh sách khách hàng" subTitle="Người dùng do Shop giới thiệu" prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-50"><CustomIcon icon="zi-group" className="text-orange-600" size={18}/></div>} suffix={<CustomIcon icon="zi-chevron-right" className="text-gray-400"/>} onClick={handleShowReferrals} />
                  <Item title="Chia sẻ ứng dụng" subTitle="QR Code + Mã giới thiệu" prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-50"><CustomIcon icon="zi-share-external-1" className="text-purple-600" size={18}/></div>} suffix={<CustomIcon icon="zi-chevron-right" className="text-gray-400"/>} onClick={() => setShowShareModal(true)} />
                  <Item title="Đổi mật khẩu" prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50"><CustomIcon icon="zi-lock" className="text-red-600" size={18}/></div>} suffix={<CustomIcon icon="zi-chevron-right" className="text-gray-400"/>} onClick={() => setShowChangePassModal(true)} />
                  <Item 
                        title="Gửi phản hồi" 
                        prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-teal-50"><Icon icon="zi-chat" className="text-teal-600" size={18}/></div>} 
                        suffix={
                            <Box flex alignItems="center">
                                {unreadFeedbackCount > 0 && (
                                    <Box className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 shadow-sm animate-pulse">
                                        {unreadFeedbackCount} mới
                                    </Box>
                                )}
                                <Icon icon="zi-chevron-right" className="text-gray-400"/>
                            </Box>
                        } 
                        onClick={() => { setShowFeedbackModal(true); fetchMyFeedbacks(); }} 
                         />
                  <Item 
                      title="Đăng xuất tài khoản" 
                      prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100"><Icon icon="zi-leave" className="text-red-500" size={18}/></div>} 
                      suffix={<Icon icon="zi-chevron-right" className="text-gray-400"/>}
                      onClick={onLogout} 
                        />
              </List>
          </Box>
      </Box>

      {/* --- CÁC MODAL --- */}

      {/* MODAL THÔNG TIN SHOP & VÍ ĐIỂM */}
      <Modal visible={showShopInfoModal} title="Thông tin Shop" onClose={() => setShowShopInfoModal(false)}>
          <Box p={4}>
              <Text.Title size="small" className="mb-3 text-gray-700">Ví điểm thưởng</Text.Title>
              <Box className="mb-6">
                  {/* TRẢI RỘNG KHỐI TỔNG TÍCH LŨY */}
                  <Box 
                    className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 rounded-xl border border-yellow-200 text-center active:opacity-60 cursor-pointer"
                    
                    onClick={() => setShowRankDetailModal(true)}
                  >
                      <CustomIcon icon="zi-poll-solid" className="text-green-600 mb-1" size={24}/>
                      <Text size="xSmall" className="text-gray-600">Tổng tích lũy</Text>
                      <Text size="large" bold className="text-green-700">{(userData.rankPoints || 0).toLocaleString()}</Text>
                      <Text size="xxxxSmall" className="text-green-600 italic mt-1 font-bold">Chạm để xem hạng và quyền lợi</Text>
                  </Box>
              </Box>

              <div className="h-[1px] bg-gray-200 w-full mb-4"></div>

              <Text.Title size="small" className="mb-3 text-gray-700">Cập nhật thông tin</Text.Title>
              <Box mb={4}><Input label="Tên Shop" value={editName} onChange={(e) => setEditName(e.target.value)} clearable /></Box>
              <Box mb={4}><Input label="Địa chỉ Shop" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} clearable /></Box>
              <Box mb={4}><Input label="Tên người quản lý" value={editManager} onChange={(e) => setEditManager(e.target.value)} clearable placeholder="VD: Nguyễn Văn A" /></Box>
              <Box mb={4}>
                  <TextArea label="Giới thiệu Shop" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Nhập lời giới thiệu ngắn về cửa hàng của bạn..." rows={3} />
              </Box>
              <Box mb={4}>
                  <Input label="Link ảnh đại diện (Avatar)" value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} clearable placeholder="Nhập URL ảnh định dạng http..." />
              </Box>
              <Box mb={4}>
                  <Input label="Link ảnh bìa (Banner)" value={editCover} onChange={(e) => setEditCover(e.target.value)} clearable placeholder="Nhập URL ảnh định dạng http..." />
              </Box>
              <Button fullWidth loading={updatingInfo} onClick={handleUpdateShopInfo}>Lưu thay đổi</Button>
          </Box>
      </Modal>

      {/* 👉 MODAL CHI TIẾT RANK (MỚI) */}
      <Modal visible={showRankDetailModal} title="Tiến trình lên hạng" onClose={() => setShowRankDetailModal(false)} actions={[{ text: "Đóng", onClick: () => setShowRankDetailModal(false) }]}>
          <Box p={4} flex flexDirection="column" alignItems="center">
              <Box className={`p-4 rounded-full mb-4 ${shopRankInfo.color}`}><CustomIcon icon={shopRankInfo.icon as any} size={40} /></Box>
              <Text.Title size="large" className="text-center">{shopRankInfo.name}</Text.Title>
              <Text size="small" className="text-gray-500 mb-6 text-center">Hạng hiện tại của Shop</Text>

              {shopRankInfo.target > 0 ? (
                  <Box className="w-full">
                      <Box flex justifyContent="space-between" mb={1}>
                          <Text size="xSmall" className="text-blue-600 font-bold">Đang có: {userData.rankPoints || 0}</Text>
                          <Text size="xSmall" className="text-gray-500">Mục tiêu: {shopRankInfo.target}</Text>
                      </Box>
                      <Progress completed={Math.min(100, ((userData.rankPoints || 0) / shopRankInfo.target) * 100)} maxCompleted={100} className="mb-2"/>
                      <Box className="bg-blue-50 p-3 rounded-lg text-center mt-4">
                          <Text size="small">Bạn cần tích lũy thêm <span className="text-red-600 font-bold">{(shopRankInfo.target - (userData.rankPoints || 0)).toLocaleString()} điểm</span> nữa để lên hạng <span className="text-blue-600 font-bold">{shopRankInfo.nextRank}</span></Text>
                      </Box>
                  </Box>
              ) : (
                  <Text className="text-green-600 font-bold text-center">Chúc mừng! Bạn đã đạt hạng cao nhất.</Text>
              )}
          </Box>
      </Modal>

      {/* 👉 MODAL LỊCH SỬ TIÊU DÙNG (MỚI) */}
      <Modal visible={showHistoryModal} title="Lịch sử tiêu dùng" onClose={() => setShowHistoryModal(false)} actions={[{ text: "Đóng", onClick: () => setShowHistoryModal(false) }]}>
          <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {historyLoading ? (
                  <Box flex justifyContent="center"><Spinner /></Box>
              ) : historyList.length > 0 ? (
                  historyList.map((item, idx) => (
                      <Box key={idx} className="mb-3 pb-3 border-b border-gray-100 last:border-0 flex justify-between items-center">
                          <Box>
                              <Text size="small" bold>{item.description || "Mua hàng / Đổi quà"}</Text>
                              <Text size="xxSmall" className="text-gray-500">{formatDate(item.createdAt)}</Text>
                          </Box>
                          <Text size="small" className="text-red-600 font-bold">-{item.amount?.toLocaleString()} điểm</Text>
                      </Box>
                  ))
              ) : (
                  <Box flex flexDirection="column" alignItems="center" py={4}>
                      <CustomIcon icon="zi-clock-2" className="text-gray-300 mb-2" size={40}/>
                      <Text size="small" className="text-gray-400">Chưa có lịch sử trừ điểm nào.</Text>
                  </Box>
              )}
          </Box>
      </Modal>

      {/* CÁC MODAL KHÁC GIỮ NGUYÊN */}
      <Modal visible={showReferralModal} title="Khách hàng giới thiệu" onClose={() => setShowReferralModal(false)} actions={[{ text: "Đóng", onClick: () => setShowReferralModal(false) }]}>
          <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {referralLoading ? <Box flex justifyContent="center"><Spinner /></Box> : referralList.length > 0 ? <Box><Box className="bg-blue-50 p-2 rounded-lg text-center mb-4 border border-blue-100"><Text bold className="text-blue-600">Tổng cộng: {referralList.length} khách</Text></Box>{referralList.map((cus, idx) => (<Box key={idx} flex alignItems="center" className="mb-3 pb-3 border-b border-gray-100 last:border-0"><Avatar src={cus.avatar} size={40} className="border" /><Box ml={3}><Text size="small" bold>{cus.name}</Text><Text size="xxSmall" className="text-gray-500">{cus.phone}</Text></Box></Box>))}</Box> : <Text className="text-center text-gray-400 mt-10 p-4 bg-gray-50 rounded italic">Chưa giới thiệu được khách nào.</Text>}
          </Box>
      </Modal>

      <Modal visible={showShareModal} title="Chia sẻ cửa hàng" onClose={() => setShowShareModal(false)}>
        <Box p={4} flex flexDirection="column" alignItems="center" className="text-center animate-fade-in">
            <Text size="small" className="text-gray-600 mb-4">Quét mã QR để vào thẳng trang Shop!</Text>
            
            <Box className="flex flex-col items-center w-fit mx-auto border-2 border-blue-400 rounded-2xl p-4 mb-6 shadow-md bg-white">
                {/* ĐÃ TRẢ LẠI LINK CHUẨN: Dùng link chính thức của Zalo để quét bằng mọi camera đều được */}
                <img 
                    src={`https://quickchart.io/qr?size=200&margin=1&text=${encodeURIComponent(getShopDirectLink())}`} 
                    alt={`Mã QR Shop ${userData.name}`} 
                    style={{ width: 180, height: 180 }} 
                />
            </Box>
            
            <Box className="bg-gray-100 p-3 rounded-lg w-full text-center mb-4 border border-gray-200 shadow-inner">
                <Text size="xxSmall" className="text-gray-500 mb-1">Mã cửa hàng (SĐT Shop)</Text>
                <Text size="large" bold className="text-blue-600 tracking-wider">{userData.phone}</Text>
            </Box>
            
            <Button fullWidth onClick={copyShareLink} prefixIcon={<CustomIcon icon="zi-copy"/>}>Sao chép liên kết</Button>
            <Button fullWidth variant="tertiary" className="mt-2 text-gray-500" onClick={handleSystemShare} prefixIcon={<CustomIcon icon="zi-chat"/>}>Chia sẻ qua Zalo</Button>
        </Box>
      </Modal>

      <Modal visible={showChangePassModal} title="Đổi mật khẩu" onClose={() => setShowChangePassModal(false)} actions={[{text:"Đóng", onClick:()=>setShowChangePassModal(false)}]}>
        <Box p={4}><Box mb={4}><Input.Password label="Mật khẩu cũ" value={oldPass} onChange={(e) => setOldPass(e.target.value)} /></Box><Box mb={4}><Input.Password label="Mật khẩu mới" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></Box><Box mb={4}><Input.Password label="Xác nhận" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} /></Box><Button fullWidth loading={passLoading} onClick={handleChangePassword}>Cập nhật</Button></Box>
      </Modal>

      <Modal visible={showFeedbackModal} title="Phản hồi & Hỗ trợ" onClose={() => setShowFeedbackModal(false)}>
          <Box p={0} className="bg-gray-50 flex flex-col" style={{ height: '70vh' }}>
              
              {/* THANH TAB */}
              <Box flex className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0">
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${feedbackTab==="new"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setFeedbackTab("new")}>
                      Gửi yêu cầu
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${feedbackTab==="history"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setFeedbackTab("history")}>
                      Lịch sử ({feedbackList.length})
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
                          <Button fullWidth loading={feedbackLoading} onClick={handleSendFeedback} prefixIcon={<CustomIcon icon="zi-send-solid" className="text-white"/>}>
                              Gửi yêu cầu
                          </Button>
                      </Box>
                  ) : (
                      <Box className="animate-fade-in-up">
                          {loadingFeedbacks ? (
                              <Box flex justifyContent="center" py={5}><Spinner /></Box>
                          ) : feedbackList.length === 0 ? (
                              <Box flex flexDirection="column" alignItems="center" py={5}>
                                  <CustomIcon icon="zi-chat" size={40} className="text-gray-300 mb-2"/>
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
                                                      <CustomIcon icon="zi-user" size={12} className="text-white"/>
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
      <Modal visible={showLocationsModal} title="Hệ thống cơ sở" onClose={() => setShowLocationsModal(false)}>
          <Box p={4} style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <Text size="small" className="text-gray-500 mb-4">Quản lý các chi nhánh trực thuộc cửa hàng của bạn. Số điện thoại ở đây sẽ hiển thị để khách hàng liên hệ trực tiếp.</Text>
              
              {/* Danh sách cơ sở hiện tại */}
              {locations.length > 0 && (
                  <Box className="mb-6">
                      <Text.Title size="small" className="mb-2 text-gray-700">Các cơ sở hiện tại</Text.Title>
                      {locations.map((loc, idx) => (
                          <Box key={idx} className="p-3 bg-gray-50 rounded-xl mb-2 border border-gray-200 flex justify-between items-center relative">
                              <Box pr={8}>
                                  <Text bold size="small" className="text-gray-800">{loc.name}</Text>
                                  <Text size="xSmall" className="text-blue-600 font-medium my-0.5">{loc.phone}</Text>
                                  <Text size="xSmall" className="text-gray-500 line-clamp-2">{loc.address}</Text>
                                  {loc.managerPhone && (
                                      <Text size="xSmall" className="text-green-600 font-medium mt-1">
                                          Quản lý: {loc.managerPhone}
                                      </Text>
                                  )}
                              </Box>
                              {/* Nút xóa cơ sở */}
                              <Box className="absolute right-3 top-3 flex gap-3">
                                  <div 
                                    className="cursor-pointer active:opacity-50" 
                                    onClick={() => handleOpenEditLocation(idx)}
                                  >
                                      <CustomIcon icon="zi-edit" className="text-blue-500" />
                                  </div>
                                  <div 
                                    className="cursor-pointer active:opacity-50" 
                                    onClick={() => handleRemoveLocation(idx)}
                                  >
                                      <CustomIcon icon="zi-close-circle" className="text-red-400" />
                                  </div>
                              </Box>
                          </Box>
                      ))}
                  </Box>
              )}

              {/* Form thêm cơ sở mới */}
              {/* 👉 ĐÃ CẬP NHẬT: Form thêm cơ sở mới với chọn địa chỉ API */}
              <Box className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mb-4">
                  <Text.Title size="small" className="mb-3 text-blue-800">Thêm cơ sở mới</Text.Title>
                  
                  <Box mb={3}>
                      <Input label="Tên cơ sở" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} placeholder="VD: Chi nhánh Cầu Giấy" />
                  </Box>
                  <Box mb={3}>
                      <Input type="text" label="Số điện thoại Zalo / Hotline" value={newLocPhone} onChange={(e) => setNewLocPhone(e.target.value)} placeholder="VD: 0912345678" />
                  </Box>
                  <Box mb={3}>
                      <Input type="text" label="SĐT Zalo Quản lý (Để đăng nhập App)" value={newLocManagerPhone} onChange={(e) => setNewLocManagerPhone(e.target.value)} placeholder="VD: 0987654321" />
                  </Box>                  
                  <Text size="small" className="mb-1 text-gray-700 font-medium ml-1 mt-2">Địa chỉ hành chính</Text>
                  
                  {/* Chọn Tỉnh / Thành Phố */}
                  <Box mb={3}>
                      <Select
                          placeholder="Chọn Tỉnh/Thành phố"
                          value={selectedProvince?.code || ""}
                          onChange={(val) => {
                              const prov = provinces.find(p => p.code === val);
                              if(prov) setSelectedProvince({ code: prov.code, name: prov.name });
                          }}
                          closeOnSelect
                      >
                          {provinces.map(p => <Option key={p.code} value={p.code} title={p.name} />)}
                      </Select>
                  </Box>

                  {/* Chọn Quận / Huyện (Chỉ hiện khi đã chọn Tỉnh) */}
                  {selectedProvince && (
                      <Box mb={3}>
                          <Select
                              placeholder="Chọn Quận/Huyện"
                              value={selectedDistrict?.code || ""}
                              onChange={(val) => {
                                  const dist = districts.find(d => d.code === val);
                                  if(dist) setSelectedDistrict({ code: dist.code, name: dist.name });
                              }}
                              closeOnSelect
                          >
                              {districts.map(d => <Option key={d.code} value={d.code} title={d.name} />)}
                          </Select>
                      </Box>
                  )}

                  {/* Chọn Phường / Xã (Chỉ hiện khi đã chọn Huyện) */}
                  {selectedDistrict && (
                      <Box mb={3}>
                          <Select
                              placeholder="Chọn Phường/Xã"
                              value={selectedWard?.code || ""}
                              onChange={(val) => {
                                  const ward = wards.find(w => w.code === val);
                                  if(ward) setSelectedWard({ code: ward.code, name: ward.name });
                              }}
                              closeOnSelect
                          >
                              {wards.map(w => <Option key={w.code} value={w.code} title={w.name} />)}
                          </Select>
                      </Box>
                  )}

                  {/* Ô nhập số nhà, tên đường */}
                  <Box mb={4}>
                      <Input 
                          label="Số nhà, Tên đường" 
                          value={newLocAddress} 
                          onChange={(e) => setNewLocAddress(e.target.value)} 
                          placeholder="VD: Số 28, ngõ 123 đường ABC" 
                      />
                  </Box>

                  <Button variant="secondary" fullWidth onClick={handleAddLocation} prefixIcon={<CustomIcon icon="zi-plus"/>}>
                      Thêm vào danh sách
                  </Button>
              </Box>

              {/* Nút lưu lên hệ thống */}
              <Button fullWidth loading={savingLocations} onClick={handleSaveLocations}>Lưu hệ thống cơ sở</Button>
          </Box>
      </Modal>
      {/* 👉 THÊM MỚI: MODAL CHỈNH SỬA CƠ SỞ */}
      <Modal 
          visible={editingLocIndex !== null} 
          title="Sửa thông tin cơ sở" 
          onClose={() => setEditingLocIndex(null)}
      >
          <Box p={4}>
              <Box mb={3}>
                  <Input label="Tên cơ sở" value={editLocName} onChange={(e) => setEditLocName(e.target.value)} />
              </Box>
              <Box mb={3}>
                  <Input type="text" label="Hotline cơ sở" value={editLocPhone} onChange={(e) => setEditLocPhone(e.target.value)} />
              </Box>
              <Box mb={3}>
                  <Input type="text" label="SĐT Zalo Quản lý" value={editLocManagerPhone} onChange={(e) => setEditLocManagerPhone(e.target.value)} />
              </Box>
              <Box mb={4}>
                  <TextArea label="Địa chỉ cụ thể" value={editLocAddress} onChange={(e) => setEditLocAddress(e.target.value)} rows={3} />
              </Box>
              
              <Button fullWidth onClick={handleSaveEditLocation}>Cập nhật thay đổi</Button>
          </Box>
      </Modal>
      {/* 👉 MODAL QUẢN LÝ ĐƠN HÀNG CHO CHỦ SHOP (ĐÃ THÊM CHI TIẾT DỊCH VỤ & GIÁ TIỀN) */}
      {/* CSS Ẩn thanh cuộn */}
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 👉 BƯỚC 3 & 4: MODAL QUẢN LÝ ĐƠN HÀNG PRO */}
      <Modal visible={showOrdersModal} title="Quản lý đơn hàng" onClose={() => setShowOrdersModal(false)}>
          <Box className="bg-gray-50 flex flex-col" style={{ height: '75vh' }}>
              {/* THANH TAB CHUYỂN ĐỔI */}
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

              <Box p={3} className="flex-1 overflow-y-auto hide-scroll">
                  {loadingOrders ? ( <Box flex justifyContent="center" py={5}><Spinner /></Box> ) : (
                      (() => {
                          let filtered = orderList;
                          if (orderTab === 'pending') filtered = filtered.filter(o => o.status === 'pending');
                          else if (orderTab === 'confirmed') filtered = filtered.filter(o => o.status === 'confirmed');
                          else filtered = filtered.filter(o => o.status === 'completed' || o.status === 'cancelled');

                          if (filtered.length === 0) return (<Box flex flexDirection="column" alignItems="center" py={8}><CustomIcon icon="zi-note" size={40} className="text-gray-300 mb-2"/><Text className="text-center text-gray-500">Trống.</Text></Box>);

                          return filtered.map((order, idx) => {
                              const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                              const originalAmount = Number(order.originalAmount || total);
                              const discountAmount = Number(order.discountAmount || 0);

                              return (
                                  <Box key={idx} className="bg-white p-3 rounded-xl mb-3 border border-gray-200 shadow-md animate-fade-in-up">
                                      <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                                          <Text size="small" bold className="text-blue-600">#{order.id.slice(0,6).toUpperCase()}</Text>
                                          <Text size="xSmall" bold className={order.status === 'pending' ? 'text-orange-500' : order.status === 'cancelled' ? 'text-red-500' : 'text-green-500'}>
                                              {order.status === 'pending' ? 'Mới' : order.status === 'confirmed' ? 'Đã chốt' : order.status === 'cancelled' ? 'Đã hủy' : 'Hoàn thành'}
                                          </Text>
                                      </Box>
                                      {/* 👉 THÊM MỚI: HIỂN THỊ LÝ DO HỦY ĐƠN */}
                                        {order.status === 'cancelled' && order.cancelReason && (
                                            <Box className="mb-2">
                                                <Text size="xSmall" className="text-red-600 bg-red-50 p-2 rounded border border-red-100 italic">
                                                    Lý do hủy: {order.cancelReason}
                                                </Text>
                                            </Box>
                                        )}
                                      {/* 👉 BỔ SUNG: HIỂN THỊ CHI TIẾT SẢN PHẨM & PHÂN LOẠI CHO CHỦ SHOP */}
                                      {order.cartItems && order.cartItems.length > 0 ? (
                                          // Trường hợp 1: Khách mua từ Giỏ hàng (Nhiều món)
                                          <Box className="mb-2 bg-gray-50/50 p-2 rounded border border-gray-100">
                                              {order.cartItems.map((item: any, i: number) => (
                                                  <Box key={i} className="mb-1 last:mb-0">
                                                      <Text size="small" bold className="text-gray-800 line-clamp-1">
                                                          <span className="text-blue-600 mr-1">x{item.quantity}</span> 
                                                          {item.product?.title || item.product?.name || item.name}
                                                      </Text>
                                                      {/* In ra phân loại của từng món trong giỏ */}
                                                      {item.options && Object.keys(item.options).length > 0 && (
                                                          <Text size="xxxxSmall" className="text-gray-500 flex items-center mt-0.5 italic">
                                                              <CustomIcon icon="zi-note" size={12} className="mr-1" />
                                                              {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                          </Text>
                                                      )}
                                                  </Box>
                                              ))}
                                          </Box>
                                      ) : (
                                          // Trường hợp 2: Khách Mua ngay 1 món hoặc Đặt lịch Dịch vụ
                                          <Box className="mb-2">
                                              <Text size="small" bold className="text-gray-800 mb-1">{order.productName}</Text>
                                              
                                              {order.selectedVariants && Object.keys(order.selectedVariants).length > 0 ? (
                                                  <Text size="xSmall" className="text-gray-600 font-medium flex items-center bg-gray-100 w-fit px-2 py-0.5 rounded">
                                                      <CustomIcon icon="zi-note" size={12} className="mr-1 text-gray-500" />
                                                      {Object.entries(order.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                  </Text>
                                              ) : (order.bookingTime || order.bookingDate) ? (
                                                  <Text size="xSmall" className="text-gray-600">⏰ {order.bookingTime} {order.bookingDate ? `- ${order.bookingDate}` : ''}</Text>
                                              ) : null}
                                          </Box>
                                      )}

                                      <Box className="bg-gray-50 p-2 rounded border border-gray-100 mb-2 flex flex-col gap-1">
                                          <Box flex alignItems="center"><CustomIcon icon="zi-user" size={14} className="text-blue-600 mr-1" /><Text size="xSmall" bold>{order.userName}</Text></Box>
                                          <Box flex alignItems="center"><CustomIcon icon="zi-location" size={14} className="text-red-500 mr-1" /><Text size="xSmall" className="text-gray-600 line-clamp-1">{order.location?.name || "Chưa rõ"}</Text></Box>
                                      </Box>

                                      <Box flex flexDirection="column" alignItems="flex-end" pt={2} className="border-t border-gray-100">
                                          {discountAmount > 0 && (<Text size="xSmall" className="text-green-600 mb-0.5">Voucher: -{discountAmount.toLocaleString()}đ</Text>)}
                                          <Box flex alignItems="baseline">
                                              <Text size="xSmall" className="text-gray-500 mr-2">Tổng:</Text>
                                              <Text bold size="large" className="text-red-600">{total.toLocaleString()}đ</Text>
                                          </Box>
                                      </Box>
                                  </Box>
                              )
                          });
                      })()
                  )}
              </Box>
              <Box p={3} className="border-t border-gray-200 bg-white shrink-0">
                  <Button fullWidth variant="secondary" onClick={() => setShowOrdersModal(false)}>Đóng bảng quản lý</Button>
              </Box>
          </Box>
      </Modal>

      {/* MODAL LỊCH SỬ ĐÃ PHỤC VỤ (CÓ CHI TIẾT PHÍ NỀN TẢNG) */}
      <Modal visible={showCompletedModal} title="Đơn đã phục vụ (Tháng này)" onClose={() => setShowCompletedModal(false)} actions={[{ text: "Đóng", onClick: () => setShowCompletedModal(false) }]}>
          <Box p={4} className="bg-gray-50 hide-scroll" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {completedOrders.length > 0 ? (
                  completedOrders.map((order, idx) => {
                      const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                      const fee = order.platformFee !== undefined ? Number(order.platformFee) : Math.floor(total * 10 / 100);
                      
                      return (
                      <Box key={idx} className="bg-white p-3 rounded-xl mb-3 border border-gray-200 shadow-md animate-fade-in-up">
                          <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                              <Text size="small" bold className="text-blue-600">#{order.id.slice(0,6).toUpperCase()}</Text>
                              <Text size="xSmall" className="text-gray-500">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('vi-VN') : ""}</Text>
                          </Box>
                          
                          <Text size="small" bold className="text-gray-800 pr-2 mb-2">{order.productName}</Text>
                          <Text size="xSmall" className="text-gray-600 mb-2">📍 {order.location?.name || "Cơ sở mặc định"}</Text>

                          {/* 👉 PHÍ NỀN TẢNG MINH BẠCH */}
                          <Box className="bg-red-50/50 p-2 rounded border border-red-100 flex justify-between items-center mb-2">
                              <Text size="xSmall" className="text-red-600">Phí nền tảng ({order.platformFeeRate || 10}%):</Text>
                              <Text size="small" bold className="text-red-600">-{fee.toLocaleString()}đ</Text>
                          </Box>
                          
                          <Box flex justify-between alignItems="center" pt={2} className="border-t border-gray-100">
                              <Text size="xSmall" className="text-gray-500">Thu khách:</Text>
                              <Text size="normal" bold className="text-green-600">{total.toLocaleString()}đ</Text>
                          </Box>
                      </Box>
                      )
                  })
              ) : (
                  <Box flex flexDirection="column" alignItems="center" py={8}>
                      <CustomIcon icon="zi-check-circle" size={40} className="text-gray-300 mb-2"/>
                      <Text className="text-center text-gray-500">Chưa có đơn hoàn thành.</Text>
                  </Box>
              )}
          </Box>
      </Modal>
      {/* 👉 BƯỚC 4: MODAL DANH SÁCH THÔNG BÁO */}
      <Modal visible={showNotifModal} title="Thông báo hệ thống" onClose={() => setShowNotifModal(false)}>
          <Box p={3} className="bg-gray-50 hide-scroll" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                  <Box flex flexDirection="column" alignItems="center" py={8}>
                      <CustomIcon icon="zi-notif" size={40} className="text-gray-300 mb-2"/>
                      <Text className="text-center text-gray-500">Chưa có thông báo nào.</Text>
                  </Box>
              ) : (
                  notifications.map((notif) => (
                      <Box 
                          key={notif.id} 
                          onClick={() => handleReadNotification(notif)}
                          className={`p-3 rounded-xl mb-3 border shadow-md transition-all cursor-pointer active:opacity-70 ${notif.isRead ? 'bg-white border-gray-200 opacity-70' : 'bg-blue-50 border-blue-200'}`}
                      >
                          <Box flex justifyContent="space-between" alignItems="center" mb={1}>
                              <Box flex alignItems="center">
                                  {notif.type === 'fee_reminder' ? (
                                      <CustomIcon icon="zi-warning" className={notif.isRead ? "text-gray-500" : "text-red-500"} size={16} />
                                  ) : (
                                      <CustomIcon icon="zi-info-circle" className={notif.isRead ? "text-gray-500" : "text-blue-500"} size={16} />
                                  )}
                                  <Text size="small" bold className={`ml-1.5 line-clamp-1 ${notif.isRead ? 'text-gray-600' : 'text-blue-800'}`}>
                                      {notif.title || "Thông báo hệ thống"}
                                  </Text>
                              </Box>
                              {/* Dấu chấm đỏ cho thư chưa đọc */}
                              {!notif.isRead && <Box className="w-2 h-2 rounded-full bg-red-500 shrink-0 ml-2"></Box>}
                          </Box>
                          
                          <Text size="xSmall" className={`mb-2 leading-relaxed ${notif.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                              {notif.content}
                          </Text>
                          
                          <Text size="xxxxSmall" className="text-gray-400 text-right">
                              {formatDate(notif.createdAt)}
                          </Text>
                      </Box>
                  ))
              )}
          </Box>
      </Modal>
      {/* 👉 BƯỚC 2: POP-UP NHẮC NỢ TỰ ĐỘNG KHỞI ĐỘNG CÙNG APP */}
      <Modal 
          visible={showDebtAlert} 
          title="⚠️ Thông báo quan trọng" 
          onClose={() => setShowDebtAlert(false)}
      >
          <Box p={4} flex flexDirection="column" alignItems="center" className="text-center animate-fade-in">
              <CustomIcon icon="zi-warning-solid" className="text-red-500 mb-3 animate-pulse" size={56} />
              <Text bold size="xLarge" className="text-red-600 mb-2">Bạn có khoản phí cần thanh toán!</Text>
              
              <Text size="small" className="text-gray-600 mb-6 leading-relaxed">
                  Hệ thống ghi nhận Shop đang có khoản nợ phí nền tảng chưa đối soát. Vui lòng kiểm tra và thanh toán sớm để duy trì hoạt động tốt nhất trên nền tảng nhé!
              </Text>
              
              <Button 
                  fullWidth 
                  className="bg-red-500 hover:bg-red-600 border-none mb-3 shadow-md"
                  onClick={() => {
                      setShowDebtAlert(false); // Tắt pop-up
                      setShowFeeModal(true);   // Mở thẳng bảng Đối soát phí
                  }}
                  prefixIcon={<CustomIcon icon="zi-warning" className="text-white"/>}
              >
                  Kiểm tra và thanh toán ngay
              </Button>
              
              <Button 
                  fullWidth 
                  variant="tertiary" 
                  className="text-gray-500"
                  onClick={() => setShowDebtAlert(false)}
              >
                  Để sau
              </Button>
          </Box>
      </Modal>
      {/* 👉 BƯỚC 3: MODAL ĐỐI SOÁT PHÍ NỀN TẢNG (CHƯA THANH TOÁN / ĐÃ THANH TOÁN) */}
      <Modal visible={showFeeModal} title="Đối soát phí nền tảng" onClose={() => setShowFeeModal(false)}>
          <Box className="bg-gray-50 flex flex-col" style={{ height: '75vh' }}>
              
              {/* THANH TAB CHUYỂN ĐỔI */}
              <Box flex className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0">
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${feeTab==="unpaid"?"border-red-500 text-red-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setFeeTab("unpaid")}>
                      Chưa thanh toán
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${feeTab==="paid"?"border-green-500 text-green-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setFeeTab("paid")}>
                      Đã thanh toán
                  </Box>
              </Box>

              <Box p={3} className="flex-1 overflow-y-auto hide-scroll">
                  {(() => {
                      // 👉 BƯỚC 3: SỬ DỤNG DANH SÁCH CỦA TẤT CẢ CƠ SỞ
                      const unpaidOrders = allLocationsCompletedOrders.filter(o => !o.isFeePaid);
                      const paidOrders = allLocationsCompletedOrders.filter(o => o.isFeePaid);
                      const displayOrders = feeTab === "unpaid" ? unpaidOrders : paidOrders;
                      
                      const totalDisplayFee = displayOrders.reduce((sum, o) => {
                          const fee = o.platformFee !== undefined ? Number(o.platformFee) : Math.floor(Number(o.totalAmount || o.totalPrice || o.total || 0) * 10 / 100);
                          return sum + fee;
                      }, 0);

                      return (
                          <Box>
                              {/* KHỐI TỔNG KẾT VÀ THANH TOÁN (Chỉ hiện ở Tab Chưa thanh toán) */}
                              {feeTab === "unpaid" && unpaidOrders.length > 0 && (
                                  <Box className="bg-white p-4 rounded-xl shadow-md border border-red-100 mb-4 animate-fade-in-down">
                                      <Text size="xSmall" className="text-gray-500 uppercase tracking-wider mb-1">Cần thanh toán cho Admin (Tất cả cơ sở)</Text>
                                      <Text bold size="xLarge" className="text-red-600 mb-3">{totalDisplayFee.toLocaleString()}đ</Text>
                                      
                                      {/* 👉 BƯỚC 3: HIỂN THỊ THÔNG TIN CHUYỂN KHOẢN ĐỘNG TỪ ADMIN */}
                                      <Box className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300 mb-3">
                                          <Text size="xSmall" bold className="text-gray-700 mb-2">Thông tin chuyển khoản:</Text>
                                          
                                          {adminBankInfoText ? (
                                              // Dùng whitespace-pre-line để giữ nguyên các dấu xuống dòng mà Admin đã gõ
                                              <Text size="xSmall" className="text-gray-700 whitespace-pre-line leading-relaxed">
                                                  {adminBankInfoText}
                                              </Text>
                                          ) : (
                                              <Text size="xSmall" className="text-gray-500 italic">Admin chưa cập nhật thông tin ngân hàng.</Text>
                                          )}
                                          
                                          {adminBankQrLink && (
                                              <Box mt={3} flex justifyContent="center">
                                                  <img 
                                                      src={adminBankQrLink} 
                                                      alt="Mã QR Chuyển khoản" 
                                                      className="w-32 h-32 object-contain rounded-lg border border-gray-200 shadow-md" 
                                                  />
                                              </Box>
                                          )}

                                          <Box mt={3} pt={2} className="border-t border-gray-200">
                                              <Text size="xSmall" className="text-gray-600">
                                                  Nội dung CK gợi ý: <span className="font-bold text-orange-600">Shop {userData.name} TT Phi NT</span>
                                              </Text>
                                          </Box>
                                      </Box>

                                      {/* 👉 BƯỚC 2: NÚT BẤM BIẾN HÌNH SAU KHI BÁO CÁO */}
                                      {(() => {
                                          // Kiểm tra xem tất cả các đơn này đã được gắn cờ báo cáo chưa
                                          const isReported = unpaidOrders.every(o => o.feePaymentReported);
                                          
                                          if (isReported) {
                                              return (
                                                  <Button 
                                                      fullWidth 
                                                      className="bg-orange-500 border-none pointer-events-none" 
                                                      prefixIcon={<CustomIcon icon="zi-clock-1" className="text-white"/>}
                                                  >
                                                      Đã báo cáo - Đang chờ Admin duyệt
                                                  </Button>
                                              );
                                          }
                                          
                                          return (
                                              <Button 
                                                  fullWidth 
                                                  loading={reportingPayment} 
                                                  onClick={() => handleReportPayment(unpaidOrders)}
                                              >
                                                  Báo cáo đã chuyển khoản
                                              </Button>
                                          );
                                      })()}
                                  </Box>
                              )}

                              {/* THÔNG BÁO TỔNG QUAN TAB ĐÃ THANH TOÁN */}
                              {feeTab === "paid" && paidOrders.length > 0 && (
                                  <Box className="bg-green-50 p-3 rounded-xl border border-green-200 mb-4 text-center">
                                      <Text size="xSmall" className="text-green-700 font-medium">Bạn đã thanh toán tổng cộng:</Text>
                                      <Text bold size="large" className="text-green-700">{totalDisplayFee.toLocaleString()}đ</Text>
                                  </Box>
                              )}

                              {/* DANH SÁCH ĐƠN HÀNG TRONG TAB */}
                              <Text size="small" bold className="text-gray-800 mb-2">Chi tiết ({displayOrders.length} đơn từ tất cả cơ sở):</Text>
                              
                              {displayOrders.length === 0 ? (
                                  <Box flex flexDirection="column" alignItems="center" py={6}>
                                      <CustomIcon icon="zi-check-circle" size={40} className="text-gray-300 mb-2"/>
                                      <Text className="text-center text-gray-500">
                                          {feeTab === "unpaid" ? "Tuyệt vời! Bạn không nợ phí nền tảng nào." : "Chưa có đơn hàng nào được ghi nhận đã thanh toán."}
                                      </Text>
                                  </Box>
                              ) : (
                                displayOrders.map((order, idx) => {
                                  const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                                  const fee = order.platformFee !== undefined ? Number(order.platformFee) : Math.floor(total * 10 / 100);
                                  
                                  // 👉 Kiểm tra xem đơn này đã được Shop bấm báo cáo chưa
                                  const isReported = order.feePaymentReported && feeTab === "unpaid";

                                  return (
                                      <Box 
                                          key={idx} 
                                          // 👉 Làm mờ 60% và đổi màu nền nếu đã báo cáo
                                          className={`p-3 rounded-xl mb-3 border shadow-md transition-all ${isReported ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'}`}
                                      >
                                          <Box flex justifyContent="space-between" alignItems="center" className="border-b border-gray-100 pb-2 mb-2">
                                              <Box flex alignItems="center">
                                                  <Text size="small" bold className="text-gray-800">#{order.id.slice(0,6).toUpperCase()}</Text>
                                                  
                                                  {/* 👉 GẮN CỜ "ĐANG CHỜ DUYỆT" */}
                                                  {isReported && (
                                                      <Box className="ml-2 px-2 py-0.5 bg-orange-100 rounded border border-orange-200">
                                                          <Text size="xxxxSmall" bold className="text-orange-600">Chờ duyệt</Text>
                                                      </Box>
                                                  )}
                                              </Box>
                                              <Text size="xSmall" className="text-gray-500">{order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('vi-VN') : ""}</Text>
                                          </Box>
                                          
                                          <Text size="small" className={`line-clamp-1 mb-2 ${isReported ? 'text-gray-500' : 'text-gray-700'}`}>
                                              {order.productName}
                                          </Text>
                                          
                                          <Box flex justify-between alignItems="center" className="bg-gray-50 p-2 rounded">
                                              <Text size="xSmall" className="text-gray-500">Phí ({order.platformFeeRate || 10}%):</Text>
                                              <Text size="normal" bold className={feeTab === "unpaid" ? "text-red-500" : "text-green-600"}>
                                                  {fee.toLocaleString()}đ
                                              </Text>
                                          </Box>
                                      </Box>
                                  )
                              })
                              )}
                          </Box>
                      );
                  })()}
              </Box>
              
              <Box p={3} className="border-t border-gray-200 bg-white shrink-0">
                  <Button fullWidth variant="secondary" onClick={() => setShowFeeModal(false)}>Đóng bảng đối soát</Button>
              </Box>
          </Box>
      </Modal>
    </Box>
  );
};