const Product = require('../models/Product');
const ImageProcessor = require('../utils/imageProcessorSimple'); // Use stable version
const fs = require('fs');
const path = require('path');

// Helper function để kiểm tra có kết nối MongoDB không
const isMongoDBConnected = () => {
  return require('mongoose').connection.readyState === 1;
};

// JSON file storage fallback
const dataFile = path.join(__dirname, '../../data', 'products.json');

const readDataFromFile = () => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return [];
  }
};

const writeDataToFile = (data) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
};

// Validate product data with enhanced image validation
const validateProduct = async (product, isUpdate = false) => {
  const errors = [];
  
  if (!isUpdate && (!product.name || product.name.trim() === '')) {
    errors.push('Name is required');
  }
  
  if (!isUpdate && (!product.description || product.description.trim() === '')) {
    errors.push('Description is required');
  }
  
  if (!isUpdate && (!product.price || isNaN(parseFloat(product.price)))) {
    errors.push('Price must be a valid number');
  }
  
  if (!isUpdate && (!product.category || product.category.trim() === '')) {
    errors.push('Category is required');
  }
  
  // Enhanced image validation - supports both URL and base64
  if (product.file) {
    const validation = ImageProcessor.validateImageInput(product.file);
    if (!validation.isValid) {
      errors.push(validation.error || 'Invalid image file');
    }
  }
  
  return errors;
};

// GET all products
const getAllProducts = async (req, res) => {
  try {
    let products;
    
    if (isMongoDBConnected()) {
      // Sử dụng MongoDB
      products = await Product.find().sort({ createdAt: -1 });
    } else {
      // Fallback to JSON file
      products = readDataFromFile();
    }
    
    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: products,
      count: products.length,
      source: isMongoDBConnected() ? 'MongoDB' : 'JSON File'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving products',
      error: error.message
    });
  }
};

// GET product by ID
const getProductById = async (req, res) => {
  try {
    let product;
    
    if (isMongoDBConnected()) {
      // Sử dụng MongoDB
      product = await Product.findById(req.params.id);
    } else {
      // Fallback to JSON file
      const products = readDataFromFile();
      product = products.find(p => p.id === req.params.id);
    }
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: product,
      source: isMongoDBConnected() ? 'MongoDB' : 'JSON File'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving product',
      error: error.message
    });
  }
};

// CREATE new product
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, file } = req.body;
    
    // Validate input
    const validationErrors = await validateProduct(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    // Process image with optimization (supports URL and base64)
    let processedImage = '';
    let imageMetadata = null;
    let imageProcessingInfo = null;
    let inputSource = 'none';
    
    if (file) {
      // Check if input is URL or base64
      const validation = ImageProcessor.validateImageInput(file);
      let imageToProcess = file;
      
      if (validation.type === 'url') {
        // Convert URL to base64 first
        const urlConversion = await ImageProcessor.convertUrlToBase64(file);
        
        if (!urlConversion.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to fetch image from URL',
            error: urlConversion.error
          });
        }
        
        imageToProcess = urlConversion.base64;
        inputSource = 'url';
      } else {
        inputSource = 'base64';
      }
      
      // Configure image processing options
      const imageOptions = {
        maxWidth: 1920,     // Max width for high quality
        maxHeight: 1080,    // Max height for high quality  
        quality: 95,        // High quality (95%)
        format: 'jpeg',     // Optimal format for photos
        preserveAspectRatio: true,
        removeMetadata: true
      };
      
      const processingResult = await ImageProcessor.processImage(imageToProcess, imageOptions);
      
      if (!processingResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Image processing failed',
          error: processingResult.error
        });
      }
      
      processedImage = processingResult.processedBase64;
      imageMetadata = processingResult.metadata;
      imageProcessingInfo = {
        originalSize: processingResult.originalSize,
        processedSize: processingResult.processedSize,
        compressionRatio: processingResult.compressionRatio,
        source: inputSource,
        originalInput: validation.type === 'url' ? file : 'base64 data'
      };
    }
    
    let newProduct;
    
    if (isMongoDBConnected()) {
      // Sử dụng MongoDB
      newProduct = new Product({
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price).toString(),
        category: category.trim(),
        file: processedImage,
        imageMetadata: imageMetadata
      });
      
      await newProduct.save();
      ('✅ Product saved to MongoDB:', newProduct._id);
    } else {
      // Fallback to JSON file
      const { v4: uuidv4 } = require('uuid');
      newProduct = {
        id: uuidv4(),
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price).toString(),
        category: category.trim(),
        file: processedImage,
        imageMetadata: imageMetadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const products = readDataFromFile();
      products.push(newProduct);
      
      if (!writeDataToFile(products)) {
        return res.status(500).json({
          success: false,
          message: 'Error saving product to file'
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct,
      source: isMongoDBConnected() ? 'MongoDB' : 'JSON File',
      imageProcessing: imageProcessingInfo
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

// UPDATE product
const updateProduct = async (req, res) => {
  try {
    // Validate ID parameter
    const productId = req.params.id;
    if (!productId || productId === 'undefined' || productId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID provided'
      });
    }

    const { name, description, price, category, file } = req.body;
    
    // Validate input
    const validationErrors = await validateProduct(req.body, true);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    // Process image if provided
    let processedImage = undefined;
    let imageMetadata = null;
    let imageProcessingInfo = null;
    
    if (file !== undefined) {
      if (file === '') {
        // Empty string means remove image
        processedImage = '';
        imageMetadata = null;
      } else {
        // Process new image (supports URL and base64)
        // Check if input is URL or base64
        const validation = ImageProcessor.validateImageInput(file);
        let imageToProcess = file;
        let inputSource = 'base64';
        
        if (validation.type === 'url') {
          // Convert URL to base64 first
          const urlConversion = await ImageProcessor.convertUrlToBase64(file);
          
          if (!urlConversion.success) {
            return res.status(400).json({
              success: false,
              message: 'Failed to fetch image from URL',
              error: urlConversion.error
            });
          }
          
          imageToProcess = urlConversion.base64;
          inputSource = 'url';
        }
        
        const imageOptions = {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 95,
          format: 'jpeg',
          preserveAspectRatio: true,
          removeMetadata: true
        };
        
        const processingResult = await ImageProcessor.processImage(imageToProcess, imageOptions);
        
        if (!processingResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Image processing failed',
            error: processingResult.error
          });
        }
        
        processedImage = processingResult.processedBase64;
        imageMetadata = processingResult.metadata;
        imageProcessingInfo = {
          originalSize: processingResult.originalSize,
          processedSize: processingResult.processedSize,
          compressionRatio: processingResult.compressionRatio,
          source: inputSource,
          originalInput: validation.type === 'url' ? file : 'base64 data'
        };
      }
    }
    
    let updatedProduct;
    
    if (isMongoDBConnected()) {
      // Sử dụng MongoDB
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (description) updateData.description = description.trim();
      if (price) updateData.price = parseFloat(price).toString();
      if (category) updateData.category = category.trim();
      if (processedImage !== undefined) {
        updateData.file = processedImage;
        updateData.imageMetadata = imageMetadata;
      }
      
      updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    } else {
      // Fallback to JSON file
      const products = readDataFromFile();
      const productIndex = products.findIndex(p => p.id === productId);
      
      if (productIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      const existingProduct = products[productIndex];
      updatedProduct = {
        ...existingProduct,
        ...(name && { name: name.trim() }),
        ...(description && { description: description.trim() }),
        ...(price && { price: parseFloat(price).toString() }),
        ...(category && { category: category.trim() }),
        ...(processedImage !== undefined && { file: processedImage }),
        ...(imageMetadata !== undefined && { imageMetadata: imageMetadata }),
        updatedAt: new Date().toISOString()
      };
      
      products[productIndex] = updatedProduct;
      
      if (!writeDataToFile(products)) {
        return res.status(500).json({
          success: false,
          message: 'Error updating product in file'
        });
      }
    }
    
    const response = {
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct,
      source: isMongoDBConnected() ? 'MongoDB' : 'JSON File'
    };
    
    if (imageProcessingInfo) {
      response.imageProcessing = imageProcessingInfo;
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

// DELETE product
const deleteProduct = async (req, res) => {
  try {
    let deletedProduct;
    
    if (isMongoDBConnected()) {
      // Sử dụng MongoDB
      deletedProduct = await Product.findByIdAndDelete(req.params.id);
      
      if (!deletedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
    } else {
      // Fallback to JSON file
      const products = readDataFromFile();
      const productIndex = products.findIndex(p => p.id === req.params.id);
      
      if (productIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      deletedProduct = products.splice(productIndex, 1)[0];
      
      if (!writeDataToFile(products)) {
        return res.status(500).json({
          success: false,
          message: 'Error deleting product from file'
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deletedProduct,
      source: isMongoDBConnected() ? 'MongoDB' : 'JSON File'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
