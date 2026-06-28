import React from "react";
import { App, ZMPRouter, SnackbarProvider } from "zmp-ui";
import { RecoilRoot } from "recoil";
import { getConfig } from "utils/config";
import { Layout } from "./layout";
import { ConfigProvider } from "./config-provider";
import ProfilePage from "pages/profile";
import DistributorPage from "pages/distributor";
import AdminDashboardPage from "pages/admin-dashboard";
import SearchPage from "pages/search";
import CategoryPage from "pages/category";
import NotificationPage from "pages/notification";
import CartPage from "pages/cart";
import CheckoutResultPage from "pages/result";
import WalletPage from "pages/wallet";
import SettingsPage from "pages/settings";
import AccountInfoPage from "pages/account-info";

const MyApp = () => {
  return (
    <RecoilRoot>
      <ConfigProvider
        cssVariables={{
          "--zmp-primary-color": getConfig((c) => c.template.primaryColor),
          "--zmp-background-color": "#f4f5f6",
        }}
      >
        <App>
          <SnackbarProvider>
            <ZMPRouter>
              <Layout />
            </ZMPRouter>
          </SnackbarProvider>
        </App>
      </ConfigProvider>
    </RecoilRoot>
  );
};
export default MyApp;
