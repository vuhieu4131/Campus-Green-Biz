import CustomIcon from '../../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Box, Text, Avatar, Icon, useNavigate } from "zmp-ui";
import { useRecoilValueLoadable } from "recoil";
import { userState } from "state";
import { auth, db } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import logo from "static/logo.png";

export const Welcome: FC = () => {
  const navigate = useNavigate();
  const userInfoLoadable = useRecoilValueLoadable(userState);
  const userInfo = userInfoLoadable.state === "hasValue" ? userInfoLoadable.contents : null;
  const [userData, setUserData] = useState<any>(null);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
          const localPhone = localStorage.getItem("user_phone");
          const finalPhone = phoneFromEmail || localPhone;

          if (finalPhone) {
            // Check in shops
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);
            if (!shopSnap.empty) {
              const shopData = shopSnap.docs[0].data();
              setUserData({ 
                id: shopSnap.docs[0].id, 
                ...shopData, 
                avatar: shopData.shopAvatar || shopData.avatar,
                role: "provider" 
              });
              return;
            }
          }

          // Check in users (by UID)
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          let data = docSnap.exists() ? docSnap.data() : null;

          // Check in users (by phone fallback)
          if (!data && finalPhone) {
            const qUser = query(collection(db, "users"), where("phone", "==", finalPhone));
            const userSnap = await getDocs(qUser);
            if (!userSnap.empty) {
              data = userSnap.docs[0].data();
            }
          }

          if (data) {
            setUserData(data);
          }
        } catch (error) {
          console.error("Lỗi lấy thông tin user welcome:", error);
        }
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const avatar = userInfo?.avatar || userData?.avatar || "https://i.pravatar.cc/150?img=11";
  const points = userData?.spendingPoints ?? userData?.points ?? 0;

  return (
    <Box 
      className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100 px-4 pb-3 flex flex-col"
      style={{ paddingTop: "calc(var(--zaui-safe-area-inset-top, 24px) + 8px)" }}
    >
      <style>{`
        @keyframes spin-y {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes spin-word-x {
          0% { transform: rotateX(0deg); }
          20% { transform: rotateX(360deg); }
          100% { transform: rotateX(360deg); }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-spin-y {
          animation: spin-y 6s linear infinite;
          display: inline-block;
        }
        .animate-word-1 {
          animation: spin-word-x 8s ease-in-out infinite;
          display: inline-block;
          transform-style: preserve-3d;
        }
        .animate-word-2 {
          animation: spin-word-x 8s ease-in-out infinite;
          animation-delay: 0.5s;
          display: inline-block;
          transform-style: preserve-3d;
        }
        .animate-word-3 {
          animation: spin-word-x 8s ease-in-out infinite;
          animation-delay: 1.0s;
          display: inline-block;
          transform-style: preserve-3d;
        }
      `}</style>
      {/* Hàng 1: Logo Thương hiệu & Khoảng trống cho nút Zalo */}
      <Box className="flex justify-between items-center h-10">
        {/* Trái: Logo ứng dụng nằm bên trái */}
        <Box className="w-24 shrink-0 flex items-center justify-start">
          <img 
            src={logo} 
            alt="Logo" 
            className="w-8 h-8 object-contain animate-spin-y cursor-pointer active:scale-95 transition-all" 
            onClick={() => setShowLogoModal(true)}
          />
        </Box>

        {/* Giữa: Dòng chữ thương hiệu nằm ở giữa */}
        <Box className="flex-1 flex items-center justify-center">
          <Text.Title 
            className="font-black text-xl tracking-tight flex items-center space-x-1.5 cursor-pointer active:opacity-75 transition-opacity"
            onClick={() => setShowTextModal(true)}
          >
            <span className="animate-word-1" style={{ color: "#00763c" }}>Campus</span>
            <span className="animate-word-2" style={{ color: "#85c441" }}>Green</span>
            <span className="animate-word-3" style={{ color: "#f15a24" }}>Biz</span>
          </Text.Title>
        </Box>

        {/* Phải: Để trống để tránh đè nút hệ thống của Zalo */}
        <Box className="w-24 shrink-0" />
      </Box>

      {/* Hàng 2: Thanh tìm kiếm & Nút thông báo */}
      <Box className="flex items-center space-x-3 mt-2">
        <Box 
          className="flex-1 bg-gray-100 rounded-full py-1.5 px-3.5 flex items-center space-x-2 cursor-pointer border border-gray-200/30 active:bg-gray-200 transition-colors"
          onClick={() => navigate('/search')}
        >
          <CustomIcon icon="zi-search" className="text-gray-400 text-base" />
          <Text className="text-gray-400 text-sm">Tìm kiếm sản phẩm, tin tức...</Text>
        </Box>
        <Box 
          className="relative p-2 bg-gray-100 active:bg-gray-200 rounded-full cursor-pointer transition-colors"
          onClick={() => navigate('/notification')}
        >
          <CustomIcon icon="zi-notif" className="text-gray-700 text-base" />
        </Box>
      </Box>

      {/* Modal phóng to Logo xoay 3D */}
      {showLogoModal && (
        <Box 
          className="fixed inset-0 bg-black/95 z-[9999] flex flex-col justify-center items-center"
          onClick={() => setShowLogoModal(false)}
        >
          {/* Nút đóng */}
          <Box 
            className="absolute top-8 right-4 p-2 bg-white/10 active:bg-white/20 rounded-full cursor-pointer transition-colors z-[10000]"
            onClick={(e) => { e.stopPropagation(); setShowLogoModal(false); }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </Box>

          {/* Logo phóng to và xoay trục Y */}
          <Box className="w-64 h-64 flex items-center justify-center pointer-events-none">
            <img 
              src={logo} 
              alt="Logo Large" 
              className="w-48 h-48 object-contain animate-spin-y" 
              style={{ animationDuration: "4s" }}
            />
          </Box>
        </Box>
      )}

      {/* Modal chào mừng khi click vào dòng chữ thương hiệu */}
      {showTextModal && (
        <Box 
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-6"
          onClick={() => setShowTextModal(false)}
        >
          <Box 
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4"
            style={{ 
              animation: "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              transform: "scale(0.9)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Logo ứng dụng */}
            <Box className="w-16 h-16 flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-full h-full object-contain animate-spin-y" />
            </Box>
            
            <Box className="mt-2 flex flex-col items-center">
              {/* Dòng trên: Lời chào mừng */}
              <Text className="text-gray-500 text-[16px] font-medium">
                Chào mừng bạn đến với
              </Text>
              
              {/* Dòng dưới: Tên thương hiệu có màu */}
              <Text.Title className="font-black text-2xl tracking-tight flex items-center space-x-1.5 justify-center mt-1">
                <span style={{ color: "#00763c" }}>Campus</span>
                <span style={{ color: "#85c441" }}>Green</span>
                <span style={{ color: "#f15a24" }}>Biz</span>
              </Text.Title>
            </Box>

            {/* Nút đóng */}
            <button 
              className="mt-6 w-full py-3 bg-[#14502e] text-white rounded-full font-bold active:scale-[0.98] transition-transform shadow-md shadow-[#14502e]/25 text-[15px]"
              onClick={() => setShowTextModal(false)}
            >
              Bắt đầu trải nghiệm
            </button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
