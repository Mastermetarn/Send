import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy | Norum Send",
  description: "Privacy information for the Norum Send application.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <article className="space-y-8 text-gray-700 dark:text-gray-300">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-950 dark:text-white">
            Privacy policy
          </h1>
          <p className="text-sm text-gray-500">Last updated: 9 August 2026</p>
          <p>
            This policy explains how Norum Send processes personal data when you
            create, send, or open a private message link.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Data controller
          </h2>
          <p>
            Adrian Isaksson Norum is the data controller. For privacy questions
            or requests, contact{" "}
            <a
              className="text-blue-700 underline dark:text-blue-400"
              href="mailto:adrian@norum.se"
            >
              adrian@norum.se
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Data we process
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              A random session identifier and timestamps used to operate and
              secure the service.
            </li>
            <li>
              Link identifiers, link settings, creation times, and message
              access or read events.
            </li>
            <li>
              In Ask, messages are encrypted in your browser. The server stores
              only ciphertext, the encrypted message key, encryption metadata,
              and the recipient&apos;s public key. The private key is not sent to
              the server.
            </li>
            <li>
              In Give, the message is stored as readable text on the server
              until it is deleted, consumed, or expires.
            </li>
          </ul>
          <p>
            Message content can contain personal data if a user chooses to
            include it. Do not use Send for sensitive personal data or content
            you are not entitled to share.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Purpose
          </h2>
          <p>
            The data is processed to create and manage message links, deliver
            messages, enforce read limits, prevent misuse, and maintain the
            security and reliability of the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Cookie and local storage
          </h2>
          <p>
            Send uses one necessary cookie named <code>send_session</code>. It
            connects you to links you create so that you can manage them. It is
            HTTP-only, is not used for tracking, and expires after 30 days. Send
            uses no analytics, advertising, or third-party cookies.
          </p>
          <p>
            In Ask, you may actively choose to save the private decryption key in
            your browser&apos;s local storage. The key otherwise stays only in the
            current tab. A saved key remains on that device until you delete the
            link through Send or clear the site&apos;s stored data in your browser.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Retention
          </h2>
          <p>
            Sessions expire after 30 days. Server-stored links, messages,
            encryption metadata, and access or read events are deleted after 30
            days at the latest. They may be deleted earlier when a link is
            manually deleted, replaced, or consumed according to its read
            settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Recipients and international transfers
          </h2>
          <p>
            Data is not sold or used for advertising, profiling, or automated
            decision-making. It is available only to the controller and the
            hosting or infrastructure providers needed to operate the service.
            Hosting and data storage take place within the EU/EEA, and no
            intentional transfer outside the EU/EEA takes place.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            Your rights
          </h2>
          <p>
            Depending on the circumstances, you may request access to,
            correction or deletion of your personal data, restriction of its
            use, object to processing based on legitimate interests, and request
            data portability where applicable. Some data may be difficult to
            identify without the relevant session or link identifier, especially
            encrypted Ask messages.
          </p>
          <p>
            You may also lodge a complaint with the Swedish Authority for
            Privacy Protection (IMY) at{" "}
            <a
              className="text-blue-700 underline dark:text-blue-400"
              href="https://www.imy.se/en/individuals/forms-and-e-services/file-a-gdpr-complaint/"
              rel="noreferrer"
              target="_blank"
            >
              imy.se
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
