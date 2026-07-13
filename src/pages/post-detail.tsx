import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Box, Text, Icon } from "zmp-ui";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { PostItem } from "../components/post-item";

const PostDetailPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const postId = new URLSearchParams(location.search).get("id");
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    if (!postId) return;
    const fetchPost = async () => {
      const docRef = doc(db, "posts", postId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      }
    };
    fetchPost();
  }, [postId]);

  if (!post) {
    return (
      <Page className="bg-gray-50 flex justify-center items-center h-screen">
        <Text className="text-gray-400">Đang tải...</Text>
      </Page>
    );
  }

  return (
    <Page className="bg-gray-50 flex flex-col h-screen">
      {/* Header */}
      <Box className="flex items-center px-4 py-3 bg-white z-50 shadow-sm border-b border-gray-100">
        <CustomIcon icon="zi-arrow-left" className="text-2xl mr-4 cursor-pointer" onClick={() => navigate(-1)} />
        <Text.Title className="font-bold text-[17px]">Bài viết</Text.Title>
      </Box>

      {/* Nội dung bài viết */}
      <Box className="flex-1 overflow-y-auto pt-4 pb-20">
        <PostItem data={post} isDetailView={true} onDelete={() => navigate(-1)} />
      </Box>
    </Page>
  );
};

export default PostDetailPage;
