// Content script for detecting call tracking and phone numbers
// Fast and accurate detection - prioritizes domain matching

(function() {
  'use strict';

  console.log('[Call Tracker Detector] Content script loaded');

  // Early exit if extension context is invalid
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.log('[Call Tracker Detector] Extension context invalid, exiting');
      return;
    }
  } catch (e) {
    console.log('[Call Tracker Detector] Extension context check failed, exiting');
    return;
  }

  // State management
  let originalNumbers = new Map();
  let detectedTrackers = [];
  let currentNumbers = new Map();
  let providers = [];
  let scanComplete = false;

  // Load provider library
  async function loadProviders() {
    try {
      const response = await fetch(chrome.runtime.getURL('providers.json'));
      const data = await response.json();
      providers = data.providers || [];
      console.log('[Call Tracker Detector] Loaded', providers.length, 'providers');
      return true;
    } catch (error) {
      console.error('[Call Tracker Detector] Error loading providers:', error);
      return false;
    }
  }

  // Extract hostname from URL
  function getHostname(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (e) {
      const match = url.toLowerCase().match(/(?:https?:)?\/\/([^\/\?#]+)/);
      return match ? match[1] : '';
    }
  }

  // Check if hostname matches domain (exact or subdomain)
  function matchesDomain(hostname, domain) {
    const d = domain.toLowerCase();
    return hostname === d || hostname.endsWith('.' + d);
  }

  // Detect tracking scripts in the page
  function detectTrackingScripts() {
    console.log('[Call Tracker Detector] === DETECTION START ===');

    const scripts = document.querySelectorAll('script[src]');
    console.log(`[Call Tracker Detector] Scanning ${scripts.length} scripts`);

    const found = new Set();
    detectedTrackers = [];

    // PASS 1: Check external script domains (MOST RELIABLE)
    scripts.forEach(script => {
      const url = script.src;
      if (!url) return;

      const hostname = getHostname(url);
      if (!hostname) return;

      for (const provider of providers) {
        if (provider.domains.some(d => matchesDomain(hostname, d))) {
          if (!found.has(provider.id)) {
            found.add(provider.id);
            console.log(`[Call Tracker Detector] ✓ ${provider.name} - Script: ${url}`);
          }
          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: url,
            matchType: 'domain'
          });
          break; // Found match, stop checking other providers for this script
        }
      }
    });

    // PASS 2: Check inline scripts for VERY SPECIFIC signatures ONLY
    // Only if no domain match was found for a provider
    const inlineScripts = document.querySelectorAll('script:not([src])');

    for (const script of inlineScripts) {
      const content = script.textContent;
      if (!content || content.length < 10) continue;

      for (const provider of providers) {
        // Skip if already found via domain
        if (found.has(provider.id)) continue;

        // Only match on VERY SPECIFIC signatures (function calls, unique APIs)
        const specificSignatures = provider.signatures.filter(sig =>
          sig.includes('.') || sig.includes('_') || sig.startsWith('window.')
        );

        const hasSpecificMatch = specificSignatures.some(sig => content.includes(sig));

        if (hasSpecificMatch) {
          found.add(provider.id);
          console.log(`[Call Tracker Detector] ✓ ${provider.name} - Inline script signature`);
          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: 'inline script',
            isInline: true,
            matchType: 'signature'
          });
          break;
        }
      }
    }

    console.log(`[Call Tracker Detector] === FOUND: ${found.size} provider(s) ===`);
    if (found.size > 0) {
      console.log('[Call Tracker Detector] Providers:', Array.from(found).map(id =>
        providers.find(p => p.id === id)?.name
      ));
    }

    return Array.from(found);
  }

  // Detect number swaps
  function detectNumberSwaps() {
    const swaps = [];
    const currentSet = new Set(currentNumbers.keys());
    const originalSet = new Set(originalNumbers.keys());

    originalSet.forEach(origKey => {
      if (!currentSet.has(origKey)) {
        const original = originalNumbers.get(origKey);
        currentSet.forEach(currKey => {
          if (!originalSet.has(currKey)) {
            swaps.push({
              original: original.formatted,
              tracking: currentNumbers.get(currKey).formatted,
              originalNormalized: origKey,
              trackingNormalized: currKey,
              locations: original.locations,
              swappedAt: Date.now()
            });
          }
        });
      }
    });

    return swaps;
  }

  // Capture original phone numbers
  function captureOriginalNumbers() {
    const numbers = findPhoneNumbersInElement(document.body);
    numbers.forEach(numberInfo => {
      const key = numberInfo.normalized;
      if (!originalNumbers.has(key)) {
        originalNumbers.set(key, {
          ...numberInfo,
          foundAt: Date.now(),
          locations: [getElementLocation(numberInfo.element)]
        });
      } else {
        const existing = originalNumbers.get(key);
        const location = getElementLocation(numberInfo.element);
        if (!existing.locations.includes(location)) {
          existing.locations.push(location);
        }
      }
    });
  }

  // Scan current numbers
  function scanCurrentNumbers() {
    currentNumbers.clear();
    const numbers = findPhoneNumbersInElement(document.body);
    numbers.forEach(numberInfo => {
      const key = numberInfo.normalized;
      if (!currentNumbers.has(key)) {
        currentNumbers.set(key, {
          ...numberInfo,
          count: 1,
          locations: [getElementLocation(numberInfo.element)]
        });
      } else {
        currentNumbers.get(key).count++;
        const location = getElementLocation(numberInfo.element);
        if (!currentNumbers.get(key).locations.includes(location)) {
          currentNumbers.get(key).locations.push(location);
        }
      }
    });
  }

  // Update badge and storage
  function updateBadgeAndStorage() {
    const swaps = detectNumberSwaps();

    const results = {
      url: window.location.href,
      detectedTrackers: detectedTrackers,
      originalNumbers: Array.from(originalNumbers.values()),
      currentNumbers: Array.from(currentNumbers.values()),
      swaps: swaps,
      timestamp: Date.now(),
      scanComplete: true
    };

    // Send to background
    try {
      chrome.runtime.sendMessage({
        action: 'updateDetection',
        data: results
      }).catch(() => {});
    } catch (e) {}

    // Store locally
    try {
      chrome.storage.local.set({
        [`detection_${window.location.href}`]: results
      }).catch(() => {});
    } catch (e) {}
  }

  // Run detection immediately
  function runDetection() {
    console.log('[Call Tracker Detector] Running detection...');

    captureOriginalNumbers();
    detectTrackingScripts();

    // Wait only 2 seconds for number swaps
    setTimeout(() => {
      scanCurrentNumbers();
      updateBadgeAndStorage();
      scanComplete = true;
    }, 2000);
  }

  // Message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getDetection') {
      sendResponse({
        detectedTrackers: detectedTrackers,
        originalNumbers: Array.from(originalNumbers.values()),
        currentNumbers: Array.from(currentNumbers.values()),
        swaps: detectNumberSwaps(),
        scanComplete: scanComplete
      });
      return true;
    }

    if (request.action === 'rescan') {
      originalNumbers.clear();
      currentNumbers.clear();
      detectedTrackers = [];
      runDetection();
      sendResponse({ success: true });
      return true;
    }
  });

  // Initialize and run IMMEDIATELY on page load
  async function initialize() {
    const loaded = await loadProviders();
    if (!loaded) {
      console.error('[Call Tracker Detector] Failed to load providers');
      return;
    }

    // Run detection immediately when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runDetection);
    } else {
      runDetection();
    }
  }

  // Start immediately
  initialize();

})();
