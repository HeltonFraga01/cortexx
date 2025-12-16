/**
 * useMedia - Hook para gerenciamento de mídia/S3
 */

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import * as mediaService from '@/services/media'
import type { MediaFile, UploadResult, MediaStatus } from '@/types/media'

interface UseMediaOptions {
  onUploadSuccess?: (result: UploadResult) => void
  onUploadError?: (error: Error) => void
  onDeleteSuccess?: (key: string) => void
  onDeleteError?: (error: Error) => void
}

export function useMedia(options: UseMediaOptions = {}) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<MediaStatus | null>(null)

  /**
   * Verifica status do serviço S3
   */
  const checkStatus = useCallback(async () => {
    try {
      const result = await mediaService.getMediaStatus()
      setStatus(result)
      return result
    } catch (error) {
      console.error('Failed to check media status:', error)
      return null
    }
  }, [])

  /**
   * Upload de arquivo (via API)
   */
  const uploadFile = useCallback(async (file: File): Promise<UploadResult | null> => {
    if (!mediaService.isAllowedFileType(file)) {
      toast({
        title: 'Tipo de arquivo não permitido',
        description: `O tipo ${file.type} não é suportado`,
        variant: 'destructive'
      })
      return null
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const result = await mediaService.uploadFile(file)
      
      setUploadProgress(100)
      
      toast({
        title: 'Upload concluído',
        description: `${file.name} enviado com sucesso`
      })

      options.onUploadSuccess?.(result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed')
      
      toast({
        title: 'Erro no upload',
        description: err.message,
        variant: 'destructive'
      })

      options.onUploadError?.(err)
      return null
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [toast, options])

  /**
   * Upload direto para S3 (via presigned URL)
   */
  const uploadDirect = useCallback(async (file: File): Promise<UploadResult | null> => {
    if (!mediaService.isAllowedFileType(file)) {
      toast({
        title: 'Tipo de arquivo não permitido',
        description: `O tipo ${file.type} não é suportado`,
        variant: 'destructive'
      })
      return null
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const result = await mediaService.uploadWithPresignedUrl(file)
      
      setUploadProgress(100)
      
      toast({
        title: 'Upload concluído',
        description: `${file.name} enviado com sucesso`
      })

      options.onUploadSuccess?.(result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed')
      
      toast({
        title: 'Erro no upload',
        description: err.message,
        variant: 'destructive'
      })

      options.onUploadError?.(err)
      return null
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [toast, options])

  /**
   * Lista arquivos do usuário
   */
  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await mediaService.listFiles()
      setFiles(result.files)
      return result
    } catch (error) {
      console.error('Failed to load files:', error)
      toast({
        title: 'Erro ao carregar arquivos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  /**
   * Deleta um arquivo
   */
  const deleteFile = useCallback(async (key: string) => {
    try {
      await mediaService.deleteFile(key)
      
      setFiles(prev => prev.filter(f => f.key !== key))
      
      toast({
        title: 'Arquivo deletado',
        description: 'O arquivo foi removido com sucesso'
      })

      options.onDeleteSuccess?.(key)
      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Delete failed')
      
      toast({
        title: 'Erro ao deletar',
        description: err.message,
        variant: 'destructive'
      })

      options.onDeleteError?.(err)
      return false
    }
  }, [toast, options])

  /**
   * Obtém URL de download
   */
  const getDownloadUrl = useCallback(async (key: string) => {
    try {
      return await mediaService.getDownloadUrl(key)
    } catch (error) {
      toast({
        title: 'Erro ao gerar link',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
      return null
    }
  }, [toast])

  return {
    // Estado
    isUploading,
    uploadProgress,
    files,
    isLoading,
    status,
    
    // Ações
    checkStatus,
    uploadFile,
    uploadDirect,
    loadFiles,
    deleteFile,
    getDownloadUrl,
    
    // Helpers
    formatFileSize: mediaService.formatFileSize,
    isAllowedFileType: mediaService.isAllowedFileType,
    getFileIcon: mediaService.getFileIcon
  }
}
