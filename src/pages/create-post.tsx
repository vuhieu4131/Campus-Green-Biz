import React, { FC, useState } from "react";
import { useSetRecoilState } from "recoil";
import { notificationsState } from "../state";
import { Page, Box, Text, Icon, Avatar, Button, useSnackbar, useNavigate } from "zmp-ui";
import { chooseImage } from "zmp-sdk";
import { auth, db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";

const CreatePostPage: FC = () => {
  const navigate = useNavigate();
  const setNotifications = useSetRecoilState(notificationsState);
  const { openSnackbar } = useSnackbar();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{url: string, file: File}[]>([]);
  const [privacy, setPrivacy] = useState("Công khai");
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [userRole, setUserRole] = useState<string>("user"); // 'user' hoặc 'provider'
  
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        const finalPhone = phoneFromEmail || localPhone;

        if (finalPhone) {
          try {
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);
            if (!shopSnap.empty) {
              setUserRole("provider");
              return;
            }
          } catch (e) {
            console.error(e);
          }
        }
        
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role) {
          setUserRole(docSnap.data().role);
        } else {
          setUserRole("user");
        }
      }
    });
    return unsub;
  }, []);

  const handleCreatePost = async () => {
    if (!currentUser) {
      openSnackbar({ text: "Lỗi: Không tìm thấy tài khoản (Bạn chưa đăng nhập dự án mới)", type: "error" });
      return;
    }

    if (userRole === "provider") {
      if (!productName.trim() || !productPrice.trim() || images.length === 0) {
        openSnackbar({ text: "Vui lòng nhập tên, giá và ảnh sản phẩm!", type: "error" });
        return;
      }
    } else {
      if (!content.trim() && images.length === 0) {
        openSnackbar({ text: "Vui lòng nhập nội dung hoặc hình ảnh!", type: "error" });
        return;
      }
    }

    setIsPosting(true);
    try {
      const uploadedImageUrls: string[] = [];
      for (const img of images) {
        const filename = `${currentUser.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const storageRef = ref(storage, `posts/${currentUser.uid}/${filename}`);
        
        try {
          // Timeout sau 10 giây nếu Firebase Storage bị treo (do chưa bật Storage trên Console)
          const uploadPromise = uploadBytes(storageRef, img.file).then(() => getDownloadURL(storageRef));
          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Storage timeout")), 10000)
          );
          
          const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
          uploadedImageUrls.push(downloadUrl);
        } catch (uploadErr) {
          console.warn("Lỗi upload Storage, dùng Base64 thay thế:", uploadErr);
          // Dự phòng: Lưu chuỗi Base64 trực tiếp vào Firestore
          uploadedImageUrls.push(img.url);
        }
      }

      if (userRole === "provider") {
        await addDoc(collection(db, "products"), {
          shopId: currentUser.uid,
          name: productName.trim(),
          price: Number(productPrice),
          images: uploadedImageUrls,
          status: "active",
          createdAt: serverTimestamp(),
        });
        openSnackbar({ text: "Đã đăng sản phẩm thành công!", type: "success" });
      } else {
        await addDoc(collection(db, "posts"), {
          authorId: currentUser.uid,
          content: content.trim(),
          images: uploadedImageUrls,
          privacy: privacy,
          createdAt: serverTimestamp(),
          likesCount: 0,
          commentsCount: 0
        });

        setNotifications((prev) => [
          {
            id: Date.now(),
            image: "https://stc-zmp.zadn.vn/templates/zaui-coffee/dummy/logo.webp",
            title: "Tạo bài đăng thành công",
            content: "Bài viết của bạn đã được chia sẻ với cộng đồng.",
          },
          ...prev,
        ]);

        openSnackbar({ 
          text: "Đã đăng bài thành công!", 
          prefixIcon: <CustomIcon icon="zi-check-circle-2" className="text-green-500 mr-2" />, 
          icon: false 
        });
      }
      navigate(-1);
    } catch (error) {
      console.error("Lỗi đăng bài/sản phẩm:", error);
      openSnackbar({ text: "Lỗi lưu dữ liệu. Xin thử lại.", type: "error" });
    } finally {
      setIsPosting(false);
    }
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const remainingSlots = 5 - images.length;
      const allowedFiles = newFiles.slice(0, remainingSlots);
      
      const newImages = await Promise.all(allowedFiles.map(file => {
        return new Promise<{url: string, file: File}>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({
              url: event.target?.result as string,
              file: file
            });
          };
          reader.readAsDataURL(file);
        });
      }));
      setImages(prev => [...prev, ...newImages]);
    }
    // Đặt lại value để có thể chọn lại cùng một file nếu cần
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = "inherit"; // Reset height to calculate correctly
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <Page className="bg-white flex flex-col h-screen">
      {/* Custom Header */}
      <Box className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-white shadow-sm z-10">
        <Icon icon="zi-close" className="text-2xl cursor-pointer" onClick={() => navigate(-1)} />
        <Text.Title className="font-bold text-lg text-[#14502e]">{userRole === 'provider' ? 'Tạo sản phẩm' : 'Tạo bài đăng'}</Text.Title>
        <Button 
          size="small" 
          disabled={isPosting || (userRole === 'provider' ? (!productName.trim() || !productPrice.trim() || images.length === 0) : (!content.trim() && images.length === 0))}
          className={`rounded-full px-4 ${(userRole === 'provider' ? (!productName.trim() || !productPrice.trim() || images.length === 0) : (!content.trim() && images.length === 0)) ? 'bg-gray-200 text-gray-400' : 'bg-[#14502e] text-white'}`}
          onClick={handleCreatePost}
        >
          {isPosting ? 'Đang tải...' : 'Đăng'}
        </Button>
      </Box>

      <Box className="flex-1 overflow-y-auto">
        {/* User Info & Privacy */}
        <Box className="flex items-center px-4 py-3 space-x-3">
          <Avatar src={currentUser?.photoURL || "https://i.pravatar.cc/150?img=11"} size={48} className="border-2 border-gray-100" />
          <Box>
            <Text className="font-bold text-[15px]">{currentUser?.email?.split('@')[0] || "Người dùng"}</Text>
            {userRole !== 'provider' && (
              <Box 
                className="flex items-center space-x-1 bg-gray-100 rounded-md px-2 py-0.5 mt-0.5 cursor-pointer w-fit border border-gray-200 active:bg-gray-200 transition"
                onClick={() => setShowPrivacySheet(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <Text size="xxSmall" className="text-gray-600 font-medium">{privacy}</Text>
                <Icon icon="zi-chevron-down" size={12} className="text-gray-600" />
              </Box>
            )}
            {userRole === 'provider' && (
              <Box className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold mt-1 inline-block">Cửa hàng</Box>
            )}
          </Box>
        </Box>

        {/* Input Area */}
        <Box className="px-4 py-2">
          {userRole === 'provider' ? (
            <Box className="space-y-4 mb-4">
              <Box>
                <Text className="font-bold text-gray-700 mb-1">Tên sản phẩm</Text>
                <input 
                  type="text" 
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500" 
                  placeholder="Ví dụ: Cà phê hữu cơ"
                />
              </Box>
              <Box>
                <Text className="font-bold text-gray-700 mb-1">Giá bán (VNĐ)</Text>
                <input 
                  type="number" 
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500" 
                  placeholder="Ví dụ: 50000"
                />
              </Box>
            </Box>
          ) : (
            <textarea
              placeholder="Bạn đang nghĩ gì?"
              value={content}
              onChange={adjustTextareaHeight}
              className="w-full border-none text-[17px] bg-transparent p-0 outline-none resize-none placeholder:text-gray-400 overflow-hidden"
              style={{ minHeight: '120px' }}
              maxLength={2000}
            />
          )}
        </Box>

        {/* Image Preview Grid */}
        {/* Image Preview Grid (Facebook Layout logic reused locally with close button) */}
        {images.length > 0 && (
          <Box className="px-1 py-2">
            <Box className={`w-full h-64 ${images.length > 1 ? 'grid gap-1' : ''} ${images.length === 2 || images.length >= 4 ? 'grid-cols-2' : ''} ${images.length === 3 ? 'grid-cols-2' : ''}`}>
              {images.map((img, idx) => {
                let extraClass = "relative bg-cover bg-center rounded-sm overflow-hidden border border-gray-100";
                if (images.length === 3 && idx === 0) extraClass += " col-span-1 row-span-2 h-full";
                else if (images.length === 3 && idx > 0) extraClass += " h-32";
                else if (images.length >= 4 && idx === 0) extraClass += " col-span-1 row-span-2 h-full";
                else if (images.length >= 4 && idx > 0) extraClass += " h-32";
                else extraClass += " h-full w-full";
                
                // Truncate at 4 images in UI
                if (images.length > 4 && idx >= 4) return null;

                return (
                  <Box key={idx} className={extraClass} style={{ backgroundImage: `url('${img.url}')` }}>
                    <Box 
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 cursor-pointer active:scale-90 transition-transform z-10"
                      onClick={() => removeImage(idx)}
                    >
                      <Icon icon="zi-close" size={14} className="text-white" />
                    </Box>
                    {images.length > 4 && idx === 3 && (
                      <Box className="absolute inset-0 bg-black/50 flex justify-center items-center pointer-events-none">
                        <Text className="text-white text-xl font-bold">+{images.length - 4}</Text>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Action Bar */}
      <Box className="border-t border-gray-100 bg-white pb-safe">
        <Box className="flex items-center justify-between px-4 py-3">
          <Text className="font-medium text-gray-700">Thêm vào bài viết</Text>
          <Box className="flex space-x-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              multiple 
              onChange={onFileChange} 
            />
            <svg onClick={handleChooseImage} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 cursor-pointer active:opacity-70"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 cursor-pointer active:opacity-70"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 cursor-pointer active:opacity-70"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 cursor-pointer active:opacity-70"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          </Box>
        </Box>
      </Box>

      {/* Sheet Quyền riêng tư */}
      <Box 
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity ${showPrivacySheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setShowPrivacySheet(false)}
      >
        <Box 
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-2xl pb-safe transition-transform duration-300 ${showPrivacySheet ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <Box className="p-4 border-b border-gray-100 text-center font-bold relative">
            <Text>Ai có thể xem bài viết này?</Text>
            <Icon icon="zi-close" className="absolute right-4 top-4 text-xl cursor-pointer" onClick={() => setShowPrivacySheet(false)} />
          </Box>
          <Box className="p-2 pb-6">
            <Box className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-100 rounded-xl" onClick={() => { setPrivacy("Công khai"); setShowPrivacySheet(false); }}>
              <Box className="flex items-center space-x-3">
                <Icon icon="zi-earth" className="text-2xl text-gray-500" />
                <Box>
                  <Text className="font-medium text-gray-800">Công khai</Text>
                  <Text size="xSmall" className="text-gray-500">Mọi người trên và ngoài Campus</Text>
                </Box>
              </Box>
              {privacy === "Công khai" && <Icon icon="zi-check-circle-solid" className="text-[#14502e] text-xl" />}
            </Box>
            <Box className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-100 rounded-xl" onClick={() => { setPrivacy("Bạn bè"); setShowPrivacySheet(false); }}>
              <Box className="flex items-center space-x-3">
                <Icon icon="zi-group" className="text-2xl text-gray-500" />
                <Box>
                  <Text className="font-medium text-gray-800">Bạn bè</Text>
                  <Text size="xSmall" className="text-gray-500">Chỉ những người bạn kết bạn</Text>
                </Box>
              </Box>
              {privacy === "Bạn bè" && <Icon icon="zi-check-circle-solid" className="text-[#14502e] text-xl" />}
            </Box>
            <Box className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-100 rounded-xl" onClick={() => { setPrivacy("Chỉ mình tôi"); setShowPrivacySheet(false); }}>
              <Box className="flex items-center space-x-3">
                <Icon icon="zi-lock" className="text-2xl text-gray-500" />
                <Box>
                  <Text className="font-medium text-gray-800">Chỉ mình tôi</Text>
                  <Text size="xSmall" className="text-gray-500">Chỉ có mình bạn được xem</Text>
                </Box>
              </Box>
              {privacy === "Chỉ mình tôi" && <Icon icon="zi-check-circle-solid" className="text-[#14502e] text-xl" />}
            </Box>
          </Box>
        </Box>
      </Box>
    </Page>
  );
};

export default CreatePostPage;
