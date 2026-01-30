import { Button } from "@/app/components/Button";
import { Modal } from "@/app/components/Modal";
import { useImageStore } from "@/app/store/images";
import { parseCardList, fetchCardsFromScryfall, type FetchResult } from "@/sources/scryfall";
import { parseYGOCardList, fetchCardsFromYGO } from "@/sources/ygoprodeck";
import { parsePokemonCardList, fetchCardsFromPokemonTCG } from "@/sources/pokemontcg";
import { useState } from "react";

type ImportSource = "mtg-scryfall" | "ygo-ygoprodeck" | "pokemon-pokemontcg";

interface ImportCardsModalProps {
  onImport: (cards: FetchResult[]) => void;
  onClose: () => void;
}

type Step = "input" | "loading" | "results";

export function ImportCardsModal({ onImport, onClose }: ImportCardsModalProps) {
  const { addImage } = useImageStore();
  const [source, setSource] = useState<ImportSource>("mtg-scryfall");
  const [cardList, setCardList] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" });
  const [results, setResults] = useState<FetchResult[]>([]);

  const handleLoad = async () => {
    if (source === "mtg-scryfall") {
      const parsed = parseCardList(cardList);
      if (parsed.length === 0) return;

      setStep("loading");
      setProgress({ current: 0, total: parsed.length, name: "" });

      const fetched = await fetchCardsFromScryfall(parsed, addImage, (current, total, name) => {
        setProgress({ current, total, name });
      });

      setResults(fetched);
      setStep("results");
    } else if (source === "ygo-ygoprodeck") {
      const parsed = parseYGOCardList(cardList);
      if (parsed.length === 0) return;

      setStep("loading");
      setProgress({ current: 0, total: parsed.length, name: "" });

      const fetched = await fetchCardsFromYGO(parsed, addImage, (current, total, name) => {
        setProgress({ current, total, name });
      });

      setResults(fetched);
      setStep("results");
    } else {
      const parsed = parsePokemonCardList(cardList);
      if (parsed.length === 0) return;

      setStep("loading");
      setProgress({ current: 0, total: parsed.length, name: "" });

      const fetched = await fetchCardsFromPokemonTCG(parsed, addImage, (current, total, name) => {
        setProgress({ current, total, name });
      });

      setResults(fetched);
      setStep("results");
    }
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

  const parsedCount =
    source === "mtg-scryfall"
      ? parseCardList(cardList).length
      : source === "ygo-ygoprodeck"
        ? parseYGOCardList(cardList).length
        : parsePokemonCardList(cardList).length;

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleLoad} variant="accent" disabled={parsedCount === 0}>
        Load {parsedCount > 0 ? `${String(parsedCount)} Cards` : ""}
      </Button>
    </>
  );

  const placeholder =
    source === "mtg-scryfall"
      ? "1 Mana Vault\n2x Counterspell\n1 Sol Ring"
      : source === "ygo-ygoprodeck"
        ? "3 Dark Magician\n2x Blue-Eyes White Dragon\n1 Exodia the Forbidden One"
        : "4 Pikachu\n2x Charizard\n1 Mewtwo";

  const helpText =
    source === "mtg-scryfall"
      ? "Enter one card per line. Format: COUNT NAME or COUNTx NAME"
      : source === "ygo-ygoprodeck"
        ? "Enter one card per line. Format: COUNT NAME or COUNTx NAME. Also supports YDK format (card IDs)."
        : "Enter one card per line. Format: COUNT NAME or COUNTx NAME";

  const corsWarning = source === "ygo-ygoprodeck" && (
    <div
      style={{
        background: "rgba(255, 200, 50, 0.15)",
        border: "1px solid rgba(255, 200, 50, 0.4)",
        borderRadius: "4px",
        padding: "0.75rem",
        marginBottom: "1rem",
        fontSize: "0.9em",
      }}
    >
      <strong style={{ color: "rgb(255, 200, 50)" }}>⚠ CORS Required</strong>
      <p style={{ marginTop: "0.25rem" }}>
        YGOPRODeck doesn't support browser requests. You must disable CORS in your browser.
      </p>
      <p style={{ marginTop: "0.5rem" }}>
        Firefox:{" "}
        <a
          href="https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}
        >
          CORS Everywhere
        </a>
        {" | "}
        Chrome:{" "}
        <a
          href="https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}
        >
          Allow CORS
        </a>
      </p>
    </div>
  );

  return (
    <Modal title="Import Cards" onClose={onClose} footer={footer}>
      <label>
        <span>Source</span>
        <select value={source} onChange={(e) => setSource(e.target.value as ImportSource)}>
          <option value="mtg-scryfall">MTG - Scryfall</option>
          <option value="ygo-ygoprodeck">Yu-Gi-Oh - YGOPRODeck</option>
          <option value="pokemon-pokemontcg">Pokémon - TCGdex</option>
        </select>
      </label>

      {corsWarning}

      <label style={{ marginTop: "1rem", display: "block" }}>
        <span>Card List</span>
        <textarea
          value={cardList}
          onChange={(e) => setCardList(e.target.value)}
          placeholder={placeholder}
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
        {helpText}
      </p>
    </Modal>
  );
}
