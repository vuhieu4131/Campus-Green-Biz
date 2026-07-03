import CustomIcon from './custom-icon';
import React, { FC, useState } from "react";
import { Box, Text, Avatar, Icon, Sheet, Input, useSnackbar, useNavigate } from "zmp-ui";
import { ImageGrid } from "./image-grid";
import { RawPost } from "../utils/edgeRanker";
import { auth, db } from "../firebase";
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { AuthOverlay } from "../pages/auth";

interface PostItemProps {
  data: RawPost;
  isDetailView?: boolean;
  onDelete?: () => void;
}

export const PostItem: FC<PostItemProps> = ({ data, isDetailView, onDelete }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return unsub;
  }, []);

  const [liked, setLiked] = useState(data.likedBy?.includes(currentUser?.uid || "") || false);
  const [likesCount, setLikesCount] = useState(data.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(data.commentsCount || 0);
  const [sharesCount, setSharesCount] = useState(data.sharesCount || 0);

  // States
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  
  const [isExpanded, setIsExpanded] = useState(isDetailView || false);
  const [showShare, setShowShare] = useState(false);

  // For post options
  const [showMenu, setShowMenu] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editPrivacy, setEditPrivacy] = useState("Công khai");

  // For long-press comment context menu
  const [activeCommentMenu, setActiveCommentMenu] = useState<any>(null);
  let pressTimer: any;

  // Real-time comments
  React.useEffect(() => {
    if (showComments && data.id) {
      const q = query(collection(db, "posts", data.id, "comments"), orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setComments(fetchedComments);
      });
      return unsubscribe;
    }
  }, [showComments, data.id]);

  const handleLike = async () => {
    if (!currentUser) {
      setShowAuth(true);
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      const postRef = doc(db, "posts", data.id);
      // Giả lập lưu like: trong thực tế sẽ dùng arrayUnion hoặc transaction
      await updateDoc(postRef, {
        likesCount: increment(newLiked ? 1 : -1)
      });
    } catch (e) {
      // Revert if error
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSendComment = async () => {
    if (!currentUser) return openSnackbar({ text: "Vui lòng đăng nhập", type: "error" });
    if (!commentText.trim()) return;

    try {
      await addDoc(collection(db, "posts", data.id, "comments"), {
        authorId: currentUser.uid,
        authorName: currentUser.email?.split('@')[0] || "Người dùng",
        authorAvatar: currentUser.photoURL || "https://i.pravatar.cc/150?img=11",
        content: commentText.trim(),
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "posts", data.id), {
        commentsCount: increment(1)
      });
      setCommentsCount(prev => prev + 1);
      
      setCommentText("");
    } catch (error) {
      console.error("Lỗi gửi bình luận:", error);
      openSnackbar({ text: "Không thể gửi bình luận", type: "error" });
    }
  };

  // Tính toán thời gian
  let timeString = "Vừa xong";
  if (data.createdAt) {
    const createdTime = data.createdAt.toMillis ? data.createdAt.toMillis() : (data.createdAt.seconds ? data.createdAt.seconds * 1000 : Date.now());
    const diffInSeconds = Math.floor((Date.now() - createdTime) / 1000);
    if (diffInSeconds < 60) timeString = `${diffInSeconds} giây trước`;
    else if (diffInSeconds < 3600) timeString = `${Math.floor(diffInSeconds / 60)} phút trước`;
    else if (diffInSeconds < 86400) timeString = `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    else timeString = `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  }

  const handleTouchStart = (comment: any) => {
    pressTimer = setTimeout(() => {
      setActiveCommentMenu(comment);
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, "posts", data.id, "comments", commentId));
      await updateDoc(doc(db, "posts", data.id), {
        commentsCount: increment(-1)
      });
      setCommentsCount(prev => Math.max(0, prev - 1));
      openSnackbar({ text: "Đã xóa bình luận", type: "success" });
      setActiveCommentMenu(null);
    } catch (e) {
      openSnackbar({ text: "Lỗi xóa bình luận", type: "error" });
    }
  };

  const handleLikeComment = async (comment: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) return;
    const commentRef = doc(db, "posts", data.id, "comments", comment.id);
    const hasLiked = comment.likedBy?.includes(currentUser.uid);
    try {
      if (hasLiked) {
        await updateDoc(commentRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(commentRef, {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1)
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== data.authorId) return;
    
    if (window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) {
      try {
        await deleteDoc(doc(db, "posts", data.id));
        openSnackbar({ text: "Đã xóa bài viết thành công!", type: "success" });
        if (onDelete) onDelete();
      } catch (error) {
        openSnackbar({ text: "Lỗi khi xóa bài viết", type: "error" });
      }
    }
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, "posts", data.id), {
        content: editContent.trim(),
        privacy: editPrivacy
      });
      data.content = editContent.trim();
      data.privacy = editPrivacy;
      setIsEditing(false);
      openSnackbar({ text: "Đã lưu thay đổi", type: "success" });
    } catch (error) {
      openSnackbar({ text: "Lỗi khi lưu bài viết", type: "error" });
    }
  };

  const handleTogglePin = async () => {
    try {
      const newPinStatus = !data.isPinned;
      await updateDoc(doc(db, "posts", data.id), {
        isPinned: newPinStatus
      });
      data.isPinned = newPinStatus;
      setShowMenu(false);
      openSnackbar({ text: newPinStatus ? "Đã ghim lên đầu" : "Đã bỏ ghim", type: "success" });
    } catch (error) {
      openSnackbar({ text: "Lỗi khi thao tác", type: "error" });
    }
  };

  return (
    <Box className="bg-white mx-3 mb-4 pt-4 pb-2 rounded-2xl shadow-sm border border-gray-100">
      {/* Header */}
      <Box className="flex items-center justify-between px-4 mb-2">
        <Box className="flex items-center space-x-2">
          <Avatar 
            src={data.authorAvatar || "https://i.pravatar.cc/150?img=11"} 
            size={40} 
            className="border border-gray-100 cursor-pointer active:opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              if (data.authorId) {
                navigate(`/profile?id=${data.authorId}`);
              }
            }}
          />
          <Box 
            className="cursor-pointer active:opacity-70"
            onClick={() => { if (!isDetailView) navigate(`/post-detail?id=${data.id}`) }}
          >
            <Box className="flex items-center space-x-1">
              <Text.Title 
                className="font-bold text-gray-800 text-[15px] leading-tight hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.authorId) {
                    navigate(`/profile?id=${data.authorId}`);
                  }
                }}
              >
                {data.authorName || "Người dùng"}
              </Text.Title>
              {data.isPinned && <CustomIcon icon="zi-star-solid" size={12} className="text-[#a68c4d]" />}
            </Box>
            {isEditing ? (
              <Box className="flex items-center mt-1 bg-gray-100 rounded-md px-2 py-0.5 border border-gray-200">
                <select 
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                  className="bg-transparent text-[13px] text-gray-700 outline-none w-full"
                >
                  <option value="Công khai">Công khai</option>
                  <option value="Bạn bè">Bạn bè</option>
                  <option value="Chỉ mình tôi">Chỉ mình tôi</option>
                </select>
              </Box>
            ) : (
              <Text size="xxSmall" className="text-gray-500">
                {timeString} • {data.privacy || "Công khai"}
              </Text>
            )}
          </Box>
        </Box>
        {!isEditing ? (
          <CustomIcon icon="zi-more-horiz" className="text-gray-400 cursor-pointer p-2" onClick={() => setShowMenu(true)} />
        ) : (
          <Text className="text-[#14502e] font-bold text-[15px] cursor-pointer p-2" onClick={handleSaveEdit}>Lưu</Text>
        )}
      </Box>

      {/* Content */}
      <Box className="px-4 mb-3">
        {isEditing ? (
          <textarea
            className="w-full border border-gray-200 rounded-lg p-3 text-[15px] outline-none min-h-[120px] focus:border-[#14502e] transition-colors"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Bạn đang nghĩ gì?"
          />
        ) : (
          <>
            <Text className={`text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap ${!isExpanded && data.content && data.content.length > 150 ? "line-clamp-3" : ""}`} onClick={() => setIsExpanded(!isExpanded)}>
              {data.content}
            </Text>
            {data.content && data.content.length > 150 && (
              <Text 
                className="text-gray-500 font-medium mt-1 cursor-pointer" 
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? "Thu gọn" : "Xem thêm"}
              </Text>
            )}
          </>
        )}
      </Box>

      {/* Images Grid */}
      {data.images && data.images.length > 0 && (
        <Box className="mb-3 px-1">
          <ImageGrid 
            images={data.images} 
            onImageClick={(idx) => {
              setActiveImageIndex(idx);
              setShowOverlay(true);
              setShowImageViewer(true);
            }} 
          />
        </Box>
      )}

      {/* Stats */}
      <Box className="flex justify-between items-center px-4 mb-3 text-gray-500 border-b border-gray-100 pb-2">
        <Box className="flex items-center space-x-1">
          <Box className="bg-red-500 rounded-full p-[2px] flex items-center justify-center">
            <Icon icon="zi-heart-solid" className="text-white text-[10px]" />
          </Box>
          <Text size="xxSmall">{likesCount}</Text>
        </Box>
        <Box className="flex items-center space-x-3 cursor-pointer" onClick={() => currentUser ? setShowComments(true) : setShowAuth(true)}>
          <Text size="xxSmall">{commentsCount} bình luận</Text>
          <Text size="xxSmall">{sharesCount} chia sẻ</Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box className="flex justify-around items-center px-2">
        <Box className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer active:bg-gray-50" onClick={() => currentUser ? handleLike() : setShowAuth(true)}>
          <Icon icon={liked ? "zi-heart-solid" : "zi-heart"} className={liked ? "text-red-500 text-xl" : "text-gray-500 text-xl"} />
          <Text size="small" className={`font-medium ${liked ? "text-red-500" : "text-gray-500"}`}>Thích</Text>
        </Box>
        <Box className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer active:bg-gray-50" onClick={() => currentUser ? setShowComments(true) : setShowAuth(true)}>
          <CustomIcon icon="zi-chat" className="text-gray-500 text-xl" />
          <Text size="small" className="font-medium text-gray-500">Bình luận</Text>
        </Box>
        <Box className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer active:bg-gray-50" onClick={() => currentUser ? setShowShare(true) : setShowAuth(true)}>
          <CustomIcon icon="zi-share" className="text-gray-500 text-xl" />
          <Text size="small" className="font-medium text-gray-500">Chia sẻ</Text>
        </Box>
      </Box>

      {/* Trình xem ảnh toàn màn hình */}
      {showImageViewer && data.images && (
        <Box className="fixed inset-0 bg-black z-[90] flex flex-col justify-center items-center" onClick={() => setShowOverlay(!showOverlay)}>
          <Box className="w-full h-full bg-contain bg-no-repeat bg-center" style={{ backgroundImage: `url('${data.images[activeImageIndex]}')` }} />
          {showOverlay && (
            <>
              <Box className="absolute top-0 left-0 w-full p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
                <Box className="flex items-center space-x-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowImageViewer(false); if (data.authorId) navigate(`/profile?id=${data.authorId}`); }}>
                  <Avatar src={data.authorAvatar || "https://i.pravatar.cc/150?img=11"} size={36} className="border border-white/30" />
                  <Box>
                    <Text className="text-white font-bold text-sm leading-tight">{data.authorName || "Người dùng"}</Text>
                    <Text className="text-white/70 text-xs">{timeString}</Text>
                  </Box>
                </Box>
                <CustomIcon icon="zi-close" className="text-white text-3xl cursor-pointer p-2" onClick={(e) => { e.stopPropagation(); setShowImageViewer(false); }} />
              </Box>
              {data.images.length > 1 && (
                <Box className="absolute top-1/2 left-0 w-full flex justify-between px-2 pointer-events-none -translate-y-1/2">
                  {activeImageIndex > 0 ? (
                    <Box className="bg-black/50 w-10 h-10 flex items-center justify-center rounded-full pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveImageIndex(activeImageIndex - 1); }}>
                      <CustomIcon icon="zi-chevron-left" className="text-white" />
                    </Box>
                  ) : <div />}
                  {activeImageIndex < data.images.length - 1 ? (
                    <Box className="bg-black/50 w-10 h-10 flex items-center justify-center rounded-full pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveImageIndex(activeImageIndex + 1); }}>
                      <CustomIcon icon="zi-chevron-right" className="text-white" />
                    </Box>
                  ) : <div />}
                </Box>
              )}
              {/* Bottom Actions */}
              <Box className="absolute bottom-0 left-0 w-full flex flex-col bg-gradient-to-t from-black/80 to-transparent pt-10 pb-safe pointer-events-none">
                <Box className="pointer-events-auto">
                  <Box className="flex justify-between items-center px-4 mb-2 text-white/90">
                    <Box className="flex items-center space-x-1">
                      <Box className="bg-red-500 rounded-full p-[2px] flex items-center justify-center">
                        <Icon icon="zi-heart-solid" className="text-white text-[10px]" />
                      </Box>
                      <Text size="xxSmall" className="text-white">{likesCount}</Text>
                    </Box>
                    <Box className="flex items-center space-x-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); currentUser ? setShowComments(true) : setShowAuth(true); }}>
                      <Text size="xxSmall" className="text-white">{commentsCount} bình luận</Text>
                      <Text size="xxSmall" className="text-white">{sharesCount} chia sẻ</Text>
                    </Box>
                  </Box>
                  <Box className="flex justify-around items-center px-2 pb-2 border-t border-white/20 pt-2">
                    <Box className="flex flex-1 justify-center items-center space-x-2 py-2 cursor-pointer active:bg-white/10 rounded-lg" onClick={(e) => { e.stopPropagation(); currentUser ? handleLike() : setShowAuth(true); }}>
                      <Icon icon={liked ? "zi-heart-solid" : "zi-heart"} className={liked ? "text-red-500 text-xl" : "text-white text-xl"} />
                      <Text size="small" className={`font-medium ${liked ? "text-red-500" : "text-white"}`}>Thích</Text>
                    </Box>
                    <Box className="flex flex-1 justify-center items-center space-x-2 py-2 cursor-pointer active:bg-white/10 rounded-lg" onClick={(e) => { e.stopPropagation(); currentUser ? setShowComments(true) : setShowAuth(true); }}>
                      <CustomIcon icon="zi-chat" className="text-white text-xl" />
                      <Text size="small" className="font-medium text-white">Bình luận</Text>
                    </Box>
                    <Box className="flex flex-1 justify-center items-center space-x-2 py-2 cursor-pointer active:bg-white/10 rounded-lg" onClick={(e) => { e.stopPropagation(); currentUser ? setShowShare(true) : setShowAuth(true); }}>
                      <CustomIcon icon="zi-share" className="text-white text-xl" />
                      <Text size="small" className="font-medium text-white">Chia sẻ</Text>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Bảng Bình luận (Comment Bottom Sheet) */}
      <Sheet visible={showComments} onClose={() => setShowComments(false)} autoHeight title="Bình luận">
        <Box className="p-4 flex flex-col space-y-4 max-h-[60vh] overflow-y-auto">
          {comments.length === 0 ? (
            <Text className="text-center text-gray-400 py-4">Chưa có bình luận nào.</Text>
          ) : (
            comments.map((cmt) => (
              <Box 
                key={cmt.id} 
                className="flex space-x-2"
                onTouchStart={() => handleTouchStart(cmt)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(cmt)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
              >
                <Avatar src={cmt.authorAvatar || "https://i.pravatar.cc/150?img=11"} size={32} className="flex-shrink-0" />
                <Box className="flex-1 flex items-center justify-between">
                  <Box className="bg-gray-100 px-3 py-2 rounded-2xl max-w-[90%] active:bg-gray-200 transition-colors">
                    <Text className="font-bold text-[14px] text-gray-800">{cmt.authorName || "Người dùng"}</Text>
                    <Text className="text-[14px] text-gray-800">{cmt.content}</Text>
                  </Box>
                  <Box className="flex flex-col items-center justify-center pl-2 pr-1 cursor-pointer" onClick={(e) => handleLikeComment(cmt, e)}>
                    <Icon icon={cmt.likedBy?.includes(currentUser?.uid) ? "zi-heart-solid" : "zi-heart"} className={cmt.likedBy?.includes(currentUser?.uid) ? "text-red-500" : "text-gray-400"} size={16} />
                    {cmt.likesCount > 0 && <Text size="xxSmall" className="text-gray-400 mt-0.5">{cmt.likesCount}</Text>}
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
        <Box className="p-3 border-t border-gray-200 flex space-x-3 items-center bg-white">
          <Avatar src={currentUser?.photoURL || "https://i.pravatar.cc/150?img=11"} size={36} className="flex-shrink-0" />
          <Box className="flex-1 bg-gray-100 rounded-full px-4 py-1 flex items-center">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-transparent border-none p-0 h-9"
              placeholder="Viết bình luận..."
              onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
            />
            <CustomIcon icon="zi-send-solid" className={`text-xl ml-2 cursor-pointer ${commentText.trim() ? "text-[#14502e]" : "text-gray-300"}`} onClick={handleSendComment} />
          </Box>
        </Box>
      </Sheet>

      {/* Menu tương tác bình luận (Long press menu) */}
      <Sheet visible={!!activeCommentMenu} onClose={() => setActiveCommentMenu(null)} autoHeight title="Tùy chọn bình luận">
        <Box className="p-2 pb-6">
          <Box className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700" onClick={() => { handleLikeComment(activeCommentMenu); setActiveCommentMenu(null); }}>
            <Icon icon="zi-heart" className="mr-3 text-2xl text-red-500" />
            <Text className="text-[16px] font-medium">{activeCommentMenu?.likedBy?.includes(currentUser?.uid) ? "Bỏ thả tim" : "Thả tim"}</Text>
          </Box>
          <Box className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700" onClick={() => { 
            navigator.clipboard?.writeText(activeCommentMenu?.content || ""); 
            openSnackbar({ text: "Đã sao chép", type: "success" }); 
            setActiveCommentMenu(null); 
          }}>
            <CustomIcon icon="zi-copy" className="mr-3 text-2xl" />
            <Text className="text-[16px] font-medium">Sao chép văn bản</Text>
          </Box>
          <Box className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700" onClick={() => { openSnackbar({ text: "Đã báo cáo", type: "success" }); setActiveCommentMenu(null); }}>
            <CustomIcon icon="zi-warning" className="mr-3 text-2xl" />
            <Text className="text-[16px] font-medium">Báo cáo vi phạm</Text>
          </Box>
          {(currentUser?.uid === activeCommentMenu?.authorId || currentUser?.uid === data.authorId) && (
            <Box className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-red-500 border-t border-gray-100" onClick={() => handleDeleteComment(activeCommentMenu.id)}>
              <CustomIcon icon="zi-delete" className="mr-3 text-2xl" />
              <Text className="text-[16px] font-medium">Xóa bình luận</Text>
            </Box>
          )}
        </Box>
      </Sheet>

      {/* Bảng Chia sẻ */}
      <Sheet visible={showShare} onClose={() => setShowShare(false)} autoHeight title="Chia sẻ lên">
        <Box className="p-6 grid grid-cols-4 gap-4">
          {/* ... (keep existing share UI) ... */}
          <Box className="flex flex-col items-center cursor-pointer">
            <Box className="w-14 h-14 bg-[#0068ff] rounded-full flex items-center justify-center mb-2 text-white shadow-md"><CustomIcon icon="zi-chat" className="text-2xl" /></Box>
            <Text size="xSmall" className="text-center font-medium text-gray-600">Gửi bạn bè</Text>
          </Box>
          <Box className="flex flex-col items-center cursor-pointer" onClick={async () => {
            navigator.clipboard?.writeText(`https://zalo.me/s/campus-green-biz/post-detail/${data.id}`); 
            openSnackbar({ text: "Đã sao chép liên kết" }); 
            setShowShare(false);
            try {
              await updateDoc(doc(db, "posts", data.id), { sharesCount: increment(1) });
              setSharesCount(prev => prev + 1);
            } catch (e) {}
          }}>
            <Box className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-2 text-gray-700 shadow-md border border-gray-200"><CustomIcon icon="zi-copy" className="text-2xl" /></Box>
            <Text size="xSmall" className="text-center font-medium text-gray-600">Sao chép link</Text>
          </Box>
        </Box>
      </Sheet>
      {/* Menu Tùy chọn (3 chấm) */}
      {showMenu && (
        <Box className="fixed inset-0 z-[100] flex items-end">
          {/* Lớp mờ nền */}
          <Box className="absolute inset-0 bg-black/40" onClick={() => setShowMenu(false)} />
          
          {/* Menu hiển thị từ dưới lên */}
          <Box className="w-full bg-white rounded-t-2xl pb-safe z-10" style={{ animation: "slideUp 0.3s ease-out" }}>
            <Box className="p-4 border-b border-gray-100 flex justify-center items-center relative">
              <Text className="font-bold text-[17px]">Tùy chọn</Text>
              <CustomIcon icon="zi-close" className="absolute right-4 text-2xl cursor-pointer p-1" onClick={() => setShowMenu(false)} />
            </Box>
            <Box className="p-2 pb-6">
              {currentUser?.uid === data.authorId ? (
                <>
                  <Box 
                    className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700 transition-colors" 
                    onClick={() => {
                      setShowMenu(false);
                      setEditContent(data.content || "");
                      setEditPrivacy(data.privacy || "Công khai");
                      setIsEditing(true);
                    }}
                  >
                    <CustomIcon icon="zi-edit" className="mr-3 text-2xl" />
                    <Text className="text-[16px] font-medium">Chỉnh sửa bài viết</Text>
                  </Box>
                  <Box 
                    className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700 transition-colors" 
                    onClick={handleTogglePin}
                  >
                    <CustomIcon icon={data.isPinned ? "zi-star-solid" : "zi-star"} className={`mr-3 text-2xl ${data.isPinned ? "text-[#a68c4d]" : ""}`} />
                    <Text className="text-[16px] font-medium">{data.isPinned ? "Bỏ ghim bài viết này" : "Ghim lên đầu trang cá nhân"}</Text>
                  </Box>
                  <Box 
                    className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-red-500 transition-colors mt-2 border-t border-gray-100" 
                    onClick={handleDeletePost}
                  >
                    <CustomIcon icon="zi-delete" className="mr-3 text-2xl" />
                    <Text className="text-[16px] font-medium">Xóa bài viết này</Text>
                  </Box>
                </>
              ) : (
                <Box 
                  className="flex items-center p-4 cursor-pointer active:bg-gray-100 rounded-xl text-gray-700 transition-colors" 
                  onClick={() => { 
                    setShowMenu(false); 
                    openSnackbar({ text: "Tính năng báo cáo đang phát triển", type: "info" });
                  }}
                >
                  <CustomIcon icon="zi-warning" className="mr-3 text-2xl" />
                  <Text className="text-[16px] font-medium">Báo cáo vi phạm</Text>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}

      <AuthOverlay visible={showAuth} onClose={() => setShowAuth(false)} />
    </Box>
  );
};
