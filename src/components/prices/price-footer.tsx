const LINK_CLASS =
  "rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Footer of the price section: price hint (AC-14) and source attribution with license (AC-15).
export function PriceFooter() {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>Reiner Börsenpreis ohne Netzentgelte, Steuern und Umlagen – dein Tarifpreis liegt höher.</p>
      <p>
        Daten: Bundesnetzagentur | SMARD.de, über{" "}
        <a href="https://www.energy-charts.info" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Energy-Charts
        </a>
        ,{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}
