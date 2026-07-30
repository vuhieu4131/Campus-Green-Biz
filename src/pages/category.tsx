import { ProductItem } from "components/product/item";
import React, { FC, Suspense, useState, useEffect } from "react";
import { useRecoilValue } from "recoil";
import {
  categoriesState,
  productsByCategoryState,
  selectedCategoryIdState,
} from "state";
import { Box, Header, Page, Tabs, Text } from "zmp-ui";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const CategoryPicker: FC = () => {
  const categories = useRecoilValue(categoriesState);
  const selectedCategory = useRecoilValue(selectedCategoryIdState);
  return (
    <Tabs
      scrollable
      defaultActiveKey={selectedCategory}
      className="category-tabs"
    >
      {categories.map((category) => (
        <Tabs.Tab key={category.id} label={category.name}>
          <Suspense>
            <CategoryProducts categoryName={category.name} />
          </Suspense>
        </Tabs.Tab>
      ))}
    </Tabs>
  );
};

const CategoryProducts: FC<{ categoryName: string }> = ({ categoryName }) => {
  const productsByCategory = useRecoilValue(
    productsByCategoryState(categoryName),
  );
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

  if (productsByCategory.length === 0) {
    return (
      <Box className="flex-1 bg-background p-4 flex justify-center items-center">
        <Text size="xSmall" className="text-gray">
          Không có sản phẩm trong danh mục
        </Text>
      </Box>
    );
  }
  return (
    <Box className="bg-background grid grid-cols-2 gap-4 p-4">
      {productsByCategory.map((product) => (
        <ProductItem key={product.id} product={product} showPrice={showPrice} />
      ))}
    </Box>
  );
};

const CategoryPage: FC = () => {
  return (
    <Page className="flex flex-col">
      <Header title="Danh mục" />
      <CategoryPicker />
    </Page>
  );
};

export default CategoryPage;
