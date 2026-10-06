# PROJ-1 Tasks

> Erzeugt von `/tasks` aus `spec.md` + `design.md`. Das ist der geordnete, nachvollziehbare Bauplan: die Brücke zwischen dem Vertrag (WAS) und dem Build (WIE).
> `[P]` = parallelisierbar: Die Dateien der Aufgabe überschneiden sich mit keiner anderen `[P]`-Aufgabe derselben Ebene, `/build` kann sie also an einen eigenen Subagenten geben.
> Ebenen laufen **nacheinander** (jede ist eine Schranke). Aufgaben **innerhalb** einer Ebene laufen parallel, wo `[P]` steht. Jede Aufgabe nennt die AC-/EC-IDs aus `spec.md`, die sie erfüllt. Das ist die Kette AC → Task → Test.
> `[user]` = eine Einstellung, die nur du machen kannst (Dashboard, Terminal, `.env.local`): `where:` statt `files:`, nie `[P]`. Du hakst sie selbst ab, `/build` übergibt sie nur. Solange eine offen ist, ist das Feature nicht fertig.
> Owner: `/tasks` legt die Datei an, `/build` hakt die Kästchen ab, außer bei `[user]`-Aufgaben.
> Kein Status-Feld hier. Der Status des Features steht nur in `features/INDEX.md`.

## Ebene 1 — Setup & Datenbank

- [x] T1 [P]  Projekt-Setup: `supabase init` (vorhandenen Ordner `supabase/` aus `supabase link` übernehmen), Paket `server-only` installieren, Platzhalter `SUPABASE_SERVICE_ROLE_KEY` in `.env.local.example`  · files: supabase/config.toml, supabase/.gitignore, package.json, package-lock.json, .env.local.example  · → AC-7, AC-10, AC-25
- [x] T2 [P]  Migration `profiles`: Tabelle, Prüfregel für `display_name` (1–50, getrimmt), Kaskade auf `auth.users`, Trigger „Profil bei Registrierung anlegen“, Trigger für `updated_at`, RLS an, nur eigenes Profil lesen und nur `display_name` ändern, `GRANT`s für `authenticated`, keine Rechte für `anon`  · files: supabase/migrations/20261006000001_profiles.sql  · → AC-3, AC-18, AC-23, AC-24, EC-10, EC-11
- [x] T3 [P]  Migration Login-Sperre: Schema `private`, Tabelle `private.login_failures` mit beiden Indizes, Funktionen „Sperrstatus abfragen“ (5 pro E-Mail / 20 pro IP in 15 Min., „frei in N Sekunden“), „Fehlversuch eintragen“ (räumt dabei ab) und „Adresse existiert?“, `EXECUTE` nur für `service_role`  · files: supabase/migrations/20261006000002_login_throttle.sql  · → AC-7, AC-10, AC-11
- [x] T4 [P]  Migration Aufräum-Job: `pg_cron` aktivieren, stündlicher Job löscht unbestätigte Auth-Nutzer älter als 7 Tage und `login_failures` älter als 15 Min.  · files: supabase/migrations/20261006000003_cleanup_job.sql  · → AC-27
- [x] T5 [user]  Supabase-CLI anmelden und Projekt verknüpfen  · where: Terminal im Projektordner: `supabase login`, dann `supabase link --project-ref <ref>` (Ref aus der Dashboard-URL, fragt nach dem Datenbank-Passwort)  · → AC-3, AC-23, AC-24, AC-27

## Ebene 2 — Server-Grundlagen & gemeinsame Bausteine

- [x] T6  Migrationen aus Ebene 1 einspielen (`supabase db push`, vorher `--dry-run` zeigen) und per `supabase migration list` bestätigen. Läuft vor den `[P]`-Aufgaben, braucht T5. Achtung, „single“: Das ist das Live-Projekt  · files: — (nur Befehle)  · → AC-3, AC-23, AC-24, AC-27
- [x] T7 [P]  Admin-Client (Service-Rolle, `server-only`), Ermittlung von IP-Adresse und SHA-256-Hashes, Login-Sperre als Server-Modul (Status abfragen, Fehlversuch eintragen, „X Minuten“ berechnen) mit Tests  · files: src/lib/supabase/admin.ts, src/lib/auth/request-meta.ts, src/lib/auth/throttle.ts, src/lib/auth/throttle.test.ts  · → AC-10, AC-11
- [x] T8 [P]  Zod-Schemas (E-Mail normalisieren, Passwort 8–72 Zeichen / ≤ 72 Bytes, Anzeigename), sicheres Rücksprungziel und Cookie `pending_email`, mit Tests  · files: src/lib/auth/schemas.ts, src/lib/auth/schemas.test.ts, src/lib/auth/safe-redirect.ts, src/lib/auth/safe-redirect.test.ts, src/lib/auth/pending-email.ts  · → AC-2, AC-13, EC-7, EC-10, EC-12
- [x] T9 [P]  `src/proxy.ts`: Sitzung auffrischen, Weiterleitungsregeln für `/`, `/dashboard…`, `/login` und `/signup` als testbare Funktion, mit Tests  · files: src/proxy.ts, src/lib/auth/route-rules.ts, src/lib/auth/route-rules.test.ts  · → AC-12, AC-13, AC-14, AC-15
- [x] T10 [P]  Sicherheits-Header (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`)  · files: next.config.ts  · → Technische Anforderungen (Sicherheit)
- [x] T11 [P]  App-Rahmen-Grundlagen: Root-Layout (Deutsch, Titel „WattWann“, Inter, Toaster), Startseite als Weiterleitung, Layout der Auth-Seiten, `AuthCard`  · files: src/app/layout.tsx, src/app/page.tsx, src/app/(auth)/layout.tsx, src/components/auth/auth-card.tsx  · → AC-14
- [x] T12 [user]  Schlüssel in `.env.local` eintragen  · where: `.env.local` → `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API Keys, secret/service_role, **ohne** `NEXT_PUBLIC_`)  · → AC-7, AC-10, AC-25

## Ebene 3 — Server Actions & Link-Endpunkt

- [x] T13 [P]  Server Actions „Registrieren“ (Existenz-Prüfung, kein Supabase-Aufruf bei vorhandener Adresse, Cookie, Fehlerfälle) und „Bestätigungslink erneut senden“ (immer neutrale Antwort), mit Tests  · files: src/lib/auth/actions/signup.ts, src/lib/auth/actions/signup.test.ts, src/lib/auth/actions/resend.ts, src/lib/auth/actions/resend.test.ts  · → AC-1, AC-2, AC-3, AC-5, AC-7, EC-1, EC-3, EC-4, EC-7
- [x] T14 [P]  Server Actions „Anmelden“ (Sperre vor dem Versuch, nur Fehlversuche zählen, gleiche Meldung, unbestätigt → Hinweis + Cookie, sicherer Rücksprung) und „Abmelden“ (Scope „local“), mit Tests  · files: src/lib/auth/actions/login.ts, src/lib/auth/actions/login.test.ts, src/lib/auth/actions/logout.ts  · → AC-6, AC-8, AC-9, AC-10, AC-11, AC-13, AC-17, EC-5, EC-12
- [x] T15 [P]  Server Actions „Passwort vergessen“ (immer gleiche Meldung) und „Neues Passwort setzen“ (nur mit Reset-Sitzung), mit Tests  · files: src/lib/auth/actions/password.ts, src/lib/auth/actions/password.test.ts  · → AC-19, AC-20, EC-8
- [x] T16 [P]  Server Actions „Anzeigename ändern“ (nur eigenes Profil) und „Konto löschen“ (ID aus geprüfter Sitzung, Admin-Löschung, Abmelden, Weiterleitung mit Hinweis), mit Tests  · files: src/lib/auth/actions/account.ts, src/lib/auth/actions/account.test.ts  · → AC-18, AC-25, EC-6, EC-10, EC-11
- [x] T17 [P]  Endpunkt `/auth/confirm`: `token_hash` prüfen, `signup` → `/dashboard`, `recovery` → 1-h-Prüfung über `recovery_sent_at` → `/reset-password`, ungültig → `/dashboard` (falls angemeldet) oder `/auth/link-invalid?typ=…`, mit Tests  · files: src/app/auth/confirm/route.ts, src/app/auth/confirm/route.test.ts  · → AC-4, AC-20, AC-21, EC-2, EC-3, EC-9
- [ ] T18 [user]  App-Passwort für den Mailversand  · where: Google-Konto `max@kopp-beratung.de` → Sicherheit → Bestätigung in zwei Schritten an → App-Passwörter → „WattWann Supabase“ (falls die Option fehlt: Google-Admin-Konsole → App-Passwörter für den Nutzer erlauben)  · → AC-1, AC-5, AC-19
- [ ] T19 [user]  Eigener SMTP-Server in Supabase  · where: Supabase → Authentication → Emails → SMTP Settings → Host `smtp.gmail.com`, Port 587, Benutzer `max@kopp-beratung.de`, Passwort = App-Passwort aus T18, Absender `max@kopp-beratung.de`, Name „WattWann“  · → AC-1, AC-5, AC-19, EC-4
- [ ] T20 [user]  Mail-Limit  · where: Supabase → Authentication → Rate Limits → „emails sent per hour“ = 30; Authentication → Attack Protection → CAPTCHA bleibt **aus**  · → EC-4
- [ ] T21 [user]  E-Mail-Bestätigung einschalten  · where: Supabase → Authentication → Sign In / Providers → Email → „Confirm email“ = an  · → AC-4, AC-6
- [ ] T22 [user]  Link-Gültigkeit  · where: dort → „Email OTP Expiration“ = 86400 Sekunden  · → AC-4, AC-20, EC-3
- [ ] T23 [user]  Passwort-Regeln  · where: dort → „Minimum password length“ = 8, keine Pflicht-Zeichenklassen; Authentication → Attack Protection → Leaked-Password-Schutz bleibt aus (nur Pro-Plan)  · → AC-2
- [ ] T24 [user]  Mail-Vorlage „Confirm signup“  · where: Supabase → Authentication → Emails → Templates → „Confirm signup“; deutscher Text (liefert `/build` in der Übergabe), Link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`  · → AC-4
- [ ] T25 [user]  Mail-Vorlage „Reset password“  · where: dort → „Reset password“; deutscher Text mit „gilt 1 Stunde“ (liefert `/build`), Link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`  · → AC-19, AC-20
- [ ] T26 [user]  Site-URL und erlaubte Weiterleitungen  · where: Supabase → Authentication → URL Configuration → Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**`  · → AC-4, AC-20

## Ebene 4 — Oberfläche

- [ ] T27 [P]  Seite `/login`: Formular, Fehlerbereich (falsche Daten, Sperre mit Minuten, unbestätigt + Link, Verbindungsfehler mit „Erneut versuchen“), Hinweis „Dein Konto wurde gelöscht“, Links zu Reset, Registrierung und Datenschutz  · files: src/app/(auth)/login/page.tsx, src/components/auth/login-form.tsx  · → AC-6, AC-8, AC-9, AC-10, AC-11, AC-13, AC-25, AC-26, EC-1, EC-5
- [ ] T28 [P]  Seiten `/signup` und `/signup/check-email`: Formular mit Anzeigename, Hinweis auf die Datenschutzhinweise, Postfach-Seite mit Adresse aus dem Cookie und Button „Link erneut senden“ mit 60-s-Countdown  · files: src/app/(auth)/signup/page.tsx, src/components/auth/signup-form.tsx, src/app/(auth)/signup/check-email/page.tsx, src/components/auth/resend-button.tsx  · → AC-1, AC-2, AC-5, AC-7, AC-26, EC-1, EC-5
- [ ] T29 [P]  Seiten `/forgot-password`, `/reset-password` und `/auth/link-invalid` (je nach `typ` Aktion „Neuer Bestätigungslink“ mit E-Mail oder „Neues Passwort anfordern“, dazu „Anmelden“)  · files: src/app/(auth)/forgot-password/page.tsx, src/app/(auth)/reset-password/page.tsx, src/app/(auth)/auth/link-invalid/page.tsx, src/components/auth/password-forms.tsx, src/components/auth/resend-form.tsx  · → AC-19, AC-20, AC-21, EC-2, EC-3, EC-5
- [ ] T30 [P]  Dashboard-Rahmen: geschütztes Layout (Nutzer beim Auth-Server prüfen, ohne Cache), Seite „Übersicht“ mit Toast nach Passwortänderung, `AppHeader` mit Menü, Dialoge „Anzeigename ändern“ und „Konto löschen“  · files: src/app/dashboard/layout.tsx, src/app/dashboard/page.tsx, src/components/app-header.tsx, src/components/account-dialogs.tsx  · → AC-16, AC-17, AC-18, AC-20, AC-25, EC-6, EC-10, EC-13
- [ ] T31 [P]  Seite `/datenschutz` (öffentlich): Verantwortlicher, Kontakt max@kopp-beratung.de, Daten und Zwecke, Speicherdauer, Dienste mit Region (Supabase Frankfurt, Google Workspace), Rechte, Antwort innerhalb eines Monats; Inhalt aus `docs/privacy.md`  · files: src/app/datenschutz/page.tsx  · → AC-26
- [ ] T32 [user]  Auftragsverarbeitungsverträge abschließen bzw. prüfen  · where: Supabase → Organization Settings → Legal Documents · Google-Admin-Konsole → Konto → Rechtliches und Compliance  · → AC-26

## Ebene 5 — Prüfung der Datentrennung

- [ ] T33  Integrationstest gegen die echte Datenbank: Zwei Testkonten (per Admin-Client bestätigt angelegt und danach gelöscht). A kann das Profil von B weder lesen noch ändern, `anon` bekommt keine Profile, `anon`/`authenticated` können `private.login_failures` und die Sperr-Funktionen nicht aufrufen  · files: src/lib/supabase/rls.integration.test.ts  · → AC-23, AC-24, AC-10

## Parallelisierung

- **Ebenen sind Schranken.** Eine Ebene startet erst, wenn die vorige vollständig integriert und gegen ihre AC-IDs geprüft ist: Datenbank (E1) → Server-Grundlagen (E2) → Actions (E3) → Oberfläche (E4) → Datentrennung (E5).
- **`[P]` heißt: keine gemeinsamen Dateien.** Geprüft: Keine zwei `[P]`-Aufgaben einer Ebene nennen denselben Pfad. Die drei Migrationen haben feste, aufsteigende Zeitstempel, damit ihre Reihenfolge stimmt, auch wenn sie parallel entstehen.
- **T6 läuft in Ebene 2 zuerst und allein.** Sie spielt die Migrationen ins (Live-)Projekt ein und braucht dafür T5.
- **`[user]`-Aufgaben werden nie gebaut.** Sie stehen in der Ebene, deren Code sie braucht. `/build` nennt sie beim Erreichen der Ebene (was, wo, welcher Wert) und macht weiter. Das Kästchen bleibt offen, bis du es abhakst. Spätestens vor `/qa` müssen alle erledigt sein, sonst lassen sich Registrierung und Mails nicht prüfen.
- Während `/build` läuft jede `[P]`-Aufgabe der aktiven Ebene in einem eigenen Subagenten mit isoliertem Git-Worktree. Danach integriert der Haupt-Agent, prüft gegen die AC-IDs der Ebene und hakt hier ab. Subagenten erklären sich nie selbst für fertig.
