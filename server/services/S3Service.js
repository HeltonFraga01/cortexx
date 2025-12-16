/**
 * S3Service - Serviço para gerenciamento de arquivos no S3
 * Suporta S3 compatível (AWS, DigitalOcean Spaces, MinIO, etc.)
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { logger } = require('../utils/logger');
const path = require('path');
const crypto = require('crypto');

class S3Service {
  constructor() {
    this.client = null;
    this.bucket = null;
    this.enabled = false;
    this.initialize();
  }

  /**
   * Inicializa o cliente S3 com as configurações do ambiente
   */
  initialize() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    this.bucket = process.env.S3_BUCKET;

    // Verificar se S3 está habilitado
    if (process.env.S3_ENABLED !== 'true') {
      logger.info('S3Service: S3 storage disabled');
      this.enabled = false;
      return;
    }

    // Validar configurações obrigatórias
    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      logger.warn('S3Service: Missing required S3 configuration', {
        hasEndpoint: !!endpoint,
        hasAccessKey: !!accessKeyId,
        hasSecretKey: !!secretAccessKey,
        hasBucket: !!this.bucket
      });
      this.enabled = false;
      return;
    }

    try {
      this.client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
      });

      this.enabled = true;
      logger.info('S3Service: Initialized successfully', {
        endpoint,
        region,
        bucket: this.bucket,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true'
      });
    } catch (error) {
      logger.error('S3Service: Failed to initialize', { error: error.message });
      this.enabled = false;
    }
  }

  /**
   * Verifica se o serviço S3 está habilitado e configurado
   */
  isEnabled() {
    return this.enabled && this.client !== null;
  }

  /**
   * Gera um nome de arquivo único para upload
   * @param {string} originalName - Nome original do arquivo
   * @param {string} userId - ID do usuário (para organização)
   * @returns {string} Caminho único no S3
   */
  generateKey(originalName, userId = 'anonymous') {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const sanitizedName = path.basename(originalName, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    return `media/${userId}/${timestamp}-${randomId}-${sanitizedName}${ext}`;
  }

  /**
   * Faz upload de um arquivo para o S3
   * @param {Object} params - Parâmetros do upload
   * @param {Buffer|Stream} params.body - Conteúdo do arquivo
   * @param {string} params.key - Caminho no S3 (ou será gerado)
   * @param {string} params.originalName - Nome original do arquivo
   * @param {string} params.contentType - MIME type do arquivo
   * @param {string} params.userId - ID do usuário
   * @param {Object} params.metadata - Metadados adicionais
   * @returns {Promise<Object>} Resultado do upload
   */
  async upload({ body, key, originalName, contentType, userId, metadata = {} }) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    const fileKey = key || this.generateKey(originalName, userId);
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
        Metadata: {
          'original-name': originalName || 'unknown',
          'user-id': userId || 'anonymous',
          'upload-date': new Date().toISOString(),
          ...metadata
        }
      });

      await this.client.send(command);

      const result = {
        key: fileKey,
        bucket: this.bucket,
        url: this.getPublicUrl(fileKey),
        contentType,
        originalName
      };

      logger.info('S3Service: File uploaded successfully', {
        key: fileKey,
        bucket: this.bucket,
        contentType,
        userId
      });

      return result;
    } catch (error) {
      logger.error('S3Service: Upload failed', {
        key: fileKey,
        bucket: this.bucket,
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Gera uma URL pré-assinada para upload direto do cliente
   * @param {Object} params - Parâmetros
   * @param {string} params.key - Caminho no S3
   * @param {string} params.contentType - MIME type esperado
   * @param {number} params.expiresIn - Tempo de expiração em segundos
   * @returns {Promise<Object>} URL e informações do upload
   */
  async getUploadUrl({ key, contentType, expiresIn = 3600 }) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType
      });

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

      logger.debug('S3Service: Generated upload URL', { key, expiresIn });

      return {
        uploadUrl,
        key,
        bucket: this.bucket,
        expiresIn
      };
    } catch (error) {
      logger.error('S3Service: Failed to generate upload URL', {
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Gera uma URL pré-assinada para download
   * @param {string} key - Caminho do arquivo no S3
   * @param {number} expiresIn - Tempo de expiração em segundos
   * @returns {Promise<string>} URL pré-assinada
   */
  async getDownloadUrl(key, expiresIn = 3600) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.debug('S3Service: Generated download URL', { key, expiresIn });

      return url;
    } catch (error) {
      logger.error('S3Service: Failed to generate download URL', {
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retorna a URL pública do arquivo (se o bucket for público)
   * @param {string} key - Caminho do arquivo
   * @returns {string} URL pública
   */
  getPublicUrl(key) {
    const endpoint = process.env.S3_ENDPOINT;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

    if (forcePathStyle) {
      return `${endpoint}/${this.bucket}/${key}`;
    }
    
    // URL estilo virtual-hosted
    const url = new URL(endpoint);
    return `${url.protocol}//${this.bucket}.${url.host}/${key}`;
  }

  /**
   * Deleta um arquivo do S3
   * @param {string} key - Caminho do arquivo
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  async delete(key) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.client.send(command);

      logger.info('S3Service: File deleted', { key, bucket: this.bucket });

      return true;
    } catch (error) {
      logger.error('S3Service: Delete failed', {
        key,
        bucket: this.bucket,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verifica se um arquivo existe no S3
   * @param {string} key - Caminho do arquivo
   * @returns {Promise<boolean>} True se existe
   */
  async exists(key) {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Obtém metadados de um arquivo
   * @param {string} key - Caminho do arquivo
   * @returns {Promise<Object>} Metadados do arquivo
   */
  async getMetadata(key) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const response = await this.client.send(command);

      return {
        key,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata
      };
    } catch (error) {
      logger.error('S3Service: Failed to get metadata', {
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Lista arquivos de um usuário
   * @param {string} userId - ID do usuário
   * @param {Object} options - Opções de listagem
   * @returns {Promise<Array>} Lista de arquivos
   */
  async listUserFiles(userId, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    const { maxKeys = 100, continuationToken } = options;
    const prefix = `media/${userId}/`;

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken
      });

      const response = await this.client.send(command);

      const files = (response.Contents || []).map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        url: this.getPublicUrl(item.Key)
      }));

      return {
        files,
        nextToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated
      };
    } catch (error) {
      logger.error('S3Service: Failed to list files', {
        userId,
        prefix,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Deleta todos os arquivos de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<number>} Número de arquivos deletados
   */
  async deleteUserFiles(userId) {
    if (!this.isEnabled()) {
      throw new Error('S3 storage is not enabled');
    }

    let deletedCount = 0;
    let continuationToken;

    try {
      do {
        const { files, nextToken } = await this.listUserFiles(userId, {
          maxKeys: 1000,
          continuationToken
        });

        for (const file of files) {
          await this.delete(file.key);
          deletedCount++;
        }

        continuationToken = nextToken;
      } while (continuationToken);

      logger.info('S3Service: User files deleted', { userId, deletedCount });

      return deletedCount;
    } catch (error) {
      logger.error('S3Service: Failed to delete user files', {
        userId,
        deletedCount,
        error: error.message
      });
      throw error;
    }
  }
}

// Singleton instance
const s3Service = new S3Service();

module.exports = { S3Service, s3Service };
