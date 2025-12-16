/**
 * Types para o serviço de mídia/S3
 */

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

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export type MediaFileType = 'image' | 'video' | 'audio' | 'document' | 'other'

export function getMediaFileType(contentType: string): MediaFileType {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('audio/')) return 'audio'
  if (contentType === 'application/pdf' || contentType.includes('word')) return 'document'
  return 'other'
}
