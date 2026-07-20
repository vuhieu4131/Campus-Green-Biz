import CustomIcon from '../components/custom-icon';
import React, { FC, useState } from "react";
import { Box, Text, Input, Button, Switch, Avatar, Icon, useNavigate } from "zmp-ui"; 
import { useRecoilValueLoadable } from "recoil";
import { userState } from "state";
import { auth, db } from "../firebase"; 
import { getDefaultAvatar } from "../utils/avatar"; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
// 👉 ĐÃ BỔ SUNG: Thêm collection, query, where, getDocs để hỗ trợ quét dữ liệu ngoại lệ
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp, increment } from "firebase/firestore"; 
import { openChat } from "zmp-sdk/apis";

interface AuthOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthOverlay: FC<AuthOverlayProps> = ({ visible, onClose }) => {
  const navigate = useNavigate(); 
  const userInfoLoadable = useRecoilValueLoadable(userState);
  const userInfo = userInfoLoadable.state === "hasValue" ? userInfoLoadable.contents : null;

  const [formType, setFormType] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("0000869131");
  const [password, setPassword] = useState("123456");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isShopConfig, setIsShopConfig] = useState(false);

  if (!visible) return null;

  const handleLoginSubmit = async () => {
    // Luồng cho Admin cứng
    if (phone === "0000869131" && password === "123456") {
      try {
        const email = "0000869131@campus.com";
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (signInErr: any) {
          // Thử tạo mới nếu chưa tồn tại
          try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
          } catch (createErr: any) {
            if (createErr.code === "auth/email-already-in-use") {
              userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
              throw createErr;
            }
          }
        }

        const uid = userCredential.user.uid;
        // Đảm bảo document của admin tồn tại trong Firestore users collection với role: admin
        const adminRef = doc(db, "users", uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            phone: "0000869131",
            fullName: "Admin Hệ thống",
            role: "admin",
            avatar: "https://img.icons8.com/color/48/administrator-male.png",
            createdAt: new Date().toISOString()
          });
        } else if (adminSnap.data().role !== "admin") {
          await setDoc(adminRef, { role: "admin" }, { merge: true });
        }

        localStorage.setItem("isAdminBypass", "true");
        onClose(); 
        navigate("/admin-dashboard");
        return;
      } catch (error: any) {
        console.error("Lỗi xác thực admin cứng:", error);
        alert("Đăng nhập Admin thất bại. Lỗi: " + error.message);
        return;
      }
    }

    try {
      const email = `${phone}@campus.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // 👉 LẤY MÃ UID TỪ FIREBASE ĐỂ TÌM KIẾM
      const uid = userCredential.user.uid; 

      // 1. TÌM TRONG BẢNG "shops" BẰNG UID
      const shopRef = doc(db, "shops", uid);
      const shopSnap = await getDoc(shopRef);

      if (shopSnap.exists()) {
        alert("Chào mừng Nhà phân phối quay trở lại!");
        onClose(); 
        navigate("/profile"); 
        return; 
      }

      // 2. TÌM TRONG BẢNG "users" BẰNG UID
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        alert(`Đăng nhập thành công! Chào ${userSnap.data().fullName || "bạn"}`);
        onClose(); 
        return;
      } 
      
      // 3. LỚP CỨU CÁNH: Nếu UID không khớp (Dành riêng cho Shop bạn tự tạo bằng tay trên Firebase)
      const qShop = query(collection(db, "shops"), where("phone", "==", phone));
      const shopByPhoneSnap = await getDocs(qShop);
      if (!shopByPhoneSnap.empty) {
        alert("Chào mừng Nhà phân phối quay trở lại!");
        onClose(); 
        navigate("/profile"); 
        return;
      }

      alert("Đăng nhập thành công!");
      onClose(); 

    } catch (error: any) {
      alert("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!");
      console.error("Lỗi đăng nhập:", error.message);
    }
  };

  const handleRegisterSubmit = async () => {
    if (password !== confirmPassword) {
      alert("Mật khẩu nhập lại không khớp!");
      return;
    }
    
    if (phone.length < 9) {
      alert("Số điện thoại không hợp lệ!");
      return;
    }

    try {
      const email = `${phone}@campus.com`;
      
      // 1. Tạo tài khoản đăng nhập bên Xác thực (Auth)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // 👉 LẤY MÃ UID VỪA TẠO
      const uid = userCredential.user.uid; 

      let initialSpendingPoints = 5; // Mặc định nhận 5 điểm đăng ký mới
      let initialRankPoints = 5;
      const refPhone = referralCode.trim();

      if (refPhone) {
        try {
          let referrerRef: any = null;
          let referrerDocId = "";
          let referrerType: "user" | "shop" = "user";

          const qUser = query(collection(db, "users"), where("phone", "==", refPhone));
          const userSnap = await getDocs(qUser);
          if (!userSnap.empty) {
            referrerRef = doc(db, "users", userSnap.docs[0].id);
            referrerDocId = userSnap.docs[0].id;
            referrerType = "user";
          } else {
            const qShop = query(collection(db, "shops"), where("phone", "==", refPhone));
            const shopSnap = await getDocs(qShop);
            if (!shopSnap.empty) {
              referrerRef = doc(db, "shops", shopSnap.docs[0].id);
              referrerDocId = shopSnap.docs[0].id;
              referrerType = "shop";
            }
          }

          if (referrerRef) {
            let pointsToReferrer = 10;
            if (isShopConfig) {
              // Giới thiệu Shop: người giới thiệu +50, shop mới +10
              pointsToReferrer = 50;
              initialSpendingPoints = 10;
              initialRankPoints = 10;
            } else {
              // Giới thiệu User: người giới thiệu +10, user mới +5
              pointsToReferrer = 10;
              initialSpendingPoints = 5;
              initialRankPoints = 5;
            }

            await updateDoc(referrerRef, {
              spendingPoints: increment(pointsToReferrer),
              rankPoints: increment(pointsToReferrer)
            });

            await addDoc(collection(db, "point_transactions"), {
              userId: referrerDocId,
              type: "plus",
              amount: pointsToReferrer,
              description: `Thưởng giới thiệu thành viên mới: ${fullName || "Khách"} (${phone})`,
              walletType: "main",
              createdAt: serverTimestamp()
            });

            await addDoc(collection(db, "notifications"), {
              userId: referrerDocId,
              title: "Nhận điểm giới thiệu thành công",
              content: `Bạn được cộng +${pointsToReferrer} điểm ưu đãi từ việc giới thiệu thành viên ${fullName || "Khách"} (${phone}) thành công!`,
              type: "success",
              createdAt: serverTimestamp(),
              isRead: false
            });
          }
        } catch (err) {
          console.error("Lỗi cộng điểm giới thiệu:", err);
        }
      }

      const collectionName = isShopConfig ? "shops" : "users";

      // 2. LƯU DỮ LIỆU BẰNG MÃ UID
      await setDoc(doc(db, collectionName, uid), {
        phone: phone,
        fullName: fullName,
        referralCode: referralCode,
        isShopConfig: isShopConfig, 
        zaloName: userInfo?.name || "",
        spendingPoints: initialSpendingPoints,
        rankPoints: initialRankPoints,
        createdAt: new Date().toISOString(),
        ...(isShopConfig ? { status: "pending" } : {})
      });

      if (initialSpendingPoints > 0) {
        await addDoc(collection(db, "point_transactions"), {
          userId: uid,
          type: "plus",
          amount: initialSpendingPoints,
          description: refPhone ? `Thưởng nhập mã giới thiệu từ: ${refPhone}` : "Thưởng đăng ký thành viên mới",
          walletType: "main",
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, "notifications"), {
          userId: uid,
          title: "Thưởng thành viên mới",
          content: `Bạn được tặng +${initialSpendingPoints} điểm ưu đãi khi nhập mã giới thiệu từ ${refPhone}.`,
          type: "success",
          createdAt: serverTimestamp(),
          isRead: false
        });
      }

      if (isShopConfig) {
        alert("Đăng ký mở Gian hàng (Nhà phân phối) thành công!");
      } else {
        alert("Đăng ký thành viên thành công!");
      }
      
      onClose(); 
    } catch (error: any) {
      console.error("LỖI CHI TIẾT CỦA FIREBASE:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Số điện thoại này đã được đăng ký. Vui lòng đăng nhập!");
      } else {
        alert("Đăng ký thất bại. Lỗi: " + error.message);
      }
    }
  };

  return (
    <Box className="fixed inset-0 bg-white flex flex-col w-full h-full" style={{ zIndex: 99999 }}>
      <Box className="flex items-center p-4 pb-0" style={{ paddingTop: 'calc(var(--zaui-safe-area-inset-top, 40px) + 8px)' }}>
        <div onClick={onClose} className="cursor-pointer flex items-center space-x-1 p-1.5 pr-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors active:scale-95">
          <Icon icon="zi-arrow-left" className="text-gray-600 text-2xl" />
          <Text className="text-gray-700 font-medium text-sm">Quay lại</Text>
        </div>
      </Box>

      <Box className="flex-1 overflow-y-auto px-6 pb-8">
        <Box className="flex flex-col items-center mb-6">
          <Avatar src={getDefaultAvatar(phone)} size={80} className="mt-8 mb-4 shadow-md" />
          {formType === "login" ? (
            <>
              <Text.Title className="text-2xl font-bold mb-1">Xin chào {userInfo?.name || "bạn"}!</Text.Title>
              <Text className="text-gray-500">Đăng nhập để quản lý hồ sơ</Text>
            </>
          ) : (
            <>
              <Text.Title className="text-2xl font-bold mb-1">Đăng ký thành viên</Text.Title>
              <Text className="text-gray-500">Tạo tài khoản để nhận ưu đãi</Text>
            </>
          )}
        </Box>

        <Box className="w-full space-y-4">
          <Input type="text" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="bg-gray-100 border-none rounded-xl py-3 px-4" />
          
          {formType === "register" && (
            <Input type="text" placeholder={isShopConfig ? "Họ và tên (Người quản lý)" : "Họ và tên"} value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="bg-gray-100 border-none rounded-xl py-3 px-4" />
          )}

          <Input.Password placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-100 border-none rounded-xl py-3 px-4" />

          {formType === "register" && (
            <>
              <Input.Password placeholder="Nhập lại mật khẩu" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-gray-100 border-none rounded-xl py-3 px-4" />
              <Input type="text" placeholder="Mã giới thiệu (SĐT người giới thiệu)" value={referralCode} onChange={(e) => setReferralCode(e.target.value)}
                className="bg-gray-100 border-none rounded-xl py-3 px-4" />
              
              <Box className="flex justify-between items-center py-2">
                <Box>
                  <Text className="font-semibold text-gray-800">Đăng ký mở Gian hàng</Text>
                  <Text size="xSmall" className="text-gray-500">Dành cho chủ cửa hàng/đối tác</Text>
                </Box>
                <Switch checked={isShopConfig} onChange={(e) => setIsShopConfig(e.target.checked)} />
              </Box>
            </>
          )}

          {formType === "login" && (
            <Box className="flex justify-end">
              <Text 
                className="text-blue-500 text-sm cursor-pointer"
                onClick={async () => {
                  try {
                    await openChat({
                      type: 'oa',
                      id: '1234567890', // Default Zalo OA ID placeholder
                      message: `Xin chào, tôi cần hỗ trợ khôi phục mật khẩu cho số điện thoại: ${phone}`
                    });
                  } catch (err) {
                    console.error("openChat failed:", err);
                    const subject = encodeURIComponent("Hỗ trợ khôi phục mật khẩu");
                    const body = encodeURIComponent(`Xin chào, tôi cần hỗ trợ khôi phục mật khẩu cho số điện thoại: ${phone}. Vui lòng giúp tôi lấy lại mật khẩu.`);
                    window.location.href = `mailto:campusgreenbiz@gmail.com?subject=${subject}&body=${body}`;
                  }
                }}
              >
                Quên mật khẩu?
              </Text>
            </Box>
          )}

          <Button 
            fullWidth 
            className="mt-4 py-3 rounded-full font-bold text-white text-lg border-none"
            style={{ backgroundColor: "#8b191b" }} 
            onClick={formType === "login" ? handleLoginSubmit : handleRegisterSubmit}
          >
            {formType === "login" ? "Đăng nhập" : "Đăng ký"}
          </Button>

          <Box className="flex justify-center mt-6">
            <Text className="text-gray-600">
              {formType === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
              <span 
                className="text-blue-600 font-bold underline cursor-pointer"
                onClick={() => setFormType(formType === "login" ? "register" : "login")}
              >
                {formType === "login" ? "Đăng ký mới" : "Đăng nhập ngay"}
              </span>
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};