import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";
import { getAllSources, getSource, type FetchResult } from "@/sources/index";
import { useState, useRef } from "react";

// Import sources to register them
import "@/sources/scryfall";
import "@/sources/ygoprodeck";
import "@/sources/pokemontcg";
import "@/sources/dimrift";

interface ImportCardsModalProps {
  onImport: (cards: FetchResult[]) => void;
  onClose: () => void;
}

type Step = "input" | "loading" | "results";

export function ImportCardsModal({ onImport, onClose }: ImportCardsModalProps) {
  const { addImage } = useImageStore();
  const sources = getAllSources();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [cardList, setCardList] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" });
  const [results, setResults] = useState<FetchResult[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const source = getSource(sourceId);

  const handleLoad = async () => {
    if (!source) return;

    const parsed = source.parse(cardList);
    if (parsed.length === 0) return;

    // Cancel any existing fetch
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStep("loading");
    setProgress({ current: 0, total: parsed.length, name: "" });

    const fetched = await source.fetch(
      parsed,
      addImage,
      (current, total, name) => {
        setProgress({ current, total, name });
      },
      abortController.signal
    );

    // Only show results if not cancelled
    if (!abortController.signal.aborted) {
      setResults(fetched);
      setStep("results");
    }
    abortControllerRef.current = null;
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStep("input");
  };

  const handleImport = () => {
    const successful = results.filter((r) => r.imageId);
    onImport(successful);
  };

  const successCount = results.filter((r) => r.imageId).length;
  const errorCount = results.filter((r) => r.error).length;

  if (step === "loading") {
    return (
      <Modal title="Import Cards" onClose={onClose}>
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <p>
            Loading {progress.current} / {progress.total}
          </p>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {progress.name}
          </p>
          <div
            style={{
              marginTop: "1rem",
              background: "var(--border)",
              height: "4px",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "var(--accent)",
                height: "100%",
                width: `${String((progress.current / progress.total) * 100)}%`,
                transition: "width 0.2s",
              }}
            />
          </div>
          <div style={{ marginTop: "1.5rem" }}>
            <Button onClick={handleCancel}>Cancel</Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "results") {
    const footer = (
      <>
        <Button onClick={() => setStep("input")}>Back</Button>
        <Button onClick={handleImport} variant="accent" disabled={successCount === 0}>
          Import {successCount} Cards
        </Button>
      </>
    );

    return (
      <Modal title="Import Cards" onClose={onClose} footer={footer}>
        <p style={{ marginBottom: "1rem" }}>
          <span style={{ color: "var(--accent)" }}>{successCount} loaded</span>
          {errorCount > 0 && <span style={{ color: "var(--danger)" }}> • {errorCount} failed</span>}
        </p>

        <div style={{ maxHeight: "300px", overflow: "auto" }}>
          {results.map((result, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {result.imageData && (
                <img
                  src={result.imageData}
                  alt={result.name}
                  style={{ width: "32px", height: "auto", borderRadius: "2px" }}
                />
              )}
              <span style={{ flex: 1 }}>
                {result.count}x {result.name}
              </span>
              {result.error && <span style={{ color: "var(--danger)", fontSize: "0.9em" }}>{result.error}</span>}
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  const parsedCount = source?.parse(cardList).length ?? 0;

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleLoad} variant="accent" disabled={parsedCount === 0}>
        Load {parsedCount > 0 ? `${String(parsedCount)} Cards` : ""}
      </Button>
    </>
  );

  return (
    <Modal title="Import Cards" onClose={onClose} footer={footer}>
      <label>
        <span>Source</span>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {source?.corsWarning && (
        <div
          style={{
            background: "rgba(255, 200, 50, 0.15)",
            border: "1px solid rgba(255, 200, 50, 0.4)",
            borderRadius: "4px",
            padding: "0.75rem",
            marginTop: "1rem",
            fontSize: "0.9em",
          }}
        >
          <strong style={{ color: "rgb(255, 200, 50)" }}>⚠ CORS Required</strong>
          <p style={{ marginTop: "0.25rem" }}>{source.corsWarning}</p>
          <p style={{ marginTop: "0.5rem" }}>
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Firefox
            </a>
            {" | "}
            <a
              href="https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Chrome
            </a>
          </p>
        </div>
      )}

      <label style={{ marginTop: "1rem", display: "block" }}>
        <span>Card List</span>
        <textarea
          value={cardList}
          onChange={(e) => setCardList(e.target.value)}
          placeholder={source?.placeholder}
          rows={10}
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "1em",
            background: "#000",
            color: "var(--text)",
            border: "1px solid var(--border)",
            padding: "8px",
            resize: "vertical",
          }}
        />
      </label>

      <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.9em" }}>
        Enter one card per line. Format: COUNT NAME or COUNTx NAME
      </p>
    </Modal>
  );
}
