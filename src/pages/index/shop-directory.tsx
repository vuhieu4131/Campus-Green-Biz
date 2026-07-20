import React, { FC, useState, useEffect } from "react";
import { Box, Text, Avatar, Spinner } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import CustomIcon from "../../components/custom-icon";
import { getDefaultAvatar } from "../../utils/avatar";

export const ShopDirectory: FC = () => {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const q = query(collection(db, "shops"));
        const snap = await getDocs(q);
        const shopList = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(shop => shop.status === "active")
          .sort((a, b) => {
            const nameA = (a.shopName || "").toString().toLowerCase();
            const nameB = (b.shopName || "").toString().toLowerCase();
            return nameA.localeCompare(nameB, 'vi');
          });
        setShops(shopList);
      } catch (error) {
        console.error("Lỗi tải danh sách cửa hàng:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchShops();
  }, []);

  if (loading) {
    return (
      <Box className="flex justify-center items-center py-10">
        <Spinner visible />
      </Box>
    );
  }

  if (shops.length === 0) {
    return (
      <Box className="p-4 text-center">
        <Text size="small" className="text-gray-500 italic">Chưa có cửa hàng nào trên hệ thống.</Text>
      </Box>
    );
  }

  return (
    <Box className="px-4 pb-24">
      <Text size="large" bold className="text-[#14502e] mb-4">Danh sách Gian hàng</Text>
      <Box className="grid grid-cols-1 gap-4">
        {shops.map(shop => (
          <Box 
            key={shop.id} 
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:opacity-70 transition-opacity"
            onClick={() => navigate(`/shop-details/${shop.id}`)}
          >
            {/* Banner */}
            <Box 
              className="h-32 bg-gray-200 relative bg-cover bg-center"
              style={{ backgroundImage: `url(${shop.cover || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80"})` }}
            >
              <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            </Box>
            
            {/* Info Section */}
            <Box className="p-3 relative pt-10">
              {/* Avatar overlapping banner */}
              <Box className="absolute -top-8 left-3">
                <Avatar 
                  src={shop.avatar || shop.shopAvatar || getDefaultAvatar(shop.id)} 
                  size={60} 
                  className="border-4 border-white shadow-sm"
                />
              </Box>
              
              <Text size="normal" bold className="text-gray-800 line-clamp-1">{shop.name || shop.shopName || "Tên cửa hàng"}</Text>
              <Box flex alignItems="center" className="mb-1">
                <CustomIcon icon="zi-location" size={14} className="text-green-600 mr-1" />
                <Text size="xSmall" className="text-green-600 font-medium line-clamp-1">
                  {shop.address || "Chưa cập nhật địa chỉ"}
                </Text>
              </Box>
              {shop.description && (
                <Text size="xxSmall" className="text-gray-500 line-clamp-2 mt-1">
                  {shop.description}
                </Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
