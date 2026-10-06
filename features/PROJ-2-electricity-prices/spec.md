# PROJ-2: Strompreise

<!-- This file (spec.md) is the stable CONTRACT — it defines WHAT, not HOW.
     Owner: /write-spec (creates), /refine (updates). During /build this file is READ-ONLY.
     Technical design lives in design.md, QA results in qa-report.md.
     No status or date fields here: the feature's status lives ONLY in features/INDEX.md,
     and git records when this file changed. -->

## Abhängigkeiten
- Benötigt: PROJ-1 (Benutzerkonto & Login) – für den geschützten Bereich `/dashboard`, in dem der Abschnitt „Strompreise“ unter dem Seitentitel „Übersicht“ steht, und für die Prüfung, ob jemand angemeldet ist.
- Wird genutzt von: PROJ-3 (Geräte & Startfenster) – rechnet mit denselben Day-ahead-Preisen.

## User Stories
- Als Haushalt mit dynamischem Stromtarif möchte ich auf einen Blick sehen, was Strom gerade an der Börse kostet, damit ich einschätzen kann, ob jetzt ein guter Moment für große Verbraucher ist.
- Als Haushalt mit dynamischem Stromtarif möchte ich sehen, wann es heute ab jetzt am günstigsten und am teuersten wird, damit ich Waschmaschine oder Spülmaschine passend verschieben kann.
- Als Haushalt mit dynamischem Stromtarif möchte ich die Preise für morgen sehen, sobald sie veröffentlicht sind, damit ich z. B. das Laden des E-Autos über Nacht planen kann.
- Als Laie ohne Fachwissen möchte ich den Tagesverlauf in ct/kWh und mit verständlichen Farben (günstig / mittel / teuer) sehen, damit ich keine Börsendaten in EUR/MWh deuten muss.
- Als Nutzer mit Screenreader möchte ich die Preise auch als Tabelle abrufen können, damit ich nicht auf das Diagramm angewiesen bin.
- Als Nutzer möchte ich klar erkennen, dass es sich um den reinen Börsenpreis handelt, damit ich ihn nicht mit meinem Tarifpreis verwechsle.

## Out of Scope
- Echter Endkundenpreis mit Netzentgelten, Steuern und Umlagen (Nicht-Ziel laut PRD)
- Startfenster-Empfehlung pro Gerät (PROJ-3)
- Benachrichtigungen bei günstigen Preisen (Nicht-Ziel laut PRD)
- Vergangene Tage, historische Preise und Preise über „morgen“ hinaus
- Andere Gebotszonen als Deutschland/Luxemburg (DE-LU)
- Umschalter auf Stundenmittel oder andere Raster (bewusst nur 15 Minuten)
- Export der Preise (CSV o. Ä.)
- Preisanzeige für nicht angemeldete Besucher (z. B. auf einer öffentlichen Startseite)
- Wahl einer anderen Zeitzone als der deutschen Zeit

## Acceptance Criteria

### Abschnitt & Zugriff
- [ ] **AC-1** — Angenommen der Nutzer ist angemeldet, wenn er `/dashboard` öffnet, dann sieht er unter dem Seitentitel einen Abschnitt „Strompreise“ mit den Tabs „Heute“ und „Morgen“, und „Heute“ ist vorausgewählt.
- [ ] **AC-2** — Angenommen jemand ist nicht angemeldet, wenn er die Preisdaten der App abruft (über die Seite oder direkt über einen Endpunkt der App), dann erhält er keine Preise (Weiterleitung zu `/login` bzw. Ablehnung der Anfrage).

### Diagramm & Werte
- [ ] **AC-3** — Angenommen Preise für den gewählten Tag liegen vor, wenn der Tab angezeigt wird, dann zeigt ein Balkendiagramm jeden 15-Minuten-Slot des Tages als eigenen Balken, mit der Uhrzeit (0–24 Uhr) auf der x-Achse und ct/kWh auf der y-Achse.
- [ ] **AC-4** — Angenommen die Quelle liefert einen Preis in EUR/MWh, wenn er angezeigt wird, dann erscheint er als ct/kWh (EUR/MWh ÷ 10), gerundet auf eine Nachkommastelle im deutschen Zahlenformat (z. B. 160,55 EUR/MWh → „16,1 ct/kWh“), und jeder angezeigte Wert stimmt nach dieser Umrechnung mit dem Wert der Energy-Charts-Quelle für denselben Slot überein.
- [ ] **AC-5** — Angenommen das Diagramm wird angezeigt, wenn der Nutzer mit der Maus über einen Balken fährt, ihn antippt oder ihn per Tastatur fokussiert, dann sieht er Zeitraum und Preis dieses Slots (z. B. „13:15–13:30 · 8,4 ct/kWh“).
- [ ] **AC-6** — Angenommen ein Preis ist negativ, wenn er angezeigt wird, dann trägt er ein Minuszeichen (z. B. „−0,5 ct/kWh“), und sein Balken reicht unter die Nulllinie.
- [ ] **AC-7** — Angenommen Preise für den gewählten Tag liegen vor, wenn das Diagramm angezeigt wird, dann wird die Spanne vom niedrigsten bis zum höchsten Preis des ganzen angezeigten Tages in Drittel geteilt: Balken im unteren Drittel sind grün (günstig), im mittleren neutral grau (mittel), im oberen bernsteinfarben (teuer), und eine Legende benennt die drei Stufen in Worten.
- [ ] **AC-8** — Angenommen der günstigste und der teuerste Slot sind bestimmt (AC-10 bzw. AC-12), wenn das Diagramm angezeigt wird, dann tragen diese beiden Balken zusätzlich zur Farbe ein Label und ein Icon.
- [ ] **AC-9** — Angenommen mehrere Slots haben denselben niedrigsten (bzw. höchsten) Preis, wenn der günstigste (bzw. teuerste) Slot bestimmt wird, dann gilt der früheste dieser Slots.

### Tab „Heute“
- [ ] **AC-10** — Angenommen der Tab „Heute“ ist gewählt, wenn die Kennzahlen angezeigt werden, dann zeigen drei Kennzahlen „Jetzt“ (Preis des aktuellen Slots), „Günstigster ab jetzt“ und „Teuerster ab jetzt“ (jeweils Uhrzeit des Slots und Preis), wobei nur der aktuelle und alle späteren Slots des heutigen Tages berücksichtigt werden.
- [ ] **AC-11** — Angenommen der Tab „Heute“ ist gewählt, wenn das Diagramm angezeigt wird, dann ist der aktuelle Slot mit der Hervorhebungsfarbe und dem Label „jetzt“ markiert, und alle vergangenen Slots sind ausgegraut, bleiben aber sichtbar.

### Tab „Morgen“
- [ ] **AC-12** — Angenommen die Preise für morgen sind veröffentlicht, wenn der Nutzer den Tab „Morgen“ wählt, dann sieht er das Diagramm des ganzen Tages ohne „jetzt“-Markierung und ohne ausgegraute Slots sowie die Kennzahlen „Ø Tagesdurchschnitt“ (Mittel aller Slots), „Günstigster“ und „Teuerster“ über den ganzen Tag.
- [ ] **AC-13** — Angenommen die Preise für morgen sind noch nicht veröffentlicht, wenn der Nutzer den Tab „Morgen“ wählt, dann sieht er einen Leerzustand mit dem Hinweis „Die Preise für morgen sind noch nicht veröffentlicht. Sie erscheinen meist ab ca. 13 Uhr.“ und keinen Fehler.

### Erklärung & Barrierefreiheit
- [ ] **AC-14** — Angenommen Preise werden angezeigt, wenn der Nutzer den Abschnitt ansieht, dann steht unter dem Diagramm der Hinweis „Reiner Börsenpreis ohne Netzentgelte, Steuern und Umlagen – dein Tarifpreis liegt höher.“
- [ ] **AC-15** — Angenommen Preise werden angezeigt, wenn der Nutzer den Abschnitt ansieht, dann nennt eine Quellenangabe die Herkunft der Daten mit Lizenz („Daten: Bundesnetzagentur | SMARD.de, über Energy-Charts, CC BY 4.0“) mit Link zur Quelle.
- [ ] **AC-16** — Angenommen Preise werden angezeigt, wenn der Nutzer „Als Tabelle anzeigen“ aufklappt, dann sieht er alle Slots des gewählten Tages mit Zeitraum und Preis, und der günstigste und der teuerste Slot sind in Textform gekennzeichnet.
- [ ] **AC-17** — Angenommen der Bildschirm ist 360 px breit, wenn der Abschnitt angezeigt wird, dann passen Kennzahlen und Diagramm ohne horizontales Scrollen auf die Seite, und Antippen eines Balkens zeigt dessen Zeitraum und Preis.

### Zeit & Aktualisierung
- [ ] **AC-18** — Angenommen das Gerät des Nutzers steht in einer anderen Zeitzone, wenn der Abschnitt angezeigt wird, dann gelten „heute“, „morgen“, „jetzt“ und alle Uhrzeiten trotzdem in deutscher Zeit (Europe/Berlin).
- [ ] **AC-19** — Angenommen das Dashboard ist geöffnet, wenn ein neuer 15-Minuten-Slot beginnt, dann rückt die „jetzt“-Markierung ohne Neuladen der Seite auf den neuen Slot, und die Kennzahlen „ab jetzt“ werden neu berechnet.
- [ ] **AC-20** — Angenommen die Preise für morgen fehlen noch und das Dashboard ist geöffnet, wenn sie veröffentlicht werden, dann erscheinen sie spätestens mit dem nächsten Slot-Wechsel ohne Neuladen der Seite.
- [ ] **AC-21** — Angenommen das Dashboard ist über Mitternacht (deutsche Zeit) geöffnet, wenn der neue Tag beginnt, dann zeigt „Heute“ die Preise des neuen Tages und „Morgen“ den Leerzustand aus AC-13, bis die nächsten Preise veröffentlicht sind.

### Laden & Fehler
- [ ] **AC-22** — Angenommen die Preise werden geladen, wenn der Abschnitt angezeigt wird, dann sieht der Nutzer Skeletons in der Form von Kennzahlen und Diagramm statt eines Vollbild-Spinners.
- [ ] **AC-23** — Angenommen die Energy-Charts-API ist nicht erreichbar oder antwortet nicht rechtzeitig und für den Tag liegen keine zwischengespeicherten Preise vor, wenn der Abschnitt geladen wird, dann sieht der Nutzer einen Fehlerhinweis „Die Strompreise konnten gerade nicht geladen werden.“ mit dem Button „Erneut versuchen“, und der Rest des Dashboards bleibt bedienbar.
- [ ] **AC-24** — Angenommen die Preise eines Tages wurden bereits einmal geladen und die Energy-Charts-API ist danach nicht erreichbar, wenn der Abschnitt erneut geladen wird, dann werden die zwischengespeicherten Preise ohne Warnhinweis angezeigt.

## Edge Cases
- **EC-1** — Angenommen es ist der Tag der Umstellung auf Sommerzeit (März), wenn die Preise angezeigt werden, dann hat der Tag 92 Slots, die ausgefallene Stunde 02:00–03:00 erscheint weder als Balken noch als Lücke, und Kennzahlen und Durchschnitt beziehen sich auf die 92 Slots.
- **EC-2** — Angenommen es ist der Tag der Umstellung auf Winterzeit (Oktober), wenn die Preise angezeigt werden, dann hat der Tag 100 Slots, die doppelte Stunde 02:00–03:00 erscheint zweimal, und Tooltip und Tabelle unterscheiden beide mit „MESZ“ bzw. „MEZ“.
- **EC-3** — Angenommen es ist der letzte Slot des Tages (23:45–24:00), wenn der Tab „Heute“ angezeigt wird, dann zeigen „Jetzt“, „Günstigster ab jetzt“ und „Teuerster ab jetzt“ denselben Slot, ohne Fehler.
- **EC-4** — Angenommen einzelne Slots fehlen in den Daten der Quelle, wenn der Tag angezeigt wird, dann erscheinen sie als Lücke im Diagramm und als „keine Daten“ in der Tabelle, Kennzahlen, Durchschnitt und Farbstufen berücksichtigen nur vorhandene Slots, und fehlt der aktuelle Slot, zeigt „Jetzt“ „Kein Preis verfügbar“.
- **EC-5** — Angenommen die Quelle ist erreichbar, liefert aber für heute gar keine Preise, wenn der Tab „Heute“ geladen wird, dann sieht der Nutzer den Fehlerhinweis aus AC-23 (nicht den Leerzustand aus AC-13, denn heutige Preise sind immer veröffentlicht).
- **EC-6** — Angenommen alle Slots des angezeigten Tages haben denselben Preis, wenn das Diagramm angezeigt wird, dann sind alle Balken neutral grau, und günstigster und teuerster Slot sind nach AC-9 der früheste Slot.
- **EC-7** — Angenommen der Browser-Tab lag im Hintergrund oder der Rechner war im Standby, wenn der Nutzer zum Dashboard zurückkehrt, dann zeigen „jetzt“-Markierung und Kennzahlen sofort den aktuellen Slot (und ggf. den neuen Tag), nicht den Stand von vorher.
- **EC-8** — Angenommen eine automatische Aktualisierung (AC-19 bis AC-21) schlägt fehl, wenn für den angezeigten Tag schon Preise da sind, dann bleiben diese ohne Fehlerhinweis stehen, und beim nächsten Slot-Wechsel wird es erneut versucht. Fehlen nach einem Tageswechsel die Preise für den neuen Tag, gilt AC-23.
- **EC-9** — Angenommen viele angemeldete Nutzer haben das Dashboard gleichzeitig offen, wenn ihre Ansichten sich zum Slot-Wechsel aktualisieren, dann sehen alle dieselben Preise, und die Energy-Charts-API wird nicht pro Nutzer abgefragt.
- **EC-10** — Angenommen der Nutzer wechselt zwischen „Heute“ und „Morgen“, wenn er den Tab wechselt, dann wird der andere Tag ohne erneuten Ladezustand angezeigt, sofern seine Preise schon geladen sind.

## Technische Anforderungen
- **Quelle:** Energy-Charts API, Gebotszone DE-LU, ohne API-Key. Die Abfrage läuft ausschließlich serverseitig; der Browser ruft Energy-Charts nie direkt auf (so geht auch keine Nutzer-IP an den Drittanbieter).
- **Zwischenspeicher:** Preise werden serverseitig kurz zwischengespeichert, nicht in der Datenbank abgelegt (siehe `docs/data-model.md`). Die Abfragehäufigkeit an Energy-Charts ist unabhängig von der Zahl der Nutzer (EC-9).
- **Antwortzeit:** Spätestens 10 Sekunden nach dem Öffnen zeigt der Abschnitt entweder Preise oder den Fehlerhinweis aus AC-23. Er hängt nie unbegrenzt im Ladezustand.
- **Sicherheit:** Nur für angemeldete Nutzer (AC-2).
- **Datenschutz:** Das Feature verarbeitet keine personenbezogenen Daten. Die Preise sind öffentlich und für alle gleich, und es wird nichts pro Nutzer gespeichert.
- **Gestaltung:** Farben, Kennzahlen, Lade-, Leer- und Fehlerzustand folgen `docs/design-system.md` (Preisskala `--chart-1` bis `--chart-4`, Farbe nie als einziges Signal, `tabular-nums`).
- **Browser:** aktuelle Versionen von Chrome, Firefox, Safari und Edge, mobil und Desktop.

## Offene Fragen
- [x] Nutzungsbedingungen und eventuelle Abfragegrenzen der Energy-Charts-API prüfen – entscheidet in `/architecture` mit, wie lange zwischengespeichert wird. → Beantwortet in `design.md` (2 Anfragen/Minute pro IP, 429 mit `Retry-After`, CC BY 4.0 mit Nennung von Energy-Charts.info).

## Entscheidungslog

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Diagramm + drei Kennzahlen, Tabelle aufklappbar | Kennzahlen beantworten die Laienfrage „wann?“ sofort, das Diagramm zeigt den Verlauf, die Tabelle macht beides für Screenreader zugänglich. | 2026-10-06 |
| 15-Minuten-Raster, kein Stundenmittel | Entspricht der Quelle (PRD-Erfolgskriterium: Preise stimmen mit Energy-Charts überein) und dem Raster, mit dem PROJ-3 rechnet. | 2026-10-06 |
| „Heute“: günstigster/teuerster Zeitpunkt nur ab jetzt | Ein günstigster Moment, der schon vorbei ist, hilft niemandem. Vergangene Slots bleiben ausgegraut sichtbar, damit der Tagesverlauf lesbar bleibt. | 2026-10-06 |
| „Morgen“: Tagesdurchschnitt statt „Jetzt“ | „Jetzt“ hat für morgen keine Bedeutung. Der Durchschnitt hilft einzuordnen, ob morgen insgesamt günstiger ist. | 2026-10-06 |
| Bei Gleichstand gilt der früheste Slot | Eindeutig und testbar. Früher starten ist für Nutzer meist praktischer. | 2026-10-06 |
| Morgen-Tab ist vor der Veröffentlichung wählbar und zeigt einen Hinweis | Ein ausgegrauter Tab mit Tooltip ist auf Touchgeräten schwer erklärbar. Ein ausgeblendeter Tab verschweigt, dass die Preise noch kommen. | 2026-10-06 |
| ct/kWh mit einer Nachkommastelle, Hinweis „reiner Börsenpreis“ | Laien kennen ct/kWh von ihrer Rechnung, eine zweite Nachkommastelle wäre nur Unruhe. Der Hinweis verhindert, dass der Börsenpreis mit dem Tarifpreis verwechselt wird. | 2026-10-06 |
| Farbstufen: Drittel der Tagesspanne (günstig / mittel / teuer) | Man sieht auf einen Blick, wann es allgemein günstig ist, nicht nur den einen besten Slot. Ein stufenloser Verlauf wäre für Laien schwerer zu deuten. | 2026-10-06 |
| Automatische Aktualisierung zu jedem Slot-Wechsel | „jetzt“ und die Kennzahlen veralten sonst, und die Preise für morgen erscheinen ohne Neuladen. | 2026-10-06 |
| Bei API-Ausfall zwischengespeicherte Preise ohne Warnung zeigen | Day-ahead-Preise ändern sich nach der Veröffentlichung nicht mehr. Zwischengespeicherte Werte sind also nicht veraltet. | 2026-10-06 |
| Immer deutsche Zeit (Europe/Berlin) | Die Preise gelten für die Gebotszone DE-LU. „Heute“ soll der Börsentag sein, unabhängig von der Zeitzone des Geräts. | 2026-10-06 |
| Quellenangabe mit Lizenz im Abschnitt | Die Daten stehen unter CC BY 4.0 (Bundesnetzagentur / SMARD.de), die Lizenz verlangt eine Namensnennung. | 2026-10-06 |
| Preise nur für angemeldete Nutzer | Die App soll kein offener Proxy für Energy-Charts sein; laut PRD gehören die Preise zum geschützten Dashboard. | 2026-10-06 |
