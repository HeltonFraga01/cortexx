import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Interface para configuração do diálogo
interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

// Interface para o estado do diálogo
interface ConfirmDialogState {
  isOpen: boolean;
  config: ConfirmDialogConfig | null;
  resolve: ((value: boolean) => void) | null;
}

// Hook para gerenciar diálogos de confirmação
export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    config: null,
    resolve: null,
  });

  // Função para mostrar o diálogo de confirmação
  const confirm = useCallback((config: ConfirmDialogConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        config: {
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
          variant: 'default',
          ...config,
        },
        resolve,
      });
    });
  }, []);

  // Função para fechar o diálogo
  const closeDialog = useCallback((confirmed: boolean) => {
    if (dialogState.resolve) {
      dialogState.resolve(confirmed);
    }
    setDialogState({
      isOpen: false,
      config: null,
      resolve: null,
    });
  }, [dialogState.resolve]);

  // Componente do diálogo
  const ConfirmDialog = useCallback(() => {
    if (!dialogState.config) return null;

    return (
      <AlertDialog open={dialogState.isOpen} onOpenChange={() => closeDialog(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogState.config.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.config.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeDialog(false)}>
              {dialogState.config.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closeDialog(true)}
              className={
                dialogState.config.variant === 'destructive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {dialogState.config.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [dialogState, closeDialog]);

  return {
    confirm,
    ConfirmDialog,
  };
};

export default useConfirmDialog;