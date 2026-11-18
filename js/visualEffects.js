// Presentation-only controls: this module never reads or changes ledger data.
(() => {
  const key = 'pocket-ledger-visual-effects';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowEnd = () => (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
    || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 2);
  const selectedMode = () => reducedMotion.matches || lowEnd() ? 'lite' : (localStorage.getItem(key) || 'full');
  const applyMode = () => {
    const mode = selectedMode();
    document.body.dataset.visualEffects = mode;
    const selector = document.querySelector('#visualEffectsSelect');
    if (selector) selector.value = mode;
  };
  applyMode();
  document.querySelector('#visualEffectsSelect')?.addEventListener('change', event => {
    localStorage.setItem(key, event.target.value === 'lite' ? 'lite' : 'full');
    applyMode();
  });
  reducedMotion.addEventListener?.('change', applyMode);

  // The cards lean gently toward a fine pointer and always settle back smoothly.
  const tiltCards = document.querySelectorAll('#dashboardAvailableCard, #entryCard');
  tiltCards.forEach(card => {
    card.addEventListener('pointermove', event => {
      if (document.body.dataset.visualEffects !== 'full' || reducedMotion.matches || event.pointerType === 'touch') return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(x * 6).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
})();
