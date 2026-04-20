// app/[langcode]/terms-of-use.tsx
// Terms of Use legal page

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';

export default function TermsOfUseScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <PageScrollView>
        <PageBanner icon="document-lock-outline" iconBgColor="#3B82F6" title={t('legal.termsOfUse')} />
        <View style={styles.inner}>

          <Text style={styles.lastUpdated}>Last updated: April 2026</Text>

          <Text style={styles.intro}>
            These Terms of Use ("Terms") govern your access to and use of the StepUp Tours platform,
            including our mobile application and website (collectively, the "Service"). By creating
            an account or using the Service in any way, you agree to be bound by these Terms. If you
            do not agree, please do not use the Service.
          </Text>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. About StepUp Tours</Text>
            <Text style={styles.body}>
              StepUp Tours is a gamified self-guided tour platform that enables users to discover
              cities and cultural landmarks by following curated routes. Users earn experience points
              (XP) by completing steps along a route, climbing a global ranking and unlocking
              achievements. Professional guides ("Tour Creators") may publish and monetise tours
              through subscription plans and voluntary user donations.
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Eligibility</Text>
            <Text style={styles.body}>
              You must be at least 16 years of age to create an account and use the Service. By
              registering, you represent and warrant that:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• You are at least 16 years old;</Text>
              <Text style={styles.listItem}>• You have the legal capacity to enter into a binding agreement;</Text>
              <Text style={styles.listItem}>
                • The information you provide during registration is accurate, current, and complete;
              </Text>
              <Text style={styles.listItem}>
                • You are not prohibited from using the Service under any applicable law.
              </Text>
            </View>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. User Accounts</Text>
            <Text style={styles.body}>
              To access most features of the Service, you must register for an account. You are
              responsible for:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • Keeping your login credentials confidential and not sharing them with any third
                party;
              </Text>
              <Text style={styles.listItem}>
                • All activity that occurs under your account, whether or not authorised by you;
              </Text>
              <Text style={styles.listItem}>
                • Notifying us immediately at{' '}
                <Text style={styles.bold}>support@stepuptours.com</Text> if you suspect
                unauthorised access to your account.
              </Text>
            </View>
            <Text style={styles.body}>
              We reserve the right to suspend or terminate accounts that we believe to be
              compromised, fraudulent, or in violation of these Terms.
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Acceptable Use</Text>
            <Text style={styles.body}>
              You agree to use the Service only for lawful purposes and in accordance with these
              Terms. You must not:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • Use the Service in any manner that violates any applicable local, national, or
                international law or regulation;
              </Text>
              <Text style={styles.listItem}>
                • Attempt to gain unauthorised access to any part of the Service, its servers, or
                any system or network connected to the Service;
              </Text>
              <Text style={styles.listItem}>
                • Use automated tools (bots, scrapers, crawlers) to access or extract content from
                the Service without prior written authorisation;
              </Text>
              <Text style={styles.listItem}>
                • Submit false, misleading, or fraudulent tour completions, QR code scans, or
                challenge answers to manipulate XP or ranking data;
              </Text>
              <Text style={styles.listItem}>
                • Upload, post, or transmit content that is defamatory, obscene, hateful,
                discriminatory, or otherwise objectionable;
              </Text>
              <Text style={styles.listItem}>
                • Impersonate any person or entity, or misrepresent your affiliation with any
                person or entity;
              </Text>
              <Text style={styles.listItem}>
                • Interfere with or disrupt the integrity or performance of the Service or the
                servers and networks that host it.
              </Text>
            </View>
            <Text style={styles.body}>
              Violation of these rules may result in immediate suspension or permanent termination
              of your account, at our sole discretion, without prior notice.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Subscriptions and Payments</Text>

            <Text style={styles.subTitle}>Subscription Plans</Text>
            <Text style={styles.body}>
              Tour Creators may subscribe to a paid plan to unlock additional features such as
              publishing multiple tours, featuring businesses at tour stops, and offering multi-language
              content. Subscription fees and features are as displayed in the application and may be
              updated from time to time with reasonable notice.
            </Text>

            <Text style={styles.subTitle}>Billing and Renewal</Text>
            <Text style={styles.body}>
              Subscriptions are billed on a recurring basis (monthly or annually) unless cancelled
              before the renewal date. By subscribing, you authorise us to charge your chosen payment
              method at the start of each billing period. You may cancel auto-renewal at any time
              through your dashboard; cancellation takes effect at the end of the current billing
              period and no refund is issued for the remaining period.
            </Text>

            <Text style={styles.subTitle}>Payment Processing</Text>
            <Text style={styles.body}>
              All payments are processed by Stripe, Inc. We do not store your payment card details.
              By making a payment, you also agree to Stripe's Terms of Service and Privacy Policy.
            </Text>

            <Text style={styles.subTitle}>Donations</Text>
            <Text style={styles.body}>
              Users may voluntarily donate to tour guides upon completing a tour. Donations are
              non-refundable and are distributed to the guide according to the revenue split
              configured by the platform administrator.
            </Text>

            <Text style={styles.subTitle}>Taxes</Text>
            <Text style={styles.body}>
              All listed prices are exclusive of applicable taxes unless stated otherwise. You are
              responsible for any taxes applicable to your purchase in your jurisdiction.
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. User-Generated Content</Text>
            <Text style={styles.body}>
              Certain features allow you to submit content, including tour reviews, ratings, and
              (for Tour Creators) tour descriptions, step content, and media ("User Content"). By
              submitting User Content, you:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • Grant StepUp Tours a non-exclusive, worldwide, royalty-free, sub-licensable licence
                to use, reproduce, display, and distribute your User Content solely in connection
                with operating and improving the Service;
              </Text>
              <Text style={styles.listItem}>
                • Represent and warrant that you own or have the necessary rights to the content you
                submit, and that it does not infringe the intellectual property or other rights of
                any third party;
              </Text>
              <Text style={styles.listItem}>
                • Understand that you remain solely responsible for your User Content.
              </Text>
            </View>
            <Text style={styles.body}>
              We reserve the right to remove any User Content that violates these Terms or that we
              consider harmful, misleading, or otherwise inappropriate, without notice.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
            <Text style={styles.body}>
              All content provided by StepUp Tours — including the application software, design,
              graphics, logos, text, and gamification mechanics — is the exclusive property of
              StepUp Tours or its licensors and is protected by applicable intellectual property
              laws. Nothing in these Terms grants you any right, title, or interest in any StepUp
              Tours intellectual property other than the limited licence to use the Service as
              expressly set out herein.
            </Text>
            <Text style={styles.body}>
              You may not reproduce, distribute, modify, create derivative works from, publicly
              display, or commercially exploit any content belonging to StepUp Tours without our
              prior written consent.
            </Text>
          </View>

          {/* Section 8 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Third-Party Services and Links</Text>
            <Text style={styles.body}>
              The Service may integrate with or contain links to third-party services (for example,
              mapping providers, Stripe for payments, or Google for social sign-in). These services
              are governed by their own terms and privacy policies. We are not responsible for the
              content, practices, or policies of any third-party service, and your use of such
              services is at your own risk.
            </Text>
          </View>

          {/* Section 9 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Disclaimer of Warranties</Text>
            <Text style={styles.body}>
              The Service is provided on an "as is" and "as available" basis, without warranties of
              any kind, either express or implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement.
            </Text>
            <Text style={styles.body}>
              We do not warrant that:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• The Service will be uninterrupted, error-free, or free of harmful components;</Text>
              <Text style={styles.listItem}>• Information provided within the Service (including tour content) is accurate, complete, or current;</Text>
              <Text style={styles.listItem}>• The Service will meet your specific requirements.</Text>
            </View>
            <Text style={styles.body}>
              Tour content — including descriptions, directions, and points of interest — is
              provided for informational and entertainment purposes only. You are responsible for
              your own safety while following a tour route.
            </Text>
          </View>

          {/* Section 10 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
            <Text style={styles.body}>
              To the maximum extent permitted by applicable law, StepUp Tours and its officers,
              directors, employees, and agents shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages — including loss of profits, data,
              goodwill, or other intangible losses — arising out of or in connection with:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Your access to or use of (or inability to access or use) the Service;</Text>
              <Text style={styles.listItem}>• Any conduct or content of any third party on the Service;</Text>
              <Text style={styles.listItem}>• Any User Content submitted through the Service;</Text>
              <Text style={styles.listItem}>• Unauthorised access, use, or alteration of your account or content.</Text>
            </View>
            <Text style={styles.body}>
              In jurisdictions that do not allow the exclusion or limitation of liability for
              consequential or incidental damages, the above limitation may not apply to you.
            </Text>
          </View>

          {/* Section 11 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>11. Termination</Text>
            <Text style={styles.body}>
              You may delete your account at any time through your profile settings or by contacting
              us at <Text style={styles.bold}>support@stepuptours.com</Text>. Upon deletion, your
              personal data will be handled in accordance with our Privacy Policy.
            </Text>
            <Text style={styles.body}>
              We reserve the right to suspend or permanently terminate your access to the Service
              at our sole discretion, without notice or liability, if we believe you have violated
              these Terms, engaged in fraudulent activity, or if required to do so by law. Any active
              subscription fees paid for the current period are non-refundable upon termination for
              cause.
            </Text>
          </View>

          {/* Section 12 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>12. Changes to These Terms</Text>
            <Text style={styles.body}>
              We may update these Terms from time to time. When we make material changes, we will
              update the "Last updated" date at the top of this page and, where appropriate, notify
              you through the platform or by email. Your continued use of the Service after changes
              are posted constitutes your acceptance of the revised Terms. If you do not agree to
              the revised Terms, you must stop using the Service and may delete your account.
            </Text>
          </View>

          {/* Section 13 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>13. Governing Law and Dispute Resolution</Text>
            <Text style={styles.body}>
              These Terms are governed by and construed in accordance with the laws of the European
              Union and the applicable national law of the jurisdiction in which StepUp Tours
              operates, without regard to conflict of law principles. Any dispute arising from or
              relating to these Terms or the Service that cannot be resolved amicably shall be
              submitted to the exclusive jurisdiction of the competent courts of that jurisdiction.
            </Text>
            <Text style={styles.body}>
              If you are a consumer in the European Union, you may also use the EU Online Dispute
              Resolution (ODR) platform at https://ec.europa.eu/consumers/odr/ to resolve disputes
              out of court.
            </Text>
          </View>

          {/* Section 14 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>14. Contact Us</Text>
            <Text style={styles.body}>
              For any questions or concerns regarding these Terms of Use, please contact us:
            </Text>
            <Text style={styles.contactBlock}>
              StepUp Tours — Legal Team{'\n'}
              legal@stepuptours.com{'\n'}
              https://stepuptours.com
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
