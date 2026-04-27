// lib/tour-jsonld.ts
// schema.org JSON-LD structured data for tour detail pages.

import type { Tour } from '../types';

export function buildTourJsonLd(
  tour: Tour,
  canonicalUrl: string,
  langcode: string,
): object[] {
  const touristTrip: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    '@id': canonicalUrl,
    name: tour.title,
    url: canonicalUrl,
    inLanguage: langcode,
    provider: {
      '@type': 'Organization',
      name: 'StepUp Tours',
      url: process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com',
    },
  };

  const rawDescription = tour.description?.replace(/<[^>]+>/g, '').trim();
  if (rawDescription) touristTrip.description = rawDescription.slice(0, 500);
  if (tour.image) touristTrip.image = tour.image;
  if (tour.duration) touristTrip.duration = `PT${tour.duration}M`;

  if (tour.city || tour.country) {
    const destination: Record<string, any> = { '@type': 'City' };
    if (tour.city) destination.name = tour.city.name;
    if (tour.country) {
      destination.containedInPlace = { '@type': 'Country', name: tour.country.name };
    }
    if (tour.location) {
      destination.geo = {
        '@type': 'GeoCoordinates',
        latitude: tour.location.lat,
        longitude: tour.location.lon,
      };
    }
    touristTrip.itinerary = destination;
  }

  if (tour.ratingCount > 0 && tour.averageRate > 0) {
    touristTrip.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: tour.averageRate.toFixed(1),
      reviewCount: tour.ratingCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com'}/${langcode}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: tour.title,
        item: canonicalUrl,
      },
    ],
  };

  return [touristTrip, breadcrumb];
}
