import CustomIcon from '../custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Box, Text, Icon, Modal, Avatar, Button, Input, useSnackbar, Spinner, Select, Switch } from "zmp-ui";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, addDoc, serverTimestamp, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
const { Option } = Select;
// Hàm format ngày giờ
const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
};

interface AdminProps {
  userData: any;
  onLogout: () => void; 
}

// Menu Items
const MENU_ITEMS = [
  { id: "members", label: "Thành viên", icon: "zi-group", color: "text-blue-500" },
  { id: "providers", label: "Nhà cung cấp", icon: "zi-user-settings", color: "text-orange-500" },
  { id: "posts", label: "Duyệt Bài đăng", icon: "zi-list-1", color: "text-green-500" }, 
  { id: "banners", label: "Banner", icon: "zi-photo", color: "text-purple-500" },
  { id: "feedbacks", label: "Phản hồi", icon: "zi-chat", color: "text-teal-500" },
  { id: "vouchers", label: "Mở đợt Voucher", icon: "zi-star", color: "text-red-500" }, 
  { id: "create_admin", label: "Tạo Admin", icon: "zi-add-user", color: "text-pink-500" },
  { id: "all_orders", label: "Tất cả đơn", icon: "zi-note", color: "text-indigo-500" },
  { id: "fee_reconciliation", label: "Đối soát phí", icon: "zi-poll", color: "text-red-600" }, // 👉 BƯỚC 1: CẬP NHẬT ICON MỚI
  { id: "settings", label: "Cài đặt", icon: "zi-setting", color: "text-gray-600" }, 
];

export const AdminView: FC<AdminProps> = ({ userData, onLogout }) => {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paidDataList, setPaidDataList] = useState<any[]>([]);

  // 👉 BƯỚC 1: Bổ sung biến đếm fee_reconciliation
  const [pendingCounts, setPendingCounts] = useState({
    providers: 0, posts: 0, feedbacks: 0, requests: 0, members: 0, banners: 0, create_admin: 0, fee_reconciliation: 0
  });

  const [bannerInput, setBannerInput] = useState("");      
  const [bannerLinkInput, setBannerLinkInput] = useState(""); 

  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [detailUser, setDetailUser] = useState<any>(null);
  // 👉 BƯỚC 1: BỔ SUNG STATE CHO TÌM KIẾM VÀ LỌC THÀNH VIÊN/SHOP
  const [searchQuery, setSearchQuery] = useState("");
  const [sortFilter, setSortFilter] = useState("all");
  // 👉 BƯỚC 1: STATE CHO TÍNH NĂNG GỬI THÔNG BÁO RIÊNG
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyContent, setNotifyContent] = useState("");
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [userNotifs, setUserNotifs] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const [providerTab, setProviderTab] = useState("pending");
  const [postTab, setPostTab] = useState("pending");
  const [feedbackTab, setFeedbackTab] = useState("new");

  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [adminNote, setAdminNote] = useState("");

  // STATE ĐỔI MẬT KHẨU
  const [showChangePass, setShowChangePass] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  
  const { openSnackbar } = useSnackbar();

  // 👉 THÊM MỚI: State cho Thống kê và Cài đặt
  const [adminStats, setAdminStats] = useState({ totalRevenue: 0, totalOrders: 0, totalCollectedFee: 0, totalUnpaidFee: 0 });
  const [platformFeeRate, setPlatformFeeRate] = useState("10"); // Mặc định 10%
  const [rewardPointRate, setRewardPointRate] = useState("10");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  // 👉 BƯỚC 2: State cho Chiến dịch Voucher
  const [voucherConfig, setVoucherConfig] = useState<{
    title: string; startTime: string; endTime: string; isOpen: boolean; applicableProducts: string[];
  }>({
    title: "", startTime: "", endTime: "", isOpen: false, applicableProducts: [] // Mảng chứa ID sản phẩm được chọn
  });
  const [allServices, setAllServices] = useState<any[]>([]); 
const [allProvidersList, setAllProvidersList] = useState<any[]>([]); // 👉 THÊM: Lưu danh sách Shop
const [voucherShopFilter, setVoucherShopFilter] = useState("all");

  const [savingVoucher, setSavingVoucher] = useState(false);
  const [voucherTab, setVoucherTab] = useState("current");
  const [isEditingVoucher, setIsEditingVoucher] = useState(false);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [statsShopFilter, setStatsShopFilter] = useState("all");
  const [showStatsDetail, setShowStatsDetail] = useState(false);
  const [statsTab, setStatsTab] = useState("all"); // 'all', 'collected', 'unpaid'

  useEffect(() => {
    const fetchAdminDashboard = async () => {
        try {
            // 1. Lấy cài đặt tỷ lệ phí VÀ tỷ lệ điểm
            const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
            if (configSnap.exists()) {
                const data = configSnap.data();
                if (data.platformFeeRate !== undefined) setPlatformFeeRate(data.platformFeeRate.toString());
                // 👉 ĐÃ THÊM: Kéo tỷ lệ điểm về máy
                if (data.rewardPointRate !== undefined) setRewardPointRate(data.rewardPointRate.toString());
                // 👉 BỔ SUNG: Kéo cấu hình Voucher về máy (ĐÃ FIX LỖI)
                if (data.showPrice !== undefined) setShowPrice(data.showPrice);
              setVoucherConfig({
                title: data.voucherTitle || "",
                startTime: data.voucherStartTime || "",
                endTime: data.voucherEndTime || "",
                isOpen: data.isVoucherOpen || false,
                applicableProducts: data.applicableProducts || [] // 👉 Thêm dòng này vào là hết đỏ
            });
              
              // 👉 BƯỚC 2 (BỔ SUNG): TẢI THÊM THÔNG TIN NGÂN HÀNG ĐÃ LƯU
              setAdminBankInfoText(data.bankInfoText || "");
              setAdminBankQrLink(data.bankQrLink || "");
          }

            // 2. Tính thống kê tổng quan và bóc tách Đã thu / Còn nợ
            const ordersSnap = await getDocs(query(collection(db, "orders"), where("status", "in", ["completed", "success"])));
            let tRev = 0; let tCollected = 0; let tUnpaid = 0; let tCount = 0;
            let cOrders: any[] = [];
            
            ordersSnap.forEach(doc => {
                const data = doc.data();
                tCount++;
                const amount = Number(data.totalAmount || data.totalPrice || data.total || 0);
                const fee = data.platformFee !== undefined ? Number(data.platformFee) : Math.floor(amount * 10 / 100);
                tRev += amount;
                
                // 👉 Tách luồng tính toán phí tại đây
                if (data.isFeePaid) {
                    tCollected += fee;
                } else {
                    tUnpaid += fee;
                }

                cOrders.push({ id: doc.id, ...data, calculatedFee: fee });
            });
            
            cOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setCompletedOrders(cOrders);
            // 👉 Đã cập nhật đúng cấu trúc State mới
            setAdminStats({ totalRevenue: tRev, totalOrders: tCount, totalCollectedFee: tCollected, totalUnpaidFee: tUnpaid });
        } catch (error) { console.error("Lỗi tải Dashboard Admin:", error); }
    };
    fetchAdminDashboard();
  }, []);

  // 👉 TẢI DANH SÁCH DỊCH VỤ VÀ NHÀ CUNG CẤP ĐỂ ADMIN LÀM VOUCHER
  useEffect(() => {
    if (isEditingVoucher && allServices.length === 0) {
        const fetchServicesAndProviders = async () => {
            try {
                // 1. Tải Dịch vụ (Lấy thêm SĐT - providerId để lọc chuẩn xác không sợ trùng tên)
                const snap = await getDocs(query(collection(db, "services"), where("status", "==", "approved")));
                const svcs = snap.docs.map(doc => ({ 
                    id: doc.id, title: doc.data().title, shopName: doc.data().shopName, providerId: doc.data().providerId 
                }));
                setAllServices(svcs);

                // 2. Tải trực tiếp danh sách Nhà cung cấp (Chỉ lấy shop đã duyệt)
                const provSnap = await getDocs(query(collection(db, "users"), where("role", "==", "provider"), where("status", "==", "active")));
                const provs = provSnap.docs.map(doc => ({ 
                    id: doc.id, phone: doc.data().phone, name: doc.data().name 
                }));
                setAllProvidersList(provs);
            } catch (error) { console.error("Lỗi tải dữ liệu Voucher:", error); }
        };
        fetchServicesAndProviders();
    }
  }, [isEditingVoucher]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
        await setDoc(doc(db, "system_config", "admin_settings"), {
            platformFeeRate: Number(platformFeeRate),
            rewardPointRate: Number(rewardPointRate), // 👉 ĐÃ THÊM: Lưu tỷ lệ điểm lên Firebase
            showPrice: showPrice
        }, { merge: true }); // Dùng merge để không làm mất password admin
          openSnackbar({ text: "Lưu cài đặt thành công!", type: "success" });
      } catch (error) { openSnackbar({ text: "Lỗi lưu cài đặt", type: "error" }); }
      finally { setSavingSettings(false); }
  };
  
  // 👉 BƯỚC 3: HÀM LƯU CẤU HÌNH NGÂN HÀNG CỦA ADMIN
  const handleSaveBankInfo = async () => {
    if (!adminBankInfoText.trim()) {
        return openSnackbar({ text: "Vui lòng nhập thông tin chuyển khoản bằng chữ!", type: "warning" });
    }
    setSavingBankInfo(true);
    try {
        // Lưu vào document cấu hình chung của hệ thống
        await updateDoc(doc(db, "system_config", "admin_settings"), {
            bankInfoText: adminBankInfoText,
            bankQrLink: adminBankQrLink,
            updatedAt: serverTimestamp(),
            updatedBy: userData.name
        });
        openSnackbar({ text: "Lưu thông tin ngân hàng thành công!", type: "success" });
    } catch (error) {
        console.error("Lỗi lưu thông tin ngân hàng:", error);
        openSnackbar({ text: "Lỗi hệ thống khi lưu", type: "error" });
    } finally {
        setSavingBankInfo(false);
    }
};
  // 👉 BƯỚC 3: Lưu cấu hình và tạo bản ghi Lịch sử
  const handleSaveVoucherConfig = async () => {
    setSavingVoucher(true);
    try {
        await setDoc(doc(db, "system_config", "admin_settings"), {
            voucherTitle: voucherConfig.title,
            voucherStartTime: voucherConfig.startTime,
            voucherEndTime: voucherConfig.endTime,
            isVoucherOpen: voucherConfig.isOpen,
            applicableProducts: voucherConfig.applicableProducts // 👉 LƯU MẢNG ID VÀO CẤU HÌNH CHUNG
        }, { merge: true });

        await addDoc(collection(db, "voucher_campaigns"), {
            title: voucherConfig.title,
            startTime: voucherConfig.startTime,
            endTime: voucherConfig.endTime,
            isOpen: voucherConfig.isOpen,
            applicableProducts: voucherConfig.applicableProducts, // 👉 LƯU MẢNG ID VÀO LỊCH SỬ CHIẾN DỊCH
            createdAt: serverTimestamp()
        });

        openSnackbar({ text: "Lưu đợt Voucher thành công!", type: "success" });
        fetchData("vouchers"); 
        setIsEditingVoucher(false); 
    } catch (error) { 
        openSnackbar({ text: "Lỗi lưu cấu hình", type: "error" }); 
    }
    finally { setSavingVoucher(false); }
};
  // 👉 BƯỚC 2: CÀI ĐẶT LẮNG NGHE SHOP BÁO CÁO CHUYỂN KHOẢN
  useEffect(() => {
    const unsubProviders = onSnapshot(query(collection(db, "users"), where("role", "==", "provider"), where("status", "==", "pending")), (snap) => setPendingCounts(prev => ({ ...prev, providers: snap.size })));
    const unsubPosts = onSnapshot(query(collection(db, "services"), where("status", "==", "pending")), (snap) => setPendingCounts(prev => ({ ...prev, posts: snap.size })));
    const unsubFeedbacks = onSnapshot(query(collection(db, "feedbacks"), where("status", "!=", "done")), (snap) => setPendingCounts(prev => ({ ...prev, feedbacks: snap.size })));
    const unsubRequests = onSnapshot(query(collection(db, "support_requests")), (snap) => setPendingCounts(prev => ({ ...prev, requests: snap.size })));
    
    // 👉 ăng-ten lắng nghe các đơn hàng ĐÃ BÁO CÁO
    const unsubFees = onSnapshot(
        query(collection(db, "orders"), where("feePaymentReported", "==", true)),
        (snap) => {
            // Lọc ra các đơn chưa được Admin gạch nợ
            const pendingFeeOrders = snap.docs.filter(doc => !doc.data().isFeePaid);
            // Gom nhóm theo Shop để đếm xem có bao nhiêu Shop đang chờ duyệt
            const uniqueShops = new Set(pendingFeeOrders.map(doc => doc.data().shopId || doc.data().providerId));
            
            setPendingCounts(prev => ({ ...prev, fee_reconciliation: uniqueShops.size }));
        }
    );

    return () => { unsubProviders(); unsubPosts(); unsubFeedbacks(); unsubRequests(); unsubFees(); };
  }, []);

  // 👉 BƯỚC 2: STATE CHO TÍNH NĂNG ĐỐI SOÁT & CẤU HÌNH NGÂN HÀNG ADMIN
  const [reconciliationTab, setReconciliationTab] = useState("fees"); // Mặc định mở Tab "Phí nền tảng"
  const [adminBankInfoText, setAdminBankInfoText] = useState("");     // Nội dung Text ngân hàng
  const [adminBankQrLink, setAdminBankQrLink] = useState("");       // Link mã QR
  const [savingBankInfo, setSavingBankInfo] = useState(false);       // Trạng thái đang lưu

  // 👉 BƯỚC 3: CẬP NHẬT HÀM TẢI DỮ LIỆU CÓ CHỨC NĂNG GOM NHÓM ĐỐI SOÁT
  const fetchData = async (featureId: string) => {
    if (featureId === "create_admin") return;
    setLoading(true);
    setDataList([]);
    try {
      let q;
      switch (featureId) {
        case "members": q = query(collection(db, "users"), where("role", "==", "member")); break;
        case "providers": q = query(collection(db, "users"), where("role", "==", "provider")); break;
        case "posts": q = query(collection(db, "services"), orderBy("createdAt", "desc")); break;
        case "banners": q = query(collection(db, "banners"), orderBy("createdAt", "desc")); break;
        case "feedbacks": q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc")); break;
        case "requests": q = query(collection(db, "support_requests"), orderBy("createdAt", "desc")); break;
        case "all_orders": q = query(collection(db, "orders"), orderBy("createdAt", "desc")); break;
        case "vouchers": q = query(collection(db, "voucher_campaigns"), orderBy("createdAt", "desc")); break;
        // Lấy toàn bộ đơn hoàn thành để lọc đối soát
        case "fee_reconciliation": q = query(collection(db, "orders"), where("status", "in", ["completed", "success"])); break; 
        default: setLoading(false); return;
      }
      
      if (q) {
        const snapshot = await getDocs(q);
        let rawData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        
        // 👉 XỬ LÝ RIÊNG: LỌC VÀ GOM NHÓM CHO TÍNH NĂNG ĐỐI SOÁT PHÍ
        // 👉 XỬ LÝ RIÊNG: LỌC VÀ GOM NHÓM CHO TÍNH NĂNG ĐỐI SOÁT PHÍ
        // 👉 XỬ LÝ RIÊNG: LỌC, PHÁT HIỆN BÁO CÁO CK VÀ GOM NHÓM ĐỐI SOÁT PHÍ
        if (featureId === "fee_reconciliation") {
            const unpaidOrders = rawData.filter(o => !o.isFeePaid); // Chỉ lấy đơn chưa thu phí
            const paidOrders = rawData.filter(o => o.isFeePaid);    // 👉 Lấy đơn ĐÃ THU PHÍ

            // 1. Gom nhóm đơn CHƯA THANH TOÁN (Logic cũ)
            const groupedByShop: Record<string, any> = {};
            unpaidOrders.forEach(order => {
                const sId = order.shopId || order.providerId; 
                if (!sId) return;
                
                if (!groupedByShop[sId]) {
                    groupedByShop[sId] = { shopId: sId, shopName: order.shopName || "Shop chưa rõ tên", totalFee: 0, orders: [], hasReported: false };
                }
                
                const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                const fee = order.platformFee !== undefined ? Number(order.platformFee) : Math.floor(total * 10 / 100);
                
                groupedByShop[sId].totalFee += fee;
                groupedByShop[sId].orders.push(order);
                if (order.feePaymentReported) groupedByShop[sId].hasReported = true;
            });

            const resultList = Object.values(groupedByShop);
            resultList.sort((a: any, b: any) => (b.hasReported ? 1 : 0) - (a.hasReported ? 1 : 0));
            setDataList(resultList);

            // 2. 👉 BƯỚC 2: Gom nhóm đơn ĐÃ THANH TOÁN (Lịch sử)
            const groupedPaidByShop: Record<string, any> = {};
            paidOrders.forEach(order => {
                const sId = order.shopId || order.providerId; 
                if (!sId) return;
                
                if (!groupedPaidByShop[sId]) {
                    groupedPaidByShop[sId] = { shopId: sId, shopName: order.shopName || "Shop chưa rõ tên", totalPaidFee: 0, orders: [] };
                }
                
                const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                const fee = order.platformFee !== undefined ? Number(order.platformFee) : Math.floor(total * 10 / 100);
                
                groupedPaidByShop[sId].totalPaidFee += fee;
                groupedPaidByShop[sId].orders.push(order);
            });
            
            // Cập nhật vào state riêng
            setPaidDataList(Object.values(groupedPaidByShop));
        } else {
            setDataList(rawData);
        }
      }
    } catch (error) { console.error(error); openSnackbar({ text: "Lỗi tải dữ liệu", type: "warning" }); } 
    finally { setLoading(false); }
  };

  // 👉 BƯỚC 2: RESET TÌM KIẾM KHI ĐỔI MENU
  useEffect(() => { 
      if (selectedFeature) {
          setSearchQuery(""); // Xóa chữ trong ô tìm kiếm
          setSortFilter("all"); // Trả bộ lọc về mặc định
          fetchData(selectedFeature); 
      }
  }, [selectedFeature]);
  // 👉 BƯỚC 2: TẢI LỊCH SỬ THÔNG BÁO KHI MỞ CHI TIẾT USER/SHOP
  useEffect(() => {
    if (detailUser) {
        const fetchNotifs = async () => {
            setLoadingNotifs(true);
            try {
                const targetId = detailUser.id || detailUser.phone;
                // Tải tất cả thông báo gửi đến ID này
                const q = query(collection(db, "notifications"), where("userId", "==", targetId));
                const snap = await getDocs(q);
                
                let notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sắp xếp tin mới nhất lên đầu (Xử lý bằng JS để tránh lỗi thiếu Index của Firebase)
                notifs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                
                setUserNotifs(notifs);
            } catch (error) {
                console.error("Lỗi tải lịch sử thông báo:", error);
            } finally {
                setLoadingNotifs(false);
            }
        };
        fetchNotifs();
    } else {
        setUserNotifs([]); // Reset sạch sẽ khi đóng bảng
    }
}, [detailUser]);
  // --- LOGIC XỬ LÝ ---
  const handleApprovePost = async (post: any) => {
    try {
      const newStatus = post.status === "approved" ? "pending" : "approved";
      await updateDoc(doc(db, "services", post.id), { status: newStatus });
      openSnackbar({ text: "Đã cập nhật trạng thái!", type: "success" });
      fetchData("posts"); 
    } catch (error) { openSnackbar({ text: "Lỗi", type: "error" }); }
  };
  // 👉 BƯỚC 2: HÀM GỬI THÔNG BÁO TÙY CHỈNH CHO USER/SHOP
  const handleSendPrivateNotification = async () => {
    if (!notifyTitle.trim() || !notifyContent.trim()) {
        return openSnackbar({ text: "Vui lòng nhập đầy đủ tiêu đề và nội dung!", type: "warning" });
    }

    setNotifyLoading(true);
    try {
      const targetUserId = detailUser?.id || detailUser?.phone;
      if (!targetUserId) {
          openSnackbar({ text: "Không tìm thấy thông tin người nhận!", type: "error" });
          return;
      }

      // 👉 Sửa đổi: Hứng docRef để lấy ID
      const docRef = await addDoc(collection(db, "notifications"), {
          userId: targetUserId,
          title: notifyTitle.trim(),
          content: notifyContent.trim(),
          isRead: false,
          type: "admin_message", 
          createdAt: serverTimestamp()
      });
      
      // 👉 BỔ SUNG: Chèn ngay thư vừa gửi vào đầu danh sách Lịch sử
      const newNotif = {
          id: docRef.id,
          userId: targetUserId,
          title: notifyTitle.trim(),
          content: notifyContent.trim(),
          createdAt: new Date() // Lấy giờ hiện tại trên máy để hiển thị tạm
      };
      setUserNotifs(prev => [newNotif, ...prev]);

      openSnackbar({ text: "Gửi thông báo thành công!", type: "success" });
      setShowNotifyModal(false);
      setNotifyTitle("");
      setNotifyContent("");
  } catch (error) {
        console.error("Lỗi gửi thông báo:", error);
        openSnackbar({ text: "Có lỗi xảy ra khi gửi", type: "error" });
    } finally {
        setNotifyLoading(false);
    }
};
  const handleCreateAdmin = async () => {
    if (!newAdminPhone || !newAdminName || !newAdminPassword) return openSnackbar({ text: "Thiếu thông tin!", type: "warning" });
    setCreatingAdmin(true);
    try {
        const docRef = doc(db, "users", newAdminPhone);
        if ((await getDoc(docRef)).exists()) { openSnackbar({ text: "SĐT đã tồn tại!", type: "error" }); } 
        else {
            await setDoc(docRef, { id: newAdminPhone, phone: newAdminPhone, name: newAdminName, password: newAdminPassword, role: "admin", avatar: "https://img.icons8.com/color/48/administrator-male.png", createdAt: serverTimestamp(), status: "active" });
            openSnackbar({ text: "Tạo Admin thành công!", type: "success" });
            setNewAdminPhone(""); setNewAdminName(""); setNewAdminPassword(""); setSelectedFeature(null); 
        }
    } catch (error) { openSnackbar({ text: "Lỗi", type: "error" }); } finally { setCreatingAdmin(false); }
  };
  // 👉 BƯỚC 2: HÀM XÁC NHẬN THU TIỀN TỪ SHOP
  const [approvingFeeFor, setApprovingFeeFor] = useState<string | null>(null);
  // 👉 BƯỚC 1: STATE VÀ HÀM GỬI THÔNG BÁO NHẮC NỢ
  const [sendingReminders, setSendingReminders] = useState(false);

  const handleApproveFee = async (shopId: string, shopOrders: any[]) => {
      setApprovingFeeFor(shopId);
      try {
          // Lặp qua tất cả đơn hàng đang nợ của Shop này và chuyển trạng thái thành Đã thanh toán
          const updatePromises = shopOrders.map(order => 
              updateDoc(doc(db, "orders", order.id), { 
                  isFeePaid: true,
                  feePaidAt: serverTimestamp(),
                  feePaidConfirmedBy: userData.name
              })
          );
          await Promise.all(updatePromises); // Chạy cập nhật song song
          
          openSnackbar({ text: `Gạch nợ thành công cho Shop!`, type: "success" });
          fetchData("fee_reconciliation"); // Tải lại danh sách để ẩn Shop này đi
      } catch (error) {
          console.error("Lỗi xác nhận thu phí:", error);
          openSnackbar({ text: "Lỗi hệ thống khi cập nhật", type: "error" });
      } finally {
          setApprovingFeeFor(null);
      }
  };
  // 👉 HÀM GỬI THÔNG BÁO NHẮC NỢ CHO CÁC SHOP ĐANG NỢ PHÍ
  const handleSendReminders = async () => {
    // Chỉ lấy những Shop chưa báo cáo chuyển khoản (Tránh nhắc nhầm người đã nộp)
    const shopsToRemind = dataList.filter(shop => !shop.hasReported && shop.totalFee > 0);
    
    if (shopsToRemind.length === 0) {
        return openSnackbar({ text: "Hiện không có Shop nào cần nhắc nợ!", type: "info" });
    }

    setSendingReminders(true);
    try {
        const promises = shopsToRemind.map(shop => {
            // Tạo một bản ghi thông báo vào bảng 'notifications' của Firebase
            return addDoc(collection(db, "notifications"), {
                userId: shop.shopId,
                title: "⚠️ Nhắc nhở thanh toán phí nền tảng",
                content: `Hệ thống ghi nhận Shop đang có khoản dư nợ phí nền tảng là ${shop.totalFee.toLocaleString()}đ. Vui lòng đối soát và thanh toán sớm để duy trì hoạt động tốt nhất nhé!`,
                isRead: false,
                type: "fee_reminder",
                createdAt: serverTimestamp()
            });
        });
        
        await Promise.all(promises);
        openSnackbar({ text: `Đã gửi thông báo nhắc nợ đến ${shopsToRemind.length} Shop!`, type: "success" });
    } catch (error) {
        console.error("Lỗi gửi nhắc nợ:", error);
        openSnackbar({ text: "Lỗi hệ thống khi gửi thông báo", type: "error" });
    } finally {
        setSendingReminders(false);
    }
};
  // 👉 HÀM ĐỔI MẬT KHẨU ADMIN (ĐÃ SỬA LỖI)
  const handleChangeAdminPassword = async () => {
      if (!oldPass || !newPass || !confirmPass) return openSnackbar({ text: "Nhập đủ thông tin!", type: "warning" });
      if (newPass !== confirmPass) return openSnackbar({ text: "Mật khẩu mới không khớp!", type: "error" });
      
      setPassLoading(true);
      try {
          const configRef = doc(db, "system_config", "admin_settings");
          const configSnap = await getDoc(configRef);
          
          if (configSnap.exists()) {
              const currentConfig = configSnap.data();
              // 👉 QUAN TRỌNG: Cho phép đổi nếu đúng mật khẩu trong DB HOẶC nhập mật khẩu cứu hộ 'admin'
              if (currentConfig.password !== oldPass && oldPass !== "admin") {
                  openSnackbar({ text: "Mật khẩu cũ không đúng!", type: "error" });
                  setPassLoading(false);
                  return;
              }
          } 
          
          // Cập nhật mật khẩu mới
          await setDoc(configRef, {
              username: "0000869131", 
              password: newPass
          }, { merge: true });

          openSnackbar({ text: "Đổi mật khẩu thành công!", type: "success" });
          setShowChangePass(false); setOldPass(""); setNewPass(""); setConfirmPass("");
      } catch (error) { console.error(error); openSnackbar({ text: "Lỗi hệ thống!", type: "error" }); } 
      finally { setPassLoading(false); }
  };

  const handleToggleProviderStatus = async (item: any) => {
    try {
      const newStatus = item.status === "active" ? "pending" : "active";
      await updateDoc(doc(db, "users", item.id), { status: newStatus });
      openSnackbar({ text: "Đã cập nhật!", type: "success" });
      fetchData("providers"); 
    } catch (error) { openSnackbar({ text: "Lỗi", type: "error" }); }
  };

  const handleDeleteItem = async (col: string, id: string) => {
    try { await deleteDoc(doc(db, col, id)); openSnackbar({ text: "Xóa thành công!", type: "success" }); fetchData(selectedFeature!); } 
    catch (error) { openSnackbar({ text: "Lỗi xóa", type: "error" }); }
  };

  const handleAddBanner = async () => {
    if (!bannerInput.trim()) return;
    try { await addDoc(collection(db, "banners"), { image: bannerInput.trim(), link: bannerLinkInput.trim(), active: true, createdAt: serverTimestamp() }); setBannerInput(""); setBannerLinkInput(""); openSnackbar({ text: "Thêm thành công!", type: "success" }); fetchData("banners"); } 
    catch (error) { openSnackbar({ text: "Lỗi", type: "error" }); }
  };

  const handleProcessFeedback = async () => {
      if (!selectedFeedback) return;
      try { await updateDoc(doc(db, "feedbacks", selectedFeedback.id), { status: "done", adminNote, processedBy: userData.name, processedAt: serverTimestamp() }); openSnackbar({ text: "Đã xử lý!", type: "success" }); setReplyModalVisible(false); setAdminNote(""); fetchData("feedbacks"); } 
      catch (error) { openSnackbar({ text: "Lỗi", type: "error" }); }
  };

  // RENDER MODAL CONTENT
  const renderModalContent = () => {
    if (selectedFeature === "create_admin") return (
        <Box>
            <Text size="small" className="mb-4 text-gray">Tạo tài khoản phụ.</Text>
            <Box mb={4}><Input label="SĐT Admin" value={newAdminPhone} onChange={(e) => setNewAdminPhone(e.target.value)} type="number" /></Box>
            <Box mb={4}><Input label="Tên hiển thị" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} /></Box>
            <Box mb={4}><Input.Password label="Mật khẩu" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} /></Box>
            <Button fullWidth loading={creatingAdmin} onClick={handleCreateAdmin}>Tạo tài khoản</Button>
        </Box>
    );

    if (loading) return <Box flex justifyContent="center" p={4}><Spinner /></Box>;
    if (dataList.length === 0 && !["banners", "posts", "providers", "settings", "vouchers"].includes(selectedFeature || "")) return <Box p={4}><Text className="text-center text-gray">Không có dữ liệu.</Text></Box>;

    switch (selectedFeature) {
      case "members": {
        let processedList = [...dataList];

        // 1. Logic Lọc Tìm Kiếm (Tên hoặc SĐT)
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            processedList = processedList.filter(m => 
                (m.name && m.name.toLowerCase().includes(lowerQ)) || 
                (m.phone && m.phone.includes(lowerQ))
            );
        }

        // 2. Thuật toán đếm số người giới thiệu cực nhanh
        const referralCounts: Record<string, number> = {};
        dataList.forEach(u => {
            if (u.referrer) { referralCounts[u.referrer] = (referralCounts[u.referrer] || 0) + 1; }
        });

        // 3. Logic Sắp xếp TOP
        if (sortFilter === 'top_spending') {
            processedList.sort((a, b) => (b.spendingPoints || 0) - (a.spendingPoints || 0));
        } else if (sortFilter === 'top_rank') {
            processedList.sort((a, b) => (b.rankPoints || 0) - (a.rankPoints || 0));
        } else if (sortFilter === 'top_referral') {
            processedList.forEach(m => m._refCount = referralCounts[m.phone] || 0);
            processedList.sort((a, b) => (b._refCount || 0) - (a._refCount || 0));
        }

        return (
          <Box className="bg-white h-full flex flex-col hide-scroll">
              {/* THANH TÌM KIẾM VÀ BỘ LỌC CỐ ĐỊNH PHÍA TRÊN */}
              <Box className="p-3 border-b border-gray-100 bg-white shrink-0 z-10">
                  <Input 
                      placeholder="Tìm kiếm theo tên, SĐT..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      prefix={<CustomIcon icon="zi-search" className="text-gray-400" />}
                      clearable
                  />
                  {/* Danh sách Chip bộ lọc cuộn ngang */}
                  <Box className="flex overflow-x-auto hide-scroll gap-2 mt-3 pb-1">
                      <Box onClick={() => setSortFilter("all")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Tất cả</Box>
                      <Box onClick={() => setSortFilter("top_spending")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "top_spending" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Best Points</Box>
                      <Box onClick={() => setSortFilter("top_rank")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "top_rank" ? "bg-yellow-500 text-white border-yellow-500" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Best Rank</Box>
                      <Box onClick={() => setSortFilter("top_referral")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "top_referral" ? "bg-purple-600 text-white border-purple-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Best Ref</Box>
                  </Box>
              </Box>

              {/* DANH SÁCH THÀNH VIÊN */}
              <Box p={4} className="flex-1 overflow-y-auto hide-scroll">
                  {processedList.length === 0 ? <Text className="text-center text-gray-400 mt-4">Không tìm thấy kết quả.</Text> : processedList.map((m, idx) => (
                      <Box key={m.id} flex alignItems="center" justifyContent="space-between" className="mb-3 pb-3 border-b border-gray-100 p-1">
                          <Box flex alignItems="center" className="flex-1 cursor-pointer active:opacity-70" onClick={() => setDetailUser(m)}>
                              <Box className="relative">
                                  <Avatar src={m.avatar} />
                                  {/* Hiển thị Top 1, 2, 3 */}
                                  {sortFilter !== "all" && idx < 3 && (
                                      <Box className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                                          {idx + 1}
                                      </Box>
                                  )}
                              </Box>
                              <Box ml={3} className="flex-1">
    <Text bold size="small">{m.name}</Text>
    <Text size="xxSmall" className="text-gray">{m.phone}</Text>
    {/* 👉 Hiển thị thêm địa chỉ */}
    {/* 👉 Hiển thị địa chỉ: Do Bước 1 đã lưu "address" nên giờ gọi thẳng là ra */}
    {m.address && (
        <Text size="xxxxSmall" className="text-gray-500 line-clamp-1 mt-0.5 flex items-center">
            <CustomIcon icon="zi-location" size={12} className="mr-1 shrink-0" />
            <span className="line-clamp-1">{m.address}</span>
        </Text>
    )}
                                  
                                  {/* Hiển thị lý do đứng Top */}
                                  {sortFilter === 'top_spending' && <Text size="xxxxSmall" className="text-green-600 font-bold mt-0.5">Tiêu dùng: {m.spendingPoints || 0} đ</Text>}
                                  {sortFilter === 'top_rank' && <Text size="xxxxSmall" className="text-yellow-600 font-bold mt-0.5">Tích lũy: {m.rankPoints || 0} đ</Text>}
                                  {sortFilter === 'top_referral' && <Text size="xxxxSmall" className="text-purple-600 font-bold mt-0.5">Đã giới thiệu: {m._refCount || referralCounts[m.phone] || 0} người</Text>}
                              </Box>
                              <Text size="xxSmall" className="bg-blue-100 text-blue-600 px-2 py-1 rounded mr-2 shrink-0">{m.rank || "Mới"}</Text>
                          </Box>
                          <Box className="p-2 ml-1 cursor-pointer active:opacity-50" onClick={(e) => { e.stopPropagation(); handleDeleteItem("users", m.id); }}>
                              <CustomIcon icon="zi-delete" className="text-red-500" />
                          </Box>
                      </Box>
                  ))}
              </Box>
          </Box>
        );
      }
      case "providers": {
        let processedList = [...dataList];

        // 1. Tính toán Tự động Doanh thu & Đơn hàng cho từng Shop (Dùng mảng completedOrders đã tải từ Dashboard)
        processedList.forEach(p => {
            const shopOrders = completedOrders.filter(o => o.shopId === p.id || o.providerId === p.id);
            p._orderCount = shopOrders.length;
            p._revenue = shopOrders.reduce((sum, o) => sum + Number(o.totalAmount || o.totalPrice || o.total || 0), 0);
        });

        // 2. Logic Tìm Kiếm (Tên hoặc SĐT)
        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            processedList = processedList.filter(p => 
                (p.name && p.name.toLowerCase().includes(lowerQ)) || 
                (p.phone && p.phone.includes(lowerQ))
            );
        }

        // 3. Logic Sắp xếp
        if (sortFilter === 'top_revenue') {
            processedList.sort((a, b) => (b._revenue || 0) - (a._revenue || 0));
        } else if (sortFilter === 'top_orders') {
            processedList.sort((a, b) => (b._orderCount || 0) - (a._orderCount || 0));
        }

        const pPending = processedList.filter(p => p.status === 'pending');
        const pActive = processedList.filter(p => p.status === 'active');
        const pDisplay = providerTab === 'pending' ? pPending : pActive;

        return (
          <Box className="bg-white h-full flex flex-col hide-scroll">
            {/* THANH CÔNG CỤ TÌM KIẾM VÀ LỌC */}
            <Box className="p-3 bg-white shrink-0 z-10">
                <Box flex className="mb-3 border-b border-gray-200">
                    <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${providerTab==="pending"?"border-orange-500 text-orange-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setProviderTab("pending")}>Cần duyệt ({pPending.length})</Box>
                    <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${providerTab==="active"?"border-orange-500 text-orange-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setProviderTab("active")}>Đã duyệt ({pActive.length})</Box>
                </Box>
                
                <Input 
                    placeholder="Tìm tên Shop, SĐT..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    prefix={<CustomIcon icon="zi-search" className="text-gray-400" />}
                    clearable
                />
                
                {providerTab === 'active' && (
                    <Box className="flex overflow-x-auto hide-scroll gap-2 mt-3">
                        <Box onClick={() => setSortFilter("all")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Mặc định</Box>
                        <Box onClick={() => setSortFilter("top_revenue")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "top_revenue" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Doanh số cao nhất</Box>
                        <Box onClick={() => setSortFilter("top_orders")} className={`px-3 py-1.5 rounded-full whitespace-nowrap text-[11px] font-bold border cursor-pointer transition-colors ${sortFilter === "top_orders" ? "bg-orange-600 text-white border-orange-600" : "bg-gray-50 text-gray-500 border-gray-200"}`}>Nhiều đơn hàng nhất</Box>
                    </Box>
                )}
            </Box>

            {/* DANH SÁCH SHOP */}
            <Box p={4} pt={1} className="flex-1 overflow-y-auto hide-scroll">
                {pDisplay.length === 0 && <Text size="small" className="text-center text-gray mt-4">Không tìm thấy dữ liệu.</Text>}
                {pDisplay.map((p, idx) => (
                    <Box key={p.id} className="mb-4 pb-4 border-b border-gray-100">
                        <Box flex alignItems="center" mb={3} className="cursor-pointer active:opacity-70 relative" onClick={() => setDetailUser(p)}>
                            <Box className="relative">
                                <Avatar src={p.avatar} />
                                {providerTab === 'active' && sortFilter !== "all" && idx < 3 && (
                                    <Box className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
                                        {idx + 1}
                                    </Box>
                                )}
                            </Box>
                            <Box ml={3} className="flex-1">
    <Text bold size="small" className="line-clamp-1">{p.name}</Text>
    <Text size="xxSmall" className="text-gray">{p.phone}</Text>
    {/* 👉 Hiển thị thêm địa chỉ */}
    {p.address && (
        <Text size="xxxxSmall" className="text-gray-500 line-clamp-1 mt-0.5 flex items-center">
            <CustomIcon icon="zi-location" size={12} className="mr-1 shrink-0" />
            <span className="line-clamp-1">{p.address}</span>
        </Text>
    )}
</Box>
                            <Text size="xxSmall" className={`shrink-0 ml-2 ${p.status==="active"?"text-green-500 font-bold":"text-yellow-500 font-bold"}`}>
                                {p.status==="active"?"Đã duyệt":"Chờ duyệt"}
                            </Text>
                        </Box>

                        {/* 👉 Khu vực hiển thị thông số Doanh thu (Chỉ hiện khi Shop đã duyệt) */}
                        {p.status === 'active' && (
                            <Box flex className="bg-gray-50 p-2 rounded-lg border border-gray-100 mb-3 gap-2">
                                <Box className="flex-1 text-center border-r border-gray-200">
                                    <Text size="xxxxSmall" className="text-gray-500 mb-0.5">Doanh số</Text>
                                    <Text size="small" bold className="text-green-600">{p._revenue?.toLocaleString() || 0}đ</Text>
                                </Box>
                                <Box className="flex-1 text-center">
                                    <Text size="xxxxSmall" className="text-gray-500 mb-0.5">Đơn hàng</Text>
                                    <Text size="small" bold className="text-blue-600">{p._orderCount || 0}</Text>
                                </Box>
                            </Box>
                        )}

                        <Box flex className="gap-2">
                            <Button className="flex-1 bg-white text-red-600 border border-red-200" size="small" onClick={() => handleDeleteItem("users", p.id)}>
                                Xóa
                            </Button>
                            <Button className="flex-1" size="small" variant={p.status==="active"?"secondary":"primary"} onClick={() => handleToggleProviderStatus(p)}>
                                {p.status==="active"?"Khóa":"Duyệt ngay"}
                            </Button>
                        </Box>
                    </Box>
                ))}
            </Box>
          </Box>
        );
      }
        case "posts": 
        const poPending = dataList.filter(p => p.status === 'pending');
        const poApproved = dataList.filter(p => p.status === 'approved');
        const poDisplay = postTab === 'pending' ? poPending : poApproved;
        return (
          <Box p={4} className="bg-white h-full">
            <Box flex className="mb-4 border-b border-gray-200">
                <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${postTab==="pending"?"border-green-600 text-green-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setPostTab("pending")}>Cần duyệt ({poPending.length})</Box>
                <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${postTab==="approved"?"border-green-600 text-green-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setPostTab("approved")}>Đã duyệt ({poApproved.length})</Box>
            </Box>
            {poDisplay.length===0 && <Text size="small" className="text-center text-gray mt-4">Trống.</Text>}
            {poDisplay.map((p) => (<Box key={p.id} className="mb-3 p-3 border rounded-lg bg-white shadow-md"><Box flex className="mb-2"><img src={p.image||"https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"} className="w-16 h-16 rounded object-cover mr-3 bg-gray-200"/><Box className="flex-1"><Text bold size="small" className="line-clamp-2">{p.title}</Text><Text size="xxSmall" className="text-gray">{p.shopName}</Text><Text size="xxSmall" className="text-gray">{formatDate(p.createdAt)}</Text></Box></Box><Box flex justifyContent="space-between" alignItems="center"><Text size="xxSmall" className="text-red-500 cursor-pointer" onClick={() => handleDeleteItem("services", p.id)}><CustomIcon icon="zi-delete"/> Xóa</Text><Button size="small" variant={p.status==="approved"?"secondary":"primary"} onClick={() => handleApprovePost(p)}>{p.status==="approved"?"Ẩn":"Duyệt"}</Button></Box></Box>))}
          </Box>
        );
      case "banners": return (
          <Box>
             <Box className="bg-gray-50 p-3 rounded-lg mb-6 border border-gray-200"><Text size="small" bold className="mb-2">Thêm Banner</Text><Box mb={2}><Input placeholder="Link ảnh" value={bannerInput} onChange={(e)=>setBannerInput(e.target.value)}/></Box><Box mb={2}><Input placeholder="Link điều hướng" value={bannerLinkInput} onChange={(e)=>setBannerLinkInput(e.target.value)}/></Box><Button fullWidth onClick={handleAddBanner}>Đăng</Button></Box>
             {dataList.map((b) => (<Box key={b.id} className="mb-4 relative border rounded-lg overflow-hidden shadow-md"><img src={b.image} className="w-full h-32 object-cover"/><Box className="absolute top-2 right-2 bg-white rounded-full p-1 shadow cursor-pointer" onClick={()=>handleDeleteItem("banners", b.id)}><CustomIcon icon="zi-delete" className="text-red-500" size={18}/></Box></Box>))}
          </Box>
        );
        case "feedbacks": 
        const fbNew = dataList.filter(f => f.status !== "done");
        const fbHistory = dataList.filter(f => f.status === "done");
        const fbDisplay = feedbackTab === "new" ? fbNew : fbHistory;
        return (
          <Box p={4} className="bg-white h-full hide-scroll">
            <Box flex className="mb-4 border-b border-gray-200">
                <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${feedbackTab==="new"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setFeedbackTab("new")}>Cần xử lý ({fbNew.length})</Box>
                <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${feedbackTab==="history"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setFeedbackTab("history")}>Lịch sử ({fbHistory.length})</Box>
            </Box>
            
            {fbDisplay.length === 0 && <Text className="text-center text-gray-400 mt-4">Trống.</Text>}
            
            {fbDisplay.map((f) => (
                <Box key={f.id} className="mb-4 p-4 rounded-xl border bg-white shadow-md animate-fade-in-up">
                    <Box flex justifyContent="space-between" alignItems="center" mb={2}>
                        <Text bold size="small" className="text-blue-800">
                            {f.userName} <span className="text-gray-500 font-normal">({f.userPhone})</span>
                        </Text>
                        <Text size="xxxxSmall" className="text-gray-500">{formatDate(f.createdAt)}</Text>
                    </Box>
                    
                    <Box className="bg-orange-50 p-2 rounded-lg border border-orange-100 mb-2">
                        <Text size="xSmall" className="text-orange-800 font-bold mb-1">Nội dung gửi:</Text>
                        <Text size="small" className="text-gray-800 italic">"{f.content}"</Text>
                    </Box>

                    {/* 👉 Hiển thị câu trả lời của Admin trong Tab Lịch sử */}
                    {f.status === 'done' && f.adminNote && (
                        <Box className="bg-blue-50 p-2 rounded-lg border border-blue-100 mb-2">
                            <Text size="xSmall" className="text-blue-800 font-bold mb-1 flex items-center">
                                <CustomIcon icon="zi-chat" size={12} className="mr-1"/> Admin đã trả lời:
                            </Text>
                            <Text size="small" className="text-gray-800">{f.adminNote}</Text>
                        </Box>
                    )}

                    <Box flex justifyContent="space-between" mt={3} pt={2} className="border-t border-gray-100 items-center">
                        <Text size="xxSmall" className="text-red-500 cursor-pointer active:opacity-50" onClick={() => handleDeleteItem("feedbacks", f.id)}>
                            <CustomIcon icon="zi-delete"/> Xóa phiếu
                        </Text>
                        {f.status !== 'done' && (
                            <Button size="small" onClick={()=>{setSelectedFeedback(f);setReplyModalVisible(true)}}>
                                Trả lời
                            </Button>
                        )}
                    </Box>
                </Box>
            ))}
          </Box>
        );
        case "vouchers": 
          // TÍNH TRẠNG THÁI HIỂN THỊ
          let currentStatus = "Chưa thiết lập";
          let statusColor = "text-gray-500 bg-gray-100 border-gray-200";

          if (voucherConfig.isOpen) {
              currentStatus = "Đang mở (Thủ công)";
              statusColor = "text-green-600 bg-green-100 border-green-200";
          } else if (voucherConfig.startTime && voucherConfig.endTime) {
              const now = new Date().getTime();
              const start = new Date(voucherConfig.startTime).getTime();
              const end = new Date(voucherConfig.endTime).getTime();

              if (now < start) {
                  currentStatus = "Sắp diễn ra";
                  statusColor = "text-yellow-600 bg-yellow-100 border-yellow-200";
              } else if (now >= start && now <= end) {
                  currentStatus = "Đang diễn ra";
                  statusColor = "text-green-600 bg-green-100 border-green-200";
              } else {
                  currentStatus = "Đã hoàn thành";
                  statusColor = "text-red-600 bg-red-100 border-red-200";
              }
          }

          return (
              <Box p={0}>
                  <Box flex className="mb-4 border-b border-gray-200 px-2 pt-2">
                      <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${voucherTab==="current"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setVoucherTab("current")}>Chiến dịch hiện tại</Box>
                      <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${voucherTab==="history"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setVoucherTab("history")}>Lịch sử ({dataList.length})</Box>
                  </Box>

                  {voucherTab === "current" ? (
                      <Box p={2}>
                          {/* 👉 NẾU ĐANG Ở CHẾ ĐỘ XEM TỔNG QUAN */}
                          {!isEditingVoucher ? (
                              <Box className="animate-fade-in">
                                  <Box flex justifyContent="space-between" alignItems="center" className="mb-3">
                                      <Text size="small" bold className="text-gray-800">Tổng quan Chiến dịch</Text>
                                      <Box className={`px-2 py-1 rounded border text-[10px] font-bold ${statusColor}`}>
                                          {currentStatus}
                                      </Box>
                                  </Box>

                                  <Box className="bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                                      <Text size="normal" bold className="text-blue-600 mb-4">{voucherConfig.title || "Chưa có tên chiến dịch"}</Text>
                                      
                                      <Box flex alignItems="center" mb={2}>
                                          <CustomIcon icon="zi-clock-1" className="text-gray-400 mr-2" size={16} />
                                          <Text size="small" className="text-gray-600">
                                              <span className="font-semibold text-gray-800">Bắt đầu: </span><br/>
                                              {voucherConfig.startTime ? new Date(voucherConfig.startTime).toLocaleString('vi-VN') : "Chưa thiết lập"}
                                          </Text>
                                      </Box>
                                      
                                      <Box flex alignItems="center" mb={4}>
                                          <CustomIcon icon="zi-clock-2" className="text-gray-400 mr-2" size={16} />
                                          <Text size="small" className="text-gray-600">
                                              <span className="font-semibold text-gray-800">Kết thúc: </span><br/>
                                              {voucherConfig.endTime ? new Date(voucherConfig.endTime).toLocaleString('vi-VN') : "Chưa thiết lập"}
                                          </Text>
                                      </Box>

                                      <Box className="bg-gray-50 p-2 rounded border border-gray-100 flex items-center">
                                          <CustomIcon icon={voucherConfig.isOpen ? "zi-check-circle-solid" : "zi-close-circle-solid"} className={voucherConfig.isOpen ? "text-green-500 mr-2" : "text-gray-400 mr-2"} size={16} />
                                          <Text size="xSmall" className="text-gray-600">Công tắc mở thủ công: <span className="font-bold">{voucherConfig.isOpen ? "BẬT" : "TẮT"}</span></Text>
                                      </Box>
                                  </Box>

                                  <Box flex className="gap-2">
                                      <Button variant="secondary" className="flex-1 bg-white border border-blue-600 text-blue-600" onClick={() => setIsEditingVoucher(true)}>
                                          Chỉnh sửa
                                      </Button>
                                      <Button className="flex-1 bg-blue-600" onClick={() => {
                                          setVoucherConfig({ title: "", startTime: "", endTime: "", isOpen: false, applicableProducts: [] }); // 👉 Đã thêm mảng rỗng để reset
                                          setIsEditingVoucher(true);
                                      }}>
                                          Mở chiến dịch mới
                                      </Button>
                                  </Box>
                              </Box>
                          ) : (
                              /* 👉 NẾU ĐANG Ở CHẾ ĐỘ NHẬP LIỆU (FORM) */
                              <Box className="animate-fade-in-up">
                                  <Box flex justifyContent="space-between" alignItems="center" className="mb-3">
                                      <Text size="small" bold className="text-gray-800">Thiết lập cấu hình</Text>
                                      <Box className={`px-2 py-1 rounded border text-[10px] font-bold ${statusColor}`}>
                                          {currentStatus}
                                      </Box>
                                  </Box>
                                  
                                  <Box className="bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                                      <Box mb={3}>
                                          <Text size="small" className="mb-1 font-medium text-gray-700">Tên thông báo / Chiến dịch</Text>
                                          <Input placeholder="VD: Tuần lễ vàng đổi điểm nhận quà!" value={voucherConfig.title} onChange={(e) => setVoucherConfig({...voucherConfig, title: e.target.value})} />
                                      </Box>
                                      <Box mb={3}>
                                          <Text size="small" className="mb-1 font-medium text-gray-700">Thời gian bắt đầu</Text>
                                          <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" value={voucherConfig.startTime} onChange={(e) => setVoucherConfig({...voucherConfig, startTime: e.target.value})} />
                                      </Box>
                                      <Box mb={3}>
                                          <Text size="small" className="mb-1 font-medium text-gray-700">Thời gian kết thúc</Text>
                                          <input type="datetime-local" className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" value={voucherConfig.endTime} onChange={(e) => setVoucherConfig({...voucherConfig, endTime: e.target.value})} />
                                          <Text size="xxxxSmall" className="text-gray-400 mt-1 italic">* Hệ thống sẽ tự động mở/đóng Cửa hàng Voucher dựa theo thời gian này.</Text>
                                      </Box>
                                      
                                      <Box className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                                          <Box>
                                              <Text bold size="small" className="text-gray-800">Trạng thái thủ công</Text>
                                              <Text size="xxxxSmall" className="text-gray-500">Mở ép buộc không cần chờ thời gian</Text>
                                          </Box>
                                          <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={voucherConfig.isOpen} onChange={(e) => setVoucherConfig({...voucherConfig, isOpen: e.target.checked})} />
                                          {/* 👉 KHUNG TÍCH CHỌN SẢN PHẨM / DỊCH VỤ GIỚI HẠN */}
                                      <Box className="mt-4 pt-4 border-t border-gray-100">
                                          <Text size="small" bold className="mb-1 text-gray-700">Giới hạn Dịch vụ áp dụng</Text>
                                          <Text size="xxxxSmall" className="text-gray-500 mb-2 italic">
                                              * Nếu <span className="text-red-500 font-bold">KHÔNG TÍCH</span> ô nào, Voucher sẽ áp dụng cho <span className="text-green-600 font-bold">TOÀN BỘ</span> hệ thống.
                                          </Text>
                                          
                                          {/* 👉 BỘ LỌC TÌM KIẾM THEO NHÀ CUNG CẤP (ĐÃ FIX LỖI HIỂN THỊ) */}
                                          <Box mb={2} className="bg-white border border-gray-200 rounded-lg p-1">
                                              {allProvidersList.length > 0 ? (
                                                  <Select
                                                      key={allProvidersList.length} // Mẹo ép ứng dụng tải lại ô chọn khi có dữ liệu
                                                      value={voucherShopFilter}
                                                      onChange={(val) => setVoucherShopFilter(val as string)}
                                                      closeOnSelect
                                                      placeholder="Lọc theo Nhà cung cấp"
                                                  >
                                                      <Option value="all" title="-- Tất cả Nhà cung cấp --" />
                                                      {allProvidersList.map((shop) => (
                                                          <Option key={shop.id} value={shop.phone} title={shop.name || shop.phone} />
                                                      ))}
                                                  </Select>
                                              ) : (
                                                  <Box p={2} flex justifyContent="center"><Spinner visible={true} logo={""} /></Box>
                                              )}
                                          </Box>

                                          {/* Danh sách cuộn chứa các dịch vụ (Đã áp dụng bộ lọc) */}
                                          <Box className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 hide-scroll">
                                              {allServices.length === 0 ? <Spinner /> : allServices
                                                  // 👉 Sửa lại: Lọc theo SĐT (providerId) thay vì Tên để tuyệt đối chính xác
                                                  .filter(svc => voucherShopFilter === "all" || svc.providerId === voucherShopFilter)
                                                  .map(svc => {
                                                  // Kiểm tra xem dịch vụ này đã được chọn chưa
                                                  const isChecked = voucherConfig.applicableProducts?.includes(svc.id);
                                                  
                                                  return (
                                                      <Box 
                                                          key={svc.id} 
                                                          flex alignItems="center" 
                                                          className={`mb-2 p-2 rounded-lg border shadow-md cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-100 hover:bg-gray-100'}`}
                                                          onClick={() => {
                                                              const newArr = isChecked
                                                                  ? voucherConfig.applicableProducts.filter(id => id !== svc.id) // Bỏ chọn
                                                                  : [...(voucherConfig.applicableProducts || []), svc.id]; // Thêm vào
                                                              setVoucherConfig({...voucherConfig, applicableProducts: newArr});
                                                          }}
                                                      >
                                                          <input type="checkbox" className="mr-3 w-5 h-5 accent-blue-600" checked={isChecked} readOnly />
                                                          <Box className="flex-1 overflow-hidden">
                                                              <Text size="small" bold className={isChecked ? "text-blue-800 line-clamp-1" : "text-gray-800 line-clamp-1"}>
                                                                  {svc.title}
                                                              </Text>
                                                              <Text size="xxxxSmall" className="text-gray-500 line-clamp-1">Shop: {svc.shopName}</Text>
                                                          </Box>
                                                      </Box>
                                                  );
                                              })}
                                          </Box>
                                      </Box>
                                      </Box>
                                  </Box>
                                  <Box flex className="gap-2">
                                      <Button variant="secondary" className="flex-1 bg-gray-100 text-gray-600 border-none" onClick={() => setIsEditingVoucher(false)}>
                                          Hủy bỏ
                                      </Button>
                                      <Button className="flex-1 bg-blue-600" loading={savingVoucher} onClick={handleSaveVoucherConfig}>
                                          Lưu cấu hình
                                      </Button>
                                  </Box>
                              </Box>
                          )}
                      </Box>
                  ) : (
                      // TAB 2: LỊCH SỬ CHIẾN DỊCH ĐÃ TẠO
                      <Box p={2}>
                          {dataList.length === 0 ? (
                              <Text className="text-center text-gray-500 mt-4">Chưa có lịch sử chiến dịch nào.</Text>
                          ) : (
                              dataList.map(camp => (
                                  <Box key={camp.id} className="mb-3 p-3 bg-white rounded-xl border border-gray-200 shadow-md flex justify-between items-center">
                                      <Box className="flex-1 pr-2">
                                          <Text bold size="small" className="text-gray-800 line-clamp-1">{camp.title || "Không có tên"}</Text>
                                          <Text size="xxxxSmall" className="text-gray-500 mt-1">
                                              Bắt đầu: {camp.startTime ? new Date(camp.startTime).toLocaleString('vi-VN') : 'Không rõ'}<br/>
                                              Kết thúc: {camp.endTime ? new Date(camp.endTime).toLocaleString('vi-VN') : 'Không rõ'}
                                          </Text>
                                      </Box>
                                      <Button size="small" variant="secondary" onClick={() => {
                                          setVoucherConfig({ 
                                              title: camp.title, 
                                              startTime: camp.startTime, 
                                              endTime: camp.endTime, 
                                              isOpen: false,
                                              applicableProducts: camp.applicableProducts || [] // 👉 Đã thêm: Kéo danh sách đã chọn của đợt cũ ra
                                          });
                                          setVoucherTab("current");
                                          setIsEditingVoucher(true);
                                      }}>
                                          Dùng lại
                                      </Button>
                                  </Box>
                              ))
                          )}
                      </Box>
                  )}
              </Box>
          );
        // 👉 BƯỚC 4: GIAO DIỆN ĐỐI SOÁT PHÍ NỀN TẢNG (PHIÊN BẢN CÓ TAB CẤU HÌNH)
        case "fee_reconciliation": return (
          <Box p={0} flex flexDirection="column" className="h-full bg-white">
              
              {/* THANH TAB CHUYỂN ĐỔI */}
              <Box flex className="border-b border-gray-200 px-2 pt-2 bg-white shrink-0">
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${reconciliationTab==="fees"?"border-red-600 text-red-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setReconciliationTab("fees")}>
                      Đang nợ ({dataList.length})
                  </Box>
                  {/* 👉 TAB LỊCH SỬ */}
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${reconciliationTab==="history"?"border-green-600 text-green-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setReconciliationTab("history")}>
                      Lịch sử
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${reconciliationTab==="bank_info"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setReconciliationTab("bank_info")}>
                      Cấu hình
                  </Box>
              </Box>

              {/* 2. NỘI DUNG TỪNG TAB (Có hide-scroll) */}
              <Box p={4} className="flex-1 bg-white hide-scroll overflow-y-auto pb-32">
                  
                  {/* --- TAB 1: PHÍ NỀN TẢNG (GIỮ NGUYÊN LOGIC CŨ) --- */}
                  {reconciliationTab === "fees" && (
                      <Box className="animate-fade-in-down">
                          <Box className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-4 flex items-center shadow-md">
                              <CustomIcon icon="zi-info-circle" className="text-blue-500 mr-2" />
                              <Text size="xSmall" className="text-blue-700">
                                  Danh sách các Shop đang nợ phí. Khi Shop chuyển khoản xong, Admin bấm "Xác nhận thu" để gạch nợ.
                              </Text>
                          </Box>
                          {/* 👉 BƯỚC 2: KHUNG TRỢ LÝ NHẮC NỢ (Tự động đổi màu vào ngày 1 và 15) */}
                          {(() => {
                              const today = new Date().getDate();
                              const isRemindDay = today === 1 || today === 15;
                              const shopsToRemindCount = dataList.filter(shop => !shop.hasReported).length;

                              if (dataList.length > 0) return (
                                  <Box className={`mb-4 p-3 rounded-xl border shadow-md flex items-center justify-between ${isRemindDay ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                                      <Box flex alignItems="center">
                                          <Box className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${isRemindDay ? 'bg-orange-100' : 'bg-white shadow-md'}`}>
                                              <CustomIcon icon="zi-notif-ring" className={isRemindDay ? 'text-orange-500' : 'text-gray-400'} size={18}/>
                                          </Box>
                                          <Box>
                                              <Text size="small" bold className={isRemindDay ? 'text-orange-700' : 'text-gray-700'}>
                                                  {isRemindDay ? "Hôm nay là lịch nhắc nợ định kỳ!" : "Trợ lý nhắc nợ"}
                                              </Text>
                                              <Text size="xxxxSmall" className="text-gray-500 mt-0.5">
                                                  Gửi thông báo đến {shopsToRemindCount} Shop chưa thanh toán.
                                              </Text>
                                          </Box>
                                      </Box>
                                      <Button 
                                          size="small" 
                                          loading={sendingReminders} 
                                          onClick={handleSendReminders} 
                                          className={`border-none px-3 ${isRemindDay ? "bg-orange-500 hover:bg-orange-600 animate-pulse" : "bg-blue-600"}`}
                                      >
                                          Gửi nhắc nợ
                                      </Button>
                                  </Box>
                              );
                              return null;
                          })()}
                          {dataList.length === 0 ? (
                              <Box flex flexDirection="column" alignItems="center" py={8} className="bg-white rounded-2xl border border-dashed border-gray-200">
                                  <CustomIcon icon="zi-check-circle" size={40} className="text-green-500 mb-2"/>
                                  <Text className="text-center text-gray-500">Tất cả các Shop đều đã thanh toán.</Text>
                              </Box>
                          ) : (
                              dataList.map((shopGroup, idx) => (
                                  <Box key={idx} className="mb-4 p-4 bg-white rounded-xl border border-red-100 shadow-md animate-fade-in-up">
                                      <Box flex justifyContent="space-between" alignItems="flex-start" mb={2}>
                                            <Box>
                                                <Box flex alignItems="center" mb={0.5}>
                                                    <Text size="small" bold className="text-gray-800">{shopGroup.shopName}</Text>
                                                    
                                                    {/* 👉 GẮN HUY HIỆU NẾU SHOP ĐÃ BÁO CÁO */}
                                                    {shopGroup.hasReported && (
                                                        <Box className="ml-2 px-2 py-0.5 bg-orange-100 rounded border border-orange-200 flex items-center shadow-md">
                                                            <CustomIcon icon="zi-clock-1" size={12} className="text-orange-600 mr-1"/>
                                                            <Text size="xxxxSmall" bold className="text-orange-600 uppercase tracking-wider">Đã Chuyển khoản</Text>
                                                        </Box>
                                                    )}
                                                </Box>
                                                
                                                <Text size="xSmall" className="text-gray-500">SĐT: {shopGroup.shopId}</Text>
                                                <Text size="xSmall" className="text-gray-500 mt-0.5">Số đơn nợ: <span className="font-bold text-red-500">{shopGroup.orders.length}</span></Text>
                                            </Box>
                                            <Box className="text-right">
                                                <Text size="xSmall" className="text-gray-500 uppercase tracking-wider mb-0.5">Tổng nợ phí</Text>
                                                <Text size="large" bold className="text-red-600">{shopGroup.totalFee.toLocaleString()}đ</Text>
                                            </Box>
                                        </Box>
                                        
                                        <Box mt={3} pt={3} className="border-t border-dashed border-gray-200">
                                            {/* 👉 ĐỔI MÀU NÚT BẤM ĐỂ ADMIN CHÚ Ý HƠN */}
                                            <Button 
                                                fullWidth 
                                                className={`border-none ${shopGroup.hasReported ? "bg-indigo-600" : "bg-green-600"}`}
                                                loading={approvingFeeFor === shopGroup.shopId} 
                                                onClick={() => handleApproveFee(shopGroup.shopId, shopGroup.orders)} 
                                                prefixIcon={<CustomIcon icon="zi-check-circle-solid" className="text-white"/>}
                                            >
                                                {shopGroup.hasReported ? `Duyệt thu ${shopGroup.totalFee.toLocaleString()}đ` : `Xác nhận đã thu ${shopGroup.totalFee.toLocaleString()}đ`}
                                            </Button>
                                        </Box>
                                  </Box>
                              ))
                          )}
                      </Box>
                  )}
                  {/* 👉 BƯỚC 3: NỘI DUNG TAB LỊCH SỬ ĐÃ THU PHÍ */}
                  {reconciliationTab === "history" && (
                      <Box className="animate-fade-in-up">
                          <Box className="bg-green-50 p-3 rounded-xl border border-green-100 mb-4 flex items-center shadow-md">
                              <CustomIcon icon="zi-check-circle" className="text-green-500 mr-2" />
                              <Text size="xSmall" className="text-green-700 leading-relaxed">
                                  Lịch sử các khoản phí nền tảng đã được Admin duyệt và gạch nợ thành công.
                              </Text>
                          </Box>

                          {paidDataList.length === 0 ? (
                              <Box py={8} className="text-center text-gray-400 bg-white rounded-2xl border border-dashed">Chưa có lịch sử thanh toán nào.</Box>
                          ) : (
                              paidDataList.map((shopGroup, idx) => (
                                  <Box key={idx} className="mb-4 p-4 bg-white rounded-xl border border-green-100 shadow-md animate-fade-in-up opacity-90">
                                      <Box flex justifyContent="space-between" alignItems="flex-start" mb={2}>
                                          <Box>
                                              <Text size="small" bold className="text-gray-800">{shopGroup.shopName}</Text>
                                              <Text size="xSmall" className="text-gray-500">SĐT: {shopGroup.shopId}</Text>
                                              <Text size="xSmall" className="text-gray-500 mt-0.5">Tổng số đơn đã đối soát: <span className="font-bold text-green-600">{shopGroup.orders.length}</span></Text>
                                          </Box>
                                          <Box className="text-right">
                                              <Text size="xSmall" className="text-gray-500 uppercase tracking-wider mb-0.5">Tổng đã thu</Text>
                                              <Text size="large" bold className="text-green-600 leading-none">{shopGroup.totalPaidFee.toLocaleString()}đ</Text>
                                          </Box>
                                      </Box>
                                      <Box mt={2} pt={2} className="border-t border-dashed border-gray-200">
                                          <Text size="xxxxSmall" className="text-gray-400 italic">
                                              * Doanh thu này đã được đối soát và ghi nhận vào hệ thống.
                                          </Text>
                                      </Box>
                                  </Box>
                              ))
                          )}
                      </Box>
                  )}
                  {/* --- TAB 2: CẤU HÌNH THÔNG TIN CHUYỂN KHOẢN --- */}
                  {reconciliationTab === "bank_info" && (
                      <Box className="animate-fade-in-up space-y-4">
                          <Box flex alignItems="center" className="mb-3">
                              <CustomIcon icon={"zi-wallet" as any} className="text-red-500 mr-2" size={20}/>
                              <Text bold size="normal" className="text-gray-800">Cấu hình thông tin nhận tiền</Text>
                          </Box>
                          
                          <Box className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
                              <Box mb={4}>
                                  <Text size="small" bold className="mb-1 text-gray-700">1. Thông tin ngân hàng (Dạng chữ)</Text>
                                  <Text size="xxxxSmall" className="text-gray-400 mb-2 italic">* Nội dung này sẽ hiển thị cho Shop copy khi họ đối soát phí.</Text>
                                  {/* 👉 SỬA LỖI TYPESCRIPT: Dùng Input.TextArea của zmp-ui */}
                                <Input.TextArea 
                                    placeholder={`VD: Ngân hàng: VCB\nSố TK: 0123456789\nChủ TK: NGUYEN VAN A\nNội dung: Shop...TT Phi`} 
                                    className="h-28" 
                                    value={adminBankInfoText} 
                                    onChange={(e) => setAdminBankInfoText(e.target.value)} 
                                />
                              </Box>
                              
                              <Box>
                                  <Text size="small" bold className="mb-1 text-gray-700">2. Link hình ảnh mã QR Ngân hàng (Nếu có)</Text>
                                  <Text size="xxxxSmall" className="text-gray-400 mb-2 italic">* Dán link hình ảnh trực tiếp (vd: link từ firebase, drive công khai...)</Text>
                                  <Input 
                                      placeholder="VD: https://firebasestorage.googleapis.com/...qr_code.png" 
                                      value={adminBankQrLink} 
                                      onChange={(e) => setAdminBankQrLink(e.target.value)} 
                                      prefix={<CustomIcon icon={"zi-qr-code" as any} className="text-gray-400"/>}
                                  />
                                  {/* Hiển thị xem trước mã QR nếu có link */}
                                  {adminBankQrLink && (
                                      <Box mt={3} p={2} flex justifyContent="center" className="bg-gray-50 rounded border border-gray-200">
                                          <img src={adminBankQrLink} alt="QR Code Xem trước" className="w-24 h-24 object-contain" />
                                      </Box>
                                  )}
                              </Box>
                          </Box>
                          
                          <Button fullWidth loading={savingBankInfo} onClick={handleSaveBankInfo} prefixIcon={<CustomIcon icon="zi-check-circle-solid" className="text-white"/>}>
                              Lưu thông tin chuyển khoản
                          </Button>
                      </Box>
                  )}
              </Box>
              
              {/* NÚT ĐÓNG MODAL */}
              <Box p={3} className="border-t border-gray-200 bg-white shrink-0">
                  <Button fullWidth variant="secondary" onClick={() => setSelectedFeature(null)}>Đóng</Button>
              </Box>
          </Box>
      );
          // 👉 THÊM MỚI 2 CASE NÀY TRƯỚC default:
        case "settings": return (
          <Box p={2}>
              <Text size="small" bold className="mb-2 text-gray-800">Cấu hình Tài chính</Text>
              {/* 👇 BẮT ĐẦU: CÔNG TẮC KIỂM DUYỆT ZALO 👇 */}
              <Box className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-md mb-4 flex items-center justify-between">
                  <Box className="flex-1 pr-4">
                      <Text size="small" bold className="mb-1 text-orange-800">Hiển thị Giá tiền & Nút thanh toán</Text>
                      <Text size="xxxxSmall" className="text-orange-700 italic leading-relaxed">
                          ⚠️ <b>LƯU Ý QUAN TRỌNG:</b>Điều tiết khi <b>ẨN</b> giá tiền. hoặc <b>BẬT</b> để hiện giá tiền.
                      </Text>
                  </Box>
                  <Switch 
                      checked={showPrice} 
                      onChange={(e: any) => setShowPrice(e.target.checked)}
                  />
              </Box>
              {/* 👆 KẾT THÚC: CÔNG TẮC KIỂM DUYỆT ZALO 👆 */}
              <Box className="bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                  <Text size="small" className="mb-2 text-gray-600">Tỷ lệ trích trả Chi phí nền tảng (%)</Text>
                  <Input 
                      type="number" 
                      value={platformFeeRate} 
                      onChange={(e) => setPlatformFeeRate(e.target.value)} 
                      placeholder="Nhập % (VD: 10)"
                  />
                  <Text size="xxSmall" className="text-gray-400 mt-2 italic">* Tỷ lệ này sẽ áp dụng để tự động tính phí khi Shop hoàn thành đơn hàng mới.</Text>
              </Box>
  
              {/* 👉 ĐÃ THÊM: Ô CÀI ĐẶT TỶ LỆ TÍCH ĐIỂM */}
              <Box className="bg-white p-4 rounded-xl border border-gray-200 shadow-md mb-4">
                  <Text size="small" className="mb-2 text-gray-600">Tỷ lệ tích điểm tối thiểu (%)</Text>
                  <Input 
                      type="number" 
                      value={rewardPointRate} 
                      onChange={(e) => setRewardPointRate(e.target.value)} 
                      placeholder="Nhập % (VD: 10)"
                  />
                  <Text size="xxSmall" className="text-gray-400 mt-2 italic">* Tỷ lệ tối thiểu bắt buộc Shop phải tặng khách (1 điểm = 1000đ). VD: Đơn 100k, tỷ lệ 10% = 10k = 10 điểm.</Text>
              </Box>
  
              <Button fullWidth loading={savingSettings} onClick={handleSaveSettings}>Lưu thay đổi</Button>
          </Box>
      );
    // 👉 ĐÃ NÂNG CẤP: Hiển thị danh sách Tất cả đơn hàng
    case "all_orders": return (
      <Box>
          {dataList.length === 0 && <Text size="small" className="text-center text-gray mt-4 overflow-y-auto">Chưa có đơn hàng nào trên hệ thống.</Text>}
          {dataList.map((order) => {
              const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
              // Tính lại phí hiển thị (nếu đơn cũ chưa lưu phí thì tự tính 10%)
              const fee = order.platformFee !== undefined ? Number(order.platformFee) : Math.floor(total * 10 / 100);
              
              return (
                  <Box key={order.id} className="mb-3 p-3 bg-white rounded-xl border border-gray-200 shadow-md">
                      {/* Mã đơn & Trạng thái */}
                      <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                          <Text size="small" bold className="text-blue-600">#{order.id.slice(0,6).toUpperCase()}</Text>
                          <Text size="xSmall" bold className={
                              order.status === 'completed' || order.status === 'success' ? "text-green-500" :
                              order.status === 'cancelled' ? "text-red-500" : "text-yellow-500"
                          }>
                              {order.status === 'completed' || order.status === 'success' ? "Hoàn thành" : 
                               order.status === 'cancelled' ? "Đã hủy" : "Đang chờ"}
                          </Text>
                      </Box>
                      
                      {/* Thông tin Dịch vụ & Đối tác */}
                      <Box mb={2}>
                          <Text size="small" bold className="text-gray-800">{order.productName}</Text>
                          <Box flex alignItems="center" mt={1}>
                              <CustomIcon icon={"zi-store" as any} size={14} className="text-gray-400 mr-1" />
                              <Text size="xxSmall" className="text-gray-600 line-clamp-1">{order.shopName || order.location?.name || "Chi nhánh"}</Text>
                          </Box>
                          <Box flex alignItems="center" mt={0.5}>
                              <CustomIcon icon="zi-user" size={14} className="text-gray-400 mr-1" />
                              <Text size="xxSmall" className="text-gray-600 line-clamp-1">{order.userName} ({order.userPhone || order.phone})</Text>
                          </Box>
                      </Box>

                      {/* Tiền & Phí */}
                      <Box flex justifyContent="space-between" alignItems="center" mt={2} pt={2} className="border-t border-gray-50">
                          <Text size="small" bold className="text-red-600">{total.toLocaleString()}đ</Text>
                          {(order.status === 'completed' || order.status === 'success') ? (
                              <Text size="xxSmall" className="text-red-600 bg-red-50 px-2 py-1 rounded-md font-medium border border-red-100">
                                  Thu phí: {fee.toLocaleString()}đ
                              </Text>
                          ) : (
                              <Text size="xxSmall" className="text-gray-400 italic">Chưa thu phí</Text>
                          )}
                      </Box>
                  </Box>
              );
          })}
      </Box>
  );
      default: return null;
    }
  };

  return (
    <Box>
      <Box className="bg-blue-600 p-6 text-white mb-4 shadow-md">
        <Box flex alignItems="center" justifyContent="space-between">
            <Box flex alignItems="center"><Avatar src={userData.avatar} size={48} /><Box ml={3}><Text.Title className="text-white" size="small">ADMIN</Text.Title><Text size="small">Xin chào, {userData.name}</Text></Box></Box>
            <Box flex>
                <Box onClick={() => setShowChangePass(true)} className="bg-blue-700 p-2 rounded-full cursor-pointer active:opacity-80 mr-2"><CustomIcon icon="zi-lock" className="text-white" /></Box>
                <Box onClick={onLogout} className="bg-blue-700 p-2 rounded-full cursor-pointer active:opacity-80"><CustomIcon icon="zi-leave" className="text-white" /></Box>
            </Box>
        </Box>
      </Box>
      <Box className="m-4 bg-white rounded-2xl shadow-md border border-gray-100 p-4">
          <Text bold size="normal" className="text-gray-800 mb-3">Thống kê tổng quan</Text>
      {/* 👉 BƯỚC 2: BẢNG THỐNG KÊ GỌN GÀNG (CHỈ HIỆN SỐ CÒN NỢ) */}
      <Box className="grid grid-cols-2 gap-3">
          {/* Ô 1: Tổng Doanh thu */}
          <Box 
              className="col-span-2 p-4 rounded-xl flex justify-between items-center shadow-md"
              style={{ backgroundColor: '#10b981', color: '#ffffff' }} 
          >
              <Box>
                  <Box flex alignItems="center" className="opacity-90 mb-1">
                      <CustomIcon icon="zi-poll" size={16} className="mr-1"/>
                      <Text size="xSmall" className="uppercase tracking-wider">Tổng Doanh thu Nền tảng</Text>
                  </Box>
                  <Text bold size="xLarge">{adminStats.totalRevenue.toLocaleString()}đ</Text>
              </Box>
              <CustomIcon icon="zi-check-circle" size={32} className="opacity-30" />
          </Box>

          {/* Ô 2: Tổng số đơn */}
          <Box 
              className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex flex-col justify-center items-center cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => { setStatsTab("all"); setShowStatsDetail(true); }}
          >
              <Text size="xSmall" className="text-gray-500 mb-1">Tổng số đơn</Text>
              <Text bold size="large" className="text-blue-600">{adminStats.totalOrders}</Text>
          </Box>

          {/* Ô 3: Phí còn nợ (Hiển thị ra ngoài theo yêu cầu) */}
          <Box 
              className="bg-red-50 p-3 rounded-xl border border-red-200 flex flex-col justify-center items-center cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => { setStatsTab("unpaid"); setShowStatsDetail(true); }}
          >
              <Text size="xSmall" className="text-red-600 mb-1">Phí còn nợ</Text>
              <Text bold size="large" className="text-red-500">{adminStats.totalUnpaidFee.toLocaleString()}đ</Text>
          </Box>
      </Box>
      </Box>
      <Box className="m-4 grid grid-cols-2 gap-4">
        {MENU_ITEMS.map((item) => (
          <Box key={item.id} className="bg-white p-4 rounded-xl flex flex-col items-center shadow-md border border-gray-50 relative cursor-pointer active:opacity-80" onClick={() => setSelectedFeature(item.id)}>
            <CustomIcon icon={item.icon as any} className={`${item.color} text-3xl mb-2`} />
            <Text bold size="small" className="text-center">{item.label}</Text>
            {pendingCounts[item.id] > 0 && (<Box className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-md">{pendingCounts[item.id]}</Box>)}
          </Box>
        ))}
      </Box>

      {/* 👉 ĐOẠN CSS ẨN THANH CUỘN (SCROLLBAR) */}
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 👉 BƯỚC 1: GIAO DIỆN TRANG RỘNG (FULL-SCREEN OVERLAY) */}
      {selectedFeature && (
          <Box className="fixed inset-0 bg-white z-[100] flex flex-col h-[100vh] w-[100vw] animate-fade-in">
              {/* Header Điều hướng */}
              <Box className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shadow-md shrink-0">
                  <Box onClick={() => setSelectedFeature(null)} className="mr-3 cursor-pointer p-1 flex items-center">
                      <CustomIcon icon="zi-arrow-left" size={24} className="text-blue-600" />
                  </Box>
                  <Text.Title size="normal" className="text-gray-800">
                      {MENU_ITEMS.find(item => item.id === selectedFeature)?.label || "Quản lý"}
                  </Text.Title>
              </Box>

              {/* Nội dung tràn viền */}
              <Box className="flex-1 overflow-y-auto bg-white pb-32 hide-scroll">
                  {renderModalContent()}
              </Box>
          </Box>
      )}

<Modal visible={!!detailUser} title="Chi tiết" onClose={() => setDetailUser(null)} actions={[{ text: "Đóng", onClick: () => setDetailUser(null), highLight: true }]}>
        {detailUser && (
            <Box p={4} flex flexDirection="column" alignItems="center">
                <Avatar src={detailUser.avatar} size={72} />
<Text.Title size="normal" className="mt-3">{detailUser.name}</Text.Title>
<Text size="small" className="text-gray mb-2">{detailUser.phone}</Text>
{/* 👉 Khối hiển thị Địa chỉ */}
{detailUser.address && (
    <Box className="w-full bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3 flex flex-col">
        <Box flex alignItems="center" mb={1}>
            <CustomIcon icon="zi-location" size={16} className="text-red-500 mr-1" />
            <Text size="xSmall" className="text-gray-500">Địa chỉ liên hệ</Text>
        </Box>
        <Text size="small" bold className="text-gray-800">
            {detailUser.address}
        </Text>
    </Box>
)}

<Box className="w-full bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2 flex justify-between">
  <Text size="small">Vai trò</Text>
  <Text size="small" bold className="uppercase text-blue-700">{detailUser.role==='provider'?'Nhà cung cấp':'Thành viên'}</Text>
  </Box>
                {detailUser.role==='provider' && (<Box className="w-full bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2 flex justify-between items-center"><Text size="small">Người giới thiệu</Text><Text size="small" bold className="text-orange-700">{detailUser.presenterName||detailUser.presenter||"Vãng lai"}</Text></Box>)}
                <Box className="w-full bg-yellow-50 p-3 rounded-lg border border-yellow-100 mb-2 flex justify-between"><Text size="small">Hạng thành viên</Text><Text size="small" bold className="text-yellow-700">{detailUser.rank||"Mới"}</Text></Box>
                <Box className="w-full grid grid-cols-2 gap-2 mt-2">
                    <Box className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100"><CustomIcon icon="zi-star-solid" className="text-yellow-500 mb-1" /><Text size="xxSmall" className="text-gray">Điểm tiêu dùng</Text><Text size="large" bold>{detailUser.spendingPoints?.toLocaleString()||0}</Text></Box>
                    <Box className="bg-gray-50 p-3 rounded-lg text-center border border-gray-100"><CustomIcon icon="zi-poll-solid" className="text-green-500 mb-1" /><Text size="xxSmall" className="text-gray">Tổng tích lũy</Text><Text size="large" bold>{detailUser.rankPoints?.toLocaleString()||0}</Text></Box>
                </Box>
                
                {/* 👉 BƯỚC 3: NÚT GỬI THÔNG BÁO CHO NGƯỜI NÀY */}
                <Box mt={4} className="w-full">
                    <Button 
                        fullWidth 
                        variant="secondary" 
                        className="bg-blue-50 text-blue-600 border border-blue-200 shadow-md font-bold"
                        onClick={() => {
                            setNotifyTitle("Thông báo từ Ban quản trị"); // Tiêu đề mặc định cho nhanh
                            setNotifyContent("");
                            setShowNotifyModal(true);
                        }}
                    >
                        <CustomIcon icon="zi-chat" className="mr-1" /> Gửi thông báo riêng
                    </Button>
                </Box>
                {/* 👉 BƯỚC 4: KHUNG LỊCH SỬ THÔNG BÁO */}
                <Box mt={4} className="w-full border border-gray-200 rounded-xl overflow-hidden shadow-md">
                    <Box className="bg-gray-50 p-2.5 border-b border-gray-200 flex justify-between items-center">
                        <Text size="xSmall" bold className="text-gray-700">Lịch sử thông báo đã gửi</Text>
                        <Text size="xxxxSmall" className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{userNotifs.length}</Text>
                    </Box>
                    
                    <Box className="p-2 bg-white max-h-40 overflow-y-auto hide-scroll">
                        {loadingNotifs ? (
                            <Box flex justifyContent="center" py={3}><Spinner /></Box>
                        ) : userNotifs.length === 0 ? (
                            <Text size="xSmall" className="text-center text-gray-400 italic py-4">Chưa có thông báo nào.</Text>
                        ) : (
                            userNotifs.map((notif, idx) => (
                                <Box key={notif.id || idx} className="mb-2 pb-2 border-b border-gray-50 last:border-0 last:mb-0 last:pb-0">
                                    <Box flex justifyContent="space-between" mb={0.5}>
                                        <Text size="xSmall" bold className="text-blue-800 line-clamp-1 flex-1 pr-2">{notif.title}</Text>
                                        <Text size="xxxxSmall" className="text-gray-400 shrink-0">{formatDate(notif.createdAt)}</Text>
                                    </Box>
                                    <Text size="xxxxSmall" className="text-gray-600 line-clamp-2">{notif.content}</Text>
                                </Box>
                            ))
                        )}
                    </Box>
                </Box>
            </Box>
        )}
      </Modal>
      {/* 👉 BƯỚC 4: GIAO DIỆN MODAL SOẠN THÔNG BÁO */}
      <Modal 
          visible={showNotifyModal} 
          title={`Gửi tin đến: ${detailUser?.name || 'Thành viên'}`} 
          onClose={() => setShowNotifyModal(false)}
      >
          <Box p={4}>
              <Text size="xSmall" className="text-gray-500 mb-4 italic leading-relaxed">
                  Thông báo này sẽ được gửi trực tiếp vào mục "Thông báo" trên ứng dụng của người dùng.
              </Text>
              <Box mb={4}>
                  <Input 
                      label="Tiêu đề thông báo" 
                      value={notifyTitle} 
                      onChange={(e) => setNotifyTitle(e.target.value)} 
                      placeholder="Nhập tiêu đề..."
                  />
              </Box>
              <Box mb={4}>
                  <Input.TextArea 
                      label="Nội dung chi tiết" 
                      value={notifyContent} 
                      onChange={(e) => setNotifyContent(e.target.value)} 
                      placeholder="Ví dụ: Chúc mừng bạn đã nâng hạng! Bạn được tặng 1 Voucher..."
                      rows={4}
                  />
              </Box>
              <Box flex className="gap-3 mt-2">
                  <Button variant="secondary" className="flex-1 bg-gray-100 text-gray-600 border-none" onClick={() => setShowNotifyModal(false)}>Hủy</Button>
                  <Button className="flex-1 bg-blue-600" loading={notifyLoading} onClick={handleSendPrivateNotification}>Gửi ngay</Button>
              </Box>
          </Box>
      </Modal>
      <Modal visible={replyModalVisible} title="Xử lý" onClose={() => setReplyModalVisible(false)} actions={[{ text: "Hủy", onClick: () => setReplyModalVisible(false) }, { text: "Xác nhận", onClick: handleProcessFeedback, highLight: true }]}><Box p={4}><Input.TextArea placeholder="Ghi chú xử lý..." value={adminNote} onChange={(e) => setAdminNote(e.target.value)} /></Box></Modal>

      {/* MODAL ĐỔI MẬT KHẨU ADMIN */}
      <Modal visible={showChangePass} title="Đổi mật khẩu Admin" onClose={() => setShowChangePass(false)}>
        <Box p={4}>
            <Box mb={4}><Input.Password label="Mật khẩu cũ" value={oldPass} onChange={(e) => setOldPass(e.target.value)} /></Box>
            <Box mb={4}><Input.Password label="Mật khẩu mới" value={newPass} onChange={(e) => setNewPass(e.target.value)} /></Box>
            <Box mb={4}><Input.Password label="Xác nhận mật khẩu" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} /></Box>
            <Button fullWidth loading={passLoading} onClick={handleChangeAdminPassword}>Lưu thay đổi</Button>
        </Box>
      </Modal>
      {/* 👉 BƯỚC 4: MODAL CHI TIẾT ĐƠN HÀNG VÀ BỘ LỌC SHOP (Đã sửa lỗi hiển thị tên Shop) */}
      {/* 👉 BƯỚC 3: MODAL CHI TIẾT TÍCH HỢP 3 TAB (TỔNG PHÍ / ĐÃ THU / CÒN NỢ) */}
      <Modal
            visible={showStatsDetail}
            title="Chi tiết Giao dịch & Phí"
            onClose={() => setShowStatsDetail(false)}
            actions={[{ text: "Đóng", onClick: () => setShowStatsDetail(false) }]}
        >
            <Box className="bg-gray-50 flex flex-col h-[75vh]">
                {/* THANH TAB CHUYỂN ĐỔI */}
                <Box flex className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0">
                    <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${statsTab==="all"?"border-blue-600 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setStatsTab("all")}>
                        Tổng phí
                    </Box>
                    <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${statsTab==="collected"?"border-green-600 text-green-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setStatsTab("collected")}>
                        Đã thu
                    </Box>
                    <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${statsTab==="unpaid"?"border-red-600 text-red-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setStatsTab("unpaid")}>
                        Còn nợ
                    </Box>
                </Box>

                <Box p={4} className="flex-1 overflow-y-auto hide-scroll">
                    {/* BỘ LỌC SHOP */}
                    <Box mb={4} className="bg-white p-3 rounded-xl border border-gray-200 shadow-md">
                        <Text size="small" bold className="mb-2 text-gray-700">Lọc theo Shop (Nhà cung cấp):</Text>
                        <Select
                            value={statsShopFilter}
                            onChange={(val) => setStatsShopFilter(val as string)}
                            closeOnSelect
                        >
                            <Option value="all" title="Tất cả các Shop" />
                            {Array.from(new Set(completedOrders.map(o => o.shopId))).map(shopId => {
                                if (!shopId) return null;
                                const sampleOrder = completedOrders.find(o => o.shopId === shopId);
                                const shopName = sampleOrder?.shopName || "Shop chưa cập nhật tên";
                                return <Option key={shopId} value={shopId} title={shopName} />;
                            })}
                        </Select>
                    </Box>

                    {/* DANH SÁCH ĐƠN HÀNG KÈM SỐ TỔNG THEO TAB */}
                    {(() => {
                        // 1. Lọc theo Shop
                        let filteredOrders = statsShopFilter === "all" ? completedOrders : completedOrders.filter(o => o.shopId === statsShopFilter);
                        
                        // 2. Lọc theo Tab (Đã thu / Còn nợ)
                        if (statsTab === "collected") {
                            filteredOrders = filteredOrders.filter(o => o.isFeePaid);
                        } else if (statsTab === "unpaid") {
                            filteredOrders = filteredOrders.filter(o => !o.isFeePaid);
                        }

                        // 3. Tính toán tiền theo điều kiện lọc
                        const filteredFee = filteredOrders.reduce((sum, o) => sum + (o.calculatedFee || 0), 0);

                        if (filteredOrders.length === 0) return <Text className="text-center text-gray-500 mt-4">Không có dữ liệu.</Text>;

                        return (
                            <Box>
                                {/* 👉 SỐ TỔNG HIỂN THỊ NỔI BẬT THEO TỪNG TAB */}
                                <Box className={`p-3 rounded-xl border shadow-md mb-4 text-center ${statsTab === 'collected' ? 'bg-green-50 border-green-200' : statsTab === 'unpaid' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                                    <Text size="xSmall" className="text-gray-600 uppercase tracking-wider mb-1">
                                        {statsTab === 'collected' ? 'Tổng phí đã thu' : statsTab === 'unpaid' ? 'Tổng phí còn nợ' : 'Tổng phí nền tảng'} ({filteredOrders.length} đơn)
                                    </Text>
                                    <Text bold size="xLarge" className={statsTab === 'collected' ? 'text-green-600' : statsTab === 'unpaid' ? 'text-red-600' : 'text-blue-600'}>
                                        {filteredFee.toLocaleString()}đ
                                    </Text>
                                </Box>

                                {filteredOrders.map((order, idx) => (
                                    <Box key={order.id} className="mb-3 p-3 bg-white rounded-xl border border-gray-200 shadow-md animate-fade-in-up">
                                        <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                                            <Text size="small" bold className="text-blue-600">#{order.id.slice(0,6).toUpperCase()}</Text>
                                            <Text size="xSmall" className="text-gray-500">{formatDate(order.createdAt)}</Text>
                                        </Box>
                                        
                                        <Box mb={2}>
                                            <Text size="small" bold className="text-gray-800">{order.productName}</Text>
                                            
                                            <Box flex alignItems="center" mt={1}>
                                                <CustomIcon icon={"zi-store" as any} size={14} className="text-orange-500 mr-1" />
                                                <Text size="xxSmall" bold className="text-orange-600 line-clamp-1">
                                                    Shop: {order.shopName || "Chưa cập nhật"}
                                                </Text>
                                            </Box>
                                            
                                            {order.location?.name && (
                                                <Box flex alignItems="center" mt={0.5}>
                                                    <CustomIcon icon={"zi-location" as any} size={14} className="text-gray-400 mr-1" />
                                                    <Text size="xxSmall" className="text-gray-500 line-clamp-1">
                                                        Chi nhánh: {order.location.name}
                                                    </Text>
                                                </Box>
                                            )}
                                        </Box>

                                        <Box flex justifyContent="space-between" alignItems="center" mt={2} pt={2} className="border-t border-gray-50">
                                            <Text size="small" bold className="text-gray-800">Đơn: {Number(order.totalAmount || order.totalPrice || order.total || 0).toLocaleString()}đ</Text>
                                            
                                            {/* Huy hiệu hiển thị trạng thái Nợ / Đã thu của từng đơn */}
                                            <Text size="small" bold className={`px-2 py-1 rounded-md border ${order.isFeePaid ? 'text-green-600 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                                                Phí: +{order.calculatedFee?.toLocaleString()}đ {order.isFeePaid ? '(Đã thu)' : '(Nợ)'}
                                            </Text>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        );
                    })()}
                </Box>
            </Box>
        </Modal>
    </Box>
  );
};