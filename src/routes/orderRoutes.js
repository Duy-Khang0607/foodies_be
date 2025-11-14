const express = require('express');
const router = express.Router();
const {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrdersByStatus
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

// Tất cả routes đều yêu cầu authentication
router.use(authenticate);

// Routes
// POST /api/orders - Tạo đơn hàng mới (user đặt hàng)
router.post('/create-order', createOrder);

// GET /api/orders - Lấy tất cả đơn hàng (user thấy của mình, admin thấy tất cả)
router.get('/get-all-orders', getAllOrders);

// GET /api/orders/status/:status - Lấy đơn hàng theo trạng thái
router.get('/status/:status', getOrdersByStatus);

// GET /api/orders/:id - Lấy đơn hàng theo ID
router.get('/:id', getOrderById);

// PUT /api/orders/:id - Cập nhật trạng thái đơn hàng
router.put('/:id', updateOrderStatus);

// PUT /api/orders/:id/update - Cập nhật toàn bộ thông tin đơn hàng (chỉ admin)
router.put('/:id/update', authorize('admin', 'moderator'), updateOrder);

// DELETE /api/orders/:id - Xóa đơn hàng (chỉ admin)
router.delete('/:id', authorize('admin'), deleteOrder);

module.exports = router;

