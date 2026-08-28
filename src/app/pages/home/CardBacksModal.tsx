import { useState } from "react";
import { Button } from "@/app/components/Button";
import { ImagePickerModal } from "@/app/components/ImagePickerModal";
import { Modal } from "@/app/components/Modal";
import { Select } from "@/app/components/Select";
import { Toggle } from "@/app/components/Toggle";
import { useImageStore } from "@/app/store/images";
import { useSessionStore } from "@/app/store/sessions";
import { MirrorAxis } from "@/types/page";
import { getCardBacks, type CardBacks, type Session } from "@/types/session";

interface CardBacksModalProps {
  session: Session;
  onClose: () => void;
}

export function CardBacksModal({ session, onClose }: CardBacksModalProps) {
  const { updateSession } = useSessionStore();
  const { getImage } = useImageStore();
  const [showPicker, setShowPicker] = useState(false);

  const cardBacks = getCardBacks(session);
  const { enabled, defaultBackId, mirror } = cardBacks;
  const defaultBackImage = defaultBackId ? getImage(defaultBackId) : null;

  const update = (updates: Partial<CardBacks>) => {
    updateSession(session.id, { cardBacks: { ...cardBacks, ...updates } });
  };

  const handleSelectBack = (imageId: string) => {
    update({ defaultBackId: imageId });
    setShowPicker(false);
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
        <Toggle
          checked={enabled}
          onChange={(checked) => update({ enabled: checked })}
          label="Enable card backs for this session"
        />

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
                  <Button onClick={() => update({ defaultBackId: undefined })} variant="danger">
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

            <Select
              label="Mirror"
              value={mirror}
              onChange={(value) => update({ mirror: value as MirrorAxis })}
              options={[
                { value: MirrorAxis.Horizontal, label: "Horizontal" },
                { value: MirrorAxis.Vertical, label: "Vertical" },
              ]}
            />
            <p className="muted" style={{ margin: 0 }}>
              Choice of how to flip the sheet over to print the backs. All elements will be mirrored to match either a
              horizontal (book) or vertical (calendar) page flip.
            </p>
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
