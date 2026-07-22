import React, { useState, useEffect } from "react";
import { Page, Box, Input, Button, Text, useSnackbar, Header, Icon, Spinner, Select, Modal } from "zmp-ui";
// 👉 BƯỚC 1: Bổ sung doc và getDoc để đọc cấu hình Admin
import { collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../firebase"; 
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getUserInfo } from "zmp-sdk/apis";
import { compressImage } from "../utils/compression";


const { Option } = Select;
const { TextArea } = Input;

const PostPage: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  // 👇 THÊM MỚI: Lấy ID và Dữ liệu từ nút Chỉnh sửa truyền sang
  const { id: paramId } = useParams(); 
  const location = useLocation();
  const editingPost = location.state?.product; // Đây chính là dữ liệu item truyền từ trang Chi tiết
  const id = paramId || editingPost?.id;
  const [loading, setLoading] = useState(false);
  
  const [myLocations, setMyLocations] = useState<any[]>([]);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [shopAddress, setShopAddress] = useState<string>("");

  // 👉 BƯỚC 2: Thêm State lưu tỷ lệ điểm của Admin (Mặc định 10%)
  const [minRewardRate, setMinRewardRate] = useState(10);
  const [defaultPlatformFeeRate, setDefaultPlatformFeeRate] = useState(15);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  const [uploadingImage, setUploadingImage] = useState(false); // State xoay vòng loading tải ảnh
  const [uploadingVideo, setUploadingVideo] = useState(false); // State xoay vòng loading tải video

  const [form, setForm] = useState<{
    title: string; price: string; originalPrice: string; shopName: string; points: string; rewardRate: string;
    description: string; images: string[]; videoUrl: string; selectedLocation: string; category: string;
    stock: string; 
    productCategory: string;
  }>({
    title: "", price: "", originalPrice: "", shopName: "", points: "", rewardRate: "",
    description: "", images: [], videoUrl: "", selectedLocation: "", category: "", 
    stock: "",
    productCategory: ""
  });

  // 👉 THÊM MỚI: State quản lý Phân loại hàng (Màu sắc, Size...)
  const [hasVariants, setHasVariants] = useState(false);
  const [attributes, setAttributes] = useState([{ name: "", values: "" }]);
  
  const [hasPriceVariants, setHasPriceVariants] = useState(false);
  const [priceVariants, setPriceVariants] = useState([{ label: "", price: "", originalPrice: "" }]);

  const [isVip, setIsVip] = useState(false);
  const [currentVipPoints, setCurrentVipPoints] = useState(0);
  const [showVipModal, setShowVipModal] = useState(false);

 useEffect(() => {
  const init = async () => {
      try {
        // 👇 BỔ SUNG: NẾU ĐANG Ở CHẾ ĐỘ CHỈNH SỬA -> ĐIỀN DỮ LIỆU VÀO FORM
        if (editingPost) {
          setForm({
              title: editingPost.title || "",
              price: editingPost.price?.toString() || "",
              originalPrice: editingPost.originalPrice?.toString() || "", // 👉 BỔ SUNG DÒNG NÀY
              shopName: editingPost.shopName || "",
              points: editingPost.points?.toString() || "",
              description: editingPost.description || "",
              // Ưu tiên lấy mảng ảnh (gallery), nếu không có thì lấy ảnh đơn (image)
              images: editingPost.gallery || (editingPost.image ? [editingPost.image] : []),
              videoUrl: editingPost.videoUrl || "",
              selectedLocation: editingPost.locationAddress || "",
              category: editingPost.category || "package",
              stock: editingPost.stock && editingPost.stock !== -1 ? editingPost.stock.toString() : "",
              productCategory: editingPost.productCategory || "",
              rewardRate: editingPost.rewardRate?.toString() || "",
          });
          setHasVariants(editingPost.hasVariants || false);
          if (editingPost.attributes && editingPost.attributes.length > 0) {
              setAttributes(editingPost.attributes);
          }
          setHasPriceVariants(editingPost.hasPriceVariants || false);
          if (editingPost.priceVariants && editingPost.priceVariants.length > 0) {
              setPriceVariants(editingPost.priceVariants);
          }
          setIsVip(editingPost.isVip || false);
      }
          // 👉 BƯỚC 3: Lấy Tỷ lệ tích điểm và Tỷ lệ chi phí từ Cấu hình Admin
          const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
          if (configSnap.exists()) {
              if (configSnap.data().rewardPointRate !== undefined) {
                  const adminRate = Number(configSnap.data().rewardPointRate);
                  setMinRewardRate(adminRate);
              }
              if (configSnap.data().platformFeeRate !== undefined) {
                  const pFeeRate = Number(configSnap.data().platformFeeRate);
                  setDefaultPlatformFeeRate(pFeeRate);
                  
                  // Chỉ cập nhật nếu là bài đăng mới
                  if (!editingPost) {
                    setForm(prev => ({
                        ...prev,
                        rewardRate: prev.rewardRate || pFeeRate.toString(),
                        points: prev.price ? Math.floor((Number(prev.price) * pFeeRate / 100) / 1000).toString() : prev.points
                    }));
                  }
              }
          }

          try {
            const querySnapshot = await getDocs(query(collection(db, "categories"), orderBy("createdAt", "asc")));
            const catList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            setDbCategories(catList);
          } catch (error) {
            console.error("Lỗi khi tải danh mục:", error);
          }

          const userPhone = localStorage.getItem("user_phone");
          if (!userPhone) return;

          let userData: any = null;
          let isDistributor = false;

          // 1. Dò tìm trong bảng "users" (Chủ Shop / provider)
          const qUser = query(collection(db, "users"), where("phone", "==", userPhone));
          const snapUser = await getDocs(qUser);
          if (!snapUser.empty) {
              userData = snapUser.docs[0].data();
              isDistributor = userData.role === "distributor";
          } else {
              // 2. Dò tìm trong bảng "shops" (Nhà phân phối / distributor)
              const qShop = query(collection(db, "shops"), where("phone", "==", userPhone));
              const snapShop = await getDocs(qShop);
              if (!snapShop.empty) {
                  userData = snapShop.docs[0].data();
                  isDistributor = true;
              }
          }

          if (userData) {
              const nameToUse = userData.fullName || userData.name || "";
              setForm(prev => ({ 
                ...prev, 
                shopName: nameToUse,
                // Mặc định chọn địa điểm là địa chỉ của Shop/Distributor nếu không có hệ thống cơ sở
                selectedLocation: userData.address || "Toàn hệ thống"
              }));
              setUserRole(isDistributor ? "distributor" : (userData.role || "provider"));
              setShopAddress(userData.address || "");
          }

          // Lấy điểm VIP từ bảng shops
          const qShopForPoints = query(collection(db, "shops"), where("phone", "==", userPhone));
          const snapShopForPoints = await getDocs(qShopForPoints);
          if (!snapShopForPoints.empty) {
              setCurrentVipPoints(snapShopForPoints.docs[0].data().vipPushPoints || 0);
          }
      } catch (e) { console.error(e); }
      finally { setFetchingUser(false); }
  };
  init();
}, []);

  // 👉 BƯỚC 4: Tự động tính điểm theo đúng Tỷ lệ Admin quy định
  const handleVipChange = (checked: boolean) => {
    if (checked && currentVipPoints < 10 && !editingPost?.isVip) {
      setShowVipModal(true);
      return;
    }
    setIsVip(checked);
  };

  const handleChange = (field: string, value: string) => {
    if (field === "price" || field === "rewardRate") {
        const newPrice = field === "price" ? value : form.price;
        const newRate = field === "rewardRate" ? value : form.rewardRate;
        
        const numericPrice = Number(newPrice) || 0;
        const activeRate = Number(newRate) || minRewardRate;
        
        // Công thức: (Giá * Tỷ lệ % / 100) / 1000đ = Số điểm
        const autoPoints = Math.floor((numericPrice * activeRate / 100) / 1000).toString();
        
        setForm({ ...form, [field]: value, points: autoPoints });
    } else {
        setForm({ ...form, [field]: value });
    }
  };
  // 👉 HÀM XỬ LÝ PHÂN LOẠI HÀNG
  const addAttribute = () => setAttributes([...attributes, { name: "", values: "" }]);
  const removeAttribute = (index: number) => {
      const newAttr = [...attributes];
      newAttr.splice(index, 1);
      setAttributes(newAttr);
  };
  const handleAttributeChange = (index: number, field: string, val: string) => {
      const newAttr = [...attributes];
      newAttr[index][field] = val;
      setAttributes(newAttr);
  };

  // 👉 HÀM XỬ LÝ NHIỀU MỨC GIÁ
  const addPriceVariant = () => setPriceVariants([...priceVariants, { label: "", price: "", originalPrice: "" }]);
  const removePriceVariant = (index: number) => {
      const newVar = [...priceVariants];
      newVar.splice(index, 1);
      setPriceVariants(newVar);
  };
  const handlePriceVariantChange = (index: number, field: string, val: string) => {
      const newVar = [...priceVariants];
      newVar[index][field] = val;
      setPriceVariants(newVar);
  };
  // 👉 BƯỚC 3: HÀM UPLOAD NHIỀU ẢNH LÊN FIREBASE STORAGE
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Lấy toàn bộ file người dùng chọn (vì có thuộc tính multiple)
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Kiểm tra số lượng ảnh tối đa
    // Kiểm tra số lượng ảnh tối đa
      if (form.images.length + files.length > 10) {
        openSnackbar({ text: "Chỉ được tải lên tối đa 10 ảnh!", type: "warning", position: "top" });
        return;
      }

    setUploadingImage(true);
    try {
        const storage = getStorage();
        const newImageUrls: string[] = [];

        for (const file of files) {
            // Ép dung lượng tối đa 5MB/ảnh để App mượt mà
            const maxSize = 5 * 1024 * 1024; 
            if (file.size > maxSize) {
                openSnackbar({ text: `Ảnh ${file.name} vượt quá 5MB nên bị bỏ qua.`, type: "warning", position: "top" });
                continue;
            }

            // Upload từng ảnh lên Firebase
            const storageRef = ref(storage, `services_images/${Date.now()}_${file.name}`);
            const compressedFile = await compressImage(file);
            await uploadBytes(storageRef, compressedFile);
            const downloadURL = await getDownloadURL(storageRef);
            newImageUrls.push(downloadURL);
        }

        // Cập nhật mảng ảnh mới vào State
        setForm(prev => ({ ...prev, images: [...prev.images, ...newImageUrls] }));
        openSnackbar({ text: `Đã tải lên thêm ${newImageUrls.length} ảnh!`, type: "success", position: "top" });
    } catch (error) {
        console.error("Lỗi tải ảnh:", error);
        openSnackbar({ text: "Lỗi hệ thống khi tải ảnh lên!", type: "error", position: "top" });
    } finally {
        setUploadingImage(false);
    }
};

// Hàm xóa bớt ảnh khi Shop đổi ý
  const handleRemoveImage = (index: number) => {
      setForm(prev => {
          const newImages = [...prev.images];
          newImages.splice(index, 1);
          return { ...prev, images: newImages };
      });
  };
  // 👉 HÀM UPLOAD VIDEO LÊN FIREBASE STORAGE
const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]; // Lấy file đầu tiên (chỉ cho phép 1 video)
  if (!file) return;

  // Giới hạn dung lượng video (Ví dụ: 20MB = 20 * 1024 * 1024 bytes)
  const maxVideoSize = 20 * 1024 * 1024;
  if (file.size > maxVideoSize) {
      openSnackbar({ text: `Video quá lớn! Vui lòng chọn video dưới 20MB.`, type: "warning", position: "top" });
      return;
  }

  setUploadingVideo(true);
  try {
      const storage = getStorage();
      // Tạo thư mục riêng cho video để dễ quản lý
      const storageRef = ref(storage, `services_videos/${Date.now()}_${file.name}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Cập nhật link video vào State
      setForm(prev => ({ ...prev, videoUrl: downloadURL }));
      openSnackbar({ text: `Tải video lên thành công!`, type: "success", position: "top" });
  } catch (error) {
      console.error("Lỗi tải video:", error);
      openSnackbar({ text: "Lỗi hệ thống khi tải video lên!", type: "error", position: "top" });
  } finally {
      setUploadingVideo(false);
  }
};

// 👉 Hàm xóa video khi Shop đổi ý
const handleRemoveVideo = () => {
  setForm(prev => ({ ...prev, videoUrl: "" }));
};
  const handleSubmit = async () => {
    if (form.images.length === 0) {
      openSnackbar({ text: "Vui lòng tải lên ít nhất 1 hình ảnh sản phẩm!", type: "error", position: "top" });
      return;
    }
    
    // 👉 BƯỚC 5: CHỐT CHẶN - Kiểm tra điểm Shop nhập vào có đạt yêu cầu không
    const numericPrice = Number(form.price) || 0;
    const numericOriginalPrice = Number(form.originalPrice) || 0; // 👉 BỔ SUNG

    let basePriceForPoints = numericPrice;
    if (hasPriceVariants && priceVariants.length > 0) {
        basePriceForPoints = Math.min(...priceVariants.map(v => Number(v.price) || 0));
    }

    // 👉 TÍNH % GIẢM GIÁ ĐỂ LƯU DATABASE
    const discountPercent = (numericOriginalPrice > numericPrice && numericPrice > 0)
        ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100)
        : 0;
    // ...
    const enteredPoints = Number(form.points) || 0;
    const requiredMinPointsSubmit = Math.floor((basePriceForPoints * minRewardRate / 100) / 1000);

    if (!hasPriceVariants && enteredPoints < requiredMinPointsSubmit) {
        openSnackbar({ 
            text: `Tỷ lệ tích điểm quy định là ${minRewardRate}%. Bạn phải tặng khách ít nhất ${requiredMinPointsSubmit} điểm!`, 
            type: "error", 
            position: "top" 
        });
        return;
    }

    // Đã gỡ bỏ validation Địa điểm áp dụng
    // 👉 CHỐT CHẶN: Nếu là Sản Phẩm thì bắt buộc nhập Kho
    if (form.category === "product" && (!form.stock || Number(form.stock) <= 0)) {
      openSnackbar({ text: "Vui lòng nhập Số lượng kho hợp lệ cho Sản phẩm!", type: "error", position: "top" });
      return;
  }
    setLoading(true);

    try {
      const userPhone = localStorage.getItem("user_phone");
      
      // Lấy thông tin shop để kiểm tra & khấu trừ Ví điểm đẩy hàng VIP
      const qShop = query(collection(db, "shops"), where("phone", "==", userPhone));
      const snapShop = await getDocs(qShop);
      if (snapShop.empty) {
        openSnackbar({ text: "Không tìm thấy thông tin shop của bạn!", type: "error", position: "top" });
        setLoading(false);
        return;
      }
      const shopDoc = snapShop.docs[0];
      const currentVipPoints = shopDoc.data().vipPushPoints || 0;
      const wasAlreadyVip = editingPost?.isVip === true;

      // Phí: 10 điểm nếu đăng VIP và trước đó chưa phải VIP.
      // Đăng bài bình thường không mất phí VIP.
      const vipCost = (isVip && !wasAlreadyVip) ? 10 : 0;

      if (vipCost > 0 && currentVipPoints < vipCost) {
        openSnackbar({ 
          text: `Số dư Ví điểm VIP không đủ (Cần tối thiểu ${vipCost} điểm để ${isVip ? "đăng bài VIP" : "đăng bài"}). Vui lòng nạp thêm!`, 
          type: "error", 
          position: "top" 
        });
        setLoading(false);
        return;
      }

      const validAttributes = hasVariants ? attributes.filter(a => a.name.trim() && a.values.trim()) : [];
      const validPriceVariants = hasPriceVariants ? priceVariants.filter(v => v.label.trim() && v.price.trim()).map(v => ({
          label: v.label.trim(),
          price: Number(v.price),
          originalPrice: v.originalPrice ? Number(v.originalPrice) : 0
      })) : [];
      
      let minPrice = numericPrice;
      let maxPrice = numericPrice;
      
      if (hasPriceVariants && validPriceVariants.length > 0) {
          const prices = validPriceVariants.map(v => v.price);
          minPrice = Math.min(...prices);
          maxPrice = Math.max(...prices);
      }

      // 👇 Gom dữ liệu lại thành 1 cục (Payload) để dùng chung
      const postData = {
        title: form.title,
        price: numericPrice,
        originalPrice: numericOriginalPrice, // 👉 BỔ SUNG
        discountPercent: discountPercent,    // 👉 BỔ SUNG
        shopName: form.shopName,
        points: enteredPoints, 
        description: form.description || "",
        image: form.images[0] || "",
        gallery: form.images,
        videoUrl: form.videoUrl,
        locationAddress: shopAddress || "Toàn hệ thống", 
        category: form.category,
        productCategory: form.productCategory || "Khác", // 👇 THÊM MỚI: Nếu shop quên nhập, mặc định là "Khác"
        providerId: userPhone, 
        ownerPhone: userPhone, 
        stock: form.stock ? Number(form.stock) : -1,
        hasVariants: hasVariants,
        attributes: validAttributes,
        hasPriceVariants: hasPriceVariants,
        priceVariants: validPriceVariants,
        minPrice: minPrice,
        maxPrice: maxPrice,
        isVip: isVip,
        rewardRate: Number(form.rewardRate) || minRewardRate, // BỔ SUNG: Lưu Tỷ lệ chi phí App
      };

      // Khấu trừ điểm VIP của shop
      if (vipCost > 0) {
        await updateDoc(doc(db, "shops", shopDoc.id), {
          vipPushPoints: currentVipPoints - vipCost
        });
      }

      if (id) {
        // 👇 NẾU CÓ ID -> CHẾ ĐỘ CHỈNH SỬA
        // Chỉ định đúng bảng "services" và bài viết có "id" tương ứng
        const docRef = doc(db, "services", id);
        
        // Cập nhật dữ liệu
        await updateDoc(docRef, {
            ...postData,
            status: "pending", // Bắt buộc chuyển về pending để admin duyệt lại
            updatedAt: serverTimestamp(), // Hàm của Firebase để tự động ghi nhận giờ sửa
        });
        openSnackbar({ text: "Cập nhật bài viết thành công!", type: "success", position: "top" });
      } else {
        // 👇 NẾU KHÔNG CÓ ID -> CHẾ ĐỘ ĐĂNG MỚI
        // Thêm dữ liệu mới vào bảng "services"
        const collectionRef = collection(db, "services");

        await addDoc(collectionRef, {
            ...postData,
            status: "pending", // Bạn có thể thêm trường trạng thái để chờ Admin duyệt
            createdAt: serverTimestamp(), // Ghi nhận giờ tạo
        });
        openSnackbar({ text: "Đăng bài thành công! Vui lòng chờ duyệt.", type: "success", position: "top" });
      }

      setTimeout(() => { navigate(-1); }, 1500); // Đã sửa: navigate(-1) để quay lại trang trước đó cho tiện

    } 
    
    catch (error) {
      console.error("Lỗi đăng bài:", error);
      openSnackbar({ text: "Có lỗi xảy ra, vui lòng thử lại.", type: "error", position: "top" });
    } finally {
      setLoading(false);
    }
  };
  // 👉 BỔ SUNG: TÍNH TOÁN ĐIỂM HỢP LỆ THỜI GIAN THỰC (REAL-TIME)
  const numericPrice = Number(form.price) || 0;
  let basePriceForUI = numericPrice;
  if (hasPriceVariants && priceVariants.length > 0) {
      basePriceForUI = Math.min(...priceVariants.map(v => Number(v.price) || 0));
  }
  const enteredPoints = Number(form.points) || 0;
  const requiredMinPoints = Math.floor((basePriceForUI * minRewardRate / 100) / 1000);
  
  // Hợp lệ khi: Có nhiều mức giá (ẩn ô điểm thưởng), HOẶC Chưa nhập giá (0đ), HOẶC điểm nhập vào lớn/bằng điểm tối thiểu
  const isPointsValid = hasPriceVariants || basePriceForUI === 0 || enteredPoints >= requiredMinPoints;
  // 👉 KIỂM TRA ĐỊA CHỈ: Có địa chỉ hay chưa? (Distributor và Shop mặc định là hợp lệ vì phân phối trực tiếp)
  const hasValidLocation = true;

    if (fetchingUser) return <Page className="bg-white flex justify-center items-center"><Spinner /></Page>;

  return (
    <Page className="bg-white">
      <Header title={id ? "Chỉnh sửa Dịch Vụ" : "Đăng Sản phẩm/ Dịch Vụ Mới"} showBackIcon={true} />
      
      <Box p={4} className="pb-20">
        {/* 👉 BƯỚC 5: GIAO DIỆN LƯỚI ALBUM ẢNH (TỐI ĐA 10 ẢNH) */}
        <Box mb={4}>
          <Box flex justifyContent="space-between" alignItems="center" mb={2}>
              <Text size="small" className="font-medium">Hình ảnh sản phẩm <span className="text-red-500">*</span></Text>
              <Text size="xxxxSmall" className="text-gray-500 font-bold">{form.images.length}/10 ảnh</Text>
          </Box>

            <Box className="grid grid-cols-3 gap-2">
                {/* Hiển thị các ảnh đã tải lên */}
                {form.images.map((imgUrl, idx) => (
                    <Box key={idx} className="relative w-full pt-[100%] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        <img src={imgUrl} className="absolute inset-0 w-full h-full object-cover" alt={`img-${idx}`} />
                        {/* Nút Xóa ảnh (Dấu X) */}
                        <Box 
                            className="absolute top-1 right-1 bg-white/90 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer shadow active:bg-red-50"
                            onClick={() => handleRemoveImage(idx)}
                        >
                            <Icon icon="zi-close" className="text-red-500" size={14} />
                        </Box>
                        {idx === 0 && (
                            <Box className="absolute bottom-0 left-0 right-0 bg-blue-600/80 text-white text-[9px] text-center py-0.5">
                                Ảnh đại diện
                            </Box>
                        )}
                    </Box>
                ))}

                {/* Khung tải thêm ảnh (Ẩn đi nếu đã đủ 5 ảnh) */}
                {form.images.length < 10 && (
                    <Box className="relative w-full pt-[100%] bg-blue-50/50 rounded-lg border-2 border-dashed border-blue-300 flex flex-col items-center justify-center active:opacity-70 transition-opacity">
                        <input 
                            type="file" 
                            accept="image/*" 
                            multiple // 👉 Thuộc tính quan trọng cho phép chọn nhiều ảnh
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                            onChange={handleImageChange} 
                            disabled={uploadingImage} 
                        />
                        <Box className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {uploadingImage ? (
                                <Spinner />
                            ) : (
                                <>
                                    <Icon icon="zi-camera" className="text-blue-400 text-2xl mb-1"/>
                                    <Text size="xxxxSmall" className="text-blue-500 font-medium">Thêm ảnh</Text>
                                </>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>
            <Text size="xxxxSmall" className="text-gray-400 italic mt-2">* Bạn chọn tối đa 10 ảnh. Ảnh đầu tiên sẽ làm ảnh đại diện chính.</Text>
        </Box>
        {/* 👉 GIAO DIỆN TẢI VIDEO (TỐI ĐA 1 VIDEO) */}
        <Box mb={4}>
            <Box flex justifyContent="space-between" alignItems="center" mb={2}>
                <Text size="small" className="font-medium">Video sản phẩm (Tùy chọn)</Text>
                <Text size="xxxxSmall" className="text-gray-500 font-bold">{form.videoUrl ? "1/1" : "0/1"} video</Text>
            </Box>

            <Box className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                {form.videoUrl ? (
                    // Nếu đã có video thì hiển thị trình phát video
                    <>
                        <video src={form.videoUrl} controls className="absolute inset-0 w-full h-full object-cover" />
                        {/* Nút xóa video */}
                        <Box 
                            className="absolute top-2 right-2 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer shadow active:bg-red-50 z-10"
                            onClick={handleRemoveVideo}
                        >
                            <Icon icon="zi-close" className="text-red-500" size={18} />
                        </Box>
                    </>
                ) : (
                    // Nếu chưa có video thì hiển thị nút chọn file
                    <>
                        <input 
                            type="file" 
                            accept="video/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                            onChange={handleVideoChange} 
                            disabled={uploadingVideo} 
                        />
                        <Box className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {uploadingVideo ? (
                                <Spinner />
                            ) : (
                                <>
                                    <Icon icon="zi-video" className="text-gray-400 text-3xl mb-1"/>
                                    <Text size="xxxxSmall" className="text-gray-500 font-medium">Nhấn để thêm video (Max 20MB)</Text>
                                </>
                            )}
                        </Box>
                    </>
                )}
            </Box>
        </Box>                      
        <Box mb={4}>
          <Input label="Tên sản phẩm/ dịch vụ" placeholder="VD: Tinh dầu bạch đàn" value={form.title} onChange={(e) => handleChange("title", e.target.value)} />
        </Box>

        {/* CÂU HỎI ĐĂNG VIP */}
        <Box mb={4} className="bg-purple-50 p-3.5 rounded-xl border border-purple-100 shadow-sm">
          <Box flex justifyContent="space-between" alignItems="center">
            <Text size="small" className="font-semibold text-purple-950 flex-1 pr-2">Bạn có muốn đăng Sản phẩm/ Dịch vụ này lên VIP không?</Text>
            <input 
              type="checkbox" 
              className="w-5 h-5 accent-purple-600 cursor-pointer shrink-0" 
              checked={isVip} 
              onChange={(e) => handleVipChange(e.target.checked)} 
            />
          </Box>
          {isVip && (
            <Box className="mt-2.5 bg-white/70 p-2.5 rounded-lg border border-purple-200">
              <Text size="xxxxSmall" className="text-purple-800 leading-normal font-medium">
                📢 <b>Thông báo:</b> Sản phẩm này sẽ được hiển thị trong thư mục <b>Sản phẩm Hot</b> và trừ <b>10 điểm</b> cho mỗi bài đăng VIP. Số điểm này sẽ được trừ trực tiếp vào Ví điểm đẩy hàng VIP của shop.
              </Text>
            </Box>
          )}
        </Box>
        {/* 👇 THÊM MỚI: Ô nhập Nhãn phân loại 👇 */}
        <Box mb={4}>
          <Input 
              label="Nhãn sản phẩm (Để tạo bộ lọc)" 
              placeholder="VD: Tinh dầu, Bút gỗ, Móc khóa..." 
              value={form.productCategory} 
              onChange={(e) => handleChange("productCategory", e.target.value)} 
          />
        </Box>
        <Box mb={4}>
            <Text size="small" className="mb-1 font-medium ml-1">Danh mục</Text>
            <Select
                placeholder="Chọn danh mục"
                value={form.category}
                onChange={(val) => handleChange("category", val as string)}
                closeOnSelect
            >
                {dbCategories.map(cat => (
                  <Option key={cat.id} value={cat.name} title={cat.name} />
                ))}
                {dbCategories.length === 0 && (
                  <>
                    <Option value="Công nghệ" title="Công nghệ" />
                    <Option value="Thời trang" title="Thời trang" />
                    <Option value="Góc học tập" title="Góc học tập" />
                    <Option value="Phòng trọ" title="Phòng trọ" />
                    <Option value="Ăn uống" title="Ăn uống" />
                    <Option value="Tiện ích cộng đồng" title="Tiện ích cộng đồng" />
                  </>
                )}
            </Select>
        </Box>
        {/* 👉 GIAO DIỆN CHỈ HIỆN KHI ĐÃ CHỌN DANH MỤC */}
        {form.category !== "" && (
            <Box mb={4} className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm animate-fade-in-down">
                <Text size="small" bold className="text-blue-800 mb-3">Thông tin Bán hàng</Text>
                
                {/* 1. Số lượng kho */}
                <Box mb={3}>
                    <Input type="number" label="Số lượng kho (*)" placeholder="VD: 100" value={form.stock} onChange={(e) => handleChange("stock", e.target.value)} />
                </Box>

                {/* 2. Công tắc Bật/Tắt Phân loại hàng */}
                <Box flex justifyContent="space-between" alignItems="center" mb={2}>
                    <Text size="small" className="font-medium text-gray-700">Có phân loại (Màu sắc, Size...)?</Text>
                    <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} />
                </Box>

                {/* 3. Khung nhập Phân loại hàng */}
                {hasVariants && (
                    <Box className="mt-3 pl-3 border-l-2 border-blue-300">
                        {attributes.map((attr, idx) => (
                            <Box key={idx} mb={3} className="p-3 bg-white rounded-lg border border-gray-200 relative shadow-sm">
                                <Box flex flexDirection="column" style={{ gap: 8 }}>
                                    <Box>
                                        <Text size="xxxxSmall" className="text-gray-500 mb-1">Tên nhóm phân loại</Text>
                                        <Input placeholder="VD: Màu sắc" value={attr.name} onChange={(e) => handleAttributeChange(idx, "name", e.target.value)} />
                                    </Box>
                                    <Box>
                                        <Text size="xxxxSmall" className="text-gray-500 mb-1">Các tùy chọn (Ngăn cách bởi dấu phẩy)</Text>
                                        <Input placeholder="VD: Đỏ, Xanh, Đen" value={attr.values} onChange={(e) => handleAttributeChange(idx, "values", e.target.value)} />
                                    </Box>
                                </Box>
                                {attributes.length > 1 && (
                                    <Box className="absolute -top-2 -right-2 bg-red-100 rounded-full cursor-pointer p-1 shadow-sm active:bg-red-200" onClick={() => removeAttribute(idx)}>
                                        <Icon icon="zi-close" className="text-red-500" size={14}/>
                                    </Box>
                                )}
                            </Box>
                        ))}
                        <Button size="small" variant="secondary" className="bg-white text-blue-600 border-blue-200" onClick={addAttribute} prefixIcon={<Icon icon="zi-plus"/>}>
                            Thêm nhóm phân loại khác (VD: Size)
                        </Button>
                    </Box>
                )}

                {/* 4. Công tắc Bật/Tắt Phân loại mức giá */}
                <Box flex justifyContent="space-between" alignItems="center" mb={2} mt={4}>
                    <Text size="small" className="font-medium text-gray-700">Có nhiều mức giá (VD: Các gói 1, 3, 6 tháng)?</Text>
                    <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={hasPriceVariants} onChange={(e) => setHasPriceVariants(e.target.checked)} />
                </Box>

                {/* 5. Khung nhập Mức giá */}
                {hasPriceVariants && (
                    <Box className="mt-3 pl-3 border-l-2 border-purple-300">
                        {priceVariants.map((variant, idx) => (
                            <Box key={idx} mb={3} className="p-3 bg-white rounded-lg border border-gray-200 relative shadow-sm">
                                <Box flex flexDirection="column" style={{ gap: 8 }}>
                                    <Box>
                                        <Text size="xxxxSmall" className="text-gray-500 mb-1">Tên gói (VD: 1 Tháng)</Text>
                                        <Input placeholder="Tên gói" value={variant.label} onChange={(e) => handlePriceVariantChange(idx, "label", e.target.value)} />
                                    </Box>
                                    <Box flex style={{ gap: 8 }}>
                                        <Box className="flex-1">
                                            <Text size="xxxxSmall" className="text-gray-500 mb-1">Giá bán mới (đ)</Text>
                                            <Input type="number" placeholder="Bắt buộc" value={variant.price} onChange={(e) => handlePriceVariantChange(idx, "price", e.target.value)} />
                                        </Box>
                                        <Box className="flex-1">
                                            <Text size="xxxxSmall" className="text-gray-500 mb-1">Giá gốc (Tùy chọn)</Text>
                                            <Input type="number" placeholder="Không bắt buộc" value={variant.originalPrice} onChange={(e) => handlePriceVariantChange(idx, "originalPrice", e.target.value)} />
                                        </Box>
                                    </Box>
                                </Box>
                                {priceVariants.length > 1 && (
                                    <Box className="absolute -top-2 -right-2 bg-red-100 rounded-full cursor-pointer p-1 shadow-sm active:bg-red-200" onClick={() => removePriceVariant(idx)}>
                                        <Icon icon="zi-close" className="text-red-500" size={14}/>
                                    </Box>
                                )}
                            </Box>
                        ))}
                        <Button size="small" variant="secondary" className="bg-white text-purple-600 border-purple-200" onClick={addPriceVariant} prefixIcon={<Icon icon="zi-plus"/>}>
                            Thêm mức giá khác
                        </Button>
                        <Text size="xxxxSmall" className="text-gray-400 mt-2 italic">
                            * Lưu ý: Giá ở mục trên cùng sẽ bị vô hiệu, hệ thống sẽ sử dụng các giá ở đây.
                        </Text>
                    </Box>
                )}
            </Box>
        )}
        {/* Đã gỡ bỏ block Địa điểm áp dụng */}

        {/* 👉 GIAO DIỆN NHẬP GIÁ MỚI */}
        {!hasPriceVariants && (
            <Box mb={3}>
                <Input type="number" label="Giá gốc (Chưa giảm - Tùy chọn)" placeholder="Ví dụ: 300000" value={form.originalPrice} onChange={(e) => handleChange("originalPrice", e.target.value)} />
            </Box>
        )}

        <Box mb={2} flex flexDirection="row" style={{ gap: 12 }}>
          {!hasPriceVariants && (
            <Box style={{ flex: 1, position: 'relative' }}>
              <Input type="number" label="Giá bán (Thực thu)" placeholder="200000" value={form.price} onChange={(e) => handleChange("price", e.target.value)} />
              
              {/* 👉 HIỂN THỊ NHÃN % GIẢM GIÁ THỜI GIAN THỰC (MÀU ĐỎ) */}
              {Number(form.originalPrice) > Number(form.price) && Number(form.price) > 0 && (
                  <Box className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm z-10 animate-pulse border border-white">
                      Giảm {Math.round(((Number(form.originalPrice) - Number(form.price)) / Number(form.originalPrice)) * 100)}%
                  </Box>
              )}
            </Box>
          )}
          {!hasPriceVariants && (
            <Box style={{ flex: 1 }}>
              <Input type="number" label="Tỷ lệ chi phí App (%)" placeholder={`${defaultPlatformFeeRate}`} value={form.rewardRate} onChange={(e) => handleChange("rewardRate", e.target.value)} />
            </Box>
          )}
          {!hasPriceVariants && (
            <Box style={{ flex: 1 }}>
              <Input type="number" label="Điểm thưởng" placeholder="10" value={form.points} onChange={(e) => handleChange("points", e.target.value)} disabled={true} />
            </Box>
          )}
        </Box>
        {/* 👉 GIAO DIỆN CẢNH BÁO THỜI GIAN THỰC */}
        {!hasPriceVariants && (
          basePriceForUI > 0 && !isPointsValid ? (
              <Text size="xxxxSmall" className="text-red-500 italic mb-4 ml-1 font-medium">
                  ⚠️ Hệ thống yêu cầu tỷ lệ tối thiểu là {minRewardRate}% (Tương đương ít nhất {requiredMinPoints} điểm). Vui lòng nhập mức tỷ lệ chi phí cao hơn!
              </Text>
          ) : (
              <Text size="xxxxSmall" className="text-gray-400 italic mb-4 ml-1">
                  * Hệ thống yêu cầu tỷ lệ tối thiểu {minRewardRate}% (Tương đương {requiredMinPoints} điểm). Tăng tỷ lệ chi phí App đồng nghĩa với việc khách nhận được nhiều điểm hơn, giúp thu hút khách tốt hơn.
              </Text>
          )
        )}
        
        <Box mb={4}>
          <Text size="small" className="mb-1 font-medium ml-1">Mô tả chi tiết</Text>
          {/* 👉 ĐÃ SỬA: Tăng maxLength lên 1000 và rows lên 6 để khung nhập thoải mái hơn */}
          <TextArea placeholder="Mô tả chi tiết..." value={form.description} onChange={(e) => handleChange("description", e.target.value)} showCount maxLength={2000} rows={6} />
        </Box>

        <Box mt={6}>
          {/* 👉 ẨN NÚT NẾU ĐIỂM HOẶC ĐỊA CHỈ KHÔNG HỢP LỆ */}
          {isPointsValid && hasValidLocation ? (
              <Button fullWidth onClick={handleSubmit} loading={loading} size="large">
              {id ? "Lưu thay đổi" : "Đăng tin ngay"}
          </Button>
          ) : (
              <Button fullWidth disabled size="large" className="bg-gray-300 text-gray-500 border-none">
                  {!hasValidLocation ? "Vui lòng cập nhật Địa chỉ Shop" : "Điểm chưa đạt yêu cầu"}
              </Button>
          )}
        </Box>
      </Box>

      {/* Modal báo thiếu điểm VIP */}
      <Modal 
          visible={showVipModal}
          title="Không đủ điểm VIP"
          onClose={() => setShowVipModal(false)}
          actions={[
              { text: "Đóng", close: true },
              { text: "Nạp điểm ngay", highLight: true, onClick: () => { navigate("/profile", { state: { openVipWallet: true } }); setShowVipModal(false); } }
          ]}
      >
          <Box className="text-center">
              <Text className="mb-2">Ví điểm đẩy hàng VIP của bạn hiện còn <b>{currentVipPoints}</b> điểm.</Text>
              <Text>Cần tối thiểu <b>10 điểm</b> để có thể đăng bài lên thư mục Sản phẩm Hot.</Text>
          </Box>
      </Modal>
    </Page>
  );
};

export default PostPage;