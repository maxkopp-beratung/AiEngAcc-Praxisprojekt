# PROJ-2 – Technisches Design: Strompreise

> Das technische Design (das WIE) für das Feature. Zwei Leser: die PM (gibt frei) und `/build` (setzt danach um). Kein Code, aber so genau, dass niemand raten muss.
> Owner: `/architecture`. Der Vertrag (WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.
> Kein Status- oder Datumsfeld hier – der Status steht nur in `features/INDEX.md`.

## Überblick

Der Abschnitt „Strompreise“ hängt sich in das bestehende Dashboard von PROJ-1 ein (`docs/app-shell.md`). Es gibt keine neue Seite, keine Navigation und keine Datenbanktabelle.

```
Browser (Dashboard)                     Unser Server                          Energy-Charts
──────────────────                      ──────────                            ─────────────
Erster Aufruf von /dashboard ─────────► Preis-Dienst ──┐
                                                       ├─ Zwischenspeicher ─► GET /price
Alle 15 Min / Tageswechsel ── /api/prices ─► Preis-Dienst ┘  (eine Anfrage für    (max. 2 / Min.)
(nur wenn nötig)                                            heute + morgen)
```

- **Preis-Dienst (Server):** holt die Preise von Energy-Charts, prüft die Antwort, teilt sie in „heute“ und „morgen“ (deutsche Zeit) und speichert sie im Arbeitsspeicher. Die Seite und der Endpunkt `/api/prices` nutzen ihn, später auch PROJ-3.
- **Abschnitt im Browser:** bekommt die Preise beim ersten Laden fertig mitgeliefert. Danach rechnet er „jetzt“, Kennzahlen, Farben und Markierungen selbst. Nur zum Nachladen (morgen fehlt noch, Tageswechsel, „Erneut versuchen“) fragt er `/api/prices` ab.
- **Der Browser spricht nie mit Energy-Charts.** So geht keine Nutzer-IP an den Drittanbieter, und die Abfragegrenze der API gilt nur für unseren Server.

## Component Structure

```
/dashboard  (Seite von PROJ-1, Seitentitel „Übersicht“)
+-- Abschnitt „Strompreise“                       PriceSection (Server)
    |   lädt die Preise über den Preis-Dienst; während des Ladens: PriceSectionSkeleton (AC-22)
    +-- PricePanel                                (Browser – hält Zustand, Uhr und Nachladen)
        +-- Kopf: Titel „Strompreise“ + Tabs „Heute“ | „Morgen“   (shadcn Tabs; „Heute“ vorausgewählt, AC-1)
        +-- Fehlerzustand (statt Tabs, wenn heute nicht geladen werden kann)   (shadcn Alert, AC-23, EC-5)
        |     „Die Strompreise konnten gerade nicht geladen werden.“ + Button „Erneut versuchen“
        +-- Tab „Heute“  → DayView (Modus „heute“)
        |     +-- KeyFigures: „Jetzt“ · „Günstigster ab jetzt“ · „Teuerster ab jetzt“   (AC-10)
        |     +-- PriceChart: Balken, „jetzt“-Markierung, vergangene ausgegraut,
        |     |               Label + Icon an günstigstem/teuerstem Slot, Legende   (AC-3, 5–8, 11)
        |     +-- PriceTable: aufklappbar „Als Tabelle anzeigen“   (shadcn Collapsible + Table, AC-16)
        +-- Tab „Morgen“ → DayView (Modus „ganzer Tag“) oder Leerzustand
        |     +-- KeyFigures: „Ø Tagesdurchschnitt“ · „Günstigster“ · „Teuerster“   (AC-12)
        |     +-- PriceChart / PriceTable wie oben, ohne „jetzt“ und ohne Ausgrauen
        |     +-- Leerzustand (gestrichelte Karte, Icon, Text aus AC-13)
        +-- Fußzeile des Abschnitts
              +-- „Reiner Börsenpreis ohne Netzentgelte, Steuern und Umlagen – dein Tarifpreis liegt höher.“ (AC-14)
              +-- „Daten: Bundesnetzagentur | SMARD.de, über Energy-Charts, CC BY 4.0“ mit Link (AC-15)
```

**Einhängen ins Dashboard:** `src/app/dashboard/page.tsx` (PROJ-1) bekommt den Abschnitt unter dem Seitentitel. Der Platzhaltersatz dort wird zu „Hier siehst du bald deine Geräte.“ gekürzt, weil die Preise jetzt da sind. Kopfzeile, Layout und Schutz der Seite bleiben unverändert.

**Wiederverwendet (schon installiert):** `Tabs`, `Card`, `Alert`, `Button`, `Skeleton`, `Collapsible`, `Table`, `Tooltip`, Icons aus `lucide-react`.
**Neu per shadcn:** `chart` (`npx shadcn@latest add chart`). Es bringt `recharts` mit und liest die Farben aus den Tokens `--chart-1` bis `--chart-4`.

### Darstellung im Detail

**Kennzahlen (KeyFigures):** drei Karten nebeneinander, unter 640 px Breite untereinander (AC-17). Jede Karte hat eine Überschrift, einen großen Preis (`tabular-nums`, 600) und darunter die Uhrzeit des Slots.
- „Jetzt“: Preis des aktuellen Slots und die Stufe in Worten („günstig“/„mittel“/„teuer“). Fehlt der Preis: „Kein Preis verfügbar“ (EC-4).
- „Günstigster ab jetzt“ / „Teuerster ab jetzt“: Beginn des Slots, z. B. „13:15 Uhr“, und Preis.
- Morgen: „Ø Tagesdurchschnitt“ (Mittel aller vorhandenen Preise) statt „Jetzt“; „Günstigster“ und „Teuerster“ über den ganzen Tag.

**Diagramm (PriceChart):**
- Ein Balken pro Slot, in zeitlicher Reihenfolge: 92, 96 oder 100 Balken. Die Breite passt sich dem Container an, es gibt nie horizontales Scrollen (AC-17).
- x-Achse: Beschriftung alle 3 Stunden („0“, „3“, … „21“), unter 640 px alle 6 Stunden. y-Achse in ct/kWh mit Nulllinie; negative Balken reichen nach unten (AC-6).
- Balkenfarbe nach Stufe (siehe Preislogik): günstig = `--chart-1`, mittel = `--chart-2`, teuer = `--chart-3` (AC-7).
- Tab „Heute“: Slots, deren Ende vorbei ist, in `muted` ohne Stufenfarbe (ausgegraut, AC-11). Der aktuelle Slot in `--chart-4` mit Label „jetzt“ darüber.
- Günstigster und teuerster Slot (heute: ab jetzt, morgen: ganzer Tag) mit Icon (`ArrowDown` / `ArrowUp`) und Label „günstigst“ / „teuerst“ über dem Balken (AC-8). Ist es derselbe Slot (EC-3, EC-6), stehen beide Labels übereinander.
- Fehlende Slots: kein Balken, die Stelle bleibt leer (EC-4).
- Tooltip bei Hover, Tippen und Tastaturfokus: „13:15–13:30 · 8,4 ct/kWh“ (AC-5). Tastatur: Das Diagramm ist ein einziger Tab-Stopp, Pfeiltasten wandern von Slot zu Slot (Recharts-Option für Barrierefreiheit). Es gibt keine 96 einzelnen Tab-Stopps.
- Legende unter dem Diagramm in Worten: „günstig“, „mittel“, „teuer“, und im Tab „Heute“ zusätzlich „jetzt“ und „vorbei“.

**Tabelle (PriceTable):** zugeklappt per Standard. Spalten „Zeitraum“ und „Preis“. Der günstigste und der teuerste Slot bekommen in einer dritten Spalte „Hinweis“ den Text „günstigster Zeitpunkt“ / „teuerster Zeitpunkt“. Fehlende Slots stehen als „keine Daten“ in der Tabelle (EC-4).

## Data Model

Es wird **nichts in der Datenbank gespeichert**. Es gibt keine Migration und keine RLS-Änderung. Die Preise liegen nur im Arbeitsspeicher des Servers (siehe Zwischenspeicher).

**Preis-Paket** (was der Preis-Dienst liefert, gleich für Seite und `/api/prices`):
- `generatedAt` – Zeitpunkt (UTC), zu dem das Paket erstellt wurde
- `today` – ein Tagespaket
- `tomorrow` – ein Tagespaket

**Tagespaket:**
- `date` – Kalendertag in deutscher Zeit, Format `JJJJ-MM-TT`
- `status` – genau einer von:
  - `ok` – Preise liegen vor
  - `not_published` – noch nicht veröffentlicht (nur bei „morgen“ möglich)
  - `error` – konnte nicht geladen werden und liegt auch nicht im Zwischenspeicher (nur bei „heute“ möglich; liefert die Quelle für heute nichts, ist das ebenfalls `error`, EC-5)
- `slots` – nur bei `ok`: lückenlose, zeitlich sortierte Liste **aller** 15-Minuten-Slots dieses Tages in deutscher Zeit, also 96 Slots, am Tag der Umstellung auf Sommerzeit 92, auf Winterzeit 100 (EC-1, EC-2)

**Slot:**
- `start` – Beginn als UTC-Zeitpunkt (ISO 8601); das Ende ist immer `start` + 15 Minuten
- `priceEurMwh` – Zahl (auch negativ oder 0) genau wie von der Quelle, ungerundet; `null`, wenn die Quelle für diesen Slot nichts liefert (EC-4)

Die Slots kommen absichtlich als absolute UTC-Zeitpunkte. So kann der Browser „jetzt“ unabhängig von der Zeitzone des Geräts bestimmen (AC-18). Nur zum **Anzeigen** wird in deutsche Zeit umgerechnet.

### Preislogik (gemeinsame, reine Funktionen – im Browser und auf dem Server nutzbar, für PROJ-3 wiederverwendbar)

- **Umrechnung (AC-4):** ct/kWh = EUR/MWh ÷ 10. Angezeigt wird auf eine Nachkommastelle gerundet (kaufmännisch), im deutschen Format mit Komma und mit echtem Minuszeichen „−“ bei negativen Werten, z. B. „16,1 ct/kWh“, „−0,5 ct/kWh“. Gerechnet und verglichen wird immer mit dem ungerundeten EUR/MWh-Wert.
- **Aktueller Slot:** der Slot mit `start` ≤ jetzt < `start` + 15 Minuten.
- **Betrachteter Bereich:** Tab „Heute“ = aktueller Slot und alle späteren des Tages; Tab „Morgen“ = alle Slots.
- **Günstigster / teuerster Slot (AC-9, AC-10, AC-12):** niedrigster bzw. höchster Preis im betrachteten Bereich, nur Slots mit Preis. Bei Gleichstand gilt der früheste. Gibt es im Bereich keinen Preis, steht in der Kennzahl „Kein Preis verfügbar“.
- **Tagesdurchschnitt:** arithmetisches Mittel aller Slots des Tages mit Preis.
- **Stufe eines Slots (AC-7, EC-6):** Min und Max sind der niedrigste und höchste Preis des **ganzen** angezeigten Tages, auch vergangene Slots, nur Slots mit Preis. Ist Max = Min, sind alle Slots „mittel“. Sonst ist t = (Preis − Min) ÷ (Max − Min): t < 1/3 → „günstig“, t > 2/3 → „teuer“, sonst „mittel“.
- **Zeitraum-Beschriftung:** „HH:MM–HH:MM“ in deutscher Zeit; das Ende des letzten Slots heißt „24:00“. Am Tag mit 100 Slots tragen die Slots von 02:00 bis 02:45 beim ersten Durchlauf den Zusatz „MESZ“, beim zweiten „MEZ“, in Tooltip und Tabelle (EC-2). An allen anderen Tagen gibt es keinen Zusatz.

## Behaviors & Access

### Preis-Dienst (serverseitig, nicht direkt aufrufbar)
**„Preise für heute und morgen holen“:**
1. Er bestimmt „heute“ und „morgen“ als Kalendertage in deutscher Zeit, vom aktuellen Zeitpunkt aus.
2. Liegt ein gültiger Eintrag im Zwischenspeicher, gibt er ihn ohne Anfrage zurück.
3. Sonst fragt er **einmal** an: `GET https://api.energy-charts.info/price?bzn=DE-LU&start=<heute>&end=<morgen>` (Tagesformat). Die API liefert in einer Antwort heute und, falls schon veröffentlicht, auch morgen. Fehlt morgen, kommen nur die Slots von heute. Dieses Verhalten wurde am 2026-10-06 geprüft.
4. Die Antwort wird gegen ein Schema geprüft: `unix_seconds` ist eine Liste ganzer Zahlen, `price` eine gleich lange Liste aus Zahlen oder `null`. Passt das nicht, gilt die Antwort als Fehler.
5. Jeder Wert wird über seinen Zeitstempel dem passenden Tag (deutsche Zeit) und Slot zugeordnet. Slots ohne Wert werden mit `null` aufgefüllt. Werte außerhalb von heute/morgen werden verworfen.
6. Status: heute ohne einen einzigen Wert → `error` (EC-5). Morgen ohne einen einzigen Wert → `not_published`. Sonst `ok`.
7. Fehler sind: Zeitüberschreitung nach **8 Sekunden**, Netzwerkfehler, HTTP-Status ≠ 200 (auch 404 und 429) und eine ungültige Antwort. Bei einem Fehler gilt Schritt 8 aus dem Zwischenspeicher.

### Zwischenspeicher (im Arbeitsspeicher des Server-Prozesses)
- Er ist ein einziger Speicher für den ganzen Server-Prozess, gemeinsam für Seite und Endpunkt und für alle Nutzer (EC-9). Er wird so abgelegt, dass Neuladen im Entwicklungsmodus und getrennte Bundles ihn nicht verdoppeln (prozessweit, nicht pro Modul).
- **Schlüssel:** der heutige Kalendertag in deutscher Zeit. Um Mitternacht gibt es automatisch einen neuen Schlüssel, alte Einträge werden verworfen.
- **Gültigkeit eines Eintrags:**
  - Heute und morgen beide vollständig (keine `null`-Slots) → gültig bis Mitternacht deutscher Zeit
  - Morgen `not_published` und es ist **vor 12:00 Uhr** deutscher Zeit → gültig bis 12:00 Uhr. Die Börsenauktion schließt erst um 12:00, vorher wäre jede Anfrage verschwendet.
  - Morgen `not_published` und es ist **ab 12:00 Uhr** → gültig für **60 Sekunden** (AC-20)
  - Ein Tag hat Lücken (`null`-Slots) → gültig für 15 Minuten, dann wird erneut gefragt
- **Bei einem Fehler (Schritt 7):**
  - Gibt es für heute schon einen Eintrag, auch einen abgelaufenen, wird er ohne Warnung ausgeliefert (AC-24, Day-ahead-Preise ändern sich nicht mehr). Der nächste Versuch kommt frühestens nach 30 Sekunden, oder nach der Zeit aus `Retry-After`, falls die API sie bei 429 nennt.
  - Gibt es keinen Eintrag, liefert der Dienst `today.status = error` und `tomorrow.status = not_published`. Auch dieser Fehler wird 30 Sekunden (bzw. `Retry-After`) gemerkt, damit „Erneut versuchen“ vieler Nutzer die API nicht überrennt.
- **Gleichzeitige Anfragen:** Laufen mehrere Aufrufe, während schon eine Anfrage an Energy-Charts unterwegs ist, warten sie auf **dieselbe** Anfrage. Es gibt nie zwei gleichzeitige Anfragen (EC-9).
- **Ergebnis:** höchstens etwa eine Anfrage pro Minute, und das nur zwischen 12:00 Uhr und der Veröffentlichung. Den Rest des Tages ist es meist eine Anfrage pro Tag. Das liegt sicher unter der Grenze der API (2 Anfragen pro Minute pro IP, bei Last weniger).

### Endpunkt `GET /api/prices`
- **Wer:** nur angemeldete Nutzer. Die Sitzung wird im Endpunkt selbst gegen Supabase Auth geprüft, wie im Dashboard-Layout von PROJ-1. Ohne gültige Sitzung → **401** mit `{ "error": "unauthorized" }` und **ohne Preise** (AC-2). Der Proxy von PROJ-1 leitet `/api/*` nicht um, der Endpunkt schützt sich also selbst.
- **Eingaben:** keine. Es gibt keine Query-Parameter, also auch nichts zu validieren. Unbekannte Parameter werden ignoriert.
- **Antwort:** **200** mit dem Preis-Paket. Das gilt auch, wenn `today.status = error`: Der Fehler ist ein Datenzustand, kein Serverfehler, und der Abschnitt zeigt dafür sein Alert.
- **Header:** `Cache-Control: private, no-store`. Weder Browser noch Zwischenstationen sollen die Antwort für andere speichern.
- **Erlaubte Methode:** nur GET. Alles andere → 405 (Standardverhalten des Frameworks).

### Seite `/dashboard`
- Der Abschnitt ruft den Preis-Dienst **direkt auf dem Server** auf (keine HTTP-Runde zu `/api/prices`). Die Anmeldeprüfung übernimmt das Dashboard-Layout von PROJ-1.
- Der Abschnitt steht in einer eigenen Suspense-Grenze. Kopfzeile und Seitentitel erscheinen sofort, die Preise kommen nach, und bis dahin zeigt der Abschnitt das Skeleton (AC-22). Ein langsamer oder ausgefallener Preis-Dienst blockiert so nie den Rest des Dashboards (AC-23).
- Obergrenze: 8 Sekunden Zeitüberschreitung beim Abruf plus Verarbeitung. Damit zeigt der Abschnitt spätestens nach rund 10 Sekunden Preise oder den Fehler (Technische Anforderung der Spec).

### Verhalten im Browser (PricePanel)
- **Uhr (AC-19):** Ein Timer läuft genau bis zum Beginn des nächsten 15-Minuten-Slots, gerechnet aus den Slot-Zeitpunkten, nicht aus der Gerätezeitzone. Bei Ablauf wird „jetzt“ neu bestimmt, Kennzahlen und Markierungen werden neu berechnet, dann wird der nächste Timer gestellt.
- **Rückkehr aus Hintergrund/Standby (EC-7):** Wird die Seite wieder sichtbar, berechnet sich alles sofort neu und der Timer wird neu gestellt. Die Schritte „Nachladen“ und „Tageswechsel“ unten laufen dabei genauso.
- **Nachladen (AC-20):** Bei jedem Slot-Wechsel (und bei Rückkehr) wird `/api/prices` abgefragt, **nur wenn** morgen nicht `ok` ist oder ein Tageswechsel ansteht. Sonst gibt es keine Anfrage.
- **Tageswechsel um Mitternacht (AC-21):** Ist der letzte Slot von heute vorbei, wird sofort „morgen“ zu „heute“ (falls vorhanden) und „morgen“ zeigt den Leerzustand. Danach folgt eine Abfrage von `/api/prices`, deren Ergebnis den Stand ersetzt.
- **Nachladen schlägt fehl (EC-8):** Bei Netzwerkfehler, 5xx oder `today.status = error`, solange die angezeigten Daten noch zum heutigen Tag passen, bleibt der bisherige Stand ohne Fehlerhinweis stehen. Der nächste Versuch kommt beim nächsten Slot-Wechsel. Passt der Stand nicht mehr zum heutigen Tag und kann nichts nachrücken, erscheint der Fehlerzustand.
- **401 beim Nachladen:** Die Sitzung ist abgelaufen oder das Konto wurde gelöscht. Dann wird die Seite neu geladen, und der Schutz von PROJ-1 leitet zu `/login` weiter.
- **„Erneut versuchen“ (AC-23):** fragt `/api/prices` sofort ab. Während der Anfrage ist der Button deaktiviert und zeigt einen Ladehinweis.
- **Tab-Wechsel (EC-10):** Beide Tage liegen schon im Browser, ein Tab-Wechsel lädt nichts nach.
- Der gewählte Tab bleibt beim automatischen Aktualisieren erhalten. Er wird nicht gespeichert, beim Neuladen ist wieder „Heute“ gewählt (AC-1).

## Dependencies

- `recharts` – Diagramm-Bibliothek, kommt mit der shadcn-Komponente `chart` (mit `npx shadcn@latest add chart` installieren, nicht von Hand)
- `date-fns` + `@date-fns/tz` – zuverlässige Kalendertag- und Zeitumstellungs-Rechnung in Europe/Berlin (Tagesgrenzen, 92/100-Slot-Tage, „MESZ“/„MEZ“)

## Testbarkeit (Hinweis für `/build` und `/qa`)

- **Uhrzeit und Energy-Charts werden in Tests ersetzt.** Die Preislogik bekommt „jetzt“ als Eingabe übergeben. Der Preis-Dienst bekommt Abruf und Uhr von außen, damit Tests ohne echte API und mit fester Uhrzeit laufen. Echte Aufrufe an Energy-Charts in Tests würden die Abfragegrenze reißen.
- Pflicht-Testfälle für die Preislogik: 92-, 96- und 100-Slot-Tag, negativer Preis, Gleichstand, alle Preise gleich, fehlende Slots, letzter Slot des Tages, Gerät in fremder Zeitzone.
- Pflicht-Testfälle für den Zwischenspeicher: vor/nach 12:00, 429 mit `Retry-After`, Ausfall mit und ohne vorhandenen Eintrag, gleichzeitige Aufrufe → eine Anfrage.

## Settings the user makes

Keine. Die Energy-Charts-API braucht keinen Schlüssel und keine Einstellung in einem Dashboard. Es gibt keine neue Umgebungsvariable.

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| Basis von PROJ-2 ist der Branch von PROJ-1 (gestapelt) | Das Design baut auf dem echten Dashboard-Rahmen, dem Proxy und den aktuellen `docs/` von PROJ-1 auf, ohne auf dessen QA zu warten. | Abzweigen von `main` | PROJ-2 darf erst nach PROJ-1 nach `main`; ändert die QA von PROJ-1 noch etwas, muss PROJ-2 nachgezogen werden (Rebase). | 2026-10-06 |
| Eigener Zwischenspeicher im Arbeitsspeicher statt Next.js-Datencache | Die Regeln sind fachlich (gültig bis Mitternacht, bis 12:00, 60 s, bei Ausfall alten Stand zeigen, `Retry-After` beachten) und lassen sich mit dem eingebauten Cache nicht sauber ausdrücken. Der Speicher ist durchschaubar und mit fester Uhr testbar. Die App läuft lokal in einem Prozess (kein Deployment laut PRD). | `fetch` mit `revalidate` / `unstable_cache` (gilt in Next 16 als Auslaufmodell) bzw. `use cache` (braucht das `cacheComponents`-Flag für die ganze App) | Nach einem Neustart des Servers ist der Speicher leer (eine Anfrage). Bei mehreren Server-Instanzen hätte jede ihren eigenen Speicher – für dieses Projekt nicht relevant. | 2026-10-06 |
| Eine Anfrage für heute und morgen zusammen | Die API liefert beide Tage in einer Antwort (geprüft). Bei 2 Anfragen pro Minute pro IP halbiert das den Verbrauch. | Je eine Anfrage pro Tag | Solange morgen fehlt, wird heute bei jeder Nachfrage nach morgen mitgeladen – ein paar KB, vernachlässigbar. | 2026-10-06 |
| Vor 12:00 Uhr keine Anfrage nach den Preisen für morgen | Die Day-ahead-Auktion schließt um 12:00 Uhr, vorher kann es keine Preise für morgen geben. Das spart den Großteil der Anfragen. | Ganztägig alle 60 s fragen | Würde die Börse ihre Zeiten ändern, kämen die Preise erst ab 12:00 an. Ein Regelwechsel ist nicht absehbar. | 2026-10-06 |
| Gleichzeitige Aufrufe teilen sich eine laufende Anfrage | Garantie für EC-9: Egal wie viele Nutzer gleichzeitig aktualisieren, Energy-Charts sieht höchstens eine Anfrage. | Jeder Aufruf fragt selbst, wenn der Speicher leer ist | Etwas mehr Logik im Dienst, dafür mit einem Test belegbar. | 2026-10-06 |
| Bei Ausfall alten Stand ohne Warnung zeigen, Fehler 30 s / `Retry-After` merken | Day-ahead-Preise sind nach der Veröffentlichung endgültig (AC-24). Das Merken des Fehlers schützt die Abfragegrenze, wenn viele „Erneut versuchen“ drücken. | Jeder Retry geht durch | „Erneut versuchen“ kann bis zu 30 s lang denselben Fehler zeigen. | 2026-10-06 |
| Erste Daten serverseitig in die Seite, danach `GET /api/prices` zum Nachladen | Kein Ladeflackern beim Öffnen, und der Rest des Dashboards bleibt dank Suspense sofort bedienbar. Zum Nachladen passt ein lesender GET-Endpunkt besser als eine Server Action, denn Server Actions sind POST und laufen nacheinander. | Nur clientseitig laden; Server Action zum Nachladen | Zwei Einstiege (Seite und Endpunkt), beide über denselben Preis-Dienst, damit sie nicht auseinanderlaufen. | 2026-10-06 |
| Endpunkt prüft die Sitzung selbst (401), zusätzlich zum Proxy | Sicherheitsregel: Anmeldung im Anfragepfad selbst prüfen. Der Proxy von PROJ-1 leitet nur `/dashboard` um. | Proxy-Regel für `/api/prices` erweitern | Keiner; eine Proxy-Änderung wäre eine Änderung am Rahmen von PROJ-1 (`/refine PROJ-1`). | 2026-10-06 |
| Kein eigenes Rate-Limit auf `/api/prices` | Der Endpunkt prüft keine Zugangsdaten, liefert nur Daten aus dem Zwischenspeicher an angemeldete Nutzer und kann Energy-Charts dank Speicher und geteilter Anfrage nicht überlasten. | App-Throttle pro Nutzer | Ein angemeldeter Nutzer könnte den Endpunkt häufig abfragen; das kostet nur Server-CPU, keine API-Anfragen. | 2026-10-06 |
| Slots als UTC-Zeitpunkte, Anzeige in Europe/Berlin über `@date-fns/tz` | „jetzt“ ist so unabhängig von der Gerätezeitzone (AC-18). Die Zeitumstellung wird von einer erprobten Bibliothek gerechnet statt von Hand (PRD: Empfehlung muss bei Zeitumstellung nachweislich stimmen, PROJ-3 erbt das). | Nur `Intl` mit selbstgebauter Offset-Rechnung | Zwei kleine Pakete mehr. | 2026-10-06 |
| Rohwert EUR/MWh wird übertragen, Umrechnung und Rundung erst bei der Anzeige | Eine einzige Stelle für AC-4. Vergleiche (günstigster, Gleichstand, Stufen) arbeiten mit dem exakten Quellwert, nicht mit gerundeten Werten. | Server liefert fertige ct/kWh | Der Browser formatiert selbst – über dieselbe gemeinsame Funktion. | 2026-10-06 |
| Diagramm mit shadcn `chart` (Recharts) | Projektkonvention „shadcn first“. Die Chart-Tokens aus dem Design-System passen direkt. Negative Werte, Lücken, Einzelfarben pro Balken, Referenzlinie und Tastaturnavigation sind eingebaut. | Eigenes SVG-Diagramm | Recharts ist eine größere Abhängigkeit (Bundle-Größe); dafür muss kein eigener Diagramm-Code mit Barrierefreiheit gepflegt werden. | 2026-10-06 |
| Diagramm ist ein Tab-Stopp mit Pfeiltasten-Navigation, Tabelle als Alternative | 96 einzelne Tab-Stopps wären eine Tastaturfalle. Die aufklappbare Tabelle ist die vollständige Alternative für Screenreader (AC-16). | Jeder Balken fokussierbar | Pfeiltasten-Navigation muss man kennen. Die Tabelle gleicht das aus. | 2026-10-06 |
| Antwort von Energy-Charts wird gegen ein Schema geprüft (Zod) | Eingaben von außen werden an der Grenze geprüft (Sicherheitsregel). Eine geänderte API soll den Fehlerzustand auslösen, nicht falsche Preise anzeigen. | Antwort ungeprüft übernehmen | Ändert Energy-Charts das Format, zeigt die App einen Fehler, bis das Schema angepasst ist. | 2026-10-06 |
| Zeitüberschreitung 8 s für die Anfrage an Energy-Charts | Hält die 10-Sekunden-Grenze der Spec samt Verarbeitung ein. Die API antwortet normalerweise in unter 0,5 s. | 5 s / 10 s | Bei sehr langsamer API greift früher der Fehler bzw. der alte Stand. | 2026-10-06 |

## Umsetzungsnotizen (`/build`)

- **Tippen fokussierte das Diagramm (in T14 gefunden, behoben):** Ein Klick oder Tippen auf einen Balken hat das Diagramm fokussiert. Die Tastatur-Schicht von Recharts springt beim Fokussieren auf den ersten Slot, also zeigte der Tooltip „00:00–00:15“ statt des angetippten Balkens. Jetzt verhindert der Rahmen des Diagramms den Fokus per Maus/Tippen (`mousedown` ohne Standardaktion); per Tab bleibt es fokussierbar. Abgesichert durch einen Test in `price-chart.test.tsx`.
- **Nach Mitternacht bleibt der Ausfallschutz erhalten:** Der Zwischenspeicher übernimmt beim Tageswechsel das bisherige „morgen“ als abgelaufenen Eintrag für „heute“. Fällt Energy-Charts direkt nach Mitternacht aus, zeigt die App so trotzdem die Preise des Tages (AC-24), statt des Fehlers.
- **Marker-Beschriftungen im Diagramm:** Ihre Breite wird geschätzt (SVG-Text wird nicht gemessen). Überlappende Labels werden übereinander gestapelt.
- **Abschnitt prüft die Sitzung selbst (BUG-2, behoben):** Abweichend von „Seite `/dashboard`“ verlässt sich `PriceSection` nicht mehr allein auf das Layout von PROJ-1. Next rendert Layout und Seite parallel, deshalb landeten bei serverseitig widerrufener Sitzung die Preise trotz Weiterleitung im Body. Der Abschnitt ruft jetzt vor `getPrices()` selbst `getUser()` auf und leitet ohne gültige Sitzung zu `/login` weiter. Dasselbe Muster gilt für PROJ-3: Jede Server-Komponente, die geschützte Daten lädt, prüft die Sitzung nahe an der Datenquelle.
- **Sub-Agenten ohne Worktree-Isolation:** Die parallelen Aufgaben liefen direkt im PROJ-2-Worktree, weil eine Isolation vom PROJ-1-Checkout abgezweigt wäre. Die `[P]`-Aufgaben hatten disjunkte Dateien, Git-Befehle lagen nur beim Hauptagenten.

## Open Questions

- [x] Nutzungsbedingungen und Abfragegrenzen der Energy-Charts-API (aus `spec.md`): Laut OpenAPI-Beschreibung gilt für `/price` ein Token-Bucket mit 2 Anfragen pro Minute pro IP (Burst 2), bei Last weniger. Bei Überschreitung kommt HTTP 429 mit `Retry-After`. Daten unter CC BY 4.0 mit Pflicht zur Nennung von Energy-Charts.info. → Der Zwischenspeicher oben ist darauf ausgelegt.
