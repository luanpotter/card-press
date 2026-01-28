import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { loadDefaultTemplates } from "@/app/store/loadDefaults";
import { usePdfStore } from "@/app/store/pdfs";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import { DEFAULT_TEMPLATES } from "@/types/template";
import { useState } from "react";

export function Config() {
  const { pdfs, prunePdfs } = usePdfStore();
  const { sessions, deleteAllSessions } = useSessionStore();
  const { templates, deleteAllTemplates } = useTemplateStore();
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const handlePrunePdfs = () => {
    const usedIds = new Set(templates.map((t) => t.basePdfId).filter((id): id is string => id !== undefined));
    prunePdfs(usedIds);
  };

  const handleDeleteAllTemplates = () => {
    deleteAllSessions();
    deleteAllTemplates();
    setShowDeleteAllModal(false);
  };

  const existingNames = new Set(templates.map((t) => t.name));
  const missingDefaults = DEFAULT_TEMPLATES.filter((dt) => !existingNames.has(dt.name));

  const handleLoadDefaults = () => {
    loadDefaultTemplates();
  };

  const usedCount = new Set(templates.map((t) => t.basePdfId).filter((id) => id !== undefined)).size;
  const unusedCount = pdfs.length - usedCount;

  return (
    <main>
      <Box label="Templates">
        <Element>
          <span>
            PDFs stored: {pdfs.length} ({usedCount} used, {unusedCount} unused)
          </span>
          <Button onClick={handlePrunePdfs} variant="danger" disabled={unusedCount === 0}>
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
      </Box>

      <Box label="Sessions">
        <Element>
          <span>Sessions: {sessions.length}</span>
          <Button onClick={deleteAllSessions} variant="danger" disabled={sessions.length === 0}>
            Delete All Sessions
          </Button>
        </Element>
      </Box>

      {showDeleteAllModal && (
        <ConfirmModal
          title="Delete All Templates"
          message={`Are you sure you want to delete all ${String(templates.length)} template(s) and ${String(sessions.length)} session(s)? This cannot be undone.`}
          confirmLabel="Delete All"
          onConfirm={handleDeleteAllTemplates}
          onClose={() => setShowDeleteAllModal(false)}
        />
      )}
    </main>
  );
}

const Element = ({ children }: { children: React.ReactNode }) => <div className="columns">{children}</div>;

const Buttons = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: "8px" }}>{children}</div>
);
