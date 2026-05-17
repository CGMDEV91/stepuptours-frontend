// lib/intro-state.ts
// Flag en memoria (no persistido) que indica si la pantalla de introducción ya se
// mostró en esta apertura de la app. Se reinicia cada vez que el proceso arranca,
// de modo que el invitado vuelve a ver las slides al reabrir la app nativa.
let introShownThisLaunch = false;

export function wasIntroShown(): boolean {
  return introShownThisLaunch;
}

export function markIntroShown(): void {
  introShownThisLaunch = true;
}
