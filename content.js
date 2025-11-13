// Content script for detecting call tracking and phone numbers

(function() {
  'use strict';

  // Early exit if extension context is invalid
  // This prevents errors on pages where content script was injected before extension reload
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.log('[Call Tracker Detector] Extension context invalid at script load, exiting');
      return;
    }
  } catch (e) {
    console.log('[Call Tracker Detector] Extension context check failed, exiting');
    return;
  }

  // State management
  let originalNumbers = new Map(); // Store original numbers before any swaps
  let detectedTrackers = [];
  let currentNumbers = new Map();
  let providers = [];
  let scanComplete = false;
  let contextInvalidated = false; // Flag to track if we've detected invalidation

  // Listen for global variable detection results from injected script
  // Set this up EARLY before any injections happen
  document.addEventListener('trackingVariablesFound', (event) => {
    const foundVariables = event.detail;
    
    foundVariables.forEach(item => {
      // Check if we've already detected this provider via this global variable
      const alreadyDetected = detectedTrackers.some(
        tracker => tracker.providerId === item.providerId &&
                  tracker.matchType === 'globalVariable' &&
                  tracker.globalVariable === item.variable
      );

      if (!alreadyDetected) {
        detectedTrackers.push({
          provider: item.provider,
          providerId: item.providerId,
          scriptUrl: 'global variable',
          globalVariable: item.variable,
          matchType: 'globalVariable',
          matchedPattern: item.variable
        });
        console.log('[Call Tracker Detector] Found', item.provider, 'via global variable:', item.variable);
        
        // Update badge and storage when new variable detected
        if (isExtensionContextValid()) {
          updateBadgeAndStorage();
        }
      }
    });
  });

  // Check if extension context is still valid
  function isExtensionContextValid() {
    try {
      const isValid = chrome.runtime && chrome.runtime.id;
      if (!isValid && !contextInvalidated) {
        contextInvalidated = true;
        console.log('[Call Tracker Detector] Extension context became invalid during execution');
      }
      return isValid;
    } catch (e) {
      if (!contextInvalidated) {
        contextInvalidated = true;
        console.log('[Call Tracker Detector] Extension context check exception:', e.message);
      }
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

  // Inject script into page context to check for global variables
  function injectGlobalVariableDetector() {
    const target = document.head || document.documentElement;
    if (!target) return;

    // Validate providers array exists
    if (!providers || providers.length === 0) return;

    // Create a script tag with data attribute containing vars to check
    const varsToCheck = providers.flatMap(p =>
      (p.globalVariables || []).map(v => ({ provider: p.id, variable: v, name: p.name }))
    );
    
    // First inject a script tag with the data
    const dataScript = document.createElement('script');
    dataScript.dataset.trackerVars = JSON.stringify(varsToCheck);
    dataScript.id = 'call-tracker-detector-data';
    target.appendChild(dataScript);
    
    // Then inject the detector script that will read this data
    const detectorScript = document.createElement('script');
    detectorScript.src = chrome.runtime.getURL('injected-detector.js');
    detectorScript.onerror = function(e) {
      console.error('[Call Tracker Detector] Failed to load injected-detector.js:', e);
    };
    detectorScript.onload = function() {
      // Don't remove immediately - give it time to execute
      setTimeout(() => {
        this.remove();
        dataScript.remove();
      }, 100);
    };
    
    target.appendChild(detectorScript);
  }

  // Detect tracking scripts by checking global JavaScript variables
  function detectGlobalVariables() {
    // Inject script to check in page context
    injectGlobalVariableDetector();
    
    // Schedule additional checks for scripts that load later
    setTimeout(() => {
      injectGlobalVariableDetector();
    }, 3000);
    
    // Return empty for now - actual detection happens via event listener
    return [];
  }

  // Detect tracking scripts in the page
  function detectTrackingScripts() {
    const scripts = document.querySelectorAll('script[src]');
    const detectedProviders = new Set();

    scripts.forEach(script => {
      const src = script.src;

      providers.forEach(provider => {
        // Use comprehensive URL matching from utils.js
        const matchResult = matchesTrackingUrl(src, provider);

        if (matchResult.matches) {
          detectedProviders.add(provider.id);
          detectedTrackers.push({
            provider: provider.name,
            providerId: provider.id,
            scriptUrl: script.src,
            element: script,
            matchType: matchResult.matchType,
            matchedPattern: matchResult.matchedPattern
          });
          console.log('[Call Tracker Detector] Found', provider.name, 'script:', script.src,
                      `(matched via ${matchResult.matchType}: ${matchResult.matchedPattern})`);
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
    // Safety check: document.body may not exist yet at document_start
    if (!document.body) return;

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
    // Safety check: document.body may not exist yet
    if (!document.body) return;

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
  let mutationObserver = null;

  function observeDOMChanges() {
    // Safety check: document.body must exist to observe
    if (!document.body) {
      console.log('[Call Tracker Detector] document.body not ready yet, cannot start observer');
      return;
    }

    mutationObserver = new MutationObserver((mutations) => {
      // Wrap everything in try-catch to handle extension context invalidation
      try {
        // Check context validity first and disconnect if invalid
        if (!isExtensionContextValid()) {
          console.log('[Call Tracker Detector] Context invalid, disconnecting observer');
          if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
          }
          return;
        }

        let hasPhoneChange = false;

        // Process mutations with additional try-catch for accessing mutation properties
        try {
          mutations.forEach(mutation => {
            try {
              // Additional safety check: ensure target exists and is valid
              if (!mutation.target || !mutation.target.nodeType) {
                return;
              }

              // Check if text content changed
              if (mutation.type === 'characterData' || mutation.type === 'childList') {
                // Safely access textContent with null checks
                const target = mutation.target;
                if (target && typeof target.textContent === 'string') {
                  const text = target.textContent || '';
                  if (text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)) {
                    hasPhoneChange = true;
                  }
                }
              }

              // Check for attribute changes on tel: links
              if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
                const element = mutation.target;
                if (element && element.href && typeof element.href === 'string' && element.href.startsWith('tel:')) {
                  hasPhoneChange = true;
                }
              }
            } catch (mutationError) {
              // Silently ignore individual mutation errors to prevent observer crash
              // This can happen when extension context becomes invalid mid-processing
            }
          });
        } catch (mutationsError) {
          // If accessing mutations array fails, context is likely invalid
          // Disconnect observer and return
          if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
          }
          return;
        }

        if (hasPhoneChange) {
          console.log('[Call Tracker Detector] Phone number changed in DOM');
          scanCurrentNumbers();

          // Only update if extension context is still valid
          if (isExtensionContextValid()) {
            updateBadgeAndStorage();
          }
        }
      } catch (error) {
        // Final catch-all for any other errors
        // Disconnect observer to prevent further errors
        if (mutationObserver) {
          try {
            mutationObserver.disconnect();
            mutationObserver = null;
          } catch (e) {
            // Even disconnect can fail if context is invalid
          }
        }
      }
    });

    if (mutationObserver && isExtensionContextValid()) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
        attributes: true,
        attributeFilter: ['href']
      });

      console.log('[Call Tracker Detector] DOM observer active');
    } else {
      console.log('[Call Tracker Detector] Cannot start observer - context invalid');
    }
  }

  // Debounce timer for badge updates
  let updateTimer = null;

  // Update extension badge and storage
  function updateBadgeAndStorage() {
    // Debounce to prevent rapid flickering
    if (updateTimer) {
      clearTimeout(updateTimer);
    }

    updateTimer = setTimeout(() => {
      // Check if extension context is valid before proceeding
      if (!isExtensionContextValid()) {
        console.log('[Call Tracker Detector] Extension context invalidated, skipping update');
        return;
      }

      const swaps = detectNumberSwaps();

      // Count unique providers instead of total detections
      const uniqueProviders = new Set(detectedTrackers.map(t => t.providerId));
      const providerCount = uniqueProviders.size;

      const results = {
        url: window.location.href,
        detectedTrackers: detectedTrackers,
        originalNumbers: Array.from(originalNumbers.values()),
        currentNumbers: Array.from(currentNumbers.values()),
        swaps: swaps,
        uniqueProviderCount: providerCount,
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
    }, 150); // 150ms debounce for better responsiveness
  }

  // Get approximate tab ID (we'll use timestamp as fallback)
  function getTabId() {
    return window.location.href;
  }

  // Initialize detection
  async function initialize() {
    console.log('[Call Tracker Detector] Initializing...');

    // Load providers first
    await loadProviders();

    // Run initial detection
    runDetection();

    // Set up lifecycle-based rescans
    if (document.readyState === 'loading') {
      // Document still loading - wait for DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => runDetection());
    }

    // Always rescan after window fully loads (for dynamic scripts)
    window.addEventListener('load', () => {
      setTimeout(() => runDetection(), 1000);
    });
  }

  // Run the detection process
  function runDetection() {
    // Step 1: Capture original numbers if not already captured
    if (originalNumbers.size === 0) {
      captureOriginalNumbers();
    }

    // Step 2: Detect tracking scripts in DOM
    const foundProviders = detectTrackingScripts();

    // Step 3: Check for global variables
    const globalVarProviders = detectGlobalVariables();

    // Step 4: Scan current numbers
    scanCurrentNumbers();
    const swaps = detectNumberSwaps();

    // Count unique providers
    const uniqueProviders = new Set(detectedTrackers.map(t => t.providerId));

    console.log('[Call Tracker Detector] Detection complete:', {
      uniqueProviders: uniqueProviders.size,
      scriptProviders: foundProviders.length,
      globalVarProviders: globalVarProviders.length,
      totalDetections: detectedTrackers.length,
      originalNumbers: originalNumbers.size,
      currentNumbers: currentNumbers.size,
      swaps: swaps.length
    });

    // Step 5: Update badge and storage
    if (isExtensionContextValid()) {
      updateBadgeAndStorage();
    }

    // Step 6: Start monitoring for changes (only once)
    if (!mutationObserver) {
      observeDOMChanges();
    }

    scanComplete = true;
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
