import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_VUxzTEM5D9D93yvhkjbok6kTL3BbnQM1AnqdTLgRbrF';
const POSTHOG_HOST = 'https://eu.posthog.com';
const CONSENT_KEY = 'swigs-cookie-consent';

let initialized = false;

export function getConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

export function acceptConsent() {
  localStorage.setItem(CONSENT_KEY, 'accepted');
  initPostHog();
  // Fire the first pageview immediately after consent
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
    capture_pageview: false, // Manual via router hook
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    cookie_domain: '.swigs.online',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    },
    loaded: (ph) => {
      ph.register({ app: 'swigs-workflow' });
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
    app: 'swigs-workflow',
    hub_user_id: user.hubUserId,
  });
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

export function trackEvent(eventName, properties = {}) {
  if (!initialized) return;
  posthog.capture(eventName, properties);
}

export function trackPageView(path) {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: window.location.href, path });
}

export { posthog };
