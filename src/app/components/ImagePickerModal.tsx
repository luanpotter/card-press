import { useCallback, useState } from "react";
import { Dropzone } from "@/app/components/Dropzone";
import { Modal } from "@/app/components/Modal";
import { usePastedImage } from "@/app/components/usePastedImage";
import { useImageStore } from "@/app/store/images";
import { CARD_BACKS } from "@/generated/assets";
import { readDataUrl } from "@/utils/imageFiles";
import { loadDefaultCardBacks } from "@/utils/lazyModules";

interface ImagePickerModalProps {
  onSelect: (imageId: string) => void;
  onClose: () => void;
}

type Tab = "upload" | "storage" | "defaults";

export function ImagePickerModal({ onSelect, onClose }: ImagePickerModalProps) {
  const { images, addImage, getImage } = useImageStore();
  const [tab, setTab] = useState<Tab>("upload");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string>();

  const handleFile = useCallback(
    (file: File) => {
      void readDataUrl(file).then((data) => onSelect(addImage(file.name, data)));
    },
    [addImage, onSelect]
  );

  // Takes pastes over the page underneath, which would add them as cards
  usePastedImage(handleFile, { preempt: true });

  const handleSelectFromStorage = (imageId: string) => {
    onSelect(imageId);
  };

  const handleSelectDefault = async (defaultBack: (typeof CARD_BACKS)[number]) => {
    // Check if already in storage
    const existing = getImage(defaultBack.id);
    if (existing) {
      onSelect(existing.id);
      return;
    }

    // Add to storage and select, once downloaded; a failed download starts over on the next click
    setDownloading(true);
    setDownloadError(undefined);
    try {
      const data = (await loadDefaultCardBacks()).get(defaultBack.url);
      if (data) {
        onSelect(addImage(defaultBack.name, data, defaultBack.id));
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  };

  const tabs = (
    <menu>
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
      <a
        href="#"
        className={tab === "defaults" ? "active" : ""}
        onClick={(e) => {
          e.preventDefault();
          setTab("defaults");
        }}
      >
        <span>Defaults</span>
      </a>
    </menu>
  );

  return (
    <Modal title={tabs} onClose={onClose}>
      <div className="image-picker-content">
        {/* Upload tab */}
        {tab === "upload" && (
          <Dropzone prompt="Drop or paste image here" onFiles={([file]) => file && handleFile(file)} />
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

        {/* Defaults tab */}
        {tab === "defaults" && (
          <div className="image-picker-defaults">
            {downloading && <p className="muted">Downloading the card backs...</p>}
            {downloadError && (
              <p className="danger">Cannot download the card backs ({downloadError}). Click one to try again.</p>
            )}
            <div className="image-picker-grid">
              {CARD_BACKS.map((back) => (
                <button
                  key={back.id}
                  type="button"
                  className="image-picker-item"
                  onClick={() => void handleSelectDefault(back)}
                  title={back.name}
                  disabled={downloading}
                >
                  <img src={back.url} alt={back.name} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
