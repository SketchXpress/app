import Link from "next/link";
import type { Metadata } from "next";
import { ScrollText, ArrowLeft, ExternalLink } from "lucide-react";

import { generateTermsMetadata } from "./metadata";

import styles from "./page.module.scss";

export const metadata: Metadata = generateTermsMetadata();

const TermsPage = () => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.breadcrumb}>
            <Link href="/" className={styles.backButton}>
              <ArrowLeft size={16} />
              <span>Back to SketchXpress</span>
            </Link>
          </div>

          <div className={styles.titleSection}>
            <div className={styles.iconContainer}>
              <ScrollText className={styles.icon} />
            </div>
            <h1 className={styles.title}>Terms and Conditions</h1>
            <p className={styles.subtitle}>
              Last Updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </header>

        {/* Terms Content */}
        <article className={styles.termsContent}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              1. Introduction and Acceptance
            </h2>
            <p className={styles.text}>
              Welcome to SketchXpress (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;), a platform that enables users to create sketches,
              enhance them using artificial intelligence, and mint them as
              Non-Fungible Tokens (NFTs) on the Solana blockchain. These Terms
              and Conditions (&quot;Terms&quot;) govern your use of our website,
              services, and platform (collectively, the &quot;Service&quot;).
            </p>
            <p className={styles.text}>
              By accessing or using SketchXpress, you agree to be bound by these
              Terms. If you disagree with any part of these Terms, you may not
              access or use our Service.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              2. Eligibility and Age Requirements
            </h2>

            <h3 className={styles.subsectionTitle}>
              2.1 General Age Requirement
            </h3>
            <p className={styles.text}>
              You must be at least 13 years old to use SketchXpress. By using
              our Service, you represent and warrant that you meet this age
              requirement.
            </p>

            <h3 className={styles.subsectionTitle}>
              2.2 Age-Specific Restrictions
            </h3>
            <ul className={styles.list}>
              <li>
                <strong>Users under 18:</strong> You may only use Kids Mode,
                which includes additional content filtering and parental
                controls. NFT minting requires parental consent.
              </li>
              <li>
                <strong>Users 18+:</strong> You may access all features,
                including Professional Mode and unrestricted content creation.
              </li>
            </ul>

            <h3 className={styles.subsectionTitle}>2.3 Parental Consent</h3>
            <p className={styles.text}>If you are under 18:</p>
            <ul className={styles.list}>
              <li>
                You must have your parent or guardian&apos;s permission to use
                SketchXpress
              </li>
              <li>
                Your parent or guardian must approve any NFT minting
                transactions
              </li>
              <li>
                All blockchain transactions require adult supervision and
                consent
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              3. Account Registration and Security
            </h2>

            <h3 className={styles.subsectionTitle}>3.1 Wallet Connection</h3>
            <p className={styles.text}>
              SketchXpress integrates with Solana wallet providers. You are
              responsible for:
            </p>
            <ul className={styles.list}>
              <li>Maintaining the security of your wallet credentials</li>
              <li>All transactions made from your connected wallet</li>
              <li>Any losses resulting from compromised wallet security</li>
            </ul>

            <h3 className={styles.subsectionTitle}>
              3.2 Account Responsibility
            </h3>
            <p className={styles.text}>You agree to:</p>
            <ul className={styles.list}>
              <li>Provide accurate information when required</li>
              <li>Maintain the confidentiality of your account</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>
                Accept responsibility for all activities under your account
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Service Description</h2>

            <h3 className={styles.subsectionTitle}>4.1 Core Services</h3>
            <p className={styles.text}>SketchXpress provides:</p>
            <ul className={styles.list}>
              <li>Digital drawing canvas and tools</li>
              <li>AI-powered image enhancement</li>
              <li>NFT minting on the Solana blockchain</li>
              <li>MintStreet marketplace for trading NFTs</li>
              <li>Bonding curve economics for fair pricing</li>
            </ul>

            <h3 className={styles.subsectionTitle}>4.2 Service Availability</h3>
            <p className={styles.text}>
              We strive to maintain Service availability but do not guarantee
              uninterrupted access. We reserve the right to modify, suspend, or
              discontinue any aspect of the Service with or without notice.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              5. Content Guidelines and Restrictions
            </h2>

            <h3 className={styles.subsectionTitle}>5.1 Prohibited Content</h3>
            <p className={styles.text}>
              You agree not to create, upload, or mint content that:
            </p>
            <ul className={styles.list}>
              <li>Violates any laws or regulations</li>
              <li>Infringes third-party intellectual property rights</li>
              <li>Contains explicit sexual content or nudity</li>
              <li>Promotes violence, hatred, or discrimination</li>
              <li>Includes defamatory or harassing material</li>
              <li>Contains malware or harmful code</li>
              <li>Violates platform-specific guidelines</li>
            </ul>

            <h3 className={styles.subsectionTitle}>
              5.2 Kids Mode Content Filtering
            </h3>
            <p className={styles.text}>In Kids Mode:</p>
            <ul className={styles.list}>
              <li>AI enhancement includes additional content filtering</li>
              <li>Inappropriate prompts are automatically blocked</li>
              <li>Only age-appropriate enhancements are permitted</li>
              <li>Enhanced monitoring prevents 18+ content generation</li>
            </ul>

            <h3 className={styles.subsectionTitle}>5.3 Content Moderation</h3>
            <p className={styles.text}>We reserve the right to:</p>
            <ul className={styles.list}>
              <li>Review and moderate all content</li>
              <li>Remove content that violates these Terms</li>
              <li>Suspend accounts for repeated violations</li>
              <li>Report illegal content to authorities</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              6. Intellectual Property Rights
            </h2>

            <h3 className={styles.subsectionTitle}>6.1 Your Content</h3>
            <p className={styles.text}>
              You retain ownership of your original sketches and creations. By
              using our Service, you grant us a limited license to:
            </p>
            <ul className={styles.list}>
              <li>Process your content for AI enhancement</li>
              <li>Display your content on the platform</li>
              <li>Store your content on IPFS networks</li>
              <li>Enable NFT minting and trading</li>
            </ul>

            <h3 className={styles.subsectionTitle}>6.2 AI-Enhanced Content</h3>
            <p className={styles.text}>
              When you enhance content using our AI:
            </p>
            <ul className={styles.list}>
              <li>You retain rights to the enhanced version</li>
              <li>The enhancement is considered a derivative work</li>
              <li>
                You&apos;re responsible for ensuring you have rights to the
                original content
              </li>
              <li>Enhanced content must comply with all applicable laws</li>
            </ul>

            <h3 className={styles.subsectionTitle}>
              6.3 Platform Intellectual Property
            </h3>
            <p className={styles.text}>
              All platform technology, designs, and features remain our
              intellectual property. You may not:
            </p>
            <ul className={styles.list}>
              <li>Reverse engineer our software</li>
              <li>Copy our proprietary algorithms</li>
              <li>Use our trademarks without permission</li>
              <li>Create derivative platforms without authorization</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. NFT and Blockchain Terms</h2>

            <h3 className={styles.subsectionTitle}>7.1 NFT Minting</h3>
            <p className={styles.text}>When minting NFTs:</p>
            <ul className={styles.list}>
              <li>You pay applicable gas fees and minting costs</li>
              <li>All blockchain transactions are irreversible</li>
              <li>We do not control the blockchain or NFT standards</li>
              <li>
                Success depends on network conditions and wallet connectivity
              </li>
            </ul>

            <h3 className={styles.subsectionTitle}>7.2 Blockchain Risks</h3>
            <p className={styles.text}>You acknowledge:</p>
            <ul className={styles.list}>
              <li>Blockchain technology is experimental and evolving</li>
              <li>Transactions may fail due to network issues</li>
              <li>Gas fees can fluctuate significantly</li>
              <li>Smart contracts may contain unforeseen risks</li>
              <li>Value of NFTs can vary dramatically</li>
            </ul>

            <h3 className={styles.subsectionTitle}>
              7.3 MintStreet Marketplace
            </h3>
            <p className={styles.text}>Using our marketplace:</p>
            <ul className={styles.list}>
              <li>Trading occurs via smart contracts</li>
              <li>We facilitate but don&apos;t guarantee trades</li>
              <li>Bonding curve mechanics determine pricing</li>
              <li>Users bear all trading risks</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Financial Terms</h2>

            <h3 className={styles.subsectionTitle}>8.1 Fees and Payments</h3>
            <ul className={styles.list}>
              <li>AI enhancement may require credits or fees</li>
              <li>NFT minting incurs gas fees paid to the blockchain</li>
              <li>Platform fees may apply to certain features</li>
              <li>All payments are in cryptocurrency</li>
            </ul>

            <h3 className={styles.subsectionTitle}>8.2 No Refunds</h3>
            <p className={styles.text}>
              Due to the nature of blockchain transactions:
            </p>
            <ul className={styles.list}>
              <li>All payments are generally non-refundable</li>
              <li>Failed transactions may result in lost gas fees</li>
              <li>Technical issues don&apos;t guarantee compensation</li>
              <li>Users bear all financial risks</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              9. Privacy and Data Protection
            </h2>

            <h3 className={styles.subsectionTitle}>9.1 Data Collection</h3>
            <p className={styles.text}>We collect:</p>
            <ul className={styles.list}>
              <li>Drawing data for AI enhancement</li>
              <li>Wallet addresses for transactions</li>
              <li>Usage statistics for improvement</li>
              <li>Content metadata for IPFS storage</li>
            </ul>

            <h3 className={styles.subsectionTitle}>9.2 Data Use</h3>
            <p className={styles.text}>Your data is used to:</p>
            <ul className={styles.list}>
              <li>Provide and improve services</li>
              <li>Enable AI enhancement features</li>
              <li>Facilitate NFT minting and trading</li>
              <li>Comply with legal requirements</li>
            </ul>

            <h3 className={styles.subsectionTitle}>9.3 Third-Party Services</h3>
            <p className={styles.text}>We integrate with:</p>
            <ul className={styles.list}>
              <li>Solana blockchain network</li>
              <li>IPFS storage providers (Pinata)</li>
              <li>AI enhancement services</li>
              <li>Wallet provider software</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              10. Disclaimers and Limitation of Liability
            </h2>

            <h3 className={styles.subsectionTitle}>10.1 Service Disclaimer</h3>
            <p className={styles.text}>
              SketchXpress is provided &quot;as is&quot; without warranties of
              any kind. We specifically disclaim:
            </p>
            <ul className={styles.list}>
              <li>Merchantability and fitness for purpose</li>
              <li>Uninterrupted or error-free operation</li>
              <li>Accuracy of AI enhancements</li>
              <li>Success of blockchain transactions</li>
              <li>Value or marketability of NFTs</li>
            </ul>

            <h3 className={styles.subsectionTitle}>
              10.2 Limitation of Liability
            </h3>
            <p className={styles.text}>
              To the maximum extent permitted by law:
            </p>
            <ul className={styles.list}>
              <li>
                Our liability is limited to the amount you paid for services
              </li>
              <li>
                We&apos;re not liable for indirect, incidental, or consequential
                damages
              </li>
              <li>Force majeure events absolve us of responsibility</li>
              <li>Your use of the Service is at your own risk</li>
            </ul>

            <h3 className={styles.subsectionTitle}>10.3 Risk Acknowledgment</h3>
            <p className={styles.text}>You acknowledge and accept:</p>
            <ul className={styles.list}>
              <li>Blockchain technology risks</li>
              <li>Potential loss of funds or NFTs</li>
              <li>Market volatility of digital assets</li>
              <li>Technical failures beyond our control</li>
              <li>Regulatory uncertainty in blockchain space</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>11. Indemnification</h2>
            <p className={styles.text}>
              You agree to indemnify and hold harmless SketchXpress, its
              affiliates, officers, directors, employees, and agents from any
              claims, damages, liabilities, costs, and expenses arising from:
            </p>
            <ul className={styles.list}>
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your content and NFTs</li>
              <li>Your blockchain transactions</li>
              <li>Any third-party claims related to your activities</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>12. Termination</h2>

            <h3 className={styles.subsectionTitle}>12.1 Termination Rights</h3>
            <p className={styles.text}>
              We may terminate or suspend your access:
            </p>
            <ul className={styles.list}>
              <li>For violation of these Terms</li>
              <li>If required by law</li>
              <li>To protect platform integrity</li>
              <li>At our sole discretion</li>
            </ul>

            <h3 className={styles.subsectionTitle}>
              12.2 Effect of Termination
            </h3>
            <p className={styles.text}>Upon termination:</p>
            <ul className={styles.list}>
              <li>Your account access ends immediately</li>
              <li>Existing NFTs remain on the blockchain</li>
              <li>No refunds are provided</li>
              <li>Certain provisions survive termination</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>13. Dispute Resolution</h2>

            <h3 className={styles.subsectionTitle}>13.1 Governing Law</h3>
            <p className={styles.text}>
              These Terms are governed by the laws of [Jurisdiction], without
              regard to conflict of law principles.
            </p>

            <h3 className={styles.subsectionTitle}>13.2 Arbitration</h3>
            <p className={styles.text}>
              Any disputes will be resolved through binding arbitration, except:
            </p>
            <ul className={styles.list}>
              <li>Claims for injunctive relief</li>
              <li>Violations of intellectual property rights</li>
              <li>Small claims court matters</li>
            </ul>

            <h3 className={styles.subsectionTitle}>13.3 Forum Selection</h3>
            <p className={styles.text}>
              Any legal proceedings must be filed in the courts of
              [Jurisdiction], and you consent to personal jurisdiction there.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>14. Modifications</h2>

            <h3 className={styles.subsectionTitle}>14.1 Changes to Terms</h3>
            <p className={styles.text}>
              We may modify these Terms at any time. Changes will be posted with
              updated dates. Continued use constitutes acceptance of
              modifications.
            </p>

            <h3 className={styles.subsectionTitle}>14.2 Feature Changes</h3>
            <p className={styles.text}>We may:</p>
            <ul className={styles.list}>
              <li>Add or remove features</li>
              <li>Change pricing structures</li>
              <li>Modify platform mechanics</li>
              <li>Update content policies</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              15. Compliance and Regulatory
            </h2>

            <h3 className={styles.subsectionTitle}>15.1 Legal Compliance</h3>
            <p className={styles.text}>
              You agree to comply with all applicable laws, including:
            </p>
            <ul className={styles.list}>
              <li>Local copyright and intellectual property laws</li>
              <li>Export control regulations</li>
              <li>Anti-money laundering (AML) requirements</li>
              <li>Tax obligations</li>
              <li>Data protection regulations</li>
            </ul>

            <h3 className={styles.subsectionTitle}>15.2 Regulatory Changes</h3>
            <p className={styles.text}>As blockchain regulation evolves:</p>
            <ul className={styles.list}>
              <li>We may need to modify services</li>
              <li>Some features might become unavailable</li>
              <li>Users may need to verify identity</li>
              <li>Compliance costs may increase</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>16. Contact Information</h2>
            <p className={styles.text}>
              For questions about these Terms or our Service:
            </p>
            <div className={styles.contactInfo}>
              <p>
                <strong>Email:</strong> ashishregmi2017@gmail.com
              </p>
              <p>
                <strong>Support:</strong> lakpasherpa948@gmail.com
              </p>
              <p>
                <strong>Address:</strong> Waterloo, Canada
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>17. Severability</h2>
            <p className={styles.text}>
              If any provision of these Terms is found invalid or unenforceable,
              the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>18. Acknowledgment</h2>
            <p className={styles.text}>
              By using SketchXpress, you acknowledge that you have read,
              understood, and agree to be bound by these Terms and Conditions.
            </p>
          </section>
        </article>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerDivider}></div>
          <div className={styles.footerContent}>
            <div className={styles.footerText}>
              <p>
                <strong>SketchXpress Team</strong>
              </p>
              <p>
                <em>Where creativity meets blockchain</em>
              </p>
            </div>
            <div className={styles.footerActions}>
              <Link href="/" className={styles.footerButton}>
                <ArrowLeft size={16} />
                Return to App
              </Link>
              <a
                href="mailto:legal@sketchxpress.tech"
                className={styles.footerButton}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} />
                Contact Legal
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default TermsPage;
