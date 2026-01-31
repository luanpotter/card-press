import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";

interface ImagePickerModalProps {
  onSelect: (imageId: string) => void;
  onClose: () => void;
}

type Tab = "upload" | "storage";

export function ImagePickerModal({ onSelect, onClose }: ImagePickerModalProps) {
  const { images, addImage } = useImageStore();
  const [tab, setTab] = useState<Tab>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        const imageId = addImage(file.name, data);
        onSelect(imageId);
      };
      reader.readAsDataURL(file);
    },
    [addImage, onSelect]
  );

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };

    // Use capture phase to handle before other listeners
    document.addEventListener("paste", handlePaste, true);
    return () => document.removeEventListener("paste", handlePaste, true);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSelectFromStorage = (imageId: string) => {
    onSelect(imageId);
  };

  const tabs = (
    <menu className="inline">
      <a
        href="#"
        className={tab === "upload" ? "active" : ""}
        onClick={(e) => {
          e.preventDefault();
          setTab("upload");
        }}
      >
        <span>Upload</span>
      </a>
      <a
        href="#"
        className={tab === "storage" ? "active" : images.length === 0 ? "disabled" : ""}
        onClick={(e) => {
          e.preventDefault();
          if (images.length > 0) setTab("storage");
        }}
      >
        <span>From Storage ({images.length})</span>
      </a>
    </menu>
  );

  return (
    <Modal title={tabs} onClose={onClose}>
      <div className="image-picker-content">
        {/* Upload tab */}
        {tab === "upload" && (
          <div
            className={`image-picker-dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <p>Drop or paste image here</p>
            <p className="muted">or</p>
            <Button onClick={() => fileInputRef.current?.click()}>Choose File</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileInput}
              hidden
            />
          </div>
        )}

        {/* Storage tab */}
        {tab === "storage" && (
          <div className="image-picker-grid">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                className="image-picker-item"
                onClick={() => handleSelectFromStorage(img.id)}
                title={img.name}
              >
                <img src={img.data} alt={img.name} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
