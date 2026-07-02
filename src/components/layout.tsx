import React, { FC, Suspense } from "react";
import { Route, Routes } from "react-router";
import { Box } from "zmp-ui";
import { Navigation } from "./navigation";
import HomePage from "pages/index";
import CategoryPage from "pages/category";
import CartPage from "pages/cart";
import NotificationPage from "pages/notification";
import ProfilePage from "pages/profile";
import SearchPage from "pages/search";
import CheckoutResultPage from "pages/result";

import DistributorPage from "pages/distributor"; // (hoặc đường dẫn tương ứng tới file distributor.tsx)
import AdminDashboardPage from "pages/admin-dashboard";
import SettingsPage from "pages/settings";
import AccountInfoPage from "pages/account-info";
import WalletPage from "pages/wallet";
import CreatePostPage from "pages/create-post";
import PostDetailPage from "pages/post-detail";
import { getSystemInfo } from "zmp-sdk";
import { ScrollRestoration } from "./scroll-restoration";
import { useHandlePayment } from "hooks";
import ShopPublicView from '../pages/ShopPublicView';
import PostPage from '../pages/post';

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
            <Route path="/distributor" element={<DistributorPage />} />
            <Route path="/shop-details/:id" element={<ShopPublicView />} />
            <Route path="/post-service" element={<PostPage />} />
            <Route path="/admin-dashboard" element={<AdminDashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/account-info" element={<AccountInfoPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/create-post" element={<CreatePostPage />} />
            <Route path="/post-detail" element={<PostDetailPage />} />
          </Routes>
        </Suspense>
        {/* Kết thúc bọc Suspense */}
      </Box>
      <Navigation />
    </Box>
  );
};