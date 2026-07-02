import { DisplayPrice } from "components/display/price";
import React, { FC } from "react";
import { useRecoilValue } from "recoil";
import { totalPriceState, totalQuantityState } from "state";
import pay from "utils/product";
import { Box, Button, Text, useSnackbar, useNavigate } from "zmp-ui";
import CustomIcon from "components/custom-icon";
import { useSetRecoilState } from "recoil";
import { notificationsState, cartState } from "state";

export const CartPreview: FC = () => {
  const quantity = useRecoilValue(totalQuantityState);
  const totalPrice = useRecoilValue(totalPriceState);
  const setNotifications = useSetRecoilState(notificationsState);
  const setCart = useSetRecoilState(cartState);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleCheckout = async () => {
    try {
      await pay(totalPrice);
      setNotifications((prev) => [
        {
          id: Date.now(),
          image: "https://stc-zmp.zadn.vn/templates/zaui-coffee/dummy/logo.webp",
          title: "Đặt hàng thành công",
          content: "Đơn hàng của bạn đã được tiếp nhận và đang xử lý.",
        },
        ...prev,
      ]);
      setCart([]);
      openSnackbar({ 
        text: "Đã đặt hàng thành công!", 
        prefixIcon: <CustomIcon icon="zi-check-circle-2" className="text-green-500 mr-2" />, 
        icon: false 
      });
      navigate("/");
    } catch (error) {
      openSnackbar({ text: "Thanh toán thất bại hoặc đã hủy", icon: false });
    }
  };

  return (
    <Box flex className="sticky bottom-0 bg-background p-4 space-x-4">
      <Box
        flex
        flexDirection="column"
        justifyContent="space-between"
        className="min-w-[120px] flex-none"
      >
        <Text className="text-gray" size="xSmall">
          {quantity} sản phẩm
        </Text>
        <Text.Title size="large">
          <DisplayPrice>{totalPrice}</DisplayPrice>
        </Text.Title>
      </Box>
      <Button
        type="highlight"
        disabled={!quantity}
        fullWidth
        onClick={handleCheckout}
      >
        Đặt hàng
      </Button>
    </Box>
  );
};
