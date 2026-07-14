import React, { FC, useState, useEffect } from "react";
import { Pagination, Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { getDummyImage } from "utils/product";
import { Box } from "zmp-ui";
import { db } from "../../firebase";
import { collection, query, getDocs, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router";

export const Banner: FC = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "banners"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const bannerList = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as any))
        .filter((b) => b.type === "home" && b.active !== false)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBanners(bannerList);
      setLoading(false);
    }, (error) => {
      console.error("Lỗi khi tải banners trang chủ:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading || banners.length === 0) {
    return (
      <Box className="bg-transparent" pb={4} pt={2}>
        <Swiper
          modules={[Pagination, Autoplay]}
          pagination={{
            clickable: true,
          }}
          autoplay={{
            delay: 2000,
            disableOnInteraction: false,
          }}
          loop
        >
          {[1, 2, 3, 4, 5]
            .map((i) => getDummyImage(`banner-${i}.webp`))
            .map((banner, i) => (
              <SwiperSlide key={i} className="px-4">
                <Box
                  className="w-full rounded-2xl aspect-[2/1] bg-cover bg-center bg-skeleton shadow-md"
                  style={{ backgroundImage: `url(${banner})` }}
                />
              </SwiperSlide>
            ))}
        </Swiper>
      </Box>
    );
  }

  return (
    <Box className="bg-transparent" pb={4} pt={2}>
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{
          clickable: true,
        }}
        autoplay={{
          delay: 2000,
          disableOnInteraction: false,
        }}
        loop
      >
        {banners.map((banner, i) => {
          // Tính toán mã hash đơn giản từ id để chọn ảnh và đường dẫn cố định, tránh bị đổi ngẫu nhiên mỗi lần render
          const seed = banner.id ? banner.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : i;
          
          // Link ảnh ngẫu nhiên nếu không điền
          const bannerImage = banner.image && banner.image.trim() !== "" 
            ? banner.image 
            : `https://stc-zmp.zadn.vn/templates/zaui-coffee/dummy/banner-${(seed % 5) + 1}.webp`;

          // Link điều hướng ngẫu nhiên nếu không điền
          const fallbackRoutes = ["/profile", "/notification", "/cart", "/wallet", "/"];
          const bannerLink = banner.link && banner.link.trim() !== "" 
            ? banner.link 
            : fallbackRoutes[seed % fallbackRoutes.length];

          return (
            <SwiperSlide key={banner.id || i} className="px-4">
              <Box
                className="w-full rounded-2xl aspect-[2/1] bg-cover bg-center bg-skeleton shadow-md cursor-pointer"
                style={{ backgroundImage: `url(${bannerImage})` }}
                onClick={() => {
                  if (bannerLink) {
                    navigate(bannerLink);
                  }
                }}
              />
            </SwiperSlide>
          );
        })}
      </Swiper>
    </Box>
  );
};
