/**
 * Media Service - Cliente para API de mídia/S3
 */

import { apiClient } from './api-client'

export interface MediaStatus {
  enabled: boolean
  bucket: string | null
  maxFileSize: number
}

export interface UploadResult {
  key: string
  url: string
  contentType: string
  originalName: string
  size: number
}

export interface PresignedUploadResult {
  uploadUrl: string
  key: string
  expiresIn: number
  publicUrl: string
}

export interface MediaFile {
  key: string
  size: number
  lastModified: string
  url: string
}

export interface ListFilesResult {
  files: MediaFile[]
  nextToken?: string
  isTruncated: boolean
}

export interface FileMetadata {
  key: string
  contentType: string
  contentLength: number
  lastModified: string
  metadata: Record<string, string>
  url: string
}

/**
 * Verifica se o serviço S3 está habilitado
 */
export async function getMediaStatus(): Promise<MediaStatus> {
  const response = await apiClient.get<{ success: boolean; data: MediaStatus }>(
    '/api/media/status'
  )
  return response.data.data
}

/**
 * Faz upload de um arquivo diretamente
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<{ success: boolean; data: UploadResult }>(
    '/api/media/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  )
  return response.data.data
}

/**
 * Obtém URL pré-assinada para upload direto do cliente
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string
): Promise<PresignedUploadResult> {
  const response = await apiClient.post<{ success: boolean; data: PresignedUploadResult }>(
    '/api/media/presigned-upload',
    { filename, contentType }
  )
  return response.data.data
}

/**
 * Faz upload usando URL pré-assinada (upload direto para S3)
 */
export async function uploadWithPresignedUrl(file: File): Promise<UploadResult> {
  // 1. Obter URL pré-assinada
  const presigned = await getPresignedUploadUrl(file.name, file.type)

  // 2. Upload direto para S3
  await fetch(presigned.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  })

  // 3. Retornar resultado
  return {
    key: presigned.key,
    url: presigned.publicUrl,
    contentType: file.type,
    originalName: file.name,
    size: file.size
  }
}

/**
 * Obtém URL de download para um arquivo
 */
export async function getDownloadUrl(key: string): Promise<string> {
  const response = await apiClient.get<{ success: boolean; data: { downloadUrl: string } }>(
    `/api/media/download/${encodeURIComponent(key)}`
  )
  return response.data.data.downloadUrl
}

/**
 * Lista arquivos do usuário
 */
export async function listFiles(options?: {
  maxKeys?: number
  continuationToken?: string
}): Promise<ListFilesResult> {
  const params = new URLSearchParams()
  if (options?.maxKeys) params.append('maxKeys', options.maxKeys.toString())
  if (options?.continuationToken) params.append('continuationToken', options.continuationToken)

  const response = await apiClient.get<{ success: boolean; data: ListFilesResult }>(
    `/api/media/list?${params.toString()}`
  )
  return response.data.data
}

/**
 * Deleta um arquivo
 */
export async function deleteFile(key: string): Promise<void> {
  await apiClient.delete(`/api/media/${encodeURIComponent(key)}`)
}

/**
 * Obtém informações de um arquivo
 */
export async function getFileInfo(key: string): Promise<FileMetadata> {
  const response = await apiClient.get<{ success: boolean; data: FileMetadata }>(
    `/api/media/info/${encodeURIComponent(key)}`
  )
  return response.data.data
}

/**
 * Helper para formatar tamanho de arquivo
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Helper para verificar se um tipo de arquivo é permitido
 */
export function isAllowedFileType(file: File): boolean {
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
  ]
  return allowedTypes.includes(file.type)
}

/**
 * Helper para obter ícone baseado no tipo de arquivo
 */
export function getFileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return '🖼️'
  if (contentType.startsWith('video/')) return '🎬'
  if (contentType.startsWith('audio/')) return '🎵'
  if (contentType === 'application/pdf') return '📄'
  if (contentType.includes('word')) return '📝'
  return '📎'
}
