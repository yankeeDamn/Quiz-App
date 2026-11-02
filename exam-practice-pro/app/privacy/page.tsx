import { LegalPage, LegalSection } from '@/components/legal/legal-page';
export const metadata = {
  title: 'Privacy Policy',
  description:
    'How ExamPro handles sign-in information, exam history and support enquiries.',
};
export default function Page() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        ExamPro is an independent educational practice platform. This policy
        describes information used when you browse, sign in, take tests and
        contact us.
      </p>
      <LegalSection title="Information we process">
        <p>
          When you sign in with Google or GitHub, we may receive your display
          name, verified email, profile image and provider identifier. Exam
          attempts, responses, scores, bookmarks, notes and plan status may be
          stored to provide the service. Some guest activity, preferences and
          translations may be saved in your browser.
        </p>
      </LegalSection>
      <LegalSection title="Purpose and providers">
        <p>
          We use this information to provide exam practice, authenticate
          accounts, preserve results, protect restricted features and respond to
          enquiries. Hosting providers can include Vercel, Render and Neon
          PostgreSQL. Sign-in providers and WhatsApp operate under their own
          privacy policies.
        </p>
      </LegalSection>
      <LegalSection title="Aggregate analytics and error monitoring">
        <p>
          In production, Vercel Web Analytics may record aggregate page views
          and a limited set of activity events: successful sign-in, mock start,
          mock completion, pricing view and WhatsApp plan requests. Event
          properties are limited to catalogue exam slugs, test identifiers and
          plan names. We do not send your name, email, answers, question text or
          application reference numbers as analytics properties. Page URLs are
          filtered to remove query strings and fragments; authentication and
          private account/admin pages are excluded, and dynamic page identifiers
          are generalized.
        </p>
        <p>
          When configured, Sentry receives technical error reports and a 10%
          sample of performance traces to help us find crashes and slow
          requests. Our filters remove account identity, request bodies,
          cookies, headers, breadcrumbs and arbitrary application context. Error
          messages are withheld; technical error types and limited stack-frame
          locations remain available for diagnosis. We do not enable session
          replay, advertising profiles or screen recording. Network providers
          can still process connection information under their own policies.
        </p>
        <p>
          These measurements are approximate and may be blocked by browser
          settings. A WhatsApp request records a click, not a payment or
          completed conversation. This analytics setup does not identify
          individual returning learners or measure an account-level seven-day
          retention cohort. You can contact us with questions about these
          providers or your data.
        </p>
      </LegalSection>
      <LegalSection title="Sharing and protection">
        <p>
          We share data with infrastructure and authentication providers as
          needed to deliver ExamPro; we do not claim to sell personal
          information. Restricted APIs require authentication and authorization.
          No online service can guarantee absolute security.
        </p>
      </LegalSection>
      <LegalSection title="Retention">
        <p>
          Records are kept while needed to operate the service, resolve support
          enquiries, protect against misuse or satisfy legal obligations.
          Retention may vary depending on the record and applicable law.
        </p>
      </LegalSection>
      <LegalSection title="Your choices">
        <p>
          You may request access to, correction of or deletion of your account
          data through our contact page. We may need to verify your account and
          may need to retain certain records where required by law.
        </p>
      </LegalSection>
      <LegalSection title="Policy updates">
        <p>
          We may update this policy as the service, vendors or payment features
          change. The date above indicates the version currently published.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
