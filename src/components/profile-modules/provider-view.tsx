import CustomIcon from '../custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Box, Text, Icon, Button, Avatar, List, Modal, Input, Spinner, useSnackbar, Progress, Select } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, setDoc, serverTimestamp, orderBy, limit, getDoc, onSnapshot, increment } from "firebase/firestore";
import { db, storage, auth } from "../../firebase"; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { openShareSheet } from "zmp-sdk/apis";
import { getValidAvatar } from "../../utils/avatar";
import { compressImage } from "../../utils/compression";

const { Item } = List;
const { TextArea } = Input;
const { Option } = Select;

const isWithin15Days = (createdAt: any) => {
  if (!createdAt) return true;
  const date = createdAt.toDate ? createdAt.toDate() : (createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt));
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  return date >= fifteenDaysAgo;
};

// 👉 Placeholder cho App ID của bạn
const YOUR_APP_ID = "3525851935148341014"; 

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
  setUserData?: (data: any) => void;
  onBackToProfile?: () => void; // Dấu ? nghĩa là hàm này có thể có hoặc không
  onLogout?: () => void;        // Định nghĩa thêm hàm đăng xuất
  initialOpenVipModal?: boolean;
}

export const ProviderView: FC<ProviderProps> = ({ userData, setUserData, onBackToProfile, onLogout, initialOpenVipModal }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();

  const handleShareOrder = async (order) => {
    try {
      const orderCode = order.orderCode || order.id.slice(0, 8).toUpperCase();
      const orderTitle = order.productName || "Đơn hàng Green Biz";
      const orderPrice = Number(order.totalAmount || order.totalPrice || order.total || 0).toLocaleString('vi-VN') + 'đ';
      let statusText = order.status || 'Chờ xác nhận';
      if (order.status === 'completed' || order.status === 'success') statusText = 'Hoàn thành';
      else if (order.status === 'cancelled') statusText = 'Đã hủy';
      else statusText = 'Đang xử lý';
      
      await openShareSheet({
        type: "zmp_deep_link",
        data: {
          title: `Mã đơn hàng: #${orderCode} - Campus Green Biz`,
          description: `Đơn hàng: ${orderTitle} (${orderPrice}). Trạng thái: ${statusText}. Ghé thăm Campus Green Biz nhé!`,
          thumbnail: order.productImage || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png",
        },
      });
    } catch (err) {
      console.error("Lỗi chia sẻ đơn hàng:", err);
    }
  };

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
  // Lắng nghe real-time số lượng phản hồi Admin đã trả lời nhưng chưa đọc
  useEffect(() => {
    if (!userData?.id && !userData?.phone) return;
    
    const shopId = userData.id || userData.phone;
    const qUnread = query(
      collection(db, "feedbacks"),
      where("userId", "==", shopId),
      where("status", "==", "done"),
      where("userRead", "==", false)
    );

    const unsub = onSnapshot(qUnread, (snap) => {
      setUnreadFeedbackCount(snap.docs.length);
    });

    return () => unsub();
  }, [userData]);

  // --- STATE MODAL CẬP NHẬT THÔNG TIN SHOP ---
  const [showShopRegistrationModal, setShowShopRegistrationModal] = useState(false);
  const [regShopName, setRegShopName] = useState(userData?.shopName || userData?.fullName || "");
  const [regManagerName, setRegManagerName] = useState("");
  const [regManagerPhone, setRegManagerPhone] = useState(userData?.phone || "");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [hasBusinessLicense, setHasBusinessLicense] = useState<string>("no");
  const [agreeToLiability, setAgreeToLiability] = useState(false);
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [isUploadingLicense, setIsUploadingLicense] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);

  const handleUploadLicenseImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLicense(true);
    try {
      const filename = `licenses/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filename);
      const compressedFile = await compressImage(file);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      setLicenseImage(url);
      openSnackbar({ text: "Tải ảnh lên thành công!", type: "success" });
    } catch (error) {
      console.error("Lỗi khi tải ảnh lên:", error);
      openSnackbar({ text: "Lỗi tải ảnh lên. Vui lòng thử lại.", type: "error" });
    } finally {
      setIsUploadingLicense(false);
    }
  };

  const handleSubmitRegistration = async () => {
    if (!regShopName || !regManagerName || !regManagerPhone) {
      openSnackbar({ text: "Vui lòng điền đầy đủ thông tin!", type: "error" });
      return;
    }
    if (!agreeToTerms) {
      openSnackbar({ text: "Vui lòng đồng ý với Điều khoản thoả thuận!", type: "error" });
      return;
    }
    if (hasBusinessLicense === "yes" && !licenseImage) {
      openSnackbar({ text: "Vui lòng tải lên Giấy đăng ký kinh doanh!", type: "error" });
      return;
    }
    if (hasBusinessLicense === "no" && !agreeToLiability) {
      openSnackbar({ text: "Vui lòng xác nhận Cam kết chịu trách nhiệm!", type: "error" });
      return;
    }

    setIsSubmittingRegistration(true);
    try {
      const shopId = userData.id;
      if (!shopId) throw new Error("Không tìm thấy ID Shop");

      await updateDoc(doc(db, "shops", shopId), {
        shopName: regShopName,
        managerName: regManagerName,
        managerPhone: regManagerPhone,
        hasBusinessLicense: hasBusinessLicense === "yes",
        licenseImage: licenseImage || null,
        agreeToTerms: agreeToTerms,
        agreeToLiability: agreeToLiability,
        status: "reviewing",
        registrationUpdatedAt: serverTimestamp()
      });

      // Update local state partially so UI reacts
      userData.status = "reviewing";

      openSnackbar({ text: "Gửi yêu cầu xét duyệt thành công!", type: "success" });
      setShowShopRegistrationModal(false);
    } catch (err) {
      console.error("Lỗi gửi duyệt:", err);
      openSnackbar({ text: "Có lỗi xảy ra, vui lòng thử lại!", type: "error" });
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  // 👉 THÊM MỚI: STATE QUẢN LÝ ĐƠN HÀNG (CHỦ SHOP)
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderList, setOrderList] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
  const [buyerNamesMap, setBuyerNamesMap] = useState<Record<string, string>>({});
  const [showOrderAccount, setShowOrderAccount] = useState(false);
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReasonText, setCancelReasonText] = useState("");

  // State Thông tin Shop
  const [showShopInfoModal, setShowShopInfoModal] = useState(false);
  const [editName, setEditName] = useState(userData.name || userData.shopName || "");
  const [editAddress, setEditAddress] = useState(userData.address || "");
  const [editManager, setEditManager] = useState(userData.managerName || userData.fullName || "");
  const [updatingInfo, setUpdatingInfo] = useState(false);
  const [editDescription, setEditDescription] = useState(userData.description || "");
  const [editAvatar, setEditAvatar] = useState(userData.avatar || "");
  const [editCover, setEditCover] = useState(userData.cover || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
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
  const [rankHistoryList, setRankHistoryList] = useState<any[]>([]);
  const [rankHistoryLoading, setRankHistoryLoading] = useState(false);
  const [showShopWalletHistoryModal, setShowShopWalletHistoryModal] = useState(false);
  const [shopActiveWalletTab, setShopActiveWalletTab] = useState<'rank' | 'promo' | 'interaction'>('rank');
  const [shopWalletHistoryList, setShopWalletHistoryList] = useState<any[]>([]);
  const [loadingShopWalletHistory, setLoadingShopWalletHistory] = useState(false);
  const [eligiblePoints, setEligiblePoints] = useState(0);
  const [activeShopTab, setActiveShopTab] = useState<'rank' | 'promo' | 'interaction'>('rank');

  useEffect(() => {
    const fetchShopEligiblePoints = async () => {
      if (!userData?.id) return;
      try {
        const q = query(
          collection(db, "point_transactions"),
          where("userId", "==", userData.id),
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
        console.error("Lỗi tính điểm khả dụng shop:", e);
      }
    };
    fetchShopEligiblePoints();
  }, [userData?.id]);

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
          preloadName: userData.name || userData.shopName,
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
          const uq1 = query(collection(db, "users"), where("referrer", "==", userData.phone));
          const uq2 = query(collection(db, "users"), where("referralCode", "==", userData.phone));
          const sq1 = query(collection(db, "shops"), where("referrer", "==", userData.phone));
          const sq2 = query(collection(db, "shops"), where("referralCode", "==", userData.phone));
          
          const [usnap1, usnap2, ssnap1, ssnap2] = await Promise.all([
              getDocs(uq1),
              getDocs(uq2),
              getDocs(sq1),
              getDocs(sq2)
          ]);
          
          const mergedMap = new Map();
          usnap1.docs.forEach(doc => mergedMap.set(doc.id, { ...doc.data(), referredType: "user" }));
          usnap2.docs.forEach(doc => mergedMap.set(doc.id, { ...doc.data(), referredType: "user" }));
          ssnap1.docs.forEach(doc => mergedMap.set(doc.id, { ...doc.data(), referredType: "shop" }));
          ssnap2.docs.forEach(doc => mergedMap.set(doc.id, { ...doc.data(), referredType: "shop" }));
          
          const mergedList = Array.from(mergedMap.values());
          setReferralList(mergedList);
      } catch (error) { 
          console.error("Lỗi tải khách hàng giới thiệu:", error);
          openSnackbar({ text: "Lỗi tải dữ liệu", type: "error" }); 
      } finally { setReferralLoading(false); }
  };

  // 👉 3. LẤY LỊCH SỬ TIÊU DÙNG (GIẢM ĐIỂM)
  const handleShowSpendingHistory = async () => {
      setShowHistoryModal(true);
      setHistoryLoading(true);
      try {
          // Tìm trong collection 'point_history' các giao dịch trừ điểm của user này (Lọc và sắp xếp in-memory để tránh lỗi thiếu Composite Index)
          const q = query(
              collection(db, "point_history"), 
              where("userId", "==", userData.phone)
          );
          
          const snapshot = await getDocs(q);
          const list = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as any))
              .filter(item => item.type === "minus" && isWithin15Days(item.createdAt))
              .sort((a, b) => {
                  const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                  const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                  return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 20);
          setHistoryList(list);
      } catch (error) {
          console.error("Lỗi tải lịch sử:", error);
          setHistoryList([]);
      } finally {
          setHistoryLoading(false);
      }
  };

  // 👉 LẤY LỊCH SỬ TÍCH LŨY ĐIỂM (CỘNG ĐIỂM ĐỂ LÊN HẠNG)
  const handleShowRankDetail = async () => {
      setShowRankDetailModal(true);
      setRankHistoryLoading(true);
      try {
          // Lọc và sắp xếp in-memory để tránh lỗi thiếu Composite Index của Firebase
          const q = query(
              collection(db, "point_transactions"), 
              where("userId", "==", userData.id)
          );
          
          const snapshot = await getDocs(q);
          const list = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as any))
              .filter(item => item.type === "plus" && item.walletType === "rank" && isWithin15Days(item.createdAt))
              .sort((a, b) => {
                  const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                  const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                  return dateB.getTime() - dateA.getTime();
              })
              .slice(0, 20);
          setRankHistoryList(list);
      } catch (error) {
          console.error("Lỗi tải lịch sử tích lũy:", error);
          setRankHistoryList([]);
      } finally {
          setRankHistoryLoading(false);
      }
  };

  const handleConvertPromoToVip = async () => {
      const currentPromo = userData.spendingPoints || 0;
      if (currentPromo < 2) {
          return openSnackbar({ text: "Số dư Ví Ưu Đãi không đủ (Tối thiểu 2 điểm)!", type: "warning" });
      }

      if (!window.confirm("Đổi điểm từ Ví Ưu Đãi sang Ví điểm đẩy hàng VIP?\n- Tỷ lệ: 2 Ưu Đãi = 1 VIP\n- Toàn bộ số điểm chẵn sẽ được đổi.")) return;

      try {
          const promoToDeduct = currentPromo - (currentPromo % 2); // Chỉ đổi phần chẵn
          const vipToAdd = promoToDeduct / 2;
          const targetDocId = userData.id || userData.phone;

          // Cập nhật điểm shop
          await updateDoc(doc(db, "shops", targetDocId), {
              spendingPoints: increment(-promoToDeduct),
              vipPushPoints: increment(vipToAdd),
              rankPoints: increment(vipToAdd)
          });

          // Lịch sử trừ Ví Ưu Đãi
          await addDoc(collection(db, "point_transactions"), {
              userId: targetDocId,
              amount: promoToDeduct,
              type: "minus",
              walletType: "promo",
              reason: `Quy đổi sang ${vipToAdd} điểm đẩy hàng VIP`,
              createdAt: serverTimestamp()
          });

          // Lịch sử cộng Ví Hạng
          await addDoc(collection(db, "point_transactions"), {
              userId: targetDocId,
              amount: vipToAdd,
              type: "plus",
              walletType: "rank",
              reason: `Được quy đổi từ ${promoToDeduct} điểm Ví Ưu Đãi`,
              createdAt: serverTimestamp()
          });

          // Thêm vào lịch sử nạp VIP
          await addDoc(collection(db, "vip_points_requests"), {
              shopId: targetDocId,
              points: vipToAdd,
              amount: 0,
              status: "approved",
              reason: `Đổi từ ${promoToDeduct} điểm Ví Ưu Đãi`,
              createdAt: serverTimestamp()
          });

          openSnackbar({ text: `Đã đổi thành công ${vipToAdd} điểm VIP!`, type: "success" });
          
          if (setUserData) setUserData((prev: any) => ({
              ...prev,
              spendingPoints: (prev.spendingPoints || 0) - promoToDeduct,
              vipPushPoints: (prev.vipPushPoints || 0) + vipToAdd,
              rankPoints: (prev.rankPoints || 0) + vipToAdd
          }));
      } catch (e) {
          console.error(e);
          openSnackbar({ text: "Lỗi quy đổi điểm", type: "error" });
      }
  };

  const handleConvertInteractionToVip = async () => {
      if (eligiblePoints < 20) {
          return openSnackbar({ text: "Số dư khả dụng không đủ (Tối thiểu 20 điểm)!", type: "warning" });
      }

      if (!window.confirm("Đổi điểm từ Ví Tương Tác sang Ví điểm đẩy hàng VIP?\n- Tỷ lệ: 20 Tương Tác = 1 VIP\n- Toàn bộ số điểm chẵn theo tỷ lệ sẽ được đổi.")) return;

      try {
          const interactionToDeduct = eligiblePoints - (eligiblePoints % 20); // Chỉ đổi phần chia hết cho 20
          const vipToAdd = interactionToDeduct / 20;
          const targetDocId = userData.id || userData.phone;

          // Cập nhật điểm shop
          await updateDoc(doc(db, "shops", targetDocId), {
              interactionPoints: increment(-interactionToDeduct),
              vipPushPoints: increment(vipToAdd),
              rankPoints: increment(vipToAdd)
          });

          // Lịch sử trừ Ví Tương Tác
          await addDoc(collection(db, "point_transactions"), {
              userId: targetDocId,
              amount: interactionToDeduct,
              type: "minus",
              walletType: "interaction",
              reason: `Quy đổi sang ${vipToAdd} điểm đẩy hàng VIP`,
              createdAt: serverTimestamp()
          });

          // Lịch sử cộng Ví Hạng
          await addDoc(collection(db, "point_transactions"), {
              userId: targetDocId,
              amount: vipToAdd,
              type: "plus",
              walletType: "rank",
              reason: `Được quy đổi từ ${interactionToDeduct} điểm Ví Tương Tác`,
              createdAt: serverTimestamp()
          });

          // Thêm vào lịch sử nạp VIP
          await addDoc(collection(db, "vip_points_requests"), {
              shopId: targetDocId,
              points: vipToAdd,
              amount: 0,
              status: "approved",
              reason: `Đổi từ ${interactionToDeduct} điểm Ví Tương Tác`,
              createdAt: serverTimestamp()
          });

          openSnackbar({ text: `Đã đổi thành công ${vipToAdd} điểm VIP!`, type: "success" });
          
          if (setUserData) setUserData((prev: any) => ({
              ...prev,
              interactionPoints: (prev.interactionPoints || 0) - interactionToDeduct,
              vipPushPoints: (prev.vipPushPoints || 0) + vipToAdd,
              rankPoints: (prev.rankPoints || 0) + vipToAdd
          }));
          setEligiblePoints(prev => prev - interactionToDeduct);
      } catch (e) {
          console.error(e);
          openSnackbar({ text: "Lỗi quy đổi điểm", type: "error" });
      }
  };

  const handleOpenShopWalletHistory = async (tab: 'rank' | 'promo' | 'interaction') => {
      setShopActiveWalletTab(tab);
      setShowShopWalletHistoryModal(true);
      setLoadingShopWalletHistory(true);
      try {
          const q = query(
              collection(db, "point_transactions"), 
              where("userId", "==", userData.id)
          );
          const snapshot = await getDocs(q);
          let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          docs = docs.filter((tx: any) => {
              const type = tx.walletType || 'main';
              let matchesType = false;
              if (tab === 'rank') {
                  matchesType = type === 'main' || type === 'all';
              } else if (tab === 'promo') {
                  matchesType = type === 'promo' || type === 'main' || type === 'all';
              } else {
                  matchesType = type === 'interaction';
              }
              return matchesType && isWithin15Days(tx.createdAt);
          });
          
          docs.sort((a: any, b: any) => {
              const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
              const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
              return timeB - timeA;
          });
          
          setShopWalletHistoryList(docs);
      } catch (error) {
          console.error("Lỗi tải lịch sử ví shop:", error);
          setShopWalletHistoryList([]);
      } finally {
          setLoadingShopWalletHistory(false);
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
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.exists() ? orderSnap.data() : null;

        let updateData: any = { status: newStatus };
        let finalBuyerPoints = 0;

        if (newStatus === 'completed' && orderData) {
            const totalAmount = Number(orderData.totalAmount || orderData.totalPrice || orderData.total || 0);

            // 1. TÍNH CHI PHÍ NỀN TẢNG
            let platformFeeRate = 10;
            try {
                const configRef = doc(db, "system_config", "admin_settings");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().platformFeeRate !== undefined) {
                    platformFeeRate = Number(configSnap.data().platformFeeRate);
                }
            } catch (e) { console.log("Lỗi lấy tỷ lệ phí Admin:", e); }

            const platformFee = Math.floor(totalAmount * (platformFeeRate / 100));
            updateData.platformFee = platformFee;
            updateData.platformFeeRate = platformFeeRate;

            // 2. CỘNG ĐIỂM TÍCH LŨY (10.000đ = 1 điểm)
            let totalPoints = Math.floor(totalAmount / 10000); 
            if (totalPoints > 0) {
                let buyerPoints = totalPoints;
                const referrerPoints: Record<string, number> = {};

                const parsePriceStr = (val: any) => {
                    if (!val) return 0;
                    if (typeof val === 'number') return val;
                    const parsed = Number(val.toString().replace(/[^0-9]/g, ''));
                    return isNaN(parsed) ? 0 : parsed;
                };

                const items = orderData.items || orderData.cartItems || [];
                items.forEach((item: any) => {
                    if (item.referrerId && item.referrerId !== orderData.userId && item.product?.price) {
                        const itemAmount = (parsePriceStr(item.product.price) * (item.quantity || 1));
                        const itemPts = Math.floor(itemAmount / 10000);
                        if (itemPts > 0) {
                            const refPts = Math.floor(itemPts * 0.2); // 20%
                            if (refPts > 0) {
                                buyerPoints -= refPts;
                                referrerPoints[item.referrerId] = (referrerPoints[item.referrerId] || 0) + refPts;
                            }
                        }
                    }
                });

                if (buyerPoints < 0) buyerPoints = 0;
                finalBuyerPoints = buyerPoints;

                // Cộng điểm cho người mua (80%)
                if (orderData.userId && buyerPoints > 0) {
                    try {
                        const qUser = query(collection(db, "users"), where("phone", "==", orderData.userId));
                        const userSnap = await getDocs(qUser);
                        const userDocId = !userSnap.empty ? userSnap.docs[0].id : orderData.userId;
                        const userRef = doc(db, "users", userDocId);
                        
                        await setDoc(userRef, { 
                            spendingPoints: increment(buyerPoints), 
                            rankPoints: increment(buyerPoints) 
                        }, { merge: true });
                        
                        await addDoc(collection(db, "point_transactions"), { 
                                userId: userDocId, 
                                type: "plus", 
                                amount: buyerPoints, 
                                description: `Tích điểm từ đơn hàng #${orderData.orderCode || orderId.slice(0,6).toUpperCase()}`, 
                                walletType: "main", 
                                createdAt: serverTimestamp() 
                            });
                    } catch (e) {
                        console.error("Lỗi cộng điểm khách hàng:", e);
                    }
                }

                // Cộng điểm cho người giới thiệu (20%)
                for (const [refId, rPts] of Object.entries(referrerPoints)) {
                    try {
                        let refDocId = refId;
                        let refUserRef = doc(db, "users", refDocId);

                        const qRef = query(collection(db, "users"), where("phone", "==", refId));
                        const refSnap = await getDocs(qRef);
                        if (!refSnap.empty) {
                            refDocId = refSnap.docs[0].id;
                            refUserRef = doc(db, "users", refDocId);
                        }
                        
                        await setDoc(refUserRef, { 
                            spendingPoints: increment(rPts), 
                            rankPoints: increment(rPts) 
                        }, { merge: true });
                        
                        await addDoc(collection(db, "point_transactions"), { 
                                userId: refDocId, 
                                type: "plus", 
                                amount: rPts, 
                                description: `Hoa hồng giới thiệu sản phẩm từ đơn hàng #${orderData.orderCode || orderId.slice(0,6).toUpperCase()}`, 
                                walletType: "main", 
                                createdAt: serverTimestamp() 
                            });

                            await addDoc(collection(db, "notifications"), {
                                userId: refDocId,
                                title: "Nhận điểm giới thiệu",
                                content: `Bạn vừa nhận được ${rPts} điểm ưu đãi từ việc chia sẻ giới thiệu sản phẩm trong đơn hàng #${orderData.orderCode || orderId.slice(0,6).toUpperCase()}.`,
                                type: "bonus",
                                createdAt: serverTimestamp(),
                                isRead: false
                            });
                    } catch (e) {
                        console.error("Lỗi cộng điểm người giới thiệu:", e);
                    }
                }
                if (orderData.shopId) {
                    try {
                        const shopRef = doc(db, "shops", orderData.shopId);
                        await updateDoc(shopRef, { 
                            spendingPoints: increment(totalPoints), 
                            rankPoints: increment(totalPoints) 
                        });
                    } catch (e) {
                        console.error("Lỗi cộng điểm shop:", e);
                    }
                }
            }
        }

        await updateDoc(orderRef, updateData);

        // TẠO THÔNG BÁO CHO KHÁCH HÀNG
        if (orderData && orderData.userId) {
            let notifTitle = "Cập nhật đơn hàng";
            let notifContent = `Đơn hàng #${orderData.orderCode || orderId.slice(0, 6).toUpperCase()} của bạn đã thay đổi trạng thái.`;
            if (newStatus === "confirmed" || newStatus === "processing") {
                notifTitle = "Xác nhận đơn hàng";
                notifContent = `Đơn hàng #${orderData.orderCode || orderId.slice(0, 6).toUpperCase()} đã được cửa hàng xác nhận và đang chuẩn bị.`;
            } else if (newStatus === "shipping") {
                notifTitle = "Đơn hàng đang giao";
                notifContent = `Tài xế đang trên đường giao đơn hàng #${orderData.orderCode || orderId.slice(0, 6).toUpperCase()} cho bạn. Vui lòng chú ý điện thoại.`;
            } else if (newStatus === "completed") {
                notifTitle = "Giao hàng thành công";
                notifContent = `Đơn hàng #${orderData.orderCode || orderId.slice(0, 6).toUpperCase()} đã giao thành công.${finalBuyerPoints > 0 ? ` Bạn được cộng ${finalBuyerPoints} điểm ưu đãi!` : ''}`;
            } else if (newStatus === "cancelled") {
                notifTitle = "Đơn hàng đã hủy";
                notifContent = `Đơn hàng #${orderData.orderCode || orderId.slice(0, 6).toUpperCase()} của bạn đã bị hủy.`;
            }
            await addDoc(collection(db, "notifications"), {
                userId: orderData.userId,
                title: notifTitle,
                content: notifContent,
                type: newStatus,
                createdAt: serverTimestamp(),
                isRead: false
            }).catch(e => console.log("Lỗi tạo thông báo:", e));
        }

        // Cập nhật lại state giao diện
        setOrderList(prev => prev.map(o => o.id === orderId ? { ...o, ...updateData } : o));
        openSnackbar({ text: "Đã cập nhật trạng thái!", type: "success" });
    } catch (error) {
        openSnackbar({ text: "Lỗi cập nhật", type: "error" });
    }
};
  const [pendingCount, setPendingCount] = useState(0);
  const [shopVipPoints, setShopVipPoints] = useState(0);
  const [showVipModal, setShowVipModal] = useState(initialOpenVipModal || false);
  const [pointsToBuy, setPointsToBuy] = useState("");
  const [vipActiveTab, setVipActiveTab] = useState("buy");
  const [myVipRequests, setMyVipRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!showVipModal || !userData.id) return;
    const q1 = query(
      collection(db, "vip_points_requests"), 
      where("shopId", "==", userData.id)
    );
    const q2 = query(
      collection(db, "point_transactions"),
      where("userId", "==", userData.id)
    );
    
    let list1: any[] = [];
    let list2: any[] = [];
    
    const updateMergedList = () => {
      const merged = [...list1, ...list2].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setMyVipRequests(merged);
    };

    const unsub1 = onSnapshot(q1, (snap) => {
      list1 = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      updateMergedList();
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      // Lọc các giao dịch có lý do là quy đổi điểm sang VIP
      list2 = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(item => item.walletType === "rank" && item.reason && item.reason.includes("Được quy đổi từ"))
        .map(item => ({
          ...item,
          status: "approved",
          points: item.amount,
          amount: 0
        }));
      updateMergedList();
    });

    return () => { unsub1(); unsub2(); };
  }, [showVipModal, userData.id]);

  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingVipRequest, setSubmittingVipRequest] = useState(false);

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const filename = `vip_receipts/${userData.id}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filename);
      const compressedFile = await compressImage(file);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      setReceiptUrl(url);
      openSnackbar({ text: "Tải biên lai lên thành công!", type: "success" });
    } catch (error) {
      console.error("Lỗi khi tải ảnh biên lai:", error);
      openSnackbar({ text: "Lỗi tải ảnh lên. Vui lòng thử lại.", type: "error" });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmitVipRequest = async () => {
    if (!pointsToBuy || Number(pointsToBuy) <= 0) {
      openSnackbar({ text: "Vui lòng nhập số điểm muốn mua hợp lệ!", type: "error" });
      return;
    }
    if (!receiptUrl) {
      openSnackbar({ text: "Vui lòng tải ảnh biên lai chuyển tiền lên!", type: "error" });
      return;
    }

    const generateOrderCode = () => {
      const year = new Date().getFullYear().toString().slice(-2);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let suffix = "";
      for (let i = 0; i < 6; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `${year}${suffix}`;
    };

    setSubmittingVipRequest(true);
    try {
      const code = generateOrderCode();
      await addDoc(collection(db, "vip_points_requests"), {
        orderCode: code,
        shopId: userData.id,
        shopPhone: userData.phone,
        shopName: userData.name || userData.phone,
        points: Number(pointsToBuy),
        amount: Number(pointsToBuy) * 1000,
        receiptImage: receiptUrl,
        status: "pending",
        createdAt: serverTimestamp()
      });
      openSnackbar({ text: `Gửi yêu cầu mua điểm VIP thành công! Mã đơn: ${code}`, type: "success" });
      setShowVipModal(false);
      setPointsToBuy("");
      setReceiptUrl("");
    } catch (error) {
      console.error("Lỗi gửi yêu cầu mua điểm:", error);
      openSnackbar({ text: "Lỗi hệ thống. Vui lòng thử lại.", type: "error" });
    } finally {
      setSubmittingVipRequest(false);
    }
  };

  useEffect(() => {
    if (!userData.id) return;
    const unsub = onSnapshot(doc(db, "shops", userData.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setShopVipPoints((data.vipPushPoints || 0) + (data.vipPoints || 0));
      }
    });
    return () => unsub();
  }, [userData.id]);

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

          // Lấy tên các tài khoản đặt hàng
          const uniqueUserIds = Array.from(new Set(allDocs.map(doc => {
              const d = doc.data();
              return d.userId || d.customerPhone || d.phone;
          }).filter(Boolean))) as string[];
          const namesMap: Record<string, string> = {};
          await Promise.all(uniqueUserIds.map(async (uid: string) => {
              const uSnap = await getDocs(query(collection(db, "users"), where("phone", "==", uid)));
              if (!uSnap.empty) {
                  const d = uSnap.docs[0].data();
                  namesMap[uid] = d.name || d.fullName || "Khách hàng";
              }
          }));
          setBuyerNamesMap(namesMap);
      } catch (error) { console.error("Lỗi đếm đơn:", error); }
  };

  fetchStatsAndCounts();
}, [userData, orderList, filterDate, filterLocation]);

  // --- CÁC HÀM XỬ LÝ KHÁC (GIỮ NGUYÊN) ---
  const handleChangePassword = async () => {
      if (!userData.phone) return;
      if (!oldPass || !newPass || !confirmPass) return openSnackbar({ text: "Nhập đủ thông tin", type: "warning" });
      if (newPass !== confirmPass) return openSnackbar({ text: "Mật khẩu không khớp", type: "error" });
      
      setPassLoading(true);
      try {
          const user = auth.currentUser;
          let isVerified = false;
          
          if (user && user.email && user.email !== "guest@campus.com") {
              try {
                  const credential = EmailAuthProvider.credential(user.email, oldPass);
                  await reauthenticateWithCredential(user, credential);
                  isVerified = true;
              } catch (authErr) {
                  console.warn("Firebase Auth verification failed, checking Firestore fallback", authErr);
              }
          }
          
          if (!isVerified) {
              if (userData.password && oldPass === userData.password) {
                  isVerified = true;
              } else if (!userData.password && oldPass === "123456") {
                  isVerified = true;
              }
          }
          
          if (!isVerified) {
              openSnackbar({ text: "Mật khẩu cũ không chính xác!", type: "error" });
              setPassLoading(false);
              return;
          }
          
          if (user && user.email && user.email !== "guest@campus.com") {
              try {
                  await updatePassword(user, newPass);
              } catch (authUpdateErr) {
                  console.error("Auth update error:", authUpdateErr);
              }
          }
          
          const targetDocId = userData.id || user?.uid || userData.phone;
          await updateDoc(doc(db, "shops", targetDocId), { password: newPass });
          
          openSnackbar({ text: "Đổi mật khẩu thành công!", type: "success" });
          setShowChangePassModal(false); setOldPass(""); setNewPass(""); setConfirmPass("");
      } catch (error) { 
          console.error("Lỗi hệ thống khi đổi mật khẩu:", error);
          openSnackbar({ text: "Lỗi hệ thống", type: "error" }); 
      } finally { setPassLoading(false); }
  };

  const handleSendFeedback = async () => {
      if (!userData.phone) return;
      if (!feedbackContent.trim()) return openSnackbar({ text: "Nhập nội dung", type: "warning" });
      setFeedbackLoading(true);
      // Sửa lại từ dòng try { ... } của hàm handleSendFeedback thành thế này:
  try {
    await addDoc(collection(db, "feedbacks"), { 
        userId: userData.phone || "unknown", userName: userData.shopName || userData.fullName || userData.name || "Chưa có tên", userPhone: userData.phone || "unknown", 
        role: "provider", 
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
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingAvatar(true);
      try {
          const filename = `shop_avatars/${userData.id || 'guest'}_${Date.now()}_${file.name}`;
          const storageRef = ref(storage, filename);
          const compressedFile = await compressImage(file);
          await uploadBytes(storageRef, compressedFile);
          const url = await getDownloadURL(storageRef);
          setEditAvatar(url);
          openSnackbar({ text: "Tải ảnh đại diện thành công!", type: "success" });
      } catch (error) {
          console.error("Lỗi khi tải ảnh đại diện:", error);
          openSnackbar({ text: "Lỗi tải ảnh lên. Vui lòng thử lại.", type: "error" });
      } finally {
          setUploadingAvatar(false);
      }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingCover(true);
      try {
          const filename = `shop_covers/${userData.id || 'guest'}_${Date.now()}_${file.name}`;
          const storageRef = ref(storage, filename);
          const compressedFile = await compressImage(file);
          await uploadBytes(storageRef, compressedFile);
          const url = await getDownloadURL(storageRef);
          setEditCover(url);
          openSnackbar({ text: "Tải ảnh bìa thành công!", type: "success" });
      } catch (error) {
          console.error("Lỗi khi tải ảnh bìa:", error);
          openSnackbar({ text: "Lỗi tải ảnh lên. Vui lòng thử lại.", type: "error" });
      } finally {
          setUploadingCover(false);
      }
  };

  const handleUpdateShopInfo = async () => {
      if (!editName.trim()) return openSnackbar({ text: "Tên Shop không được để trống", type: "warning" });
      setUpdatingInfo(true);
      try {
          const targetDocId = userData.id || userData.phone;
          await updateDoc(doc(db, "shops", targetDocId), { 
              name: editName, 
              shopName: editName,
              address: editAddress, 
              managerName: editManager, 
              fullName: editManager, 
              description: editDescription, 
              avatar: editAvatar, 
              cover: editCover 
          });
          openSnackbar({ text: "Cập nhật thành công!", type: "success" });
          setShowShopInfoModal(false);
          window.dispatchEvent(new Event("authStateChanged"));
      } catch (error) { 
          console.error("Lỗi cập nhật Shop:", error);
          openSnackbar({ text: "Lỗi cập nhật", type: "error" }); 
      } finally { 
          setUpdatingInfo(false); 
      }
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



  // --- GIAO DIỆN CHÍNH ---
  return (
    <Box className="animate-fade-in pb-10">
      {/* 0. NÚT QUAY LẠI */}
      {onBackToProfile && (
        <Box 
          className="px-4 flex items-center cursor-pointer active:opacity-70" 
          onClick={onBackToProfile}
          style={{ paddingTop: "calc(var(--zaui-safe-area-inset-top, 24px) + 8px)" }}
        >
          <Icon icon="zi-arrow-left" className="text-gray-800 text-2xl mr-2" />
          <Text.Title size="large" className="font-bold text-gray-800">Quản lý Cửa Hàng</Text.Title>
        </Box>
      )}

      {/* 1. HEADER THÔNG TIN SHOP */}
      <Box 
        className="bg-white p-4 m-4 rounded-xl flex items-center shadow-md border border-gray-100 relative overflow-hidden active:opacity-80 cursor-pointer"
        onClick={() => setShowShopInfoModal(true)}
      >
        <Avatar src={getValidAvatar(userData.avatar, userData.id)} size={64} className="border-2 border-blue-500 shadow" />
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
              {locations.length > 1 && (
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

          {/* VÍ ĐIỂM ĐẨY HÀNG VIP */}
          <Box 
              mt={3} p={3} 
              className="bg-purple-50 rounded-xl border border-purple-100 flex justify-between items-center cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => setShowVipModal(true)}
          >
              <Box flex alignItems="center">
                  <Box className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-2 shadow-md">
                      <CustomIcon icon="zi-star-solid" className="text-purple-600" size={16}/>
                  </Box>
                  <Text size="small" className="text-gray-700 font-medium">Ví điểm đẩy hàng VIP:</Text>
              </Box>
              <Box flex alignItems="center">
                  <Text bold size="normal" className="text-purple-600 mr-2">{shopVipPoints.toLocaleString()} điểm</Text>
                  <CustomIcon icon="zi-chevron-right" className="text-purple-400" size={16}/>
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
                  <Item 
                    title="Đăng Sản phẩm/Dịch vụ mới" 
                    prefix={<div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-50"><Icon icon="zi-plus-circle" className="text-green-600" size={18}/></div>} 
                    suffix={<Icon icon="zi-chevron-right" className="text-gray-400"/>} 
                    onClick={() => {
                      if (userData.status === 'reviewing') {
                        openSnackbar({ text: "Cửa hàng của bạn đang được Admin xét duyệt. Vui lòng quay lại sau!", type: "warning" });
                      } else if (userData.status !== 'active') {
                        setShowShopRegistrationModal(true);
                      } else {
                        navigate("/post-service");
                      }
                    }} 
                  />
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

      {/* MODAL VÍ ĐIỂM ĐẨY HÀNG VIP */}
      <Modal 
        visible={showVipModal} 
        title="Ví Điểm Đẩy Hàng VIP" 
        onClose={() => { setShowVipModal(false); setPointsToBuy(""); setVipActiveTab("buy"); }}
        actions={[{ text: "Đóng", onClick: () => { setShowVipModal(false); setPointsToBuy(""); setVipActiveTab("buy"); } }]}
      >
        <Box p={4} className="hide-scroll overflow-y-auto" style={{ maxHeight: '75vh' }}>
          <Box className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-xl text-white shadow-md text-center mb-4 shrink-0">
            <Text size="small" className="opacity-90">Số dư hiện tại</Text>
            <Text bold size="xLarge" className="mt-1">{shopVipPoints.toLocaleString()} điểm</Text>
            <Text size="xxxxSmall" className="opacity-75 mt-2 block">* Mỗi lượt đăng sản phẩm mới sẽ trừ 1 điểm VIP</Text>
          </Box>

          {/* TAB BAR */}
          <Box flex className="mb-4 border-b border-gray-200 shrink-0">
            <Box 
              className={`flex-1 text-center py-2 border-b-2 text-xs font-bold cursor-pointer transition-colors ${vipActiveTab === "buy" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500"}`} 
              onClick={() => setVipActiveTab("buy")}
            >
              Nạp điểm
            </Box>
            <Box 
              className={`flex-1 text-center py-2 border-b-2 text-xs font-bold cursor-pointer transition-colors ${vipActiveTab === "pending" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500"}`} 
              onClick={() => setVipActiveTab("pending")}
            >
              Chờ duyệt ({myVipRequests.filter(r => r.status === "pending").length})
            </Box>
            <Box 
              className={`flex-1 text-center py-2 border-b-2 text-xs font-bold cursor-pointer transition-colors ${vipActiveTab === "history" ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500"}`} 
              onClick={() => setVipActiveTab("history")}
            >
              Lịch sử nạp ({myVipRequests.filter(r => r.status !== "pending").length})
            </Box>
          </Box>

          {/* TAB CONTENTS */}
          {vipActiveTab === "buy" && (
            <Box className="animate-fade-in-down">
              <Box className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                <Text size="xxSmall" className="text-yellow-800 leading-relaxed font-semibold">
                  💡 Quy định nạp điểm VIP:
                  <br />• Tỷ lệ chuyển đổi: 1.000đ = 1 điểm.
                  <br />• Điền số điểm muốn mua bên dưới để tạo mã thanh toán chuyển khoản QR tự động.
                  <br />• Sau khi chuyển khoản, Admin sẽ duyệt và điểm được cộng trực tiếp vào ví của bạn.
                </Text>
              </Box>

              <Box mb={4}>
                <Input 
                  type="number" 
                  label="Số điểm muốn mua" 
                  placeholder="Ví dụ: 100" 
                  value={pointsToBuy} 
                  onChange={(e) => setPointsToBuy(e.target.value)} 
                  clearable
                />
              </Box>

              {Number(pointsToBuy) > 0 && (
                <Box className="flex flex-col border border-gray-100 rounded-xl p-4 bg-gray-50 mb-2 text-left">
                  <Text bold size="small" className="text-gray-700 mb-1 text-center">Thông tin thanh toán:</Text>
                  <Text size="xSmall" className="text-gray-500 mb-3 text-center">Số tiền: <span className="text-[#14502e] font-bold text-sm">{(Number(pointsToBuy) * 1000).toLocaleString('vi-VN')} đ</span></Text>
                  
                  {adminBankInfoText && (
                    <Text size="xSmall" className="text-gray-700 whitespace-pre-line leading-relaxed mb-3">
                        {adminBankInfoText}
                    </Text>
                  )}

                  <Box className="bg-white p-2 rounded-xl shadow-md border mb-3 flex items-center justify-center self-center">
                    <img 
                      src={adminBankQrLink || `https://img.vietqr.io/image/MB-9999999999-compact.png?amount=${Number(pointsToBuy) * 1000}&addInfo=${encodeURIComponent(userData.phone + "need" + pointsToBuy)}&accountName=GREENBIZ%20ADMIN`} 
                      alt="QR Thanh toán" 
                      className="w-48 h-48 object-contain"
                    />
                  </Box>

                  <Box className="bg-purple-100/50 border border-purple-200 p-2.5 rounded-lg w-full text-center mb-4">
                    <Text size="xxxxSmall" className="text-gray-500 block mb-0.5 font-medium">
                      {adminBankQrLink ? "Nội dung chuyển khoản bắt buộc:" : "Nội dung chuyển khoản (Đã tích hợp trong QR):"}
                    </Text>
                    <Text size="xSmall" bold className="text-purple-700 tracking-wide select-all">
                      {userData.phone}need{pointsToBuy}
                    </Text>
                  </Box>

                  <Box className="w-full border-t border-gray-200 pt-4">
                    <Text bold size="small" className="text-gray-700 mb-2">Tải Biên lai chuyển tiền (Ảnh chụp giao dịch):</Text>
                    <Box className="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="vip-receipt-upload" 
                        className="hidden" 
                        onChange={handleUploadReceipt} 
                      />
                      <label htmlFor="vip-receipt-upload">
                        <Box 
                          className={`border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors ${receiptUrl ? 'bg-purple-50/50' : 'bg-white'}`}
                        >
                          {uploadingReceipt ? (
                            <Box className="flex flex-col items-center">
                              <Spinner />
                              <Text size="xSmall" className="text-gray-500 mt-2">Đang tải ảnh biên lai lên...</Text>
                            </Box>
                          ) : receiptUrl ? (
                            <Box className="w-full flex flex-col items-center">
                              <img src={receiptUrl} alt="Biên lai" className="w-32 h-32 object-cover rounded-lg border border-purple-200 shadow-sm mb-2" />
                              <Text size="xxxxSmall" className="text-purple-600 font-bold">Chạm để tải ảnh khác</Text>
                            </Box>
                          ) : (
                            <>
                              <Icon icon="zi-camera" className="text-gray-400 text-3xl mb-1"/>
                              <Text size="xxxxSmall" className="text-gray-500 font-medium">Nhấn để chụp hoặc chọn ảnh biên lai</Text>
                            </>
                          )}
                        </Box>
                      </label>
                    </Box>
                  </Box>

                  <Button 
                    fullWidth 
                    className="mt-4 bg-purple-600 active:bg-purple-700" 
                    loading={submittingVipRequest}
                    disabled={!receiptUrl || uploadingReceipt}
                    onClick={handleSubmitVipRequest}
                  >
                    Xác nhận chuyển tiền
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {vipActiveTab === "pending" && (
            <Box className="animate-fade-in-down">
              {myVipRequests.filter(r => r.status === "pending").length === 0 ? (
                <Text size="small" className="text-center text-gray-500 py-6 block">Không có đơn mua nào đang chờ duyệt.</Text>
              ) : (
                myVipRequests.filter(r => r.status === "pending").map((req) => (
                  <Box key={req.id} className="bg-white border border-gray-150 rounded-xl p-3.5 shadow-sm mb-3">
                    <Box flex justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Text bold size="small" className="text-purple-700">+{req.points?.toLocaleString()} điểm VIP</Text>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-200 bg-yellow-50 text-yellow-800">
                        Chờ duyệt
                      </span>
                    </Box>
                    {req.orderCode && (
                      <Text size="xxxxSmall" className="text-gray-500 block mb-1">Mã đơn: <span className="font-semibold text-gray-800 select-all">{req.orderCode}</span></Text>
                    )}
                    <Text size="xxxxSmall" className="text-gray-500 block mb-1">Số tiền: <span className="font-semibold text-gray-800">{(req.amount || 0).toLocaleString()}đ</span></Text>
                    <Text size="xxxxSmall" className="text-gray-500 block mb-2">Ngày gửi: {formatDate(req.createdAt)}</Text>
                    {req.receiptImage && (
                      <img src={req.receiptImage} alt="Biên lai" className="w-16 h-20 object-cover rounded-lg border border-gray-200 active:scale-150 transition-transform cursor-pointer" onClick={() => window.open(req.receiptImage, '_blank')} />
                    )}
                  </Box>
                ))
              )}
            </Box>
          )}

          {vipActiveTab === "history" && (
            <Box className="animate-fade-in-down">
              {myVipRequests.filter(r => r.status !== "pending").length === 0 ? (
                <Text size="small" className="text-center text-gray-500 py-6 block">Chưa có lịch sử giao dịch nạp điểm.</Text>
              ) : (
                myVipRequests.filter(r => r.status !== "pending").map((req) => {
                  const isApp = req.status === "approved";
                  return (
                    <Box key={req.id} className="bg-white border border-gray-150 rounded-xl p-3.5 shadow-sm mb-3">
                      <Box flex justifyContent="space-between" alignItems="center" mb={1.5}>
                        <Text bold size="small" className={isApp ? "text-green-600" : "text-red-500"}>
                          {isApp ? `+${req.points?.toLocaleString()} điểm VIP` : `${req.points?.toLocaleString()} điểm VIP`}
                        </Text>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isApp ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
                          {isApp ? 'Thành công' : 'Bị từ chối'}
                        </span>
                      </Box>
                      {req.orderCode && (
                        <Text size="xxxxSmall" className="text-gray-500 block mb-1">Mã đơn: <span className="font-semibold text-gray-800 select-all">{req.orderCode}</span></Text>
                      )}
                      {req.reason ? (
                        <Text size="xxxxSmall" className="text-gray-500 block mb-1">Giao dịch: <span className="font-semibold text-gray-800">{req.reason}</span></Text>
                      ) : (
                        <Text size="xxxxSmall" className="text-gray-500 block mb-1">Số tiền: <span className="font-semibold text-gray-800">{(req.amount || 0).toLocaleString()}đ</span></Text>
                      )}
                      <Text size="xxxxSmall" className="text-gray-500 block">Thời gian: {formatDate(req.createdAt)}</Text>
                      {!isApp && req.rejectedReason && (
                        <Text size="xxxxSmall" className="text-red-500 block mt-1.5 font-semibold">Lý do từ chối: {req.rejectedReason}</Text>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          )}
        </Box>
      </Modal>

      {/* MODAL THÔNG TIN SHOP & VÍ ĐIỂM */}
      <Modal visible={showShopInfoModal} title="Thông tin Shop" onClose={() => setShowShopInfoModal(false)}>
          <Box p={4} className="max-h-[85vh] overflow-y-auto hide-scroll">
              <Text.Title size="small" className="mb-3 text-gray-700">Ví điểm thưởng</Text.Title>
              <Box flex className="space-x-2 mb-4">
                  {/* TỔNG TÍCH LŨY */}
                  <Box 
                    className={`flex-1 p-2.5 rounded-xl border text-center cursor-pointer flex flex-col items-center justify-center transition-all ${
                      activeShopTab === 'rank' 
                        ? 'border-yellow-400 bg-yellow-50 text-yellow-600 font-semibold' 
                        : 'border-gray-200 bg-white text-gray-500'
                    }`}
                    onClick={() => setActiveShopTab('rank')}
                  >
                      <CustomIcon icon="zi-poll-solid" className={activeShopTab === 'rank' ? 'text-yellow-600 mb-1' : 'text-gray-400 mb-1'} size={20}/>
                      <Text className="text-[10px] font-medium leading-none">Ví Hạng</Text>
                      <Text size="normal" bold className={`mt-1 ${activeShopTab === 'rank' ? 'text-yellow-700' : 'text-gray-800'}`}>{(userData.rankPoints || 0).toLocaleString()}</Text>
                  </Box>
 
                  {/* VÍ ƯU ĐÃI SHOP */}
                  <Box 
                    className={`flex-1 p-2.5 rounded-xl border text-center cursor-pointer flex flex-col items-center justify-center transition-all ${
                      activeShopTab === 'promo' 
                        ? 'border-blue-400 bg-blue-50 text-blue-600 font-semibold' 
                        : 'border-gray-200 bg-white text-gray-500'
                    }`}
                    onClick={() => setActiveShopTab('promo')}
                  >
                      <CustomIcon icon="zi-star-solid" className={activeShopTab === 'promo' ? 'text-blue-600 mb-1' : 'text-gray-400 mb-1'} size={20}/>
                      <Text className="text-[10px] font-medium leading-none">Ví Ưu Đãi</Text>
                      <Text size="normal" bold className={`mt-1 ${activeShopTab === 'promo' ? 'text-blue-700' : 'text-gray-800'}`}>{(userData.spendingPoints || 0).toLocaleString()}</Text>
                  </Box>
                  
                  {/* VÍ TƯƠNG TÁC SHOP */}
                  <Box 
                    className={`flex-1 p-2.5 rounded-xl border text-center cursor-pointer flex flex-col items-center justify-center transition-all ${
                      activeShopTab === 'interaction' 
                        ? 'border-[#288F4E] bg-[#288F4E]/10 text-[#288F4E] font-semibold' 
                        : 'border-gray-200 bg-white text-gray-500'
                    }`}
                    onClick={() => setActiveShopTab('interaction')}
                  >
                      <CustomIcon icon="zi-chat-solid" className={activeShopTab === 'interaction' ? 'text-[#288F4E] mb-1' : 'text-gray-400 mb-1'} size={20}/>
                      <Text className="text-[10px] font-medium leading-none">Ví Tương Tác</Text>
                      <Text size="normal" bold className={`mt-1 ${activeShopTab === 'interaction' ? 'text-green-800' : 'text-gray-800'}`}>{(userData.interactionPoints || 0).toLocaleString()}</Text>
                  </Box>
              </Box>

              {/* Card Content for activeShopTab */}
              {activeShopTab === 'rank' && (
                <Box className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl p-4 text-white shadow-sm relative overflow-hidden mb-5">
                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-4">
                    <Box className="cursor-pointer active:opacity-75" onClick={handleShowRankDetail}>
                      <Text size="xxSmall" className="opacity-80 uppercase tracking-wider">Hạng Cửa Hàng</Text>
                      <Box flex alignItems="center" className="mt-1">
                        <CustomIcon icon={shopRankInfo.icon as any} size={16} className="mr-1 text-yellow-300" />
                        <Text bold size="normal" className="text-white">{shopRankInfo.name}</Text>
                      </Box>
                    </Box>
                    <Box className="text-right">
                      <Text size="xxSmall" className="opacity-80">Điểm Tích Lũy</Text>
                      <Text bold size="large" className="text-white mt-1 block">{(userData.rankPoints || 0).toLocaleString()}</Text>
                    </Box>
                  </Box>
                  
                  {shopRankInfo.target > 0 ? (
                    <Box className="mb-3">
                      <Box className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <Box className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, ((userData.rankPoints || 0) / shopRankInfo.target) * 100)}%` }} />
                      </Box>
                      <Box flex justifyContent="space-between" className="mt-1 opacity-80 text-[9px]">
                        <span>0</span>
                        <span>Mục tiêu: {shopRankInfo.target} điểm</span>
                      </Box>
                    </Box>
                  ) : (
                    <Text size="xxSmall" className="text-yellow-200 font-bold block mb-3">Đã đạt hạng cao nhất</Text>
                  )}

                  <Box flex justifyContent="space-between" alignItems="center" className="border-t border-white/20 pt-2.5 mt-1">
                    <Text size="xxxxSmall" className="italic opacity-85">* Điểm dùng để xếp hạng cửa hàng trên hệ thống.</Text>
                    <Box 
                      flex 
                      alignItems="center" 
                      className="cursor-pointer active:opacity-75 text-[10px] font-bold bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10"
                      onClick={handleShowRankDetail}
                    >
                      <Icon icon="zi-poll" className="mr-1" size={10} />
                      <span>Xem tiến trình</span>
                    </Box>
                  </Box>
                </Box>
              )}

              {activeShopTab === 'promo' && (
                <Box className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white shadow-sm relative overflow-hidden mb-5">
                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-4">
                    <Box>
                      <Text size="xxSmall" className="opacity-80 uppercase tracking-wider">Ưu Đãi Cửa Hàng</Text>
                      <Box flex alignItems="center" className="mt-1">
                        <Icon icon="zi-star" size={16} className="mr-1 text-blue-200" />
                        <Text bold size="normal" className="text-white">Ví Ưu Đãi</Text>
                      </Box>
                    </Box>
                    <Box className="text-right">
                      <Text size="xxSmall" className="opacity-80">Số Dư Hiện Tại</Text>
                      <Text bold size="large" className="text-white mt-1 block">{(userData.spendingPoints || 0).toLocaleString()}</Text>
                    </Box>
                  </Box>

                  <Box flex justifyContent="flex-end" alignItems="center" className="border-t border-white/20 pt-2.5 mt-4">
                    <Box flex className="gap-2">
                        <Box 
                          flex 
                          alignItems="center" 
                          className="cursor-pointer active:opacity-75 text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2.5 py-1 rounded-full shadow-sm"
                          onClick={handleConvertPromoToVip}
                        >
                          <Icon icon={"zi-sync" as any} className="mr-1" size={12} />
                          <span>Đổi điểm VIP</span>
                        </Box>
                        <Box 
                          flex 
                          alignItems="center" 
                          className="cursor-pointer active:opacity-75 text-[10px] font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
                          onClick={() => handleOpenShopWalletHistory('promo')}
                        >
                          <Icon icon={"zi-clock" as any} className="mr-1" size={10} />
                          <span>Xem lịch sử</span>
                        </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              {activeShopTab === 'interaction' && (
                <Box className="bg-gradient-to-br from-[#14502e] to-[#288F4E] rounded-2xl p-4 text-white shadow-sm relative overflow-hidden mb-5">
                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-4">
                    <Box>
                      <Text size="xxSmall" className="opacity-80 uppercase tracking-wider">Tích Lũy Tương Tác</Text>
                      <Box flex alignItems="center" className="mt-1">
                        <Icon icon="zi-chat" size={16} className="mr-1 text-emerald-200" />
                        <Text bold size="normal" className="text-white">Ví Tương Tác</Text>
                      </Box>
                    </Box>
                    <Box className="text-right flex space-x-3 items-center">
                      <Box>
                        <Text size="xxxxSmall" className="opacity-75 block text-right">Tổng điểm</Text>
                        <Text bold size="normal" className="text-white mt-0.5 block text-right">{(userData.interactionPoints || 0).toLocaleString()}</Text>
                      </Box>
                      <Box className="border-l border-white/20 pl-3">
                        <Text size="xxxxSmall" className="opacity-90 block text-right font-bold text-yellow-300">{"Khả dụng (>48h)"}</Text>
                        <Text bold size="normal" className="text-yellow-300 mt-0.5 block text-right">{eligiblePoints.toLocaleString()}</Text>
                      </Box>
                    </Box>
                  </Box>

                  <Box flex justifyContent="flex-end" alignItems="center" className="border-t border-white/20 pt-2.5 mt-4">
                    <Box flex className="gap-2">
                        <Box 
                          flex 
                          alignItems="center" 
                          className="cursor-pointer active:opacity-75 text-[10px] font-bold bg-yellow-400 text-yellow-900 px-2.5 py-1 rounded-full shadow-sm"
                          onClick={handleConvertInteractionToVip}
                        >
                          <Icon icon={"zi-sync" as any} className="mr-1" size={12} />
                          <span>Đổi điểm VIP</span>
                        </Box>
                        <Box 
                          flex 
                          alignItems="center" 
                          className="cursor-pointer active:opacity-75 text-[10px] font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
                          onClick={() => handleOpenShopWalletHistory('interaction')}
                        >
                          <Icon icon={"zi-clock" as any} className="mr-1" size={10} />
                          <span>Xem lịch sử</span>
                        </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              <div className="h-[1px] bg-gray-200 w-full mb-4"></div>

              <Text.Title size="small" className="mb-3 text-gray-700">Cập nhật thông tin</Text.Title>
              <Box mb={4}><Input label="Tên Shop" value={editName} onChange={(e) => setEditName(e.target.value)} clearable /></Box>
              <Box mb={4}><Input label="Địa chỉ Shop" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} clearable /></Box>
              <Box mb={4}><Input label="Tên người quản lý" value={editManager} onChange={(e) => setEditManager(e.target.value)} clearable placeholder="VD: Nguyễn Văn A" /></Box>
              <Box mb={4}>
                  <TextArea label="Giới thiệu Shop" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Nhập lời giới thiệu ngắn về cửa hàng của bạn..." rows={3} />
              </Box>
              <Box mb={4} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <Text size="small" bold className="text-gray-700 mb-2">Ảnh đại diện (Avatar)</Text>
                  <Box flex alignItems="center" style={{ gap: '16px' }}>
                      {editAvatar ? (
                          <img src={editAvatar} className="w-16 h-16 rounded-full border border-gray-200 object-cover shadow-sm bg-white" alt="Avatar preview" />
                      ) : (
                          <div className="w-16 h-16 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 bg-white">
                              <Icon icon="zi-plus" />
                          </div>
                      )}
                      <Box className="flex-1">
                          <input 
                              type="file" 
                              accept="image/*" 
                              id="shop-avatar-upload" 
                              style={{ display: "none" }} 
                              onChange={handleUploadAvatar} 
                          />
                          <Button 
                              size="small" 
                              variant="secondary" 
                              loading={uploadingAvatar}
                              onClick={() => document.getElementById("shop-avatar-upload")?.click()}
                              prefixIcon={<Icon icon="zi-camera" />}
                          >
                              Tải ảnh Avatar
                          </Button>
                          <Text size="xxxxSmall" className="text-gray-500 mt-1">Gợi ý tỉ lệ: 1:1 (ảnh vuông)</Text>
                      </Box>
                  </Box>
              </Box>
              
              <Box mb={4} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <Text size="small" bold className="text-gray-700 mb-2">Ảnh bìa (Banner)</Text>
                  <Box flex flexDirection="column" style={{ gap: '12px' }}>
                      {editCover ? (
                          <img src={editCover} className="w-full h-24 rounded-lg border border-gray-200 object-cover shadow-sm bg-white" alt="Cover preview" />
                      ) : (
                          <div className="w-full h-24 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 bg-white">
                              <Text size="xSmall" className="text-gray-400">Chưa có ảnh bìa</Text>
                          </div>
                      )}
                      <Box flex alignItems="center" justifyContent="space-between">
                          <input 
                              type="file" 
                              accept="image/*" 
                              id="shop-cover-upload" 
                              style={{ display: "none" }} 
                              onChange={handleUploadCover} 
                          />
                          <Button 
                              size="small" 
                              variant="secondary" 
                              loading={uploadingCover}
                              onClick={() => document.getElementById("shop-cover-upload")?.click()}
                              prefixIcon={<Icon icon="zi-camera" />}
                          >
                              Tải ảnh bìa
                          </Button>
                          <Text size="xxxxSmall" className="text-gray-500">Gợi ý tỉ lệ: 16:9 hoặc 3:1</Text>
                      </Box>
                  </Box>
              </Box>
              <Button fullWidth loading={updatingInfo} onClick={handleUpdateShopInfo}>Lưu thay đổi</Button>
          </Box>
      </Modal>

      {/* 👉 MODAL CHI TIẾT RANK (MỚI) */}
      <Modal 
        visible={showRankDetailModal} 
        title="Tiến trình lên hạng" 
        onClose={() => setShowRankDetailModal(false)} 
        actions={[{ text: "Đóng", onClick: () => setShowRankDetailModal(false) }]}
      >
          <Box p={4} flex flexDirection="column" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              <Box flex flexDirection="column" alignItems="center" className="mb-4">
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

              <div className="h-[1px] bg-gray-100 w-full my-4"></div>

              <Box className="w-full">
                  <Text.Title size="small" className="mb-3 text-gray-700 font-bold">Lịch sử tích lũy</Text.Title>
                  {rankHistoryLoading ? (
                      <Box flex justifyContent="center" py={4}><Spinner /></Box>
                  ) : rankHistoryList.length > 0 ? (
                      <Box className="flex flex-col gap-3">
                          {rankHistoryList.map((item, idx) => (
                              <Box key={idx} className="pb-3 border-b border-gray-100 last:border-0 flex justify-between items-center">
                                  <Box className="flex-1 pr-2">
                                      <Text size="small" className="font-semibold text-gray-800">{item.description || "Tích điểm lên hạng"}</Text>
                                      <Text size="xxSmall" className="text-gray-400 mt-0.5 block">{formatDate(item.createdAt)}</Text>
                                  </Box>
                                  <Text size="small" className="text-green-600 font-bold flex-shrink-0">+{item.amount?.toLocaleString()} điểm</Text>
                              </Box>
                          ))}
                      </Box>
                  ) : (
                      <Box flex flexDirection="column" alignItems="center" py={4} className="text-center">
                          <CustomIcon icon="zi-clock-2" className="text-gray-300 mb-2" size={32}/>
                          <Text size="small" className="text-gray-400 italic">Chưa có lịch sử tích lũy điểm nào.</Text>
                      </Box>
                  )}
              </Box>
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

      {/* MODAL LỊCH SỬ VÍ SHOP (ƯU ĐÃI & TƯƠNG TÁC) */}
      <Modal 
        visible={showShopWalletHistoryModal} 
        title={
          shopActiveWalletTab === 'promo' 
            ? "Lịch sử Ví Ưu Đãi" 
            : shopActiveWalletTab === 'interaction' 
            ? "Lịch sử Ví Tương Tác" 
            : "Lịch sử Ví Hạng"
        } 
        onClose={() => setShowShopWalletHistoryModal(false)}
        actions={[{ text: "Đóng", onClick: () => setShowShopWalletHistoryModal(false) }]}
      >
          <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingShopWalletHistory ? (
                  <Box flex justifyContent="center"><Spinner /></Box>
              ) : shopWalletHistoryList.length > 0 ? (
                  <Box className="flex flex-col gap-3">
                      {shopWalletHistoryList.map((item, idx) => {
                          const isPlus = item.type === 'plus';
                          return (
                              <Box key={idx} className="pb-3 border-b border-gray-100 last:border-0 flex justify-between items-center">
                                  <Box className="flex-1 pr-2">
                                      <Text size="small" className="font-semibold text-gray-800">{item.description || item.reason || "Giao dịch điểm"}</Text>
                                      <Text size="xxSmall" className="text-gray-400 mt-0.5 block">{formatDate(item.createdAt)}</Text>
                                  </Box>
                                  <Text 
                                      size="small" 
                                      className={`font-bold flex-shrink-0 ${isPlus ? "text-[#288F4E]" : "text-red-550"}`}
                                  >
                                      {isPlus ? "+" : "-"}{item.amount?.toLocaleString()} điểm
                                  </Text>
                              </Box>
                          );
                      })}
                  </Box>
              ) : (
                  <Box flex flexDirection="column" alignItems="center" py={4} className="text-center">
                      <CustomIcon icon="zi-clock-2" className="text-gray-300 mb-2" size={40}/>
                      <Text size="small" className="text-gray-400 italic">Chưa có lịch sử giao dịch nào.</Text>
                  </Box>
              )}
          </Box>
      </Modal>

      {/* CÁC MODAL KHÁC GIỮ NGUYÊN */}
      <Modal visible={showReferralModal} title="Khách hàng giới thiệu" onClose={() => setShowReferralModal(false)} actions={[{ text: "Đóng", onClick: () => setShowReferralModal(false) }]}>
          <Box p={4} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {referralLoading ? <Box flex justifyContent="center"><Spinner /></Box> : referralList.length > 0 ? <Box><Box className="bg-blue-50 p-2 rounded-lg text-center mb-4 border border-blue-100"><Text bold className="text-blue-600">Tổng cộng: {referralList.length} thành viên</Text></Box>{referralList.map((cus, idx) => (<Box key={idx} flex alignItems="center" justifyContent="space-between" className="mb-3 pb-3 border-b border-gray-100 last:border-0"><Box flex alignItems="center"><Avatar src={getValidAvatar(cus.avatar, cus.id)} size={40} className="border" /><Box ml={3}><Text size="small" bold>{cus.fullName || cus.name || "Thành viên"}</Text><Text size="xxSmall" className="text-gray-500">{cus.phone}</Text></Box></Box><Box>{cus.referredType === "shop" ? (<span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-600 border border-orange-200">Shop</span>) : (<span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-600 border border-blue-200">Khách</span>)}</Box></Box>))}</Box> : <Text className="text-center text-gray-400 mt-10 p-4 bg-gray-50 rounded italic">Chưa giới thiệu được thành viên nào.</Text>}
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
                          ) : (
                              (() => {
                                  let filtered = feedbackList;
                                  if (feedbackTab === 'new') filtered = feedbackList.filter(fb => fb.status !== 'done');
                                  else filtered = feedbackList.filter(fb => fb.status === 'done').filter(fb => isWithin15Days(fb.createdAt));
                                  
                                  if (filtered.length === 0) return (
                                      <Box flex flexDirection="column" alignItems="center" py={5}>
                                          <CustomIcon icon="zi-chat" size={40} className="text-gray-300 mb-2"/>
                                          <Text className="text-center text-gray-500">Bạn chưa có yêu cầu nào trong 15 ngày qua.</Text>
                                      </Box>
                                  );
                                  
                                  return filtered.map((fb, idx) => {
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
                                  )});
                              })()
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
      <Modal 
          visible={showOrdersModal} 
          title="Quản lý đơn hàng" 
          onClose={() => setShowOrdersModal(false)}
          modalClassName="order-management-modal"
      >
          <Box className="bg-gray-50 flex flex-col flex-1" style={{ height: '100%' }}>
              {/* THANH TAB CHUYỂN ĐỔI */}
              <Box flex className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0">
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="pending"?"border-orange-500 text-orange-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("pending")}>
                      Mới ({orderList.filter(o=>o.status==='pending').length})
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="confirmed"?"border-blue-500 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("confirmed")}>
                      Chờ vận chuyển ({orderList.filter(o=>o.status==='confirmed' || o.status==='shipping').length})
                  </Box>
                  <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="history"?"border-gray-500 text-gray-800 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("history")}>
                      Lịch sử ({orderList.filter(o => o.status === 'completed' || o.status === 'success' || o.status === 'cancelled').length})
                  </Box>
              </Box>

              <Box p={3} className="flex-1 overflow-y-auto hide-scroll">
                  {loadingOrders ? ( <Box flex justifyContent="center" py={5}><Spinner /></Box> ) : (
                      (() => {
                          let filtered = orderList;
                          if (orderTab === 'pending') filtered = filtered.filter(o => o.status === 'pending');
                          else if (orderTab === 'confirmed') filtered = filtered.filter(o => o.status === 'confirmed' || o.status === 'shipping');
                          else filtered = filtered.filter(o => o.status === 'completed' || o.status === 'success' || o.status === 'cancelled');

                          if (filtered.length === 0) return (<Box flex flexDirection="column" alignItems="center" py={8}><CustomIcon icon="zi-note" size={40} className="text-gray-300 mb-2"/><Text className="text-center text-gray-500">Trống.</Text></Box>);

                          return filtered.map((order, idx) => {
                              const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                              const originalAmount = Number(order.originalAmount || total);
                              const discountAmount = Number(order.discountAmount || 0);
                              const recipientName = order.recipientName || order.receiverName || order.userName || "Chưa rõ";
                              const recipientPhone = order.recipientPhone || order.receiverPhone || order.userId || "Chưa rõ";
                              const deliveryAddress = order.address || order.deliveryAddress || "Chưa rõ";

                              return (
                                  <Box 
                                      key={idx} 
                                      onClick={() => setSelectedOrderDetail(order)}
                                      className="bg-white p-3 rounded-xl mb-3 border border-gray-200 shadow-md animate-fade-in-up active:scale-[0.98] active:bg-gray-50 transition-all cursor-pointer"
                                  >
                                      <Box flex justifyContent="space-between" alignItems="center" className="border-b border-gray-100 pb-2 mb-2">
                                          <Text size="small" bold className="text-blue-600">#{order.orderCode || order.id.slice(0, 8).toUpperCase()}</Text>
                                          <Box flex alignItems="center" className="space-x-2">
                                              <span className="text-[10px] text-blue-500 hover:text-blue-700 underline font-medium cursor-pointer mr-1">
                                                  Xem chi tiết
                                              </span>
                                              <Text size="xSmall" bold className={order.status === 'pending' ? 'text-orange-500' : order.status === 'cancelled' ? 'text-red-500' : 'text-green-500'}>
                                                  {order.status === 'pending' ? 'Mới' : order.status === 'confirmed' ? 'Đã chốt' : order.status === 'cancelled' ? 'Đã hủy' : 'Hoàn thành'}
                                              </Text>
                                          </Box>
                                      </Box>
                                      {/* 👉 THÊM MỚI: HIỂN THỊ LÝ DO HỦY ĐƠN */}
                                      {order.status === 'cancelled' && order.cancelReason && (
                                          <Box className="mb-2">
                                              <Text size="xSmall" className="text-red-600 bg-red-50 p-2 rounded border border-red-100 italic">
                                                  Lý do hủy: {order.cancelReason}
                                              </Text>
                                          </Box>
                                      )}

                                      {/* Thông tin khách đặt */}
                                      <Box className="bg-blue-50/30 p-2 rounded-lg border border-blue-100/30 mb-2.5 text-xs space-y-0.5">
                                          <p><strong className="text-gray-700">Khách đặt:</strong> {recipientName} ({recipientPhone})</p>
                                          <p className="line-clamp-1"><strong className="text-gray-700">Địa chỉ:</strong> {deliveryAddress}</p>
                                      </Box>

                                      {/* 👉 BỔ SUNG: HIỂN THỊ CHI TIẾT SẢN PHẨM & PHÂN LOẠI CHO CHỦ SHOP */}
                                      {(order.items || order.cartItems) && (order.items || order.cartItems).length > 0 ? (
                                          // Trường hợp 1: Khách mua từ Giỏ hàng (Nhiều món)
                                          <Box className="mb-2 bg-gray-50/50 p-2 rounded border border-gray-100 space-y-2">
                                              {(order.items || order.cartItems).map((item: any, i: number) => {
                                                  const imgUrl = item.product?.image || item.product?.images?.[0] || "";
                                                  return (
                                                      <Box key={i} flex className="items-start space-x-2 py-1 first:pt-0 last:pb-0 border-b border-dashed border-gray-100 last:border-none">
                                                          <Box className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                                              {imgUrl ? (
                                                                  <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                                                              ) : (
                                                                  <Icon icon={"zi-image" as any} size={16} className="text-gray-400" />
                                                              )}
                                                          </Box>
                                                          <Box className="flex-1 min-w-0">
                                                              <Text size="xSmall" bold className="text-gray-800 line-clamp-1">
                                                                  <span className="text-blue-600 mr-1">x{item.quantity}</span> 
                                                                  {item.product?.title || item.product?.name || item.name}
                                                              </Text>
                                                              {item.options && Object.keys(item.options).length > 0 && (
                                                                  <Text size="xxxxSmall" className="text-gray-500 italic mt-0.5">
                                                                      {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                                  </Text>
                                                              )}
                                                          </Box>
                                                      </Box>
                                                  );
                                              })}
                                          </Box>
                                      ) : (
                                          // Trường hợp 2: Khách Mua ngay 1 món hoặc Đặt lịch Dịch vụ
                                          (() => {
                                              const singleImg = order.productImage || order.product?.image || order.product?.images?.[0] || "";
                                              return (
                                                  <Box flex className="items-start space-x-2 mb-2 bg-gray-50/50 p-2 rounded border border-gray-100">
                                                      <Box className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                                          {singleImg ? (
                                                              <img src={singleImg} className="w-full h-full object-cover" alt="" />
                                                          ) : (
                                                              <Icon icon={"zi-image" as any} size={16} className="text-gray-400" />
                                                          )}
                                                      </Box>
                                                      <Box className="flex-1 min-w-0">
                                                          <Text size="xSmall" bold className="text-gray-800 line-clamp-1">{order.productName}</Text>
                                                          {order.selectedVariants && Object.keys(order.selectedVariants).length > 0 ? (
                                                              <Text size="xxxxSmall" className="text-gray-500 italic mt-0.5 font-medium">
                                                                  {Object.entries(order.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                              </Text>
                                                          ) : (order.bookingTime || order.bookingDate) ? (
                                                              <Text size="xxxxSmall" className="text-gray-500 mt-0.5">⏰ Lịch: {order.bookingTime} {order.bookingDate}</Text>
                                                          ) : null}
                                                      </Box>
                                                  </Box>
                                              );
                                          })()
                                      )}

                                      <Box flex justifyContent="space-between" alignItems="center" pt={2} className="border-t border-gray-100">
                                          <Box flex flexDirection="column" alignItems="flex-start">
                                              {discountAmount > 0 && (<Text size="xxxxSmall" className="text-green-600 mb-0.5">Voucher: -{discountAmount.toLocaleString()}đ</Text>)}
                                              <Box flex alignItems="baseline">
                                                  <Text size="xxxxSmall" className="text-gray-500 mr-1.5">Tổng thu:</Text>
                                                  <Text bold size="small" className="text-red-600">{total.toLocaleString()}đ</Text>
                                              </Box>
                                          </Box>
                                          {order.status === 'pending' ? (
                                              <Button 
                                                  size="small" 
                                                  onClick={async (e) => { 
                                                      e.stopPropagation(); 
                                                      await handleUpdateOrderStatus(order.id, "confirmed"); 
                                                  }}
                                                  className="bg-[#14502e] text-white flex items-center space-x-1 h-7 px-3 rounded-lg border-none"
                                              >
                                                  <CustomIcon icon="zi-check-circle" size={12} />
                                                  <span className="text-[11px]">Duyệt nhanh</span>
                                              </Button>
                                          ) : (order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipping') ? (
                                              <Button 
                                                  size="small" 
                                                  onClick={async (e) => { 
                                                      e.stopPropagation(); 
                                                      await handleUpdateOrderStatus(order.id, "completed"); 
                                                  }}
                                                  className="bg-blue-600 text-white flex items-center space-x-1 h-7 px-3 rounded-lg border-none"
                                              >
                                                  <CustomIcon icon="zi-check" size={12} />
                                                  <span className="text-[11px]">Giao xong</span>
                                              </Button>
                                          ) : null}
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

      {/* 👉 MODAL CHI TIẾT ĐƠN HÀNG (MỚI) */}
      <Modal 
        visible={!!selectedOrderDetail} 
        title="Chi tiết đơn hàng" 
        onClose={() => {
          setSelectedOrderDetail(null);
          setShowOrderAccount(false);
          setShowCancelInput(false);
          setCancelReasonText("");
        }}
      >
        {selectedOrderDetail && (() => {
          const total = Number(selectedOrderDetail.totalAmount || selectedOrderDetail.totalPrice || selectedOrderDetail.total || 0);
          const originalAmount = Number(selectedOrderDetail.originalAmount || total);
          const discountAmount = Number(selectedOrderDetail.discountAmount || 0);
          const recipientName = selectedOrderDetail.recipientName || selectedOrderDetail.receiverName || selectedOrderDetail.userName || "Chưa rõ";
          const recipientPhone = selectedOrderDetail.recipientPhone || selectedOrderDetail.receiverPhone || selectedOrderDetail.userId || "Chưa rõ";
          const deliveryAddress = selectedOrderDetail.address || selectedOrderDetail.deliveryAddress || "Chưa rõ";
          const statusText = selectedOrderDetail.status === 'pending' 
            ? 'Mới (Chờ duyệt)' 
            : selectedOrderDetail.status === 'confirmed' || selectedOrderDetail.status === 'shipping'
              ? 'Chờ vận chuyển' 
              : selectedOrderDetail.status === 'cancelled' 
                ? 'Đã hủy' 
                : 'Đã hoàn thành';
          const statusColor = selectedOrderDetail.status === 'pending' 
            ? 'text-orange-500 bg-orange-50' 
            : selectedOrderDetail.status === 'confirmed' || selectedOrderDetail.status === 'shipping'
              ? 'text-blue-500 bg-blue-50' 
              : selectedOrderDetail.status === 'cancelled' 
                ? 'text-red-500 bg-red-50' 
                : 'text-green-500 bg-green-50';

          return (
            <Box p={4} className="hide-scroll" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Trạng thái đơn */}
              <Box className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                <Text size="large" bold className="text-gray-800">Mã đơn: #{selectedOrderDetail.orderCode || selectedOrderDetail.id.slice(0, 8).toUpperCase()}</Text>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}>
                  {statusText}
                </span>
              </Box>

              {/* Thông tin tài khoản đặt hàng */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm mb-4">
                <Box 
                  className={`flex justify-between items-center cursor-pointer ${showOrderAccount ? 'mb-2 border-b border-gray-100 pb-1' : ''}`}
                  onClick={() => setShowOrderAccount(!showOrderAccount)}
                >
                  <Text size="small" bold className="text-gray-800">
                    Tài khoản đặt hàng
                  </Text>
                  <Icon icon={showOrderAccount ? "zi-chevron-up" as any : "zi-chevron-down" as any} size={16} className="text-gray-400" />
                </Box>
                {showOrderAccount && (
                  <Box className="space-y-1.5 text-xs text-gray-600">
                    <p><strong className="text-gray-700">Tên tài khoản:</strong> {buyerNamesMap[selectedOrderDetail.userId || selectedOrderDetail.customerPhone || selectedOrderDetail.phone] || selectedOrderDetail.customerName || selectedOrderDetail.userName || selectedOrderDetail.fullName || "Khách hàng"}</p>
                    <p><strong className="text-gray-700">Số điện thoại:</strong> {selectedOrderDetail.userId || selectedOrderDetail.customerPhone || selectedOrderDetail.phone || "Không có"}</p>
                    <div 
                      className="text-blue-600 font-medium cursor-pointer inline-flex items-center mt-1 border border-blue-100 bg-blue-50 px-2 py-1 rounded"
                      onClick={() => navigate(`/profile?id=${selectedOrderDetail.userId || selectedOrderDetail.customerPhone || selectedOrderDetail.phone}`)}
                    >
                      <Icon icon="zi-user" size={12 as any} className="mr-1" /> Trang cá nhân
                    </div>
                  </Box>
                )}
              </Box>

              {/* Thông tin giao hàng */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm mb-4">
                <Text size="small" bold className="text-gray-800 mb-2 block border-b border-gray-100 pb-1">
                  Thông tin nhận hàng
                </Text>
                <Box className="space-y-1.5 text-xs text-gray-600">
                  <p><strong className="text-gray-700">Người nhận:</strong> {recipientName}</p>
                  <p><strong className="text-gray-700">Số điện thoại:</strong> {recipientPhone}</p>
                  <p><strong className="text-gray-700">Địa chỉ giao hàng:</strong> {deliveryAddress}</p>
                  {selectedOrderDetail.location?.name && (
                    <p><strong className="text-gray-700">Cơ sở:</strong> {selectedOrderDetail.location.name}</p>
                  )}
                  {selectedOrderDetail.note && (
                    <p className="bg-orange-50/50 p-1.5 rounded border border-orange-100/50 mt-1">
                      <strong className="text-orange-700">Ghi chú:</strong> {selectedOrderDetail.note}
                    </p>
                  )}
                </Box>
              </Box>

              {/* Danh sách sản phẩm */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm mb-4">
                <Text size="small" bold className="text-gray-800 mb-2 block border-b border-gray-100 pb-1">
                  Sản phẩm đặt mua
                </Text>
                {(() => {
                  const detailItems = selectedOrderDetail.items || selectedOrderDetail.cartItems;
                  return detailItems && detailItems.length > 0 ? (
                    <Box className="space-y-3">
                      {detailItems.map((item: any, i: number) => {
                        const imgUrl = item.product?.image || item.product?.images?.[0] || "";
                        return (
                          <Box key={i} flex className="items-start space-x-2 py-1.5 first:pt-0 last:pb-0 border-b border-dashed border-gray-100 last:border-none">
                            <Box className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                              {imgUrl ? (
                                <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <Icon icon={"zi-image" as any} size={16} className="text-gray-400" />
                              )}
                            </Box>
                            <Box className="flex-1 min-w-0">
                              <Text size="small" bold className="text-gray-800 line-clamp-1">
                                {item.product?.title || item.product?.name || item.name}
                              </Text>
                              {item.options && Object.keys(item.options).length > 0 && (
                                <p className="text-[10px] text-gray-500 italic mt-0.5">
                                  Phân loại: {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                </p>
                              )}
                              <Box flex justifyContent="space-between" className="mt-1">
                                <Text size="xSmall" className="text-gray-500">x{item.quantity}</Text>
                                <Text size="xSmall" bold className="text-gray-700">{(item.product?.price || 0).toLocaleString()}đ</Text>
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                  <Box className="py-1">
                    <Text size="small" bold className="text-gray-800">{selectedOrderDetail.productName}</Text>
                    {selectedOrderDetail.selectedVariants && Object.keys(selectedOrderDetail.selectedVariants).length > 0 && (
                      <p className="text-xs text-gray-500 italic mt-1">
                        Phân loại: {Object.entries(selectedOrderDetail.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                      </p>
                    )}
                    {selectedOrderDetail.bookingTime && (
                      <p className="text-xs text-gray-600 mt-1">⏰ Lịch hẹn: {selectedOrderDetail.bookingTime} {selectedOrderDetail.bookingDate}</p>
                    )}
                  </Box>
                ) })()}
              </Box>

              {/* Chi tiết thanh toán */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm mb-4 text-xs">
                <Box flex justifyContent="space-between" className="mb-1.5">
                  <Text className="text-gray-500">Tiền hàng gốc:</Text>
                  <Text className="text-gray-700">{originalAmount.toLocaleString()}đ</Text>
                </Box>
                {discountAmount > 0 && (
                  <Box flex justifyContent="space-between" className="mb-1.5 text-green-600">
                    <Text>Voucher giảm giá:</Text>
                    <Text>-{discountAmount.toLocaleString()}đ</Text>
                  </Box>
                )}
                <Box flex justifyContent="space-between" className="mb-1.5">
                  <Text className="text-gray-500">Phương thức thanh toán:</Text>
                  <Text bold className="text-gray-700">{selectedOrderDetail.paymentMethod || "Thanh toán khi nhận hàng (COD)"}</Text>
                </Box>
                <Box flex justifyContent="space-between" className="pt-2 border-t border-gray-100 items-center">
                  <Text bold className="text-gray-800 text-sm">Thực thu:</Text>
                  <Text bold className="text-red-600 text-base">{total.toLocaleString()}đ</Text>
                </Box>
              </Box>

              {/* Phần nhập lý do hủy đơn (nếu click nút Hủy) */}
              {showCancelInput && (
                <Box className="bg-red-50 p-3 rounded-xl border border-red-150 mb-4">
                  <Text size="xSmall" bold className="text-red-700 mb-1.5 block">Nhập lý do hủy đơn hàng:</Text>
                  <input 
                    type="text" 
                    placeholder="VD: Khách đổi ý, hết hàng..." 
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    className="w-full p-2 border border-red-200 rounded-lg text-xs mb-2.5 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                  />
                  <Box flex className="space-x-2">
                    <Button 
                      size="small" 
                      onClick={async () => {
                        if (!cancelReasonText.trim()) {
                          return openSnackbar({ text: "Vui lòng nhập lý do hủy!", type: "warning" });
                        }
                        try {
                          await updateDoc(doc(db, "orders", selectedOrderDetail.id), {
                            status: "cancelled",
                            cancelReason: cancelReasonText.trim()
                          });
                          setOrderList(prev => prev.map(o => o.id === selectedOrderDetail.id ? { ...o, status: "cancelled", cancelReason: cancelReasonText.trim() } : o));
                          openSnackbar({ text: "Đã hủy đơn hàng thành công!", type: "success" });
                          setSelectedOrderDetail(null);
                          setShowCancelInput(false);
                          setCancelReasonText("");
                        } catch (e) {
                          openSnackbar({ text: "Lỗi khi hủy đơn hàng", type: "error" });
                        }
                      }}
                      className="bg-red-600 text-white flex-1 rounded-lg text-xs"
                    >
                      Xác nhận hủy đơn
                    </Button>
                    <Button 
                      size="small" 
                      variant="secondary"
                      onClick={() => {
                        setShowCancelInput(false);
                        setCancelReasonText("");
                      }}
                      className="flex-1 rounded-lg text-xs"
                    >
                      Hủy bỏ
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Nút hành động chính */}
              {!showCancelInput && (
                <Box flex className="space-x-2 mt-4 shrink-0">
                  {selectedOrderDetail.status === 'pending' && (
                    <>
                      <Button 
                        className="bg-green-600 text-white flex-1 rounded-xl text-sm font-bold"
                        onClick={async () => {
                          try {
                            await handleUpdateOrderStatus(selectedOrderDetail.id, "confirmed");
                            setSelectedOrderDetail(null);
                          } catch (e) {}
                        }}
                      >
                        Duyệt đơn
                      </Button>
                      <Button 
                        variant="secondary"
                        className="border border-red-200 text-red-600 flex-1 rounded-xl text-sm font-bold bg-white"
                        onClick={() => setShowCancelInput(true)}
                      >
                        Hủy đơn
                      </Button>
                    </>
                  )}

                  {(selectedOrderDetail.status === 'confirmed' || selectedOrderDetail.status === 'shipping') && (
                    <>
                      <Button 
                        className="bg-green-600 text-white flex-1 rounded-xl text-sm font-bold"
                        onClick={async () => {
                          try {
                            await handleUpdateOrderStatus(selectedOrderDetail.id, "completed");
                            setSelectedOrderDetail(null);
                          } catch (e) {}
                        }}
                      >
                        Xác nhận đã giao hàng
                      </Button>
                      <Button 
                        variant="secondary"
                        className="border border-red-200 text-red-600 flex-1 rounded-xl text-sm font-bold bg-white"
                        onClick={() => setShowCancelInput(true)}
                      >
                        Hủy đơn
                      </Button>
                    </>
                  )}

                  {(selectedOrderDetail.status === 'completed' || selectedOrderDetail.status === 'cancelled') && (
                    <Button 
                      fullWidth 
                      variant="secondary" 
                      onClick={() => setSelectedOrderDetail(null)}
                      className="rounded-xl text-sm font-bold bg-gray-100"
                    >
                      Đóng chi tiết
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          );
        })()}
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
                              <Text size="small" bold className="text-blue-600">#{order.orderCode || order.id.slice(0,6).toUpperCase()}</Text>
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
                              <Box flex flexDirection="column" alignItems="flex-start">
                                  <Text size="xxxxSmall" className="text-gray-500 font-semibold mb-0.5">Thu khách:</Text>
                                  <Text size="normal" bold className="text-green-600">{total.toLocaleString()}đ</Text>
                              </Box>
                              <Button 
                                  size="small" 
                                  onClick={() => handleShareOrder(order)}
                                  className="bg-[#14502e] text-white flex items-center space-x-1 h-7 px-3 rounded-lg"
                              >
                                  <CustomIcon icon="zi-share" size={12} />
                                  <span className="text-[11px]">Chia sẻ Zalo</span>
                              </Button>
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
                              ) : feeTab === "paid" ? (
                                  // 👉 HIỂN THỊ THEO LẦN THANH TOÁN (NHÓM THEO NGÀY)
                                  (() => {
                                      const groupedPaidOrders = displayOrders.reduce((acc: any, order: any) => {
                                          const dateStr = order.feePaidAt?.toDate ? order.feePaidAt.toDate().toLocaleDateString('vi-VN') : "Không rõ ngày";
                                          if (!acc[dateStr]) acc[dateStr] = [];
                                          acc[dateStr].push(order);
                                          return acc;
                                      }, {});

                                      return Object.keys(groupedPaidOrders).map((date, idx) => {
                                          const ordersInBatch = groupedPaidOrders[date];
                                          const batchTotalFee = ordersInBatch.reduce((sum: number, o: any) => {
                                              const total = Number(o.totalAmount || o.totalPrice || o.total || 0);
                                              return sum + (o.platformFee !== undefined ? Number(o.platformFee) : Math.floor(total * 10 / 100));
                                          }, 0);

                                          return (
                                              <Box key={idx} className="mb-4 p-4 bg-white rounded-xl border border-green-200 shadow-sm">
                                                  <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2">
                                                      <Text bold className="text-gray-800">Thanh toán: {date}</Text>
                                                      <Text bold className="text-green-600">+{batchTotalFee.toLocaleString()}đ</Text>
                                                  </Box>
                                                  <Text size="xSmall" className="text-gray-500 mb-3">Đã đối soát {ordersInBatch.length} đơn hàng</Text>
                                                  
                                                  <Box className="space-y-2 max-h-40 overflow-y-auto hide-scroll">
                                                      {ordersInBatch.map((order: any) => {
                                                          const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                                                          const fee = order.platformFee !== undefined ? Number(order.platformFee) : Math.floor(total * 10 / 100);
                                                          return (
                                                              <Box key={order.id} flex justifyContent="space-between" className="bg-gray-50 p-2 rounded">
                                                                  <Box>
                                                                      <Text size="xxxxSmall" bold className="text-gray-700">#{order.orderCode || order.id?.slice(0,6).toUpperCase() || "UNK"}</Text>
                                                                      <Text size="xxxxSmall" className="text-gray-500 line-clamp-1">{order.productName}</Text>
                                                                  </Box>
                                                                  <Text size="xxxxSmall" className="text-green-600 font-medium">{fee.toLocaleString()}đ</Text>
                                                              </Box>
                                                          );
                                                      })}
                                                  </Box>
                                              </Box>
                                          );
                                      });
                                  })()
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
                                                  <Text size="small" bold className="text-gray-800">#{order.orderCode || order.id?.slice(0,6).toUpperCase() || "UNK"}</Text>
                                                  
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
                                              <Box flex flexDirection="column" alignItems="flex-start">
                                                  <Text size="xxxxSmall" className="text-gray-500">Phí ({order.platformFeeRate || 10}%):</Text>
                                                  <Text size="normal" bold className={feeTab === "unpaid" ? "text-red-500" : "text-green-600"}>
                                                      {fee.toLocaleString()}đ
                                                  </Text>
                                              </Box>
                                              <Button 
                                                  size="small" 
                                                  onClick={() => handleShareOrder(order)}
                                                  className="bg-[#14502e] text-white flex items-center space-x-1 h-7 px-3 rounded-lg border-none"
                                              >
                                                  <CustomIcon icon="zi-share" size={12} />
                                                  <span className="text-[11px]">Chia sẻ Zalo</span>
                                              </Button>
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

      {/* --- MODAL ĐĂNG KÝ/CẬP NHẬT SHOP CHO VIỆC PHÊ DUYỆT --- */}
      <Modal visible={showShopRegistrationModal} title="Đăng ký Thông tin Cửa hàng" onClose={() => setShowShopRegistrationModal(false)}>
        <Box p={4} className="bg-white rounded-xl shadow-md border-t-4 border-green-500 overflow-y-auto max-h-[80vh]">
          <Text size="small" className="text-gray-600 mb-4 text-center">Để đảm bảo quyền lợi và tính hợp pháp, Vui lòng cung cấp các thông tin sau để Ban Quản Trị phê duyệt tài khoản Shop của bạn.</Text>
          
          <Box mb={4}>
            <Input label="Tên Shop" value={regShopName} onChange={(e) => setRegShopName(e.target.value)} required />
          </Box>
          <Box mb={4}>
            <Input label="Tên người quản lý" value={regManagerName} onChange={(e) => setRegManagerName(e.target.value)} required />
          </Box>
          <Box mb={4}>
            <Input label="Số điện thoại người quản lý" type="number" value={regManagerPhone} onChange={(e) => setRegManagerPhone(e.target.value)} required />
          </Box>

          {/* Chọn Giấy ĐKKD */}
          <Box mb={4}>
            <Text size="small" bold className="text-gray-700 mb-2">Bạn có Giấy phép Đăng ký kinh doanh không?</Text>
            <Select 
              value={hasBusinessLicense} 
              onChange={(value) => setHasBusinessLicense(value as string)}
              closeOnSelect
            >
              <Option value="yes" title="Tôi CÓ Giấy ĐKKD" />
              <Option value="no" title="Tôi KHÔNG CÓ Giấy ĐKKD" />
            </Select>
          </Box>

          {hasBusinessLicense === "yes" && (
            <Box mb={4} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Text size="small" bold className="text-blue-800 mb-2">Ảnh chụp Giấy ĐKKD *</Text>
              {licenseImage ? (
                <Box className="relative mb-2 inline-block">
                  <img src={licenseImage} alt="Giấy ĐKKD" className="w-full h-32 object-cover rounded-lg border border-gray-300" />
                  <Box className="absolute top-1 right-1 bg-white rounded-full p-1 shadow cursor-pointer" onClick={() => setLicenseImage(null)}>
                    <CustomIcon icon="zi-close" className="text-red-500" size={16} />
                  </Box>
                </Box>
              ) : (
                <Box className="flex items-center justify-center border-2 border-dashed border-blue-300 bg-white rounded-lg h-24 relative overflow-hidden">
                  {isUploadingLicense ? <Spinner visible /> : (
                    <Box className="text-center text-blue-500">
                      <CustomIcon icon="zi-upload" size={24} />
                      <Text size="xSmall" className="mt-1">Tải ảnh lên</Text>
                    </Box>
                  )}
                  <input type="file" accept="image/*" onChange={handleUploadLicenseImage} className="absolute inset-0 opacity-0 cursor-pointer" />
                </Box>
              )}
            </Box>
          )}

          {hasBusinessLicense === "no" && (
            <Box mb={4} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <label className="flex items-start">
                <input type="checkbox" checked={agreeToLiability} onChange={(e) => setAgreeToLiability(e.target.checked)} className="mt-1 mr-2 flex-shrink-0 accent-orange-600" />
                <Text size="small" className="text-gray-700 leading-snug">
                  Tôi <b>Cam kết chịu trách nhiệm 100% trước cơ quan pháp luật</b> về việc kinh doanh hợp pháp các sản phẩm/dịch vụ trên nền tảng.
                </Text>
              </label>
            </Box>
          )}

          {/* Điều khoản */}
          <Box mb={4}>
            <label className="flex items-center">
              <input type="checkbox" checked={agreeToTerms} onChange={(e) => setAgreeToTerms(e.target.checked)} className="mr-2 accent-green-600" />
              <Text size="small" className="text-gray-700">
                Tôi đồng ý với{" "}
                <span className="text-blue-600 underline font-bold cursor-pointer" onClick={() => setShowTermsModal(true)}>Điều khoản thoả thuận</span>.
              </Text>
            </label>
          </Box>

          <Button fullWidth onClick={handleSubmitRegistration} loading={isSubmittingRegistration}>Gửi admin phê duyệt</Button>
        </Box>
      </Modal>

      {/* --- MODAL ĐIỀU KHOẢN THỎA THUẬN --- */}
      <Modal visible={showTermsModal} title="Điều khoản Thoả thuận" onClose={() => setShowTermsModal(false)}>
        <Box p={4} className="max-h-[70vh] overflow-y-auto">
          <Text.Title size="small" className="mb-2 text-green-700">1. Quy định về Hàng hóa, Dịch vụ</Text.Title>
          <Text size="small" className="text-gray-600 mb-3 text-justify">
            Cửa hàng cam kết cung cấp hàng hóa/dịch vụ đảm bảo chất lượng, đúng theo mô tả, tuân thủ nghiêm ngặt mọi quy định của Pháp luật Việt Nam về việc kinh doanh, buôn bán. Tuyệt đối không kinh doanh hàng cấm, hàng giả, hàng kém chất lượng.
          </Text>
          
          <Text.Title size="small" className="mb-2 text-green-700">2. Chính sách Chiết khấu</Text.Title>
          <Text size="small" className="text-gray-600 mb-3 text-justify">
            Để gia tăng lợi ích cho cộng đồng, Cửa hàng cam kết cung cấp mức ưu đãi/chiết khấu <b>ít nhất là 20%</b> cho người dùng từ hệ thống Campus Green Biz.
          </Text>
          
          <Text.Title size="small" className="mb-2 text-green-700">3. Nghĩa vụ Thuế & Pháp lý</Text.Title>
          <Text size="small" className="text-gray-600 mb-3 text-justify">
            Chủ cửa hàng tự chịu trách nhiệm kê khai và nộp thuế đối với hoạt động kinh doanh của mình. Trong trường hợp không có Giấy ĐKKD, Chủ cửa hàng phải tự chịu trách nhiệm hoàn toàn 100% trước cơ quan pháp luật.
          </Text>
          
          <Text.Title size="small" className="mb-2 text-red-600">4. Miễn trừ trách nhiệm của Nền tảng</Text.Title>
          <Text size="small" className="text-gray-600 mb-4 text-justify">
            Campus Green Biz hoạt động với tư cách là nền tảng trung gian kết nối. Nền tảng <b>được miễn trừ 100% trách nhiệm</b> đối với các tranh chấp, khiếu nại liên quan đến chất lượng sản phẩm, vi phạm bản quyền, hay các vấn đề pháp lý do hoạt động kinh doanh của Shop gây ra.
          </Text>

          <Button fullWidth onClick={() => setShowTermsModal(false)} variant="secondary">Đã hiểu và Đóng</Button>
        </Box>
      </Modal>

    </Box>
  );
};