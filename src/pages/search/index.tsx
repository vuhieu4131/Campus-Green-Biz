import React, { FC, useState, useEffect } from "react";
import { Header, Page, Box, Input, Text, Spinner } from "zmp-ui";
import { db } from "../../firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { getValidAvatar } from "../../utils/avatar";

const SearchPage: FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch all approved services and users from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "services"))),
          getDocs(query(collection(db, "users")))
        ]);
        
        const servicesList = servicesSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(item => item.status === "approved" || !item.status);
        
        const usersList = usersSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any));

        setServices(servicesList);
        setUsers(usersList);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu cho tìm kiếm:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper function to remove Vietnamese accents
  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  };

  // 2. Filter services and users based on keyword
  useEffect(() => {
    if (!keyword.trim()) {
      setFilteredServices([]);
      setFilteredUsers([]);
      return;
    }
    const lowerQ = normalizeText(keyword.toLowerCase().trim());
    
    const filteredS = services.filter(item => {
      const name = normalizeText((item.name || item.title || "").toLowerCase());
      return name.includes(lowerQ);
    });
    setFilteredServices(filteredS);

    const filteredU = users.filter(user => {
      const name = normalizeText((user.name || user.displayName || "").toLowerCase());
      const phone = normalizeText((user.phone || "").toLowerCase());
      return name.includes(lowerQ) || phone.includes(lowerQ);
    });
    setFilteredUsers(filteredU);
  }, [keyword, services, users]);

  return (
    <Page className="flex flex-col bg-white">
      <Header title="Tìm kiếm" showBackIcon={true} />
      
      {/* Input tìm kiếm */}
      <Box p={4} pt={2} className="bg-white flex-none">
        <Input.Search
          placeholder="Tìm nhanh sản phẩm, dịch vụ, tài khoản..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          clearable
          allowClear
        />
      </Box>

      {/* Kết quả tìm kiếm */}
      <Box flex flexDirection="column" className="bg-[#f4f5f6] flex-1 min-h-0">
        <Text.Title className="p-4 pt-3 pb-2 text-gray-500" size="small">
          Kết quả ({filteredServices.length + filteredUsers.length})
        </Text.Title>
        
        {loading ? (
          <Box className="flex-1 flex justify-center items-center pb-24">
            <Spinner />
          </Box>
        ) : keyword.trim() === "" ? (
          <Box className="flex-1 flex justify-center items-center pb-24">
            <Text size="xSmall" className="text-gray-400">
              Nhập từ khóa để tìm kiếm sản phẩm hoặc người dùng
            </Text>
          </Box>
        ) : (filteredServices.length > 0 || filteredUsers.length > 0) ? (
          <Box className="p-4 pt-0 space-y-4 flex-1 overflow-y-auto hide-scroll pb-10">
            {/* Users section */}
            {filteredUsers.length > 0 && (
              <Box className="mb-6">
                <Text.Title className="text-gray-500 mb-2" size="small">Tài khoản</Text.Title>
                <Box className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div 
                      key={user.id} 
                      onClick={() => navigate(`/profile?id=${user.phone || user.id}`)} 
                      className="flex items-center space-x-3 bg-white p-3 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <img
                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                        src={getValidAvatar(user.avatar || user.photoURL, user.id)}
                        alt={user.name || user.displayName}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getValidAvatar("", user.id);
                        }}
                      />
                      <Box className="flex-1">
                        <Text bold size="small" className="text-gray-800 line-clamp-1">{user.name || user.displayName || "Người dùng ẩn danh"}</Text>
                        {user.phone && <Text size="xSmall" className="text-gray-500">{user.phone}</Text>}
                      </Box>
                    </div>
                  ))}
                </Box>
              </Box>
            )}

            {/* Products section */}
            {filteredServices.length > 0 && (
              <Box>
                <Text.Title className="text-gray-500 mb-2" size="small">Sản phẩm, dịch vụ</Text.Title>
                <Box className="space-y-3">
                  {filteredServices.map((product) => {
                    return (
                      <div 
                        key={product.id}
                        onClick={() => navigate(`/detail/${product.id}`)} 
                        className="flex items-center space-x-4 bg-white p-3 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        <img
                          className="w-[72px] h-[72px] rounded-lg object-cover border border-gray-100"
                          src={product.image || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png"}
                          alt={product.name || product.title}
                        />
                        <Box className="space-y-1 flex-1">
                          <Text bold size="small" className="text-gray-800 line-clamp-1">{product.name || product.title}</Text>
                          <Text size="small" bold className="text-[#14502e]">
                            {(product.price || 0).toLocaleString("vi-VN")}đ
                          </Text>
                        </Box>
                      </div>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Box className="flex-1 flex justify-center items-center pb-24">
            <Text size="xSmall" className="text-gray-400 italic">
              Không tìm thấy kết quả. Vui lòng thử lại
            </Text>
          </Box>
        )}
      </Box>
    </Page>
  );
};

export default SearchPage;
