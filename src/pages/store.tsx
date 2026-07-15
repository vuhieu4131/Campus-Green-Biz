import CustomIcon from '../components/custom-icon';
import React, { FC, useState } from "react";
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { cartState } from 'state';
import { Page, Box, Text, Avatar, Icon, Input, useNavigate, Sheet, Button, useSnackbar } from "zmp-ui";

const StoreWelcome: FC = () => {
  const navigate = useNavigate();
  const cart = useRecoilValue(cartState);
  
  // Tính tổng số lượng sản phẩm trong giỏ hàng
  const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <Box className="bg-[#14502e] rounded-b-[40px] pt-12 pb-16 px-4 relative">
      <Box className="flex justify-between items-center">
        {/* TRÁI: Avatar, Lời chào & Điểm xanh */}
        <Box className="flex items-center space-x-3">
          <Avatar src="https://i.pravatar.cc/150?img=11" size={56} className="border-2 border-white shadow-sm" />
          <Box>
            <Text className="text-white/80 text-sm">Chào buổi sáng,</Text>
            <Text.Title className="text-white font-bold text-xl mb-1">Đức</Text.Title>
            <Box className="bg-white/20 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center w-fit border border-white/30 shadow-sm">
              <CustomIcon icon="zi-star-solid" className="text-yellow-400 text-xs mr-1" />
              <Text size="xxxxSmall" className="text-white font-bold">150 Điểm Xanh</Text>
            </Box>
          </Box>
        </Box>

        {/* PHẢI: Nút Giỏ Hàng */}
        <Box 
          className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 cursor-pointer relative shadow-sm"
          onClick={() => navigate('/cart')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          {totalQuantity > 0 && (
            <Box className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] min-w-[16px] px-1 h-4 flex items-center justify-center rounded-full border border-[#14502e] font-bold">
              {totalQuantity > 99 ? '99+' : totalQuantity}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const StoreSearch: FC = () => (
  <Box className="px-4 -mt-6 relative z-10">
    <Box className="bg-white rounded-full flex items-center px-4 py-3 shadow-md">
      <CustomIcon icon="zi-search" className="text-gray-400 text-xl mr-2" />
      <Input
        placeholder="Tìm kiếm dịch vụ, sản phẩm..."
        className="flex-1 bg-transparent border-none p-0 text-sm"
        clearable
      />
    </Box>
  </Box>
);

const StoreBanner: FC = () => (
  <Box className="px-4 mt-6">
    <Box className="bg-gradient-to-r from-[#14502e] to-[#22c55e] rounded-2xl p-4 flex justify-between items-center text-white relative overflow-hidden shadow-md">
      <Box className="relative z-10 w-2/3">
        <Text className="font-bold text-lg leading-tight mb-1">Ưu Đãi Đặc Biệt<br/>Tháng 10</Text>
        <Text size="xSmall" className="text-white/80 mb-2">Giảm 25% cho sản phẩm Xanh</Text>
        <Box className="bg-white text-[#14502e] inline-block px-3 py-1 rounded-full text-xs font-bold shadow-md">
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

const StoreCategories: FC = () => {
  const categories = [
    { icon: "zi-calendar", label: "Lịch hẹn" },
    { icon: "zi-ticket", label: "Ưu đãi" },
    { icon: "zi-qrline", label: "Quét QR" },
    { icon: "zi-store", label: "Cửa hàng" },
  ];

  return (
    <Box className="px-4 mt-6 grid grid-cols-4 gap-4">
      {categories.map((cat, idx) => (
        <Box key={idx} className="flex flex-col items-center">
          <Box className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2 text-[#14502e]">
            <CustomIcon icon={cat.icon} className="text-2xl" />
          </Box>
          <Text size="xxSmall" className="font-medium text-gray-800 text-center">{cat.label}</Text>
        </Box>
      ))}
    </Box>
  );
};

import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";

const StoreRecommend: FC<{ onProductClick: (product: any) => void }> = ({ onProductClick }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        let allProducts: any[] = [];
        
        // Fetch from services
        const qServices = query(collection(db, "services"), orderBy("createdAt", "desc"), limit(20));
        const snapServices = await getDocs(qServices);
        snapServices.docs.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));

        // Fetch from products (fallback for older items)
        const qProducts = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(20));
        const snapProducts = await getDocs(qProducts);
        snapProducts.docs.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));

        // Deduplicate just in case
        const uniqueIds = new Set();
        const uniqueProducts = allProducts.filter(p => {
          if (uniqueIds.has(p.id)) return false;
          uniqueIds.add(p.id);
          return true;
        });

        // Sort by time
        uniqueProducts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        // Format to match UI
        const formatted = uniqueProducts.map(p => ({
          ...p,
          name: p.name || p.title || "Sản phẩm",
          price: Number(p.price || 0),
          image: p.image || (p.images && p.images[0]) || "https://via.placeholder.com/500",
          stars: 5,
          description: p.description || ""
        }));

        setProducts(formatted);
      } catch (error) {
        console.error("Lỗi lấy danh sách sản phẩm:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (loading) {
    return <Box className="px-4 mt-8 mb-6 text-center text-gray-500">Đang tải sản phẩm...</Box>;
  }

  return (
    <Box className="px-4 mt-8 mb-6">
      <Text.Title className="font-bold text-lg text-[#14502e] mb-4">Gợi ý cho bạn</Text.Title>
      {products.length === 0 ? (
        <Text className="text-gray-500 text-center">Chưa có sản phẩm nào được đăng.</Text>
      ) : (
        <Box className="grid grid-cols-2 gap-4">
          {products.map((p) => (
            <Box key={p.id} className="flex flex-col bg-white rounded-2xl p-3 shadow-md active:scale-95 transition-transform cursor-pointer" onClick={() => onProductClick(p)}>
              <Box 
                className="w-full aspect-[4/3] rounded-xl bg-cover bg-center mb-2"
                style={{ backgroundImage: `url('${p.image}')` }}
              />
              <Text className="font-semibold text-gray-800 text-sm line-clamp-2 min-h-[40px] leading-tight mb-1">{p.name}</Text>
              <Text className="font-bold text-[#14502e] text-sm">{p.price.toLocaleString('vi-VN')}đ</Text>
              <Box className="flex text-yellow-400 mt-1 space-x-0.5">
                {[...Array(5)].map((_, idx) => (
                  <CustomIcon key={idx} icon={idx < p.stars ? "zi-star-solid" : "zi-star"} className="text-[12px]" />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

const ConsumerStorePage: FC = () => {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const { openSnackbar } = useSnackbar();

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

  return (
    <Page className="bg-[#f0fdf4] overflow-y-auto pb-20">
      <StoreWelcome />
      <StoreSearch />
      <StoreBanner />
      <StoreCategories />
      <StoreRecommend onProductClick={handleProductClick} />

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
