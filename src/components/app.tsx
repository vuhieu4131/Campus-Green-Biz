import React from "react";
import { App, ZMPRouter, SnackbarProvider } from "zmp-ui";
import { RecoilRoot, useRecoilValue } from "recoil";
import { getConfig } from "utils/config";
import { Layout } from "./layout";
import { ConfigProvider } from "./config-provider";
import { themeState, applyThemeToDom } from "../state";

const ThemedAppContent: React.FC = () => {
  const theme = useRecoilValue(themeState);

  React.useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  return (
    <ConfigProvider
      cssVariables={{
        "--zmp-primary-color": getConfig((c) => c.template.primaryColor),
        "--zmp-background-color": theme === "dark" ? "#0c1712" : "#f4f5f6",
      }}
    >
      <App theme={theme}>
        <SnackbarProvider>
          <ZMPRouter>
            <Layout />
          </ZMPRouter>
        </SnackbarProvider>
      </App>
    </ConfigProvider>
  );
};

const MyApp = () => {
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      localStorage.setItem('referral_code', refCode);
    }
  }, []);

  return (
    <RecoilRoot>
      <ThemedAppContent />
    </RecoilRoot>
  );
};
export default MyApp;

