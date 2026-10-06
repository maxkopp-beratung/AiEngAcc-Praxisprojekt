# PROJ-2 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Das ist der geordnete, nachvollziehbare Bauplan: die Brücke zwischen dem Vertrag (WAS) und dem Build (WIE).
> `[P]` = parallelisierbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also an einen eigenen Subagenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC-/EC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur du machen kannst. Für PROJ-2 gibt es keine (`design.md` → Settings the user makes: keine).
> Owner: `/tasks` legt die Datei an, `/build` hakt die Kästchen ab.
> Kein Status-Feld hier. Der Status des Features steht nur in `features/INDEX.md`.

## Ebene 1 — Pakete & Typen

- [x] T1 [P]  shadcn-Komponente `chart` hinzufügen (`npx shadcn@latest add chart`, bringt `recharts`), `date-fns` und `@date-fns/tz` installieren  · files: package.json, package-lock.json, src/components/ui/chart.tsx  · → AC-3, AC-18
- [x] T2 [P]  Gemeinsame Typen: Preis-Paket (`generatedAt`, `today`, `tomorrow`), Tagespaket (`date`, `status` = `ok` | `not_published` | `error`, `slots` nur bei `ok`), Slot (`start` als UTC-ISO, `priceEurMwh` Zahl oder `null`), Stufe (`cheap` | `mid` | `expensive`)  · files: src/lib/prices/types.ts  · → AC-12, AC-13, EC-4, EC-5

## Ebene 2 — Bausteine ohne Seiteneffekte

- [x] T3 [P]  Deutsche Zeit (Europe/Berlin über `@date-fns/tz`): Kalendertag heute/morgen zu einem Zeitpunkt, Tagesgrenzen als UTC, lückenloses 15-Minuten-Raster eines Tages (92/96/100 Slots), Beschriftung „HH:MM–HH:MM“ mit „24:00“ am Tagesende und „MESZ“/„MEZ“ nur für die doppelte Stunde am 100-Slot-Tag, Startzeit „HH:MM Uhr“; Tests für alle drei Tageslängen und eine fremde Gerätezeitzone  · files: src/lib/prices/berlin-time.ts, src/lib/prices/berlin-time.test.ts  · → AC-18, EC-1, EC-2
- [x] T4 [P]  Preislogik als reine Funktionen: ct/kWh-Formatierung (÷ 10, eine Nachkommastelle, Komma, „−“), aktueller Slot zu „jetzt“, betrachteter Bereich (heute ab jetzt / ganzer Tag), günstigster und teuerster Slot (nur mit Preis, Gleichstand → frühester), Tagesdurchschnitt, Stufe je Slot (Drittel der Tagesspanne, Spanne 0 → alle „mittel“); Tests für negative Preise, Gleichstand, alle gleich, Lücken, letzter Slot des Tages  · files: src/lib/prices/price-math.ts, src/lib/prices/price-math.test.ts  · → AC-4, AC-6, AC-7, AC-9, AC-10, AC-12, EC-3, EC-4, EC-6
- [x] T5 [P]  Energy-Charts-Abruf (`server-only`): `GET /price?bzn=DE-LU&start=<heute>&end=<morgen>`, Zeitüberschreitung 8 s, Zod-Prüfung (`unix_seconds` ganze Zahlen, `price` gleich lang aus Zahl oder `null`), Ergebnis = gültige Wertepaare oder Fehlerart (Zeitüberschreitung, Netzwerk, HTTP ≠ 200, 429 mit `Retry-After` in Sekunden, ungültige Antwort); Tests mit gemocktem Abruf, nie gegen die echte API  · files: src/lib/prices/energy-charts.ts, src/lib/prices/energy-charts.test.ts  · → AC-4, AC-23

## Ebene 3 — Preis-Dienst

- [x] T6  Preis-Dienst „Preise für heute und morgen holen“ (`server-only`, Abruf und Uhr von außen übergebbar): Werte nach deutscher Zeit auf heute/morgen und Slots verteilen, fehlende Slots als `null`, heute ohne Wert → `error`, morgen ohne Wert → `not_published`. Dazu der prozessweite Zwischenspeicher (auf `globalThis`, Schlüssel = heutiger Kalendertag): vollständig → bis Mitternacht, morgen fehlt vor 12:00 → bis 12:00, ab 12:00 → 60 s, Lücken → 15 min, Fehler mit Eintrag → alten Stand liefern, Fehler ohne Eintrag → `error` merken; nächster Versuch frühestens nach 30 s bzw. `Retry-After`; gleichzeitige Aufrufe teilen sich eine laufende Anfrage. Tests mit fester Uhr  · files: src/lib/prices/get-prices.ts, src/lib/prices/get-prices.test.ts, src/lib/prices/price-cache.ts, src/lib/prices/price-cache.test.ts  · → AC-20, AC-23, AC-24, EC-4, EC-5, EC-9

## Ebene 4 — Endpunkt, Bauteile & Live-Logik

- [x] T7 [P]  Endpunkt `GET /api/prices`: Sitzung im Endpunkt gegen Supabase Auth prüfen, ohne Sitzung 401 `{ "error": "unauthorized" }` ohne Preise, sonst 200 mit dem Preis-Paket (auch bei `today.status = error`), Header `Cache-Control: private, no-store`, keine Parameter; Tests für 401 und 200  · files: src/app/api/prices/route.ts, src/app/api/prices/route.test.ts  · → AC-2, AC-23
- [x] T8 [P]  Kennzahlen-Karten: Modus „heute“ (Jetzt mit Stufe in Worten · Günstigster ab jetzt · Teuerster ab jetzt) und Modus „ganzer Tag“ (Ø Tagesdurchschnitt · Günstigster · Teuerster), Uhrzeit + Preis, `tabular-nums`, „Kein Preis verfügbar“, unter 640 px untereinander  · files: src/components/prices/key-figures.tsx  · → AC-10, AC-12, AC-17, EC-3, EC-4
- [x] T9 [P]  Diagramm mit shadcn `chart`: ein Balken pro Slot, Farben nach Stufe (`--chart-1/2/3`), Nulllinie und negative Balken, Lücken bei `null`, x-Achse alle 3 h (unter 640 px alle 6 h), Modus „heute“: vergangene Slots in `muted`, aktueller in `--chart-4` mit Label „jetzt“; günstigster/teuerster Slot mit Icon und Label „günstigst“/„teuerst“; Tooltip „13:15–13:30 · 8,4 ct/kWh“ bei Hover, Tippen und Tastatur (ein Tab-Stopp, Pfeiltasten); Legende in Worten; volle Breite ohne horizontales Scrollen  · files: src/components/prices/price-chart.tsx  · → AC-3, AC-5, AC-6, AC-7, AC-8, AC-11, AC-17, EC-1, EC-2, EC-4, EC-6
- [x] T10 [P]  Tabelle hinter „Als Tabelle anzeigen“ (zugeklappt, shadcn Collapsible + Table): Spalten Zeitraum, Preis, Hinweis („günstigster Zeitpunkt“/„teuerster Zeitpunkt“), „keine Daten“ bei Lücken, MESZ/MEZ-Zusatz  · files: src/components/prices/price-table.tsx  · → AC-16, EC-2, EC-4
- [x] T11 [P]  Zustände und Fußzeile: Skeleton in Form von Kennzahlen + Diagramm; Leerzustand „Morgen“ (gestrichelte Karte, Icon, Text aus AC-13); Fehlerzustand (Alert „Die Strompreise konnten gerade nicht geladen werden.“ + Button „Erneut versuchen“ mit Lade- und Deaktiviert-Zustand); Fußzeile mit Börsenpreis-Hinweis und Quellenangabe „Daten: Bundesnetzagentur | SMARD.de, über Energy-Charts, CC BY 4.0“ mit Link  · files: src/components/prices/price-section-skeleton.tsx, src/components/prices/price-states.tsx, src/components/prices/price-footer.tsx  · → AC-13, AC-14, AC-15, AC-22, AC-23
- [x] T12 [P]  Hook für die Live-Logik: Timer bis zum nächsten Slot-Beginn (aus den Slot-Zeitpunkten), Neuberechnung bei Rückkehr in den Vordergrund, `/api/prices` nur abfragen, wenn morgen nicht `ok` ist oder ein Tageswechsel ansteht, um Mitternacht „morgen“ sofort zu „heute“ machen und danach nachladen, Fehler beim Nachladen still (alter Stand bleibt, solange er zum Tag passt), 401 → Seite neu laden, `retry()` für „Erneut versuchen“; Tests mit Fake-Timern und gemocktem Abruf  · files: src/hooks/use-live-prices.ts, src/hooks/use-live-prices.test.ts  · → AC-19, AC-20, AC-21, EC-7, EC-8

## Ebene 5 — Zusammenbau

- [x] T13  `PricePanel` (Browser): Titel „Strompreise“, Tabs „Heute“ (vorausgewählt) | „Morgen“, DayView je Modus aus T8–T10, Leer-/Fehlerzustand und Fußzeile aus T11, Live-Daten aus T12, gewählter Tab bleibt beim Aktualisieren erhalten. `PriceSection` (Server): ruft den Preis-Dienst direkt auf, eigene Suspense-Grenze mit Skeleton. Einbau in `/dashboard` unter dem Seitentitel, Platzhaltersatz → „Hier siehst du bald deine Geräte.“  · files: src/components/prices/price-panel.tsx, src/components/prices/price-section.tsx, src/app/dashboard/page.tsx  · → AC-1, AC-22, AC-23, EC-10

## Ebene 6 — Abschluss

- [x] T14  Prüfung im laufenden System: ein einziger echter Abruf, angezeigte Werte stichprobenartig gegen Energy-Charts (umgerechnet) vergleichen; Browser bei 360 px (kein horizontales Scrollen, Antippen zeigt Wert) und per Tastatur (Tabs, Diagramm mit Pfeiltasten, Tabelle); Korrekturen in den betroffenen Dateien aus T8–T13  · files: — (Prüfung; Korrekturen nur in Dateien aus T8–T13)  · → AC-4, AC-5, AC-17

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist: Pakete/Typen (E1) → Bausteine (E2) → Preis-Dienst (E3) → Endpunkt, Bauteile, Hook (E4) → Zusammenbau (E5) → Abschluss (E6).
- **`[P]` heißt: keine gemeinsamen Dateien.** In Ebene 1, 2 und 4 überschneiden sich die `files:` der `[P]`-Aufgaben nicht. Ebene 3, 5 und 6 haben je nur eine Aufgabe.
- **Keine echten API-Aufrufe in Tests.** Energy-Charts erlaubt nur 2 Anfragen pro Minute pro IP. Alle Tests ersetzen Abruf und Uhr; nur T14 macht einen einzigen echten Abruf.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Subagenten mit isoliertem Git-Worktree. Danach integriert der Hauptagent, prüft gegen die AC-IDs der Ebene und hakt hier ab. Subagenten erklären sich nie selbst für fertig.
