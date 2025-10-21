const Jimp = require('jimp');
const axios = require('axios');

/**
 * Xử lý và tối ưu hóa ảnh base64
 */
class ImageProcessor {
  
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
   * Legacy method for backward compatibility
   * @param {string} base64String 
   * @returns {object} validation result
   */
  static validateBase64Image(base64String) {
    return this.validateImageInput(base64String);
  }

  /**
   * Process and optimize image
   * @param {string} base64String 
   * @param {object} options 
   * @returns {Promise<object>} processed image result
   */
  static async processImage(base64String, options = {}) {
    const defaultOptions = {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 90,
      format: 'jpeg', // jpeg, png, webp
      preserveAspectRatio: true,
      removeMetadata: true
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
      const validation = this.validateBase64Image(base64String);
      if (!validation.isValid) {
        result.error = validation.error;
        return result;
      }

      // Extract base64 data
      const base64Data = base64String.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      result.originalSize = buffer.length;

      // Load image with Jimp
      let image;
      try {
        image = await Jimp.read(buffer);
      } catch (jimpError) {
        console.error('Jimp read error:', jimpError);
        // Fallback: try reading directly from buffer
        image = await new Promise((resolve, reject) => {
          Jimp.read(buffer, (err, img) => {
            if (err) reject(err);
            else resolve(img);
          });
        });
      }
      
      // Get original metadata
      result.metadata = {
        originalWidth: image.getWidth(),
        originalHeight: image.getHeight(),
        originalFormat: validation.format,
        hasAlpha: image.hasAlpha()
      };

      // Resize if necessary (maintain aspect ratio)
      let processedImage = image.clone();
      
      if (config.preserveAspectRatio) {
        if (image.getWidth() > config.maxWidth || image.getHeight() > config.maxHeight) {
          processedImage = processedImage.scaleToFit(config.maxWidth, config.maxHeight);
        }
      } else {
        if (image.getWidth() > config.maxWidth || image.getHeight() > config.maxHeight) {
          processedImage = processedImage.resize(config.maxWidth, config.maxHeight);
        }
      }

      // Remove metadata if requested
      if (config.removeMetadata) {
        // Jimp automatically removes EXIF data
      }

      // Apply quality settings based on format
      let outputBuffer;
      let mimeType;

      try {
        switch (config.format.toLowerCase()) {
          case 'png':
            // PNG doesn't have quality, but we can optimize
            outputBuffer = await new Promise((resolve, reject) => {
              processedImage.png().getBuffer(Jimp.MIME_PNG, (err, buffer) => {
                if (err) reject(err);
                else resolve(buffer);
              });
            });
            mimeType = 'image/png';
            break;
          case 'webp':
            // WebP with quality (fallback to JPEG since Jimp doesn't support WebP well)
            outputBuffer = await new Promise((resolve, reject) => {
              processedImage.quality(config.quality).getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
                if (err) reject(err);
                else resolve(buffer);
              });
            });
            mimeType = 'image/jpeg'; // Fallback to JPEG
            break;
          case 'jpeg':
          case 'jpg':
          default:
            // JPEG with quality
            outputBuffer = await new Promise((resolve, reject) => {
              processedImage.quality(config.quality).getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
                if (err) reject(err);
                else resolve(buffer);
              });
            });
            mimeType = 'image/jpeg';
            break;
        }
      } catch (bufferError) {
        console.error('Error generating output buffer:', bufferError);
        result.error = 'Failed to generate processed image buffer';
        return result;
      }

      // Convert back to base64
      const processedBase64Data = outputBuffer.toString('base64');
      result.processedBase64 = `data:${mimeType};base64,${processedBase64Data}`;
      result.processedSize = outputBuffer.length;
      result.compressionRatio = ((result.originalSize - result.processedSize) / result.originalSize * 100).toFixed(2);

      // Add processed metadata
      result.metadata.processedWidth = processedImage.getWidth();
      result.metadata.processedHeight = processedImage.getHeight();
      result.metadata.processedFormat = config.format;

      result.success = true;

    } catch (error) {
      result.error = `Image processing failed: ${error.message}`;
    }

    return result;
  }

  /**
   * Quick validation without processing
   * @param {string} base64String 
   * @returns {boolean}
   */
  static isValidBase64Image(base64String) {
    return this.validateBase64Image(base64String).isValid;
  }

  /**
   * Get image metadata without processing
   * @param {string} base64String 
   * @returns {Promise<object>}
   */
  static async getImageMetadata(base64String) {
    try {
      if (!base64String) return null;

      const validation = this.validateBase64Image(base64String);
      if (!validation.isValid) return null;

      const base64Data = base64String.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      let image;
      try {
        image = await Jimp.read(buffer);
      } catch (jimpError) {
        console.error('Jimp read error in metadata:', jimpError);
        // Try callback version
        image = await new Promise((resolve, reject) => {
          Jimp.read(buffer, (err, img) => {
            if (err) reject(err);
            else resolve(img);
          });
        });
      }

      return {
        width: image.getWidth(),
        height: image.getHeight(),
        format: validation.format,
        size: validation.size,
        hasAlpha: image.hasAlpha(),
        aspectRatio: (image.getWidth() / image.getHeight()).toFixed(2)
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = ImageProcessor;

