import { BookOpen, Settings } from "lucide-react";

interface HeaderProps {
  guideCount: number;
}

export function Header({ guideCount }: HeaderProps) {
  const statusLabel = `${guideCount} guides plus reasoning ready`;

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <span>A</span>
        </span>
        <h1>Writing Assistant</h1>
      </div>

      <div className="guide-status" aria-label={statusLabel}>
        <BookOpen size={29} strokeWidth={1.7} aria-hidden="true" />
        <span>{guideCount} guides + reasoning</span>
        <span className="header-divider" aria-hidden="true" />
        <span className="settings-mark" role="img" aria-label="Settings">
          <Settings size={29} strokeWidth={1.7} aria-hidden="true" />
        </span>
      </div>
    </header>
  );
}
