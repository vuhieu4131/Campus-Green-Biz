import React, { FC, useState, useEffect } from "react";
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
} from "zmp-ui";
import { useLocation } from "react-router-dom";
import subscriptionDecor from "static/subscription-decor.svg";
import { AuthOverlay } from "./auth";

// IMPORT CÔNG CỤ FIREBASE
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { PostItem } from "../components/post-item";
import { RawPost } from "../utils/edgeRanker";

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
  if (p < 5) return { name: "Thành viên mới", sub: "KHÁCH HÀNG", target: 5 };
  if (p <= 100)
    return { name: "Hạng Đồng", sub: "KHÁCH HÀNG THÂN THIẾT", target: 101 };
  if (p <= 300) return { name: "Hạng Bạc", sub: "SILVER STATUS", target: 301 };
  return { name: "Hạng Vàng", sub: "ELITE STATUS", target: 1000 };
};

const NewMemberView: FC<{ 
  user: any; 
  points: number; 
  role?: string; 
  isOtherProfile?: boolean;
  followers?: string[];
  currentUserId?: string;
  onFollowToggle?: () => void;
}> = ({ user, points, role, isOtherProfile, followers = [], currentUserId, onFollowToggle }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'tagged'>('posts');
  const rankInfo = calculateMemberRankInfo(points);
  
  const [showFollowingOptions, setShowFollowingOptions] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const isFollowing = currentUserId ? followers.includes(currentUserId) : false;

  const [posts, setPosts] = useState<RawPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const q = query(
          collection(db, "posts"), 
          where("authorId", "==", user.id)
        );
        const snapshot = await getDocs(q);
        const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RawPost[];
        // Sắp xếp bài viết: Ghim lên đầu, sau đó mới nhất lên đầu
        fetchedPosts.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;

          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Lỗi lấy bài viết:", error);
      } finally {
        setLoadingPosts(false);
      }
    };
    if (user?.id) fetchPosts();
  }, [user.id]);

  return (
    <Box className="min-h-screen pb-10 relative">
      {/* 1. Header nổi trên Ảnh Bìa */}
      <Box className="absolute top-0 left-0 w-full flex justify-between items-center px-4 py-3 z-10">
        {isOtherProfile ? (
          <Box className="bg-black/20 p-2 rounded-full backdrop-blur-sm cursor-pointer" onClick={() => navigate(-1)}>
            <span className="text-white inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></span>
          </Box>
        ) : <div />}
        {!isOtherProfile && (
          <Box className="flex items-center space-x-3 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm cursor-pointer" onClick={() => navigate('/settings')}>
            <span className="text-white inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span>
            <Avatar src={user.avatar} size={32} className="border border-white/50" />
          </Box>
        )}
      </Box>

      {/* 2. Ảnh Bìa (Cover Image) */}
      <Box
        className="w-full h-56 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&fit=crop')`,
        }}
      />

      {/* 3. Thông tin User & Avatar */}
      <Box className="px-4 relative mb-2 flex justify-between items-end">
        <Box>
          <Box className="absolute -top-12 left-4 rounded-full border-4 border-white">
            <Avatar src={user.avatar} size={80} />
          </Box>
          <Box className="pt-12">
            <Text.Title className="text-xl font-bold">{user.name}</Text.Title>
          </Box>
        </Box>
        {isOtherProfile && (
          <Button 
            className="rounded-full font-medium shadow-sm px-4 h-8 text-sm flex-shrink-0 flex items-center justify-center"
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
        )}
      </Box>

      {/* 4. Thẻ Membership */}
      {!isOtherProfile && (
        <Box
          className="mx-4 mt-4 bg-[#f8f6ec] rounded-xl p-4 border border-[#e8e4d3] flex items-center shadow-md cursor-pointer"
          onClick={() => navigate("/wallet")}
        >
          <span className="text-[#a68c4d] mr-3 inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></span>
          <Box>
            <Text.Title className="font-bold uppercase text-gray-800">
              {rankInfo.name}
            </Text.Title>
            <Text
              size="xSmall"
              className="text-gray-500 uppercase tracking-widest mt-1"
            >
              {rankInfo.sub}
            </Text>
          </Box>
        </Box>
      )}

      {/* Nút Quản Lý Dành Cho Admin/Distributor */}
      {!isOtherProfile && role === "distributor" && (
        <Box className="px-4 mt-4">
          <Button
            fullWidth
            className="bg-[#14502e] text-white font-bold rounded-xl shadow-md"
            onClick={() => navigate("/admin-dashboard")}
          >
            <span className="mr-2 inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span> Quản lý Cửa Hàng
          </Button>
        </Box>
      )}

      {/* 5. Thống kê */}
      <Box className="flex justify-around mt-6 mb-4 px-4">
        <Box className="text-center">
          <Text.Title className="font-bold text-lg">{posts.length}</Text.Title>
          <Text size="small" className="text-gray-600">
            bài viết
          </Text>
        </Box>
        <Box className="text-center">
          <Text.Title className="font-bold text-lg">{followers.length}</Text.Title>
          <Text size="small" className="text-gray-600">
            người theo dõi
          </Text>
        </Box>
        <Box className="text-center">
          <Text.Title className="font-bold text-lg">0</Text.Title>
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
        </Box>
        <Box 
          className={`flex-1 flex justify-center py-3 cursor-pointer ${activeTab === 'saved' ? 'border-b-2 text-[#14502e]' : 'text-gray-400'}`}
          style={{ borderColor: activeTab === 'saved' ? "#14502e" : "transparent" }}
          onClick={() => setActiveTab('saved')}
        >
          <span className="inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></span>
        </Box>
        <Box 
          className={`flex-1 flex justify-center py-3 cursor-pointer ${activeTab === 'tagged' ? 'border-b-2 text-[#14502e]' : 'text-gray-400'}`}
          style={{ borderColor: activeTab === 'tagged' ? "#14502e" : "transparent" }}
          onClick={() => setActiveTab('tagged')}
        >
          <span className="inline-flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
        </Box>
      </Box>

      {/* 7. Nội dung Tab */}
      {activeTab === 'posts' && (
        <Box className="grid grid-cols-3 gap-1 pt-1">
          {loadingPosts ? (
            <Box className="col-span-3 py-10 flex justify-center">
              <Text className="text-gray-400">Đang tải...</Text>
            </Box>
          ) : posts.length === 0 ? (
            <Box className="col-span-3 py-10 flex justify-center flex-col items-center">
              <span className="text-gray-300 mb-2 inline-flex" style={{fontSize: "36px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></span>
              <Text className="text-gray-500">Chưa có bài viết nào</Text>
            </Box>
          ) : (
            posts.map((post) => (
              <Box
                key={post.id}
                className="aspect-square bg-gray-200 relative cursor-pointer active:opacity-80 overflow-hidden"
                onClick={() => navigate(`/post-detail?id=${post.id}`)}
              >
                {post.images && post.images.length > 0 ? (
                  <img src={post.images[0]} className="w-full h-full object-cover" alt="post" />
                ) : (
                  <Box className="w-full h-full bg-[#f8f6ec] p-2 flex items-center justify-center border border-[#e8e4d3]">
                    <Text size="xxSmall" className="text-gray-700 text-center line-clamp-4 break-words">
                      {post.content}
                    </Text>
                  </Box>
                )}
                {post.images && post.images.length > 1 && (
                  <span className="absolute top-1 right-1 text-white opacity-80 inline-flex"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>
                )}
                {post.isPinned && (
                  <Box className="absolute top-1 left-1 bg-white/90 p-1 rounded-full shadow-sm z-10 flex items-center justify-center">
                    <span className="text-[#a68c4d] inline-flex"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg></span>
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>
      )}

      {activeTab === 'saved' && (
        <Box className="py-12 flex flex-col items-center justify-center text-gray-500">
          <span className="text-gray-300 mb-2 inline-flex" style={{fontSize: "36px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></span>
          <Text>Chưa có bài viết yêu thích nào</Text>
        </Box>
      )}

      {activeTab === 'tagged' && (
        <Box className="py-12 flex flex-col items-center justify-center text-gray-500">
          <span className="text-gray-300 mb-2 inline-flex" style={{fontSize: "36px"}}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
          <Text>Chưa có bài viết nào gắn thẻ bạn</Text>
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
            <span className="mr-3 inline-flex text-2xl"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></span>
            <Text className="text-[16px] font-medium">Hủy theo dõi</Text>
          </Box>
        </Box>
      </Sheet>
    </Box>
  );
};

// --- TRANG PROFILE CHÍNH ---
const ProfilePage: FC = () => {
  const [authVisible, setAuthVisible] = useState(false);
  const location = useLocation();
  const profileId = new URLSearchParams(location.search).get("id");

  // Trạng thái quản lý User
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  
  const [targetUserData, setTargetUserData] = useState<any>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);

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
      if (user) {
        setCurrentUser(user);
        
        // 1. THỬ TÌM TRONG BẢNG "shops" TRƯỚC
        const shopRef = doc(db, "shops", user.uid);
        const shopSnap = await getDoc(shopRef);

        if (shopSnap.exists()) {
          setUserData(shopSnap.data()); // Nhận diện là Shop
          return; // Thoát hàm nếu đã tìm thấy Shop
        }

        // 2. NẾU KHÔNG THẤY TRONG SHOPS, MỚI TÌM TRONG BẢNG "users"
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data()); // Nhận diện là User
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

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
                username: targetUserData.phone || "user_name",
                name: targetUserData.fullName || targetUserData.phone || "Thành viên Campus",
                avatar: targetUserData.avatar || "https://i.pravatar.cc/150?img=11",
              }}
              points={targetUserData.points || 0}
              role={targetUserData.role}
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
            {/* KỊCH BẢN 1: ĐÃ ĐĂNG NHẬP -> Giao diện của mình */}
            <NewMemberView
              user={{
                id: currentUser.uid,
                username: currentUser.email
                  ? currentUser.email.split("@")[0]
                  : "user_name",
                name:
                  userData?.fullName ||
                  currentUser.email?.replace("@campus.com", "") ||
                  "Thành viên Campus",
                avatar: userData?.avatar || "https://i.pravatar.cc/150?img=11",
              }}
              points={userData?.points || 0}
              role={userData?.role}
              isOtherProfile={false}
              followers={userData?.followers || []}
              currentUserId={currentUser.uid}
            />
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
