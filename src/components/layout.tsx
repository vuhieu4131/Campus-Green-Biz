import React, { FC, Suspense, useState, useEffect } from "react";
import { Route, Routes } from "react-router";
import { Box, Modal, Button, Text } from "zmp-ui";
import { Navigation } from "./navigation";
import HomePage from "pages/index";
import CategoryPage from "pages/category";
import CartPage from "pages/cart";
import NotificationPage from "pages/notification";
import ProfilePage from "pages/profile";
import SearchPage from "pages/search";
import CheckoutResultPage from "pages/result";

import StorePage from "pages/store";
import { AdminDashboardPage } from "./profile-modules/admin-view";
import SettingsPage from "pages/settings";
import AccountInfoPage from "pages/account-info";
import WalletPage from "pages/wallet";
import CreatePostPage from "pages/create-post";
import PostDetailPage from "pages/post-detail";
import ProductDetailPage from "pages/product-detail";
import TermsPage from "pages/terms";
import { getSystemInfo } from "zmp-sdk";
import { ScrollRestoration } from "./scroll-restoration";
import { useHandlePayment } from "hooks";
import ShopPublicView from '../pages/ShopPublicView';
import PostPage from '../pages/post';
import ChatListPage from '../pages/chat-list';
import ChatDetailPage from '../pages/chat-detail';
import { auth, db } from "../firebase";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";

if (import.meta.env.DEV) {
  document.body.style.setProperty("--zaui-safe-area-inset-top", "24px");
} else if (getSystemInfo().platform === "android") {
  const statusBarHeight =
    window.ZaloJavaScriptInterface?.getStatusBarHeight() ?? 0;
  const androidSafeTop = Math.round(statusBarHeight / window.devicePixelRatio);
  document.body.style.setProperty(
    "--zaui-safe-area-inset-top",
    `${androidSafeTop}px`
  );
}

export const Layout: FC = () => {
  useHandlePayment();

  const [voucherData, setVoucherData] = useState<any>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [applicableShopNames, setApplicableShopNames] = useState<string>("Toàn bộ hệ thống");

  useEffect(() => {
    const fetchVoucherConfig = async () => {
      try {
        const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
        if (configSnap.exists()) {
          const data = configSnap.data();
          
          let isActive = false;
          if (data.isVoucherOpen) {
            isActive = true;
          } else if (data.voucherStartTime && data.voucherEndTime) {
            const now = new Date().getTime();
            const start = new Date(data.voucherStartTime).getTime();
            const end = new Date(data.voucherEndTime).getTime();
            if (now >= start && now <= end) {
              isActive = true;
            }
          }

          if (isActive && data.voucherTitle) {
            // Fetch shop names if applicableProducts exist
            if (data.applicableProducts && data.applicableProducts.length > 0) {
              try {
                const servicesRef = collection(db, "services");
                const snap = await getDocs(servicesRef);
                const matchedServices = snap.docs
                  .map(d => ({ id: d.id, ...d.data() }))
                  .filter((s: any) => data.applicableProducts.includes(s.id));
                  
                if (matchedServices.length > 0) {
                  // Group by shopName
                  const shopGroups = matchedServices.reduce((acc: any, curr: any) => {
                    const sName = curr.shopName || "Cửa hàng";
                    if (!acc[sName]) acc[sName] = [];
                    acc[sName].push(curr.title);
                    return acc;
                  }, {});
                  
                  const scopeTexts = Object.keys(shopGroups).map(shopName => 
                    `${shopName} (${shopGroups[shopName].join(", ")})`
                  );
                  
                  setApplicableShopNames(scopeTexts.join(" - "));
                } else {
                  setApplicableShopNames("Một số mặt hàng nhất định");
                }
              } catch (e) {
                console.error("Lỗi lấy tên cơ sở:", e);
                setApplicableShopNames("Một số cửa hàng nhất định");
              }
            } else {
              setApplicableShopNames("Toàn bộ hệ thống");
            }

            const seenKey = `seen_voucher_${data.voucherTitle}`;
            if (!localStorage.getItem(seenKey)) {
              setVoucherData(data);
              setShowVoucherModal(true);
            }
          }
        }
      } catch (err) {
        console.error("Lỗi lấy cấu hình Voucher:", err);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInWithEmailAndPassword(auth, "guest@campus.com", "guestpassword123");
          console.log("Guest login auto-completed.");
        } catch (error) {
          console.error("Failed to login automatically as guest:", error);
        }
      } else {
        fetchVoucherConfig();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCloseVoucherModal = () => {
    if (voucherData?.voucherTitle) {
      localStorage.setItem(`seen_voucher_${voucherData.voucherTitle}`, "true");
    }
    setShowVoucherModal(false);
  };

  return (
    <Box flex flexDirection="column" className="h-screen">
      <ScrollRestoration />
      <Box className="flex-1 flex flex-col overflow-hidden">
        {/* Bắt đầu bọc Suspense để chống sập màn hình */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full w-full bg-white">
              <span className="text-gray-500 font-medium">Đang tải dữ liệu...</span>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />}></Route>
            <Route path="/search" element={<SearchPage />}></Route>
            <Route path="/category" element={<CategoryPage />}></Route>
            <Route path="/notification" element={<NotificationPage />}></Route>
            <Route path="/cart" element={<CartPage />}></Route>
            <Route path="/profile" element={<ProfilePage />}></Route>
            <Route path="/result" element={<CheckoutResultPage />}></Route>
            <Route path="/store" element={<StorePage />} />
            <Route path="/shop-details/:id" element={<ShopPublicView />} />
            <Route path="/post-service" element={<PostPage />} />
            <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/account-info" element={<AccountInfoPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/create-post" element={<CreatePostPage />} />
            <Route path="/post-detail" element={<PostDetailPage />} />
            <Route path="/detail/:id" element={<ProductDetailPage />} />
            <Route path="/chat-list" element={<ChatListPage />} />
            <Route path="/chat-detail/:id" element={<ChatDetailPage />} />
          </Routes>
        </Suspense>
        {/* Kết thúc bọc Suspense */}
      </Box>

      {/* VOUCHER MODAL */}
      <Modal
        visible={showVoucherModal}
        title="🎁 Chương trình Ưu đãi mới!"
        onClose={handleCloseVoucherModal}
        actions={[
          {
            text: "Đã hiểu",
            close: true,
            highLight: true,
            onClick: handleCloseVoucherModal,
          },
        ]}
      >
        <Box className="flex flex-col items-center text-center p-2">
          <Text className="text-gray-600 mb-2">
            Hệ thống vừa mở đợt đổi Voucher:
          </Text>
          <Text.Title size="normal" className="text-green-600 mb-4 font-bold">
            {voucherData?.voucherTitle}
          </Text.Title>
          {voucherData?.voucherStartTime && voucherData?.voucherEndTime && (
            <Box className="bg-green-50 p-3 rounded-xl w-full text-left">
              <Text size="small" className="text-gray-700 mb-1">
                <span className="font-semibold">Bắt đầu:</span> {voucherData.voucherStartTime}
              </Text>
              <Text size="small" className="text-gray-700 mb-1">
                <span className="font-semibold">Kết thúc:</span> {voucherData.voucherEndTime}
              </Text>
              <Text size="small" className="text-gray-700 border-t border-green-200 mt-2 pt-2">
                <span className="font-semibold">Cơ sở áp dụng:</span> {applicableShopNames}
              </Text>
            </Box>
          )}
          <Text size="small" className="text-gray-500 mt-4 italic">
            Bạn có thể dùng Điểm ưu đãi và Điểm tương tác để đổi voucher nhé!
          </Text>
        </Box>
      </Modal>

      <Navigation />
    </Box>
  );
};