import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { usePdfStore } from "@/app/store/pdfs";
import { useTemplateStore } from "@/app/store/templates";
import { useState } from "react";

export function Config() {
  const { pdfs, prunePdfs } = usePdfStore();
  const { templates } = useTemplateStore();
  const [pruneResult, setPruneResult] = useState<string | null>(null);

  const handlePrunePdfs = () => {
    const usedIds = new Set(templates.map((t) => t.basePdfId).filter((id): id is string => id !== undefined));
    const removed = prunePdfs(usedIds);
    setPruneResult(removed > 0 ? `Removed ${String(removed)} unused PDF(s)` : "No unused PDFs to remove");
  };

  const usedCount = new Set(templates.map((t) => t.basePdfId).filter((id) => id !== undefined)).size;
  const unusedCount = pdfs.length - usedCount;

  return (
    <main>
      <h1>Config</h1>
      <Box label="Storage">
        <p>
          PDFs stored: {pdfs.length} ({usedCount} used, {unusedCount} unused)
        </p>
        <div className="form-row">
          <Button onClick={handlePrunePdfs} variant="danger" disabled={unusedCount === 0}>
            Prune Unused PDFs
          </Button>
          {pruneResult && <span>{pruneResult}</span>}
        </div>
      </Box>
    </main>
  );
}
