# QA-Testergebnisse – PROJ-1: Benutzerkonto & Login

**Getestet:** 2026-10-06
**App-URL:** http://localhost:3000 (`probe.kind: http`, `next dev` dieses Projekts)
**Tester:** QA Engineer (AI). Die Prüfung lief in drei unabhängigen `qa-engineer`-Lanes ohne Kontext aus dem Build: Akzeptanz, Security (zwei Läufe, weil der erste vor den aktiven Proben abbrach) und Regression. Zusammengeführt hat sie eine Stelle (`/qa`).
**Scope:** `full` (erster QA-Lauf)
**Datenbank:** das einzige Supabase-Projekt (Umgebung „single“). Alle Testkonten wurden über die Admin-API angelegt und nachweislich wieder gelöscht (`getUserById` → `user_not_found`). Insgesamt gingen 4 echte Mails an `max+qa-…@kopp-beratung.de`.
**Rohbelege:** `scratchpad/qa/` der QA-Sitzung (`suite-run.log`, `acceptance/r-*.txt`, `security2/*.mjs`, `regression/*.log`)

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund)

## Acceptance Criteria

### Registrierung
- [x] **AC-1** – POST der Signup-Action mit „  Max+QA-Acc-1@Kopp-Beratung.de “ → 303 auf `/signup/check-email`. Das Cookie `pending_email` ist httpOnly, gilt 1 h, SameSite=Lax; die Adresse steht nicht in der URL. Laut Admin-API ist das Konto unbestätigt und `confirmation_sent_at` gesetzt. Die Seite zeigt „Prüfe dein Postfach … an max+qa-acc-1@kopp-beratung.de“. Ob die Mail ankommt: siehe Nicht verifiziert.
- [x] **AC-2** – Formular per No-JS-POST abgeschickt, also ohne jede Browser-Prüfung:
  - leere Felder → Fehler bei E-Mail und Passwort
  - `x@` / 7 Zeichen / Name mit 51 Zeichen → drei Feldfehler, jeweils `id="<feld>-error"` unter dem Feld (`form-parts.tsx:38`)
  - Passwort mit 73 Zeichen → „höchstens 72 Zeichen“
  - 37 Umlaute (74 Bytes) → Fehler
  - Felder weggelassen → Fehler
  - Es wurde kein Konto angelegt (Admin-Suche `[]`), und das Passwort taucht im HTML nicht wieder auf.
- [x] **AC-3** – Das per App registrierte Konto hat genau ein Profil mit `display_name: "Mia QA"`; die Eingabe „  Mia QA  “ wurde getrimmt. Ein Konto ohne Namen hat `null`. Garantie: Primärschlüssel und Trigger in `supabase/migrations/20261006000001_profiles.sql:5, 55-77`. Suite: `rls.integration.test.ts > creates exactly one profile…` ✓.
- [x] **AC-4** – `GET /auth/confirm?token_hash=<generateLink signup>&type=signup` → 307 auf `/dashboard` mit Session-Cookie. `email_confirmed_at` ist gesetzt, das Dashboard liefert 200. Die 24-h-Gültigkeit selbst: siehe Nicht verifiziert.
- [x] **AC-5** (Server) – Neuversand 26 s nach der Registrierung → `code: cooldown`, `confirmation_sent_at` unverändert. Nach 94 s → Erfolg mit neutraler Meldung und neuem `confirmation_sent_at`. Direkt danach wieder `cooldown`. Den 60-s-Countdown am Button sieht man nur im Browser (`resend-button.tsx:8-45`): siehe Nicht verifiziert.
- [x] **AC-6** – Login mit unbestätigtem Konto und korrektem Passwort → 200, kein Auth-Cookie. Angezeigt werden „Bitte bestätige zuerst deine E-Mail-Adresse.“ und der Link „Bestätigungslink erneut senden“. `pending_email` wird gesetzt. Es wird kein Fehlversuch gezählt (`login_throttle_status` → `blocked: false`).
- [x] **AC-7** – Registrierung mit einer bestätigten und einer unbestätigten Adresse, jeweils mit anderem Passwort und dem Namen „Hacker“ → dieselbe Weiterleitung auf `/signup/check-email`, derselbe Body. Admin-Datensatz vorher und nachher ohne Unterschied (`diff`), das alte Passwort meldet weiter an, keine Session. **Aber:** Die Antwort-Header unterscheiden sich → BUG-3.

### Anmeldung
- [x] **AC-8** – Login mit korrekten Daten → 303 auf `/dashboard` plus `sb-…-auth-token`. Das Dashboard liefert 200 mit Kopfzeile.
- [x] **AC-9** – Für ein falsches Passwort und für eine unbekannte Adresse ist die Meldung bytegleich: „E-Mail-Adresse oder Passwort ist falsch.“ Geprüft von zwei Lanes, im Skript verglichen.
- [ ] **AC-10** – BUG-1 (High).
  - Nacheinander gesendete Versuche: Nach 5 Fehlversuchen wird auch das korrekte Passwort abgelehnt mit „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut.“ Die Sperre greift auch bei anderer Schreibweise und von einer anderen IP. Unabhängig in zwei Lanes geprüft.
  - **Parallel gesendete Versuche:** 12 von 12 Fehlversuchen landen bei der Passwortprüfung (Race).
- [ ] **AC-11** – BUG-2 (Medium). Mit fester Client-IP lehnt die App den 21. Fehlversuch ab (20 Fehlversuche verteilt auf 5 unbekannte Adressen, nachweislich die IP-Sperre). Ein anderer Wert im Header `X-Forwarded-For` hebt die Sperre sofort auf.
- [x] **AC-12** (Server) – Das Auth-Cookie ist dauerhaft (`Max-Age=34560000`, Path=/, SameSite=Lax). Der Proxy erneuert die Sitzung (`src/proxy.ts:27`). Echten Browser-Neustart und Erneuerung nach 1 h: siehe Nicht verifiziert.

### Weiterleitungen
- [x] **AC-13** – `/dashboard` ohne Session → 307 auf `/login?next=%2Fdashboard`. Das Hidden-Feld `next` überträgt das Ziel, Login → 303 auf `/dashboard`. Zweite Prüfung im Layout: `src/app/dashboard/layout.tsx:9-12`.
- [x] **AC-14** – `/` ohne Session → 307 auf `/login`, mit Session → 307 auf `/dashboard`.
- [x] **AC-15** – `/login` und `/signup` mit Session → jeweils 307 auf `/dashboard`.

### Dashboard-Rahmen & Abmelden
- [x] **AC-16** (SSR + Code) – Im Dashboard-HTML stehen der Schriftzug „WattWann“ und `aria-label="Kontomenü von <Anzeigename>"`; ohne Namen steht dort die E-Mail. Dazu ein einspaltiges `<main>`, keine Seitenleiste.
  - Die Menüeinträge „Anzeigename ändern“, „Datenschutz“, „Konto löschen“ und „Abmelden“ stehen im Client-Bundle und in `app-header.tsx:50-68`.
  - Das Öffnen des Menüs und die Optik: siehe Nicht verifiziert.
- [x] **AC-17** (Server) – Die Logout-Action antwortet mit `Set-Cookie: sb-…-auth-token=; Max-Age=0` und leitet auf `/login`. Danach führt `/dashboard` auf `/login`, auch wenn die alten Cookies erneut gesendet werden. Zurück-Button bzw. bfcache: siehe Nicht verifiziert und BUG-8.

### Anzeigename
- [x] **AC-18** (Server) – Gespeichert und in der Kopfzeile beim nächsten Request sichtbar:
  - „  Lena Neu  “ → gespeichert als „Lena Neu“
  - 50 Zeichen → gespeichert
  - 51 Zeichen → Feldfehler, der Name bleibt unverändert
  - leer → „Anzeigename entfernt.“, die Kopfzeile zeigt die E-Mail
  - `x-action-revalidated: 1` ist gesetzt. Den Toast: siehe Nicht verifiziert.

### Passwort vergessen
- [x] **AC-19** – Für eine unbekannte Adresse und ein bestehendes Konto ist der sichtbare Text identisch (diff): „Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link geschickt.“ `recovery_sent_at` wird nur beim bestehenden Konto gesetzt.
- [x] **AC-20** – Ablauf mit einem Reset-Link:
  - Reset-Link → 307 auf `/reset-password` mit Session und dem httpOnly-Cookie `password_reset` (1 h)
  - ein zu kurzes Passwort → Feldfehler
  - ein gültiges Passwort → Weiterleitung auf `/dashboard?hinweis=passwort-geaendert`, das Reset-Cookie wird gelöscht
  - Das neue Passwort meldet an, das alte liefert `invalid_credentials`.
- [x] **AC-21** – Ein schon benutzter Reset-Link führt auf `/auth/link-invalid?typ=reset` („Dieser Link ist ungültig oder abgelaufen“, „Neues Passwort anfordern“), angemeldet und abgemeldet. Die 1-h-Grenze steht in `src/app/auth/confirm/route.ts:24-28`; Suite: `route.test.ts > rejects a reset link older than one hour…` ✓. Einen echten Link, der älter als 1 h ist: siehe Nicht verifiziert.

### Schutz vor automatisierten Anfragen
- **AC-22** – entfallen (2026-10-06, kein CAPTCHA). Nichts zu prüfen.

### Datentrennung
- [x] **AC-23** – Zwei eigene Sitzungen A und B mit dem öffentlichen Anon-Key, A greift auf das Profil von B zu:
  - `select` → `[]`
  - `update` → 0 Zeilen
  - `delete` und `insert` → „permission denied“
  - B ist danach nachweislich unverändert. Suite: `rls.integration.test.ts` (2 Tests) ✓. Regeln: `20261006000001_profiles.sql:18-31`.
- [x] **AC-24** – `profiles` mit dem Anon-Key ohne Sitzung → `permission denied for table profiles` (42501). Suite ✓.

### Datenschutz
- [x] **AC-25** – Kontolöschung über die App:
  - Session-Cookie gelöscht, Weiterleitung auf `/login?konto=geloescht` mit „Dein Konto wurde gelöscht.“
  - `getUserById` → `user_not_found`
  - Das Profil verschwindet per Kaskade (`profiles.sql:5`; Suite: `deletes the profile together with the account` ✓).
  - Ohne Sitzung aufgerufen → 307 auf `/login`, nichts gelöscht.
- [ ] **AC-26** – BUG-6 (Low). `/datenschutz` liefert ohne und mit Login 200. Vorhanden sind:
  - Verantwortlicher und Kontakt max@kopp-beratung.de
  - Daten und Zwecke, Speicherdauer
  - Supabase Frankfurt und Google Workspace
  - „innerhalb eines Monats“
  - Verlinkt von `/login`, `/signup` (auch neben dem Button), `/forgot-password` und im Menü.
  - Das Recht auf **Übertragbarkeit** wird aber nicht als solches genannt, nur „Auskunft und Kopie … (Art. 15 und 20 DSGVO)“ (`src/app/datenschutz/page.tsx:91`).
- [!] **AC-27** – Der Ablauf ist NOT VERIFIED: Das Anlegedatum lässt sich nicht rückdatieren, es gibt keinen SQL-Zugriff. Bestätigt ist die Garantie im Code: stündlicher Job, `email_confirmed_at is null and created_at < now() - 7 days` (`20261006000003_cleanup_job.sql:12-14, 24`). Laut `supabase migration list --linked` ist die Migration remote eingespielt.

## Edge Cases

- [x] **EC-1** – Die Garantie ist im Code bestätigt:
  - Der Button ist beim Senden deaktiviert und zeigt einen Spinner (`form-parts.tsx:59-71`).
  - Pro Konto gibt es ein Profil über den Primärschlüssel (`profiles.sql:5`); die eindeutige E-Mail stellt Supabase selbst sicher.
  - Eine zweite Mail innerhalb von 60 s lehnt Supabase zur Laufzeit ab (siehe AC-5).
  - Einen echten Doppelklick: siehe Nicht verifiziert.
- [x] **EC-2** – Ein benutzter Bestätigungslink führt angemeldet auf `/dashboard`, abgemeldet auf `/auth/link-invalid?typ=signup` mit dem Hinweistext aus EC-2, „Anmelden“ und „Neuen Link anfordern“.
- [x] **EC-3** – Ein ungültiger Token führt auf dieselbe Seite. Die Seite sagt „ungültig oder abgelaufen“, EC-3 verlangt wörtlich „abgelaufen“. Das deckt die Verfeinerung von EC-2; die Spec widerspricht sich hier (siehe Weitere Beobachtungen). Den echten 24-h-Ablauf: siehe Nicht verifiziert.
- [ ] **EC-4** – BUG-4 (Medium). Die Meldung selbst ist vorhanden (`signup.ts:41`, `resend.ts:30`, `password.ts:24`; Suite: `signup.test > shows the mail message when sending fails (EC-4)` ✓). Bei der Registrierung verrät sie aber, ob die Adresse existiert.
- [ ] **EC-5** – BUG-5 (Medium).
  - Fällt Supabase aus: geprüft. Es erscheint ein Alert mit „Erneut versuchen“, die E-Mail bleibt erhalten (Suite: `signup.test`, `login.test`, `password.test` – EC-5-Fälle ✓).
  - Bricht die Verbindung zum WattWann-Server selbst ab: nicht abgefangen (Befund aus dem Code).
- [x] **EC-6** – Abmelden in Sitzung A1 lässt A2 angemeldet (`/dashboard` 200). Nach dem Löschen über A3 führt die nächste Seite in A2 auf `/login` ohne Kopfzeile; eine Action aus A2 leitet auf `/login`.
- [x] **EC-7** – „  Max+QA-Acc-1@Kopp-Beratung.de “ wird in `auth.users` kleingeschrieben und getrimmt gespeichert. Der Login mit Großbuchstaben und Leerzeichen funktioniert, und die Sperre zählt die normalisierte Adresse.
- [x] **EC-8** – Von zwei Reset-Links führt der ältere auf `/auth/link-invalid?typ=reset`, der neueste auf `/reset-password`.
- [x] **EC-9** – Ein unbestätigtes Konto mit Reset-Link → `/reset-password`, danach ist `email_confirmed_at` gesetzt.
- [x] **EC-10** – Ein Name aus Leerzeichen wird als `null` gespeichert. Script- und SQL-Payloads (`<script>alert(1)</script>`, `<img src=x onerror=…>`, `'); drop table profiles;--`) werden als reiner Text gespeichert und im HTML sowie im `aria-label` escaped ausgegeben; die Tabelle bleibt intakt. Die DB-Prüfregel greift auch ohne App (Suite ✓).
- [x] **EC-11** – Nach der Löschung bekommt dieselbe Adresse eine neue ID und ein leeres Profil (`display_name: null`).
- [x] **EC-12** – Werte für `next`:
  - `https://evil.example/x`, `//evil.example` und `/\evil.example` → `/dashboard`
  - `/dashboard?tab=1` bleibt erhalten
  - Suite: `safe-redirect.test.ts` (11 Fälle) ✓
- [x] **EC-13** (Code) – „Abbrechen“ ist ein `type="button"` in `AlertDialogCancel` (`account-dialogs.tsx:94-98`); `deleteAccount` hängt nur an der Form-Action. Den Klick: siehe Nicht verifiziert.

### Zusätzliche Edge Cases
- [x] `/reset-password` mit normaler Sitzung, aber ohne Reset-Cookie → 307 auf `/auth/link-invalid?typ=reset`
- [x] `/signup/check-email` ohne Cookie → 307 auf `/signup`; `/auth/confirm` ohne Parameter → `/auth/link-invalid?typ=signup`
- [x] `GET /login?email=…&password=…` meldet niemanden an (200, nur das Formular)
- [ ] „Prüfe dein Postfach“ behauptet nach AC-6 einen Versand, der nicht stattfand → BUG-7 (Low)
- [ ] Die 404-Seite ist englisch und hat zwei `<title>`-Tags → BUG-9 (Low)

## Security-Audit

- [x] **Authentifizierung:**
  - `/dashboard` ohne Cookie → 307 auf `/login?next=%2Fdashboard`
  - Die Actions `updateDisplayName` und `deleteAccount` ohne Cookie per HTTP aufgerufen → 307 auf `/login`, nichts geändert (`account.ts:19-23, 46-50`)
- [x] **Autorisierung:** Zwei echte Sitzungen gegen RLS, siehe AC-23/AC-24. Die privaten RPCs `login_throttle_status`, `record_login_failure` und `auth_email_exists` liefern als anon und als angemeldeter Nutzer `permission denied` (42501) (`20261006000002_login_throttle.sql:91-97`).
- [x] **Eingabeprüfung / Injection / XSS:** siehe AC-2 und EC-10. Zod sitzt an jeder Action-Grenze (`src/lib/auth/schemas.ts`), es gibt kein `dangerouslySetInnerHTML`.
- [!] **Rate-Limit auf gewöhnlichen Endpunkten** (Profil ändern, Konto löschen): NOT VERIFIED, nicht implementiert (optional fürs MVP).
- [ ] **Brute Force:**
  - Nacheinander: Sperre nach 5 Fehlversuchen pro Adresse bzw. 20 pro IP, nachgewiesen.
  - **BUG-1 (High):** Parallel kommen 12 von 12 Fehlversuchen bis zur Passwortprüfung.
  - **BUG-2 (Medium):** Die IP-Sperre lässt sich per `X-Forwarded-For` aushebeln.
  - Password Spraying über 5 Konten von einer festen IP wird beim 21. Versuch gestoppt.
- [ ] **Keine Konto-Ausforschung:**
  - Login (AC-9) und „Passwort vergessen“ (AC-19) sind neutral, geprüft.
  - **BUG-3:** Die Registrierung unterscheidet sich in den Set-Cookie-Headern.
  - **BUG-4:** Bei Mailfehler verrät die Registrierung, ob die Adresse existiert.
- [x] **Keine Zugangsdaten in der URL:** Alle Auth-Formulare rendern serverseitig `method="POST"` und laufen über Server Actions. Die Signup-Adresse geht per httpOnly-Cookie weiter, nicht per URL.
- [x] **Keine Secrets im Client-Bundle:** Nach `npm run build` habe ich `.next/static` (32 Dateien) per Skript durchsucht, das nur ja/nein ausgibt. Ergebnis: Der Wert von `SUPABASE_SERVICE_ROLE_KEY` kommt nicht vor.
  - Gegenprobe: Der UI-Text „Anzeigename ändern“ wird in `.next/static` gefunden, der Scan liest also die richtigen Dateien.
  - Auch der Anon-Key fehlt im Bundle, weil kein Client-Code Supabase direkt aufruft (so im Design vorgesehen).
  - Der Dev-Bundle (436 Dateien) ist ebenfalls sauber.
- [x] **Sensible Daten in Antworten:** Das angemeldete Dashboard (HTML und RSC) enthält nur die eigene E-Mail. Es gibt dort keine fremden IDs oder Adressen, keine JWTs, keinen `service_role` und keine Passwort-Hashes.
- [x] **Security-Header** auf der laufenden Antwort von `/login`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Eine CSP fehlt bewusst (`design.md`, Tech-Debt).
- [x] **Offene Weiterleitung:** siehe EC-12.
- [x] **`[user]`-Aufgaben:** Alle sind in `tasks.md` abgehakt (T5, T12, T18–T26, T32), auf dem Login-Weg ist keine offen.
  - Beobachtbar bestätigt sind „Confirm email“ an (AC-6), Mindestlänge und Link-Format (AC-2, AC-4) sowie der Mailversand über eigenes SMTP (`confirmation_sent_at` gesetzt).
  - Nur im Dashboard sichtbar und deshalb NOT VERIFIED: siehe unten.
- **Akzeptiertes Risiko (kein Bug):** Es gibt kein CAPTCHA. Massenregistrierung und direkte Supabase-Aufrufe am App-Throttle vorbei sind möglich (`spec.md` Entscheidungsprotokoll, 2026-10-06).

## Automatisierte Tests

- [x] **Unit- und Integrationstests:** `npm test` lief einmal vor der Aufteilung auf die Lanes: 11 Dateien, 90 Tests bestanden, 0 fehlgeschlagen (`suite-run.log`). Der RLS-Integrationstest lief gegen das echte Projekt und wurde nicht übersprungen (10 Tests ✓). Es gibt kein `.only`, `.skip` oder `.todo`.
- [x] **Lint / Typen / Build:** `npm run lint` (Exit 0), `npx tsc --noEmit` (Exit 0) und `npm run build` (Exit 0, 14/14 Seiten, keine Warnung) laufen fehlerfrei.
- [x] **Migrationen:** `supabase migration list --linked` zeigt alle 3 lokal und remote.
- [x] **Neue Unit-Tests aus `/qa`:** 3 Dateien, 11 Tests, alle grün. Die Rotprobe ist je Datei gemacht: Alle Erwartungen in einer Kopie umgedreht, dabei schlugen 11 von 11 fehl. Danach wiederhergestellt und erneut 11 von 11 grün.
  - `src/lib/auth/action-state.test.ts`: Sperrmeldung Singular/Plural, `textValue`, Erkennung von Verbindungs- und Mailfehlern (EC-4, EC-5)
  - `src/lib/auth/reset-cookie.test.ts`: httpOnly, 1 h, nur für die ausstellende Nutzer-ID gültig (AC-20)
  - `src/lib/auth/pending-email.test.ts`: httpOnly, 1 h, `null` ohne Cookie (AC-1, AC-6)

## Regression

- [x] Kein Feature hat den Status Deployed (`features/INDEX.md`). Es gibt keine Nachbarn, die brechen könnten.
- [x] **App-Rahmen und öffentliche Seiten:**
  - `/`, `/login`, `/signup`, `/forgot-password`, `/datenschutz` und `/auth/link-invalid` liefern die erwarteten Statuscodes und deutschen Texte.
  - Die `AuthCard` mit dem Datenschutz-Link rendert auf allen Auth-Seiten.
  - Angemeldet zeigt `/dashboard` die Kopfzeile, „Übersicht“, den Platzhaltertext und keine zweite Navigation.

## E2E-Tests
- Status: **nicht ausgeführt** (es gibt noch keine E2E-Suite; `/e2e-tests` für kritische Abläufe)

## Nicht verifiziert in diesem Lauf

- [!] **Browser-Darstellung:** Chrome, Firefox und Safari sowie Handybreite ab 360 px. `/qa` läuft ohne Browser; das deckt nur `/e2e-tests` ab.
- [!] **Browser-Konsole und Netzwerk-Tab:** brauchen DevTools.
- [!] **Mail-Zustellung** (AC-1, AC-5, AC-19): kein Zugriff aufs Postfach.
  - Prüfung von Hand: Kamen die Mails an `max+qa-acc-1@kopp-beratung.de` (Registrierung 09:29:40Z, Neuversand 09:31:15Z, Reset 09:31:32Z UTC) und an `max+qa-sec-2@…` an?
  - Die Links darin sind inzwischen ungültig, weil die Konten gelöscht sind.
- [!] **Nur im Browser sichtbar:**
  - AC-5: 60-s-Countdown am Button
  - AC-16: Menü öffnen, Optik
  - AC-18/AC-20: Toasts
  - EC-1: echter Doppelklick
  - EC-13: Klick auf „Abbrechen“
- [!] **AC-12:** echter Neustart des Browsers und Erneuerung des Tokens nach 1 h.
- [!] **AC-17:** Zurück-Button bzw. bfcache nach dem Abmelden (Risiko siehe BUG-8).
- [!] **Echte Link-Abläufe:** AC-21 (Reset-Link älter als 1 h) und EC-3/AC-4 (24 h). Beides ist nicht nachstellbar; die 1-h-Grenze deckt ein Unit-Test ab.
- [!] **AC-27:** ob der Aufräum-Job tatsächlich läuft. Kein SQL-Zugriff, das Anlegedatum lässt sich nicht rückdatieren. Prüfung von Hand: Supabase → Integrations → Cron → Job-Historie.
- [!] **EC-4:** ein echter Mailausfall bzw. ein erschöpftes Kontingent. Nicht provoziert, weil das das gemeinsame Kontingent verbraucht hätte.
- [!] **EC-5:** Netzabbruch zum Next-Server. Kein Browser; BUG-5 stammt aus dem Code.
- [!] **Dashboard-Einstellungen**, nur im Supabase-Dashboard sichtbar:
  - Authentication → Rate Limits → „emails sent per hour“ = 30
  - Sign In / Providers → Email → „Email OTP Expiration“ = 86400
  - Attack Protection → CAPTCHA aus
- [!] **Laufzeitunterschiede:** zwischen den Zweigen der Registrierung nicht gemessen, laut Design bewusst hingenommen.
- [!] **Rate-Limit auf gewöhnlichen Endpunkten:** nicht implementiert (optional fürs MVP).
- [!] **Burst-Größe bis zum Supabase-Limit pro IP** (BUG-1): nicht ausgereizt, um das Projekt nicht zu belasten.

## Bugs

### BUG-1: Login-Sperre lässt sich mit parallelen Anfragen überschreiten
- **Severity:** High
- **Status:** Open
- **AC:** AC-10
- **Class:** Rate-Limit nach dem Muster „erst prüfen, dann zählen“ ist nicht atomar (TOCTOU). Sperrprüfung (`src/lib/auth/actions/login.ts:33`) und Eintrag des Fehlversuchs (`login.ts:53`) sind getrennte Schritte ohne Sperre oder Transaktion.
- **Sweep:** `grep -rnE "getLoginThrottle\(|recordLoginFailure\(" src --include='*.ts' | grep -v '\.test\.' | grep -v "export async function"` → 2 Treffer, beide in `login.ts` (ein Ablauf)
- **Schritte:**
  1. Ein bestätigtes Konto anlegen.
  2. 12 Login-Aufrufe mit falschem Passwort gleichzeitig abschicken (`Promise.all`, feste Client-IP).
  3. Erwartet: Ab dem 6. Aufruf „Zu viele Fehlversuche…“, höchstens 5 Passwortprüfungen.
  4. Tatsächlich: Alle 12 werden geprüft (`code=invalid`). Erst danach steht die Sperre (`blocked: true, retry_after_seconds: 900`).
- **Folge:** Pro 15-Minuten-Fenster kommt ein ganzer paralleler Burst durch statt 5 Versuchen. Die Burst-Größe begrenzt nur noch das Supabase-Limit pro IP.

### BUG-2: IP-Sperre lässt sich über den Header `X-Forwarded-For` umgehen
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-11
- **Class:** Ein vom Client steuerbarer Header (`X-Forwarded-For` / `X-Real-IP`) wird ohne vertrauenswürdigen Proxy als Client-IP genommen (`src/lib/auth/request-meta.ts:11-16`).
- **Sweep:** `grep -rlniE "x-forwarded-for|x-real-ip" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Datei (`request-meta.ts`)
- **Schritte:**
  1. 20 Fehlversuche mit fester `X-Forwarded-For: 10.0.2.2`. Der 21. wird abgelehnt.
  2. Ein weiterer Versuch mit `X-Forwarded-For: 10.0.2.3`.
  3. Erwartet: weiterhin gesperrt, weil es derselbe Rechner ist.
  4. Tatsächlich: Die Passwortprüfung läuft wieder.
- **Einordnung:** Die Sperre pro E-Mail-Adresse (AC-10) bleibt davon unberührt. Lokal steht kein Proxy vor der App.

### BUG-3: Registrierung verrät über Set-Cookie-Header, ob eine Adresse schon ein Konto hat
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-7 bzw. Produktentscheidung „Registrierung mit bereits vorhandener Adresse … antworten immer gleich“
- **Class:** Eine nach außen „gleiche“ Antwort unterscheidet sich je nach Existenz-Zweig über Nebenkanäle (Cookies, Header, Fehlerzustände). BUG-4 gehört zur selben Klasse.
- **Sweep:** `grep -rnE "auth_email_exists|if \(!exists\)" src/lib/auth/actions --include='*.ts' | grep -v '\.test\.'` → 2 Treffer, beide in `signup.ts` (`:21`, `:26`), ein Zweig
- **Schritte:**
  1. Die Signup-Action einmal mit einer vorhandenen und einmal mit einer neuen Adresse aufrufen.
  2. Die `Set-Cookie`-Header vergleichen.
  3. Erwartet: identisch.
  4. Tatsächlich: Bei vorhandener Adresse kommt nur `pending_email`. Bei neuer Adresse kommen dazu drei `sb-…-code-verifier`-Cookies (PKCE aus `supabase.auth.signUp`).
- Unabhängig in zwei Lanes nachgewiesen (3 gegen 0 bzw. 4 gegen 1 Cookies).

### BUG-4: Mailfehler bei der Registrierung verrät, ob eine Adresse existiert
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **EC:** EC-4 („Die Meldung verrät nicht, ob die Adresse registriert ist“)
- **Class:** wie BUG-3. Fehlerzustände werden nur im Zweig „neue Adresse“ erreicht und sind nicht neutralisiert.
- **Sweep:** `grep -rn "MESSAGES.mail" src/lib/auth/actions/*.ts | grep -v test` → 3 Treffer (`signup.ts`, `resend.ts`, `password.ts`). Davon ist nur `signup.ts` nach Existenz verzweigt. Bei `password.ts` hängt die Mailmeldung nicht von der Existenz ab (Design: bei Kontingent-Ende bleibt der Reset neutral).
- **Schritte:**
  1. Das Mailkontingent ist erschöpft, oder SMTP fällt aus.
  2. Zwei Registrierungen: eine mit registrierter, eine mit unbekannter Adresse.
  3. Erwartet: gleiche Antwort.
  4. Tatsächlich (laut Code, `signup.ts:21-26, 41`): „Prüfe dein Postfach“ gegenüber „Wir konnten gerade keine E-Mail senden…“.
- Ohne CAPTCHA kann ein Skript das Kontingent von 30 Mails pro Stunde gezielt leeren.

### BUG-5: Verbindungsabbruch zum WattWann-Server wird in den Formularen nicht abgefangen
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **EC:** EC-5
- **Class:** Fehler beim Aufruf einer Server Action im Client fängt nichts ab. Es gibt weder `error.tsx` noch `global-error.tsx` noch eine eigene Behandlung um die Actions.
- **Sweep:** `find src/app -name error.tsx -o -name global-error.tsx | wc -l` → 0; betroffene Formulare: `grep -rln useActionState src | wc -l` → 7 Dateien
- **Schritte:**
  1. `/login` öffnen.
  2. Den Dev-Server stoppen oder offline gehen.
  3. „Anmelden“ klicken.
  4. Erwartet: ein Hinweis mit „Erneut versuchen“, die E-Mail bleibt im Feld.
  5. Tatsächlich (laut Code und Next-Quelltext `server-action-reducer.js:85-99`): Der Fehler geht an die Standard-Fehlerseite von Next, die Eingabe ist weg.
- Die Browser-Bestätigung steht noch aus.

### BUG-6: Datenschutzhinweise nennen das Recht auf Übertragbarkeit nicht
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-26
- **Class:** Pflichtangabe der Spec nur sinngemäß statt ausdrücklich umgesetzt
- **Sweep:** `grep -c "bertragbarkeit" src/app/datenschutz/page.tsx` → 0
- **Schritte:**
  1. `/datenschutz` öffnen.
  2. Erwartet: „Übertragbarkeit“ wird als Recht genannt.
  3. Tatsächlich: nur „Auskunft und Kopie deiner Daten (Art. 15 und 20 DSGVO)“ (`page.tsx:91`).

### BUG-7: „Prüfe dein Postfach“ behauptet nach dem Login eines unbestätigten Kontos einen Versand
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **Class:** Ein Text unterstellt eine Aktion, die nicht stattfand.
- **Sweep:** `grep -rn "setPendingEmail(" src/lib/auth/actions | grep -v test` → 2 Treffer (signup: gewollt, wegen AC-7; login: falsch)
- **Schritte:**
  1. Mit einem unbestätigten Konto und korrektem Passwort anmelden.
  2. Dem Link „Bestätigungslink erneut senden“ folgen.
  3. Erwartet: Die Seite bietet den Neuversand an.
  4. Tatsächlich: „Wir haben einen Bestätigungslink … geschickt“ (`src/app/(auth)/signup/check-email/page.tsx:31-32`), obwohl nichts verschickt wurde.

### BUG-8: Dashboard im Dev-Betrieb ohne `Cache-Control: no-store`
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-17 (Zurück-Button)
- **Class:** Die Cache-Garantie aus `design.md` hängt am Framework-Default, und der unterscheidet sich zwischen dev und prod.
- **Sweep:** `grep -rn "no-store" next.config.ts src/ | grep -v test | wc -l` → 0
- **Schritte:**
  1. Mit Session `curl -D - localhost:3000/dashboard` aufrufen.
  2. Erwartet: `no-store`, wie in `design.md` versprochen („ohne Cache“).
  3. Tatsächlich: `Cache-Control: no-cache, must-revalidate`.
- Die App läuft laut PRD nur per `npm run dev`. Ob der Zurück-Button tatsächlich alte Daten zeigt, ist nur im Browser prüfbar.

### BUG-9: 404-Seite englisch und mit doppeltem Seitentitel
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **Class:** Fehlende eigene Fehlerseiten des App-Rahmens. Gehört zur selben Ursache wie BUG-5: Es gibt weder `not-found.tsx` noch `error.tsx`.
- **Sweep:** `find src/app -name not-found.tsx | wc -l` → 0
- **Schritte:**
  1. `GET /gibtsnicht` aufrufen.
  2. Erwartet: eine deutsche 404-Seite mit einem Titel.
  3. Tatsächlich: „404: This page could not be found.“ und zwei `<title>`-Tags.

## Weitere Beobachtungen (kein Bug dieses Laufs)

- **EC-3 und EC-2 widersprechen sich im Wortlaut.** EC-3 verlangt „Dieser Link ist abgelaufen“, EC-2 verweist auf dieselbe Seite mit „ungültig oder abgelaufen“. Der Code folgt EC-2. Glätten mit `/refine PROJ-1`.
- **„Dein Konto wurde gelöscht“** erscheint für jeden, der `/login?konto=geloescht` öffnet. Das ist kosmetisch und verrät nichts.
- **Art. 18 DSGVO** (Recht auf Einschränkung der Verarbeitung) fehlt auf `/datenschutz`. Die Spec verlangt es nicht, Art. 13 DSGVO schon. Thema für `/dsgvo`.
- **„Link erneut senden“** antwortet bei Supabase-Cooldown mit „Bitte warte noch kurz“. `design.md` erlaubt diese Ausnahme ausdrücklich.
- **`features/INDEX.md` → Deployments** enthält noch die Beispielzeile der Vorlage (`v1.0.0 · … · app.example.com`). Das passt nicht zum Projekt ohne Deployment, und `/audit` sowie `/security-check` lesen diese Zeile.

## Zusammenfassung
- **Acceptance Criteria:** 26 aktive ACs (AC-22 entfallen). Bestanden 22, fehlgeschlagen 3 (AC-10, AC-11, AC-26), nicht verifiziert 1 (AC-27). Browser-Teilaspekte mehrerer ACs stehen oben unter „Nicht verifiziert“.
- **Edge Cases:** 13. Bestanden 11, fehlgeschlagen 2 (EC-4, EC-5).
- **Bugs:** 9 insgesamt, davon 0 Critical, 1 High, 4 Medium und 4 Low. Open: 1 (BUG-1), Deferred: 8 (BUG-2 bis BUG-9, Entscheidung des Nutzers vom 2026-10-06).
- **Security:**
  - 9 von 13 Prüfungen bestanden: Authentifizierung, Autorisierung, Injection/XSS, Zugangsdaten nicht in der URL, keine Secrets im Bundle, keine sensiblen Daten in Antworten, Header, offene Weiterleitung, `[user]`-Aufgaben.
  - 2 mit Bug: Brute Force und Ausforschung.
  - 2 NOT VERIFIED: Rate-Limit auf gewöhnlichen Endpunkten, Dashboard-Einstellungen.
- **Production Ready:** **NEIN**
- **Empfehlung:** BUG-1 mit `/build PROJ-1` beheben, danach `/qa` als Nachprüfung im Umfang des Fixes. BUG-2 bis BUG-9 sind zurückgestellt und blockieren die Freigabe nicht. Später gesammelt mit `/build PROJ-1 deferred`.

> „Production Ready: JA“ hieße nur: keine Critical- oder High-Bugs. Es hieße nicht, dass alles geprüft wurde. Die Punkte unter „Nicht verifiziert“ bleiben offen, bis ein Mensch oder `/e2e-tests` sie prüft.
