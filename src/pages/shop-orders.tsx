import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Text, Icon, Spinner, Tabs } from "zmp-ui";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useLocation } from "react-router-dom";

const ShopOrdersPage: FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const routeLocation = useLocation();

  useEffect(() => {
    let listeners: any[] = []; // Mảng chứa các Radar quét đơn

    const initRadar = () => {
        // 👉 CHỈ LẤY SỐ ĐIỆN THOẠI TỪ STATE HOẶC LOCAL_STORAGE (Tuyệt đối không gọi Zalo ID)
        const mainPhone = routeLocation.state?.shopData?.phone || localStorage.getItem("user_phone");

        // Nếu không có số điện thoại đăng nhập thì dừng lại luôn
        if (!mainPhone) {
            setLoading(false);
            return;
        }

        // BẬT RADAR QUÉT ĐƠN HÀNG THỜI GIAN THỰC
        const ordersRef = collection(db, "orders");
        const ordersMap: Record<string, any[]> = {};

        // Hàm gộp đơn và hiển thị
        const mergeAndUpdateUI = () => {
          const combined = Object.values(ordersMap).reduce((acc: any[], val: any) => acc.concat(val), []);
          const uniqueOrders = Array.from(new Set(combined.map((o: any) => o.id))).map(id => combined.find((o: any) => o.id === id));
            uniqueOrders.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setOrders(uniqueOrders);
            setLoading(false);
        };

        const addRadar = (q: any, radarName: string) => {
            const unsub = onSnapshot(q, (snap) => {
                ordersMap[radarName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                mergeAndUpdateUI();
            });
            listeners.push(unsub);
        };

        // 1. Quét đơn của Chủ Shop
        addRadar(query(ordersRef, where("shopId", "==", mainPhone)), "shop");
        addRadar(query(ordersRef, where("providerId", "==", mainPhone)), "provider");

        // 2. Quét đơn của tất cả Cơ sở con (Bạch Tuộc)
        const shopData = routeLocation.state?.shopData;
        if (shopData && shopData.locations && shopData.locations.length > 0) {
            shopData.locations.forEach((loc: any, idx: number) => {
                if (loc.managerPhone) {
                    addRadar(query(ordersRef, where("location.managerPhone", "==", loc.managerPhone)), `branch_${idx}`);
                }
            });
        } else {
            addRadar(query(ordersRef, where("location.managerPhone", "==", mainPhone)), "manager_fallback");
        }
    };

    initRadar();

    // Tắt Radar khi thoát trang
    return () => {
        listeners.forEach(unsub => unsub());
    };
  }, [routeLocation.state]);

  // Lọc đơn hàng theo Tab
  const getFilteredOrders = () => {
      if (activeTab === "pending") return orders.filter(o => o.status === "pending");
      if (activeTab === "processing") return orders.filter(o => ["processing", "shipping", "accepted", "confirmed"].includes(o.status));
      if (activeTab === "completed") return orders.filter(o => ["completed", "success", "cancelled"].includes(o.status));
      return [];
  };

  const filteredOrders = getFilteredOrders();

  // Bộ dịch trạng thái sang Tiếng Việt
  const getStatusDisplay = (status: string) => {
    switch(status) {
        case 'pending': return { text: 'Chờ xác nhận', color: 'text-orange-500' };
        case 'accepted':
        case 'confirmed': return { text: 'Đã xác nhận', color: 'text-blue-500' };
        case 'processing': return { text: 'Đang xử lý', color: 'text-blue-500' };
        case 'shipping': return { text: 'Đang giao hàng', color: 'text-blue-500' };
        case 'completed':
        case 'success': return { text: 'Hoàn thành', color: 'text-green-500' };
        case 'cancelled': return { text: 'Đã hủy', color: 'text-red-500' };
        default: return { text: status || 'Chờ xác nhận', color: 'text-gray-500' };
    }
  };

  return (
    <Page className="bg-gray-50 flex flex-col h-screen">
      <Header title="Quản lý đơn hàng (Tổng)" showBackIcon />

      <Box className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <Tabs id="order-tabs" activeKey={activeTab} onChange={(key) => setActiveTab(key as string)}>
          <Tabs.Tab key="pending" label="Chờ xử lý" />
          <Tabs.Tab key="processing" label="Đang xử lý" />
          <Tabs.Tab key="completed" label="Hoàn thành" />
        </Tabs>
      </Box>

      <Box p={3} className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <Box flex justifyContent="center" py={10}><Spinner /></Box>
        ) : filteredOrders.length > 0 ? (
            filteredOrders.map((order, idx) => {
                const total = Number(order.totalAmount || order.totalPrice || order.total || 0);
                const isProduct = order.orderType === 'product';
                const statusUI = getStatusDisplay(order.status);

                return (
                <Box key={idx} className="bg-white p-4 rounded-xl mb-4 border border-gray-200 shadow-sm animate-fade-in">
                    
                    <Box flex justifyContent="space-between" className="border-b border-gray-100 pb-2 mb-3">
                        <Text size="small" bold className="text-blue-600">
                            #{order.id.slice(0,8).toUpperCase()}
                        </Text>
                        <Text size="xSmall" bold className={statusUI.color}>
                            {statusUI.text}
                        </Text>
                    </Box>

                    <Box className="bg-orange-50/50 p-2 rounded-lg border border-orange-100 mb-3">
                        <Box flex alignItems="flex-start">
                            <Icon icon={"zi-store" as any} size={16} className="text-orange-600 mr-2 mt-0.5 shrink-0" />
                            <Box>
                                <Text size="small" bold className="text-gray-800">
                                    Cơ sở: {order.location?.name || "Chưa rõ chi nhánh"}
                                </Text>
                                {order.location?.managerPhone && (
                                    <Text size="xSmall" className="text-gray-600 mt-1 flex items-center">
                                        <Icon icon="zi-call" size={14} className="mr-1" />
                                        SĐT Quản lý: <span className="text-blue-600 font-medium ml-1">{order.location.managerPhone}</span>
                                    </Text>
                                )}
                            </Box>
                        </Box>
                    </Box>
                    
                    <Box className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 mb-3">
                        <Box flex alignItems="center" mb={1}>
                            <Icon icon="zi-user" size={16} className="text-blue-600 mr-2" />
                            <Text size="small" bold className="text-gray-800">{order.userName}</Text>
                        </Box>
                        <Box flex alignItems="center" mb={1}>
                            <Icon icon="zi-call" size={16} className="text-blue-600 mr-2" />
                            <Text size="small" className="text-blue-600 font-medium">{order.receiverPhone || order.userId}</Text>
                        </Box>
                        {isProduct && order.deliveryAddress && (
                            <Box flex alignItems="flex-start">
                                <Icon icon="zi-location" size={16} className="text-blue-600 mr-2 shrink-0 mt-0.5" />
                                <Text size="xSmall" className="text-gray-600 italic leading-tight">Giao đến: {order.deliveryAddress}</Text>
                            </Box>
                        )}
                        {order.note && (
                            <Box className="mt-2 pt-2 border-t border-blue-100">
                                <Text size="xSmall" className="text-gray-600"><span className="font-bold">Ghi chú:</span> {order.note}</Text>
                            </Box>
                        )}
                    </Box>

                    <Box mb={3}>
                        {order.cartItems && order.cartItems.length > 0 ? (
                            order.cartItems.map((item: any, i: number) => (
                                <Text key={i} size="small" className="text-gray-800 line-clamp-1 mb-1">
                                    <span className="font-bold mr-1 text-blue-600">x{item.quantity}</span> {item.product?.title || item.product?.name}
                                </Text>
                            ))
                        ) : (
                            <Box>
                                <Text size="small" bold className="text-gray-800">{order.productName}</Text>
                                {!isProduct && order.bookingTime && (
                                    <Text size="xSmall" className="text-gray-500 mt-1">
                                        ⏰ Lịch hẹn: <span className="text-blue-600 font-medium">{order.bookingTime} - {order.bookingDate}</span>
                                    </Text>
                                )}
                            </Box>
                        )}
                    </Box>

                    <Box flex justifyContent="space-between" alignItems="center" pt={3} className="border-t border-gray-100">
                        <Text size="small" className="text-gray-500 font-medium">Tổng tiền</Text>
                        <Text bold size="large" className="text-red-600">{total.toLocaleString()}đ</Text>
                    </Box>
                </Box>
                )
            })
        ) : (
            <Box flex flexDirection="column" alignItems="center" py={10}>
                <Icon icon="zi-note" size={64} className="text-gray-300 mb-3"/>
                <Text className="text-gray-500">Chưa có đơn hàng nào ở mục này.</Text>
            </Box>
        )}
      </Box>
    </Page>
  );
};

export default ShopOrdersPage;