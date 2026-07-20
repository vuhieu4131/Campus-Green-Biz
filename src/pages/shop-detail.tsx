import React, { useEffect, useState } from "react";
// 👉 Đã thêm "Modal" vào danh sách import
import { Page, Header, Box, Text, Avatar, Button, Icon, Tabs, useSnackbar, Spinner, Modal } from "zmp-ui";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { getValidAvatar } from "../utils/avatar";
import { db } from "../firebase";
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
      let shopDoc = await getDoc(doc(db, "shops", id as string));
      if (!shopDoc.exists()) {
          shopDoc = await getDoc(doc(db, "users", id as string));
      }
      
      let shopData: any = null;
      let shopIdReal = id as string;
      
      if (shopDoc.exists()) {
        shopData = shopDoc.data();
      } else {
        // Fallback: Query by phone or id field
        const qShops = query(collection(db, "shops"), where("phone", "==", id));
        const snapShops = await getDocs(qShops);
        if (!snapShops.empty) {
          shopData = snapShops.docs[0].data();
          shopIdReal = snapShops.docs[0].id;
        } else {
          const qUsers = query(collection(db, "users"), where("phone", "==", id));
          const snapUsers = await getDocs(qUsers);
          if (!snapUsers.empty) {
            shopData = snapUsers.docs[0].data();
            shopIdReal = snapUsers.docs[0].id;
          }
        }
      }

      if (shopData) {
        setShop({ 
          id: shopIdReal, 
          ...shopData,
          name: shopData?.name || shopData?.shopName || shopData?.fullName || "Chưa có tên",
          address: shopData?.address || "Chưa cập nhật địa chỉ",
          description: shopData?.description || "Cửa hàng này chưa có lời giới thiệu nào." 
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
      
      list = list.filter((item: any) => item.status !== "pending" && item.status !== "rejected" && item.status !== "deleted");
      
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
    if (shop.phone) {
      openPhone({ phoneNumber: shop.phone });
    } else {
      openSnackbar({ text: "Cửa hàng chưa cập nhật số điện thoại", type: "warning" });
    }
  };
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
              <img src={getValidAvatar(shop.avatar, shop.id)} style={{ width: 88, height: 88, objectFit: "cover" }} className="border-4 border-white shadow-lg rounded-2xl bg-white" alt="Shop Avatar" />
              
              {/* 👉 ĐÃ CẬP NHẬT: Sửa 2 nút bấm để mở Pop-up thay vì gọi ngay lập tức */}
              <Box className="flex gap-2 mb-1">
                  <Button 
                    size="small" variant="secondary" prefix={<Icon icon="zi-chat" /> as any} 
                    onClick={handleChatDirect}>
                    Chat
                  </Button>
                  <Button 
                    size="small" prefix={<Icon icon="zi-call" /> as any} 
                    onClick={handleCallDirect}>
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
                                        <Box flex flexDirection="column">
                                            {/* 1. Hiển thị Giá bán (Thực thu) */}
                                            <Text size="small" bold className="text-orange-600">
                                                {Number(item.price || 0).toLocaleString()}đ
                                            </Text>
                                            
                                            {/* 2. Kiểm tra: Nếu có Giá gốc > Giá bán thì mới hiển thị phần gạch ngang */}
                                            {Number(item.originalPrice) > Number(item.price) && Number(item.price) > 0 && (
                                                <Box flex alignItems="center" className="mt-0.5 gap-1.5">
                                                    {/* Giá gốc gạch ngang */}
                                                    <Text size="xxxxSmall" className="text-gray-400 line-through decoration-red-500">
                                                        {Number(item.originalPrice).toLocaleString()}đ
                                                    </Text>
                                                    
                                                    {/* Nhãn % giảm giá */}
                                                    <Box className="bg-red-50 border border-red-200 text-red-600 px-1 rounded text-[9px] font-bold">
                                                        -{item.discountPercent || Math.round(((Number(item.originalPrice) - Number(item.price)) / Number(item.originalPrice)) * 100)}%
                                                    </Box>
                                                </Box>
                                            )}
                                        </Box>
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
                          <Icon icon="zi-user" className="text-green-600 mr-2" />
                          <Text bold className="text-gray-800">Thông tin quản lý</Text>
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
                          <Text bold className="text-gray-800">Địa chỉ cửa hàng</Text>
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

export default ShopDetailPage;