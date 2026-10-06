import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Datenschutz – WattWann" };

// Public privacy notice (AC-26, Art. 13 GDPR). Source of truth for the content: docs/privacy.md.
export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-sm text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Zurück
      </Link>

      <article className="mt-6 space-y-8 text-sm leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Datenschutzhinweise</h1>
          <p className="text-muted-foreground">
            Welche personenbezogenen Daten WattWann verarbeitet, wozu, wie lange und welche Rechte du hast.
          </p>
        </header>

        <section>
          <h2>Verantwortlicher</h2>
          <p>
            Maximilian Kopp (Privatperson). WattWann ist ein privates Lernprojekt.
            <br />
            Kontakt für alle Datenschutzanfragen:{" "}
            <a href="mailto:max@kopp-beratung.de" className="text-primary underline underline-offset-4">
              max@kopp-beratung.de
            </a>
          </p>
        </section>

        <section>
          <h2>Welche Daten wir speichern und wozu</h2>
          <ul>
            <li>
              <strong>Dein Konto:</strong> E-Mail-Adresse, Passwort (nur als Hash, nie im Klartext), dein optionaler
              Anzeigename sowie Zeitpunkte von Registrierung, Bestätigung und letzter Anmeldung. Ohne Konto kann
              WattWann deine Geräte nicht für dich speichern. Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags
              (Art. 6 Abs. 1 lit. b DSGVO).
            </li>
            <li>
              <strong>Deine Geräte:</strong> Name und Laufzeit jedes Geräts, das du anlegst. Damit empfehlen wir
              dir das günstigste Startfenster; die Empfehlung selbst wird bei jedem Aufruf neu berechnet und nicht
              gespeichert. Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).
            </li>
            <li>
              <strong>Schutz vor Passwort-Raten:</strong> Bei einer fehlgeschlagenen Anmeldung speichern wir
              unkenntlich gemachte Prüfwerte (Hashes) deiner E-Mail-Adresse und deiner IP-Adresse, um nach zu vielen
              Fehlversuchen kurz zu sperren. Rechtsgrundlage ist unser berechtigtes Interesse an der Sicherheit der
              Konten (Art. 6 Abs. 1 lit. f DSGVO).
            </li>
            <li>
              <strong>Technisch notwendige Cookies:</strong> für deine Anmeldung, für die Seite „Prüfe dein
              Postfach“ (höchstens 1 Stunde) und zum Zurücksetzen des Passworts (höchstens 1 Stunde). Es gibt keine
              Analyse- oder Werbe-Cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2>Wie lange wir Daten speichern</h2>
          <ul>
            <li>Kontodaten: bis du dein Konto löschst.</li>
            <li>Geräte: bis du das Gerät oder dein Konto löschst.</li>
            <li>Konten, deren E-Mail-Adresse nie bestätigt wurde: werden nach 7 Tagen automatisch gelöscht.</li>
            <li>Prüfwerte fehlgeschlagener Anmeldungen: höchstens 15 Minuten.</li>
          </ul>
        </section>

        <section>
          <h2>Beteiligte Dienste</h2>
          <ul>
            <li>
              <strong>Supabase</strong> (Datenbank und Anmeldung), Server in Frankfurt am Main (Region
              eu-central-1). Vertragspartner ist Supabase Pte. Ltd. (Singapur); für Zugriffe aus Ländern
              außerhalb der EU gelten EU-Standardvertragsklauseln.
            </li>
            <li>
              <strong>Google Workspace</strong> (Versand der Bestätigungs- und Passwort-Mails über das Postfach
              max@kopp-beratung.de). Vertragspartner ist Google Cloud EMEA Ltd. (Irland); der Mutterkonzern
              Google LLC sitzt in den USA (EU-US Data Privacy Framework).
            </li>
          </ul>
        </section>

        <section>
          <h2>Deine Rechte</h2>
          <ul>
            <li>
              <strong>Auskunft und Kopie</strong> deiner Daten (Art. 15 und 20 DSGVO): per E-Mail an
              max@kopp-beratung.de.
            </li>
            <li>
              <strong>Berichtigung</strong> (Art. 16 DSGVO): Deinen Anzeigenamen änderst du selbst im Menü oben
              rechts, deine Geräte im Abschnitt „Meine Geräte“, deine E-Mail-Adresse auf Anfrage per E-Mail.
            </li>
            <li>
              <strong>Löschung</strong> (Art. 17 DSGVO): Einzelne Geräte löschst du selbst im Abschnitt „Meine
              Geräte“. „Konto löschen“ im Menü entfernt dein Konto und alle zugehörigen Daten, auch deine Geräte,
              sofort.
            </li>
            <li>
              <strong>Widerspruch</strong> (Art. 21 DSGVO) gegen den Schutz vor Passwort-Raten: per E-Mail.
            </li>
            <li>
              <strong>Beschwerde</strong> bei einer Datenschutz-Aufsichtsbehörde.
            </li>
          </ul>
          <p className="mt-2">Anfragen beantworten wir innerhalb eines Monats.</p>
        </section>
      </article>
    </main>
  );
}
