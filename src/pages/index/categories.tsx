import React, { FC, useState, useEffect, useRef } from "react";
import { Box, Text, Icon, Spinner } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useSetRecoilState } from "recoil";
import { selectedCategoryIdState } from "../../state";
import CustomIcon from "../../components/custom-icon";

export const Categories: FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setSelectedCategoryId = useSetRecoilState(selectedCategoryIdState);
  const scrollRef = useRef<any>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, "categories"), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        const cats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(cats);
      } catch (error) {
        console.error("Lỗi tải danh mục:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const gotoCategory = (categoryId: string, categoryName: string) => {
    // Lưu ID hoặc Tên danh mục vào state để trang CategoryPage có thể dùng
    setSelectedCategoryId(categoryId);
    navigate("/category");
  };

  if (loading) {
    return (
      <Box className="bg-[#f0fdf4] grid grid-cols-4 gap-4 p-4 py-8">
        <Box className="col-span-4 flex justify-center"><Spinner visible /></Box>
      </Box>
    );
  }

  return (
    <Box className="relative mt-2 mb-4 group bg-[#f0fdf4] py-4">
      {/* Nút cuộn trái */}
      <Box 
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white shadow-md rounded-r-full cursor-pointer active:bg-gray-100 opacity-90"
        onClick={scrollLeft}
      >
        <CustomIcon icon="zi-chevron-left" className="text-[#14502e] text-base" />
      </Box>

      {/* Danh sách danh mục */}
      <Box 
        ref={scrollRef}
        className="px-4 flex space-x-4 overflow-x-auto custom-scrollbar pb-3 pr-12"
      >
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            height: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(20, 80, 70, 0.1);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #14502e;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #1e7041;
          }
        `}</style>
        {categories.map((category) => (
          <Box 
            key={category.id} 
            className="flex flex-col items-center flex-shrink-0 w-[72px] cursor-pointer opacity-80"
            onClick={() => gotoCategory(category.id, category.name)}
          >
            <Box className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md mb-2 active:scale-95 transition-all text-[#14502e]">
              <CustomIcon icon={category.icon || "zi-store"} className="text-2xl" />
            </Box>
            <Text size="xxSmall" className="text-center leading-tight w-full break-words whitespace-normal line-clamp-2 font-semibold text-gray-800">
              {category.name}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Nút cuộn phải */}
      <Box 
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center bg-white shadow-md rounded-l-full cursor-pointer active:bg-gray-100 opacity-90"
        onClick={scrollRight}
      >
        <CustomIcon icon="zi-chevron-right" className="text-[#14502e] text-base" />
      </Box>
    </Box>
  );
};
