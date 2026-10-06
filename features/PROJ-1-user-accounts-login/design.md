# PROJ-1 — Tech Design: Benutzerkonto & Login

> Das technische Design (das WIE) zu `spec.md`. Zwei Leser: der PM (gibt frei) und `/build` (baut direkt danach). Kein Code, aber so genau, dass niemand raten muss.
> Owner: `/architecture`. Der Vertrag (WAS) steht in `spec.md`, die Aufgabenliste in `tasks.md`.

## Überblick

Alle Formulare, die ein Passwort oder eine E-Mail-Adresse verarbeiten, laufen über **Server Actions** auf unserem Next.js-Server. Diese rufen Supabase Auth serverseitig auf. Der Browser spricht für Login, Registrierung und Reset nie selbst mit Supabase. So bleiben Zugangsdaten aus jeder URL heraus (POST), alle Eingaben werden serverseitig geprüft, und unsere eigene Login-Sperre sitzt vor jedem Versuch.

Zwei Schutzschichten gegen Passwort-Raten:

1. **Unsere Login-Sperre** in der Datenbank: 5 Fehlversuche pro E-Mail-Adresse bzw. 20 pro IP-Adresse in 15 Minuten. Sie greift für alles, was über die Anmeldeseite von WattWann läuft.
2. **Die eingebauten Limits von Supabase**, fest pro IP-Adresse, dazu das Mail-Limit von 30 pro Stunde. Sie gelten auch für jemanden, der Supabase direkt aufruft.

**Bewusst kein CAPTCHA** (Produktentscheidung vom 2026-10-06): Wer Supabase mit dem öffentlichen Anon-Key direkt aufruft, umgeht unsere Sperre, und ein Skript kann massenhaft Konten anlegen. An Daten anderer Nutzer kommt dabei niemand, das verhindert RLS.

Mails (Bestätigung, Reset) verschickt Supabase über den **SMTP-Zugang des bestehenden Postfachs `max@kopp-beratung.de`**, also als Einzelabsender ohne zusätzlichen Mail-Dienst. Der eingebaute Mailversand von Supabase stellt nur an Mitglieder des Supabase-Teams zu, und das nur 2-mal pro Stunde.

## Component Structure

```
Root-Layout (Sprache Deutsch, Titel „WattWann“, Schrift Inter, Toaster für Rückmeldungen)
│
├── /                         → leitet weiter: angemeldet → /dashboard, sonst → /login   (AC-14)
│
├── Auth-Bereich (zentrierte Karte, max. 400 px breit, kein Header)
│   ├── /login
│   │   ├── Hinweis-Alert „Dein Konto wurde gelöscht“ (nur nach AC-25)
│   │   ├── Formular: E-Mail, Passwort, Button „Anmelden“
│   │   ├── Fehlerbereich: falsche Daten / Sperre mit Minuten / unbestätigt + „Link erneut senden“ / Verbindungsfehler
│   │   └── Links: „Passwort vergessen?“, „Noch kein Konto? Registrieren“, „Datenschutz“
│   ├── /signup
│   │   ├── Formular: E-Mail, Passwort (Hilfetext „mind. 8 Zeichen“), Anzeigename (optional)
│   │   ├── Satz neben dem Button: „Mit der Registrierung gelten unsere Datenschutzhinweise“ (Link)
│   │   └── Links: „Schon ein Konto? Anmelden“, „Datenschutz“
│   ├── /signup/check-email   „Prüfe dein Postfach“ + Adresse + Button „Link erneut senden“ (60-s-Countdown)
│   ├── /forgot-password      Formular: E-Mail → immer dieselbe neutrale Meldung
│   ├── /reset-password       Formular: neues Passwort → speichert, weiter zu /dashboard
│   └── /auth/link-invalid    „Dieser Link ist ungültig oder abgelaufen“ + passende Aktion (neuer Bestätigungslink bzw. neues Passwort)
│
├── /auth/confirm             (keine Seite, nur ein Endpunkt) prüft den Link aus der Mail und leitet weiter
│
├── /datenschutz              öffentliche Seite mit den Datenschutzhinweisen (AC-26), ohne Header, mit Link „Zurück“
│
└── /dashboard  (geschützt)
    ├── AppHeader  ← Teil des App-Rahmens, gehört PROJ-1
    │   ├── links: „WattWann“
    │   └── rechts: Menü-Button mit Anzeigename oder E-Mail (gekürzt mit „…“)
    │       ├── „Anzeigename ändern“ → Dialog mit einem Feld + „Speichern“
    │       ├── „Datenschutz“ → /datenschutz
    │       ├── „Konto löschen“ → Bestätigungsdialog (destruktiv)
    │       └── „Abmelden“
    └── Inhaltsbereich (einspaltig)
        └── Seitentitel „Übersicht“. Hier hängen PROJ-2 („Strompreise“) und PROJ-3 („Meine Geräte“) ihre Abschnitte ein
```

**Wiederverwendete shadcn/ui-Komponenten:** `card`, `form`, `input`, `label`, `button`, `alert`, `dropdown-menu`, `dialog`, `alert-dialog`, `sonner`. Neue eigene Komponenten:
- `AppHeader` (Kopfzeile mit Menü)
- `AuthCard` (Rahmen der Auth-Seiten)
- `ResendButton` (Countdown)

**Zustände** nach `docs/design-system.md`:
- Buttons sind während des Sendens deaktiviert und zeigen einen Spinner (EC-1).
- Feldfehler stehen rot unter dem Feld.
- Server- und Verbindungsfehler erscheinen als `destructive`-Alert über dem Button. Der Button heißt dann „Erneut versuchen“, die E-Mail-Adresse bleibt im Feld stehen (EC-5).
- Erfolge melden sich per Toast.

## Data Model

### `profiles` (neue Tabelle, Schema `public`)

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | UUID | Primärschlüssel, identisch mit der ID des Supabase-Auth-Nutzers. Fremdschlüssel auf `auth.users`. **Wird der Auth-Nutzer gelöscht, wird das Profil automatisch mitgelöscht.** |
| `display_name` | Text, optional | Leer = kein Name. Falls gesetzt: 1–50 Zeichen, ohne Leerzeichen am Anfang und Ende. Die Datenbank erzwingt das zusätzlich per Prüfregel |
| `created_at` | Zeitstempel mit Zeitzone | Pflicht, Standard: jetzt |
| `updated_at` | Zeitstempel mit Zeitzone | Pflicht, Standard: jetzt, wird bei jeder Änderung automatisch neu gesetzt |

- **Die E-Mail-Adresse wird nicht ins Profil kopiert.** Sie liegt bereits beim Auth-Nutzer, eine zweite Kopie würde nur auseinanderlaufen (Datensparsamkeit).
- **Angelegt wird das Profil automatisch:** Ein Datenbank-Trigger auf neuen Auth-Nutzern legt genau ein Profil an (AC-3). Den Anzeigenamen übernimmt er aus den Registrierungsdaten: Leerzeichen am Rand werden entfernt, und ein leerer oder zu langer Name wird zu „kein Name“ (zweite Absicherung zur Prüfung in der Server Action).
- **Zugriff (RLS an, ausdrückliche Rechte, weil „automatisch freigeben“ im Projekt aus ist):**
  - Angemeldete Nutzer dürfen **nur ihr eigenes** Profil lesen.
  - Angemeldete Nutzer dürfen **nur ihr eigenes** Profil ändern, und zwar **nur die Spalte `display_name`**.
  - Anlegen und Löschen dürfen Nutzer nie direkt. Das übernehmen Trigger und Lösch-Kaskade.
  - Nicht angemeldete Besucher (`anon`) haben **keinerlei** Rechte auf die Tabelle (AC-23, AC-24).
- **Gespeichert bis:** zur Löschung des Kontos (AC-25) bzw. bis zur automatischen Löschung unbestätigter Konten nach 7 Tagen (AC-27).

### `login_failures` (neue Tabelle, internes Schema `private`, nicht über die Datenschnittstelle erreichbar)

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | fortlaufende Zahl | Primärschlüssel |
| `email_hash` | Text | SHA-256 der normalisierten E-Mail-Adresse (getrimmt, kleingeschrieben). Pflicht |
| `ip_hash` | Text | SHA-256 der IP-Adresse. Pflicht |
| `created_at` | Zeitstempel mit Zeitzone | Pflicht, Standard: jetzt |

- Je ein Index auf (`email_hash`, `created_at`) und (`ip_hash`, `created_at`), damit das Zählen schnell bleibt.
- **Es werden keine Klartext-Adressen gespeichert**, nur Hashes. Das ist kein vollständiger Schutz, weil sich eine bekannte Adresse nachrechnen lässt. Es hält aber die Tabelle selbst frei von lesbaren Adressen und IPs.
- **Zugriff:** Weder `anon` noch `authenticated` haben irgendein Recht. Lesen und Schreiben geht nur über zwei Datenbankfunktionen (siehe unten). Diese darf nur die **Service-Rolle** aufrufen, also nur unser Server.
- **Gespeichert bis:** höchstens 15 Minuten nach dem Fehlversuch. Jede neue Eintragung löscht abgelaufene Zeilen, zusätzlich räumt der stündliche Aufräum-Job auf.

### Supabase Auth (bestehend, nicht von uns angelegt)

Supabase speichert E-Mail-Adresse, Passwort-Hash, Bestätigungs- und Login-Zeitpunkte sowie Protokolle mit IP-Adressen in seinem eigenen Schema `auth`. Wir lesen davon nur, was die Session liefert: ID, E-Mail, Bestätigungs- und Reset-Zeitpunkt.

### Aufräum-Job (pg_cron, stündlich, per Migration angelegt)

1. Löscht Auth-Nutzer, die **vor mehr als 7 Tagen** angelegt wurden und **nie bestätigt** sind. Profile verschwinden per Kaskade mit (AC-27).
2. Löscht Zeilen in `login_failures`, die älter als 15 Minuten sind.

## Behaviors & Access

### Datenbankfunktionen (nur Service-Rolle darf sie aufrufen)

- **Sperrstatus abfragen** (E-Mail-Hash, IP-Hash) → gibt „gesperrt ja/nein“ und „frei in N Sekunden“ zurück.
  - Gesperrt, wenn in den letzten 15 Minuten **≥ 5** Fehlversuche für diesen E-Mail-Hash **oder ≥ 20** für diesen IP-Hash vorliegen.
  - „Frei in“ = Zeitpunkt, zu dem der älteste der zählenden Versuche aus dem 15-Minuten-Fenster fällt, minus jetzt. Bei Sperre durch beide Zähler gilt der spätere Wert.
- **Fehlversuch eintragen** (E-Mail-Hash, IP-Hash) → fügt eine Zeile ein und löscht dabei Zeilen, die älter als 15 Minuten sind.
- **Gibt es die Adresse schon?** (normalisierte E-Mail) → ja/nein. Nur für die Registrierung (AC-7).

### Server Actions (alle prüfen ihre Eingaben mit Zod auf dem Server, alle senden per POST)

**Registrieren** (AC-1, AC-2, AC-3, AC-7, EC-1, EC-4, EC-7)
- Eingaben:
  - E-Mail: Pflicht, gültiges Format, wird getrimmt und kleingeschrieben.
  - Passwort: Pflicht, 8–72 Zeichen und höchstens 72 Bytes.
  - Anzeigename: optional, getrimmt, leer → keiner, max. 50 Zeichen.
- Bei Feldfehlern: Fehler pro Feld zurück, nichts weiter (AC-2).
- Gibt es die Adresse schon: **kein** Aufruf von Supabase, keine Mail, keine Änderung. Weiter wie bei Erfolg (AC-7).
- Sonst: Supabase-Registrierung mit dem Anzeigenamen als Registrierungsdaten.
  - Antwortet Supabase mit einem Mail-Fehler: EC-4-Meldung.
- Erfolg: Die Adresse kommt in ein kurzlebiges Cookie `pending_email` (httpOnly, 1 Stunde, SameSite=Lax), danach geht es weiter zu `/signup/check-email`. Die Adresse steht dabei **nicht** in der URL.

**Bestätigungslink erneut senden** (AC-5, AC-6, EC-3)
- Eingabe: E-Mail-Adresse. Auf `/signup/check-email` kommt die Adresse aus dem Cookie, auf `/auth/link-invalid` aus einem Eingabefeld.
- Supabase verschickt den Link neu. Den Mindestabstand von 60 Sekunden pro Adresse erzwingt Supabase selbst, die Oberfläche zeigt den Countdown.
- **Die Antwort ist immer neutral** („Falls ein unbestätigtes Konto mit dieser Adresse existiert, haben wir dir einen neuen Link geschickt“). Einzige Ausnahmen: Supabase meldet „zu häufig“ (dann „Bitte warte noch kurz“) oder einen Mail- bzw. Verbindungsfehler (dann EC-4/EC-5).

**Anmelden** (AC-6, AC-8 bis AC-11, AC-13, EC-7, EC-12)
- Eingaben:
  - E-Mail: Pflicht, normalisiert.
  - Passwort: Pflicht, max. 72 Zeichen. Keine Mindestlänge, damit die Meldung nichts über die Regeln verrät.
  - `next`: optionales Rücksprungziel.
- Ablauf:
  1. Sperrstatus abfragen. Ist die Adresse gesperrt: Meldung „Zu viele Fehlversuche. Bitte versuche es in X Minuten erneut.“ (X = Sekunden aufgerundet auf volle Minuten), **kein** Login-Versuch, kein weiterer Eintrag. Die Sperre greift für unbekannte Adressen genauso, verrät also nichts.
  2. Supabase-Login.
  3. Je nach Antwort:
     - Falsche Zugangsdaten: Fehlversuch eintragen, Meldung „E-Mail-Adresse oder Passwort ist falsch“ (AC-9).
     - Konto unbestätigt (meldet Supabase nur bei korrektem Passwort): **kein** Fehlversuch. Cookie `pending_email` setzen, Hinweis „Bitte bestätige zuerst deine E-Mail-Adresse“ mit Link zu `/signup/check-email` (AC-6).
     - Sonstiger Fehler: EC-5-Alert.
     - Erfolg: Weiterleitung zu `next`, wenn das ein interner Pfad ist (beginnt mit genau einem `/`, nicht mit `//` und nicht mit `/\`), sonst zu `/dashboard` (EC-12).
- **IP-Adresse:** erster Eintrag aus `x-forwarded-for`, sonst `x-real-ip`, sonst „unknown“. Lokal laufen alle Anfragen über dieselbe Adresse und teilen sich deshalb den IP-Zähler (20 Versuche).

**Passwort vergessen** (AC-19, EC-8)
- Eingabe: E-Mail (normalisiert).
- Supabase verschickt den Reset-Link. **Die Antwort ist immer** „Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link geschickt“. Einzige Ausnahme: Verbindungs- oder Mailfehler (EC-4/EC-5).
- Fordert jemand einen neuen Link an, ersetzt Supabase den alten. Damit gilt nur der zuletzt verschickte (EC-8).

**Link aus der Mail prüfen** — Endpunkt `/auth/confirm` (AC-4, AC-20, AC-21, EC-2, EC-3, EC-9)
- Der Link enthält `token_hash` und `type` (`signup` oder `recovery`). Der Endpunkt prüft beides bei Supabase. Gültig ist ein Link 24 Stunden, siehe Settings.
- `signup` gültig: Adresse bestätigt, Nutzer angemeldet → `/dashboard`.
- `recovery` gültig: Nutzer angemeldet, Adresse gilt als bestätigt (EC-9).
  - Danach wird geprüft, wann der Reset angefordert wurde (`recovery_sent_at` des Nutzers). **Älter als 1 Stunde:** abmelden, weiter zu `/auth/link-invalid?typ=reset` (AC-21).
  - Sonst weiter zu `/reset-password`.
- Ungültig, abgelaufen oder schon benutzt:
  - Ist der Nutzer bereits angemeldet: weiter zu `/dashboard`.
  - Sonst: weiter zu `/auth/link-invalid?typ=signup` bzw. `?typ=reset`.
- **Hinweis zu EC-2:** Supabase unterscheidet „schon benutzt“ nicht von „abgelaufen“. Die Seite deckt deshalb beides ab: „Dieser Link ist ungültig oder abgelaufen. Hast du deine Adresse schon bestätigt? Dann melde dich einfach an.“ mit Button „Anmelden“ und dem Formular für einen neuen Link. So steht es jetzt auch in EC-2.

**Neues Passwort setzen** (AC-20)
- Nur mit Reset-Sitzung erreichbar. Ohne Sitzung geht es weiter zu `/auth/link-invalid?typ=reset`.
- Eingabe: Passwort, 8–72 Zeichen und höchstens 72 Bytes.
- Supabase ändert das Passwort. Danach geht es zu `/dashboard`, dort meldet ein Toast „Dein Passwort wurde geändert“.

**Anzeigename ändern** (AC-18, EC-10)
- Nur angemeldet. Eingabe: Name, getrimmt, leer → keiner, max. 50 Zeichen.
- Aktualisiert **nur das eigene** Profil. Die App filtert auf die eigene ID, RLS erzwingt es zusätzlich.
- Danach wird die Kopfzeile neu geladen, und ein Toast meldet „Anzeigename gespeichert“.
- Namen werden überall als reiner Text gerendert (React escapt). Es gibt kein Rendern von HTML.

**Abmelden** (AC-17, EC-6)
- Beendet nur die Sitzung dieses Geräts (Supabase-Scope „local“) → `/login`.
- Dashboard-Seiten werden dynamisch und ohne Cache ausgeliefert. Der Zurück-Button zeigt deshalb keine alten Daten.

**Konto löschen** (AC-25, EC-6, EC-11, EC-13)
- Nur angemeldet und nur nach Bestätigung im Dialog. Abbrechen ändert nichts (EC-13).
- Ablauf:
  1. Der Server ermittelt die eigene Nutzer-ID aus der geprüften Sitzung, **nie aus einem Formularfeld**.
  2. Er löscht den Auth-Nutzer über die Admin-Schnittstelle (Service-Rolle).
  3. Das Profil verschwindet per Kaskade. Spätere Geräte (PROJ-3) hängen ebenfalls per Kaskade am Profil.
  4. Die lokale Sitzung wird beendet → `/login?konto=geloescht` → Hinweis „Dein Konto wurde gelöscht“.
- Eine spätere Registrierung mit derselben Adresse ergibt ein komplett neues Konto (EC-11).

### Weiterleitungen und Sitzung (`src/proxy.ts` + Dashboard-Layout)

- **Der Proxy läuft bei jeder Seitenanfrage.** Er frischt die Supabase-Sitzung auf und leitet um:
  - `/` → `/dashboard` oder `/login` (AC-14)
  - `/dashboard…` ohne Sitzung → `/login?next=<Pfad>` (AC-13)
  - `/login` und `/signup` mit Sitzung → `/dashboard` (AC-15)
- **Zweite, unabhängige Prüfung im Dashboard-Layout:** Es fragt den Nutzer direkt beim Supabase-Auth-Server ab, nicht nur aus dem Token. Bei einem inzwischen gelöschten Konto (EC-6) oder ohne Sitzung geht es zu `/login`.
- **Sitzungsdauer:** Supabase-Standard. Das Zugangs-Token gilt 1 Stunde und wird automatisch erneuert, ohne festes Ende, bis zum Abmelden (AC-12).

### Rechte-Übersicht

| Wer | darf |
|-----|------|
| nicht angemeldet | `/`, `/login`, `/signup`, `/signup/check-email`, `/forgot-password`, `/auth/confirm`, `/auth/link-invalid`, `/datenschutz` aufrufen. Keinerlei Zugriff auf Tabellen |
| angemeldet | zusätzlich `/dashboard`, `/reset-password`. Eigenes Profil lesen und `display_name` ändern, eigenes Konto löschen. Auf fremde Profile kein Zugriff |
| unser Server (Service-Rolle) | Sperr-Funktionen aufrufen, Existenz einer Adresse prüfen, Auth-Nutzer löschen. Der Schlüssel liegt nur serverseitig in `.env.local` und **nie** in einer `NEXT_PUBLIC_`-Variable |

### Sicherheits-Header (`next.config.ts`)

PROJ-1 besitzt den App-Rahmen und setzt deshalb für alle Antworten:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

Die Content-Security-Policy kommt nicht jetzt (siehe Technische Entscheidungen).

## Dependencies

- `server-only` — sorgt dafür, dass das Modul mit dem Service-Rollen-Schlüssel nie in den Browser-Code gelangt (Build bricht sonst ab)

Bereits vorhanden: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`, `lucide-react`.

**Neue Umgebungsvariablen** (Platzhalter in `.env.local.example`, echte Werte trägst du selbst in `.env.local` ein):
- `SUPABASE_SERVICE_ROLE_KEY` — nur serverseitig

**Projekt-Setup, das `/build` mitmacht:** `supabase init` (legt `supabase/` mit dem Migrationsordner an). `supabase login` und `supabase link` musst du selbst ausführen, siehe unten.

## Settings the user makes

Alle Einstellungen sind `now`: Es gibt kein Deployment, das Supabase-Projekt („single“) ist Test- und Live-Umgebung zugleich.

| Setting | Where | When | Value | Why | → AC |
| --- | --- | --- | --- | --- | --- |
| Supabase-CLI anmelden und Projekt verknüpfen | Terminal: `supabase login`, dann `supabase link --project-ref <ref>` (fragt nach dem Datenbank-Passwort) | now | Projekt-Ref aus der Dashboard-URL | ohne Verknüpfung kann `/build` die Migrationen nicht einspielen | AC-3, AC-23, AC-24, AC-27 |
| App-Passwort für das Postfach | Google-Konto `max@kopp-beratung.de` → Sicherheit → Bestätigung in zwei Schritten (muss an sein) → App-Passwörter → neues App-Passwort „WattWann Supabase“. Falls die Option fehlt: in der Google-Admin-Konsole App-Passwörter bzw. SMTP-Zugriff für den Nutzer erlauben | now | Absender `max@kopp-beratung.de`, Name „WattWann“ | Supabase stellt ohne eigenen SMTP-Server nur an Team-Mitglieder zu, max. 2 Mails/Stunde | AC-1, AC-5, AC-19 |
| Eigener SMTP-Dienst | Supabase → Authentication → Emails → SMTP Settings | now | Host `smtp.gmail.com`, Port 587, Benutzer `max@kopp-beratung.de`, Passwort = App-Passwort, Absender wie oben | dto. Die Zugangsdaten liegen nur im Supabase-Dashboard, nie im Repo | AC-1, AC-5, AC-19, EC-4 |
| Mail-Limit | Supabase → Authentication → Rate Limits → „emails sent per hour“ | now | 30 (Standard mit eigenem SMTP) | deckt Tests mit mehreren Personen und bleibt weit unter Googles Versandgrenze von rund 2.000 Mails pro Tag und Nutzer | EC-4 |
| E-Mail-Bestätigung an | Supabase → Authentication → Sign In / Providers → Email → „Confirm email“ | now | an | Login erst nach Bestätigung | AC-4, AC-6 |
| Link-Gültigkeit | dort → „Email OTP Expiration“ | now | 86400 Sekunden (24 h) | Bestätigungslink gilt 24 h. Den Reset-Link begrenzt die App selbst auf 1 h | AC-4, AC-20, EC-3 |
| Mindestlänge Passwort | dort → „Minimum password length“ | now | 8, keine Pflicht-Zeichenklassen | zweite Prüfung neben der Server Action | AC-2 |
| Leaked-Password-Schutz | Authentication → Attack Protection | — | **aus**, nur im Pro-Plan | 0-€-Budget, Entscheidung in der Spec | — |
| CAPTCHA-Schutz | Authentication → Attack Protection → Enable Captcha protection | — | **aus** lassen | Produktentscheidung vom 2026-10-06, AC-22 entfallen | — |
| Mail-Vorlage „Confirm signup“ | Supabase → Authentication → Emails → Templates | now | deutscher Text. Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` | der Link muss auf unseren Endpunkt zeigen und auch in einem anderen Browser bzw. auf dem Handy funktionieren | AC-4 |
| Mail-Vorlage „Reset password“ | dort | now | deutscher Text, Hinweis „gilt 1 Stunde“. Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` | dto. | AC-19, AC-20 |
| Site-URL und erlaubte Weiterleitungen | Supabase → Authentication → URL Configuration | now | Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**` | Links in den Mails zeigen auf die lokal laufende App | AC-4, AC-20 |
| Schlüssel in `.env.local` | `.env.local` (trägst du selbst ein) | now | `SUPABASE_SERVICE_ROLE_KEY` aus Supabase → Project Settings → API Keys (secret/service_role), **ohne** `NEXT_PUBLIC_`-Präfix | Sperre, Existenz-Prüfung, Konto löschen | AC-7, AC-10, AC-25 |
| AVV / DPA abschließen | Supabase → Organization Settings → Legal Documents · Google Workspace → Admin-Konsole → Konto → Rechtliches und Compliance | now | — | Auftragsverarbeitung nach Art. 28 DSGVO, siehe `docs/privacy.md` | AC-26 |

## Technical Decisions

| Decision | Rationale | Alternative considered | Trade-off | Date |
| --- | --- | --- | --- | --- |
| Alle Auth-Formulare über Server Actions, die Supabase serverseitig aufrufen | POST statt GET, Eingaben serverseitig geprüft, unsere Sperre sitzt vor jedem Login (Stack-Pack: „The login and signup flow“) | Browser ruft Supabase direkt auf | etwas mehr Code pro Formular | 2026-10-06 |
| ~~Cloudflare Turnstile, von **Supabase** geprüft, für Registrierung, Login, Reset und Neuversand~~ (ersetzt am 2026-10-06, siehe unten) | Der Anon-Key ist öffentlich. Nur eine Prüfung bei Supabase selbst stoppt Skripte, die unsere App umgehen. Supabase prüft dann für alle diese Endpunkte | CAPTCHA nur in unserer App (umgehbar); hCaptcha (setzt mehr Tracking ein) | beim Login erscheint ein kleines Prüffeld. Weicht von der Produktentscheidung „kein CAPTCHA beim Login“ ab → `/refine PROJ-1`, vom Nutzer freigegeben | 2026-10-06 |
| Login-Sperre als Tabelle in Supabase-Postgres, nur über Funktionen für die Service-Rolle | Kein weiterer Dienst, kein weiterer Auftragsverarbeiter, die Datenbank ist schon da. Zählt pro E-Mail **und** pro IP (Security-Regeln) | Upstash Redis (Stack-Pack-Standard: zusätzliches Konto, zusätzlicher Auftragsverarbeiter, US-Firma) | etwas mehr Datenbanklast pro Login, bei der Nutzerzahl unerheblich | 2026-10-06 |
| Nur **Fehlversuche** zählen, Prüfung **vor** dem Versuch | So steht es in AC-10/AC-11. Ein gesperrter Versuch wird gar nicht erst geprüft und verlängert die Sperre nicht | jeden Versuch zählen | wer trifft, bevor das Limit erreicht ist, wird nicht gezählt. Das ist beabsichtigt | 2026-10-06 |
| Gleitendes 15-Minuten-Fenster | „frei in X Minuten“ ist dann exakt berechenbar und für Nutzer nachvollziehbar | feste Zeitblöcke | — | 2026-10-06 |
| E-Mail und IP in der Sperr-Tabelle nur als SHA-256 | Datensparsamkeit: keine lesbaren Adressen in einer Hilfstabelle | Klartext; HMAC mit Geheimschlüssel | Hashes bekannter Adressen lassen sich nachrechnen. Bei 15 Minuten Speicherdauer vertretbar | 2026-10-06 |
| Bei vorhandener Adresse ruft die Registrierung Supabase gar nicht erst auf | Garantiert AC-7 (bestehendes Konto bleibt unverändert, keine Mail), unabhängig davon, wie Supabase sich bei unbestätigten Doppelungen verhält | sich auf Supabases eigene Verschleierung verlassen | der Weg „Adresse existiert“ antwortet etwas schneller als der mit Mailversand. Ein messbarer Zeitunterschied bleibt, bei dieser Nutzerzahl ist das akzeptiert | 2026-10-06 |
| Service-Rolle nur serverseitig, an genau drei Stellen (Sperre, Existenz-Prüfung, Konto löschen), Modul mit `server-only` geschützt | Das Konto zu löschen geht offiziell nur über die Admin-Schnittstelle. Die Sperr-Tabelle darf für den Browser nicht erreichbar sein | Sicherheitsfunktionen für `anon` freigeben (Browser könnte Zähler fälschen) | ein mächtiger Schlüssel liegt in `.env.local`. Er darf nie ein `NEXT_PUBLIC_`-Präfix bekommen | 2026-10-06 |
| Mail-Links mit `token_hash` über den eigenen Endpunkt `/auth/confirm` statt PKCE-Code-Austausch | Funktioniert auch, wenn der Link in einem anderen Browser oder auf dem Handy geöffnet wird. Der PKCE-Code braucht denselben Browser | Supabase-Standardlink mit PKCE | die Mail-Vorlagen müssen angepasst werden (User-Setting) | 2026-10-06 |
| Link-Gültigkeit 24 h in Supabase, Reset-Link zusätzlich per `recovery_sent_at` auf 1 h begrenzt | Supabase kennt nur **eine** Gültigkeit für alle Mail-Links, die Spec will 24 h für die Bestätigung und 1 h für den Reset | beide Links 1 h (Bestätigung zu knapp) oder beide 24 h (Reset zu lang) | ein Reset-Link zwischen 1 und 24 h meldet kurz an und sofort wieder ab. Für Nutzer sichtbar ist nur „abgelaufen“ | 2026-10-06 |
| „Prüfe dein Postfach“ liest die Adresse aus einem httpOnly-Cookie, nicht aus der URL | Keine personenbezogenen Daten in URLs (Security-Regeln) | Adresse als Query-Parameter | wer das Cookie löscht oder nach 1 h zurückkommt, wird zu `/signup` geschickt | 2026-10-06 |
| SMTP des bestehenden Postfachs `max@kopp-beratung.de` als Einzelabsender | Schlank: kein neues Konto, kein neuer Dienst. Supabase-Standard-SMTP stellt nur an Team-Mitglieder zu (vom Nutzer so gewählt) | Brevo (EU, 300 Mails/Tag, aber ein weiteres Konto und ein weiterer Auftragsverarbeiter) | ohne eigene Versand-Domain landen Mails eher im Spam; die Versandgrenzen des Postfachs gelten | 2026-10-06 |
| Dashboard-Layout fragt den Nutzer beim Auth-Server ab, der Proxy nur das Token | Der Proxy muss schnell sein. Das Layout erkennt zuverlässig gelöschte Konten (EC-6) | überall nur das Token prüfen | eine zusätzliche Anfrage pro Dashboard-Aufruf | 2026-10-06 |
| Abmelden mit Scope „local“ | AC-17 und EC-6: Abmelden wirkt nur auf dem aktuellen Gerät | Scope „global“ | — | 2026-10-06 |
| Unbestätigte Konten und alte Fehlversuche räumt ein stündlicher pg_cron-Job auf | Läuft in der Datenbank selbst, braucht keinen Server, ist im Free-Plan enthalten | Vercel Cron (kein Deployment); Aufräumen beim Login (unzuverlässig) | Job-Fehler sieht man nur in der Supabase-Oberfläche | 2026-10-06 |
| Profile per Datenbank-Trigger statt in der Server Action anlegen | Genau ein Profil pro Konto, auch wenn die Action nach der Registrierung abbricht (AC-3) | Profil in der Server Action anlegen | Logik in SQL statt TypeScript | 2026-10-06 |
| Profil-Änderung nur für die Spalte `display_name` freigegeben | Der Nutzer kann weder `id` noch Zeitstempel manipulieren, zusätzlich zu RLS | ganze Zeile änderbar | — | 2026-10-06 |
| Auth-Einstellungen im Dashboard statt per `supabase config push` | `config push` überschreibt **alle** Auth-Einstellungen des einzigen (Live-)Projekts mit der lokalen Datei, und die Geheimnisse müssten in eine weitere lokale Datei | `config push` (Einstellungen als Code) | Einstellungen sind nicht versioniert. Die Tabelle oben ist ihre Dokumentation | 2026-10-06 |
| Kein CAPTCHA, Schutz nur durch eigene Login-Sperre und Supabase-Limits (ersetzt die Turnstile-Entscheidung) | Produktentscheidung vom 2026-10-06 (AC-22 entfallen): Aufwand steht für ein reines Prüfprojekt in keinem Verhältnis. Ohne CAPTCHA entfallen ein Dienst, zwei Einstellungen, ein Schlüssel und ein Auftragsverarbeiter | Turnstile, von Supabase geprüft | Direkte Aufrufe an Supabase umgehen unsere Sperre, Massenregistrierung ist möglich. Begrenzt nur durch die festen Supabase-Limits pro IP und 30 Mails pro Stunde. RLS schützt die Daten unverändert | 2026-10-06 |
| Vier Sicherheits-Header jetzt, Content-Security-Policy später | Die Header sind trivial und Pflicht laut Security-Regeln. CSP braucht Nonces und Tests | CSP sofort | eine CSP als zusätzlicher XSS-Schutz fehlt vorerst → `docs/tech-debt.md` | 2026-10-06 |

## Abweichungen von der Spec (per `/refine PROJ-1` am 2026-10-06 in die Spec übernommen: EC-2)

1. ~~CAPTCHA auch beim Login und beim Neuversand~~: durch die spätere Entscheidung „kein CAPTCHA“ hinfällig, AC-22 ist entfallen.
2. **EC-2:** Ein schon benutzter Bestätigungslink führt zur Seite „ungültig oder abgelaufen“, mit dem Hinweis „schon bestätigt? Dann melde dich an“. Die Spec sagt bisher „/login mit Hinweis ‚bereits bestätigt‘“. Supabase kann „benutzt“ und „abgelaufen“ nicht unterscheiden.

## Open Questions

- [x] Bei welchem Anbieter liegt das Postfach `max@kopp-beratung.de`? → Google Workspace, als Auftragsverarbeiter in `docs/privacy.md` eingetragen (2026-10-06)
- [x] Automatisierte Tests in `/qa` mit echtem Turnstile? → Hinfällig, kein CAPTCHA mehr (2026-10-06)
