# Datenschutz-Verzeichnis – was WattWann mit personenbezogenen Daten macht

> Die ehrliche Übersicht, welche personenbezogenen Daten das Produkt verarbeitet, warum und wie lange.
>
> - Angelegt und aktuell gehalten von `/dsgvo`, ein Eintrag pro Verarbeitungszweck.
> - Wächst mit dem Produkt: Ändert ein Feature, was gespeichert wird, ändert sich auch sein Eintrag.
> - **Flughöhe:** Zwecke, Rechtsgrundlagen, Speicherdauer und wer die Daten noch sieht. Details auf Feldebene stehen in `docs/data-model.md` und in den Feature-Designs.
>
> Das entspricht weitgehend dem Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO), ist aber ein Engineering-Dokument und keine rechtliche Erklärung. Ob es für deinen Fall vollständig ist, entscheidet ein Anwalt oder ein Datenschutzbeauftragter.

**Anwendbares Recht:** DSGVO (EU/DE), siehe `docs/law/gdpr.md`
**Datenschutz-Haltung:** lean (festgelegt in `docs/PRD.md` → Rahmenbedingungen)
**Verantwortlicher:** Maximilian Kopp, Privatperson (privates Lernprojekt im AI Engineering Accelerator). Kontaktadresse für Datenschutzanfragen: max@kopp-beratung.de
**Zuletzt geprüft:** 2026-10-06 (`/dsgvo PROJ-1`, ergänzt durch `/architecture PROJ-1`)

**Betrieb:** Die App läuft nur lokal (`npm run dev`), die Datenbank liegt in Supabase Cloud. Neben dem Verantwortlichen registrieren sich auch andere echte Personen mit ihren echten E-Mail-Adressen. Ihnen gegenüber gelten die Pflichten deshalb voll, auch wenn die App nicht öffentlich erreichbar ist.

---

## Verarbeitungstätigkeiten

| Zweck | Daten | Von wem | Rechtsgrundlage | Speicherdauer | Beteiligte Auftragsverarbeiter |
|-------|-------|---------|-----------------|---------------|--------------------------------|
| Benutzerkonten betreiben (Registrierung, Login, Bestätigungs- und Reset-Mails) – PROJ-1 | E-Mail-Adresse, Passwort-Hash, optionaler Anzeigename, Zeitpunkte von Registrierung, Bestätigung und letztem Login, Sitzungs-Token | registrierte Nutzer | Art. 6 Abs. 1 lit. b DSGVO (Vertrag: Ohne Konto kann die App die eigenen Geräte nicht speichern) | bis zur Kontolöschung durch den Nutzer; unbestätigte Konten werden nach 7 Tagen automatisch gelöscht | Supabase, Google Workspace (Mailversand) |
| Login vor Passwort-Raten schützen (Sperre nach Fehlversuchen) – PROJ-1 | E-Mail-Adresse und IP-Adresse, nur als SHA-256-Hashes in Zählern für Fehlversuche | alle, die sich anmelden wollen | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse: Schutz der Konten vor Passwort-Raten) | höchstens 15 Minuten | Supabase |

## Besondere Kategorien

- keine. Der Anzeigename ist ein Freitextfeld, auf 50 Zeichen begrenzt und als Name gedacht.

## Auftragsverarbeiter

| Dienst | Was er verarbeitet | Region | AVV unterzeichnet | Außerhalb angemessener Länder? |
|--------|--------------------|--------|-------------------|--------------------------------|
| Supabase (Auth, Postgres) | alle Kontodaten, Sitzungen, Auth-Protokolle mit IP-Adressen, Hashes fehlgeschlagener Login-Versuche | eu-central-1 (Frankfurt) | ☑ automatisch Teil der Nutzungsbedingungen (DPA Version 1, 2026-08-01, supabase.com/legal/customer-resources/data-processing-addendum) | Vertragspartner ist Supabase Pte. Ltd. (Singapur), die Daten liegen in Frankfurt. Für Zugriffe aus Drittländern gelten die im DPA enthaltenen EU-Standardvertragsklauseln |
| Google Workspace (Postfach `max@kopp-beratung.de`, SMTP-Versand der Bestätigungs- und Reset-Mails) | E-Mail-Adresse der Empfänger, Inhalt der Mail mit dem Link; Kopien liegen im Ordner „Gesendet“ des Postfachs | _noch nicht ermittelt_ (Datenregionen gibt es nur in bestimmten Workspace-Editionen) | ☑ Zusatz zur Verarbeitung von Cloud-Daten in der Admin-Konsole akzeptiert (2026-10-06) | Vertragspartner für EU-Kunden ist Google Cloud EMEA Ltd. (Irland), Mutterkonzern Google LLC ist ein US-Unternehmen. Übermittlungsweg: EU-US Data Privacy Framework, laut AVV zu prüfen |

Kein Hosting-Anbieter (kein Deployment), kein Error-Tracking, keine Analytics.

## Betroffenenrechte – wie sie erfüllt werden

| Recht | DSGVO | So erfüllt WattWann es |
|-------|-------|------------------------|
| Auskunft / Kopie | Art. 15 | auf Anfrage per E-Mail an die Kontaktadresse aus den Datenschutzhinweisen, von Hand beantwortet |
| Berichtigung | Art. 16 | den Anzeigenamen ändert der Nutzer selbst in der App (PROJ-1); die E-Mail-Adresse wird auf Anfrage per E-Mail korrigiert |
| Löschung | Art. 17 | „Konto löschen“ in der App (PROJ-1) entfernt Konto, Profil und alle zugehörigen Daten sofort |
| Datenübertragbarkeit | Art. 20 | auf Anfrage per E-Mail, Export als JSON von Hand |
| Widerspruch | Art. 21 | betrifft nur den Missbrauchsschutz (berechtigtes Interesse); auf Anfrage per E-Mail |

> Frist: **ein Kalendermonat** nach der DSGVO (Art. 12 Abs. 3). Verlängerung um zwei Monate in komplexen Fällen, wenn die Person innerhalb des ersten Monats informiert wird.

## Offene Punkte

- [x] AVV mit Supabase: Der DPA ergänzt die Supabase-Nutzungsbedingungen und gilt ohne eigene Unterschrift (geprüft 2026-10-06). Empfehlung: eine PDF-Kopie der DPA-Seite zu den eigenen Unterlagen legen.
- [x] AVV mit Google Workspace: Zusatz zur Verarbeitung von Cloud-Daten akzeptiert (2026-10-06).
- [ ] Aufbewahrung der gesendeten Bestätigungs- und Reset-Mails im Ordner „Gesendet“ festlegen (z. B. regelmäßig löschen), sonst liegen dort Empfängeradressen unbegrenzt.
- [ ] Speicherdauer der Supabase-Auth-Protokolle (`auth.audit_log_entries`, enthalten IP-Adressen) ermitteln, im Free Plan _noch nicht ermittelt_.

## Für einen Anwalt / Datenschutzbeauftragten

- WattWann ist ein privat betriebenes Lernprojekt. Es läuft nur lokal auf dem Rechner des Betreibers, aber einige Bekannte registrieren sich mit ihren echten E-Mail-Adressen in einer Supabase-Datenbank (Frankfurt). Greift dafür die Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO), oder gelten die Pflichten des Verantwortlichen voll, inklusive Datenschutzhinweisen und AVV? Dieses Verzeichnis geht vorsichtshalber vom zweiten Fall aus.
