export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing and using Personal Library ("the Service"), you agree to be bound by these
            Terms of Service and all applicable laws and regulations. If you do not agree with any
            of these terms, you are prohibited from using this Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Description of Service</h2>
          <p className="text-muted-foreground">
            Personal Library provides a personal book management system that allows you to catalog,
            organize, track, and manage your book collection. The Service includes features for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Creating and managing multiple libraries and shelves</li>
            <li>Adding books manually, via ISBN lookup, or image analysis</li>
            <li>Tracking reading status and ratings</li>
            <li>Managing book lending records</li>
            <li>Organizing books with tags and categories</li>
            <li>Exporting library data in multiple formats</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">User Accounts</h2>
          <p className="text-muted-foreground mb-4">
            To use our Service, you must:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Create an account using Google OAuth authentication</li>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Be responsible for all activities that occur under your account</li>
            <li>Notify us immediately of any unauthorized access</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            You are solely responsible for your account and any content you create within the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">User Data and Privacy</h2>
          <p className="text-muted-foreground">
            You retain all rights to the data you enter into Personal Library. We store your data to
            provide the Service and will not share it with third parties without your consent, except
            as required by law. Please review our{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>{' '}
            for detailed information about how we collect, use, and protect your data.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Acceptable Use</h2>
          <p className="text-muted-foreground mb-4">You agree not to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>Attempt to gain unauthorized access to the Service or related systems</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Upload malicious code, viruses, or harmful content</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Use automated tools to scrape or extract data from the Service</li>
            <li>Impersonate another person or entity</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Intellectual Property</h2>
          <p className="text-muted-foreground">
            The Service and its original content, features, and functionality are owned by Personal
            Library and are protected by international copyright, trademark, and other intellectual
            property laws. You may not reproduce, distribute, modify, or create derivative works
            from any part of the Service without explicit permission.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
          <p className="text-muted-foreground">
            The Service may integrate with third-party services including Google OAuth, Google Books API,
            and OpenAI. Your use of these services is subject to their respective terms and conditions.
            We are not responsible for the availability, content, or practices of third-party services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Service Availability</h2>
          <p className="text-muted-foreground">
            We strive to maintain high availability but do not guarantee uninterrupted access to the
            Service. We may temporarily suspend access for maintenance, updates, or technical issues.
            We are not liable for any interruption or loss of access to the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Termination</h2>
          <p className="text-muted-foreground">
            We reserve the right to terminate or suspend your account and access to the Service at
            any time, with or without notice, for violations of these Terms or for any other reason.
            You may delete your account at any time from the settings page. Upon termination, all
            data associated with your account will be permanently deleted.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Disclaimer of Warranties</h2>
          <p className="text-muted-foreground">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
            SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
          <p className="text-muted-foreground">
            TO THE FULLEST EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
            REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL,
            OR OTHER INTANGIBLE LOSSES RESULTING FROM:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
            <li>Your use or inability to use the Service</li>
            <li>Any unauthorized access to or use of our servers and/or any personal information</li>
            <li>Any interruption or cessation of transmission to or from the Service</li>
            <li>Any bugs, viruses, or other harmful code that may be transmitted to or through the Service</li>
            <li>Any errors or omissions in any content or for any loss or damage incurred from using the content</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Indemnification</h2>
          <p className="text-muted-foreground">
            You agree to indemnify, defend, and hold harmless Personal Library and its affiliates from
            any claims, liabilities, damages, losses, and expenses, including reasonable attorney fees,
            arising out of or in any way connected with your access to or use of the Service, your
            violation of these Terms, or your violation of any third-party rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these Terms of Service at any time. We will notify you of
            significant changes by updating the "Last updated" date below. Your continued use of the
            Service after changes are made constitutes acceptance of the new Terms. If you do not
            agree to the modified Terms, you must stop using the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms shall be governed by and construed in accordance with applicable laws,
            without regard to conflict of law principles. Any disputes arising from these Terms
            or the Service shall be resolved through binding arbitration or in courts of competent
            jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Severability</h2>
          <p className="text-muted-foreground">
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            shall be limited or eliminated to the minimum extent necessary, and the remaining provisions
            shall remain in full force and effect.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about these Terms of Service, please contact us at:{' '}
            <span className="font-semibold">legal@bookguardian.app</span>
          </p>
        </section>

        <p className="text-sm text-muted-foreground mt-8 pt-8 border-t border-border">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  )
}
