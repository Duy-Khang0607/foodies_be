const Order = require('../models/Order');
const Product = require('../models/Product');

// Helper function để kiểm tra có kết nối MongoDB không
const isMongoDBConnected = () => {
  return require('mongoose').connection.readyState === 1;
};

// Validate order data
const validateOrder = (orderData) => {
  const errors = [];
  
  if (!orderData.customer || !orderData.customer.name || orderData.customer.name.trim() === '') {
    errors.push('Customer name is required');
  }
  
  if (!orderData.customer || !orderData.customer.email || orderData.customer.email.trim() === '') {
    errors.push('Customer email is required');
  }
  
  if (!orderData.customer || !orderData.customer.phone || orderData.customer.phone.trim() === '') {
    errors.push('Customer phone is required');
  }
  
  if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
    errors.push('Order must have at least one item');
  } else {
    orderData.items.forEach((item, index) => {
      // Chỉ báo lỗi khi CẢ HAI product và productId đều không có
      if (!item.product && !item.productId) {
        errors.push(`Item ${index + 1}: Product ID is required`);
      }
      if (!item.name || item.name.trim() === '') {
        errors.push(`Item ${index + 1}: Product name is required`);
      }
      if (!item.price || isNaN(parseFloat(item.price)) || parseFloat(item.price) < 0) {
        errors.push(`Item ${index + 1}: Valid price is required`);
      }
      if (!item.quantity || isNaN(parseInt(item.quantity)) || parseInt(item.quantity) < 1) {
        errors.push(`Item ${index + 1}: Valid quantity (at least 1) is required`);
      }
    });
  }
  
  if (!orderData.shippingAddress || orderData.shippingAddress.trim() === '') {
    errors.push('Shipping address is required');
  }
  
  return errors;
};

// CREATE new order
const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { customer, items, shippingAddress, paymentMethod, notes } = req.body;
    
    // Validate input
    const validationErrors = validateOrder(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    // Verify products exist and prepare order items
    const orderItems = [];
    let totalAmount = 0;
    
    for (const item of items) {
      const productId = item.productId || item.product;
      
      // Try to get product from database
      let product = null;
      if (productId) {
        product = await Product.findById(productId);
      }
      
      // Use product data if available, otherwise use provided data
      const productName = product ? product.name : (item.name || 'Unknown Product');
      const productPrice = product ? parseFloat(product.price) : parseFloat(item.price);
      const quantity = parseInt(item.quantity);
      const subtotal = productPrice * quantity;
      
      if (!product && !item.name) {
        return res.status(400).json({
          success: false,
          message: `Product not found for item: ${productName}`,
          errors: [`Product ID ${productId} does not exist`]
        });
      }
      
      orderItems.push({
        product: productId || null,
        name: productName,
        price: productPrice,
        quantity: quantity,
        subtotal: subtotal
      });
      
      totalAmount += subtotal;
    }
    
    // Generate order number: ORD-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderNumber = `ORD-${dateStr}-${randomStr}`;
    
    // Create order
    const newOrder = new Order({
      orderNumber: orderNumber,
      user: userId,
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim().toLowerCase(),
        phone: customer.phone.trim()
      },
      items: orderItems,
      totalAmount: totalAmount,
      shippingAddress: shippingAddress.trim(),
      paymentMethod: paymentMethod || 'cash',
      notes: notes ? notes.trim() : undefined
    });
    
    await newOrder.save();
    
    // Populate product details for response
    await newOrder.populate('items.product', 'name price category file');
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder
    });
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};

// GET all orders
const getAllOrders = async (req, res) => {
  try {
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    const user = req.user;
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    let query;
    if (user.role === 'admin' || user.role === 'moderator') {
      query = Order.find();
    } else {
      query = Order.find({ user: user._id });
    }
    
    // Get total count for pagination
    const totalOrders = await Order.countDocuments(
      user.role === 'admin' || user.role === 'moderator' 
        ? {} 
        : { user: user._id }
    );
    
    // Get paginated orders
    let orders;
    if (user.role === 'admin' || user.role === 'moderator') {
      orders = await Order.find()
        .populate('user', 'name email phone')
        .populate('items.product', 'name price category file')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } else {
      orders = await Order.find({ user: user._id })
        .populate('items.product', 'name price category file')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalOrders / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: orders,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalOrders: totalOrders,
        ordersPerPage: limit,
        ordersOnCurrentPage: orders.length,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage
      }
    });
    
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message
    });
  }
};

// GET order by ID
const getOrderById = async (req, res) => {
  try {
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    const orderId = req.params.id;
    const user = req.user;
    
    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price category file');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check if user has permission to view this order
    if (user.role !== 'admin' && user.role !== 'moderator' && order.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this order'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: order
    });
    
  } catch (error) {
    console.error('Error retrieving order:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving order',
      error: error.message
    });
  }
};

// UPDATE order status
const updateOrderStatus = async (req, res) => {
  try {
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    const orderId = req.params.id;
    const { status, cancellationReason } = req.body;
    const user = req.user;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        errors: [`Status must be one of: ${validStatuses.join(', ')}`]
      });
    }
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check permissions: Admin/Moderator can update any order, users can only cancel their own pending orders
    if (user.role !== 'admin' && user.role !== 'moderator') {
      if (order.user.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this order'
        });
      }
      
      // Regular users can only cancel their own pending orders
      if (status !== 'cancelled' || order.status !== 'pending') {
        return res.status(403).json({
          success: false,
          message: 'You can only cancel pending orders'
        });
      }
    }
    
    // Update order
    order.status = status;
    if (status === 'cancelled' && cancellationReason) {
      order.cancellationReason = cancellationReason.trim();
    }
    
    await order.save();
    
    // Populate for response
    await order.populate('user', 'name email phone');
    await order.populate('items.product', 'name price category file');
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
    
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
};

// UPDATE order (full update)
const updateOrder = async (req, res) => {
  try {
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    const orderId = req.params.id;
    const user = req.user;
    const { customer, items, shippingAddress, paymentMethod, notes } = req.body;
    
    // Only admin/moderator can fully update orders
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update order details'
      });
    }
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Validate if items are being updated
    if (items) {
      const validationErrors = validateOrder({ ...req.body, customer: customer || order.customer });
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }
      
      // Prepare updated items
      const orderItems = [];
      for (const item of items) {
        const productId = item.productId || item.product;
        let product = null;
        if (productId) {
          product = await Product.findById(productId);
        }
        
        const productName = product ? product.name : (item.name || 'Unknown Product');
        const productPrice = product ? parseFloat(product.price) : parseFloat(item.price);
        const quantity = parseInt(item.quantity);
        
        orderItems.push({
          product: productId || null,
          name: productName,
          price: productPrice,
          quantity: quantity,
          subtotal: productPrice * quantity
        });
      }
      
      order.items = orderItems;
    }
    
    // Update other fields
    if (customer) {
      order.customer = {
        name: customer.name ? customer.name.trim() : order.customer.name,
        email: customer.email ? customer.email.trim().toLowerCase() : order.customer.email,
        phone: customer.phone ? customer.phone.trim() : order.customer.phone
      };
    }
    
    if (shippingAddress) {
      order.shippingAddress = shippingAddress.trim();
    }
    
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    
    if (notes !== undefined) {
      order.notes = notes ? notes.trim() : undefined;
    }
    
    await order.save();
    
    // Populate for response
    await order.populate('user', 'name email phone');
    await order.populate('items.product', 'name price category file');
    
    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
    
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
};

// DELETE order
const deleteOrder = async (req, res) => {
  try {
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    const orderId = req.params.id;
    const user = req.user;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Check permissions: Only admin can delete orders
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete orders'
      });
    }
    
    await Order.findByIdAndDelete(orderId);
    
    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
      data: order
    });
    
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting order',
      error: error.message
    });
  }
};

// GET orders by status
const getOrdersByStatus = async (req, res) => {
  try {
    if (!isMongoDBConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection is not available'
      });
    }
    
    const status = req.params.status;
    const user = req.user;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        errors: [`Status must be one of: ${validStatuses.join(', ')}`]
      });
    }
    
    let orders;
    if (user.role === 'admin' || user.role === 'moderator') {
      orders = await Order.find({ status })
        .populate('user', 'name email phone')
        .populate('items.product', 'name price category file')
        .sort({ createdAt: -1 });
    } else {
      orders = await Order.find({ user: user._id, status })
        .populate('items.product', 'name price category file')
        .sort({ createdAt: -1 });
    }
    
    res.status(200).json({
      success: true,
      message: `Orders with status '${status}' retrieved successfully`,
      data: orders,
      count: orders.length
    });
    
  } catch (error) {
    console.error('Error retrieving orders by status:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving orders by status',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrdersByStatus
};

