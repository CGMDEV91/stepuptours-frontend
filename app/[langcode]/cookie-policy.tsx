// app/[langcode]/cookie-policy.tsx
// Cookie Policy legal page

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';

export default function CookiePolicyScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <PageScrollView>
        <PageBanner icon="document-text" iconBgColor="#6366F1" title={t('legal.cookiePolicy')} />
        <View style={styles.inner}>

          <Text style={styles.lastUpdated}>Last updated: April 2026</Text>

          <Text style={styles.intro}>
            This Cookie Policy explains what cookies are, which ones StepUp Tours uses, and how you
            can control them. It should be read alongside our Privacy Policy, which describes how
            we handle personal data more broadly. By continuing to use our platform, you acknowledge
            this policy.
          </Text>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. What Are Cookies?</Text>
            <Text style={styles.body}>
              Cookies are small text files placed on your device when you visit a website or use a
              web application. They allow the platform to remember information about your visit —
              such as your login session or language preference — making your experience more
              efficient and personalised.
            </Text>
            <Text style={styles.body}>
              Cookies may be set by the platform itself (<Text style={styles.bold}>first-party cookies</Text>)
              or by third-party services we use (<Text style={styles.bold}>third-party cookies</Text>).
              They may be <Text style={styles.bold}>session cookies</Text> (deleted when you close
              your browser) or <Text style={styles.bold}>persistent cookies</Text> (retained on your
              device for a defined period).
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Why We Use Cookies</Text>
            <Text style={styles.body}>
              StepUp Tours uses cookies and similar storage technologies for the following purposes:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Authentication:</Text> To keep you signed in across
                pages and sessions so you do not need to log in repeatedly.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Preferences:</Text> To remember your chosen language
                and other interface settings so the platform appears as you prefer.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Tour progress:</Text> To track completed steps and
                tour state so you can resume where you left off.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Platform analytics:</Text> To understand how users
                interact with our features so we can improve usability and performance.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Security and fraud prevention:</Text> To detect
                anomalous access patterns and protect the integrity of user accounts.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Payment processing:</Text> To manage secure checkout
                sessions and prevent fraudulent transactions when you subscribe or donate.
              </Text>
            </View>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Categories of Cookies We Use</Text>

            <Text style={styles.subTitle}>Strictly Necessary</Text>
            <Text style={styles.body}>
              Essential for the platform to function. Without these cookies, services such as
              authentication, session management, and tour progress tracking cannot be provided.
              They do not require your consent under applicable law and cannot be disabled without
              significantly impairing the platform.
            </Text>

            <Text style={styles.subTitle}>Functional</Text>
            <Text style={styles.body}>
              Allow us to remember choices you make — such as your preferred language — and provide
              a more personalised experience. Disabling these cookies may degrade the quality and
              consistency of your experience but will not prevent you from using the platform.
            </Text>

            <Text style={styles.subTitle}>Analytics</Text>
            <Text style={styles.body}>
              Used to collect aggregated, anonymised data about how visitors use our platform
              (e.g., which pages are visited most, where users drop off). This information helps
              us prioritise improvements. We do not sell analytics data to third parties.
            </Text>

            <Text style={styles.subTitle}>Payment (Third-party)</Text>
            <Text style={styles.body}>
              When you initiate a subscription or donation, our payment processor Stripe may set
              cookies to manage the secure payment session and detect fraudulent transactions.
              These cookies are governed exclusively by Stripe's Privacy Policy and are only active
              during and immediately after a payment flow.
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Managing and Disabling Cookies</Text>
            <Text style={styles.body}>
              You have several options to control the cookies set on your device:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Browser settings:</Text> Most browsers allow you to
                view, block, or delete cookies via the settings or preferences menu. Instructions
                vary by browser; consult your browser's help documentation. Note that disabling
                certain cookies may prevent key features from working correctly.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>In-app consent:</Text> You may withdraw your consent
                to non-essential cookies at any time by clearing your browser's local storage or
                app data. The consent prompt will reappear on your next visit, allowing you to
                make a fresh choice.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Third-party opt-out tools:</Text> For analytics and
                advertising cookies set by third parties, you may use the opt-out mechanisms
                provided by those services (e.g., Google Analytics opt-out browser add-on).
              </Text>
            </View>
            <Text style={styles.body}>
              Please note that disabling strictly necessary cookies will impair core platform
              functionality, including the ability to stay logged in or track tour progress.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Cookies and Personal Data</Text>
            <Text style={styles.body}>
              Some cookies we use may process personal data (for example, a session identifier
              linked to your account). Where this is the case, such processing is covered by our
              Privacy Policy, which sets out the legal basis, purposes, and your rights in relation
              to that data. We encourage you to read our Privacy Policy alongside this Cookie Policy.
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Changes to This Policy</Text>
            <Text style={styles.body}>
              We may update this Cookie Policy from time to time to reflect changes in technology,
              legislation, or our operational practices. When we make material changes, we will
              update the "Last updated" date at the top of this page and, where appropriate, notify
              you through the platform. We encourage you to review this policy periodically.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Contact Us</Text>
            <Text style={styles.body}>
              If you have any questions about our use of cookies or this Cookie Policy, please
              contact us:
            </Text>
            <Text style={styles.contactBlock}>
              StepUp Tours — Privacy Team{'\n'}
              privacy@stepuptours.com{'\n'}
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
