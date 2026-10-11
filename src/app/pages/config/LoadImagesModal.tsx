import { useCallback, useState } from "react";
import { Button } from "@/app/components/Button";
import { Dropzone } from "@/app/components/Dropzone";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";
import { readDataUrl } from "@/utils/imageFiles";

interface LoadImagesModalProps {
  onClose: () => void;
}

interface LoadedImage {
  name: string;
  id: string;
}

export function LoadImagesModal({ onClose }: LoadImagesModalProps) {
  const { addImage } = useImageStore();
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setLoading(true);
      const loaded: LoadedImage[] = [];

      for (const file of files) {
        const imageId = addImage(file.name, await readDataUrl(file));
        loaded.push({ name: file.name, id: imageId });
      }

      setLoadedImages((prev) => [...prev, ...loaded]);
      setLoading(false);
    },
    [addImage]
  );

  return (
    <Modal title="Load Images to Storage" onClose={onClose}>
      <div className="load-images-content">
        <Dropzone
          prompt={loading ? "Loading..." : "Drop images here"}
          onFiles={(files) => void handleFiles(files)}
          multiple
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
