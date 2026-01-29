import { useRef } from "react";
import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { Toggle } from "@/app/components/Toggle";
import { useImageStore } from "@/app/store/images";
import { useSessionStore } from "@/app/store/sessions";
import type { Session } from "@/types/session";

interface CardBacksModalProps {
  session: Session;
  onClose: () => void;
}

export function CardBacksModal({ session, onClose }: CardBacksModalProps) {
  const { updateSession } = useSessionStore();
  const { getImage, addImage } = useImageStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabled = session.cardBacksEnabled ?? false;
  const defaultBackImage =
    session.defaultCardBackId && session.defaultCardBackId !== "" ? getImage(session.defaultCardBackId) : null;

  const handleToggle = (checked: boolean) => {
    updateSession(session.id, { cardBacksEnabled: checked });
  };

  const handleSetBack = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      const imageId = addImage(file.name, data);
      updateSession(session.id, { defaultCardBackId: imageId });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearBack = () => {
    updateSession(session.id, { defaultCardBackId: "" });
  };

  const footer = (
    <Button onClick={onClose} variant="accent">
      Done
    </Button>
  );

  return (
    <Modal title="Card Backs" onClose={onClose} footer={footer}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Toggle checked={enabled} onChange={handleToggle} label="Enable card backs for this session" />

        {enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label className="label" style={{ margin: 0 }}>
              Default Back Image
            </label>

            {defaultBackImage ? (
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <img
                  src={defaultBackImage.data}
                  alt="Default back"
                  style={{
                    width: "200px",
                    height: "auto",
                    border: "1px solid var(--border)",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <Button onClick={() => fileInputRef.current?.click()}>Change</Button>
                  <Button onClick={handleClearBack} variant="danger">
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="muted" style={{ marginBottom: "8px" }}>
                  No default back image set. Cards without a custom back will be skipped when generating backs PDF.
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>Set Default Back</Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleSetBack}
              hidden
            />
          </div>
        )}

        {!enabled && (
          <p className="muted">
            Enable card backs to set a default back image and generate a separate PDF for card backs.
          </p>
        )}
      </div>
    </Modal>
  );
}
