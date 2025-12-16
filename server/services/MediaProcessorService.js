/**
 * MediaProcessorService - Processa e armazena mídia no S3
 * 
 * Responsável por:
 * - Download de mídia do WhatsApp (via WUZAPI)
 * - Upload para S3
 * - Gerenciamento de URLs de mídia
 */

const { logger } = require('../utils/logger');
const { s3Service } = require('./S3Service');
const axios = require('axios');
const crypto = require('crypto');

class MediaProcessorService {
  constructor() {
    this.wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
  }

  /**
   * Verifica se o processamento S3 está habilitado
   */
  isEnabled() {
    return s3Service.isEnabled();
  }

  /**
   * Processa mídia recebida - baixa do WhatsApp e sobe para S3
   * @param {Object} params - Parâmetros
   * @param {string} params.userToken - Token do usuário WUZAPI
   * @param {string} params.userId - ID do usuário (para organização no S3)
   * @param {Object} params.mediaMetadata - Metadados da mídia do WUZAPI
   * @param {string} params.mediaType - Tipo da mídia (image, video, audio, document)
   * @param {string} params.mediaMimeType - MIME type
   * @param {string} params.mediaFilename - Nome do arquivo (opcional)
   * @returns {Promise<Object>} URL S3 e metadados
   */
  async processIncomingMedia({ userToken, userId, mediaMetadata, mediaType, mediaMimeType, mediaFilename }) {
    if (!this.isEnabled()) {
      logger.debug('MediaProcessor: S3 disabled, skipping upload');
      return null;
    }

    if (!mediaMetadata) {
      logger.warn('MediaProcessor: No media metadata provided');
      return null;
    }

    try {
      // 1. Baixar mídia do WhatsApp via WUZAPI
      const mediaBuffer = await this.downloadFromWuzapi(userToken, mediaMetadata, mediaType);
      
      if (!mediaBuffer) {
        logger.warn('MediaProcessor: Failed to download media from WUZAPI');
        return null;
      }

      // 2. Gerar nome do arquivo
      const extension = this.getExtensionFromMimeType(mediaMimeType);
      const filename = mediaFilename || `${mediaType}_${Date.now()}${extension}`;

      // 3. Upload para S3
      const result = await s3Service.upload({
        body: mediaBuffer,
        originalName: filename,
        contentType: mediaMimeType,
        userId,
        metadata: {
          'media-type': mediaType,
          'source': 'whatsapp-incoming'
        }
      });

      logger.info('MediaProcessor: Incoming media uploaded to S3', {
        userId,
        mediaType,
        key: result.key,
        size: mediaBuffer.length
      });

      return {
        s3Key: result.key,
        s3Url: result.url,
        contentType: mediaMimeType,
        size: mediaBuffer.length,
        originalFilename: filename
      };
    } catch (error) {
      logger.error('MediaProcessor: Failed to process incoming media', {
        userId,
        mediaType,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Baixa mídia do WUZAPI usando os metadados encriptados
   * @param {string} userToken - Token do usuário
   * @param {Object} metadata - Metadados da mídia
   * @param {string} mediaType - Tipo da mídia
   * @returns {Promise<Buffer|null>} Buffer da mídia
   */
  async downloadFromWuzapi(userToken, metadata, mediaType) {
    try {
      // WUZAPI requer estes campos para download
      const { url, mediaKey, directPath, mimetype } = metadata;

      if (!url && !directPath) {
        logger.warn('MediaProcessor: No URL or directPath in metadata');
        return null;
      }

      // Construir payload para download
      const downloadPayload = {
        Url: url,
        MediaKey: mediaKey,
        Mimetype: mimetype,
        DirectPath: directPath
      };

      // Endpoint de download baseado no tipo
      const endpointMap = {
        'image': '/chat/download/image',
        'video': '/chat/download/video',
        'audio': '/chat/download/audio',
        'document': '/chat/download/document'
      };

      const endpoint = endpointMap[mediaType] || '/chat/download/image';

      const response = await axios.post(
        `${this.wuzapiBaseUrl}${endpoint}`,
        downloadPayload,
        {
          headers: {
            'Token': userToken,
            'Content-Type': 'application/json'
          },
          timeout: 60000, // 60s para downloads grandes
          responseType: 'arraybuffer'
        }
      );

      // Verificar se recebemos dados
      if (response.data && response.data.length > 0) {
        return Buffer.from(response.data);
      }

      // WUZAPI pode retornar JSON com base64
      if (response.headers['content-type']?.includes('application/json')) {
        const jsonResponse = JSON.parse(response.data.toString());
        if (jsonResponse.data) {
          return Buffer.from(jsonResponse.data, 'base64');
        }
      }

      return null;
    } catch (error) {
      logger.error('MediaProcessor: WUZAPI download failed', {
        mediaType,
        error: error.message,
        status: error.response?.status
      });
      return null;
    }
  }

  /**
   * Processa mídia para envio - faz upload para S3 e retorna URL
   * @param {Object} params - Parâmetros
   * @param {Buffer|string} params.data - Buffer ou base64 da mídia
   * @param {string} params.userId - ID do usuário
   * @param {string} params.filename - Nome do arquivo
   * @param {string} params.contentType - MIME type
   * @returns {Promise<Object>} URL S3 e metadados
   */
  async processOutgoingMedia({ data, userId, filename, contentType }) {
    if (!this.isEnabled()) {
      logger.debug('MediaProcessor: S3 disabled, skipping upload');
      return null;
    }

    try {
      // Converter base64 para buffer se necessário
      const buffer = Buffer.isBuffer(data) 
        ? data 
        : Buffer.from(data, 'base64');

      // Upload para S3
      const result = await s3Service.upload({
        body: buffer,
        originalName: filename,
        contentType,
        userId,
        metadata: {
          'source': 'whatsapp-outgoing'
        }
      });

      logger.info('MediaProcessor: Outgoing media uploaded to S3', {
        userId,
        key: result.key,
        size: buffer.length
      });

      return {
        s3Key: result.key,
        s3Url: result.url,
        contentType,
        size: buffer.length
      };
    } catch (error) {
      logger.error('MediaProcessor: Failed to process outgoing media', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upload de arquivo direto (File/Blob do frontend)
   * @param {Object} params - Parâmetros
   * @param {Buffer} params.buffer - Buffer do arquivo
   * @param {string} params.userId - ID do usuário
   * @param {string} params.originalName - Nome original
   * @param {string} params.contentType - MIME type
   * @returns {Promise<Object>} Resultado do upload
   */
  async uploadFile({ buffer, userId, originalName, contentType }) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    return await s3Service.upload({
      body: buffer,
      originalName,
      contentType,
      userId,
      metadata: {
        'source': 'direct-upload'
      }
    });
  }

  /**
   * Obtém extensão do arquivo baseado no MIME type
   * @param {string} mimeType - MIME type
   * @returns {string} Extensão com ponto
   */
  getExtensionFromMimeType(mimeType) {
    const mimeMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/3gpp': '.3gp',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/aac': '.aac',
      'audio/opus': '.opus',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
    };

    return mimeMap[mimeType] || '';
  }

  /**
   * Verifica se um MIME type é suportado
   * @param {string} mimeType - MIME type
   * @returns {boolean}
   */
  isSupportedMimeType(mimeType) {
    const supported = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/3gpp',
      'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/opus',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return supported.includes(mimeType);
  }
}

// Singleton
const mediaProcessorService = new MediaProcessorService();

module.exports = { MediaProcessorService, mediaProcessorService };
