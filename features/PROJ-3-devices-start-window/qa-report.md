# QA-Testergebnisse – PROJ-3 Geräte & Startfenster

**Getestet:** 2026-10-06 (erster Lauf)
**App-URL:** http://localhost:3001. Das ist der Dev-Server dieses Worktrees (`AIEngAcc-Praxisprojekt-PROJ-2`, Branch `feat/PROJ-3-devices-start-window`). `probe.baseUrl` (3000) zeigt auf den Checkout von `main` ohne dieses Feature.
**Tester:** QA Engineer (KI). Drei unabhängige `qa-engineer`-Lanes ohne Build-Kontext: Akzeptanz (Step 2), Security (Step 3), Regression (Step 4 + 5). Der QA-Owner hat sie zusammengeführt und die Unit-Tests geschrieben (Step 6).
**Umfang:** `full`, erster `/qa`-Lauf für PROJ-3.

**Rohbelege** (`scratchpad/` der QA-Sitzung):
- `suite-run.log`, `build.log`
- `acceptance/` mit Gegenproben `probe/*.probe.test.ts` und `run1.log` bis `run4-tz.log`
- `security/` (`act.sh`, `authz-actions.txt`, `dataapi.txt`, `revoked-session.txt`, `csrf.txt`, `injection-actions.txt`, `limit-*.txt`, `dup-dataapi.txt`, `ac27.txt`, `secrets-scan.txt`, `cleanup.txt`)
- `regression/` (`reg.out`, `reg2.out`, `dashboard-A.html`, `datenschutz.html`, `lint.log`, `tsc.log`)

**Testkonten:**
- Security-Lane: 3 Wegwerfkonten `qa-p3-sec-*`. Eines wurde über die App-Action `deleteAccount` gelöscht, die anderen über die Admin-API. Danach liefert `listUsers` 0 Treffer.
- Regressions-Lane: 6 Konten `qa-p3-reg-*`. Eines wurde über `deleteAccount` gelöscht, die anderen über die Admin-API. Danach bleiben 0.
- Akzeptanz-Lane: keine Konten. Das Berechtigungssystem hat ihr das Anlegen über die Admin-API verweigert. Ihre Prüfungen stützen sich auf Code, Tests und eigene Gegenproben. Die Laufzeitprüfungen mit Sitzung stammen aus der Security- und der Regressions-Lane.

> Legende: `[x]` in diesem Lauf verifiziert (mit Beleg) · `[ ] BUG` als fehlerhaft verifiziert · `[!] NOT VERIFIED` nicht prüfbar (mit Grund)

## Automatisierte Tests

- [x] **Suite** `npm test`: 40 Dateien, 478 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen (`suite-run.log`).
- [x] **Integrationstest gegen echtes Supabase** `src/lib/supabase/devices.integration.test.ts`: 9/9 bestanden, nicht übersprungen (Einzellauf `npx vitest run src/lib/supabase/devices.integration.test.ts --reporter=verbose`).
- [x] **Lint** `npm run lint`: Exit 0 (`regression/lint.log`).
- [x] **Typecheck** `npx tsc --noEmit`: Exit 0 (`regression/tsc.log`).
- [x] **Production-Build** `npm run build`: Exit 0, alle 15 Seiten erzeugt (`build.log`). In der Regressions-Lane hatte das Berechtigungssystem den Build verweigert. Der QA-Owner hat ihn nach Freigabe durch den Nutzer ausgeführt, der Dev-Server auf 3001 lief danach weiter (`/datenschutz` → 200).
  - Neuer Client-Build: `grep -rlE "SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_" .next/static` → 0 Treffer.
- **E2E:** `tests/` existiert nicht, deshalb nicht ausgeführt.

### Neue Unit-Tests aus diesem Lauf (Step 6)
- [x] `src/lib/devices/queries.test.ts`: 6 Tests für `listDevices`. Sie prüfen die Sortierung `created_at` und `id` aufsteigend, die Abbildung der Zeilen, die leere Liste, DB-Fehler → `null`, Exception → `null` und `data: null` → `null`.
  - **Rot-Nachweis:** Mutanten (absteigende Sortierung, Fehler → `[]`, falsche Feldabbildung, `throw` statt `null`) ließen 5/6 Tests scheitern. Der Leere-Liste-Test scheiterte mit einem eigenen Mutanten (leer → `null`). Danach wieder 6/6 grün.
- [x] `src/lib/devices/start-window.oracle.test.ts`: `recommendStartWindow` gegen eine naive Brute-Force-Referenz. Getestet werden 5 Tagespaare (Normaltag, 100-Slot- und 92-Slot-Tag, je der Vortag) mit je 400 Zufallsfällen und festem Seed. Sie decken Lücken, Gleichstände, negative Preise, morgen ja/nein, heute `error` und den letzten Slot ab.
  - **Rot-Nachweis:** 4 Mutanten wurden je einzeln eingespielt: Gleichstand → spätestes Fenster, Off-by-one bei EC-5, Lücke beim Verschieben nicht abgezogen, `startsNow`/`tomorrowMissing` verfälscht. Jeder Mutant ließ 4–5 von 5 Tests scheitern. Die unveränderte Kopie blieb 5/5 grün.

## Acceptance Criteria

### Abschnitt & Zugriff
- [x] **AC-1**: Das Dashboard-HTML mit Sitzung enthält den Abschnitt „Meine Geräte“ nach „Strompreise“. Der Suspense-Platzhalter der Preise steht vor „Meine Geräte“, der alte Platzhaltersatz ist weg (`regression/dashboard-A.html`). Code: `src/app/dashboard/page.tsx:16-19`, `devices-panel.tsx:129-137`. Test: `devices-panel.test.tsx:72`.
- [x] **AC-2**: Mehrfach belegt:
  - **Ohne Sitzung:** `/dashboard` → 307 `/login?next=%2Fdashboard`, auch mit `RSC: 1`. Server Actions ohne Cookie → 307 bzw. kein Ergebnis auf öffentlichen Routen.
  - **Mit widerrufener Sitzung:** Create, update und delete liefern `unauthorized` (`security/revoked-session.txt`, `actions.ts:28-34`).
  - **Über die Server Actions:** A greift auf Bs Gerät zu. Update und delete liefern `not_found`, Bs Gerät bleibt unverändert, in As HTML steht nichts von B (`security/authz-actions.txt`).
  - **Direkt über die Data API:** A sieht nur eigene Zeilen. PATCH und DELETE auf Bs Zeile ändern nichts. INSERT mit fremder `user_id` und Upsert werden mit 403 abgelehnt, anon bekommt 401 (`security/dataapi.txt`).
  - **Datenschicht:** RLS und Spaltenrechte in `supabase/migrations/20261006000005_devices.sql:60-83`.

### Leerzustand
- [x] **AC-3**: Text wörtlich in `devices-states.tsx:32`, die drei Vorschläge in `:11-15`, formatiert in `:46`. Test: `devices-states.test.tsx:19,44,56`.
- [x] **AC-4**: Ein Vorschlag öffnet den Dialog vorbelegt (`devices-panel.tsx:76,143`, `device-dialog.tsx:48-51`). Angelegt wird erst beim Speichern. Tests: `devices-panel.test.tsx:109`, `device-dialog.test.tsx:63`.

### Anlegen
- [x] **AC-5**: Zur Laufzeit legt `createDevice` mit Sitzung an, die Antwort ist `ok` mit der aktuellen Liste (`security/limit-ratelimit-actions.txt`). Danach Liste setzen, Dialog schließen und Toast „Gerät gespeichert“ (`devices-panel.tsx:89-95`). Test: `devices-panel.test.tsx:147`.
- [x] **AC-6**: Leer, nur Leerzeichen, 41 Zeichen und NBSP am Rand werden serverseitig abgelehnt: die Action mit Feldmeldung, die Data API mit `devices_name_check` (`security/injection-actions.txt`, `schemas.ts:16-18,33-44`, Migration `:14-18`). Siehe **BUG-1** (unsichtbare Zeichen).
- [x] **AC-7**: Die Action lehnt `"60"`, `60.5`, `735` und `1e309` mit der Bereichsmeldung ab. Die Data API lehnt 0, 735, 20 und −15 mit `devices_duration_check` ab (`security/`). Code: `schemas.ts:25-30,47-50`, Migration `:20-23`.
- [x] **AC-8**: `WASCHMASCHINE` gegen vorhandenes `Waschmaschine` → 409 `23505`. In der App wird daraus `duplicate_name` mit Feldmeldung (`actions.ts:17,49`, `devices-panel.tsx:98-99`). Integrationstest grün. Siehe **BUG-2** (NFC nur in der App).
- [x] **AC-9**: 25 Anlegen-Aufrufe über die Action ergeben ab dem 21. Gerät `limit_reached`, Endstand genau 20. Ein Sammel-Insert von 21 Zeilen über die Data API wird ganz abgelehnt (`P0001`). Belege: `security/limit-ratelimit-actions.txt`, `limit-dataapi.txt`. In der Oberfläche ist der Button ab 20 deaktiviert und der Hinweis erscheint (`devices-panel.tsx:74,133`, `devices-states.tsx:55-61`).

### Liste, Bearbeiten & Löschen
- [x] **AC-10**: Sortierung `created_at`, dann `id` (`queries.ts:14-15`), abgesichert durch den neuen `queries.test.ts`. Die Karte zeigt Name, „H:MM h“ und die Empfehlung (`device-card.tsx:39-40,63`). `created_at` ist nicht setzbar (403, `security/dataapi.txt`).
- [x] **AC-11**: Derselbe Dialog im Modus Bearbeiten, gleiche Validierung (`actions.ts:66-67`), Neuberechnung per `useMemo` (`devices-panel.tsx:50-61,89`). Test: `devices-panel.test.tsx`.
- [x] **AC-12**: Rückfrage „„[Name]“ löschen?“ (`delete-device-dialog.tsx:57`), Toast „Gerät gelöscht“ (`devices-panel.tsx:121`), Abbrechen ändert nichts (`devices-states.test.tsx:133`). Endgültiges DELETE (`actions.ts:97`), zur Laufzeit nur für eigene Geräte (siehe AC-2).

### Empfehlung
- [x] **AC-13**: Zwei unabhängige Brute-Force-Gegenproben kommen auf dasselbe Ergebnis:
  - Akzeptanz-Lane: 3000/3000 Fälle (`acceptance/probe/run1.log`).
  - Owner: `start-window.oracle.test.ts`, 2000 Fälle, 5/5 grün.
- [x] **AC-14**: Ganzzahlige Summen mit strikt `<` (`start-window.ts:33,49`), dadurch gewinnt bei Gleichstand das früheste Fenster. Bestätigt durch beide Gegenproben und `start-window.test.ts:67,117`.
- [x] **AC-15**: Die Gegenprobe ergibt z. B. „Starte um 23:00 Uhr · fertig morgen um 01:30 Uhr · Ø 0,1 ct/kWh“ und „Starte morgen um 02:00 Uhr …“ (`acceptance/probe/run2.log`).
- [x] **AC-16**: Format und Wortlaut stimmen, z. B. „Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28 %)“. Siehe **BUG-3** (Rundung bei x,5 %).
- [x] **AC-17**: „Jetzt starten · fertig um 24:00 Uhr · Ø 4,1 ct/kWh“ plus „Günstiger wird es im bekannten Zeitraum nicht.“, ohne Vergleichszeile (`recommendation-text.ts:108-113`, Gegenprobe).
- [x] **AC-18**: „Für 12:00 h sind noch nicht genug Preise bekannt. Die Preise für morgen erscheinen meist ab ca. 13 Uhr.“, ohne Empfehlung (`recommendation-text.ts:101-102`, Gegenprobe).
- [x] **AC-19**: Der Hinweis erscheint nur zusammen mit einer Empfehlung, solange morgen nicht `ok` ist (`start-window.ts:74`, `recommendation-text.ts:119`). Der Oracle-Mutant „`tomorrowMissing` verfälscht“ wird erkannt.
- [x] **AC-20**: Ein gemeinsamer Provider-Zustand (`devices-panel.tsx:47`, `price-panel.tsx:29`). Keine eigene Preisanfrage: `grep -rnE "fetch\(|energy-charts|/api/prices" src/components/devices src/lib/devices` (ohne Tests) → 0. Mit `TZ=Pacific/Kiritimati` sind die Kartentexte byte-identisch (`acceptance/probe/run4-tz.log`).

### Aktualisierung
- [x] **AC-21**: Code und Fake-Timer-Tests (`use-live-prices.ts:152-184`, `devices-panel.tsx:50-61`, `use-live-prices.test.ts:68,90,106,332`, `live-prices-provider.test.tsx:62,93`). Das echte Verhalten im offenen Browser-Tab: [!] siehe unten.

### Laden & Fehler
- [x] **AC-22**: Suspense-Fallback `DevicesSkeleton` in Kartenform, kein Spinner (`devices-section.tsx:27`, `devices-skeleton.tsx`). Test: `devices-states.test.tsx:88`.
- [x] **AC-23**: `today.status !== 'ok'` ergibt `prices_unavailable` (`start-window.ts:20`), der Text steht wörtlich in `recommendation-text.ts:18`. Die Empfehlung kehrt ohne Neuladen zurück (`devices-panel.test.tsx:96`, `live-prices-provider.test.tsx:124`).
- [x] **AC-24**: Bei einem Fehler bleibt der Dialog mit den Eingaben offen (`device-dialog.tsx:126,241-245`, `devices-panel.tsx:31-37,109-110`). Es gibt kein halbes Gerät (ein einzelnes INSERT) und kein doppeltes (eindeutiger Index). Tests: `devices-panel.test.tsx:158,222`, `device-dialog.test.tsx:231`.

### Darstellung & Barrierefreiheit
- [!] **AC-25**: NOT VERIFIED, weil es keinen Browser und keinen Viewport gibt. Im Code bestätigt sind nur die Beschriftungen: Label „Name“, „Stunden“, „Minuten“, `fieldset`/`legend` „Laufzeit“ (`device-dialog.tsx:152,171,178,208`) und `aria-label` „Aktionen für …“ (`device-card.tsx:44`).

### Datenschutz
- [x] **AC-26**: `curl http://localhost:3001/datenschutz` enthält „Deine Geräte: Name und Laufzeit …“, den Zweck, „Art. 6 Abs. 1 lit. b DSGVO“ und „Geräte: bis du das Gerät oder dein Konto löschst.“ (`acceptance/datenschutz.html`).
- [x] **AC-27**: Laufzeit: Konto A mit 20 Geräten über `deleteAccount` gelöscht. Danach liefert As JWT über RLS 0 Zeilen, der Auth-Nutzer ist weg (`security/ac27.txt`). Kaskade in Migration `:8` und `…0001_profiles.sql:5`, Integrationstest grün.

## Edge Cases

- [x] **EC-1**: 2026-03-29 ergibt „Starte um 01:30 Uhr · fertig um 05:00 Uhr“. Gezählt wird in Slots (`start-window.ts:65`). Die Oracle-Tests am 92-Slot-Tag sind grün.
- [x] **EC-2**: 2026-10-25 ergibt „02:15 Uhr MESZ“ bzw. „02:15 Uhr MEZ“ (`recommendation-text.ts:61-64`). Die Oracle-Tests am 100-Slot-Tag sind grün.
- [x] **EC-3**: `comparisonText(-4,-16)` → „Sofort: Ø −0,4 ct/kWh – du sparst 1,2 ct/kWh“, ohne Prozent.
- [x] **EC-4**: Sofort 100,04 gegen später 100,00 EUR/MWh → „kaum Unterschied (unter 0,1 ct/kWh)“.
- [x] **EC-5**: Um 22:15 mit 105 min (7 Slots übrig) → „Jetzt starten“. Der Oracle-Mutant zum Off-by-one wird erkannt.
- [x] **EC-6**: Um 23:50 ohne morgen: 0:15 h → „Jetzt starten“, 0:30 h → Hinweis aus AC-18.
- [x] **EC-7**: Garantie bestätigt: Ref-Sperre `submittingRef` (`device-dialog.tsx:104,113-115,138-142`), Button `disabled` mit Spinner (`:251-252`), serverseitig der eindeutige Index (Migration `:29`). Test: `device-dialog.test.tsx:182`. Den Ladezustand selbst habe ich nicht im Browser gesehen.
- [x] **EC-8**: Garantie bestätigt (eindeutiger Index, Migration `:29`). Zur Laufzeit ergeben 4 parallele Inserts `Trockner/trockner/TROCKNER/Trockner` 1× 201 und 3× 409, also genau 1 Zeile (`security/dup-dataapi.txt`).
- [x] **EC-9**: Garantie bestätigt: Advisory-Lock pro Nutzer im BEFORE-INSERT-Trigger (Migration `:36-57`). Zur Laufzeit ergeben 6 parallele Inserts bei 19 Geräten 1× 201 und 5× P0001, Endstand 20 (`security/limit-dataapi.txt`).
- [x] **EC-10**: Garantie bestätigt: kein Upsert, keine betroffene Zeile → `not_found` (`actions.ts:72-79,97-99`). Zur Laufzeit liefern fremde oder nicht vorhandene IDs `not_found`, nichts wird angelegt. Test: `devices-panel.test.tsx:175,231`.
- [x] **EC-11**: Garantie bestätigt: schlichtes UPDATE per `id` ohne Versionsprüfung, die Antwort enthält die frische Liste (`actions.ts:72-81`).
- [x] **EC-12**: Zur Laufzeit: `<img src=x onerror=alert(1)>` und `</script><script>…` gespeichert. Im Dashboard-HTML stehen 0 rohe Tags, nur `&lt;img …&gt;` (`security/dash-a-xss.html`). `grep -rn "dangerouslySetInnerHTML\|innerHTML" src/components/devices src/lib/devices` → 0.
- [!] **EC-13**: NOT VERIFIED, weil es keinen Viewport für 360 px gibt. Im Code: `break-words [overflow-wrap:anywhere]` (`device-card.tsx:39`), der volle Name steht im Bearbeiten-Input (`devices-panel.tsx:81`).
- [x] **EC-14**: Die Brute-Force-Gegenproben mit Lücken stimmen überein (beide Oracles). Text wörtlich (`recommendation-text.ts:41-43`), Tests `start-window.test.ts:256-303`.

### Zusätzliche Edge Cases (nicht im Spec)
- [ ] **Unsichtbare Zeichen im Namen**: siehe BUG-1.
- [ ] **Gleich aussehende Namen in NFD/NFC über die Data API**: siehe BUG-2.
- [x] **Mass Assignment**: Zusätzliche Felder `user_id`, `id`, `created_at` und `__proto__` an die Actions werden ignoriert (`actions.ts:46-48`, `security/injection-actions.txt`).
- [x] **Ungültige IDs** (`x' or 1=1--`, Array, Komma-Liste) → `not_found` über `z.uuid()` (`schemas.ts:57`).

## Security Audit

- [x] **Authentifizierung:** Ohne Login bzw. mit widerrufener Sitzung gibt es keinen Zugriff (siehe AC-2; `security/revoked-session.txt`, `unauth-actions.txt`).
- [x] **Autorisierung:** Fremde Geräte sind weder über die Actions noch über die Data API lesbar, änderbar oder löschbar. RLS und Spaltenrechte in Migration `:60-83` (`security/authz-actions.txt`, `dataapi.txt`).
- [x] **Trigger-Funktion nicht direkt aufrufbar:** `POST /rpc/enforce_device_limit` → 404. Absicherung: `security definer`, `search_path=''`, `revoke execute` (Migration `:39-40,53`).
- [x] **CSRF:** `deleteDevice` mit fremdem `Origin` → „Invalid Server Actions request.“, das Gerät bleibt (`security/csrf.txt`).
- [x] **Eingabeprüfung:** XSS wird escaped (EC-12). SQL-Payloads werden wörtlich gespeichert bzw. als UUID abgelehnt, die Tabelle bleibt intakt (`security/injection-actions.txt`). Name und Laufzeit werden serverseitig mit Zod und DB-Prüfregeln geprüft.
- [!] **Rate-Limiting (normale Endpunkte):** NOT VERIFIED, nicht implementiert (optional für MVP). 25 schnelle Aufrufe ohne Drosselung. Die Grenze von 20 Geräten deckelt die Menge (`design.md:262`).
- [!] **Brute Force / Kontenaufzählung:** NOT VERIFIED, weil dieses Feature keine Zugangsdaten prüft (`design.md:216-218`). Das gehört zu PROJ-1.
- [x] **Zugangsdaten in der URL:** Das einzige Formular (`device-dialog.tsx:135`) reicht über `handleSubmit` mit `preventDefault` ein. Das SSR-HTML enthält kein `<form>`, und es werden keine Zugangsdaten übertragen.
- [x] **Keine Secrets im Client:** 32 ausgelieferte JS-Chunks, das Dashboard-HTML, `.next/static` und `.next/dev/static` enthalten 0 Treffer für den Wert des Service-Keys und für `service_role`/`sb_secret_` (`security/secrets-scan.txt`).
- [x] **Keine Secrets in Git:** `git log -p main..HEAD` mit Schlüsselmustern → 0. Der echte Key-Wert kommt in `git log -p --all` nicht vor.
- [x] **Sensible Daten in Antworten:** Die Antworten enthalten nur `id`, `name`, `durationMinutes` und `createdAt`, kein `user_id`. Fehler werden als `{status:'error'}` ohne DB-Text zurückgegeben (`types.ts:10-15`, `actions.ts:51,78,98`).
- [x] **`[user]`-Tasks:** keine (`tasks.md:6`, `design.md:240`).
- [x] **Security-Header** lokal gesetzt: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` und `HSTS includeSubDomains` auf `:3001/dashboard` (`curl -si`).

## Regression (PROJ-1, PROJ-2)

Kein Feature hat den Status Deployed. Geprüft wurden die Kernabläufe der beiden Approved-Features, mit Schwerpunkt auf den geteilten Dateien. Das sind `src/app/dashboard/page.tsx`, `src/components/prices/price-panel.tsx`, `src/hooks/use-live-prices.ts`, `src/app/datenschutz/page.tsx` und die neue Migration.

- [x] **PROJ-1:**
  - Anmelden: AC-8 mit No-JS-POST → 303 mit Cookie.
  - Kein Hinweis auf vorhandene Konten: AC-9 mit gleicher Meldung für falsches Passwort und unbekannte Adresse.
  - Login-Sperre: AC-10, der 6. Versuch wird gesperrt.
  - Weiterleitungen: AC-13, AC-14, AC-15.
  - App-Hülle: AC-16 mit genau 1 `<header>`, 0 `<nav>`/`<aside>`.
  - Abmelden: AC-17.
  - Anzeigename: AC-18.
  - Profil-RLS: AC-23, AC-24.
  - Konto löschen: AC-25, inklusive der Geräte über die Kaskade.
  - Belege: `regression/reg.out`, `reg2.out`.
- [x] **PROJ-2:**
  - Abschnitt mit Tabs: AC-1.
  - Zugriff nur mit Sitzung: AC-2 (`/api/prices` ohne Sitzung 401, mit Sitzung 200).
  - Preise stimmen mit der Quelle: AC-4, alle 96 Slots gegen Energy-Charts verglichen, 0 Abweichungen.
  - Kennzahlen und Hinweise: AC-10, AC-14 bis AC-16.
  - Ladezustand: AC-22 (Skeleton-Fallback).
  - Die Live-Logik (AC-19 bis AC-21, AC-23, EC-7, EC-8, EC-10) ist durch die unveränderten Tests in `use-live-prices.test.ts:59-283` und die neuen Provider-Tests im grünen Suite-Lauf abgedeckt.
- [x] **PROJ-1 AC-26 (`/datenschutz`):** Die Seite ist weiter vollständig und um die Geräte ergänzt. „Übertragbarkeit“ fehlt nach wie vor. Das ist der bekannte BUG-6 aus PROJ-1 (Low, Deferred), keine Regression.

## E2E-Tests
- Status: **nicht ausgeführt** (für kritische Abläufe `/e2e-tests` ausführen)

## Nicht verifiziert in diesem Lauf

- [!] **AC-25** (360 px ohne horizontales Scrollen, vollständige Tastaturbedienung) und **EC-13** (Umbruch bei 360 px): Es gibt keinen Browser und keinen Viewport. Das gehört zu `/e2e-tests` oder einem menschlichen Durchgang.
- [!] **AC-21 in Echtzeit** (Slot-Wechsel im offenen Tab), Ladezustand des Buttons (EC-7), Toasts und Fokus: Ohne Browser-Engine ist das nur über Code und Fake-Timer-Tests belegt.
- [!] **AC-8 mit Umlauten** („Spülmaschine“ gegen „SPÜLMASCHINE“): Das hängt an der Kollation von `lower()` in der Datenbank. Der Integrationstest prüft nur ASCII.
- [!] **Rate-Limiting auf den Server Actions:** nicht implementiert (optional für MVP).
- [!] **Brute Force und Kontenaufzählung:** nicht zutreffend, das Feature prüft keine Zugangsdaten.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge) und Browser-Konsole: kein Browser.

## Bugs

### BUG-1: Ein Name aus unsichtbaren Zeichen wird als gültig angenommen
- **Severity:** Low
- **Status:** Deferred (vom Nutzer am 2026-10-06 bestätigt)
- **Class:** Die Pflichtfeld- und Randprüfung stützt sich nur auf `trim()` bzw. `\s`. Unsichtbare Format-Zeichen (Unicode Cf, z. B. U+200B, U+2060, U+FEFF) zählen deshalb als Inhalt.
- **Sweep:** `grep -rnE '\.trim\(\)' src/lib/*/schemas.ts` findet 3 Treffer:
  - `src/lib/devices/schemas.ts:17` (betroffen)
  - `src/lib/auth/schemas.ts:16` (E-Mail, die E-Mail-Prüfung fängt das ab)
  - `src/lib/auth/schemas.ts:45` (Anzeigename von PROJ-1, nicht geprüft)

  Dazu kommt die DB-Prüfregel `supabase/migrations/20261006000005_devices.sql:14-18` mit derselben Lücke.
- **Steps to Reproduce:**
  1. Als angemeldeter Nutzer `createDevice` mit Name `"​​ "` und 60 Minuten aufrufen (oder über die Data API `"​"` einfügen).
  2. Expected: Abgelehnt mit „Bitte gib einen Namen ein.“ (AC-6, „leer“).
  3. Actual: `{"status":"ok"}` bzw. 201. Die Karte hat eine leere Überschrift, die Löschfrage lautet „„“ löschen?“. Außerdem wird `"Wasch​maschine"` neben „Waschmaschine“ angenommen und sieht gleich aus.
  - Ausweg: Bearbeiten oder Löschen über das Kartenmenü funktioniert.

### BUG-2: Die Datenbank-Sperre für eindeutige Namen normalisiert nicht nach NFC
- **Severity:** Low
- **Status:** Deferred (vom Nutzer am 2026-10-06 bestätigt)
- **Class:** Eine Normalisierungsregel steht nur in der App-Validierung, nicht in der zweiten Sperre der Datenbank. `design.md` verspricht aber, dass die Datenbank eindeutige Namen auch beim Umgehen der Server Actions erzwingt.
- **Sweep:**
  - `grep -rn "normalize('NFC')" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer (`src/lib/devices/schemas.ts:17`).
  - Gegenprobe `grep -n "normalize" supabase/migrations/*.sql` → 0 Treffer.
- **Steps to Reproduce:**
  1. Mit eigenem JWT direkt über die Data API `"Wäsche"` in NFD (a + U+0308) und `"Wäsche"` in NFC einfügen.
  2. Expected: Das zweite wird mit 409 abgelehnt (AC-8).
  3. Actual: Beide 201, danach gibt es zwei optisch gleiche Geräte „Wäsche“ (`security/dataapi.txt`).
  - Auswirkung: Betrifft nur die eigenen Daten und nur, wer die App bewusst umgeht. Über die App selbst greift die NFC-Normalisierung.

### BUG-3: Prozentangabe rundet x,5 % teils ab statt kaufmännisch auf
- **Severity:** Low
- **Status:** Deferred (vom Nutzer am 2026-10-06 bestätigt)
- **Class:** Die Prozentangabe wird aus einem Gleitkomma-Quotienten gerundet statt mit ganzzahliger Arithmetik. Gleitkomma-Rauschen kippt Werte auf der ,5-Grenze nach unten.
- **Sweep:** `grep -rnE 'Math\.round\(\(.*/.*\) \* 100\)' src | grep -v '\.test\.'` → 1 Treffer (`src/lib/devices/recommendation-text.ts:88`).
- **Steps to Reproduce:**
  1. `comparisonText(40, 17)` aufrufen. Angezeigt werden Sofort 4,0 und später 1,7 ct/kWh, die Ersparnis ist 2,3 ct/kWh, exakt 57,5 %.
  2. Expected: „(58 %)“, kaufmännisch gerundet laut `design.md:154`.
  3. Actual: „(57 %)“, weil `(23/40)*100` = `57.49999999999999` ist (`node -e` bestätigt).
  - Weitere Fälle: `(80, 34)` → 57 statt 58, `(200, 171)` → 14 statt 15. Das betrifft 24 von etwa 180.000 Kombinationen bis 60 ct/kWh (`acceptance/probe/run1.log`).

## Zusammenfassung
- **Acceptance Criteria:** 26/27 bestanden (bei AC-6, AC-8 und AC-16 je ein Low-Befund), 1 nicht verifiziert (AC-25). **Edge Cases:** 13/14 bestanden, 1 nicht verifiziert (EC-13).
- **Bugs:** 3 insgesamt (0 Critical, 0 High, 0 Medium, 3 Low). Offen: 0, zurückgestellt: 3 (vom Nutzer bestätigt).
- **Security:** 11/13 Prüfungen mit Beleg verifiziert, 2 NOT VERIFIED (Rate-Limiting nicht implementiert, Brute Force nicht zutreffend).
- **Production Ready:** JA. Es gibt keinen Critical- oder High-Befund, und die Laufzeit-ACs wurden gegen die laufende App mit echten Sitzungen ausgeführt.
- **Empfehlung:** Deploy möglich. Offen bleiben AC-25 und EC-13 (360 px, Tastatur) sowie die Echtzeit-Aktualisierung im Browser. Sie gehören zu `/e2e-tests` oder einem menschlichen Durchgang.

> „Production Ready: JA“ heißt *keine Critical/High-Bugs*, nicht, dass alles geprüft wurde. Die NOT-VERIFIED-Punkte oben bleiben offen.
