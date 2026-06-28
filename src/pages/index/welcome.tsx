import React, { FC, useState, useEffect } from "react";
import { Box, Text, Avatar, Icon, useNavigate } from "zmp-ui";
import { auth, db } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export const Welcome: FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Box className="flex justify-between items-center px-4 py-2 bg-white sticky top-0 z-50 shadow-md">
      {/* Trái: Avatar & Điểm */}
      <Box className="flex items-center space-x-2 cursor-pointer w-1/3" onClick={() => navigate('/profile')}>
        <Avatar src={userData?.avatar || "https://i.pravatar.cc/150?img=11"} size={36} className="border border-gray-200" />
        <Box className="bg-green-50 px-2 py-1.5 rounded-full flex items-center">
          <Icon icon="zi-star-solid" className="text-[#14502e] text-xs mr-1" />
          <Text size="xxxxSmall" className="font-bold text-[#14502e]">
            {userData?.points || 0}
          </Text>
        </Box>
      </Box>

      {/* Giữa: Logo Thương hiệu */}
      <Box className="flex justify-center items-center w-1/3">
        <Text.Title className="text-[#14502e] font-black text-xl tracking-tight">GreenBiz</Text.Title>
      </Box>

      {/* Phải: Công cụ (Tìm kiếm & Thông báo) */}
      <Box className="flex justify-end items-center space-x-4 w-1/3 text-gray-700">
        <Icon 
          icon="zi-search" 
          className="text-2xl cursor-pointer hover:text-[#14502e]" 
          onClick={() => navigate('/search')}
        />
        <Icon 
          icon="zi-notif" 
          className="text-2xl cursor-pointer hover:text-[#14502e]" 
          onClick={() => navigate('/notification')}
        />
      </Box>
    </Box>
  );
};
