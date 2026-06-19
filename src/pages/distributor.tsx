import React, { FC, useEffect, useState } from "react";
import { Page, Header, Box, Spinner, Text, Button } from "zmp-ui";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase"; 
import { signOut } from "firebase/auth";

import { ProviderView } from "../components/profile-modules/provider-view";
import { BranchView } from "../components/profile-modules/branch-view";
import { AdminView } from "../components/profile-modules/admin-view";

const DistributorPage: FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userPhone = localStorage.getItem("user_phone");

    if (!userPhone) {
      navigate("/profile");
      return;
    }

    // 1. TÌM TRONG BẢNG "shops" TRƯỚC
    const qShop = query(collection(db, "shops"), where("phone", "==", userPhone));
    
    const unsubscribeShop = onSnapshot(qShop, (shopSnap) => {
      if (!shopSnap.empty) {
        // TÌM THẤY SHOP: Lấy dữ liệu và ép role="provider" để khớp với code của giao diện cũ
        const docData = shopSnap.docs[0];
        setUserData({ id: docData.id, ...docData.data(), role: "provider" });
        setLoading(false);
      } else {
        // 2. NẾU KHÔNG THẤY TRONG "shops", TÌM TRONG BẢNG "users"
        const qUser = query(collection(db, "users"), where("phone", "==", userPhone));
        getDocs(qUser).then(userSnap => {
            if (!userSnap.empty) {
                const docData = userSnap.docs[0];
                const data = docData.data();
                
                if (data.role === "admin") {
                    setUserData({ id: docData.id, ...data });
                } else if (data.branchInfo) {
                    setUserData({ id: docData.id, ...data, role: "member" });
                } else {
                    // Người dùng bình thường đi lạc vào đây
                    setUserData({ id: docData.id, ...data, role: "member", isUnauthorized: true });
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        }).catch(err => {
            console.error("Lỗi truy vấn:", err);
            setLoading(false);
        });
      }
    }, (error) => {
      console.error("Lỗi lấy dữ liệu:", error);
      setLoading(false);
    });

    return () => unsubscribeShop();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("user_phone");
      navigate("/profile"); 
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  if (loading) {
    return (
      <Page className="bg-gray-50 flex justify-center items-center h-screen">
        <Spinner visible logo="" />
      </Page>
    );
  }

  if (!userData) {
    return (
      <Page className="bg-gray-50 flex justify-center items-center h-screen flex-col">
        <Text className="mb-4">Không tìm thấy thông tin tài khoản!</Text>
        <Box onClick={handleLogout} className="text-blue-500 font-bold cursor-pointer bg-blue-50 p-2 rounded-lg">Đăng xuất & Thử lại</Box>
      </Page>
    );
  }

  return (
    <Page className="bg-gray-50 overflow-y-auto pb-20 hide-scroll">
      <Header title="Trang Quản Lý" showBackIcon={false} />

      {/* TỰ ĐỘNG BẬT GIAO DIỆN THEO ROLE */}
      {userData.role === "admin" && <AdminView userData={userData} onLogout={handleLogout} />}

      {userData.role === "provider" && <ProviderView userData={userData} onLogout={handleLogout} />}

      {userData.role === "member" && userData.branchInfo && !userData.isUnauthorized && <BranchView userData={userData} onLogout={handleLogout} />}

      {userData.role === "member" && userData.isUnauthorized && (
        <Box p={4} className="text-center mt-10">
          <Text className="text-red-500 mb-4">Bạn không có quyền truy cập trang Quản lý.</Text>
          <Button onClick={handleLogout}>Đăng xuất</Button>
        </Box>
      )}

    </Page>
  );
};

export default DistributorPage;