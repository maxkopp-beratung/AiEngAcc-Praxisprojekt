# Projekt-Briefing: WattWann

> Arbeitstitel: **WattWann** (alternativ „Strom-Timer“)

## Problem

Mit einem dynamischen Stromtarif schwankt der Strompreis über den Tag stark. Wer große Verbraucher (Waschmaschine, Spülmaschine, E-Auto) flexibel starten kann, weiß aber nicht, wann es am günstigsten ist.

## Lösung

Eine Web-App, die die Day-ahead-Börsenpreise anzeigt und für jedes gespeicherte Gerät das günstigste Startfenster empfiehlt.

## Zielgruppe

Privathaushalte mit dynamischem Tarif oder einfach mit Interesse an Strompreisen. Keine Profis.

## Features

- **F1 – Auth:** Registrierung, Login und Logout per E-Mail und Passwort. Jeder Nutzer sieht nur seine eigenen Geräte.
- **F2 – Strompreise:** Anzeige der Day-ahead-Börsenpreise für heute und morgen.
- **F3 – Geräte & Startfenster-Empfehlung (Kernnutzen):** Geräte mit Laufzeit verwalten und pro Gerät das günstigste Startfenster empfehlen.

## Bewusst out of scope

- Netzentgelte, Steuern und Umlagen – also kein echter Endkundenpreis
- Push-Benachrichtigungen
- Smart-Home-Steuerung
- Anbindung an einen echten Stromtarif

## Tech-Stack (Vorschlag)

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Free Plan) für Auth und Datenbank
- Energy-Charts API (ohne API-Key)
