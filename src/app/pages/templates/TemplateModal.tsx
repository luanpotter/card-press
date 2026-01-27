import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Select } from "@/app/components/Select";
import { usePdfStore } from "@/app/store/pdfs";
import type { Dimension } from "@/types/dimension";
import { PAGE_DIMENSIONS, PageSize } from "@/types/page";
import { type Slot, type Template, DEFAULT_CARD_SIZE } from "@/types/template";
import { useEffect, useRef, useState } from "react";

interface TemplateModalProps {
  template: Template | undefined;
  onSave: (template: Omit<Template, "id">) => void;
  onClose: () => void;
}

const PAGE_SIZE_OPTIONS = [
  { value: PageSize.A4, label: "A4 (210×297mm)" },
  { value: PageSize.Letter, label: "Letter (216×279mm)" },
];

export function TemplateModal({ template, onSave, onClose }: TemplateModalProps) {
  const { pdfs, addPdf } = usePdfStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [pageSize, setPageSize] = useState<PageSize>(template?.pageSize ?? PageSize.A4);
  const [cardSize, setCardSize] = useState<Dimension>(template?.cardSize ?? DEFAULT_CARD_SIZE);
  const [slots, setSlots] = useState<Slot[]>(template?.slots ?? []);
  const [basePdfId, setBasePdfId] = useState<string | undefined>(template?.basePdfId);

  const [newSlotX, setNewSlotX] = useState("");
  const [newSlotY, setNewSlotY] = useState("");

  const [gridCols, setGridCols] = useState("3");
  const [gridRows, setGridRows] = useState("3");
  const [gridGap, setGridGap] = useState("5");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    if (name.trim() === "") return;
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{template ? "Edit Template" : "New Template"}</h2>
          <Button onClick={onClose}>×</Button>
        </div>

        <div className="modal-body">
          <fieldset>
            <legend>Basic Info</legend>
            <div className="form-row">
              <label>
                Name
                <Input value={name} onChange={setName} placeholder="Template name" />
              </label>
              <label>
                Page Size
                <Select value={pageSize} onChange={(v) => setPageSize(v as PageSize)} options={PAGE_SIZE_OPTIONS} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Card Size (mm)</legend>
            <div className="form-row">
              <label>
                Width
                <Input
                  value={cardSize.width.toString()}
                  onChange={(v) => setCardSize({ ...cardSize, width: parseFloat(v) || 0 })}
                  placeholder="63"
                />
              </label>
              <label>
                Height
                <Input
                  value={cardSize.height.toString()}
                  onChange={(v) => setCardSize({ ...cardSize, height: parseFloat(v) || 0 })}
                  placeholder="88"
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Slots ({slots.length})</legend>
            <div className="form-row">
              <label>
                Cols
                <Input value={gridCols} onChange={setGridCols} placeholder="3" />
              </label>
              <label>
                Rows
                <Input value={gridRows} onChange={setGridRows} placeholder="3" />
              </label>
              <label>
                Gap (mm)
                <Input value={gridGap} onChange={setGridGap} placeholder="5" />
              </label>
              <Button onClick={handleGenerateGrid}>Generate Grid</Button>
            </div>

            <div className="form-row">
              <label>
                X (mm)
                <Input value={newSlotX} onChange={setNewSlotX} placeholder="0" />
              </label>
              <label>
                Y (mm)
                <Input value={newSlotY} onChange={setNewSlotY} placeholder="0" />
              </label>
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
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Base PDF (optional)</legend>
            <div className="form-row">
              <label>
                Select PDF
                <Select
                  value={basePdfId ?? ""}
                  onChange={(v) => setBasePdfId(v || undefined)}
                  options={basePdfOptions}
                />
              </label>
              <label>
                Upload New
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileUpload} />
              </label>
            </div>
          </fieldset>
        </div>

        <div className="modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} variant="accent">
            {template ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
