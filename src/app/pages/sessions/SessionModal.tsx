import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { Select } from "@/app/components/Select";
import { useTemplateStore } from "@/app/store/templates";
import { RGB_HEX_PLACEHOLDER, rgbFromHex, rgbToHex } from "@/types/color";
import { DEFAULT_EMPTY_SLOT_COLOR, type Session } from "@/types/session";
import { useState } from "react";

interface SessionModalProps {
  session: Session | undefined;
  existingNames: Set<string>;
  onSave: (session: Omit<Session, "id" | "cards">) => void;
  onClose: () => void;
}

export function SessionModal({ session, existingNames, onSave, onClose }: SessionModalProps) {
  const { templates } = useTemplateStore();

  const [name, setName] = useState(session?.name ?? "");
  const [templateId, setTemplateId] = useState(session?.templateId ?? templates[0]?.id ?? "");
  const [emptySlotColor, setEmptySlotColor] = useState(() => {
    const color = session ? session.emptySlotColor : DEFAULT_EMPTY_SLOT_COLOR;
    return color ? rgbToHex(color) : "";
  });

  const [errors, setErrors] = useState<{
    name?: string;
    templateId?: string;
    emptySlotColor?: string;
  }>({});

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  const colorText = emptySlotColor.trim();
  const parsedColor = colorText === "" ? undefined : rgbFromHex(colorText);

  const validate = () => {
    const trimmedName = name.trim();
    const nameEmpty = trimmedName === "";
    const nameDuplicate = existingNames.has(trimmedName) && trimmedName !== session?.name;
    const templateMissing = !templateId || !templates.some((t) => t.id === templateId);
    const colorInvalid = colorText !== "" && !parsedColor;

    const newErrors: typeof errors = {};
    if (nameEmpty) newErrors.name = "Name is required";
    if (nameDuplicate) newErrors.name = "A session with this name already exists";
    if (templateMissing) newErrors.templateId = "Template is required";
    if (colorInvalid) newErrors.emptySlotColor = `Must be ${RGB_HEX_PLACEHOLDER}`;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ name: name.trim(), templateId, emptySlotColor: parsedColor });
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} variant="accent" disabled={templates.length === 0}>
        Save
      </Button>
    </>
  );

  return (
    <Modal title={session ? "Edit Session" : "New Session"} onClose={onClose} footer={footer}>
      <Input label="Name" value={name} onChange={setName} error={errors.name} />

      <Select
        label="Template"
        value={templateId}
        onChange={setTemplateId}
        options={templateOptions}
        error={errors.templateId}
      />

      <Input
        label="Empty Slot Color"
        value={emptySlotColor}
        onChange={setEmptySlotColor}
        placeholder={RGB_HEX_PLACEHOLDER}
        error={errors.emptySlotColor}
      />
      <p className="muted" style={{ marginTop: "4px" }}>
        A solid rectangle of this color is rendered to empty slots (leave empty to disable).
      </p>

      {templates.length === 0 && (
        <p className="danger" style={{ marginTop: "8px" }}>
          No templates available. Please create a template first.
        </p>
      )}
    </Modal>
  );
}
