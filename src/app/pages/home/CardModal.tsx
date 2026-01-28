import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";
import type { Card } from "@/types/session";
import { useRef, useState } from "react";

interface CardModalProps {
  card: Card;
  onSave: (card: Partial<Omit<Card, "id">>) => void;
  onClose: () => void;
}

export function CardModal({ card, onSave, onClose }: CardModalProps) {
  const { getImage, addImage } = useImageStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(card.name);
  const [count, setCount] = useState(String(card.count));
  const [imageId, setImageId] = useState(card.imageId);

  const [errors, setErrors] = useState<{
    name?: string;
    count?: string;
  }>({});

  const image = getImage(imageId);

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
    onSave({ name: name.trim(), count: Number(count), imageId });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      const newImageId = addImage(file.name, data);
      setImageId(newImageId);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} variant="accent">
        Save
      </Button>
    </>
  );

  return (
    <Modal title="Edit Card" onClose={onClose} footer={footer}>
      <Input label="Name" value={name} onChange={setName} error={errors.name} />

      <Input label="Count" type="number" value={count} onChange={setCount} error={errors.count} />

      <div style={{ marginTop: "12px" }}>
        <label className="label">Image</label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
          {image && (
            <img
              src={image.data}
              alt={image.name}
              style={{ maxWidth: "400px", maxHeight: "400px", border: "1px solid var(--border)" }}
            />
          )}
          <Button onClick={() => fileInputRef.current?.click()}>Change Image</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            hidden
          />
        </div>
      </div>
    </Modal>
  );
}
