import React, { useEffect, useState } from "react";
import { Page, Header, Box, Text, Avatar, List, useNavigate } from "zmp-ui";
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";

const ChatListPage = () => {
  const [chats, setChats] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatPromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
        
        let otherUser = { name: "Người dùng", avatar: "https://i.pravatar.cc/150" };
        if (otherUserId) {
          // Fetch from users
          let userDoc = await getDoc(doc(db, "users", otherUserId));
          if (!userDoc.exists()) {
            userDoc = await getDoc(doc(db, "shops", otherUserId));
          }
          if (userDoc.exists()) {
            const uData = userDoc.data();
            otherUser = {
              name: uData.fullName || uData.name || uData.shopName || "Người dùng",
              avatar: uData.avatar || uData.shopAvatar || "https://i.pravatar.cc/150"
            };
          }
        }
        
        return {
          id: docSnap.id,
          ...data,
          otherUser
        };
      });

      const resolvedChats = await Promise.all(chatPromises);
      
      // Sort in memory to avoid requiring a composite index in Firestore
      resolvedChats.sort((a, b) => {
        const timeA = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : (a.lastMessageTime?.seconds ? a.lastMessageTime.seconds * 1000 : 0);
        const timeB = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : (b.lastMessageTime?.seconds ? b.lastMessageTime.seconds * 1000 : 0);
        return timeB - timeA;
      });

      setChats(resolvedChats);
    }, (error) => {
      console.error("Lỗi tải danh sách chat:", error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Page className="bg-white">
      <Header title="Tin nhắn" showBackIcon={false} />
      <Box className="mt-4 px-4 pb-20">
        <List>
          {chats.map(chat => (
            <List.Item
              key={chat.id}
              onClick={() => navigate(`/chat-detail/${chat.id}`)}
              className="px-0 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <Box className="flex items-center space-x-3 w-full">
                <Avatar src={chat.otherUser.avatar} size={48} className="flex-shrink-0 border border-gray-100 shadow-sm" />
                <Box className="flex-1 min-w-0">
                  <Box className="flex justify-between items-center mb-0.5">
                    <Text className="font-semibold text-[16px] text-gray-800 truncate pr-2">
                      {chat.otherUser.name}
                    </Text>
                    {chat.lastMessageTime && chat.lastMessageTime.toDate && (
                      <Text className="text-[12px] text-gray-400 flex-shrink-0">
                        {new Date(chat.lastMessageTime.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                    )}
                  </Box>
                  <Text className="text-[14px] text-gray-500 truncate">
                    {chat.lastMessage || "Chưa có tin nhắn nào"}
                  </Text>
                </Box>
              </Box>
            </List.Item>
          ))}
          {chats.length === 0 && (
            <Box className="text-center py-10">
              <Text className="text-gray-400 text-sm">Chưa có cuộc trò chuyện nào</Text>
            </Box>
          )}
        </List>
      </Box>
    </Page>
  );
};
export default ChatListPage;
