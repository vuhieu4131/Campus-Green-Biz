import React, { Suspense } from "react";
import { Box, Page } from "zmp-ui";
import { Banner } from "./banner";
import { FeedList } from "./feed";
import { Welcome } from "./welcome";

const HomePage: React.FunctionComponent = () => {
  return (
    <Page className="relative flex-1 flex flex-col">
      <Welcome />
      <Box className="flex-1 overflow-auto bg-gray-100">
        <Box className="bg-white pb-3 mb-2 shadow-sm">
          <Banner />
        </Box>
        <FeedList />
      </Box>
    </Page>
  );
};

export default HomePage;
