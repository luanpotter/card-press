import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";

interface ErrorModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * Tell the user something went wrong; there is nothing to choose, only to dismiss it
 */
export function ErrorModal({ title, message, onClose }: ErrorModalProps) {
  return (
    <Modal title={title} onClose={onClose} footer={<Button onClick={onClose}>OK</Button>}>
      <p>{message}</p>
    </Modal>
  );
}
