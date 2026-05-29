// components/tour/TourCard.tsx
// Reusable tour card component with image overlay, rating, favourites, and completion pill

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Tour } from '../../types';
import { StarRating } from './StarRating';
import { imageHeaders, pickTourImage } from '../../lib/drupal-client';
import { buildTourSlug } from '../../lib/tour-slug';
import { LanguagesRow } from '../ui/LanguagesRow';
import { VerifiedSeal, VERIFIED_GOLD } from '../icons/VerifiedSeal';

interface TourCardProps {
  tour: Tour;
  cardWidth: number;
  langcode: string;
  isAuthenticated?: boolean;
  isFavorite?: boolean;
  isCompleted?: boolean;
  onToggleFavorite?: () => void;
  // Owner-mode props
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Public name of the current owner — passed to the translations modal. */
  ownerPublicName?: string;
}

const CARD_IMAGE_RATIO = 0.65;
const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';
const META_ICON_COLOR = '#9CA3AF';

export function TourCard({
  tour,
  cardWidth,
  langcode,
  isAuthenticated = false,
  isFavorite = false,
  isCompleted = false,
  onToggleFavorite,
  isOwner = false,
  onEdit,
  onDelete,
  ownerPublicName,
}: TourCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const imageHeight = cardWidth * CARD_IMAGE_RATIO;
  const DEFAULT_IMAGES = [
    require('@/assets/images/default-tour-1.jpg'),
    require('@/assets/images/default-tour-2.jpg'),
    require('@/assets/images/default-tour-3.jpg'),
  ];

  // Fuera del componente para que no cambie en cada render
  const hashId = tour.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const stableDefault = DEFAULT_IMAGES[hashId % DEFAULT_IMAGES.length];

  const handlePress = () => {
    const slug = tour.drupalInternalId
      ? buildTourSlug({ country: tour.country?.name, city: tour.city?.name, nid: tour.drupalInternalId })
      : tour.id;
    router.push(`/${langcode}/tour/${slug}`);
  };

  const locationText = [tour.city?.name, tour.country?.name]
    .filter(Boolean)
    .join(', ');

  const cardImage = pickTourImage(tour, 'wide');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* Image with overlays */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={
            cardImage
              ? {
                  uri: cardImage,
                  ...(Object.keys(imageHeaders).length > 0 ? { headers: imageHeaders } : {}),
                }
              : stableDefault
          }
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={tour.id}
          placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7R**0o#DgR4' }}
        />

        {/* Title & location overlay at bottom */}
        <View style={styles.imageOverlay}>
          <Text style={styles.title} numberOfLines={2}>
            {tour.title}
          </Text>
          {locationText ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#D1D5DB" />
              <Text style={styles.location} numberOfLines={1}>
                {locationText}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Favourite heart — only for authenticated users with a toggle handler */}
        {isAuthenticated && onToggleFavorite ? (
          <TouchableOpacity
            style={styles.heartButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleFavorite();
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
        ) : null}

        {/* Completed pill — top-left, authenticated users only */}
        {isAuthenticated && isCompleted ? (
          <View style={styles.completedPill}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <Text style={styles.completedText}>{t('step.completed')}</Text>
          </View>
        ) : null}

        {/* Published / Under review pill — owner mode only */}
        {isOwner ? (
          <View style={[styles.statusPill, tour.published ? styles.statusPublished : styles.statusUnderReview]}>
            <Text style={[styles.statusPillText, tour.published ? styles.statusPublishedText : styles.statusUnderReviewText]}>
              {tour.published ? t('dashboard.tours.published') : t('dashboard.tours.underReview')}
            </Text>
          </View>
        ) : null}

        {/* Delete button — owner mode, top-left */}
        {isOwner && onDelete ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onDelete();
            }}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        ) : null}

      </View>

      {/* Meta area */}
      <View style={styles.metaArea}>
        {/* Row 1: duration + stops (left) · certified pill (right) */}
        <View style={styles.metaRow}>
          <View style={styles.metaItemsLeft}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={META_ICON_COLOR} />
              <Text style={styles.metaText}>
                {tour.duration} {t('home.minutes')}
              </Text>
            </View>
            {(tour.stopsCount ?? 0) > 0 && (
              <>
                <Text style={styles.metaSeparator}>·</Text>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={14} color={META_ICON_COLOR} />
                  <Text style={styles.metaText}>
                    {tour.stopsCount} {t('tour.points')}
                  </Text>
                </View>
              </>
            )}
          </View>
          {!isOwner && tour.published && !tour.authorIsAdmin ? (
            <View style={styles.certifiedPill}>
              <VerifiedSeal size={13} starColor="#FFFFFF" checkColor={VERIFIED_GOLD} />
              <Text style={styles.certifiedPillText} numberOfLines={1}>
                {t('verified.label')}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Row 2: star rating */}
        <View style={styles.ratingRow}>
          <StarRating rating={tour.averageRate} ratingCount={tour.ratingCount} size={14} />
        </View>

        {/* Footer row: language flags (left) + author signature (right),
            vertically aligned on the same baseline. */}
        {!isOwner && (tour.availableLangs?.length || tour.authorIsAdmin || tour.authorPublicName) ? (
          <View style={styles.footerRow}>
            <View style={styles.footerLangs}>
              {tour.availableLangs && tour.availableLangs.length > 0 ? (
                <LanguagesRow langs={tour.availableLangs} size={16} max={6} />
              ) : null}
            </View>
            {tour.authorIsAdmin || tour.authorPublicName ? (
              <Text style={styles.signature} numberOfLines={1}>
                {tour.authorIsAdmin
                  ? t('tours.signature.stepUp')
                  : tour.authorPublicName}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Edit button — owner mode only */}
        {isOwner && onEdit ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onEdit();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil-outline" size={14} color={AMBER_DARK} />
            <Text style={styles.editButtonText}>{t('dashboard.tours.edit')}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Translations are managed from the My Tours action row (TranslationsModal). */}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#f8f8f8',
    overflow: 'hidden',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 10,
  },
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 40,
    paddingBottom: 12,
    backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1))',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  location: {
    color: '#D1D5DB',
    fontSize: 12,
    flex: 1,
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0,0,0,0.18)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }),
  },
  completedPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  completedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  certifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
    // Metallic gold: real gradient on web, solid fallback on native.
    backgroundColor: '#F4B400',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #FDE08A 0%, #F4B400 45%, #C87E0A 75%, #FBD24E 100%)',
          boxShadow: '0 1px 4px rgba(180,130,10,0.45)',
        } as any)
      : {
          shadowColor: '#C87E0A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.45,
          shadowRadius: 3,
          elevation: 2,
        }),
  },
  certifiedPillText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  metaArea: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaItemsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaSeparator: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  // ── Owner-mode styles ────────────────────────────────────────────────────────
  deleteButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(0,0,0,0.15)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
          elevation: 3,
        }),
  },
  statusPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPublished: {
    backgroundColor: '#D1FAE5',
  },
  statusUnderReview: {
    backgroundColor: 'rgba(254,243,199,0.95)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusPublishedText: {
    color: '#065F46',
  },
  statusUnderReviewText: {
    color: '#92400E',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AMBER,
    backgroundColor: '#FFFBEB',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER_DARK,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  footerLangs: {
    flexShrink: 1,
  },
  signature: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6B7280',
    textAlign: 'right',
    flexShrink: 0,
  },
  requestTranslationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  requestTranslationsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
});
