import React, { useEffect, useState } from "react";
// 👉 Đã thêm "Modal" vào danh sách import
import { Page, Header, Box, Text, Avatar, Button, Icon, Tabs, useSnackbar, Spinner, Modal } from "zmp-ui";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { openPhone, openChat } from "zmp-sdk/apis";

const ShopDetailPage: React.FunctionComponent = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();
  const { openSnackbar } = useSnackbar();
  const stateData = location.state || {};

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
  // 👇 BƯỚC 1: STATE QUẢN LÝ DANH MỤC SẢN PHẨM 👇
  const [categories, setCategories] = useState<string[]>(['Tất cả']);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');

  // 👉 THÊM MỚI: Biến trạng thái quản lý việc mở Pop-up Gọi/Chat
  const [contactModal, setContactModal] = useState<{visible: boolean, type: 'call' | 'chat'}>({
    visible: false, 
    type: 'call'
  });

  useEffect(() => {
    if (id) {
      fetchShopData();
    }
  }, [id]);

  useEffect(() => {
    if (shop.id || shop.name) {
      fetchShopServices();
    }
  }, [shop]);
  // 👉 BƯỚC 2: LOGIC NHẬN DIỆN CHỦ SHOP & HÀM XÓA BÀI ĐĂNG
  const currentUserPhone = localStorage.getItem("user_phone");
  // Kiểm tra xem SĐT người đang dùng App có trùng với ID/SĐT của Shop không
  const isOwner = currentUserPhone && (currentUserPhone === id || currentUserPhone === shop.phone || currentUserPhone === shop.id);

  const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation(); // 👉 Quan trọng: Ngăn không cho sự kiện click lan ra ngoài làm nhảy sang trang chi tiết
    
    if (confirm("Bạn có chắc chắn muốn xóa bài đăng này không?")) {
        try {
            await deleteDoc(doc(db, "services", postId));
            
            // Xóa thành công trên DB thì xóa luôn trên màn hình (không cần load lại trang)
            setServices(prev => prev.filter(s => s.id !== postId));
            openSnackbar({ text: "Đã xóa bài đăng thành công!", type: "success" });
        } catch (error) {
            console.error("Lỗi xóa bài:", error);
            openSnackbar({ text: "Lỗi hệ thống khi xóa!", type: "error" });
        }
    }
  };
  // 👇 THÊM MỚI: Hàm xử lý khi bấm nút Chỉnh sửa
  const handleEditPost = (e: React.MouseEvent, item: any) => {
    e.stopPropagation(); // Ngăn không cho click lan ra ngoài (không bị nhảy sang trang chi tiết)
    
    // Điều hướng sang trang chỉnh sửa (ví dụ: /edit-post) và truyền theo dữ liệu của bài đăng
    // Lưu ý: Bạn có thể thay đổi đường dẫn "/edit-post" cho khớp với router thực tế của bạn
    navigate(`/edit-post/${item.id}`, { state: { product: item } });
  };
  const fetchShopData = async () => {
    try {
      // 👇 TẢI CẤU HÌNH ADMIN (LẤY TRẠNG THÁI CÔNG TẮC GIÁ) 👇
      const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
      if (configSnap.exists() && configSnap.data().showPrice !== undefined) {
          setShowPrice(configSnap.data().showPrice);
      }

      // Tải thông tin Shop
      const shopDoc = await getDoc(doc(db, "users", id as string));
      if (shopDoc.exists()) {
        const data = shopDoc.data();
        setShop({ 
          id: shopDoc.id, 
          ...data,
          address: data?.address || "Chưa cập nhật địa chỉ",
          description: data?.description || "Cửa hàng này chưa có lời giới thiệu nào." 
        });
      }
    } catch (error) {
      console.error("Lỗi fetch shop:", error);
    }
  };

  const fetchShopServices = async () => {
    setLoading(true);
    try {
      const qId = query(collection(db, "services"), where("shopId", "==", shop.id || id));
      const snapId = await getDocs(qId);
      
      let list = snapId.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (list.length === 0 && shop.name) {
        const qName = query(collection(db, "services"), where("shopName", "==", shop.name));
        const snapName = await getDocs(qName);
        list = snapName.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      // 👇 Sửa .category thành .productCategory 👇
const extractedCategories = Array.from(new Set(list.map((item: any) => item.productCategory).filter(Boolean)));
setCategories(['Tất cả', ...extractedCategories as string[]]);
      
      setServices(list);
    } catch (error) {
      console.error("Lỗi lấy bài đăng:", error);
    } finally {
      setLoading(false);
    }
  };

  // 👉 THÊM MỚI: Hàm xử lý khi khách bấm chọn 1 cơ sở trong Pop-up
  const handleContactSelect = (contact: any) => {
    if (contactModal.type === 'call') {
      // Xử lý GỌI ĐIỆN
      if (contact.phone) {
        openPhone({ phoneNumber: contact.phone });
      } else {
        openSnackbar({ text: "Cơ sở này chưa cập nhật số điện thoại", type: "warning" });
      }
    } else {
      // Xử lý CHAT ZALO
      // Ưu tiên dùng số điện thoại của cơ sở đó làm ID chat (giống logic lưu dữ liệu của bạn)
      const targetId = contact.phone || shop.id; 
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
    // Chọn xong thì đóng Pop-up lại
    setContactModal({ ...contactModal, visible: false });
  };

  // 👉 THÊM MỚI: Gộp Trung tâm chính và các Cơ sở con thành 1 danh sách
  const contactList = [
    { isMain: true, name: `${shop.name} (Trung tâm chính)`, phone: shop.phone, address: shop.address },
    // Dấu ... giúp rải đều các cơ sở con vào mảng
    ...(shop.locations || []).map((loc: any, idx: number) => ({
      isMain: false,
      name: loc.name || `Cơ sở ${idx + 1}`,
      phone: loc.phone,
      address: loc.address
    }))
  ];
  // 👇 Sửa .category thành .productCategory 👇
const filteredServices = selectedCategory === 'Tất cả' 
? services 
: services.filter(item => item.productCategory === selectedCategory);
  return (
    <Page className="bg-gray-50 pb-10">
      <Header title={typeof shop.name === 'string' ? shop.name : "Cửa hàng"} />
      
      <Box className="relative bg-white pb-4 overflow-hidden">
          <Box className="h-48 w-full bg-gray-200">
              {shop.cover ? (
                  <img src={shop.cover} className="w-full h-full object-cover" alt="Banner" />
              ) : (
                  <Box className="w-full h-full bg-gradient-to-r from-orange-400 to-orange-600" />
              )}
              <Box className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </Box>

          <Box className="px-4 -mt-12 flex items-end justify-between relative z-10">
              <Avatar src={shop.avatar} size={88} className="border-4 border-white shadow-lg rounded-2xl bg-white" />
              
              {/* 👉 ĐÃ CẬP NHẬT: Sửa 2 nút bấm để mở Pop-up thay vì gọi ngay lập tức */}
              <Box className="flex gap-2 mb-1">
                  <Button 
                    size="small" variant="secondary" prefix={<Icon icon="zi-chat" /> as any} 
                    onClick={() => setContactModal({ visible: true, type: 'chat' })}>
                    Chat
                  </Button>
                  <Button 
                    size="small" prefix={<Icon icon="zi-call" /> as any} 
                    onClick={() => setContactModal({ visible: true, type: 'call' })}>
                    Gọi
                  </Button>
              </Box>
          </Box>

          <Box className="px-4 mt-3">
              <Text bold size="large">{shop.name}</Text>
              <Box flex alignItems="center" className="mb-2">
                    <Icon icon="zi-location" size={18} className="text-red-500 mr-2" />
                    <Text size="small" className="text-gray-600 line-clamp-2">
                      {shop.address || "Chào mừng bạn đến với chúng tôi."}
                    </Text>
                </Box>
          </Box>
      </Box>

      <Box className="bg-white mt-2 px-4 border-b">
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <Tabs.Tab key="services" label="Dịch vụ & Sản phẩm" />
              <Tabs.Tab key="info" label="Thông tin" />
          </Tabs>
      </Box>

      <Box className="p-4">
          {activeTab === "services" ? (
              loading ? <Box flex justifyContent="center" py={10}><Spinner /></Box> :
              services.length > 0 ? (
                <Box>
                    {/* 👇 BƯỚC 4a: THANH BỘ LỌC DANH MỤC 👇 */}
                    {categories.length > 1 && (
                        <Box className="flex overflow-x-auto gap-2 pb-3 mb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            {categories.map((cat, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap border cursor-pointer transition-all ${
                                        selectedCategory === cat
                                            ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {cat}
                                </div>
                            ))}
                        </Box>
                    )}

                    {/* 👇 BƯỚC 4b: ĐỔI services.map THÀNH filteredServices.map 👇 */}
                    <Box className="grid grid-cols-2 gap-3">
                        {filteredServices.map((item) => (
                            <Box 
                                key={item.id} 
                                onClick={() => navigate(`/detail/${item.id}`, { state: { product: item } })} 
                                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 active:opacity-70 flex flex-col"
                            >
                                <Box className="relative pt-[100%]">
                                    <img src={item.image || "https://via.placeholder.com/150"} className="absolute inset-0 w-full h-full object-cover" alt="Product" />
                                    
                                    {item.points && (
                                        <div className="absolute top-2 left-2 bg-yellow-400 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm z-10">
                                            +{item.points} điểm
                                        </div>
                                    )}

                                    {isOwner && (
                                        <Box className="absolute top-2 right-2 flex gap-2 z-10">
                                            <Box 
                                                className="bg-white/90 backdrop-blur-sm w-8 h-8 flex items-center justify-center rounded-full shadow-md active:bg-blue-50"
                                                onClick={(e) => handleEditPost(e, item)}
                                            >
                                                <Icon icon="zi-edit-text" className="text-blue-500" size={18} />
                                            </Box>
                                            <Box 
                                                className="bg-white/90 backdrop-blur-sm w-8 h-8 flex items-center justify-center rounded-full shadow-md active:bg-red-50"
                                                onClick={(e) => handleDeletePost(e, item.id)}
                                            >
                                                <Icon icon="zi-delete" className="text-red-500" size={18} />
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                                <Box p={2} className="flex-1 flex flex-col justify-between">
                                    <Text size="small" className="line-clamp-2 font-medium h-10 mb-1">
                                    {item.title || item.name}
                                    </Text>
                                    {showPrice ? (
                                        <Text size="small" bold className="text-orange-600">
                                        {Number(item.price || 0).toLocaleString()}đ
                                        </Text>
                                    ) : (
                                        <Text size="xSmall" bold className="text-blue-600 italic mt-1">
                                        Liên hệ báo giá
                                        </Text>
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
              ) : (
                <Box py={10} className="text-center bg-white rounded-xl border border-dashed border-gray-200">
                    <Icon icon="zi-note" size={40} className="text-gray-200 mb-2" />
                    <Text size="small" className="text-gray-400 italic">Cửa hàng chưa có bài đăng nào.</Text>
                </Box>
              )
          ) : (
              <Box className="flex flex-col gap-3">
                  <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <Box flex alignItems="center" className="mb-2">
                          <Icon icon="zi-info-circle" className="text-blue-500 mr-2" />
                          <Text bold className="text-gray-800">Giới thiệu cửa hàng</Text>
                      </Box>
                      <Text size="small" className="text-gray-600 text-justify leading-relaxed whitespace-pre-wrap">
                          {shop.description}
                      </Text>
                  </Box>

                  <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <Box flex alignItems="center" className="mb-3">
                          <Icon icon="zi-location" className="text-red-500 mr-2" />
                          <Text bold className="text-gray-800">Hệ thống cơ sở</Text>
                      </Box>

                      {shop.locations && shop.locations.length > 0 ? (
                          <Box className="flex flex-col gap-3">
                              {shop.locations.map((loc: any, index: number) => (
                                  <Box key={index} className="pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                      <Text size="small" bold className="text-gray-700 mb-1">
                                          {loc.name || `Cơ sở ${index + 1}`}
                                      </Text>
                                      <Text size="small" className="text-gray-600 flex items-start">
                                          <Icon icon="zi-location-solid" size={14} className="mt-0.5 mr-1 text-gray-400" />
                                          <span className="flex-1">{loc.address}</span>
                                      </Text>
                                      {loc.phone && (
                                          <Text size="small" className="text-blue-600 mt-1 flex items-center">
                                              <Icon icon="zi-call" size={14} className="mr-1" />
                                              {loc.phone}
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

      {/* 👉 THÊM MỚI: Giao diện Modal Pop-up Liên hệ */}
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
                          <Text size="small" bold className="text-gray-800 mb-1">{contact.name}</Text>
                          {contact.phone && (
                              <Text size="xSmall" className="text-blue-600 font-bold mb-1 flex items-center">
                                  <Icon icon="zi-call" size={12} className="mr-1 text-gray-400" /> {contact.phone}
                              </Text>
                          )}
                          <Text size="xSmall" className="text-gray-500 line-clamp-2">{contact.address}</Text>
                      </Box>
                      
                      {/* Cột icon bên phải (Hiển thị icon Gọi hoặc Chat tùy theo type) */}
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

export default ShopDetailPage;