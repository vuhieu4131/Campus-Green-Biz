import React, { FC, useEffect, useState } from "react";
import { Page, Header, Box, Text, Avatar, Button, Icon, Tabs, useSnackbar, Spinner, Modal } from "zmp-ui";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
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

  const isOwner = currentUserPhone && (currentUserPhone === shop.id || currentUserPhone === shop.phone || currentUserPhone === id);

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
          // Trường hợp 2: ID trên URL là zaloId / providerId
          const usersRef = collection(db, "users");
          const shopsRef = collection(db, "shops");
          
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
        
        // Dựa vào ảnh Database của bạn: trường lưu ID là 'providerId'
        let qServ = query(servicesRef, where("providerId", "==", id));
        let snapServ = await getDocs(qServ);

        // Các phương án dự phòng (phòng khi Database lưu bằng trường khác)
        if (snapServ.empty) {
            qServ = query(servicesRef, where("ownerPhone", "==", actualShopId));
            snapServ = await getDocs(qServ);
        }
        if (snapServ.empty) {
            qServ = query(servicesRef, where("shopId", "==", actualShopId));
            snapServ = await getDocs(qServ);
        }

        const list = snapServ.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Đã sửa lỗi TypeScript: ép kiểu để React chấp nhận hiển thị giá trị
        setServices(list as any[]);

      } catch (error) {
        console.error("Lỗi tải dữ liệu Shop:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChatDirect = () => {
    const targetId = shop.phone || shop.id || id;
    if (targetId) {
      openChat({
        type: "user",
        id: targetId,
        message: `Xin chào ${shop.name}, tôi cần tư vấn.`
      });
    } else {
      openSnackbar({ text: "Cửa hàng chưa có thông tin liên hệ Zalo", type: "warning" });
    }
  };

  const handleCallDirect = () => {
    if (shop.phone || id) {
      openPhone({ phoneNumber: shop.phone || id });
    } else {
      openSnackbar({ text: "Cửa hàng chưa cập nhật số điện thoại", type: "warning" });
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
              (services.length > 0 || isOwner) ? (
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
                    {services.map((item) => (
                        <Box
                          key={item.id}
                          onClick={() => navigate(`/detail/${item.id}`, { state: { product: item } })}
                          className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 active:opacity-70 flex flex-col cursor-pointer"
                        >
                            <Box className="relative pt-[100%]">
                                <img src={item.image || "https://via.placeholder.com/150"} className="absolute inset-0 w-full h-full object-cover" alt="Product" />
                                
                                {/* 👇 BỔ SUNG: HIỂN THỊ ĐIỂM TÍCH LŨY 👇 */}
                                {item.points && (
                                    <div className="absolute top-2 right-2 bg-yellow-400 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm z-10">
                                        +{item.points} điểm
                                    </div>
                                )}
                            </Box>
                            <Box p={2} className="flex-1 flex flex-col justify-between">
                                <Text size="small" className="line-clamp-2 font-medium h-10 mb-1 text-gray-700">
                                  {item.title || item.name}
                                </Text>
                                {/* ĐÃ CẬP NHẬT: Giá tiền màu cam, không có mũi tên */}
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


    </Page>
  );
};

export default ShopPublicView;