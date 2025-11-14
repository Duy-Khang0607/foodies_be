const { VNPay, ignoreLogger, ProductCode, VnpLocale } = require("vnpay");

const vnpayConfig = { 
  tmnCode: "2OEQHL4T", 
  secureSecret: "2JOQ01SGQHJ7SHSE41WV2BZTQKT6G4AP", 
  vnpayHost: "https://sandbox.vnpayment.vn",
  testMode: true,
  hashAlgorithm: "SHA512", 
  loggerFn: ignoreLogger,
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};


const createPayment = async (req, res) => {
    try {
      const { amount, orderInfo, returnUrl } = req.body;
  
      // Validate input
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount is required and must be greater than 0",
        });
      }
  
      if (!orderInfo) {
        return res.status(400).json({
          success: false,
          message: "Order info is required",
        });
      }
  
      // Tạo VNPay instance
      const vnpay = new VNPay(vnpayConfig);
  
      // Tạo timestamp hiện tại
      const now = new Date();
      const createDate = formatDate(now);
      const expireDate = formatDate(new Date(now.getTime() + 30 * 60 * 1000)); // 30 phút
  
      // Tạo transaction reference duy nhất
      const txnRef = `ORDER${Date.now()}`;
  
      // Convert amount to number and ensure it's in VND (not already in cents)
      const amountInVND = parseFloat(amount);
      const amountInCents = Math.round(amountInVND * 1000); // Convert VND to cents
      
      // Payment parameters
      const paymentParams = {
        vnp_Amount: amountInCents, // VNPay yêu cầu amount tính bằng xu
        vnp_IpAddr: req.ip || req.connection.remoteAddress || "127.0.0.1",
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl:
          returnUrl ||
          `http://localhost:${process.env.PORT || 3000}/api/vnpay/check-payment`,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate,
        vnp_Locale: VnpLocale.Vietnamese || "vn",
      };
  
      // Build payment URL
      const paymentUrl = await vnpay.buildPaymentUrl(paymentParams);
  
      res.json({
        success: true,
        paymentUrl: paymentUrl,
        txnRef: txnRef,
        amount: amountInVND, // Return original amount in VND
        amountInCents: amountInCents, // Amount sent to VNPay
        currency: "VND",
        debug: {
          createDate,
          expireDate,
          txnRef,
          originalAmount: amount,
          amountInVND: amountInVND,
          amountInCents: amountInCents,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.stack,
      });
    }
};

const checkPayment = async (req, res) => {
    try {
      const vnpay = new VNPay(vnpayConfig);
      const isValid = vnpay.verifyReturnUrl(req.query);
  
      if (isValid) {
        const amountInCents = parseInt(req.query.vnp_Amount);
        const amountInVND = amountInCents / 100;
        
        res.json({
          success: true,
          message: "Payment successful",
          data: {
            txnRef: req.query.vnp_TxnRef,
            amount: amountInVND, 
            amountInCents: amountInCents, 
            responseCode: req.query.vnp_ResponseCode,
            transactionId: req.query.vnp_TransactionNo,
            bankCode: req.query.vnp_BankCode,
            payDate: req.query.vnp_PayDate,
          },
        });
      } else {
        res.json({
          success: false,
          message: "Payment failed - Invalid signature",
          data: req.query,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
};

module.exports = {
    createPayment,
    checkPayment
}
