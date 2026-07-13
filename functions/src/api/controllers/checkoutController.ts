import * as functions from 'firebase-functions';

// HTTP Function (API Endpoint) dùng để sinh VietQR Code hoặc tạo đơn hàng
export const generateVietQR = functions.https.onRequest((req, res) => {
    // Logic sẽ triển khai thực tế ở Phase 2: nhận thông tin đơn hàng, gọi API ngân hàng (như VietQR.io)
    // để lấy mã QR động trả về cho Zalo Mini App.
    res.status(200).send({
        success: true,
        message: 'VietQR Generated (Mock)',
        qrData: '00020101021138580010A000000727012800069704030114190333333333330208QRIBFTTA530370454061000005802VN62180814ThanhToanDonHang6304A1B2'
    });
});
