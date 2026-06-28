import React, { FC, useState } from "react";
import { Box, Text, Avatar, Icon } from "zmp-ui";

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
    content: "Vừa nhận được ly cà phê xanh mướt từ Campus Green Biz! Cảm giác thật tuyệt vời khi vừa thưởng thức đồ uống ngon vừa góp phần bảo vệ môi trường 🌿☕",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&fit=crop",
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
    content: "Đổi voucher thành công! Tuần này quyết tâm ăn chay và tái chế rác nhựa để tích thêm Điểm Xanh. Mọi người cùng cố gắng nhé! ♻️💚",
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
    content: "Góc khoe chiến tích trồng cây cuối tuần. Cảm ơn chương trình Green Campus đã tạo ra một phong trào ý nghĩa cho sinh viên chúng mình. 🌱🌍",
    image: "https://images.unsplash.com/photo-1416879598553-337b51bc5e3a?w=800&fit=crop",
    likes: 356,
    comments: 42,
    shares: 18,
  }
];

export const Post: FC<{ data: PostData }> = ({ data }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(data.likes);

  const handleLike = () => {
    if (liked) {
      setLikesCount(prev => prev - 1);
      setLiked(false);
    } else {
      setLikesCount(prev => prev + 1);
      setLiked(true);
    }
  };

  return (
    <Box className="bg-white mb-3 pt-3 pb-2 shadow-sm border-b border-gray-100">
      {/* Header */}
      <Box className="flex items-center justify-between px-4 mb-2">
        <Box className="flex items-center space-x-2">
          <Avatar src={data.author.avatar} size={40} className="border border-gray-100" />
          <Box>
            <Text.Title className="font-bold text-gray-800 text-sm leading-tight">{data.author.name}</Text.Title>
            <Text size="xxSmall" className="text-gray-500">{data.timestamp} • 🌍</Text>
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
          className="w-full h-64 bg-cover bg-center mb-3"
          style={{ backgroundImage: `url('${data.image}')` }}
        />
      )}

      {/* Stats */}
      <Box className="flex justify-between items-center px-4 mb-3 text-gray-500 border-b border-gray-100 pb-2">
        <Box className="flex items-center space-x-1">
          <Box className="bg-[#15803d] rounded-full p-[2px] flex items-center justify-center">
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
            <Icon icon="zi-heart-solid" className="text-[#15803d] text-xl" />
          ) : (
            <Icon icon="zi-heart" className="text-gray-500 text-xl" />
          )}
          <Text size="small" className={`font-medium ${liked ? 'text-[#15803d]' : 'text-gray-500'}`}>Thích</Text>
        </Box>
        <Box className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50">
          <Icon icon="zi-chat" className="text-gray-500 text-xl" />
          <Text size="small" className="font-medium text-gray-500">Bình luận</Text>
        </Box>
        <Box className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50">
          <Icon icon="zi-share" className="text-gray-500 text-xl" />
          <Text size="small" className="font-medium text-gray-500">Chia sẻ</Text>
        </Box>
      </Box>
    </Box>
  );
};

export const FeedList: FC = () => {
  // Demo cuộn vô cực đơn giản
  const [posts, setPosts] = useState<PostData[]>(DUMMY_POSTS);

  const loadMore = () => {
    // Clone dummy posts with new IDs to simulate loading more
    const newPosts = DUMMY_POSTS.map(p => ({ ...p, id: Math.random().toString() }));
    setPosts(prev => [...prev, ...newPosts]);
  };

  return (
    <Box className="bg-gray-100 flex-1 overflow-y-auto pb-20">
      {posts.map((post) => (
        <Post key={post.id} data={post} />
      ))}
      <Box 
        className="py-4 flex justify-center items-center cursor-pointer"
        onClick={loadMore}
      >
        <Text size="small" className="text-[#15803d] font-medium border border-[#15803d] px-4 py-1.5 rounded-full">
          Tải thêm bài viết...
        </Text>
      </Box>
    </Box>
  );
};
