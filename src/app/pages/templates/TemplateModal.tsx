import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { Select } from "@/app/components/Select";
import { usePdfStore } from "@/app/store/pdfs";
import { CARD_SIZE_PRESETS, CardSizePreset, DEFAULT_CARD_SIZE, getCardSizePreset } from "@/types/card";
import type { Dimension } from "@/types/dimension";
import { PAGE_DIMENSIONS, PageSize } from "@/types/page";
import type { Slot, Template } from "@/types/template";
import { generateGrid } from "@/utils/grid";
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

  const [errors, setErrors] = useState<{
    name?: boolean;
    cardWidth?: boolean;
    cardHeight?: boolean;
    slotX?: boolean;
    slotY?: boolean;
    gridCols?: boolean;
    gridRows?: boolean;
    gridGap?: boolean;
    slots?: boolean;
  }>({});

  const isValidNumber = (value: string) => value.trim() !== "" && !isNaN(Number(value));
  const isValidPositiveInt = (value: string) =>
    isValidNumber(value) && Number.isInteger(Number(value)) && Number(value) >= 1;
  const isValidNonNegative = (value: string) => isValidNumber(value) && Number(value) >= 0;

  const validate = () => {
    const newErrors = {
      name: name.trim() === "",
      cardWidth: cardSize.width <= 0,
      cardHeight: cardSize.height <= 0,
      slots: slots.length === 0,
    };
    setErrors(newErrors);
    return !newErrors.name && !newErrors.cardWidth && !newErrors.cardHeight && !newErrors.slots;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ name, pageSize, cardSize, slots, basePdfId });
  };

  const handleAddSlot = () => {
    const xValid = isValidNonNegative(newSlotX);
    const yValid = isValidNonNegative(newSlotY);
    setErrors((prev) => ({ ...prev, slotX: !xValid, slotY: !yValid }));
    if (!xValid || !yValid) return;

    setSlots([...slots, { x: Number(newSlotX), y: Number(newSlotY) }]);
    setNewSlotX("");
    setNewSlotY("");
  };

  const handleDeleteSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleGenerateGrid = () => {
    const colsValid = isValidPositiveInt(gridCols);
    const rowsValid = isValidPositiveInt(gridRows);
    const gapValid = isValidNonNegative(gridGap);
    setErrors((prev) => ({ ...prev, gridCols: !colsValid, gridRows: !rowsValid, gridGap: !gapValid }));
    if (!colsValid || !rowsValid || !gapValid) return;

    const newSlots = generateGrid({
      cols: Number(gridCols),
      rows: Number(gridRows),
      gap: Number(gridGap),
      cardSize,
      pageSize: PAGE_DIMENSIONS[pageSize],
    });
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
      <Box label="Basic Info">
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
      </Box>

      <Box label="Card Size (mm)">
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
      </Box>

      <Box label={`Slots (${String(slots.length)})`} error={errors.slots ? "add at least one slot" : undefined}>
        <div className="form-row">
          <Input
            label="Cols"
            value={gridCols}
            onChange={setGridCols}
            placeholder="3"
            error={errors.gridCols ? "invalid" : undefined}
          />
          <Input
            label="Rows"
            value={gridRows}
            onChange={setGridRows}
            placeholder="3"
            error={errors.gridRows ? "invalid" : undefined}
          />
          <Input
            label="Gap (mm)"
            value={gridGap}
            onChange={setGridGap}
            placeholder="5"
            error={errors.gridGap ? "invalid" : undefined}
          />
          <Button onClick={handleGenerateGrid}>Generate Grid</Button>
        </div>

        <div className="form-row">
          <Input label="X (mm)" value={newSlotX} onChange={setNewSlotX} error={errors.slotX ? "invalid" : undefined} />
          <Input label="Y (mm)" value={newSlotY} onChange={setNewSlotY} error={errors.slotY ? "invalid" : undefined} />
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
      </Box>

      <Box label="Base PDF (optional)">
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
      </Box>
    </Modal>
  );
}
