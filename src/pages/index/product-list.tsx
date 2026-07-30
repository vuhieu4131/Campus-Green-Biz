import React, { FC, Suspense, useState, useEffect } from "react";
import { Section } from "components/section";
import { useRecoilValue } from "recoil";
import { productsState } from "state";
import { Box } from "zmp-ui";
import { ProductItem } from "components/product/item";
import { ProductItemSkeleton } from "components/skeletons";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

export const ProductListContent: FC = () => {
  const products = useRecoilValue(productsState);
  const [showPrice, setShowPrice] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system_config", "admin_settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.showPrice !== undefined) setShowPrice(data.showPrice);
      }
    });
    return () => unsub();
  }, []);

  return (
    <Section title="Danh sách sản phẩm">
      <Box className="grid grid-cols-2 gap-4">
        {products.map((product) => (
          <ProductItem key={product.id} product={product} showPrice={showPrice} />
        ))}
      </Box>
    </Section>
  );
};

export const ProductListFallback: FC = () => {
  const products = [...new Array(12)];

  return (
    <Section title="Danh sách sản phẩm">
      <Box className="grid grid-cols-2 gap-4">
        {products.map((_, i) => (
          <ProductItemSkeleton key={i} />
        ))}
      </Box>
    </Section>
  );
};

export const ProductList: FC = () => {
  return (
    <Suspense fallback={<ProductListFallback />}>
      <ProductListContent />
    </Suspense>
  );
};
