const express = require('express');
const router = express.Router();
const ImageProcessor = require('../utils/imageProcessorSimple'); // Use stable version

// GET /api/images/metadata - Lấy metadata của ảnh
router.post('/metadata', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }
    
    const metadata = await ImageProcessor.getImageMetadata(image);
    
    if (!metadata) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image or unable to extract metadata'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Image metadata extracted successfully',
      data: metadata
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error extracting image metadata',
      error: error.message
    });
  }
});

// POST /api/images/process - Xử lý ảnh với tùy chọn
router.post('/process', async (req, res) => {
  try {
    const { image, options = {} } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }
    
    // Default options for best quality
    const defaultOptions = {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 95,
      format: 'jpeg',
      preserveAspectRatio: true,
      removeMetadata: true
    };
    
    const processingOptions = { ...defaultOptions, ...options };
    
    const result = await ImageProcessor.processImage(image, processingOptions);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Image processing failed',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Image processed successfully',
      data: {
        processedImage: result.processedBase64,
        metadata: result.metadata,
        stats: {
          originalSize: result.originalSize,
          processedSize: result.processedSize,
          compressionRatio: result.compressionRatio + '%'
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing image',
      error: error.message
    });
  }
});

// POST /api/images/validate - Validate image (URL or base64)
router.post('/validate', (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }
    
    const validation = ImageProcessor.validateImageInput(image);
    
    res.status(200).json({
      success: true,
      message: 'Image validation completed',
      data: {
        isValid: validation.isValid,
        type: validation.type,
        format: validation.format,
        size: validation.size,
        error: validation.error
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating image',
      error: error.message
    });
  }
});

// POST /api/images/convert-url - Convert URL to base64
router.post('/convert-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }
    
    // Validate URL first
    const validation = ImageProcessor.validateImageInput(url);
    if (!validation.isValid || validation.type !== 'url') {
      return res.status(400).json({
        success: false,
        message: 'Invalid image URL',
        error: validation.error
      });
    }
    
    const result = await ImageProcessor.convertUrlToBase64(url);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to convert URL to base64',
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'URL converted to base64 successfully',
      data: {
        base64: result.base64,
        metadata: result.metadata
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error converting URL to base64',
      error: error.message
    });
  }
});

module.exports = router;
