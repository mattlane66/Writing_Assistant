const SOURCES = [
  "Klinkenborg",
  "Tufte",
  "Zinsser",
  "Orwell",
  "King",
  "Grammar as Style",
  "100 Ways",
] as const;

export function SourceRail() {
  return (
    <footer className="source-rail" aria-label="Writing guides">
      <div className="source-list">
        {SOURCES.map((source, index) => (
          <span className="source-item" key={source}>
            <span>{source}</span>
            {index < SOURCES.length - 1 && (
              <span className="source-separator" aria-hidden="true">
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </footer>
  );
}
