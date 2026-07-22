import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect, useRef } from "react";
import { useSetRecoilState, useRecoilValue, useRecoilValueLoadable } from 'recoil';
import { cartState, userState, totalQuantityState } from 'state';
import { Page, Box, Text, Avatar, Icon, Input, useNavigate, Sheet, Button, useSnackbar } from "zmp-ui";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot } from "firebase/firestore";
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const setCart = useSetRecoilState(cartState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.email !== "guest@campus.com") {
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        const finalPhone = phoneFromEmail || localPhone;

        let foundData: any = null;

        if (finalPhone) {
          try {
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);
            if (!shopSnap.empty) {
              foundData = { ...shopSnap.docs[0].data(), id: shopSnap.docs[0].id, role: "provider" };
            }
          } catch (e) {
            console.error(e);
          }
        }

        if (!foundData) {
          try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              foundData = { ...docSnap.data(), id: docSnap.id, role: docSnap.data().role || "user" };
            } else if (finalPhone) {
              const qUser = query(collection(db, "users"), where("phone", "==", finalPhone));
              const userSnap = await getDocs(qUser);
              if (!userSnap.empty) {
                foundData = { ...userSnap.docs[0].data(), id: userSnap.docs[0].id, role: userSnap.docs[0].data().role || "member" };
              }
            }
          } catch (e) {
            console.error(e);
          }
        }

        setUserData(foundData);
      } else {
        setUserData(null);
        setCart([]); // Clear cart for guest/unlogged users!
      }
    });
    return () => unsubscribe();
  }, []);

  const isRealUser = currentUser && currentUser.email !== "guest@campus.com";
  const avatar = isRealUser 
    ? (userData?.avatar || userInfo?.avatar || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png") 
    : (userInfo?.avatar || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png");
  const name = isRealUser 
    ? (userData?.fullName || userData?.name || userInfo?.name || "Khách") 
    : (userInfo?.name || "Khách");
  const rankPoints = userData?.rankPoints || 0;
  const spendingPoints = userData?.spendingPoints ?? userData?.points ?? 0;
  
  const getRankName = (p: number) => {
    if (p < 500) return "Hạng Đồng";
    if (p < 1000) return "Hạng Bạc";
    if (p < 2000) return "Hạng Vàng";
    return "Hạng Kim Cương";
  };
  const rankName = getRankName(rankPoints);
  const greeting = getGreeting();

  return (
    <Box 
      className="bg-[#14502e] rounded-b-[30px] pb-10 px-4 relative shadow-md"
      style={{ paddingTop: 'calc(var(--zaui-safe-area-inset-top, 40px) + 12px)' }}
    >
      <Box className="flex justify-between items-end">
        {/* TRÁI: Avatar, Lời chào & Điểm ưu đãi */}
        <Box 
          className="flex items-center space-x-2.5 cursor-pointer flex-1"
          onClick={() => navigate('/profile')}
        >
          <Avatar src={avatar} size={44} className="border border-white/50 shadow-sm" />
          <Box className="flex flex-col justify-end h-full">
            <Box className="flex items-center space-x-1.5 mb-1">
              <Text className="text-white/80 text-xs">{greeting}</Text>
              <Text className="text-white font-bold text-sm truncate max-w-[120px]">{name}</Text>
            </Box>
            {isRealUser ? (
              <Box className="bg-white/25 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center w-fit border border-white/20 shadow-sm">
                <CustomIcon icon="zi-star-solid" className="text-yellow-400 text-[10px] mr-1" />
                <Text size="xxxxSmall" className="text-white font-bold text-[10px]">{rankName} | {spendingPoints} Điểm ưu đãi</Text>
              </Box>
            ) : (
              <Box 
                className="bg-yellow-500/90 rounded-full px-2 py-0.5 flex items-center w-fit border border-yellow-400/20 shadow-sm hover:bg-yellow-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/profile');
                }}
              >
                <CustomIcon icon="zi-user" className="text-white text-[10px] mr-1" />
                <Text size="xxxxSmall" className="text-white font-bold text-[10px]">Đăng nhập ngay</Text>
              </Box>
            )}
          </Box>
        </Box>

        {/* PHẢI: Nút Tìm Kiếm & Nút Giỏ Hàng */}
        <Box className="flex items-center space-x-3 text-white mb-0.5 pr-2">
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
    let unsubscribe: (() => void) | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (unsubscribe) unsubscribe();

        const q = query(collection(db, "banners"));
        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const bannerList = querySnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as any))
            .filter((b) => (b.type === "store" || !b.type) && b.active !== false)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setBanners(bannerList);
          setLoading(false);
        }, (error) => {
          console.error("Lỗi khi tải banners:", error);
          setLoading(false);
        });
      }
    });

    return () => {
      authUnsubscribe();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <Box className="px-4 mt-6 pb-2">
        <Box className="w-full rounded-2xl aspect-[2.3/1] bg-gray-200 animate-pulse shadow-md" />
      </Box>
    );
  }

  const validBanners = banners.filter(b => b.image && b.image.trim() !== "");

  if (validBanners.length === 0) {
    return null;
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
        loop={validBanners.length > 1}
      >
        {validBanners.map((banner, i) => {
          const bannerImage = banner.image;
          const bannerLink = banner.link || "";

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

interface StoreCategoriesProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryName: string | null) => void;
}

const StoreCategories: FC<StoreCategoriesProps> = ({ selectedCategory, onSelectCategory }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<any>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const list = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
      setCategories(list);
      setLoading(false);
    }, (error) => {
      console.error("Lỗi khi tải danh mục:", error);
      setLoading(false);
    });
    return () => unsubscribe();
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
    <Box className="relative mt-6 group">
      {/* Nút cuộn trái */}
      <Box 
        className="absolute left-0 top-1/2 -translate-y-[60%] z-10 w-7 h-7 flex items-center justify-center bg-white shadow-md rounded-r-full cursor-pointer active:bg-gray-100 opacity-90"
        onClick={scrollLeft}
      >
        <CustomIcon icon="zi-chevron-left" className="text-[#14502e] text-base" />
      </Box>

      {/* Danh sách danh mục */}
      <Box 
        ref={scrollRef}
        className="px-4 flex space-x-4 overflow-x-auto custom-scrollbar pb-3 pr-12"
      >
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
      {displayCategories.map((cat, idx) => {
        const catName = cat.name || cat.label;
        const isSelected = selectedCategory === catName;
        return (
          <Box 
            key={cat.id || idx} 
            className={`flex flex-col items-center flex-shrink-0 w-[72px] cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-80'}`}
            onClick={() => onSelectCategory(isSelected ? null : catName)}
          >
            <Box className={`w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2 active:scale-95 transition-all ${isSelected ? 'border-2 border-[#14502e] text-[#14502e]' : 'text-[#14502e]'}`}>
              <CustomIcon icon={cat.icon || "zi-store"} className="text-2xl" />
            </Box>
            <Text size="xxSmall" className={`text-center leading-tight w-full break-words whitespace-normal line-clamp-2 ${isSelected ? 'font-bold text-[#14502e]' : 'font-semibold text-gray-800'}`}>{catName}</Text>
          </Box>
        );
      })}
      </Box>

      {/* Nút cuộn phải */}
      <Box 
        className="absolute right-0 top-1/2 -translate-y-[60%] z-10 w-7 h-7 flex items-center justify-center bg-white shadow-md rounded-l-full cursor-pointer active:bg-gray-100 opacity-90"
        onClick={scrollRight}
      >
        <CustomIcon icon="zi-chevron-right" className="text-[#14502e] text-base" />
      </Box>
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

const HotProducts: FC<{ products: any[]; onProductClick: (product: any) => void; showPrice: boolean }> = ({ products, onProductClick, showPrice }) => {
  return (
    <Box className="mt-6 mb-4">
      <Text.Title className="font-bold text-base text-[#14502e] mb-3 px-4">Sản phẩm Hot 🔥</Text.Title>
      <Box className="flex flex-nowrap overflow-x-auto gap-3 pb-3 hide-scrollbar px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
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
            {showPrice ? (
              <Text className="font-bold text-[#14502e] text-xs">
                {p.minPrice !== undefined 
                  ? `${(p.minPrice || 0).toLocaleString('vi-VN')}đ`
                  : `${(p.price || 0).toLocaleString('vi-VN')}đ`}
              </Text>
            ) : (
              <Text className="text-blue-500 italic text-[11px] font-medium leading-normal block">Liên hệ báo giá</Text>
            )}
            {(() => {
              const parsePriceStr = (val: any) => {
                  if (!val) return 0;
                  if (typeof val === 'number') return val;
                  const parsed = Number(val.toString().replace(/[^0-9]/g, ''));
                  return isNaN(parsed) ? 0 : parsed;
              };
              const basePrice = parsePriceStr(p.minPrice !== undefined ? p.minPrice : p.price);
              const adminRewardPointRate = Number(localStorage.getItem('rewardPointRate')) || 10;
              const rewardPointRate = p.rewardRate ? Number(p.rewardRate) : adminRewardPointRate;
              const earnedPoints = Math.floor((basePrice * (rewardPointRate / 100)) / 1000);
              const isHighRate = rewardPointRate > adminRewardPointRate;
              
              if (showPrice && earnedPoints > 0) {
                return (
                  <Box className="flex mt-1.5">
                    <Box className={`${isHighRate ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-yellow-500 to-amber-500'} rounded-full px-1.5 py-0.5 flex items-center shadow-sm`}>
                      <CustomIcon icon="zi-star-solid" size={10} className="text-white mr-1" />
                      <Text className="text-white text-[10px] font-bold">+{earnedPoints} Điểm ưu đãi {isHighRate ? '🔥' : ''}</Text>
                    </Box>
                  </Box>
                );
              }
              return null;
            })()}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ProductsForYou: FC<{ products: any[]; onProductClick: (product: any) => void; showPrice: boolean }> = ({ products, onProductClick, showPrice }) => {
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
            {showPrice ? (
              <Text className="font-bold text-[#14502e] text-sm">
                {p.minPrice !== undefined 
                  ? `${(p.minPrice || 0).toLocaleString('vi-VN')}đ`
                  : `${(p.price || 0).toLocaleString('vi-VN')}đ`}
              </Text>
            ) : (
              <Text className="text-blue-500 italic text-xs font-medium leading-normal block">Liên hệ báo giá</Text>
            )}
            {(() => {
              const parsePriceStr = (val: any) => {
                  if (!val) return 0;
                  if (typeof val === 'number') return val;
                  const parsed = Number(val.toString().replace(/[^0-9]/g, ''));
                  return isNaN(parsed) ? 0 : parsed;
              };
              const basePrice = parsePriceStr(p.minPrice !== undefined ? p.minPrice : p.price);
              const adminRewardPointRate = Number(localStorage.getItem('rewardPointRate')) || 10;
              const rewardPointRate = p.rewardRate ? Number(p.rewardRate) : adminRewardPointRate;
              const earnedPoints = Math.floor((basePrice * (rewardPointRate / 100)) / 1000);
              const isHighRate = rewardPointRate > adminRewardPointRate;
              
              if (showPrice && earnedPoints > 0) {
                return (
                  <Box className="flex mt-1.5">
                    <Box className={`${isHighRate ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-yellow-500 to-amber-500'} rounded-full px-2 py-0.5 flex items-center shadow-sm`}>
                      <CustomIcon icon="zi-star-solid" size={10} className="text-white mr-1" />
                      <Text className="text-white text-[10px] font-bold">+{earnedPoints} Điểm ưu đãi {isHighRate ? '🔥' : ''}</Text>
                    </Box>
                  </Box>
                );
              }
              return null;
            })()}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ConsumerStorePage: FC = () => {
  const [dbServices, setDbServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
        if (configSnap.exists() && configSnap.data().showPrice !== undefined) {
          setShowPrice(configSnap.data().showPrice);
        }
      } catch (e) {
        console.error("Lỗi khi tải cấu hình hiển thị giá:", e);
      }
    };
    fetchConfig();

    const q = query(collection(db, "services"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const list = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(item => item.status === "approved" || !item.status);
      setDbServices(list);
      setLoadingServices(false);
    }, (error) => {
      console.error("Lỗi khi tải sản phẩm:", error);
      setLoadingServices(false);
    });
    return () => unsubscribe();
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
    navigate(`/detail/${product.id}`, { state: { product } });
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

  const filteredServices = selectedCategory 
    ? dbServices.filter(item => item.category === selectedCategory || item.productCategory === selectedCategory)
    : dbServices;

  const vipServices = filteredServices.filter(item => item.isVip === true);
  const normalServices = filteredServices.filter(item => item.isVip !== true);

  const hotList = vipServices.length > 0 ? vipServices : filteredServices.slice(0, Math.ceil(filteredServices.length / 2) || 1);
  const forYouList = normalServices.length > 0 ? normalServices : filteredServices.slice(Math.ceil(filteredServices.length / 2));
  
  // Nếu đã lọc theo danh mục thì không dùng mockProducts nếu trống để tránh gây nhầm lẫn
  const finalHotList = selectedCategory ? hotList : (hotList.length > 0 ? hotList : mockProducts);
  const finalForYouList = selectedCategory ? forYouList : (forYouList.length > 0 ? forYouList : mockProducts);

  return (
    <Page className="bg-[#f0fdf4] overflow-y-auto pb-20">
      <StoreWelcome />
      <StoreBanner />
      <StoreCategories selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
      
      {selectedCategory ? (
        <Box className="px-4 mt-6 mb-6">
          <Text.Title className="font-bold text-base text-[#14502e] mb-4">Danh mục: {selectedCategory}</Text.Title>
          {filteredServices.length > 0 ? (
            <Box className="grid grid-cols-2 gap-4">
              {filteredServices.map((p) => (
                <Box key={p.id} className="flex flex-col bg-white rounded-2xl p-3 shadow-md active:scale-95 transition-transform cursor-pointer" onClick={() => handleProductClick(p)}>
                  <Box 
                    className="w-full aspect-[4/3] rounded-xl bg-cover bg-center mb-2"
                    style={{ backgroundImage: `url('${p.image || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"}')` }}
                  />
                  <Text className="font-semibold text-gray-800 text-sm line-clamp-2 min-h-[40px] leading-tight mb-1">{p.name || p.title}</Text>
                  {showPrice ? (
                    <Text className="font-bold text-[#14502e] text-sm">{(p.price || 0).toLocaleString('vi-VN')}đ</Text>
                  ) : (
                    <Text className="text-blue-500 italic text-xs font-medium leading-normal block">Liên hệ báo giá</Text>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Text className="text-center text-gray-500 italic mt-8">Chưa có sản phẩm nào thuộc danh mục này.</Text>
          )}
        </Box>
      ) : (
        <>
          <HotProducts products={finalHotList} onProductClick={handleProductClick} showPrice={showPrice} />
          <ProductsForYou products={finalForYouList} onProductClick={handleProductClick} showPrice={showPrice} />
        </>
      )}

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
