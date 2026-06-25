import React, { FC, PropsWithChildren } from "react";
import { Box, Text } from "zmp-ui";

interface SectionBoxProps {
  title?: string;
  padding?: "none" | "all";
}

export const SectionBox: FC<PropsWithChildren<SectionBoxProps>> = ({ title, padding = "none", children }) => {
  return (
    <Box className="mt-6 mb-2">
      {title && (
        <Text className="px-4 font-bold text-[#15803d] text-lg mb-2">
          {title}
        </Text>
      )}
      <Box className={`mx-4 bg-white rounded-2xl shadow-sm border border-green-50 overflow-hidden ${padding === 'all' ? 'p-4' : ''}`}>
        {children}
      </Box>
    </Box>
  );
};
