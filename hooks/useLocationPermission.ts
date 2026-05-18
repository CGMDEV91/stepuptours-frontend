import * as Location from 'expo-location';
import { useEffect } from 'react';
import { isNative } from '../lib/platform';

export function useLocationPermission() {
  useEffect(() => {
    if (!isNative) return;
    Location.requestForegroundPermissionsAsync();
  }, []);
}
