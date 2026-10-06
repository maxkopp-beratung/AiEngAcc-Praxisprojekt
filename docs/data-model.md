# Datenmodell

> Die app-weite Übersicht, **welche Daten das Produkt speichert und wie sie zusammenhängen** – der gemeinsame Bauplan, an den sich die Tabellen jedes Features halten.
>
> - Erstellt von `/init` (erster Gesamtentwurf: Entitäten + Beziehungen).
> - Verfeinert von `/architecture`, sobald ein Feature entworfen wird.
> - **Flughöhe:** Entitäten, Beziehungen und Eigentum stehen hier (Produktebene, für alle lesbar). Spaltentypen, Indizes und genaue Fremdschlüssel werden pro Feature in dessen `design.md` festgelegt – nicht hier.

## Entitäten

| Entität | Was sie darstellt | Gehört wem / wer sieht sie | Feature |
|---------|-------------------|----------------------------|---------|
| `profiles` | Das Profil zu einem Konto mit optionalem Anzeigenamen. Es wird bei der Registrierung automatisch angelegt und mit dem Supabase-Auth-Nutzer verknüpft; die E-Mail-Adresse bleibt beim Auth-Nutzer. | nur der Nutzer selbst, der es lesen und den Anzeigenamen ändern kann (RLS) | PROJ-1 |
| `login_failures` *(intern)* | Fehlgeschlagene Login-Versuche als Hashes von E-Mail und IP, für die Login-Sperre. Höchstens 15 Minuten gespeichert. | niemand über die App, nur der Server (Service-Rolle) | PROJ-1 |
| `devices` | Ein Gerät des Nutzers mit Name und Laufzeit, z. B. „Waschmaschine, 2:30 h“ | nur der Nutzer selbst, der es lesen, anlegen, ändern und löschen kann (RLS) | PROJ-3 |
| Strompreise *(nicht gespeichert)* | Day-ahead-Preise für heute und morgen im 15-Minuten-Raster (Gebotszone DE-LU). Sie werden live von Energy-Charts geholt und nur im Arbeitsspeicher des Servers zwischengespeichert, höchstens bis zum Ende des Tages. Keine Datenbanktabelle. | öffentlich, aber in der App nur für angemeldete Nutzer abrufbar, für alle gleich | PROJ-2 |
| Startfenster-Empfehlung *(nicht gespeichert)* | Wird bei jedem Aufruf aus Preisen und Gerätelaufzeit neu berechnet | nur für den Nutzer, dem das Gerät gehört | PROJ-3 |

## Beziehungen

- Jeder Auth-Nutzer hat genau ein Profil. Wird der Auth-Nutzer gelöscht (vom Nutzer selbst oder nach 7 Tagen ohne Bestätigung), verschwindet das Profil mit.
- Ein Profil hat beliebig viele Geräte, jedes Gerät gehört genau einem Profil. Wird das Konto gelöscht, verschwinden auch seine Geräte.
- `login_failures` hängt an keinem Konto: Es zählt Versuche pro E-Mail-Adresse, auch für Adressen ohne Konto.
- Strompreise hängen an keinem Nutzer. Sie werden erst bei der Berechnung einer Empfehlung mit der Laufzeit eines Geräts kombiniert.

## Diagramm

```
auth user ── 1:1 ── profiles
                      └─ besitzt viele ─ devices
                                           └─ + Strompreise (live) → Empfehlung (berechnet)
```

---

_Dies ist ein lebendes Dokument. Wenn `/architecture` ein Feature entwirft, das eine Entität einführt oder ändert, aktualisiert es zuerst diese Übersicht, damit spätere Features gegen ein korrektes Bild bauen._
