import { Link } from 'react-router-dom'
import '../styles/legal.css'

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back">&larr; Back to home</Link>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: March 2026</p>

        <section>
          <h2>Acceptance of Terms</h2>
          <p>
            By creating an account or using Little Legend Tracker ("the app"), you agree
            to these Terms of Service and our Privacy Policy.
          </p>
        </section>

        <section>
          <h2>Description of Service</h2>
          <p>
            Little Legend Tracker is a free care tracking tool that helps families log
            medications, feeds, weight, and other care information for medically complex children.
            The service is provided "as is" without warranty.
          </p>
        </section>

        <section>
          <h2>Account Responsibilities</h2>
          <ul>
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You are responsible for who you share your Family PIN with — anyone with your PIN can join your family and access your child's care data.</li>
            <li>You must be at least 18 years old to create an account.</li>
          </ul>
        </section>

        <section>
          <h2>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the app for any unlawful purpose.</li>
            <li>Attempt to access another family's data.</li>
            <li>Reverse engineer or attempt to extract the source code of the app.</li>
            <li>Use automated tools to scrape or interact with the service.</li>
          </ul>
        </section>

        <section>
          <h2>Medical Disclaimer</h2>
          <p>
            <strong>Little Legend Tracker is not a medical device.</strong> It is a record-keeping
            and organisational tool only. It does not provide medical advice, diagnoses, or
            treatment recommendations.
          </p>
          <p>
            Medication reminders and schedules are entered by you and are your responsibility
            to verify for accuracy. Always follow your healthcare team's instructions.
            Do not rely solely on this app for critical medication timing.
          </p>
        </section>

        <section>
          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Little Legend Tracker and its creators
            shall not be liable for any direct, indirect, incidental, or consequential damages
            arising from your use of the app, including but not limited to:
          </p>
          <ul>
            <li>Missed or incorrect medication doses.</li>
            <li>Data loss or service interruptions.</li>
            <li>Reliance on information displayed in the app.</li>
          </ul>
          <p>
            You acknowledge that this is a free tool built by parents and is not a
            certified medical application.
          </p>
        </section>

        <section>
          <h2>Data &amp; Privacy</h2>
          <p>
            Your use of the app is also governed by our{' '}
            <Link to="/privacy">Privacy Policy</Link>, which describes how we collect,
            use, and protect your data.
          </p>
        </section>

        <section>
          <h2>Service Availability</h2>
          <p>
            We aim to keep the app available at all times but cannot guarantee uninterrupted
            service. We reserve the right to modify or discontinue the service at any time,
            with reasonable notice where possible.
          </p>
        </section>

        <section>
          <h2>Termination</h2>
          <p>
            You may delete your account at any time by contacting us. We may terminate
            accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2>Governing Law</h2>
          <p>
            These terms are governed by the laws of New South Wales, Australia.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For questions about these terms, contact us at:{' '}
            <a href="mailto:hello@littlelegendtracker.com">hello@littlelegendtracker.com</a>
          </p>
        </section>
      </div>
    </div>
  )
}
