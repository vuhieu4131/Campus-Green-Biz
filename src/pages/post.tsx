import React, { useState, useEffect } from "react";
import { Page, Box, Input, Button, Text, useSnackbar, Header, Icon, Spinner, Select } from "zmp-ui";
// 👉 BƯỚC 1: Bổ sung doc và getDoc để đọc cấu hình Admin
import { collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../firebase"; 
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getUserInfo } from "zmp-sdk/apis";


const { Option } = Select;
const { TextArea } = Input;

const PostPage: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  // 👇 THÊM MỚI: Lấy ID và Dữ liệu từ nút Chỉnh sửa truyền sang
  const { id } = useParams(); 
  const location = useLocation();
  const editingPost = location.state?.product; // Đây chính là dữ liệu item truyền từ trang Chi tiết
  const [loading, setLoading] = useState(false);
  
  const [myLocations, setMyLocations] = useState<any[]>([]);
  const [fetchingUser, setFetchingUser] = useState(true);

  // 👉 BƯỚC 2: Thêm State lưu tỷ lệ điểm của Admin (Mặc định 10%)
  const [minRewardRate, setMinRewardRate] = useState(10);

  const [uploadingImage, setUploadingImage] = useState(false); // State xoay vòng loading tải ảnh
  const [uploadingVideo, setUploadingVideo] = useState(false); // State xoay vòng loading tải video

  const [form, setForm] = useState<{
    title: string; price: string; originalPrice: string; shopName: string; points: string; // 👉 THÊM originalPrice
    description: string; images: string[]; videoUrl: string; selectedLocation: string; category: string;
    stock: string; 
    productCategory: string;
  }>({
    title: "", price: "", originalPrice: "", shopName: "", points: "", // 👉 THÊM originalPrice: ""
    description: "", images: [], videoUrl: "", selectedLocation: "", category: "package", 
    stock: "",
    productCategory: ""
  });

  // 👉 THÊM MỚI: State quản lý Phân loại hàng (Màu sắc, Size...)
  const [hasVariants, setHasVariants] = useState(false);
  const [attributes, setAttributes] = useState([{ name: "", values: "" }]);

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
          });
          setHasVariants(editingPost.hasVariants || false);
          if (editingPost.attributes && editingPost.attributes.length > 0) {
              setAttributes(editingPost.attributes);
          }
      }
          // 👉 BƯỚC 3: Lấy Tỷ lệ tích điểm từ Cấu hình Admin
          const configSnap = await getDoc(doc(db, "system_config", "admin_settings"));
          if (configSnap.exists() && configSnap.data().rewardPointRate !== undefined) {
              setMinRewardRate(Number(configSnap.data().rewardPointRate));
          }

          const userPhone = localStorage.getItem("user_phone");
          if (!userPhone) return;

          const q = query(collection(db, "users"), where("phone", "==", userPhone));
          const snap = await getDocs(q);
          
          if (!snap.empty) {
              const userData = snap.docs[0].data();
              setForm(prev => ({ ...prev, shopName: userData.name })); 
              
              // 👉 BƯỚC 1: KIỂM TRA CƠ SỞ (Tách biệt hoàn toàn với Địa chỉ Shop)
              if (userData.locations && Array.isArray(userData.locations) && userData.locations.length > 0) {
                setMyLocations(userData.locations);
                setForm(prev => ({ ...prev, selectedLocation: "Toàn hệ thống" }));
            } else {
                // Bắt buộc phải để trống để ép Shop đi tạo Cơ sở
                setForm(prev => ({ ...prev, selectedLocation: "" }));
            }
          }
      } catch (e) { console.error(e); }
      finally { setFetchingUser(false); }
  };
  init();
}, []);

  // 👉 BƯỚC 4: Tự động tính điểm theo đúng Tỷ lệ Admin quy định
  const handleChange = (field: string, value: string) => {
    if (field === "price") {
        const numericPrice = Number(value) || 0;
        
        // Công thức: (Giá * Tỷ lệ % / 100) / 1000đ = Số điểm
        // VD: (200.000 * 10 / 100) / 1000 = 20 điểm
        const autoPoints = Math.floor((numericPrice * minRewardRate / 100) / 1000).toString();
        
        setForm({ ...form, price: value, points: autoPoints });
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
            await uploadBytes(storageRef, file);
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

    // 👉 TÍNH % GIẢM GIÁ ĐỂ LƯU DATABASE
    const discountPercent = (numericOriginalPrice > numericPrice && numericPrice > 0)
        ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100)
        : 0;
    // ...
    const enteredPoints = Number(form.points) || 0;
    const requiredMinPoints = Math.floor((numericPrice * minRewardRate / 100) / 1000);

    if (enteredPoints < requiredMinPoints) {
        openSnackbar({ 
            text: `Tỷ lệ tích điểm quy định là ${minRewardRate}%. Bạn phải tặng khách ít nhất ${requiredMinPoints} điểm!`, 
            type: "error", 
            position: "top" 
        });
        return;
    }

    // 👉 CHỐT CHẶN: Bắt buộc phải có địa điểm
    if (!form.selectedLocation || form.selectedLocation.trim() === "") {
      openSnackbar({ text: "Bạn chưa có Địa điểm áp dụng. Vui lòng cập nhật trong Hồ sơ!", type: "error", position: "top" });
      return;
  }
    // 👉 CHỐT CHẶN: Nếu là Sản Phẩm thì bắt buộc nhập Kho
    if (form.category === "product" && (!form.stock || Number(form.stock) <= 0)) {
      openSnackbar({ text: "Vui lòng nhập Số lượng kho hợp lệ cho Sản phẩm!", type: "error", position: "top" });
      return;
  }
    setLoading(true);

    try {
      const userPhone = localStorage.getItem("user_phone");
      const validAttributes = hasVariants ? attributes.filter(a => a.name.trim() && a.values.trim()) : [];

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
        locationAddress: form.selectedLocation, 
        category: form.category,
        productCategory: form.productCategory || "Khác", // 👇 THÊM MỚI: Nếu shop quên nhập, mặc định là "Khác"
        providerId: userPhone, 
        ownerPhone: userPhone, 
        stock: form.category === "product" ? Number(form.stock) : -1,
        hasVariants: form.category === "product" ? hasVariants : false,
        attributes: form.category === "product" ? validAttributes : [],
      };

      if (id) {
        // 👇 NẾU CÓ ID -> CHẾ ĐỘ CHỈNH SỬA
        // Chỉ định đúng bảng "services" và bài viết có "id" tương ứng
        const docRef = doc(db, "services", id);
        
        // Cập nhật dữ liệu
        await updateDoc(docRef, {
            ...postData,
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
  const enteredPoints = Number(form.points) || 0;
  const requiredMinPoints = Math.floor((numericPrice * minRewardRate / 100) / 1000);
  
  // Hợp lệ khi: Chưa nhập giá (0đ) HOẶC điểm nhập vào lớn hơn/bằng điểm tối thiểu
  const isPointsValid = numericPrice === 0 || enteredPoints >= requiredMinPoints;
  // 👉 KIỂM TRA ĐỊA CHỈ: Có địa chỉ hay chưa?
  const hasValidLocation = form.selectedLocation.trim().length > 0;

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
                value={form.category}
                onChange={(val) => handleChange("category", val as string)}
                closeOnSelect
            >
                <Option value="package" title="Dịch vụ" />
                <Option value="product" title="Sản Phẩm" />
                <Option value="academy" title="Đào Tạo" />
                <Option value="franchise" title="Nhượng Quyền" />
            </Select>
        </Box>
        {/* 👉 GIAO DIỆN CHỈ HIỆN KHI CHỌN "SẢN PHẨM" */}
        {form.category === "product" && (
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
            </Box>
        )}
        <Box mb={4}>
            <Text size="small" className="mb-1 font-medium ml-1">Địa điểm áp dụng <span className="text-red-500">*</span></Text>
            {myLocations.length > 0 ? (
                <Select
                    placeholder="Chọn cơ sở thực hiện"
                    value={form.selectedLocation}
                    onChange={(val) => handleChange("selectedLocation", val as string)}
                    closeOnSelect
                >
                    <Option value="Toàn hệ thống" title="Toàn hệ thống (Tất cả chi nhánh)" />
                    {myLocations.map((loc, idx) => {
                        const addressStr = typeof loc === 'object' ? loc.address : loc;
                        return <Option key={idx} value={addressStr} title={addressStr} />;
                    })}
                </Select>
            ) : (
                // 👉 CẢNH BÁO GẮT KHI CHƯA KHAI BÁO CƠ SỞ
                <Box className="bg-red-50 p-3 rounded-lg border border-red-200 flex items-start">
                    <Icon icon="zi-warning-solid" className="text-red-500 mr-2 shrink-0" size={20}/>
                    <Text size="xSmall" className="text-red-600">
                        Bạn chưa thiết lập <b>Cơ sở thực hiện dịch vụ</b>. Vui lòng quay lại màn hình chính, chọn <b>"Quản lý hệ thống cơ sở"</b> để thêm chi nhánh trước khi đăng bài nhé!
                    </Text>
                </Box>
            )}
        </Box>

        {/* 👉 GIAO DIỆN NHẬP GIÁ MỚI */}
        <Box mb={3}>
            <Input type="number" label="Giá gốc (Chưa giảm - Tùy chọn)" placeholder="Ví dụ: 300000" value={form.originalPrice} onChange={(e) => handleChange("originalPrice", e.target.value)} />
        </Box>

        <Box mb={2} flex flexDirection="row" style={{ gap: 12 }}>
          <Box style={{ flex: 1, position: 'relative' }}>
            <Input type="number" label="Giá bán (Thực thu)" placeholder="200000" value={form.price} onChange={(e) => handleChange("price", e.target.value)} />
            
            {/* 👉 HIỂN THỊ NHÃN % GIẢM GIÁ THỜI GIAN THỰC (MÀU ĐỎ) */}
            {Number(form.originalPrice) > Number(form.price) && Number(form.price) > 0 && (
                <Box className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm z-10 animate-pulse border border-white">
                    Giảm {Math.round(((Number(form.originalPrice) - Number(form.price)) / Number(form.originalPrice)) * 100)}%
                </Box>
            )}
          </Box>
          <Box style={{ flex: 1 }}>
            <Input type="number" label="Điểm thưởng" placeholder="10" value={form.points} onChange={(e) => handleChange("points", e.target.value)} />
          </Box>
        </Box>
        {/* 👉 Hiển thị cảnh báo nhỏ cho Shop biết */}
        {/* 👉 GIAO DIỆN CẢNH BÁO THỜI GIAN THỰC */}
        {numericPrice > 0 && !isPointsValid ? (
            <Text size="xxxxSmall" className="text-red-500 italic mb-4 ml-1 font-medium">
                ⚠️ Tỷ lệ tối thiểu là {minRewardRate}% (Tương đương ít nhất {requiredMinPoints} điểm). Vui lòng nhập mức điểm cao hơn!
            </Text>
        ) : (
            <Text size="xxxxSmall" className="text-gray-400 italic mb-4 ml-1">
                * Hệ thống yêu cầu tối thiểu {minRewardRate}% (Ít nhất {requiredMinPoints} điểm). Bạn có thể tặng nhiều hơn để hút khách.
            </Text>
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
    </Page>
  );
};

export default PostPage;