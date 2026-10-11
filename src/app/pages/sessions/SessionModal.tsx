import { Button } from "@/app/components/Button";
import { Input } from "@/app/components/Input";
import { Modal } from "@/app/components/Modal";
import { Select } from "@/app/components/Select";
import { useTemplateStore } from "@/app/store/templates";
import { RGB_HEX_PLACEHOLDER, rgbFromHex, rgbToHex } from "@/types/color";
import {
  DEFAULT_EMPTY_SLOT_COLOR,
  DEFAULT_PRINT_DPI,
  DEFAULT_RASTER_SCALING,
  DEFAULT_SVG_OUTPUT,
  getPrintDpi,
  getRasterScaling,
  getSvgOutput,
  RasterScaling,
  SvgOutput,
  type Session,
} from "@/types/session";
import { MAX_PAGE_MEGAPIXELS, pageMegapixels } from "@/utils/printResolution";
import { useState } from "react";

// Below this, cards print visibly pixelated; above, no printer resolves the detail
const MIN_PRINT_DPI = 72;
const MAX_PRINT_DPI = 2400;

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
  const [printDpi, setPrintDpi] = useState(String(session ? getPrintDpi(session) : DEFAULT_PRINT_DPI));
  const [rasterScaling, setRasterScaling] = useState(session ? getRasterScaling(session) : DEFAULT_RASTER_SCALING);
  const [svgOutput, setSvgOutput] = useState(session ? getSvgOutput(session) : DEFAULT_SVG_OUTPUT);

  const [errors, setErrors] = useState<{
    name?: string;
    templateId?: string;
    emptySlotColor?: string;
    printDpi?: string;
  }>({});

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  const colorText = emptySlotColor.trim();
  const parsedColor = colorText === "" ? undefined : rgbFromHex(colorText);

  const parsedDpi = Number(printDpi.trim());
  const dpiValid = Number.isInteger(parsedDpi) && parsedDpi >= MIN_PRINT_DPI && parsedDpi <= MAX_PRINT_DPI;
  const template = templates.find((t) => t.id === templateId);
  const megapixels = template && dpiValid ? pageMegapixels(template, parsedDpi) : 0;

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
    if (!dpiValid)
      newErrors.printDpi = `Must be a whole number from ${String(MIN_PRINT_DPI)} to ${String(MAX_PRINT_DPI)}`;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      name: name.trim(),
      templateId,
      emptySlotColor: parsedColor,
      printDpi: parsedDpi,
      rasterScaling,
      svgOutput,
    });
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

      <Input
        label="Print Resolution (DPI)"
        type="number"
        value={printDpi}
        onChange={setPrintDpi}
        error={errors.printDpi}
      />
      <p className="muted" style={{ marginTop: "4px" }}>
        Render each image at this dpi (pixels per inch); {DEFAULT_PRINT_DPI} is a high-quality standard.
      </p>
      {megapixels > MAX_PAGE_MEGAPIXELS && (
        <p className="danger" style={{ marginTop: "4px" }}>
          A full page becomes {Math.ceil(megapixels)} MP at this resolution; printers will degrade or fail above{" "}
          {MAX_PAGE_MEGAPIXELS} MP.
        </p>
      )}

      <Select
        label="Raster Scaling"
        value={rasterScaling}
        onChange={(value) => setRasterScaling(value as RasterScaling)}
        options={[
          { value: RasterScaling.Lanczos, label: "Lanczos" },
          { value: RasterScaling.Nearest, label: "Nearest neighbor" },
          { value: RasterScaling.Original, label: "Original pixels" },
        ]}
      />
      <p className="muted" style={{ marginTop: "4px" }}>
        How raster images are sampled on the output PDF at the desired DPI; Lanczos is smooth, nearest neighbor keeps
        hard edges (pixel art).
      </p>

      <Select
        label="SVG Output"
        value={svgOutput}
        onChange={(value) => setSvgOutput(value as SvgOutput)}
        options={[
          { value: SvgOutput.RasterResvg, label: "Raster (resvg)" },
          { value: SvgOutput.RasterBrowser, label: "Raster (browser)" },
          { value: SvgOutput.Vector, label: "Vector" },
        ]}
      />
      <p className="muted" style={{ marginTop: "4px" }}>
        How to handle SVGs - either embeded to the PDF, or raster it (using resvg library or the browser built-in; this
        might affect how fonts are loaded and printer resolution).
      </p>

      {templates.length === 0 && (
        <p className="danger" style={{ marginTop: "8px" }}>
          No templates available. Please create a template first.
        </p>
      )}
    </Modal>
  );
}
