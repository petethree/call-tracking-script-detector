// Background service worker for Call Tracking Detector

// Store detection results per tab
const detectionResults = new Map();

// Provider library
let providers = [];

// Load providers on startup
async function loadProviders() {
  try {
    const response = await fetch(chrome.runtime.getURL('providers.json'));
    const data = await response.json();
    providers = data.providers || [];
    console.log('[Background] Loaded', providers.length, 'providers');
  } catch (error) {
    console.error('[Background] Error loading providers:', error);
  }
}

// Initialize
loadProviders();

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Background] Extension icon clicked, opening side panel');
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('[Background] Error opening side panel:', error);
  }
});

// Allow side panel to be opened via setOptions for future flexibility
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Background] Error setting panel behavior:', error));

// Listen for web requests to detect tracking scripts
chrome.webRequest?.onBeforeRequest.addListener(
  (details) => {
    const url = details.url.toLowerCase();

    providers.forEach(provider => {
      const matchesDomain = provider.domains.some(domain =>
        url.includes(domain.toLowerCase())
      );
      const matchesPattern = provider.scriptPatterns.some(pattern =>
        url.includes(pattern.toLowerCase())
      );

      if (matchesDomain || matchesPattern) {
        console.log('[Background] Detected tracking request:', provider.name, details.url);

        // Store detection for this tab
        if (!detectionResults.has(details.tabId)) {
          detectionResults.set(details.tabId, {
            providers: new Set(),
            scripts: []
          });
        }

        const tabData = detectionResults.get(details.tabId);
        tabData.providers.add(provider.name);
        tabData.scripts.push({
          provider: provider.name,
          url: details.url,
          timestamp: Date.now()
        });

        // Update badge
        updateBadge(details.tabId, tabData.providers.size);
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// Update extension badge
function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({
      tabId: tabId,
      text: count.toString()
    });

    chrome.action.setBadgeBackgroundColor({
      tabId: tabId,
      color: '#4CAF50' // Green for detected
    });
  } else {
    chrome.action.setBadgeText({
      tabId: tabId,
      text: ''
    });
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateDetection') {
    const tabId = sender.tab?.id;
    if (tabId) {
      const data = request.data;

      // Update stored results
      if (!detectionResults.has(tabId)) {
        detectionResults.set(tabId, {
          providers: new Set(),
          scripts: []
        });
      }

      const tabData = detectionResults.get(tabId);
      data.detectedTrackers.forEach(tracker => {
        tabData.providers.add(tracker.provider);
      });

      // Update badge based on detection
      const trackerCount = data.detectedTrackers.length;
      const swapCount = data.swaps?.length || 0;

      if (trackerCount > 0 || swapCount > 0) {
        updateBadge(tabId, trackerCount);
      } else {
        chrome.action.setBadgeText({
          tabId: tabId,
          text: ''
        });
        chrome.action.setBadgeBackgroundColor({
          tabId: tabId,
          color: '#999999' // Gray for no tracking
        });
      }

      // Notify side panel if it's open
      chrome.runtime.sendMessage({
        action: 'detectionUpdated',
        tabId: tabId
      }).catch(() => {
        // Side panel may not be open, ignore error
      });

      sendResponse({ success: true });
    }
    return true;
  }

  if (request.action === 'getProviders') {
    sendResponse({ providers: providers });
    return true;
  }

  if (request.action === 'clearCookies') {
    const url = request.url;
    chrome.cookies.getAll({ url: url }, (cookies) => {
      let removed = 0;
      cookies.forEach(cookie => {
        chrome.cookies.remove({
          url: url,
          name: cookie.name
        }, () => {
          removed++;
        });
      });

      setTimeout(() => {
        sendResponse({ success: true, removed: removed });
      }, 500);
    });
    return true;
  }

  if (request.action === 'enableBlocking') {
    // Enable blocking rules
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ['tracking_blocklist']
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.action === 'disableBlocking') {
    // Disable blocking rules
    chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['tracking_blocklist']
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

// Clean up old detection results when tabs are closed
chrome.tabs?.onRemoved.addListener((tabId) => {
  detectionResults.delete(tabId);
});

// Clear detection results when navigation starts
chrome.webNavigation?.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    detectionResults.delete(details.tabId);
    chrome.action.setBadgeText({
      tabId: details.tabId,
      text: ''
    });
  }
});

console.log('[Background] Call Tracking Detector service worker initialized');
