export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p className="text-muted-foreground">
            Personal Library ("we", "our", or "us") respects your privacy and is committed to protecting your personal data.
            This privacy policy explains how we collect, use, and safeguard your information when you use our service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          <p className="text-muted-foreground mb-4">
            When you sign in with Google OAuth, we collect:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Your email address</li>
            <li>Your name</li>
            <li>Your profile picture (optional)</li>
            <li>Google account ID for authentication purposes</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            We also collect information you voluntarily provide, including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Book information (titles, authors, ISBNs, ratings, comments)</li>
            <li>Library and shelf organization data</li>
            <li>Tags and categories you create</li>
            <li>Lending records</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
          <p className="text-muted-foreground mb-4">We use your information to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Authenticate your account and maintain your session</li>
            <li>Provide and maintain our service</li>
            <li>Associate your library data with your account</li>
            <li>Enable multi-user support with data isolation</li>
            <li>Communicate with you about service updates (if necessary)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Storage and Security</h2>
          <p className="text-muted-foreground">
            Your data is stored securely in a PostgreSQL database with industry-standard security measures.
            We use NextAuth.js for authentication with database sessions for enhanced security.
            Your library data is private and only accessible to you. We implement data isolation
            to ensure that users cannot access each other's information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
          <p className="text-muted-foreground mb-4">
            We use Google OAuth for authentication. When you sign in with Google, you are subject to
            Google's Privacy Policy and Terms of Service. We recommend reviewing these documents:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Google Privacy Policy
              </a>
            </li>
            <li>
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Google Terms of Service
              </a>
            </li>
          </ul>
          <p className="text-muted-foreground mt-4">
            We may also use optional third-party services like OpenAI for image analysis and Google Books API
            for book information lookup. Use of these features is optional.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
          <p className="text-muted-foreground mb-4">You have the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account and associated data</li>
            <li>Export your library data in various formats (CSV, JSON, MARC21)</li>
            <li>Withdraw consent and revoke access to your Google account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
          <p className="text-muted-foreground">
            We retain your data for as long as your account is active. If you delete your account,
            all associated data (libraries, books, shelves, tags, and lending records) will be
            permanently deleted from our database through cascade deletion.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Cookies and Sessions</h2>
          <p className="text-muted-foreground">
            We use cookies to maintain your session and keep you logged in. These are essential
            for the service to function and are not used for tracking or advertising purposes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this privacy policy from time to time. We will notify you of any significant
            changes by updating the "Last updated" date below. Continued use of the service after
            changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy or wish to exercise your data rights,
            please contact us at: <span className="font-semibold">[your-personal-email]</span>
          </p>
          <p className="text-muted-foreground mt-2 text-sm italic">
            Note: Replace [your-personal-email] with your actual email address before deploying to production.
          </p>
        </section>

        <p className="text-sm text-muted-foreground mt-8 pt-8 border-t border-border">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
