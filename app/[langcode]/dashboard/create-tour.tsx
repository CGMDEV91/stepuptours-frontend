// app/[langcode]/dashboard/create-tour.tsx
// Create Tour page — guide (and legacy professional) role only

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../stores/auth.store';
import { useToursStore } from '../../../stores/tours.store';
import { useLanguageStore } from '../../../stores/language.store';
import { webFullHeight } from '../../../lib/web-styles';
import {
  createTour,
  updateTour,
  createTourStep,
  updateTourStep,
  deleteTourStep,
  setStepPublished,
  getTourById,
  getTourByIdInLang,
  getTourStepsForEdit,
  getTourStepsInLang,
  listTourTranslations,
} from '../../../services/dashboard.service';
import { ImagePickerField } from '../../../components/shared/ImagePickerField';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import PageBanner from '../../../components/layout/PageBanner';
import { uploadDrupalFile, getApiLanguage } from '../../../lib/drupal-client';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

interface StepEntry {
  key: string;
  drupalId?: string;
  /**
   * Langcode of the persisted step. Required to build the correct
   * language-prefix URL for PATCH requests (Drupal returns 405 without it
   * when the step only exists in a non-default language).
   */
  langcode?: string;
  title: string;
  description: string;
  lat: string;
  lon: string;
  duration: string;
  /** Drupal publish state. Unpublished steps are hidden from visitors. */
  published: boolean;
}

function makeKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function CreateTourScreen() {
  const { langcode, tourId, contentLang } = useLocalSearchParams<{
    langcode: string;
    tourId?: string;
    /**
     * contentLang: the language of the tour content to load/save.
     *
     * Set by the Translations modal when the guide clicks "Edit" on a
     * translation row. It is ALWAYS passed now so we have a reliable signal:
     *
     *   • contentLang === sourceLang  → editing source, isTranslationMode = false
     *   • contentLang !== sourceLang  → editing a translation, isTranslationMode = true
     *   • contentLang absent          → new tour, isTranslationMode = false
     *
     * Crucially, `langcode` (the URL prefix) is kept equal to the UI language
     * and is NEVER changed by the Translations modal, so the interface language
     * is unaffected when the guide opens an editor for a translated tour.
     */
    contentLang?: string;
  }>();

  const isEditMode = !!tourId;
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isGuide =
      user?.roles?.includes('guide') || user?.roles?.includes('professional');

  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthLoading && (!user || !isGuide)) {
      router.replace(`/${langcode}` as any);
    }
  }, [ready, user, isAuthLoading, isGuide, langcode]);

  // ── Edit mode: loading state ──────────────────────────────────────────────
  const [isLoadingTour, setIsLoadingTour] = useState(isEditMode);

  /**
   * entityLangcode: the langcode we send to drupalPatchBase when saving.
   *
   * In source-language edit mode this equals the tour's creation language.
   * In translation edit mode this equals contentLang (the translation being
   * edited), so the PATCH goes to the correct /{lang}/jsonapi/... URL.
   */
  const [entityLangcode, setEntityLangcode] = useState<string>('');

  /**
   * sourceLangcode: the original creation language of the tour node.
   *
   * isTranslationMode: true when contentLang is present AND differs from
   * sourceLangcode. When true:
   *   - Steps are shown read-only (titles in the target language if available).
   *   - Step create / reorder / delete is disabled.
   *   - Only tour-level fields (title, description, duration, image) are editable.
   */
  const [sourceLangcode, setSourceLangcode] = useState<string>('');
  const isTranslationMode =
      isEditMode &&
      !!sourceLangcode &&
      !!contentLang &&
      contentLang !== sourceLangcode;

  /**
   * True when, in translation mode, one or more steps have no translation in the
   * target language (Drupal returned the source-language fallback). The guide
   * cannot translate steps here, so we surface a "contact support" notice and
   * keep the steps locked.
   */
  const [stepsMissingTranslation, setStepsMissingTranslation] = useState(false);

  // ── Tour basic info ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');

  // ── Tour image ────────────────────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string>('');
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // ── Desktop dropdown ─────────────────────────────────────────────────────
  const cityBtnRef = useRef<View>(null);
  const langBtnRef = useRef<View>(null);
  const [ddConfig, setDdConfig] = useState<{
    type: 'city' | 'lang';
    x: number;
    y: number;
    minWidth: number;
  } | null>(null);
  const [ddSearch, setDdSearch] = useState('');

  const openPicker = useCallback(
      (type: 'city' | 'lang') => {
        if (type === 'lang' && isEditMode) return;
        if (!isDesktop) {
          if (type === 'city') setCityPickerVisible(true);
          else setLangPickerVisible(true);
          return;
        }
        const ref = type === 'city' ? cityBtnRef : langBtnRef;
        ref.current?.measureInWindow((x, y, w, h) => {
          setDdSearch('');
          setDdConfig({ type, x, y: y + h + 4, minWidth: Math.max(w, 220) });
        });
      },
      [isDesktop, isEditMode]
  );

  const closeDd = useCallback(() => setDdConfig(null), []);

  // ── City picker ──────────────────────────────────────────────────────────
  const [cityId, setCityId] = useState('');
  const [cityLabel, setCityLabel] = useState('');
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const { cities, fetchCities } = useToursStore();

  useEffect(() => {
    if (cities.length === 0) fetchCities();
  }, []);

  const filteredCities = cities.filter((c) =>
      c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  // ── Language picker ──────────────────────────────────────────────────────
  const [languageCode, setLanguageCode] = useState(() => getApiLanguage() || 'es');
  const [languageLabel, setLanguageLabel] = useState('');
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const { languages, fetchLanguages } = useLanguageStore();

  useEffect(() => {
    if (languages.length === 0) fetchLanguages();
  }, []);

  const filteredLanguages = languages.filter((l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.id.toLowerCase().includes(langSearch.toLowerCase())
  );

  useEffect(() => {
    if (languages.length > 0 && languageCode) {
      const match = languages.find((l) => l.id === languageCode);
      if (match) setLanguageLabel(match.name);
    }
  }, [languages, languageCode]);

  // ── Tour steps ──────────────────────────────────────────────────────────
  const [steps, setSteps] = useState<StepEntry[]>([]);
  // Key of the step currently being deleted/toggled (shows a spinner / disables).
  const [busyStepKey, setBusyStepKey] = useState<string | null>(null);
  // Step pending delete confirmation (drives the confirm modal).
  const [pendingDeleteStep, setPendingDeleteStep] = useState<StepEntry | null>(null);
  // Warning / error message shown in a modal (replaces native Alert).
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const addStep = useCallback(() => {
    if (isTranslationMode) return;
    setSteps((prev) => [
      ...prev,
      { key: makeKey(), title: '', description: '', lat: '', lon: '', duration: '', published: true },
    ]);
  }, [isTranslationMode]);

  // Publish/unpublish a step. Persisted steps go through the custom guide
  // endpoint immediately (JSON:API can't PATCH `status`); new unsaved steps just
  // flip local state (they are created published on save).
  const togglePublish = useCallback(async (step: StepEntry) => {
    if (isTranslationMode || busyStepKey) return;
    const next = !step.published;
    if (step.drupalId) {
      setBusyStepKey(step.key);
      try {
        await setStepPublished(step.drupalId, next);
      } catch (err: any) {
        setAlertMsg(err?.message ?? t('createTour.error.generic'));
        setBusyStepKey(null);
        return;
      }
      setBusyStepKey(null);
    }
    setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, published: next } : s)));
  }, [isTranslationMode, busyStepKey, t]);

  // Delete a step. Persisted steps are deleted server-side (whole entity);
  // new unsaved steps are just dropped from the form.
  const performDeleteStep = useCallback(async (step: StepEntry) => {
    if (isTranslationMode) return;
    if (!step.drupalId) {
      setSteps((prev) => prev.filter((s) => s.key !== step.key));
      setPendingDeleteStep(null);
      return;
    }
    setBusyStepKey(step.key);
    try {
      await deleteTourStep(step.drupalId);
      setSteps((prev) => prev.filter((s) => s.key !== step.key));
      setPendingDeleteStep(null);
    } catch (err: any) {
      setAlertMsg(err?.message ?? t('createTour.error.generic'));
    } finally {
      setBusyStepKey(null);
    }
  }, [isTranslationMode, t]);

  const removeStep = useCallback((step: StepEntry) => {
    if (isTranslationMode || busyStepKey) return;
    setPendingDeleteStep(step);
  }, [isTranslationMode, busyStepKey]);

  const updateStep = useCallback((key: string, field: keyof StepEntry, value: string) => {
    if (isTranslationMode) return;
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }, [isTranslationMode]);

  const moveStepUp = useCallback((index: number) => {
    if (isTranslationMode || index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, [isTranslationMode]);

  const moveStepDown = useCallback((index: number) => {
    if (isTranslationMode) return;
    setSteps((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }, [isTranslationMode]);

  // ── Edit mode: load existing tour data ────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !tourId) return;
    // Wait until auth is ready: listTourTranslations / getTourById need the
    // session header. On a full page reload the auth store rehydrates async; if
    // we fetch too early listTourTranslations 403s, sourceLang falls back to the
    // wrong (default-rendered) langcode and the form wrongly enters translation
    // mode (steps locked). Gating on auth keeps source editing editable.
    if (isAuthLoading || !user) return;

    let cancelled = false;
    setIsLoadingTour(true);

    /**
     * Loading strategy:
     *
     * 1. getTourById (source language, with filter[default_langcode]=1)
     *    → always load the source node to get drupalInternalId and sourceLangcode.
     *
     * 2. listTourTranslations → resolve sourceLang reliably.
     *
     * 3a. If contentLang is absent or equals sourceLang:
     *     → use source-language data to fill the form (no extra fetch needed).
     *
     * 3b. If contentLang differs from sourceLang (translation mode):
     *     → call getTourByIdInLang(tourId, contentLang) to get the translated
     *       title / description / image for the form fields.
     *     → call getTourStepsInLang(tourId, contentLang) to show translated
     *       step titles in the read-only list (best-effort, falls back to
     *       source-language steps if the translation doesn't exist yet).
     */
    Promise.all([
      getTourById(tourId),
      getTourStepsForEdit(tourId),
    ])
        .then(async ([sourceTour, sourceTourSteps]) => {
          let translationsInfo = null;
          if (sourceTour.drupalInternalId) {
            translationsInfo = await listTourTranslations(sourceTour.drupalInternalId).catch(() => null);
          }
          if (cancelled) return;

          // Prefer the backend-resolved source lang. If it couldn't be resolved,
          // fall back to contentLang (NOT sourceTour.langcode, which is rendered
          // in the site default language) so we never wrongly enter translation
          // mode and lock the steps.
          const resolvedSourceLang =
              translationsInfo?.sourceLang ?? contentLang ?? sourceTour.langcode ?? '';
          setSourceLangcode(resolvedSourceLang);

          // Resolve the language to load/save:
          //   - translation mode → contentLang (the translation being edited)
          //   - source mode      → the node's creation language
          const isTranslating = !!contentLang && contentLang !== resolvedSourceLang;
          const loadLang = isTranslating ? (contentLang as string) : resolvedSourceLang;

          // Always load tour + steps in the resolved language. getTourById
          // renders in the site default language (wrong for non-default source
          // tours) and carries no `included`, so we never use it for content —
          // only for drupalInternalId. Errors fall back to the source node.
          const [tourData, stepsData] = await Promise.all([
            getTourByIdInLang(tourId, loadLang).catch(() => sourceTour),
            getTourStepsInLang(tourId, loadLang).catch(() => sourceTourSteps),
          ]);
          if (cancelled) return;

          setTitle(tourData.title);
          setDescription(tourData.description);
          setDuration(sourceTour.duration > 0 ? String(sourceTour.duration) : '');

          if (tourData.image) setExistingImageUrl(tourData.image);

          // City/country are language-neutral; prefer the resolved node's
          // included data, falling back to the source node.
          const cityRef = tourData.city ?? sourceTour.city;
          if (cityRef) {
            setCityId(cityRef.id);
            setCityLabel(cityRef.name);
          }

          // entityLangcode drives the PATCH URL via drupalPatchBase:
          //   - translation mode → /{contentLang}/jsonapi/node/tour/{id}
          //   - source mode      → the node's creation langcode
          setEntityLangcode(loadLang);
          setLanguageCode(resolvedSourceLang); // shown locked in the Language field

          // Steps: preserve drupalId + langcode for correct PATCH routing.
          const loadedSteps: StepEntry[] = stepsData.map((s) => ({
            key:      makeKey(),
            drupalId: s.id,
            langcode: s.contentLangcode,
            title:    s.title,
            description: s.description,
            lat:  s.location ? String(s.location.lat) : '',
            lon:  s.location ? String(s.location.lon) : '',
            duration: '',
            published: s.published,
          }));
          setSteps(loadedSteps);

          // In translation mode, flag steps that came back as source-language
          // fallback (no real translation in the target language).
          setStepsMissingTranslation(
              isTranslating && stepsData.some((s) => s.contentLangcode !== contentLang),
          );
        })
        .catch(() => {
          // Non-fatal: show empty form if fetch fails
        })
        .finally(() => {
          if (!cancelled) setIsLoadingTour(false);
        });

    return () => { cancelled = true; };
    // contentLang is intentionally in the dep array so the form reloads if it
    // changes (e.g. the user navigates from one translation edit to another).
    // isAuthLoading / user.id gate the fetch until the session is ready.
  }, [isEditMode, tourId, contentLang, isAuthLoading, user?.id]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setValidationError(null);

    if (!title.trim()) {
      setValidationError(t('createTour.validation.titleRequired'));
      return;
    }

    if (!isTranslationMode) {
      // At least one PUBLISHED step is required; unpublished steps don't count
      // and don't require a title.
      if (!steps.some((s) => s.published)) {
        setValidationError(t('createTour.validation.publishedStepRequired'));
        return;
      }
      const firstEmptyPublished = steps.findIndex((s) => s.published && !s.title.trim());
      if (firstEmptyPublished !== -1) {
        setValidationError(t('createTour.validation.stepTitleRequired', { order: firstEmptyPublished + 1 }));
        return;
      }
    }

    setSaving(true);
    try {
      let imageId: string | null | undefined = uploadedImageId;
      if (imageUri && !uploadedImageId) {
        const fileId = await uploadDrupalFile('tour', 'field_image', imageUri, imageFilename || 'image.jpg');
        setUploadedImageId(fileId);
        imageId = fileId;
      }

      if (isEditMode && tourId) {
        // PATCH the tour node.
        // entityLangcode ensures drupalPatchBase builds the correct URL:
        //   - source mode:      /{sourceLang}/jsonapi/node/tour/{id}
        //   - translation mode: /{contentLang}/jsonapi/node/tour/{id}
        await updateTour(tourId, {
          title: title.trim(),
          description: description.trim(),
          duration: parseInt(duration, 10) || 0,
          cityId: cityId || undefined,
          ...(imageId !== undefined ? { imageId } : {}),
        }, entityLangcode || undefined);

        // Step mutations only apply in source-language mode.
        // Guides cannot delete steps; they unpublish them (status=false). Each
        // step is patched with its publish state and order so reordering and
        // unpublishing persist. New steps are created published.
        if (!isTranslationMode) {
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const lat = parseFloat(step.lat);
            const lon = parseFloat(step.lon);
            const hasLocation = !isNaN(lat) && !isNaN(lon);

            if (step.drupalId) {
              await updateTourStep(step.drupalId, {
                title: step.title.trim(),
                description: step.description.trim(),
                order: i + 1,
                lat: hasLocation ? lat : undefined,
                lon: hasLocation ? lon : undefined,
                duration: step.duration ? parseInt(step.duration, 10) : undefined,
              }, step.langcode);
            } else {
              await createTourStep(tourId, {
                title: step.title.trim(),
                description: step.description.trim(),
                order: i + 1,
                lat: hasLocation ? lat : undefined,
                lon: hasLocation ? lon : undefined,
                duration: step.duration ? parseInt(step.duration, 10) : undefined,
              });
            }
          }
        }
      } else {
        // POST new tour
        const tour = await createTour({
          title: title.trim(),
          description: description.trim(),
          duration: parseInt(duration, 10) || 0,
          cityId: cityId || undefined,
          imageId: imageId ?? undefined,
          langcode: languageCode,
        });

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const lat = parseFloat(step.lat);
          const lon = parseFloat(step.lon);
          const hasLocation = !isNaN(lat) && !isNaN(lon);

          await createTourStep(tour.id, {
            title: step.title.trim(),
            description: step.description.trim(),
            order: i + 1,
            lat: hasLocation ? lat : undefined,
            lon: hasLocation ? lon : undefined,
            duration: step.duration ? parseInt(step.duration, 10) : undefined,
          });
        }
      }

      // Always navigate back using the UI langcode (from the URL param),
      // never contentLang — the UI language must not change.
      router.replace(`/${langcode}/dashboard?tab=tours&toast=tour_saved` as any);
    } catch (err: any) {
      setAlertMsg(err.message ?? t('createTour.error.generic'));
    } finally {
      setSaving(false);
    }
  }, [
    title, description, duration, cityId, steps, langcode, router, t,
    isEditMode, tourId, isTranslationMode,
    imageUri, imageFilename, uploadedImageId, languageCode, entityLangcode,
  ]);

  if (isAuthLoading || !user || isLoadingTour) {
    return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AMBER} />
        </View>
    );
  }

  const contentStyle = {
    paddingHorizontal: 16,
    paddingTop: 24,
    ...(isDesktop ? { maxWidth: CONTENT_MAX_WIDTH, width: '100%' as const, alignSelf: 'center' as const } : {}),
  };

  return (
      <View style={styles.screen}>
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
          <PageBanner
              icon={isEditMode ? 'create-outline' : 'add-circle-outline'}
              iconBgColor={AMBER}
              title={isEditMode ? t('createTour.editTitle', 'Edit Tour') : t('createTour.title')}
              subtitle={isEditMode ? t('createTour.editSubtitle', 'Update your tour details') : t('createTour.subtitle')}
              showBack
          />
          <View style={contentStyle}>

            {/* Translation mode info banner */}
            {isTranslationMode && (
                <View style={styles.translationBanner}>
                  <Ionicons name="language-outline" size={20} color="#1D4ED8" />
                  <View style={styles.translationBannerBody}>
                    <Text style={styles.translationBannerTitle}>
                      {t('createTour.translationMode.title', 'Editing translation')}
                    </Text>
                    <Text style={styles.translationBannerText}>
                      {t(
                          'createTour.translationMode.description',
                          'You are editing a translation of this tour. Only the tour title, description, duration and cover image can be updated here. To add, remove or reorder stops, switch to the original language ({{lang}}).',
                          { lang: sourceLangcode.toUpperCase() }
                      )}
                    </Text>
                  </View>
                </View>
            )}

            {/* Section 1: Basic Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('createTour.section.basicInfo')}</Text>

              <Text style={styles.label}>
                {t('createTour.field.title')} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('createTour.placeholder.title')}
                  placeholderTextColor="#9CA3AF"
                  maxLength={200}
              />

              <Text style={styles.label}>{t('createTour.field.description')}</Text>
              <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('createTour.placeholder.description')}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
              />

              <ImagePickerField
                  label={t('createTour.field.image', 'Cover Image')}
                  currentImageUrl={imageUri ?? existingImageUrl}
                  onImageSelected={(uri, filename) => {
                    setImageUri(uri);
                    setImageFilename(filename);
                    setUploadedImageId(null);
                  }}
                  onImageCleared={() => {
                    setImageUri(null);
                    setImageFilename('');
                    setUploadedImageId(null);
                    setExistingImageUrl(null);
                  }}
              />

              <View style={styles.row}>
                <View style={styles.rowField}>
                  <Text style={styles.label}>{t('createTour.field.city')}</Text>
                  <View ref={cityBtnRef} collapsable={false}>
                    <TouchableOpacity
                        style={styles.input}
                        onPress={() => openPicker('city')}
                        activeOpacity={0.7}
                    >
                      <Text style={{ color: cityLabel ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                        {cityLabel || t('createTour.placeholder.city')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.rowField}>
                  <Text style={styles.label}>{t('createTour.field.duration')}</Text>
                  <TextInput
                      style={styles.input}
                      value={duration}
                      onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, ''))}
                      placeholder="60"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowField}>
                  <Text style={styles.label}>
                    {isEditMode
                        ? t('createTour.field.languageLocked', 'Language (set at creation)')
                        : t('createTour.field.language')}
                  </Text>
                  <View ref={langBtnRef} collapsable={false}>
                    <TouchableOpacity
                        style={[styles.input, isEditMode && styles.inputLocked]}
                        onPress={() => openPicker('lang')}
                        activeOpacity={isEditMode ? 1 : 0.7}
                    >
                      <Text style={{ color: languageLabel ? (isEditMode ? '#6B7280' : '#111827') : '#9CA3AF', fontSize: 15 }}>
                        {languageLabel || languageCode}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Section 2: Steps */}
            <View style={[styles.section, isTranslationMode && styles.sectionLocked]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('createTour.section.steps')}
                  {isTranslationMode && (
                      <Text style={styles.sectionLockedLabel}>
                        {' '}— {t('createTour.translationMode.stepsReadOnly', 'read-only')}
                      </Text>
                  )}
                </Text>
                {!isTranslationMode && (
                    <TouchableOpacity style={styles.addStepBtn} onPress={addStep} activeOpacity={0.85}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.addStepBtnText}>{t('createTour.action.addStep')}</Text>
                    </TouchableOpacity>
                )}
              </View>

              {/* Translation mode: steps without a translation in the target language */}
              {isTranslationMode && stepsMissingTranslation && (
                  <View style={styles.stepsWarnBanner}>
                    <Ionicons name="alert-circle-outline" size={18} color="#92400E" />
                    <Text style={styles.stepsWarnText}>
                      {t(
                          'createTour.translationMode.stepsMissing',
                          'Some stops are not yet translated into this language and are shown in the original language. Please contact support to request a translation of the stops.',
                      )}
                    </Text>
                  </View>
              )}

              {/* Translation mode: show read-only step list with translated titles */}
              {isTranslationMode && steps.length > 0 && (
                  <View style={styles.stepsReadOnlyList}>
                    {steps.map((step, index) => (
                        <View key={step.key} style={styles.stepReadOnlyRow}>
                          <View style={styles.stepOrderBadge}>
                            <Text style={styles.stepOrderText}>{index + 1}</Text>
                          </View>
                          <Text style={styles.stepReadOnlyTitle} numberOfLines={1}>
                            {step.title || t('createTour.placeholder.stepTitle')}
                          </Text>
                          <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />
                        </View>
                    ))}
                  </View>
              )}

              {/* Source-language mode: full editable step list */}
              {!isTranslationMode && steps.length === 0 && (
                  <View style={styles.emptySteps}>
                    <Ionicons name="footsteps-outline" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyStepsText}>{t('createTour.steps.empty')}</Text>
                  </View>
              )}

              {!isTranslationMode && steps.map((step, index) => (
                  <View key={step.key} style={[styles.stepCard, !step.published && styles.stepCardUnpublished]}>
                    <View style={styles.stepHeader}>
                      <View style={[styles.stepOrderBadge, !step.published && styles.stepOrderBadgeMuted]}>
                        <Text style={styles.stepOrderText}>{index + 1}</Text>
                      </View>
                      <View style={styles.stepActions}>
                        <TouchableOpacity
                            style={styles.stepActionBtn}
                            onPress={() => moveStepUp(index)}
                            disabled={index === 0}
                        >
                          <Ionicons name="chevron-up" size={16} color={index === 0 ? '#D1D5DB' : '#6B7280'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.stepActionBtn}
                            onPress={() => moveStepDown(index)}
                            disabled={index === steps.length - 1}
                        >
                          <Ionicons name="chevron-down" size={16} color={index === steps.length - 1 ? '#D1D5DB' : '#6B7280'} />
                        </TouchableOpacity>
                        {/* Publish / unpublish (hidden from visitors when off). */}
                        <TouchableOpacity
                            style={styles.stepActionBtn}
                            onPress={() => togglePublish(step)}
                            disabled={busyStepKey === step.key}
                        >
                          <Ionicons
                              name={step.published ? 'eye-off-outline' : 'eye-outline'}
                              size={16}
                              color="#6B7280"
                          />
                        </TouchableOpacity>
                        {/* Delete the step permanently. */}
                        <TouchableOpacity
                            style={styles.stepDeleteBtn}
                            onPress={() => removeStep(step)}
                            disabled={busyStepKey === step.key}
                        >
                          {busyStepKey === step.key
                              ? <ActivityIndicator size="small" color="#EF4444" />
                              : <Ionicons name="trash-outline" size={16} color="#EF4444" />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {step.published ? (
                        <>
                          <Text style={styles.label}>
                            {t('createTour.field.stepTitle')} <Text style={styles.required}>*</Text>
                          </Text>
                          <TextInput
                              style={styles.input}
                              value={step.title}
                              onChangeText={(v) => updateStep(step.key, 'title', v)}
                              placeholder={t('createTour.placeholder.stepTitle')}
                              placeholderTextColor="#9CA3AF"
                          />

                          <Text style={styles.label}>{t('createTour.field.stepDescription')}</Text>
                          <TextInput
                              style={[styles.input, styles.inputMultiline]}
                              value={step.description}
                              onChangeText={(v) => updateStep(step.key, 'description', v)}
                              placeholder={t('createTour.placeholder.stepDescription')}
                              placeholderTextColor="#9CA3AF"
                              multiline
                              numberOfLines={3}
                              textAlignVertical="top"
                          />

                          <View style={styles.row}>
                            <View style={styles.rowField}>
                              <Text style={styles.label}>{t('createTour.field.lat')}</Text>
                              <TextInput
                                  style={styles.input}
                                  value={step.lat}
                                  onChangeText={(v) => updateStep(step.key, 'lat', v)}
                                  placeholder="41.3851"
                                  placeholderTextColor="#9CA3AF"
                                  keyboardType="decimal-pad"
                              />
                            </View>
                            <View style={styles.rowField}>
                              <Text style={styles.label}>{t('createTour.field.lon')}</Text>
                              <TextInput
                                  style={styles.input}
                                  value={step.lon}
                                  onChangeText={(v) => updateStep(step.key, 'lon', v)}
                                  placeholder="2.1734"
                                  placeholderTextColor="#9CA3AF"
                                  keyboardType="decimal-pad"
                              />
                            </View>
                            <View style={styles.rowField}>
                              <Text style={styles.label}>{t('createTour.field.stepDuration')}</Text>
                              <TextInput
                                  style={styles.input}
                                  value={step.duration}
                                  onChangeText={(v) => updateStep(step.key, 'duration', v.replace(/[^0-9]/g, ''))}
                                  placeholder="15"
                                  placeholderTextColor="#9CA3AF"
                                  keyboardType="numeric"
                              />
                            </View>
                          </View>
                        </>
                    ) : (
                        /* Unpublished: collapsed + greyed, with a request-deletion action. */
                        <View style={styles.stepCollapsedBody}>
                          <Text style={styles.stepCollapsedTitle} numberOfLines={1}>
                            {step.title || t('createTour.placeholder.stepTitle')}
                          </Text>
                          <Text style={styles.stepUnpublishedLabel}>
                            {t('createTour.steps.unpublished', 'Unpublished — hidden from visitors')}
                          </Text>
                        </View>
                    )}
                  </View>
              ))}
            </View>

            {validationError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                  <Text style={styles.errorBannerText}>{validationError}</Text>
                </View>
            )}

            <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
            >
              {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>{t('createTour.action.save')}</Text>
                  </>
              )}
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </View>
        </ScrollView>

        {/* Mobile bottom-sheet pickers */}
        {!isDesktop && (
            <>
              <Modal
                  visible={cityPickerVisible}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setCityPickerVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <Pressable style={styles.modalBackdrop} onPress={() => setCityPickerVisible(false)} />
                  <View style={styles.modalSheet}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalHeaderTitle}>{t('createTour.field.city')}</Text>
                      <TouchableOpacity onPress={() => setCityPickerVisible(false)} activeOpacity={0.7}>
                        <Ionicons name="close" size={22} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.pickerSearch}
                        value={citySearch}
                        onChangeText={setCitySearch}
                        placeholder={t('createTour.placeholder.city')}
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                        {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                    />
                    <FlatList
                        data={[{ id: '', name: t('createTour.placeholder.city') }, ...filteredCities]}
                        keyExtractor={(item) => item.id || '__clear__'}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.pickerItem}
                                onPress={() => {
                                  setCityId(item.id);
                                  setCityLabel(item.id ? item.name : '');
                                  setCityPickerVisible(false);
                                  setCitySearch('');
                                }}
                                activeOpacity={0.7}
                            >
                              <Text style={[styles.pickerItemText, !item.id && styles.pickerItemClear]}>
                                {item.name}
                              </Text>
                              {cityId === item.id && item.id !== '' && (
                                  <Ionicons name="checkmark" size={18} color={AMBER} />
                              )}
                            </TouchableOpacity>
                        )}
                    />
                  </View>
                </View>
              </Modal>

              <Modal
                  visible={langPickerVisible}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setLangPickerVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerVisible(false)} />
                  <View style={styles.modalSheet}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalHeaderTitle}>{t('createTour.field.language')}</Text>
                      <TouchableOpacity onPress={() => setLangPickerVisible(false)} activeOpacity={0.7}>
                        <Ionicons name="close" size={22} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.pickerSearch}
                        value={langSearch}
                        onChangeText={setLangSearch}
                        placeholder={t('createTour.field.language')}
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                        {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                    />
                    <FlatList
                        data={filteredLanguages}
                        keyExtractor={(item) => item.id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.pickerItem}
                                onPress={() => {
                                  setLanguageCode(item.id);
                                  setLanguageLabel(item.name);
                                  setLangPickerVisible(false);
                                  setLangSearch('');
                                }}
                                activeOpacity={0.7}
                            >
                              <Text style={styles.pickerItemText}>{item.name}</Text>
                              {languageCode === item.id && (
                                  <Ionicons name="checkmark" size={18} color={AMBER} />
                              )}
                            </TouchableOpacity>
                        )}
                    />
                  </View>
                </View>
              </Modal>
            </>
        )}

        {/* Desktop dropdown */}
        {isDesktop && ddConfig && (
            <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={closeDd}
            >
              <Pressable style={styles.ddBackdrop} onPress={closeDd} focusable={false} />
              <View
                  style={[
                    styles.ddDropdown,
                    { top: ddConfig.y, left: ddConfig.x, minWidth: ddConfig.minWidth },
                  ]}
              >
                <View style={styles.ddSearchBar}>
                  <Ionicons name="search-outline" size={15} color="#9CA3AF" />
                  <TextInput
                      style={styles.ddSearchInput}
                      value={ddSearch}
                      onChangeText={setDdSearch}
                      placeholder={ddConfig.type === 'city' ? t('createTour.placeholder.city') : t('createTour.field.language')}
                      placeholderTextColor="#9CA3AF"
                      autoFocus
                      {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                  />
                </View>
                <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                  {ddConfig.type === 'city' ? (
                      <>
                        {[{ id: '', name: t('createTour.placeholder.city') }, ...cities.filter((c) =>
                            c.name.toLowerCase().includes(ddSearch.toLowerCase())
                        )].map((item) => (
                            <TouchableOpacity
                                key={item.id || '__clear__'}
                                style={[styles.ddOption, cityId === item.id && item.id !== '' && styles.ddOptionActive]}
                                onPress={() => {
                                  setCityId(item.id);
                                  setCityLabel(item.id ? item.name : '');
                                  closeDd();
                                }}
                                activeOpacity={0.7}
                            >
                              <Text style={[styles.ddOptionText, cityId === item.id && item.id !== '' && styles.ddOptionTextActive, !item.id && styles.pickerItemClear]}>
                                {item.name}
                              </Text>
                              {cityId === item.id && item.id !== '' && (
                                  <Ionicons name="checkmark" size={16} color={AMBER} />
                              )}
                            </TouchableOpacity>
                        ))}
                      </>
                  ) : (
                      <>
                        {languages.filter((l) =>
                            l.name.toLowerCase().includes(ddSearch.toLowerCase()) ||
                            l.id.toLowerCase().includes(ddSearch.toLowerCase())
                        ).map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.ddOption, languageCode === item.id && styles.ddOptionActive]}
                                onPress={() => {
                                  setLanguageCode(item.id);
                                  setLanguageLabel(item.name);
                                  closeDd();
                                }}
                                activeOpacity={0.7}
                            >
                              <Text style={[styles.ddOptionText, languageCode === item.id && styles.ddOptionTextActive]}>
                                {item.name}
                              </Text>
                              {languageCode === item.id && (
                                  <Ionicons name="checkmark" size={16} color={AMBER} />
                              )}
                            </TouchableOpacity>
                        ))}
                      </>
                  )}
                </ScrollView>
              </View>
            </Modal>
        )}

        {/* Delete step confirmation */}
        <ConfirmModal
            visible={pendingDeleteStep !== null}
            title={t('createTour.steps.deleteTitle', 'Delete stop')}
            message={t('createTour.steps.deleteConfirm', 'Delete this stop permanently? This cannot be undone.')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            destructive
            busy={!!pendingDeleteStep && busyStepKey === pendingDeleteStep.key}
            onConfirm={() => pendingDeleteStep && performDeleteStep(pendingDeleteStep)}
            onClose={() => setPendingDeleteStep(null)}
        />

        {/* Warning / error alert */}
        <ConfirmModal
            visible={alertMsg !== null}
            title={t('createTour.error.title', 'Something went wrong')}
            message={alertMsg ?? ''}
            confirmLabel={t('common.ok', 'OK')}
            onConfirm={() => setAlertMsg(null)}
            onClose={() => setAlertMsg(null)}
        />
      </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB', ...webFullHeight },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  translationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  translationBannerBody: { flex: 1, gap: 2 },
  translationBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  translationBannerText: { fontSize: 13, color: '#1E40AF', lineHeight: 18 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 16,
  },
  sectionLocked: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.9,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  sectionLockedLabel: { fontSize: 13, fontWeight: '400', color: '#9CA3AF' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  stepsWarnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  stepsWarnText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  stepsReadOnlyList: { gap: 8 },
  stepReadOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stepReadOnlyTitle: { flex: 1, fontSize: 14, color: '#6B7280' },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  required: { color: '#EF4444' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputMultiline: { minHeight: 80, paddingTop: 10 },
  inputLocked: { backgroundColor: '#F3F4F6', opacity: 0.75 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  rowField: { flex: 1, minWidth: 100 },

  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AMBER,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addStepBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  emptySteps: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
  emptyStepsText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  stepCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  stepCardUnpublished: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  stepOrderBadgeMuted: { backgroundColor: '#9CA3AF' },
  stepCollapsedBody: { gap: 6 },
  stepCollapsedTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  stepUnpublishedLabel: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  requestDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    marginTop: 2,
  },
  requestDeleteBtnText: { fontSize: 12, fontWeight: '600', color: '#B91C1C' },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOrderText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  stepActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  stepActionBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  stepDeleteBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FEE2E2', marginLeft: 4 },

  subscriptionNote: { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 18 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, fontSize: 14, color: '#EF4444', lineHeight: 20 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pickerSearch: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#F9FAFB',
    fontSize: 14,
    color: '#111827',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: { fontSize: 15, color: '#111827' },
  pickerItemClear: { color: '#9CA3AF' },

  ddBackdrop: { ...StyleSheet.absoluteFillObject },
  ddDropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 999,
  },
  ddSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ddSearchInput: { flex: 1, fontSize: 14, color: '#111827', height: 32 },
  ddOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  ddOptionActive: { backgroundColor: '#FFFBEB' },
  ddOptionText: { fontSize: 14, color: '#111827' },
  ddOptionTextActive: { color: AMBER, fontWeight: '600' },
});