# QA-Testergebnisse – PROJ-2 Strompreise

**Getestet:** 2026-10-06
**App-URL:** http://localhost:3001. Das ist der Dev-Server dieses Worktrees. `probe.baseUrl` (3000) zeigt hier auf den Checkout von `main`.
**Tester:** QA Engineer (KI). Drei unabhängige `qa-engineer`-Lanes (Akzeptanz, Security, Regression) ohne Build-Kontext; zusammengeführt vom QA-Owner.
**Umfang:** `full` (erster Durchlauf)
**Rohbelege:** `scratchpad/` der QA-Sitzung:
- `suite-run.log`
- `acceptance/`: `ec1.json`, `ec2.json`, `api1.json`, `api2.json`, `dash1.html`, `dash2.html`, `*.probe.test.ts(x)`
- `security/`: `cache-abuse.test.ts`, `body.txt`, `bodyC.txt`, `secretscan.mjs`
- `regression/`: `reg.mjs`, `reg2.mjs`

> Legende: `[x]` in diesem Lauf verifiziert (mit Beleg) · `[ ] BUG` als fehlerhaft verifiziert · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

**Testkonten:** 6 Wegwerfkonten über die Admin-API (`qa-acc-…`, `qa-sec-…` ×3, `qa-reg-…` ×2).
- Alle sind wieder gelöscht, Beleg: `getUserById` → `user_not_found`.
- 9 direkt eingetragene Fehlversuche wurden per `release_login_attempt` entfernt.
- Energy-Charts wurde genau 2× direkt abgefragt (11:04Z und 11:10Z).

## Acceptance Criteria

### Abschnitt & Zugriff
- [x] **AC-1**: `/dashboard` mit Sitzung → 200. Unter `<h1>Übersicht</h1>` steht `<h2>Strompreise</h2>` mit den Tabs „Heute“ (`aria-selected="true"`) und „Morgen“. Beleg: `acceptance/dash1.html`, `price-panel.tsx:30`.
- [ ] **AC-2**: BUG-2. Ohne Sitzung greift der Schutz:
  - `/dashboard` → 307 auf `/login?next=%2Fdashboard`, auch mit `RSC: 1`, `_rsc`, `x-middleware-subrequest` und Pfadvarianten.
  - `/api/prices` → `401 {"error":"unauthorized"}`.
  - Beleg: curl-Läufe der Security-Lane, `route.ts:11-15`.

  **Aber:** Bei einer serverseitig widerrufenen Sitzung (Konto gelöscht oder global abgemeldet) liefert `/dashboard` zwar 307, der Body enthält aber die Preisdaten (96 bzw. 192× `priceEurMwh`).

### Diagramm & Werte
- [x] **AC-3**: 96 Balken mit dem echten Payload. x-Ticks `0,3,…,21` in Berliner Stunden, y-Achse „ct/kWh“. Beleg: `acceptance/panel.probe`, `price-chart.tsx:62-114`. Das Rendering in einer echten Engine: siehe Nicht verifiziert.
- [x] **AC-4**: Echte Quelle gegen App, Slot für Slot: heute 96/96 und morgen 96/96 ohne Abweichung (`ec2.json` ↔ `api2.json`).
  - Die Anzeige ist korrekt formatiert, 0 Abweichungen in 96 Tabellenzeilen.
  - Das Spec-Beispiel kam echt vor: 160,55 EUR/MWh → „00:00–00:15 · 16,1 ct/kWh“.
  - Code: `price-math.ts:17-28`.
- [~] **AC-5**: teilweise verifiziert.
  - Text „13:15–13:30 · 8,4 ct/kWh“: `price-chart.tsx:117-119` + `price-chart.test.tsx`.
  - Tippen fokussiert das Diagramm nicht: `:287-291`.
  - Ein Tab-Stopp mit `accessibilityLayer`: `:297`.
  - Hover, Tippen und Pfeiltasten in einer echten Engine: siehe Nicht verifiziert.
- [x] **AC-6**: −5 EUR/MWh → „−0,5 ct/kWh“ mit dem Zeichen U+2212. Der Balken reicht unter die Nulllinie (y 213,3 bei Nulllinie 181,5). Ein Wert wie −0,04 wird „0,0“ ohne Minus. Beleg: Probe, `price-math.ts:21`.
- [x] **AC-7**: Drittel über die ganze Tagesspanne inklusive Vergangenheit (`price-math.ts:84-96`). Fills `--chart-1/2/3` (`price-chart.tsx:31-35`, `globals.css:100-103`), Legende „günstig, mittel, teuer“. Die gerenderte Farbe: siehe Nicht verifiziert.
- [x] **AC-8**: In der Marker-Ebene stehen „günstigst“ und „teuerst“ mit ArrowDown- und ArrowUp-Icon. Beleg: Probe mit echten Daten, `price-chart.tsx:180-234`. Die Platzierung im Browser: siehe Nicht verifiziert.
- [x] **AC-9**: Bei Gleichstand gilt der früheste Slot, für Minimum (Slot 40 vor 70) und Maximum (Slot 50 vor 80). Beleg: Probe, `price-math.ts:51-60`.

### Tab „Heute“
- [x] **AC-10**: Server-HTML um 13:04 Berlin: „Jetzt 12,9 · Günstigster ab jetzt 12,4 (13:30 Uhr) · Teuerster ab jetzt 40,6 (18:45 Uhr)“. Unabhängig aus `api1.json` nachgerechnet. Code: `key-figures.tsx:75-121`.
- [x] **AC-11**: 52 vergangene Balken bleiben ausgegraut sichtbar (`muted-foreground`, Deckkraft 0,3). Der aktuelle Balken ist `--chart-4` mit „jetzt“, die Legende enthält „jetzt“ und „vorbei“. Beleg: Probe, `price-chart.tsx:75,84-91`.

### Tab „Morgen“
- [x] **AC-12**: echte Morgen-Daten: „Ø 19,2 · Günstigster 12,3 (13:00) · Teuerster 28,0 (08:00)“, deckungsgleich mit der Quelle. Kein „jetzt“, 0 ausgegraute Balken. Beleg: `acceptance/morgen.probe`.
- [x] **AC-13**: Der echte Payload um 13:03 hatte `tomorrow.status = not_published`. Der Tab zeigt dann den exakten Hinweistext ohne `role=alert`. Beleg: `api1.json`, `price-states.tsx:16`.

### Hinweise & Zugänglichkeit
- [x] **AC-14**: Der exakte Satz steht im Server-HTML (`dash1.html`, `price-footer.tsx:8`).
- [x] **AC-15**: Die Quellenangabe steht wortgleich im Server-HTML, mit Links auf energy-charts.info und CC BY 4.0 (`price-footer.tsx:10-22`).
- [x] **AC-16**: Die Tabelle ist im SSR zugeklappt. Aufgeklappt zeigt sie 96 Zeilen mit Zeitraum und Preis sowie „günstigster Zeitpunkt“ und „teuerster Zeitpunkt“ in Textform. Beleg: Probe, `price-table.tsx:31-86`.
- [!] **AC-17**: NOT VERIFIED, weil kein Viewport zur Verfügung stand.
  - Im Code geprüft: `grid sm:grid-cols-3` (`key-figures.tsx:116`), Diagramm `w-full min-w-0` (`price-chart.tsx:283,292`), Ticks alle 6 h unter 640 px.

### Zeit & Aktualisierung
- [x] **AC-18**: Die Probe lief identisch unter `Europe/Berlin`, `America/Los_Angeles` und `Pacific/Kiritimati` (der diff ist leer). Code: `berlin-time.ts:12-16`, `use-live-prices.ts:85,112`.
- [x] **AC-19**: Um 13:14:50 und 10 s später springt „Jetzt“ auf 13:15, die Werte „ab jetzt“ werden neu berechnet, 0 Fetches. Beleg: `acceptance/live.probe`, `use-live-prices.ts:138-148`.
- [x] **AC-20**: Fehlt morgen, folgt an der nächsten Grenze 1× `/api/prices`, und der Tab bleibt gewählt (`use-live-prices.ts:129`). Grenzfall siehe BUG-4.
- [x] **AC-21**: Um 23:59:50 und 10 s später zeigt „Heute“ den neuen Tag, „Morgen“ den Leerzustand, 1 Fetch. Beleg: Probe, `use-live-prices.ts:115-126`. Grenzfall siehe BUG-3.

### Zustände
- [x] **AC-22**: Der SSR-Stream liefert zuerst das Skeleton (`aria-busy="true"`, 3 Karten und Diagramm), danach erst den Inhalt. `animate-spin` kommt 0× vor. Beleg: `dash1.html`, `price-section.tsx:15-21`.
- [x] **AC-23**: Per Probe geprüft:
  - Ohne Cache und mit Netzwerkfehler → `today=error`.
  - Timeout genau nach 8000 ms (`energy-charts.ts:57-58`).
  - Exakter Alert-Text mit „Erneut versuchen“; während der Anfrage ist der Button deaktiviert.
  - Die Suspense-Grenze hält das übrige Dashboard frei.
  - Ein echter Ausfall in der laufenden App: siehe Nicht verifiziert.
- [x] **AC-24**: Erst Erfolg, dann Ausfall → Preise aus dem Cache ohne Warnung (`get-prices.ts:79-83`). Belege: Probe, `get-prices.test.ts` und neue Tests in `get-prices.edge.test.ts`.

## Edge Cases

- [x] **EC-1**: Simulierter Quelltag 2026-03-29: 92 Slots, kein 02:xx, Ø über 92 Werte. Die Beschriftung „01:45–03:00“ ist irreführend, siehe BUG-5.
- [x] **EC-2**: 100 Slots, die doppelte Stunde ist mit „MESZ“ bzw. „MEZ“ unterschieden, Ø über 100 Werte (`berlin-time.ts:80-92`). Die Endzeit „02:45–02:00 MESZ“ ist irreführend, siehe BUG-5.
- [x] **EC-3**: Um 23:50 Berlin zeigen alle drei Kennzahlen „16,5 ct/kWh · 23:45 Uhr“, ohne Fehler (Probe).
- [x] **EC-4**: Probe mit 5 Lücken:
  - In der Tabelle steht „keine Daten“, im Diagramm erscheint kein Balken.
  - Fehlt der aktuelle Slot, zeigt „Jetzt“ „Kein Preis verfügbar“.
  - Stufen und Durchschnitt ignorieren die Lücken.
  - Der Cache gilt dann 15 min (`price-cache.ts:67`).
- [x] **EC-5**: Antwort 200 ohne heutige Werte → `today=error`. Die Oberfläche zeigt den Alert, nicht den Leerzustand (`get-prices.ts:18,27`, Probe). Mit vorhandenem Cache-Eintrag bleiben die Preise stehen (`get-prices.edge.test.ts`).
- [x] **EC-6**: Alle Preise gleich → alles „mittel“ (`--chart-2`), günstigster = teuerster = frühester Slot (Probe, `price-math.ts:90`).
- [x] **EC-7**: `visibilitychange` oder `focus` nach vorgestellter Uhr → sofort neuer Slot bzw. neuer Tag (`use-live-prices.ts:151-157`, Probe).
- [x] **EC-8**: Netzwerkfehler, 500 oder `today=error` beim Nachladen → die alten Daten bleiben ohne Alert stehen, beim nächsten Wechsel folgt ein neuer Versuch. Nach Mitternacht ohne Daten erscheint der Fehlerzustand. Belege: Probe, `use-live-prices.ts:88-99`, `get-prices.edge.test.ts`.
- [x] **EC-9**: Die Garantie aus `design.md` steht im Code: geteilte laufende Anfrage (`get-prices.ts:64,69-90`) und prozessweiter Speicher auf `globalThis` (`price-cache.ts:29-36`).
  - 50 bzw. 200 gleichzeitige Aufrufe → 1 Quell-Abruf.
  - Live: Seite und Endpunkt liefern dasselbe `generatedAt`.
  - 30 parallele Anfragen → 30× dasselbe `generatedAt`.
- [x] **EC-10**: Wechsel Heute → Morgen → Heute: 0 Fetches, kein `aria-busy` (Probe, `price-panel.tsx:27-57`).

**Zusätzlich geprüft (undokumentiert):**
- Ein Wert, der auf null rundet, wird ohne Minus angezeigt.
- Ein komplett fehlender Zeitstempel wird als Lücke behandelt.
- Query-Parameter an `/api/prices` werden ignoriert und umgehen den Cache nicht.
- POST, PUT, DELETE und PATCH → 405.
- Mitternacht mit einer Antwort für den alten Tag → BUG-3.
- Veröffentlichung kurz vor einer Slot-Grenze → BUG-4.

## Security-Audit

- [ ] **Authentifizierung**: BUG-2 (Preisdaten im Body der 307-Antwort bei widerrufener Sitzung). Alles Übrige hält:
  - Ohne, mit kaputtem oder gefälschtem Cookie (inklusive `alg:none`-JWT) → `/api/prices` 401, `/dashboard` 307 ohne Preise.
  - `RSC`-, `_rsc`- und `x-middleware-subrequest`-Varianten und Pfadvarianten (`/api/Prices` → 404, `/api/prices/` → 308 → 401) kommen ebenfalls nicht durch.
  - HEAD → 401, OPTIONS → 204 ohne CORS-Header.
- [x] **Autorisierung**: Das Feature hat keine nutzerbezogenen Daten und keine Tabelle.
  - Die Antwort enthält nur `generatedAt`, `today` und `tomorrow`; Slots nur `start` und `priceEurMwh`.
  - `grep -i "email|user|token|password"` auf der Antwort → 0 Treffer. RLS ist nicht betroffen.
- [x] **Eingabevalidierung und Injection**: Der Endpunkt nimmt keine Eingaben an.
  - 30 Anfragen mit `?bzn=FR&start=2000-01-01&nocache=…` liefern alle dieselben DE-LU-Daten.
  - Die ausgehende URL wird nur serverseitig gebaut, mit festem Host (`energy-charts.ts:7,35-38`). Die Antwort wird per Zod geprüft (`:25-32`).
  - XSS: Das einzige `dangerouslySetInnerHTML` ist `ui/chart.tsx:80`, gespeist aus statischer Konfiguration; es rendert kein `<style>`.
- [!] **Rate Limiting**: NOT VERIFIED, weil nicht implementiert. Das ist eine bewusste Design-Entscheidung (`design.md` → „Kein eigenes Rate-Limit auf /api/prices“).
  - 30 parallele Anfragen → 30× 200.
  - Missbrauch gegen Energy-Charts ist durch den Cache begrenzt: höchstens 1 Abruf pro Minute bzw. pro 30 s bei Ausfall. Beleg: `security/cache-abuse.test.ts`.
- [x] **Brute Force**: PROJ-2 hat keinen Credential-Pfad (`grep "<form\|method=" src/components/prices` → 0). `tasks.md:6`: keine `[user]`-Aufgaben. Der Login dieses Branches ist durch die veraltete PROJ-1-Basis beschädigt, siehe BUG-1.
- [x] **Keine Account-Enumeration**: entfällt für PROJ-2, weil das Feature keine Anmeldemaske hat.
- [x] **Keine Zugangsdaten in der URL**: PROJ-2 hat keine Formulare. Das Login-Formular rendert `method="POST"`.
- [x] **Keine Secrets im Client-Bundle**:
  - Gescannt wurden 20 Client-Chunks (6,5 MB), `.next/static` und `.next`: `SUPABASE_SERVICE_ROLE_KEY` → 0 Treffer, Server-Bezeichner (`getPrices`, `price-cache`, `createAdminClient`) → 0.
  - `server-only` steht in `energy-charts.ts:1`, `get-prices.ts:1` und `price-cache.ts:1`.
  - Der Browser ruft Energy-Charts nie direkt auf (`api.energy-charts` in den Chunks: 0×).
- [x] **Sensible Daten in Antworten und Header**: `cache-control: private, no-store` auf 200 und 401. Dazu `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` und HSTS. Keine Stacktraces.
- [x] **Preisdaten auf öffentlichen Seiten**: 7 öffentliche Seiten, mit und ohne `RSC: 1` → 0× `priceEurMwh`.

## Regression

- [ ] **Testsuite**: `suite-run.log`, 22 Dateien, **245 passed, 2 failed**, beide in `src/lib/supabase/rls.integration.test.ts:102,123` (PGRST202, Sperre greift nicht) → BUG-1.
- [ ] **PROJ-1 Login-Sperre**: 4 Fehlversuche vorbelegt, dann 1 falsches Passwort über `/login` → `login_throttle_status` meldet weiterhin `blocked:false`. Der Fehlversuch wird nicht gezählt → BUG-1.
- [x] **PROJ-1 Login mit korrektem Passwort**: 303 auf `/dashboard`, Auth-Cookie gesetzt (`regression/reg.mjs`).
- [x] **Ohne Sitzung**: `/`, `/dashboard` und `/dashboard?x=1` → 307 auf `/login`, `/api/prices` → 401.
- [x] **Öffentliche Seiten**: `/login`, `/signup`, `/datenschutz`, `/forgot-password` und `/auth/link-invalid` liefern 200 mit korrektem `<title>` und `<h1>`.
- [x] **Dashboard mit Sitzung**:
  - Titel „Übersicht – WattWann“, genau 1× `<header`, 0× `<nav` und `<aside`.
  - Der neue Platzhaltersatz „Hier siehst du bald deine Geräte.“ steht da, der alte fehlt (laut `design.md:48`).
- [x] **Weiterleitungen mit Sitzung**: `/`, `/login` und `/signup` → 307 auf `/dashboard`. Logout-Action → `x-action-redirect: /login`, danach `/dashboard` → 307.
- [x] **App-Rahmen unverändert**: `git diff 0a641d1..HEAD`. `dashboard/layout.tsx`, `app-header.tsx`, `proxy.ts` und `app/layout.tsx` sind unverändert. `app-shell.md` hat nur +1 Zeile (Route `/api/prices`).
- [x] **shadcn first**: `chart` gab es vorher nicht (`git ls-tree 0a641d1 src/components/ui/`). `ui/chart.tsx` hat die shadcn-Struktur.
- [x] **Abhängigkeiten**: genau `recharts`, `date-fns` und `@date-fns/tz`, wie im Design. `globals.css` ist unverändert, die `--chart-1…4` sind vorhanden.
- [x] **Doku stimmig**: `data-model.md` präzisiert „nicht gespeichert“, es gibt keine neue Migration. `privacy.md` ist unverändert, was korrekt ist: Es gehen keine Nutzerdaten an Energy-Charts.
- [x] **Lint und Typen**: `npm run lint` → Exit 0, `npx tsc --noEmit` → Exit 0.
- [x] **Merge-Fähigkeit**: `git merge-tree --write-tree HEAD main` zeigt nur einen Konflikt, in `features/INDEX.md` (benachbarte Statuszellen). Keine Code-Datei überschneidet sich.

## Unit-Tests (von `/qa` ergänzt)

Die Preislogik war schon breit getestet (139 `it(`-Fälle in 11 PROJ-2-Testdateien). Ergänzt habe ich die Randfälle von Zwischenspeicher und Preis-Dienst:

- `src/lib/prices/price-cache.edge.test.ts`: 10 Tests.
  - 12:00-Grenze auf die Millisekunde.
  - Kombination der Regeln Lücken, Mittag und 60 s.
  - Lücken nur in „morgen“.
  - Mitternacht an beiden Umstellungstagen (23:00Z bzw. 22:00Z).
  - `Retry-After` 0 und 31.
  - **Rot-Nachweis:** Gegen eine Kopie mit zurückgebauten Regeln (`Math.min`→`Math.max`, naive 24-h-Tagesgrenze, `Retry-After` ohne 30-s-Untergrenze; ein Erwartungswert gedreht) schlugen alle 10 fehl. Danach wurde wiederhergestellt: 10/10 grün.
- `src/lib/prices/get-prices.edge.test.ts`: 5 Tests.
  - Sperrfenster liefert den abgelaufenen Eintrag.
  - Mitternacht ohne Vortags-„morgen“ bei Ausfall → Fehler.
  - Leere Quelle mit vorhandenem Cache → Cache.
  - Gleichzeitige Aufrufe bei Ausfall → 1 Abruf.
  - Keine hängende laufende Anfrage.
  - **Rot-Nachweis:** Gegen eine Kopie ohne Sperrprüfung, ohne Rollover-Grenze, ohne `today=ok`-Prüfung und ohne geteilte bzw. freigegebene laufende Anfrage schlugen alle 5 fehl. Danach wurde wiederhergestellt: 5/5 grün.
- Die Mutationen liefen in einer temporären Kopie; die echten Quellen wurden nie verändert, weil Lanes gegen den Dev-Server prüften. Lauf: `npx vitest run src/lib/prices/*.edge.test.ts` → 2 Dateien, 15 passed.

## E2E-Tests
- Status: **nicht gelaufen**. Für kritische Abläufe `/e2e-tests` ausführen. Es gibt noch keine Suite (`tests/` fehlt).

## Nicht verifiziert in diesem Lauf

- [!] **AC-5 Interaktion** (Hover, Tippen, Pfeiltasten): kein Browser. In jsdom löst Recharts den Tooltip nicht aus.
- [!] **AC-17** (360 px ohne horizontales Scrollen, Antippen zeigt den Wert): kein Viewport.
- [!] **AC-7, AC-8, AC-11, gerenderte Farben und Label-Platzierung**: keine Browser-Engine, keine berechneten Styles.
- [!] **AC-23 und AC-24 gegen einen echten Energy-Charts-Ausfall in der laufenden App**: nicht provozierbar (externer Dienst, gemeinsames Rate-Limit). Belegt durch Code, Probes und Unit-Tests.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge, mobil): `/qa` läuft ohne Browser, abgedeckt nur durch `/e2e-tests`.
- [!] **Hydration-Abweichung** bei verstellter Geräteuhr bzw. genau an einer Slot-Grenze (`use-live-prices.ts:55`): braucht die DevTools-Konsole.
- [!] **Abgelaufenes Access-Token** (nach rund 1 h): nicht abgewartet. Ersatzweise geprüft mit widerrufenen und gefälschten Tokens.
- [!] **Rate Limiting auf `/api/prices`**: bewusst nicht implementiert.
- [!] **`ui/chart.tsx` byte-gleich mit der shadcn-Registry**: kein Upstream-Abgleich (bräuchte Netzwerk).
- [!] **Security-Header gegen eine Live-URL**: Es gibt kein Deployment (PRD), geprüft wurde gegen den Dev-Server.

## Gefundene Bugs

### BUG-1: Veraltete PROJ-1-Basis – die Login-Sperre zählt auf diesem Branch keine Fehlversuche, Testsuite rot
- **Severity:** High
- **Status:** Open
- **Class:** Ein gestapelter Feature-Branch läuft gegen ein gemeinsames DB-Schema (Strategie `single`), das eine auf `main` angewendete Migration schon weitergezogen hat. Code und Schema passen nicht mehr zusammen, weil der Branch nicht nachgezogen wurde (`design.md` → Technical Decisions, „gestapelt“: „muss PROJ-2 nachgezogen werden“).
- **Sweep:** `for fn in $(grep -rhoE "rpc\('[a-z_]+'" src | sed "s/rpc('//;s/'//" | sort -u); do git grep -l "drop function public.$fn" main -- supabase/migrations; done` → 1 Treffer (`record_login_failure`, aufgerufen in `src/lib/auth/throttle.ts:30`). Stummes Verschlucken: `grep -rn "the failure is lost" src/lib/auth/actions` → 1 Treffer (`login.ts:55`).
- **Steps to Reproduce:**
  1. `npm test` → `rls.integration.test.ts:102` meldet `PGRST202` statt `42501`, `:123` meldet `blocked` = false.
  2. Konto anlegen, mehr als 5× ein falsches Passwort über `/login` senden.
  3. Erwartet: ab dem 6. Versuch „Zu viele Fehlversuche …“ (PROJ-1 AC-10/AC-11).
  4. Tatsächlich: immer „E-Mail-Adresse oder Passwort ist falsch.“. Der Fehlversuch wird nie gezählt, weil `main` die Funktion `record_login_failure` mit `20261006000004_login_throttle_atomic.sql` gelöscht hat und dieser Branch sie noch aufruft.
- **Behebung:** Den Stand von `main` in den Branch holen (Rebase oder Merge). Es gibt nur einen trivialen Konflikt in `features/INDEX.md`. Danach laufen die Suite und der Login-Code wieder gegen dasselbe Schema. Der Code von PROJ-2 selbst ist nicht betroffen.

### BUG-2: `/dashboard` liefert Preisdaten im Body der 307-Weiterleitung, wenn die Sitzung serverseitig widerrufen ist
- **Severity:** Medium. AC-2 ist verletzt, die Daten sind aber öffentliche Börsenpreise ohne Personenbezug, und das Fenster reicht nur bis zum Ablauf des Access-Tokens. Dieselbe Fehlerklasse wird High, sobald `/dashboard` nutzerbezogene Daten zeigt (PROJ-3).
- **Status:** Deferred (Entscheidung in der Nutzer-Review am 2026-10-06; Vorschlag war Open)
- **Class:** Server-Komponenten laden geschützte Daten und verlassen sich allein auf die Auth-Prüfung im Layout. Eine Prüfung nahe an der Datenquelle fehlt. Next rendert Layout und Page parallel (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1356`).
- **Sweep:** `grep -rlE "await (getPrices\(|supabase\s*\.from\()" src/app src/components | grep -v "\.test\." | xargs grep -LE "auth\.(getUser|getClaims)\("` → 1 Treffer (`src/components/prices/price-section.tsx`).
- **Steps to Reproduce:**
  1. Konto anlegen, anmelden und das Cookie sichern.
  2. Das Konto per Admin-API löschen (oder `signOut({ scope: 'global' })`).
  3. `curl -s -D - -o body.txt -b "<alter Cookie>" http://localhost:3001/dashboard`
  4. Erwartet: 307 auf `/login` ohne Preisdaten.
  5. Tatsächlich: 307 auf `/login?next=%2Fdashboard`, aber `grep -o priceEurMwh body.txt | wc -l` → 96 (bzw. 192). Im Body steht der RSC-Payload. Gegenprobe: `/api/prices` mit demselben Cookie → 401.
  - Ursache: `src/proxy.ts:27` prüft nur die Token-Signatur (`getClaims`), `dashboard/layout.tsx:11-12` lehnt per `getUser()` ab, und `price-section.tsx:9` ruft `getPrices()` ohne eigene Prüfung auf.

### BUG-3: Um Mitternacht kann eine Server-Antwort für den alten Tag den lokal vorgerückten neuen Tag überschreiben
- **Severity:** Low (selten, heilt sich zur nächsten Viertelstunde)
- **Status:** Deferred (vom Nutzer bestätigt am 2026-10-06)
- **Class:** Eine Antwort bzw. eine geteilte laufende Anfrage wird ohne Abgleich des Tagesschlüssels übernommen.
- **Sweep:** `grep -n "setPayload(result.payload)\|if (store.inflight) return store.inflight" src/hooks/use-live-prices.ts src/lib/prices/get-prices.ts` → 2 Treffer (`use-live-prices.ts:92`, `get-prices.ts:64`).
- **Steps to Reproduce:**
  1. Panel um 23:59:50 Berlin, heute = 06.10., morgen = 07.10. (ok).
  2. `/api/prices` antwortet noch mit `today.date = 2026-10-06`, z. B. weil eine kurz vor Mitternacht gestartete Anfrage geteilt wird oder die Server-Uhr nachgeht.
  3. 10 s weiterlaufen lassen.
  4. Erwartet: „Heute“ zeigt den 07.10.
  5. Tatsächlich: Alle Kennzahlen zeigen „Kein Preis verfügbar“, alle Balken sind grau, „Morgen“ zeigt den 06.10., und zwar bis 00:15 (AC-21). Beleg: `acceptance/window.probe`.

### BUG-4: Morgen-Preise, die bis zu 60 s vor einer Slot-Grenze erscheinen, kommen erst eine Grenze später
- **Severity:** Low
- **Status:** Deferred (vom Nutzer bestätigt am 2026-10-06)
- **Class:** Die Cache-Dauer des Servers ist nicht auf den Abfragetakt des Clients abgestimmt.
- **Sweep:** `grep -n "NOT_PUBLISHED_TTL_MS" src/lib/prices/price-cache.ts` → 2 Treffer (`:9`, `:65`).
- **Steps to Reproduce:**
  1. Der Server holt um 13:14:30 Berlin, morgen fehlt (der Cache gilt 60 s).
  2. Energy-Charts veröffentlicht um 13:14:45.
  3. Der Client fragt um 13:15:00 und bekommt den Cache: `not_published`.
  4. Erwartet laut AC-20: Die Preise erscheinen spätestens mit dem nächsten Slot-Wechsel.
  5. Tatsächlich: Sie erscheinen erst um 13:30, bis zu rund 16 min nach der Veröffentlichung. Beleg: `acceptance/window.probe`.

### BUG-5: Endzeit der Slot-Beschriftung an Umstellungstagen irreführend
- **Severity:** Low (kosmetisch)
- **Status:** Deferred (vom Nutzer bestätigt am 2026-10-06)
- **Class:** Die Endzeit wird als Wanduhrzeit über die Zeitumstellung geschrieben, ohne Zonenangabe.
- **Sweep:** `acceptance/sweep.probe.test.ts` (alle Tage 2026 durch `slotLabel`, Spannweite ≠ 15 min) → 2 Treffer: `2026-03-29 01:45–03:00` und `2026-10-25 02:45–02:00 MESZ`.
- **Steps to Reproduce:**
  1. Tabelle oder Tooltip am 25.10.2026: Der erste 02:45-Slot heißt „02:45–02:00 MESZ“. Wörtlich heißt das „bis 02:00 MESZ“, also rückwärts; das Ende liegt aber bei 02:00 MEZ.
  2. Am 29.03.2026 heißt der Slot „01:45–03:00“ und liest sich wie 75 Minuten.
  3. Erwartet: eine lesbare Viertelstunde, z. B. „02:45 MESZ–02:00 MEZ“ bzw. „01:45–02:00“ mit Hinweis.
  4. Code: `berlin-time.ts:80-92`. `design.md` legt die Endzeit an diesen Tagen nicht fest.

**Zur Kenntnis, kein Bug in PROJ-2:**
- `Retry-After` hat keine Obergrenze (`price-cache.ts:73`). Ein 429 mit 24 h würde den Abruf 24 h aussetzen. Das kann nur Energy-Charts auslösen.
- `X-Powered-By: Next.js` wird app-weit gesendet (Rahmen von PROJ-1).

## Zusammenfassung
- **Acceptance Criteria:** 21/24 bestanden, 1 mit Bug (AC-2), 1 teilweise (AC-5), 1 nicht verifiziert (AC-17). AC-20 und AC-21 bestehen, Grenzfälle siehe BUG-3 und BUG-4. Edge Cases: 10/10 bestanden.
- **Bugs:** 5 insgesamt (0 Critical, 1 High, 1 Medium, 3 Low). Open: 1 (BUG-1), Deferred: 4 (BUG-2 bis BUG-5, vom Nutzer so entschieden).
- **Security:** 10 Prüfungen: 8 ohne Befund verifiziert, 1 mit Bug (Authentifizierung → BUG-2), 1 NOT VERIFIED (Rate Limiting, bewusst nicht implementiert).
- **Production Ready:** NEIN
- **Empfehlung:** BUG-1 beheben (Stand von `main` in den Branch holen), dann `/qa` erneut ausführen; das wird eine Re-Verifikation in der Breite des Diffs. BUG-2 bis BUG-5 später gesammelt über `/build PROJ-2 deferred`. Vor PROJ-3 sollte BUG-2 behoben sein, weil das Dashboard dann Nutzerdaten zeigt.

> „Production Ready: JA“ hieße nur *keine Critical/High-Bugs*, nicht, dass alles geprüft wurde. Die Punkte unter „Nicht verifiziert“ bleiben offen und brauchen einen Menschen oder `/e2e-tests`.
