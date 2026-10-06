# PROJ-1: Benutzerkonto & Login

<!-- Diese Datei (spec.md) ist der stabile VERTRAG – sie legt fest, WAS gebaut wird, nicht WIE.
     Owner: /write-spec (legt an), /refine (ändert). Während /build ist diese Datei READ-ONLY.
     Das technische Design steht in design.md, die QA-Ergebnisse in qa-report.md.
     Kein Status- oder Datumsfeld: Der Status steht NUR in features/INDEX.md. -->

## Abhängigkeiten
- Keine. PROJ-1 ist das erste Feature und besitzt den App-Rahmen (`docs/app-shell.md`): Kopfzeile, `/dashboard`, `/login`, `/signup`. PROJ-2 und PROJ-3 füllen nur Abschnitte im Dashboard.

## User Stories
- Als Haushalt mit dynamischem Stromtarif möchte ich mich mit E-Mail-Adresse und Passwort registrieren, damit meine Geräte dauerhaft gespeichert bleiben.
- Als registrierte Person möchte ich mich anmelden und angemeldet bleiben, bis ich mich selbst abmelde, damit ich WattWann täglich ohne erneutes Einloggen kurz öffnen kann.
- Als registrierte Person möchte ich mein Passwort per E-Mail-Link zurücksetzen können, damit ich bei einem vergessenen Passwort nicht mein Konto und meine Geräte verliere.
- Als registrierte Person möchte ich sicher sein, dass nur ich meine Daten sehen und ändern kann, damit niemand sonst auf meine Geräte und mein Profil zugreift.
- Als registrierte Person möchte ich einen Anzeigenamen festlegen und ändern können, damit mich die App persönlich anspricht.
- Als registrierte Person möchte ich mein Konto mit allen Daten löschen können, damit nichts von mir zurückbleibt, wenn ich WattWann nicht mehr nutze.
- Als registrierte Person möchte ich mich abmelden können, damit niemand an diesem Gerät in mein Konto kommt.

## Out of Scope
- Anmeldung über Google, Apple o. Ä. (Social Login), Magic Link ohne Passwort, Zwei-Faktor-Authentifizierung
- E-Mail-Adresse in der App ändern: erfolgt auf Anfrage per E-Mail an die Kontaktadresse aus den Datenschutzhinweisen
- Daten-Export per Button in der App: Auskunft und Kopie gibt es auf Anfrage per E-Mail (siehe `docs/privacy.md`)
- „Angemeldet bleiben“-Häkchen und „Auf allen Geräten abmelden“
- Eigene Landingpage unter `/`
- Abgleich neuer Passwörter mit Listen geleakter Passwörter (bei Supabase nur im Pro-Plan, außerhalb des 0-€-Budgets)
- Admin-Ansicht auf Konten anderer Nutzer
- Impressum: Die App ist weder öffentlich erreichbar noch kommerziell
- Inhalte der Dashboard-Abschnitte „Strompreise“ (PROJ-2) und „Meine Geräte“ (PROJ-3)
- CAPTCHA bzw. Bot-Schutz auf den Formularen (Entscheidung vom 2026-10-06, Risiko im Entscheidungsprotokoll)

## Acceptance Criteria

### Registrierung
- [ ] **AC-1** — Angenommen eine nicht angemeldete Person ist auf `/signup`, wenn sie eine gültige E-Mail-Adresse, ein Passwort mit 8 bis 72 Zeichen und optional einen Anzeigenamen eingibt und „Registrieren“ klickt, dann wird ein unbestätigtes Konto angelegt, eine Bestätigungs-Mail an die Adresse verschickt und die Seite „Prüfe dein Postfach“ mit der eingegebenen Adresse angezeigt
- [ ] **AC-2** — Angenommen eine Person ist auf `/signup`, wenn sie das Formular mit leerer oder ungültiger E-Mail-Adresse, einem Passwort unter 8 oder über 72 Zeichen oder einem Anzeigenamen über 50 Zeichen abschickt, dann erscheint unter jedem betroffenen Feld eine verständliche Fehlermeldung, und es wird weder ein Konto angelegt noch eine Mail verschickt. Das gilt auch, wenn die Prüfung im Browser umgangen wird
- [ ] **AC-3** — Angenommen ein Konto wird angelegt, wenn die Registrierung abgeschlossen ist, dann existiert zu diesem Konto automatisch genau ein Profil mit dem angegebenen Anzeigenamen (oder ohne Namen, falls keiner angegeben wurde)
- [ ] **AC-4** — Angenommen eine Person hat sich registriert, wenn sie innerhalb von 24 Stunden auf den Link in der Bestätigungs-Mail klickt, dann gilt ihre Adresse als bestätigt, sie ist angemeldet und landet auf `/dashboard`
- [ ] **AC-5** — Angenommen eine Person ist auf der Seite „Prüfe dein Postfach“, wenn sie „Link erneut senden“ klickt, dann wird eine neue Bestätigungs-Mail verschickt, und der Button bleibt danach 60 Sekunden lang deaktiviert und zeigt die verbleibende Wartezeit an
- [ ] **AC-6** — Angenommen ein Konto ist noch nicht bestätigt, wenn sich die Person mit korrekter E-Mail-Adresse und korrektem Passwort anmelden will, dann wird sie nicht angemeldet, sieht den Hinweis „Bitte bestätige zuerst deine E-Mail-Adresse“ und kann den Bestätigungslink erneut anfordern
- [ ] **AC-7** — Angenommen für eine E-Mail-Adresse existiert bereits ein Konto, wenn sich jemand mit dieser Adresse registriert, dann erscheint dieselbe Seite „Prüfe dein Postfach“ wie bei einer neuen Adresse, und am bestehenden Konto ändert sich nichts (weder Passwort noch Anzeigename, keine Anmeldung)

### Anmeldung
- [ ] **AC-8** — Angenommen eine Person hat ein bestätigtes Konto, wenn sie auf `/login` E-Mail-Adresse und Passwort korrekt eingibt und „Anmelden“ klickt, dann ist sie angemeldet und landet auf `/dashboard`
- [ ] **AC-9** — Angenommen ein Login-Versuch schlägt fehl, wenn die Fehlermeldung angezeigt wird, dann lautet sie für eine unbekannte Adresse und für ein falsches Passwort gleich („E-Mail-Adresse oder Passwort ist falsch“) und verrät nicht, ob die Adresse registriert ist
- [ ] **AC-10** — Angenommen es gab 5 fehlgeschlagene Login-Versuche für dieselbe E-Mail-Adresse innerhalb von 15 Minuten, wenn über die Anmeldeseite von WattWann ein weiterer Versuch erfolgt (auch mit korrektem Passwort), dann wird er abgelehnt, bis das 15-Minuten-Fenster abgelaufen ist, und die Person sieht, in wie vielen Minuten sie es erneut versuchen kann
- [ ] **AC-11** — Angenommen es gab 20 fehlgeschlagene Login-Versuche von derselben IP-Adresse innerhalb von 15 Minuten (egal für welche Adressen), wenn von dieser IP-Adresse über die Anmeldeseite von WattWann ein weiterer Versuch erfolgt, dann wird er abgelehnt, bis das Fenster abgelaufen ist, mit derselben Art Hinweis wie in AC-10
- [ ] **AC-12** — Angenommen eine Person ist angemeldet, wenn sie den Browser schließt und WattWann später wieder öffnet, dann ist sie weiterhin angemeldet, bis sie sich selbst abmeldet

### Weiterleitungen
- [ ] **AC-13** — Angenommen eine Person ist nicht angemeldet, wenn sie `/dashboard` aufruft, dann wird sie auf `/login` weitergeleitet und landet nach erfolgreicher Anmeldung wieder auf `/dashboard`
- [ ] **AC-14** — Angenommen eine Person ruft `/` auf, wenn sie angemeldet ist, dann landet sie auf `/dashboard`, andernfalls auf `/login`
- [ ] **AC-15** — Angenommen eine Person ist angemeldet, wenn sie `/login` oder `/signup` aufruft, dann wird sie auf `/dashboard` weitergeleitet

### Dashboard-Rahmen & Abmelden
- [ ] **AC-16** — Angenommen eine Person ist angemeldet, wenn sie `/dashboard` öffnet, dann sieht sie eine Kopfzeile mit dem App-Namen „WattWann“, ihrem Anzeigenamen (oder ihrer E-Mail-Adresse, falls kein Name gesetzt ist) und einem Menü mit „Anzeigename ändern“, „Datenschutz“, „Konto löschen“ und „Abmelden“, darunter einen einspaltigen Inhaltsbereich
- [ ] **AC-17** — Angenommen eine Person ist angemeldet, wenn sie im Menü „Abmelden“ wählt, dann ist ihre Sitzung auf diesem Gerät beendet, sie landet auf `/login`, und auch der Zurück-Button des Browsers zeigt keine Dashboard-Daten mehr an

### Anzeigename
- [ ] **AC-18** — Angenommen eine Person ist angemeldet, wenn sie über „Anzeigename ändern“ einen neuen Namen mit 1 bis 50 Zeichen speichert oder das Feld leert, dann wird der Name gespeichert bzw. entfernt, die Kopfzeile zeigt sofort den neuen Stand, und eine kurze Bestätigung erscheint

### Passwort vergessen
- [ ] **AC-19** — Angenommen eine Person ist auf `/login`, wenn sie „Passwort vergessen?“ klickt, ihre E-Mail-Adresse eingibt und abschickt, dann erscheint immer dieselbe Meldung („Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link geschickt“), egal ob die Adresse registriert ist. Bei einem bestehenden Konto geht ein Reset-Link an die Adresse
- [ ] **AC-20** — Angenommen eine Person hat einen Reset-Link erhalten, wenn sie ihn innerhalb von 1 Stunde öffnet und ein neues Passwort mit 8 bis 72 Zeichen speichert, dann gilt das neue Passwort, das alte nicht mehr, sie ist angemeldet, landet auf `/dashboard` und sieht eine kurze Bestätigung
- [ ] **AC-21** — Angenommen ein Reset-Link ist abgelaufen oder wurde schon benutzt, wenn die Person ihn öffnet, dann sieht sie „Dieser Link ist ungültig oder abgelaufen“ und kann direkt einen neuen anfordern

### Schutz vor automatisierten Anfragen
- ~~**AC-22** — Angenommen ein automatisiertes Skript ruft Registrierung, Login, „Passwort vergessen“ oder „Link erneut senden“ auf, wenn es dabei kein gelöstes CAPTCHA mitschickt, dann wird die Anfrage serverseitig abgelehnt. Das gilt auch, wenn das Skript die Oberfläche von WattWann umgeht und den Anmeldedienst direkt aufruft. Für normale Nutzer läuft das CAPTCHA meist unsichtbar im Hintergrund (kleines Prüffeld), eine Aufgabe erscheint nur bei Verdacht~~ — _Entfallen am 2026-10-06: kein CAPTCHA, siehe Entscheidungsprotokoll. Die ID wird nicht neu vergeben._

### Datentrennung
- [ ] **AC-23** — Angenommen es gibt zwei Konten A und B, wenn A versucht, das Profil von B zu lesen oder zu ändern, auch direkt über die Datenschnittstelle ohne die Oberfläche, dann erhält A keine Daten von B, und an B ändert sich nichts
- [ ] **AC-24** — Angenommen eine Person ist nicht angemeldet, wenn sie Profildaten über die Datenschnittstelle abfragt, dann erhält sie keine Daten

### Datenschutz (aus dem `/dsgvo`-Check)
- [ ] **AC-25** — Angenommen eine Person ist angemeldet, wenn sie im Menü „Konto löschen“ wählt und die Rückfrage bestätigt, dann werden ihr Konto, ihr Profil und alle zugehörigen Daten (auch Geräte aus späteren Features) sofort und endgültig gelöscht, sie ist abgemeldet, landet auf `/login` und sieht den Hinweis „Dein Konto wurde gelöscht“. _(Art. 17 DSGVO)_
- [ ] **AC-26** — Angenommen eine Person ist angemeldet oder nicht, wenn sie auf `/login`, `/signup` oder im Dashboard-Menü „Datenschutz“ klickt, dann öffnet sich die Seite `/datenschutz` ohne Login. Sie nennt den Verantwortlichen, die Kontaktadresse max@kopp-beratung.de, welche Daten zu welchem Zweck gespeichert werden, die Speicherdauer, die beteiligten Dienste mit Region (Supabase in Frankfurt, Google Workspace für den Mailversand) und die Rechte auf Auskunft, Berichtigung, Löschung, Übertragbarkeit und Widerspruch. Anfragen werden innerhalb eines Monats beantwortet. Das Registrierungsformular verweist neben dem Button auf diese Seite. _(Art. 13, Art. 12 Abs. 3 DSGVO)_
- [ ] **AC-27** — Angenommen ein Konto wurde vor mehr als 7 Tagen angelegt und nie bestätigt, wenn diese Frist abläuft, dann werden das Konto und sein Profil automatisch gelöscht. _(Art. 5 Abs. 1 lit. e DSGVO)_

## Edge Cases
- **EC-1** — Angenommen eine Person klickt „Registrieren“ (oder „Anmelden“, „Link senden“) zweimal schnell hintereinander, wenn die Anfragen ankommen, dann entsteht höchstens ein Konto bzw. eine Mail. Der Button ist während des Sendens deaktiviert und zeigt einen Ladezustand
- **EC-2** — Angenommen ein Bestätigungslink wurde schon benutzt, wenn er ein zweites Mal geöffnet wird, dann landet die Person auf `/dashboard`, falls sie angemeldet ist. Sonst sieht sie dieselbe Seite wie bei einem abgelaufenen Link (EC-3): „Dieser Link ist ungültig oder abgelaufen. Hast du deine Adresse schon bestätigt? Dann melde dich einfach an.“ mit den Aktionen „Anmelden“ und „Neuen Link anfordern“
- **EC-3** — Angenommen ein Bestätigungslink ist älter als 24 Stunden, wenn er geöffnet wird, dann sieht die Person „Dieser Link ist abgelaufen“ und kann einen neuen anfordern
- **EC-4** — Angenommen der Mailversand schlägt fehl oder das Mail-Kontingent ist erschöpft, wenn eine Bestätigungs- oder Reset-Mail verschickt werden soll, dann sieht die Person „Wir konnten gerade keine E-Mail senden, bitte versuche es in einigen Minuten erneut“. Die Meldung verrät nicht, ob die Adresse registriert ist
- **EC-5** — Angenommen die Verbindung zum Server bricht ab oder der Dienst antwortet nicht, wenn eine Person sich registriert, anmeldet oder ein Passwort setzt, dann erscheint ein Fehlerhinweis mit „Erneut versuchen“, und die E-Mail-Adresse bleibt im Formular erhalten
- **EC-6** — Angenommen eine Person ist in zwei Browsern angemeldet, wenn sie in einem davon ihr Konto löscht oder sich abmeldet und im anderen weiterklickt, dann führt die nächste Aktion im anderen Browser beim gelöschten Konto zu `/login` ohne Daten. Beim Abmelden bleibt der andere Browser angemeldet (Abmelden wirkt nur auf dem aktuellen Gerät)
- **EC-7** — Angenommen eine Person gibt ihre E-Mail-Adresse mit Großbuchstaben oder Leerzeichen am Rand ein („ Max@Example.de “), wenn sie sich registriert oder anmeldet, dann wird sie wie „max@example.de“ behandelt
- **EC-8** — Angenommen eine Person fordert mehrmals hintereinander einen Reset-Link an, wenn sie einen der Links öffnet, dann funktioniert nur der zuletzt verschickte
- **EC-9** — Angenommen ein Konto ist noch unbestätigt, wenn die Person über „Passwort vergessen“ einen Reset-Link anfordert und ihn benutzt, dann gilt ihre Adresse damit als bestätigt, weil sie Zugriff auf das Postfach nachgewiesen hat
- **EC-10** — Angenommen ein Anzeigename besteht nur aus Leerzeichen oder enthält HTML bzw. Skript-Code, wenn er gespeichert wird, dann gilt ein reiner Leerzeichen-Name als „kein Name“, und alles andere wird überall als reiner Text angezeigt, nie ausgeführt
- **EC-11** — Angenommen ein Konto wurde gelöscht, wenn sich jemand später mit derselben Adresse neu registriert, dann entsteht ein komplett neues, leeres Konto ohne Daten des alten
- **EC-12** — Angenommen eine Person wird nach dem Login zu einer Zielseite zurückgeleitet (AC-13), wenn diese Zielangabe auf eine fremde Website zeigt, dann wird sie ignoriert, und die Person landet auf `/dashboard`
- **EC-13** — Angenommen eine Person bricht „Konto löschen“ in der Rückfrage ab, wenn der Dialog geschlossen wird, dann bleibt alles unverändert

## Technische Anforderungen
- Sicherheit: Alle Eingaben werden serverseitig gegen ein Schema geprüft, nicht nur im Browser
- Sicherheit: Login-, Registrierungs- und Reset-Formulare senden per POST. Weder Passwörter noch E-Mail-Adressen noch Tokens stehen in einer URL, mit Ausnahme der einmaligen Links aus den Mails
- Sicherheit: Der Zugriffsschutz greift zusätzlich in der Datenbank (Row Level Security), nicht nur in der App
- Passwörter werden nie im Klartext gespeichert oder protokolliert
- Darstellung: funktioniert in aktuellen Versionen von Chrome, Firefox und Safari, auch auf Handybreite (ab 360 px)
- Gestaltung nach `docs/design-system.md` (Formularfelder, Fehler-, Lade- und Leerzustände)

## Offene Fragen
- [x] Reicht der eingebaute Mailversand von Supabase mit seinen niedrigen Stundenlimits für Tests mit mehreren Personen, oder braucht es einen eigenen kostenlosen Mail-Dienst? → Nein, er reicht nicht (stellt nur an Supabase-Team-Mitglieder zu). Die Mails gehen über das bestehende Postfach max@kopp-beratung.de als Einzelabsender, ohne zusätzlichen Dienst (2026-10-06)
- [ ] Greift für das private, nur lokal laufende Projekt die Haushaltsausnahme der DSGVO? Frage für einen Anwalt, siehe `docs/privacy.md`. Die Spec geht bis dahin davon aus, dass die Pflichten voll gelten

## Entscheidungsprotokoll

### Produktentscheidungen
| Entscheidung | Begründung | Datum |
|--------------|------------|-------|
| Die E-Mail-Adresse muss per Link bestätigt werden, bevor man die App nutzen kann | Echte Adressen sind Voraussetzung dafür, dass „Passwort vergessen“ funktioniert und sich niemand mit fremden Adressen registriert. Die längere Registrierung wird dafür bewusst in Kauf genommen | 2026-10-06 |
| Seite „Prüfe dein Postfach“ mit „Link erneut senden“ (gedrosselt auf 1× pro 60 s); der Bestätigungslink meldet direkt an | Keine Sackgasse, wenn eine Mail nicht ankommt. Direkte Anmeldung hält den Weg zum 2-Minuten-Ziel kurz | 2026-10-06 |
| „Passwort vergessen“ gehört zum MVP | Der Mailversand existiert durch die Bestätigung ohnehin. Ohne Reset wären Konto und Geräte bei einem vergessenen Passwort verloren | 2026-10-06 |
| Passwort mind. 8, max. 72 Zeichen, keine Pflicht-Sonderzeichen | Länge statt Zeichenzwang (aktuelle NIST-Empfehlung). 72 ist eine technische Obergrenze. Ein Abgleich mit geleakten Passwörtern ist im 0-€-Budget nicht verfügbar | 2026-10-06 |
| Login-Sperre nach 5 Fehlversuchen pro E-Mail-Adresse in 15 Min., zusätzlich 20 pro IP-Adresse in 15 Min. | Bremst gezieltes Passwort-Raten und das Durchprobieren vieler Konten, ohne Laien bei Tippfehlern zu frustrieren | 2026-10-06 |
| ~~CAPTCHA bei Registrierung und „Passwort vergessen“, nicht beim Login~~ (ersetzt am 2026-10-06, siehe unten) | Diese beiden öffentlichen Formulare lösen Mails aus und schützen damit auch das knappe Mail-Kontingent. Den Login schützt die Sperre, ein CAPTCHA wäre dort bei jedem Login eine Hürde | 2026-10-06 |
| Registrierung mit bereits vorhandener Adresse und „Passwort vergessen“ antworten immer gleich | Verrät nicht, wer ein Konto hat (Schutz gegen Konto-Ausforschung) | 2026-10-06 |
| Optionaler Anzeigename (1–50 Zeichen), später änderbar, sonst wird die E-Mail-Adresse angezeigt | Persönliche Ansprache ohne Pflichtfeld. Änderbarkeit erfüllt zugleich das Recht auf Berichtigung | 2026-10-06 |
| `/` leitet direkt weiter, keine Landingpage | Die App läuft nur lokal und braucht keine Werbeseite | 2026-10-06 |
| Angemeldet bleiben bis zum Abmelden, Abmelden wirkt nur auf dem aktuellen Gerät | Bequem für eine App, die man täglich kurz öffnet. Kein zusätzliches Häkchen, das Laien verwirrt | 2026-10-06 |
| Auskunft und Datenkopie auf Anfrage per E-Mail statt per Export-Button | Für eine Handvoll Nutzer und die Haltung „lean“ angemessen. Spart Aufwand in PROJ-1 und PROJ-3 | 2026-10-06 |
| Kontolöschung sofort und endgültig, in der App | Recht auf Löschung (Art. 17 DSGVO), ohne manuellen Aufwand. Es gibt keine gesetzlichen Aufbewahrungspflichten, die dagegen sprechen | 2026-10-06 |
| Kontaktadresse für Datenschutzanfragen: max@kopp-beratung.de | Vom Verantwortlichen festgelegt. Sie steht in den Datenschutzhinweisen (AC-26) | 2026-10-06 |
| Unbestätigte Konten werden nach 7 Tagen gelöscht | Speicherbegrenzung: Eine nie bestätigte Adresse gehört womöglich gar nicht der Person, die sie eingegeben hat | 2026-10-06 |
| ~~CAPTCHA (meist unsichtbar) auch beim Login und bei „Link erneut senden“, ersetzt „nicht beim Login“~~ (ersetzt am 2026-10-06, siehe unten) | In `/architecture` erkannt: Ein CAPTCHA schützt nur, wenn der Anmeldedienst es selbst prüft, und der prüft es dann für alle diese Formulare. Ohne das könnte ein Skript CAPTCHA und Login-Sperre umgehen. Weil es meist unsichtbar läuft, bleibt die Hürde beim Login klein | 2026-10-06 |
| Schon benutzter und abgelaufener Bestätigungslink führen zur selben Hinweisseite (EC-2) | Der Anmeldedienst kann „schon benutzt“ und „abgelaufen“ nicht unterscheiden. Die gemeinsame Seite bietet beide Auswege: anmelden oder neuen Link anfordern | 2026-10-06 |
| Bestätigungs- und Reset-Mails kommen von max@kopp-beratung.de (Einzelabsender) | Schlank: kein zusätzlicher Mail-Dienst, kein weiteres Konto. Dafür landen die Mails eher im Spam-Ordner | 2026-10-06 |
| Kein CAPTCHA, AC-22 entfällt. Ersetzt beide CAPTCHA-Entscheidungen oben | Das Projekt dient nur der Prüfung durch den Ersteller der Schulungsunterlagen. Zwei zusätzliche Dienstkonten und die Einrichtung stehen dazu in keinem Verhältnis. **Bewusst in Kauf genommenes Risiko:** Ein Skript kann massenhaft Konten anlegen und Mails auslösen. Wer den Anmeldedienst direkt statt über WattWann aufruft, umgeht außerdem die eigene Login-Sperre (AC-10, AC-11). Dann greifen nur die festen Limits von Supabase pro IP-Adresse und das Mail-Limit von 30 pro Stunde. Ein Datenabfluss ist dadurch nicht möglich: RLS (AC-23, AC-24) schützt die Daten weiterhin | 2026-10-06 |
