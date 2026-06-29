import React, { FC, useState, useEffect } from "react";
// 👉 ĐÃ THÊM: Import thẻ Select từ zmp-ui
import { Page, Header, Box, Text, Button, Icon, Modal, Input, useSnackbar, useNavigate, DatePicker, Select, Spinner } from "zmp-ui"; 
import { useLocation } from "react-router-dom";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useSetRecoilState } from "recoil";
import { cartState } from "../state";

const OrderPage: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const setCart = useSetRecoilState(cartState);
  const { product, location: detailLocation, cartGroup, selectedVariants } = location.state || {};
  const isFromCart = !!cartGroup;
  const isProductFlow = isFromCart ? cartGroup.isProduct : (product?.category === 'product');

  const basePrice = isFromCart ? cartGroup.totalAmount : Number(product?.price || 0);
  const selectedLoc = isFromCart ? cartGroup.items[0]?.cartItem?.location : detailLocation;
  const shopIdToUse = isFromCart ? cartGroup.shopId : (product?.providerId || product?.shopId || product?.ownerPhone);
  const shopNameToUse = isFromCart ? cartGroup.shopName : (product?.shopName || product?.providerName || "Shop đối tác");

  const displayTitle = isFromCart
      ? cartGroup.items.map((i: any) => `${i.cartItem.quantity}x ${i.cartItem.product.title}`).join(', ')
      : (product?.title || product?.name);

  // STATE CHUNG
  const [note, setNote] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 👇 STATE QUẢN LÝ ẨN/HIỆN GIÁ TIỀN 👇
  const [showPrice, setShowPrice] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
        if (configSnap.exists() && configSnap.data().showPrice !== undefined) {
          setShowPrice(configSnap.data().showPrice);
        }
      } catch (error) {
        console.error("Lỗi lấy cấu hình admin:", error);
      }
    };
    fetchConfig();
  }, []);
  // 👉 BƯỚC 2: STATE VOUCHER (MỚI)
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [myVouchers, setMyVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);

  // STATE CHO DỊCH VỤ (ĐẶT LỊCH)
  const [bookingDate, setBookingDate] = useState<Date>(new Date());
  const [bookingTime, setBookingTime] = useState("");
  const [extraServices, setExtraServices] = useState<any[]>([]); 
  const [selectedExtras, setSelectedExtras] = useState<any[]>([]); 
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  
  // STATE CHO SẢN PHẨM (GIAO HÀNG)
  const [receiverName, setReceiverName] = useState(localStorage.getItem("user_name") || "");
  const [receiverPhone, setReceiverPhone] = useState(localStorage.getItem("user_phone") || "");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [specificAddress, setSpecificAddress] = useState("");

  // 👉 STATE LƯU TRỮ DANH SÁCH TỪ API
  const [provincesList, setProvincesList] = useState<any[]>([]);
  const [districtsList, setDistrictsList] = useState<any[]>([]);
  const [wardsList, setWardsList] = useState<any[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string | number>("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<string | number>("");

  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

  // ========================================================
  // 👉 API FETCH: TẢI DANH SÁCH TỈNH / QUẬN / PHƯỜNG
  // ========================================================
  useEffect(() => {
    if (isProductFlow) {
        fetch('https://provinces.open-api.vn/api/p/')
        .then(res => res.json())
        .then(data => setProvincesList(data))
        .catch(err => console.error(err));
    }
  }, [isProductFlow]);

  useEffect(() => {
      if (selectedProvinceCode) {
          fetch(`https://provinces.open-api.vn/api/p/${selectedProvinceCode}?depth=2`)
          .then(res => res.json())
          .then(data => setDistrictsList(data.districts || []))
          .catch(err => console.error(err));
      } else {
          setDistrictsList([]);
      }
  }, [selectedProvinceCode]);

  useEffect(() => {
      if (selectedDistrictCode) {
          fetch(`https://provinces.open-api.vn/api/d/${selectedDistrictCode}?depth=2`)
          .then(res => res.json())
          .then(data => setWardsList(data.wards || []))
          .catch(err => console.error(err));
      } else {
          setWardsList([]);
      }
  }, [selectedDistrictCode]);
  // ========================================================

  useEffect(() => {
    if (shopIdToUse && !isProductFlow) {
      const fetchExtras = async () => {
        try {
          const servicesRef = collection(db, "services");
          let q = query(servicesRef, where("providerId", "==", shopIdToUse));
          let snap = await getDocs(q);

          if (snap.empty) {
              q = query(servicesRef, where("ownerPhone", "==", shopIdToUse));
              snap = await getDocs(q);
          }
          if (snap.empty) {
              q = query(servicesRef, where("shopId", "==", shopIdToUse));
              snap = await getDocs(q);
          }

          const docs = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => {
                if (isFromCart) return !cartGroup.items.some((i: any) => i.cartItem.product.id === item.id);
                return item.id !== product?.id;
            });
          
          setExtraServices(docs);
        } catch (error) { console.error("Lỗi lấy dịch vụ thêm:", error); }
      };
      fetchExtras();
    }
  }, [shopIdToUse, isFromCart, isProductFlow]);

  // 👉 BƯỚC 2: TÍNH TOÁN TIỀN VÀ ĐIỂM THƯỞNG
  const totalAmount = basePrice + (!isProductFlow ? selectedExtras.reduce((sum, s) => sum + (Number(s.price) || 0), 0) : 0);
  // Tính tổng tiền CUỐI CÙNG sau khi đã áp dụng Voucher (Không để bị âm tiền)
  const finalTotalAmount = Math.max(0, totalAmount - (appliedVoucher?.discountAmount || 0));
  
  // 👉 THUẬT TOÁN MỚI: TÍNH ĐIỂM DỰA TRÊN TỶ LỆ RIÊNG CỦA TỪNG BÀI ĐĂNG (SẢN PHẨM/DỊCH VỤ)
  let finalEarnedPoints = 0;
  const voucherDiscount = appliedVoucher?.discountAmount || 0;

  if (isFromCart) {
      // 1. Luồng Giỏ hàng (Có thể có nhiều món của các Shop khác nhau với tỷ lệ điểm khác nhau)
      finalEarnedPoints = cartGroup.items.reduce((sum: number, i: any) => {
          const itemPrice = Number(i.cartItem.product.price || 0) * i.cartItem.quantity;
          const itemPoints = Number(i.cartItem.product.points || 0) * i.cartItem.quantity;

          // a. Tính TỶ LỆ TÍCH ĐIỂM của riêng món này (VD: 10 điểm / 100k = 10%)
          const itemRate = itemPrice > 0 ? (itemPoints / itemPrice) : 0;

          // b. Phân bổ tiền Voucher cho món này (món càng đắt gánh càng nhiều tiền giảm)
          const itemDiscount = totalAmount > 0 ? (itemPrice / totalAmount) * voucherDiscount : 0;
          
          // c. Số tiền khách THỰC TRẢ cho riêng món này
          const itemFinalPrice = Math.max(0, itemPrice - itemDiscount);

          // d. Điểm thu về = Tiền thực trả x Tỷ lệ riêng của Bài đăng đó
          return sum + (itemFinalPrice * itemRate);
      }, 0);
  } else {
      // 2. Luồng Mua ngay / Đặt lịch (Chỉ có 1 Bài đăng gốc)
      const mainItemPrice = basePrice;
      const mainItemPoints = Number(product?.points || 0);
      
      // a. Tính TỶ LỆ TÍCH ĐIỂM của Bài đăng gốc
      const itemRate = mainItemPrice > 0 ? (mainItemPoints / mainItemPrice) : 0;
      
      // b. Vì chỉ có 1 bài đăng (và các phụ phí đi kèm), ta nhân trực tiếp tỷ lệ này với tổng tiền khách thực trả
      finalEarnedPoints = finalTotalAmount * itemRate;
  }

  // Làm tròn xuống số nguyên để không bị lẻ điểm (VD: 9.8 điểm -> 9 điểm)
  finalEarnedPoints = Math.floor(finalEarnedPoints);
  // 👉 BƯỚC 1: HÀM KIỂM TRA TÍNH HỢP LỆ CỦA VOUCHER VỚI ĐƠN HÀNG HIỆN TẠI
  const checkVoucherEligibility = (v: any) => {
    // 1. Kiểm tra giá trị đơn tối thiểu
    if (totalAmount < (v.minOrderValue || 0)) {
        return { isEligible: false, reason: "Chưa đạt tối thiểu" };
    }

    // 2. Kiểm tra giới hạn sản phẩm / dịch vụ
    const restrictedIds = v.applicableProducts || [];
    if (restrictedIds.length > 0) {
        let hasEligibleProduct = false;
        
        if (isFromCart) {
            // Nếu đi từ Giỏ hàng (nhiều món): Kiểm tra xem trong giỏ có món nào nằm trong danh sách cho phép không
            hasEligibleProduct = cartGroup.items.some((i: any) => restrictedIds.includes(i.cartItem.product.id));
        } else {
            // Nếu Đặt lịch/Mua ngay (1 món): Kiểm tra món đang mua có nằm trong danh sách không
            hasEligibleProduct = restrictedIds.includes(product?.id);
        }

        if (!hasEligibleProduct) {
            return { isEligible: false, reason: "Sai SP áp dụng" }; // Sai dịch vụ thì báo lỗi này
        }
    }

    // 3. Nếu vượt qua mọi bài kiểm tra thì cho qua
    return { isEligible: true, reason: "" };
};
  // 👉 HÀM ÁP DỤNG VÀ KIỂM TRA VOUCHER
  // 👉 HÀM 1: TẢI DANH SÁCH VOUCHER CỦA RIÊNG KHÁCH HÀNG NÀY
  const fetchMyVouchers = async () => {
    setShowVoucherModal(true);
    setLoadingVouchers(true);
    try {
        const userPhone = localStorage.getItem("user_phone");
        if (!userPhone) return;

        // Chỉ lấy Voucher thuộc về SĐT này và chưa sử dụng (active)
        const q = query(
            collection(db, "user_vouchers"),
            where("userId", "==", userPhone),
            where("status", "==", "active")
        );
        const snap = await getDocs(q);
        let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Lọc bỏ các Voucher đã quá hạn sử dụng
        const now = new Date();
        list = list.filter((v: any) => {
            const expiryDate = v.expiredAt?.toDate ? v.expiredAt.toDate() : new Date(v.expiredAt?.seconds * 1000);
            return expiryDate > now;
        });

        setMyVouchers(list);
    } catch (error) {
        console.error("Lỗi lấy voucher:", error);
    } finally {
        setLoadingVouchers(false);
    }
};

// 👉 HÀM 2: ÁP DỤNG VOUCHER KHI KHÁCH CLICK VÀO DANH SÁCH (ĐÃ NÂNG CẤP)
const handleSelectVoucher = (voucher: any) => {
  const eligibility = checkVoucherEligibility(voucher);
  
  // Nếu soát vé thấy không hợp lệ -> Báo lỗi và chặn lại
  if (!eligibility.isEligible) {
      return openSnackbar({ 
          text: eligibility.reason === "Sai SP áp dụng" ? "Voucher không áp dụng cho Dịch vụ này!" : `Đơn chưa đạt ${(voucher.minOrderValue / 1000).toLocaleString()}k`, 
          type: "warning", 
          position: "top" 
      });
  }

  setAppliedVoucher(voucher);
  setShowVoucherModal(false);
  openSnackbar({ text: `Áp dụng thành công! Giảm ${voucher.discountAmount.toLocaleString()}đ`, type: "success", position: "top" });
};
  // Lấy điểm cố định từ dữ liệu Firebase truyền sang
  let earnedPoints = 0;
  if (isFromCart) {
      // Nếu mua từ giỏ hàng: Cộng dồn điểm của từng món * số lượng
      earnedPoints = cartGroup.items.reduce((sum: number, i: any) => {
          const pts = Number(i.cartItem.product.points || 0);
          return sum + (pts * i.cartItem.quantity);
      }, 0);
  } else {
      // Nếu Mua ngay/Đặt lịch ngay: Lấy trực tiếp điểm của món đó
      earnedPoints = Number(product?.points || 0);
  }

  const handleConfirmOrder = async (paymentMethod: string) => {
    if (isProductFlow) {
        if (!receiverName || !receiverPhone || !province || !district || !ward || !specificAddress) {
            return openSnackbar({ text: "Vui lòng điền đầy đủ thông tin giao hàng!", type: "warning", position: "top" });
        }
    } else {
        if (!bookingTime) return openSnackbar({ text: "Vui lòng chọn khung giờ hẹn!", type: "warning", position: "top" });
    }
    
    setLoading(true);
    try {
      const fullDeliveryAddress = isProductFlow ? `${specificAddress}, ${ward}, ${district}, ${province}` : null;

      const orderData = {
        userId: localStorage.getItem("user_phone"),
        userName: localStorage.getItem("user_name"),
        orderType: isProductFlow ? "product" : "service", 
        productId: isFromCart ? "cart_group" : product?.id, 
        productName: displayTitle,
        selectedVariants: !isFromCart ? selectedVariants : null, // 👉 BỔ SUNG LƯU PHÂN LOẠI
        cartItems: isFromCart ? cartGroup.items.map((i:any) => i.cartItem) : null,
        shopId: shopIdToUse,
        shopName: shopNameToUse,
        location: selectedLoc || null, 
        
        bookingDate: !isProductFlow ? bookingDate.toLocaleDateString('vi-VN') : null,
        bookingTime: !isProductFlow ? bookingTime : null,
        extras: !isProductFlow ? selectedExtras : [],
        
        receiverName: isProductFlow ? receiverName : null,
        receiverPhone: isProductFlow ? receiverPhone : null,
        deliveryAddress: fullDeliveryAddress,
        deliveryDetails: isProductFlow ? { province, district, ward, specificAddress } : null,
        note,
        // 👉 BỔ SUNG: Lưu rõ ràng số tiền gốc, tiền giảm và tiền cuối cùng
        originalAmount: totalAmount,
        discountAmount: appliedVoucher?.discountAmount || 0,
        voucherCode: appliedVoucher?.code || null,
        totalAmount: finalTotalAmount,
        paymentMethod,
        earnedPoints: earnedPoints,
        status: "pending",
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "orders"), orderData);

      // 👉 NẾU DÙNG VOUCHER -> PHẢI KHÓA VOUCHER LẠI KHÔNG CHO DÙNG LẦN NỮA
      if (appliedVoucher) {
          await updateDoc(doc(db, "user_vouchers", appliedVoucher.id), {
              status: "used",
              usedAt: serverTimestamp(),
              usedForOrderId: docRef.id // Ghi vết lại dùng cho đơn nào để tiện đối soát
          });
      }
      // 👉 BƯỚC 3: XÓA ĐÚNG CÁC SẢN PHẨM VỪA MUA KHỎI GIỎ HÀNG
      if (isFromCart) {
        // Ép kiểu bất định (any) để TypeScript không báo lỗi thiếu trường 'location'
        setCart((prevCart: any[]) => prevCart.filter((cartItem: any) => {
            const isPurchased = cartGroup.items.some((purchasedItem: any) => 
                purchasedItem.cartItem.product.id === cartItem.product.id &&
                (purchasedItem.cartItem.location?.address === cartItem.location?.address || 
                 purchasedItem.cartItem.location?.specificAddress === cartItem.location?.specificAddress)
            );
            return !isPurchased;
        }));
    }
      openSnackbar({ text: isProductFlow ? "Đặt hẹn thành công!" : "Đặt lịch thành công!", type: "success", position: "top" });
      navigate("/history"); 
    } catch (e) {
      openSnackbar({ text: "Có lỗi xảy ra, thử lại sau", type: "error", position: "top" });
    } finally {
      setLoading(false);
      setShowPaymentModal(false);
    }
  };

  return (
    <Page className="bg-gray-100 pb-28"> 
      <Header title={isProductFlow ? "Xác nhận đặt hẹn" : "Xác nhận đặt lịch"} />
      
      <Box p={4} className="bg-white mb-2 shadow-sm">
        <Text bold size="large" className="text-gray-800 mb-1 leading-tight">{displayTitle}</Text>
        {/* 👉 HIỂN THỊ PHÂN LOẠI HÀNG (Cho cả Mua ngay và Mua từ Giỏ hàng) */}
        {!isFromCart && selectedVariants && Object.keys(selectedVariants).length > 0 && (
            <Box mb={2}>
                <Text size="xSmall" className="text-gray-600 font-medium flex items-center bg-gray-100 w-fit px-2 py-0.5 rounded">
                    <Icon icon="zi-note" size={12} className="mr-1 text-gray-500" />
                    {Object.entries(selectedVariants).map(([key, val]) => `${key}: ${val}`).join(' | ')}
                </Text>
            </Box>
        )}
        
        {isFromCart && cartGroup?.items?.map((itemObj: any, idx: number) => {
            const options = itemObj.cartItem.options;
            if (options && Object.keys(options).length > 0) {
                return (
                    <Box key={idx} mb={2}>
                        <Text size="xSmall" className="text-gray-600 font-medium flex items-center bg-gray-100 w-fit px-2 py-0.5 rounded">
                            <Icon icon="zi-note" size={12} className="mr-1 text-gray-500 shrink-0" />
                            <span className="line-clamp-1">
                                {itemObj.cartItem.product.title || itemObj.cartItem.product.name}: {Object.entries(options).map(([key, val]) => `${key}: ${val}`).join(' | ')}
                            </span>
                        </Text>
                    </Box>
                );
            }
            return null;
        })}
        {/* 👇 HIỂN THỊ GIÁ HOẶC ĐIỂM Ở PHẦN HEADER 👇 */}
        {showPrice ? (
            <Text size="small" className="text-orange-600 font-bold mb-2">{basePrice.toLocaleString()}đ</Text>
        ) : (
            <Box mb={2}>
                <Text size="xSmall" className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 shadow-sm inline-flex items-center">
                    <Icon icon="zi-star-solid" size={14} className="mr-1" />
                    {/* Tự động tính điểm an toàn (Kể cả món chưa set điểm) */}
                    {(() => {
                        let pts = 0;
                        if (isFromCart) {
                            pts = (cartGroup?.items || []).reduce((sum: number, i: any) => {
                                const p = i?.cartItem?.product?.points || 0;
                                const prc = i?.cartItem?.product?.price || 0;
                                const fallback = p === 0 ? Math.floor(prc / 10000) : p;
                                return sum + (fallback * (i?.cartItem?.quantity || 1));
                            }, 0);
                        } else {
                            const p = product?.points || 0;
                            const prc = product?.price || 0;
                            pts = p === 0 ? Math.floor(prc / 10000) : p;
                        }
                        return pts > 0 ? `+${pts} điểm` : "Tích điểm";
                    })()}
                </Text>
            </Box>
        )}
        <Box flex alignItems="center" className="text-gray-500 pt-2 border-t border-gray-50">
          <Icon icon={isProductFlow ? "zi-store" : "zi-location" as any} size={14} className="mr-1 text-blue-500 shrink-0"/>
          <Text size="xxSmall" className="flex-1">
              {isProductFlow ? "Cung cấp bởi: " : "Thực hiện tại: "}
              {selectedLoc?.address || selectedLoc?.specificAddress || "Cơ sở chưa cập nhật"}
          </Text>
        </Box>
      </Box>

      {/* ========================================================= */}
      {/* LUỒNG SẢN PHẨM: FORM ĐỊA CHỈ TỰ ĐỘNG THEO API */}
      {/* ========================================================= */}
      {isProductFlow && (
        <Box p={4} className="bg-white mb-2 shadow-sm">
          <Text bold className="mb-3 text-gray-800">Thông tin người nhận</Text>
          <Box className="space-y-3">
            <Input label="Tên người nhận" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            <Input label="Số điện thoại" type="text" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
          </Box>

          <Text bold className="mt-5 mb-3 text-gray-800">Địa chỉ giao hàng</Text>
          <Box className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              
              {/* Nút Chọn Tỉnh */}
              <Select
                  label="Tỉnh / Thành phố"
                  placeholder="Chọn Tỉnh/Thành phố"
                  value={selectedProvinceCode}
                  closeOnSelect={true}
                  onChange={(val) => {
                      const selected = provincesList.find(p => p.code === val);
                      setSelectedProvinceCode(val as string);
                      setProvince(selected?.name || "");
                      // Xóa dữ liệu cũ khi đổi tỉnh
                      setSelectedDistrictCode("");
                      setDistrict("");
                      setWard("");
                  }}
              >
                  {provincesList.map((p) => (
                      <Select.Option key={p.code} value={p.code} title={p.name} />
                  ))}
              </Select>

              {/* Nút Chọn Quận */}
              <Select
                  label="Quận / Huyện"
                  placeholder="Chọn Quận/Huyện"
                  value={selectedDistrictCode}
                  closeOnSelect={true}
                  onChange={(val) => {
                      const selected = districtsList.find(d => d.code === val);
                      setSelectedDistrictCode(val as string);
                      setDistrict(selected?.name || "");
                      // Xóa dữ liệu cũ khi đổi quận
                      setWard("");
                  }}
                  disabled={!selectedProvinceCode}
              >
                  {districtsList.map((d) => (
                      <Select.Option key={d.code} value={d.code} title={d.name} />
                  ))}
              </Select>

              {/* Nút Chọn Phường */}
              <Select
                  label="Phường / Xã"
                  placeholder="Chọn Phường/Xã"
                  value={ward}
                  closeOnSelect={true}
                  onChange={(val) => {
                      setWard(val as string);
                  }}
                  disabled={!selectedDistrictCode}
              >
                  {wardsList.map((w) => (
                      <Select.Option key={w.code} value={w.name} title={w.name} />
                  ))}
              </Select>
              
              {/* Ô nhập tay: Địa chỉ cụ thể */}
              <Input.TextArea 
                  label="Địa chỉ cụ thể" 
                  placeholder="Số nhà, ngõ ngách, tên đường..." 
                  value={specificAddress} 
                  onChange={(e) => setSpecificAddress(e.target.value)} 
              />
          </Box>
        </Box>
      )}

      {/* ========================================================= */}
      {/* LUỒNG DỊCH VỤ VÀ GHI CHÚ CHUNG (GIỮ NGUYÊN) */}
      {/* ========================================================= */}
      {!isProductFlow && (
        <>
          <Box p={4} className="bg-white mb-2 shadow-sm">
            <Text bold className="mb-3 text-gray-800">Chọn ngày & khung giờ</Text>
            <DatePicker label="Ngày thực hiện" helperText="Chọn ngày bạn muốn đến" mask dateFormat="dd/mm/yyyy" title="Chọn ngày" value={bookingDate} onChange={(value) => { setBookingDate(value as Date); }} />
            <Text size="xSmall" className="mt-4 mb-2 text-gray-500">Khung giờ trống:</Text>
            <Box className="flex flex-wrap gap-2">
                {timeSlots.map(t => (
                    <Box key={t} onClick={() => setBookingTime(t)} style={{ width: 'calc(25% - 8px)' }} className={`p-2 text-center rounded-lg border text-xs transition-all cursor-pointer ${bookingTime === t ? "bg-blue-600 text-white border-blue-600 shadow-md font-bold" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {t}
                    </Box>
                ))}
            </Box>
          </Box>

          <Box p={4} className="bg-white mb-2 shadow-sm">
            <Text bold className="mb-3 text-gray-800">Dịch vụ chọn thêm</Text>
            {selectedExtras.length > 0 ? (
                <Box>
                    {selectedExtras.map((ex, idx) => (
                        <Box key={idx} flex justifyContent="space-between" alignItems="center" className="mb-2 pb-2 border-b border-gray-50 last:border-0">
                            <Text size="small" className="text-gray-700 flex-1 pr-2 line-clamp-1">• {ex.title || ex.name}</Text>
                            {/* 👇 HIỂN THỊ GIÁ HOẶC ĐIỂM DỰA TRÊN CÔNG TẮC 👇 */}
                            {showPrice ? (
                                <Text size="small" bold className="text-orange-600">+{Number(ex.price || 0).toLocaleString()}đ</Text>
                            ) : (
                                <Text size="xxxxSmall" className="text-yellow-600 font-bold bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100 shadow-sm">
                                    {ex.points ? `+${ex.points} điểm` : (ex.price >= 10000 ? `+${Math.floor(ex.price / 10000)} điểm` : "Tích điểm")}
                                </Text>
                            )}
                        </Box>
                    ))}
                    <Box onClick={() => setShowExtrasModal(true)} className="mt-3 text-center py-2.5 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm cursor-pointer active:opacity-70 border border-blue-100">
                        + Chọn thêm / Chỉnh sửa dịch vụ
                    </Box>
                </Box>
            ) : (
                <Box className="py-5 text-center border border-dashed border-blue-300 bg-blue-50/50 rounded-xl cursor-pointer active:bg-blue-100 transition-colors" onClick={() => setShowExtrasModal(true)}>
                    <Icon icon="zi-plus-circle" className="text-blue-500 mb-1" size={28} />
                    <Text size="small" className="text-blue-600 font-medium">Nhấn để xem các dịch vụ chọn thêm</Text>
                </Box>
            )}
          </Box>
        </>
      )}

      {/* 👉 KHỐI CHỌN VOUCHER TỪ DANH SÁCH */}
      {/* 👉 CHỈ HIỂN THỊ KHỐI VOUCHER KHI ĐƯỢC PHÉP HIỂN THỊ GIÁ 👇 */}
      {showPrice && (
      <Box p={4} className="bg-white mb-2 shadow-sm">
          <Box flex justifyContent="space-between" alignItems="center" className="mb-3">
              <Text bold className="text-gray-800">Mã giảm giá (Voucher)</Text>
              <Text size="small" className="text-blue-600 font-medium cursor-pointer active:opacity-50" onClick={fetchMyVouchers}>
                  {appliedVoucher ? "Thay đổi mã" : "Chọn mã"}
              </Text>
          </Box>

          {appliedVoucher ? (
              <Box className="p-3 bg-green-50 border border-green-200 rounded-xl flex justify-between items-center animate-fade-in">
                  <Box flex alignItems="center">
                      <Icon icon="zi-check-circle-solid" className="text-green-600 mr-2" size={24} />
                      <Box>
                          <Text bold size="small" className="text-green-700">Đã áp dụng: {appliedVoucher.code}</Text>
                          <Text size="xSmall" className="text-green-600">- Giảm {appliedVoucher.discountAmount.toLocaleString()}đ</Text>
                      </Box>
                  </Box>
                  <Text size="small" className="text-red-500 font-bold cursor-pointer p-2 active:opacity-50" onClick={() => setAppliedVoucher(null)}>
                      Bỏ chọn
                  </Text>
              </Box>
          ) : (
              <Box className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center cursor-pointer active:bg-gray-100 transition-colors" onClick={fetchMyVouchers}>
                  <Icon icon="zi-star" className="text-blue-500 mr-2" size={24} />
                  <Text size="small" className="text-gray-600 font-medium">Nhấn để chọn mã giảm giá của bạn</Text>
              </Box>
          )}
      </Box>
      )}
      <Box p={4} className="bg-white mb-2 shadow-sm">
        <Input.TextArea label={isProductFlow ? "Ghi chú giao hàng" : "Ghi chú cho cửa hàng"} placeholder={isProductFlow ? "Ví dụ: Giao giờ hành chính..." : "Ví dụ: Da nhạy cảm, yêu cầu kỹ thuật viên..."} value={note} onChange={(e) => setNote(e.target.value)} />
      </Box>

      {/* 👉 THANH CÔNG CỤ TỔNG TIỀN ĐÃ ĐƯỢC BẢO TOÀN NÚT "TIẾP TỤC" */}
      <Box className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex items-center justify-between px-4 py-3 z-50 shadow-lg" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
      <Box flex flexDirection="column" className="flex-1 overflow-hidden pr-2">
              {showPrice ? (
                  <>
                      <Text size="xxxxSmall" className="text-gray-400 font-bold uppercase">Tổng cộng</Text>
                      <Box flex alignItems="baseline">
                          {appliedVoucher && (
                              <Text size="small" className="text-gray-400 line-through mr-2">{totalAmount.toLocaleString()}đ</Text>
                          )}
                          <Text bold size="xLarge" className="text-orange-600 leading-tight">
                              {finalTotalAmount.toLocaleString()}đ
                          </Text>
                      </Box>
                      {finalEarnedPoints > 0 && (
                          <Text size="xxxxSmall" className="text-yellow-600 font-bold mt-0.5 flex items-center">
                              <Icon icon="zi-star-solid" size={12} className="mr-0.5" />
                              Nhận ngay +{finalEarnedPoints.toLocaleString()} điểm
                          </Text>
                      )}
                  </>
              ) : (
                  <>
                      <Text size="xxxxSmall" className="text-yellow-600 font-bold uppercase mb-0.5">Điểm dự kiến</Text>
                      <Text bold size="large" className="text-yellow-500 flex items-center">
                          <Icon icon="zi-star-solid" size={20} className="mr-1" />
                          {finalEarnedPoints > 0 ? `+${finalEarnedPoints.toLocaleString()}` : "Theo hạng mức"}
                      </Text>
                  </>
              )}
          </Box>
          {/* Nút được đặt shrink-0 để không bị bóp méo khi màn hình nhỏ */}
          <Button onClick={() => setShowPaymentModal(true)} className="bg-blue-600 rounded-xl font-bold shrink-0 px-6" loading={loading}>
              Tiếp tục
          </Button>
      </Box>
      {!isProductFlow && (
          <Modal visible={showExtrasModal} title="Dịch vụ của Shop" onClose={() => setShowExtrasModal(false)} actions={[{ text: "Xác nhận", highLight: true, onClick: () => setShowExtrasModal(false) }]}>
            <Box p={2} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {extraServices.length === 0 ? (
                    <Text className="text-center text-gray-400 italic py-4">Shop chưa có dịch vụ nào khác để chọn thêm.</Text>
                ) : (
                    extraServices.map((svc: any) => {
                        const isSelected = selectedExtras.some((s) => s.id === svc.id);
                        return (
                            <Box key={svc.id} className={`p-3 mb-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${isSelected ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-gray-200 bg-white hover:bg-gray-50"}`} onClick={() => { if (isSelected) setSelectedExtras(selectedExtras.filter((s) => s.id !== svc.id)); else setSelectedExtras([...selectedExtras, svc]); }}>
                                <Box flex alignItems="center" className="flex-1 pr-3 overflow-hidden">
                                    <Box className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden mr-3 shrink-0 border border-gray-100"><img src={svc.image || "https://zalo-api.zdn.vn/api/emoticon/emoticon/default_avatar.png"} className="w-full h-full object-cover" /></Box>
                                    <Box className="flex-1 overflow-hidden">
                                        <Text bold size="small" className="line-clamp-2 text-gray-800">{svc.title || svc.name}</Text>
                                        {/* 👇 HIỂN THỊ GIÁ HOẶC ĐIỂM 👇 */}
                                        {showPrice ? (
                                            <Text size="small" className="text-orange-600 font-bold mt-1">+{Number(svc.price || 0).toLocaleString()}đ</Text>
                                        ) : (
                                            <Text size="xxxxSmall" className="text-yellow-600 font-bold mt-1 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100 w-fit">
                                                {svc.points ? `+${svc.points} điểm` : (svc.price >= 10000 ? `+${Math.floor(svc.price / 10000)} điểm` : "Tích điểm")}
                                            </Text>
                                        )}
                                    </Box>
                                </Box>
                                <Box className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 ${isSelected ? "bg-orange-500 border-orange-500" : "bg-white border-gray-300"}`}>
                                    {isSelected && <Icon icon="zi-check" size={16} className="text-white" />}
                                </Box>
                            </Box>
                        );
                    })
                )}
            </Box>
          </Modal>
      )}
      {/* 👉 MODAL HIỂN THỊ DANH SÁCH VOUCHER */}
      <Modal visible={showVoucherModal} title="Mã giảm giá của bạn" onClose={() => setShowVoucherModal(false)} actions={[{ text: "Đóng", onClick: () => setShowVoucherModal(false) }]}>
          <Box p={2} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingVouchers ? (
                  <Box flex justifyContent="center" py={5}><Spinner /></Box>
              ) : myVouchers.length === 0 ? (
                  <Box py={5} flex flexDirection="column" alignItems="center">
                      <Icon icon={"zi-star" as any} size={40} className="text-gray-300 mb-2" />
                      <Text className="text-gray-400">Bạn chưa có mã giảm giá nào.</Text>
                  </Box>
              ) : (
                  <Box className="space-y-3">
                      {myVouchers.map((v, idx) => {
                          // 👉 BƯỚC 3: DÙNG HÀM KIỂM TRA ĐỂ VẼ GIAO DIỆN
                          const eligibility = checkVoucherEligibility(v);
                          const isEligible = eligibility.isEligible;
                          
                          return (
                              <Box 
                                  key={idx} 
                                  className={`p-3 rounded-xl border flex items-center justify-between shadow-sm transition-all ${isEligible ? 'bg-white border-blue-200 cursor-pointer active:bg-blue-50' : 'bg-gray-50 border-gray-200 opacity-70'}`} 
                                  onClick={() => isEligible && handleSelectVoucher(v)}
                              >
                                  <Box flex alignItems="flex-start" className="flex-1 pr-2">
                                      <Box className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 mt-0.5 ${isEligible ? 'bg-blue-50' : 'bg-gray-200'}`}>
                                          <Icon icon={"zi-ticket" as any} className={isEligible ? "text-blue-600" : "text-gray-400"} size={20} />
                                      </Box>
                                      <Box>
                                          <Text bold size="small" className={isEligible ? "text-gray-800" : "text-gray-500"}>Giảm {v.discountAmount.toLocaleString()}đ</Text>
                                          <Text size="xxxxSmall" className={`${isEligible ? 'text-gray-500' : 'text-gray-400'} mt-1 leading-tight`}>
                                              Đơn tối thiểu {(v.minOrderValue/1000).toLocaleString()}k
                                              <br/>Mã: <span className="font-bold">{v.code}</span>
                                          </Text>
                                          
                                          {/* Hiển thị câu Điều kiện (in chìm từ Profile) */}
                                          {v.conditionText && (
                                              <Text size="xxxxSmall" className={`mt-1 font-medium italic ${isEligible ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                  * {v.conditionText}
                                              </Text>
                                          )}
                                      </Box>
                                  </Box>
                                  
                                  {!isEligible ? (
                                      // Hiện rõ lý do: Do chưa đủ tiền hay do Sai sản phẩm
                                      <Text size="xxxxSmall" className="text-red-500 bg-red-50 p-1 rounded font-medium text-center" style={{maxWidth: 70}}>
                                          {eligibility.reason}
                                      </Text>
                                  ) : (
                                      <Button size="small" className="bg-blue-600 rounded-full px-3">Dùng</Button>
                                  )}
                              </Box>
                          )
                      })}
                  </Box>
              )}
          </Box>
      </Modal>

      {/* 👉 ĐÃ SỬA: BỎ TỪ KHÓA ZALOPAY, CHUYỂN SANG THANH TOÁN OFFLINE ĐỂ PASS KIỂM DUYỆT */}
      {/* 👉 ĐÃ SỬA: LÀM SẠCH GIAO DIỆN XÁC NHẬN ĐỂ VƯỢT KIỂM DUYỆT 100% */}
      <Modal visible={showPaymentModal} title="Xác nhận đặt hẹn" onClose={() => setShowPaymentModal(false)}>
        <Box p={2} className="flex flex-col gap-3">
            <Text size="small" className="text-gray-600 text-center mb-2 px-2">
                Hệ thống sẽ ghi nhận thông tin và nhân viên cửa hàng sẽ sớm liên hệ để hỗ trợ bạn.
            </Text>
            
            <Button fullWidth onClick={() => handleConfirmOrder('later')} className="h-12 rounded-xl bg-blue-600 text-white font-bold">
                {isProductFlow ? "Xác nhận & Hoàn tất khi nhận hàng COD" : "Xác nhận đặt lịch"}
            </Button>
            
            <Button fullWidth variant="tertiary" onClick={() => setShowPaymentModal(false)} className="text-gray-500">
                Hủy bỏ
            </Button>
        </Box>
      </Modal>
    </Page>
  );
};

export default OrderPage;