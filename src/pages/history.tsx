import React, { FC, useEffect, useState } from "react";
import { Page, Header, Box, Text, Icon, Spinner, Button, Modal, Input, useSnackbar } from "zmp-ui";
import { getUserInfo } from "zmp-sdk/apis";
import { collection, query, where, getDocs, doc, addDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"; 
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

// Hàm format tiền tệ
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

// Hàm format ngày tháng
const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} - ${date.getHours()}:${date.getMinutes()}`;
};

const HistoryPage: FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();
  // 👇 STATE QUẢN LÝ ẨN/HIỆN GIÁ TIỀN 👇
  const [showPrice, setShowPrice] = useState(false);
  
  // 👉 THÊM MỚI: State quản lý việc Hủy cuộc hẹn
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        // 👇 1. TẢI CẤU HÌNH ADMIN (LẤY TRẠNG THÁI CÔNG TẮC GIÁ) 👇
        const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
        if (configSnap.exists() && configSnap.data().showPrice !== undefined) {
            setShowPrice(configSnap.data().showPrice);
        }

        let userPhone = localStorage.getItem("user_phone");

        if (!userPhone) {
            const { userInfo } = await getUserInfo({});
            const userQuery = query(collection(db, "users"), where("zaloId", "==", userInfo.id));
            const userSnapshot = await getDocs(userQuery);
            if (!userSnapshot.empty) {
                userPhone = userSnapshot.docs[0].data().phone;
            }
        }

        if (userPhone) {
            const ordersQuery1 = query(collection(db, "orders"), where("userId", "==", userPhone));
            const ordersQuery2 = query(collection(db, "orders"), where("phone", "==", userPhone));
            
            const [snap1, snap2] = await Promise.all([getDocs(ordersQuery1), getDocs(ordersQuery2)]);
            
            const allDocs = [...snap1.docs, ...snap2.docs];
            const uniqueDocs = Array.from(new Set(allDocs.map(a => a.id))).map(id => allDocs.find(a => a.id === id));
            
            const ordersData = uniqueDocs.map(doc => ({ id: doc?.id, ...doc?.data() }));

            ordersData.sort((a: any, b: any) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            setOrders(ordersData);
        } else {
            setOrders([]);
        }
      } catch (error) {
        console.log("Lỗi tải cuộc hẹn:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // 👉 THÊM MỚI: Hàm xử lý Xác nhận hủy cuộc hẹn
  const handleConfirmCancel = async () => {
    if (!cancelingId) return;
    setIsCanceling(true);
    try {
      // 1. Cập nhật trạng thái trên Firebase
      const orderRef = doc(db, "orders", cancelingId);
      await updateDoc(orderRef, {
        status: "cancelled"
      });

      // 2. Cập nhật ngay lập tức giao diện (Không cần tải lại trang)
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === cancelingId ? { ...order, status: "cancelled" } : order
        )
      );

      openSnackbar({ text: "Đã hủy cuộc hẹn thành công!", type: "success" });
    } catch (error) {
      console.error("Lỗi hủy cuộc hẹn:", error);
      openSnackbar({ text: "Có lỗi xảy ra, vui lòng thử lại sau.", type: "error" });
    } finally {
      setIsCanceling(false);
      setCancelingId(null);
    }
  };
  // 👉 THÊM MỚI: Các State dành cho tính năng Đánh giá (Review)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState<any>(null);
  const [rating, setRating] = useState(5); // Mặc định 5 sao
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Hàm mở Modal Đánh giá
  const handleOpenReview = (order: any) => {
      setReviewingOrder(order);
      setRating(5);
      setReviewText("");
      setShowReviewModal(true);
  };

  // Hàm Gửi Đánh giá lên Firebase
  const handleSubmitReview = async () => {
      if (!reviewingOrder) return;
      setIsSubmittingReview(true);
      try {
          // 1. Lưu bài đánh giá vào bảng 'reviews'
          await addDoc(collection(db, "reviews"), {
              orderId: reviewingOrder.id,
              shopId: reviewingOrder.shopId,
              productId: reviewingOrder.productId,
              productName: reviewingOrder.productName,
              userId: reviewingOrder.userId,
              userName: reviewingOrder.userName,
              branchName: reviewingOrder.location?.name || "Chi nhánh",
              rating: rating,
              content: reviewText,
              createdAt: serverTimestamp()
          });

          // 2. Đánh dấu cuộc hẹn là "Đã đánh giá" để giấu nút đi
          await updateDoc(doc(db, "orders", reviewingOrder.id), {
              isReviewed: true
          });

          // 3. Cập nhật giao diện
          setOrders(prev => prev.map(o => o.id === reviewingOrder.id ? { ...o, isReviewed: true } : o));
          setShowReviewModal(false);
          openSnackbar({ text: "Cảm ơn bạn đã đánh giá!", type: "success" });
      } catch (error) {
          console.error("Lỗi gửi đánh giá:", error);
          openSnackbar({ text: "Có lỗi xảy ra, thử lại sau.", type: "error" });
      } finally {
          setIsSubmittingReview(false);
      }
  };
  return (
    <Page className="bg-gray-50">
      <Header title="Lịch sử cuộc hẹn" showBackIcon={true} />
      
      {loading ? (
        <Box flex justifyContent="center" mt={10}><Spinner /></Box>
      ) : orders.length === 0 ? (
        <Box flex flexDirection="column" alignItems="center" justifyContent="center" mt={10} p={4}>
           <Icon icon="zi-clock-2" size={48} className="text-gray-300 mb-4" />
           <Text className="text-gray text-center">Bạn chưa có cuộc hẹn nào.</Text>
           <Text size="xxSmall" className="text-gray-400 text-center mt-2">
             (Các cuộc hẹn bạn đặt sẽ hiển thị tại đây)
           </Text>
        </Box>
      ) : (
        <Box p={4} className="pb-20">
          {orders.map((order) => {
            const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
            const extrasTotal = (order.extras || []).reduce((sum: number, ex: any) => sum + Number(ex.price || 0), 0);
            const mainServicePrice = total - extrasTotal;
            // 👇 THÊM ĐOẠN LOGIC TỰ ĐỘNG TÍNH ĐIỂM NÀY 👇
            let displayPoints = order.points || order.rewardPoints || 0;
            
            // Nếu Firebase không có tổng điểm, tự động quét giỏ hàng để cộng dồn
            if (!displayPoints && (order.cartItems || order.items)) {
                displayPoints = (order.cartItems || order.items).reduce((sum: number, item: any) => {
                    const itemPoint = item.product?.points || item.points || 0;
                    // Nếu sản phẩm không có điểm, tự tính mặc định: 10.000đ = 1 điểm (tỷ lệ 10%)
                    const fallbackPoint = itemPoint === 0 ? Math.floor((item.product?.price || item.price || 0) / 10000) : itemPoint;
                    return sum + (fallbackPoint * (item.quantity || 1));
                }, 0);
            }
            
            // Nếu là đơn dịch vụ lẻ (Không có giỏ hàng) và không có điểm
            if (!displayPoints && !order.cartItems && !order.items) {
              // 👇 SỬA TẠI ĐÂY: Dùng total để tính điểm trên tổng hóa đơn (Gồm cả dịch vụ chính + thêm)
              displayPoints = Math.floor(total / 10000);
          }
            // 👆 KẾT THÚC LOGIC TÍNH ĐIỂM 👆

            return (
              <Box key={order.id} className="border border-gray-200 rounded-xl p-4 mb-4 shadow-sm bg-white">
                {/* Header cuộc hẹn: Mã đơn + Ngày đặt */}
                <Box flex justifyContent="space-between" mb={3} className="border-b pb-3 border-dashed border-gray-200">
                  <Box>
                      <Text bold size="small" className="text-blue-600">#{order.id.slice(0, 6).toUpperCase()}</Text>
                      <Text size="xxSmall" className="text-gray-500 mt-0.5">{formatDate(order.createdAt)}</Text>
                  </Box>
                  <Box className={`px-2 py-1 rounded-lg h-fit ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'shipping' ? 'bg-blue-100 text-blue-700' :
                      (order.status === 'success' || order.status === 'completed') ? 'bg-green-100 text-green-700' : 
                      'bg-gray-100 text-gray-600'
                  }`}>
                      <Text size="xxSmall" bold>
                          {order.status === 'pending' ? 'Chờ xác nhận' : 
                            order.status === 'shipping' ? 'Đang giao' :
                            (order.status === 'success' || order.status === 'completed') ? 'Hoàn thành' : 
                            (order.status === 'cancel' || order.status === 'cancelled') ? 'Đã hủy' : order.status}
                      </Text>
                  </Box>
                </Box>
                {/* 👉 BƯỚC 2: BỔ SUNG THÔNG TIN SHOP & CƠ SỞ */}
                <Box className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <Box flex alignItems="center" className="mb-1.5">
                        <Icon icon={"zi-store" as any} size={14} className="text-gray-600 mr-1.5 shrink-0" />
                        <Text bold size="small" className="text-gray-800 line-clamp-1">
                            {order.shopName || "Shop đối tác"}
                        </Text>
                    </Box>
                    <Box flex alignItems="flex-start">
                        <Icon icon="zi-location" size={14} className="text-gray-500 mr-1.5 mt-0.5 shrink-0" />
                        <Text size="xxxxSmall" className="text-gray-600 italic">
                            {order.location?.name ? `${order.location.name} - ` : ''}
                            {order.location?.address || order.location?.specificAddress || order.deliveryAddress || "Cơ sở chưa cập nhật"}
                        </Text>
                    </Box>
                </Box>
                {/* PHẦN NỘI DUNG CUỘC HẸN */}
                {(!order.cartItems && !order.items) ? (
                    // Đơn Đặt lịch (Spa, Dịch vụ)
                    <Box 
                        className="py-2 cursor-pointer active:opacity-60"
                        onClick={() => navigate(`/detail/${order.productId}`)} /* 👉 THÊM SỰ KIỆN CLICK */
                    >
                        <Box flex alignItems="flex-start" mb={1}>
                            <Box className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center mr-3 shrink-0">
                                <Icon icon="zi-calendar" className="text-blue-500" size={20} />
                            </Box>
                            <Box className="flex-1">
                                <Box flex justifyContent="space-between" alignItems="flex-start">
                                    <Text bold size="small" className="text-gray-800 line-clamp-2 pr-2">
                                        {order.productName}
                                    </Text>
                                    {/* 👇 ẨN GIÁ VÀ HIỆN ĐIỂM TẠI ĐÂY 👇 */}
                                    {showPrice ? (
                                        <Text size="small" className="text-gray-800 font-medium whitespace-nowrap">
                                            {formatCurrency(mainServicePrice)}
                                        </Text>
                                    ) : (
                                        <Text size="xSmall" className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 whitespace-nowrap shadow-sm">
                                            {order.points || order.rewardPoints ? `+${order.points || order.rewardPoints} điểm` : "Tích điểm"}
                                        </Text>
                                    )}
                                </Box>

                                {/* 👉 ĐÃ SỬA: Hiển thị Phân loại hàng HOẶC Ngày giờ đặt lịch */}
                                {(order.options && Object.keys(order.options).length > 0) || (order.selectedVariants && Object.keys(order.selectedVariants).length > 0) ? (
                                    <Text size="xSmall" className="text-gray-600 font-medium flex items-center mt-1 bg-gray-100 w-fit px-2 py-0.5 rounded">
                                        <Icon icon="zi-note" size={12} className="mr-1 text-gray-500" />
                                        {Object.entries(order.options || order.selectedVariants).map(([key, val]) => `${key}: ${val}`).join(' | ')}
                                    </Text>
                                ) : (order.bookingTime || order.bookingDate) ? (
                                    <Text size="xSmall" className="text-blue-600 font-medium flex items-center mt-1">
                                        <Icon icon="zi-clock-1" size={12} className="mr-1" />
                                        {order.bookingTime} {order.bookingDate ? `- ${order.bookingDate}` : ''}
                                    </Text>
                                ) : null}

                                {order.extras && order.extras.length > 0 && (
                                    <Box mt={2} pt={2} className="border-t border-dashed border-gray-100">
                                        {order.extras.map((ex: any, idx: number) => (
                                            <Box key={idx} flex justifyContent="space-between" alignItems="center" mb={1}>
                                                <Text size="xSmall" className="text-gray-500 line-clamp-1 pr-2">
                                                    + Thêm: {ex.name || ex.title}
                                                </Text>
                                                
                                                {/* 👇 CHỈNH SỬA TẠI ĐÂY: HIỂN THỊ GIÁ HOẶC ĐIỂM 👇 */}
                                                {showPrice ? (
                                                    <Text size="xSmall" className="text-gray-500 whitespace-nowrap">
                                                        {formatCurrency(ex.price || 0)}
                                                    </Text>
                                                ) : (
                                                    /* HIỂN THỊ ĐIỂM CHO DỊCH VỤ THÊM */
                                                    <Text size="xxxxSmall" className="text-yellow-600 font-bold bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100 whitespace-nowrap shadow-sm">
                                                        {ex.points ? `+${ex.points} điểm` : (ex.price >= 10000 ? `+${Math.floor(ex.price / 10000)} điểm` : "Tích điểm")}
                                                    </Text>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Box>
                ) : (
                  // Đơn Đặt món/Lịch hẹn
                  <Box className="py-2">
                      {/* Lưu ý: Dữ liệu giỏ mới lưu ở trường cartItems thay vì items */}
                      {(order.cartItems || order.items)?.map((item: any, idx: number) => (
                          <Box 
                              key={idx} 
                              flex justifyContent="space-between" 
                              alignItems="center"
                              mb={2} 
                              className="cursor-pointer active:opacity-60 bg-gray-50/50 p-2 rounded-lg"
                              onClick={() => navigate(`/detail/${item.product?.id || item.id}`)}
                          >
                              {/* Cột trái: Tên sản phẩm + Phân loại */}
                              <Box className="flex-1 pr-2">
                                  <Text size="small" className="line-clamp-2">
                                    <span className="font-bold text-blue-600 mr-1">x{item.quantity}</span> 
                                    {item.product?.title || item.product?.name || item.name}
                                  </Text>
                                  
                                  {/* 👉 BỔ SUNG: HIỂN THỊ PHÂN LOẠI (MÀU SẮC, SIZE...) */}
                                  {item.options && Object.keys(item.options).length > 0 && (
                                      <Text size="xxxxSmall" className="text-gray-500 mt-1 italic flex items-center">
                                          <Icon icon="zi-note" size={12} className="mr-1" />
                                          {Object.entries(item.options).map(([key, val]) => `${key}: ${val}`).join(' | ')}
                                      </Text>
                                  )}
                              </Box>
                              
                              {/* Cột phải: Giá tiền */}
                              {/* 👇 CỘT PHẢI: HIỂN THỊ GIÁ HOẶC ĐIỂM 👇 */}
                              {showPrice ? (
                                  <Text size="small" bold className="text-gray-800 shrink-0">
                                    {formatCurrency(item.product?.price || item.price)}
                                  </Text>
                              ) : (
                                  <Text size="xSmall" className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 shrink-0 shadow-sm">
                                      {item.product?.points || item.points ? `+${item.product?.points || item.points} điểm` : "Tích điểm"}
                                  </Text>
                              )}
                          </Box>
                      ))}
                  </Box>
              )}
                
                {/* Tổng tiền & Nút hành động */}
                <Box mt={3} pt={3} className="border-t border-gray-200">
                  {/* 👇 HIỂN THỊ TỔNG TIỀN HOẶC TỔNG ĐIỂM 👇 */}
                  {showPrice ? (
                      <Box flex justifyContent="space-between" alignItems="center" className="mb-2">
                        <Text size="small" className="text-gray-600">Tổng cộng sau khi phục vụ tại cơ sở:</Text>
                        <Text bold size="large" className="text-red-600">
                            {formatCurrency(total)}
                        </Text>
                      </Box>
                  ) : (
                      <Box flex justifyContent="space-between" alignItems="center" className="mb-2 bg-yellow-50 p-2.5 rounded-lg border border-yellow-100 shadow-sm">
                        <Text size="small" className="text-yellow-800 font-bold">Điểm thưởng tích lũy:</Text>
                        <Text bold size="large" className="text-yellow-600 flex items-center">
                            <Icon icon="zi-star-solid" size={20} className="mr-1" />
                            {/* 👉 ĐÃ SỬA CHỖ NÀY: Dùng biến tự tính */}
                            {displayPoints > 0 ? `+${displayPoints} điểm` : "Chờ đối soát"}
                        </Text>
                      </Box>
                  )}

                  {/* 👉 NÚT HỦY ĐƠN (Chỉ hiển thị khi đơn đang chờ xác nhận) */}
                  {order.status === 'pending' && (
                    <Box flex justifyContent="flex-end" mt={3}>
                      <Button 
                        size="small" 
                        variant="secondary" 
                        type="danger" 
                        className="bg-red-50 text-red-600 border border-red-200"
                        onClick={() => setCancelingId(order.id)}
                      >
                        Hủy cuộc hẹn
                      </Button>
                    </Box>
                  )}
                  {/* 👉 THÊM MỚI: NÚT ĐÁNH GIÁ (Chỉ hiện khi đơn Hoàn thành và chưa đánh giá) */}
      {(order.status === 'completed' || order.status === 'success') && !order.isReviewed && (
        <Box flex justifyContent="flex-end" mt={3}>
            <Button size="small" className="bg-orange-500 font-bold px-6 border-none shadow-sm" onClick={() => handleOpenReview(order)}>
                ⭐ Đánh giá dịch vụ
            </Button>
        </Box>
      )}
      
      {/* Hiện chữ Cảm ơn nếu đã đánh giá */}
      {(order.status === 'completed' || order.status === 'success') && order.isReviewed && (
        <Box flex justifyContent="flex-end" mt={3}>
            <Text size="xSmall" className="text-green-600 font-medium italic flex items-center">
                <Icon icon="zi-check-circle-solid" size={14} className="mr-1"/> Bạn đã đánh giá dịch vụ này
            </Text>
        </Box>
      )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* 👉 MODAL XÁC NHẬN HỦY CUỘC HẸN */}
      <Modal
        visible={!!cancelingId}
        title="Xác nhận hủy cuộc hẹn"
        onClose={() => !isCanceling && setCancelingId(null)}
      >
        <Box p={4}>
          <Text size="small" className="text-center text-gray-600 mb-6">
            Bạn có chắc chắn muốn hủy cuộc hẹn này không? Quá trình này không thể hoàn tác.
          </Text>
          <Box flex className="gap-3">
            <Button 
              variant="secondary" 
              fullWidth 
              onClick={() => setCancelingId(null)}
              disabled={isCanceling}
            >
              Không
            </Button>
            <Button 
              type="danger" 
              fullWidth 
              onClick={handleConfirmCancel}
              loading={isCanceling}
            >
              Đồng ý Hủy
            </Button>
          </Box>
        </Box>
      </Modal>
      {/* 👉 MODAL ĐÁNH GIÁ DỊCH VỤ */}
      <Modal
          visible={showReviewModal}
          title="Đánh giá dịch vụ"
          onClose={() => !isSubmittingReview && setShowReviewModal(false)}
      >
          <Box p={4} flex flexDirection="column" alignItems="center">
              <Text bold className="text-gray-800 text-center mb-1">{reviewingOrder?.productName}</Text>
              <Text size="xSmall" className="text-gray-500 text-center mb-6">Tại: {reviewingOrder?.location?.name}</Text>
              
              {/* Chọn Sao */}
              <Box flex justifyContent="center" className="gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                      <div key={star} onClick={() => setRating(star)} className="cursor-pointer transition-transform active:scale-90">
                          <Icon 
                              icon={star <= rating ? "zi-star-solid" : "zi-star"} 
                              className={star <= rating ? "text-yellow-400" : "text-gray-300"} 
                              style={{ fontSize: 40 }}
                          />
                      </div>
                  ))}
              </Box>

              {/* Lời chúc tùy theo sao */}
              <Text size="small" bold className="text-orange-500 mb-4 text-center">
                  {rating === 5 ? "Tuyệt vời quá!" : rating === 4 ? "Rất tốt" : rating === 3 ? "Bình thường" : rating === 2 ? "Không hài lòng" : "Tệ"}
              </Text>

              <Box className="w-full mb-6">
                  <Input.TextArea 
                      placeholder="Chia sẻ trải nghiệm của bạn (không bắt buộc)..." 
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={4}
                  />
              </Box>

              <Box flex className="gap-3 w-full">
                  <Button variant="secondary" fullWidth onClick={() => setShowReviewModal(false)} disabled={isSubmittingReview}>Để sau</Button>
                  <Button fullWidth onClick={handleSubmitReview} loading={isSubmittingReview}>Gửi đánh giá</Button>
              </Box>
          </Box>
      </Modal>
    </Page>
  );
};

export default HistoryPage;