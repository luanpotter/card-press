import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { useState } from "react";

interface QuickAddCardModalProps {
  imageData: string;
  onSave: (name: string, count: number) => void;
  onClose: () => void;
}

/**
 * Modal for quickly adding a card from a pasted or dropped image.
 * Shows a preview and allows naming the card before adding.
 */
export function QuickAddCardModal({ imageData, onSave, onClose }: QuickAddCardModalProps) {
  const [name, setName] = useState("unnamed");
  const [count, setCount] = useState("1");

  const [errors, setErrors] = useState<{
    name?: string;
    count?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (name.trim() === "") newErrors.name = "Name is required";
    const countNum = Number(count);
    if (!Number.isInteger(countNum) || countNum < 1) newErrors.count = "Count must be at least 1";
    setErrors(newErrors);
    return !newErrors.name && !newErrors.count;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(name.trim(), Number(count));
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} variant="accent">
        Add Card
      </Button>
    </>
  );

  return (
    <Modal title="Add Card" onClose={onClose} footer={footer}>
      <div style={{ marginBottom: "12px" }}>
        <label className="label">Preview</label>
        <div style={{ marginTop: "4px" }}>
          <img
            src={imageData}
            alt="Card preview"
            style={{
              maxWidth: "400px",
              maxHeight: "400px",
              border: "1px solid var(--border)",
            }}
          />
        </div>
      </div>

      <Input label="Name" value={name} onChange={setName} error={errors.name} />

      <Input label="Count" type="number" value={count} onChange={setCount} error={errors.count} />
    </Modal>
  );
}
