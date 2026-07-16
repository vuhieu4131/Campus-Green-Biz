import React, { FC, useState, useEffect } from "react";
import { Header, Page, Box, Input, Text, Spinner } from "zmp-ui";
import { db } from "../../firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { ProductPicker } from "../../components/product/picker";

const SearchPage: FC = () => {
  const [keyword, setKeyword] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch all approved services from database
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(collection(db, "services"));
        const snap = await getDocs(q);
        const list = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(item => item.status === "approved" || !item.status);
        setServices(list);
      } catch (err) {
        console.error("Lỗi khi tải sản phẩm cho tìm kiếm:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // 2. Filter services based on keyword
  useEffect(() => {
    if (!keyword.trim()) {
      setFilteredServices([]);
      return;
    }
    const lowerQ = keyword.toLowerCase().trim();
    const filtered = services.filter(item => {
      const name = (item.name || item.title || "").toLowerCase();
      return name.includes(lowerQ);
    });
    setFilteredServices(filtered);
  }, [keyword, services]);

  return (
    <Page className="flex flex-col bg-white">
      <Header title="Tìm kiếm" showBackIcon={true} />
      
      {/* Input tìm kiếm */}
      <Box p={4} pt={2} className="bg-white flex-none">
        <Input.Search
          placeholder="Tìm nhanh sản phẩm, dịch vụ..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          clearable
          allowClear
        />
      </Box>

      {/* Kết quả tìm kiếm */}
      <Box flex flexDirection="column" className="bg-[#f4f5f6] flex-1 min-h-0">
        <Text.Title className="p-4 pt-3 pb-2 text-gray-500" size="small">
          Kết quả ({filteredServices.length})
        </Text.Title>
        
        {loading ? (
          <Box className="flex-1 flex justify-center items-center pb-24">
            <Spinner />
          </Box>
        ) : keyword.trim() === "" ? (
          <Box className="flex-1 flex justify-center items-center pb-24">
            <Text size="xSmall" className="text-gray-400">
              Nhập từ khóa để tìm kiếm sản phẩm
            </Text>
          </Box>
        ) : filteredServices.length > 0 ? (
          <Box className="p-4 pt-0 space-y-4 flex-1 overflow-y-auto hide-scroll">
            {filteredServices.map((product) => {
              // Map name/title so picker works correctly
              const mappedProduct = {
                ...product,
                name: product.name || product.title,
                variants: product.variants || []
              };
              return (
                <ProductPicker key={product.id} product={mappedProduct}>
                  {({ open }) => (
                    <div onClick={open} className="flex items-center space-x-4 bg-white p-3 rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors">
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
                  )}
                </ProductPicker>
              );
            })}
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
