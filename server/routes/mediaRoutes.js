/**
 * Media Routes - Endpoints para upload e gerenciamento de mídia
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { s3Service } = require('../services/S3Service');
const { logger } = require('../utils/logger');
const { requireAuth: authenticate } = require('../middleware/auth');
const { featureMiddleware } = require('../middleware/featureEnforcement');
const QuotaService = require('../services/QuotaService');
const db = require('../database');

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.S3_UPLOAD_MAX_SIZE) || 52428800 // 50MB default
  },
  fileFilter: (req, file, cb) => {
    // Tipos permitidos
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

/**
 * GET /api/media/status
 * Verifica se o serviço S3 está habilitado
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const enabled = s3Service.isEnabled();
    
    res.json({
      success: true,
      data: {
        enabled,
        bucket: enabled ? process.env.S3_BUCKET : null,
        maxFileSize: parseInt(process.env.S3_UPLOAD_MAX_SIZE) || 52428800
      }
    });
  } catch (error) {
    logger.error('Media status check failed', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/media/status'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media/upload
 * Upload direto de arquivo para S3
 */
router.post('/upload', authenticate, featureMiddleware.mediaStorage, upload.single('file'), async (req, res) => {
  try {
    if (!s3Service.isEnabled()) {
      return res.status(503).json({ 
        error: 'S3 storage is not enabled',
        code: 'S3_DISABLED'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.user?.id || req.user?.token || 'anonymous';
    const fileSizeMb = req.file.size / (1024 * 1024); // Convert bytes to MB
    
    // Check storage quota before upload
    const quotaService = new QuotaService(db);
    const quotaCheck = await quotaService.checkQuota(
      userId, 
      QuotaService.QUOTA_TYPES.MAX_STORAGE_MB, 
      fileSizeMb
    );
    
    if (!quotaCheck.allowed) {
      logger.warn('Storage quota exceeded', {
        userId,
        currentUsage: quotaCheck.usage,
        limit: quotaCheck.limit,
        requested: fileSizeMb,
        endpoint: '/api/media/upload'
      });
      
      return res.status(429).json({
        error: 'Quota de armazenamento excedida',
        code: 'QUOTA_EXCEEDED',
        details: {
          quotaType: 'max_storage_mb',
          limit: quotaCheck.limit,
          currentUsage: quotaCheck.usage,
          remaining: quotaCheck.remaining,
          requested: fileSizeMb
        },
        message: 'Você atingiu o limite de armazenamento. Faça upgrade do seu plano para continuar.'
      });
    }
    
    const result = await s3Service.upload({
      body: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      userId,
      metadata: {
        'uploaded-via': 'api',
        'original-size': req.file.size.toString()
      }
    });

    // Track storage usage after successful upload
    await quotaService.incrementUsage(userId, QuotaService.QUOTA_TYPES.MAX_STORAGE_MB, fileSizeMb);

    logger.info('File uploaded via API', {
      userId,
      key: result.key,
      contentType: req.file.mimetype,
      size: req.file.size,
      sizeMb: fileSizeMb,
      endpoint: '/api/media/upload'
    });

    res.json({
      success: true,
      data: {
        key: result.key,
        url: result.url,
        contentType: result.contentType,
        originalName: result.originalName,
        size: req.file.size
      }
    });
  } catch (error) {
    logger.error('File upload failed', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/media/upload'
    });

    if (error.message.includes('File too large')) {
      return res.status(413).json({ error: 'File too large' });
    }

    if (error.message.includes('not allowed')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media/presigned-upload
 * Gera URL pré-assinada para upload direto do cliente
 */
router.post('/presigned-upload', authenticate, async (req, res) => {
  try {
    if (!s3Service.isEnabled()) {
      return res.status(503).json({ 
        error: 'S3 storage is not enabled',
        code: 'S3_DISABLED'
      });
    }

    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ 
        error: 'filename and contentType are required' 
      });
    }

    const userId = req.user?.id || req.user?.token || 'anonymous';
    const key = s3Service.generateKey(filename, userId);
    const expiresIn = parseInt(process.env.S3_PRESIGNED_URL_EXPIRY) || 3600;

    const result = await s3Service.getUploadUrl({
      key,
      contentType,
      expiresIn
    });

    logger.info('Presigned upload URL generated', {
      userId,
      key,
      contentType,
      expiresIn,
      endpoint: '/api/media/presigned-upload'
    });

    res.json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        key: result.key,
        expiresIn: result.expiresIn,
        publicUrl: s3Service.getPublicUrl(key)
      }
    });
  } catch (error) {
    logger.error('Presigned URL generation failed', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/media/presigned-upload'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/media/download/:key(*)
 * Gera URL pré-assinada para download
 */
router.get('/download/:key(*)', authenticate, async (req, res) => {
  try {
    if (!s3Service.isEnabled()) {
      return res.status(503).json({ 
        error: 'S3 storage is not enabled',
        code: 'S3_DISABLED'
      });
    }

    const { key } = req.params;
    const userId = req.user?.id || req.user?.token;

    // Verificar se o arquivo pertence ao usuário (segurança)
    if (!key.includes(`media/${userId}/`) && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exists = await s3Service.exists(key);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const expiresIn = parseInt(process.env.S3_PRESIGNED_URL_EXPIRY) || 3600;
    const downloadUrl = await s3Service.getDownloadUrl(key, expiresIn);

    res.json({
      success: true,
      data: {
        downloadUrl,
        expiresIn
      }
    });
  } catch (error) {
    logger.error('Download URL generation failed', {
      error: error.message,
      key: req.params.key,
      userId: req.user?.id,
      endpoint: '/api/media/download'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/media/list
 * Lista arquivos do usuário
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    if (!s3Service.isEnabled()) {
      return res.status(503).json({ 
        error: 'S3 storage is not enabled',
        code: 'S3_DISABLED'
      });
    }

    const userId = req.user?.id || req.user?.token || 'anonymous';
    const { maxKeys, continuationToken } = req.query;

    const result = await s3Service.listUserFiles(userId, {
      maxKeys: parseInt(maxKeys) || 100,
      continuationToken
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('File listing failed', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/media/list'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/media/:key(*)
 * Deleta um arquivo
 */
router.delete('/:key(*)', authenticate, async (req, res) => {
  try {
    if (!s3Service.isEnabled()) {
      return res.status(503).json({ 
        error: 'S3 storage is not enabled',
        code: 'S3_DISABLED'
      });
    }

    const { key } = req.params;
    const userId = req.user?.id || req.user?.token;

    // Verificar se o arquivo pertence ao usuário (segurança)
    if (!key.includes(`media/${userId}/`) && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get file metadata before deletion to track storage
    let fileSizeMb = 0;
    try {
      const metadata = await s3Service.getMetadata(key);
      fileSizeMb = (metadata.contentLength || 0) / (1024 * 1024);
    } catch (metaError) {
      // File might not exist, continue with deletion attempt
      if (metaError.name !== 'NotFound' && metaError.$metadata?.httpStatusCode !== 404) {
        logger.warn('Could not get file metadata before deletion', { key, error: metaError.message });
      }
    }

    const exists = await s3Service.exists(key);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    await s3Service.delete(key);

    // Decrement storage usage after successful deletion
    if (fileSizeMb > 0) {
      const quotaService = new QuotaService(db);
      await quotaService.decrementUsage(userId, QuotaService.QUOTA_TYPES.MAX_STORAGE_MB, fileSizeMb);
    }

    logger.info('File deleted', {
      userId,
      key,
      sizeMb: fileSizeMb,
      endpoint: '/api/media/delete'
    });

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    logger.error('File deletion failed', {
      error: error.message,
      key: req.params.key,
      userId: req.user?.id,
      endpoint: '/api/media/delete'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/media/info/:key(*)
 * Obtém informações de um arquivo
 */
router.get('/info/:key(*)', authenticate, async (req, res) => {
  try {
    if (!s3Service.isEnabled()) {
      return res.status(503).json({ 
        error: 'S3 storage is not enabled',
        code: 'S3_DISABLED'
      });
    }

    const { key } = req.params;
    const userId = req.user?.id || req.user?.token;

    // Verificar se o arquivo pertence ao usuário (segurança)
    if (!key.includes(`media/${userId}/`) && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const metadata = await s3Service.getMetadata(key);

    res.json({
      success: true,
      data: {
        ...metadata,
        url: s3Service.getPublicUrl(key)
      }
    });
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'File not found' });
    }

    logger.error('File info retrieval failed', {
      error: error.message,
      key: req.params.key,
      userId: req.user?.id,
      endpoint: '/api/media/info'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
