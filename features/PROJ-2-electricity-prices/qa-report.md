# QA-Testergebnisse – PROJ-2 Strompreise

**Getestet:** 2026-10-06. Dritter Lauf: Re-Verifikation nach dem Fix von BUG-2.
**App-URL:** http://localhost:3001. Das ist der Dev-Server dieses Worktrees. `probe.baseUrl` (3000) zeigt hier auf den Checkout von `main`.
**Tester:** QA Engineer (KI). Eine unabhängige `qa-engineer`-Lane ohne Build-Kontext prüfte nacheinander Akzeptanz, Security und Regression, beschränkt auf den Diff. Zusammengeführt vom QA-Owner.

**Umfang dieses Laufs:** Re-Verifikation.
- Befehl: `git diff --stat 40c2fa0..HEAD`.
- Geänderte Produktionsdatei: `src/components/prices/price-section.tsx`.
- Dazu kommen der neue Test `src/components/prices/price-section.test.tsx`, `design.md` und `features/INDEX.md`.
- Der Diff berührt keinen gemeinsam genutzten Code (keine App-Hülle, keine Auth- oder Middleware-Datei, keine Migration). Deshalb lief **eine Lane**, beschränkt auf den Diff und BUG-2.
- Geprüft wurden BUG-2 mit Sweep, AC-1, AC-2, AC-4 (Stichprobe) und AC-22, die Security-Prüfungen am Diff und die Regression.
- Alles andere stammt aus dem zweiten Lauf (2026-10-06, Commit `40c2fa0`). Es ist pro Abschnitt als **übernommen** markiert und wurde in diesem Lauf nicht erneut ausgeführt.

**Übersprungen:** der Migrations-Round-Trip, `skipped — unchanged since 2026-10-06`. Der Diff berührt `supabase/` nicht (`git diff --stat 40c2fa0..HEAD -- supabase` ist leer).

**Rohbelege** (`scratchpad/` der QA-Sitzung):
- Lauf 3:
  - `suite-run-3.log`, `lint-3.log`, `tsc-3.log`, `build-3.log`
  - `red-price-section.log`
  - `reverify-3/` (`bug2.out`, `auth.out`, `ac4.out`, `ac22.out`, `refresh.out`, `reg.out`, `secrets.out`, `cleanup.out`)
- Lauf 2: `suite-run-2.log`, `build-2.log`, `acceptance-2/`, `security-2/`, `regression-2/`
- Lauf 1: `suite-run.log`, `acceptance/`, `security/`, `regression/`

> Legende: `[x]` in diesem Lauf verifiziert (mit Beleg) · `[x] (übernommen)` im Lauf 2 verifiziert, Dateien seitdem unverändert, nicht erneut ausgeführt · `[ ] BUG` als fehlerhaft verifiziert · `[!] NOT VERIFIED` nicht prüfbar (mit Grund)

**Testkonten (Lauf 3):** 4 Wegwerfkonten `qa-reg3-…`, angelegt über die Admin-API.
- Jedes Konto hat sich über das echte Login-Formular angemeldet (303 auf `/dashboard`). Es gab keinen falschen Passwortversuch.
- Alle 4 Konten sind gelöscht. Beleg: `getUserById` → 404, `listUsers` findet 0× `qa-reg3-` (`reverify-3/cleanup.out`).
- Energy-Charts wurde genau 1× direkt abgefragt.

## Acceptance Criteria

### Abschnitt & Zugriff
- [x] **AC-1** (Lauf 3): `/dashboard` mit gültiger Sitzung → 200.
  - `<h1>Übersicht</h1>` steht vor `<h2 id="prices-heading">Strompreise</h2>`.
  - Tab „Heute“ mit `aria-selected="true"`, Tab „Morgen“ mit `aria-selected="false"`.
  - 192× `priceEurMwh` auf der Seite.
  - Beleg: `reverify-3/hdr-ok.txt`, `body-ok.html`.
- [x] **AC-2** (Lauf 3): BUG-2 ist behoben.
  - Ohne Sitzung:
    - `/api/prices` → `401 {"error":"unauthorized"}`.
    - `/dashboard` → 307 auf `/login?next=%2Fdashboard`, 0× `priceEurMwh`. Dasselbe mit `RSC: 1` und mit Prefetch.
  - **Bei serverseitig widerrufener Sitzung** (Konto gelöscht oder `signOut(token,'global')`):
    - `/dashboard` → 307 auf `/login?next=%2Fdashboard` mit **0×** `priceEurMwh`. Vorher waren es 192×.
    - Ebenso 0× mit `?_rsc`, mit `Next-Router-Prefetch: 1` und mit `RSC: 1`. Bei `RSC: 1` liefert der weitergeleitete Aufruf 200 mit `NEXT_REDIRECT` und ohne Preise.
    - `/api/prices` → 401.
  - Gegenprobe: Mit gültiger Sitzung enthält dieselbe Abfrage 192×.
  - Beleg: `reverify-3/bug2.out`, `auth.out`, `price-section.tsx:12-18`.

### Diagramm & Werte
_Übernommen aus Lauf 2: Der Diff berührt `price-chart.tsx`, `price-math.ts` und `berlin-time.ts` nicht. Nicht erneut ausgeführt, außer der AC-4-Stichprobe._
- [x] **AC-3** (übernommen): 96, 92 und 100 Balken an Normal- und Umstellungstagen, x-Ticks `0,3,…,21`, y-Achse in ct/kWh. Beleg: `acceptance-2/chart.probe`, `price-chart.tsx:98,284`. Darstellung im Browser: siehe Nicht verifiziert.
- [x] **AC-4** (Stichprobe Lauf 3):
  - `/api/prices`, der RSC-Payload von `/dashboard` und das Dashboard-HTML haben 192/192 identische Slots und dasselbe `generatedAt`.
  - 1 Direktabruf bei Energy-Charts: 192/192 gleich.
  - Die SSR-Kennzahlen „Jetzt 15,3 ct/kWh / 15:15 Uhr“ und „Teuerster ab jetzt 40,6 / 18:45“ passen zur nachgerechneten API-Antwort.
  - Beleg: `reverify-3/ac4.out`. Die `formatCt`-Referenzprüfung (10 000 Zufallswerte) ist aus Lauf 2 übernommen.
- [~] **AC-5** (übernommen): teilweise geprüft.
  - Der Tooltip-Text ist belegt: „13:15–13:30 · 53,0 ct/kWh“ (`price-chart.tsx:117-119`).
  - Die Tastatur-Ebene `accessibilityLayer` ist vorhanden (`:297`), Tippen fokussiert nicht (`:289`).
  - Hover, Tippen und Pfeiltasten in einer echten Engine: siehe Nicht verifiziert.
- [x] **AC-6** (übernommen): −5 EUR/MWh → „−0,5 ct/kWh“ mit dem Zeichen U+2212, −0,4 → „0,0“. Der Balken liegt unter der Nulllinie (`acceptance-2/chart.probe`, `price-chart.tsx:318`).
- [x] **AC-7** (übernommen): Drittel über den ganzen Tag. Probe `[−30,60,0,29.9,30.1]` → günstig, teuer, mittel, mittel, teuer. Fills `--chart-1/2/3`, die Legende benennt die Stufen in Worten (`acceptance-2/logic.probe`, `price-chart.tsx:31-35`).
- [x] **AC-8** (übernommen): Marker „günstigst“ und „teuerst“ mit ArrowDown- bzw. ArrowUp-Icon (`acceptance-2/panel.probe`, `price-chart.tsx:203`).
- [x] **AC-9** (übernommen): Bei Gleichstand gewinnt der früheste Slot, auch ab `from` (`acceptance-2/logic.probe`, `price-math.ts:52-59`).

### Tab „Heute“
_Übernommen aus Lauf 2; der Diff berührt `key-figures.tsx` und `price-panel.tsx` nicht._
- [x] **AC-10** (übernommen): Um 13:20 zeigen die Kennzahlen „Jetzt 10,0 / 13:15 · günstig“, „Günstigster ab jetzt 2,0 / 15:00“ und „Teuerster ab jetzt 50,0 / 20:00“; das vergangene Tagesminimum wird ignoriert (`acceptance-2/panel.probe`).
- [x] **AC-11** (übernommen): Vergangene Balken sind `muted-foreground` mit Deckkraft 0,3, der aktuelle Balken ist `--chart-4` mit „jetzt“ (`price-chart.tsx:84-91`).

### Tab „Morgen“
_Übernommen aus Lauf 2._
- [x] **AC-12** (übernommen): „Ø Tagesdurchschnitt 10,1“, „Günstigster −0,5 / 01:15“, „Teuerster 30,0 / 10:00“. Weder „jetzt“ noch „vorbei“ (`acceptance-2/panel.probe`).
- [x] **AC-13** (übernommen): Der Hinweistext steht wörtlich da, ohne `role=alert`. Eine Quelle ohne Werte ergibt `not_published` (`price-states.tsx:16`).

### Hinweise & Zugänglichkeit
_Übernommen aus Lauf 2._
- [x] **AC-14** (übernommen): Der Satz steht wörtlich im SSR-HTML (`price-footer.tsx:8`).
- [x] **AC-15** (übernommen): Quellenangabe mit Links auf energy-charts.info und CC BY 4.0 (`price-footer.tsx:10-22`).
- [x] **AC-16** (übernommen): Button „Als Tabelle anzeigen“ im SSR. Aufgeklappt zeigt die Tabelle 96 Zeilen, inklusive günstigstem und teuerstem Zeitpunkt (`acceptance-2/panel.probe`).
- [!] **AC-17**: nicht verifiziert, weil kein Viewport zur Verfügung stand.
  - Im Code: `sm:grid-cols-3` (`key-figures.tsx:116`), `w-full min-w-0` (`price-chart.tsx:283`).
  - Unter 640 px stehen die x-Ticks alle 6 Stunden (`:238,280`).

### Zeit & Aktualisierung
_Übernommen aus Lauf 2; der Diff berührt `use-live-prices.ts`, `get-prices.ts` und `price-cache.ts` nicht._
- [x] **AC-18** (übernommen): Die Probes laufen identisch unter `Europe/Berlin`, `America/Los_Angeles` und `Pacific/Kiritimati` (`acceptance-2/logic.probe` + `panel.probe`).
- [x] **AC-19** (übernommen): Mit Fake-Timer springt „Jetzt“ ohne Reload zum nächsten Slot (`use-live-prices.ts:138-148`).
- [x] **AC-20** (übernommen): Fehlt „morgen“, holt die App die Preise an der nächsten Grenze nach; serverseitig 60 s Cache ab 12:00 (`acceptance-2/service.probe`). Grenzfall siehe BUG-4.
- [x] **AC-21** (übernommen): Über Mitternacht zeigt „Heute“ sofort den neuen Tag (`acceptance-2/panel.probe`). Grenzfall siehe BUG-3.

### Zustände
- [x] **AC-22** (Lauf 3, Struktur):
  - Die Antwort kommt `chunked`. Zuerst kommt `<template id="B:0">`, dann das Skeleton `<section aria-busy="true">` (36 Skeleton-Elemente, 0× `animate-spin`), danach der Inhalt mit `<h2 id="prices-heading">`, eingesetzt über `$RC("B:0","S:0")`.
  - Beleg: `reverify-3/ac22.out`, `price-section.tsx:25-31`.
  - Das sichtbare Verhalten im Browser: siehe Nicht verifiziert.
- [x] **AC-23** (übernommen):
  - Der Alert-Text stimmt wörtlich, es erscheinen keine Tabs, „Erneut versuchen“ ist während der Anfrage deaktiviert.
  - Danach gilt eine 30-s-Sperre, die Zeitüberschreitung liegt bei 8 s, und das Dashboard bleibt bedienbar.
  - Beleg: `acceptance-2/panel.probe` + `service.probe`, `energy-charts.ts:9,58`.
- [x] **AC-24** (übernommen): Ist ein Tag im Cache und die Quelle nicht erreichbar, bleibt `today=ok` (`get-prices.ts:79-83`, `get-prices.edge.test.ts`).

### Zusätzlicher Grenzfall (Lauf 3)
- [x] **Abgelaufenes Access-Token, gültiges Refresh-Token:** Layout und Abschnitt rufen jetzt beide `getUser()` auf. Mit `expires_at` in der Vergangenheit liefert `/dashboard` 200 mit 192 Preisen und erneuert das Session-Cookie, `/api/prices` liefert 200. Die doppelte Prüfung blockiert den angemeldeten Pfad also nicht (`reverify-3/refresh.out`).

## Edge Cases

_Alle übernommen aus Lauf 2: Der Diff berührt keine der implementierenden Dateien._

- [x] **EC-1** (übernommen): 2026-03-29 und 2027-03-28 haben 92 Slots, kein Label beginnt mit „02:“, das Diagramm zeigt 92 Balken. Zur Beschriftung siehe BUG-5.
- [x] **EC-2** (übernommen): 2026-10-25 und 2027-10-31 haben 100 Slots, je 4× „MESZ“ und „MEZ“ in Tooltip und Tabelle. Siehe BUG-5 und BUG-6.
- [x] **EC-3** (übernommen): Um 23:50 zeigen alle drei Kennzahlen „10,5 / 23:45 Uhr“.
- [x] **EC-4** (übernommen): Fehlt der aktuelle Slot, zeigt „Jetzt“ „Kein Preis verfügbar“; `null` wird überall ignoriert.
- [x] **EC-5** (übernommen): Liefert die Quelle `ok`, aber leer, wird `today=error` gesetzt (`get-prices.ts:18,27`).
- [x] **EC-6** (übernommen): Haben alle Slots denselben Preis, sind alle Balken „mittel“, Extrema = frühester Slot.
- [x] **EC-7** (übernommen): Bei `visibilitychange` springt die Anzeige sofort auf den aktuellen Slot (`use-live-prices.ts:151-157`).
- [x] **EC-8** (übernommen): Liefert der Refetch 503, erscheint kein Alert und die bisherigen Daten bleiben (`use-live-prices.test.ts:143`).
- [x] **EC-9** (übernommen): Die Garantie steht im Code: eine gemeinsame laufende Anfrage (`get-prices.ts:64,69-90`) und ein prozessweiter Speicher (`price-cache.ts:29-36`). 50 gleichzeitige Aufrufe → 1 Fetch.
- [x] **EC-10** (übernommen): Wechsel Heute → Morgen → Heute löst 0 Fetches aus.

## Security-Audit

- [x] **Authentifizierung** (Lauf 3): BUG-2 ist geschlossen.
  - Getestet ohne Cookie, mit kaputtem Cookie, mit gefälschtem JWT `alg:none` (sub = echte User-ID) und mit HS256 mit falschem Schlüssel.
  - `/dashboard` (ohne Zusatz, mit `RSC: 1`, mit Prefetch) liefert durchweg 307 auf `/login?next=%2Fdashboard` mit 0 Preisen. `/api/prices` liefert durchweg 401 mit `private, no-store`.
  - Eine widerrufene Sitzung ergibt in allen Varianten 0 Preise, siehe AC-2.
  - Beleg: `reverify-3/auth.out`, `bug2.out`.
- [x] **Keine Secrets im Client-Bundle** (Lauf 3):
  - Durchsucht wurde `.next/static` aus dem Prod-Build von Lauf 3 (33 Dateien, 1,55 MB).
  - Ergebnis: 0× Name und Wert von `SUPABASE_SERVICE_ROLE_KEY`, 0× `service_role`, 0× `sb_secret_`.
  - `price-section.tsx` wird nur serverseitig importiert (`dashboard/page.tsx:4`).
  - Beleg: `reverify-3/secrets.out`.
- [x] **Keine Zugangsdaten in der URL** (Lauf 3, Nebenbefund der Regression): `/login`, `/signup`, `/forgot-password` und `/auth/link-invalid` rendern `method="POST"` (`reverify-3/reg.out`).
- [x] **Autorisierung** (übernommen): Zwei Sitzungen erhalten byte-gleiche `/api/prices`-Antworten; die PROJ-1-RLS hält (`security-2/sess.out`).
- [x] **Eingabevalidierung und Injection** (übernommen):
  - `?bzn=FR`, SQL, SSRF-URL, `__proto__`, `<script>` und `x-forwarded-host` laufen ins Leere.
  - Die ausgehende URL besteht nur aus einer Konstante und berechneten Werten (`energy-charts.ts:7,35-38`), die Antwort wird per Zod geprüft (`:25-32`).
- [x] **Brute Force** (übernommen):
  - Pro E-Mail gesperrt ab dem 6. Versuch, pro IP ab dem 21.; parallel 5/12 bzw. 5/30.
  - Beleg: `security-2/bf.out`.
  - Einschränkung: Über `X-Forwarded-For` lässt sich die IP-Sperre umgehen (PROJ-1 BUG-2, Deferred).
- [x] **Keine Account-Enumeration (Meldung)** (übernommen): identische Meldung für bekannte und unbekannte Adresse (`security-2/enum.mjs`).
- [x] **Sensible Daten und Header** (übernommen): Der Body von `/api/prices` enthält nur `generatedAt`, `today` und `tomorrow`. Gesendet werden `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` und HSTS.
- [x] **Preisdaten auf öffentlichen Seiten** (übernommen): 9 öffentliche Routen, jeweils mit und ohne `RSC: 1`, enthalten 0× `priceEurMwh`.
- [!] **Rate Limiting auf `/api/prices`**: nicht implementiert. Das ist bewusst so entschieden (`design.md` → „Kein eigenes Rate-Limit auf /api/prices“); der Cache schützt Energy-Charts.
- [!] **Massen-Registrierung**: nicht abgefeuert, weil jede Registrierung eine echte Mail verschickt. Das Risiko ist in PROJ-1 `spec.md:128` akzeptiert.

## Regression

- [x] **Testsuite** (Lauf 3): `suite-run-3.log` meldet **29 Dateien, 283 passed, 0 failed**. Der neue `price-section.test.tsx` ist enthalten.
- [x] **Production-Build** (Lauf 3): `build-3.log` endet mit Exit 0, `ƒ /api/prices` und `ƒ /dashboard` sind gebaut.
- [x] **Lint und Typen** (Lauf 3): `npm run lint` endet mit Exit 0 (`lint-3.log`), `npx tsc --noEmit` ebenfalls mit Exit 0 und ohne Ausgabe (`tsc-3.log`).
- [x] **PROJ-1 – Login** (Lauf 3): Das Formular liefert 4× 303 auf `/dashboard` (`reverify-3/setup.out`).
- [x] **PROJ-1 – Logout** (Lauf 3): `x-action-redirect: /login` und das Cookie wird gelöscht. Danach liefert `/dashboard` mit dem alten Cookie 307 ohne Preise, `/api/prices` 401 (`reverify-3/reg.out`).
- [x] **PROJ-1 – öffentliche Seiten** (Lauf 3): `/login`, `/signup`, `/forgot-password`, `/datenschutz` und `/auth/link-invalid` liefern 200 mit der jeweiligen Überschrift (`reverify-3/reg.out`).
- [x] **App-Hülle** (Lauf 3): Das Dashboard hat genau 1× `<header>`, 0× `<nav>`, 0× `<aside>` und 1× `<main>` (`reverify-3/body-ok.html`).
- [x] **PROJ-1 – Login-Sperre zählt Fehlversuche** (übernommen, `regression-2/reg.out`).
- [!] **Features mit Status Deployed**: Es gibt keine. Stattdessen wurde das verwandte Feature PROJ-1 geprüft.

## Unit-Tests

- **Lauf 3:** keine neuen Tests von `/qa`. Der Diff enthält keine isolierte Logik; den Regressionstest für BUG-2 hat `/build` geschrieben (`price-section.test.tsx`, 2 Tests).
  - **Rot-Nachweis von `/qa` erneut geprüft:** Ohne die Zeile `if (!user) redirect(…)` schlägt „loads no prices and redirects to /login …“ fehl (1 failed, 1 passed). Mit dem Fix sind beide grün (`red-price-section.log`).
- **Lauf 1:** `src/lib/prices/price-cache.edge.test.ts` (10 Tests) und `src/lib/prices/get-prices.edge.test.ts` (5 Tests). Rot-Nachweis in Commit `8c8a5e1`. Beide Dateien sind Teil der 283 grünen Tests.

## E2E-Tests
- Status: **nicht gelaufen** (für kritische Abläufe `/e2e-tests` ausführen). Es gibt noch keine Suite.

## Nicht verifiziert in diesem Lauf

- [!] **AC-5 Interaktion** (Hover, Tippen, Pfeiltasten): kein Browser.
- [!] **AC-17** (360 px ohne horizontales Scrollen, Antippen): kein Viewport.
- [!] **AC-3, AC-7, AC-8, AC-11 optisch** (y-Ticks, Platzierung der Labels, Farbwirkung): keine Browser-Engine.
- [!] **AC-22 im Browser** (sichtbares Skeleton, Dauer): kein Browser. Belegt ist nur, dass die Stream-Struktur das Skeleton zuerst ausliefert.
- [!] **Später Redirect aus dem Suspense-Bereich:** Das wäre der Fall, dass das Layout die Sitzung akzeptiert, der Abschnitt aber nicht. Er lässt sich von außen nicht provozieren, weil beide Prüfungen im selben Request laufen. Belegt ist nur der Code (`price-section.tsx:16`: in diesem Zweig kein `getPrices()`). Wie der Client das späte `NEXT_REDIRECT` verarbeitet, ist ohne Browser nicht geprüft.
- [!] **AC-23/AC-24 gegen einen echten Energy-Charts-Ausfall in der laufenden App**: nicht provozierbar. Belegt durch Probes, Unit-Tests und Code.
- [!] **AC-19 bis AC-21 und EC-7 im echten Browser** (Timer-Drosselung, Standby): nur mit Fake-Timern geprüft.
- [!] **Cross-Browser** (Chrome, Firefox, Safari, Edge, mobil): `/qa` läuft ohne Browser.
- [!] **Hydration-Abweichung** an einer Slot-Grenze (`use-live-prices.ts:55`): braucht die DevTools-Konsole.
- [!] **Rate Limiting auf `/api/prices`**: bewusst nicht implementiert.
- [!] **Massen-Registrierung**: nicht abgefeuert (echte Mails).
- [!] **Fail-closed des Throttles bei DB-Ausfall**: nur im Code belegt (`login.ts:37-39`).
- [!] **Migrations-Round-Trip**: übersprungen, siehe Kopf.
- [!] **`private.cleanup_auth_data()` und Cron-Job in der Cloud-DB**: Das Schema `private` ist über die Data API nicht erreichbar.
- [!] **Security-Header gegen eine Live-URL**: Es gibt kein Deployment (PRD), geprüft wurde nur gegen den Dev-Server.

## Gefundene Bugs

### BUG-1: Veraltete PROJ-1-Basis – die Login-Sperre zählte auf diesem Branch keine Fehlversuche, Testsuite rot
- **Severity:** High
- **Status:** Fixed (2026-10-06, re-verified in Lauf 2)
- **Class:** Ein gestapelter Feature-Branch lief gegen ein gemeinsames DB-Schema (Strategie `single`), das eine auf `main` angewendete Migration schon weitergezogen hatte.
- **Sweep:** `for fn in $(grep -rhoE "rpc\('[a-z_]+'" src | sed "s/rpc('//;s/'//" | sort -u); do git grep -l "drop function public.$fn" HEAD -- supabase/migrations; done` → 0 Treffer (Lauf 2).
- **Fix:** `main` per Merge in den Branch geholt (Commit `28612a8`).

### BUG-2: `/dashboard` liefert Preisdaten im Body der 307-Weiterleitung, wenn die Sitzung serverseitig widerrufen ist
- **Severity:** Medium. Dieselbe Fehlerklasse wäre High, sobald `/dashboard` nutzerbezogene Daten zeigt (PROJ-3).
- **Status:** Fixed (2026-10-06, re-verified in Lauf 3). Der Fix steht in Commit `b8a0a50`: `PriceSectionContent` prüft vor `getPrices()` selbst `getUser()` und leitet ohne Nutzer weiter.
- **Class:** Server-Komponenten laden geschützte Daten und verlassen sich allein auf die Auth-Prüfung im Layout. Next rendert Layout und Page parallel (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1356`).
- **Sweep:** `grep -rlE "await (getPrices\(|supabase\s*\.from\()" src/app src/components | grep -v "\.test\." | xargs grep -LE "auth\.(getUser|getClaims)\("`. Lauf 2 fand 1 Treffer, **Lauf 3 findet 0 Treffer**. Die erste Stufe findet 3 Dateien (`dashboard/layout.tsx`, `api/prices/route.ts`, `price-section.tsx`), alle drei prüfen die Sitzung.
- **Re-Verifikation:** Beide Widerrufswege ergeben 307 mit 0× `priceEurMwh`, auch mit `RSC`, `_rsc` und Prefetch (siehe AC-2). Die Gegenprobe mit gültiger Sitzung ergibt 192×. Der Regressionstest hat einen Rot-Nachweis.

### BUG-3: Um Mitternacht kann eine Server-Antwort für den alten Tag den lokal vorgerückten neuen Tag überschreiben
- **Severity:** Low (selten, heilt sich zur nächsten Viertelstunde)
- **Status:** Deferred (Nutzer-Review 2026-10-06). Übernommen aus Lauf 2: Der Diff berührt die Dateien nicht.
- **Class:** Eine Antwort bzw. eine geteilte laufende Anfrage wird übernommen, ohne den Tagesschlüssel abzugleichen.
- **Sweep:** `grep -n "setPayload(result.payload)\|if (store.inflight) return store.inflight" src/hooks/use-live-prices.ts src/lib/prices/get-prices.ts` → 2 Treffer (`use-live-prices.ts:92`, `get-prices.ts:64`).
- **Steps to Reproduce:**
  1. Das Panel steht um 23:59:50 Berlin: heute = 06.10., morgen = 07.10. (ok).
  2. `/api/prices` antwortet noch mit `today.date = 2026-10-06`.
  3. Erwartet: „Heute“ zeigt den 07.10.
  4. Tatsächlich: Bis 00:15 zeigen alle Kennzahlen „Kein Preis verfügbar“, und „Morgen“ zeigt den 06.10.

### BUG-4: Morgen-Preise, die bis zu 60 s vor einer Slot-Grenze erscheinen, kommen erst eine Grenze später
- **Severity:** Low
- **Status:** Deferred (Nutzer-Review 2026-10-06). Übernommen aus Lauf 2.
- **Class:** Die Cache-Dauer des Servers ist nicht auf den Abfragetakt des Clients abgestimmt.
- **Sweep:** `grep -n "NOT_PUBLISHED_TTL_MS" src/lib/prices/price-cache.ts` → 2 Treffer (`:9`, `:65`).
- **Steps to Reproduce:**
  1. Der Server holt um 13:14:30, „morgen“ fehlt; der Cache gilt 60 s.
  2. Energy-Charts veröffentlicht um 13:14:45.
  3. Der Client fragt um 13:15:00 und bekommt `not_published`.
  4. Die Preise erscheinen erst um 13:30.

### BUG-5: Endzeit der Slot-Beschriftung an Umstellungstagen irreführend
- **Severity:** Low (kosmetisch)
- **Status:** Deferred (Nutzer-Review 2026-10-06). Übernommen aus Lauf 2.
- **Class:** Die Endzeit wird als Wanduhrzeit über die Zeitumstellung geschrieben, ohne Zonenangabe.
- **Sweep:** Probe mit allen Tagen 2026 durch `slotLabel`, Suche nach Spannweite ≠ 15 min → 2 Treffer: `2026-03-29 01:45–03:00` und `2026-10-25 02:45–02:00 MESZ`.
- **Steps to Reproduce:** Am 25.10.2026 heißt der erste 02:45-Slot „02:45–02:00 MESZ“, gemeint ist 02:00 MEZ. Am 29.03.2026 liest sich „01:45–03:00“ wie 75 Minuten (`berlin-time.ts:80-92`).

### BUG-6: Kennzahlen-Uhrzeit am 100-Slot-Tag mehrdeutig – zwei verschiedene Slots heißen beide „02:15 Uhr“
- **Severity:** Low
- **Status:** Deferred (aus Lauf 2). Übernommen aus Lauf 2.
- **Class:** Die Startzeit wird in der doppelten Stunde ohne Zonenzusatz beschriftet. PROJ-3 erbt die Funktion.
- **Sweep:** `grep -rn "startTimeLabel(" src | grep -v "\.test\."` → 3 Treffer (`key-figures.tsx:69`, `key-figures.tsx:93`, Definition `berlin-time.ts:95`).
- **Steps to Reproduce:** Am 25.10.2026 ist der günstigste Slot 01:15Z (02:15 MEZ, 0,5 ct), der teuerste 00:15Z (02:15 MESZ, 90,0 ct). Beide Kennzahlen zeigen „02:15 Uhr“ (`acceptance-2/dstfig.probe`).

**Hinweise, kein Bug in PROJ-2** (betreffen PROJ-1 bzw. den App-Rahmen):
- **IP-Sperre per `X-Forwarded-For` umgehbar.** Das ist der bekannte PROJ-1 BUG-2, Deferred (`src/lib/auth/request-meta.ts:12-14`).
- **Möglicher Timing-Seitenkanal beim Login.** Gemessen bei n=5: Median ~190 ms bei bekannter, ~116 ms bei unbekannter Adresse. Das sollte im nächsten PROJ-1-QA-Lauf mit größerer Stichprobe geprüft werden.
- **Source Maps mit Server-Action-Quelltext** im Dev-Server, ohne Secret-Werte.
- `X-Powered-By: Next.js` wird app-weit gesendet.
- `Retry-After` hat keine Obergrenze (`price-cache.ts:73`).
- **Neu in Lauf 3:** Pro Dashboard-Aufruf gehen jetzt 2 parallele `getUser()`-Anfragen an den Supabase-Auth-Server (`layout.tsx:11`, `price-section.tsx:15`). Das ist kein Bug, nur eine Notiz zur Performance. Mit PROJ-3 kommen voraussichtlich weitere hinzu (Muster aus `design.md`).

## Zusammenfassung
- **Acceptance Criteria:** 22/24 bestanden, 1 teilweise (AC-5), 1 nicht verifiziert (AC-17).
  - In Lauf 3 geprüft: AC-1, AC-2, AC-4 (Stichprobe) und AC-22.
  - Die übrigen sind aus Lauf 2 übernommen.
  - Edge Cases: 10/10 bestanden (übernommen).
- **Bugs:** 6 insgesamt (0 Critical, 1 High, 1 Medium, 4 Low).
  - Fixed: 2 (BUG-1, BUG-2).
  - Open: 0.
  - Deferred: 4 (BUG-3 bis BUG-6, alle Low).
  - Neue Befunde in Lauf 3: keine.
- **Security:** 11 Prüfungen: 9 ohne Befund verifiziert (3 davon in Lauf 3, 6 übernommen), 2 NOT VERIFIED (Rate Limiting auf `/api/prices` bewusst nicht implementiert; Massen-Registrierung nicht abgefeuert).
- **Production Ready:** JA. Es gibt keinen offenen Critical-, High- oder Medium-Bug, und die Laufzeit-Kriterien wurden gegen die laufende App geprüft.
- **Empfehlung:** freigeben (Approved). Die 4 Low-Bugs gesammelt über `/build PROJ-2 deferred` beheben, sobald gewünscht.

> „Production Ready: JA“ heißt nur *keine blockierenden Bugs*, nicht, dass alles geprüft wurde. Die Punkte unter „Nicht verifiziert in diesem Lauf“ (vor allem Darstellung auf dem Handy, Interaktion mit dem Diagramm, Cross-Browser) bleiben offen und brauchen einen Menschen oder `/e2e-tests`.
