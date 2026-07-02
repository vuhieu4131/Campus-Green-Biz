import * as functions from 'firebase-functions';

// API Endpoint đổi điểm lấy Voucher
export const redeemVoucher = functions.https.onRequest((req, res) => {
    // Logic: Nhận token, kiểm tra số dư điểm, trừ điểm bằng Transaction, và cấp voucher vào user_vouchers
    res.status(200).send({
        success: true,
        message: 'Redeemed voucher successfully (Mock)'
    });
});
