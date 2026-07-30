import React, { Suspense, useEffect, useState } from "react";
import { Box, Page, Spinner } from "zmp-ui";
import { Banner } from "./banner";
import { FeedList } from "./feed";
import { Welcome } from "./welcome";
import { Categories } from "./categories";
import { ShopDirectory } from "./shop-directory";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

const HomePage: React.FunctionComponent = () => {
  const [showPosts, setShowPosts] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "system_config", "admin_settings"), 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.showPosts !== undefined) {
            setShowPosts(data.showPosts);
          }
        }
        setLoadingConfig(false);
      },
      (error) => {
        console.error("Lỗi tải cấu hình:", error);
        setLoadingConfig(false);
      }
    );
    return () => unsub();
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
