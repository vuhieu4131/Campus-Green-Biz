import CustomIcon from "../../components/custom-icon";
import React, { FC, useState, useEffect, useMemo } from "react";
import { Page, Box, Text, Icon, Button, useSnackbar, Modal } from "zmp-ui";
import { useRecoilState, useRecoilValue } from "recoil";
import { cartState } from "../../state";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

const CartPage: FC = () => {
  const [cart, setCart] = useRecoilState(cartState);
  
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Receipient Form States (preserved across orders)
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  // Address Dropdown States (preserved across orders)
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [specificAddress, setSpecificAddress] = useState("");

  // Address lists loaded from API
  const [provinceList, setProvinceList] = useState<any[]>([]);
  const [districtList, setDistrictList] = useState<any[]>([]);
  const [wardList, setWardList] = useState<any[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);

  // Address Collapse Switch (For quick campus/dorm address input)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Voucher States
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // Note & Dialog States
  const [note, setNote] = useState("");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Fallbacks in case open-api.vn is blocked or slow
  const fallbackProvinces = [
    { code: 1, name: "Thành phố Hà Nội" },
    { code: 79, name: "Thành phố Hồ Chí Minh" },
    { code: 97, name: "Tỉnh Lâm Đồng" },
    { code: 17, name: "Tỉnh Hòa Bình" }
  ];
  
  const fallbackDistricts: Record<number, any[]> = {
    1: [
      { code: 268, name: "Quận Hà Đông" },
      { code: 5, name: "Quận Cầu Giấy" },
      { code: 19, name: "Quận Nam Từ Liêm" },
      { code: 277, name: "Huyện Chương Mỹ" }
    ],
    79: [
      { code: 760, name: "Quận 1" },
      { code: 772, name: "Quận Bình Thạnh" },
      { code: 764, name: "Quận Gò Vấp" }
    ],
    97: [
      { code: 970, name: "Thành phố Đà Lạt" },
      { code: 973, name: "Huyện Đức Trọng" }
    ],
    17: [
      { code: 148, name: "Thành phố Hòa Bình" },
      { code: 150, name: "Huyện Lương Sơn" }
    ]
  };

  const fallbackWards: Record<number, any[]> = {
    268: [
      { code: 9556, name: "Phường Dương Nội" },
      { code: 9559, name: "Phường Hà Cầu" },
      { code: 9562, name: "Phường La Khê" },
      { code: 9565, name: "Phường Mộ Lao" }
    ],
    5: [
      { code: 145, name: "Phường Dịch Vọng" },
      { code: 148, name: "Phường Mai Dịch" },
      { code: 151, name: "Phường Nghĩa Tân" }
    ],
    19: [
      { code: 583, name: "Phường Mỹ Đình 1" },
      { code: 586, name: "Phường Mỹ Đình 2" }
    ],
    277: [
      { code: 9820, name: "Thị trấn Chúc Sơn" },
      { code: 9823, name: "Xã Tiên Phương" }
    ]
  };

  // Group cart items by shop/provider
  const groupedCart = useMemo(() => {
    const groups: Record<string, typeof cart> = {};
    cart.forEach(item => {
      const shop = item.product.shopName || "Gian hàng khác";
      if (!groups[shop]) {
        groups[shop] = [];
      }
      groups[shop].push(item);
    });
    return groups;
  }, [cart]);

  // Active shop for checkout
  const [activeShop, setActiveShop] = useState<string>("");

  // Automatically select the first shop if activeShop is empty or not in cart
  useEffect(() => {
    const shops = Object.keys(groupedCart);
    if (shops.length > 0) {
      if (!activeShop || !shops.includes(activeShop)) {
        setActiveShop(shops[0]);
      }
    } else {
      setActiveShop("");
    }
  }, [groupedCart, activeShop]);

  const activeCartItems = useMemo(() => {
    if (!activeShop) return [];
    return groupedCart[activeShop] || [];
  }, [activeShop, groupedCart]);

  const activeTotalPrice = useMemo(() => {
    return activeCartItems.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0);
  }, [activeCartItems]);

  const activeTotalQuantity = useMemo(() => {
    return activeCartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [activeCartItems]);

  // Load Provinces on mount
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const res = await fetch("https://provinces.open-api.vn/api/p/");
        if (res.ok) {
          const data = await res.json();
          setProvinceList(data);
          return;
        }
      } catch (e) {
        console.error("Lỗi fetch tỉnh thành API:", e);
      }
      setProvinceList(fallbackProvinces);
    };
    loadProvinces();
  }, []);

  // Initialize Recipient Name & Phone from Current User
  useEffect(() => {
    const user = auth.currentUser;
    if (user && user.email !== "guest@campus.com") {
      setRecipientName(user.displayName || "Thành viên");
      setRecipientPhone((user.email || "").replace("@campus.com", ""));
    }
  }, []);

  // Load available vouchers from Firestore with mock backup
  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const q = query(collection(db, "voucher_campaigns"), where("isOpen", "==", true));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Add backup mock vouchers for testing
        const mocks = [
          { id: "mock_10k", title: "Mã CAMPUSGREEN - Giảm 10.000đ", discountType: "fixed", value: 10000 },
          { id: "mock_15percent", title: "Mã GO_GREEN - Giảm 15% đơn hàng", discountType: "percent", value: 15 },
          { id: "mock_50k", title: "Mã VIP_SHOPPING - Giảm 50.000đ", discountType: "fixed", value: 50000 }
        ];
        setVouchers([...list, ...mocks]);
      } catch (e) {
        console.error("Lỗi khi tải Voucher:", e);
      }
    };
    fetchVouchers();
  }, []);

  // Calculate discount and final price for active shop items
  const discountAmount = useMemo(() => {
    if (!selectedVoucher) return 0;
    if (selectedVoucher.discountType === "percent" || selectedVoucher.title?.includes("%")) {
      const percentValue = selectedVoucher.value || 15;
      return Math.round((activeTotalPrice * percentValue) / 100);
    }
    return selectedVoucher.value || 10000;
  }, [selectedVoucher, activeTotalPrice]);

  const finalTotalPrice = useMemo(() => {
    return Math.max(0, activeTotalPrice - discountAmount);
  }, [activeTotalPrice, discountAmount]);

  // Handle Province selection and fetch districts
  const handleProvinceSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value; // Format: "code|name"
    if (!val) {
      setProvince("");
      setSelectedProvinceCode(null);
      setDistrict("");
      setSelectedDistrictCode(null);
      setWard("");
      setDistrictList([]);
      setWardList([]);
      return;
    }
    const [codeStr, name] = val.split("|");
    const code = Number(codeStr);
    
    setProvince(name);
    setSelectedProvinceCode(code);
    setDistrict("");
    setSelectedDistrictCode(null);
    setWard("");
    setWardList([]);

    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
      if (res.ok) {
        const data = await res.json();
        setDistrictList(data.districts || []);
        return;
      }
    } catch (err) {
      console.error("Lỗi fetch quận huyện API:", err);
    }
    setDistrictList(fallbackDistricts[code] || []);
  };

  // Handle District selection and fetch wards
  const handleDistrictSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value; // Format: "code|name"
    if (!val) {
      setDistrict("");
      setSelectedDistrictCode(null);
      setWard("");
      setWardList([]);
      return;
    }
    const [codeStr, name] = val.split("|");
    const code = Number(codeStr);

    setDistrict(name);
    setSelectedDistrictCode(code);
    setWard("");

    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
      if (res.ok) {
        const data = await res.json();
        setWardList(data.wards || []);
        return;
      }
    } catch (err) {
      console.error("Lỗi fetch phường xã API:", err);
    }
    setWardList(fallbackWards[code] || []);
  };

  const validateCheckout = () => {
    if (!activeCartItems.length) {
      openSnackbar({ text: "Không có sản phẩm nào được chọn để lên đơn!", type: "warning" });
      return false;
    }
    if (!recipientName.trim()) {
      openSnackbar({ text: "Vui lòng nhập tên người nhận!", type: "warning" });
      return false;
    }
    if (!recipientPhone.trim()) {
      openSnackbar({ text: "Vui lòng nhập số điện thoại người nhận!", type: "warning" });
      return false;
    }
    
    if (isCollapsed) {
      // Dorm/quick campus selection bypasses city/district/ward verification
      if (!specificAddress.trim()) {
        openSnackbar({ text: "Vui lòng nhập thông tin Ký túc xá / địa chỉ nhanh!", type: "warning" });
        return false;
      }
    } else {
      if (!province || !district || !ward || !specificAddress.trim()) {
        openSnackbar({ text: "Vui lòng điền đầy đủ địa chỉ giao hàng!", type: "warning" });
        return false;
      }
    }
    return true;
  };

  const handleCheckoutSubmit = async () => {
    setCheckoutLoading(true);
    try {
      const deliveryAddress = isCollapsed
        ? specificAddress.trim()
        : `${specificAddress.trim()}, ${ward}, ${district}, ${province}`;

      // 1. Ghi đơn hàng vào Firestore cho các sản phẩm của shop hiện tại
      await addDoc(collection(db, "orders"), {
        items: activeCartItems.map(i => ({
          product: { 
            id: i.product.id, 
            name: i.product.title || i.product.name, 
            price: i.product.price, 
            image: i.product.image,
            shopName: i.product.shopName || "Gian hàng"
          },
          quantity: i.quantity,
          options: i.options
        })),
        totalPrice: finalTotalPrice,
        originalPrice: activeTotalPrice,
        discountAmount: discountAmount,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        address: deliveryAddress,
        voucherTitle: selectedVoucher?.title || "Không có",
        note: note.trim(),
        status: "pending",
        shopName: activeShop,
        createdAt: serverTimestamp()
      });

      // 2. Xóa các sản phẩm đã thanh toán của shop hiện tại ra khỏi giỏ hàng
      setCart(prevCart => prevCart.filter(item => (item.product.shopName || "Gian hàng khác") !== activeShop));
      
      openSnackbar({ 
        text: `Đã lên đơn cho nhà cung cấp "${activeShop}" thành công!`, 
        prefixIcon: <CustomIcon icon="zi-check-circle-2" className="text-green-500 mr-2" />,
        icon: false,
        duration: 3000
      });

      setShowCheckoutModal(false);
      setSelectedVoucher(null); // Reset voucher
      setNote(""); // Reset ghi chú

      // Nếu giỏ hàng đã sạch hoàn toàn -> về trang chủ
      const remainingShops = Object.keys(groupedCart).filter(s => s !== activeShop);
      if (remainingShops.length === 0) {
        navigate("/");
      }
    } catch (e) {
      console.error("Lỗi khi đặt hàng:", e);
      openSnackbar({ text: "Có lỗi xảy ra, vui lòng thử lại sau.", type: "error" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <Page className="bg-gray-50 flex flex-col h-screen relative">
      {/* Header */}
      <Box className="flex items-center px-4 py-3 bg-white z-50 shadow-sm border-b border-gray-100">
        <CustomIcon icon="zi-arrow-left" className="text-2xl mr-4 cursor-pointer text-gray-800" onClick={() => navigate(-1)} />
        <Text.Title className="font-bold text-[17px] text-gray-800">Thanh toán</Text.Title>
      </Box>

      {/* Content Form Scrollable */}
      <Box className="flex-1 overflow-y-auto pb-24 space-y-3">
        {/* Danh sách sản phẩm gom nhóm theo nhà cung cấp */}
        {Object.entries(groupedCart).map(([shopName, items], gIdx) => {
          const isActive = activeShop === shopName;

          return (
            <Box 
              key={gIdx} 
              className={`bg-white border-b border-gray-150 shadow-sm transition-all duration-200 ${
                isActive 
                  ? "ring-2 ring-green-600 ring-inset" 
                  : "opacity-75"
              }`}
            >
              {/* Header nhà cung cấp */}
              <Box flex justifyContent="space-between" alignItems="center" className="p-3 bg-gray-50 border-b border-gray-150">
                <Box flex alignItems="center" className="space-x-1.5 flex-1 truncate pr-2">
                  <CustomIcon icon="zi-store" size={16} className="text-gray-500" />
                  <Text bold size="small" className="text-gray-800 truncate">
                    {shopName}
                  </Text>
                </Box>
                {isActive ? (
                  <span className="text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full flex items-center">
                    <Icon icon="zi-check" size={12} className="mr-1" /> Đang lên đơn
                  </span>
                ) : (
                  <button 
                    className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full active:bg-blue-100 focus:outline-none"
                    onClick={() => setActiveShop(shopName)}
                  >
                    Chọn lên đơn
                  </button>
                )}
              </Box>

              {/* Danh sách các sản phẩm của nhà cung cấp này */}
              <Box className="divide-y divide-gray-100">
                {items.map((item, idx) => {
                  const optText = Object.entries(item.options || {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");

                  return (
                    <Box key={idx} className="p-4">
                      <Box flex className="space-x-3">
                        <img src={item.product.image} className="w-16 h-16 object-cover rounded-lg border border-gray-100" alt="product" />
                        <Box className="flex-1">
                          <Text bold size="small" className="text-gray-900 leading-tight">
                            {item.product.title || item.product.name}
                          </Text>
                          {optText && (
                            <Text className="text-gray-500 text-xs mt-1">
                              {optText}
                            </Text>
                          )}
                          <Box flex justifyContent="space-between" className="mt-1">
                            <Text bold className="text-[#14502e] text-sm">
                              {item.product.price?.toLocaleString("vi-VN")}đ
                            </Text>
                            <Text className="text-gray-500 text-xs font-semibold">
                              x{item.quantity}
                            </Text>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}

        {cart.length === 0 && (
          <Box className="bg-white p-8 text-center text-gray-400">
            Không có sản phẩm nào trong giỏ hàng!
          </Box>
        )}

        {/* 2. Thông tin người nhận */}
        <Box className="bg-white p-4 border-b border-gray-100 shadow-sm space-y-3">
          <Text bold className="text-gray-800 text-sm border-b border-gray-50 pb-2 block">
            Thông tin người nhận
          </Text>
          <Box className="space-y-1">
            <Text className="text-xs text-gray-500 font-medium ml-1">Tên người nhận</Text>
            <input 
              type="text" 
              placeholder="Nhập tên người nhận..." 
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-600 focus:bg-white"
            />
          </Box>
          <Box className="space-y-1">
            <Text className="text-xs text-gray-500 font-medium ml-1">Số điện thoại</Text>
            <input 
              type="tel" 
              placeholder="Nhập số điện thoại..." 
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-600 focus:bg-white"
            />
          </Box>
        </Box>

        {/* 3. Địa chỉ giao hàng */}
        <Box className="bg-white p-4 border-b border-gray-100 shadow-sm space-y-4">
          <Box flex justifyContent="space-between" alignItems="center" className="border-b border-gray-50 pb-2">
            <Text bold className="text-gray-800 text-sm block">
              Địa chỉ giao hàng
            </Text>
            <button 
              className="text-[#14502e] text-xs font-semibold focus:outline-none flex items-center bg-green-50 px-2.5 py-1 rounded-full border border-green-200"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? "Hiện bộ chọn địa chỉ ˱" : "Thu gọn bộ chọn ˰"}
            </button>
          </Box>
          
          <Box className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
            {!isCollapsed && (
              <>
                <Box className="space-y-1">
                  <Text className="text-[11px] text-gray-500 font-medium">Tỉnh / Thành phố</Text>
                  <select 
                    value={selectedProvinceCode ? `${selectedProvinceCode}|${province}` : ""} 
                    onChange={handleProvinceSelect}
                    className="w-full h-10 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none text-gray-700"
                  >
                    <option value="">Chọn Tỉnh/Thành phố</option>
                    {provinceList.map((pOpt) => (
                      <option key={pOpt.code} value={`${pOpt.code}|${pOpt.name}`}>{pOpt.name}</option>
                    ))}
                  </select>
                </Box>

                <Box className="space-y-1">
                  <Text className="text-[11px] text-gray-500 font-medium">Quận / Huyện</Text>
                  <select 
                    value={selectedDistrictCode ? `${selectedDistrictCode}|${district}` : ""} 
                    disabled={!selectedProvinceCode}
                    onChange={handleDistrictSelect}
                    className="w-full h-10 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none text-gray-700 disabled:opacity-50"
                  >
                    <option value="">Chọn Quận/Huyện</option>
                    {districtList.map((dOpt) => (
                      <option key={dOpt.code} value={`${dOpt.code}|${dOpt.name}`}>{dOpt.name}</option>
                    ))}
                  </select>
                </Box>

                <Box className="space-y-1">
                  <Text className="text-[11px] text-gray-500 font-medium">Phường / Xã</Text>
                  <select 
                    value={ward} 
                    disabled={!selectedDistrictCode}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full h-10 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none text-gray-700 disabled:opacity-50"
                  >
                    <option value="">Chọn Phường/Xã</option>
                    {wardList.map((wOpt) => (
                      <option key={wOpt.code || wOpt.name} value={wOpt.name}>{wOpt.name}</option>
                    ))}
                  </select>
                </Box>
              </>
            )}

            <Box className="space-y-1">
              <Text className="text-[11px] text-gray-500 font-medium">
                {isCollapsed ? "Ký túc xá / Địa chỉ nhanh" : "Địa chỉ cụ thể"}
              </Text>
              <input 
                type="text" 
                placeholder={isCollapsed ? "Nhập số phòng, toà nhà, ký túc xá..." : "Số nhà, ngõ ngách, tên đường..."} 
                value={specificAddress}
                onChange={(e) => setSpecificAddress(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-600 focus:bg-white"
              />
            </Box>
          </Box>
        </Box>

        {/* 4. Mã giảm giá (Voucher) */}
        <Box className="bg-white p-4 border-b border-gray-100 shadow-sm space-y-3">
          <Box flex justifyContent="space-between" alignItems="center">
            <Text bold className="text-gray-800 text-sm">Mã giảm giá (Voucher)</Text>
            <button 
              className="text-blue-600 text-xs font-semibold focus:outline-none"
              onClick={() => setShowVoucherModal(true)}
            >
              Chọn mã
            </button>
          </Box>
          
          <button 
            className="w-full border border-dashed border-gray-300 rounded-xl p-3 flex items-center bg-gray-50/50 hover:bg-gray-100 active:bg-gray-200 text-left focus:outline-none"
            onClick={() => setShowVoucherModal(true)}
          >
            <Icon icon="zi-star" className="text-blue-500 text-lg mr-2" />
            <Text className="text-xs text-gray-700 flex-1 font-medium">
              {selectedVoucher ? selectedVoucher.title : "Nhấn để chọn mã giảm giá của bạn"}
            </Text>
            {selectedVoucher && (
              <Box className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                -{discountAmount.toLocaleString("vi-VN")}đ
              </Box>
            )}
          </button>
        </Box>

        {/* 5. Ghi chú giao hàng */}
        <Box className="bg-white p-4 border-b border-gray-100 shadow-sm space-y-2">
          <Text bold className="text-gray-800 text-sm">Ghi chú giao hàng</Text>
          <textarea 
            placeholder="Ví dụ: Giao giờ hành chính..." 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-600 focus:bg-white leading-relaxed text-gray-700"
          />
        </Box>
      </Box>

      {/* Sticky Bottom Preview Footer */}
      <Box className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 p-4 shadow-lg z-50 flex items-center justify-between">
        <Box className="flex flex-col">
          <Text className="text-gray-400 text-xs">{activeTotalQuantity} sản phẩm</Text>
          <Text className="text-lg font-bold text-red-600">
            {finalTotalPrice.toLocaleString("vi-VN")}đ
          </Text>
        </Box>
        <button 
          className="bg-[#14502e] text-white font-bold rounded-xl h-11 px-8 flex items-center justify-center shadow-md active:opacity-75 transition-opacity"
          onClick={() => {
            if (validateCheckout()) {
              setShowCheckoutModal(true);
            }
          }}
        >
          Đặt hàng
        </button>
      </Box>

      {/* Voucher Selection Modal */}
      <Modal
        visible={showVoucherModal}
        title="Chọn Mã Giảm Giá"
        onClose={() => setShowVoucherModal(false)}
      >
        <Box p={4} className="max-h-[50vh] overflow-y-auto space-y-3">
          {vouchers.map((v) => (
            <Box 
              key={v.id} 
              className={`p-3 border rounded-xl cursor-pointer transition-all flex justify-between items-center ${
                selectedVoucher?.id === v.id 
                  ? "border-[#14502e] bg-green-50/70" 
                  : "border-gray-200 bg-white active:bg-gray-50"
              }`}
              onClick={() => {
                setSelectedVoucher(v);
                setShowVoucherModal(false);
                openSnackbar({ text: `Đã áp dụng ${v.title}!`, type: "success" });
              }}
            >
              <Box className="flex-1 pr-2">
                <Text bold size="small" className="text-gray-800">{v.title}</Text>
                <Text size="xxxxSmall" className="text-gray-400">
                  {v.discountType === "percent" ? `Giảm ${v.value}%` : `Giảm giá trị ${v.value?.toLocaleString("vi-VN")}đ`}
                </Text>
              </Box>
              <Box 
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  selectedVoucher?.id === v.id ? "border-[#14502e] bg-[#14502e] text-white" : "border-gray-300"
                }`}
              >
                {selectedVoucher?.id === v.id && <Icon icon="zi-check" size={10} />}
              </Box>
            </Box>
          ))}
          
          {selectedVoucher && (
            <Button 
              size="small" 
              variant="secondary" 
              className="w-full border-none text-red-600 bg-red-50 mt-2"
              onClick={() => {
                setSelectedVoucher(null);
                setShowVoucherModal(false);
              }}
            >
              Hủy chọn mã
            </Button>
          )}

          {vouchers.length === 0 && (
            <Text className="text-gray-400 text-center block py-4">Không có mã giảm giá khả dụng</Text>
          )}
        </Box>
      </Modal>

      {/* Checkout Confirm Dialog */}
      <Modal
        visible={showCheckoutModal}
        title="Xác nhận đơn hàng"
        onClose={() => setShowCheckoutModal(false)}
      >
        <Box p={4} className="text-center space-y-4">
          <Text size="small" className="text-gray-600 leading-relaxed block">
            Hệ thống sẽ ghi nhận thông tin đặt hàng từ nhà cung cấp "{activeShop}" và nhân viên cửa hàng sẽ sớm liên hệ để hỗ trợ bạn.
          </Text>
          <Box className="flex flex-col space-y-2 mt-4">
            <Button 
              className="bg-red-800 text-white font-bold h-11 rounded-xl shadow-md w-full border-none"
              loading={checkoutLoading}
              onClick={handleCheckoutSubmit}
            >
              Thanh toán khi nhận hàng
            </Button>
            <button 
              className="text-gray-500 font-semibold py-2 w-full text-sm active:bg-gray-100 rounded-xl"
              onClick={() => setShowCheckoutModal(false)}
            >
              Hủy bỏ
            </button>
          </Box>
        </Box>
      </Modal>
    </Page>
  );
};

export default CartPage;
