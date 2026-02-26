import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_VUxzTEM5D9D93yvhkjbok6kTL3BbnQM1AnqdTLgRbrF';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.posthog.com';
const CONSENT_KEY = 'swigs-cookie-consent';
const APP_NAME = 'swigs-pro';

let initialized = false;

export function getConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

export function acceptConsent() {
  localStorage.setItem(CONSENT_KEY, 'accepted');
  initPostHog();
  trackPageView(window.location.pathname);
}

export function declineConsent() {
  localStorage.setItem(CONSENT_KEY, 'declined');
}

export function withdrawConsent() {
  localStorage.setItem(CONSENT_KEY, 'declined');
  if (initialized) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
}

export function initPostHog() {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (getConsent() !== 'accepted') return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    cookie_domain: '.swigs.online',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    },
    loaded: (ph) => {
      ph.register({ app: APP_NAME });
    },
  });

  initialized = true;
}

export function identifyUser(user) {
  if (!initialized || !user) return;
  const distinctId = user.hubUserId || user._id;
  if (!distinctId) return;

  posthog.identify(distinctId, {
    email: user.email,
    name: user.name,
    app: APP_NAME,
    hub_user_id: user.hubUserId,
  });
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

export function trackEvent(eventName, properties = {}) {
  if (!initialized) return;
  posthog.capture(eventName, { ...properties, app: APP_NAME });
}

export function trackPageView(path) {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: window.location.href, path });
}

// ── Auth tracking ──────────────────────────────────────────────
export function trackLogin(method = 'sso') {
  trackEvent('user_logged_in', { method });
}

export function trackLogout() {
  trackEvent('user_logged_out');
}

// ── Onboarding tracking ───────────────────────────────────────
export function trackOnboardingStep(step, completed) {
  trackEvent('onboarding_step', { step, completed });
}

// ── Feature usage tracking ────────────────────────────────────
export function trackFeatureUsed(feature, properties = {}) {
  trackEvent('feature_used', { feature, ...properties });
}

// ── Business funnel tracking ──────────────────────────────────
export function trackBusinessEvent(action, properties = {}) {
  trackEvent(`business_${action}`, properties);
}

// ── Automation tracking ───────────────────────────────────────
export function trackAutomation(action, properties = {}) {
  trackEvent(`automation_${action}`, properties);
}

// ── Portal tracking (public, no auth) ─────────────────────────
export function trackPortalEvent(action, properties = {}) {
  trackEvent(`portal_${action}`, properties);
}

// ── Settings tracking ─────────────────────────────────────────
export function trackSettingsChanged(section, properties = {}) {
  trackEvent('settings_changed', { section, ...properties });
}

export { posthog };
