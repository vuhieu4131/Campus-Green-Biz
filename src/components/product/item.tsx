import { FinalPrice } from "components/display/final-price";
import React, { FC } from "react";
import { Product } from "types/product";
import { Box, Text } from "zmp-ui";
import { useNavigate } from "react-router-dom";

export const ProductItem: FC<{ product: Product }> = ({ product }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="space-y-2 cursor-pointer active:opacity-70 transition-opacity" 
      onClick={() => navigate(`/detail/${product.id}`, { state: { product } })}
    >
      <Box className="w-full aspect-square relative">
        <img
          loading="lazy"
          src={product.image || product.images?.[0] || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80"}
          className="absolute left-0 right-0 top-0 bottom-0 w-full h-full object-cover object-center rounded-lg bg-skeleton"
        />
      </Box>
      <Text className="font-semibold text-gray-800 line-clamp-2 leading-snug">{product.name || product.title}</Text>
      <Text size="xxSmall" className="text-gray pb-2">
        <FinalPrice>{product}</FinalPrice>
      </Text>
    </div>
  );
};
