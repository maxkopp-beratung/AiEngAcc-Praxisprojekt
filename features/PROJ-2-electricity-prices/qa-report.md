# QA-Testergebnisse – PROJ-2 Strompreise

**Getestet:** 2026-10-06. Zweiter Lauf, eine Re-Verifikation nach dem Fix von BUG-1.
**App-URL:** http://localhost:3001. Das ist der Dev-Server dieses Worktrees. `probe.baseUrl` (3000) zeigt hier auf den Checkout von `main`.
**Tester:** QA Engineer (KI). Drei unabhängige `qa-engineer`-Lanes (Akzeptanz, Security, Regression) ohne Build-Kontext; zusammengeführt vom QA-Owner.
**Umfang:** Re-Verifikation.
- Befehl: `git diff --stat 8c8a5e1..HEAD`.
- Geänderte Produktionsdateien:
  - `src/lib/auth/actions/login.ts`
  - `src/lib/auth/throttle.ts`
  - `supabase/migrations/20261006000004_login_throttle_atomic.sql`
- Dazu kommen 7 Testdateien, die PROJ-1-Doku und `features/INDEX.md`. Das alles kommt aus dem Merge von `main` (Commit `28612a8`).
- Weil der Diff gemeinsam genutzten Code berührt (Auth und eine Migration), lief **die volle Breite**. Alle Häkchen unten stammen aus diesem Lauf.
**Übersprungen:** der Migrations-Round-Trip (`supabase db reset`).
- Grund: Bei der Strategie `single` ist das Supabase-Projekt zugleich die Live-Datenbank (`docs/stacks/backend-supabase.md:51-56`).
- Ersatzbeleg: Die Migration `…000004` ist im Cloud-Projekt angewendet. `begin_login_attempt` existiert, `record_login_failure` liefert `PGRST202`.
**Rohbelege** (`scratchpad/` der QA-Sitzung):
- `suite-run-2.log`, `build-2.log`
- `acceptance-2/` (Probes, `api1.json`)
- `security-2/` (`bf.out`, `sess.out`, `enum.mjs`, `rpc.mjs`, `secrets.mjs`, `forged.txt`)
- `regression-2/` (`reg.out`, `rls-single.log`, `lint.log`, `tsc.log`)
- aus dem ersten Lauf: `suite-run.log`, `acceptance/`, `security/`, `regression/`

> Legende: `[x]` in diesem Lauf verifiziert (mit Beleg) · `[ ] BUG` als fehlerhaft verifiziert · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

**Testkonten (zweiter Lauf):** 15 Wegwerfkonten über die Admin-API: `qa-acc2-…` (1), `qa-sec2-…` (13) und `qa-reg2-…` (1).
- Alle sind gelöscht, Beleg: `getUserById` → 404.
- Ein Teil der Throttle-Zeilen aus dem Brute-Force-Test hatte gefälschte IPs (`198.51.100.x`) und ließ sich nicht freigeben. Diese Zeilen laufen nach 15 Minuten ab.
- Energy-Charts wurde in diesem Lauf genau 1× direkt abgefragt.

## Acceptance Criteria

### Abschnitt & Zugriff
- [x] **AC-1**: `/dashboard` mit Sitzung → 200. Unter `<h1>Übersicht</h1>` steht `<h2>Strompreise</h2>` mit den Tabs „Heute“ (`aria-selected="true"`) und „Morgen“. Beleg: curl in der Akzeptanz-Lane, `price-panel.tsx:30`.
- [ ] **AC-2**: BUG-2 (Deferred).
  - Ohne Sitzung greift der Schutz:
    - `/api/prices` → `401 {"error":"unauthorized"}`.
    - `/dashboard` → 307 auf `/login?next=%2Fdashboard`, 0× `priceEurMwh`, auch mit `RSC: 1`, `_rsc` und `x-middleware-subrequest`.
    - Gefälschte JWTs (`alg:none`, falsche Signatur) kommen ebenfalls nicht durch (`security-2/forged.txt`).
  - **Aber:** Bei serverseitig widerrufener Sitzung liefert `/dashboard` eine 307 mit 192× `priceEurMwh` im Body (Akzeptanz- und Security-Lane).

### Diagramm & Werte
- [x] **AC-3**: 96, 92 und 100 Balken an Normal- und Umstellungstagen, x-Ticks `0,3,…,21`, y-Achse in ct/kWh. Beleg: `acceptance-2/chart.probe`, `price-chart.tsx:98,284`. Darstellung im Browser: siehe Nicht verifiziert.
- [x] **AC-4**: 1 Direktabruf bei Energy-Charts gegen `/api/prices`: 192/192 Slots exakt gleich.
  - Der RSC-Payload im Dashboard-HTML ist ebenfalls 192/192 gleich.
  - `formatCt` gegen eine unabhängige Dezimal-Referenz: 192 echte Werte und 10 000 Zufallswerte, 0 Abweichungen.
  - Die SSR-Kennzahlen um 13:42 passen zur Quelle: „Jetzt 12,4 ct/kWh / 13:30 Uhr“ und „Teuerster ab jetzt 40,6 / 18:45 Uhr“.
- [~] **AC-5**: teilweise geprüft.
  - Der Tooltip-Text ist belegt: „13:15–13:30 · 53,0 ct/kWh“ (`price-chart.tsx:117-119`).
  - Die Tastatur-Ebene `accessibilityLayer` ist vorhanden (`:297`), Tippen fokussiert das Diagramm nicht (`:289`).
  - Hover, Tippen und Pfeiltasten in einer echten Engine: siehe Nicht verifiziert.
- [x] **AC-6**: −5 EUR/MWh → „−0,5 ct/kWh“ mit dem Zeichen U+2212, −0,4 EUR/MWh → „0,0“. Der Balken liegt unter der Nulllinie (y 213,3 gegenüber 181,5). Beleg: `acceptance-2/chart.probe`, `price-chart.tsx:318`.
- [x] **AC-7**: Die Drittel gelten über den ganzen Tag. Probe `[−30,60,0,29.9,30.1]` → günstig, teuer, mittel, mittel, teuer.
  - Fills `--chart-1/2/3`, die Legende benennt die Stufen in Worten.
  - Beleg: `acceptance-2/logic.probe`, `price-chart.tsx:31-35`, SSR-HTML.
- [x] **AC-8**: Die Marker-Ebene trägt „günstigst“ und „teuerst“ mit ArrowDown- bzw. ArrowUp-Icon (`acceptance-2/panel.probe`, `price-chart.tsx:203`).
- [x] **AC-9**: Bei Gleichstand gewinnt der früheste Slot, auch ab `from` (`acceptance-2/logic.probe`, `price-math.ts:52-59`).

### Tab „Heute“
- [x] **AC-10**: Um 13:20 zeigen die Kennzahlen „Jetzt 10,0 / 13:15 · günstig“, „Günstigster ab jetzt 2,0 / 15:00“ und „Teuerster ab jetzt 50,0 / 20:00“. Das vergangene Tagesminimum wird dabei ignoriert. Beleg: `acceptance-2/panel.probe`, live passend zur Quelle (AC-4).
- [x] **AC-11**: Vergangene Balken sind `muted-foreground` mit Deckkraft 0,3, der aktuelle Balken ist `--chart-4` mit „jetzt“ (`acceptance-2/panel.probe`, `price-chart.tsx:84-91`).

### Tab „Morgen“
- [x] **AC-12**: „Ø Tagesdurchschnitt 10,1“ (nachgerechnet 100,99 EUR/MWh), „Günstigster −0,5 / 01:15“, „Teuerster 30,0 / 10:00“. Weder eine „jetzt“-Markierung noch „vorbei“ in der Legende (`acceptance-2/panel.probe`).
- [x] **AC-13**: Der Hinweistext steht wörtlich da, ohne `role=alert`. Eine Quelle ohne Werte für morgen ergibt `not_published` (`acceptance-2/panel.probe` + `service.probe`, `price-states.tsx:16`).

### Hinweise & Zugänglichkeit
- [x] **AC-14**: Der Satz steht wörtlich im SSR-HTML von `/dashboard` (`price-footer.tsx:8`).
- [x] **AC-15**: Die Quellenangabe steht wörtlich im SSR-HTML, mit Links auf energy-charts.info und CC BY 4.0 (`price-footer.tsx:10-22`).
- [x] **AC-16**: Der Button „Als Tabelle anzeigen“ ist im SSR vorhanden. Aufgeklappt zeigt die Tabelle 96 Zeilen inklusive „günstigster Zeitpunkt“ und „teuerster Zeitpunkt“ (`acceptance-2/panel.probe`).
- [!] **AC-17**: nicht verifiziert, weil kein Viewport zur Verfügung stand.
  - Im Code geprüft: `sm:grid-cols-3` (`key-figures.tsx:116`) und `w-full min-w-0` (`price-chart.tsx:283`).
  - Unter 640 px stehen x-Ticks alle 6 Stunden (`:238,280`).

### Zeit & Aktualisierung
- [x] **AC-18**: Die Probes laufen identisch unter `Europe/Berlin`, `America/Los_Angeles` und `Pacific/Kiritimati`. Beispiel: 2026-10-06T22:30Z gilt überall als 2026-10-07 (`acceptance-2/logic.probe` + `panel.probe`).
- [x] **AC-19**: Mit Fake-Timer springt „Jetzt“ von 13:14:50 auf 13:15, ohne Reload, und die Werte „ab jetzt“ werden neu berechnet (`acceptance-2/panel.probe`, `use-live-prices.ts:138-148`).
- [x] **AC-20**: Fehlt „morgen“, holt die App die Preise an der nächsten Grenze mit 1 Fetch nach; der Tab bleibt gewählt.
  - Der Server fragt vor 12:00 nicht erneut. Ab 12:00 fragt er nach 60 s neu, nach 59 s noch nicht (`acceptance-2/service.probe`).
  - Grenzfall siehe BUG-4.
- [x] **AC-21**: Um 23:50 und danach über Mitternacht zeigt „Heute“ sofort den neuen Tag, „Morgen“ dann den Leerzustand (`acceptance-2/panel.probe`). Grenzfall siehe BUG-3.

### Zustände
- [x] **AC-22**: Der SSR-Stream liefert zuerst `<section aria-busy="true">` mit Skeletons für Kennzahlen und Diagramm, danach den Inhalt. Kein Spinner. Beleg: `price-section.tsx:17`.
- [x] **AC-23**:
  - Der Alert-Text stimmt wörtlich, und es erscheinen keine Tabs.
  - Während der Anfrage ist „Erneut versuchen“ deaktiviert.
  - Ein Ausfall ohne Cache ergibt `error`, danach gilt eine 30-s-Sperre.
  - Die Zeitüberschreitung liegt bei 8 s (`energy-charts.ts:9,58`).
  - Das Dashboard bleibt bedienbar: Der Inhalt außerhalb des Abschnitts (Byte 7753) steht vor dem Preis-Inhalt (Byte 8738).
  - Beleg: `acceptance-2/panel.probe` + `service.probe`.
  - Live-Ausfall: siehe Nicht verifiziert.
- [x] **AC-24**: Ist ein Tag im Cache und die Quelle 61 s später nicht erreichbar, bleibt `today=ok`, ohne Warnfeld (`acceptance-2/service.probe`, `get-prices.ts:79-83`, `get-prices.edge.test.ts`).

## Edge Cases

- [x] **EC-1**: 2026-03-29 und 2027-03-28 haben 92 Slots, kein Label beginnt mit „02:“, das Diagramm zeigt 92 Balken (`acceptance-2/logic.probe` + `chart.probe`). Zur Beschriftung siehe BUG-5.
- [x] **EC-2**: 2026-10-25 und 2027-10-31 haben 100 Slots, je 4× „MESZ“ und 4× „MEZ“ in Tooltip und Tabelle, 100 Balken. Zur Beschriftung siehe BUG-5, zu den Kennzahlen siehe BUG-6.
- [x] **EC-3**: Um 23:50 zeigen alle drei Kennzahlen „10,5 / 23:45 Uhr“, ohne Fehler (`acceptance-2/panel.probe`).
- [x] **EC-4**: Fehlt der aktuelle Slot, zeigt „Jetzt“ „Kein Preis verfügbar“. Die Tabelle zeigt „keine Daten“, das Diagramm keinen Balken, und Ø, Stufen und Extrema ignorieren `null` (`acceptance-2/panel.probe`, `chart.probe`, `logic.probe`).
- [x] **EC-5**: Liefert die Quelle `ok`, aber leer, wird `today=error` gesetzt (`acceptance-2/service.probe`, `get-prices.ts:18,27`). Mit Cache bleiben die Preise stehen (`get-prices.edge.test.ts`).
- [x] **EC-6**: Haben alle Slots denselben Preis, sind alle Balken „mittel“, und Günstigster und Teuerster zeigen denselben frühesten Slot (`acceptance-2/logic.probe` + `panel.probe`).
- [x] **EC-7**: Wird die Uhr ohne Timer vorgestellt, springt die Anzeige bei `visibilitychange` sofort auf den aktuellen Slot (`acceptance-2/panel.probe`, `use-live-prices.ts:151-157`).
- [x] **EC-8**: Liefert der Refetch an der Slot-Grenze 503, erscheint kein Alert und die bisherigen Daten bleiben. Fehlen die Daten nach einem Tageswechsel, erscheint der Fehlerzustand (`acceptance-2/panel.probe`, `use-live-prices.test.ts:143`).
- [x] **EC-9**: Die zugesicherte Garantie steht im Code: eine gemeinsame laufende Anfrage (`get-prices.ts:64,69-90`) und ein prozessweiter Speicher (`price-cache.ts:29-36`).
  - Probe: 50 gleichzeitige Aufrufe ergeben 1 Fetch.
  - Live: 20 bzw. 80 Aufrufe von `/api/prices` liefern alle dasselbe `generatedAt`.
- [x] **EC-10**: Wechsel Heute → Morgen → Heute löst 0 Fetches aus (`acceptance-2/panel.probe`).

## Security-Audit

- [ ] **Authentifizierung**: BUG-2 (Deferred, reproduziert weiterhin). Alles andere hält:
  - Ohne, mit kaputtem oder gefälschtem Cookie gibt `/api/prices` 401 und `/dashboard` 307 ohne Preise. Das gilt für alle getesteten Varianten: `RSC`, `_rsc`, Prefetch, `x-middleware-subrequest` und die Pfadvarianten `/api/Prices`, `/api/prices/`, `/dashboard.rsc`.
  - OPTIONS liefert 204 ohne CORS-Header.
  - Beleg: `route.ts:11-15`, `dashboard/layout.tsx:11-13`.
- [x] **Autorisierung**: Zwei Sitzungen erhalten byte-gleiche `/api/prices`-Antworten; die Preise sind nicht nutzerbezogen.
  - Die PROJ-1-RLS auf derselben Seite hält: X liest 0 fremde `profiles`-Zeilen, und ein Update auf Y ändert 0 Zeilen.
  - Beleg: `security-2/sess.out`.
- [x] **Eingabevalidierung und Injection**: Folgende Eingaben laufen ins Leere, der Body ist jeweils identisch zum Basis-Body:
  - `?bzn=FR`, SQL-Payload, `?url=http://169.254.169.254/…`, `__proto__`, `<script>`
  - der Header `x-forwarded-host: evil.example`
  - Die ausgehende URL besteht nur aus einer Konstante und berechneten Werten (`energy-charts.ts:7,35-38`), die Antwort wird per Zod geprüft (`:25-32`).
  - Das einzige `dangerouslySetInnerHTML` ist `ui/chart.tsx:81` mit statischer Konfiguration und rendert 0× `<style`.
- [!] **Rate Limiting auf `/api/prices`**: nicht implementiert. Das ist bewusst so entschieden (`design.md` → „Kein eigenes Rate-Limit auf /api/prices“).
  - 80 Anfragen ergeben 80× 200, `generatedAt` bleibt unverändert: Der Cache schützt Energy-Charts.
- [x] **Brute Force** (Login-Pfad, durch den Merge geändert):
  - Pro E-Mail, nacheinander: #1–#5 „E-Mail-Adresse oder Passwort ist falsch.“, **ab #6 bis #22 „Zu viele Fehlversuche …“**. Danach ist auch das korrekte Passwort gesperrt, auch von einer anderen IP aus.
  - Parallel: 12 gleichzeitige Versuche → 5 invalid / 7 gesperrt; 30 gleichzeitige → 5 / 25. Die Atomarität sichert `pg_advisory_xact_lock` (`…000004_login_throttle_atomic.sql:21`).
  - Pro IP: Nach 20 Fehlversuchen auf 5 Konten wird **#21** gesperrt.
  - Beleg: `security-2/bf.out`.
  - Einschränkung: Wechselnde `X-Forwarded-For`-Werte umgehen die IP-Sperre. Das ist der bekannte PROJ-1 BUG-2 (Deferred), siehe Hinweise.
- [x] **Keine Account-Enumeration (Meldung)**: Bekannte Adresse mit falschem Passwort und unbekannte Adresse liefern identisch „E-Mail-Adresse oder Passwort ist falsch.“ (HTTP 200). Auch eine unbekannte Adresse wird nach 5 Versuchen gesperrt (`security-2/enum.mjs`). Timing: siehe Hinweise.
- [x] **Keine Zugangsdaten in der URL**: Alle 8 `<form>` im Code nutzen eine Server Action. Gerendert erscheint `method="POST"` auf `/login`, `/signup`, `/forgot-password` und `/auth/link-invalid`. PROJ-2 selbst hat keine Formulare.
- [x] **Keine Secrets im Client-Bundle**:
  - Durchsucht wurden `.next/static` aus dem Prod-Build (24 Dateien) und 20 ausgelieferte Dev-Chunks (6,8 MB).
  - Ergebnis: 0× Wert und Name von `SUPABASE_SERVICE_ROLE_KEY`, 0× Server-Bezeichner, 0× `api.energy-charts.info`.
  - Die Git-Historie enthält keine Schlüsselwerte.
  - `server-only` steht in allen Server-Modulen (`security-2/secrets.mjs`).
- [x] **Sensible Daten und Header**: Der Body von `/api/prices` enthält nur `generatedAt`, `today` und `tomorrow` (Slots: `start`, `priceEurMwh`), keine E-Mail, keine IDs, keine Stacktraces.
  - Header: `cache-control: private, no-store`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS.
- [x] **Preisdaten auf öffentlichen Seiten**: 9 öffentliche Routen, jeweils mit und ohne `RSC: 1`, enthalten 0× `priceEurMwh`.
- [!] **Massen-Registrierung**: nicht abgefeuert, weil jede Registrierung eine echte Mail verschicken würde (gemeinsames Limit 30/h). Das Risiko ist in PROJ-1 `spec.md:128` bewusst akzeptiert.

## Regression

- [x] **Testsuite**: `suite-run-2.log` meldet **28 Dateien, 281 passed, 0 failed**. Die zwei früher roten Tests stehen jetzt auf ✓ (`regression-2/rls-single.log`, 12/12).
- [x] **Production-Build**: `build-2.log` endet mit Exit 0, alle Routen sind gebaut (`ƒ /api/prices`, `ƒ /dashboard`, Proxy).
- [x] **Lint und Typen**: `npm run lint` und `npx tsc --noEmit` enden jeweils mit Exit 0 (`regression-2/lint.log`, `tsc.log`).
- [x] **Merge sauber**:
  - `main` ist Vorfahre von HEAD.
  - `git diff main HEAD --stat -- src/lib src/proxy.ts supabase` zeigt nur `src/lib/prices/*`.
  - Es gibt keine Konfliktmarker (`git grep '^<<<<<<<'` → 0).
  - In INDEX steht PROJ-1 auf Approved und PROJ-2 auf In Review.
- [x] **PROJ-1 – Fehlversuche werden wieder gezählt**: Nach 1 App-Fehlversuch plus 4 Reservierungen meldet `login_throttle_status` `blocked:true`. Die Zeile wurde danach wieder freigegeben (`regression-2/reg.out`).
- [x] **PROJ-1 – Kernabläufe**: Ein korrekter Login liefert 303 auf `/dashboard`. `/` und `/dashboard` leiten ohne Sitzung auf `/login`, mit Sitzung leiten `/`, `/login` und `/signup` auf `/dashboard`. Logout liefert `x-action-redirect: /login`, danach `/dashboard` → 307. Die öffentlichen Seiten rendern.
- [x] **PROJ-2 nach dem Merge intakt**: Das Dashboard zeigt den Abschnitt „Strompreise“ mit genau 1× `<header>`, 0× `<nav>` und 0× `<aside>`. `/api/prices` antwortet mit Sitzung 200 und ohne Sitzung 401.
- [!] **Features mit Status Deployed**: Es gibt keine. Stattdessen wurde das verwandte Feature PROJ-1 geprüft.

## Unit-Tests (von `/qa` ergänzt, im ersten Lauf)

- `src/lib/prices/price-cache.edge.test.ts` (10 Tests) und `src/lib/prices/get-prices.edge.test.ts` (5 Tests) decken Grenzfälle in Zwischenspeicher und Preis-Dienst ab.
- Rot-Nachweis: Gegen Kopien mit zurückgebauten Schutzregeln schlugen alle 15 Tests fehl. Gegen den echten Code waren danach alle 15 grün. Die Details stehen in Commit `8c8a5e1`.
- Die Tests sind Teil der 281 im aktuellen Suite-Lauf und dort grün.

## E2E-Tests
- Status: **nicht gelaufen** (für kritische Abläufe `/e2e-tests` ausführen). Es gibt noch keine Suite.

## Nicht verifiziert in diesem Lauf

- [!] **AC-5 Interaktion** (Hover, Tippen, Pfeiltasten): kein Browser. In jsdom bleibt der Recharts-Tooltip leer.
- [!] **AC-17** (360 px ohne horizontales Scrollen, Antippen): kein Viewport.
- [!] **AC-3, AC-7, AC-8, AC-11 optisch** (y-Ticks, Platzierung der Labels, Farbwirkung): keine Browser-Engine.
- [!] **AC-23/AC-24 gegen einen echten Energy-Charts-Ausfall in der laufenden App**: nicht provozierbar. Belegt durch Probes, Unit-Tests und Code.
- [!] **AC-19 bis AC-21 und EC-7 im echten Browser** (Timer-Drosselung im Hintergrund, Standby): nur mit Fake-Timern geprüft.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge, mobil): `/qa` läuft ohne Browser; das deckt nur `/e2e-tests` ab.
- [!] **Hydration-Abweichung** genau an einer Slot-Grenze (`use-live-prices.ts:55`): braucht die DevTools-Konsole.
- [!] **Rate Limiting auf `/api/prices`**: bewusst nicht implementiert.
- [!] **Massen-Registrierung**: nicht abgefeuert (echte Mails), siehe Security.
- [!] **Fail-closed des Throttles bei DB-Ausfall**: nur im Code belegt (`login.ts:37-39`).
- [!] **Migrations-Round-Trip**: übersprungen, weil `single` die Live-Datenbank ist, siehe Kopf.
- [!] **`private.cleanup_auth_data()` und Cron-Job in der Cloud-DB**: Das Schema `private` ist über die Data API nicht erreichbar.
- [!] **Security-Header gegen eine Live-URL**: Es gibt kein Deployment (PRD), geprüft wurde nur gegen den Dev-Server.

## Gefundene Bugs

### BUG-1: Veraltete PROJ-1-Basis – die Login-Sperre zählte auf diesem Branch keine Fehlversuche, Testsuite rot
- **Severity:** High
- **Status:** Fixed (2026-10-06, re-verified)
- **Class:** Ein gestapelter Feature-Branch lief gegen ein gemeinsames DB-Schema (Strategie `single`), das eine auf `main` angewendete Migration schon weitergezogen hatte.
- **Sweep:** `for fn in $(grep -rhoE "rpc\('[a-z_]+'" src | sed "s/rpc('//;s/'//" | sort -u); do git grep -l "drop function public.$fn" HEAD -- supabase/migrations; done`. Im ersten Lauf 1 Treffer, **jetzt 0 Treffer**. `grep -rn "the failure is lost" src/lib/auth/actions` → jetzt 0 Treffer.
- **Fix:** `main` per Merge in den Branch geholt (Commit `28612a8`).
- **Re-Verifikation:**
  - Testsuite 281/281 grün.
  - Pro E-Mail gesperrt ab dem 6. Versuch, pro IP ab dem 21., parallel 5/12 bzw. 5/30.
  - Fehlversuche über die App werden gezählt.

### BUG-2: `/dashboard` liefert Preisdaten im Body der 307-Weiterleitung, wenn die Sitzung serverseitig widerrufen ist
- **Severity:** Medium. AC-2 ist verletzt; die Daten sind aber öffentliche Börsenpreise ohne Personenbezug. Dieselbe Fehlerklasse wird High, sobald `/dashboard` nutzerbezogene Daten zeigt (PROJ-3).
- **Status:** Deferred. Entschieden in der Nutzer-Review am 2026-10-06, der Vorschlag war Open. Reproduziert im zweiten Lauf weiterhin (192× `priceEurMwh`).
- **Class:** Server-Komponenten laden geschützte Daten und verlassen sich allein auf die Auth-Prüfung im Layout. Eine Prüfung nahe an der Datenquelle fehlt. Next rendert Layout und Page parallel (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1356`).
- **Sweep:** `grep -rlE "await (getPrices\(|supabase\s*\.from\()" src/app src/components | grep -v "\.test\." | xargs grep -LE "auth\.(getUser|getClaims)\("` → 1 Treffer (`src/components/prices/price-section.tsx`).
- **Steps to Reproduce:**
  1. Konto anlegen, anmelden und das Cookie sichern.
  2. Das Konto per Admin-API löschen oder `signOut(token, 'global')` ausführen.
  3. `curl -s -D - -o body.txt -b "<alter Cookie>" http://localhost:3001/dashboard`
  4. Erwartet: 307 auf `/login` ohne Preisdaten.
  5. Tatsächlich: 307, aber `grep -o priceEurMwh body.txt | wc -l` → 192. Mit demselben Cookie liefert `/api/prices` 401.
  - Ursache:
    - `src/proxy.ts:27` prüft nur die Signatur (`getClaims`).
    - `dashboard/layout.tsx:11-12` lehnt per `getUser()` ab.
    - `price-section.tsx:9` ruft `getPrices()` ohne eigene Prüfung auf.

### BUG-3: Um Mitternacht kann eine Server-Antwort für den alten Tag den lokal vorgerückten neuen Tag überschreiben
- **Severity:** Low (selten, heilt sich zur nächsten Viertelstunde)
- **Status:** Deferred (in der Nutzer-Review am 2026-10-06 bestätigt). Reproduziert im zweiten Lauf weiterhin (`acceptance-2/bug3.probe`).
- **Class:** Eine Antwort bzw. eine geteilte laufende Anfrage wird übernommen, ohne den Tagesschlüssel abzugleichen.
- **Sweep:** `grep -n "setPayload(result.payload)\|if (store.inflight) return store.inflight" src/hooks/use-live-prices.ts src/lib/prices/get-prices.ts` → 2 Treffer (`use-live-prices.ts:92`, `get-prices.ts:64`).
- **Steps to Reproduce:**
  1. Panel um 23:59:50 Berlin: heute = 06.10., morgen = 07.10. (ok).
  2. `/api/prices` antwortet noch mit `today.date = 2026-10-06`. Ursache: eine kurz vor Mitternacht gestartete, geteilte Anfrage, oder die Server-Uhr geht nach.
  3. Erwartet: „Heute“ zeigt den 07.10.
  4. Tatsächlich: Bis 00:15 zeigen alle Kennzahlen „Kein Preis verfügbar“, alle Balken sind grau, und „Morgen“ zeigt den 06.10.

### BUG-4: Morgen-Preise, die bis zu 60 s vor einer Slot-Grenze erscheinen, kommen erst eine Grenze später
- **Severity:** Low
- **Status:** Deferred (in der Nutzer-Review am 2026-10-06 bestätigt). Reproduziert im zweiten Lauf weiterhin (`acceptance-2/service.probe`).
- **Class:** Die Cache-Dauer des Servers ist nicht auf den Abfragetakt des Clients abgestimmt.
- **Sweep:** `grep -n "NOT_PUBLISHED_TTL_MS" src/lib/prices/price-cache.ts` → 2 Treffer (`:9`, `:65`).
- **Steps to Reproduce:**
  1. Der Server holt um 13:14:30 Berlin, „morgen“ fehlt; der Cache gilt 60 s.
  2. Energy-Charts veröffentlicht um 13:14:45.
  3. Der Client fragt um 13:15:00 und bekommt aus dem Cache `not_published`.
  4. Erwartet laut AC-20: spätestens mit dem nächsten Slot-Wechsel.
  5. Tatsächlich: erst um 13:30, also bis zu rund 16 min nach der Veröffentlichung.

### BUG-5: Endzeit der Slot-Beschriftung an Umstellungstagen irreführend
- **Severity:** Low (kosmetisch)
- **Status:** Deferred (in der Nutzer-Review am 2026-10-06 bestätigt). Reproduziert im zweiten Lauf weiterhin (`acceptance-2/logic.probe`).
- **Class:** Die Endzeit wird als Wanduhrzeit über die Zeitumstellung geschrieben, ohne Zonenangabe.
- **Sweep:** Probe mit allen Tagen 2026 durch `slotLabel`, Suche nach Spannweite ≠ 15 min → 2 Treffer: `2026-03-29 01:45–03:00` und `2026-10-25 02:45–02:00 MESZ`.
- **Steps to Reproduce:**
  1. Am 25.10.2026 heißt der erste 02:45-Slot „02:45–02:00 MESZ“. Gemeint ist aber 02:00 MEZ.
  2. Am 29.03.2026 steht „01:45–03:00“, das liest sich wie 75 Minuten.
  3. Code: `berlin-time.ts:80-92`. `design.md` legt die Endzeit an diesen Tagen nicht fest.

### BUG-6: Kennzahlen-Uhrzeit am 100-Slot-Tag mehrdeutig – zwei verschiedene Slots heißen beide „02:15 Uhr“
- **Severity:** Low
- **Status:** Deferred. Neuer, nicht blockierender Befund der Re-Verifikation; laut Regel startet er keine weitere Runde.
- **Class:** Die Startzeit wird in der doppelten Stunde ohne Zonenzusatz beschriftet. EC-2 verlangt „MESZ“ und „MEZ“ nur für Tooltip und Tabelle; für die Kennzahlen ist es nicht geregelt. PROJ-3 erbt die Funktion.
- **Sweep:** `grep -rn "startTimeLabel(" src | grep -v "\.test\."` → 3 Treffer (`key-figures.tsx:69`, `key-figures.tsx:93`, Definition `berlin-time.ts:95`).
- **Steps to Reproduce:**
  1. Kennzahlen für den 25.10.2026: Der günstigste Slot ist 01:15Z (02:15 MEZ, 0,5 ct), der teuerste 00:15Z (02:15 MESZ, 90,0 ct).
  2. Erwartet: Beide Uhrzeiten sind unterscheidbar, z. B. „02:15 Uhr MEZ“ und „02:15 Uhr MESZ“.
  3. Tatsächlich: „0,5 ct/kWh · 02:15 Uhr“ und „90,0 ct/kWh · 02:15 Uhr“ (`acceptance-2/dstfig.probe`).

**Hinweise, kein Bug in PROJ-2** (betreffen PROJ-1 bzw. den App-Rahmen und gehen dort über `/refine PROJ-1` oder den nächsten PROJ-1-Lauf):
- **IP-Sperre per `X-Forwarded-For` umgehbar.** Das ist der bekannte PROJ-1 BUG-2 (Deferred), weiterhin reproduzierbar. Ohne vorgeschalteten Proxy kann der Client den Header frei setzen (`src/lib/auth/request-meta.ts:12-14`).
- **Möglicher Timing-Seitenkanal beim Login.** Gemessen: bekannte Adresse Median ~190 ms, unbekannte ~116 ms, bei n=5 je Fall verrauscht. `security.md` verlangt vergleichbare Antwortzeiten. Das sollte im nächsten PROJ-1-QA-Lauf mit größerer Stichprobe geprüft werden.
- **Source Maps mit Server-Action-Quelltext.** Der Dev-Server liefert sie aus, ohne Secret-Werte; der Prod-Build enthält sie nicht. Relevant, weil die App laut PRD nur per `npm run dev` läuft.
- `X-Powered-By: Next.js` wird app-weit gesendet.
- `Retry-After` hat keine Obergrenze (`price-cache.ts:73`). Auslösen kann das nur Energy-Charts.
- Hat „morgen“ nach der Veröffentlichung Lücken, fragt der Client nicht nach (`use-live-prices.ts:129`). Das deckt sich mit `design.md` → Nachladen und ist kein Vertragsbruch.

## Zusammenfassung
- **Acceptance Criteria:** 21/24 bestanden, 1 mit Bug (AC-2 → BUG-2, Deferred), 1 teilweise (AC-5), 1 nicht verifiziert (AC-17). Edge Cases: 10/10 bestanden.
- **Bugs:** 6 insgesamt (0 Critical, 1 High, 1 Medium, 4 Low).
  - Fixed: 1 (BUG-1).
  - Open: 0.
  - Deferred: 5 (BUG-2 bis BUG-6).
- **Security:** 11 Prüfungen: 8 ohne Befund verifiziert, 1 mit Bug (Authentifizierung → BUG-2, Deferred), 2 NOT VERIFIED (Rate Limiting auf `/api/prices` ist bewusst nicht implementiert; Massen-Registrierung nicht abgefeuert).
- **Production Ready:** JA. Es gibt keinen offenen Critical- oder High-Bug, und die Laufzeit-Kriterien wurden gegen die laufende App geprüft.
- **Empfehlung:** freigeben (Approved). Die Deferred-Bugs gesammelt über `/build PROJ-2 deferred` beheben. **BUG-2 vor PROJ-3**, weil das Dashboard dann Nutzerdaten zeigt.

> „Production Ready: JA“ heißt nur *keine Critical/High-Bugs*, nicht, dass alles geprüft wurde. Die Punkte unter „Nicht verifiziert in diesem Lauf“ (vor allem Darstellung auf dem Handy, Interaktion mit dem Diagramm, Cross-Browser) bleiben offen und brauchen einen Menschen oder `/e2e-tests`.
