import React, { FC, useState, useEffect } from "react";
import { Pagination, Autoplay } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { getDummyImage } from "utils/product";
import { Box } from "zmp-ui";
import { db, auth } from "../../firebase";
import { collection, query, getDocs, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router";
import { onAuthStateChanged } from "firebase/auth";

export const Banner: FC = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (unsubscribe) unsubscribe();

        const q = query(collection(db, "banners"));
        unsubscribe = onSnapshot(q, (querySnapshot) => {
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
      }
    });

    return () => {
      authUnsubscribe();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <Box className="px-4 pb-4 pt-2">
        <Box className="w-full rounded-2xl aspect-[2/1] bg-gray-200 animate-pulse shadow-md" />
      </Box>
    );
  }

  const validBanners = banners.filter(b => b.image && b.image.trim() !== "");

  if (validBanners.length === 0) {
    return null;
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
        loop={validBanners.length > 1}
      >
        {validBanners.map((banner, i) => {
          const bannerImage = banner.image;
          const bannerLink = banner.link || "";

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
