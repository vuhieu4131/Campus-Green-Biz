import React, { FC } from "react";
import { ListRenderer } from "components/list-renderer";
import { Box, Header, Page, Text, Icon } from "zmp-ui";
import { Divider } from "components/divider";

const orderNotifications = [
  {
    id: 1,
    icon: "zi-check-circle",
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
    title: "Giao hàng thành công",
    content: "Đơn hàng #12345 đã được giao đến bạn. Chúc bạn một ngày vui vẻ!",
    time: "10:30 24/06"
  },
  {
    id: 2,
    icon: "zi-clock-1",
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
    title: "Đơn hàng đang giao",
    content: "Tài xế đang trên đường giao đơn hàng #12346 cho bạn. Vui lòng chú ý điện thoại.",
    time: "09:15 24/06"
  },
  {
    id: 3,
    icon: "zi-note",
    iconColor: "text-yellow-600",
    bgColor: "bg-yellow-100",
    title: "Xác nhận đơn hàng",
    content: "Đơn hàng #12347 của bạn đã được cửa hàng xác nhận và đang được chuẩn bị.",
    time: "08:00 24/06"
  },
  {
    id: 4,
    icon: "zi-close-circle",
    iconColor: "text-red-600",
    bgColor: "bg-red-100",
    title: "Đơn hàng đã hủy",
    content: "Đơn hàng #12344 của bạn đã bị hủy. Tiền sẽ được hoàn lại trong 24h.",
    time: "15:20 23/06"
  }
];

const NotificationList: FC = () => {
  return (
    <Box className="bg-white">
      <ListRenderer
        noDivider
        items={orderNotifications}
        renderLeft={(item) => (
          <Box className={`w-12 h-12 rounded-full flex items-center justify-center ${item.bgColor}`}>
            <Icon icon={item.icon} className={item.iconColor} size={24} />
          </Box>
        )}
        renderRight={(item) => (
          <Box key={item.id} className="ml-2 py-2 border-b border-gray-100 last:border-0 w-full pr-4">
            <Box className="flex justify-between items-start mb-1">
              <Text.Title className="font-bold text-gray-800 text-base">{item.title}</Text.Title>
              <Text size="xSmall" className="text-gray-400 whitespace-nowrap ml-2 mt-1">{item.time}</Text>
            </Box>
            <Text
              size="small"
              className="text-gray-600 line-clamp-2"
            >
              {item.content}
            </Text>
          </Box>
        )}
      />
    </Box>
  );
};

const NotificationPage: FC = () => {
  return (
    <Page className="bg-gray-50">
      <Header title="Thông báo" showBackIcon={true} />
      <NotificationList />
    </Page>
  );
};

export default NotificationPage;
