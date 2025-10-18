const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  price: {
    type: String,
    required: [true, 'Price is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  file: {
    type: String,
    default: ''
  },
  // Metadata cho ảnh
  imageMetadata: {
    originalWidth: { type: Number, default: null },
    originalHeight: { type: Number, default: null },
    processedWidth: { type: Number, default: null },
    processedHeight: { type: Number, default: null },
    format: { type: String, default: null },
    size: { type: Number, default: null },
    compressionRatio: { type: String, default: null },
    hasAlpha: { type: Boolean, default: false }
  }
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

module.exports = mongoose.model('Product', productSchema);
