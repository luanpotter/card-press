import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { usePdfStore } from "@/app/store/pdfs";
import { useTemplateStore } from "@/app/store/templates";
import { useState } from "react";

export function Config() {
  const { pdfs, prunePdfs } = usePdfStore();
  const { templates, deleteAllTemplates } = useTemplateStore();
  const [pruneResult, setPruneResult] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const handlePrunePdfs = () => {
    const usedIds = new Set(templates.map((t) => t.basePdfId).filter((id): id is string => id !== undefined));
    const removed = prunePdfs(usedIds);
    setPruneResult(removed > 0 ? `Removed ${String(removed)} unused PDF(s)` : "No unused PDFs to remove");
  };

  const handleDeleteAllTemplates = () => {
    deleteAllTemplates();
    setShowDeleteAllModal(false);
  };

  const usedCount = new Set(templates.map((t) => t.basePdfId).filter((id) => id !== undefined)).size;
  const unusedCount = pdfs.length - usedCount;

  return (
    <main>
      <h1>Config</h1>
      <Box label="Templates">
        <Element>
          <span>
            PDFs stored: {pdfs.length} ({usedCount} used, {unusedCount} unused)
          </span>
          <Button onClick={handlePrunePdfs} variant="danger" disabled={unusedCount === 0}>
            Prune Unused PDFs
          </Button>
          {pruneResult && <span>{pruneResult}</span>}
        </Element>
        <Element>
          <span>Templates: {templates.length}</span>
          <Button onClick={() => setShowDeleteAllModal(true)} variant="danger" disabled={templates.length === 0}>
            Delete All Templates
          </Button>
        </Element>
      </Box>

      {showDeleteAllModal && (
        <ConfirmModal
          title="Delete All Templates"
          message={`Are you sure you want to delete all ${String(templates.length)} template(s)? This cannot be undone.`}
          confirmLabel="Delete All"
          onConfirm={handleDeleteAllTemplates}
          onClose={() => setShowDeleteAllModal(false)}
        />
      )}
    </main>
  );
}

const Element = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
    {children}
  </div>
);
