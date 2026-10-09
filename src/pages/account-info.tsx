import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Input, Button, useSnackbar, Text, Icon, useNavigate } from "zmp-ui";
import { getDefaultAvatar } from "../utils/avatar";
import {
  getCachedUserData,
  getInitialCachedUserData,
  setCachedUserData,
  updateCachedUserData,
} from "../state";
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged, User, verifyBeforeUpdateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/compression";

const getRoleLabel = (cached: any): string => {
  if (!cached) return "Thành viên";
  if (cached.role === "provider" || cached.collectionName === "shops") return "Nhà phân phối";
  if (cached.role === "admin") return "Quản trị viên";
  if (cached.branchInfo) return "Quản lý chi nhánh";
  return "Thành viên";
};

const AccountInfoPage: FC = () => {
  const { openSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const initialCached = getInitialCachedUserData(auth.currentUser);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [name, setName] = useState(() => initialCached?.fullName || initialCached?.name || initialCached?.shopName || "");
  const [phone, setPhone] = useState(() => initialCached?.phone || "");
  const [email, setEmail] = useState(() => initialCached?.email || auth.currentUser?.email || "");
  const [avatar, setAvatar] = useState(() => initialCached?.avatar || initialCached?.shopAvatar || "");
  const [role, setRole] = useState(() => getRoleLabel(initialCached));
  const [isUploading, setIsUploading] = useState(false);
  const [showVerifyEmailModal, setShowVerifyEmailModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [docId, setDocId] = useState(() => initialCached?.id || auth.currentUser?.uid || "");
  const [collectionName, setCollectionName] = useState(() =>
    initialCached?.role === "provider" || initialCached?.collectionName === "shops" ? "shops" : "users"
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      setIsUploading(true);
      try {
        const filename = `avatars/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        const compressedFile = await compressImage(file);
        await uploadBytes(storageRef, compressedFile);
        const url = await getDownloadURL(storageRef);
        setAvatar(url);
        openSnackbar({ text: "Đã tải ảnh lên thành công!", type: "success" });
      } catch (error) {
        console.error("Lỗi tải ảnh:", error);
        openSnackbar({ text: "Lỗi tải ảnh. Vui lòng thử lại.", type: "error" });
      } finally {
        setIsUploading(false);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const cached = getCachedUserData(user.uid);
        if (cached) {
          setName(cached.fullName || cached.name || cached.shopName || "");
          setPhone(cached.phone || "");
          setEmail(cached.email || user.email || "");
          setAvatar(cached.avatar || cached.shopAvatar || "");
          setRole(getRoleLabel(cached));
        }
        
        let finalPhone = user.phoneNumber || user.email?.split('@')[0] || "";
        if (finalPhone.startsWith("+84")) {
          finalPhone = "0" + finalPhone.substring(3);
        }

        let currentColl = "users";
        let currentId = user.uid;
        
        let docRef = doc(db, "users", user.uid);
        let docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          // Check shops
          try {
            const qShop = query(collection(db, "shops"), where("phone", "==", finalPhone));
            const shopSnap = await getDocs(qShop);
            if (!shopSnap.empty) {
              docSnap = shopSnap.docs[0];
              currentColl = "shops";
              currentId = shopSnap.docs[0].id;
              setRole("Nhà phân phối");
            } else {
              // Check fallback users by phone (managers)
              const qUser = query(collection(db, "users"), where("phone", "==", finalPhone));
              const userSnap = await getDocs(qUser);
              if (!userSnap.empty) {
                docSnap = userSnap.docs[0];
                currentColl = "users";
                currentId = userSnap.docs[0].id;
                setRole(docSnap.data()?.branchInfo ? "Quản lý chi nhánh" : "Thành viên");
              }
            }
          } catch (err) {
            console.error("Lỗi tải thông tin tài khoản:", err);
          }
        } else {
          const data = docSnap.data() || {};
          if (data.role === "admin") {
            setRole("Quản trị viên");
          } else if (data.branchInfo) {
            setRole("Quản lý chi nhánh");
          } else {
            setRole("Thành viên");
          }
        }
        
        setCollectionName(currentColl);
        setDocId(currentId);
        
        if (docSnap && docSnap.exists()) {
          const data = docSnap.data();
          setName(data.fullName || data.name || finalPhone);
          setPhone(data.phone || finalPhone);
          setEmail(data.email || user.email || "");
          setAvatar(data.avatar || "");
          setCachedUserData(user.uid, {
            id: currentId,
            collectionName: currentColl,
            ...data,
            role: currentColl === "shops" ? "provider" : (data.role || (data.branchInfo ? "member" : "user")),
          });
        } else {
          setName(finalPhone);
          setPhone(finalPhone);
          setEmail(user.email || "");
          setAvatar("");
        }
      } else {
        setCurrentUser(null);
        setName("Vũ Hoàng Hiệp (Mẫu)");
        setPhone("0782431949");
        setEmail("");
        setAvatar("");
        setRole("Thành viên");
        setCollectionName("users");
        setDocId("");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!currentUser) {
      openSnackbar({
        text: "Bạn chưa đăng nhập!",
        type: "error",
        duration: 3000
      });
      return;
    }

    try {
      const targetColl = collectionName || "users";
      const targetId = docId || currentUser.uid;
      const docRef = doc(db, targetColl, targetId);

      // Cập nhật email trong Firebase Auth nếu người dùng có thay đổi và có nhập email
      if (email && email.includes("@") && !email.includes("@campus.com")) {
        if (currentUser.email !== email) {
          try {
            await verifyBeforeUpdateEmail(currentUser, email);
            setPendingEmail(email);
            setShowVerifyEmailModal(true);
          } catch (e: any) {
            console.error("Lỗi cập nhật email Auth:", e);
            if (e.code === 'auth/requires-recent-login') {
              openSnackbar({ text: "Vui lòng đăng xuất và đăng nhập lại để thay đổi Email!", type: "error" });
              return;
            } else if (e.code === 'auth/email-already-in-use') {
              openSnackbar({ text: "Email này đã được sử dụng cho tài khoản khác!", type: "error" });
              return;
            } else {
              openSnackbar({ text: "Lỗi hệ thống: Vui lòng liên hệ Admin. " + e.message, type: "error" });
              return;
            }
          }
        }
      }
      
      await setDoc(docRef, {
        fullName: name,
        name: name,
        shopName: name, // Đồng bộ luôn cho trường hợp là Shop
        managerName: name, // Đồng bộ luôn cho người quản lý
        phone: phone,
        email: email,
        avatar: avatar
      }, { merge: true });

      updateCachedUserData(currentUser.uid, {
        fullName: name,
        name: name,
        shopName: name,
        managerName: name,
        phone: phone,
        email: email,
        avatar: avatar,
      });

      openSnackbar({
        text: "Cập nhật thông tin thành công!",
        type: "success",
        duration: 3000
      });
    } catch (error) {
      console.error(error);
      openSnackbar({
        text: "Có lỗi xảy ra khi cập nhật!",
        type: "error",
        duration: 3000
      });
    }
  };

  return (
    <Page className="bg-white">
      <Header title="Thông tin tài khoản" showBackIcon={true} />
      
      {/* Display Section */}
      <Box className="flex flex-col items-center mt-6">
        <Box 
          className="relative mb-3 cursor-pointer"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <img 
            src={avatar || getDefaultAvatar(currentUser?.uid)}
            alt="Avatar" 
            className={`w-28 h-28 rounded-full object-cover ${isUploading ? 'opacity-50' : ''}`} 
          />
          
          <Box className="absolute bottom-0 right-0 bg-[#14502e] text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-md">
            <Icon icon="zi-camera" size={16} />
          </Box>
          
          {isUploading && (
            <Box className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </Box>
          )}
        </Box>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={handleAvatarChange} 
        />
        <Text.Title className="text-xl font-bold mb-1">{name || "Người dùng"}</Text.Title>
        <Text className="text-gray-800 text-base mb-1">{phone || "Chưa có sđt"}</Text>
        <Text className="font-bold text-sm text-gray-800">{role}</Text>
      </Box>

      {/* Divider */}
      <Box className="mx-4 my-6 border-b border-gray-400" />

      {/* Update Section */}
      <Box className="mx-4">
        <Text.Title className="text-lg font-bold mb-4">Cập nhật thông tin</Text.Title>
        
        <Box className="mb-4">
          <Text className="mb-2 text-sm text-gray-700">Tên hiển thị</Text>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nhập tên hiển thị" 
            className="bg-gray-100 border-none rounded-xl px-4 py-2"
          />
        </Box>

        <Box className="mb-4">
          <Text className="mb-2 text-sm text-gray-700">Số điện thoại</Text>
          <Input 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="Nhập số điện thoại" 
            type="text"
            className="bg-gray-100 border-none rounded-xl px-4 py-2"
          />
        </Box>

        <Box className="mb-6">
          <Text className="mb-2 text-sm text-gray-700">Email (Dùng để khôi phục mật khẩu)</Text>
          <Input 
            value={email.includes("@campus.com") ? "" : email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="Nhập Email thực của bạn" 
            type="email"
            className="bg-gray-100 border-none rounded-xl px-4 py-2"
          />
        </Box>

        <Button 
          fullWidth 
          onClick={handleSave} 
          className="rounded-xl font-bold text-base py-3"
          style={{ backgroundColor: "#8c1515", color: "white" }}
        >
          Lưu thay đổi
        </Button>
      </Box>

      {/* MODAL XÁC THỰC EMAIL */}
      {showVerifyEmailModal && (
        <Box className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center p-4">
          <Box className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center animate-fade-in text-center">
            <Box className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Icon icon="zi-mail" className="text-blue-500 text-3xl" />
            </Box>
            <Text.Title className="text-lg font-bold mb-2 text-gray-800">
              Xác thực Email
            </Text.Title>
            <Text className="text-gray-600 text-sm mb-6 leading-relaxed">
              Một email chứa link xác nhận vừa được gửi đến <strong className="text-blue-600">{pendingEmail}</strong>. 
              Vui lòng kiểm tra hộp thư và bấm vào link để hoàn tất việc đổi email!
            </Text>
            
            <Box className="flex space-x-3 w-full">
              <Button 
                variant="secondary"
                fullWidth 
                className="py-2.5 rounded-xl font-medium"
                onClick={() => {
                  setShowVerifyEmailModal(false);
                  navigate("/store");
                }}
              >
                Xác minh sau
              </Button>
              <Button 
                fullWidth 
                className="py-2.5 rounded-xl font-medium text-white border-none"
                style={{ backgroundColor: "#8b191b" }}
                onClick={() => {
                  window.location.href = `mailto:${pendingEmail}`;
                  setShowVerifyEmailModal(false);
                }}
              >
                Mở hòm thư
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Page>
  );
};

export default AccountInfoPage;
