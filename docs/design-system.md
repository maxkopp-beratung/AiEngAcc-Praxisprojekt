# Design System – WattWann

> Von `/init` vorgeschlagen und vom Nutzer freigegeben. `/build` wendet diese Werte bei jedem Feature an.
> Tokens im HSL-Format des Projekts (`src/app/globals.css`, shadcn/ui-Variablen). Alle Text-/Hintergrund-Paare unten erreichen in beiden Themes mindestens 4,5:1.

## Charakter

Ruhig, klar, freundlich. Grün bedeutet „jetzt günstig“, Bernstein bedeutet „jetzt teuer“. Die Preise stehen im Mittelpunkt, alles andere tritt zurück. Die Zielgruppe sind Laien – keine Fachbegriffe ohne Erklärung.

## Farben

| Token | Hell | Dunkel | Einsatz |
|---|---|---|---|
| `--background` | `210 20% 97%` | `222 22% 8%` | Seitenhintergrund |
| `--foreground` | `222 25% 12%` | `210 20% 94%` | Text |
| `--card` / `--popover` | `210 20% 99.5%` | `222 20% 11%` | Karten, Flächen, Popovers |
| `--card-foreground` / `--popover-foreground` | `222 25% 12%` | `210 20% 94%` | Text auf Karten |
| `--primary` | `158 64% 28%` | `152 55% 48%` | Hauptaktion, „günstig“ |
| `--primary-foreground` | `150 40% 98%` | `160 50% 7%` | Text auf `primary` |
| `--primary-hover` | `158 64% 24%` | `152 55% 54%` | Hover auf `primary` |
| `--primary-active` | `158 64% 20%` | `152 55% 58%` | Gedrückt-Zustand |
| `--primary-subtle` | `152 50% 93%` | `158 40% 15%` | Hintergrund des empfohlenen Fensters |
| `--primary-subtle-foreground` | `158 64% 20%` | `152 55% 70%` | Text auf `primary-subtle` |
| `--secondary` | `210 16% 93%` | `222 16% 17%` | Sekundäre Flächen und Buttons |
| `--secondary-foreground` | `222 25% 15%` | `210 20% 94%` | Text auf `secondary` |
| `--muted` | `210 16% 93%` | `222 16% 17%` | Gedämpfte Flächen |
| `--muted-foreground` | `215 14% 36%` | `215 14% 66%` | Hilfstexte, Achsenbeschriftung |
| `--accent` | `152 30% 94%` | `222 16% 17%` | Hover-Fläche für Menüs und Ghost-Buttons |
| `--accent-foreground` | `222 25% 12%` | `210 20% 94%` | Text auf `accent` |
| `--price-expensive` | `26 90% 36%` | `32 95% 60%` | „teuer“, teuerster Zeitpunkt |
| `--price-expensive-subtle` | `36 90% 93%` | `30 50% 15%` | Hintergrund für teure Zeiträume |
| `--destructive` | `0 72% 44%` | `0 72% 63%` | Löschen, Fehler |
| `--destructive-foreground` | `0 0% 98%` | `0 0% 6%` | Text auf `destructive` |
| `--border` / `--input` | `214 18% 87%` | `222 14% 20%` | Linien, Eingabefelder |
| `--ring` | `158 64% 28%` | `152 55% 48%` | Fokusring (= `primary`) |

**Charts (Preisskala):** `--chart-1` = `primary` (günstig), `--chart-2` = `215 14% 60%` (neutral), `--chart-3` = `price-expensive` (teuer), `--chart-4` = `210 70% 50%` (Hervorhebung „jetzt“). In Dunkel dieselben Rollen mit den Dunkel-Werten von `primary` und `price-expensive`.

**Regeln**
- Nie reines `#000` oder `#fff` für Hintergrund oder Text.
- Die Markenfarbe nie als flache, große Fläche – immer mit Hover-, Active- und Subtle-Variante.
- Farbe ist nie das einzige Signal: günstigster und teuerster Zeitpunkt tragen immer zusätzlich ein Label oder Icon.

## Typografie

- **Schrift:** Inter, eingebunden über `next/font/google`.
- **Größen:** 12 / 14 / 16 / 18 / 20 / 24 / 30 px (`text-xs` bis `text-3xl`).
- **Gewichte:** Überschriften 600 (semibold), Fließtext 400, hervorgehobene Zahlen 600.
- **Zahlen:** Preise und Uhrzeiten immer mit `tabular-nums`.
- **Seitentitel:** `text-2xl font-semibold`, Abschnittstitel `text-lg font-semibold`.

## Rundung, Abstände, Tiefe

- **Rundung:** eine einzige Entscheidung – `--radius: 0.625rem` (10 px), überall angewendet.
- **Abstände:** 4-px-Raster (Tailwind-Standard). Seitenrand 16 px mobil, 24 px ab `md`. Abstand zwischen Karten 16–24 px, Innenabstand von Karten 20–24 px.
- **Tiefe:** Flächen werden durch Rahmen (`border`) getrennt, nicht durch Schatten. Schatten (`shadow-md`) nur für schwebende Elemente: Dialoge, Popovers, Toasts.

## Komponenten-Konventionen

- **Buttons:** Standardgröße `h-10`. Pro Seite genau eine primäre Aktion (`default`), alles andere `outline` oder `ghost`. Destruktive Aktionen `destructive`, immer mit Bestätigung.
- **Hover & Fokus:** Jedes interaktive Element hat einen sichtbaren Hover-Zustand und einen sichtbaren Fokusring (2 px `ring`, 2 px Abstand). Fokus ist Pflicht, kein Extra.
- **Formularfelder:** Höhe `h-10`, Label über dem Feld, Hilfetext in `muted-foreground` darunter, Fehlermeldung in `destructive` unter dem Feld.
- **Ladezustand:** Skeletons in der Form des späteren Inhalts, kein Vollbild-Spinner.
- **Leerzustand:** Icon, Überschrift, ein erklärender Satz und die primäre Aktion – in einer Karte mit gestricheltem Rahmen.
- **Fehlerzustand:** Alert in `destructive` mit kurzem, verständlichem Text und einem Button „Erneut versuchen“.
- **Komponentenbibliothek:** shadcn/ui (`src/components/ui`), Icons aus `lucide-react`.
