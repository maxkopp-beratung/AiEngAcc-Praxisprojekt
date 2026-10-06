# App-Rahmen & Navigation

> Die app-weite Übersicht über **den Rahmen, in dem jedes Feature angezeigt wird** – Bereiche, Layout und das gemeinsame Seitenmuster.
>
> - Erstellt von `/init` (erster Gesamtentwurf: Bereiche + Layout).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Struktur, nicht Gestaltung. Farben, Schriften und Komponenten-Stil stehen in `docs/design-system.md`; das Innere einer einzelnen Seite steht in der `design.md` des jeweiligen Features. Das genaue Verhalten (Weiterleitungen, mobiles Verhalten usw.) wird in den Specs als Akzeptanzkriterien festgelegt.

## Zuständiges Feature

Owner: PROJ-1 (Benutzerkonto & Login) – liefert den geschützten Bereich `/dashboard` mit Kopfzeile und Abmelden. PROJ-2 und PROJ-3 füllen nur Abschnitte darin. Änderungen am Rahmen laufen über `/refine PROJ-1`.

## Bereiche

| Bereich | Was man dort tut | Sichtbar für | Feature |
|---------|------------------|--------------|---------|
| `/login` | anmelden | nicht angemeldet | PROJ-1 |
| `/signup` | registrieren | nicht angemeldet | PROJ-1 |
| `/signup/check-email` | Hinweis „Prüfe dein Postfach“, Bestätigungslink erneut senden | nicht angemeldet | PROJ-1 |
| `/forgot-password` | Reset-Link anfordern | alle | PROJ-1 |
| `/reset-password` | neues Passwort setzen | nur mit Reset-Sitzung | PROJ-1 |
| `/auth/confirm` | (Endpunkt) Link aus der Mail prüfen und weiterleiten | alle | PROJ-1 |
| `/auth/link-invalid` | Hinweis „Link ungültig oder abgelaufen“, neuen Link anfordern | alle | PROJ-1 |
| `/datenschutz` | Datenschutzhinweise lesen | alle | PROJ-1 |
| `/api/prices` | (Endpunkt) Strompreise für heute und morgen, vom Abschnitt „Strompreise“ zum Aktualisieren abgefragt | angemeldet (sonst 401) | PROJ-2 |
| `/dashboard` | Preise ansehen, Geräte verwalten, Empfehlungen sehen | angemeldet | Rahmen: PROJ-1 · Abschnitt „Strompreise“: PROJ-2 · Abschnitt „Meine Geräte“: PROJ-3 |

## Layout

- **Dashboard:** Kopfzeile (`AppHeader`) mit Logo und Schriftzug links (Link zur Übersicht) und einem Menü rechts. Das Menü zeigt den Anzeigenamen oder die E-Mail-Adresse und enthält „Anzeigename ändern“, „Datenschutz“, „Konto löschen“ und „Abmelden“. Darunter steht der Inhalt einspaltig mit dem Seitentitel „Übersicht“, darunter in dieser Reihenfolge die Abschnitte „Strompreise“ (PROJ-2) und „Meine Geräte“ (PROJ-3). Keine Seitenleiste.
- **Gemeinsamer Preis-Zustand auf dem Dashboard:** Ein Provider im Browser (`LivePricesProvider`, PROJ-3) umschließt beide Abschnitte. Er hält die Preise, „jetzt“ und das Nachladen von `/api/prices` genau einmal pro Seite. Jeder Abschnitt, der mit Preisen rechnet, liest von dort und startet keine eigene Uhr und kein eigenes Nachladen.
- **Auth-Seiten** (`/login`, `/signup`, Reset, Link-Hinweise): ohne Kopfzeile, eine zentrierte Karte (`AuthCard`) mit Logo oben, unten Links zu „Datenschutz“ und zur jeweils anderen Auth-Seite.
- **`/datenschutz`:** ohne Kopfzeile, einspaltiger Text mit Link „Zurück“.
- **Weiterleitungen:** `/` führt angemeldet zu `/dashboard`, sonst zu `/login`. Wer nicht angemeldet `/dashboard` aufruft, landet auf `/login` und danach wieder dort. Wer angemeldet `/login` oder `/signup` aufruft, landet auf `/dashboard`.
- **Rückmeldungen:** ein Toaster für die ganze App (im Root-Layout).

## Abschnitts-Muster

Titel, Lade-, Leer- und Fehlerzustand sowie Rückmeldungen folgen `docs/design-system.md` → Komponenten-Konventionen.

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das einen Bereich oder eine Layout-Region hinzufügt, aktualisiert es zuerst diese Übersicht. Verhaltensänderungen am Rahmen laufen über `/refine` auf dem zuständigen Feature – nie direkt in die `design.md` eines anderen Features._
