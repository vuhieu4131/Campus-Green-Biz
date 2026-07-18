import React, { useEffect, useState, useRef } from "react";
import { Page, Header, Box, Text, Avatar, Button, Icon, useSnackbar } from "zmp-ui";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, getDoc, doc, addDoc, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { db, auth } from "../firebase";

const ChatDetailPage = () => {
  const { id: chatId } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [otherUser, setOtherUser] = useState<any>(null);
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!chatId || !currentUser) return;

    // Fetch other user info from chat document
    const fetchOtherUser = async () => {
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
        if (otherUserId) {
          let isShop = false;
          let userDoc = await getDoc(doc(db, "users", otherUserId));
          if (!userDoc.exists()) {
            userDoc = await getDoc(doc(db, "shops", otherUserId));
            isShop = true;
          }
          if (userDoc.exists()) {
            const uData = userDoc.data();
            setOtherUser({
              id: otherUserId,
              isShop,
              name: uData.fullName || uData.name || uData.shopName || "Người dùng",
              avatar: uData.avatar || uData.shopAvatar || "https://i.pravatar.cc/150"
            });
          }
        }
      }
    };
    fetchOtherUser();

    // Subscribe to messages
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      // Reset unread count for current user
      updateDoc(doc(db, "chats", chatId), {
        [`unreadCount.${currentUser.uid}`]: 0
      }).catch(console.error);
    });

    return () => unsubscribe();
  }, [chatId, currentUser]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !chatId) return;
    const text = inputText.trim();
    setInputText("");

    try {
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text,
        senderId: currentUser.uid,
        createdAt: serverTimestamp()
      });

      const updateData: any = {
        lastMessage: text,
        lastMessageTime: serverTimestamp()
      };
      if (otherUser && otherUser.id) {
        updateData[`unreadCount.${otherUser.id}`] = increment(1);
      }
      await updateDoc(doc(db, "chats", chatId), updateData);
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
      openSnackbar({ text: "Gửi tin nhắn thất bại", type: "error" });
    }
  };

  const navigateToProfile = () => {
    if (!otherUser) return;
    if (otherUser.isShop) {
      navigate(`/shop-details/${otherUser.id}`);
    } else {
      navigate(`/profile?id=${otherUser.id}`);
    }
  };

  return (
    <Page className="bg-gray-50 pb-[80px]">
      <Header 
        textColor="white"
        title={
          <Box onClick={navigateToProfile} className="active:opacity-50 transition-opacity">
            {otherUser ? otherUser.name : "Đang tải..."}
          </Box>
        } 
        showBackIcon 
      />
      <Box className="p-4 flex flex-col space-y-3">
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser?.uid;
          return (
            <Box 
              key={msg.id || idx} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end space-x-2`}
            >
              {!isMe && (
                <Avatar src={otherUser?.avatar || "https://i.pravatar.cc/150"} size={28} className="shrink-0" />
              )}
              <Box 
                className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                  isMe ? 'bg-[#14502e] text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
                }`}
              >
                <Text className="text-[15px] leading-relaxed break-words">{msg.text}</Text>
              </Box>
            </Box>
          );
        })}
        <div ref={messagesEndRef} />
      </Box>
      <Box className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 flex items-center space-x-2 z-50 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <Box className="flex-1 bg-gray-100 rounded-full px-4 flex items-center h-10">
          <input 
            type="text" 
            placeholder="Nhập tin nhắn..." 
            className="w-full h-full bg-transparent outline-none text-gray-700 text-[15px]"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
        </Box>
        <Button 
          className="shrink-0 w-10 h-10 rounded-full p-0 flex items-center justify-center transition-colors"
          style={{ backgroundColor: inputText.trim() ? '#14502e' : '#e5e7eb' }}
          onClick={handleSend}
          disabled={!inputText.trim()}
        >
          <Icon icon="zi-send-solid" className={inputText.trim() ? 'text-white' : 'text-gray-400'} size={20} />
        </Button>
      </Box>
    </Page>
  );
};

export default ChatDetailPage;
