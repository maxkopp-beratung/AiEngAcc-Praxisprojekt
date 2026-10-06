# PROJ-3: Geräte & Startfenster

<!-- This file (spec.md) is the stable CONTRACT — it defines WHAT, not HOW.
     Owner: /write-spec (creates), /refine (updates). During /build this file is READ-ONLY.
     Technical design lives in design.md, QA results in qa-report.md.
     No status or date fields here: the feature's status lives ONLY in features/INDEX.md,
     and git records when this file changed. -->

## Abhängigkeiten
- Benötigt: PROJ-1 (Benutzerkonto & Login) – für den geschützten Bereich `/dashboard`, in dem der Abschnitt „Meine Geräte“ steht, für die Zuordnung der Geräte zum Konto, für „Konto löschen“ (entfernt auch die Geräte) und für die Seite `/datenschutz`, die um die Geräte ergänzt wird (AC-26).
- Benötigt: PROJ-2 (Strompreise) – liefert die Day-ahead-Preise für heute und morgen im 15-Minuten-Raster, mit denen die Empfehlung rechnet, sowie deren Aktualisierung zum Slot-Wechsel.

## User Stories
- Als Haushalt mit dynamischem Stromtarif möchte ich meine Geräte einmal mit ihrer Laufzeit anlegen, damit ich sie nicht bei jedem Besuch neu eingeben muss.
- Als Haushalt mit dynamischem Stromtarif möchte ich pro Gerät eine klare Startzeit sehen („Starte um 13:15 Uhr“), damit ich nicht selbst ausrechnen muss, wann eine 2,5-Stunden-Wäsche am günstigsten läuft.
- Als Laie möchte ich sehen, wie viel günstiger das empfohlene Fenster im Vergleich zu „sofort starten“ ist, damit ich entscheiden kann, ob sich das Warten lohnt.
- Als neuer Nutzer ohne Geräte möchte ich mit einem Fingertipp ein typisches Gerät anlegen können, damit ich in unter 2 Minuten meine erste Empfehlung sehe.
- Als Nutzer möchte ich Name und Laufzeit eines Geräts ändern und Geräte löschen können, damit meine Liste aktuell bleibt.
- Als Nutzer möchte ich ehrlich gesagt bekommen, wenn für eine lange Laufzeit noch nicht genug Preise bekannt sind, damit ich mich nicht auf eine geratene Empfehlung verlasse.
- Als registrierte Person möchte ich sicher sein, dass nur ich meine Geräte sehen und ändern kann.

## Out of Scope
- Späteste Endzeit („muss bis 18 Uhr fertig sein“) pro Gerät oder pro Abfrage – bewusst nicht im MVP
- Ersparnis in Euro und ein Feld für den Verbrauch pro Lauf (kWh)
- Markierung des empfohlenen Fensters im Preisdiagramm von PROJ-2 (wäre ein `/refine PROJ-2`)
- Benachrichtigungen, Erinnerungen oder Timer zum Startzeitpunkt (Nicht-Ziel laut PRD)
- Gerät automatisch starten, Smart-Home-Steuerung (Nicht-Ziel laut PRD)
- Minutengenaue Laufzeiten und minutengenaue Startzeiten (nur 15-Minuten-Raster)
- Unterbrochene Fenster (z. B. Laden mit Pause) – das Fenster ist immer zusammenhängend
- Laufzeiten über 12 Stunden
- Gerätetypen, Icons oder Leistungsprofile, die sich über die Laufzeit ändern
- Eigene Sortierung oder Umsortieren der Geräte
- Verlauf vergangener Empfehlungen
- Geräte mit anderen Personen oder einem Haushalt teilen
- Datenexport per Knopf in der App (Auskunft und Export laufen per E-Mail, siehe `docs/privacy.md`)

## Acceptance Criteria

### Abschnitt & Zugriff
- [ ] **AC-1** — Angenommen der Nutzer ist angemeldet, wenn er `/dashboard` öffnet, dann sieht er unter dem Abschnitt „Strompreise“ einen Abschnitt „Meine Geräte“ mit dem Button „Gerät hinzufügen“.
- [ ] **AC-2** — Angenommen es gibt Geräte mehrerer Nutzer, wenn ein Nutzer Geräte abruft, anlegt, ändert oder löscht (über die Oberfläche oder direkt über einen Endpunkt der App), dann wirkt das nur auf seine eigenen Geräte; fremde Geräte kann er weder sehen noch ändern noch löschen, und wer nicht angemeldet ist, erhält keine Gerätedaten (Weiterleitung zu `/login` bzw. Ablehnung der Anfrage).

### Leerzustand
- [ ] **AC-3** — Angenommen der Nutzer hat noch keine Geräte, wenn er den Abschnitt ansieht, dann sieht er den Hinweis „Noch keine Geräte. Lege dein erstes Gerät an, um zu sehen, wann es am günstigsten läuft.“, den Button „Gerät hinzufügen“ und drei Vorschläge: „Waschmaschine · 2:30 h“, „Spülmaschine · 3:00 h“ und „E-Auto · 4:00 h“.
- [ ] **AC-4** — Angenommen der Leerzustand wird angezeigt, wenn der Nutzer einen Vorschlag antippt, dann öffnet sich der Dialog „Gerät hinzufügen“ mit Name und Laufzeit des Vorschlags vorausgefüllt, und das Gerät wird erst beim Speichern angelegt.

### Anlegen
- [ ] **AC-5** — Angenommen der Nutzer klickt „Gerät hinzufügen“, wenn er im Dialog einen Namen und eine Laufzeit (Stunden 0–12, Minuten 00/15/30/45) eingibt und speichert, dann schließt sich der Dialog, eine Bestätigung „Gerät gespeichert“ erscheint, und die Karte des neuen Geräts ist ohne Neuladen der Seite mit ihrer Empfehlung sichtbar.
- [ ] **AC-6** — Angenommen der Nutzer speichert ein Gerät, wenn der Name leer ist, nur aus Leerzeichen besteht oder nach Entfernen der Leerzeichen am Rand länger als 40 Zeichen ist, dann wird nicht gespeichert, und am Feld steht eine verständliche Fehlermeldung. Leerzeichen am Anfang und Ende werden vor dem Speichern entfernt.
- [ ] **AC-7** — Angenommen der Nutzer speichert ein Gerät, wenn die Laufzeit 0:00 h, länger als 12:00 h oder kein Vielfaches von 15 Minuten ist, dann wird nicht gespeichert und eine Fehlermeldung erklärt den erlaubten Bereich (0:15 bis 12:00 h in 15-Minuten-Schritten). Das gilt auch für Anfragen, die nicht über das Formular kommen.
- [ ] **AC-8** — Angenommen der Nutzer hat schon ein Gerät „Waschmaschine“, wenn er ein weiteres Gerät „waschmaschine“ oder „ Waschmaschine “ speichern will, dann wird es nicht gespeichert, und am Namensfeld steht „Du hast schon ein Gerät mit diesem Namen.“ (Groß-/Kleinschreibung und Leerzeichen am Rand zählen nicht).
- [ ] **AC-9** — Angenommen der Nutzer hat 20 Geräte, wenn er den Abschnitt ansieht, dann ist „Gerät hinzufügen“ nicht verfügbar, und der Hinweis „Du hast die Höchstzahl von 20 Geräten erreicht. Lösche ein Gerät, um ein neues anzulegen.“ ist sichtbar. Auch eine Anfrage an die App, ein 21. Gerät anzulegen, wird abgelehnt.

### Liste, Bearbeiten & Löschen
- [ ] **AC-10** — Angenommen der Nutzer hat Geräte, wenn er den Abschnitt ansieht, dann sieht er pro Gerät eine Karte mit Name, Laufzeit (z. B. „2:30 h“) und Empfehlung, in der Reihenfolge des Anlegens (ältestes zuerst).
- [ ] **AC-11** — Angenommen ein Gerät existiert, wenn der Nutzer im Menü der Karte „Bearbeiten“ wählt, dann öffnet sich derselbe Dialog mit Name und Laufzeit vorausgefüllt; beim Speichern gelten AC-6 bis AC-8 (der eigene bisherige Name zählt nicht als Duplikat), und die Karte zeigt danach ohne Neuladen die neuen Werte und die neu berechnete Empfehlung.
- [ ] **AC-12** — Angenommen ein Gerät existiert, wenn der Nutzer im Menü der Karte „Löschen“ wählt, dann erscheint die Rückfrage „„[Name]“ löschen?“; bestätigt er, ist das Gerät sofort und endgültig entfernt und eine Bestätigung „Gerät gelöscht“ erscheint; bricht er ab, bleibt alles unverändert. _(Art. 17 DSGVO)_

### Empfehlung
- [ ] **AC-13** — Angenommen Preise liegen vor, wenn die Empfehlung für ein Gerät berechnet wird, dann kommen als Start alle Slot-Grenzen vom Beginn des aktuellen Slots bis zum letzten möglichen Start in Frage, und das Fenster (Laufzeit ÷ 15 Minuten aufeinanderfolgende Slots) muss vollständig im bekannten Zeitraum liegen: vom aktuellen Slot bis zum letzten veröffentlichten Slot (Rest von heute, und morgen, sobald dessen Preise veröffentlicht sind).
- [ ] **AC-14** — Angenommen mehrere Fenster sind möglich, wenn die Empfehlung bestimmt wird, dann gilt das Fenster mit dem niedrigsten Durchschnittspreis seiner Slots; haben mehrere Fenster denselben niedrigsten Durchschnitt, gilt das früheste.
- [ ] **AC-15** — Angenommen eine Empfehlung liegt vor, wenn die Karte angezeigt wird, dann zeigt sie Startzeit, Endzeit und Durchschnittspreis des Fensters, z. B. „Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh“; liegt Start oder Ende am nächsten Tag, steht „morgen“ davor (z. B. „Starte morgen um 02:00 Uhr“). Preise erscheinen wie in PROJ-2 in ct/kWh mit einer Nachkommastelle im deutschen Zahlenformat.
- [ ] **AC-16** — Angenommen das empfohlene Fenster beginnt nicht im aktuellen Slot, wenn die Karte angezeigt wird, dann steht darunter der Vergleich mit dem Fenster ab dem aktuellen Slot, z. B. „Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28 %)“. Die Prozentangabe ist die Differenz geteilt durch den Durchschnitt bei sofortigem Start, auf ganze Prozent gerundet.
- [ ] **AC-17** — Angenommen das günstigste Fenster beginnt im aktuellen Slot, wenn die Karte angezeigt wird, dann lautet die Empfehlung „Jetzt starten · fertig um [Uhrzeit] · Ø [Preis] ct/kWh“ mit dem Zusatz „Günstiger wird es im bekannten Zeitraum nicht.“ und ohne Vergleichszeile.
- [ ] **AC-18** — Angenommen die Laufzeit eines Geräts ist länger als der bekannte Zeitraum ab dem aktuellen Slot, wenn die Karte angezeigt wird, dann zeigt sie keine Empfehlung und keinen Vergleich, sondern den Hinweis „Für [Laufzeit] h sind noch nicht genug Preise bekannt. Die Preise für morgen erscheinen meist ab ca. 13 Uhr.“
- [ ] **AC-19** — Angenommen die Preise für morgen sind noch nicht veröffentlicht und für ein Gerät wird eine Empfehlung angezeigt, wenn der Nutzer die Karte ansieht, dann steht dort zusätzlich „Die Preise für morgen fehlen noch – die Empfehlung kann sich ab ca. 13 Uhr ändern.“
- [ ] **AC-20** — Angenommen der Abschnitt „Strompreise“ zeigt Preise an, wenn eine Empfehlung berechnet wird, dann rechnet sie mit genau denselben Slot-Preisen, und alle Zeiten gelten in deutscher Zeit (Europe/Berlin), auch wenn das Gerät des Nutzers in einer anderen Zeitzone steht.

### Aktualisierung
- [ ] **AC-21** — Angenommen das Dashboard ist geöffnet, wenn ein neuer 15-Minuten-Slot beginnt, die Preise für morgen veröffentlicht werden oder ein neuer Tag beginnt, dann werden alle Empfehlungen und Vergleiche ohne Neuladen der Seite neu berechnet (im selben Takt wie die Preisanzeige aus PROJ-2).

### Laden & Fehler
- [ ] **AC-22** — Angenommen die Geräte werden geladen, wenn der Abschnitt angezeigt wird, dann sieht der Nutzer Skeletons in Form der Gerätekarten statt eines Vollbild-Spinners.
- [ ] **AC-23** — Angenommen die Strompreise sind nicht verfügbar (Fehlerzustand aus PROJ-2 AC-23), wenn der Abschnitt „Meine Geräte“ angezeigt wird, dann sind die Geräte trotzdem sichtbar und lassen sich anlegen, bearbeiten und löschen; jede Karte zeigt statt der Empfehlung „Empfehlung gerade nicht verfügbar – die Strompreise konnten nicht geladen werden.“, und sobald die Preise wieder geladen sind, erscheinen die Empfehlungen ohne Neuladen.
- [ ] **AC-24** — Angenommen Speichern oder Löschen schlägt fehl (z. B. keine Verbindung), wenn der Nutzer es versucht, dann sieht er die Meldung „Das hat nicht geklappt. Bitte versuche es erneut.“; beim Speichern bleibt der Dialog mit seinen Eingaben offen, und es entsteht kein halbes oder doppeltes Gerät.

### Darstellung & Barrierefreiheit
- [ ] **AC-25** — Angenommen der Bildschirm ist 360 px breit, wenn der Abschnitt mit Geräten und Dialog angezeigt wird, dann passt alles ohne horizontales Scrollen, und Hinzufügen, Bearbeiten und Löschen sind vollständig per Tastatur bedienbar, mit beschrifteten Feldern und Buttons.

### Datenschutz
- [ ] **AC-26** — Angenommen jemand öffnet `/datenschutz`, wenn er den Abschnitt zu den gespeicherten Daten liest, dann nennt die Seite auch die Geräte (Name und Laufzeit), den Zweck (Startfenster empfehlen), die Rechtsgrundlage (Erfüllung des Nutzungsvertrags, Art. 6 Abs. 1 lit. b DSGVO) und die Speicherdauer (bis der Nutzer das Gerät oder sein Konto löscht). _(Art. 13 DSGVO)_
- [ ] **AC-27** — Angenommen ein Nutzer hat Geräte, wenn er sein Konto löscht (PROJ-1 AC-25), dann sind auch alle seine Geräte sofort und endgültig gelöscht. _(Art. 17 DSGVO)_

## Edge Cases
- **EC-1** — Angenommen ein Fenster überspannt die Umstellung auf Sommerzeit (März), wenn die Empfehlung berechnet wird, dann zählt die echte Laufzeit: Eine 2:30-h-Wäsche ab 01:30 Uhr endet um 05:00 Uhr, und die ausgefallene Stunde wird weder berechnet noch angezeigt.
- **EC-2** — Angenommen ein Fenster beginnt oder endet in der doppelten Stunde der Umstellung auf Winterzeit (Oktober), wenn die Karte angezeigt wird, dann steht hinter der Uhrzeit „MESZ“ bzw. „MEZ“ (wie in PROJ-2 EC-2), und die Laufzeit zählt in echter Zeit.
- **EC-3** — Angenommen der Durchschnitt bei sofortigem Start ist 0 oder negativ, wenn der Vergleich angezeigt wird, dann entfällt die Prozentangabe, und nur die Differenz in ct/kWh wird gezeigt (z. B. „Sofort: Ø −0,4 ct/kWh – du sparst 1,2 ct/kWh“). Negative Durchschnittspreise tragen ein Minuszeichen.
- **EC-4** — Angenommen das empfohlene Fenster ist günstiger als sofort, die Differenz rundet aber auf 0,0 ct/kWh, wenn die Karte angezeigt wird, dann zeigt der Vergleich „Sofort: Ø [Preis] ct/kWh – kaum Unterschied (unter 0,1 ct/kWh)“.
- **EC-5** — Angenommen die Laufzeit entspricht genau dem bekannten Zeitraum ab dem aktuellen Slot, wenn die Empfehlung berechnet wird, dann gibt es nur ein mögliches Fenster, und die Karte zeigt „Jetzt starten“ (AC-17), keinen Fehler.
- **EC-6** — Angenommen es ist der letzte Slot des Tages (23:45–24:00) und die Preise für morgen fehlen, wenn die Karten angezeigt werden, dann zeigt ein 0:15-h-Gerät „Jetzt starten“, und jedes längere Gerät den Hinweis aus AC-18.
- **EC-7** — Angenommen der Nutzer klickt „Speichern“ zweimal schnell hintereinander, wenn die Anfragen ankommen, dann entsteht höchstens ein Gerät; der Button ist während des Speicherns deaktiviert und zeigt einen Ladezustand.
- **EC-8** — Angenommen der Nutzer legt in zwei Tabs gleichzeitig ein Gerät mit demselben Namen an, wenn beide speichern, dann entsteht genau ein Gerät, und der andere Tab zeigt die Meldung aus AC-8.
- **EC-9** — Angenommen der Nutzer hat 19 Geräte und legt in zwei Tabs gleichzeitig je ein weiteres an, wenn beide speichern, dann entsteht genau eins, und der andere Tab zeigt den Hinweis aus AC-9; es gibt nie mehr als 20 Geräte.
- **EC-10** — Angenommen ein Gerät wurde in einem Tab gelöscht, wenn der Nutzer es in einem anderen Tab bearbeitet oder löscht, dann sieht er „Dieses Gerät gibt es nicht mehr.“, die Liste wird aktualisiert, und es wird kein Gerät neu angelegt.
- **EC-11** — Angenommen der Nutzer bearbeitet dasselbe Gerät in zwei Tabs, wenn beide speichern, dann gilt die zuletzt gespeicherte Fassung, und die Liste zeigt nach dem Speichern diesen Stand.
- **EC-12** — Angenommen ein Gerätename enthält Sonderzeichen, Emojis oder HTML (z. B. `<b>Trockner</b>`), wenn er angezeigt wird, dann erscheint er wörtlich als Text und wird nicht als HTML ausgeführt.
- **EC-13** — Angenommen ein Gerätename ist 40 Zeichen lang, wenn die Karte auf einem 360 px breiten Bildschirm angezeigt wird, dann bricht er um oder wird gekürzt, ohne das Layout zu sprengen, und der volle Name bleibt im Bearbeiten-Dialog lesbar.

## Technische Anforderungen
- **Sicherheit:** Nur angemeldete Nutzer, jeder nur mit seinen eigenen Geräten (AC-2). Zugriff wird zusätzlich in der Datenbank erzwungen (Row Level Security), nicht nur in der App. Alle Eingaben werden serverseitig geprüft (AC-6 bis AC-9), nicht nur im Formular.
- **Berechnung:** Die Empfehlung wird bei jedem Aufruf aus Preisen und Laufzeit neu berechnet und nicht gespeichert (siehe `docs/data-model.md`). Die Rechnung ist durch automatisierte Tests abgesichert, auch für die Randfälle Zeitumstellung, fehlende Preise für morgen und zu lange Laufzeit (PRD-Erfolgskriterium).
- **Preisquelle:** Es werden keine zusätzlichen Anfragen an Energy-Charts pro Gerät oder pro Nutzer ausgelöst; die Empfehlung nutzt die Preise aus PROJ-2.
- **Antwortzeit:** Empfehlungen erscheinen gemeinsam mit den Preisen; der Abschnitt hängt nie unbegrenzt im Ladezustand.
- **Datenschutz:** Gerätename und Laufzeit sind mit dem Konto verknüpft und damit personenbezogen. Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO, gespeichert bis zur Löschung des Geräts oder Kontos, einziger Auftragsverarbeiter Supabase (Frankfurt). Eintrag in `docs/privacy.md`.
- **Gestaltung:** Karten, Dialog, Lade-, Leer- und Fehlerzustand folgen `docs/design-system.md` (`tabular-nums` für Zeiten und Preise, Farbe nie als einziges Signal).
- **Browser:** aktuelle Versionen von Chrome, Firefox, Safari und Edge, mobil und Desktop.

## Offene Fragen
- keine

## Entscheidungslog

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Suchraum: ab jetzt bis zum letzten veröffentlichten Slot, ohne „fertig bis“ | Kein zusätzlicher Bedienschritt für Laien; morgen fließt automatisch ein, sobald die Preise da sind. Eine späteste Endzeit bringt viele Randfälle und kommt bei Bedarf später. | 2026-10-06 |
| Laufzeit in 15-Minuten-Schritten, 0:15 bis 12:00 h | Passt zum Preisraster, die Rechnung bleibt exakt und gut testbar. 12 h decken auch E-Auto-Laden über Nacht ab. | 2026-10-06 |
| Der aktuelle Slot zählt als „sofort“, Starts nur an Slot-Grenzen | Eindeutig und testbar. Die Ungenauigkeit von höchstens 14 Minuten am Anfang ist für die Entscheidung „jetzt oder später“ unerheblich. | 2026-10-06 |
| Vergleich als Ø ct/kWh und Ersparnis in %, ohne Euro | Kommt ohne Verbrauchsangabe aus, die Laien selten kennen; das Gerät bleibt bei Name + Laufzeit wie im PRD. Die Prozentzahl macht die ct-Differenz greifbar. | 2026-10-06 |
| Karte pro Gerät mit sichtbarer Empfehlung, keine Detailseite, keine Markierung im Diagramm | Kein Klick bis zur Empfehlung (2-Minuten-Ziel). Die Markierung im Diagramm würde in PROJ-2 eingreifen und den Umfang vergrößern. | 2026-10-06 |
| Gerätename 1–40 Zeichen und pro Konto eindeutig (ohne Groß-/Kleinschreibung) | Gleiche Namen führen auf dem Dashboard zu Verwechslungen. 40 Zeichen reichen für „Waschmaschine Eco 40–60“ und passen auf eine Handy-Karte. | 2026-10-06 |
| Höchstens 20 Geräte pro Konto | Schützt vor Massenanlage per Skript und hält das Dashboard übersichtlich; ein Haushalt hat selten mehr flexible Großverbraucher. | 2026-10-06 |
| Leerzustand mit drei antippbaren Vorschlägen, nichts automatisch angelegt | Hilft beim 2-Minuten-Ziel, ohne Daten anzulegen, die der Nutzer nicht selbst gewählt hat. | 2026-10-06 |
| Zu lange Laufzeit: keine Empfehlung, klarer Hinweis | Die App rechnet nur mit echten Preisen; eine Empfehlung auf Teildaten könnte falsch sein. | 2026-10-06 |
| Hinweis „Empfehlung kann sich ab ca. 13 Uhr ändern“, solange morgen fehlt | Vormittags kann ein Fenster in der Nacht günstiger sein, das noch unbekannt ist. Der Hinweis verhindert falsches Vertrauen. | 2026-10-06 |
| Bei Gleichstand gilt das früheste Fenster | Eindeutig und testbar, gleiche Regel wie in PROJ-2 (AC-9). | 2026-10-06 |
| Reihenfolge der Geräte: wie angelegt, ältestes zuerst | Stabil – Karten springen nicht, wenn sich Empfehlungen ändern oder ein Name bearbeitet wird. | 2026-10-06 |
| Gleichzeitiges Bearbeiten: die zuletzt gespeicherte Fassung gilt | Ein Nutzer bearbeitet nur seine eigenen Geräte; Konflikte zwischen zwei eigenen Tabs sind selten und ohne Schaden. | 2026-10-06 |
