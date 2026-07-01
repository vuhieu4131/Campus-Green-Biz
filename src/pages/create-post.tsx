import React, { FC, useState } from "react";
import { Page, Box, Text, Icon, Avatar, Button, Input, useNavigate } from "zmp-ui";
import { chooseImage } from "zmp-sdk";

const CreatePostPage: FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState("Công khai");

  const handleChooseImage = async () => {
    try {
      const { filePaths } = await chooseImage({
        sourceType: ["album", "camera"],
        cameraType: "back",
        count: 5 - images.length
      });
      if (filePaths && filePaths.length > 0) {
        setImages([...images, ...filePaths]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <Page className="bg-white flex flex-col h-screen">
      {/* Custom Header */}
      <Box className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white shadow-sm z-10">
        <Icon icon="zi-close" className="text-2xl cursor-pointer" onClick={() => navigate(-1)} />
        <Text.Title className="font-bold text-lg text-[#14502e]">Tạo bài đăng</Text.Title>
        <Button 
          size="small" 
          disabled={!content.trim() && images.length === 0}
          className={`rounded-full px-4 ${(!content.trim() && images.length === 0) ? 'bg-gray-200 text-gray-400' : 'bg-[#14502e] text-white'}`}
          onClick={() => {
            // TODO: Call API to create post
            navigate(-1);
          }}
        >
          Đăng
        </Button>
      </Box>

      <Box className="flex-1 overflow-y-auto">
        {/* User Info & Privacy */}
        <Box className="flex items-center px-4 py-3 space-x-3">
          <Avatar src="https://i.pravatar.cc/150?img=11" size={48} className="border-2 border-gray-100" />
          <Box>
            <Text className="font-bold text-[15px]">Đức</Text>
            <Box className="flex items-center space-x-1 bg-gray-100 rounded-md px-2 py-0.5 mt-0.5 cursor-pointer w-fit border border-gray-200 active:bg-gray-200 transition">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              <Text size="xxSmall" className="text-gray-600 font-medium">{privacy}</Text>
              <Icon icon="zi-chevron-down" size={12} className="text-gray-600" />
            </Box>
          </Box>
        </Box>

        {/* Input Area */}
        <Box className="px-4 py-2">
          <textarea
            placeholder="Bạn đang nghĩ gì?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border-none text-[17px] bg-transparent p-0 outline-none resize-none min-h-[150px] placeholder:text-gray-400"
            maxLength={2000}
          />
        </Box>

        {/* Image Preview Grid */}
        {images.length > 0 && (
          <Box className="px-4 py-2 grid grid-cols-2 gap-2">
            {images.map((img, idx) => (
              <Box key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={img} alt="preview" className="w-full h-full object-cover" />
                <Box 
                  className="absolute top-1 right-1 bg-black/50 rounded-full p-1 cursor-pointer hover:bg-black/70"
                  onClick={() => removeImage(idx)}
                >
                  <Icon icon="zi-close" size={16} className="text-white" />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Bottom Action Bar */}
      <Box className="border-t border-gray-100 bg-white pb-safe">
        <Box className="flex items-center justify-between px-4 py-3">
          <Text className="font-medium text-gray-700">Thêm vào bài viết</Text>
          <Box className="flex space-x-4">
            <svg onClick={handleChooseImage} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 cursor-pointer active:opacity-70"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 cursor-pointer active:opacity-70"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 cursor-pointer active:opacity-70"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 cursor-pointer active:opacity-70"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          </Box>
        </Box>
      </Box>
    </Page>
  );
};

export default CreatePostPage;
