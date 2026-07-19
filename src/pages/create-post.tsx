import React, { FC, useState } from "react";
import { useSetRecoilState } from "recoil";
import { notificationsState } from "../state";
import { Page, Box, Text, Icon, Avatar, Button, useSnackbar, useNavigate } from "zmp-ui";
import { chooseImage } from "zmp-sdk";
import { auth, db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc, updateDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { AuthOverlay } from "./auth";

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
  const [dbUserData, setDbUserData] = useState<any>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<{url: string, file: File} | null>(null);

  const avatarUrl = dbUserData?.avatar || dbUserData?.shopAvatar || currentUser?.photoURL || "https://i.pravatar.cc/150?img=11";
  const displayName = dbUserData?.fullName || dbUserData?.name || dbUserData?.shopName || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Người dùng";

  const [attachedProduct, setAttachedProduct] = useState<any>(null);
  const [showProductSheet, setShowProductSheet] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState("");

  const [showEmojiSheet, setShowEmojiSheet] = useState(false);
  const emojis = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😝", "😜", "🤪", "😎", "🤩", "🥳", "😏", "😒", "😔", "😢", "😭", "😤", "😠", "😡", "🤯", "😳", "🥵", "🥶", "😱", "😴", "😈", "💩", "👻", "👍", "👎", "👏", "🙌", "🙏", "❤️", "🔥", "✨", "🎉", "🌟", "☘️", "🌿"];

  const [location, setLocation] = useState("");
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState("");
  const campusLocations = ["Thư viện trung tâm", "Căng tin Khu B", "Ký túc xá khu A", "Nhà thi đấu thể thao", "Hội trường lớn", "Sân bóng cỏ nhân tạo", "Vườn hoa Green Campus"];

  React.useEffect(() => {
    if (showProductSheet) {
      const fetchProducts = async () => {
        try {
          const snap = await getDocs(collection(db, "services"));
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAllProducts(list);
        } catch (e) {
          console.error("Lỗi tải sản phẩm:", e);
        }
      };
      fetchProducts();
    }
  }, [showProductSheet]);

  const handleSelectLocation = (loc: string) => {
    setLocation(loc);
    setShowLocationSheet(false);
  };

  const handleSelectEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  const handleChooseVideo = () => {
    videoInputRef.current?.click();
  };

  const onVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 50 * 1024 * 1024) {
        openSnackbar({ text: "Dung lượng video vượt quá 50MB, vui lòng chọn video nhỏ hơn!", type: "error" });
        return;
      }
      const url = URL.createObjectURL(file);
      setVideo({ url, file });
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user || user.email === "guest@campus.com") {
        openSnackbar({ text: "Vui lòng đăng nhập để tạo bài đăng!", type: "warning" });
        navigate(-1);
        return;
      }

      const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
      const localPhone = localStorage.getItem("user_phone");
      const finalPhone = phoneFromEmail || localPhone;

      let isShop = false;
      if (finalPhone) {
        try {
          const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
          const shopSnap = await getDocs(qShop);
          if (!shopSnap.empty) {
            setUserRole("provider");
            setDbUserData(shopSnap.docs[0].data());
            isShop = true;
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      if (!isShop) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setDbUserData(data);
            if (data.role) {
              setUserRole(data.role);
            } else {
              setUserRole("user");
            }
          } else {
            setUserRole("user");
          }
        } catch (e) {
          console.error(e);
          setUserRole("user");
        }
      }
    });
    return unsub;
  }, []);

  const handleCreatePost = async () => {
    if (!currentUser || currentUser.email === "guest@campus.com") {
      openSnackbar({ text: "Lỗi: Không tìm thấy tài khoản (Bạn chưa đăng nhập dự án mới)", type: "error" });
      return;
    }

    if (!content.trim() && images.length === 0 && !video) {
      openSnackbar({ text: "Vui lòng nhập nội dung, chọn hình ảnh hoặc video!", type: "error" });
      return;
    }

    setIsPosting(true);
    try {
      let uploadedVideoUrl = "";
      if (video) {
        const filename = `${currentUser.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
        const storageRef = ref(storage, `posts/${currentUser.uid}/${filename}`);
        try {
          const uploadPromise = uploadBytes(storageRef, video.file).then(() => getDownloadURL(storageRef));
          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Video upload timeout")), 20000)
          );
          uploadedVideoUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch (uploadErr) {
          console.error("Lỗi upload video:", uploadErr);
          openSnackbar({ text: "Tải video lên thất bại. Vui lòng kích hoạt/kiểm tra cấu hình Firebase Storage và thử lại!", type: "error" });
          setIsPosting(false);
          return;
        }
      }

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
        // 1. Khai báo và lấy thông tin người dùng an toàn trước khi lưu vào cơ sở dữ liệu
        const authorName = displayName;
        const authorAvatar = avatarUrl;
        // 2. Thực hiện lưu dữ liệu (giữ nguyên cấu trúc của bạn)
        const postRef = await addDoc(collection(db, "posts"), {
          authorId: currentUser.uid,
          authorName: authorName,
          authorAvatar: authorAvatar,
          content: content.trim(),
          images: uploadedImageUrls,
          videoUrl: uploadedVideoUrl || null,
          privacy: privacy,
          createdAt: serverTimestamp(),
          likesCount: 0,
          likedBy: [],
          commentsCount: 0,
          status: "pending",
          location: location || null,
          attachedProduct: attachedProduct ? {
            id: attachedProduct.id,
            name: attachedProduct.name || attachedProduct.title || "",
            price: attachedProduct.price || 0,
            image: attachedProduct.image || attachedProduct.images?.[0] || ""
          } : null
        });

        // 👉 Cộng điểm uy tín (+10) cho người đăng bài viết mới
        try {
          let accountRef = doc(db, "users", currentUser.uid);
          let accountSnap = await getDoc(accountRef);
          
          if (!accountSnap.exists()) {
            accountRef = doc(db, "shops", currentUser.uid);
            accountSnap = await getDoc(accountRef);
          }
          
          if (accountSnap.exists()) {
            await updateDoc(accountRef, {
              reputationPoints: increment(10)
            });
            await addDoc(collection(db, "point_transactions"), {
              userId: currentUser.uid,
              type: "plus",
              amount: 10,
              description: "Thưởng uy tín: Đăng bài viết mới",
              walletType: "reputation",
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Lỗi cộng điểm uy tín đăng bài:", err);
        }
 
        openSnackbar({ text: "Bài đăng của bạn đã được gửi xét duyệt", type: "success" });
        navigate("/profile");
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
      <Box 
        className="flex justify-between items-center px-4 pb-3 border-b border-gray-100 bg-white shadow-sm z-10"
        style={{ paddingTop: "calc(var(--zaui-safe-area-inset-top, 24px) + 8px)" }}
      >
        <Box 
          className="cursor-pointer flex items-center justify-start w-10 h-10" 
          onClick={() => navigate(-1)}
        >
          <Icon icon="zi-close" className="text-2xl text-gray-700" />
        </Box>
        <Text.Title className="font-bold text-lg text-[#14502e] flex-1 text-center">Tạo bài đăng</Text.Title>
        <Box className="w-10" />
      </Box>

      <Box className="flex-1 overflow-y-auto">
        {/* User Info & Privacy */}
        <Box className="flex items-center px-4 py-3 space-x-3">
          <Avatar src={avatarUrl} size={48} className="border-2 border-gray-100 object-cover" />
          <Box>
            <Text className="font-bold text-[15px]">
              {displayName}
              {location && (
                <span className="text-gray-500 text-xs font-normal ml-1">
                  — đang ở <span className="font-semibold text-gray-700">{location}</span>
                  <span className="text-red-500 ml-1 cursor-pointer hover:underline text-[10px]" onClick={() => setLocation("")}> (Xóa)</span>
                </span>
              )}
            </Text>
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
            <textarea
              placeholder="Bạn đang nghĩ gì?"
              value={content}
              onChange={adjustTextareaHeight}
              className="w-full border-none text-[17px] bg-transparent p-0 outline-none resize-none placeholder:text-gray-400 overflow-hidden"
              style={{ minHeight: '120px' }}
              maxLength={2000}
            />
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
        {/* Video Preview */}
        {video && (
          <Box className="px-4 py-2 relative">
            <Box className="relative rounded-lg overflow-hidden border border-gray-100 bg-black max-h-64 flex justify-center items-center">
              <video 
                src={video.url} 
                controls 
                className="max-h-64 w-full object-contain" 
              />
              <Box 
                className="absolute top-2 right-2 bg-black/60 rounded-full p-1 cursor-pointer active:scale-90 transition-transform z-10"
                onClick={() => {
                  URL.revokeObjectURL(video.url);
                  setVideo(null);
                }}
              >
                <Icon icon="zi-close" size={14} className="text-white" />
              </Box>
            </Box>
          </Box>
        )}

        {/* Attached Product Preview */}
        {attachedProduct && (
          <Box className="mx-4 my-2 bg-gray-50 border border-gray-200/60 rounded-xl p-3 flex items-center justify-between">
            <Box className="flex items-center space-x-3 flex-1 min-w-0">
              {(attachedProduct.image || attachedProduct.images?.[0]) && (
                <img 
                  src={attachedProduct.image || attachedProduct.images?.[0]} 
                  alt={attachedProduct.name || attachedProduct.title} 
                  className="w-12 h-12 object-cover rounded-lg border border-gray-200" 
                />
              )}
              <Box className="flex-1 min-w-0">
                <Text className="font-semibold text-gray-800 text-[13px] truncate">
                  {attachedProduct.name || attachedProduct.title}
                </Text>
                <Text className="text-red-600 text-xs font-bold mt-0.5">
                  {Number(attachedProduct.price || 0).toLocaleString('vi-VN')}đ
                </Text>
              </Box>
            </Box>
            <Box 
              className="bg-gray-200/60 hover:bg-gray-200 active:scale-95 text-gray-600 p-1.5 rounded-full cursor-pointer ml-3 transition"
              onClick={() => setAttachedProduct(null)}
            >
              <Icon icon="zi-close" size={14} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Action Bar */}
      <Box className="border-t border-gray-100 bg-white pb-safe px-4 py-3 flex flex-col space-y-3">
        <Box className="flex items-center justify-between">
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
            <input 
              type="file" 
              ref={videoInputRef} 
              style={{ display: 'none' }} 
              accept="video/*" 
              onChange={onVideoChange} 
            />
            <svg onClick={handleChooseImage} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 cursor-pointer active:opacity-70"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <svg onClick={handleChooseVideo} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500 cursor-pointer active:opacity-70"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            <svg onClick={() => setShowProductSheet(true)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 cursor-pointer active:opacity-70"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <svg onClick={() => setShowLocationSheet(true)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 cursor-pointer active:opacity-70"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <svg onClick={() => setShowEmojiSheet(true)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 cursor-pointer active:opacity-70"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          </Box>
        </Box>
        <Button 
          fullWidth
          disabled={isPosting || (!content.trim() && images.length === 0 && !video)}
          className={`rounded-full h-11 font-bold text-base flex items-center justify-center ${(!content.trim() && images.length === 0 && !video) ? 'bg-gray-100 text-gray-400' : 'bg-[#14502e] text-white'}`}
          onClick={handleCreatePost}
        >
          {isPosting ? 'Đang tải...' : 'Đăng'}
        </Button>
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
            {/* @ts-ignore */}
<Icon icon="zi-close" className="absolute right-4 top-4 text-xl cursor-pointer" onClick={() => setShowPrivacySheet(false)} />
          </Box>
          <Box className="p-2 pb-6">
            <Box className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-100 rounded-xl" onClick={() => { setPrivacy("Công khai"); setShowPrivacySheet(false); }}>
              <Box className="flex items-center space-x-3">
                <Icon icon={"zi-earth" as any} className="text-2xl text-gray-500" />
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

      {/* Sheet Gắn sản phẩm */}
      <Box 
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity ${showProductSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setShowProductSheet(false)}
      >
        <Box 
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-2xl pb-safe transition-transform duration-300 flex flex-col h-[70vh] ${showProductSheet ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <Box className="p-4 border-b border-gray-100 text-center font-bold relative shrink-0">
            <Text>Gắn link sản phẩm</Text>
            {/* @ts-ignore */}
            <Icon icon="zi-close" className="absolute right-4 top-4 text-xl cursor-pointer" onClick={() => setShowProductSheet(false)} />
          </Box>
          
          <Box className="p-3 shrink-0">
            <Box className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200/30">
              <Icon icon="zi-search" className="text-gray-400 text-lg" />
              <input 
                type="text" 
                placeholder="Tìm kiếm sản phẩm..." 
                value={searchProductQuery}
                onChange={e => setSearchProductQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400"
              />
            </Box>
          </Box>

          <Box className="flex-1 overflow-y-auto px-4 pb-6">
            {allProducts.filter(p => String(p.title || p.name || "").toLowerCase().includes(searchProductQuery.toLowerCase())).length === 0 ? (
              <Box className="flex justify-center items-center py-10">
                <Text className="text-gray-400 text-sm">Không tìm thấy sản phẩm nào</Text>
              </Box>
            ) : (
              allProducts.filter(p => String(p.title || p.name || "").toLowerCase().includes(searchProductQuery.toLowerCase())).map((p: any) => {
                const img = p.image || p.images?.[0] || "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png";
                return (
                  <Box 
                    key={p.id} 
                    className="flex items-center space-x-3 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50 transition"
                    onClick={() => {
                      setAttachedProduct(p);
                      setShowProductSheet(false);
                    }}
                  >
                    <img src={img} alt={p.name || p.title} className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                    <Box className="flex-1 min-w-0">
                      <Text className="font-semibold text-gray-800 text-sm truncate">{p.name || p.title}</Text>
                      <Text className="text-red-600 text-xs font-bold mt-0.5">{Number(p.price || 0).toLocaleString('vi-VN')}đ</Text>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* Sheet Chọn vị trí */}
      <Box 
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity ${showLocationSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setShowLocationSheet(false)}
      >
        <Box 
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-2xl pb-safe transition-transform duration-300 flex flex-col max-h-[60vh] ${showLocationSheet ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <Box className="p-4 border-b border-gray-100 text-center font-bold relative shrink-0">
            <Text>Bạn đang ở đâu?</Text>
            {/* @ts-ignore */}
            <Icon icon="zi-close" className="absolute right-4 top-4 text-xl cursor-pointer" onClick={() => setShowLocationSheet(false)} />
          </Box>
          
          <Box className="p-3 shrink-0 flex space-x-2">
            <Box className="flex-1 flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200/30">
              <Icon icon="zi-location" className="text-red-500 text-lg" />
              <input 
                type="text" 
                placeholder="Nhập vị trí khác..." 
                value={customLocationInput}
                onChange={e => setCustomLocationInput(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-gray-400"
              />
            </Box>
            <Button 
              size="small" 
              className="bg-[#14502e] text-white rounded-full px-4 shrink-0 font-medium"
              onClick={() => {
                if (customLocationInput.trim()) {
                  handleSelectLocation(customLocationInput.trim());
                  setCustomLocationInput("");
                }
              }}
            >
              Áp dụng
            </Button>
          </Box>

          <Box className="flex-1 overflow-y-auto px-4 pb-6">
            <Text className="text-gray-400 text-xs font-bold mb-2 uppercase px-1">Gợi ý địa điểm trong Campus</Text>
            {campusLocations.map((loc, idx) => (
              <Box 
                key={idx} 
                className="flex items-center justify-between py-3.5 border-b border-gray-100 cursor-pointer active:bg-gray-50 transition px-1"
                onClick={() => handleSelectLocation(loc)}
              >
                <Box className="flex items-center space-x-3">
                  <Icon icon="zi-location" className="text-gray-500 text-lg" />
                  <Text className="text-gray-700 text-sm font-medium">{loc}</Text>
                </Box>
                {location === loc && <Icon icon="zi-check-circle-solid" className="text-[#14502e] text-lg" />}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Sheet Chọn Emoji */}
      <Box 
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity ${showEmojiSheet ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setShowEmojiSheet(false)}
      >
        <Box 
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-2xl pb-safe transition-transform duration-300 flex flex-col h-[40vh] ${showEmojiSheet ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <Box className="p-4 border-b border-gray-100 text-center font-bold relative shrink-0">
            <Text>Chọn cảm xúc (Emoji)</Text>
            {/* @ts-ignore */}
            <Icon icon="zi-close" className="absolute right-4 top-4 text-xl cursor-pointer" onClick={() => setShowEmojiSheet(false)} />
          </Box>
          <Box className="flex-1 overflow-y-auto p-4 pb-8 grid grid-cols-8 gap-3 justify-items-center">
            {emojis.map((emoji, idx) => (
              <span 
                key={idx} 
                className="text-3xl cursor-pointer active:scale-75 transition-transform hover:bg-gray-100 p-1.5 rounded-xl flex items-center justify-center w-12 h-12"
                onClick={() => handleSelectEmoji(emoji)}
              >
                {emoji}
              </span>
            ))}
          </Box>
        </Box>
      </Box>
    </Page>
  );
};

export default CreatePostPage;
