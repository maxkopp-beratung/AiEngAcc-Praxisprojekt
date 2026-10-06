# Product Requirements Document – WattWann

## Vision
WattWann zeigt Haushalten mit dynamischem Stromtarif auf einen Blick, wann Strom heute und morgen am günstigsten ist. Für jedes gespeicherte Gerät (Waschmaschine, Spülmaschine, E-Auto) empfiehlt die App das günstigste Startfenster. So wird ein Börsenpreis-Chart zu einer konkreten Handlungsempfehlung: „Starte um 13:15 Uhr.“

## Zielgruppe
Privathaushalte mit dynamischem Stromtarif oder allgemeinem Interesse an Strompreisen, ohne Fachwissen. Ihr Problem: Der Preis schwankt über den Tag stark. Rohe Börsendaten in EUR/MWh und im 15-Minuten-Raster sind aber für Laien nicht lesbar, und auszurechnen, wann eine 2,5-Stunden-Wäsche am günstigsten läuft, ist im Kopf nicht machbar.

## Kernfunktionen (Roadmap)

Für das MVP braucht es drei Dinge:
- ein Konto mit Login, damit die eigenen Geräte gespeichert bleiben
- die aktuellen Day-ahead-Preise für heute und morgen
- pro Gerät eine Empfehlung für das günstigste zusammenhängende Startfenster, verglichen mit „sofort starten“

Alles darüber hinaus (Benachrichtigungen, Endkundenpreise, Smart-Home) kommt bewusst später oder nie. Die Feature-Liste steht in `features/INDEX.md`.

## Erfolgskriterien
- Eine neue Person schafft es ohne Erklärung in unter 2 Minuten, sich zu registrieren, ein Gerät anzulegen und dessen empfohlenes Startfenster zu sehen.
- Die Empfehlung ist nachweislich richtig: Automatisierte Tests bestätigen das günstigste zusammenhängende Fenster, auch in Randfällen (Zeitumstellung, fehlende Preise für morgen, Laufzeit länger als der verfügbare Zeitraum).
- Die angezeigten Preise stimmen mit der Energy-Charts-Quelle überein.

## Rahmenbedingungen
- **Kontext:** Praxisprojekt im AI Engineering Accelerator. Jedes Feature durchläuft den kompletten Kit-Workflow (`/write-spec` → `/architecture` → `/tasks` → `/build` → `/qa`). Der Git-Verlauf muss diese Reihenfolge zeigen, und am Ende stehen alle Features auf „Approved“.
- **Team & Budget:** Solo mit Claude Code, 0 €. Nur Free-Tarife und öffentliche APIs ohne Schlüssel.
- **Zeitrahmen:** kein fester Abgabetermin.
- **Stack:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Free Plan) über `@supabase/ssr`, Energy-Charts API (ohne Key).
- Backend: Supabase Cloud (Auth + Postgres + RLS)
- Environment strategy: single
- Hosting: kein Deployment. Die App läuft lokal (`npm run dev`), die Datenbank in Supabase Cloud.
- Data region: eu-central-1 (Frankfurt)
- Data protection law: GDPR (EU/DE)
- Data protection stance: lean
- Design system: see `docs/design-system.md`
- **Keine Secrets im Repository:** Schlüssel nur in `.env.local`, die Git ignoriert.

## Nicht-Ziele
- Netzentgelte, Steuern und Umlagen: kein echter Endkundenpreis, nur der reine Börsenpreis
- Push-Benachrichtigungen
- Smart-Home-Steuerung
- Anbindung an einen echten Stromtarif
- Deployment auf einen Webserver
