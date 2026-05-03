// components/tour/StepContent.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Linking,
  LayoutChangeEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTTS } from '../../hooks/useTTS';
import { BusinessCard } from './BusinessCard';
import { HtmlText, stripHtmlText } from '../ui/HtmlText';
import type { TourStep } from '../../types';
import { useWindowDimensions } from 'react-native';
import { buildStreetViewUrl } from '../../lib/streetview';

const ORANGE        = '#EC8A00';
const SPEEDS        = [0.75, 1, 1.25, 1.5, 2];
const BAR_WIDTH     = 2;
const BAR_GAP       = 2;
const MAX_BARS      = 80;
const BAR_HEIGHTS_PATTERN = [5, 10, 7, 13, 6, 11, 8, 14, 5, 9, 12, 7, 10, 6, 6, 11, 5, 9, 12, 7];
const PREVIEW_LINES = 4;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Idiomas sin soporte en el servicio TTS del servidor.
const NO_TTS_LANGS = new Set(['el']);

function isGoogleMapsUrl(url: string): boolean {
  return (
      url.startsWith('about:') ||
      url.includes('google.com/maps') ||
      url.includes('maps.google.com') ||
      url.includes('maps.googleapis.com') ||
      url.includes('maps.gstatic.com') ||
      url.includes('googleapis.com') ||
      url.includes('googleusercontent.com') ||
      url.includes('gstatic.com')
  );
}

const SV_INJECT_JS = `
(function() {
  setTimeout(function() {
    var canvasCount = document.querySelectorAll('canvas').length;
    if (canvasCount === 0) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage('sv_unavailable');
    }
  }, 3000);
})();
true;
`;

// ─── Platform-aware Google embed ─────────────────────────────────────────────

interface EmbedProps {
  uri: string;
  height: number;
  interactive?: boolean;
  onUnavailable?: () => void;
}

function WebGoogleEmbed({ uri, height, interactive = false, onUnavailable }: EmbedProps) {
  const SV_WEB_TIMEOUT = 7_000;
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const isMounted  = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Set src to about:blank before DOM removal to abort in-flight Google Maps
      // async ops (GeoPhotoService.GetMetadata) that would otherwise fire
      // callbacks against a destroyed panorama instance.
      if (iframeRef.current) iframeRef.current.src = 'about:blank';
    };
  }, []);

  React.useEffect(() => {
    if (!onUnavailable) return;

    let interacted = false;
    const onBlur = () => { interacted = true; };
    window.addEventListener('blur', onBlur);

    const timer = setTimeout(() => {
      if (!interacted && isMounted.current) onUnavailable();
    }, SV_WEB_TIMEOUT);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
    };
  }, [uri]);

  const wrapStyle = { height, overflow: 'hidden' as const, position: 'relative' as const };
  return (
      <View style={wrapStyle}>
        {/* @ts-ignore */}
        <iframe
            ref={iframeRef}
            src={uri}
            style={{ width: '100%', height: '100%', border: 'none', pointerEvents: interactive ? 'auto' : 'none' }}
            loading="lazy"
            allowFullScreen
            allow="accelerometer *; gyroscope *; geolocation *; fullscreen *; xr-spatial-tracking *"
            referrerPolicy="no-referrer-when-downgrade"
        />
        {!interactive && <View style={StyleSheet.absoluteFill} />}
      </View>
  );
}

function GoogleEmbed({ uri, height, interactive = false, onUnavailable }: EmbedProps) {
  const wrapStyle    = { height, overflow: 'hidden' as const, position: 'relative' as const };
  const webViewRef   = useRef<WebView>(null);

  useEffect(() => {
    return () => { webViewRef.current?.stopLoading(); };
  }, []);

  if (Platform.OS === 'web') {
    return <WebGoogleEmbed uri={uri} height={height} interactive={interactive} onUnavailable={onUnavailable} />;
  }

  return (
      <View style={wrapStyle}>
        <WebView
            ref={webViewRef}
            source={{ uri }}
            scrollEnabled={interactive}
            javaScriptEnabled
            geolocationEnabled={interactive}
            allowsInlineMediaPlayback
            injectedJavaScript={onUnavailable ? SV_INJECT_JS : undefined}
            onMessage={(e) => { if (e.nativeEvent.data === 'sv_unavailable') onUnavailable?.(); }}
            onShouldStartLoadWithRequest={(req) => isGoogleMapsUrl(req.url)}
            style={{ flex: 1, backgroundColor: '#e8e8e8' }}
        />
        {!interactive && <View style={StyleSheet.absoluteFill} pointerEvents="box-only" />}
      </View>
  );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────

interface AccordionSectionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ icon, title, open, onToggle, children }: AccordionSectionProps) {
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [open]);

  return (
      <View style={styles.accordionWrap}>
        <TouchableOpacity style={styles.accordionHeader} onPress={onToggle} activeOpacity={0.75}>
          <Ionicons name={icon} size={18} color={ORANGE} />
          <Text style={styles.accordionTitle}>{title}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#78716c" />
        </TouchableOpacity>
        <Animated.View
            style={{
              overflow: 'hidden',
              maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1200] }),
              opacity: anim,
            }}
        >
          <View style={styles.accordionBody}>{children}</View>
        </Animated.View>
      </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepContentProps {
  step: TourStep;
  isCompleted: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onComplete: () => void;
  langcode: string;
  tourId?: string;
  tourTitle?: string;
}

interface NavMode {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  travelmode: string;
  dirflg: string;
  androidMode: string;
  iosDirMode: string;
}

const NAV_MODES: NavMode[] = [
  { labelKey: 'step.walk',            icon: 'walk-outline',    travelmode: 'walking',   dirflg: 'w', androidMode: 'w', iosDirMode: 'walking'   },
  { labelKey: 'step.bike',            icon: 'bicycle-outline', travelmode: 'bicycling', dirflg: 'b', androidMode: 'b', iosDirMode: 'bicycling' },
  { labelKey: 'step.publicTransport', icon: 'bus-outline',     travelmode: 'transit',   dirflg: 'r', androidMode: 'r', iosDirMode: 'transit'   },
  { labelKey: 'step.drive',           icon: 'car-outline',     travelmode: 'driving',   dirflg: 'd', androidMode: 'd', iosDirMode: 'driving'   },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function SkipIcon({ direction, color }: { direction: 'back' | 'forward'; color: string }) {
  return (
      <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons
            name="reload-outline"
            size={32}
            color={color}
            style={direction === 'forward' ? { transform: [{ scaleX: -1 }] } : undefined}
        />
        <Text style={{ position: 'absolute', fontSize: 9, fontWeight: '700', color }}>15</Text>
      </View>
  );
}

const MAP_HEIGHT = 220;

// ─── NavBlock ─────────────────────────────────────────────────────────────────

interface NavBlockProps {
  step: TourStep;
  selectedMode: string | null;
  directionsUrl: string | null;
  activeMode: NavMode | undefined;
  streetViewExpanded: boolean;
  hasStreetView: boolean;
  streetViewUrl: string | null;
  svKey: number;
  svAvailable: boolean;
  isDesktop: boolean;
  onModeSelect: (mode: NavMode) => void;
  onGoToSite: () => void;
  onToggleStreetView: () => void;
  onSvUnavailable: () => void;
  t: (key: string) => string;
}

function NavBlock({
                    step,
                    selectedMode,
                    directionsUrl,
                    activeMode,
                    streetViewExpanded,
                    hasStreetView,
                    streetViewUrl,
                    svKey,
                    svAvailable,
                    isDesktop,
                    onModeSelect,
                    onGoToSite,
                    onToggleStreetView,
                    onSvUnavailable,
                    t,
                  }: NavBlockProps) {
  if (!step.location) return null;

  const showingSV  = streetViewExpanded && hasStreetView;
  const mapUri     = showingSV ? streetViewUrl : directionsUrl;
  const mapHeight  = showingSV ? 320 : (isDesktop ? 300 : MAP_HEIGHT);

  return (
      <>
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>{t('step.howToGet')}</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.chipsRow}>
          {NAV_MODES.map((mode) => {
            const active = selectedMode === mode.travelmode;
            return (
                <TouchableOpacity
                    key={mode.travelmode}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onModeSelect(mode)}
                    activeOpacity={0.7}
                >
                  <Ionicons name={mode.icon} size={17} color={active ? ORANGE : '#57534e'} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t(mode.labelKey)}
                  </Text>
                </TouchableOpacity>
            );
          })}
        </View>

        {activeMode && mapUri && (
            <View style={[styles.navContent, isDesktop && styles.navContentDesktop]}>
              {/* Mapa o Street View */}
              <View style={[styles.navMapWrap, isDesktop && styles.navMapWrapDesktop]}>
                <GoogleEmbed
                    key={showingSV ? `sv-${svKey}` : `map-${selectedMode}`}
                    uri={mapUri}
                    height={mapHeight}
                    interactive={showingSV}
                    onUnavailable={showingSV ? onSvUnavailable : undefined}
                />
              </View>

              {/* Botones */}
              <View style={[styles.navActionsWrap, isDesktop && styles.navActionsWrapDesktop]}>
                <TouchableOpacity
                    style={[styles.startRouteBtn, isDesktop && { flex: 1 }]}
                    onPress={onGoToSite}
                    activeOpacity={0.85}
                >
                  <Ionicons name="navigate" size={16} color="#ffffff" />
                  <Text style={styles.startRouteBtnText}>{t('step.goToSite')}</Text>
                </TouchableOpacity>

                {hasStreetView && (
                    <TouchableOpacity
                        style={[styles.streetViewToggle, isDesktop && { flex: 1 }]}
                        onPress={onToggleStreetView}
                        activeOpacity={0.8}
                    >
                      <Ionicons name={showingSV ? 'map-outline' : 'eye-outline'} size={16} color={ORANGE} />
                      <Text style={styles.streetViewToggleText}>
                        {showingSV ? t('step.showMap') : t('step.streetView')}
                      </Text>
                    </TouchableOpacity>
                )}
              </View>
            </View>
        )}
      </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepContent({
                              step,
                              isCompleted,
                              isActive,
                              isExpanded,
                              onComplete,
                              langcode,
                              tourId,
                              tourTitle,
                            }: StepContentProps) {
  const { t } = useTranslation();

  const [confirmed, setConfirmed]               = useState(false);
  const [expanded, setExpanded]                 = useState(false);
  const [selectedMode, setSelectedMode]         = useState<string | null>('walking');
  const [svAvailable, setSvAvailable]           = useState(true);
  const [svKey, setSvKey]                       = useState(0);
  const [streetViewExpanded, setStreetViewExpanded] = useState(false);
  const [historyOpen, setHistoryOpen]           = useState(isCompleted);
  const [waveContainerWidth, setWaveContainerWidth] = useState(0);

  const svRetriesRef = useRef(0);
  const MAX_SV_RETRIES = 1;

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const descriptionText = step.description ?? '';
  const ttsText         = stripHtmlText(descriptionText);
  const ttsLangcode     = step.contentLangcode ?? langcode;
  const tts             = useTTS(ttsText, ttsLangcode, { tourTitle, stepTitle: step.title });
  const isPlaying       = tts.playState === 'playing';

  const waveAnims = useRef(
      Array.from({ length: MAX_BARS }, () => new Animated.Value(0.4))
  ).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);

  // Computed bar count from measured container width
  const barCount = waveContainerWidth > 0
      ? Math.min(MAX_BARS, Math.max(4, Math.floor((waveContainerWidth + BAR_GAP) / (BAR_WIDTH + BAR_GAP))))
      : 20;

  // ── Waveform animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (isPlaying) {
      waveLoops.current = waveAnims.slice(0, barCount).map((anim, i) => {
        const loop = Animated.loop(
            Animated.sequence([
              Animated.timing(anim, { toValue: 1,    duration: 280 + i * 35, useNativeDriver: USE_NATIVE_DRIVER }),
              Animated.timing(anim, { toValue: 0.25, duration: 280 + i * 35, useNativeDriver: USE_NATIVE_DRIVER }),
            ])
        );
        loop.start();
        return loop;
      });
    } else {
      waveLoops.current.forEach((l) => l.stop());
      waveAnims.forEach((a) => a.setValue(0.4));
    }
    return () => waveLoops.current.forEach((l) => l.stop());
  }, [isPlaying, barCount]);

  // ── Prefetch ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isActive && ttsText) tts.prefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const prevExpandedRef = useRef(isExpanded);
  useEffect(() => {
    if (isExpanded && !prevExpandedRef.current) {
      if (ttsText) tts.prefetch();
    }
    if (prevExpandedRef.current && !isExpanded) {
      tts.handleStop();
    }
    prevExpandedRef.current = isExpanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  // ── Auto-open history accordion when confirmed ────────────────────────────

  useEffect(() => {
    if (confirmed) setHistoryOpen(true);
  }, [confirmed]);

  // ── Reset al completar ────────────────────────────────────────────────────

  useEffect(() => {
    if (isCompleted) {
      setConfirmed(false);
      setHistoryOpen(true);
      setStreetViewExpanded(false);
      setSelectedMode('walking');
    }
  }, [isCompleted]);

  // ── Street View retry / fallback ─────────────────────────────────────────

  const handleSvUnavailable = useCallback(() => {
    if (svRetriesRef.current < MAX_SV_RETRIES) {
      svRetriesRef.current += 1;
      setSvKey((k) => k + 1);
    } else {
      svRetriesRef.current = 0;
      setSvAvailable(false);
    }
  }, []);

  // ── URLs ──────────────────────────────────────────────────────────────────

  const hasLocation = !!step.location;

  const streetViewUrl = buildStreetViewUrl(step);

  const staticMapUrl = step.location
      ? `https://maps.google.com/maps?q=${step.location.lat},${step.location.lon}&z=17&output=embed`
      : null;

  const activeMode    = NAV_MODES.find((m) => m.travelmode === selectedMode);
  const directionsUrl = step.location && activeMode
      ? `https://maps.google.com/maps?saddr=My+Location&daddr=${step.location.lat},${step.location.lon}&dirflg=${activeMode.dirflg}&output=embed`
      : null;

  // ── Nav handlers ──────────────────────────────────────────────────────────

  const handleModeSelect = (mode: NavMode) => {
    if (selectedMode === mode.travelmode) {
      setSelectedMode(null);
    } else {
      setSelectedMode(mode.travelmode);
      if (streetViewExpanded) setStreetViewExpanded(false);
    }
  };

  const resetNavState = () => {
    setSelectedMode(null);
  };

  const handleConfirm = () => {
    resetNavState();
    setStreetViewExpanded(false);
    setConfirmed(true);
  };

  const openNearbyMaps = async (query: string) => {
    if (!step.location) return;
    const { lat, lon } = step.location;
    const encodedQuery = encodeURIComponent(query);

    if (Platform.OS === 'ios') {
      const googleUrl = `comgooglemaps://?q=${encodedQuery}&center=${lat},${lon}`;
      const canGm = await Linking.canOpenURL(googleUrl).catch(() => false);
      Linking.openURL(canGm ? googleUrl : `maps://?q=${encodedQuery}&ll=${lat},${lon}`);
    } else if (Platform.OS === 'android') {
      Linking.openURL(`geo:${lat},${lon}?q=${encodedQuery}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/${encodedQuery}/@${lat},${lon},16z`);
    }
  };

  const handleGoToSite = async () => {
    if (!step.location || !activeMode) return;
    const { lat, lon } = step.location;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=${activeMode.travelmode}`;

    if (Platform.OS === 'ios') {
      const gmUrl = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=${activeMode.iosDirMode}`;
      const canGm = await Linking.canOpenURL(gmUrl).catch(() => false);
      Linking.openURL(canGm ? gmUrl : `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=${activeMode.androidMode}`);
    } else if (Platform.OS === 'android') {
      const gmUrl = `google.navigation:q=${lat},${lon}&mode=${activeMode.androidMode}`;
      const canGm = await Linking.canOpenURL(gmUrl).catch(() => false);
      Linking.openURL(canGm ? gmUrl : webUrl);
    } else {
      Linking.openURL(webUrl);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
      <View style={styles.container}>

        {/* 1. NAVEGACIÓN */}
        {hasLocation && (
            <NavBlock
                step={step}
                selectedMode={selectedMode}
                directionsUrl={directionsUrl}
                activeMode={activeMode}
                streetViewExpanded={streetViewExpanded}
                hasStreetView={!!(svAvailable && streetViewUrl)}
                streetViewUrl={streetViewUrl}
                svKey={svKey}
                svAvailable={svAvailable}
                isDesktop={isDesktop}
                onModeSelect={handleModeSelect}
                onGoToSite={handleGoToSite}
                onToggleStreetView={() => setStreetViewExpanded((v) => !v)}
                onSvUnavailable={handleSvUnavailable}
                t={t}
            />
        )}

        {/* 3. CONFIRMACIÓN DE LLEGADA */}
        {isActive && !confirmed && !isCompleted && (
            <View style={styles.arrivalCard}>
              <Text style={styles.arrivalTitle}>{t('step.confirmTitle')}</Text>
              <Text style={styles.arrivalSub}>{t('step.confirmSubtitle')}</Text>
              <TouchableOpacity style={styles.arrivalBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                <Text style={styles.arrivalBtnText}>{t('step.confirmYes')}</Text>
              </TouchableOpacity>
            </View>
        )}

        {/* 4. CONTENIDO (tras confirmar o si completado) */}
        {(confirmed || isCompleted) && (
            <>
              {/* Acordeón Historia y Audioguía */}
              {descriptionText ? (
                  <AccordionSection
                      icon="headset-outline"
                      title={t('step.historyAndAudio')}
                      open={historyOpen}
                      onToggle={() => setHistoryOpen((v) => !v)}
                  >
                    {/* Reproductor de audio o aviso sin soporte */}
                    {NO_TTS_LANGS.has(langcode) ? (
                        <View style={styles.ttsWarning}>
                          <Ionicons name="information-circle-outline" size={16} color="#664d03" />
                          <Text style={styles.ttsWarningText}>{t('step.ttsUnavailable')}</Text>
                        </View>
                    ) : (
                        <View style={[styles.playerCard, isDesktop && styles.playerCardDesktop]}>
                          {/* Título + velocidad + stop */}
                          <View style={styles.playerTopRow}>
                            <Text style={styles.playerTitle} numberOfLines={1}>{step.title}</Text>
                            <TouchableOpacity onPress={tts.handleSpeedChange} style={styles.speedChip} activeOpacity={0.7}>
                              <Text style={styles.speedChipText}>{SPEEDS[tts.speedIndex]}x</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={tts.handleStop} style={styles.stopChip} activeOpacity={0.7}>
                              <Ionicons name="stop" size={12} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                          </View>

                          {/* Waveform dinámica */}
                          <View
                              style={styles.waveform}
                              onLayout={(e: LayoutChangeEvent) =>
                                  setWaveContainerWidth(e.nativeEvent.layout.width)
                              }
                          >
                            {Array.from({ length: barCount }, (_, i) => (
                                <Animated.View
                                    key={i}
                                    style={[
                                      styles.waveBar,
                                      {
                                        height: BAR_HEIGHTS_PATTERN[i % BAR_HEIGHTS_PATTERN.length],
                                        backgroundColor: isPlaying ? ORANGE : 'rgba(255,255,255,0.16)',
                                        transform: [{ scaleY: waveAnims[i] }],
                                      },
                                    ]}
                                />
                            ))}
                          </View>

                          {/* Controles + tiempos en una sola fila */}
                          <View style={styles.playerControlsRow}>
                            <Text style={styles.playerTimeActive}>{formatTime(tts.elapsed)}</Text>
                            <TouchableOpacity onPress={() => tts.handleSeek(-15)} activeOpacity={0.7}>
                              <SkipIcon direction="forward" color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.playBtn} onPress={tts.handlePlayPause} activeOpacity={0.8}>
                              {tts.playState === 'loading' ? (
                                  <Ionicons name="ellipsis-horizontal" size={14} color="#FFFFFF" />
                              ) : (
                                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={15} color="#FFFFFF" />
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => tts.handleSeek(15)} activeOpacity={0.7}>
                              <SkipIcon direction="back" color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                            <Text style={styles.playerTimeDim}>
                              {formatTime(tts.totalDuration > 0 ? Math.round(tts.totalDuration / SPEEDS[tts.speedIndex]) : 0)}
                            </Text>
                          </View>
                        </View>
                    )}

                    {/* Descripción con read more/less */}
                    <View style={styles.descDivider} />
                    <HtmlText
                        html={descriptionText}
                        style={styles.descText}
                        numberOfLines={expanded ? undefined : PREVIEW_LINES}
                    />
                    {ttsText.length > 200 ? (
                        <TouchableOpacity
                            style={styles.readMoreBtn}
                            onPress={() => setExpanded((v) => !v)}
                            activeOpacity={0.7}
                        >
                          <Ionicons name={expanded ? 'remove-outline' : 'add-outline'} size={11} color={ORANGE} />
                          <Text style={styles.readMoreText}>
                            {expanded ? t('step.readLess') : t('step.readMore')}
                          </Text>
                        </TouchableOpacity>
                    ) : null}
                  </AccordionSection>
              ) : null}

              {/* BusinessCard (siempre visible) */}
              {step.featuredBusiness ? (
                  <BusinessCard
                      business={step.featuredBusiness}
                      langcode={langcode}
                      tourId={tourId}
                      stepId={step.id}
                  />
              ) : null}

              {/* Cerca de aquí (siempre visible) */}
              {hasLocation && step.location ? (
                  <View style={styles.nearbyContainer}>
                    <Text style={styles.nearbyTitle}>{t('step.nearbyTitle')}</Text>
                    <View style={[styles.nearbyChips, isDesktop && styles.nearbyChipsDesktop]}>
                      {[
                        { key: 'step.nearbyRestaurants', query: 'restaurants',         icon: 'restaurant-outline' },
                        { key: 'step.nearbyCafes',       query: 'cafes',               icon: 'cafe-outline' },
                        { key: 'step.nearbyAttractions', query: 'tourist attractions',  icon: 'camera-outline' },
                      ].map(({ key, query, icon }) => (
                          <TouchableOpacity
                              key={key}
                              style={styles.nearbyChip}
                              onPress={() => openNearbyMaps(query)}
                              activeOpacity={0.75}
                          >
                            <Ionicons name={icon as any} size={15} color={ORANGE} />
                            <Text style={styles.nearbyChipText}>{t(key)}</Text>
                            <View style={{ flex: 1 }} />
                            <Ionicons name="chevron-forward" size={14} color={ORANGE} />
                          </TouchableOpacity>
                      ))}
                    </View>
                  </View>
              ) : null}

              {/* Botón Completar parada (siempre visible) */}
              {isActive && !isCompleted ? (
                  <TouchableOpacity style={styles.completeBtn} onPress={onComplete} activeOpacity={0.8}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.completeBtnText}>{t('step.markCompleted')}</Text>
                  </TouchableOpacity>
              ) : null}
            </>
        )}

      </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 10,
    paddingBottom: 4,
  },

  // ── Navigation section ──────────────────────────────────────────────────────
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b0a898',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    flexShrink: 0,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ede9e2',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: '#f5f4f0',
    borderWidth: 1.5,
    borderColor: '#e5e1d8',
    borderRadius: 10,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: ORANGE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716c',
    textAlign: 'center',
  },
  chipTextActive: {
    color: ORANGE,
  },
  // ── Nav content layout ──────────────────────────────────────────────────────
  navContent: {
    gap: 10,
  },
  navContentDesktop: {
    gap: 10,
  },
  navMapWrap: {
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },
  navMapWrapDesktop: {},
  navActionsWrap: {
    gap: 8,
  },
  navActionsWrapDesktop: {
    flexDirection: 'row',
    gap: 10,
  },

  startRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    backgroundColor: ORANGE,
    borderRadius: 10,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  startRouteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  streetViewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: '#FFFFFF',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  streetViewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE,
  },

  // ── Arrival card ────────────────────────────────────────────────────────────
  arrivalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: ORANGE,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  arrivalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1917',
    textAlign: 'center',
  },
  arrivalSub: {
    fontSize: 13,
    color: '#78716c',
    textAlign: 'center',
  },
  arrivalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ORANGE,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  arrivalBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Accordion ───────────────────────────────────────────────────────────────
  accordionWrap: {
    backgroundColor: '#faf9f6',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#ece9e3',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  accordionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#44403c',
  },
  accordionBody: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 10,
  },

  // ── Audio player ────────────────────────────────────────────────────────────
  playerCard: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  playerCardDesktop: {
    alignSelf: 'stretch',
  },
  playerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  playerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
    height: 18,
    overflow: 'hidden',
  },
  waveBar: {
    width: BAR_WIDTH,
    borderRadius: 2,
    transformOrigin: 'center',
  },
  playerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  playerTimeActive: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    fontVariant: ['tabular-nums'] as any,
  },
  playerTimeDim: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    fontVariant: ['tabular-nums'] as any,
  },
  speedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  speedChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  stopChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Description (inside accordion) ─────────────────────────────────────────
  descDivider: {
    height: 1,
    backgroundColor: '#ece9e3',
    marginTop: 4,
    marginBottom: 4,
  },
  descText: {
    fontSize: 15,
    color: '#44403c',
    lineHeight: 23,
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
  },

  // ── Nearby ──────────────────────────────────────────────────────────────────
  nearbyContainer: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  nearbyTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  nearbyChips: {
    flexDirection: 'column',
    gap: 6,
  },
  nearbyChipsDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nearbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  nearbyChipText: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '500',
  },

  // ── Complete button ─────────────────────────────────────────────────────────
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    backgroundColor: '#22c55e',
    borderRadius: 11,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 2,
  },
  completeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── TTS warning ─────────────────────────────────────────────────────────────
  ttsWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ttsWarningText: {
    fontSize: 13,
    color: '#664d03',
    flex: 1,
    lineHeight: 19,
  },
});
