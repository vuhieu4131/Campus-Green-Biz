import React, { FC, useEffect, useState } from "react";
import { Page, Header, Box, Text, Avatar, Button, Icon, Tabs, useSnackbar, Spinner, Modal } from "zmp-ui";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
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
        // 👇 1. TẢI CẤU HÌNH ADMIN (LẤY TRẠNG THÁI CÔNG TẮC GIÁ) 👇
        const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
        if (configSnap.exists() && configSnap.data().showPrice !== undefined) {
            setShowPrice(configSnap.data().showPrice);
        }
        let currentShopData: any = null;
        let actualShopId = id; 

        // =========================================================
        // BƯỚC 1: LẤY THÔNG TIN CỬA HÀNG TỪ BẢNG 'users'
        // =========================================================
        const shopDoc = await getDoc(doc(db, "users", id));
        
        if (shopDoc.exists()) {
          // Trường hợp 1: ID trên URL chính là Document ID (VD: Số điện thoại)
          currentShopData = shopDoc.data();
        } else {
          // Trường hợp 2: ID trên URL là zaloId / providerId (Dãy số 33686...)
          const usersRef = collection(db, "users");
          
          // Tìm user có zaloId khớp với dãy số này (Dựa theo logic detail.tsx của bạn)
          const qZalo = query(usersRef, where("zaloId", "==", id));
          const snapZalo = await getDocs(qZalo);

          if (!snapZalo.empty) {
             currentShopData = snapZalo.docs[0].data();
             actualShopId = snapZalo.docs[0].id; // Lấy ID thật (SĐT) để dùng dự phòng
          } else {
             // Tìm user có providerId khớp với dãy số này
             const qProvider = query(usersRef, where("providerId", "==", id));
             const snapProvider = await getDocs(qProvider);
             if (!snapProvider.empty) {
                 currentShopData = snapProvider.docs[0].data();
                 actualShopId = snapProvider.docs[0].id;
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

  // 4. LOGIC CHỌN CHI NHÁNH ĐỂ GỌI HOẶC CHAT ZALO
  const handleContactSelect = (contact: any) => {
    if (contactModal.type === 'call') {
      if (contact.phone) {
        openPhone({ phoneNumber: contact.phone });
      } else {
        openSnackbar({ text: "Cơ sở này chưa cập nhật số điện thoại", type: "warning" });
      }
    } else {
      const targetId = contact.phone || shop.id || id;
      if (targetId) {
        openChat({
          type: "user",
          id: targetId,
          message: `Xin chào ${contact.name}, tôi cần tư vấn.`
        });
      } else {
        openSnackbar({ text: "Cơ sở này chưa có thông tin liên hệ Zalo", type: "warning" });
      }
    }
    setContactModal({ ...contactModal, visible: false });
  };

  const contactList = [
    { isMain: true, name: `${shop.name} (Trung tâm chính)`, phone: shop.phone || id, address: shop.address },
    ...(shop.locations || []).map((loc: any, idx: number) => ({
      isMain: false,
      name: loc.name || `Cơ sở ${idx + 1}`,
      phone: loc.phone || loc.managerPhone,
      address: loc.address
    }))
  ];

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
                    onClick={() => setContactModal({ visible: true, type: 'chat' })}
                    className="bg-white text-blue-600 border border-blue-600"
                  >
                    Chat
                  </Button>
                  <Button
                    size="small" prefix={<Icon icon="zi-call" /> as any}
                    onClick={() => setContactModal({ visible: true, type: 'call' })}
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
              services.length > 0 ? (
                <Box className="grid grid-cols-2 gap-3">
                    {services.map((item) => (
                        <Box
                          key={item.id}
                          onClick={() => navigate(`/detail/${item.id}`, { state: { product: item } })}
                          className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 active:opacity-70 flex flex-col"
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
                                    <Text size="small" bold className="text-orange-600 mt-2">
                                      {Number(item.price || 0).toLocaleString()}đ
                                    </Text>
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
                          <Text className="font-bold text-gray-800">Hệ thống cơ sở</Text>
                      </Box>

                      {shop.locations && shop.locations.length > 0 ? (
                          <Box className="flex flex-col gap-3">
                              {shop.locations.map((loc: any, index: number) => (
                                  <Box key={index} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                      <Text size="small" className="font-bold text-gray-700 mb-1">
                                          {loc.name || `Cơ sở ${index + 1}`}
                                      </Text>
                                      <Text size="small" className="text-gray-600 flex items-start">
                                          <Icon icon="zi-location-solid" size={14} className="mt-0.5 mr-1 text-gray-400" />
                                          <span className="flex-1">{loc.address}</span>
                                      </Text>
                                      {(loc.phone || loc.managerPhone) && (
                                          <Text size="small" className="text-blue-600 mt-1 flex items-center">
                                              <Icon icon="zi-call" size={14} className="mr-1" />
                                              {loc.phone || loc.managerPhone}
                                          </Text>
                                      )}
                                  </Box>
                              ))}
                          </Box>
                      ) : (
                          <Box className="flex items-start">
                              <Icon icon="zi-location-solid" size={14} className="mt-0.5 mr-1 text-gray-400" />
                              <Text size="small" className="text-gray-600">
                                  {shop.address || "Chưa cập nhật địa chỉ chi tiết."}
                              </Text>
                          </Box>
                      )}
                  </Box>
              </Box>
          )}
      </Box>

      {/* --- MODAL CHỌN CHI NHÁNH ĐỂ GỌI / CHAT --- */}
      <Modal
          visible={contactModal.visible}
          title={contactModal.type === 'call' ? "Chọn cơ sở để gọi điện" : "Chọn cơ sở để nhắn tin Zalo"}
          onClose={() => setContactModal({ ...contactModal, visible: false })}
      >
          <Box className="max-h-[60vh] overflow-y-auto flex flex-col gap-3 p-2">
              {contactList.map((contact, index) => (
                  <Box
                      key={index}
                      onClick={() => handleContactSelect(contact)}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200 active:bg-blue-50 cursor-pointer flex items-center justify-between"
                  >
                      <Box className="flex-1 pr-3">
                          <Text size="small" className="font-bold text-gray-800 mb-1">{contact.name}</Text>
                          {contact.phone && (
                              <Text size="xSmall" className="text-blue-600 font-bold mb-1 flex items-center">
                                  <Icon icon="zi-call" size={12} className="mr-1 text-gray-400" /> {contact.phone}
                              </Text>
                          )}
                          <Text size="xSmall" className="text-gray-500 line-clamp-2">{contact.address}</Text>
                      </Box>

                      <Box className={`w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center ${contactModal.type === 'call' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                          <Icon icon={contactModal.type === 'call' ? 'zi-call' : 'zi-chat'} size={20} />
                      </Box>
                  </Box>
              ))}
          </Box>
      </Modal>
    </Page>
  );
};

export default ShopPublicView;