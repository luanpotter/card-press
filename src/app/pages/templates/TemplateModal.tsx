import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { Select } from "@/app/components/Select";
import { usePdfStore } from "@/app/store/pdfs";
import { CardSizePreset, CARD_SIZE_PRESETS, getCardSizePreset } from "@/types/card";
import type { Dimension } from "@/types/dimension";
import { PAGE_DIMENSIONS, PageSize } from "@/types/page";
import { type Slot, type Template, DEFAULT_CARD_SIZE } from "@/types/template";
import { useRef, useState } from "react";

interface TemplateModalProps {
  template: Template | undefined;
  onSave: (template: Omit<Template, "id">) => void;
  onClose: () => void;
}

const PAGE_SIZE_OPTIONS = Object.values(PageSize).map((size) => {
  const dim = PAGE_DIMENSIONS[size];
  return { value: size, label: `${size} (${String(dim.width)}x${String(dim.height)}mm)` };
});

const CARD_SIZE_OPTIONS = Object.values(CardSizePreset).map((preset) => {
  if (preset === CardSizePreset.Custom) {
    return { value: preset, label: "Custom" };
  }
  const dim = CARD_SIZE_PRESETS[preset];
  return { value: preset, label: `${preset} (${String(dim.width)}x${String(dim.height)}mm)` };
});

export function TemplateModal({ template, onSave, onClose }: TemplateModalProps) {
  const { pdfs, addPdf } = usePdfStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [pageSize, setPageSize] = useState<PageSize>(template?.pageSize ?? PageSize.A4);
  const [cardSize, setCardSize] = useState<Dimension>(template?.cardSize ?? DEFAULT_CARD_SIZE);
  const [cardSizePreset, setCardSizePreset] = useState<CardSizePreset>(
    getCardSizePreset(template?.cardSize ?? DEFAULT_CARD_SIZE)
  );
  const [slots, setSlots] = useState<Slot[]>(template?.slots ?? []);
  const [basePdfId, setBasePdfId] = useState<string | undefined>(template?.basePdfId);

  const [newSlotX, setNewSlotX] = useState("");
  const [newSlotY, setNewSlotY] = useState("");

  const [gridCols, setGridCols] = useState("3");
  const [gridRows, setGridRows] = useState("3");
  const [gridGap, setGridGap] = useState("5");

  const [errors, setErrors] = useState<{ name?: boolean; cardWidth?: boolean; cardHeight?: boolean }>({});

  const validate = () => {
    const newErrors = {
      name: name.trim() === "",
      cardWidth: cardSize.width <= 0,
      cardHeight: cardSize.height <= 0,
    };
    setErrors(newErrors);
    return !newErrors.name && !newErrors.cardWidth && !newErrors.cardHeight;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ name, pageSize, cardSize, slots, basePdfId });
  };

  const handleAddSlot = () => {
    const x = parseFloat(newSlotX);
    const y = parseFloat(newSlotY);
    if (isNaN(x) || isNaN(y)) return;
    setSlots([...slots, { x, y }]);
    setNewSlotX("");
    setNewSlotY("");
  };

  const handleDeleteSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleGenerateGrid = () => {
    const cols = parseInt(gridCols);
    const rows = parseInt(gridRows);
    const gap = parseFloat(gridGap);
    if (isNaN(cols) || isNaN(rows) || isNaN(gap) || cols < 1 || rows < 1) return;

    const page = PAGE_DIMENSIONS[pageSize];
    const totalWidth = cols * cardSize.width + (cols - 1) * gap;
    const totalHeight = rows * cardSize.height + (rows - 1) * gap;
    const startX = (page.width - totalWidth) / 2;
    const startY = (page.height - totalHeight) / 2;

    const newSlots: Slot[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        newSlots.push({
          x: startX + col * (cardSize.width + gap),
          y: startY + row * (cardSize.height + gap),
        });
      }
    }
    setSlots(newSlots);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      const id = addPdf(file.name, data);
      setBasePdfId(id);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const basePdfOptions = [{ value: "", label: "None" }, ...pdfs.map((p) => ({ value: p.id, label: p.name }))];

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} variant="accent">
        {template ? "Update" : "Create"}
      </Button>
    </>
  );

  return (
    <Modal title={template ? "Edit Template" : "New Template"} onClose={onClose} footer={footer}>
      <fieldset>
        <legend>Basic Info</legend>
        <div className="form-row">
          <Input
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Template name"
            error={errors.name ? "required" : undefined}
          />
          <Select
            label="Page Size"
            value={pageSize}
            onChange={(v) => setPageSize(v as PageSize)}
            options={PAGE_SIZE_OPTIONS}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Card Size (mm)</legend>
        <div className="form-row">
          <Select
            label="Preset"
            value={cardSizePreset}
            onChange={(v) => {
              const preset = v as CardSizePreset;
              setCardSizePreset(preset);
              if (preset !== CardSizePreset.Custom) {
                setCardSize(CARD_SIZE_PRESETS[preset]);
              }
            }}
            options={CARD_SIZE_OPTIONS}
          />
          <Input
            label="Width"
            value={cardSize.width.toString()}
            onChange={(v) => {
              const width = parseFloat(v) || 0;
              setCardSize({ ...cardSize, width });
              setCardSizePreset(CardSizePreset.Custom);
            }}
            placeholder="63"
            error={errors.cardWidth ? "invalid" : undefined}
          />
          <Input
            label="Height"
            value={cardSize.height.toString()}
            onChange={(v) => {
              const height = parseFloat(v) || 0;
              setCardSize({ ...cardSize, height });
              setCardSizePreset(CardSizePreset.Custom);
            }}
            placeholder="88"
            error={errors.cardHeight ? "invalid" : undefined}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Slots ({slots.length})</legend>
        <div className="form-row">
          <Input label="Cols" value={gridCols} onChange={setGridCols} placeholder="3" />
          <Input label="Rows" value={gridRows} onChange={setGridRows} placeholder="3" />
          <Input label="Gap (mm)" value={gridGap} onChange={setGridGap} placeholder="5" />
          <Button onClick={handleGenerateGrid}>Generate Grid</Button>
        </div>

        <div className="form-row">
          <Input label="X (mm)" value={newSlotX} onChange={setNewSlotX} placeholder="0" />
          <Input label="Y (mm)" value={newSlotY} onChange={setNewSlotY} placeholder="0" />
          <Button onClick={handleAddSlot}>Add Slot</Button>
          {slots.length > 0 && (
            <Button onClick={() => setSlots([])} variant="danger">
              Clear All
            </Button>
          )}
        </div>

        {slots.length > 0 && (
          <div className="slots-list">
            {slots.map((slot, i) => (
              <span key={i} className="slot-tag">
                ({slot.x.toFixed(1)}, {slot.y.toFixed(1)})
                <button type="button" onClick={() => handleDeleteSlot(i)}>
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Base PDF (optional)</legend>
        <div className="form-row">
          <Select
            label="Select PDF"
            value={basePdfId ?? ""}
            onChange={(v) => setBasePdfId(v || undefined)}
            options={basePdfOptions}
          />
          <label>
            <span>Upload New</span>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} />
          </label>
        </div>
      </fieldset>
    </Modal>
  );
}
