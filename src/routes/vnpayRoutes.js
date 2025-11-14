const express = require('express');
const router = express.Router();
const { createPayment, checkPayment } = require("../controllers/vnpayController");

// API tạo thanh toán VNPay
router.post('/create-payment', createPayment);  
// API xử lý callback từ VNPay
router.post('/check-payment', checkPayment);

module.exports = router;
