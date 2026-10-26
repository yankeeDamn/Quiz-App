import { LegalPage,LegalSection } from '@/components/legal/legal-page';
import {whatsappLink,formatWhatsappNumber} from '@/lib/plans';
export const metadata={title:'Contact and Support',description:'Contact ExamPro about questions, accounts, billing and privacy.'};
export default function Page(){return <LegalPage title="Contact and Support">
 <p>For support with exam questions, account access, paid plans or privacy requests, contact ExamPro via the WhatsApp link below.</p>
 <LegalSection title="WhatsApp support"><p><a href={whatsappLink('Hello ExamPro support. I need help with my account or mock tests.')} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 underline dark:text-indigo-300">Message ExamPro: {formatWhatsappNumber()}</a></p><p>Provide your exam name or payment reference when relevant. Never send a password, OTP or card number.</p></LegalSection>
 <LegalSection title="Question corrections"><p>Include the name of the mock, question number, the suspected error and a source if available. All reports are reviewed before any answer key is changed.</p></LegalSection>
 <LegalSection title="Account and data requests"><p>Use the email connected to your Google or GitHub account so we can verify requests about your personal data.</p></LegalSection>
 </LegalPage>}
