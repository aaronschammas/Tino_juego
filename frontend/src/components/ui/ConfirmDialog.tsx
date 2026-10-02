import Button from '@/components/ui/Button';
import Portal from '@/components/ui/Portal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-[32px] bg-white p-8 shadow-2xl animate-page-enter">
          <div className="space-y-3">
            <h3 className="text-[22px] font-extrabold tracking-tight text-gray-900 leading-tight">
              {title}
            </h3>
            <p className="text-[14px] font-medium text-gray-500 leading-relaxed">
              {description}
            </p>
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="font-bold"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              className="font-bold shadow-sm"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
      );
}
