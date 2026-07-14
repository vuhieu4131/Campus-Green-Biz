import CustomIcon from '../custom-icon';
import React, { useState, useEffect } from "react";
import { Page, Header, Box, Text, Icon, Button, Input, useSnackbar, Spinner, Modal } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, increment, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; // Đảm bảo đường dẫn này đúng với dự án của bạn

const BranchOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();

  // Lấy SĐT của Quản lý từ bộ nhớ
  const userPhone = localStorage.getItem("user_phone") || "";

  const [orderList, setOrderList] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderTab, setOrderTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // 1. Tải danh sách đơn hàng
  useEffect(() => {
    const fetchAllBranchOrders = async () => {
      if (!userPhone) return;
      try {
        const q = query(collection(db, "orders"), where("location.managerPhone", "==", userPhone));
        const snap = await getDocs(q);
        const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        orders.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setOrderList(orders);
      } catch (error) { 
        console.error("Lỗi tải đơn:", error); 
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchAllBranchOrders();
  }, [userPhone]);

  // 2. Xử lý đổi trạng thái đơn
  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
        let updateData: any = { status: newStatus };

        if (newStatus === 'completed') {
            const totalAmount = Number(order.totalAmount || order.totalPrice || order.total || 0);
            let platformFeeRate = 10; 
            try {
                const configRef = doc(db, "system_config", "admin_settings");
                const configSnap = await getDoc(configRef);
                if (configSnap.exists() && configSnap.data().platformFeeRate !== undefined) {
                    platformFeeRate = Number(configSnap.data().platformFeeRate);
                }
            } catch (e) { console.log("Lỗi:", e); }

            updateData.platformFee = Math.floor(totalAmount * (platformFeeRate / 100));
            updateData.platformFeeRate = platformFeeRate;

            const pointsEarned = Math.floor(totalAmount / 10000); 
            if (pointsEarned > 0) {
                if (order.userId) {
                    const userRef = doc(db, "users", order.userId);
                    await updateDoc(userRef, { spendingPoints: increment(pointsEarned), rankPoints: increment(pointsEarned) }).catch(e => console.log(e));
                }
            }
        }

        await updateDoc(doc(db, "orders", order.id), updateData);
        setOrderList(prev => prev.map(o => o.id === order.id ? { ...o, ...updateData } : o));
        openSnackbar({ text: "Đã xử lý đơn hàng!", type: "success" });
    } catch (error) {
        openSnackbar({ text: "Lỗi cập nhật", type: "error" });
    }
  };

  // 3. Xử lý hủy đơn
  const handleConfirmCancelOrder = async () => {
    if (!cancelReason.trim()) return openSnackbar({ text: "Vui lòng nhập lý do!", type: "warning" });
    setCancelLoading(true);
    try {
        await updateDoc(doc(db, "orders", selectedOrderToCancel.id), {
            status: 'cancelled', cancelReason: cancelReason,
            cancelledAt: serverTimestamp(), cancelledBy: userPhone 
        });
        setOrderList(prev => prev.map(o => o.id === selectedOrderToCancel.id ? { ...o, status: 'cancelled', cancelReason } : o));
        openSnackbar({ text: "Đã hủy đơn hàng!", type: "success" });
        setShowCancelModal(false); setCancelReason(""); setSelectedOrderToCancel(null);
    } catch (error) {
        openSnackbar({ text: "Lỗi khi hủy đơn", type: "error" });
    } finally { setCancelLoading(false); }
  };

  return (
    <Page className="bg-gray-50 flex flex-col h-screen">
      <Header title="Quản lý Đơn hàng" showBackIcon />

      {/* THANH TÌM KIẾM */}
      <Box p={3} className="bg-white border-b border-gray-200 shrink-0">
          <Input
              placeholder="Tìm theo Tên khách hoặc SĐT..."
              clearable value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<CustomIcon icon="zi-search" className="text-gray-400" />}
          />
      </Box>

      {/* THANH TAB */}
      <Box flex className="bg-white border-b border-gray-200 px-2 pt-2 shrink-0">
          <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="pending"?"border-orange-500 text-orange-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("pending")}>
              Mới ({orderList.filter(o=>o.status==='pending').length})
          </Box>
          <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="confirmed"?"border-blue-500 text-blue-600 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("confirmed")}>
              Chờ khách ({orderList.filter(o=>o.status==='confirmed').length})
          </Box>
          <Box className={`flex-1 text-center py-2 border-b-2 cursor-pointer ${orderTab==="history"?"border-gray-500 text-gray-800 font-bold":"border-transparent text-gray-500"}`} onClick={()=>setOrderTab("history")}>
              Lịch sử
          </Box>
      </Box>
      
      {/* NỘI DUNG DANH SÁCH ĐƠN HÀNG */}
      <Box p={3} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {loadingOrders ? (
              <Box flex justifyContent="center" py={5}><Spinner /></Box>
          ) : (
              (() => {
                  let filtered = orderList;
                  if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      filtered = filtered.filter(o => (o.userName && o.userName.toLowerCase().includes(q)) || (o.userId && o.userId.includes(q)));
                  }

                  if (orderTab === 'pending') filtered = filtered.filter(o => o.status === 'pending');
                  else if (orderTab === 'confirmed') filtered = filtered.filter(o => o.status === 'confirmed');
                  else if (orderTab === 'cancelled') filtered = filtered.filter(o => o.status === 'cancelled');
                  else filtered = filtered.filter(o => o.status === 'completed' || o.status === 'success');

                  if (filtered.length === 0) {
                      return (
                          <Box flex flexDirection="column" alignItems="center" py={8}>
                              <CustomIcon icon="zi-note" size={40} className="text-gray-300 mb-2"/>
                              <Text className="text-center text-gray-500">Chưa có đơn hàng nào.</Text>
                          </Box>
                      );
                  }

                  return filtered.map((order) => {
                      const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                      const originalAmount = Number(order.originalAmount || total);
                      const discountAmount = Number(order.discountAmount || 0);

                      return (
                          <Box key={order.id} className="bg-white p-3 rounded-xl mb-4 border border-gray-200 shadow-md relative">
                              <a href={`tel:${order.userId}`} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center cursor-pointer active:opacity-70 z-10">
                                  <CustomIcon icon="zi-call" size={16} className="text-green-600" />
                              </a>

                              <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-2 pr-10">
                                  <Text size="small" bold className="text-gray-800">#{order.orderCode || order.id.slice(0,6).toUpperCase()}</Text>
                                  <Text size="xSmall" bold className={ order.status === 'pending' ? 'text-orange-600 bg-orange-50 px-2 py-0.5 rounded' : order.status === 'confirmed' ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded' : order.status === 'cancelled' ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : 'text-green-600 bg-green-50 px-2 py-0.5 rounded'}>
                                      {order.status === 'pending' ? 'Mới - Chờ duyệt' : order.status === 'confirmed' ? 'Đã chốt - Chờ khách' : order.status === 'cancelled' ? 'Đã hủy' : 'Hoàn thành'}
                                  </Text>
                              </Box>
                              
                              <Box flex alignItems="center" mb={3}>
                                  <CustomIcon icon="zi-user" size={16} className="text-blue-600 mr-2" />
                                  <Box>
                                      <Text size="small" bold className="text-blue-800">{order.userName}</Text>
                                      <Text size="xSmall" className="text-gray-500">{order.userId}</Text>
                                  </Box>
                              </Box>
                              {/* 👇 BỔ SUNG: Thông tin người nhận (Tên + SĐT để ship hàng) 👇 */}
                              {(order.receiverName || order.receiverPhone || order.shippingName || order.shippingPhone) && (
                                  <Box flex alignItems="flex-start" mb={2} className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-100">
                                      <CustomIcon icon="zi-user-circle" size={16} className="text-blue-600 mr-2 mt-0.5 shrink-0" />
                                      <Box>
                                          <Text size="xSmall" bold className="text-blue-800 mb-0.5">Thông tin người nhận:</Text>
                                          <Text size="xSmall" className="text-gray-700">
                                              <span className="font-bold">
                                                  {order.receiverName || order.shippingName || order.userName || "Chưa có tên"}
                                              </span>
                                              {(order.receiverPhone || order.shippingPhone || order.userId) && (
                                                  <span className="ml-1 text-blue-700 font-medium">
                                                      - {order.receiverPhone || order.shippingPhone || order.userId}
                                                  </span>
                                              )}
                                          </Text>
                                      </Box>
                                  </Box>
                              )}

                              {/* 👇 BỔ SUNG: Thông tin địa chỉ nhận hàng của khách 👇 */}
                              {(order.address || order.deliveryAddress || order.shippingAddress) && (
                                  <Box flex alignItems="flex-start" mb={3} className="bg-orange-50/50 p-2.5 rounded-lg border border-orange-100">
                                      <CustomIcon icon="zi-location" size={16} className="text-orange-600 mr-2 mt-0.5 shrink-0" />
                                      <Box>
                                          <Text size="xSmall" bold className="text-orange-800 mb-0.5">Địa chỉ nhận hàng:</Text>
                                          <Text size="xSmall" className="text-gray-700 leading-relaxed">
                                              {typeof (order.address || order.deliveryAddress || order.shippingAddress) === 'string' 
                                                  ? (order.address || order.deliveryAddress || order.shippingAddress)
                                                  : ((order.address?.address || order.address?.fullAddress || order.deliveryAddress?.address) || "Chưa xác định rõ")}
                                          </Text>
                                      </Box>
                                  </Box>
                              )}
                              {/* 👇 ĐÃ CẬP NHẬT: HIỂN THỊ HÌNH ẢNH VÀ TÊN ĐẦY ĐỦ 👇 */}
                              <Box className="bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2">
                                  {order.cartItems && order.cartItems.length > 0 ? (
                                      <Box>
                                          {order.cartItems.map((item: any, i: number) => (
                                              <Box key={i} flex alignItems="flex-start" className="mb-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                                  {/* Cột Trái: Hình ảnh */}
                                                  <img 
                                                      src={item.product?.image || item.image || "https://via.placeholder.com/150"} 
                                                      alt="Product" 
                                                      style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', marginRight: 10, border: '1px solid #eee' }}
                                                  />
                                                  {/* Cột Phải: Thông tin (Không dùng line-clamp nữa để hiện đầy đủ chữ) */}
                                                  <Box className="flex-1">
                                                      <Text size="small" bold className="text-gray-800 whitespace-normal">
                                                          <span className="text-blue-600 mr-1">x{item.quantity}</span> 
                                                          {item.product?.title || item.product?.name || item.name}
                                                      </Text>
                                                      <Text size="small" className="text-gray-800 font-medium mt-1">
                                                          {(Number(item.product?.price || item.price || 0) * item.quantity).toLocaleString()}đ
                                                      </Text>
                                                      {item.options && Object.keys(item.options).length > 0 && (
                                                          <Text size="xxxxSmall" className="text-gray-500 flex items-center mt-1 italic">
                                                              <CustomIcon icon="zi-note" size={12} className="mr-1" />
                                                              {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                          </Text>
                                                      )}
                                                  </Box>
                                              </Box>
                                          ))}
                                      </Box>
                                  ) : (
                                      <Box flex alignItems="flex-start" className="mb-1">
                                           {/* Cột Trái: Hình ảnh cho trường hợp giỏ hàng cũ */}
                                          <img 
                                              src={order.productImage || order.image || "https://via.placeholder.com/150"} 
                                              alt="Product" 
                                              style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', marginRight: 10, border: '1px solid #eee' }}
                                          />
                                          <Box className="flex-1">
                                              <Text size="small" bold className="text-gray-800 whitespace-normal">
                                                  {order.productName}
                                              </Text>
                                              <Text size="small" className="text-gray-800 font-medium mt-1">
                                                  {Number(order.totalAmount || 0).toLocaleString()}đ
                                              </Text>
                                              {order.selectedVariants && Object.keys(order.selectedVariants).length > 0 && (
                                                  <Text size="xSmall" className="text-gray-600 font-medium flex items-center bg-white border border-gray-200 w-fit px-2 py-0.5 rounded mt-1">
                                                      <CustomIcon icon="zi-note" size={12} className="mr-1 text-gray-500" />
                                                      {Object.entries(order.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                                  </Text>
                                              )}
                                          </Box>
                                      </Box>
                                  )}
                              </Box>

                              <Box flex flexDirection="column" alignItems="flex-end" mb={2} pt={2} className="border-t border-gray-100">
                                  {discountAmount > 0 && (
                                      <Text size="xSmall" className="text-green-600 font-medium mb-0.5">Voucher: -{discountAmount.toLocaleString()}đ</Text>
                                  )}
                                  <Box flex alignItems="baseline">
                                      <Text size="small" className="text-gray-600 mr-2">Thực thu:</Text>
                                      <Text bold size="large" className="text-red-600">{total.toLocaleString()}đ</Text>
                                  </Box>
                              </Box>
                              {/* 👇 BỔ SUNG: Ghi chú của khách hàng 👇 */}
                              {order.note && (
                                  <Text size="xSmall" className="italic text-gray-500 mb-2 p-2 bg-yellow-50 rounded border border-yellow-100">
                                      Ghi chú: {order.note}
                                  </Text>
                              )}
                              {/* NÚT THAO TÁC */}
                              {order.status === 'pending' && (
                                 <Box flex className="gap-2 mt-2">
                                   <Button size="small" variant="secondary" className="flex-1 bg-red-50 text-red-600 border border-red-200" onClick={() => { setSelectedOrderToCancel(order); setShowCancelModal(true); }}>Từ chối</Button>
                                   <Button size="small" className="flex-1 bg-blue-600" onClick={() => handleUpdateOrderStatus(order, 'confirmed')}>Nhận khách</Button>
                                 </Box>
                              )}
                              {order.status === 'confirmed' && (
                                <Box mt={2} flex className="gap-2">
                                    <Button size="small" variant="secondary" className="bg-red-50 text-red-600 border border-red-200" onClick={() => { setSelectedOrderToCancel(order); setShowCancelModal(true); }}>Hủy đơn</Button>
                                    <Button size="small" className="flex-1 bg-green-500 border-none" onClick={() => handleUpdateOrderStatus(order, 'completed')}>Đã phục vụ xong</Button>
                                </Box>
                              )}
                          </Box>
                      );
                  });
              })()
          )}
      </Box>

      {/* POPUP NHẬP LÝ DO HỦY */}
      <Modal visible={showCancelModal} title="Lý do Hủy/Từ chối" onClose={() => { setShowCancelModal(false); setCancelReason(""); }}>
          <Box p={4}>
              <Input.TextArea placeholder="Nhập lý do hủy đơn..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={4} />
              <Box mt={4} flex className="gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowCancelModal(false)}>Đóng</Button>
                  <Button className="flex-1 bg-red-600 border-none" loading={cancelLoading} onClick={handleConfirmCancelOrder}>Xác nhận</Button>
              </Box>
          </Box>
      </Modal>
    </Page>
  );
};

export default BranchOrdersPage;