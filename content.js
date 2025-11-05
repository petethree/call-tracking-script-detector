// Content script for detecting call tracking and phone numbers

(function() {
  'use strict';

  // State management
  let originalNumbers = new Map(); // Store original numbers before any swaps
  let detectedTrackers = [];
  let currentNumbers = new Map();
  let providers = [];
  let scanComplete = false;

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  // Load provider library
  async function loadProviders() {
    try {
      if (!isExtensionContextValid()) {
        console.log('[Call Tracker Detector] Extension context invalidated, skipping provider load');
        return;
      }
      const response = await fetch(chrome.runtime.getURL('providers.json'));
      const data = await response.json();
      providers = data.providers || [];
      console.log('[Call Tracker Detector] Loaded', providers.length, 'providers');
    } catch (error) {
      console.error('[Call Tracker Detector] Error loading providers:', error);
    }
  }

  // Detect tracking scripts in the page
  function detectTrackingScripts() {
    const scripts = document.querySelectorAll('script[src]');
    const detectedProviders = new Set();

    scripts.forEach(script => {
      const src = script.src.toLowerCase();

      providers.forEach(provider => {
        // Check if script URL matches provider domains or patterns
        const matchesDomain = provider.domains.some(domain => src.includes(domain.toLowerCase()));
        const matchesPattern = provider.scriptPatterns.some(pattern =>
          src.includes(pattern.toLowerCase())
        );

        if (matchesDomain || matchesPattern) {
          detectedProviders.add(provider.id);
          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: script.src,
            element: script
          });
          console.log('[Call Tracker Detector] Found', provider.name, 'script:', script.src);
        }
      });
    });

    // Also check inline scripts for signatures
    const inlineScripts = document.querySelectorAll('script:not([src])');
    inlineScripts.forEach(script => {
      const content = script.textContent.toLowerCase();

      providers.forEach(provider => {
        const matchesSignature = provider.signatures.some(sig =>
          content.includes(sig.toLowerCase())
        );

        if (matchesSignature && !detectedProviders.has(provider.id)) {
          detectedProviders.add(provider.id);
          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: 'inline script',
            element: script,
            isInline: true
          });
          console.log('[Call Tracker Detector] Found', provider.name, 'in inline script');
        }
      });
    });

    return Array.from(detectedProviders);
  }

  // Capture original phone numbers from the page
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
        // Add additional location
        const existing = originalNumbers.get(key);
        const location = getElementLocation(numberInfo.element);
        if (!existing.locations.includes(location)) {
          existing.locations.push(location);
        }
      }
    });

    console.log('[Call Tracker Detector] Captured', originalNumbers.size, 'original numbers');
  }

  // Scan current state of phone numbers
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

  // Detect number swaps by comparing original vs. current
  function detectNumberSwaps() {
    const swaps = [];
    const currentNumberSet = new Set(currentNumbers.keys());
    const originalNumberSet = new Set(originalNumbers.keys());

    // Find numbers that disappeared (likely replaced)
    originalNumberSet.forEach(origKey => {
      if (!currentNumberSet.has(origKey)) {
        // This number was swapped
        const original = originalNumbers.get(origKey);

        // Try to find the replacement (new numbers that appeared)
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

  // Set up DOM mutation observer
  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      let hasPhoneChange = false;

      mutations.forEach(mutation => {
        // Check if text content changed
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          const text = mutation.target.textContent || '';
          if (text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)) {
            hasPhoneChange = true;
          }
        }

        // Check for attribute changes on tel: links
        if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
          const element = mutation.target;
          if (element.href && element.href.startsWith('tel:')) {
            hasPhoneChange = true;
          }
        }
      });

      if (hasPhoneChange) {
        console.log('[Call Tracker Detector] Phone number changed in DOM');
        scanCurrentNumbers();
        updateBadgeAndStorage();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: true,
      attributeFilter: ['href']
    });

    console.log('[Call Tracker Detector] DOM observer active');
  }

  // Update extension badge and storage
  function updateBadgeAndStorage() {
    // Check if extension context is valid before proceeding
    if (!isExtensionContextValid()) {
      console.log('[Call Tracker Detector] Extension context invalidated, skipping update');
      return;
    }

    const swaps = detectNumberSwaps();

    const results = {
      url: window.location.href,
      detectedTrackers: detectedTrackers,
      originalNumbers: Array.from(originalNumbers.values()),
      currentNumbers: Array.from(currentNumbers.values()),
      swaps: swaps,
      timestamp: Date.now()
    };

    // Send to background script
    try {
      chrome.runtime.sendMessage({
        action: 'updateDetection',
        data: results
      }).catch(err => {
        // Extension context may be invalid, ignore
        console.log('[Call Tracker Detector] Could not send message:', err);
      });
    } catch (err) {
      console.log('[Call Tracker Detector] Error sending message:', err);
    }

    // Store in chrome.storage for popup
    try {
      chrome.storage.local.set({
        [`detection_${getTabId()}`]: results
      }).catch(err => {
        console.log('[Call Tracker Detector] Could not store results:', err);
      });
    } catch (err) {
      console.log('[Call Tracker Detector] Error storing results:', err);
    }
  }

  // Get approximate tab ID (we'll use timestamp as fallback)
  function getTabId() {
    return window.location.href;
  }

  // Initialize detection
  async function initialize() {
    console.log('[Call Tracker Detector] Initializing...');

    // Load providers
    await loadProviders();

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runDetection);
    } else {
      runDetection();
    }
  }

  // Run the detection process
  function runDetection() {
    console.log('[Call Tracker Detector] Running detection...');

    // Step 1: Capture original numbers immediately
    captureOriginalNumbers();

    // Step 2: Detect tracking scripts
    const foundProviders = detectTrackingScripts();

    // Step 3: Wait a bit for tracking scripts to execute
    setTimeout(() => {
      scanCurrentNumbers();
      const swaps = detectNumberSwaps();

      console.log('[Call Tracker Detector] Detection complete:', {
        providers: foundProviders.length,
        originalNumbers: originalNumbers.size,
        currentNumbers: currentNumbers.size,
        swaps: swaps.length
      });

      // Step 4: Update badge and storage
      updateBadgeAndStorage();

      // Step 5: Start monitoring for changes
      observeDOMChanges();

      scanComplete = true;
    }, 2000); // Wait 2 seconds for scripts to execute
  }

  // Listen for messages from popup
  if (isExtensionContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getDetection') {
          const swaps = detectNumberSwaps();
          sendResponse({
            detectedTrackers: detectedTrackers,
            originalNumbers: Array.from(originalNumbers.values()),
            currentNumbers: Array.from(currentNumbers.values()),
            swaps: swaps,
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
    } catch (error) {
      console.log('[Call Tracker Detector] Could not add message listener:', error);
    }
  }

  // Start initialization
  if (isExtensionContextValid()) {
    initialize();
  } else {
    console.log('[Call Tracker Detector] Extension context invalid at startup, not initializing');
  }

})();
