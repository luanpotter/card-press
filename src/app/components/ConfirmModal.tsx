import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = "Confirm", onConfirm, onClose }: ConfirmModalProps) {
  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm} variant="danger">
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Modal title={title} onClose={onClose} footer={footer}>
      <p>{message}</p>
    </Modal>
  );
}
