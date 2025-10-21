const axios = require('axios');
const sharp = require('sharp');

/**
 * Simple Image Processor using only Sharp (more stable)
 */
class SimpleImageProcessor {
  
  /**
   * Check if string is a valid URL
   * @param {string} string 
   * @returns {boolean}
   */
  static isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Convert image URL to base64
   * @param {string} imageUrl 
   * @returns {Promise<object>} conversion result
   */
  static async convertUrlToBase64(imageUrl) {
    const result = {
      success: false,
      base64: null,
      error: null,
      metadata: null
    };

    try {
      // Download image với timeout và headers
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        maxBodyLength: 10 * 1024 * 1024
      });

      const buffer = Buffer.from(response.data);
      
      // Get content type from response headers
      const contentType = response.headers['content-type'];
      let format = 'jpeg'; // default
      
      if (contentType) {
        if (contentType.includes('png')) format = 'png';
        else if (contentType.includes('gif')) format = 'gif';
        else if (contentType.includes('webp')) format = 'webp';
        else if (contentType.includes('bmp')) format = 'bmp';
      }

      // Convert to base64
      const base64Data = buffer.toString('base64');
      result.base64 = `data:image/${format};base64,${base64Data}`;
      
      // Get basic metadata
      result.metadata = {
        originalUrl: imageUrl,
        size: buffer.length,
        format: format,
        contentType: contentType
      };

      result.success = true;

    } catch (error) {
      console.error('❌ Error converting URL to base64:', error.message);
      
      if (error.code === 'ENOTFOUND') {
        result.error = 'Unable to reach the image URL. Please check the URL.';
      } else if (error.code === 'ETIMEDOUT') {
        result.error = 'Request timeout. The image server is not responding.';
      } else if (error.response && error.response.status === 404) {
        result.error = 'Image not found (404). Please check the URL.';
      } else if (error.response && error.response.status === 403) {
        result.error = 'Access denied (403). The image server is blocking requests.';
      } else if (error.message.includes('maxContentLength')) {
        result.error = 'Image too large. Maximum size allowed: 10MB.';
      } else {
        result.error = `Failed to fetch image: ${error.message}`;
      }
    }

    return result;
  }

  /**
   * Validate image input (base64 or URL)
   * @param {string} imageInput 
   * @returns {object} validation result
   */
  static validateImageInput(imageInput) {
    const result = {
      isValid: false,
      error: null,
      format: null,
      size: 0,
      type: null // 'base64', 'url', or 'empty'
    };

    if (!imageInput) {
      result.isValid = true; // Empty is allowed
      result.type = 'empty';
      return result;
    }

    // Check if it's a URL
    if (this.isValidUrl(imageInput)) {
      // Basic URL validation
      const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp)(\?.*)?$/i;
      if (imageExtensions.test(imageInput) || imageInput.includes('image') || imageInput.includes('.png') || imageInput.includes('.jpg')) {
        result.isValid = true;
        result.type = 'url';
        return result;
      } else {
        result.error = 'URL does not appear to be an image. Supported formats: JPG, PNG, GIF, BMP, WebP';
        return result;
      }
    }

    // Check if it's base64
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|bmp|webp);base64,(.+)$/;
    const match = imageInput.match(base64Regex);

    if (!match) {
      result.error = 'Invalid input. Expected: base64 image (data:image/[type];base64,[data]) or image URL (http/https)';
      return result;
    }

    const [, format, data] = match;
    result.format = format;
    result.type = 'base64';

    // Check if base64 data is valid
    try {
      const buffer = Buffer.from(data, 'base64');
      result.size = buffer.length;
      
      // Check file size (limit 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (result.size > maxSize) {
        result.error = `Image too large. Maximum size: ${maxSize / 1024 / 1024}MB, got: ${(result.size / 1024 / 1024).toFixed(2)}MB`;
        return result;
      }

      // Check minimum size (at least 100 bytes)
      if (result.size < 100) {
        result.error = 'Image too small or corrupted';
        return result;
      }

      result.isValid = true;
    } catch (error) {
      result.error = 'Invalid base64 data';
    }

    return result;
  }

  /**
   * Process and optimize image using Sharp
   * @param {string} base64String 
   * @param {object} options 
   * @returns {Promise<object>} processed image result
   */
  static async processImage(base64String, options = {}) {
    const defaultOptions = {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 95,
      format: 'jpeg',
      preserveAspectRatio: true
    };

    const config = { ...defaultOptions, ...options };
    
    const result = {
      success: false,
      processedBase64: null,
      originalSize: 0,
      processedSize: 0,
      compressionRatio: 0,
      metadata: null,
      error: null
    };

    try {
      if (!base64String) {
        result.success = true;
        result.processedBase64 = '';
        return result;
      }

      // Validate first
      const validation = this.validateImageInput(base64String);
      if (!validation.isValid) {
        result.error = validation.error;
        return result;
      }

      // Extract base64 data
      const base64Data = base64String.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      result.originalSize = buffer.length;

      // Get original metadata using Sharp
      const imageInfo = await sharp(buffer).metadata();
      
      result.metadata = {
        originalWidth: imageInfo.width,
        originalHeight: imageInfo.height,
        originalFormat: imageInfo.format,
        hasAlpha: imageInfo.hasAlpha
      };

      // Process image with Sharp
      let sharpInstance = sharp(buffer);
      
      // Resize if necessary
      if (config.preserveAspectRatio) {
        if (imageInfo.width > config.maxWidth || imageInfo.height > config.maxHeight) {
          sharpInstance = sharpInstance.resize(config.maxWidth, config.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      } else {
        if (imageInfo.width > config.maxWidth || imageInfo.height > config.maxHeight) {
          sharpInstance = sharpInstance.resize(config.maxWidth, config.maxHeight);
        }
      }

      // Apply format and quality
      let outputBuffer;
      let mimeType;

      switch (config.format.toLowerCase()) {
        case 'png':
          outputBuffer = await sharpInstance.png({ 
            compressionLevel: 9,
            quality: config.quality 
          }).toBuffer();
          mimeType = 'image/png';
          break;
        case 'webp':
          outputBuffer = await sharpInstance.webp({ 
            quality: config.quality 
          }).toBuffer();
          mimeType = 'image/webp';
          break;
        case 'jpeg':
        case 'jpg':
        default:
          outputBuffer = await sharpInstance.jpeg({ 
            quality: config.quality,
            progressive: true,
            mozjpeg: true
          }).toBuffer();
          mimeType = 'image/jpeg';
          break;
      }

      // Get processed metadata
      const processedInfo = await sharp(outputBuffer).metadata();
      result.metadata.processedWidth = processedInfo.width;
      result.metadata.processedHeight = processedInfo.height;
      result.metadata.processedFormat = config.format;

      // Convert back to base64
      const processedBase64Data = outputBuffer.toString('base64');
      result.processedBase64 = `data:${mimeType};base64,${processedBase64Data}`;
      result.processedSize = outputBuffer.length;
      result.compressionRatio = ((result.originalSize - result.processedSize) / result.originalSize * 100).toFixed(2);

      result.success = true;

    } catch (error) {
      console.error('Sharp processing error:', error);
      result.error = `Image processing failed: ${error.message}`;
    }

    return result;
  }

  /**
   * Get image metadata using Sharp
   * @param {string} base64String 
   * @returns {Promise<object>}
   */
  static async getImageMetadata(base64String) {
    try {
      if (!base64String) return null;

      const validation = this.validateImageInput(base64String);
      if (!validation.isValid) return null;

      const base64Data = base64String.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const metadata = await sharp(buffer).metadata();

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha,
        aspectRatio: (metadata.width / metadata.height).toFixed(2),
        channels: metadata.channels,
        density: metadata.density
      };
    } catch (error) {
      console.error('Error getting metadata:', error);
      return null;
    }
  }
}

module.exports = SimpleImageProcessor;
