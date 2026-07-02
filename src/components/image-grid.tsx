import React, { FC, useState } from "react";
import { Box, Text, Icon } from "zmp-ui";

interface ImageGridProps {
  images: string[];
  onImageClick?: (index: number) => void;
}

export const ImageGrid: FC<ImageGridProps> = ({ images, onImageClick }) => {
  if (!images || images.length === 0) return null;

  const handleImgClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (onImageClick) {
      onImageClick(index);
    }
  };

  if (images.length === 1) {
    return (
      <Box 
        className="w-full h-64 bg-cover bg-center cursor-pointer"
        style={{ backgroundImage: `url('${images[0]}')` }}
        onClick={(e) => handleImgClick(e, 0)}
      />
    );
  }

  if (images.length === 2) {
    return (
      <Box className="w-full h-64 grid grid-cols-2 gap-1 cursor-pointer">
        <Box 
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url('${images[0]}')` }}
          onClick={(e) => handleImgClick(e, 0)}
        />
        <Box 
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url('${images[1]}')` }}
          onClick={(e) => handleImgClick(e, 1)}
        />
      </Box>
    );
  }

  if (images.length === 3) {
    return (
      <Box className="w-full h-64 grid grid-cols-2 gap-1 cursor-pointer">
        <Box 
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url('${images[0]}')` }}
          onClick={(e) => handleImgClick(e, 0)}
        />
        <Box className="w-full h-full grid grid-rows-2 gap-1">
          <Box 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${images[1]}')` }}
            onClick={(e) => handleImgClick(e, 1)}
          />
          <Box 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${images[2]}')` }}
            onClick={(e) => handleImgClick(e, 2)}
          />
        </Box>
      </Box>
    );
  }

  if (images.length >= 4) {
    return (
      <Box className="w-full h-64 grid grid-cols-2 gap-1 cursor-pointer">
        <Box 
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url('${images[0]}')` }}
          onClick={(e) => handleImgClick(e, 0)}
        />
        <Box className="w-full h-full grid grid-rows-2 gap-1">
          <Box 
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${images[1]}')` }}
            onClick={(e) => handleImgClick(e, 1)}
          />
          <Box className="w-full h-full grid grid-cols-2 gap-1">
            <Box 
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url('${images[2]}')` }}
              onClick={(e) => handleImgClick(e, 2)}
            />
            <Box 
              className="w-full h-full bg-cover bg-center relative"
              style={{ backgroundImage: `url('${images[3]}')` }}
              onClick={(e) => handleImgClick(e, 3)}
            >
              {images.length > 4 && (
                <Box className="absolute inset-0 bg-black/50 flex justify-center items-center">
                  <Text className="text-white text-xl font-bold">+{images.length - 4}</Text>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
};
