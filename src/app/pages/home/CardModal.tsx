import { Button } from "@/app/components/Button";
import { ImagePickerModal } from "@/app/components/ImagePickerModal";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";
import type { Card } from "@/types/session";
import { useState } from "react";

interface CardModalProps {
  card: Card;
  cardBacksEnabled?: boolean | undefined;
  defaultCardBackId?: string | undefined;
  onSave: (card: Partial<Omit<Card, "id">>) => void;
  onClose: () => void;
}

type PickerMode = "image" | "back" | null;

export function CardModal({ card, cardBacksEnabled, defaultCardBackId, onSave, onClose }: CardModalProps) {
  const { getImage } = useImageStore();

  const [name, setName] = useState(card.name);
  const [count, setCount] = useState(String(card.count));
  const [imageId, setImageId] = useState(card.imageId);
  const [cardBackId, setCardBackId] = useState<string | undefined>("cardBackId" in card ? card.cardBackId : undefined);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  const [errors, setErrors] = useState<{
    name?: string;
    count?: string;
  }>({});

  const image = getImage(imageId);
  const cardBackImage = cardBackId ? getImage(cardBackId) : null;
  const effectiveBackImage = cardBackImage ?? (defaultCardBackId ? getImage(defaultCardBackId) : null);

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
    const updates: Partial<Omit<Card, "id">> = { name: name.trim(), count: Number(count), imageId };
    if (cardBackId !== undefined) {
      updates.cardBackId = cardBackId;
    }
    onSave(updates);
  };

  const handleImageSelect = (id: string) => {
    setImageId(id);
    setPickerMode(null);
  };

  const handleBackSelect = (id: string) => {
    setCardBackId(id);
    setPickerMode(null);
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} variant="accent">
        Save
      </Button>
    </>
  );

  if (pickerMode === "image") {
    return <ImagePickerModal onSelect={handleImageSelect} onClose={() => setPickerMode(null)} />;
  }

  if (pickerMode === "back") {
    return <ImagePickerModal onSelect={handleBackSelect} onClose={() => setPickerMode(null)} />;
  }

  return (
    <Modal title="Edit Card" onClose={onClose} footer={footer}>
      <Input label="Name" value={name} onChange={setName} error={errors.name} />

      <Input label="Count" type="number" value={count} onChange={setCount} error={errors.count} />

      <div style={{ marginTop: "12px", display: "flex", gap: "16px" }}>
        {/* Image (front) column */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <Button onClick={() => setPickerMode("image")}>Change Image</Button>
          </div>
          {image && (
            <img
              src={image.data}
              alt={image.name}
              style={{ width: "100%", height: "auto", border: "1px solid var(--border)" }}
            />
          )}
        </div>

        {/* Card back column */}
        {cardBacksEnabled && (
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <Button onClick={() => setPickerMode("back")}>Custom Back</Button>
              {cardBackId && (
                <Button onClick={() => setCardBackId(undefined)} variant="danger">
                  Use Default
                </Button>
              )}
            </div>
            {effectiveBackImage ? (
              <img
                src={effectiveBackImage.data}
                alt="Card back"
                style={{
                  width: "100%",
                  height: "auto",
                  border: "1px solid var(--border)",
                  opacity: cardBackId ? 1 : 0.7,
                }}
              />
            ) : (
              <div style={{ color: "var(--muted)", padding: "12px 0" }}>No back set</div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
