import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { useSetRecoilState, useRecoilValue, useRecoilValueLoadable } from 'recoil';
import { cartState, userState, totalQuantityState } from 'state';
import { Page, Box, Text, Avatar, Icon, Input, useNavigate, Sheet, Button, useSnackbar } from "zmp-ui";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Chào buổi sáng,";
  } else if (hour >= 12 && hour < 18) {
    return "Chào buổi chiều,";
  } else {
    return "Chào buổi tối,";
  }
};

const StoreWelcome: FC = () => {
  const navigate = useNavigate();
  const userInfoLoadable = useRecoilValueLoadable(userState);
  const userInfo = userInfoLoadable.state === "hasValue" ? userInfoLoadable.contents : null;
  const cartQuantity = useRecoilValue(totalQuantityState);

  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const avatar = userInfo?.avatar || userData?.avatar || "https://i.pravatar.cc/150?img=11";
  const name = userInfo?.name || userData?.fullName || userData?.name || "Đức";
  const points = userData?.spendingPoints ?? userData?.points ?? 150;
  const greeting = getGreeting();

  return (
    <Box className="bg-[#14502e] rounded-b-[30px] pt-10 pb-10 px-4 relative shadow-md">
      <Box className="flex justify-between items-center">
        {/* TRÁI: Avatar, Lời chào & Điểm xanh */}
        <Box 
          className="flex items-center space-x-2.5 cursor-pointer flex-1"
          onClick={() => navigate('/profile')}
        >
          <Avatar src={avatar} size={44} className="border border-white/50 shadow-sm" />
          <Box>
            <Box className="flex items-center space-x-1.5 mb-0.5">
              <Text className="text-white/80 text-xs">{greeting}</Text>
              <Text className="text-white font-bold text-sm truncate max-w-[120px]">{name}</Text>
            </Box>
            <Box className="bg-white/25 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center w-fit border border-white/20 shadow-sm">
              <CustomIcon icon="zi-star-solid" className="text-yellow-400 text-[10px] mr-1" />
              <Text size="xxxxSmall" className="text-white font-bold text-[10px]">{points} Điểm Xanh</Text>
            </Box>
          </Box>
        </Box>

        {/* PHẢI: Nút Tìm Kiếm & Nút Giỏ Hàng */}
        <Box className="flex items-center space-x-3 text-white">
          {/* Nút Tìm Kiếm */}
          <Box 
            className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/25 cursor-pointer relative shadow-sm hover:bg-white/30 transition-colors"
            onClick={() => navigate('/search')}
          >
            <CustomIcon icon="zi-search" className="text-white text-lg" />
          </Box>

          {/* Nút Giỏ Hàng */}
          <Box 
            className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/25 cursor-pointer relative shadow-sm hover:bg-white/30 transition-colors"
            onClick={() => navigate('/cart')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            {cartQuantity > 0 && (
              <Box className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full border border-[#14502e] font-bold">
                {cartQuantity}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const StoreBanner: FC = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const q = query(collection(db, "banners"));
        const querySnapshot = await getDocs(q);
        const bannerList = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as any))
          .filter((b) => (b.type === "store" || !b.type) && b.active !== false)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setBanners(bannerList);
      } catch (e) {
        console.error("Lỗi khi tải banners:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, []);

  if (loading || banners.length === 0) {
    return (
      <Box className="px-4 mt-6">
        <Box className="bg-gradient-to-r from-[#14502e] to-[#22c55e] rounded-2xl p-4 flex justify-between items-center text-white relative overflow-hidden shadow-md">
          <Box className="relative z-10 w-2/3">
            <Text className="font-bold text-lg leading-tight mb-1">Ưu Đãi Đặc Biệt<br/>Tháng 10</Text>
            <Text size="xSmall" className="text-white/80 mb-2">Giảm 25% cho sản phẩm Xanh</Text>
            <Box className="bg-white text-[#14502e] inline-block px-3 py-1 rounded-full text-xs font-bold shadow-md cursor-pointer">
              Mua Ngay
            </Box>
          </Box>
          <Box className="w-1/3 flex justify-end relative z-10">
            {/* Placeholder cho ảnh sản phẩm trong banner */}
            <Box className="w-16 h-16 bg-white/20 rounded-xl backdrop-blur-sm border border-white/30 flex items-center justify-center">
              <CustomIcon icon="zi-poll" className="text-white text-3xl" />
            </Box>
          </Box>
          {/* Vòng tròn trang trí */}
          <Box className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-md" />
        </Box>
      </Box>
    );
  }

  return (
    <Box className="bg-transparent mt-6" pb={2}>
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{
          clickable: true,
        }}
        autoplay={{
          delay: 2000,
          disableOnInteraction: false,
        }}
        loop
      >
        {banners.map((banner, i) => {
          // Tính toán mã hash đơn giản từ id để chọn ảnh và đường dẫn cố định, tránh bị đổi ngẫu nhiên mỗi lần render
          const seed = banner.id ? banner.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : i;
          
          // Link ảnh ngẫu nhiên nếu không điền
          const bannerImage = banner.image && banner.image.trim() !== "" 
            ? banner.image 
            : `https://stc-zmp.zadn.vn/templates/zaui-coffee/dummy/banner-${(seed % 5) + 1}.webp`;

          // Link điều hướng ngẫu nhiên nếu không điền
          const fallbackRoutes = ["/profile", "/notification", "/cart", "/wallet", "/"];
          const bannerLink = banner.link && banner.link.trim() !== "" 
            ? banner.link 
            : fallbackRoutes[seed % fallbackRoutes.length];

          return (
            <SwiperSlide key={banner.id || i} className="px-4">
              <Box
                className="w-full rounded-2xl aspect-[2.3/1] bg-cover bg-center bg-skeleton shadow-md cursor-pointer"
                style={{ backgroundImage: `url(${bannerImage})` }}
                onClick={() => {
                  if (bannerLink) {
                    navigate(bannerLink);
                  }
                }}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>
    </Box>
  );
};

const StoreCategories: FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, "categories"), orderBy("createdAt", "asc"));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
        setCategories(list);
      } catch (e) {
        console.error("Lỗi khi tải danh mục:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const displayCategories = categories.length > 0 ? categories : [
    { icon: "zi-memory", name: "Công nghệ" },
    { icon: "zi-star", name: "Thời trang" },
    { icon: "zi-note", name: "Góc học tập" },
    { icon: "zi-location", name: "Phòng trọ" },
    { icon: "zi-shopping-bag", name: "Ăn uống" },
    { icon: "zi-group", name: "Tiện ích cộng đồng" }
  ];

  return (
    <Box className="px-4 mt-6 flex space-x-4 overflow-x-auto custom-scrollbar pb-3">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(20, 80, 70, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #14502e;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1e7041;
        }
      `}</style>
      {displayCategories.map((cat, idx) => (
        <Box key={cat.id || idx} className="flex flex-col items-center flex-shrink-0 w-[72px]">
          <Box className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2 text-[#14502e] active:scale-95 transition-transform cursor-pointer">
            <CustomIcon icon={cat.icon || "zi-store"} className="text-2xl" />
          </Box>
          <Text size="xxSmall" className="font-semibold text-gray-800 text-center leading-tight w-full break-words whitespace-normal line-clamp-2">{cat.name || cat.label}</Text>
        </Box>
      ))}
    </Box>
  );
};

const mockProducts = [
  { 
    id: "mock-1",
    name: "Bình nước tre", 
    image: "https://images.unsplash.com/photo-1606115915090-be18fea23ce7?w=500&fit=crop", 
    stars: 5,
    price: 120000,
    description: "Bình nước giữ nhiệt làm từ tre tự nhiên 100%, an toàn cho sức khỏe và thân thiện với môi trường."
  },
  { 
    id: "mock-2",
    name: "Túi vải canvas", 
    image: "https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=500&fit=crop", 
    stars: 4,
    price: 85000,
    description: "Túi tote vải canvas phong cách tối giản, bền chắc, dùng đi học hay đi chơi đều phù hợp."
  },
  { 
    id: "mock-3",
    name: "Xà phòng hữu cơ", 
    image: "https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=500&fit=crop", 
    stars: 5,
    price: 55000,
    description: "Xà phòng handmade chiết xuất từ thiên nhiên, làm sạch dịu nhẹ, không gây kích ứng da."
  },
  { 
    id: "mock-4",
    name: "Sổ tay tái chế", 
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&fit=crop", 
    stars: 5,
    price: 45000,
    description: "Sổ tay A5 bìa kraft làm từ giấy tái chế, thân thiện môi trường."
  },
];

const HotProducts: FC<{ products: any[]; onProductClick: (product: any) => void }> = ({ products, onProductClick }) => {
  return (
    <Box className="mt-6 mb-4">
      <Text.Title className="font-bold text-base text-[#14502e] mb-3 px-4">Sản phẩm Hot 🔥</Text.Title>
      <Box className="flex overflow-x-auto gap-3 pb-3 hide-scrollbar px-4">
        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        {products.map((p) => (
          <Box 
            key={p.id} 
            className="flex flex-col bg-white rounded-2xl p-3 shadow-md active:scale-95 transition-transform cursor-pointer flex-shrink-0 w-[140px]" 
            onClick={() => onProductClick(p)}
          >
            <Box 
              className="w-full aspect-square rounded-xl bg-cover bg-center mb-2"
              style={{ backgroundImage: `url('${p.image || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"}')` }}
            />
            <Text className="font-semibold text-gray-800 text-xs line-clamp-2 min-h-[32px] leading-tight mb-1">{p.name || p.title}</Text>
            <Text className="font-bold text-[#14502e] text-xs">{(p.price || 0).toLocaleString('vi-VN')}đ</Text>
            <Box className="flex text-yellow-400 mt-1 space-x-0.5">
              {[...Array(5)].map((_, idx) => (
                <CustomIcon key={idx} icon={idx < (p.stars || 5) ? "zi-star-solid" : "zi-star"} className="text-[10px]" />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ProductsForYou: FC<{ products: any[]; onProductClick: (product: any) => void }> = ({ products, onProductClick }) => {
  return (
    <Box className="px-4 mt-4 mb-6">
      <Text.Title className="font-bold text-base text-[#14502e] mb-4">Sản phẩm dành cho bạn ✨</Text.Title>
      <Box className="grid grid-cols-2 gap-4">
        {products.map((p) => (
          <Box key={p.id} className="flex flex-col bg-white rounded-2xl p-3 shadow-md active:scale-95 transition-transform cursor-pointer" onClick={() => onProductClick(p)}>
            <Box 
              className="w-full aspect-[4/3] rounded-xl bg-cover bg-center mb-2"
              style={{ backgroundImage: `url('${p.image || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"}')` }}
            />
            <Text className="font-semibold text-gray-800 text-sm line-clamp-2 min-h-[40px] leading-tight mb-1">{p.name || p.title}</Text>
            <Text className="font-bold text-[#14502e] text-sm">{(p.price || 0).toLocaleString('vi-VN')}đ</Text>
            <Box className="flex text-yellow-400 mt-1 space-x-0.5">
              {[...Array(5)].map((_, idx) => (
                <CustomIcon key={idx} icon={idx < (p.stars || 5) ? "zi-star-solid" : "zi-star"} className="text-[12px]" />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ConsumerStorePage: FC = () => {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const [dbServices, setDbServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(collection(db, "services"));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(item => item.status === "approved" || !item.status);
        setDbServices(list);
      } catch (e) {
        console.error("Lỗi khi tải sản phẩm:", e);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        const finalPhone = phoneFromEmail || localPhone;

        if (finalPhone) {
          try {
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);

            if (!shopSnap.empty) {
              const shopId = shopSnap.docs[0].id;
              // Nếu là shop, đưa thẳng đến cửa hàng của shop
              navigate(`/shop-details/${shopId}`, { replace: true });
            }
          } catch (e) {
            console.error(e);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setQuantity(1);
    setSheetVisible(true);
  };

  const setCart = useSetRecoilState(cartState);
  const handleAddToCart = () => {
    setCart(cart => {
      const newCart = [...cart];
      const index = newCart.findIndex(i => i.product.id === selectedProduct.id);
      if (index >= 0) {
        newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + quantity };
      } else {
        newCart.push({ product: { ...selectedProduct, categoryId: ['store'] }, quantity, options: {} });
      }
      return newCart;
    });

    setSheetVisible(false);
    openSnackbar({
      text: `Đã thêm ${quantity} "${selectedProduct?.name}" vào giỏ hàng!`,
      prefixIcon: <CustomIcon icon="zi-check-circle-2" className="text-green-500 mr-2" />,
      icon: false,
      duration: 3000
    });
  };

  const vipServices = dbServices.filter(item => item.isVip === true);
  const normalServices = dbServices.filter(item => item.isVip !== true);

  const hotList = vipServices.length > 0 ? vipServices : dbServices.slice(0, Math.ceil(dbServices.length / 2) || 1);
  const forYouList = normalServices.length > 0 ? normalServices : dbServices.slice(Math.ceil(dbServices.length / 2));
  
  const finalHotList = hotList.length > 0 ? hotList : mockProducts;
  const finalForYouList = forYouList.length > 0 ? forYouList : mockProducts;

  return (
    <Page className="bg-[#f0fdf4] overflow-y-auto pb-20">
      <StoreWelcome />
      <StoreBanner />
      <StoreCategories />
      <HotProducts products={finalHotList} onProductClick={handleProductClick} />
      <ProductsForYou products={finalForYouList} onProductClick={handleProductClick} />

      <Sheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        autoHeight
      >
        {selectedProduct && (
          <Box className="pb-4 relative bg-white">
            <Box className="p-4 flex space-x-4 border-b border-gray-100">
              <img src={selectedProduct.image} alt={selectedProduct.name} className="w-24 h-24 object-cover rounded-xl shadow-sm border border-gray-100" />
              <Box className="flex-1 pt-1">
                <Text className="text-xl font-bold text-[#14502e] mb-1">{selectedProduct.price.toLocaleString('vi-VN')}đ</Text>
                <Text className="text-gray-800 font-semibold leading-tight">{selectedProduct.name}</Text>
                <Text className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{selectedProduct.description}</Text>
              </Box>
            </Box>
            
            <Box className="p-4 flex justify-between items-center border-b border-gray-100">
              <Text className="font-semibold text-gray-800">Số lượng</Text>
              <Box className="flex items-center space-x-3 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                <Box 
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm active:bg-gray-200 cursor-pointer text-gray-600"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </Box>
                <Text className="font-bold w-6 text-center text-gray-800">{quantity}</Text>
                <Box 
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm active:bg-gray-200 cursor-pointer text-gray-600"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <CustomIcon icon="zi-plus" size={16} />
                </Box>
              </Box>
            </Box>

            <Box className="p-4 flex space-x-3 mt-2">
              <Button 
                className="flex-1 bg-green-50 text-[#14502e] border border-[#14502e] font-semibold rounded-xl h-12 flex items-center justify-center shadow-sm"
                onClick={handleAddToCart}
              >
                Thêm vào giỏ
              </Button>
              <Button 
                className="flex-1 bg-[#14502e] text-white font-bold rounded-xl h-12 flex items-center justify-center shadow-sm"
                onClick={handleAddToCart}
              >
                Mua ngay
              </Button>
            </Box>
            
            <Box className="absolute top-2 right-2 p-2 cursor-pointer z-10" onClick={() => setSheetVisible(false)}>
              <CustomIcon icon="zi-close-circle" className="text-gray-400 text-2xl" />
            </Box>
          </Box>
        )}
      </Sheet>
    </Page>
  );
};

export default ConsumerStorePage;
