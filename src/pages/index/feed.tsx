import React, { FC, useState, useEffect } from "react";
import { Box, Text, Spinner } from "zmp-ui";
import { PostItem } from "../../components/post-item";
import { RawPost, sortPostsOnEdge } from "../../utils/edgeRanker";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

export const FeedList: FC = () => {
  const [posts, setPosts] = useState<RawPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHomeFeed = async () => {
    try {
      setLoading(true);
      const postsRef = collection(db, "posts");
      
      // Lấy tất cả bài viết (không dùng orderBy để tránh sót các bài cũ không có trường createdAt)
      // Thuật toán edgeRanker bên dưới sẽ tự động sắp xếp lại một cách thông minh
      const querySnapshot = await getDocs(postsRef);
      const rawData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RawPost[];

      // Không lọc bài viết chờ duyệt nữa, cho hiển thị tất cả
      // Xếp hạng bằng Edge Ranker tại Client
      const sorted = sortPostsOnEdge(rawData);
      setPosts(sorted);
    } catch (error) {
      console.error("Lỗi tải bảng tin:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeFeed();
  }, []);

  if (loading) {
    return (
      <Box className="flex justify-center items-center h-40">
        <Spinner visible />
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Box className="flex flex-col items-center justify-center py-10 text-gray-400">
        <Text>Chưa có bài viết nào gần đây.</Text>
      </Box>
    );
  }

  return (
    <Box className="bg-transparent flex-1 overflow-y-auto pb-20">
      {posts.map((post) => (
        <PostItem key={post.id} data={post} />
      ))}
      <Box className="py-4 flex justify-center items-center cursor-pointer" onClick={fetchHomeFeed}>
        <Text size="small" className="text-[#14502e] font-medium border border-[#14502e] px-4 py-1.5 rounded-full">
          Làm mới bảng tin
        </Text>
      </Box>
    </Box>
  );
};
