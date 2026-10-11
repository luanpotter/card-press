import { useRef, useState } from "react";
import { Button } from "@/app/components/Button";
import { IMAGE_ACCEPT, validateImageFiles } from "@/utils/imageFiles";

interface DropzoneProps {
  /** Called with the image files dropped or chosen; other files are left out, and named in the zone */
  onFiles: (files: File[]) => void;
  /** Text shown above the file chooser */
  prompt: string;
  multiple?: boolean;
}

/**
 * Area to drop image files onto, or to choose them with the file picker.
 * It fills the height of its container.
 */
export function Dropzone({ onFiles, prompt, multiple = false }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejection, setRejection] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const takeFiles = (files: FileList | null) => {
    const { images, rejection } = validateImageFiles(files ?? []);
    setRejection(rejection);
    if (images.length > 0) {
      onFiles(images);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    // Also tells page-wide drop handlers that these files are taken
    e.preventDefault();
    setIsDragging(false);
    takeFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    takeFiles(e.target.files);
    // Reset input so the same files can be selected again
    e.target.value = "";
  };

  return (
    <div
      className={`image-picker-dropzone ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p>{prompt}</p>
      {rejection && <p className="danger">{rejection}</p>}
      <p className="muted">or</p>
      <Button onClick={() => fileInputRef.current?.click()}>{multiple ? "Choose Files" : "Choose File"}</Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple={multiple}
        onChange={handleFileInput}
        hidden
      />
    </div>
  );
}
