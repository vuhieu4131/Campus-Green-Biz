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
    <Box className="flex justify-between items-center px-4 py-3 bg-transparent sticky top-0 z-10 backdrop-blur-md">
      {/* Left: Avatar & Green Points */}
      <Box className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/profile')}>
        <Avatar src={userData?.avatar || "https://i.pravatar.cc/150?img=11"} size={36} className="border-2 border-white shadow-sm" />
        <Box className="bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow-sm flex items-center border border-green-100">
          <Icon icon="zi-star-solid" className="text-[#15803d] text-sm mr-1" />
          <Text size="xSmall" className="font-bold text-[#15803d]">
            {userData?.points || 0} Điểm Xanh
          </Text>
        </Box>
      </Box>

      {/* Right: Search Icon */}
      <Box 
        className="w-10 h-10 bg-white rounded-full flex justify-center items-center shadow-sm cursor-pointer border border-gray-100 text-gray-600 hover:text-[#15803d]"
        onClick={() => navigate('/search')}
      >
        <Icon icon="zi-search" />
      </Box>
    </Box>
  );
};
