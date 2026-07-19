import React, { Suspense, useEffect, useState } from "react";
import { Box, Page, Spinner } from "zmp-ui";
import { Banner } from "./banner";
import { FeedList } from "./feed";
import { Welcome } from "./welcome";
import { Categories } from "./categories";
import { ShopDirectory } from "./shop-directory";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

const HomePage: React.FunctionComponent = () => {
  const [showPosts, setShowPosts] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
        if (configSnap.exists() && configSnap.data().showPosts !== undefined) {
          setShowPosts(configSnap.data().showPosts);
        }
      } catch (error) {
        console.error("Lỗi tải cấu hình:", error);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  return (
    <Page className="relative flex-1 flex flex-col bg-[#f0fdf4]">
      <Welcome />
      <Box className="flex-1 overflow-auto bg-transparent">
        <Box className="bg-transparent pb-3 mb-2">
          <Banner />
        </Box>
        
        {loadingConfig ? (
          <Box className="flex justify-center py-10"><Spinner visible /></Box>
        ) : showPosts ? (
          <FeedList />
        ) : (
          <>
            <Categories />
            <Box className="mt-4">
              <ShopDirectory />
            </Box>
          </>
        )}
      </Box>
    </Page>
  );
};

export default HomePage;
