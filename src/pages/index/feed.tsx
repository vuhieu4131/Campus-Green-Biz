import React, { FC, useState } from "react";
import { Box, Text, Avatar, Icon, Sheet, Input } from "zmp-ui";

interface PostData {
  id: string;
  author: {
    name: string;
    avatar: string;
  };
  timestamp: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  shares: number;
}

const DUMMY_POSTS: PostData[] = [
  {
    id: "1",
    author: {
      name: "Đức V.",
      avatar: "https://i.pravatar.cc/150?img=11",
    },
    timestamp: "2 giờ trước",
    content:
      "Vừa nhận được ly cà phê xanh mướt từ Campus Green Biz! Cảm giác thật tuyệt vời khi vừa thưởng thức đồ uống ngon vừa góp phần bảo vệ môi trường 🌿☕",
    image:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&fit=crop",
    likes: 124,
    comments: 15,
    shares: 2,
  },
  {
    id: "2",
    author: {
      name: "Mai Anh",
      avatar: "https://i.pravatar.cc/150?img=5",
    },
    timestamp: "5 giờ trước",
    content:
      "Đổi voucher thành công! Tuần này quyết tâm ăn chay và tái chế rác nhựa để tích thêm Điểm Xanh. Mọi người cùng cố gắng nhé! ♻️💚",
    likes: 89,
    comments: 23,
    shares: 0,
  },
  {
    id: "3",
    author: {
      name: "Hoàng Minh",
      avatar: "https://i.pravatar.cc/150?img=12",
    },
    timestamp: "Hôm qua lúc 15:30",
    content:
      "Góc khoe chiến tích trồng cây cuối tuần. Cảm ơn chương trình Green Campus đã tạo ra một phong trào ý nghĩa cho sinh viên chúng mình. 🌱🌍",
    image:
      "https://images.unsplash.com/photo-1416879598553-337b51bc5e3a?w=800&fit=crop",
    likes: 356,
    comments: 42,
    shares: 18,
  },
];

export const Post: FC<{ data: PostData }> = ({ data }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(data.likes);

  // States cho các tương tác nâng cao
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const handleLike = () => {
    if (liked) {
      setLikesCount((prev) => prev - 1);
      setLiked(false);
    } else {
      setLikesCount((prev) => prev + 1);
      setLiked(true);
    }
  };

  return (
    <Box className="bg-white mx-3 mb-4 pt-4 pb-2 rounded-2xl shadow-md border border-gray-500">
      {/* Header */}
      <Box className="flex items-center justify-between px-4 mb-2">
        <Box className="flex items-center space-x-2">
          <Avatar
            src={data.author.avatar}
            size={40}
            className="border border-gray-100"
          />
          <Box>
            <Text.Title className="font-bold text-gray-800 text-sm leading-tight">
              {data.author.name}
            </Text.Title>
            <Text size="xxSmall" className="text-gray-500">
              {data.timestamp} • 🌍
            </Text>
          </Box>
        </Box>
        <Icon icon="zi-more-horiz" className="text-gray-400" />
      </Box>

      {/* Content */}
      <Box className="px-4 mb-3">
        <Text className="text-gray-800 leading-relaxed text-sm">
          {data.content}
        </Text>
      </Box>

      {/* Image */}
      {data.image && (
        <Box
          className="w-full h-64 bg-cover bg-center mb-3 cursor-pointer"
          style={{ backgroundImage: `url('${data.image}')` }}
          onClick={() => {
            setShowOverlay(true);
            setShowImageViewer(true);
          }}
        />
      )}

      {/* Stats */}
      <Box className="flex justify-between items-center px-4 mb-3 text-gray-500 border-b border-gray-100 pb-2">
        <Box className="flex items-center space-x-1">
          <Box className="bg-[#14502e] rounded-full p-[2px] flex items-center justify-center">
            <Icon icon="zi-heart-solid" className="text-white text-[10px]" />
          </Box>
          <Text size="xxSmall">{likesCount}</Text>
        </Box>
        <Box className="flex items-center space-x-3">
          <Text size="xxSmall">{data.comments} bình luận</Text>
          <Text size="xxSmall">{data.shares} chia sẻ</Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box className="flex justify-around items-center px-2">
        <Box
          className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50"
          onClick={handleLike}
        >
          {liked ? (
            <Icon icon="zi-heart-solid" className="text-[#14502e] text-xl" />
          ) : (
            <Icon icon="zi-heart" className="text-gray-500 text-xl" />
          )}
          <Text
            size="small"
            className={`font-medium ${
              liked ? "text-[#14502e]" : "text-gray-500"
            }`}
          >
            Thích
          </Text>
        </Box>
        <Box
          className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50"
          onClick={() => setShowComments(true)}
        >
          <Icon icon="zi-chat" className="text-gray-500 text-xl" />
          <Text size="small" className="font-medium text-gray-500">
            Bình luận
          </Text>
        </Box>
        <Box
          className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50"
          onClick={() => setShowShare(true)}
        >
          <Icon icon="zi-share" className="text-gray-500 text-xl" />
          <Text size="small" className="font-medium text-gray-500">
            Chia sẻ
          </Text>
        </Box>
      </Box>

      {/* 1. Trình xem ảnh toàn màn hình (Fullscreen Image Viewer) */}
      {showImageViewer && data.image && (
        <Box
          className="fixed inset-0 bg-black z-[100] flex flex-col justify-center items-center"
          onClick={() => setShowOverlay(!showOverlay)}
        >
          <Box
            className="w-full h-full bg-contain bg-no-repeat bg-center"
            style={{ backgroundImage: `url('${data.image}')` }}
          />

          {showOverlay && (
            <>
              {/* Header của Trình xem ảnh */}
              <Box className="absolute top-0 left-0 w-full p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
                <Box className="flex items-center space-x-2">
                  <Avatar
                    src={data.author.avatar}
                    size={36}
                    className="border border-white/30"
                  />
                  <Box>
                    <Text className="text-white font-bold text-sm leading-tight">
                      {data.author.name}
                    </Text>
                    <Text className="text-white/70 text-xs">
                      {data.timestamp}
                    </Text>
                  </Box>
                </Box>
                <Icon
                  icon="zi-close"
                  className="text-white text-3xl cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageViewer(false);
                  }}
                />
              </Box>

              {/* Footer / Actions của Trình xem ảnh */}
              <Box className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-around items-center">
                <Box
                  className="flex flex-col items-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                >
                  <Icon
                    icon={liked ? "zi-heart-solid" : "zi-heart"}
                    className={
                      liked ? "text-red-500 text-3xl" : "text-white text-3xl"
                    }
                  />
                  <Text className="text-white text-xs mt-1">{likesCount}</Text>
                </Box>
                <Box
                  className="flex flex-col items-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageViewer(false);
                    setShowComments(true);
                  }}
                >
                  <Icon icon="zi-chat" className="text-white text-3xl" />
                  <Text className="text-white text-xs mt-1">
                    {data.comments}
                  </Text>
                </Box>
                <Box
                  className="flex flex-col items-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageViewer(false);
                    setShowShare(true);
                  }}
                >
                  <Icon icon="zi-share" className="text-white text-3xl" />
                  <Text className="text-white text-xs mt-1">{data.shares}</Text>
                </Box>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* 2. Bảng Bình luận (Comment Bottom Sheet) */}
      <Sheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        autoHeight
        title="Bình luận"
      >
        <Box className="p-4 flex flex-col space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Bình luận mẫu 1 */}
          <Box className="flex space-x-2">
            <Avatar
              src="https://i.pravatar.cc/150?img=1"
              size={32}
              className="flex-shrink-0"
            />
            <Box className="bg-gray-100 px-3 py-2 rounded-2xl flex-1">
              <Text className="font-bold text-sm text-gray-800">
                Thanh Tùng
              </Text>
              <Text className="text-sm text-gray-700">
                Tuyệt vời quá bạn ơi! 🌿
              </Text>
            </Box>
          </Box>
          {/* Bình luận mẫu 2 */}
          <Box className="flex space-x-2">
            <Avatar
              src="https://i.pravatar.cc/150?img=2"
              size={32}
              className="flex-shrink-0"
            />
            <Box className="bg-gray-100 px-3 py-2 rounded-2xl flex-1">
              <Text className="font-bold text-sm text-gray-800">Bích Ngọc</Text>
              <Text className="text-sm text-gray-700">
                Cho mình hỏi địa chỉ cửa hàng với ạ? Nhìn thích quá đi mất.
              </Text>
            </Box>
          </Box>
        </Box>
        {/* Khung nhập bình luận */}
        <Box className="p-3 border-t border-gray-200 flex space-x-3 items-center bg-white">
          <Avatar
            src="https://i.pravatar.cc/150?img=11"
            size={36}
            className="flex-shrink-0"
          />
          <Box className="flex-1 bg-gray-100 rounded-full px-4 py-1 flex items-center">
            <Input
              className="flex-1 bg-transparent border-none p-0 h-9"
              placeholder="Viết bình luận..."
              clearable
            />
            <Icon
              icon="zi-send-solid"
              className="text-[#14502e] text-xl ml-2 cursor-pointer"
            />
          </Box>
        </Box>
      </Sheet>

      {/* 3. Bảng Chia sẻ (Share Bottom Sheet) */}
      <Sheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        autoHeight
        title="Chia sẻ lên"
      >
        <Box className="p-6 grid grid-cols-4 gap-4">
          <Box className="flex flex-col items-center cursor-pointer">
            <Box className="w-14 h-14 bg-[#0068ff] rounded-full flex items-center justify-center mb-2 text-white shadow-md">
              <Icon icon="zi-chat" className="text-2xl" />
            </Box>
            <Text
              size="xSmall"
              className="text-center font-medium text-gray-600"
            >
              Gửi bạn bè
            </Text>
          </Box>
          <Box className="flex flex-col items-center cursor-pointer">
            <Box className="w-14 h-14 bg-[#0068ff] rounded-full flex items-center justify-center mb-2 text-white shadow-md">
              <Icon icon="zi-note" className="text-2xl" />
            </Box>
            <Text
              size="xSmall"
              className="text-center font-medium text-gray-600"
            >
              Đăng nhật ký
            </Text>
          </Box>
          <Box className="flex flex-col items-center cursor-pointer">
            <Box className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-2 text-gray-700 shadow-md border border-gray-200">
              <Icon icon="zi-copy" className="text-2xl" />
            </Box>
            <Text
              size="xSmall"
              className="text-center font-medium text-gray-600"
            >
              Sao chép link
            </Text>
          </Box>
          <Box className="flex flex-col items-center cursor-pointer">
            <Box className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-2 text-gray-700 shadow-md border border-gray-200">
              <Icon icon="zi-download" className="text-2xl" />
            </Box>
            <Text
              size="xSmall"
              className="text-center font-medium text-gray-600"
            >
              Lưu ảnh
            </Text>
          </Box>
        </Box>
      </Sheet>
    </Box>
  );
};

export const FeedList: FC = () => {
  // Demo cuộn vô cực đơn giản
  const [posts, setPosts] = useState<PostData[]>(DUMMY_POSTS);

  const loadMore = () => {
    // Clone dummy posts with new IDs to simulate loading more
    const newPosts = DUMMY_POSTS.map((p) => ({
      ...p,
      id: Math.random().toString(),
    }));
    setPosts((prev) => [...prev, ...newPosts]);
  };

  return (
    <Box className="bg-transparent flex-1 overflow-y-auto pb-20">
      {posts.map((post) => (
        <Post key={post.id} data={post} />
      ))}
      <Box
        className="py-4 flex justify-center items-center cursor-pointer"
        onClick={loadMore}
      >
        <Text
          size="small"
          className="text-[#14502e] font-medium border border-[#14502e] px-4 py-1.5 rounded-full"
        >
          Tải thêm bài viết...
        </Text>
      </Box>
    </Box>
  );
};
