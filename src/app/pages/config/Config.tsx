import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { useImageStore } from "@/app/store/images";
import { loadDefaultTemplates } from "@/app/store/loadDefaults";
import { usePdfStore } from "@/app/store/pdfs";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import { DEFAULT_TEMPLATES } from "@/types/template";
import { useState } from "react";
import { LoadImagesModal } from "@/app/pages/config/LoadImagesModal";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  const unit = units[i] ?? "B";
  return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
}

export function Config() {
  const { images, pruneImages, _hydrated: imagesHydrated } = useImageStore();
  const { pdfs, prunePdfs, _hydrated: pdfsHydrated } = usePdfStore();
  const { sessions, deleteAllSessions } = useSessionStore();
  const { templates, deleteAllTemplates } = useTemplateStore();
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteSessionsModal, setShowDeleteSessionsModal] = useState(false);
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
  const [showLoadImagesModal, setShowLoadImagesModal] = useState(false);

  const handlePruneImages = () => {
    const usedIds = new Set(sessions.flatMap((s) => s.cards.map((c) => c.imageId)));
    pruneImages(usedIds);
  };

  const handlePrunePdfs = () => {
    const usedIds = new Set(templates.map((t) => t.basePdfId).filter((id): id is string => id !== undefined));
    prunePdfs(usedIds);
  };

  const handleDeleteAllTemplates = () => {
    deleteAllSessions();
    deleteAllTemplates();
    setShowDeleteAllModal(false);
  };

  const handleDeleteAllSessions = () => {
    deleteAllSessions();
    setShowDeleteSessionsModal(false);
  };

  const existingNames = new Set(templates.map((t) => t.name));
  const missingDefaults = DEFAULT_TEMPLATES.filter((dt) => !existingNames.has(dt.name));

  const handleLoadDefaults = () => {
    loadDefaultTemplates();
  };

  const usedPdfCount = new Set(templates.map((t) => t.basePdfId).filter((id) => id !== undefined)).size;
  const unusedPdfCount = pdfs.length - usedPdfCount;
  const pdfSize = pdfs.reduce((acc, p) => acc + p.data.length, 0);

  const usedImageCount = new Set(sessions.flatMap((s) => s.cards.map((c) => c.imageId))).size;
  const unusedImageCount = images.length - usedImageCount;
  const imageSize = images.reduce((acc, img) => acc + img.data.length, 0);

  const pdfStats = pdfsHydrated
    ? `PDFs stored: ${String(pdfs.length)} (${String(usedPdfCount)} used, ${String(unusedPdfCount)} unused, ${formatBytes(pdfSize)})`
    : "[loading]";

  const imageStats = imagesHydrated
    ? `Images stored: ${String(images.length)} (${String(usedImageCount)} used, ${String(unusedImageCount)} unused, ${formatBytes(imageSize)})`
    : "[loading]";

  return (
    <main>
      <ElementBox label="Templates">
        <Element>
          <span>{pdfStats}</span>
          <Button onClick={handlePrunePdfs} variant="danger" disabled={!pdfsHydrated || unusedPdfCount === 0}>
            Prune Unused PDFs
          </Button>
        </Element>
        <Element>
          <span>Templates: {templates.length}</span>
          <Buttons>
            <Button onClick={() => setShowDeleteAllModal(true)} variant="danger" disabled={templates.length === 0}>
              Delete All Templates
            </Button>
            <Button onClick={handleLoadDefaults} disabled={missingDefaults.length === 0}>
              Load Default Templates
            </Button>
          </Buttons>
        </Element>
      </ElementBox>

      <ElementBox label="Sessions">
        <Element>
          <span>{imageStats}</span>
          <Buttons>
            <Button onClick={() => setShowLoadImagesModal(true)}>Load Images</Button>
            <Button onClick={handlePruneImages} variant="danger" disabled={!imagesHydrated || unusedImageCount === 0}>
              Prune Unused Images
            </Button>
          </Buttons>
        </Element>
        <Element>
          <span>Sessions: {sessions.length}</span>
          <Button onClick={() => setShowDeleteSessionsModal(true)} variant="danger" disabled={sessions.length === 0}>
            Delete All Sessions
          </Button>
        </Element>
      </ElementBox>

      <ElementBox label="Danger Zone" error="Exercise caution">
        <div className="right">
          <Button onClick={() => setShowFactoryResetModal(true)} variant="danger">
            Factory Reset
          </Button>
        </div>
      </ElementBox>

      {showDeleteAllModal && (
        <ConfirmModal
          title="Delete All Templates"
          message={`Are you sure you want to delete all ${String(templates.length)} template(s) and ${String(sessions.length)} session(s)? This cannot be undone.`}
          confirmLabel="Delete All"
          onConfirm={handleDeleteAllTemplates}
          onClose={() => setShowDeleteAllModal(false)}
        />
      )}

      {showDeleteSessionsModal && (
        <ConfirmModal
          title="Delete All Sessions"
          message={`Are you sure you want to delete all ${String(sessions.length)} session(s)? This cannot be undone.`}
          confirmLabel="Delete All"
          onConfirm={handleDeleteAllSessions}
          onClose={() => setShowDeleteSessionsModal(false)}
        />
      )}

      {showFactoryResetModal && (
        <ConfirmModal
          title="Factory Reset"
          message="Are you sure you want to perform a factory reset? This will delete all templates, sessions, images, and PDFs. This action cannot be undone."
          confirmLabel="Factory Reset"
          onConfirm={() => {
            deleteAllSessions();
            deleteAllTemplates();
            pruneImages(new Set());
            prunePdfs(new Set());
            setShowFactoryResetModal(false);
          }}
          onClose={() => setShowFactoryResetModal(false)}
        />
      )}

      {showLoadImagesModal && <LoadImagesModal onClose={() => setShowLoadImagesModal(false)} />}
    </main>
  );
}

const ElementBox = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <Box label={label} error={error}>
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>{children}</div>
  </Box>
);

const Element = ({ children }: { children: React.ReactNode }) => <div className="columns">{children}</div>;

const Buttons = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: "8px" }}>{children}</div>
);
