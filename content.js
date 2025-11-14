// Content script for detecting call tracking and phone numbers

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

  // Detect tracking scripts in the page
  function detectTrackingScripts() {
    console.log('[Call Tracker Detector] === STARTING DETECTION ===');

    const scripts = document.querySelectorAll('script[src]');
    console.log('[Call Tracker Detector] Found', scripts.length, 'script tags on page');

    const detectedProviders = new Set();
    detectedTrackers = []; // Reset

    scripts.forEach((script, idx) => {
      const srcUrl = script.src;
      if (!srcUrl) return;

      console.log(`[Call Tracker Detector] Script ${idx + 1}: ${srcUrl}`);

      const srcLower = srcUrl.toLowerCase();
      let hostname = '';

      // Extract hostname
      try {
        const url = new URL(srcUrl);
        hostname = url.hostname.toLowerCase();
      } catch (e) {
        const match = srcLower.match(/(?:https?:)?\/\/([^\/\?#]+)/);
        if (match) hostname = match[1];
      }

      if (!hostname) return;

      // Check each provider
      providers.forEach(provider => {
        // Check domains
        const domainMatch = provider.domains.some(domain => {
          const d = domain.toLowerCase();
          return hostname === d || hostname.endsWith('.' + d);
        });

        if (domainMatch) {
          console.log(`[Call Tracker Detector] ✓✓✓ MATCH: ${provider.name} (domain: ${hostname})`);

          if (!detectedProviders.has(provider.id)) {
            detectedProviders.add(provider.id);
          }

          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: srcUrl,
            element: script
          });
        }
      });
    });

    // Check inline scripts
    const inlineScripts = document.querySelectorAll('script:not([src])');
    console.log('[Call Tracker Detector] Checking', inlineScripts.length, 'inline scripts');

    inlineScripts.forEach(script => {
      const content = script.textContent;
      if (!content) return;

      const contentLower = content.toLowerCase();

      providers.forEach(provider => {
        const sigMatch = provider.signatures.some(sig => {
          return content.includes(sig) || contentLower.includes(sig.toLowerCase());
        });

        if (sigMatch && !detectedProviders.has(provider.id)) {
          console.log(`[Call Tracker Detector] ✓✓✓ MATCH: ${provider.name} (inline script)`);

          detectedProviders.add(provider.id);
          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: 'inline script',
            element: script,
            isInline: true
          });
        }
      });
    });

    console.log('[Call Tracker Detector] === DETECTION COMPLETE ===');
    console.log('[Call Tracker Detector] Providers found:', detectedProviders.size);
    console.log('[Call Tracker Detector] Details:', Array.from(detectedProviders));

    return Array.from(detectedProviders);
  }

  // Detect number swaps
  function detectNumberSwaps() {
    const swaps = [];
    const currentNumberSet = new Set(currentNumbers.keys());
    const originalNumberSet = new Set(originalNumbers.keys());

    originalNumberSet.forEach(origKey => {
      if (!currentNumberSet.has(origKey)) {
        const original = originalNumbers.get(origKey);
        currentNumberSet.forEach(currKey => {
          if (!originalNumberSet.has(currKey)) {
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
    console.log('[Call Tracker Detector] Captured', originalNumbers.size, 'original numbers');
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

    console.log('[Call Tracker Detector] Results saved:', results);
  }

  // Run the detection
  async function runDetection() {
    console.log('[Call Tracker Detector] === RUNNING DETECTION ===');

    // Capture original numbers
    captureOriginalNumbers();

    // Detect tracking scripts
    detectTrackingScripts();

    // Wait for scripts to execute
    setTimeout(() => {
      scanCurrentNumbers();
      updateBadgeAndStorage();
      scanComplete = true;
      console.log('[Call Tracker Detector] Scan complete');
    }, 3000);
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

  // Initialize - wait for page to fully load
  async function initialize() {
    console.log('[Call Tracker Detector] Initializing...');

    // Load providers
    const loaded = await loadProviders();
    if (!loaded) {
      console.error('[Call Tracker Detector] Failed to load providers');
      return;
    }

    // Wait for page to be fully loaded
    if (document.readyState === 'complete') {
      // Already loaded
      console.log('[Call Tracker Detector] Page already loaded, running detection');
      setTimeout(runDetection, 1000); // Give it 1 second for dynamic scripts
    } else {
      // Wait for load event
      console.log('[Call Tracker Detector] Waiting for page load...');
      window.addEventListener('load', () => {
        console.log('[Call Tracker Detector] Page loaded, running detection');
        setTimeout(runDetection, 2000); // Give it 2 seconds for dynamic scripts
      });
    }
  }

  // Start
  initialize();

})();
