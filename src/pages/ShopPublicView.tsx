import React, { FC, useEffect, useState, useRef } from "react";
import { Page, Header, Box, Text, Avatar, Button, Icon, Tabs, useSnackbar, Spinner, Modal, Sheet } from "zmp-ui";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { openPhone, openChat } from "zmp-sdk/apis";

const ShopPublicView: FC = () => {
  const { id } = useParams(); // SĐT hoặc ID của Shop
  const navigate = useNavigate();
  const location = useLocation();
  const { openSnackbar } = useSnackbar();
  const stateData = location.state || {};

  // 1. STATE QUẢN LÝ DỮ LIỆU CỬA HÀNG
  const [shop, setShop] = useState<any>({
    name: stateData.preloadName || "Đang tải...",
    avatar: stateData.preloadAvatar || "",
    cover: stateData.preloadCover || "",
    address: "",
    description: "Cửa hàng này chưa có lời giới thiệu nào."
  });
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("services");
  // 👇 STATE QUẢN LÝ ẨN/HIỆN GIÁ TIỀN 👇
  const [showPrice, setShowPrice] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        setCurrentUserPhone(phoneFromEmail || localPhone || user.uid);
      } else {
        setCurrentUserPhone(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const isOwner = !!(
    currentUserPhone && (
      currentUserPhone === shop.id || 
      currentUserPhone === shop.phone || 
      currentUserPhone === id ||
      currentUserPhone === shop.ownerPhone ||
      currentUserPhone === shop.providerId
    )
  ) || !!(
    auth.currentUser && (
      auth.currentUser.uid === shop.uid ||
      auth.currentUser.uid === shop.id ||
      auth.currentUser.uid === id ||
      auth.currentUser.uid === shop.providerId
    )
  );

  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [subTab, setSubTab] = useState<'approved' | 'pending' | 'rejected' | 'deleted'>('approved');
  const [actionProduct, setActionProduct] = useState<any>(null);

  useEffect(() => {
    setSelectedCategory("Tất cả");
  }, [subTab]);

  const categoriesList = React.useMemo(() => {
    const cats = new Set<string>();
    cats.add("Tất cả");
    services.forEach(item => {
      // Chỉ lấy các danh mục của các sản phẩm tương ứng với tab hiện tại
      if (isOwner) {
        if (subTab === 'approved' && (item.status === 'pending' || item.status === 'rejected' || item.status === 'deleted')) return;
        if (subTab === 'pending' && item.status !== 'pending') return;
        if (subTab === 'rejected' && item.status !== 'rejected') return;
        if (subTab === 'deleted' && item.status !== 'deleted') return;
      }
      if (item.productCategory && item.productCategory.trim()) {
        const parts = item.productCategory.split(",");
        parts.forEach(part => {
          const trimmed = part.trim();
          if (trimmed) {
            cats.add(trimmed);
          }
        });
      } else if (item.category) {
        let catLabel = "";
        switch (item.category) {
          case "product": catLabel = "Sản phẩm"; break;
          case "package": catLabel = "Dịch vụ"; break;
          case "academy": catLabel = "Đào tạo"; break;
          case "franchise": catLabel = "Nhượng quyền"; break;
          default: catLabel = item.category;
        }
        if (catLabel) cats.add(catLabel);
      }
    });
    return Array.from(cats);
  }, [services, isOwner, subTab]);

  const displayedServices = React.useMemo(() => {
    const filtered = services.filter((item: any) => {
      // 1. Lọc theo trạng thái kiểm duyệt (chỉ ẩn đối với khách vãng lai)
      if (!isOwner && (item.status === "pending" || item.status === "rejected" || item.status === "deleted")) {
        return false;
      }
      
      // 2. Nếu chủ shop chia tab Đã duyệt / Chờ duyệt / Từ chối / Đã xóa
      if (isOwner) {
        if (subTab === 'approved') {
          if (item.status === 'pending' || item.status === 'rejected' || item.status === 'deleted') return false;
        } else if (subTab === 'pending') {
          if (item.status !== 'pending') return false;
        } else if (subTab === 'rejected') {
          if (item.status !== 'rejected') return false;
        } else if (subTab === 'deleted') {
          if (item.status !== 'deleted') return false;
        }
      }

      // 3. Lọc theo danh mục đã chọn
      if (selectedCategory === "Tất cả") {
        return true;
      }
      
      // So khớp danh mục
      if (item.productCategory && item.productCategory.trim()) {
        const parts = item.productCategory.split(",").map((p: string) => p.trim().toLowerCase());
        if (parts.includes(selectedCategory.toLowerCase())) {
          return true;
        }
      }
      
      let catLabel = "";
      switch (item.category) {
        case "product": catLabel = "Sản phẩm"; break;
        case "package": catLabel = "Dịch vụ"; break;
        case "academy": catLabel = "Đào tạo"; break;
        case "franchise": catLabel = "Nhượng quyền"; break;
        default: catLabel = item.category;
      }
      return catLabel.toLowerCase() === selectedCategory.toLowerCase();
    });

    // Sắp xếp: Mới nhất lên đầu
    return filtered.sort((a: any, b: any) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return timeB - timeA;
    });
  }, [services, selectedCategory, isOwner, subTab]);

  // 1.5. PHÂN TRANG SẢN PHẨM CUỘN VÔ HẠN (LOAD 10 SẢN PHẨM MỖI LẦN)
  const [visibleCount, setVisibleCount] = useState(10);
  const sentinelRef = useRef<any>(null);

  useEffect(() => {
    setVisibleCount(10);
  }, [selectedCategory, subTab]);

  useEffect(() => {
    if (displayedServices.length <= visibleCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 10);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [sentinelRef, displayedServices.length, visibleCount]);

  const paginatedServices = React.useMemo(() => {
    return displayedServices.slice(0, visibleCount);
  }, [displayedServices, visibleCount]);

  // 2. STATE QUẢN LÝ MODAL LIÊN HỆ (GỌI / CHAT)
  const [contactModal, setContactModal] = useState<{visible: boolean, type: 'call' | 'chat'}>({
    visible: false,
    type: 'call'
  });

  // 3. FETCH DỮ LIỆU TỪ FIREBASE
  // 3. FETCH DỮ LIỆU TỪ FIREBASE (ĐÃ TỐI ƯU THEO CẤU TRÚC DATABASE)
  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        try {
          const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
          if (configSnap.exists() && configSnap.data().showPrice !== undefined) {
              setShowPrice(configSnap.data().showPrice);
          }
        } catch (e) {
          console.warn("Could not load admin config", e);
        }
        let currentShopData: any = null;
        let actualShopId = id; 

        // =========================================================
        // BƯỚC 1: LẤY THÔNG TIN CỬA HÀNG TỪ BẢNG 'users' VÀ 'shops'
        // =========================================================
        let shopDoc = await getDoc(doc(db, "users", id));
        if (!shopDoc.exists()) {
           shopDoc = await getDoc(doc(db, "shops", id));
        }
        
        if (shopDoc.exists()) {
          // Trường hợp 1: ID trên URL chính là Document ID (VD: Số điện thoại)
          currentShopData = shopDoc.data();
        } else {
          // Trường hợp 2: ID trên URL là phone / zaloId / providerId
          const usersRef = collection(db, "users");
          const shopsRef = collection(db, "shops");
          
          let qPhone = query(shopsRef, where("phone", "==", id));
          let snapPhone = await getDocs(qPhone);

          if (!snapPhone.empty) {
             currentShopData = snapPhone.docs[0].data();
             actualShopId = snapPhone.docs[0].id;
          } else {
             qPhone = query(usersRef, where("phone", "==", id));
             snapPhone = await getDocs(qPhone);
             if (!snapPhone.empty) {
                 currentShopData = snapPhone.docs[0].data();
                 actualShopId = snapPhone.docs[0].id;
             } else {
                 let qZalo = query(usersRef, where("zaloId", "==", id));
                 let snapZalo = await getDocs(qZalo);
      
                 if (!snapZalo.empty) {
                    currentShopData = snapZalo.docs[0].data();
                    actualShopId = snapZalo.docs[0].id;
                 } else {
                    qZalo = query(shopsRef, where("zaloId", "==", id));
                    snapZalo = await getDocs(qZalo);
                    if (!snapZalo.empty) {
                       currentShopData = snapZalo.docs[0].data();
                       actualShopId = snapZalo.docs[0].id;
                    } else {
                        let qProvider = query(usersRef, where("providerId", "==", id));
                        let snapProvider = await getDocs(qProvider);
                        if (!snapProvider.empty) {
                            currentShopData = snapProvider.docs[0].data();
                            actualShopId = snapProvider.docs[0].id;
                        } else {
                            qProvider = query(shopsRef, where("providerId", "==", id));
                            snapProvider = await getDocs(qProvider);
                            if (!snapProvider.empty) {
                                currentShopData = snapProvider.docs[0].data();
                                actualShopId = snapProvider.docs[0].id;
                            }
                        }
                    }
                 }
             }
          }
        }

        // Cập nhật State thông tin Shop để hiển thị lên UI
        if (currentShopData) {
          setShop(prev => ({
            ...prev,
            id: actualShopId,
            ...currentShopData,
            name: currentShopData.shopName || currentShopData.name || prev.name,
            avatar: currentShopData.avatar || currentShopData.shopAvatar || "https://zalo-api.zdn.vn/api/emoticon/emoticon/default_avatar.png",
            address: currentShopData.address || "Chưa cập nhật địa chỉ",
            description: currentShopData.description || "Cửa hàng này chưa có lời giới thiệu nào."
          }));
        }

        // =========================================================
        // BƯỚC 2: LẤY DANH SÁCH DỊCH VỤ TỪ BẢNG 'services' 
        // =========================================================
        const servicesRef = collection(db, "services");
        
        const possibleIds = new Set<string>();
        if (id) possibleIds.add(id);
        if (actualShopId) possibleIds.add(actualShopId);
        if (currentShopData) {
          if (currentShopData.phone) possibleIds.add(currentShopData.phone);
          if (currentShopData.shopPhone) possibleIds.add(currentShopData.shopPhone);
          if (currentShopData.ownerPhone) possibleIds.add(currentShopData.ownerPhone);
          if (currentShopData.uid) possibleIds.add(currentShopData.uid);
        }

        const allDocs: any[] = [];
        const seenDocIds = new Set<string>();

        for (const pid of Array.from(possibleIds)) {
          // 1. providerId
          const snap1 = await getDocs(query(servicesRef, where("providerId", "==", pid)));
          snap1.docs.forEach(d => {
            if (!seenDocIds.has(d.id)) {
              seenDocIds.add(d.id);
              allDocs.push({ id: d.id, ...d.data() });
            }
          });

          // 2. ownerPhone
          const snap2 = await getDocs(query(servicesRef, where("ownerPhone", "==", pid)));
          snap2.docs.forEach(d => {
            if (!seenDocIds.has(d.id)) {
              seenDocIds.add(d.id);
              allDocs.push({ id: d.id, ...d.data() });
            }
          });

          // 3. shopId
          const snap3 = await getDocs(query(servicesRef, where("shopId", "==", pid)));
          snap3.docs.forEach(d => {
            if (!seenDocIds.has(d.id)) {
              seenDocIds.add(d.id);
              allDocs.push({ id: d.id, ...d.data() });
            }
          });
        }

        setServices(allDocs);

      } catch (error) {
        console.error("Lỗi tải dữ liệu Shop:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChatDirect = async () => {
    const currentUser = auth.currentUser;
    const targetUserId = shop.id || id;
    if (!currentUser || currentUser.email === "guest@campus.com") {
      openSnackbar({ text: "Vui lòng đăng nhập để nhắn tin", type: "warning" });
      return;
    }
    if (!targetUserId) {
      openSnackbar({ text: "Không tìm thấy thông tin cửa hàng", type: "warning" });
      return;
    }
    
    try {
      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
      );
      const snap = await getDocs(q);
      let existingChatId: string | null = null;
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants.includes(targetUserId)) {
          existingChatId = docSnap.id;
        }
      });

      if (existingChatId) {
        navigate(`/chat-detail/${existingChatId}`);
      } else {
        const newChat = await addDoc(collection(db, "chats"), {
          participants: [currentUser.uid, targetUserId],
          lastMessage: "",
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        navigate(`/chat-detail/${newChat.id}`);
      }
    } catch (error) {
      console.error("Lỗi khi tạo chat:", error);
      openSnackbar({ text: "Không thể mở đoạn chat", type: "error" });
    }
  };

  const handleCallDirect = () => {
    if (shop.phone || id) {
      openPhone({ phoneNumber: shop.phone || id });
    } else {
      openSnackbar({ text: "Cửa hàng chưa cập nhật số điện thoại", type: "warning" });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (window.confirm("Bạn đã chắc chắn muốn xóa sản phẩm này?")) {
      try {
        await updateDoc(doc(db, "services", serviceId), {
          status: "deleted",
          updatedAt: serverTimestamp()
        });
        openSnackbar({ text: "Đã chuyển sản phẩm vào mục Đã xóa!", type: "success" });
        setServices(prev => prev.map(item => item.id === serviceId ? { ...item, status: "deleted" } : item));
      } catch (error) {
        console.error("Lỗi xóa mặt hàng:", error);
        openSnackbar({ text: "Không thể xóa mặt hàng", type: "error" });
      }
    }
  };

  // 5. RENDER GIAO DIỆN
  return (
    <Page className="bg-gray-50 pb-10">
      <Header title={typeof shop.name === 'string' ? shop.name : "Chi tiết cửa hàng"} showBackIcon />

      {/* --- BANNER & AVATAR --- */}
      <Box className="relative bg-white pb-4 overflow-hidden">
          <Box className="h-48 w-full bg-gray-200">
              {shop.cover ? (
                  <img src={shop.cover} className="w-full h-full object-cover" alt="Banner" />
              ) : (
                  // ĐÃ CẬP NHẬT: Màu cam giống ảnh
                  <Box className="w-full h-full bg-gradient-to-r from-orange-400 to-orange-600" />
              )}
              <Box className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </Box>

          <Box className="px-4 -mt-12 flex items-end justify-between relative z-10">
              <Avatar src={shop.avatar} size={88} className="border-4 border-white shadow-lg rounded-2xl bg-white" />
              <Box className="flex gap-2 mb-1">
                  {/* ĐÃ SỬA LỖI TS: Thêm 'as any' */}
                  <Button
                    size="small" variant="secondary" prefix={<Icon icon="zi-chat" /> as any}
                    onClick={handleChatDirect}
                    className="bg-white text-blue-600 border border-blue-600"
                  >
                    Chat
                  </Button>
                  <Button
                    size="small" prefix={<Icon icon="zi-call" /> as any}
                    onClick={handleCallDirect}
                  >
                    Gọi
                  </Button>
              </Box>
          </Box>

          <Box className="px-4 mt-3">
              <Text.Title size="large" className="font-bold text-gray-800">
                  {shop.name}
              </Text.Title>
              <Box flex alignItems="center" className="mb-2 mt-1">
                    <Icon icon="zi-location" size={16} className="text-red-500 mr-1" />
                    {/* ĐÃ CẬP NHẬT: Chữ mặc định giống ảnh */}
                    <Text size="small" className="text-gray-600 line-clamp-2">
                      {shop.address || "Chào mừng bạn đến với chúng tôi."}
                    </Text>
              </Box>
          </Box>
      </Box>

      {/* --- TABS CHUYỂN ĐỔI --- */}
      <Box className="bg-white mt-2 px-4 border-b border-gray-100 sticky top-0 z-20">
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <Tabs.Tab key="services" label="Dịch vụ & Sản phẩm" />
              <Tabs.Tab key="info" label="Thông tin" />
          </Tabs>
      </Box>

      {/* --- NỘI DUNG TABS --- */}
      <Box className="p-4">
          {activeTab === "services" ? (
              // TAB 1: DANH SÁCH DỊCH VỤ
              loading ? <Box flex justifyContent="center" py={10}><Spinner /></Box> :
              (displayedServices.length > 0 || isOwner) ? (
                <Box>
                  {/* 👇 THANH CHUYỂN ĐỔI TAB ĐÃ DUYỆT / CHỜ DUYỆT (CHỈ CHỦ SHOP) 👇 */}
                  {isOwner && (() => {
                    const countApproved = services.filter((item: any) => item.status !== 'pending' && item.status !== 'rejected' && item.status !== 'deleted').length;
                    const countPending = services.filter((item: any) => item.status === 'pending').length;
                    const countRejected = services.filter((item: any) => item.status === 'rejected').length;
                    const countDeleted = services.filter((item: any) => item.status === 'deleted').length;

                    return (
                      <Box flex className="mb-4 bg-gray-100 p-1 rounded-lg border border-gray-200 gap-1 overflow-x-auto hide-scroll">
                        <div
                          onClick={() => setSubTab('approved')}
                          className={`flex-1 min-w-[80px] text-center py-2 text-[10px] font-bold rounded-md cursor-pointer transition-all duration-200 ${
                            subTab === 'approved' 
                              ? 'bg-white text-green-800 shadow-sm border border-gray-200' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Đã duyệt ({countApproved})
                        </div>
                        <div
                          onClick={() => setSubTab('pending')}
                          className={`flex-1 min-w-[80px] text-center py-2 text-[10px] font-bold rounded-md cursor-pointer transition-all duration-200 ${
                            subTab === 'pending' 
                              ? 'bg-white text-yellow-800 shadow-sm border border-gray-200' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Chờ duyệt ({countPending})
                        </div>
                        <div
                          onClick={() => setSubTab('rejected')}
                          className={`flex-1 min-w-[80px] text-center py-2 text-[10px] font-bold rounded-md cursor-pointer transition-all duration-200 ${
                            subTab === 'rejected' 
                              ? 'bg-white text-red-800 shadow-sm border border-gray-200' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Từ chối ({countRejected})
                        </div>
                        <div
                          onClick={() => setSubTab('deleted')}
                          className={`flex-1 min-w-[80px] text-center py-2 text-[10px] font-bold rounded-md cursor-pointer transition-all duration-200 ${
                            subTab === 'deleted' 
                              ? 'bg-white text-gray-800 shadow-sm border border-gray-200' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          Đã xóa ({countDeleted})
                        </div>
                      </Box>
                    );
                  })()}

                  {/* 👇 THANH LỌC DANH MỤC DẠNG PILLS TRƯỢT NGANG 👇 */}
                  {categoriesList.length > 1 && (
                    <Box className="w-full mb-4">
                      <Box className="flex overflow-x-auto gap-2 pb-2 hide-scroll" style={{ whiteSpace: "nowrap" }}>
                        {categoriesList.map(cat => {
                          const isSelected = selectedCategory === cat;
                          return (
                            <div
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 border ${
                                isSelected 
                                  ? "bg-green-700 text-white border-green-700 shadow-sm" 
                                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {cat}
                            </div>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                  
                  <Box className="grid grid-cols-2 gap-3">
                    {/* 👇 BỔ SUNG NÚT THÊM SẢN PHẨM Ở ĐÂY NẾU LÀ CHỦ SHOP 👇 */}
                    {isOwner && (
                        <Box
                           onClick={() => navigate("/post-service")}
                           className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden active:opacity-70 flex flex-col justify-center items-center cursor-pointer min-h-[220px]"
                        >
                            <Icon icon="zi-plus-circle" size={40} className="text-gray-400 mb-2" />
                            <Text className="text-gray-500 font-medium">Thêm Mặt hàng</Text>
                        </Box>
                    )}
                    {paginatedServices.map((item) => (
                        <Box
                          key={item.id}
                          onClick={() => {
                            if (isOwner) {
                              setActionProduct(item);
                            } else {
                              navigate(`/detail/${item.id}`, { state: { product: item } });
                            }
                          }}
                          className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 active:opacity-75 flex flex-col cursor-pointer"
                        >
                            <Box className="relative pt-[100%]">
                                <img src={item.image || "https://via.placeholder.com/150"} className="absolute inset-0 w-full h-full object-cover" alt="Product" />
                                
                                {/* 👇 BỔ SUNG: HIỂN THỊ ĐIỂM TÍCH LŨY 👇 */}
                                {item.points && (
                                    <div className="absolute top-2 right-2 bg-yellow-400 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm z-10">
                                        +{item.points} điểm
                                    </div>
                                )}

                                {/* 👉 Trạng thái duyệt dành cho chủ shop */}
                                {isOwner && (
                                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm z-10 ${
                                      item.status === 'pending' ? 'bg-yellow-500 text-white' : 
                                      item.status === 'rejected' ? 'bg-red-500 text-white' : 
                                      item.status === 'deleted' ? 'bg-gray-500 text-white' : 
                                      'bg-green-600 text-white'
                                    }`}>
                                        {item.status === 'pending' ? 'Pending' : 
                                         item.status === 'rejected' ? 'Rejected' :
                                         item.status === 'deleted' ? 'Deleted' : 'Active'}
                                    </div>
                                )}
                            </Box>
                            <Box p={2} className="flex-1 flex flex-col justify-between">
                                <Text size="small" className="line-clamp-2 font-medium h-10 mb-1 text-gray-700">
                                  {item.title || item.name}
                                </Text>
                                {/* 👇 HIỂN THỊ GIÁ DỰA TRÊN CÔNG TẮC ADMIN 👇 */}
                                {showPrice ? (
                                    <Box mt={2}>
                                        <Text size="small" bold className="text-orange-600">
                                            {Number(item.price || 0).toLocaleString()}đ
                                        </Text>
                                        
                                        {/* 👉 HIỂN THỊ GIÁ GỐC GẠCH NGANG & % GIẢM GIÁ */}
                                        {Number(item.originalPrice) > Number(item.price) && (
                                            <Box flex alignItems="center" className="mt-0.5">
                                                <Text size="xSmall" className="text-gray-400 line-through mr-1.5">
                                                    {Number(item.originalPrice).toLocaleString()}đ
                                                </Text>
                                                <Text size="xxxxSmall" className="bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">
                                                    -{Math.round(((Number(item.originalPrice) - Number(item.price)) / Number(item.originalPrice)) * 100)}%
                                                </Text>
                                            </Box>
                                        )}
                                    </Box>
                                ) : (
                                    <Text size="xSmall" bold className="text-blue-600 mt-2 italic">
                                      Liên hệ báo giá
                                    </Text>
                                )}
                            </Box>
                        </Box>
                    ))}
                    {displayedServices.length > visibleCount && (
                      <Box ref={sentinelRef} className="py-4 flex justify-center items-center col-span-2">
                        <Spinner visible />
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box py={10} className="text-center bg-white rounded-2xl border border-dashed border-gray-200">
                    <Icon icon="zi-note" size={40} className="text-gray-200 mb-2" />
                    <Text size="small" className="text-gray-400 italic">Cửa hàng chưa có bài đăng nào.</Text>
                </Box>
              )
          ) : (
              // TAB 2: THÔNG TIN CỬA HÀNG VÀ CƠ SỞ
              <Box className="flex flex-col gap-3 animate-fade-in">
                  <Box className="p-4 bg-indigo-900 rounded-2xl text-white flex items-center justify-between shadow-lg shadow-indigo-100 mb-2">
                      <Box>
                          <Text size="small" className="font-bold">Hệ thống đối tác tin cậy</Text>
                          <Text size="xxxxSmall" className="opacity-80">Cam kết chất lượng dịch vụ chuẩn 5 sao</Text>
                      </Box>
                      <Icon icon="zi-check-circle-solid" size={32} className="opacity-50"/>
                  </Box>

                  <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <Box flex alignItems="center" className="mb-2">
                          <Icon icon="zi-info-circle" className="text-blue-500 mr-2" />
                          <Text className="font-bold text-gray-800">Giới thiệu cửa hàng</Text>
                      </Box>
                      <Text size="small" className="text-gray-600 text-justify leading-relaxed whitespace-pre-wrap">
                          {shop.description}
                      </Text>
                  </Box>

                  <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <Box flex alignItems="center" className="mb-3">
                          <Icon icon="zi-user" className="text-green-600 mr-2" />
                          <Text className="font-bold text-gray-800">Thông tin quản lý</Text>
                      </Box>
                      <Box className="flex flex-col gap-2">
                          <Box flex alignItems="center">
                              <Text size="small" className="text-gray-400 w-24 shrink-0">Người quản lý:</Text>
                              <Text size="small" className="text-gray-700 font-medium">
                                  {shop.managerName || "Chưa cập nhật"}
                              </Text>
                          </Box>
                          <Box flex alignItems="center">
                              <Text size="small" className="text-gray-400 w-24 shrink-0">Số điện thoại:</Text>
                              <Text size="small" className="text-gray-700 font-medium">
                                  {shop.phone || "Chưa cập nhật"}
                              </Text>
                          </Box>
                      </Box>
                  </Box>

                  <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <Box flex alignItems="center" className="mb-3">
                          <Icon icon="zi-location" className="text-red-500 mr-2" />
                          <Text className="font-bold text-gray-800">Địa chỉ cửa hàng</Text>
                      </Box>
                      <Box className="flex items-start">
                          <Icon icon="zi-location-solid" size={14} className="mt-0.5 mr-1 text-gray-400" />
                          <Text size="small" className="text-gray-600">
                              {shop.address || "Chưa cập nhật địa chỉ chi tiết."}
                          </Text>
                      </Box>
                  </Box>
              </Box>
          )}
      </Box>


      {/* SHEET HỎI TÁC VỤ CHO CHỦ SHOP */}
      <Sheet
        visible={!!actionProduct}
        onClose={() => setActionProduct(null)}
        autoHeight
        title="Tùy chọn sản phẩm"
      >
        <Box className="p-2 pb-6">
          <Box 
            className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700 transition-colors"
            onClick={() => {
              const prod = actionProduct;
              setActionProduct(null);
              navigate("/post-service", { state: { product: prod } });
            }}
          >
            <Icon icon="zi-edit-text" className="mr-3 text-2xl text-indigo-500" />
            <Text className="text-[16px] font-medium">Chỉnh sửa thông tin</Text>
          </Box>

          <Box 
            className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-red-600 transition-colors mt-2 border-t border-gray-100"
            onClick={() => {
              const prod = actionProduct;
              setActionProduct(null);
              handleDeleteService(prod.id);
            }}
          >
            <Icon icon="zi-delete" className="mr-3 text-2xl text-red-500" />
            <Text className="text-[16px] font-medium">Xóa sản phẩm này</Text>
          </Box>
        </Box>
      </Sheet>

    </Page>
  );
};

export default ShopPublicView;