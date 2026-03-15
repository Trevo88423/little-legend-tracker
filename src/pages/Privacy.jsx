import { Link } from 'react-router-dom'
import '../styles/legal.css'

export default function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back">&larr; Back to home</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: March 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Little Legend Tracker ("we", "our", "the app") is a care tracking tool for families
            with medically complex children. We take your privacy seriously — especially when
            it involves your child's health information.
          </p>
        </section>

        <section>
          <h2>Information We Collect</h2>
          <ul>
            <li><strong>Account information:</strong> Email address, display name, and a hashed password (we never store your password in plain text).</li>
            <li><strong>Child information:</strong> Name, date of birth, and care data you choose to log (medications, feeds, weight, notes, and custom tracker entries).</li>
            <li><strong>Usage data:</strong> We do not use analytics, tracking pixels, or third-party advertising tools. We do not track your behaviour.</li>
          </ul>
        </section>

        <section>
          <h2>How We Use Your Data</h2>
          <p>Your data is used solely to provide the care tracking service. Specifically:</p>
          <ul>
            <li>To display and sync care records between family members you've invited via your Family PIN.</li>
            <li>To generate PDF reports you request (processed entirely in your browser — not on our servers).</li>
            <li>To send password reset emails when requested.</li>
          </ul>
          <p><strong>We do not sell, share, or disclose your data to any third party.</strong></p>
        </section>

        <section>
          <h2>Data Storage &amp; Security</h2>
          <ul>
            <li>Data is stored securely on <strong>Supabase</strong> (hosted on AWS infrastructure).</li>
            <li>All data is isolated by family — Row Level Security (RLS) policies ensure no family can access another family's data.</li>
            <li>Family PINs are hashed using bcrypt and cannot be read, even by us.</li>
            <li>All connections use HTTPS/TLS encryption in transit.</li>
          </ul>
        </section>

        <section>
          <h2>Children's Privacy</h2>
          <p>
            This app is designed for <strong>parents and carers</strong> to use on behalf of their children.
            Children do not create accounts or interact with the app directly. All child data is
            entered and managed by authenticated adult family members.
          </p>
        </section>

        <section>
          <h2>Data Sharing Within Families</h2>
          <p>
            When you create a family and share your Family PIN with another person, they can
            join your family and access all care data for your children within that family.
            Only share your PIN with people you trust.
          </p>
        </section>

        <section>
          <h2>Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> all data we hold about you and your family.</li>
            <li><strong>Correct</strong> any inaccurate information via the app.</li>
            <li><strong>Delete</strong> your account and all associated data by contacting us.</li>
            <li><strong>Export</strong> your data via the PDF report feature.</li>
          </ul>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            We use only essential cookies/local storage for authentication (keeping you signed in).
            We do not use advertising cookies, analytics cookies, or any third-party tracking.
          </p>
        </section>

        <section>
          <h2>Medical Disclaimer</h2>
          <p>
            Little Legend Tracker is a <strong>record-keeping tool only</strong>. It does not provide
            medical advice, diagnoses, or treatment recommendations. Always consult your child's
            healthcare team for medical decisions. Medication reminders are provided as a convenience
            and should not replace professional medical guidance.
          </p>
        </section>

        <section>
          <h2>Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. If we make significant changes,
            we will notify users via the app. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For privacy questions, data deletion requests, or concerns, contact us at:{' '}
            <a href="mailto:privacy@littlelegend.care">privacy@littlelegend.care</a>
          </p>
        </section>
      </div>
    </div>
  )
}
