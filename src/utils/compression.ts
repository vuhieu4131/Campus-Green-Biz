import imageCompression from 'browser-image-compression';

/**
 * Nén ảnh trước khi tải lên Firebase Storage
 * @param imageFile File ảnh gốc
 * @param maxSizeMB Kích thước tối đa tính bằng MB (mặc định 0.5 MB)
 * @param maxWidthOrHeight Chiều rộng/cao tối đa (mặc định 1920px)
 * @returns Trả về File ảnh đã được nén
 */
export const compressImage = async (
  imageFile: File,
  maxSizeMB: number = 0.5,
  maxWidthOrHeight: number = 1920
): Promise<File> => {
  const options = {
    maxSizeMB: maxSizeMB,
    maxWidthOrHeight: maxWidthOrHeight,
    useWebWorker: true,
  };

  try {
    const compressedFile = await imageCompression(imageFile, options);
    // Trả về một File mới với tên và loại giống với file gốc
    return new File([compressedFile], imageFile.name, {
      type: imageFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Lỗi khi nén ảnh:", error);
    return imageFile; // Nếu lỗi thì trả về ảnh gốc để không làm gián đoạn luồng upload
  }
};
