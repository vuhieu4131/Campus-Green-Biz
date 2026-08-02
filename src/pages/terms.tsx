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
          Chào mừng bạn đến với ứng dụng Campus Green Biz. Bằng việc truy cập và sử dụng dịch vụ trên nền tảng của chúng tôi, bạn đồng ý tuân thủ các điều khoản và điều kiện dưới đây.
          </Text>
          <Text className="text-gray-700 leading-relaxed text-[15px]">
          Campus Green Biz hiện tại là một dự án sinh viên phi lợi nhuận, được xây dựng và phát triển nhằm mục đích tham gia cuộc thi "Sáng tạo trẻ VNUF" do Trường Đại học Lâm Nghiệp phát động. Ở giai đoạn dự thi này, dự án hoạt động chủ yếu như một danh bạ giới thiệu địa điểm và chương trình khách hàng thân thiết. Nền tảng giúp cung cấp thông tin về các cửa hàng, nhà cung cấp uy tín hướng tới các giá trị xanh tại khu vực Campus (trường học) để người dùng tham khảo, lựa chọn; đồng thời cung cấp tính năng trải nghiệm tích điểm đổi ưu đãi. Ứng dụng hoàn toàn không thực hiện chức năng bán hàng, không thu tiền và không xử lý bất kỳ giao dịch thương mại nào trực tuyến.
          </Text>
        </Box>

        {/* Section 2 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">2. Quyền lợi và Trách nhiệm</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Người dùng được cung cấp thông tin minh bạch về danh sách cửa hàng, hình ảnh sản phẩm tham khảo và các chương trình ưu đãi đang diễn ra tại cửa hàng.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Nền tảng chỉ cung cấp thông tin liên hệ. Mọi nhu cầu mua bán, trao đổi, giao nhận sản phẩm sẽ do Người dùng liên hệ và thực hiện trực tiếp với Cửa hàng.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Người dùng cam kết sử dụng ứng dụng đúng mục đích; không thực hiện các hành vi gian lận điểm thưởng, tạo đánh giá ảo hoặc lạm dụng/trục lợi từ các chương trình mã ưu đãi của hệ thống.
            </Text>
          </Box>
        </Box>

        {/* Section 3 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">3. Chính sách Tích điểm & Ưu đãi</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Hệ thống duy trì các loại ví điểm (Ví Tính Hạng, Ví Ưu Đãi) dựa trên hoạt động của giới thiệu người dùng trên ứng dụng hoặc khi người dùng đến trải nghiệm trực tiếp tại các cửa hàng liên kết.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Điểm thưởng chỉ có giá trị sử dụng nội bộ để quy đổi thành các Mã ưu đãi/Mã giảm giá (Voucher) dùng tại cửa hàng. Điểm thưởng là hoàn toàn miễn phí, không phát sinh từ việc nạp tiền, không phải là tài sản kỹ thuật số và tuyệt đối không có giá trị quy đổi thành tiền mặt ở trong hay ngoài hệ thống.
            </Text>
          </Box>
        </Box>

        {/* Section 4 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">4. Miễn trừ trách nhiệm</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Với bản chất là một dự án học thuật đang trong quá trình thử nghiệm và dự thi, Campus Green Biz chỉ hoạt động với vai trò là kênh thông tin giới thiệu. Chúng tôi không trực tiếp kinh doanh, không sản xuất, không vận chuyển hay bảo hành bất kỳ sản phẩm/dịch vụ nào.
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
              - Ứng dụng không can thiệp vào quá trình giao dịch tài chính hay thỏa thuận giữa Người dùng và Cửa hàng. Mọi vấn đề phát sinh liên quan đến chất lượng sản phẩm, dịch vụ sẽ do Cửa hàng trực tiếp chịu trách nhiệm xử lý với Người dùng. Ban quản trị dự án cam kết sẽ hỗ trợ tiếp nhận phản hồi để điều chỉnh dữ liệu minh họa và loại bỏ các cửa hàng không đạt chất lượng ra khỏi hệ thống.
            </Text>
          </Box>
        </Box>
        {/* Section 5 */}
        <Box className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <Text size="large" bold className="text-blue-800 mb-2">5. Chính sách Quyền riêng tư và Dữ liệu cá nhân (Privacy Policy)</Text>
          <Box className="space-y-3">
            <Text className="text-gray-700 leading-relaxed text-[15px]">
            Để đáp ứng tiêu chuẩn của Zalo Mini App và bảo vệ người dùng, chúng tôi quy định rõ:
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
            - Thu thập dữ liệu: Để ứng dụng hoạt động trơn tru, Campus Green Biz có yêu cầu người dùng cấp quyền truy cập: Số điện thoại (để định danh tài khoản thành viên, hỗ trợ đăng nhập và quản lý ví điểm thưởng), Vị trí hiện tại (chỉ dùng để gợi ý các cửa hàng gần nhất, hỗ trợ tìm kiếm và chỉ đường), và Hình ảnh/Media (để tải lên ảnh đại diện cá nhân).
            </Text>
            <Text className="text-gray-700 leading-relaxed text-[15px]">
            - Sử dụng và Bảo mật dữ liệu: Chúng tôi cam kết chỉ sử dụng thông tin của bạn cho các mục đích vận hành tính năng thẻ thành viên như đã nêu. Dữ liệu của bạn được lưu trữ trên hạ tầng máy chủ bảo mật, tuyệt đối không bán hoặc chia sẻ cho bất kỳ bên thứ 3 nào vì mục đích quảng cáo khi chưa có sự đồng ý của bạn.
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
