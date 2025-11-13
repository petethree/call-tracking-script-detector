// This script runs in the page's context (not isolated)
// It checks for tracking service global variables

(function() {
  'use strict';
  
  // Get the list of variables to check from the script tag's data attribute
  const scriptTag = document.querySelector('script[data-tracker-vars], script#call-tracker-detector-data');
  if (!scriptTag) return;
  
  let varsToCheck = [];
  try {
    const dataStr = scriptTag.dataset.trackerVars || scriptTag.getAttribute('data-tracker-vars');
    if (!dataStr) return;
    varsToCheck = JSON.parse(dataStr);
  } catch (e) {
    console.error('[Injected Detector] Failed to parse tracker vars:', e);
    return;
  }
  
  // Check for global variables
  const foundVariables = [];
  
  varsToCheck.forEach(item => {
    try {
      if (typeof window[item.variable] !== 'undefined') {
        foundVariables.push({
          provider: item.name,
          providerId: item.provider,
          variable: item.variable,
          type: typeof window[item.variable]
        });
        console.log('[Injected Detector] Found', item.name, 'variable:', item.variable);
      }
    } catch (e) {
      // Silently ignore errors checking individual variables
    }
  });
  
  // Send results back to content script via custom event
  if (foundVariables.length > 0) {
    document.dispatchEvent(new CustomEvent('trackingVariablesFound', {
      detail: foundVariables
    }));
  }
})();