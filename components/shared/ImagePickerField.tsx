// components/shared/ImagePickerField.tsx
// Reusable image pick + preview component for forms.
// Web:    hidden <input type="file"> rendered in JSX, triggered by a styled button
// Native: expo-image-picker launchImageLibraryAsync

import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export interface ImagePickerFieldProps {
  /** Existing image URL shown in edit mode before a new file is selected */
  currentImageUrl?: string | null;
  /** Called when the user picks a new image */
  onImageSelected: (uri: string, filename: string) => void;
  /** Called when the user removes the current/selected image */
  onImageCleared: () => void;
  /** Optional label — defaults to translated "Image" if omitted */
  label?: string;
}

const AMBER = '#F59E0B';

export function ImagePickerField({
  currentImageUrl,
  onImageSelected,
  onImageCleared,
  label,
}: ImagePickerFieldProps) {
  const { t } = useTranslation();
  // Web: ref to the persistent hidden <input type="file"> element in the DOM.
  // We do NOT use document.createElement() because detached elements can be
  // garbage-collected before the async file-picker dialog returns, causing
  // the onchange closure to lose its callback reference (TypeError in prod builds).
  const fileInputRef = useRef<any>(null);

  // Always hold the latest callback in a ref so the input's onChange handler
  // is never stale regardless of parent re-renders.
  const onImageSelectedRef = useRef(onImageSelected);
  useEffect(() => {
    onImageSelectedRef.current = onImageSelected;
  }, [onImageSelected]);

  const handlePickWeb = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePickNative = useCallback(async () => {
    try {
      // Dynamically import expo-image-picker to avoid web bundle issues
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      // Derive filename from URI or use a safe fallback
      const filename = asset.fileName ?? uri.split('/').pop() ?? 'photo.jpg';
      onImageSelected(uri, filename);
    } catch {
      // expo-image-picker not available — silently skip
    }
  }, [onImageSelected]);

  const handlePick = Platform.OS === 'web' ? handlePickWeb : handlePickNative;

  const previewUri = currentImageUrl ?? null;

  return (
    <View style={styles.container}>
      {/* Persistent hidden file input for web — keeps the DOM node alive through
          the async file-picker dialog so the onChange closure is never GC'd. */}
      {Platform.OS === 'web' && (
        // @ts-ignore — raw <input> is valid React Native Web DOM passthrough
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e: any) => {
            const file: File = e.target?.files?.[0];
            if (!file) return;
            const uri = URL.createObjectURL(file);
            onImageSelectedRef.current(uri, file.name);
            // Reset so the same file can be re-selected next time
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
      )}

      <Text style={styles.label}>{label ?? t('imagePicker.label', 'Image')}</Text>

      {previewUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: previewUri }}
            style={styles.preview}
            contentFit="cover"
          />
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={handlePick}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={AMBER} />
              <Text style={styles.changeBtnText}>{t('imagePicker.change')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={onImageCleared}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
              <Text style={styles.removeBtnText}>{t('imagePicker.remove')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.pickBtn}
          onPress={handlePick}
          activeOpacity={0.8}
        >
          <Ionicons name="image-outline" size={22} color="#9CA3AF" />
          <Text style={styles.pickBtnText}>{t('imagePicker.selectImage')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  pickBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickBtnText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  previewContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  preview: {
    width: '100%',
    height: 160,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AMBER,
  },
  changeBtnText: {
    fontSize: 13,
    color: AMBER,
    fontWeight: '600',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  removeBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
});
