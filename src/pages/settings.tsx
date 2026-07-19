import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Text, List, Icon, useNavigate, Modal, Button, Input, Spinner, Avatar } from "zmp-ui";
import { auth, db } from "../firebase";
import { signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, increment, addDoc } from "firebase/firestore";
import { SectionBox } from "../components/section-box";
import { openShareSheet } from "zmp-sdk/apis";
import { useRecoilState } from "recoil";
import { cartState } from "../state";


const isWithin15Days = (createdAt: any) => {
  if (!createdAt) return true;
  const date = createdAt.toDate ? createdAt.toDate() : (createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt));
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  return date >= fifteenDaysAgo;
};

interface UserPersonalMenuProps {
  onReferralClick: () => void;
  onShareClick: () => void;
  onChangePasswordClick: () => void;
  onSupportClick: () => void;
  onMyOrdersClick: () => void;
}

const UserPersonalMenu: FC<UserPersonalMenuProps> = ({ onReferralClick, onShareClick, onChangePasswordClick, onSupportClick, onMyOrdersClick }) => {
  const navigate = useNavigate();
  return (
    <SectionBox title="Cá nhân">
      <List>
        <List.Item onClick={() => navigate('/account-info')} title="Thông tin tài khoản" prefix={<CustomIcon icon="zi-user" className="text-gray-600" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={() => navigate('/notification')} title="Thông báo" prefix={<CustomIcon icon="zi-notif" className="text-blue-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
        <List.Item onClick={onMyOrdersClick} title="Đơn hàng của tôi" prefix={<CustomIcon icon="zi-note" className="text-orange-500" />} suffix={<CustomIcon icon="zi-chevron-right" />} />
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

  const [referralCode, setReferralCode] = useState("Đang tải...");
  const [passLoading, setPassLoading] = useState(false);
  const [referredList, setReferredList] = useState<any[]>([]);
  const [loadingReferred, setLoadingReferred] = useState(false);

  // Wallet states
  const [userData, setUserData] = useState<any>(null);
  const [points, setPoints] = useState(0);
  const [isWalletExpanded, setIsWalletExpanded] = useState(false);
  const [activeWalletTab, setActiveWalletTab] = useState<'rank' | 'promo' | 'interaction'>('rank');
  const [showWalletHistoryModal, setShowWalletHistoryModal] = useState(false);
  const [walletHistoryList, setWalletHistoryList] = useState<any[]>([]);
  const [loadingWalletHistory, setLoadingWalletHistory] = useState(false);
  const [eligiblePoints, setEligiblePoints] = useState(0);

  const fetchEligiblePoints = async (userId: string) => {
    try {
      const q = query(
        collection(db, "point_transactions"),
        where("userId", "==", userId),
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
      console.error("Lỗi tính điểm đủ điều kiện:", e);
    }
  };

  // My Orders states & functions
  const [showMyOrdersModal, setShowMyOrdersModal] = useState(false);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);
  const [cart, setCart] = useRecoilState(cartState);
  const [ordersTab, setOrdersTab] = useState<'cart' | 'pending' | 'history'>('cart');

  const getStatusDisplay = (status: string) => {
    switch(status) {
        case 'pending': return { text: 'Chờ xác nhận', color: 'text-orange-500' };
        case 'accepted':
        case 'confirmed': return { text: 'Đã xác nhận', color: 'text-blue-500' };
        case 'processing': return { text: 'Đang xử lý', color: 'text-blue-500' };
        case 'shipping': return { text: 'Đang giao hàng', color: 'text-blue-500' };
        case 'completed':
        case 'success': return { text: 'Hoàn thành', color: 'text-green-500' };
        case 'cancelled': return { text: 'Đã hủy', color: 'text-red-500' };
        default: return { text: status || 'Chờ xác nhận', color: 'text-gray-500' };
    }
  };

  const handleOpenMyOrders = async () => {
    const userPhone = localStorage.getItem("user_phone");
    if (!userPhone) return;
    setLoadingMyOrders(true);
    setShowMyOrdersModal(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", userPhone)
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      setMyOrders(docs);
    } catch (error) {
      console.error("Lỗi tải đơn hàng của tôi:", error);
      setMyOrders([]);
    } finally {
      setLoadingMyOrders(false);
    }
  };

  const handleShareOrder = async (order: any) => {
    try {
      const orderCode = order.orderCode || order.id.slice(0, 8).toUpperCase();
      const orderTitle = order.productName || "Đơn hàng Green Biz";
      const orderPrice = (order.totalAmount || order.totalPrice || order.total || 0).toLocaleString('vi-VN') + 'đ';
      const statusText = getStatusDisplay(order.status).text;
      
      await openShareSheet({
        type: "zmp_deep_link",
        data: {
          title: `Mã đơn hàng: #${orderCode} - Campus Green Biz`,
          description: `Đơn hàng: ${orderTitle} (${orderPrice}). Trạng thái: ${statusText}. Ghé thăm Campus Green Biz nhé!`,
          thumbnail: order.productImage || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png",
        },
      } as any);
    } catch (err) {
      console.error("Lỗi chia sẻ đơn hàng:", err);
    }
  };

  const handleOpenHistory = async () => {
    if (!userData?.id) return;
    setLoadingWalletHistory(true);
    setShowWalletHistoryModal(true);
    try {
      const q = query(
        collection(db, "point_transactions"),
        where("userId", "==", userData.id)
      );
      const querySnapshot = await getDocs(q);
      let docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      docs = docs.filter((tx: any) => {
        const type = tx.walletType || 'main';
        if (activeWalletTab === 'rank') {
          return type === 'main' || type === 'all';
        } else if (activeWalletTab === 'promo') {
          return type === 'promo' || type === 'main' || type === 'all';
        } else {
          return type === 'interaction';
        }
      });
      
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
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

        let foundData: any = null;

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
            } else if (finalPhone) {
              const qUser = query(collection(db, "users"), where("phone", "==", finalPhone));
              const userSnap = await getDocs(qUser);
              if (!userSnap.empty) {
                const data = userSnap.docs[0].data();
                foundData = { id: userSnap.docs[0].id, ...data, role: data.role || "member" };
              }
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
        if (foundData.id) {
          fetchEligiblePoints(foundData.id);
        }

        // 👉 ĐÃ BỔ SUNG: Đồng bộ điểm thưởng quá khứ (Retroactive points sync)
        const syncRetroactivePoints = async (userId: string, userPhone: string, userRole: string, currentData: any) => {
          try {
            let totalPointsToAward = 0;
            let dbUpdated = false;

            // Fetch existing notifications to avoid duplicates
            const qNotifs = query(collection(db, "notifications"), where("userId", "==", userId));
            const notifsSnap = await getDocs(qNotifs);
            const notifContents = new Set(notifsSnap.docs.map(doc => doc.data().content));
            
            // 1. Đồng bộ các đơn hàng đã Hoàn thành trong quá khứ
            if (userPhone) {
              const qOrders = query(collection(db, "orders"), where("userId", "==", userPhone), where("status", "==", "completed"));
              const ordersSnap = await getDocs(qOrders);
              
              for (const orderDoc of ordersSnap.docs) {
                const order = orderDoc.data();
                const orderId = orderDoc.id;
                const orderCodeStr = order.orderCode || orderId.slice(0, 6).toUpperCase();
                const totalAmount = Number(order.totalAmount || order.totalPrice || order.total || 0);
                const pointsEarned = Math.floor(totalAmount / 10000);
                
                const qTx = query(
                  collection(db, "point_transactions"),
                  where("userId", "==", userId),
                  where("description", "==", `Tích điểm từ đơn hàng #${orderCodeStr}`)
                );
                const txSnap = await getDocs(qTx);
                if (txSnap.empty) {
                  if (pointsEarned > 0) {
                    totalPointsToAward += pointsEarned;
                    await addDoc(collection(db, "point_transactions"), {
                      userId: userId,
                      type: "plus",
                      amount: pointsEarned,
                      description: `Tích điểm từ đơn hàng #${orderCodeStr}`,
                      walletType: "main",
                      createdAt: new Date()
                    });
                    dbUpdated = true;
                  }
                }

                // Retroactive notification write
                if (pointsEarned > 0) {
                  const expectedContent = `Bạn được cộng +${pointsEarned} điểm ưu đãi từ đơn hàng #${orderCodeStr}.`;
                  if (!notifContents.has(expectedContent)) {
                    await addDoc(collection(db, "notifications"), {
                      userId: userId,
                      title: "Tích điểm đơn hàng thành công",
                      content: expectedContent,
                      type: "completed",
                      createdAt: new Date(),
                      isRead: false
                    });
                    notifContents.add(expectedContent);
                  }
                }
              }
            }
            
            // 2. Đồng bộ điểm từ danh sách thành viên đã giới thiệu thành công
            if (userPhone) {
              const uq1 = query(collection(db, "users"), where("referrer", "==", userPhone));
              const uq2 = query(collection(db, "users"), where("referralCode", "==", userPhone));
              const sq1 = query(collection(db, "shops"), where("referrer", "==", userPhone));
              const sq2 = query(collection(db, "shops"), where("referralCode", "==", userPhone));
              
              const [usnap1, usnap2, ssnap1, ssnap2] = await Promise.all([
                getDocs(uq1), getDocs(uq2), getDocs(sq1), getDocs(sq2)
              ]);
              
              const referredMap = new Map();
              usnap1.docs.forEach(doc => referredMap.set(doc.id, doc.data()));
              usnap2.docs.forEach(doc => referredMap.set(doc.id, doc.data()));
              ssnap1.docs.forEach(doc => referredMap.set(doc.id, doc.data()));
              ssnap2.docs.forEach(doc => referredMap.set(doc.id, doc.data()));
              
              for (const [refDocId, refData] of referredMap.entries()) {
                const rPhone = (refData as any).phone || "";
                const rName = (refData as any).fullName || (refData as any).name || "Khách";
                
                const qTx = query(
                  collection(db, "point_transactions"),
                  where("userId", "==", userId),
                  where("description", "==", `Thưởng giới thiệu thành viên mới: ${rName} (${rPhone})`)
                );
                const txSnap = await getDocs(qTx);
                if (txSnap.empty) {
                  totalPointsToAward += 10;
                  await addDoc(collection(db, "point_transactions"), {
                    userId: userId,
                    type: "plus",
                    amount: 10,
                    description: `Thưởng giới thiệu thành viên mới: ${rName} (${rPhone})`,
                    walletType: "main",
                    createdAt: new Date()
                  });
                  dbUpdated = true;
                }

                // Retroactive notification write
                const expectedContent = `Bạn được cộng +10 điểm ưu đãi từ việc giới thiệu thành viên ${rName} (${rPhone}) thành công!`;
                if (!notifContents.has(expectedContent)) {
                  await addDoc(collection(db, "notifications"), {
                    userId: userId,
                    title: "Nhận điểm giới thiệu thành công",
                    content: expectedContent,
                    type: "success",
                    createdAt: new Date(),
                    isRead: false
                  });
                  notifContents.add(expectedContent);
                }
              }
            }

            // 3. Đồng bộ điểm thưởng khi nhập mã giới thiệu lúc đăng ký
            if (currentData?.referralCode) {
              const refCodeStr = String(currentData.referralCode).trim();
              if (refCodeStr) {
                const qTx = query(
                  collection(db, "point_transactions"),
                  where("userId", "==", userId),
                  where("description", "==", `Thưởng nhập mã giới thiệu từ: ${refCodeStr}`)
                );
                const txSnap = await getDocs(qTx);
                if (txSnap.empty) {
                  totalPointsToAward += 5;
                  await addDoc(collection(db, "point_transactions"), {
                    userId: userId,
                    type: "plus",
                    amount: 5,
                    description: `Thưởng nhập mã giới thiệu từ: ${refCodeStr}`,
                    walletType: "main",
                    createdAt: new Date()
                  });
                  dbUpdated = true;
                }

                // Retroactive notification write
                const expectedContent = `Bạn được tặng +5 điểm ưu đãi khi nhập mã giới thiệu từ ${refCodeStr}.`;
                if (!notifContents.has(expectedContent)) {
                  await addDoc(collection(db, "notifications"), {
                    userId: userId,
                    title: "Thưởng thành viên mới",
                    content: expectedContent,
                    type: "success",
                    createdAt: new Date(),
                    isRead: false
                  });
                  notifContents.add(expectedContent);
                }
              }
            }
            
            // 4. Sửa sai số điểm tích lũy của đơn hàng nếu tỷ lệ quy đổi bị sai (ví dụ 1.000đ thay vì 10.000đ)
            if (userPhone) {
              const qOrders = query(collection(db, "orders"), where("userId", "==", userPhone), where("status", "==", "completed"));
              const ordersSnap = await getDocs(qOrders);
              
              for (const orderDoc of ordersSnap.docs) {
                const order = orderDoc.data();
                const orderId = orderDoc.id;
                const orderCodeStr = order.orderCode || orderId.slice(0, 6).toUpperCase();
                
                const qTx = query(
                  collection(db, "point_transactions"),
                  where("userId", "==", userId),
                  where("description", "==", `Tích điểm từ đơn hàng #${orderCodeStr}`)
                );
                const txSnap = await getDocs(qTx);
                if (!txSnap.empty) {
                  const txDoc = txSnap.docs[0];
                  const txData = txDoc.data();
                  const totalAmount = Number(order.totalAmount || order.totalPrice || order.total || 0);
                  const correctPoints = Math.floor(totalAmount / 10000);
                  
                  if (txData.amount !== correctPoints) {
                    await updateDoc(doc(db, "point_transactions", txDoc.id), {
                      amount: correctPoints
                    });
                    dbUpdated = true;
                  }
                }
              }
            }
            
            // 5. Tự động tính toán lại tổng điểm ví thực tế từ danh sách giao dịch để đồng bộ
            const qAllTx = query(collection(db, "point_transactions"), where("userId", "==", userId));
            const allTxSnap = await getDocs(qAllTx);
            let calculatedTotal = 0;
            allTxSnap.docs.forEach(doc => {
              const tx = doc.data();
              if (tx.type === "plus") {
                calculatedTotal += Number(tx.amount || 0);
              } else if (tx.type === "minus") {
                calculatedTotal -= Number(tx.amount || 0);
              }
            });
            
            if (calculatedTotal < 0) calculatedTotal = 0;
            
            const currentPointsInDb = Number(currentData?.rankPoints || 0);
            if (dbUpdated || calculatedTotal !== currentPointsInDb) {
              const collectionName = userRole === "provider" ? "shops" : "users";
              const userRef = doc(db, collectionName, userId);
              await updateDoc(userRef, {
                spendingPoints: calculatedTotal,
                rankPoints: calculatedTotal
              });
              
              setPoints(calculatedTotal);
              setUserData((prev: any) => prev ? {
                ...prev,
                spendingPoints: calculatedTotal,
                rankPoints: calculatedTotal
              } : null);
            }
          } catch (err) {
            console.error("Lỗi đồng bộ điểm thưởng:", err);
          }
        };

        syncRetroactivePoints(foundData.id, foundData.phone, foundData.role, foundData);

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

  useEffect(() => {
    const fetchReferredList = async () => {
      if (!userData?.phone || !showRefModal) return;
      setLoadingReferred(true);
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
        
        const list = Array.from(mergedMap.values());
        setReferredList(list);
      } catch (err) {
        console.error("Lỗi tải danh sách người giới thiệu:", err);
      } finally {
        setLoadingReferred(false);
      }
    };
    
    fetchReferredList();
  }, [userData, showRefModal]);

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Mật khẩu mới và xác nhận không khớp!");
      return;
    }

    setPassLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        alert("Lỗi phiên đăng nhập. Vui lòng đăng nhập lại.");
        setPassLoading(false);
        return;
      }

      // 1. Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. Update password in Firebase Auth
      await updatePassword(user, newPassword);

      // 3. Update in Firestore collection (users or shops)
      const targetColl = userData?.role === "provider" ? "shops" : "users";
      const targetId = userData?.id || user.uid;
      const docRef = doc(db, targetColl, targetId);
      
      await updateDoc(docRef, { password: newPassword });

      alert("Đổi mật khẩu thành công!");
      setShowPasswordModal(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Lỗi đổi mật khẩu:", error);
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        alert("Mật khẩu cũ không chính xác!");
      } else {
        alert("Có lỗi xảy ra khi đổi mật khẩu! Chi tiết: " + (error.message || error));
      }
    } finally {
      setPassLoading(false);
    }
  };

  const handleOpenOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setShowOrderDetailModal(true);
  };

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
              <Box flex className="space-x-2 mb-4">
                <button 
                  className={`flex-1 py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    activeWalletTab === 'rank' 
                      ? 'border-orange-400 bg-orange-50/30 text-orange-600 font-semibold' 
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                  onClick={() => setActiveWalletTab('rank')}
                >
                  <Icon icon="zi-poll" className="mb-1 text-lg" />
                  <span className="text-[11px] whitespace-nowrap">Ví Tính Hạng</span>
                </button>

                <button 
                  className={`flex-1 py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    activeWalletTab === 'promo' 
                      ? 'border-blue-400 bg-blue-50/30 text-blue-600 font-semibold' 
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                  onClick={() => setActiveWalletTab('promo')}
                >
                  <Icon icon="zi-star" className="mb-1 text-lg" />
                  <span className="text-[11px] whitespace-nowrap">Ví Ưu Đãi</span>
                </button>

                <button 
                  className={`flex-1 py-2 px-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    activeWalletTab === 'interaction' 
                      ? 'border-[#288F4E] bg-[#288F4E]/10 text-[#288F4E] font-semibold' 
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                  onClick={() => setActiveWalletTab('interaction')}
                >
                  <Icon icon="zi-chat" className="mb-1 text-lg" />
                  <span className="text-[11px] whitespace-nowrap">Ví Tương Tác</span>
                </button>
              </Box>

              {/* Wallet Card */}
              {activeWalletTab === 'rank' && (
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
              )}

              {activeWalletTab === 'promo' && (
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

              {activeWalletTab === 'interaction' && (
                <Box className="bg-gradient-to-br from-[#14502e] to-[#288F4E] rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                  <Box flex justifyContent="space-between" alignItems="flex-start" className="mb-6">
                    <Box>
                      <Text size="xxSmall" className="opacity-80 uppercase tracking-wider">Tích Lũy Tương Tác</Text>
                      <Box flex alignItems="center" className="mt-1">
                        <Icon icon="zi-chat" size={20} className="mr-1 text-emerald-200" />
                        <Text bold size="large" className="text-white">Ví Tương Tác</Text>
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

                  {/* Progress Bar */}
                  <Box className="mb-4">
                    <Box className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <Box 
                        className="h-full bg-white rounded-full" 
                        style={{ width: `${Math.min(100, ((userData.interactionPoints || 0) / 500) * 100)}%` }} 
                      />
                    </Box>
                    <Box flex justifyContent="space-between" className="mt-1.5 opacity-80 text-[10px]">
                      <span>0</span>
                      <span>Mục tiêu: 500 điểm</span>
                    </Box>
                  </Box>

                  <Box flex justifyContent="space-between" alignItems="center" className="border-t border-white/20 pt-3 mt-1">
                    <Text size="xxSmall" className="italic opacity-85">* Điểm khả dụng là điểm đã tích lũy đủ 48 giờ và không bị hoàn tác.</Text>
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
        onMyOrdersClick={handleOpenMyOrders}
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
        <Box p={2} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loadingReferred ? (
            <Box flex justifyContent="center" py={4}><Spinner /></Box>
          ) : referredList.length > 0 ? (
            <Box>
              <Box className="bg-blue-50 p-2 rounded-lg text-center mb-4 border border-blue-100">
                <Text bold className="text-blue-600">Tổng số: {referredList.length} người</Text>
              </Box>
              {referredList.map((cus, idx) => (
                <Box key={idx} flex alignItems="center" justifyContent="space-between" className="mb-3 pb-3 border-b border-gray-100 last:border-0">
                  <Box flex alignItems="center">
                    <Avatar 
                      src={cus.avatar || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"} 
                      size={40} 
                      className="border" 
                    />
                    <Box ml={3}>
                      <Text size="small" bold>{cus.fullName || cus.name || "Khách hàng"}</Text>
                      <Text size="xxSmall" className="text-gray-500">{cus.phone}</Text>
                    </Box>
                  </Box>
                  <Box>
                    {cus.referredType === "shop" ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-600 border border-orange-200">Shop</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-600 border border-blue-200">Khách</span>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Text className="text-center text-gray-400 mt-10 p-4 bg-gray-50 rounded italic">Bạn chưa giới thiệu người nào.</Text>
          )}
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
            className="w-full bg-[#14502e] text-white py-3 rounded-xl text-center font-bold mt-4 cursor-pointer shadow-md flex items-center justify-center space-x-2"
            onClick={() => !passLoading && handleUpdatePassword()}
            style={{ opacity: passLoading ? 0.7 : 1 }}
          >
            {passLoading ? <Spinner /> : "Cập nhật"}
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
        title={activeWalletTab === 'rank' ? "Lịch sử Ví Tính Hạng" : activeWalletTab === 'promo' ? "Lịch sử Ví Ưu Đãi" : "Lịch sử Ví Tương Tác"}
        onClose={() => setShowWalletHistoryModal(false)}
      >
        <Box p={4} className="max-h-[60vh] overflow-y-auto hide-scroll">
          {loadingWalletHistory ? (
            <Box className="flex justify-center items-center py-10">
              <Spinner />
            </Box>
          ) : walletHistoryList.filter(item => isWithin15Days(item.createdAt)).length > 0 ? (
            walletHistoryList.filter(item => isWithin15Days(item.createdAt)).map((item, idx) => {
              const isPlus = item.type === 'plus';
              const displayDate = item.createdAt 
                ? (item.createdAt.toDate ? item.createdAt.toDate().toLocaleString('vi-VN') : new Date(item.createdAt.seconds * 1000).toLocaleString('vi-VN')) 
                : 'N/A';
              
              return (
                <Box 
                  key={idx} 
                  className="mb-4 pb-3 border-b border-gray-100/70 flex justify-between items-start space-x-3"
                >
                  <Box className="flex-1 min-w-0">
                    <Text className="text-gray-800 font-medium text-xs leading-normal">
                      {item.description}
                    </Text>
                    <Text className="text-gray-400 text-[10px] mt-1 block">
                      {displayDate}
                    </Text>
                  </Box>
                   <Text className={`text-xs font-bold flex-shrink-0 ${isPlus ? "text-[#288F4E]" : "text-red-500"}`}>
                    {isPlus ? '+' : '-'}{item.amount?.toLocaleString()}
                  </Text>
                </Box>
              );
            })
          ) : (
            <Text size="small" className="text-center text-gray-400 py-10">Không có dữ liệu giao dịch.</Text>
          )}
        </Box>
        <Box className="p-4 bg-white border-t border-gray-100 mt-auto rounded-b-2xl">
          <Button 
            fullWidth 
            onClick={() => setShowWalletHistoryModal(false)}
            className="bg-[#14502e] text-white rounded-xl font-bold py-2.5 text-sm active:bg-[#0f3d23] transition-colors"
          >
            Đóng
          </Button>
        </Box>
      </Modal>
      {/* Modal Đơn hàng của tôi */}
      <Modal
        visible={showMyOrdersModal}
        title="Đơn hàng của tôi"
        onClose={() => setShowMyOrdersModal(false)}
        modalClassName="order-management-modal"
      >
        <Box className="bg-gray-50 flex flex-col flex-1 hide-scroll p-4 space-y-3" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {/* Tab Selection */}
          <Box flex className="border-b border-gray-150 mb-4 bg-gray-50 p-1.5 rounded-xl">
            <button 
              onClick={() => setOrdersTab('cart')}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${ordersTab === 'cart' ? 'bg-[#14502e] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Giỏ hàng ({cart.length})
            </button>
            <button 
              onClick={() => setOrdersTab('pending')}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${ordersTab === 'pending' ? 'bg-[#14502e] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Đang chờ ({myOrders.filter(o => !['completed', 'success', 'cancelled'].includes(o.status)).length})
            </button>
            <button 
              onClick={() => setOrdersTab('history')}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${ordersTab === 'history' ? 'bg-[#14502e] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Lịch sử
            </button>
          </Box>

          {ordersTab === 'cart' ? (
            <Box className="space-y-3">
              {cart.length > 0 ? (
                <>
                  <Box className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {cart.map((item, idx) => {
                      const optText = Object.entries(item.options || {})
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                      
                      const handleQtyChange = (delta: number) => {
                        setCart(prev => {
                          const newCart = [...prev];
                          const newQty = item.quantity + delta;
                          if (newQty <= 0) {
                            newCart.splice(idx, 1);
                          } else {
                            newCart[idx] = { ...item, quantity: newQty };
                          }
                          return newCart;
                        });
                      };

                      const handleRemove = () => {
                        setCart(prev => {
                          const newCart = [...prev];
                          newCart.splice(idx, 1);
                          return newCart;
                        });
                      };

                      return (
                        <Box key={idx} className="p-3 flex space-x-3">
                          <img src={item.product.image || (item.product as any).gallery?.[0] || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"} className="w-16 h-16 object-cover rounded-lg border border-gray-100" alt="product" />
                          <Box className="flex-1">
                              <Box flex justifyContent="space-between" alignItems="flex-start">
                              <Text bold size="small" className="text-gray-900 leading-tight flex-1 line-clamp-2 pr-2">
                                {item.product.title || item.product.name}
                              </Text>
                              <button 
                                onClick={handleRemove}
                                className="text-red-500 hover:text-red-700 p-1 active:scale-90 transition-transform cursor-pointer"
                              >
                                <Icon icon="zi-delete" size={18} />
                              </button>
                            </Box>
                            {optText && (
                              <Text className="text-gray-500 text-xs mt-0.5">
                                {optText}
                              </Text>
                            )}
                            <Box flex justifyContent="space-between" alignItems="center" className="mt-2 pt-1 border-t border-dashed border-gray-50">
                              <Text bold className="text-[#14502e] text-sm">
                                {Number(item.product.price || 0).toLocaleString("vi-VN")}đ
                              </Text>
                              
                              <Box flex alignItems="center" className="space-x-2">
                                <button 
                                  onClick={() => handleQtyChange(-1)}
                                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-transform flex items-center justify-center text-gray-600 font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <Text size="small" bold className="text-gray-800 w-6 text-center">
                                  {item.quantity}
                                </Text>
                                <button 
                                  onClick={() => handleQtyChange(1)}
                                  className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-transform flex items-center justify-center text-gray-600 font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  <Box className="pt-2">
                    <Button 
                      fullWidth 
                      onClick={() => {
                        setShowMyOrdersModal(false);
                        navigate('/cart');
                      }}
                      className="bg-[#14502e] text-white rounded-xl font-bold py-2.5 text-sm"
                    >
                      Đến trang Thanh toán
                    </Button>
                  </Box>
                </>
              ) : (
                <Box className="py-8 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Text size="small" className="text-gray-400">Giỏ hàng của bạn đang trống.</Text>
                  <Button 
                    size="small"
                    onClick={() => {
                      setShowMyOrdersModal(false);
                      navigate('/store');
                    }}
                    className="mt-3 bg-[#14502e] text-white"
                  >
                    Mua sắm ngay
                  </Button>
                </Box>
              )}
            </Box>
          ) : ordersTab === 'pending' ? (
            <Box className="space-y-3">
              {loadingMyOrders ? (
                <Box className="flex justify-center items-center py-10">
                  <Spinner />
                </Box>
              ) : myOrders.filter(o => !['completed', 'success', 'cancelled'].includes(o.status)).length > 0 ? (
                myOrders.filter(o => !['completed', 'success', 'cancelled'].includes(o.status)).map((order, idx) => {
                  const statusUI = getStatusDisplay(order.status);
                  const orderCode = order.orderCode || order.id.slice(0, 8).toUpperCase();
                  const totalAmount = order.totalAmount || order.totalPrice || order.total || 0;
                  return (
                    <Box key={idx} className="p-3 bg-white border border-gray-150 rounded-xl relative shadow-sm cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors" onClick={() => handleOpenOrderDetail(order)}>
                      <Box flex justifyContent="space-between" alignItems="center" className="border-b border-gray-200 pb-1.5 mb-2">
                        <Text size="small" bold className="text-blue-600">#{orderCode}</Text>
                        <Text size="xxSmall" bold className={statusUI.color}>{statusUI.text}</Text>
                      </Box>
                      
                      <Box mb={2}>
                        {order.shopName && (
                          <Text size="xxSmall" className="text-gray-400 font-bold block mb-1">Shop: {order.shopName}</Text>
                        )}
                        
                        {/* Danh sách sản phẩm trong đơn */}
                        {(order.items || order.cartItems) && (order.items || order.cartItems).length > 0 ? (
                          <Box className="bg-white p-2 rounded-xl border border-gray-100 mb-2 space-y-2">
                            {(order.items || order.cartItems).map((item: any, i: number) => {
                              const imgUrl = item.product?.image || item.product?.images?.[0] || "";
                              return (
                                <Box key={i} flex className="items-start space-x-2 py-1 first:pt-0 last:pb-0 border-b border-dashed border-gray-100 last:border-none">
                                  <Box className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                    {imgUrl ? (
                                      <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                      <Icon icon="zi-photo" size={16} className="text-gray-400" />
                                    )}
                                  </Box>
                                  <Box className="flex-1 min-w-0">
                                    <Text size="xSmall" bold className="text-gray-800 line-clamp-1">
                                      {item.product?.title || item.product?.name || item.name}
                                    </Text>
                                    {item.options && Object.keys(item.options).length > 0 && (
                                      <Text size="xxxxSmall" className="text-gray-500 italic mt-0.5">
                                        {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                      </Text>
                                    )}
                                    <Box flex justifyContent="space-between" className="mt-1 items-center">
                                      <Text size="xxxxSmall" className="text-gray-400">Số lượng: {item.quantity}</Text>
                                      <Text size="xxxxSmall" bold className="text-gray-700">{(item.product?.price || 0).toLocaleString('vi-VN')}đ</Text>
                                    </Box>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          (() => {
                            const singleImg = order.productImage || order.product?.image || order.product?.images?.[0] || "";
                            return (
                              <Box flex className="items-start space-x-2 mb-2 bg-white p-2 rounded-xl border border-gray-100">
                                <Box className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                  {singleImg ? (
                                    <img src={singleImg} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <Icon icon="zi-photo" size={16} className="text-gray-400" />
                                  )}
                                </Box>
                                <Box className="flex-1 min-w-0">
                                  <Text size="xSmall" bold className="text-gray-800 line-clamp-1">{order.productName}</Text>
                                  {order.selectedVariants && Object.keys(order.selectedVariants).length > 0 ? (
                                    <Text size="xxxxSmall" className="text-gray-500 italic mt-0.5">
                                      {Object.entries(order.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                    </Text>
                                  ) : (order.bookingTime || order.bookingDate) ? (
                                    <Text size="xxxxSmall" className="text-gray-500 mt-0.5">⏰ Lịch: {order.bookingTime} {order.bookingDate}</Text>
                                  ) : null}
                                  <Box flex justifyContent="space-between" className="mt-1 items-center">
                                    <Text size="xxxxSmall" className="text-gray-400">Số lượng: 1</Text>
                                    <Text size="xxxxSmall" bold className="text-gray-700">{(order.originalAmount || totalAmount).toLocaleString('vi-VN')}đ</Text>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })()
                        )}
                      </Box>

                      <Box flex justifyContent="space-between" alignItems="center" className="border-t border-gray-200 pt-2 mt-2">
                        <Box>
                          <Text size="xxSmall" className="text-gray-400 block">Tổng thanh toán</Text>
                          <Text size="small" bold className="text-red-500">{totalAmount.toLocaleString('vi-VN')}đ</Text>
                        </Box>
                        <Button 
                          size="small" 
                          onClick={() => handleShareOrder(order)}
                          className="bg-[#14502e] text-white flex items-center space-x-1"
                        >
                          <CustomIcon icon="zi-share" size={14} />
                          <span className="text-xs">Chia sẻ Zalo</span>
                        </Button>
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Text size="small" className="text-center text-gray-400 py-10">Không có đơn hàng nào đang chờ xử lý.</Text>
              )}
            </Box>
          ) : (
            <Box className="space-y-3">
              {loadingMyOrders ? (
                <Box className="flex justify-center items-center py-10">
                  <Spinner />
                </Box>
              ) : myOrders.filter(o => ['completed', 'success', 'cancelled'].includes(o.status)).filter(o => isWithin15Days(o.createdAt)).length > 0 ? (
                myOrders.filter(o => ['completed', 'success', 'cancelled'].includes(o.status)).filter(o => isWithin15Days(o.createdAt)).map((order, idx) => {
                  const statusUI = getStatusDisplay(order.status);
                  const orderCode = order.orderCode || order.id.slice(0, 8).toUpperCase();
                  const totalAmount = order.totalAmount || order.totalPrice || order.total || 0;
                  return (
                    <Box key={idx} className="p-3 bg-white border border-gray-150 rounded-xl relative shadow-sm cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors" onClick={() => handleOpenOrderDetail(order)}>
                      <Box flex justifyContent="space-between" alignItems="center" className="border-b border-gray-200 pb-1.5 mb-2">
                        <Text size="small" bold className="text-blue-600">#{orderCode}</Text>
                        <Text size="xxSmall" bold className={statusUI.color}>{statusUI.text}</Text>
                      </Box>
                      
                      <Box mb={2}>
                        {order.shopName && (
                          <Text size="xxSmall" className="text-gray-400 font-bold block mb-1">Shop: {order.shopName}</Text>
                        )}
                        
                        {/* Danh sách sản phẩm trong đơn */}
                        {(order.items || order.cartItems) && (order.items || order.cartItems).length > 0 ? (
                          <Box className="bg-white p-2 rounded-xl border border-gray-100 mb-2 space-y-2">
                            {(order.items || order.cartItems).map((item: any, i: number) => {
                              const imgUrl = item.product?.image || item.product?.images?.[0] || "";
                              return (
                                <Box key={i} flex className="items-start space-x-2 py-1 first:pt-0 last:pb-0 border-b border-dashed border-gray-100 last:border-none">
                                  <Box className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                    {imgUrl ? (
                                      <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                      <Icon icon="zi-photo" size={16} className="text-gray-400" />
                                    )}
                                  </Box>
                                  <Box className="flex-1 min-w-0">
                                    <Text size="xSmall" bold className="text-gray-800 line-clamp-1">
                                      {item.product?.title || item.product?.name || item.name}
                                    </Text>
                                    {item.options && Object.keys(item.options).length > 0 && (
                                      <Text size="xxxxSmall" className="text-gray-500 italic mt-0.5">
                                        {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                      </Text>
                                    )}
                                    <Box flex justifyContent="space-between" className="mt-1 items-center">
                                      <Text size="xxxxSmall" className="text-gray-400">Số lượng: {item.quantity}</Text>
                                      <Text size="xxxxSmall" bold className="text-gray-700">{(item.product?.price || 0).toLocaleString('vi-VN')}đ</Text>
                                    </Box>
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          (() => {
                            const singleImg = order.productImage || order.product?.image || order.product?.images?.[0] || "";
                            return (
                              <Box flex className="items-start space-x-2 mb-2 bg-white p-2 rounded-xl border border-gray-100">
                                <Box className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                  {singleImg ? (
                                    <img src={singleImg} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <Icon icon="zi-photo" size={16} className="text-gray-400" />
                                  )}
                                </Box>
                                <Box className="flex-1 min-w-0">
                                  <Text size="xSmall" bold className="text-gray-800 line-clamp-1">{order.productName}</Text>
                                  {order.selectedVariants && Object.keys(order.selectedVariants).length > 0 ? (
                                    <Text size="xxxxSmall" className="text-gray-500 italic mt-0.5">
                                      {Object.entries(order.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                    </Text>
                                  ) : (order.bookingTime || order.bookingDate) ? (
                                    <Text size="xxxxSmall" className="text-gray-500 mt-0.5">⏰ Lịch: {order.bookingTime} {order.bookingDate}</Text>
                                  ) : null}
                                  <Box flex justifyContent="space-between" className="mt-1 items-center">
                                    <Text size="xxxxSmall" className="text-gray-400">Số lượng: 1</Text>
                                    <Text size="xxxxSmall" bold className="text-gray-700">{(order.originalAmount || totalAmount).toLocaleString('vi-VN')}đ</Text>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })()
                        )}
                      </Box>

                      <Box flex justifyContent="space-between" alignItems="center" className="border-t border-gray-200 pt-2 mt-2">
                        <Box>
                          <Text size="xxSmall" className="text-gray-400 block">Tổng thanh toán</Text>
                          <Text size="small" bold className="text-red-500">{totalAmount.toLocaleString('vi-VN')}đ</Text>
                        </Box>
                        <Button 
                          size="small" 
                          onClick={() => handleShareOrder(order)}
                          className="bg-[#14502e] text-white flex items-center space-x-1"
                        >
                          <CustomIcon icon="zi-share" size={14} />
                          <span className="text-xs">Chia sẻ Zalo</span>
                        </Button>
                      </Box>
                    </Box>
                  );
                })
              ) : (
                <Text size="small" className="text-center text-gray-400 py-10">Bạn chưa có đơn hàng nào.</Text>
              )}
            </Box>
          )}
        </Box>
        <Box className="p-4 bg-white border-t border-gray-100 mt-auto rounded-b-2xl">
          <Button 
            fullWidth 
            onClick={() => setShowMyOrdersModal(false)}
            className="bg-[#14502e] text-white rounded-xl font-bold py-2.5 text-sm active:bg-[#0f3d23] transition-colors"
          >
            Đóng
          </Button>
        </Box>
      </Modal>

      {/* Modal Chi tiết đơn hàng */}
      <Modal
        visible={showOrderDetailModal}
        title="Chi tiết đơn hàng"
        onClose={() => setShowOrderDetailModal(false)}
      >
        {selectedOrder && (() => {
          const statusUI = getStatusDisplay(selectedOrder.status);
          const orderCode = selectedOrder.orderCode || selectedOrder.id.slice(0, 8).toUpperCase();
          const totalAmount = selectedOrder.totalAmount || selectedOrder.totalPrice || selectedOrder.total || 0;
          const dateObj = selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate() : 
                         (selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000) : new Date(selectedOrder.createdAt));
          
          return (
            <Box p={4} className="max-h-[70vh] overflow-y-auto hide-scroll space-y-4 text-left">
              {/* Header Info */}
              <Box className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <Box flex justifyContent="space-between" className="mb-2">
                  <Text size="small" className="text-gray-500">Mã đơn hàng:</Text>
                  <Text size="small" bold className="text-blue-600">#{orderCode}</Text>
                </Box>
                <Box flex justifyContent="space-between" className="mb-2">
                  <Text size="small" className="text-gray-500">Trạng thái:</Text>
                  <Text size="small" bold className={statusUI.color}>{statusUI.text}</Text>
                </Box>
                <Box flex justifyContent="space-between" className="mb-2">
                  <Text size="small" className="text-gray-500">Thời gian đặt:</Text>
                  <Text size="small" bold className="text-gray-800">
                    {dateObj ? dateObj.toLocaleString('vi-VN') : "Gần đây"}
                  </Text>
                </Box>
                {selectedOrder.shopName && (
                  <Box flex justifyContent="space-between">
                    <Text size="small" className="text-gray-500">Cửa hàng:</Text>
                    <Text size="small" bold className="text-gray-800">{selectedOrder.shopName}</Text>
                  </Box>
                )}
              </Box>

              {/* Customer Delivery Info */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 space-y-2">
                <Text bold size="small" className="text-gray-800 border-b border-gray-100 pb-1.5 block">Thông tin giao hàng</Text>
                <Box flex justifyContent="space-between">
                  <Text size="xSmall" className="text-gray-500">Người nhận:</Text>
                  <Text size="xSmall" bold className="text-gray-800">{selectedOrder.customerName || selectedOrder.fullName || "Khách hàng"}</Text>
                </Box>
                <Box flex justifyContent="space-between">
                  <Text size="xSmall" className="text-gray-500">Số điện thoại:</Text>
                  <Text size="xSmall" bold className="text-gray-800">{selectedOrder.customerPhone || selectedOrder.phone || "Không có"}</Text>
                </Box>
                <Box flex justifyContent="space-between" className="items-start">
                  <Text size="xSmall" className="text-gray-500 shrink-0">Địa chỉ:</Text>
                  <Text size="xSmall" bold className="text-gray-800 text-right max-w-[70%]">{selectedOrder.customerAddress || selectedOrder.address || "Nhận tại cửa hàng"}</Text>
                </Box>
                {selectedOrder.note && (
                  <Box flex justifyContent="space-between" className="items-start">
                    <Text size="xSmall" className="text-gray-500 shrink-0">Ghi chú:</Text>
                    <Text size="xSmall" className="text-gray-600 text-right max-w-[70%] italic">"{selectedOrder.note}"</Text>
                  </Box>
                )}
              </Box>

              {/* Products List */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 space-y-3">
                <Text bold size="small" className="text-gray-800 border-b border-gray-100 pb-1.5 block">Danh sách sản phẩm</Text>
                {(selectedOrder.items || selectedOrder.cartItems) && (selectedOrder.items || selectedOrder.cartItems).length > 0 ? (
                  (selectedOrder.items || selectedOrder.cartItems).map((item: any, i: number) => {
                    const imgUrl = item.product?.image || item.product?.images?.[0] || "";
                    return (
                      <Box key={i} flex className="items-start space-x-3 py-2 border-b border-dashed border-gray-100 last:border-none last:pb-0">
                        <Box className="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                          {imgUrl ? (
                            <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Icon icon="zi-photo" size={20} className="text-gray-400" />
                          )}
                        </Box>
                        <Box className="flex-1 min-w-0">
                          <Text size="small" bold className="text-gray-800 line-clamp-2">
                            {item.product?.title || item.product?.name || item.name}
                          </Text>
                          {item.options && Object.keys(item.options).length > 0 && (
                            <Text size="xSmall" className="text-gray-500 italic mt-0.5">
                              {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                            </Text>
                          )}
                          <Box flex justifyContent="space-between" className="mt-1 items-center">
                            <Text size="xSmall" className="text-gray-500">Số lượng: {item.quantity}</Text>
                            <Text size="xSmall" bold className="text-gray-800">{(item.product?.price || item.price || 0).toLocaleString('vi-VN')}đ</Text>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })
                ) : (
                  (() => {
                    const singleImg = selectedOrder.productImage || selectedOrder.product?.image || selectedOrder.product?.images?.[0] || "";
                    return (
                      <Box flex className="items-start space-x-3 py-2">
                        <Box className="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                          {singleImg ? (
                            <img src={singleImg} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Icon icon="zi-photo" size={20} className="text-gray-400" />
                          )}
                        </Box>
                        <Box className="flex-1 min-w-0">
                          <Text size="small" bold className="text-gray-800 line-clamp-2">{selectedOrder.productName}</Text>
                          {selectedOrder.selectedVariants && Object.keys(selectedOrder.selectedVariants).length > 0 ? (
                            <Text size="xSmall" className="text-gray-500 italic mt-0.5">
                              {Object.entries(selectedOrder.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                            </Text>
                          ) : (selectedOrder.bookingTime || selectedOrder.bookingDate) ? (
                            <Text size="xSmall" className="text-gray-500 mt-0.5">⏰ Lịch: {selectedOrder.bookingTime} {selectedOrder.bookingDate}</Text>
                          ) : null}
                          <Box flex justifyContent="space-between" className="mt-1 items-center">
                            <Text size="xSmall" className="text-gray-500">Số lượng: 1</Text>
                            <Text size="xSmall" bold className="text-gray-800">{(selectedOrder.originalAmount || totalAmount).toLocaleString('vi-VN')}đ</Text>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })()
                )}
              </Box>

              {/* Total Calculation Details */}
              <Box className="bg-white p-3 rounded-xl border border-gray-150 space-y-2">
                <Text bold size="small" className="text-gray-800 border-b border-gray-100 pb-1.5 block">Chi tiết thanh toán</Text>
                <Box flex justifyContent="space-between">
                  <Text size="xSmall" className="text-gray-500">Phương thức:</Text>
                  <Text size="xSmall" bold className="text-gray-800">Thanh toán khi nhận hàng (COD)</Text>
                </Box>
                <Box flex justifyContent="space-between">
                  <Text size="xSmall" className="text-gray-500">Tổng giá trị sản phẩm:</Text>
                  <Text size="xSmall" bold className="text-gray-800">{totalAmount.toLocaleString('vi-VN')}đ</Text>
                </Box>
                <Box flex justifyContent="space-between">
                  <Text size="xSmall" className="text-gray-500">Khuyến mãi / Giảm giá:</Text>
                  <Text size="xSmall" bold className="text-gray-800">0đ</Text>
                </Box>
                <Box flex justifyContent="space-between" className="border-t border-dashed border-gray-100 pt-2 mt-2">
                  <Text size="small" bold className="text-gray-800">Thực tế thanh toán:</Text>
                  <Text size="small" bold className="text-red-500">{totalAmount.toLocaleString('vi-VN')}đ</Text>
                </Box>
              </Box>
            </Box>
          );
        })()}
        <Box className="p-4 bg-white border-t border-gray-100 mt-auto rounded-b-2xl">
          <Button 
            fullWidth 
            onClick={() => setShowOrderDetailModal(false)}
            className="bg-[#14502e] text-white rounded-xl font-bold py-2.5 text-sm active:bg-[#0f3d23] transition-colors"
          >
            Đóng
          </Button>
        </Box>
      </Modal>
    </Page>
  );
};

export default SettingsPage;
