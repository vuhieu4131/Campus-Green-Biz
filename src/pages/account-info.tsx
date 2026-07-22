import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Input, Button, useSnackbar, Text, Icon } from "zmp-ui";
import { getDefaultAvatar } from "../utils/avatar";
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/compression";

const AccountInfoPage: FC = () => {
  const { openSnackbar } = useSnackbar();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [role, setRole] = useState("Thành viên");
  const [isUploading, setIsUploading] = useState(false);
  const [docId, setDocId] = useState("");
  const [collectionName, setCollectionName] = useState("users");
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
          setAvatar(data.avatar || "");
        } else {
          setName(finalPhone);
          setPhone(finalPhone);
          setAvatar("");
        }
      } else {
        setCurrentUser(null);
        setName("Vũ Hoàng Hiệp (Mẫu)");
        setPhone("0782431949");
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
      
      await setDoc(docRef, {
        fullName: name,
        name: name,
        shopName: name, // Đồng bộ luôn cho trường hợp là Shop
        managerName: name, // Đồng bộ luôn cho người quản lý
        phone: phone,
        avatar: avatar
      }, { merge: true });

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

        <Box className="mb-6">
          <Text className="mb-2 text-sm text-gray-700">Số điện thoại</Text>
          <Input 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="Nhập số điện thoại" 
            type="text"
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
    </Page>
  );
};

export default AccountInfoPage;
