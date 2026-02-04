import { useCallback, useRef, useState } from "react";
import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";

interface LoadImagesModalProps {
  onClose: () => void;
}

interface LoadedImage {
  name: string;
  id: string;
}

export function LoadImagesModal({ onClose }: LoadImagesModalProps) {
  const { addImage } = useImageStore();
  const [isDragging, setIsDragging] = useState(false);
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setLoading(true);
      const loaded: LoadedImage[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;

        const data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const imageId = addImage(file.name, data);
        loaded.push({ name: file.name, id: imageId });
      }

      setLoadedImages((prev) => [...prev, ...loaded]);
      setLoading(false);
    },
    [addImage]
  );

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
    void handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleFiles(files);
    }
    // Reset input so the same files can be selected again
    e.target.value = "";
  };

  return (
    <Modal title="Load Images to Storage" onClose={onClose}>
      <div
        className={`image-picker-dropzone ${isDragging ? "dragging" : ""}`}
        style={{ height: "200px" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p>Drop images here</p>
            <p className="muted">or</p>
            <Button onClick={() => fileInputRef.current?.click()}>Choose Files</Button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={handleFileInput}
          hidden
        />
      </div>

      {loadedImages.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <p>
            <strong>Loaded {loadedImages.length} image(s):</strong>
          </p>
          <ul
            style={{
              maxHeight: "150px",
              overflow: "auto",
              fontSize: "0.875rem",
              margin: "0.5rem 0",
              paddingLeft: "1.5rem",
            }}
          >
            {loadedImages.map((img) => (
              <li key={img.id}>{img.name}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onClose}>{loadedImages.length > 0 ? "Done" : "Cancel"}</Button>
      </div>
    </Modal>
  );
}
