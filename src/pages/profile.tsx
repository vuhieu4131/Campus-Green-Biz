import React, { FC, useState } from "react";
import { Box, Header, Icon, Page, Text, Button } from "zmp-ui";
import subscriptionDecor from "static/subscription-decor.svg";
import { ListRenderer } from "components/list-renderer";
import { useToBeImplemented } from "hooks";
import { useRecoilCallback } from "recoil";
import { userState } from "state";
import { AdminView } from "../components/profile-modules/admin-view";

const Subscription: FC<{ onLoginAdmin: () => void }> = ({ onLoginAdmin }) => {
  const requestUserInfo = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const userInfo = await snapshot.getPromise(userState);
        console.warn("Các bên tích hợp có thể sử dụng userInfo ở đây...", {
          userInfo,
        });
      },
    []
  );

  return (
    <Box className="m-4">
      <Box
        className="bg-green text-white rounded-xl p-4 space-y-2 mb-4"
        style={{
          backgroundImage: `url(${subscriptionDecor})`,
          backgroundPosition: "right 8px center",
          backgroundRepeat: "no-repeat",
        }}
        onClick={requestUserInfo}
      >
        <Text.Title className="font-bold">Đăng ký thành viên</Text.Title>
        <Text size="xxSmall">Tích điểm đổi thưởng, mở rộng tiện ích</Text>
      </Box>
      <Button 
        fullWidth 
        variant="secondary"
        onClick={onLoginAdmin}
        className="bg-blue-600 text-white font-bold"
      >
        Đăng nhập với quyền Admin
      </Button>
    </Box>
  );
};

const Personal: FC = () => {
  const onClick = useToBeImplemented();

  return (
    <Box className="m-4">
      <ListRenderer
        title="Cá nhân"
        onClick={onClick}
        items={[
          {
            left: <Icon icon="zi-user" />,
            right: (
              <Box flex>
                <Text.Header className="flex-1 items-center font-normal">
                  Thông tin tài khoản
                </Text.Header>
                <Icon icon="zi-chevron-right" />
              </Box>
            ),
          },
          {
            left: <Icon icon="zi-clock-2" />,
            right: (
              <Box flex>
                <Text.Header className="flex-1 items-center font-normal">
                  Lịch sử đơn hàng
                </Text.Header>
                <Icon icon="zi-chevron-right" />
              </Box>
            ),
          },
        ]}
        renderLeft={(item) => item.left}
        renderRight={(item) => item.right}
      />
    </Box>
  );
};

const Other: FC = () => {
  const onClick = useToBeImplemented();

  return (
    <Box className="m-4">
      <ListRenderer
        title="Khác"
        onClick={onClick}
        items={[
          {
            left: <Icon icon="zi-star" />,
            right: (
              <Box flex>
                <Text.Header className="flex-1 items-center font-normal">
                  Đánh giá đơn hàng
                </Text.Header>
                <Icon icon="zi-chevron-right" />
              </Box>
            ),
          },
          {
            left: <Icon icon="zi-call" />,
            right: (
              <Box flex>
                <Text.Header className="flex-1 items-center font-normal">
                  Liên hệ và góp ý
                </Text.Header>
                <Icon icon="zi-chevron-right" />
              </Box>
            ),
          },
        ]}
        renderLeft={(item) => item.left}
        renderRight={(item) => item.right}
      />
    </Box>
  );
};

const ProfilePage: FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  if (isAdmin) {
    return (
      <Page className="relative overflow-y-auto">
        <AdminView userData={{ name: "Admin", role: "admin" }} onLogout={() => setIsAdmin(false)} />
      </Page>
    );
  }

  return (
    <Page className="relative overflow-y-auto">
      <Header showBackIcon={false} title="&nbsp;" />
      <Subscription onLoginAdmin={() => setIsAdmin(true)} />
      <Personal />
      <Other />
    </Page>
  );
};

export default ProfilePage;
