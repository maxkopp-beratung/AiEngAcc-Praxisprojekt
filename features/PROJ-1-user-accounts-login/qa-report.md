# QA-Testergebnisse – PROJ-1: Benutzerkonto & Login

**Getestet:** 2026-10-06 (zweiter Lauf, Nachprüfung)
**App-URL:** http://localhost:3000 (`probe.kind: http`, laufender `next dev` dieses Projekts)
**Tester:** QA Engineer (AI). Drei unabhängige `qa-engineer`-Lanes ohne Kontext aus dem Build (Akzeptanz, Security, Regression). Zusammengeführt hat sie eine Stelle (`/qa`).
**Datenbank:** das einzige Supabase-Projekt (Umgebung „single“).
- 12 Testkonten wurden über die Admin-API bzw. die App angelegt und nachweislich wieder gelöscht (`getUserById` → `user_not_found`).
- Es ging 1 echte Mail raus: Registrierung von `max+qa2-reg-1@kopp-beratung.de`, ca. 09:58Z UTC.
**Rohbelege:** `scratchpad/qa2/` der QA-Sitzung (`suite-run.log`, `static-checks.log`, `build.log`, `acceptance/`, `security/`, `regression/`)

## Umfang: Nachprüfung

- **Anlass:** BUG-1 (High) war offen. Seit dem Bericht in Commit `3cca6b2` kam der Fix `a2126ca`.
- **Diff:** `git diff --stat 3cca6b2..HEAD` → 7 Dateien. Produktiv geändert sind:
  - `src/lib/auth/actions/login.ts` (Login-Action)
  - `src/lib/auth/throttle.ts` (Login-Sperre)
  - `supabase/migrations/20261006000004_login_throttle_atomic.sql` (neue Migration)
- **Breite:** Der Diff berührt geteilten Auth-Code und eine Migration. Deshalb lief die volle Aufteilung auf drei Lanes. Die Regressions-Lane hat die Kernabläufe außerhalb des Login-Formulars neu durchlaufen.
- **Übernommen:** Was in diesem Lauf nicht erneut lief, ist mit „— unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft“ markiert. Das ist kein neues Häkchen.

> Legende: `[x]` in diesem Lauf geprüft (mit Beleg) · `[ ] BUG` als fehlerhaft belegt · `[!] NOT VERIFIED` in diesem Lauf nicht prüfbar (mit Grund) · `[~]` aus dem ersten Lauf übernommen

## Acceptance Criteria

### Registrierung
- [x] **AC-1** – Regression: No-JS-POST an `/signup` mit „  Max+QA2-Reg-1@Kopp-Beratung.de “ → 303 auf `/signup/check-email`.
  - Das Cookie `pending_email` ist gesetzt. Die Seite zeigt „Prüfe dein Postfach“ und die normalisierte Adresse.
  - Laut Admin-API ist das Konto unbestätigt, `confirmation_sent_at` ist gesetzt (`regression/flow1.log`).
  - Ob die Mail ankommt: siehe Nicht verifiziert.
- [~] **AC-2** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft. Der Diff berührt `schemas.ts` und `signup.ts` nicht.
- [x] **AC-3** – Regression: Die eigene Sitzung liefert genau ein Profil `display_name: "Reg Eins"`, der Name ist getrimmt. Der Trigger aus `…0001` ist intakt (`regression/flow1.log`).
- [x] **AC-4** – Regression: `generateLink(signup)` → `GET /auth/confirm?…&type=signup` → 307 auf `/dashboard` mit Auth-Cookie, `email_confirmed_at` gesetzt.
- [~] **AC-5** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft. `resend.ts` ist nicht im Diff.
- [x] **AC-6** – Akzeptanz: Unbestätigtes Konto mit 4 vorbefüllten Fehlversuchen, Login mit korrektem Passwort.
  - Antwort: `200 unconfirmed` mit „Bitte bestätige zuerst deine E-Mail-Adresse.“, kein Auth-Cookie, im HTML der Link „…erneut senden“.
  - `pending_email` ist gesetzt (httpOnly, 1 h).
  - Danach `login_throttle_status` → `blocked: false`. Der Versuch wurde also freigegeben und nicht gezählt (`login.ts:64-69`).
- [~] **AC-7** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft (`signup.ts` nicht im Diff). Der Nebenkanal aus BUG-3 ist weiter sichtbar (`regression/flow1.log`: drei `sb-…-code-verifier`-Cookies).

### Anmeldung
- [x] **AC-8** – Akzeptanz: Konto mit 4 vorbefüllten Fehlversuchen, korrekter Login → 303 auf `/dashboard` plus Auth-Cookie, das Dashboard liefert 200.
  - Nach drei Erfolgen in Folge steht der Status bei `blocked: false`, die Freigabe wirkt.
  - Unter Gleichzeitigkeit siehe BUG-10.
- [x] **AC-9** – Für ein falsches Passwort und eine unbekannte Adresse ist die Meldung bytegleich: „E-Mail-Adresse oder Passwort ist falsch.“
  - Akzeptanz: Meldung verglichen.
  - Security: Status, Code und Cookies sind gleich; das HTML ist nach Normalisierung byte-identisch (`security/probe9c.mjs`).
  - Die unbekannte Adresse wird ebenso gezählt und gesperrt.
- [x] **AC-10** – **BUG-1 behoben.** Von zwei Lanes unabhängig über die laufende App nachgewiesen:
  - **12 gleichzeitige Fehlversuche:** `{ invalid: 5, locked: 7 }` (`acceptance/bug1.mjs`, `security/probe3.mjs`).
  - **Direkt nach Ablauf eines Fensters:** wieder 5 von 12 (`security/probe6.mjs`).
  - **Gemischt** (1 Fehlversuch vorab, dann 6 falsche und 2 richtige parallel): insgesamt genau 5 Fehlversuche (`probe5.mjs`).
  - **Danach** wird das korrekte Passwort von derselben und von einer anderen IP abgelehnt, mit „…in 15 Minuten erneut.“ Auch Schreibvarianten (Großschreibung, Leerzeichen, NBSP, BOM, Kelvin-Zeichen) umgehen die Sperre nicht (`probe4.mjs`).
  - **Ein gesperrter Versuch verlängert die Sperre nicht** (`retry_after_seconds` vorher und nachher 900).
  - **Ein falsches Passwort an einem unbestätigten Konto zählt.** Ebenso ein überlanges Passwort (144 Byte).
  - **Nacheinander:** 4 vorbefüllt plus 1 Fehlversuch per HTTP → gesperrt.
- [ ] **AC-11** – BUG-2 (Deferred), unverändert.
  - Mit fester IP wird der 21. Versuch mit derselben Meldung wie bei AC-10 abgelehnt.
  - Ein anderer Wert in `X-Forwarded-For` hebt die Sperre auf (`acceptance/`).
  - Auf DB-Ebene atomar: von 40 parallelen Versuchen auf eine IP kommen genau 20 durch (`security/probe1.mjs`).
- [x] **AC-12** (Server) – Das Auth-Cookie ist dauerhaft: `Path=/; Max-Age=34560000; SameSite=lax`. Echten Browser-Neustart: siehe Nicht verifiziert.

### Weiterleitungen
- [x] **AC-13** – Von Akzeptanz und Regression geprüft:
  - `/dashboard` ohne Session → 307 auf `/login?next=%2Fdashboard`.
  - Das Hidden-Feld `next="/dashboard"` wird gerendert. Der Login darüber → 303 auf `/dashboard`.
- [x] **AC-14** – Regression: `/` ohne Session → 307 auf `/login`, mit Session → 307 auf `/dashboard`.
- [x] **AC-15** – Regression: `/login` und `/signup` mit Session → jeweils 307 auf `/dashboard`.

### Dashboard-Rahmen & Abmelden
- [x] **AC-16** (SSR) – Regression: `/dashboard` liefert 200.
  - Im HTML stehen „WattWann“, `aria-label="Kontomenü von Reg Eins"`, `<main>` und „Übersicht“.
  - Es gibt 0 `<nav>`/`<aside>`.
  - Menü öffnen und Optik: siehe Nicht verifiziert.
- [x] **AC-17** (Server) – Regression: Logout-Action → `x-action-redirect: /login`, das Auth-Cookie ist gelöscht. Danach führt `/dashboard` auf `/login`, auch mit den alten Cookies (`regression/flow2.log`). Zurück-Button: siehe Nicht verifiziert und BUG-8.

### Anzeigename
- [x] **AC-18** (Server) – Regression (`regression/flow1b.log`):
  - „  Lena Neu  “ → Kopfzeile „Lena Neu“
  - 50 Zeichen → übernommen
  - 51 Zeichen → abgelehnt, der Name bleibt unverändert
  - leer → die Kopfzeile zeigt die E-Mail
  - Toast: siehe Nicht verifiziert.

### Passwort vergessen
- [x] **AC-19** – Regression, Zweig „unbekannte Adresse“: 200 mit „Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link geschickt.“
  - Der Zweig „bestehendes Konto“ ist aus dem ersten Lauf übernommen; er wurde nicht ausgelöst, um keine Mail zu verbrauchen.
  - `password.ts` ist nicht im Diff.
- [x] **AC-20** – Regression (`regression/flow3.log`):
  - Reset-Link → `/reset-password` mit Cookie `password_reset`.
  - Ein zu kurzes Passwort → Feldfehler.
  - Ein gültiges Passwort → 303 auf `/dashboard?hinweis=passwort-geaendert`, das Cookie ist gelöscht.
  - Das neue Passwort meldet an, das alte liefert die neutrale Fehlermeldung.
  - Die Schutzvorkehrung um diesen Ablauf ist aber umgehbar → BUG-11.
- [x] **AC-21** – Regression: Ein schon benutzter Reset-Link → 307 auf `/auth/link-invalid?typ=reset` mit „ungültig oder abgelaufen“. Einen echten Link, der älter als 1 h ist: siehe Nicht verifiziert.

### Schutz vor automatisierten Anfragen
- **AC-22** – entfallen (2026-10-06, kein CAPTCHA). Nichts zu prüfen.

### Datentrennung
- [x] **AC-23** – Regression (`regression/flow4.log`) und Security (`security/probe7.mjs`), zwei echte App-Sitzungen.
  - A greift auf B zu:
    - `select` → `[]`
    - `update` → 0 Zeilen
    - `delete`, `insert`, `upsert` und das Umschreiben der eigenen ID → 42501
  - B ist danach unverändert, und umgekehrt sieht B das Profil von A nicht.
  - Suite: `rls.integration.test.ts` ✓.
- [x] **AC-24** – Anon-Key ohne Session → `profiles` liefert 42501 (Regression und Suite).

### Datenschutz
- [x] **AC-25** – Regression (`regression/flow4.log`):
  - `deleteAccount` → 303 auf `/login?konto=geloescht`, das Cookie ist gelöscht, die Seite zeigt „Dein Konto wurde gelöscht“.
  - `getUserById` → `user_not_found`.
  - Die Profil-Kaskade belegen `profiles.sql:5` und der Suite-Test `deletes the profile together with the account` ✓ (auch einzeln gelaufen, `rls-single.log`). Zur Laufzeit ist sie nicht direkt sichtbar, weil die Service-Rolle bewusst keinen Grant auf `profiles` hat.
- [ ] **AC-26** – BUG-6 (Deferred), unverändert.
  - `/datenschutz` liefert ohne und mit Session 200, alle übrigen Pflichtangaben sind vorhanden.
  - „Übertragbarkeit“ fehlt weiter (`regression/flow5.log`).
- [!] **AC-27** – NOT VERIFIED: kein SQL-Zugriff, das Anlegedatum lässt sich nicht rückdatieren. Bestätigt ist:
  - `…0004` fasst weder Tabelle noch Cron-Job noch Trigger an (`grep` → 0 Treffer).
  - Der Job aus `20261006000003_cleanup_job.sql:12-14, 24` ist unverändert.

## Edge Cases

- [~] **EC-1** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft.
- [~] **EC-2** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft.
- [~] **EC-3** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft.
- [ ] **EC-4** – BUG-4 (Deferred), unverändert. `signup.ts` ist nicht im Diff, der Sweep liefert unverändert 3 Treffer.
- [ ] **EC-5** – BUG-5 (Deferred).
  - **Supabase-Ausfall:** abgefangen, belegt durch Unit-Tests. `login.test.ts > reports connection problems…` ✓ prüft jetzt auch die Freigabe der Reservierung; `> fails closed when the throttle cannot be checked` ✓.
  - **Verbindungsabbruch zum Next-Server:** weiter nicht abgefangen, der Code dort ist unverändert.
- [x] **EC-6** – Regression:
  - Abmelden in Sitzung J2 lässt J1 angemeldet.
  - Nach dem Löschen über K1 führt die nächste Anfrage in K2 auf `/login`, ohne Kopfzeile.
- [x] **EC-7** – Akzeptanz: „  Max+QA2-Acc-2@Kopp-Beratung.de  “ meldet an. Ein Fehlversuch in Großschreibung zählt für die normalisierte Adresse (`schemas.ts:12-20`).
- [x] **EC-8** – Regression: Von zwei Reset-Links führt der ältere auf `/auth/link-invalid?typ=reset`, der neueste auf `/reset-password`.
- [~] **EC-9** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft.
- [x] **EC-10** – Security: `<img src=x onerror=alert(1)>`, `"><script>alert(1)</script>` und `x'); drop table profiles;--` werden wörtlich gespeichert und in HTML und `aria-label` escaped ausgegeben. 51 Zeichen werden auch an der Oberfläche vorbei abgelehnt (`security/probe7b.mjs`, `probe8d.mjs`).
- [x] **EC-11** – Regression: Dieselbe Adresse neu angelegt → neue ID, Profil `display_name: null`, die Kopfzeile zeigt die E-Mail.
- [x] **EC-12** – Akzeptanz und Security: `next=https://evil.example/x` und `next=//evil.example/x` beim Login → 303 auf `/dashboard`.
- [~] **EC-13** – unverändert seit 2026-10-06 (erster Lauf), in diesem Lauf nicht erneut geprüft.

### Zusätzliche Edge Cases (dieser Lauf)
- [ ] **Gleichzeitige korrekte Logins:** 6 parallel → 5 × `/dashboard`, 1 × „Zu viele Fehlversuche … 15 Minuten“, obwohl es keinen Fehlversuch gab → BUG-10.
- [x] **Supabase-Limit (429) beim Login:** gibt die Reservierung frei und meldet „Zu viele Anfragen…“ statt der Fehlversuchsmeldung. Belegt durch die neuen Unit-Tests in `login-release.test.ts`. Zur Laufzeit nicht provoziert: siehe Nicht verifiziert.
- [x] **Freigabe scheitert:** Login und Hinweis „unbestätigt“ funktionieren trotzdem, der Eintrag bleibt dann 15 Minuten als Fehlversuch stehen (`login.ts:43-49`; `login-release.test.ts`).
- [x] **Alte Namen entfernt:** `record_login_failure` ist remote gelöscht (`PGRST202`). Im Code zeigt nichts mehr auf `record_login_failure`, `recordLoginFailure` oder `getLoginThrottle` (Regression, `grep` → 0).

## Security-Audit

- [x] **Neue DB-Funktionen** (`…0004`), geprüft in `security/probe1.mjs` und `probe2.mjs`:
  - `begin_login_attempt` und `release_login_attempt` liefern als anon und als angemeldeter Nutzer 42501, auch per GET an `/rest/v1/rpc/…` (401).
  - `security definer` mit `set search_path = ''`, alle Objekte sind schema-qualifiziert (`…0004:13-14, 43-44`).
  - Rechte nur für die Service-Rolle (`:51-55`). Eine fremde Sperre lässt sich also nicht aufheben.
  - `'1 or 1=1'` an `release_login_attempt` → 22P02.
- [x] **Timing-Garantie aus `design.md`** (Umsetzungsnotizen Fix BUG-1), im Code bestätigt:
  - `pg_advisory_xact_lock` in `…0004:20`, Prüfen und Eintragen im selben gesperrten Schritt (`:22-35`).
  - Reservierung vor der Passwortprüfung, fail closed (`login.ts:33-40`).
  - Die Reservierung bleibt nur bei `invalid_credentials` stehen (`login.ts:61-64`).
  - Laufzeit: siehe AC-10. Auf DB-Ebene kommen von 30 parallelen Versuchen auf eine Adresse genau 5 durch.
- [x] **Authentifizierung** (`security/probe7b.mjs`, `probe8*.mjs`):
  - `/dashboard` ohne Sitzung, auch mit `RSC: 1`, `_rsc`, gefälschtem Auth-Cookie und `x-middleware-subrequest` → 307 auf `/login`. Pfadvarianten → 404 ohne Inhalt.
  - `updateDisplayName` und `deleteAccount` ohne Cookie, auch über öffentliche Routen → nichts geändert. Der Schutz sitzt in der Action selbst (`account.ts:19-28, 44-50`).
- [x] **Autorisierung:** zwei echte Sitzungen gegen RLS, siehe AC-23 und AC-24. `/auth/v1/admin/users` mit Nutzer-Token → 403.
- [x] **Eingabeprüfung / Injection / XSS:** siehe EC-10. Zod sitzt an der Grenze (`schemas.ts`). `grep dangerouslySetInnerHTML|innerHTML` (ohne `components/ui`) → 0.
- [x] **CSRF:** POST mit gültigem Cookie und `Origin: https://evil.example` → 500, nichts geändert (`probe7b.mjs`).
- [ ] **Brute Force:**
  - Die Sperre pro Adresse (5) und pro IP (20) ist atomar nachgewiesen, BUG-1 ist geschlossen. Die höchste erreichte Versuchszahl pro Fenster ist 5.
  - Weiter offen ist BUG-2 (Deferred): Die IP-Sperre lässt sich per `X-Forwarded-For` umgehen, und damit lässt sich auch eine fremde IP gezielt sperren.
  - Akzeptiertes Risiko laut Spec (`spec.md:128`): kein CAPTCHA, und direkte Supabase-Aufrufe umgehen die eigene Sperre.
  - Das gezielte Aussperren eines fremden Kontos für 15 Minuten ist von AC-10 gewollt („auch mit korrektem Passwort“).
- [ ] **Keine Konto-Ausforschung:**
  - Login: neutral, geprüft (AC-9).
  - BUG-3 und BUG-4 (Deferred) sind unverändert, die Sweeps liefern 2 bzw. 3 Treffer wie zuvor. Zur Laufzeit nicht wiederholt, weil das Mails auslöst.
- [ ] **Sitzungs- und Reset-Cookies:**
  - BUG-11 (Deferred): Das Reset-Cookie ist unsigniert.
  - BUG-12 (Deferred): Das Session-Cookie ist nicht HttpOnly.
- [x] **Keine Zugangsdaten in der URL:**
  - `/login`, `/signup`, `/forgot-password` und `/auth/link-invalid` rendern `method="POST"`.
  - Alle 8 `<form>` binden eine Server Action (`grep … | grep -vc "action="` → 0).
  - `GET /login?email=…&password=…` → 200 ohne Set-Cookie.
- [x] **Keine Secrets im Client-Bundle:** Der Scan über `.next/static` (Produktions-Build dieses Laufs, 23 Dateien) gibt nur ja/nein aus.
  - Nicht gefunden: der Wert von `SUPABASE_SERVICE_ROLE_KEY` (auch kein 24-Zeichen-Teilstück), der Name, `createAdminClient`, `begin_login_attempt`, der Anon-Key.
  - Gegenprobe: „Anzeigename ändern“ wird gefunden.
  - `git log -p --all` auf Schlüsselmuster → 0.
- [x] **Sensible Daten in Antworten:** Das Dashboard enthält nur die eigene E-Mail: keine fremde ID, kein JWT, kein `service_role`, kein Hash. In der Antwort auf einen fehlgeschlagenen Login steht das Passwort nicht.
- [x] **Security-Header:** `/login`, `/datenschutz`, `/dashboard` (angemeldet) und die 404-Seite liefern `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin` und `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Eine CSP fehlt bewusst (Tech-Debt).
- [x] **Offene Weiterleitung:** siehe EC-12. `/auth/confirm` kennt keinen `next`-Parameter.
- [x] **`[user]`-Aufgaben:** Alle sind in `tasks.md` abgehakt (T5, T12, T18–T26, T32). Es gibt keine `[user go-live]`-Zeile, und auf dem Login-Weg ist keine offen.
- [!] **Rate-Limit auf gewöhnlichen Endpunkten:** NOT VERIFIED, nicht implementiert (optional fürs MVP). 25 × `updateDisplayName` in 6,5 s → 25 × 200 (`probe11.mjs`).

## Automatisierte Tests

- [x] **Unit- und Integrationstests:** `npm test` lief einmal vor der Aufteilung auf die Lanes: 14 Dateien, 103 Tests bestanden, 0 fehlgeschlagen, keine übersprungen (`suite-run.log`).
  - Der RLS-Integrationstest lief gegen das echte Projekt; einzeln: 12/12, darunter „lets at most 5 of 12 parallel attempts…“.
  - `grep` nach `.only/.skip/.todo` findet nur den gewollten Schalter `describe.skipIf(!configured)`, und der hat nicht ausgelöst.
- [x] **Lint / Typen / Build:** `npm run lint` (Exit 0), `npx tsc --noEmit` (Exit 0), `npm run build` (Exit 0, 14/14 Seiten) (`static-checks.log`, `build.log`).
- [x] **Migrationen:** `supabase migration list --linked` → 20261006000001 bis …0004 lokal und remote. Die früheren Funktionen laufen weiter: `login_throttle_status`, `auth_email_exists`, Profil-Trigger.
- [x] **Neue Unit-Tests aus diesem Lauf:** `src/lib/auth/actions/login-release.test.ts`, 6 Tests, grün. Geprüft wird, welche Login-Ausgänge die Reservierung freigeben: Supabase-429, unbekannter Fehlercode, Exception, falsches Passwort (bleibt), Freigabe scheitert (2×).
  - Rotprobe 1: alle Erwartungen in einer Kopie umgedreht → 6/6 rot.
  - Rotprobe 2: die Schutzstellen in `login.ts` entfernt (Abfangen des Freigabefehlers, Behalten bei falschem Passwort, Freigabe vor den Fehlerzweigen) → die jeweils zuständigen Tests rot (3 bzw. 2).
  - Danach wiederhergestellt (`git checkout`), 6/6 grün.
- [~] **Unit-Tests aus dem ersten Lauf** (`action-state.test.ts`, `reset-cookie.test.ts`, `pending-email.test.ts`): laufen in der Suite grün mit.

## Regression

- [x] Kein Feature hat den Status Deployed (`features/INDEX.md`). Es gibt keine Nachbarn außerhalb von PROJ-1.
- [x] **Kernabläufe innerhalb von PROJ-1, die der Diff nicht nennt:** keine Regression. Neu durchlaufen wurden:
  - Registrierung → Bestätigung → Dashboard
  - Weiterleitungen
  - Kopfzeile und Anzeigename
  - Abmelden und parallele Sitzungen
  - Passwort-Reset
  - RLS mit zwei Sitzungen
  - Konto löschen und neu anlegen
  - öffentliche Seiten
  Belege siehe die AC oben.
- [x] **Öffentliche Seiten:** `/login`, `/signup`, `/forgot-password`, `/datenschutz` und `/auth/link-invalid` liefern 200, `lang="de"`, einen Datenschutz-Link und `method="POST"`.

## E2E-Tests
- Status: **nicht ausgeführt** (es gibt noch keine E2E-Suite; `/e2e-tests` für kritische Abläufe)

## Nicht verifiziert in diesem Lauf

- [!] **Browser-Darstellung:** Chrome, Firefox und Safari sowie Handybreite ab 360 px. `/qa` läuft ohne Browser.
- [!] **Browser-Konsole, Netzwerk-Tab, `document.cookie`:** brauchen DevTools. BUG-12 ist nur aus dem `Set-Cookie`-Header gefolgert.
- [!] **Mail-Zustellung** (AC-1, AC-19): kein Zugriff aufs Postfach. Prüfung von Hand: Kam die Registrierungsmail an `max+qa2-reg-1@kopp-beratung.de` an (ca. 09:58Z UTC)? Der Link darin ist inzwischen ungültig.
- [!] **Nur im Browser sichtbar:**
  - AC-5: Countdown am Button
  - AC-16: Menü öffnen, Optik
  - AC-18/AC-20: Toasts
  - EC-1: echter Doppelklick
  - EC-13: Klick auf „Abbrechen“
- [!] **AC-12:** echter Browser-Neustart und Erneuerung des Tokens.
- [!] **AC-17:** Zurück-Button bzw. bfcache nach dem Abmelden (Risiko siehe BUG-8).
- [!] **Echte Link-Abläufe:** AC-21 (älter als 1 h) und EC-3/AC-4 (24 h). Nicht nachstellbar.
- [!] **AC-27:** ob der Aufräum-Job tatsächlich läuft. Prüfung von Hand: Supabase → Integrations → Cron → Job `proj1-auth-cleanup` → Verlauf.
- [!] **Supabase-429 beim Login zur Laufzeit:** nicht provoziert, um das gemeinsame Limit pro IP nicht auszureizen. Belegt durch Code und die neuen Unit-Tests.
- [!] **IP-Sperre (AC-11) mit 20 echten Passwortprüfungen:** nur auf DB-Ebene atomar gemessen, über die App vorbefüllt. Das Budget an Supabase-Logins hätte sonst nicht gereicht.
- [!] **Abbruch des Servers zwischen Reservierung und Freigabe:** nicht provozierbar. Im Code bestätigt, dass der Eintrag dann nach 15 Minuten abläuft.
- [!] **EC-4 und EC-5:** ein echter Mailausfall bzw. ein Netzabbruch zum Next-Server.
- [!] **Ausforschung bei Registrierung und „Passwort vergessen“** (BUG-3, BUG-4): nicht zur Laufzeit wiederholt, weil das Mails auslöst. Der Code ist unverändert.
- [!] **Dashboard-Einstellungen**, nur im Supabase-Dashboard sichtbar:
  - Authentication → Sign In / Providers → Email → „Secure password change“ (zu BUG-11)
  - Rate Limits → „emails sent per hour“ = 30 und das Limit für Anmeldungen pro IP
  - „Email OTP Expiration“ = 86400
  - CAPTCHA aus
- [!] **Laufzeitunterschiede beim Login:** eine Stichprobe (322 ms gegen 197 ms) ist keine Messreihe.
- [!] **Rate-Limit auf gewöhnlichen Endpunkten:** nicht implementiert (optional fürs MVP).

## Bugs

### BUG-1: Login-Sperre lässt sich mit parallelen Anfragen überschreiten
- **Severity:** High
- **Status:** Closed (behoben in `a2126ca`, in diesem Lauf verifiziert am 2026-10-06)
- **AC:** AC-10
- **Class:** Rate-Limit nach dem Muster „erst prüfen, dann zählen“ ist nicht atomar (TOCTOU).
- **Sweep:** `grep -rnE "getLoginThrottle\(|recordLoginFailure\(" src --include='*.ts' | grep -v '\.test\.' | grep -v "export async function"` → **0 Treffer** (vorher 2).
- **Klassen-Sweeps dieses Laufs:**
  - App-Code: `grep -rnE "\.rpc\('[a-z_]*(status|exists|check|count)[a-z_]*'" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Treffer, `signup.ts:21` (`auth_email_exists`). Das ist „prüfen, dann handeln“ ohne Zähler, keine Instanz.
  - SQL: Funktionen mit `insert into` ohne `advisory|for update|serializable` → 2 Treffer. Davon ist `record_login_failure` in `…0004` gelöscht, und `handle_new_user` ist ein Trigger mit PK-Eindeutigkeit. Keine Instanz.
  - Ausnahme: Der Insert in `…0002:77` gehört zur gelöschten Funktion und ist eingefroren.
- **Nachweis:** 12 parallele Fehlversuche → 5 Passwortprüfungen, 7 abgelehnt (zwei Lanes, siehe AC-10).

### BUG-2: IP-Sperre lässt sich über den Header `X-Forwarded-For` umgehen
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-11
- **Class:** Ein vom Client steuerbarer Header (`X-Forwarded-For` / `X-Real-IP`) wird ohne vertrauenswürdigen Proxy als Client-IP genommen (`src/lib/auth/request-meta.ts:11-16`).
- **Sweep:** `grep -rlniE "x-forwarded-for|x-real-ip" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 1 Datei (`request-meta.ts`). In diesem Lauf erneut ausgeführt, unverändert.
- **Schritte:**
  1. 20 Fehlversuche mit fester `X-Forwarded-For`. Der 21. wird abgelehnt.
  2. Ein weiterer Versuch mit einem anderen Wert.
  3. Erwartet: weiterhin gesperrt.
  4. Tatsächlich: Die Passwortprüfung läuft wieder. In diesem Lauf erneut bestätigt (10.20.1.60 gegen 10.20.1.61).
- **Ergänzung (aus dem Code):** Mit derselben Fälschung lässt sich auch eine **fremde** IP gezielt sperren. Clients ohne Header landen gemeinsam im Topf `"unknown"` (`request-meta.ts:12-15`), den ein Angreifer per `X-Forwarded-For: unknown` füllen kann.
- **Einordnung:** Die Sperre pro E-Mail-Adresse (AC-10) bleibt unberührt. Lokal steht kein Proxy vor der App.

### BUG-3: Registrierung verrät über Set-Cookie-Header, ob eine Adresse schon ein Konto hat
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-7
- **Class:** Eine nach außen „gleiche“ Antwort unterscheidet sich je nach Existenz-Zweig über Nebenkanäle (Cookies, Header, Fehlerzustände). BUG-4 gehört zur selben Klasse.
- **Sweep:** `grep -rnE "auth_email_exists|if \(!exists\)" src/lib/auth/actions --include='*.ts' | grep -v '\.test\.'` → 2 Treffer (`signup.ts:21`, `:26`). In diesem Lauf erneut ausgeführt, unverändert.
- **Schritte:**
  1. Die Signup-Action einmal mit einer vorhandenen und einmal mit einer neuen Adresse aufrufen.
  2. Die `Set-Cookie`-Header vergleichen.
  3. Tatsächlich: Bei neuer Adresse kommen zusätzlich drei `sb-…-code-verifier`-Cookies. In diesem Lauf erneut beobachtet (`regression/flow1.log`).

### BUG-4: Mailfehler bei der Registrierung verrät, ob eine Adresse existiert
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **EC:** EC-4
- **Class:** wie BUG-3.
- **Sweep:** `grep -rn "MESSAGES.mail" src/lib/auth/actions/*.ts | grep -v test` → 3 Treffer (`signup.ts`, `resend.ts`, `password.ts`). Davon ist nur `signup.ts` nach Existenz verzweigt. In diesem Lauf erneut ausgeführt, unverändert.
- **Schritte:**
  1. Das Mailkontingent ist erschöpft, oder SMTP fällt aus.
  2. Zwei Registrierungen: eine mit registrierter, eine mit unbekannter Adresse.
  3. Tatsächlich (laut Code, `signup.ts:21-26, 41`): „Prüfe dein Postfach“ gegenüber „Wir konnten gerade keine E-Mail senden…“.

### BUG-5: Verbindungsabbruch zum WattWann-Server wird in den Formularen nicht abgefangen
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **EC:** EC-5
- **Class:** Fehler beim Aufruf einer Server Action im Client fängt nichts ab. Es gibt weder `error.tsx` noch `global-error.tsx` noch eine eigene Behandlung um die Actions.
- **Sweep:** `find src/app -name error.tsx -o -name global-error.tsx | wc -l` → 0; betroffene Formulare: `grep -rln useActionState src | wc -l` → 7 Dateien (erster Lauf; der Diff berührt keine dieser Dateien)
- **Schritte:**
  1. `/login` öffnen.
  2. Den Dev-Server stoppen oder offline gehen.
  3. „Anmelden“ klicken.
  4. Tatsächlich (laut Code): Der Fehler geht an die Standard-Fehlerseite von Next, die Eingabe ist weg.

### BUG-6: Datenschutzhinweise nennen das Recht auf Übertragbarkeit nicht
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-26
- **Class:** Pflichtangabe der Spec nur sinngemäß statt ausdrücklich umgesetzt
- **Sweep:** `grep -c "bertragbarkeit" src/app/datenschutz/page.tsx` → 0. In diesem Lauf gegen das gerenderte HTML erneut bestätigt.
- **Schritte:** `/datenschutz` öffnen. Dort steht nur „Auskunft und Kopie deiner Daten (Art. 15 und 20 DSGVO)“ (`page.tsx:91`).

### BUG-7: „Prüfe dein Postfach“ behauptet nach dem Login eines unbestätigten Kontos einen Versand
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **Class:** Ein Text unterstellt eine Aktion, die nicht stattfand.
- **Sweep:** `grep -rn "setPendingEmail(" src/lib/auth/actions | grep -v test` → 2 Treffer (signup: gewollt, wegen AC-7; login: falsch). Erster Lauf; `login.ts` ruft es weiterhin an derselben Stelle auf (`login.ts:68`).
- **Schritte:**
  1. Mit einem unbestätigten Konto und korrektem Passwort anmelden.
  2. Dem Link „Bestätigungslink erneut senden“ folgen.
  3. Tatsächlich: „Wir haben einen Bestätigungslink … geschickt“ (`src/app/(auth)/signup/check-email/page.tsx:31-32`), obwohl nichts verschickt wurde.

### BUG-8: Dashboard im Dev-Betrieb ohne `Cache-Control: no-store`
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **AC:** AC-17 (Zurück-Button)
- **Class:** Die Cache-Garantie aus `design.md` hängt am Framework-Default, und der unterscheidet sich zwischen dev und prod.
- **Sweep:** `grep -rn "no-store" next.config.ts src/ | grep -v test | wc -l` → 0 (erster Lauf; der Diff berührt diese Dateien nicht)
- **Schritte:** Mit Session `curl -D - localhost:3000/dashboard` aufrufen. Ergebnis: `Cache-Control: no-cache, must-revalidate` statt `no-store`.

### BUG-9: 404-Seite englisch und mit doppeltem Seitentitel
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06)
- **Class:** Fehlende eigene Fehlerseiten des App-Rahmens. Gleiche Ursache wie BUG-5.
- **Sweep:** `find src/app -name not-found.tsx | wc -l` → 0. In diesem Lauf erneut beobachtet (`/gibtsnicht` englisch).
- **Schritte:** `GET /gibtsnicht` aufrufen. Ergebnis: „404: This page could not be found.“ und zwei `<title>`-Tags.

### BUG-10: Laufende korrekte Logins zählen als Fehlversuche und sperren gleichzeitige korrekte Logins
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06; neuer, nicht blockierender Befund einer Nachprüfung)
- **AC:** AC-8, AC-10
- **Herkunft:** Nebenwirkung des Fixes für BUG-1.
- **Class:** Pessimistisch reservierte Versuche werden vor ihrem Ausgang als endgültige Fehlversuche gewertet. Laufende und bestätigte Fehlversuche teilen sich einen Zähler, für die Sperre und für die angezeigte Wartezeit.
- **Sweep:**
  - `grep -rnE "beginLoginAttempt\(" src --include='*.ts' | grep -v '\.test\.' | grep -v "export async function"` → 1 Treffer (`login.ts:33`)
  - `grep -nE "insert into private.login_failures" supabase/migrations/*.sql` → 2 Treffer, davon aktiv nur `…0004:31`
- **Schritte:**
  1. Ein bestätigtes Konto ohne Fehlversuche anlegen.
  2. 6 Logins mit **korrektem** Passwort gleichzeitig senden (feste IP).
  3. Erwartet: alle 6 auf `/dashboard`.
  4. Tatsächlich: 5 × `/dashboard`, 1 × „Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut.“ Direkt danach steht der Status bei `blocked: false`, die „15 Minuten“ stimmen also nicht (`acceptance/par.mjs`).
- **Einordnung:** Tritt nur bei mindestens 5 gleichzeitigen Versuchen pro Adresse oder 20 pro IP auf. Ein erneuter Versuch funktioniert sofort.

### BUG-11: Reset-Cookie ist fälschbar: Passwortwechsel ohne Reset-Link
- **Severity:** Medium
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06; neuer, nicht blockierender Befund einer Nachprüfung)
- **AC:** AC-20, Garantie aus `design.md` (Umsetzungsnotizen: „Sonst könnte jeder Angemeldete dort ohne altes Passwort ein neues setzen“)
- **Herkunft:** besteht seit dem ersten Build (`b33cb6d`), im ersten QA-Lauf übersehen. Nicht durch den Fix entstanden.
- **Class:** Eine Sicherheitsentscheidung hängt an einem unsignierten Cookie, das der Client selbst setzen kann. `src/lib/auth/reset-cookie.ts:11` speichert die Nutzer-ID im Klartext, `:22` vergleicht nur den Wert.
- **Sweep:**
  - `grep -rnE "store\.get\(|cookies\(\)\)?\.get\(|\.cookies\.get\(" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'` → 2 Treffer:
    - `reset-cookie.ts:22` entscheidet über eine Berechtigung, das ist der Bug.
    - `pending-email.ts:21` dient nur der Anzeige bzw. dem Neuversand und erweitert keine Rechte.
  - Signaturen im Code: `grep -rnE "createHmac|sign\(|verify\(" src --include='*.ts' | grep -v test | wc -l` → 0.
- **Schritte** (`security/probe10.mjs`):
  1. Normal anmelden. `GET /reset-password` → 307 auf `/auth/link-invalid?typ=reset` (korrekt).
  2. Das Cookie `password_reset=<eigene Nutzer-ID>` selbst mitschicken. Die ID steht als `sub` im Session-Token. `GET /reset-password` → **200** mit Formular.
  3. Die Action `updatePassword` mit diesem Cookie → **303 auf `/dashboard?hinweis=passwort-geaendert`**.
  4. Zusätzlich: `PUT {SUPABASE_URL}/auth/v1/user` nur mit dem Session-Token → 200. Supabase verlangt derzeit kein altes Passwort.
- **Folge:** Wer eine fremde Sitzung hat (geteiltes oder offenes Gerät), kann das Passwort ändern und das Konto dauerhaft übernehmen.
- **Fix braucht beides:** ein signiertes bzw. serverseitig gebundenes Reset-Merkmal im Code und die Supabase-Einstellung „Secure password change“. Sonst bleibt der direkte Weg über Supabase offen.

### BUG-12: Supabase-Session-Cookie ohne HttpOnly
- **Severity:** Low
- **Status:** Deferred (Entscheidung des Nutzers, 2026-10-06; neuer, nicht blockierender Befund einer Nachprüfung)
- **AC:** keins direkt (Technische Anforderungen, Sicherheit)
- **Class:** Das Session-Token ist im Browser lesbar, obwohl kein Client-Code es braucht (Standard von `@supabase/ssr` übernommen).
- **Sweep:** `grep -rn "httpOnly" src/lib/supabase src/proxy.ts | wc -l` → 0; betroffen sind `src/lib/supabase/server.ts` und `src/proxy.ts`.
- **Schritte:** Einloggen und den `Set-Cookie`-Header von `sb-…-auth-token` lesen: `Path=/; Max-Age=34560000; SameSite=lax`, **ohne** `HttpOnly`.
- **Einordnung:** Schutz in der Tiefe. Einen XSS-Weg gibt es derzeit nicht (EC-10). Das lesbare Token erleichtert aber BUG-11.

## Weitere Beobachtungen (kein Bug dieses Laufs)

- **Globaler Advisory Lock** (`…0004:20`): Alle Logins der App laufen nacheinander, nicht nur die für dieselbe Adresse. Bei dieser Nutzerzahl unkritisch.
- **Freigabe bei unbekannten Fehlercodes** (`login.ts:61-64`): Jeder Code außer `invalid_credentials` gibt die Reservierung frei. Liefert Supabase für ein falsches Passwort einmal einen anderen Code, wäre das Raten wieder unbegrenzt. Heute zählen alle geprüften Fälle. Härter wäre: bei unbekanntem Code behalten.
- **Parallele Registrierung derselben neuen Adresse** (`signup.ts:21-28`, „prüfen, dann handeln“): Ob das zweite `signUp` Passwort oder Namen des gerade angelegten Kontos überschreibt, ist ungeprüft, weil der Test Mails auslöst.
- **Server-Action-POST an öffentliche Seiten** bzw. mit fremdem `Origin` liefert 500 statt 4xx. Ohne Folgen, aber laute Fehler im Log.
- **`X-Powered-By: Next.js`** wird gesendet (Info).
- **`updateDisplayName`** unterscheidet ein fehlendes Feld nicht von einem leeren (`account.ts:14`). Entspricht AC-18, vermutlich gewollt.
- **EC-3 und EC-2 widersprechen sich im Wortlaut** („abgelaufen“ gegen „ungültig oder abgelaufen“). Der Code folgt EC-2. Glätten mit `/refine PROJ-1`.
- **Art. 18 DSGVO** (Recht auf Einschränkung) fehlt auf `/datenschutz`. Die Spec verlangt es nicht. Thema für `/dsgvo`.
- **`features/INDEX.md` → Deployments** enthält noch die Beispielzeile der Vorlage (`v1.0.0 · … · app.example.com`). `/audit` und `/security-check` lesen diese Zeile.

## Zusammenfassung
- **Acceptance Criteria:** 26 aktive ACs (AC-22 entfallen).
  - Bestanden 23: 20 in diesem Lauf geprüft, 3 übernommen (AC-2, AC-5, AC-7).
  - Fehlgeschlagen 2: AC-11 (BUG-2) und AC-26 (BUG-6), beide Deferred.
  - Nicht verifiziert 1: AC-27.
  - **AC-10 ist jetzt bestanden.**
- **Edge Cases:** 13.
  - Bestanden 11: davon 6 in diesem Lauf geprüft, 5 übernommen.
  - Fehlgeschlagen 2: EC-4 (BUG-4) und EC-5 (BUG-5), beide Deferred.
- **Bugs:** 12 insgesamt.
  - Closed 1: BUG-1.
  - Open 0.
  - Deferred 11: BUG-2 bis BUG-12. Nach Severity: 0 Critical, 0 High, 6 Medium (BUG-2, 3, 4, 5, 10, 11), 5 Low (BUG-6, 7, 8, 9, 12).
  - Neu in diesem Lauf: BUG-10, BUG-11, BUG-12.
- **Security:** 17 Prüfungen.
  - 12 bestanden: neue DB-Funktionen, Timing-Garantie, Authentifizierung, Autorisierung, Injection/XSS, CSRF, Zugangsdaten nicht in der URL, keine Secrets im Bundle, keine sensiblen Daten in Antworten, Header, offene Weiterleitung, `[user]`-Aufgaben.
  - 3 mit Bug (alle Deferred): Brute Force (nur noch BUG-2), Ausforschung (BUG-3/4), Cookies (BUG-11/12).
  - 2 NOT VERIFIED: Rate-Limit auf gewöhnlichen Endpunkten, Dashboard-Einstellungen.
- **Production Ready:** **JA**. Kein Critical- oder High-Bug, kein Bug Open. Die Laufzeit-ACs wurden gegen die laufende App ausgeführt.
- **Empfehlung:**
  - BUG-2 bis BUG-12 sind zurückgestellt und blockieren die Freigabe nicht. Später gesammelt mit `/build PROJ-1 deferred`.
  - BUG-11 als Erstes angehen, weil er Code **und** die Supabase-Einstellung „Secure password change“ braucht.

> „Production Ready: JA“ heißt nur: keine blockierenden Bugs gefunden. Es heißt nicht, dass alles geprüft wurde. Die Punkte unter „Nicht verifiziert“ bleiben offen, bis ein Mensch oder `/e2e-tests` sie prüft.
