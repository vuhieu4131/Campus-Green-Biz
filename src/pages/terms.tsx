import React from "react";
import { Page, Header, Box, Text } from "zmp-ui";
import { useNavigate } from "react-router";

const TermsPage = () => {
  const navigate = useNavigate();
  return (
    <Page className="bg-gray-50 pb-8">
      <Header title="Điều khoản sử dụng" showBackIcon />
      
      <Box className="p-4 space-y-4">
        {/* Section 1 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">1. Giới thiệu</Text>
          <Text className="text-gray-700 leading-relaxed text-[15px]">
            Chào mừng bạn đến với ứng dụng Campus Green Biz. Bằng việc truy cập và sử dụng dịch vụ trên nền tảng của chúng tôi, bạn đồng ý tuân thủ các điều khoản và điều kiện dưới đây. Campus Green Biz là nền tảng kết nối người dùng với các cửa hàng, nhà cung cấp uy tín.
          </Text>
        </Box>

        {/* Section 2 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">2. Quyền lợi và Trách nhiệm</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Người dùng được cung cấp thông tin minh bạch về sản phẩm, dịch vụ, giá cả và các chương trình ưu đãi từ các cửa hàng.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Người dùng có trách nhiệm cung cấp thông tin liên hệ và địa chỉ giao hàng chính xác để đảm bảo quá trình đặt hàng và giao nhận diễn ra thuận lợi.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Người dùng cam kết tuân thủ các quy định mua sắm, không thực hiện các hành vi gian lận điểm thưởng, đặt đơn hàng ảo hoặc trục lợi từ các chương trình khuyến mãi.
            </Text>
          </Box>
        </Box>

        {/* Section 3 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">3. Chính sách Tích điểm & Ưu đãi</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Hệ thống duy trì các loại ví điểm (Ví Tính Hạng, Ví Ưu Đãi, Ví Tương Tác) dựa trên hoạt động mua sắm, giới thiệu thành viên và tương tác cộng đồng của người dùng.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Điểm thưởng chỉ có giá trị sử dụng để quy đổi thành Voucher hoặc nhận ưu đãi bên trong ứng dụng Campus Green Biz, tuyệt đối không có giá trị quy đổi thành tiền mặt ngoài hệ thống.
            </Text>
          </Box>
        </Box>

        {/* Section 4 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">4. Miễn trừ trách nhiệm</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Campus Green Biz hoạt động với vai trò nền tảng trung gian kết nối Người dùng và Cửa hàng. Chúng tôi không trực tiếp sản xuất, cung cấp hay bảo hành sản phẩm.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Mọi vấn đề phát sinh liên quan đến chất lượng sản phẩm, dịch vụ, hoặc tranh chấp trong quá trình mua bán sẽ do Cửa hàng trực tiếp chịu trách nhiệm xử lý. Tuy nhiên, nền tảng cam kết sẽ hỗ trợ tiếp nhận phản hồi và phối hợp giải quyết để bảo vệ quyền lợi chính đáng của Người dùng.
            </Text>
          </Box>
        </Box>

        {/* Action Button */}
        <Box className="pt-6 pb-4 flex justify-end border-t border-gray-100 mt-6">
          <Text 
            className="text-red-800 font-semibold cursor-pointer active:opacity-70 px-2 py-2 text-[15px]"
            onClick={() => navigate(-1)}
          >
            Đã hiểu
          </Text>
        </Box>
      </Box>
    </Page>
  );
};

export default TermsPage;
