// components/admin/LegalTab.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import CountryFlag from 'react-native-country-flag';
import { langCodeToCountryCode } from '../../services/language.service';
import {
    getAdminLanguages, getTranslations, saveTranslations,
    type AdminLanguage,
} from '../../services/admin.service';

const AMBER = '#F59E0B';

type LegalPage = 'privacy' | 'cookie' | 'terms';

const PAGES: { id: LegalPage; labelKey: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { id: 'privacy', labelKey: 'legal.privacyPolicy', icon: 'shield-checkmark-outline', color: '#10B981' },
    { id: 'cookie',  labelKey: 'legal.cookiePolicy',  icon: 'document-text-outline',    color: '#6366F1' },
    { id: 'terms',   labelKey: 'legal.termsOfUse',    icon: 'document-lock-outline',    color: '#3B82F6' },
];

type SectionDef = { titleKey: string; bodyKey: string };

const PAGE_SECTIONS: Record<LegalPage, { introKey: string; sections: SectionDef[] }> = {
    privacy: {
        introKey: 'legal.privacy.intro',
        sections: [
            { titleKey: 'legal.privacy.s1_title', bodyKey: 'legal.privacy.s1_body' },
            { titleKey: 'legal.privacy.s2_title', bodyKey: 'legal.privacy.s2_body' },
            { titleKey: 'legal.privacy.s3_title', bodyKey: 'legal.privacy.s3_body' },
            { titleKey: 'legal.privacy.s4_title', bodyKey: 'legal.privacy.s4_body' },
            { titleKey: 'legal.privacy.s5_title', bodyKey: 'legal.privacy.s5_body' },
            { titleKey: 'legal.privacy.s6_title', bodyKey: 'legal.privacy.s6_body' },
            { titleKey: 'legal.privacy.s7_title', bodyKey: 'legal.privacy.s7_body' },
            { titleKey: 'legal.privacy.s8_title', bodyKey: 'legal.privacy.s8_body' },
            { titleKey: 'legal.privacy.s9_title', bodyKey: 'legal.privacy.s9_body' },
            { titleKey: 'legal.privacy.s10_title', bodyKey: 'legal.privacy.s10_body' },
        ],
    },
    cookie: {
        introKey: 'legal.cookie.intro',
        sections: [
            { titleKey: 'legal.cookie.s1_title', bodyKey: 'legal.cookie.s1_body' },
            { titleKey: 'legal.cookie.s2_title', bodyKey: 'legal.cookie.s2_body' },
            { titleKey: 'legal.cookie.s3_title', bodyKey: 'legal.cookie.s3_body' },
            { titleKey: 'legal.cookie.s4_title', bodyKey: 'legal.cookie.s4_body' },
            { titleKey: 'legal.cookie.s5_title', bodyKey: 'legal.cookie.s5_body' },
            { titleKey: 'legal.cookie.s6_title', bodyKey: 'legal.cookie.s6_body' },
        ],
    },
    terms: {
        introKey: 'legal.terms.intro',
        sections: [
            { titleKey: 'legal.terms.s1_title', bodyKey: 'legal.terms.s1_body' },
            { titleKey: 'legal.terms.s2_title', bodyKey: 'legal.terms.s2_body' },
            { titleKey: 'legal.terms.s3_title', bodyKey: 'legal.terms.s3_body' },
            { titleKey: 'legal.terms.s4_title', bodyKey: 'legal.terms.s4_body' },
            { titleKey: 'legal.terms.s5_title', bodyKey: 'legal.terms.s5_body' },
            { titleKey: 'legal.terms.s6_title', bodyKey: 'legal.terms.s6_body' },
            { titleKey: 'legal.terms.s7_title', bodyKey: 'legal.terms.s7_body' },
            { titleKey: 'legal.terms.s8_title', bodyKey: 'legal.terms.s8_body' },
            { titleKey: 'legal.terms.s9_title', bodyKey: 'legal.terms.s9_body' },
            { titleKey: 'legal.terms.s10_title', bodyKey: 'legal.terms.s10_body' },
            { titleKey: 'legal.terms.s11_title', bodyKey: 'legal.terms.s11_body' },
            { titleKey: 'legal.terms.s12_title', bodyKey: 'legal.terms.s12_body' },
            { titleKey: 'legal.terms.s13_title', bodyKey: 'legal.terms.s13_body' },
        ],
    },
};

interface PageFields {
    intro: string;
    sections: { title: string; body: string }[];
}

export function LegalTab() {
    const { t, i18n } = useTranslation();

    const [languages, setLanguages] = useState<AdminLanguage[]>([]);
    const [selectedLang, setSelectedLang] = useState<string>('en');
    const [activePage, setActivePage] = useState<LegalPage>('privacy');
    const [fields, setFields] = useState<PageFields>({ intro: '', sections: [] });
    const [modifications, setModifications] = useState<Map<string, string>>(new Map());
    const [loadingLangs, setLoadingLangs] = useState(true);
    const [loadingContent, setLoadingContent] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Load languages on mount
    useEffect(() => {
        getAdminLanguages()
            .then(langs => {
                setLanguages(langs);
                const current = langs.find(l => l.id === i18n.language) ?? langs[0];
                if (current) setSelectedLang(current.id);
            })
            .catch(() => {})
            .finally(() => setLoadingLangs(false));
    }, []);

    // Load content when language or page changes
    const loadContent = useCallback(async (lang: string, page: LegalPage) => {
        setLoadingContent(true);
        setModifications(new Map());
        setFeedback(null);

        const pageDef = PAGE_SECTIONS[page];

        let rowMap = new Map<string, string>();
        try {
            const rows = await getTranslations(lang);
            rows.forEach(r => { if (r.target) rowMap.set(r.key, r.target); });
        } catch {}

        const getVal = (key: string) =>
            rowMap.get(key) || i18next.t(key, { lng: lang }) || '';

        setFields({
            intro: getVal(pageDef.introKey),
            sections: pageDef.sections.map(s => ({
                title: getVal(s.titleKey),
                body:  getVal(s.bodyKey),
            })),
        });
        setLoadingContent(false);
    }, []);

    useEffect(() => {
        loadContent(selectedLang, activePage);
    }, [selectedLang, activePage, loadContent]);

    const trackChange = (key: string, value: string) => {
        setModifications(prev => new Map(prev).set(key, value));
        setFeedback(null);
    };

    const handleIntroChange = (value: string) => {
        setFields(prev => ({ ...prev, intro: value }));
        trackChange(PAGE_SECTIONS[activePage].introKey, value);
    };

    const handleTitleChange = (idx: number, value: string) => {
        setFields(prev => ({
            ...prev,
            sections: prev.sections.map((s, i) => i === idx ? { ...s, title: value } : s),
        }));
        trackChange(PAGE_SECTIONS[activePage].sections[idx].titleKey, value);
    };

    const handleBodyChange = (idx: number, value: string) => {
        setFields(prev => ({
            ...prev,
            sections: prev.sections.map((s, i) => i === idx ? { ...s, body: value } : s),
        }));
        trackChange(PAGE_SECTIONS[activePage].sections[idx].bodyKey, value);
    };

    const handleSave = async () => {
        if (modifications.size === 0) return;
        setSaving(true);
        setFeedback(null);
        try {
            const entries = Array.from(modifications.entries()).map(([key, value]) => ({ key, value }));
            await saveTranslations(selectedLang, entries);
            setModifications(new Map());
            setFeedback({ type: 'success', message: t('admin.translations.saved') });
        } catch {
            setFeedback({ type: 'error', message: t('admin.settings.error') });
        } finally {
            setSaving(false);
        }
    };

    const modCount = modifications.size;
    const activeMeta = PAGES.find(p => p.id === activePage)!;
    const activeDef = PAGE_SECTIONS[activePage];

    const editingLabel = t('admin.legal.editingLabel', {
        page: t(activeMeta.labelKey),
        lang: languages.find(l => l.id === selectedLang)?.label ?? selectedLang,
    });
    const unsavedLabel = modCount > 0
        ? `  •  ${t('admin.legal.unsavedChanges', { count: modCount })}`
        : '';
    const saveBtnLabel = modCount > 0
        ? t('admin.legal.saveChanges', { count: modCount })
        : t('admin.legal.noChanges');

    if (loadingLangs) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={AMBER} />
            </View>
        );
    }

    return (
        <View>
            {/* Page sub-tab bar */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pageTabBar}
                style={styles.pageTabBarScroll}
            >
                {PAGES.map(page => {
                    const isActive = page.id === activePage;
                    return (
                        <TouchableOpacity
                            key={page.id}
                            style={[styles.pageTabPill, isActive && { backgroundColor: page.color }]}
                            onPress={() => setActivePage(page.id)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name={page.icon} size={15} color={isActive ? '#FFFFFF' : '#6B7280'} />
                            <Text style={[styles.pageTabLabel, isActive && styles.pageTabLabelActive]}>
                                {t(page.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Language selector */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="language-outline" size={18} color={AMBER} />
                    <Text style={styles.cardTitle}>{t('admin.translations.selectLanguage')}</Text>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.langRow}
                >
                    {languages.map(lang => {
                        const isActive = lang.id === selectedLang;
                        const cc = langCodeToCountryCode(lang.id);
                        return (
                            <TouchableOpacity
                                key={lang.id}
                                style={[styles.langPill, isActive && styles.langPillActive]}
                                onPress={() => setSelectedLang(lang.id)}
                                activeOpacity={0.7}
                            >
                                <CountryFlag isoCode={cc} size={14} />
                                <Text style={[styles.langPillText, isActive && styles.langPillTextActive]}>
                                    {lang.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Editing context note */}
            <View style={styles.infoNote}>
                <Ionicons name="create-outline" size={16} color="#6B7280" />
                <Text style={styles.infoNoteText}>
                    {editingLabel}{unsavedLabel}
                </Text>
            </View>

            {loadingContent ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="small" color={AMBER} />
                </View>
            ) : (
                <View>
                    {/* Intro card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.sectionDot, { backgroundColor: activeMeta.color }]} />
                            <Text style={styles.cardTitle}>{t('admin.legal.introCard')}</Text>
                        </View>
                        <Text style={styles.fieldLabel}>{t('admin.legal.introFieldLabel')}</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={fields.intro}
                            onChangeText={handleIntroChange}
                            multiline
                            textAlignVertical="top"
                            placeholder={t('admin.legal.introPh')}
                            placeholderTextColor="#D1D5DB"
                        />
                    </View>

                    {/* Section cards */}
                    {activeDef.sections.map((secDef, idx) => (
                        <View key={secDef.titleKey} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.sectionBadge, { backgroundColor: activeMeta.color + '18' }]}>
                                    <Text style={[styles.sectionBadgeText, { color: activeMeta.color }]}>
                                        §{idx + 1}
                                    </Text>
                                </View>
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {fields.sections[idx]?.title || t('admin.legal.sectionLabel', { n: idx + 1 })}
                                </Text>
                            </View>

                            <Text style={styles.fieldLabel}>{t('admin.legal.titleFieldLabel')}</Text>
                            <TextInput
                                style={styles.input}
                                value={fields.sections[idx]?.title ?? ''}
                                onChangeText={v => handleTitleChange(idx, v)}
                                placeholder={t('admin.legal.titlePh')}
                                placeholderTextColor="#D1D5DB"
                            />

                            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{t('admin.legal.contentFieldLabel')}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, styles.textAreaTall]}
                                value={fields.sections[idx]?.body ?? ''}
                                onChangeText={v => handleBodyChange(idx, v)}
                                multiline
                                textAlignVertical="top"
                                placeholder={t('admin.legal.contentPh')}
                                placeholderTextColor="#D1D5DB"
                            />
                            <View style={styles.formatHint}>
                                <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
                                <Text style={styles.formatHintText}>
                                    {t('admin.legal.formatHint')}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {/* Feedback */}
                    {feedback && (
                        <View style={[
                            styles.feedbackBanner,
                            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                        ]}>
                            <Ionicons
                                name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                                size={18}
                                color={feedback.type === 'success' ? '#065F46' : '#991B1B'}
                            />
                            <Text style={[
                                styles.feedbackText,
                                feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError,
                            ]}>
                                {feedback.message}
                            </Text>
                        </View>
                    )}

                    {/* Save button */}
                    <TouchableOpacity
                        style={[styles.saveBtn, (saving || modCount === 0) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving || modCount === 0}
                        activeOpacity={0.8}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.saveBtnText}>{saveBtnLabel}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    loadingWrap: { paddingVertical: 60, alignItems: 'center' },

    // Page sub-tab bar
    pageTabBarScroll: { marginBottom: 16 },
    pageTabBar: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
    pageTabPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    pageTabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    pageTabLabelActive: { color: '#FFFFFF' },

    // Card
    card: {
        backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, marginBottom: 16,
        ...Platform.select({
            web:     { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any,
            default: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
        }),
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', flex: 1 },

    // Section decorators
    sectionDot: { width: 10, height: 10, borderRadius: 5 },
    sectionBadge: {
        minWidth: 28, height: 28, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    },
    sectionBadgeText: { fontSize: 12, fontWeight: '700' },

    // Language pills
    langRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    langPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: 'transparent',
    },
    langPillActive: { backgroundColor: AMBER + '18', borderColor: AMBER },
    langPillText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
    langPillTextActive: { color: AMBER },

    // Info note
    infoNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12, marginBottom: 16,
    },
    infoNoteText: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 18 },

    // Fields
    fieldLabel: {
        fontSize: 11, fontWeight: '600', color: '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
    },
    input: {
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 8,
        fontSize: 13, color: '#374151', backgroundColor: '#FAFAFA',
    },
    textArea:     { minHeight: 80 },
    textAreaTall: { minHeight: 180 },

    formatHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    formatHintText: { fontSize: 11, color: '#9CA3AF', flex: 1 },

    // Feedback
    feedbackBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 12, borderRadius: 8, marginBottom: 16,
    },
    feedbackSuccess: { backgroundColor: '#ECFDF5' },
    feedbackError:   { backgroundColor: '#FEF2F2' },
    feedbackText:    { fontSize: 13, fontWeight: '500' },
    feedbackTextSuccess: { color: '#065F46' },
    feedbackTextError:   { color: '#991B1B' },

    // Save button
    saveBtn: {
        borderRadius: 10, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: AMBER, marginBottom: 20,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});