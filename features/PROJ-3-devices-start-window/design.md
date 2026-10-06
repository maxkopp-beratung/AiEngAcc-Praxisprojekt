# PROJ-3 – Technisches Design: Geräte & Startfenster

> Das technische Design (das WIE) für das Feature. Zwei Leser: die PM (gibt frei) und `/build` (setzt danach um). Kein Code, aber so genau, dass niemand raten muss.
> Owner: `/architecture`. Der Vertrag (WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.
> Kein Status- oder Datumsfeld hier – der Status steht nur in `features/INDEX.md`.

## Überblick

Der Abschnitt „Meine Geräte“ hängt sich unter „Strompreise“ in das bestehende Dashboard von PROJ-1 ein (`docs/app-shell.md`). Es gibt keine neue Seite und keine Navigation. Neu sind eine Datenbanktabelle `devices`, drei Server Actions zum Anlegen, Ändern und Löschen und eine reine Rechenfunktion für das Startfenster.

```
Browser (Dashboard)                                   Unser Server                    Supabase (Frankfurt)
──────────────────                                    ──────────                      ────────────────────
Gemeinsamer Preis-Zustand  ◄── Startpaket ── Abschnitt „Strompreise“ (PROJ-2)
 (eine Uhr, ein Nachladen)                                                            
   │                                                                                  
   ├─► Abschnitt „Strompreise“ zeigt Preise                                           
   └─► Abschnitt „Meine Geräte“ rechnet Empfehlungen                                  
                                                                                      
Abschnitt „Meine Geräte“ ◄── Geräteliste ──── DevicesSection ── liest ─────────────► Tabelle devices
Dialog / Menü ── Server Action (POST) ──────► anlegen / ändern / löschen ── schreibt ► (RLS + Prüfregeln
                ◄── aktuelle Geräteliste ────                                           + Trigger)
```

- **Die Empfehlung rechnet der Browser**, aus denselben Preisen, die der Abschnitt „Strompreise“ gerade anzeigt (AC-20). Sie wird nie gespeichert und löst keine eigene Anfrage an Energy-Charts oder `/api/prices` aus.
- **Ein gemeinsamer Preis-Zustand für beide Abschnitte.** Bisher hält der Abschnitt „Strompreise“ seine Preise, die Uhr und das Nachladen allein. Diese Logik wird eine Ebene höher gezogen, damit beide Abschnitte mit genau demselben Stand und im selben Takt rechnen (AC-20, AC-21). Für die Nutzer von PROJ-2 ändert sich nichts.
- **Die Datenbank ist die zweite, unabhängige Sperre.** Eigentum, Namensregeln, Laufzeitregeln, eindeutige Namen und die Höchstzahl von 20 erzwingt die Datenbank selbst. Das gilt auch für jemanden, der unsere Server Actions umgeht und Supabase mit seinem eigenen Login direkt aufruft.

## Component Structure

```
/dashboard  (Seite von PROJ-1, Seitentitel „Übersicht“)
+-- LivePricesProvider                            (Browser – gemeinsamer Preis-Zustand: Preise, „jetzt“, Nachladen)
    +-- Abschnitt „Strompreise“  (PROJ-2, Aussehen und Verhalten unverändert)
    |     PricePanel übergibt sein Startpaket vom Server an den Provider und liest danach aus ihm
    +-- Abschnitt „Meine Geräte“                  DevicesSection (Server, eigene Suspense-Grenze)
        |   prüft die Sitzung, lädt die Geräte; während des Ladens: DevicesSkeleton (AC-22)
        +-- DevicesPanel                          (Browser – hält die Geräteliste)
            +-- Kopf: Titel „Meine Geräte“ + Button „Gerät hinzufügen“ (AC-1)
            |     nur sichtbar, wenn es mindestens ein Gerät gibt; im Leerzustand trägt die Leer-Karte den Button
            +-- Hinweis Höchstzahl (Alert, neutral, ab 20 Geräten; Button deaktiviert)      (AC-9)
            +-- Leerzustand (gestrichelte Karte)                                              (AC-3, AC-4)
            |     Icon, Text aus AC-3, Button „Gerät hinzufügen“,
            |     drei Vorschlag-Buttons „Waschmaschine · 2:30 h“, „Spülmaschine · 3:00 h“, „E-Auto · 4:00 h“
            +-- Geräteliste (1 Spalte, ab 768 px 2 Spalten), Reihenfolge wie angelegt        (AC-10)
            |   +-- DeviceCard × n
            |       +-- Kopf: Name (bricht um) · Laufzeit „2:30 h“ · Menü-Button „⋯“         (EC-12, EC-13)
            |       |     DropdownMenu: „Bearbeiten“, „Löschen“                               (AC-11, AC-12)
            |       +-- RecommendationBlock (Fläche `primary-subtle`), genau ein Zustand:
            |             • lädt            – Skeleton-Zeile, solange noch keine Preise da sind
            |             • nicht verfügbar – Text aus AC-23
            |             • zu wenig Preise – Text aus AC-18
            |             • Empfehlung      – AC-15 bzw. AC-17, darunter Vergleich (AC-16, EC-3, EC-4)
            |                                 und ggf. Hinweis „Preise für morgen fehlen“ (AC-19)
            +-- DeviceDialog (ein Dialog für Anlegen und Bearbeiten)                          (AC-4–8, AC-11, AC-24)
            |     Titel „Gerät hinzufügen“ / „Gerät bearbeiten“
            |     Feld „Name“ (Input) mit Hilfetext „Höchstens 40 Zeichen“
            |     Feld „Laufzeit“: Select „Stunden“ (0–12) + Select „Minuten“ (00, 15, 30, 45)
            |     Fehlerbereich (Alert `destructive`) für Fehler, die kein Feld betreffen
            |     Buttons „Abbrechen“ (outline) · „Speichern“ (default, mit Ladezustand)
            +-- DeleteDeviceDialog (AlertDialog)                                              (AC-12)
                  Titel „„[Name]“ löschen?“, Buttons „Abbrechen“ · „Löschen“ (destructive)
```

**Einhängen ins Dashboard:** `src/app/dashboard/page.tsx` (PROJ-1) bekommt den `LivePricesProvider` um beide Abschnitte und den Abschnitt „Meine Geräte“ unter „Strompreise“. Der Platzhaltersatz „Hier siehst du bald deine Geräte.“ fällt weg. Kopfzeile, Layout und Schutz der Seite bleiben unverändert.

**Wiederverwendet (schon installiert):** `Card`, `Button`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Form`, `Input`, `Label`, `Select`, `Alert`, `Skeleton`, Toasts über `sonner` (Toaster liegt schon im Root-Layout), Icons aus `lucide-react`. **Nichts Neues per shadcn.**

### Darstellung im Detail

**Gerätekarte (DeviceCard):**
- Name in `font-semibold`. Lange Namen ohne Leerzeichen brechen an beliebiger Stelle um (`break-words`/`overflow-wrap: anywhere`), damit 40 Zeichen auf 360 px passen (EC-13). Der Name wird immer als Text ausgegeben, nie als HTML (EC-12; React tut das von selbst, es gibt kein `dangerouslySetInnerHTML`).
- Laufzeit als „H:MM h“ in `muted-foreground` und `tabular-nums`, z. B. „2:30 h“, „0:15 h“, „12:00 h“.
- Menü-Button: Icon-Button (`ghost`, Icon `MoreHorizontal`), Beschriftung für Screenreader „Aktionen für [Name]“.
- Empfehlung (Zustand „Empfehlung“), Zeiten und Preise in `tabular-nums`:
  - Zeile 1 (hervorgehoben, 600): „Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh“ (AC-15) bzw. „Jetzt starten · fertig um 15:45 Uhr · Ø 8,4 ct/kWh“ (AC-17). Die Zeile darf an den „·“ umbrechen.
  - Zeile 2 (normal): „Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28 %)“ (AC-16) bzw. „Günstiger wird es im bekannten Zeitraum nicht.“ (AC-17).
  - Zeile 3 (`muted-foreground`, nur solange morgen fehlt): „Die Preise für morgen fehlen noch – die Empfehlung kann sich ab ca. 13 Uhr ändern.“ (AC-19)
  - Icon `Clock` vor Zeile 1. Farbe ist nie das einzige Signal: Die Empfehlung steht immer in Worten da.

**Leerzustand:** nach Design-System (gestrichelte Karte, Icon `Plug`, Überschrift „Noch keine Geräte“, Satz aus AC-3, primärer Button). Die drei Vorschläge sind `outline`-Buttons in einer Zeile, die auf 360 px umbricht.

**Dialog:** Labels über den Feldern, Fehlermeldungen in `destructive` unter dem betroffenen Feld. Die beiden Selects der Laufzeit stehen nebeneinander unter einem gemeinsamen Label „Laufzeit“ (Gruppe mit `fieldset`/`legend`, jedes Select zusätzlich mit eigener Beschriftung „Stunden“ bzw. „Minuten“). Der Fokus springt beim Öffnen ins Namensfeld, Escape schließt (shadcn-Standard). Beim Bearbeiten steht der volle Name im Feld (EC-13).

**Skeleton (DevicesSkeleton):** Titelzeile plus zwei Karten-Skeletons in der Form einer Gerätekarte (Name, Laufzeit, zwei Zeilen Empfehlung). Kein Vollbild-Spinner (AC-22).

## Data Model

### `devices` (neue Tabelle, Schema `public`)

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | UUID | Primärschlüssel, von der Datenbank erzeugt |
| `user_id` | UUID | Pflicht. Fremdschlüssel auf `profiles.id`. **Wird das Profil gelöscht (also das Konto), werden alle Geräte automatisch mitgelöscht** (AC-27). Standardwert: die ID des angemeldeten Nutzers. Nach dem Anlegen nicht mehr änderbar |
| `name` | Text | Pflicht. 1–40 Zeichen, gezählt in Unicode-Zeichen (Codepoints), ohne Leerraum am Anfang oder Ende. Die Datenbank erzwingt beides per Prüfregel |
| `duration_minutes` | ganze Zahl | Pflicht. 15 bis 720 und ohne Rest durch 15 teilbar. Die Datenbank erzwingt das per Prüfregel (AC-7) |
| `created_at` | Zeitstempel mit Zeitzone | Pflicht, Standard: jetzt. Bestimmt die Reihenfolge der Karten (AC-10); nicht vom Nutzer setzbar |

- **Eindeutiger Name pro Konto (AC-8, EC-8):** eindeutiger Index auf (`user_id`, Name in Kleinbuchstaben). Weil Leerraum am Rand nie gespeichert wird, zählen damit Groß-/Kleinschreibung und Leerzeichen am Rand nicht. Der eigene bisherige Name ist beim Bearbeiten kein Duplikat, weil es dieselbe Zeile ist (AC-11).
- **Höchstens 20 Geräte pro Konto (AC-9, EC-9):** ein Trigger vor jedem Einfügen. Er sperrt für die Dauer der Transaktion eine Sperre pro Nutzer (Advisory-Lock auf die `user_id`), zählt die vorhandenen Geräte und lehnt bei 20 oder mehr mit dem festen Fehlercode `device_limit_reached` ab. Die Sperre sorgt dafür, dass zwei gleichzeitige Einfügungen nacheinander zählen und nie 21 Geräte entstehen.
- **Index** auf (`user_id`, `created_at`) für die sortierte Liste.
- **Keine Spalte `updated_at`:** Kein Kriterium braucht sie (EC-11 ist „die letzte Fassung gilt“), also wird sie nicht gespeichert (Datensparsamkeit).
- **Was nicht gespeichert wird:** die Empfehlung, Preise, ein Gerätetyp oder Verbrauch.

**Zugriff (RLS an, ausdrückliche Rechte, weil „automatisch freigeben“ im Projekt aus ist):**
- Angemeldete Nutzer (`authenticated`) dürfen:
  - **lesen:** nur Zeilen mit `user_id` = eigene ID
  - **anlegen:** nur mit `user_id` = eigene ID; Rechte nur auf die Spalten `name` und `duration_minutes` (die übrigen setzt die Datenbank)
  - **ändern:** nur eigene Zeilen, und nur die Spalten `name` und `duration_minutes`
  - **löschen:** nur eigene Zeilen
- Nicht angemeldete Besucher (`anon`) haben **keinerlei** Rechte auf die Tabelle (AC-2).
- Die Trigger-Funktion für die Höchstzahl läuft mit den Rechten ihres Besitzers (`security definer`, fester `search_path`), damit sie zählen kann. Aufrufen kann sie niemand direkt.

**Gespeichert bis:** der Nutzer das Gerät löscht (AC-12) oder sein Konto löscht (AC-27, über die Lösch-Kaskade Auth-Nutzer → Profil → Geräte). Unbestätigte Konten verschwinden nach 7 Tagen samt Geräten (bestehender Aufräum-Job von PROJ-1).

**Migration:** `supabase/migrations/20261006000005_devices.sql`. Sie wird wie bei PROJ-1 direkt auf das Supabase-Cloud-Projekt angewendet (Umgebungsstrategie `single`).

### Gemeinsame Eingabeprüfung (Zod, gleiche Regeln in Dialog und Server Action)

- **Name:** Text. Wird zuerst in Unicode-Normalform NFC gebracht (damit „ä“ als ein Zeichen zählt und Duplikate sicher erkannt werden) und dann am Rand von Leerraum befreit.
  - leer nach dem Trimmen → „Bitte gib einen Namen ein.“
  - mehr als 40 Zeichen (Codepoints) → „Der Name darf höchstens 40 Zeichen lang sein.“
- **Laufzeit:** im Dialog Stunden (0–12) und Minuten (0, 15, 30, 45), an den Server geht eine ganze Zahl `durationMinutes`.
  - kleiner 15, größer 720 oder nicht durch 15 teilbar → „Die Laufzeit muss zwischen 0:15 und 12:00 h liegen, in 15-Minuten-Schritten.“ (AC-7). Die Meldung steht unter den beiden Selects.
- **Geräte-ID** (Bearbeiten, Löschen): muss eine UUID sein, sonst wie „gibt es nicht mehr“ behandelt.

### Empfehlung (reine Funktion, nicht gespeichert)

Eingaben: das Preis-Paket aus dem gemeinsamen Preis-Zustand (heute, morgen), „jetzt“ und die Laufzeit in Minuten. Ausgabe: genau einer der Zustände
- `prices_unavailable` – heute hat den Status `error` (AC-23)
- `not_enough_prices` – kein zulässiges Fenster (AC-18)
- `recommendation` – mit Start, Ende und Durchschnitt des besten Fensters, „beginnt jetzt“ ja/nein, Durchschnitt bei sofortigem Start (oder keiner), Ersparnis und „morgen fehlt“ ja/nein

Die Rechnung:
1. **Bekannter Zeitraum (AC-13):** die Slots von heute, ab dem aktuellen Slot (erster Slot, dessen Ende nach „jetzt“ liegt), gefolgt von allen Slots von morgen, falls morgen den Status `ok` hat. Die Slots sind lückenlos aufeinanderfolgende UTC-Zeitpunkte, auch über Mitternacht.
2. **Fensterlänge:** n = Laufzeit ÷ 15 Slots. Weil in Slots und nicht in Uhrzeiten gezählt wird, gilt immer die echte Laufzeit, auch über eine Zeitumstellung (EC-1, EC-2).
3. **Zulässige Fenster:** alle n aufeinanderfolgenden Slots im bekannten Zeitraum, beginnend an jeder Slot-Grenze ab dem aktuellen Slot, bei denen **jeder Slot einen Preis hat**. Gibt es keins → `not_enough_prices` (AC-18, EC-5, EC-6).
4. **Bestes Fenster (AC-14):** niedrigster Durchschnittspreis; bei Gleichstand das früheste. Verglichen wird die Summe der Preise, umgerechnet in ganze Hundertstel EUR/MWh, damit Gleichstand exakt erkannt wird und kein Rundungsrauschen der Gleitkommazahlen entscheidet. Das Fenster wird in einem Durchlauf mit gleitender Summe gesucht.
5. **„Sofort“-Fenster:** das Fenster ab dem aktuellen Slot. Ist es zulässig, ist sein Durchschnitt der Vergleichswert; ist es nicht zulässig (Preislücke darin), gibt es keine Vergleichszeile.
6. **„beginnt jetzt“** = das beste Fenster beginnt im aktuellen Slot → AC-17, keine Vergleichszeile.
7. **„morgen fehlt“** = morgen hat nicht den Status `ok` → Zusatzzeile AC-19.

**Anzeige der Zeiten (AC-15, EC-2):**
- Start = Beginn des ersten Slots, Ende = Beginn des ersten Slots + n × 15 Minuten, jeweils in deutscher Zeit „HH:MM Uhr“.
- „morgen“ steht vor einer Zeit, wenn ihr Kalendertag (deutsche Zeit) nach dem heutigen Kalendertag von „jetzt“ liegt: „Starte morgen um 02:00 Uhr“, „fertig morgen um 00:30 Uhr“. Start und Ende werden einzeln geprüft.
- Ein Ende genau um Mitternacht heißt „24:00 Uhr“ und gehört zum Tag davor (wie „24:00“ in PROJ-2): Ein Fenster von 21:30 bis Mitternacht zeigt „fertig um 24:00 Uhr“.
- Liegt eine Zeit in der doppelten Stunde 02:00–02:59 am Tag der Umstellung auf Winterzeit, steht dahinter „MESZ“ (erster Durchlauf) bzw. „MEZ“ (zweiter Durchlauf), z. B. „Starte um 02:15 Uhr MESZ“ (EC-2). An allen anderen Tagen kein Zusatz.

**Anzeige der Preise und der Ersparnis (AC-15, AC-16, EC-3, EC-4):**
- Durchschnitte erscheinen wie in PROJ-2: ct/kWh mit einer Nachkommastelle, deutsches Format, echtes Minuszeichen (gemeinsame Funktion `formatCt` aus PROJ-2).
- **Die Ersparnis wird aus den angezeigten, gerundeten Werten gerechnet**, damit die Zahlen auf der Karte zusammenpassen: Ersparnis = gerundeter Sofort-Durchschnitt − gerundeter bester Durchschnitt (in Zehntel ct/kWh, also exakt). Beispiel: 11,7 − 8,4 = 3,3.
- Prozent = Ersparnis ÷ gerundeter Sofort-Durchschnitt × 100, kaufmännisch auf ganze Prozent gerundet, Anzeige „(28 %)“ mit geschütztem Leerzeichen.
- Sofort-Durchschnitt (gerundet) 0 oder negativ → keine Prozentangabe, nur die Differenz (EC-3).
- Ersparnis = 0,0 (die beiden angezeigten Durchschnitte sind gleich, obwohl das Fenster später beginnt) → „Sofort: Ø [Preis] ct/kWh – kaum Unterschied (unter 0,1 ct/kWh)“ (EC-4).
- Laufzeit im Hinweis AC-18 im Format „H:MM“, z. B. „Für 4:00 h sind noch nicht genug Preise bekannt. …“

## Behaviors & Access

### Server Actions (alle POST, alle prüfen Eingaben mit Zod auf dem Server)

Jede Action prüft zuerst die Sitzung gegen Supabase Auth (`getUser`, wie das Dashboard-Layout und der Preis-Abschnitt). Ohne gültige Sitzung → Ergebnis `unauthorized`, nichts wird gelesen oder geschrieben. Alle Datenbankzugriffe laufen mit der Sitzung des Nutzers (nicht mit der Service-Rolle), damit RLS greift.

Jede Action liefert ein Ergebnis mit genau einem Status und – außer bei `unauthorized` und `error` – der **aktuellen Geräteliste** des Nutzers (sortiert nach `created_at`, dann `id`). So zeigt die Karte das Ergebnis ohne Neuladen (AC-5, AC-11), und nach EC-9/EC-10 ist die Liste wieder richtig.

**Gerät anlegen** (AC-5 bis AC-9, EC-7 bis EC-9, AC-24)
- Eingaben: `name`, `durationMinutes`.
- Ablauf: Zod-Prüfung → ein einziges Einfügen (eine Anweisung, also nie ein halbes Gerät) → aktuelle Liste lesen.
- Ergebnisse:
  - `ok` → Dialog schließt, Toast „Gerät gespeichert“
  - `invalid` mit Feldfehlern (Name/Laufzeit) → Meldungen an den Feldern, Dialog bleibt offen
  - `duplicate_name` (Eindeutigkeitsverletzung auf dem Namensindex) → am Namensfeld „Du hast schon ein Gerät mit diesem Namen.“
  - `limit_reached` (Fehlercode `device_limit_reached` aus dem Trigger) → im Dialog „Du hast die Höchstzahl von 20 Geräten erreicht. Lösche ein Gerät, um ein neues anzulegen.“; die Liste wird aktualisiert, und der Abschnitt zeigt den Hinweis aus AC-9
  - `error` (jeder andere Datenbank- oder Verbindungsfehler) → „Das hat nicht geklappt. Bitte versuche es erneut.“ im Dialog, Eingaben bleiben stehen (AC-24)

**Gerät ändern** (AC-11, EC-10, EC-11)
- Eingaben: `id`, `name`, `durationMinutes`.
- Ablauf: Zod-Prüfung → Ändern der einen Zeile mit dieser `id` (RLS beschränkt auf eigene Zeilen) mit Rückgabe der geänderten Zeile → aktuelle Liste lesen.
- Ergebnisse wie beim Anlegen (ohne `limit_reached`), zusätzlich:
  - `not_found` (keine Zeile geändert: gelöscht oder fremd) → Dialog schließt, Toast-Fehler „Dieses Gerät gibt es nicht mehr.“, Liste aktualisiert. **Es wird nie ein Gerät neu angelegt** (kein „Upsert“) (EC-10).
- Zwei Tabs speichern nacheinander → die zweite Änderung überschreibt die erste (EC-11). Keine Versionsprüfung.

**Gerät löschen** (AC-12, EC-10)
- Eingabe: `id`.
- Ablauf: Löschen der Zeile (RLS: nur eigene) mit Rückgabe der gelöschten Zeile → aktuelle Liste lesen.
- Ergebnisse: `ok` → Toast „Gerät gelöscht“ · `not_found` → Toast-Fehler „Dieses Gerät gibt es nicht mehr.“, Liste aktualisiert · `error` → Toast-Fehler „Das hat nicht geklappt. Bitte versuche es erneut.“, das Gerät bleibt in der Liste (AC-24).

**Gemeinsam:**
- `unauthorized` → die Seite lädt neu, der Schutz von PROJ-1 leitet zu `/login` (wie 401 in PROJ-2).
- Kommt im Browser gar keine Antwort (Netzwerkfehler, die Action wirft) → wie `error`.
- **Doppelklick (EC-7):** Der Button „Speichern“ bzw. „Löschen“ ist ab dem ersten Klick bis zur Antwort deaktiviert und zeigt einen Spinner. Zusätzlich verhindert der eindeutige Name ein zweites gleiches Gerät.
- Fehlercodes der Datenbank werden auf die Ergebnisse oben abgebildet. Rohe Fehlermeldungen der Datenbank erreichen den Browser nie.

### Laden der Geräte (DevicesSection, Server)

- Prüft selbst die Sitzung mit `getUser` und leitet ohne Sitzung zu `/login?next=%2Fdashboard` weiter, bevor irgendetwas gelesen wird (Muster aus PROJ-2 BUG-2: Layout und Seite rendern parallel).
- Liest alle Geräte des Nutzers, sortiert nach `created_at`, dann `id` (AC-10). RLS ist die zweite Sperre.
- Eigene Suspense-Grenze: Die Geräte erscheinen unabhängig von den Preisen. Kopfzeile, Titel und Preise warten nicht auf die Geräte und umgekehrt.
- Schlägt das Laden fehl: Fehlerzustand nach Design-System im Abschnitt („Deine Geräte konnten gerade nicht geladen werden.“ + „Erneut versuchen“, das die Seite neu lädt). Der Abschnitt „Strompreise“ bleibt davon unberührt.

### Gemeinsamer Preis-Zustand im Browser (LivePricesProvider)

- Enthält genau die Logik, die heute im Hook `useLivePrices` von PROJ-2 steckt: Preis-Paket, „jetzt“, Uhr bis zum nächsten Slot (AC-21), Rückkehr aus dem Hintergrund, bedingtes Nachladen von `/api/prices`, Tageswechsel, stilles Fehlerverhalten, „Erneut versuchen“. **Es gibt nur eine Uhr und ein Nachladen für die ganze Seite.**
- Startet leer. Sobald der Abschnitt „Strompreise“ sein Startpaket vom Server hat, übergibt er es dem Provider (nur die erste Übergabe zählt). Ab dann lesen beide Abschnitte denselben Stand. Bis zur Übergabe zeigt der Preis-Abschnitt sein Startpaket direkt (kein Flackern), die Gerätekarten zeigen in der Empfehlung eine Skeleton-Zeile.
- Die Empfehlungen werden bei jedem Rendern aus Preis-Paket, „jetzt“ und Laufzeit neu berechnet (pro Gerät gemerkt, solange sich die drei nicht ändern). Jeder Slot-Wechsel, jedes Nachladen und jeder Tageswechsel aktualisiert so Preise und Empfehlungen im selben Moment (AC-20, AC-21, AC-23 „erscheinen ohne Neuladen“).
- PROJ-2 bleibt im Verhalten unverändert: Seine Tests müssen nach dem Umbau ohne inhaltliche Änderung grün bleiben (angepasst werden darf nur, wie der Test den Provider aufbaut).

### Datenschutzseite `/datenschutz` (AC-26)

Die Seite von PROJ-1 bekommt Ergänzungen in zwei bestehenden Abschnitten:
- „Welche Daten wir speichern und wozu“: Punkt **„Deine Geräte:“** Name und Laufzeit jedes Geräts, das du anlegst. Zweck: das günstigste Startfenster empfehlen. Die Empfehlung selbst wird nicht gespeichert. Rechtsgrundlage: Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).
- „Wie lange wir Daten speichern“: „Geräte: bis du das Gerät oder dein Konto löschst.“
- „Deine Rechte“ → Berichtigung/Löschung: Geräte änderst und löschst du selbst im Abschnitt „Meine Geräte“.

### Brute-Force-Schutz

Nicht zutreffend: Das Feature prüft keine Zugangsdaten. Gegen Massenanlage per Skript schützt die Höchstzahl von 20 Geräten in der Datenbank.

## Dependencies

Keine neuen Pakete. Genutzt werden die vorhandenen: `zod`, `react-hook-form` + `@hookform/resolvers` (Dialog), `date-fns` + `@date-fns/tz` (deutsche Zeit, über die Helfer aus `src/lib/prices/berlin-time.ts`), `sonner` (Toasts), `@supabase/ssr` (Sitzung und Datenbank).

## Testbarkeit (Hinweis für `/build` und `/qa`)

- **Die Empfehlung ist eine reine Funktion** mit „jetzt“ als Eingabe, ohne Uhr, ohne Netz. Pflicht-Testfälle (PRD-Erfolgskriterium):
  - Gleichstand → frühestes Fenster (AC-14); bestes Fenster jetzt (AC-17) und später (AC-16)
  - Laufzeit = bekannter Zeitraum (EC-5); länger (AC-18); letzter Slot des Tages ohne morgen, 0:15 h und 0:30 h (EC-6)
  - Fenster über Mitternacht in den morgigen Tag, mit „morgen“ an Start und/oder Ende; Ende genau um Mitternacht („24:00 Uhr“)
  - Umstellung auf Sommerzeit: 2:30 h ab 01:30 endet 05:00 (EC-1); Umstellung auf Winterzeit mit „MESZ“/„MEZ“ (EC-2)
  - morgen fehlt → Hinweis AC-19; heute `error` → AC-23
  - negativer und null Sofort-Durchschnitt (EC-3); Ersparnis rundet auf 0,0 (EC-4); Prozent-Rundung
  - Preislücke (`null`) im Fenster, im Sofort-Fenster und am Ende des Zeitraums
  - „jetzt“ mitten im Slot; Gerät in fremder Zeitzone (Testlauf mit anderer `TZ`) (AC-20)
- **Datenbank-Regeln** als Integrationstest gegen das echte Supabase-Projekt, nach dem Muster von `src/lib/supabase/rls.integration.test.ts`: fremde Geräte weder lesen noch ändern noch löschen; `anon` ohne Zugriff; ungültige Laufzeit und Namen direkt über die Datenschnittstelle abgelehnt (AC-7); 21. Gerät abgelehnt; zwei gleichzeitige Einfügungen bei 19 Geräten → genau eins (EC-9); zwei gleichzeitige gleiche Namen → genau eins (EC-8); `user_id` und `created_at` nicht setzbar; Konto löschen → Geräte weg (AC-27).
- **Server Actions** mit ersetztem Supabase-Client: Abbildung jedes Fehlercodes auf das Ergebnis, `unauthorized` ohne Datenbankzugriff, `not_found` legt nichts an.

## Settings the user makes

Keine. Die Tabelle, ihre Rechte und der Trigger kommen per Migration. Es gibt keine neue Umgebungsvariable und keine Einstellung in einem Dashboard.

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| Gemeinsamer Preis-Zustand (`LivePricesProvider`) für beide Abschnitte | Garantie für AC-20/AC-21: Preise und Empfehlungen rechnen mit demselben Paket und demselben „jetzt“, eine Uhr, ein Nachladen. Keine zweite Anfrage an `/api/prices` pro Seite. | Abschnitt „Meine Geräte“ mit eigenem `useLivePrices` | Umbau an PROJ-2-Code (Hook wird zum Provider). Verhalten bleibt gleich, abgesichert durch die bestehenden PROJ-2-Tests. Zwei eigene Instanzen könnten kurz verschiedene Stände zeigen, etwa wenn die Preise für morgen zwischen zwei Anfragen erscheinen. | 2026-10-06 |
| Startpaket wird vom Preis-Abschnitt an den Provider übergeben, Geräte laden in eigener Suspense-Grenze | Geräte erscheinen sofort aus der Datenbank, auch wenn Energy-Charts langsam ist oder ausfällt (AC-23). Die Empfehlungen erscheinen genau dann, wenn die Preise da sind („gemeinsam mit den Preisen“). | Eine gemeinsame Suspense-Grenze, die Preise und Geräte zusammen lädt | Ein kurzer Moment, in dem die Karten schon stehen und die Empfehlung noch als Skeleton-Zeile lädt. | 2026-10-06 |
| Empfehlung im Browser berechnet, als reine Funktion | Sie muss bei jedem Slot-Wechsel neu entstehen, ohne Neuladen (AC-21), und darf nicht gespeichert werden. Eine reine Funktion mit „jetzt“ als Eingabe ist vollständig testbar (PRD-Erfolgskriterium). | Berechnung auf dem Server und Auslieferung mit der Liste | Rechnen im Browser kostet bei 20 Geräten × ~190 Slots Mikrosekunden. | 2026-10-06 |
| Fenster werden in Slots gezählt, nicht in Uhrzeiten | Die echte Laufzeit gilt automatisch auch über die Zeitumstellung (EC-1, EC-2), ohne Sonderfall im Code. | Uhrzeit + Laufzeit in Ortszeit rechnen | Keiner – die Slots aus PROJ-2 sind bereits lückenlose UTC-Zeitpunkte. | 2026-10-06 |
| Gleichstand über ganzzahlige Summen (Hundertstel EUR/MWh) | Gleitkomma-Summen können bei gleichen Durchschnitten minimal abweichen und so das „früheste Fenster“ (AC-14) zufällig verfehlen. | Durchschnitte als Gleitkommazahlen vergleichen | Werte mit mehr als zwei Nachkommastellen würden für den Vergleich gerundet; Energy-Charts liefert höchstens zwei. | 2026-10-06 |
| Ersparnis und Prozent aus den angezeigten, gerundeten Durchschnitten | Die Zahlen auf der Karte gehen für Laien auf (11,7 − 8,4 = 3,3), wie im Beispiel von AC-16. | Ersparnis aus ungerundeten Werten | „kaum Unterschied“ (EC-4) erscheint genau dann, wenn beide angezeigten Durchschnitte gleich sind; eine echte Differenz unter 0,05 ct/kWh kann als „0,1“ erscheinen, wenn sie über eine Rundungsgrenze fällt. | 2026-10-06 |
| Fenster mit Preislücken (`null`) sind nicht zulässig | Die App rechnet nur mit echten Preisen (Produktentscheidung „keine Empfehlung auf Teildaten“). Ohne zulässiges Fenster erscheint der Hinweis aus AC-18; ist nur das Sofort-Fenster betroffen, entfällt die Vergleichszeile. | Lücken überspringen oder mit Nachbarwerten füllen | Bei einer seltenen Lücke in den Quelldaten kann eine Empfehlung fehlen, obwohl die Laufzeit in den Zeitraum passen würde. Die Spec nennt diesen Fall nicht ausdrücklich (siehe Open Questions). | 2026-10-06 |
| Server Actions für Anlegen, Ändern, Löschen; Ergebnis enthält die aktuelle Liste | POST, Zod an der Grenze, gleiche Muster wie PROJ-1. Die mitgelieferte Liste macht die Oberfläche ohne zweite Anfrage aktuell und repariert nach EC-9/EC-10 den Stand. | Route Handler (REST); oder Rückgabe nur der einen Zeile und `router.refresh()` | Bis zu 20 Zeilen pro Antwort, vernachlässigbar. Andere offene Tabs aktualisieren sich erst bei der nächsten eigenen Aktion oder beim Neuladen (nicht gefordert). | 2026-10-06 |
| Datenbank erzwingt alle Regeln zusätzlich (Prüfregeln, eindeutiger Index, Trigger, RLS, Spaltenrechte) | Der Anon-Key ist öffentlich: Wer angemeldet ist, kann die Datenschnittstelle mit seinem Login direkt aufrufen. AC-2, AC-7 und AC-9 verlangen die Ablehnung auch dort. Sicherheitsregel: zweite, unabhängige Sperre. | Prüfung nur in den Server Actions; oder Tabelle für `authenticated` sperren und nur über Service-Rolle schreiben | Regeln stehen an zwei Stellen (Zod und Datenbank) und müssen gleich bleiben – Integrationstests prüfen beide Seiten. | 2026-10-06 |
| Höchstzahl per Trigger mit Sperre pro Nutzer | Garantie für EC-9: Zwei gleichzeitige Einfügungen bei 19 Geräten zählen nacheinander, es entstehen nie 21. Ein einfaches „erst zählen, dann einfügen“ in der App hätte genau diese Lücke. | Zählen in der Server Action; Zähler-Spalte im Profil | Eine Sperre pro Nutzer serialisiert nur dessen eigene Einfügungen – bei einem Nutzer mit zwei Tabs ohne spürbare Wartezeit. | 2026-10-06 |
| Eindeutiger Index auf (Nutzer, Name in Kleinbuchstaben), Name vorher NFC-normalisiert und getrimmt | Garantie für AC-8 und EC-8: Die Datenbank lehnt das zweite gleichnamige Gerät auch bei gleichzeitigem Speichern ab. NFC verhindert, dass „ä“ in zwei Schreibweisen als verschiedene Namen durchgeht. | Duplikat-Prüfung per Abfrage vor dem Einfügen | Kleinschreibung folgt den Regeln der Datenbank-Kollation; für deutsche Namen unkritisch. | 2026-10-06 |
| Namenslänge in Codepoints, nicht in JavaScript-Zeichen | JavaScript zählt ein Emoji als 2, Postgres als 1. Mit Codepoints prüfen Formular und Datenbank dasselbe. | `string.length` | Zusammengesetzte Emojis (z. B. Familie) zählen als mehrere Zeichen. | 2026-10-06 |
| Spaltenrechte: Nutzer dürfen nur `name` und `duration_minutes` schreiben | `created_at` bestimmt die Reihenfolge (AC-10) und `user_id` das Eigentum (AC-2); beides soll niemand fälschen können. | Volle Tabellenrechte, nur RLS | Keiner. | 2026-10-06 |
| Kein Retry-Schutz per Idempotenz-Schlüssel beim Anlegen | Ein einzelnes Einfügen ist atomar, und der eindeutige Name verhindert ein doppeltes Gerät (AC-24). | Vom Browser erzeugte Geräte-ID als Idempotenz-Schlüssel | Ging nur die Antwort verloren und der Nutzer speichert erneut, sieht er „Du hast schon ein Gerät mit diesem Namen.“; die mitgelieferte Liste zeigt das Gerät dann schon. | 2026-10-06 |
| Ändern und Löschen ohne „Upsert“, mit Rückgabe der betroffenen Zeile | Garantie für EC-10: Keine Zeile betroffen → „gibt es nicht mehr“, nie ein neues Gerät. | Upsert | Keiner. | 2026-10-06 |
| Keine Versionsprüfung beim Ändern | Produktentscheidung „die zuletzt gespeicherte Fassung gilt“ (EC-11). | Optimistisches Sperren mit Versionsspalte | Ein Tab kann die Änderung eines anderen Tabs unbemerkt überschreiben – vom Spec so gewollt. | 2026-10-06 |
| Kein eigenes Rate-Limit auf die Server Actions | Sie prüfen keine Zugangsdaten; Massenanlage begrenzt die Höchstzahl von 20, jede Action wirkt nur auf eigene Daten. | Throttle pro Nutzer | Ein angemeldeter Nutzer kann viele Änderungen hintereinander schicken; das kostet nur Server- und Datenbank-CPU. | 2026-10-06 |
| Fremdschlüssel auf `profiles` statt direkt auf `auth.users` | Entspricht dem Datenmodell (ein Profil besitzt viele Geräte). Die Lösch-Kaskade Auth-Nutzer → Profil → Geräte erfüllt AC-27 ohne eigenen Code. | Fremdschlüssel auf `auth.users` | Ein Gerät setzt ein Profil voraus – das legt der Trigger von PROJ-1 bei jeder Registrierung an. | 2026-10-06 |

## Open Questions

- [ ] Preislücken (Slots ohne Preis in den Quelldaten, PROJ-2 EC-4) sind in der Spec von PROJ-3 nicht als Edge Case beschrieben. Das Design schließt Fenster mit Lücke aus (siehe Technical Decisions). Soll dieses Verhalten per `/refine PROJ-3` als EC in die Spec, damit `/qa` es prüfen kann?
