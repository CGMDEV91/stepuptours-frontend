// app/[langcode]/privacy-policy.tsx
// Privacy Policy legal page

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <PageScrollView>
        <PageBanner icon="shield-checkmark" iconBgColor="#10B981" title={t('legal.privacyPolicy')} />
        <View style={styles.inner}>

          <Text style={styles.lastUpdated}>Last updated: April 2026</Text>

          <Text style={styles.intro}>
            StepUp Tours ("we", "us", or "our") is committed to protecting your personal data and
            your right to privacy. This Privacy Policy describes the information we collect, how we
            use it, who we share it with, and the rights you have under applicable data protection
            law, including the General Data Protection Regulation (GDPR) for users in the European
            Economic Area and the United Kingdom.
          </Text>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Data Controller</Text>
            <Text style={styles.body}>
              StepUp Tours acts as the data controller for the personal data you provide or that we
              collect when you use our platform. For any data protection enquiries, please contact
              us at <Text style={styles.bold}>privacy@stepuptours.com</Text>.
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Data We Collect</Text>
            <Text style={styles.body}>We collect personal data in the following categories:</Text>

            <Text style={styles.subTitle}>Account Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Username and email address (required for registration)</Text>
              <Text style={styles.listItem}>• Password (stored as a one-way cryptographic hash; never in plain text)</Text>
              <Text style={styles.listItem}>• Display name and optional profile details you choose to provide</Text>
              <Text style={styles.listItem}>• Preferred language and country (for personalisation purposes)</Text>
            </View>

            <Text style={styles.subTitle}>Tour Activity Data</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Tours you start, complete, or mark as a favourite</Text>
              <Text style={styles.listItem}>• Steps completed, XP points earned, and ranking position</Text>
              <Text style={styles.listItem}>• Ratings and written reviews you submit for tours</Text>
            </View>

            <Text style={styles.subTitle}>Payment Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Subscription plan details (plan type, billing cycle, renewal date)</Text>
              <Text style={styles.listItem}>• Donation amounts and timestamps</Text>
              <Text style={styles.listItem}>
                • We do not store card numbers, bank account details, or any other raw payment
                credentials. All payment data is processed exclusively by Stripe, Inc., and governed
                by their Privacy Policy.
              </Text>
            </View>

            <Text style={styles.subTitle}>Usage and Technical Data</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Device type, operating system, and browser version</Text>
              <Text style={styles.listItem}>• IP address (used for security, fraud prevention, and access logging)</Text>
              <Text style={styles.listItem}>• Pages and features accessed within the platform</Text>
              <Text style={styles.listItem}>• Error logs and performance data used for service improvement</Text>
            </View>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Legal Basis and Purposes of Processing</Text>
            <Text style={styles.body}>
              We process your personal data only when we have a valid legal basis to do so:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Performance of a contract:</Text> To create and manage
                your account, process payments, and deliver the services you have requested,
                including tour access, step validation, and subscription management.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Legitimate interests:</Text> To improve platform
                quality, detect and prevent fraud and abuse, ensure the security of user accounts,
                and provide technical support — where such interests are not overridden by your
                fundamental rights.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Legal obligation:</Text> To comply with applicable
                laws, including tax, accounting, anti-money-laundering, and anti-fraud regulations.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Consent:</Text> To send you optional communications
                such as newsletters or promotional offers, where you have explicitly opted in.
                You may withdraw consent at any time without affecting the lawfulness of prior
                processing.
              </Text>
            </View>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Data Sharing</Text>
            <Text style={styles.body}>
              We do not sell, rent, or trade your personal data. We may share data with trusted
              third parties strictly as necessary to deliver our services:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Stripe, Inc.:</Text> Payment processing and fraud
                detection. Stripe acts as an independent data controller for payment transactions.
                Their processing is governed by the Stripe Privacy Policy and GDPR Data Processing
                Addendum.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Hosting and infrastructure providers:</Text> To operate
                our servers, databases, and content delivery infrastructure. All providers are
                contractually bound by data processing agreements (DPAs) ensuring GDPR-equivalent
                safeguards.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Legal authorities:</Text> Where required by law, court
                order, or regulatory authority, or where necessary to protect the rights, safety,
                or property of StepUp Tours or its users.
              </Text>
            </View>
            <Text style={styles.body}>
              Public profile data — including your username, XP total, and global ranking position
              — is visible to other platform users by design. You may contact us to request
              restriction of this visibility.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. International Data Transfers</Text>
            <Text style={styles.body}>
              Some of our service providers are located outside the European Economic Area. When we
              transfer personal data to countries that do not benefit from an adequacy decision by
              the European Commission, we ensure appropriate safeguards are in place — such as
              Standard Contractual Clauses (SCCs) approved by the European Commission — or we rely
              on the provider's certification under an equivalent recognised framework.
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Your Rights</Text>
            <Text style={styles.body}>
              Under applicable data protection law (including the GDPR for users in the EEA and UK),
              you have the following rights:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right of access:</Text> Request a copy of the personal
                data we hold about you, including information on how it is processed.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right to rectification:</Text> Ask us to correct
                inaccurate or incomplete personal data without undue delay.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right to erasure:</Text> Request the deletion of your
                personal data ("right to be forgotten"), subject to legal retention obligations.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right to restriction:</Text> Ask us to restrict
                processing in certain circumstances (e.g., while a dispute is under review).
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right to data portability:</Text> Receive your data in
                a structured, commonly used, machine-readable format and transmit it to another
                controller.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right to object:</Text> Object to processing based on
                legitimate interests or carried out for direct marketing purposes at any time.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Right to withdraw consent:</Text> Where processing is
                based on consent, you may withdraw it at any time without affecting the lawfulness
                of processing carried out prior to withdrawal.
              </Text>
            </View>
            <Text style={styles.body}>
              To exercise any of these rights, please contact us at{' '}
              <Text style={styles.bold}>privacy@stepuptours.com</Text>. We will respond within
              30 calendar days. You also have the right to lodge a complaint with your local
              data protection supervisory authority at any time.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Data Retention</Text>
            <Text style={styles.body}>
              We retain personal data for as long as your account remains active or as needed to
              deliver our services. If you delete your account, we will delete or anonymise your
              personal data within 30 calendar days, except where we are required or permitted by
              law to retain it longer (for example, financial and transaction records may be
              retained for up to 7 years to comply with tax and accounting obligations).
            </Text>
          </View>

          {/* Section 8 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Security</Text>
            <Text style={styles.body}>
              We implement appropriate technical and organisational measures to protect your personal
              data against unauthorised access, accidental loss, disclosure, alteration, or
              destruction. These include:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Encrypted connections (HTTPS/TLS 1.2+) for all data in transit</Text>
              <Text style={styles.listItem}>• Passwords stored using industry-standard adaptive hashing (bcrypt)</Text>
              <Text style={styles.listItem}>• Role-based access controls limiting data access to authorised personnel only</Text>
              <Text style={styles.listItem}>• Regular security reviews, dependency audits, and vulnerability assessments</Text>
              <Text style={styles.listItem}>• Anomalous login detection and account protection mechanisms</Text>
            </View>
            <Text style={styles.body}>
              No method of transmission over the internet is 100% secure. We encourage you to use
              a strong, unique password for your account and to report any suspected security
              incident to privacy@stepuptours.com.
            </Text>
          </View>

          {/* Section 9 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
            <Text style={styles.body}>
              StepUp Tours is not directed at children under the age of 16. We do not knowingly
              collect personal data from children. If you believe we have inadvertently collected
              data from a child, please contact us immediately at{' '}
              <Text style={styles.bold}>privacy@stepuptours.com</Text> and we will take prompt
              steps to delete that information.
            </Text>
          </View>

          {/* Section 10 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
            <Text style={styles.body}>
              We may update this Privacy Policy from time to time to reflect changes in our
              practices, technology, or legal obligations. When we make material changes, we will
              update the "Last updated" date at the top of this page and, where required by law,
              notify you directly. Continued use of the platform after changes are posted
              constitutes your acknowledgement of the revised policy.
            </Text>
          </View>

          {/* Section 11 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Contact Us</Text>
            <Text style={styles.body}>
              For any questions, requests, or complaints regarding this Privacy Policy or our data
              processing practices, please contact our Data Protection team:
            </Text>
            <Text style={styles.contactBlock}>
              StepUp Tours — Data Protection{'\n'}
              privacy@stepuptours.com{'\n'}
              https://stepuptours.com
            </Text>
            <Text style={styles.body}>
              You have the right to lodge a complaint with your local data protection supervisory
              authority if you believe we have not handled your personal data lawfully.
            </Text>
          </View>

        </View>
        <Footer />
      </PageScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...webFullHeight,
  },
  inner: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 26,
    marginBottom: 28,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 26,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
  },
  list: {
    gap: 8,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 26,
    paddingLeft: 4,
  },
  contactBlock: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 14,
    fontFamily: 'monospace',
  },
});
