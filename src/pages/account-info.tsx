import React, { FC, useState, useEffect } from "react";
import { Page, Header, Box, Input, Button, useSnackbar, Text, Icon } from "zmp-ui";
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const AccountInfoPage: FC = () => {
  const { openSnackbar } = useSnackbar();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [role, setRole] = useState("Thành viên");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      setIsUploading(true);
      try {
        const filename = `avatars/${currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, file);
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
        
        let docRef = doc(db, "users", user.uid);
        let docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          docRef = doc(db, "shops", user.uid);
          docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setRole("Nhà phân phối");
          }
        }
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.fullName || data.name || user.email?.split('@')[0] || "");
          setPhone(data.phone || user.email?.split('@')[0] || "");
          setAvatar(data.avatar || "");
        } else {
          setName(user.email?.split('@')[0] || "");
          setPhone(user.email?.split('@')[0] || "");
          setAvatar("");
        }
      } else {
        setCurrentUser(null);
        setName("Vũ Hoàng Hiệp (Mẫu)");
        setPhone("0782431949");
        setAvatar("");
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
      let docRef = doc(db, "users", currentUser.uid);
      let docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        docRef = doc(db, "shops", currentUser.uid);
      }
      
      await updateDoc(docRef, {
        fullName: name,
        phone: phone,
        avatar: avatar
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
          {avatar ? (
            <img 
              src={avatar} 
              alt="Avatar" 
              className={`w-28 h-28 rounded-full object-cover ${isUploading ? 'opacity-50' : ''}`} 
            />
          ) : (
            <Box className={`w-28 h-28 rounded-full bg-[#e4e6eb] flex items-center justify-center overflow-hidden ${isUploading ? 'opacity-50' : ''}`}>
              <Icon icon="zi-user-solid" className="text-white" style={{ fontSize: "100px", marginTop: "28px" }} />
            </Box>
          )}
          
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
