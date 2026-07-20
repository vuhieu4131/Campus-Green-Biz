import React, { FC, useState, useEffect, startTransition } from "react";
import { getDefaultAvatar } from "../utils/avatar";
import {
  Box,
  Header,
  Icon,
  Page,
  Text,
  Avatar,
  Button,
  useNavigate,
  Tabs,
  Sheet,
  useSnackbar,
  Modal,
  Spinner,
} from "zmp-ui";
import { useLocation } from "react-router-dom";
import subscriptionDecor from "static/subscription-decor.svg";
import { AuthOverlay } from "./auth";
import CustomIcon from "../components/custom-icon";

// IMPORT CÔNG CỤ FIREBASE
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { PostItem } from "../components/post-item";
import { RawPost } from "../utils/edgeRanker";
import { ProviderView } from "../components/profile-modules/provider-view";
import { AdminView } from "../components/profile-modules/admin-view";

class ErrorBoundary extends React.Component<
  any,
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={4} className="bg-red-50 text-red-600 mt-10 rounded-xl m-4">
          <Text.Title className="text-red-600 font-bold">
            Lỗi Giao Diện
          </Text.Title>
          <Text className="mt-2">{this.state.error?.toString()}</Text>
          <Text className="mt-2 text-xs opacity-70">
            Vui lòng chụp màn hình lỗi này gửi cho AI.
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

// --- COMPONENT CHƯA ĐĂNG NHẬP (LỜI MỜI) ---
const Subscription: FC<{ onOpenAuth: () => void }> = ({ onOpenAuth }) => {
  return (
    <Box className="m-4" onClick={onOpenAuth}>
      <Box
        className="bg-green text-white rounded-xl p-4 space-y-2"
        style={{
          backgroundImage: `url(${subscriptionDecor})`,
          backgroundPosition: "right 8px center",
          backgroundRepeat: "no-repeat",
          cursor: "pointer",
        }}
      >
        <Text.Title className="font-bold">Đăng ký / Đăng nhập</Text.Title>
        <Text size="xxSmall">
          Tạo tài khoản để nhận ưu đãi và quản lý đơn hàng
        </Text>
      </Box>
    </Box>
  );
};

// --- CÁC KHỐI GIAO DIỆN KHI ĐÃ ĐĂNG NHẬP ---

// --- COMPONENT MỚI CHO GIAO DIỆN PROFILE ---
const calculateMemberRankInfo = (points: number) => {
  const p = points || 0;
  if (p < 100) return { name: "Thành viên mới", sub: "NEW MEMBER", color: "bg-gray-50 text-gray-600 border-gray-200", icon: "zi-star", target: 100 };
  if (p < 500) return { name: "Hạng Đồng", sub: "KHÁCH HÀNG THÂN THIẾT", color: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]", icon: "zi-shield-solid", target: 500 };
  if (p < 1000) return { name: "Hạng Bạc", sub: "SILVER STATUS", color: "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]", icon: "zi-heart-solid", target: 1000 };
  if (p < 2000) return { name: "Hạng Vàng", sub: "ELITE STATUS", color: "bg-[#fffdf5] text-[#ca8a04] border-[#fef08a]", icon: "zi-diamond", target: 2000 };
  return { name: "Hạng Kim Cương", sub: "DIAMOND STATUS", color: "bg-[#faf5ff] text-[#9333ea] border-[#e9d5ff]", icon: "zi-diamond-solid", target: 999999 };
};

const handleChat = async (currentUser: any, targetUserId: string, navigate: any, openSnackbar: any) => {
  if (!currentUser || currentUser.email === "guest@campus.com") {
    openSnackbar({ text: "Vui lòng đăng nhập để nhắn tin", type: "warning" });
    return;
  }
  try {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );
    const snap = await getDocs(q);
    let existingChatId: string | null = null;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.participants.includes(targetUserId)) {
        existingChatId = docSnap.id;
      }
    });

    if (existingChatId) {
      navigate(`/chat-detail/${existingChatId}`);
    } else {
      const newChat = await addDoc(collection(db, "chats"), {
        participants: [currentUser.uid, targetUserId],
        lastMessage: "",
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      navigate(`/chat-detail/${newChat.id}`);
    }
  } catch (error) {
    console.error("Lỗi khi tạo chat:", error);
    openSnackbar({ text: "Không thể mở đoạn chat", type: "error" });
  }
};

const calculateShopRankInfo = (points: number) => {
  const p = points || 0;
  if (p < 300) return { name: "Thạch Anh", color: "bg-gray-100 text-gray-600 border-gray-200", icon: "zi-star" };
  if (p < 1000) return { name: "Ngọc Bích", color: "bg-green-100 text-green-700 border-green-200", icon: "zi-shield-solid" };
  if (p < 2000) return { name: "Hồng Ngọc", color: "bg-red-100 text-red-600 border-red-200", icon: "zi-heart-solid" };
  if (p < 5000) return { name: "Lam Ngọc", color: "bg-blue-100 text-blue-600 border-blue-200", icon: "zi-diamond" };
  return { name: "Kim Cương", color: "bg-purple-100 text-purple-600 border-purple-200", icon: "zi-diamond-solid" };
};

const NewMemberView: FC<{ 
  user: any; 
  points: number; 
  rankPoints?: number;
  role?: string; 
  isOtherProfile?: boolean;
  followers?: string[];
  currentUserId?: string;
  onFollowToggle?: () => void;
  onUpdateImage?: (field: "avatar" | "cover", file: File) => void;
  onOpenProviderDashboard?: () => void;
}> = ({ user, points, rankPoints = 0, role, isOtherProfile, followers = [], currentUserId, onFollowToggle, onUpdateImage, onOpenProviderDashboard }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'shared'>('posts');
  const rankInfo = calculateMemberRankInfo(rankPoints || points);
  

  
  const [showFollowingOptions, setShowFollowingOptions] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [followingCount, setFollowingCount] = useState(0);

  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleShowFollowers = async () => {
    if (followers.length === 0) return;
    setShowFollowers(true);
    setLoadingStats(true);
    try {
      const matched: any[] = [];
      const chunks = [];
      for (let i = 0; i < followers.length; i += 10) {
        chunks.push(followers.slice(i, i + 10));
      }
      
      for (const chunk of chunks) {
        // Unfortunately, Firestore doesn't allow 'in' query on document ID easily without using documentId() which is imported separately. 
        // We will just fetch the specific docs by ID directly to be safe and robust.
        const userPromises = chunk.map(id => getDoc(doc(db, "users", id)));
        const shopPromises = chunk.map(id => getDoc(doc(db, "shops", id)));
        
        const [uDocs, sDocs] = await Promise.all([
          Promise.all(userPromises),
          Promise.all(shopPromises)
        ]);
        
        uDocs.forEach(d => { if (d.exists()) matched.push({ id: d.id, ...d.data(), type: 'user' }) });
        sDocs.forEach(d => { if (d.exists()) matched.push({ id: d.id, ...d.data(), type: 'shop' }) });
      }
      
      setFollowersList(matched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleShowFollowing = async () => {
    if (followingCount === 0) return;
    setShowFollowing(true);
    setLoadingStats(true);
    try {
      const [uSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("followers", "array-contains", user.id))),
        getDocs(query(collection(db, "shops"), where("followers", "array-contains", user.id)))
      ]);
      const users = uSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'user' }));
      const shops = sSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'shop' }));
      setFollowingList([...users, ...shops]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    const fetchFollowingCount = async () => {
      if (!user?.id) return;
      try {
        const usersQ = query(
          collection(db, "users"),
          where("followers", "array-contains", user.id)
        );
        const usersSnap = await getDocs(usersQ);
        
        const shopsQ = query(
          collection(db, "shops"),
          where("followers", "array-contains", user.id)
        );
        const shopsSnap = await getDocs(shopsQ);
        
        setFollowingCount(usersSnap.size + shopsSnap.size);
      } catch (error) {
        console.error("Lỗi lấy số lượng đang theo dõi:", error);
      }
    };
    fetchFollowingCount();
  }, [user?.id, followers]);

  const isFollowing = currentUserId ? followers.includes(currentUserId) : false;

  const [posts, setPosts] = useState<RawPost[]>([]);
  const [linkedPosts, setLinkedPosts] = useState<RawPost[]>([]);
  const [sharedPosts, setSharedPosts] = useState<RawPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // States for Image Actions
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetTarget, setActionSheetTarget] = useState<'avatar' | 'cover' | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageAction = (target: 'avatar' | 'cover') => {
    setActionSheetTarget(target);
    setActionSheetVisible(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && actionSheetTarget && onUpdateImage) {
      onUpdateImage(actionSheetTarget, e.target.files[0]);
    }
  };

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoadingPosts(true);
        if (role === "provider") {
          // 1. Lấy danh sách bài đăng của chính shop
          const ownPostsQ = query(
            collection(db, "posts"), 
            where("authorId", "==", user.id)
          );
          const ownSnapshot = await getDocs(ownPostsQ);
          const ownPosts = ownSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RawPost[];
          
          // Sắp xếp bài viết của shop: Ghim lên đầu, sau đó mới nhất lên đầu
          ownPosts.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;

            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return timeB - timeA;
          });
          setPosts(ownPosts);

          // 2. Lấy danh sách ID sản phẩm thuộc về shop này
          const shopProductIds = new Set<string>();
          if (user.phone) {
            const q1 = query(collection(db, "services"), where("providerId", "==", user.phone));
            const q2 = query(collection(db, "services"), where("ownerPhone", "==", user.phone));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            snap1.forEach(doc => shopProductIds.add(doc.id));
            snap2.forEach(doc => shopProductIds.add(doc.id));
          }
          const q3 = query(collection(db, "services"), where("shopId", "==", user.id));
          const snap3 = await getDocs(q3);
          snap3.forEach(doc => shopProductIds.add(doc.id));

          // 3. Lấy toàn bộ bài viết trong hệ thống để lọc bài viết gắn link và bài chia sẻ
          const allPostsQ = query(collection(db, "posts"));
          const allSnapshot = await getDocs(allPostsQ);
          const allPosts = allSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RawPost[];

          // Lọc bài viết gắn link: bài viết của bất kỳ ai có gắn sản phẩm của shop, HOẶC bài viết do chính shop đăng có gắn sản phẩm
          const shopLinked = allPosts.filter(post => {
            if (!post.attachedProduct) return false;
            
            const isProductOfThisShop = shopProductIds.has(post.attachedProduct.id);
            const isAuthoredByThisShop = post.authorId === user.id;
            
            if (!isProductOfThisShop && !isAuthoredByThisShop) return false;
            if (post.sharedFrom) return false;
            
            // Chỉ hiển thị bài viết được duyệt (hoặc đang chờ duyệt nếu là chính shop xem)
            if (post.status !== "approved" && post.authorId !== currentUserId) return false;
            return true;
          });
          shopLinked.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return timeB - timeA;
          });
          setLinkedPosts(shopLinked);

          // Lọc bài viết chia sẻ: bài viết do chính shop chia sẻ, HOẶC bài viết của bất kỳ ai chia sẻ lại bài viết gốc của shop
          const ownPostIds = new Set(ownPosts.map(p => p.id));
          const shopShared = allPosts.filter(post => {
            if (!post.sharedFrom) return false;
            
            const isSharedByThisShop = post.authorId === user.id;
            const isSharingThisShopsPost = ownPostIds.has(post.sharedFrom);
            
            if (!isSharedByThisShop && !isSharingThisShopsPost) return false;
            
            // Chỉ hiển thị bài viết được duyệt (hoặc đang chờ duyệt nếu là chính shop xem)
            if (post.status !== "approved" && post.authorId !== currentUserId) return false;
            return true;
          });
          shopShared.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return timeB - timeA;
          });
          setSharedPosts(shopShared);

        } else {
          // Luồng tiêu chuẩn cho User bình thường: Chỉ hiển thị bài viết, bài gắn link, bài chia sẻ của chính họ
          const q = query(
            collection(db, "posts"), 
            where("authorId", "==", user.id)
          );
          const snapshot = await getDocs(q);
          const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RawPost[];
          
          fetchedPosts.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;

            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return timeB - timeA;
          });
          setPosts(fetchedPosts);
          setLinkedPosts(fetchedPosts.filter(post => !!post.attachedProduct && !post.sharedFrom));
          setSharedPosts(fetchedPosts.filter(post => !!post.sharedFrom));
        }
      } catch (error) {
        console.error("Lỗi lấy bài viết:", error);
      } finally {
        setLoadingPosts(false);
      }
    };
    if (user?.id) fetchPosts();
  }, [user.id, role, user.phone, currentUserId]);

  return (
    <Box className="min-h-screen pb-10 relative">
      {/* 1. Header nổi trên Ảnh Bìa */}
      <Box 
        className="absolute top-0 left-0 w-full flex justify-between items-center px-4 py-3 z-10"
        style={{ paddingTop: "calc(var(--zaui-safe-area-inset-top, 24px) + 8px)" }}
      >
        {isOtherProfile ? (
          <Box className="bg-black/20 p-2 rounded-full backdrop-blur-sm cursor-pointer" onClick={() => navigate(-1)}>
            <span className="text-white inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></span>
          </Box>
        ) : <div />}
      </Box>

      {/* 2. Ảnh Bìa (Cover Image) */}
      <Box
        className="w-full h-56 bg-cover bg-center cursor-pointer relative"
        style={{
          backgroundImage: `url('${user.cover || (role === "provider" ? "https://firebasestorage.googleapis.com/v0/b/campusbizproject.firebasestorage.app/o/banners%2F000_Banner_2.jpg?alt=media&token=b4125322-a3e2-40e0-91be-25debde54a52" : "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&fit=crop")}')`,
        }}
        onClick={() => !isOtherProfile ? handleImageAction('cover') : setViewImage(user.cover || (role === "provider" ? "https://firebasestorage.googleapis.com/v0/b/campusbizproject.firebasestorage.app/o/banners%2F000_Banner_2.jpg?alt=media&token=b4125322-a3e2-40e0-91be-25debde54a52" : "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&fit=crop"))}
      >
        {!isOtherProfile && (
          <Box 
            className="absolute bottom-3 right-4 bg-black/40 p-2 rounded-full backdrop-blur-sm cursor-pointer hover:bg-black/60 transition-colors z-10 flex items-center justify-center border border-white/20 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (role === "distributor") {
                navigate("/admin-dashboard");
              } else if (role === "provider") {
                if (onOpenProviderDashboard) onOpenProviderDashboard();
              } else {
                navigate('/settings');
              }
            }}
          >
            <span className="text-white inline-flex">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </span>
          </Box>
        )}
      </Box>

      {/* 3. Thông tin User & Avatar */}
      <Box className="px-4 relative mb-2 flex flex-col items-center">
        <Box className="flex flex-col items-center w-full">
          <Box 
            className="absolute -top-12 left-1/2 -translate-x-1/2 rounded-full border-4 border-white cursor-pointer"
            onClick={() => !isOtherProfile ? handleImageAction('avatar') : setViewImage(user.avatar || getDefaultAvatar(user.id))}
          >
            <Avatar src={user.avatar || getDefaultAvatar(user.id)} size={80} />
            {!isOtherProfile && (
              <Box className="absolute bottom-0 right-0 bg-[#14502e] text-white w-6 h-6 rounded-full flex items-center justify-center border border-white">
                <Icon icon="zi-camera" size={12} />
              </Box>
            )}
          </Box>
          <Box className="pt-12 flex flex-col gap-1 items-center w-full">
            <Box className="flex items-center gap-2 flex-wrap justify-center">
              <Text.Title className="text-xl font-bold leading-none text-center">{user.name}</Text.Title>
              {role === "provider" ? (
                <Box className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-xs ${calculateShopRankInfo(rankPoints).color}`}>
                  <CustomIcon icon={calculateShopRankInfo(rankPoints).icon as any} size={10} className="mr-1 inline-flex" />
                  <span>{calculateShopRankInfo(rankPoints).name} Shop</span>
                </Box>
              ) : (
                <Box className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-xs ${calculateMemberRankInfo(rankPoints || points).color}`}>
                  <CustomIcon icon={calculateMemberRankInfo(rankPoints || points).icon as any} size={10} className="mr-1 inline-flex" />
                  <span>{calculateMemberRankInfo(rankPoints || points).name}</span>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
        {isOtherProfile && (
          <Box className="flex items-center space-x-2 shrink-0 mt-3 justify-center w-full">
            <Button 
              className="rounded-full font-medium shadow-sm px-4 h-8 text-sm flex items-center justify-center"
              style={{ 
                backgroundColor: isFollowing ? "#f3f4f6" : "#14502e", 
                color: isFollowing ? "#374151" : "white",
                border: isFollowing ? "1px solid #e5e7eb" : "none"
              }}
              onClick={() => {
                if (isFollowing) {
                  setShowFollowingOptions(true);
                } else {
                  if (onFollowToggle) onFollowToggle();
                }
              }}
            >
              {isFollowing ? (
                <Box className="flex items-center">
                  Đang theo dõi
                  <span className="ml-1 inline-flex"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
                </Box>
              ) : "Theo dõi"}
            </Button>
            <Button 
              className="rounded-full font-medium shadow-sm px-4 h-8 text-sm flex items-center justify-center bg-[#0068ff] text-white"
              onClick={() => handleChat(auth.currentUser, user.id, navigate, openSnackbar)}
            >
              Nhắn tin
            </Button>
          </Box>
        )}
      </Box>



      {/* 5. Thống kê */}
      <Box className="flex justify-around mt-6 mb-4 px-4">
        <Box className="text-center cursor-pointer active:opacity-70" onClick={() => setActiveTab('posts')}>
          <Text.Title className="font-bold text-lg">
            {posts.filter(post => !post.attachedProduct).length + linkedPosts.length + sharedPosts.length}
          </Text.Title>
          <Text size="small" className="text-gray-600">
            bài viết
          </Text>
        </Box>
        <Box className="text-center cursor-pointer active:opacity-70" onClick={handleShowFollowers}>
          <Text.Title className="font-bold text-lg">{followers.length}</Text.Title>
          <Text size="small" className="text-gray-600">
            người theo dõi
          </Text>
        </Box>
        <Box className="text-center cursor-pointer active:opacity-70" onClick={handleShowFollowing}>
          <Text.Title className="font-bold text-lg">{followingCount}</Text.Title>
          <Text size="small" className="text-gray-600">
            đang theo dõi
          </Text>
        </Box>
      </Box>

      {/* 6. Tabs */}
      <Box className="flex border-t border-b border-gray-100 mb-1 bg-transparent">
        <Box
          className={`flex-1 flex justify-center py-3 cursor-pointer ${activeTab === 'posts' ? 'border-b-2' : ''}`}
          style={{ borderColor: activeTab === 'posts' ? "#14502e" : "transparent" }}
          onClick={() => setActiveTab('posts')}
        >
          <Box className="flex items-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={activeTab === 'posts' ? "#14502e" : "#9ca3af"}
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="3" y="3" width="8" height="8" rx="1" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
            <span className={`ml-1.5 text-xs font-medium ${activeTab === 'posts' ? 'text-[#14502e]' : 'text-gray-400'}`}>
              ({posts.filter(post => !post.attachedProduct).length})
            </span>
          </Box>
        </Box>
        <Box 
          className={`flex-1 flex justify-center py-3 cursor-pointer ${activeTab === 'saved' ? 'border-b-2 text-[#14502e]' : 'text-gray-400'}`}
          style={{ borderColor: activeTab === 'saved' ? "#14502e" : "transparent" }}
          onClick={() => setActiveTab('saved')}
        >
          <Box className="flex items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span className={`ml-1.5 text-xs font-medium ${activeTab === 'saved' ? 'text-[#14502e]' : 'text-gray-400'}`}>
              ({linkedPosts.length})
            </span>
          </Box>
        </Box>
        <Box 
          className={`flex-1 flex justify-center py-3 cursor-pointer ${activeTab === 'shared' ? 'border-b-2 text-[#14502e]' : 'text-gray-400'}`}
          style={{ borderColor: activeTab === 'shared' ? "#14502e" : "transparent" }}
          onClick={() => setActiveTab('shared')}
        >
          <Box className="flex items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            <span className={`ml-1.5 text-xs font-medium ${activeTab === 'shared' ? 'text-[#14502e]' : 'text-gray-400'}`}>
              ({sharedPosts.length})
            </span>
          </Box>
        </Box>
      </Box>

      {/* 7. Nội dung Tab */}
      {activeTab === 'posts' && (
        <Box className="grid grid-cols-3 gap-2 px-3 pt-2">
          {loadingPosts ? (
            <Box className="col-span-3 py-10 flex justify-center">
              <Text className="text-gray-400">Đang tải...</Text>
            </Box>
          ) : posts.filter(post => !post.attachedProduct).length === 0 ? (
            <Box className="col-span-3 py-10 flex justify-center flex-col items-center">
              <span className="text-gray-300 mb-2 inline-flex" style={{fontSize: "36px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></span>
              <Text className="text-gray-500">Chưa có bài viết nào</Text>
            </Box>
          ) : (
            posts.filter(post => !post.attachedProduct).map((post) => (
              <Box
                key={post.id}
                className="flex flex-col bg-white border border-gray-150 rounded-lg overflow-hidden shadow-xs cursor-pointer active:scale-[0.98] transition duration-150"
                onClick={() => navigate(`/post-detail?id=${post.id}`)}
              >
                <Box className="aspect-square bg-gray-100 relative overflow-hidden flex items-center justify-center">
                  {post.images && post.images.length > 0 ? (
                    <img src={post.images[0]} className="w-full h-full object-cover" alt="post" />
                  ) : (
                    <Box className="w-full h-full bg-[#f8f6ec] p-2 flex items-center justify-center">
                      <Text size="xxSmall" className="text-gray-700 text-center line-clamp-4 break-words leading-tight">
                        {post.content}
                      </Text>
                    </Box>
                  )}
                  {post.images && post.images.length > 1 && (
                    <span className="absolute top-1 right-1 text-white opacity-80 inline-flex bg-black/30 p-0.5 rounded-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </span>
                  )}
                  {post.isPinned && (
                    <Box className="absolute top-1 left-1 bg-white/90 p-0.5 rounded-full shadow-xs z-10 flex items-center justify-center">
                      <span className="text-[#a68c4d] inline-flex">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                        </svg>
                      </span>
                    </Box>
                  )}
                  {!isOtherProfile && post.status === "pending" && (
                    <Box className="absolute bottom-1 right-1 bg-yellow-500 text-white text-[8px] px-1 py-0.5 rounded font-bold shadow-sm z-10">
                      Chờ duyệt
                    </Box>
                  )}
                  {!isOtherProfile && post.status === "rejected" && (
                    <Box className="absolute bottom-1 right-1 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded font-bold shadow-sm z-10">
                      Bị từ chối
                    </Box>
                  )}
                </Box>
                {/* Interactions Row */}
                <Box className="flex items-center justify-center space-x-3 py-1.5 bg-gray-50/50 border-t border-gray-100 text-gray-500">
                  <Box className="flex items-center space-x-0.5">
                    <Icon icon="zi-heart-solid" className="text-red-500 text-xs" />
                    <span className="text-[10px] font-medium text-gray-600">{post.likesCount || 0}</span>
                  </Box>
                  <Box className="flex items-center space-x-0.5">
                    <Icon icon="zi-chat" className="text-gray-400 text-xs" />
                    <span className="text-[10px] font-medium text-gray-600">{post.commentsCount || 0}</span>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      )}

      {activeTab === 'saved' && (
        <Box className="grid grid-cols-3 gap-2 px-3 pt-2">
          {loadingPosts ? (
            <Box className="col-span-3 py-10 flex justify-center">
              <Text className="text-gray-400">Đang tải...</Text>
            </Box>
          ) : linkedPosts.length === 0 ? (
            <Box className="col-span-3 py-12 flex flex-col items-center justify-center text-gray-500">
              <span className="text-gray-300 mb-2 inline-flex" style={{fontSize: "36px"}}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </span>
              <Text className="text-gray-500">Chưa có bài viết gắn link nào</Text>
            </Box>
          ) : (
            linkedPosts.map((post) => (
              <Box
                key={post.id}
                className="flex flex-col bg-white border border-gray-150 rounded-lg overflow-hidden shadow-xs cursor-pointer active:scale-[0.98] transition duration-150"
                onClick={() => navigate(`/post-detail?id=${post.id}`)}
              >
                <Box className="aspect-square bg-gray-100 relative overflow-hidden flex items-center justify-center">
                  {post.images && post.images.length > 0 ? (
                    <img src={post.images[0]} className="w-full h-full object-cover" alt="post" />
                  ) : (
                    <Box className="w-full h-full bg-[#f8f6ec] p-2 flex items-center justify-center">
                      <Text size="xxSmall" className="text-gray-700 text-center line-clamp-4 break-words leading-tight">
                        {post.content}
                      </Text>
                    </Box>
                  )}
                  {post.images && post.images.length > 1 && (
                    <span className="absolute top-1 right-1 text-white opacity-80 inline-flex bg-black/30 p-0.5 rounded-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </span>
                  )}
                  {post.isPinned && (
                    <Box className="absolute top-1 left-1 bg-white/90 p-0.5 rounded-full shadow-xs z-10 flex items-center justify-center">
                      <span className="text-[#a68c4d] inline-flex">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                        </svg>
                      </span>
                    </Box>
                  )}
                  {!isOtherProfile && post.status === "pending" && (
                    <Box className="absolute bottom-1 right-1 bg-yellow-500 text-white text-[8px] px-1 py-0.5 rounded font-bold shadow-sm z-10">
                      Chờ duyệt
                    </Box>
                  )}
                  {!isOtherProfile && post.status === "rejected" && (
                    <Box className="absolute bottom-1 right-1 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded font-bold shadow-sm z-10">
                      Bị từ chối
                    </Box>
                  )}
                </Box>
                {/* Interactions Row */}
                <Box className="flex items-center justify-center space-x-3 py-1.5 bg-gray-50/50 border-t border-gray-100 text-gray-500">
                  <Box className="flex items-center space-x-0.5">
                    <Icon icon="zi-heart-solid" className="text-red-500 text-xs" />
                    <span className="text-[10px] font-medium text-gray-600">{post.likesCount || 0}</span>
                  </Box>
                  <Box className="flex items-center space-x-0.5">
                    <Icon icon="zi-chat" className="text-gray-400 text-xs" />
                    <span className="text-[10px] font-medium text-gray-600">{post.commentsCount || 0}</span>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      )}

      {activeTab === 'shared' && (
        <Box className="grid grid-cols-3 gap-2 px-3 pt-2">
          {loadingPosts ? (
            <Box className="col-span-3 py-10 flex justify-center">
              <Text className="text-gray-400">Đang tải...</Text>
            </Box>
          ) : sharedPosts.length === 0 ? (
            <Box className="col-span-3 py-12 flex flex-col items-center justify-center text-gray-500">
              <span className="text-gray-300 mb-2 inline-flex" style={{fontSize: "36px"}}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
              </span>
              <Text className="text-gray-500">Chưa có bài viết đã chia sẻ nào</Text>
            </Box>
          ) : (
            sharedPosts.map((post) => (
              <Box
                key={post.id}
                className="flex flex-col bg-white border border-gray-150 rounded-lg overflow-hidden shadow-xs cursor-pointer active:scale-[0.98] transition duration-150"
                onClick={() => navigate(`/post-detail?id=${post.id}`)}
              >
                <Box className="aspect-square bg-gray-100 relative overflow-hidden flex items-center justify-center">
                  {post.images && post.images.length > 0 ? (
                    <img src={post.images[0]} className="w-full h-full object-cover" alt="post" />
                  ) : post.originalPost?.images && post.originalPost.images.length > 0 ? (
                    <img src={post.originalPost.images[0]} className="w-full h-full object-cover" alt="post" />
                  ) : (
                    <Box className="w-full h-full bg-[#f8f6ec] p-2 flex items-center justify-center">
                      <Text size="xxSmall" className="text-gray-700 text-center line-clamp-4 break-words leading-tight">
                        {post.content || post.originalPost?.content}
                      </Text>
                    </Box>
                  )}
                  {(((post.images?.length || 0) > 1) || ((post.originalPost?.images?.length || 0) > 1)) && (
                    <span className="absolute top-1 right-1 text-white opacity-80 inline-flex bg-black/30 p-0.5 rounded-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </span>
                  )}
                  {post.isPinned && (
                    <Box className="absolute top-1 left-1 bg-white/90 p-0.5 rounded-full shadow-xs z-10 flex items-center justify-center">
                      <span className="text-[#a68c4d] inline-flex">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                        </svg>
                      </span>
                    </Box>
                  )}
                  {!isOtherProfile && post.status === "pending" && (
                    <Box className="absolute bottom-1 right-1 bg-yellow-500 text-white text-[8px] px-1 py-0.5 rounded font-bold shadow-sm z-10">
                      Chờ duyệt
                    </Box>
                  )}
                  {!isOtherProfile && post.status === "rejected" && (
                    <Box className="absolute bottom-1 right-1 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded font-bold shadow-sm z-10">
                      Bị từ chối
                    </Box>
                  )}
                </Box>
                {/* Interactions Row */}
                <Box className="flex items-center justify-center space-x-3 py-1.5 bg-gray-50/50 border-t border-gray-100 text-gray-500">
                  <Box className="flex items-center space-x-0.5">
                    <Icon icon="zi-heart-solid" className="text-red-500 text-xs" />
                    <span className="text-[10px] font-medium text-gray-600">{post.likesCount || 0}</span>
                  </Box>
                  <Box className="flex items-center space-x-0.5">
                    <Icon icon="zi-chat" className="text-gray-400 text-xs" />
                    <span className="text-[10px] font-medium text-gray-600">{post.commentsCount || 0}</span>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      )}

      {/* Menu Tùy chọn Đang theo dõi */}
      <Sheet visible={showFollowingOptions} onClose={() => setShowFollowingOptions(false)} autoHeight title="Đang theo dõi">
        <Box className="p-2 pb-6">
          <Box className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700" onClick={() => { 
            setNotificationsEnabled(!notificationsEnabled);
            openSnackbar({ text: notificationsEnabled ? "Đã tắt thông báo" : "Đã bật thông báo nhận bài viết mới", type: "success" });
            setShowFollowingOptions(false);
          }}>
            <span className="mr-3 inline-flex text-2xl">{notificationsEnabled ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}</span>
            <Text className="text-[16px] font-medium">{notificationsEnabled ? "Tắt thông báo bài viết mới" : "Nhận thông báo bài viết mới"}</Text>
          </Box>
          <Box className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-red-500 border-t border-gray-100" onClick={() => {
            if (onFollowToggle) onFollowToggle();
            setShowFollowingOptions(false);
          }}>
            <span className="mr-3 inline-flex text-2xl"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.1 0-2 .9-2 2v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="23" y1="11" x2="17" y2="11"></line></svg></span>
            <Text className="text-[16px] font-medium">Hủy theo dõi</Text>
          </Box>
        </Box>
      </Sheet>

      {/* Image Actions Sheet */}
      <Sheet visible={actionSheetVisible} onClose={() => setActionSheetVisible(false)} autoHeight>
        <Box className="p-4 pb-8 flex flex-col space-y-4">
          <Button 
            variant="secondary"
            fullWidth 
            onClick={() => {
              setViewImage(actionSheetTarget === 'avatar' ? user.avatar : (user.cover || (role === "provider" ? "https://firebasestorage.googleapis.com/v0/b/campusbizproject.firebasestorage.app/o/banners%2F000_Banner_2.jpg?alt=media&token=b4125322-a3e2-40e0-91be-25debde54a52" : "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&fit=crop")));
              setActionSheetVisible(false);
            }}
          >
            Xem ảnh
          </Button>
          <Button 
            fullWidth
            style={{ backgroundColor: "#14502e", color: "white" }}
            onClick={() => {
              fileInputRef.current?.click();
              setActionSheetVisible(false);
            }}
          >
            Đổi ảnh mới
          </Button>
        </Box>
      </Sheet>

      <Modal visible={showFollowers} title="Người theo dõi" onClose={() => setShowFollowers(false)} actions={[{ text: "Đóng", onClick: () => setShowFollowers(false), highLight: true }]}>
        <Box p={2} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loadingStats ? <Box flex justifyContent="center" py={4}><Spinner /></Box> : (
            followersList.map((item, idx) => (
              <Box key={idx} flex alignItems="center" justifyContent="space-between" className="mb-3 pb-3 border-b border-gray-100 last:border-0" onClick={() => { if (item.type === 'shop') { setShowFollowers(false); navigate(`/shop-details/${item.id}`); } }}>
                <Box flex alignItems="center">
                  <Avatar src={item.avatar || item.shopImage || getDefaultAvatar(item.id)} size={40} className="border" />
                  <Box ml={3}>
                    <Text size="small" bold>{item.name || item.fullName || item.shopName || "Khách hàng"}</Text>
                  </Box>
                </Box>
                {item.type === 'shop' && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-600 border border-orange-200">Shop</span>}
              </Box>
            ))
          )}
        </Box>
      </Modal>

      <Modal visible={showFollowing} title="Đang theo dõi" onClose={() => setShowFollowing(false)} actions={[{ text: "Đóng", onClick: () => setShowFollowing(false), highLight: true }]}>
        <Box p={2} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loadingStats ? <Box flex justifyContent="center" py={4}><Spinner /></Box> : (
            followingList.map((item, idx) => (
              <Box key={idx} flex alignItems="center" justifyContent="space-between" className="mb-3 pb-3 border-b border-gray-100 last:border-0" onClick={() => { if (item.type === 'shop') { setShowFollowing(false); navigate(`/shop-details/${item.id}`); } }}>
                <Box flex alignItems="center">
                  <Avatar src={item.avatar || item.shopImage || getDefaultAvatar(item.id)} size={40} className="border" />
                  <Box ml={3}>
                    <Text size="small" bold>{item.name || item.fullName || item.shopName || "Khách hàng"}</Text>
                  </Box>
                </Box>
                {item.type === 'shop' && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-600 border border-orange-200">Shop</span>}
              </Box>
            ))
          )}
        </Box>
      </Modal>

      {/* Hidden File Input */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        style={{ display: "none" }} 
        onChange={handleFileChange} 
      />

      {/* Image Viewer Modal */}
      {viewImage && (
        <Box 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center flex-col"
          onClick={() => setViewImage(null)}
        >
          <Box className="absolute top-4 right-4 p-2 bg-black/50 rounded-full cursor-pointer z-50" onClick={() => setViewImage(null)}>
            <Icon icon="zi-close" className="text-white text-2xl" />
          </Box>
          <img src={viewImage} className="w-full h-auto max-h-screen object-contain" alt="Viewer" />
        </Box>
      )}
    </Box>
  );
};

// --- TRANG PROFILE CHÍNH ---
const ProfilePage: FC = () => {
  const [authVisible, setAuthVisible] = useState(false);
  const navigate = useNavigate(); // Công cụ chuyển trang

  // Trạng thái quản lý User
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const { openSnackbar } = useSnackbar();

  const [targetUserData, setTargetUserData] = useState<any>(null);
  const [showProviderDashboard, setShowProviderDashboard] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const handleUpdateImage = async (field: "avatar" | "cover", file: File) => {
    if (!currentUser || !userData) return;
    setIsUploadingImage(true);
    try {
      const filename = `${field}s/${currentUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const docRef = doc(db, userData.role === "provider" ? "shops" : "users", currentUser.uid);
      await updateDoc(docRef, { [field]: url });
      
      setUserData((prev: any) => ({ ...prev, [field]: url }));
      openSnackbar({ text: `Cập nhật ${field === 'avatar' ? 'ảnh đại diện' : 'ảnh bìa'} thành công!`, type: "success" });
    } catch (error) {
      console.error(error);
      openSnackbar({ text: "Lỗi cập nhật ảnh. Vui lòng thử lại.", type: "error" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const profileId = new URLSearchParams(window.location.search).get("id");

  // Lấy data của user mục tiêu nếu có profileId
  useEffect(() => {
    if (profileId) {
      setLoadingTarget(true);
      const fetchTarget = async () => {
        let snap = await getDoc(doc(db, "users", profileId));
        if (snap.exists()) {
          setTargetUserData({ id: snap.id, collectionName: "users", ...snap.data() });
          setLoadingTarget(false);
          return;
        }
        
        snap = await getDoc(doc(db, "shops", profileId));
        if (snap.exists()) {
          setTargetUserData({ id: snap.id, collectionName: "shops", ...snap.data() });
          setLoadingTarget(false);
          return;
        }

        try {
          const qUser = query(collection(db, "users"), where("phone", "==", profileId));
          const userSnap = await getDocs(qUser);
          if (!userSnap.empty) {
            setTargetUserData({ id: userSnap.docs[0].id, collectionName: "users", ...userSnap.docs[0].data() });
            setLoadingTarget(false);
            return;
          }
          
          const qShop = query(collection(db, "shops"), where("phone", "==", profileId));
          const shopSnap = await getDocs(qShop);
          if (!shopSnap.empty) {
            setTargetUserData({ id: shopSnap.docs[0].id, collectionName: "shops", ...shopSnap.docs[0].data() });
            setLoadingTarget(false);
            return;
          }
        } catch (e) {
          console.error("Lỗi tìm kiếm hồ sơ theo sđt:", e);
        }
        
        setLoadingTarget(false);
      };
      fetchTarget();
    } else {
      setTargetUserData(null);
    }
  }, [profileId]);

  // Lắng nghe trạng thái đăng nhập từ Firebase
  // Lắng nghe trạng thái đăng nhập từ Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email !== "guest@campus.com") {
        setCurrentUser(user);
        
        // Lấy SĐT từ email
        const phoneFromEmail = user.email ? user.email.replace("@campus.com", "") : "";
        const localPhone = localStorage.getItem("user_phone");
        const finalPhone = phoneFromEmail || localPhone;

        if (finalPhone) {
          if (!localPhone) {
            localStorage.setItem("user_phone", finalPhone);
          }

          try {
            // Dò tìm SĐT trong bảng "shops"
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);

            if (!shopSnap.empty) {
              // LÀ SHOP: Load ProviderView
              const shopData = shopSnap.docs[0].data();
              setUserData({ id: shopSnap.docs[0].id, ...shopData, role: "provider" });
              return; 
            }
          } catch (error) {
            console.error("Lỗi kiểm tra quyền Shop:", error);
          }
        }

        // Tải dữ liệu từ bảng "users"
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        let data = docSnap.exists() ? docSnap.data() : null;
        let docId = docSnap.id;

        if ((!data || !data.branchInfo) && finalPhone) {
          try {
            const qUser = query(collection(db, "users"), where("phone", "==", finalPhone));
            const userSnap = await getDocs(qUser);
            if (!userSnap.empty) {
              data = userSnap.docs[0].data();
              docId = userSnap.docs[0].id;
            }
          } catch (err) {
            console.error("Lỗi tải fallback users:", err);
          }
        }

        if (data) {
          if (data.role === "admin") {
              setUserData({ id: docId, ...data });
          } else if (data.branchInfo) {
              setUserData({ id: docId, ...data, role: "member" });
          } else {
              setUserData({ id: docId, ...data, role: data.role || "user" });
          }
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
        localStorage.removeItem("user_phone");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Hàm xử lý Đăng xuất
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Firebase sẽ tự động cập nhật currentUser về null và giao diện sẽ đổi
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      setAuthVisible(true);
      return;
    }
    if (!targetUserData || !targetUserData.collectionName) return;

    const targetRef = doc(db, targetUserData.collectionName, targetUserData.id);
    const followers = targetUserData.followers || [];
    const isFollowing = followers.includes(currentUser.uid);

    try {
      if (isFollowing) {
        await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
        setTargetUserData({ ...targetUserData, followers: followers.filter((id: string) => id !== currentUser.uid) });
      } else {
        await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
        setTargetUserData({ ...targetUserData, followers: [...followers, currentUser.uid] });
      }
    } catch (error) {
      console.error("Follow toggle failed", error);
    }
  };

  return (
    <ErrorBoundary>
      <Page className="relative overflow-y-auto">
        {!currentUser && <Header showBackIcon={false} title="Hồ sơ cá nhân" />}

        {/* HIỂN THỊ DỰA TRÊN TRẠNG THÁI */}
        {profileId ? (
          loadingTarget ? (
            <Box className="flex justify-center items-center h-40">
              <Text className="text-gray-400">Đang tải hồ sơ...</Text>
            </Box>
          ) : targetUserData ? (
            <NewMemberView
              user={{
                id: targetUserData.id,
                name: (targetUserData.collectionName === "shops" || targetUserData.role === "provider") 
                  ? (targetUserData.name || targetUserData.shopName || targetUserData.fullName || targetUserData.phone || "Shop")
                  : (targetUserData.fullName || targetUserData.name || targetUserData.phone || "Thành viên Campus"),
                avatar: targetUserData.avatar || targetUserData.shopAvatar || "",
                cover: targetUserData.cover,
                phone: targetUserData.phone
              }}
              points={targetUserData.rankPoints || targetUserData.points || 0}
              rankPoints={targetUserData.rankPoints || 0}
              role={targetUserData.role || (targetUserData.collectionName === "shops" ? "provider" : "user")}
              isOtherProfile={true}
              followers={targetUserData.followers || []}
              currentUserId={currentUser?.uid}
              onFollowToggle={handleFollowToggle}
            />
          ) : (
            <Box className="flex justify-center items-center h-40">
              <Text className="text-gray-400">Không tìm thấy người dùng.</Text>
            </Box>
          )
        ) : currentUser ? (
          <>
            {isUploadingImage && (
              <Box className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
                <Box className="bg-white p-4 rounded-xl flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-[#14502e] border-t-transparent rounded-full animate-spin mb-2"></div>
                  <Text className="font-medium text-gray-800">Đang tải ảnh lên...</Text>
                </Box>
              </Box>
            )}
            {userData?.role === "admin" && <AdminView userData={userData} onLogout={handleLogout} />}
            {userData?.role === "provider" && showProviderDashboard && <ProviderView userData={userData} setUserData={setUserData} onLogout={handleLogout} onBackToProfile={() => setShowProviderDashboard(false)} />}
            
            {(!userData?.role || userData?.role === "user" || userData?.role === "member" || userData?.role === "distributor" || (userData?.role === "provider" && !showProviderDashboard)) && (
              <NewMemberView
                user={{
                  id: currentUser.uid,
                  username: currentUser.email
                    ? currentUser.email.split("@")[0]
                    : "user_name",
                  name: (userData?.role === "provider" || userData?.collectionName === "shops")
                    ? (userData?.name || userData?.shopName || userData?.fullName || "Shop")
                    : (userData?.fullName || currentUser.email?.replace("@campus.com", "") || "Thành viên Campus"),
                  avatar: userData?.avatar || "",
                  cover: userData?.cover,
                  phone: userData?.phone
                }}
                points={userData?.rankPoints || userData?.points || 0}
                rankPoints={userData?.rankPoints || 0}
                role={userData?.role}
                followers={userData?.followers || []}
                currentUserId={currentUser.uid}
                onUpdateImage={handleUpdateImage}
                onOpenProviderDashboard={() => setShowProviderDashboard(true)}
              />
            )}
          </>
        ) : (
          <>
            {/* KỊCH BẢN 2: CHƯA ĐĂNG NHẬP (hoặc vừa đăng xuất) -> Hiển thị khối màu xanh */}
            <Subscription onOpenAuth={() => setAuthVisible(true)} />
          </>
        )}

        {/* Lớp phủ đăng nhập/đăng ký */}
        <React.Suspense fallback={null}>
          <AuthOverlay
            visible={authVisible}
            onClose={() => setAuthVisible(false)}
          />
        </React.Suspense>
      </Page>
    </ErrorBoundary>
  );
};

export default ProfilePage;
