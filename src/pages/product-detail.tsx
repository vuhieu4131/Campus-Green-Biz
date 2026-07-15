import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Box, Text, Icon, Button, useSnackbar, Spinner, Modal } from "zmp-ui";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useSetRecoilState } from "recoil";
import { cartState } from "../state";

const ProductDetailPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { openSnackbar } = useSnackbar();
  
  const [product, setProduct] = useState<any>(location.state?.product || null);
  const [loading, setLoading] = useState(!product);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showPrice, setShowPrice] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const setCart = useSetRecoilState(cartState);

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
  }, []);

  useEffect(() => {
    if (product) {
      setLoading(false);
      return; 
    }
    if (!id) return;

    const fetchProduct = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "services", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setProduct({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error("Lỗi khi tải thông tin sản phẩm:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, product]);

  const handleSelectOption = (attrName: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [attrName]: value
    }));
  };

  const validateOptions = () => {
    if (product?.attributes && product.attributes.length > 0) {
      for (const attr of product.attributes) {
        if (!selectedOptions[attr.name]) {
          openSnackbar({
            text: `Vui lòng chọn ${attr.name}!`,
            type: "error",
            position: "top"
          });
          return false;
        }
      }
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!validateOptions()) return;

    setCart(cart => {
      const newCart = [...cart];
      const index = newCart.findIndex(i => i.product.id === product.id && JSON.stringify(i.options) === JSON.stringify(selectedOptions));
      if (index >= 0) {
        newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + quantity };
      } else {
        newCart.push({ product: { ...product, categoryId: ['store'] }, quantity, options: selectedOptions });
      }
      return newCart;
    });

    setShowSuccessModal(true);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!validateOptions()) return;

    setCart(cart => {
      const newCart = [...cart];
      const index = newCart.findIndex(i => i.product.id === product.id && JSON.stringify(i.options) === JSON.stringify(selectedOptions));
      if (index >= 0) {
        newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + quantity };
      } else {
        newCart.push({ product: { ...product, categoryId: ['store'] }, quantity, options: selectedOptions });
      }
      return newCart;
    });
    navigate('/cart');
  };

  if (loading) {
    return (
      <Page className="bg-gray-50 flex justify-center items-center h-screen">
        <Spinner />
      </Page>
    );
  }

  if (!product) {
    return (
      <Page className="bg-gray-50 flex flex-col items-center justify-center h-screen p-4">
        <Text className="text-gray-400 mb-4">Không tìm thấy sản phẩm!</Text>
        <Button onClick={() => navigate('/store')}>Quay lại cửa hàng</Button>
      </Page>
    );
  }

  const discountPercent = product.discountPercent || (product.originalPrice && product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0);

  return (
    <Page className="bg-gray-50 flex flex-col h-screen relative">
      {/* Header */}
      <Box className="flex items-center px-4 py-3 bg-white z-50 shadow-sm border-b border-gray-100">
        <CustomIcon icon="zi-arrow-left" className="text-2xl mr-4 cursor-pointer text-gray-800" onClick={() => navigate(-1)} />
        <Text.Title className="font-bold text-[17px] text-gray-800 flex-1 truncate">
          {product.title || product.name}
        </Text.Title>
      </Box>

      {/* Main Content */}
      <Box className="flex-1 overflow-y-auto pb-24">
        {/* Product Image */}
        <Box className="w-full bg-white relative pt-[100%] border-b border-gray-100 shadow-sm">
          <img 
            src={product.image || "https://via.placeholder.com/400"} 
            className="absolute inset-0 w-full h-full object-cover" 
            alt={product.title || product.name} 
          />
          {/* Points Badge */}
          {product.points && (
            <Box className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center space-x-1">
              <CustomIcon icon="zi-star-solid" className="text-yellow-200" size={14} />
              <span>+{product.points} Điểm Xanh</span>
            </Box>
          )}
        </Box>

        {/* Pricing & Name Info */}
        <Box className="bg-white p-4 mb-3 border-b border-gray-100 shadow-sm">
          <Box flex alignItems="center" className="mb-2">
            {!showPrice ? (
              <Text className="text-xl font-bold text-blue-500 italic">
                Liên hệ báo giá
              </Text>
            ) : (
              <>
                <Text className="text-2xl font-extrabold text-[#14502e]">
                  {product.price?.toLocaleString('vi-VN')}đ
                </Text>
                {product.originalPrice && product.originalPrice > product.price && (
                  <>
                    <Text size="small" className="text-gray-400 line-through ml-3 mt-1">
                      {product.originalPrice.toLocaleString('vi-VN')}đ
                    </Text>
                    {discountPercent > 0 && (
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full ml-3 mt-1">
                        -{discountPercent}%
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </Box>

          <Text.Title className="text-lg font-bold text-gray-900 leading-snug mb-2">
            {product.title || product.name}
          </Text.Title>

          {product.shopName && (
            <Box flex alignItems="center" className="text-gray-500 text-xs mt-2">
              <CustomIcon icon="zi-store" size={14} className="mr-1 text-gray-400" />
              <span>Cung cấp bởi: </span>
              <span className="font-semibold text-gray-800 ml-1">{product.shopName}</span>
            </Box>
          )}
        </Box>

        {/* Product Attributes (Size, Color, etc.) */}
        {product.attributes && product.attributes.length > 0 && (
          <Box className="bg-white p-4 mb-3 border-b border-gray-100 shadow-sm space-y-4">
            <Text bold className="text-gray-800 text-sm border-b border-gray-50 pb-2 block">
              Lựa chọn sản phẩm
            </Text>
            {product.attributes.map((attr: any, idx: number) => {
              const options = attr.values.split(",").map((v: string) => v.trim()).filter(Boolean);
              return (
                <Box key={idx} className="space-y-2">
                  <Text className="text-xs text-gray-500 font-medium">
                    {attr.name} <span className="text-red-500">*</span>
                  </Text>
                  <Box className="flex flex-wrap gap-2">
                    {options.map((val: string, oIdx: number) => {
                      const isSelected = selectedOptions[attr.name] === val;
                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleSelectOption(attr.name, val)}
                          className={`px-3.5 py-1.5 rounded-lg border text-xs transition-all ${
                            isSelected
                              ? "border-[#14502e] bg-green-50 text-[#14502e] font-semibold"
                              : "border-gray-200 bg-gray-50 text-gray-600 active:bg-gray-100"
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Product Description */}
        <Box className="bg-white p-4 mb-3 border-b border-gray-100 shadow-sm">
          <Text bold className="text-gray-800 text-sm border-b border-gray-50 pb-2 block mb-3">
            Mô tả sản phẩm
          </Text>
          <Text className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
            {product.description || "Sản phẩm chưa có mô tả chi tiết."}
          </Text>
        </Box>
      </Box>

      {/* Sticky Bottom Actions */}
      <Box className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 p-4 shadow-lg z-50 flex flex-col space-y-3">
        {/* Quantity Picker inside footer */}
        <Box flex justifyContent="space-between" alignItems="center">
          <Text bold className="text-gray-800 text-sm">Số lượng mua</Text>
          <Box className="flex items-center space-x-3 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
            <Box 
              className="w-7 h-7 flex items-center justify-center bg-white rounded-full shadow-sm active:bg-gray-200 cursor-pointer text-gray-600 font-bold text-sm"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              -
            </Box>
            <Text className="font-bold w-6 text-center text-gray-800 text-sm">{quantity}</Text>
            <Box 
              className="w-7 h-7 flex items-center justify-center bg-white rounded-full shadow-sm active:bg-gray-200 cursor-pointer text-gray-600 font-bold text-sm"
              onClick={() => setQuantity(quantity + 1)}
            >
              +
            </Box>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box flex className="space-x-3">
          <button 
            className="flex-1 bg-green-50 text-[#14502e] border border-[#14502e] font-semibold rounded-xl h-11 flex items-center justify-center shadow-sm active:opacity-75 transition-opacity"
            onClick={handleAddToCart}
          >
            Thêm vào giỏ
          </button>
          <button 
            className="flex-1 bg-[#14502e] text-white font-bold rounded-xl h-11 flex items-center justify-center shadow-sm active:opacity-75 transition-opacity"
            onClick={handleBuyNow}
          >
            Mua ngay
          </button>
        </Box>
      </Box>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        title="Thêm vào giỏ hàng thành công 🎉"
        onClose={() => setShowSuccessModal(false)}
      >
        <Box p={4} className="text-center">
          <Text size="small" className="text-gray-600 mb-6 leading-relaxed block">
            Bạn có muốn tiếp tục chọn sản phẩm khác hay đến Giỏ hàng để thanh toán ngay?
          </Text>
          <Box flex className="gap-3 mt-4">
            <Button 
              variant="secondary" 
              className="flex-1 bg-gray-100 text-gray-700 border-none"
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/store');
              }}
            >
              Mua tiếp
            </Button>
            <Button 
              className="flex-1 bg-[#14502e]"
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/cart');
              }}
            >
              Thanh toán
            </Button>
          </Box>
        </Box>
      </Modal>
    </Page>
  );
};

export default ProductDetailPage;
