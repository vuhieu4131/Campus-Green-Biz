import CustomIcon from './custom-icon';
import React, { FC, useState } from "react";
import { Box, Text, Avatar, Icon, Sheet, Input, useSnackbar, useNavigate } from "zmp-ui";
import { getDefaultAvatar, getValidAvatar } from "../utils/avatar";
import { ImageGrid } from "./image-grid";
import { RawPost } from "../utils/edgeRanker";
import { auth, db } from "../firebase";
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, arrayUnion, arrayRemove, getDoc, getDocs, where } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { AuthOverlay } from "../pages/auth";
import { openShareSheet } from "zmp-sdk/apis";

const awardReputationPoints = async (userId: string, amount: number, description: string) => {
  try {
    let accountRef = doc(db, "users", userId);
    let accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      accountRef = doc(db, "shops", userId);
      accountSnap = await getDoc(accountRef);
    }
    
    if (accountSnap.exists()) {
      await updateDoc(accountRef, {
        reputationPoints: increment(amount)
      });
      
      await addDoc(collection(db, "point_transactions"), {
        userId: userId,
        type: "plus",
        amount: amount,
        description: description,
        walletType: "reputation",
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Lỗi cộng điểm uy tín:", err);
  }
};

const awardInteractionPoints = async (userId: string, amount: number, description: string, postId?: string, actionType?: string) => {
  try {
    let accountRef = doc(db, "users", userId);
    let accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      accountRef = doc(db, "shops", userId);
      accountSnap = await getDoc(accountRef);
    }
    
    if (accountSnap.exists()) {
      const currentPoints = accountSnap.data().interactionPoints || 0;
      await updateDoc(accountRef, {
        interactionPoints: currentPoints + amount
      });
      
      await addDoc(collection(db, "point_transactions"), {
        userId: userId,
        type: "plus",
        amount: amount,
        description: description,
        walletType: "interaction",
        postId: postId || "",
        actionType: actionType || "",
        createdAt: serverTimestamp()
      });

      // Gửi thông báo đến người nhận
      await addDoc(collection(db, "notifications"), {
        userId: userId,
        title: "Tích lũy tương tác mới 🎉",
        content: `${description}. Bạn được cộng +${amount} điểm tương tác vào Ví Tương Tác.`,
        isRead: false,
        type: "interaction_points_plus",
        postId: postId || "",
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Lỗi cộng điểm tương tác:", err);
  }
};

const deductInteractionPoints = async (userId: string, amount: number, description: string, postId?: string, actionType?: string) => {
  try {
    let accountRef = doc(db, "users", userId);
    let accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      accountRef = doc(db, "shops", userId);
      accountSnap = await getDoc(accountRef);
    }
    
    if (accountSnap.exists()) {
      const currentPoints = accountSnap.data().interactionPoints || 0;
      await updateDoc(accountRef, {
        interactionPoints: Math.max(0, currentPoints - amount)
      });
      
      await addDoc(collection(db, "point_transactions"), {
        userId: userId,
        type: "minus",
        amount: amount,
        description: description,
        walletType: "interaction",
        postId: postId || "",
        actionType: actionType || "",
        createdAt: serverTimestamp()
      });

      // Gửi thông báo đến người nhận
      await addDoc(collection(db, "notifications"), {
        userId: userId,
        title: "Khấu trừ điểm tương tác ⚠️",
        content: `${description}. Bạn bị trừ -${amount} điểm tương tác khỏi Ví Tương Tác.`,
        isRead: false,
        type: "interaction_points_minus",
        postId: postId || "",
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error("Lỗi trừ điểm tương tác:", err);
  }
};

const checkDailyPointsForAction = async (userId: string, actionType: string, cap: number) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, "point_transactions"),
      where("userId", "==", userId),
      where("actionType", "==", actionType),
      where("type", "==", "plus")
    );
    const snap = await getDocs(q);
    let sum = 0;
    snap.forEach(d => {
      const txData = d.data();
      const created = txData.createdAt?.toDate ? txData.createdAt.toDate() : (txData.createdAt?.seconds ? new Date(txData.createdAt.seconds * 1000) : null);
      if (created && created >= today) {
        sum += txData.amount || 0;
      }
    });
    return sum >= cap;
  } catch (e) {
    console.error("Lỗi kiểm tra giới hạn điểm ngày:", e);
    return false;
  }
};

interface PostItemProps {
  data: RawPost;
  isDetailView?: boolean;
  onDelete?: () => void;
}

export const PostItem: FC<PostItemProps> = ({ data, isDetailView, onDelete }) => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const isRealUser = currentUser && currentUser.email !== "guest@campus.com";
  
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return unsub;
  }, []);

  const [liked, setLiked] = useState(data.likedBy?.includes(currentUser?.uid || "") || false);
  const [likesCount, setLikesCount] = useState(data.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(data.commentsCount || 0);
  const [sharesCount, setSharesCount] = useState(data.sharesCount || 0);

  // Sync state when props or auth changes
  React.useEffect(() => {
    setLiked(data.likedBy?.includes(currentUser?.uid || "") || false);
  }, [data.likedBy, currentUser]);

  React.useEffect(() => {
    setLikesCount(data.likesCount || 0);
  }, [data.likesCount]);

  React.useEffect(() => {
    setCommentsCount(data.commentsCount || 0);
  }, [data.commentsCount]);

  React.useEffect(() => {
    setSharesCount(data.sharesCount || 0);
  }, [data.sharesCount]);

  // States
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  
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
    return undefined;
  }, [showComments, data.id]);

  // Trạng thái theo dõi tác giả bài viết
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(true);

  React.useEffect(() => {
    if (!data.authorId) {
      setLoadingFollow(false);
      return;
    }

    const authorRef = doc(db, "users", data.authorId as string);
    const unsub = onSnapshot(authorRef, (docSnap) => {
      if (docSnap.exists()) {
        const followers = docSnap.data().followers || [];
        setIsFollowing(currentUser ? followers.includes(currentUser.uid) : false);
      } else {
        const shopRef = doc(db, "shops", data.authorId as string);
        getDoc(shopRef).then((shopSnap) => {
          if (shopSnap.exists()) {
            const followers = shopSnap.data().followers || [];
            setIsFollowing(currentUser ? followers.includes(currentUser.uid) : false);
          }
        });
      }
      setLoadingFollow(false);
    }, (err) => {
      console.error("Lỗi lấy thông tin follow:", err);
      setLoadingFollow(false);
    });

    return unsub;
  }, [currentUser, data.authorId]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || currentUser.email === "guest@campus.com") {
      setShowAuth(true);
      return;
    }
    if (!data.authorId) return;

    try {
      let authorRef = doc(db, "users", data.authorId);
      let snap = await getDoc(authorRef);
      
      if (!snap.exists()) {
        authorRef = doc(db, "shops", data.authorId);
        snap = await getDoc(authorRef);
      }

      if (snap.exists()) {
        if (isFollowing) {
          await updateDoc(authorRef, {
            followers: arrayRemove(currentUser.uid)
          });
          setIsFollowing(false);
          openSnackbar({ text: "Đã hủy theo dõi", type: "success" });
        } else {
          await updateDoc(authorRef, {
            followers: arrayUnion(currentUser.uid)
          });
          setIsFollowing(true);
          openSnackbar({ text: "Đã theo dõi người dùng", type: "success" });
        }
      }
    } catch (error) {
      console.error("Lỗi khi thao tác theo dõi:", error);
      openSnackbar({ text: "Thao tác thất bại", type: "error" });
    }
  };

  // Trạng thái profile thực tế của tác giả bài viết
  const [authorProfile, setAuthorProfile] = useState<{ name: string; avatar: string } | null>(null);

  React.useEffect(() => {
    if (!data.authorId) return;

    const authorRef = doc(db, "users", data.authorId as string);
    const unsub = onSnapshot(authorRef, (docSnap) => {
      if (docSnap.exists()) {
        const docData = docSnap.data();
        setAuthorProfile({
          name: docData.fullName || docData.name || data.authorName,
          avatar: docData.avatar || data.authorAvatar
        });
      } else {
        const shopRef = doc(db, "shops", data.authorId as string);
        getDoc(shopRef).then((shopSnap) => {
          if (shopSnap.exists()) {
            const shopData = shopSnap.data();
            setAuthorProfile({
              name: shopData.shopName || shopData.name || data.authorName,
              avatar: shopData.shopAvatar || shopData.avatar || data.authorAvatar
            });
          }
        });
      }
    });

    return unsub;
  }, [data.authorId, data.authorName, data.authorAvatar]);

  const maskPhoneNumber = (text: string) => {
    if (!text) return "Người dùng";
    const digitsOnly = text.replace(/\D/g, "");
    if (digitsOnly.length >= 9 && digitsOnly.length <= 11 && /^\d+$/.test(text)) {
      return text.substring(0, 3) + "****" + text.substring(text.length - 3);
    }
    return text;
  };

  const resolvedAuthorName = maskPhoneNumber(authorProfile?.name || data.authorName || "Người dùng");
  const resolvedAuthorAvatar = getValidAvatar(authorProfile?.avatar || data.authorAvatar, data.authorId);

  const handleLike = async () => {
    if (!isRealUser) {
      setShowAuth(true);
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      const postRef = doc(db, "posts", data.id);
      await updateDoc(postRef, {
        likesCount: increment(newLiked ? 1 : -1),
        likedBy: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid)
      });
      if (newLiked) {
        // Tích điểm tương tác (Thích bài viết): +1 điểm
        if (data.authorId !== currentUser.uid) {
          // Kiểm tra giới hạn 30 điểm/ngày cho người thích
          const isLikerCapped = await checkDailyPointsForAction(currentUser.uid, "like", 30);
          if (!isLikerCapped) {
            await awardInteractionPoints(currentUser.uid, 1, "Thưởng tương tác: Thích bài viết", data.id, "like");
          }
          // Kiểm tra giới hạn 30 điểm/ngày cho tác giả nhận like
          if (data.authorId) {
            const isAuthorCapped = await checkDailyPointsForAction(data.authorId, "received_like", 30);
            if (!isAuthorCapped) {
              await awardInteractionPoints(data.authorId, 1, `Điểm tương tác: Bài viết được thích bởi ${currentUser.displayName || "Thành viên"}`, data.id, "received_like");
            }
          }
        }
      } else {
        // Bỏ thích trước 48 giờ thì trừ 1 điểm cho mỗi người
        try {
          const qTx = query(
            collection(db, "point_transactions"),
            where("userId", "==", currentUser.uid),
            where("postId", "==", data.id),
            where("actionType", "==", "like"),
            where("type", "==", "plus")
          );
          const txSnap = await getDocs(qTx);
          if (!txSnap.empty) {
            let txDocs = txSnap.docs.map(d => d.data());
            txDocs.sort((a: any, b: any) => {
              const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
              const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
              return tB - tA;
            });
            const txTime = txDocs[0].createdAt?.toDate ? txDocs[0].createdAt.toDate() : (txDocs[0].createdAt?.seconds ? new Date(txDocs[0].createdAt.seconds * 1000) : null);
            if (txTime) {
              const now = new Date();
              const diffInHours = (now.getTime() - txTime.getTime()) / 3600000;
              if (diffInHours < 48) {
                // Trừ điểm tương tác
                await deductInteractionPoints(currentUser.uid, 1, "Trừ điểm: Bỏ thích bài viết trước 48h", data.id, "unlike");
                if (data.authorId && data.authorId !== currentUser.uid) {
                  await deductInteractionPoints(data.authorId, 1, `Trừ điểm: Bài viết bị bỏ thích bởi ${currentUser.displayName || "Thành viên"} trước 48h`, data.id, "received_unlike");
                }
              }
            }
          }
        } catch (err) {
          console.error("Lỗi khi kiểm tra trừ điểm bỏ like:", err);
        }
      }
    } catch (e) {
      // Revert nếu lỗi
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSendComment = async () => {
    if (!isRealUser) {
      setShowComments(false);
      setShowAuth(true);
      return;
    }
    if (!commentText.trim()) return;

    try {
      let profileName = "Người dùng";
      let profileAvatar = getDefaultAvatar(currentUser?.uid);

      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        profileName = userData.fullName || userData.name || profileName;
        profileAvatar = userData.avatar || profileAvatar;
      } else {
        const shopRef = doc(db, "shops", currentUser.uid);
        const shopSnap = await getDoc(shopRef);
        if (shopSnap.exists()) {
          const shopData = shopSnap.data();
          profileName = shopData.shopName || shopData.name || profileName;
          profileAvatar = shopData.shopAvatar || shopData.avatar || profileAvatar;
        }
      }

      if (profileName === "Người dùng") {
        profileName = currentUser.displayName || "Thành viên";
        if (profileName === "Thành viên" && currentUser.email) {
          const emailPrefix = currentUser.email.split('@')[0];
          if (/^\d+$/.test(emailPrefix)) {
            profileName = emailPrefix.slice(0, 3) + "****" + emailPrefix.slice(-3);
          } else {
            profileName = emailPrefix;
          }
        }
      }
      if (profileAvatar === getDefaultAvatar(currentUser?.uid)) {
        profileAvatar = currentUser.photoURL || profileAvatar;
      }

      await addDoc(collection(db, "posts", data.id, "comments"), {
        authorId: currentUser.uid,
        authorName: profileName,
        authorAvatar: profileAvatar,
        content: commentText.trim(),
        replyToId: replyingTo ? replyingTo.id : null,
        replyToName: replyingTo ? replyingTo.authorName : null,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "posts", data.id), {
        commentsCount: increment(1)
      });
      setCommentsCount(prev => prev + 1);
      // Tích điểm tương tác cho người bình luận (chỉ tính lần đầu cho mỗi bài viết)
      const qComment = query(
        collection(db, "point_transactions"),
        where("userId", "==", currentUser.uid),
        where("postId", "==", data.id),
        where("actionType", "==", "comment"),
        where("type", "==", "plus")
      );
      const commentSnap = await getDocs(qComment);
      const isFirstCommentOnPost = commentSnap.empty;

      if (isFirstCommentOnPost && data.authorId !== currentUser.uid) {
        // Kiểm tra giới hạn 15 điểm/ngày cho người bình luận
        const isCommenterCapped = await checkDailyPointsForAction(currentUser.uid, "comment", 15);
        if (!isCommenterCapped) {
          await awardInteractionPoints(currentUser.uid, 5, "Thưởng tương tác: Bình luận bài viết", data.id, "comment");
        }
        // Kiểm tra giới hạn 15 điểm/ngày cho tác giả bài viết
        if (data.authorId) {
          const isAuthorCapped = await checkDailyPointsForAction(data.authorId, "received_comment", 15);
          if (!isAuthorCapped) {
            await awardInteractionPoints(data.authorId, 5, `Điểm tương tác: Bài viết được bình luận bởi ${currentUser.displayName || "Thành viên"}`, data.id, "received_comment");
          }
        }
      }

      // Add a dedicated comment notification
      if (data.authorId && data.authorId !== currentUser.uid) {
        let snippet = commentText.trim();
        if (snippet.length > 50) snippet = snippet.slice(0, 50) + "...";
        await addDoc(collection(db, "notifications"), {
          userId: data.authorId,
          title: "Bình luận mới 💬",
          content: `${profileName} đã bình luận: "${snippet}"`,
          type: "comment",
          postId: data.id,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }

      setCommentText("");
      setReplyingTo(null);
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
      const commentObj = activeCommentMenu;
      await deleteDoc(doc(db, "posts", data.id, "comments", commentId));
      await updateDoc(doc(db, "posts", data.id), {
        commentsCount: increment(-1)
      });
      setCommentsCount(prev => Math.max(0, prev - 1));

      // Kiểm tra nếu xóa bình luận trước 48h thì trừ 5 điểm của cả 2 bên
      if (commentObj) {
        const now = new Date();
        const commentTime = commentObj.createdAt?.toDate 
          ? commentObj.createdAt.toDate() 
          : (commentObj.createdAt?.seconds ? new Date(commentObj.createdAt.seconds * 1000) : new Date());
        const diffInHours = (now.getTime() - commentTime.getTime()) / 3600000;

        if (diffInHours < 48) {
          // Kiểm tra xem đã từng tích điểm bình luận bài viết này chưa
          const qCommentPlus = query(
            collection(db, "point_transactions"),
            where("userId", "==", commentObj.authorId),
            where("postId", "==", data.id),
            where("actionType", "==", "comment"),
            where("type", "==", "plus")
          );
          const plusSnap = await getDocs(qCommentPlus);
          if (!plusSnap.empty) {
            await deductInteractionPoints(commentObj.authorId, 5, "Trừ điểm: Xóa bình luận trước 48h", data.id, "uncomment");
            if (data.authorId && data.authorId !== commentObj.authorId) {
              await deductInteractionPoints(data.authorId, 5, `Trừ điểm: Bình luận bị xóa bởi ${commentObj.authorName} trước 48h`, data.id, "received_uncomment");
            }
          }
        }
      }

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
    const hasDisliked = comment.dislikedBy?.includes(currentUser.uid);
    try {
      if (hasLiked) {
        await updateDoc(commentRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1)
        });
      } else {
        const updates: any = {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1)
        };
        if (hasDisliked) {
          updates.dislikedBy = arrayRemove(currentUser.uid);
          updates.dislikesCount = increment(-1);
        }
        await updateDoc(commentRef, updates);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDislikeComment = async (comment: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser) return;
    const commentRef = doc(db, "posts", data.id, "comments", comment.id);
    const hasDisliked = comment.dislikedBy?.includes(currentUser.uid);
    const hasLiked = comment.likedBy?.includes(currentUser.uid);
    try {
      if (hasDisliked) {
        await updateDoc(commentRef, {
          dislikedBy: arrayRemove(currentUser.uid),
          dislikesCount: increment(-1)
        });
      } else {
        const updates: any = {
          dislikedBy: arrayUnion(currentUser.uid),
          dislikesCount: increment(1)
        };
        if (hasLiked) {
          updates.likedBy = arrayRemove(currentUser.uid);
          updates.likesCount = increment(-1);
        }
        await updateDoc(commentRef, updates);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== data.authorId) return;
    
    if (window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) {
      try {
        // Kiểm tra trừ điểm nếu là bài viết chia sẻ bị xoá trước 48h
        if (data.sharedFrom) {
          const now = new Date();
          const postTime = data.createdAt?.toDate 
            ? data.createdAt.toDate() 
            : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date());
          const diffInHours = (now.getTime() - postTime.getTime()) / 3600000;

          if (diffInHours < 48) {
            // Kiểm tra xem đã từng tích điểm chia sẻ bài viết này chưa
            const qSharePlus = query(
              collection(db, "point_transactions"),
              where("userId", "==", currentUser.uid),
              where("postId", "==", data.sharedFrom),
              where("actionType", "==", "share"),
              where("type", "==", "plus")
            );
            const plusSnap = await getDocs(qSharePlus);
            if (!plusSnap.empty) {
              await deductInteractionPoints(currentUser.uid, 10, "Trừ điểm: Xóa bài viết chia sẻ trước 48h", data.sharedFrom, "unshare");
              const origAuthorId = data.originalAuthorId || data.originalPost?.authorId;
              if (origAuthorId && origAuthorId !== currentUser.uid) {
                await deductInteractionPoints(origAuthorId, 10, `Trừ điểm: Bài chia sẻ bị xóa bởi ${currentUser.displayName || "Thành viên"} trước 48h`, data.sharedFrom, "received_unshare");
              }
            }
          }
        }

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
        privacy: editPrivacy,
        status: "pending" // Bắt buộc chuyển về pending để admin duyệt lại
      });
      data.content = editContent.trim();
      data.privacy = editPrivacy;
      data.status = "pending"; // Cập nhật local
      setIsEditing(false);
      openSnackbar({ text: "Đã lưu và gửi yêu cầu phê duyệt lại", type: "success" });
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

  const commentMap = new Map();
  comments.forEach(c => commentMap.set(c.id, c));
  const rootComments: any[] = [];
  const repliesMap = new Map<string, any[]>();
  comments.forEach(c => {
    if (!c.replyToId) {
      rootComments.push(c);
    } else {
      let rootId = c.rootCommentId;
      if (!rootId) {
        let current = c;
        while (current.replyToId && commentMap.has(current.replyToId)) {
          current = commentMap.get(current.replyToId);
        }
        rootId = current.id;
      }
      if (!repliesMap.has(rootId)) {
        repliesMap.set(rootId, []);
      }
      repliesMap.get(rootId)!.push(c);
    }
  });

  const renderComment = (cmt: any, isReply = false) => (
    <Box 
      key={cmt.id} 
      className={`flex space-x-2 ${isReply ? 'mt-3' : 'mb-1'}`}
      onTouchStart={() => handleTouchStart(cmt)}
      onTouchEnd={handleTouchEnd}
      onMouseDown={() => handleTouchStart(cmt)}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      <Avatar src={getValidAvatar(cmt.authorAvatar, cmt.authorId)} size={isReply ? 24 : 32} className="flex-shrink-0 mt-1" />
      <Box className="flex-1 flex flex-col">
        <Box className="bg-gray-100 px-3 py-2 rounded-2xl w-fit max-w-[100%] active:bg-gray-200 transition-colors">
          <Text className="font-bold text-[14px] text-gray-800">{cmt.authorName || "Người dùng"}</Text>
          <Text className="text-[14px] text-gray-800">{cmt.content}</Text>
        </Box>
        <Box className="flex items-center space-x-4 mt-1.5 ml-2">
          <Box className="flex items-center space-x-1 cursor-pointer" onClick={(e) => handleLikeComment(cmt, e)}>
            <Text size="xSmall" className={`font-semibold ${cmt.likedBy?.includes(currentUser?.uid) ? "text-[#14502e]" : "text-gray-500"}`}>Thích</Text>
            {cmt.likesCount > 0 && <Text size="xSmall" className="text-gray-500">{cmt.likesCount}</Text>}
          </Box>
          <Box className="flex items-center space-x-1 cursor-pointer" onClick={(e) => handleDislikeComment(cmt, e)}>
            <Text size="xSmall" className={`font-semibold ${cmt.dislikedBy?.includes(currentUser?.uid) ? "text-red-600" : "text-gray-500"}`}>Không thích</Text>
            {cmt.dislikesCount > 0 && <Text size="xSmall" className="text-gray-500">{cmt.dislikesCount}</Text>}
          </Box>
          <Text size="xSmall" className="text-gray-500 font-semibold cursor-pointer" onClick={() => setReplyingTo(cmt)}>Trả lời</Text>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box className="bg-white mx-3 mb-4 pt-4 pb-2 rounded-2xl shadow-sm border border-gray-100">
      {data.sharedFrom && data.originalPost && (
        <Box className="px-4 pb-2 border-b border-gray-100/50 mb-3 flex items-center space-x-1.5 text-xs text-gray-500">
          <Icon icon="zi-share" size={14} className="text-gray-400" />
          <span>đã chia sẻ bài viết của <span className="font-bold text-gray-700">{data.originalPost.authorName}</span></span>
        </Box>
      )}
      {/* Header */}
      <Box className="flex items-center justify-between px-4 mb-2">
        <Box className="flex items-center space-x-2">
          <Avatar 
            src={resolvedAuthorAvatar} 
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
            <Box className="flex items-center space-x-1 flex-wrap">
              <Text.Title 
                className="font-bold text-gray-800 text-[15px] leading-tight hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (data.authorId) {
                    navigate(`/profile?id=${data.authorId}`);
                  }
                }}
              >
                {resolvedAuthorName}
              </Text.Title>
              {data.authorId !== currentUser?.uid && !loadingFollow && (
                <span 
                  className="text-xs font-semibold cursor-pointer active:opacity-75 select-none"
                  onClick={handleFollowToggle}
                  style={{ color: isFollowing ? "#9ca3af" : "#14502e" }}
                >
                  <span className="text-gray-400 mx-1 font-normal">•</span>
                  {isFollowing ? "Đang theo dõi" : "Theo dõi"}
                </span>
              )}
              {/* @ts-ignore */}
              {data.location && (
                <span className="text-gray-500 text-xs flex items-center font-normal ml-1">
                  <svg className="w-3.5 h-3.5 text-red-500 mr-0.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  đang ở <span className="font-semibold text-gray-700 ml-1">{data.location}</span>
                </span>
              )}
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
                {data.authorId === currentUser?.uid && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ml-2 ${
                    data.status === 'pending' 
                      ? 'bg-yellow-500 text-white' 
                      : data.status === 'rejected'
                        ? 'bg-red-600 text-white'
                        : 'bg-green-600 text-white'
                  }`}>
                    {data.status === 'pending' 
                      ? 'Chờ duyệt' 
                      : data.status === 'rejected'
                        ? 'Bị từ chối'
                        : 'Đã duyệt'}
                  </span>
                )}
              </Text>
            )}
          </Box>
        </Box>
        {!isEditing ? (
          <CustomIcon icon="zi-more-horiz" className="text-gray-400 cursor-pointer p-2" onClick={() => setShowMenu(true)} />
        ) : (
          <Box className="flex items-center space-x-2">
            <Text className="text-gray-400 font-medium text-[15px] cursor-pointer p-2 active:opacity-70" onClick={() => setIsEditing(false)}>Hủy</Text>
            <Text className="text-[#14502e] font-bold text-[15px] cursor-pointer p-2 active:opacity-70" onClick={handleSaveEdit}>Lưu</Text>
          </Box>
        )}
      </Box>

      {/* Content, Images, Video, Product */}
      {data.sharedFrom && data.originalPost ? (
        <>
          <Box className="px-4 mb-2">
            <Text className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap">
              {data.content}
            </Text>
          </Box>
          <Box className="mx-4 mb-3 p-3 bg-gray-50 border border-gray-150 rounded-xl">
            {/* Original Author Info */}
            <Box className="flex items-center space-x-2 mb-2">
              <Avatar src={getValidAvatar(data.originalPost.authorAvatar, data.originalPost.authorId)} size={28} className="border border-gray-200" />
              <Text className="font-bold text-gray-800 text-[13px]">{data.originalPost.authorName}</Text>
            </Box>
            {/* Original Content */}
            {data.originalPost.content && (
              <Text className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap mb-2">
                {data.originalPost.content}
              </Text>
            )}
            {/* Original Images Grid */}
            {data.originalPost.images && data.originalPost.images.length > 0 && (
              <Box className="mb-2">
                <ImageGrid 
                  images={data.originalPost.images} 
                  onImageClick={(idx) => {
                    setActiveImageIndex(idx);
                    setShowOverlay(true);
                    setShowImageViewer(true);
                  }} 
                />
              </Box>
            )}
            {/* Original Video Player */}
            {data.originalPost.videoUrl && (
              <Box className="mb-2">
                <Box className="w-full rounded-lg overflow-hidden border border-gray-200/50 bg-black flex justify-center items-center shadow-sm">
                  <video 
                    src={data.originalPost.videoUrl} 
                    controls 
                    playsInline
                    className="w-full object-contain max-h-64" 
                    poster={data.originalPost.images?.[0] || ""}
                  />
                </Box>
              </Box>
            )}
            {/* Original Attached Product */}
            {data.originalPost.attachedProduct && (
              <Box 
                className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-start space-x-2.5 cursor-pointer hover:bg-gray-100/50 transition"
                onClick={() => {
                  const prod = {
                    id: data.originalPost.attachedProduct.id,
                    title: data.originalPost.attachedProduct.name || data.originalPost.attachedProduct.title,
                    price: data.originalPost.attachedProduct.price,
                    image: data.originalPost.attachedProduct.image,
                    images: [data.originalPost.attachedProduct.image],
                  };
                  navigate(`/detail/${data.originalPost.attachedProduct.id}`, { state: { product: prod, referrerId: data.authorId } });
                }}
              >
                {data.originalPost.attachedProduct.image && (
                  <img 
                    src={data.originalPost.attachedProduct.image} 
                    alt={data.originalPost.attachedProduct.name || data.originalPost.attachedProduct.title} 
                    className="w-12 h-12 object-cover rounded border border-gray-150 shrink-0" 
                  />
                )}
                <Box className="flex-1 min-w-0 flex flex-col justify-between min-h-[48px]">
                  <Box>
                    <Text className="font-semibold text-gray-800 text-[13px] line-clamp-2 leading-tight">
                      {data.originalPost.attachedProduct.name || data.originalPost.attachedProduct.title}
                    </Text>
                  </Box>
                  <Box className="flex items-center justify-between mt-1">
                    <Text className="text-red-600 text-[11px] font-bold">
                      {Number(data.originalPost.attachedProduct.price || 0).toLocaleString('vi-VN')}đ
                    </Text>
                    <Box className="bg-[#14502e] text-white px-2 py-1 rounded-full text-[9px] font-semibold flex items-center space-x-0.5 shrink-0 shadow-sm active:opacity-90">
                      <span>Xem sản phẩm</span>
                      <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42 5.43 5.43H5v2z"/></svg>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </>
      ) : (
        <>
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

          {/* Video Player */}
          {/* @ts-ignore */}
          {data.videoUrl && (
            <Box className="mb-3 px-4">
              <Box className="w-full rounded-lg overflow-hidden border border-gray-200/50 bg-black flex justify-center items-center shadow-sm">
                <video 
                  src={data.videoUrl} 
                  controls 
                  playsInline
                  className="w-full object-contain max-h-80" 
                  poster={data.images?.[0] || ""}
                />
              </Box>
            </Box>
          )}

          {/* @ts-ignore */}
          {data.attachedProduct && (
            <Box 
              className="mx-4 mb-3 bg-gray-50 border border-gray-200/60 rounded-xl p-3 flex items-start space-x-3 cursor-pointer hover:bg-gray-100 transition active:scale-[0.99]"
              onClick={() => {
                const prod = {
                  id: data.attachedProduct.id,
                  title: data.attachedProduct.name || data.attachedProduct.title,
                  price: data.attachedProduct.price,
                  image: data.attachedProduct.image,
                  images: [data.attachedProduct.image],
                };
                navigate(`/detail/${data.attachedProduct.id}`, { state: { product: prod, referrerId: data.authorId } });
              }}
            >
              {data.attachedProduct.image && (
                <img 
                  src={data.attachedProduct.image} 
                  alt={data.attachedProduct.name || data.attachedProduct.title} 
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0" 
                />
              )}
              <Box className="flex-1 min-w-0 flex flex-col justify-between min-h-[64px]">
                <Box>
                  <Text className="font-semibold text-gray-800 text-[14px] line-clamp-2 leading-tight">
                    {data.attachedProduct.name || data.attachedProduct.title}
                  </Text>
                </Box>
                <Box className="flex items-center justify-between mt-2">
                  <Text className="text-red-600 text-sm font-bold">
                    {Number(data.attachedProduct.price || 0).toLocaleString('vi-VN')}đ
                  </Text>
                  <Box className="bg-[#14502e] text-white px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center space-x-1 shrink-0 shadow-sm active:opacity-90">
                    <span>Xem sản phẩm</span>
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42 5.43 5.43H5v2z"/></svg>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </>
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
        <Box className="flex flex-1 justify-center items-center space-x-2 py-2 rounded-lg cursor-pointer active:bg-gray-50" onClick={() => isRealUser ? handleLike() : setShowAuth(true)}>
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
                  <Avatar src={resolvedAuthorAvatar} size={36} className="border border-white/30" />
                  <Box>
                    <Text className="text-white font-bold text-sm leading-tight">{resolvedAuthorName}</Text>
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
                    <Box className="flex flex-1 justify-center items-center space-x-2 py-2 cursor-pointer active:bg-white/10 rounded-lg" onClick={(e) => { e.stopPropagation(); isRealUser ? handleLike() : setShowAuth(true); }}>
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
        <Box className="p-4 flex flex-col space-y-1 max-h-[60vh] overflow-y-auto">
          {rootComments.length === 0 ? (
            <Text className="text-center text-gray-400 py-4">Chưa có bình luận nào.</Text>
          ) : (
            rootComments.map((rootCmt) => (
              <Box key={rootCmt.id} className="mb-4">
                {renderComment(rootCmt, false)}
                {repliesMap.has(rootCmt.id) && repliesMap.get(rootCmt.id)!.length > 0 && (
                  <Box className="ml-10">
                    {repliesMap.get(rootCmt.id)!.map(reply => renderComment(reply, true))}
                  </Box>
                )}
              </Box>
            ))
          )}
        </Box>
        <Box className="p-3 pb-24 border-t border-gray-200 flex flex-col bg-white">
          {replyingTo && (
            <Box className="flex items-center justify-between mb-2 px-2 bg-gray-50 rounded p-1">
              <Text size="xSmall" className="text-gray-600">Đang trả lời <span className="font-bold">{replyingTo.authorName}</span></Text>
              <CustomIcon icon="zi-close" className="text-gray-400 cursor-pointer" size={16} onClick={() => setReplyingTo(null)} />
            </Box>
          )}
          <Box className="flex space-x-3 items-center">
            <Avatar src={currentUser?.photoURL || getDefaultAvatar(currentUser?.uid)} size={36} className="flex-shrink-0" />
            <Box className="flex-1 bg-gray-100 rounded-full px-4 py-1 flex items-center">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-transparent border-none p-0 h-9"
                placeholder="Viết bình luận..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              />
            </Box>
            <button
              onClick={handleSendComment}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                commentText.trim() 
                  ? "bg-[#14502e] text-white shadow-sm active:scale-95" 
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <CustomIcon icon="zi-send-solid" size={16} />
            </button>
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
          <Box className="flex flex-col items-center cursor-pointer" onClick={async () => {
            if (!currentUser || currentUser.email === "guest@campus.com") {
              setShowShare(false);
              setShowAuth(true);
              return;
            }
            setShowShare(false);
            try {
              let profileName = "Người dùng";
              let profileAvatar = getDefaultAvatar(currentUser?.uid);

              const userRef = doc(db, "users", currentUser.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                profileName = userData.fullName || userData.name || profileName;
                profileAvatar = userData.avatar || profileAvatar;
              } else {
                const shopRef = doc(db, "shops", currentUser.uid);
                const shopSnap = await getDoc(shopRef);
                if (shopSnap.exists()) {
                  const shopData = shopSnap.data();
                  profileName = shopData.shopName || shopData.name || profileName;
                  profileAvatar = shopData.shopAvatar || shopData.avatar || profileAvatar;
                }
              }

              if (profileName === "Người dùng") {
                profileName = currentUser.displayName || currentUser.email?.split('@')[0] || profileName;
              }
              if (profileAvatar === getDefaultAvatar(currentUser?.uid)) {
                profileAvatar = currentUser.photoURL || profileAvatar;
              }

              await addDoc(collection(db, "posts"), {
                authorId: currentUser.uid,
                authorName: profileName,
                authorAvatar: profileAvatar,
                content: `Đã chia sẻ bài viết của ${data.authorName}`,
                sharedFrom: data.id,
                originalAuthorId: data.originalAuthorId || data.originalPost?.authorId || data.authorId || "",
                originalPost: {
                  id: data.id,
                  authorId: data.authorId || "",
                  authorName: data.authorName,
                  authorAvatar: data.authorAvatar,
                  content: data.content || "",
                  images: data.images || [],
                  videoUrl: data.videoUrl || null,
                  attachedProduct: data.attachedProduct || null
                },
                createdAt: serverTimestamp(),
                likesCount: 0,
                likedBy: [],
                commentsCount: 0,
                sharesCount: 0,
                status: "approved"
              });

              await updateDoc(doc(db, "posts", data.id), { sharesCount: increment(1) });
              setSharesCount(prev => prev + 1);

              // Một bài chỉ được tính 1 lần chia sẻ lên tường
              const qShare = query(
                collection(db, "point_transactions"),
                where("userId", "==", currentUser.uid),
                where("postId", "==", data.id),
                where("actionType", "==", "share"),
                where("type", "==", "plus")
              );
              const shareSnap = await getDocs(qShare);
              const isFirstShareOnPost = shareSnap.empty;

              if (isFirstShareOnPost && data.authorId !== currentUser.uid) {
                // Tích điểm tương tác cho người chia sẻ bài viết (+10 điểm)
                await awardInteractionPoints(currentUser.uid, 10, "Thưởng tương tác: Chia sẻ bài viết lên tường", data.id, "share");
                // Tích điểm tương tác cho tác giả bài viết
                if (data.authorId) {
                  await awardInteractionPoints(data.authorId, 10, `Điểm tương tác: Bài viết được chia sẻ bởi ${currentUser.displayName || "Thành viên"}`, data.id, "received_share");
                }
              }
              openSnackbar({ text: "Đã chia sẻ bài viết lên tường của bạn!", type: "success" });
            } catch (error) {
              console.error("Lỗi chia sẻ bài viết:", error);
              openSnackbar({ text: "Không thể chia sẻ bài viết", type: "error" });
            }
          }}>
            <Box className="w-14 h-14 bg-[#14502e] rounded-full flex items-center justify-center mb-2 text-white shadow-md"><CustomIcon icon="zi-share" className="text-2xl" /></Box>
            <Text size="xSmall" className="text-center font-medium text-gray-600">Lên tường</Text>
          </Box>
          <Box className="flex flex-col items-center cursor-pointer" onClick={async () => {
            const postDesc = data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + "..." : data.content) : "Xem bài viết trên Campus Green Biz";
            const postThumb = data.images && data.images.length > 0 ? data.images[0] : "https://stc-zalopay-images.zg.vn/v2/0/images/avatars/default_avatar.png";
            try {
              await openShareSheet({
                type: "zmp_deep_link",
                data: {
                  title: "Campus Green Biz - Bài viết",
                  description: postDesc,
                  thumbnail: postThumb,
                  path: `/post-detail?id=${data.id}`
                }
              } as any);
              setShowShare(false);
              try {
                await updateDoc(doc(db, "posts", data.id), { sharesCount: increment(1) });
                setSharesCount(prev => prev + 1);
              } catch (e) {}
            } catch (error) {
              console.warn("Exception in openShareSheet:", error);
              openSnackbar({ text: "Không thể mở danh sách chia sẻ Zalo.", type: "error" });
            }
          }}>
            <Box className="w-14 h-14 bg-[#0068ff] rounded-full flex items-center justify-center mb-2 text-white shadow-md"><CustomIcon icon="zi-chat" className="text-2xl" /></Box>
            <Text size="xSmall" className="text-center font-medium text-gray-600">Gửi bạn bè</Text>
          </Box>
          <Box className="flex flex-col items-center cursor-pointer" onClick={async () => {
            const shareLink = `https://zalo.me/s/3525851935148341014/?path=/post-detail?id=${data.id}`;
            const postDesc = data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + "..." : data.content) : "Xem chi tiết bài viết";
            const clipboardText = `Campus Green Biz - Bài viết\n${postDesc}\nLink xem: ${shareLink}`;
            
            try {
              await navigator.clipboard.writeText(clipboardText); 
              openSnackbar({ text: "Đã sao chép nội dung bài viết và link!" }); 
              setShowShare(false);
              try {
                await updateDoc(doc(db, "posts", data.id), { sharesCount: increment(1) });
                setSharesCount(prev => prev + 1);
              } catch (e) {}
            } catch (err) {
              console.warn("Lỗi sao chép:", err);
              openSnackbar({ text: "Lỗi sao chép liên kết", type: "error" }); 
            }
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
