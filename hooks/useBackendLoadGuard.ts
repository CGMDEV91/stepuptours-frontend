// hooks/useBackendLoadGuard.ts
// Vigila la carga de datos del backend para una página. Si tras `timeoutMs` no
// hay datos, o si aparece un error explícito, activa el modal global de error
// de servidor. En páginas no-home, además redirige a la home.

import { useEffect, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useServerErrorStore } from '../stores/serverError.store';

interface Options {
  isLoading: boolean;
  hasData: boolean;
  error: unknown;
  timeoutMs?: number;
  redirectToHomeOnFail?: boolean;
  // Si true, también dispara el modal cuando, pasado el timeout, el fetch ha
  // terminado sin datos (respuesta vacía). Útil para listados donde "0 items"
  // se considera fallo (home), pero no para páginas con resultado legítimamente
  // vacío (favoritos/completados de un usuario nuevo).
  treatEmptyAsFailure?: boolean;
  // Si true, redirige a home sin mostrar el modal — el recurso pedido no existe
  // (404). Distingue "recurso inexistente" de "problema real de servidor".
  notFound?: boolean;
}

export function useBackendLoadGuard({
  isLoading,
  hasData,
  error,
  timeoutMs = 5000,
  redirectToHomeOnFail = false,
  treatEmptyAsFailure = false,
  notFound = false,
}: Options) {
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const show = useServerErrorStore((s) => s.show);
  const isModalVisible = useServerErrorStore((s) => s.isVisible);
  const firedRef = useRef(false);

  // Cuando el usuario cierra el modal, rearmamos el guard: si el siguiente
  // intento de fetch también falla, el modal debe volver a aparecer.
  useEffect(() => {
    if (!isModalVisible) firedRef.current = false;
  }, [isModalVisible]);
  // Una vez vimos datos, no volvemos a disparar por "respuesta vacía":
  // un filtro que devuelve 0 resultados no es fallo de servidor.
  const everHadDataRef = useRef(false);

  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (redirectToHomeOnFail && langcode) {
      router.replace(`/${langcode}` as any);
    }
    show();
  };

  useEffect(() => {
    if (hasData) {
      everHadDataRef.current = true;
      firedRef.current = false;
    }
  }, [hasData]);

  // Error explícito → disparar inmediatamente
  useEffect(() => {
    if (!error || firedRef.current) return;
    fire();
  }, [error]);

  // 404 / recurso inexistente: redirige a home sin mostrar el modal.
  useEffect(() => {
    if (!notFound || firedRef.current) return;
    firedRef.current = true;
    if (langcode) router.replace(`/${langcode}` as any);
  }, [notFound]);

  // Timeout: por defecto solo si sigue cargando; con treatEmptyAsFailure
  // (y mientras nunca hayamos visto datos), también si terminó sin datos.
  useEffect(() => {
    if (firedRef.current) return;
    if (hasData) return;
    const emptyCountsAsFailure = treatEmptyAsFailure && !everHadDataRef.current;
    if (!isLoading && !emptyCountsAsFailure) return;

    const id = setTimeout(() => {
      if (firedRef.current || hasData) return;
      fire();
    }, timeoutMs);

    return () => clearTimeout(id);
  }, [isLoading, hasData, timeoutMs, treatEmptyAsFailure]);
}
