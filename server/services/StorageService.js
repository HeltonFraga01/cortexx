/**
 * Storage Service
 * Task 14.3: Create StorageService.js
 * 
 * Handles media uploads, signed URLs, and cascade deletes
 * Uses Supabase Storage with RLS policies
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Bucket names
const MEDIA_BUCKET = 'media';
const AVATARS_BUCKET = 'avatars';

// Allowed MIME types
const ALLOWED_MEDIA_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_AVATAR_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp'
];

// Size limits
const MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

class StorageService {
  /**
   * Upload media file for a conversation
   * @param {Buffer} fileBuffer - File content
   * @param {string} filename - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<{path: string, url: string, error: any}>}
   */
  async uploadMedia(fileBuffer, filename, mimeType, conversationId) {
    try {
      // Validate MIME type
      if (!ALLOWED_MEDIA_TYPES.includes(mimeType)) {
        return {
          path: null,
          url: null,
          error: { code: 'INVALID_FILE_TYPE', message: `File type ${mimeType} not allowed` }
        };
      }

      // Validate file size
      if (fileBuffer.length > MAX_MEDIA_SIZE) {
        return {
          path: null,
          url: null,
          error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${MAX_MEDIA_SIZE / 1024 / 1024}MB limit` }
        };
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `conversations/${conversationId}/${timestamp}_${sanitizedFilename}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, fileBuffer, {
          contentType: mimeType,
          upsert: false
        });

      if (error) {
        logger.error('Media upload failed', {
          conversationId,
          filename,
          error: error.message
        });
        return {
          path: null,
          url: null,
          error: { code: 'UPLOAD_FAILED', message: error.message }
        };
      }

      logger.info('Media uploaded successfully', {
        conversationId,
        path: data.path
      });

      return {
        path: data.path,
        url: `${MEDIA_BUCKET}/${data.path}`,
        error: null
      };
    } catch (error) {
      logger.error('StorageService.uploadMedia error', {
        error: error.message,
        stack: error.stack
      });
      return {
        path: null,
        url: null,
        error: { code: 'STORAGE_ERROR', message: error.message }
      };
    }
  }

  /**
   * Upload avatar for a user
   * @param {Buffer} fileBuffer - File content
   * @param {string} filename - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} userId - User UUID
   * @returns {Promise<{path: string, url: string, error: any}>}
   */
  async uploadAvatar(fileBuffer, filename, mimeType, userId) {
    try {
      // Validate MIME type
      if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
        return {
          path: null,
          url: null,
          error: { code: 'INVALID_FILE_TYPE', message: `File type ${mimeType} not allowed for avatars` }
        };
      }

      // Validate file size
      if (fileBuffer.length > MAX_AVATAR_SIZE) {
        return {
          path: null,
          url: null,
          error: { code: 'FILE_TOO_LARGE', message: `Avatar exceeds ${MAX_AVATAR_SIZE / 1024 / 1024}MB limit` }
        };
      }

      // Generate path
      const ext = filename.split('.').pop() || 'jpg';
      const path = `${userId}/avatar.${ext}`;

      // Upload to Supabase Storage (upsert to replace existing)
      const { data, error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, fileBuffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        logger.error('Avatar upload failed', {
          userId,
          error: error.message
        });
        return {
          path: null,
          url: null,
          error: { code: 'UPLOAD_FAILED', message: error.message }
        };
      }

      // Get public URL for avatar
      const { data: urlData } = supabase.storage
        .from(AVATARS_BUCKET)
        .getPublicUrl(data.path);

      logger.info('Avatar uploaded successfully', {
        userId,
        path: data.path
      });

      return {
        path: data.path,
        url: urlData.publicUrl,
        error: null
      };
    } catch (error) {
      logger.error('StorageService.uploadAvatar error', {
        error: error.message,
        stack: error.stack
      });
      return {
        path: null,
        url: null,
        error: { code: 'STORAGE_ERROR', message: error.message }
      };
    }
  }

  /**
   * Get signed URL for private media file
   * @param {string} path - File path in storage
   * @param {number} expiresIn - Expiration time in seconds (default 1 hour)
   * @returns {Promise<{signedUrl: string, error: any}>}
   */
  async getSignedUrl(path, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(path, expiresIn);

      if (error) {
        logger.error('Failed to create signed URL', {
          path,
          error: error.message
        });
        return {
          signedUrl: null,
          error: { code: 'SIGNED_URL_FAILED', message: error.message }
        };
      }

      return {
        signedUrl: data.signedUrl,
        error: null
      };
    } catch (error) {
      logger.error('StorageService.getSignedUrl error', {
        error: error.message,
        stack: error.stack
      });
      return {
        signedUrl: null,
        error: { code: 'STORAGE_ERROR', message: error.message }
      };
    }
  }

  /**
   * Delete all media files for a conversation
   * Task 14.4: Cascade delete for conversation media
   * @param {string} conversationId - Conversation UUID
   * @returns {Promise<{deleted: number, error: any}>}
   */
  async deleteConversationMedia(conversationId) {
    try {
      const folderPath = `conversations/${conversationId}`;

      // List all files in the conversation folder
      const { data: files, error: listError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .list(folderPath);

      if (listError) {
        logger.error('Failed to list conversation media', {
          conversationId,
          error: listError.message
        });
        return {
          deleted: 0,
          error: { code: 'LIST_FAILED', message: listError.message }
        };
      }

      if (!files || files.length === 0) {
        logger.debug('No media files to delete', { conversationId });
        return { deleted: 0, error: null };
      }

      // Build file paths for deletion
      const filePaths = files.map(file => `${folderPath}/${file.name}`);

      // Delete all files
      const { error: deleteError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove(filePaths);

      if (deleteError) {
        logger.error('Failed to delete conversation media', {
          conversationId,
          error: deleteError.message
        });
        return {
          deleted: 0,
          error: { code: 'DELETE_FAILED', message: deleteError.message }
        };
      }

      logger.info('Conversation media deleted', {
        conversationId,
        filesDeleted: filePaths.length
      });

      return {
        deleted: filePaths.length,
        error: null
      };
    } catch (error) {
      logger.error('StorageService.deleteConversationMedia error', {
        error: error.message,
        stack: error.stack
      });
      return {
        deleted: 0,
        error: { code: 'STORAGE_ERROR', message: error.message }
      };
    }
  }

  /**
   * Delete a specific file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path
   * @returns {Promise<{success: boolean, error: any}>}
   */
  async deleteFile(bucket, path) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        logger.error('Failed to delete file', {
          bucket,
          path,
          error: error.message
        });
        return {
          success: false,
          error: { code: 'DELETE_FAILED', message: error.message }
        };
      }

      logger.info('File deleted', { bucket, path });
      return { success: true, error: null };
    } catch (error) {
      logger.error('StorageService.deleteFile error', {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: { code: 'STORAGE_ERROR', message: error.message }
      };
    }
  }

  /**
   * Get file metadata
   * @param {string} bucket - Bucket name
   * @param {string} path - File path
   * @returns {Promise<{metadata: object, error: any}>}
   */
  async getFileMetadata(bucket, path) {
    try {
      // Extract folder and filename
      const parts = path.split('/');
      const filename = parts.pop();
      const folder = parts.join('/');

      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, {
          search: filename
        });

      if (error) {
        return {
          metadata: null,
          error: { code: 'METADATA_FAILED', message: error.message }
        };
      }

      const file = data?.find(f => f.name === filename);
      if (!file) {
        return {
          metadata: null,
          error: { code: 'FILE_NOT_FOUND', message: 'File not found' }
        };
      }

      return {
        metadata: {
          name: file.name,
          size: file.metadata?.size,
          mimeType: file.metadata?.mimetype,
          createdAt: file.created_at,
          updatedAt: file.updated_at
        },
        error: null
      };
    } catch (error) {
      logger.error('StorageService.getFileMetadata error', {
        error: error.message,
        stack: error.stack
      });
      return {
        metadata: null,
        error: { code: 'STORAGE_ERROR', message: error.message }
      };
    }
  }
}

// Export singleton instance
module.exports = new StorageService();
