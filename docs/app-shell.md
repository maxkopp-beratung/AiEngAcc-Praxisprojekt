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
| `/dashboard` | Preise ansehen, Geräte verwalten, Empfehlungen sehen | angemeldet | Rahmen: PROJ-1 · Abschnitt „Strompreise“: PROJ-2 · Abschnitt „Meine Geräte“: PROJ-3 |

## Layout

Kopfzeile mit App-Name und Abmelden, darunter der Inhalt einspaltig. Keine Seitenleiste.

## Abschnitts-Muster

Titel, Lade-, Leer- und Fehlerzustand sowie Rückmeldungen folgen `docs/design-system.md` → Komponenten-Konventionen.

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das einen Bereich oder eine Layout-Region hinzufügt, aktualisiert es zuerst diese Übersicht. Verhaltensänderungen am Rahmen laufen über `/refine` auf dem zuständigen Feature – nie direkt in die `design.md` eines anderen Features._
