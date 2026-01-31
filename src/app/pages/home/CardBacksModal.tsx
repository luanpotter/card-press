import { useState } from "react";
import { Button } from "@/app/components/Button";
import { ImagePickerModal } from "@/app/components/ImagePickerModal";
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
  const { getImage } = useImageStore();
  const [showPicker, setShowPicker] = useState(false);

  const enabled = session.cardBacksEnabled ?? false;
  const defaultBackImage =
    session.defaultCardBackId && session.defaultCardBackId !== "" ? getImage(session.defaultCardBackId) : null;

  const handleToggle = (checked: boolean) => {
    updateSession(session.id, { cardBacksEnabled: checked });
  };

  const handleSelectBack = (imageId: string) => {
    updateSession(session.id, { defaultCardBackId: imageId });
    setShowPicker(false);
  };

  const handleClearBack = () => {
    updateSession(session.id, { defaultCardBackId: "" });
  };

  const footer = (
    <Button onClick={onClose} variant="accent">
      Done
    </Button>
  );

  if (showPicker) {
    return <ImagePickerModal onSelect={handleSelectBack} onClose={() => setShowPicker(false)} />;
  }

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
                  <Button onClick={() => setShowPicker(true)}>Change</Button>
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
                <Button onClick={() => setShowPicker(true)}>Set Default Back</Button>
              </div>
            )}
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
