import React, { FC, useState, useEffect, useRef } from "react";
import { Box, Text, Spinner } from "zmp-ui";
import { PostItem } from "../../components/post-item";
import { RawPost } from "../../utils/edgeRanker";
import { db, auth } from "../../firebase";
import { collection, query, getDocs, orderBy, limit, startAfter } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getDefaultAvatar } from "../../utils/avatar";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper";
import { useNavigate } from "react-router-dom";

const ShopBannersSlider: FC<{ shops: any[] }> = ({ shops }) => {
  const navigate = useNavigate();
  if (!shops || shops.length === 0) return null;

  return (
    <Box className="my-2 mx-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-white">
      <Swiper
        modules={[Autoplay]}
        autoplay={{ delay: 2000, disableOnInteraction: false }}
        loop={shops.length > 1}
        spaceBetween={0}
        slidesPerView={1}
      >
        {shops.map((shop, idx) => (
          <SwiperSlide key={idx} className="cursor-pointer" onClick={() => navigate(`/profile?id=${shop.id}`)}>
            <Box className="relative">
              <img src={shop.cover || shop.bannerUrl || shop.avatar} className="w-full h-[120px] object-cover" alt={shop.name || shop.shopName || "Cửa hàng"} />
              <Box className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                <Text className="text-white font-bold text-sm line-clamp-1">{shop.name || shop.shopName || "Cửa hàng"}</Text>
              </Box>
            </Box>
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
};

const mockPosts: RawPost[] = [
  {
    id: "mock-p1",
    authorName: "Đức Nguyễn",
    authorAvatar: getDefaultAvatar("mock-p1"),
    content: "Hôm nay mình vừa mang gom vỏ hộp sữa giấy tái chế đến cơ sở đổi điểm. Cảm giác tích điểm đổi quà xanh thật là ý nghĩa! Mọi người cùng chung tay bảo vệ môi trường nhé! 🌿✨",
    images: ["https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&fit=crop"],
    likesCount: 24,
    commentsCount: 5,
    sharesCount: 2,
    createdAt: { seconds: Date.now() / 1000 - 3600 }
  },
  {
    id: "mock-p2",
    authorName: "Hương Giang",
    authorAvatar: getDefaultAvatar("mock-p2"),
    content: "Shop Lâm Nghiệp Xanh hôm nay mới đăng bán thêm bộ thìa dĩa gỗ dừa siêu xinh, an toàn cho bé. Cả nhà vào gian hàng của shop xem thử nhé, giá hạt dẻ lắm luôn! 🥥🥄",
    images: ["https://images.unsplash.com/photo-1606115915090-be18fea23ce7?w=800&fit=crop"],
    likesCount: 15,
    commentsCount: 3,
    sharesCount: 1,
    createdAt: { seconds: Date.now() / 1000 - 7200 }
  }
];

export const FeedList: FC = () => {
  const [posts, setPosts] = useState<RawPost[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<any>(null);

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "shops"));
        const shopsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const validShops = shopsData.filter(s => s.cover || s.avatar || s.bannerUrl);
        const shuffled = validShops.sort(() => 0.5 - Math.random());
        setShops(shuffled);
      } catch (err) {
        console.error("Error fetching shops", err);
      }
    };
    fetchShops();
  }, []);

  const fetchInitialPosts = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, "posts");
      const q = query(postsRef, orderBy("createdAt", "desc"), limit(10));
      const querySnapshot = await getDocs(q);
      
      const docs = querySnapshot.docs;
      const rawData = docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RawPost[];

      // Bài viết đẩy lên luôn Trang chủ (cả approved và pending)
      const approvedPosts = rawData;
      setPosts(approvedPosts);

      if (docs.length > 0) {
        setLastDoc(docs[docs.length - 1]);
      }
      setHasMore(docs.length === 10);
    } catch (error) {
      console.error("Lỗi tải bảng tin:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMorePosts = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    try {
      setLoadingMore(true);
      const postsRef = collection(db, "posts");
      const q = query(postsRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(10));
      const querySnapshot = await getDocs(q);
      
      const docs = querySnapshot.docs;
      const rawData = docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RawPost[];

      // Bài viết đẩy lên luôn Trang chủ (cả approved và pending)
      const approvedPosts = rawData;

      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = approvedPosts.filter(p => !existingIds.has(p.id));
        return [...prev, ...filteredNew];
      });

      if (docs.length > 0) {
        setLastDoc(docs[docs.length - 1]);
      }
      setHasMore(docs.length === 10);
    } catch (error) {
      console.error("Lỗi tải thêm bài viết:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchInitialPosts();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          fetchMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [sentinelRef, hasMore, loadingMore, loading, lastDoc]);

  if (loading) {
    return (
      <Box className="flex justify-center items-center h-40">
        <Spinner visible />
      </Box>
    );
  }

  const isUsingMock = posts.length === 0;
  const displayPosts = isUsingMock ? mockPosts : posts;

  return (
    <Box className="bg-transparent flex-1 overflow-y-auto pb-20">
      {displayPosts.map((post, index) => (
        <React.Fragment key={post.id}>
          <PostItem data={post} />
          {(index + 1) % 5 === 0 && <ShopBannersSlider shops={shops} />}
        </React.Fragment>
      ))}

      {/* Sentinel element to trigger infinite scroll load more */}
      {!isUsingMock && hasMore && (
        <Box ref={sentinelRef} className="py-4 flex justify-center items-center">
          {loadingMore && <Spinner visible />}
        </Box>
      )}

      <Box className="py-4 flex justify-center items-center cursor-pointer" onClick={fetchInitialPosts}>
        <Text size="small" className="text-[#14502e] font-medium border border-[#14502e] px-4 py-1.5 rounded-full">
          Làm mới bảng tin
        </Text>
      </Box>
    </Box>
  );
};
