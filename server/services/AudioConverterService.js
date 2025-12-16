/**
 * AudioConverterService - Converte áudio para formato OGG/Opus
 * 
 * O WhatsApp requer áudio no formato OGG com codec Opus para reprodução correta.
 * Este serviço usa FFmpeg para converter qualquer formato de áudio para OGG/Opus.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

class AudioConverterService {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || '/tmp';
    this.ffmpegAvailable = this.checkFfmpeg();
  }

  /**
   * Verifica se o FFmpeg está disponível no sistema
   */
  checkFfmpeg() {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      logger.info('AudioConverterService: FFmpeg disponível');
      return true;
    } catch (error) {
      logger.warn('AudioConverterService: FFmpeg não disponível - conversão de áudio desabilitada');
      return false;
    }
  }

  /**
   * Verifica se o serviço está habilitado
   */
  isEnabled() {
    return this.ffmpegAvailable;
  }

  /**
   * Converte áudio para formato OGG/Opus
   * @param {string} audioData - Áudio em base64 (pode incluir data URL prefix)
   * @param {string} inputMimeType - MIME type do áudio de entrada
   * @returns {Promise<Object>} { base64, mimeType, converted }
   */
  async convertToOpus(audioData, inputMimeType = 'audio/webm') {
    // Se FFmpeg não está disponível, retorna o áudio original
    if (!this.ffmpegAvailable) {
      logger.debug('AudioConverterService: FFmpeg não disponível, retornando áudio original');
      return {
        base64: audioData,
        mimeType: inputMimeType,
        converted: false
      };
    }

    // Se já é OGG/Opus, não precisa converter
    // Normalize the data URL to remove codecs=opus if present (WUZAPI doesn't expect it)
    if (inputMimeType === 'audio/ogg' || inputMimeType === 'audio/ogg; codecs=opus') {
      logger.debug('AudioConverterService: Áudio já está em formato OGG/Opus');
      let normalizedAudio = audioData;
      // Remove codecs=opus from data URL if present
      if (audioData.startsWith('data:')) {
        normalizedAudio = audioData.replace(/data:audio\/ogg;\s*codecs=opus;base64,/i, 'data:audio/ogg;base64,');
      }
      return {
        base64: normalizedAudio,
        mimeType: 'audio/ogg',
        converted: false
      };
    }

    const uniqueId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(this.tempDir, `audio_input_${uniqueId}.bin`);
    const outputPath = path.join(this.tempDir, `audio_output_${uniqueId}.ogg`);

    try {
      // Extrair base64 puro (remover data URL prefix se existir)
      let base64Data = audioData;
      if (audioData.startsWith('data:')) {
        const match = audioData.match(/^data:[^;]+;base64,(.+)$/);
        if (match) {
          base64Data = match[1];
        }
      }

      // Converter base64 para buffer e salvar arquivo temporário
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(inputPath, buffer);

      logger.debug('AudioConverterService: Iniciando conversão', {
        inputMimeType,
        inputSize: buffer.length,
        inputPath,
        outputPath
      });

      // Converter para OGG/Opus usando FFmpeg
      // -y: sobrescrever arquivo de saída
      // -i: arquivo de entrada
      // -c:a libopus: usar codec Opus
      // -b:a 64k: bitrate de 64kbps (bom para voz)
      // -vn: sem vídeo
      // -ar 48000: sample rate de 48kHz (padrão Opus)
      // -ac 1: mono (melhor para mensagens de voz)
      const ffmpegCommand = `ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 64k -vn -ar 48000 -ac 1 "${outputPath}"`;
      
      execSync(ffmpegCommand, { 
        stdio: 'pipe',
        timeout: 30000 // 30 segundos de timeout
      });

      // Ler arquivo convertido
      const convertedBuffer = fs.readFileSync(outputPath);
      const convertedBase64 = convertedBuffer.toString('base64');

      logger.info('AudioConverterService: Conversão concluída', {
        inputSize: buffer.length,
        outputSize: convertedBuffer.length,
        inputMimeType,
        outputMimeType: 'audio/ogg; codecs=opus'
      });

      // WUZAPI expects: data:audio/ogg;base64,<base64data>
      // DO NOT include "codecs=opus" in the data URL - WUZAPI doesn't expect it
      return {
        base64: `data:audio/ogg;base64,${convertedBase64}`,
        mimeType: 'audio/ogg',
        converted: true
      };

    } catch (error) {
      logger.error('AudioConverterService: Falha na conversão', {
        error: error.message,
        inputMimeType
      });

      // Em caso de erro, retorna o áudio original
      return {
        base64: audioData,
        mimeType: inputMimeType,
        converted: false,
        error: error.message
      };

    } finally {
      // Limpar arquivos temporários
      this.cleanupFile(inputPath);
      this.cleanupFile(outputPath);
    }
  }

  /**
   * Remove arquivo temporário de forma segura
   */
  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.warn('AudioConverterService: Falha ao limpar arquivo temporário', {
        filePath,
        error: error.message
      });
    }
  }

  /**
   * Detecta o MIME type do áudio a partir do data URL
   */
  detectMimeType(audioData) {
    if (audioData.startsWith('data:')) {
      const match = audioData.match(/^data:([^;]+);/);
      if (match) {
        return match[1];
      }
    }
    return 'audio/webm'; // Default para gravações do navegador
  }
}

// Singleton
const audioConverterService = new AudioConverterService();

module.exports = { AudioConverterService, audioConverterService };
