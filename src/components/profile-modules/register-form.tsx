import CustomIcon from '../custom-icon';
import React, { useState } from "react";
import { Box, Button, Input, Select, Text, useSnackbar, Header, Icon, Spinner, Avatar, Page } from "zmp-ui";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

const { Option } = Select;

interface RegisterProps {
  userInfo: { id: string; name: string; avatar: string };
  onSuccess: () => void;
  onBack: () => void;
}

export const RegisterForm: React.FunctionComponent<RegisterProps> = ({ userInfo, onSuccess, onBack }) => {
  const [role, setRole] = useState("member");
  const [fullName, setFullName] = useState(userInfo.name || ""); 
  const [phone, setPhone] = useState(""); 
  const [password, setPassword] = useState(""); 
  const [confirmPassword, setConfirmPassword] = useState(""); 
  const [referralCode, setReferralCode] = useState(""); 
  
  const [loading, setLoading] = useState(false);
  const [checkingRef, setCheckingRef] = useState(false);
  const [referrerName, setReferrerName] = useState(""); 
  const [referrerError, setReferrerError] = useState(""); 

  const { openSnackbar } = useSnackbar();

  // Validate số điện thoại
  const isValidPhone = (p: string) => {
    const cleanPhone = p.trim();
    const vnf_regex = /((09|03|07|08|05)+([0-9]{8})\b)/g;
    return vnf_regex.test(cleanPhone);
  };

  // Kiểm tra mã giới thiệu
  const checkReferralCode = async () => {
    const code = referralCode.trim();
    if (!code) {
        setReferrerError("");
        setReferrerName("");
        return;
    }
    setCheckingRef(true);
    setReferrerError("");
    setReferrerName("");

    try {
      // Tìm người giới thiệu trong DB
      const q = query(collection(db, "users"), where("phone", "==", code));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const refUser = querySnapshot.docs[0].data();
        setReferrerName(refUser.name);
      } else {
        setReferrerError("Mã giới thiệu không tồn tại!");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingRef(false);
    }
  };

  const handleRegister = async () => {
    const cleanPhone = phone.trim();
    const cleanReferralCode = referralCode.trim();

    // --- VALIDATION ---
    if (!fullName.trim()) {
        openSnackbar({ text: "Vui lòng nhập Họ và tên!", type: "warning" });
        return;
    }
    if (!cleanPhone) {
      openSnackbar({ text: "Vui lòng nhập số điện thoại", type: "warning" });
      return;
    }
    if (!isValidPhone(cleanPhone)) {
        openSnackbar({ text: "Số điện thoại không đúng định dạng!", type: "error" });
        return;
    }
    if (!password || password.length < 6) {
        openSnackbar({ text: "Mật khẩu phải có ít nhất 6 ký tự!", type: "warning" });
        return;
    }
    if (password !== confirmPassword) {
        openSnackbar({ text: "Mật khẩu nhập lại không khớp!", type: "error" });
        return;
    }

    if (role === "member") {
        if (cleanReferralCode && referrerError) {
            openSnackbar({ text: "Mã giới thiệu không hợp lệ!", type: "error" });
            return;
        }
    }

    setLoading(true);
    try {
      // 1. Check trùng SĐT (Kiểm tra xem Document ID này đã tồn tại chưa)
      // Sử dụng doc() để trỏ thẳng tới document có ID là số điện thoại
      const userDocRef = doc(db, "users", cleanPhone);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        openSnackbar({ text: "Số điện thoại này đã được đăng ký!", type: "error" });
        setLoading(false);
        return;
      }

      // --- CẤU HÌNH ĐIỂM SỐ (Đã sửa theo yêu cầu) ---
      const POINT_NEW_USER = 5;  // Người đăng ký mới nhận 5 điểm
      const POINT_REFERRER = 10; // Người giới thiệu nhận 10 điểm

      let referrerIdToUpdate = ""; 

      // 2. Tìm ID của người giới thiệu (nếu có mã)
      if (role === "member" && cleanReferralCode) {
         // Query tìm người có phone == mã giới thiệu
         const qRef = query(collection(db, "users"), where("phone", "==", cleanReferralCode));
         const snapRef = await getDocs(qRef);
         if (!snapRef.empty) {
             const referrerDoc = snapRef.docs[0];
             referrerIdToUpdate = referrerDoc.id; // Lấy ID document để update
         }
      }

      // 3. Tạo tài khoản cho người mới
      // QUAN TRỌNG: Sử dụng cleanPhone làm Document ID thay vì userInfo.id
      // Điều này giúp tránh bị ghi đè khi test nhiều user trên cùng 1 máy
      await setDoc(doc(db, "users", cleanPhone), {
        id: cleanPhone,       // ID document là SĐT
        zaloId: userInfo.id,  // Lưu thêm Zalo ID để sau này có thể mapping
        name: fullName, 
        avatar: userInfo.avatar,
        phone: cleanPhone,
        password: password,
        role: role, 
        referrer: role === "member" ? cleanReferralCode : "",
        referrerName: referrerName || "", 
        status: role === "provider" ? "pending" : "active",
        
        // Luôn cộng 5 điểm cho người mới (dù có hay không có mã giới thiệu)
        rankPoints: POINT_NEW_USER,      
        spendingPoints: POINT_NEW_USER,  
        
        rank: "Thành viên mới",
        createdAt: serverTimestamp(),
      });

      // 4. Cộng điểm cho người giới thiệu (nếu tìm thấy)
      if (referrerIdToUpdate) {
          const referrerRef = doc(db, "users", referrerIdToUpdate);
          await updateDoc(referrerRef, {
              rankPoints: increment(POINT_REFERRER),     
              spendingPoints: increment(POINT_REFERRER)  
          });
          console.log(`Đã cộng ${POINT_REFERRER} điểm cho người giới thiệu (ID: ${referrerIdToUpdate})`);
      }

      openSnackbar({ text: `Đăng ký thành công! Bạn nhận được ${POINT_NEW_USER} điểm thưởng.`, type: "success" });
      onSuccess(); 
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      openSnackbar({ text: "Lỗi hệ thống, vui lòng thử lại", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="bg-white flex flex-col h-screen"> 
      <Header title="Đăng ký tài khoản" showBackIcon onBackClick={onBack} />
      
      <Box 
        className="flex-1 overflow-y-auto" 
        style={{ paddingBottom: 100 }}
      >
        <Box p={4} className="m-4">
            <Box mb={6} flex flexDirection="column" alignItems="center">
                <Avatar story="default" src={userInfo.avatar} size={72} />
                <Text.Title size="normal" className="mt-3">{fullName || "Khách hàng"}</Text.Title> 
                <Text size="xxSmall" className="text-gray">Hoàn tất hồ sơ để tham gia</Text>
            </Box>

            <Box mb={4}>
              <Input 
                label="Họ và tên của bạn" 
                placeholder="Nhập họ và tên đầy đủ" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                clearable
              />
            </Box>

            <Box mb={4}>
              <Text size="small" className="mb-1 font-medium">Bạn muốn đăng ký là?</Text>
              <Select value={role} onChange={(val) => setRole(val as string)} placeholder="Chọn vai trò">
                <Option value="member" title="Thành viên (Khách hàng)" />
                <Option value="provider" title="Nhà cung cấp (Chủ Shop)" />
              </Select>
            </Box>

            <Box mb={4}>
              <Input 
                label="Số điện thoại" 
                placeholder="Ví dụ: 0912345678" 
                type="number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Box>

            <Box mb={4}>
                <Input.Password
                    label="Mật khẩu đăng nhập"
                    placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </Box>
            <Box mb={4}>
                <Input.Password
                    label="Nhập lại mật khẩu"
                    placeholder="Xác nhận lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
            </Box>

            {role === "member" && (
              <Box mb={4}>
                <Box flex justifyContent="space-between" alignItems="center">
                    <Text size="small" className="mb-1 font-medium">Mã giới thiệu (Không bắt buộc)</Text>
                    {checkingRef && <Spinner />}
                </Box>
                
                <Input 
                  placeholder="Nhập SĐT người giới thiệu (nếu có)" 
                  value={referralCode}
                  type="number"
                  onChange={(e) => {
                      setReferralCode(e.target.value);
                      setReferrerName("");
                      setReferrerError("");
                  }}
                  onBlur={checkReferralCode} 
                />
                
                {referrerName && (
                    <Text size="xxSmall" className="text-green-500 mt-1 flex items-center">
                        <CustomIcon icon="zi-check-circle-solid" size={14} style={{marginRight: 4}}/> 
                        Người giới thiệu: {referrerName}
                    </Text>
                )}
                {referralCode && referrerError && (
                    <Text size="xxSmall" className="text-red-500 mt-1">
                        <CustomIcon icon="zi-warning-solid" size={14} style={{marginRight: 4}}/> 
                        {referrerError}
                    </Text>
                )}
                <Text size="xxSmall" className="text-gray mt-2 italic">
                   *Bạn nhận ngay 5 điểm khi đăng ký. Nếu nhập mã, người giới thiệu bạn sẽ nhận được 10 điểm.
                </Text>
              </Box>
            )}

            <Box mt={6}>
                <Button fullWidth loading={loading} onClick={handleRegister} size="large">
                    Hoàn tất đăng ký
                </Button>
            </Box>
        </Box>
      </Box>
    </Page>
  );
};