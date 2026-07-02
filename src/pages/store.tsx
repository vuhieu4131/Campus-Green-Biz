import React, { FC } from "react";
import { Page, Box, Text, Avatar, Icon, Input, useNavigate } from "zmp-ui";

const StoreWelcome: FC = () => {
  const navigate = useNavigate();
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
              <Icon icon="zi-star-solid" className="text-yellow-400 text-xs mr-1" />
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
          <Box className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-[#14502e] font-bold">
            2
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const StoreSearch: FC = () => (
  <Box className="px-4 -mt-6 relative z-10">
    <Box className="bg-white rounded-full flex items-center px-4 py-3 shadow-md">
      <Icon icon="zi-search" className="text-gray-400 text-xl mr-2" />
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
          <Icon icon="zi-poll" className="text-white text-3xl" />
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
            <Icon icon={cat.icon} className="text-2xl" />
          </Box>
          <Text size="xxSmall" className="font-medium text-gray-800 text-center">{cat.label}</Text>
        </Box>
      ))}
    </Box>
  );
};

const StoreRecommend: FC = () => {
  const products = [
    { name: "Bình nước tre", image: "https://images.unsplash.com/photo-1606115915090-be18fea23ce7?w=500&fit=crop", stars: 5 },
    { name: "Túi vải canvas", image: "https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=500&fit=crop", stars: 4 },
    { name: "Xà phòng hữu cơ", image: "https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=500&fit=crop", stars: 5 },
    { name: "Sổ tay tái chế", image: "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&fit=crop", stars: 5 },
  ];

  return (
    <Box className="px-4 mt-8 mb-6">
      <Text.Title className="font-bold text-lg text-[#14502e] mb-4">Gợi ý cho bạn</Text.Title>
      <Box className="grid grid-cols-2 gap-4">
        {products.map((p, i) => (
          <Box key={i} className="flex flex-col bg-white rounded-2xl p-3 shadow-md">
            <Box 
              className="w-full aspect-[4/3] rounded-xl bg-cover bg-center mb-2"
              style={{ backgroundImage: `url('${p.image}')` }}
            />
            <Text className="font-semibold text-gray-800 text-sm line-clamp-1">{p.name}</Text>
            <Box className="flex text-yellow-400 mt-1 space-x-0.5">
              {[...Array(5)].map((_, idx) => (
                <Icon key={idx} icon={idx < p.stars ? "zi-star-solid" : "zi-star"} className="text-xs" />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const ConsumerStorePage: FC = () => {
  return (
    <Page className="bg-[#f0fdf4] overflow-y-auto pb-20">
      <StoreWelcome />
      <StoreSearch />
      <StoreBanner />
      <StoreCategories />
      <StoreRecommend />
    </Page>
  );
};

export default ConsumerStorePage;
