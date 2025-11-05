// Side panel script for Call Tracking Detector

let currentTabId = null;
let isScanning = false;

// Initialize the side panel
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Side Panel] Initializing...');

  // Get current active tab
  await updateCurrentTab();

  // Set up event listeners
  setupEventListeners();

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(handleTabChange);

  // Listen for navigation within tab
  chrome.tabs.onUpdated.addListener(handleTabUpdate);

  // Listen for messages from background/content scripts
  chrome.runtime.onMessage.addListener(handleMessage);

  // Initial scan
  if (currentTabId) {
    loadDetectionResults();
  }
});

// Update current tab and display URL
async function updateCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      currentTabId = tab.id;
      displayCurrentUrl(tab.url);
      console.log('[Side Panel] Current tab:', currentTabId, tab.url);
    }
  } catch (error) {
    console.error('[Side Panel] Error getting current tab:', error);
  }
}

// Display current URL
function displayCurrentUrl(url) {
  const urlElement = document.getElementById('currentUrl');
  if (urlElement && url) {
    try {
      const urlObj = new URL(url);
      urlElement.textContent = urlObj.hostname + urlObj.pathname;
    } catch {
      urlElement.textContent = url;
    }
  }
}

// Handle tab change
async function handleTabChange(activeInfo) {
  console.log('[Side Panel] Tab changed to:', activeInfo.tabId);
  currentTabId = activeInfo.tabId;

  const tab = await chrome.tabs.get(currentTabId);
  displayCurrentUrl(tab.url);

  // Clear current results
  clearResults();

  // Load new results
  setTimeout(() => {
    loadDetectionResults();
  }, 500);
}

// Handle tab updates (navigation, etc.)
function handleTabUpdate(tabId, changeInfo, tab) {
  // Only handle the current tab
  if (tabId !== currentTabId) return;

  // Only act on URL or status changes
  if (changeInfo.url || changeInfo.status === 'complete') {
    console.log('[Side Panel] Tab updated:', changeInfo);

    if (changeInfo.url) {
      displayCurrentUrl(changeInfo.url);
      clearResults();
    }

    if (changeInfo.status === 'complete') {
      // Page fully loaded, get detection results
      setTimeout(() => {
        loadDetectionResults();
      }, 2500); // Wait for content script to finish scanning
    }
  }
}

// Handle messages
function handleMessage(request, sender, sendResponse) {
  if (request.action === 'detectionUpdated' && sender.tab?.id === currentTabId) {
    console.log('[Side Panel] Detection updated for current tab');
    loadDetectionResults();
  }
}

// Clear results display
function clearResults() {
  updateStatus('Scanning...', 'default');
  displayTrackers([]);
  displayPhoneNumbers([], []);
  document.getElementById('swapsSection').style.display = 'none';
}

// Load detection results from content script
async function loadDetectionResults() {
  if (isScanning) return;
  isScanning = true;

  try {
    if (!currentTabId) {
      await updateCurrentTab();
    }

    // Try to get results from content script
    const response = await chrome.tabs.sendMessage(currentTabId, { action: 'getDetection' });

    if (response) {
      displayResults(response);
    } else {
      // Fall back to storage
      await loadFromStorage();
    }
  } catch (error) {
    console.log('[Side Panel] Could not get detection from content script:', error);
    // Fall back to storage
    await loadFromStorage();
  } finally {
    isScanning = false;
  }
}

// Load from chrome storage
async function loadFromStorage() {
  try {
    const tab = await chrome.tabs.get(currentTabId);
    const key = `detection_${tab.url}`;
    const result = await chrome.storage.local.get(key);

    if (result[key]) {
      displayResults(result[key]);
    } else {
      updateStatus('No detection data available', 'gray');
    }
  } catch (error) {
    console.error('[Side Panel] Error loading from storage:', error);
    updateStatus('Error loading data', 'error');
  }
}

// Display detection results
function displayResults(data) {
  const {
    detectedTrackers = [],
    originalNumbers = [],
    currentNumbers = [],
    swaps = [],
    scanComplete = false
  } = data;

  // Update status
  if (scanComplete) {
    const trackerCount = detectedTrackers.length;
    const swapCount = swaps.length;

    if (trackerCount > 0 || swapCount > 0) {
      updateStatus(`${trackerCount} Tracker(s) Detected`, 'success');
    } else {
      updateStatus('No Tracking Detected', 'gray');
    }
  }

  // Display trackers
  displayTrackers(detectedTrackers);

  // Display phone numbers
  displayPhoneNumbers(originalNumbers, currentNumbers);

  // Display swaps
  if (swaps.length > 0) {
    displaySwaps(swaps);
  }
}

// Update status message
function updateStatus(message, type = 'default') {
  const statusText = document.getElementById('statusText');
  const statusElement = document.getElementById('status');

  if (statusText) {
    statusText.textContent = message;
  }

  if (statusElement) {
    statusElement.className = 'status';
    if (type === 'success') {
      statusElement.classList.add('status-success');
    } else if (type === 'gray') {
      statusElement.classList.add('status-gray');
    }
  }
}

// Display detected trackers
function displayTrackers(trackers) {
  const trackerCount = document.getElementById('trackerCount');
  const trackerList = document.getElementById('trackerList');

  trackerCount.textContent = trackers.length;

  if (trackers.length === 0) {
    trackerList.innerHTML = '<p class="empty-state">No tracking scripts detected</p>';
    return;
  }

  trackerList.innerHTML = '';

  // Group by provider
  const grouped = {};
  trackers.forEach(tracker => {
    if (!grouped[tracker.provider]) {
      grouped[tracker.provider] = [];
    }
    grouped[tracker.provider].push(tracker);
  });

  Object.entries(grouped).forEach(([provider, scripts]) => {
    const trackerCard = document.createElement('div');
    trackerCard.className = 'tracker-card';

    const scriptUrls = scripts.map(s => {
      if (s.isInline) {
        return '<div class="script-url">📄 Inline Script</div>';
      }
      return `<div class="script-url">🔗 ${escapeHtml(s.scriptUrl)}</div>`;
    }).join('');

    trackerCard.innerHTML = `
      <div class="tracker-header">
        <span class="tracker-name">${escapeHtml(provider)}</span>
        <span class="tracker-badge">${scripts.length} script(s)</span>
      </div>
      ${scriptUrls}
    `;

    trackerList.appendChild(trackerCard);
  });
}

// Display phone numbers
function displayPhoneNumbers(originalNumbers, currentNumbers) {
  const numberCount = document.getElementById('numberCount');
  const numberList = document.getElementById('numberList');

  // Combine and deduplicate
  const allNumbers = new Map();

  originalNumbers.forEach(num => {
    allNumbers.set(num.normalized, {
      number: num.formatted,
      locations: num.locations || [],
      isOriginal: true
    });
  });

  currentNumbers.forEach(num => {
    if (!allNumbers.has(num.normalized)) {
      allNumbers.set(num.normalized, {
        number: num.formatted,
        locations: num.locations || [],
        isOriginal: false,
        isTracking: true
      });
    }
  });

  numberCount.textContent = allNumbers.size;

  if (allNumbers.size === 0) {
    numberList.innerHTML = '<p class="empty-state">No phone numbers found</p>';
    return;
  }

  numberList.innerHTML = '';

  allNumbers.forEach((info, normalized) => {
    const numberCard = document.createElement('div');
    numberCard.className = 'number-card';

    const badge = info.isTracking
      ? '<span class="number-badge tracking">Tracking</span>'
      : '<span class="number-badge original">Original</span>';

    const locations = info.locations.length > 0
      ? `<div class="number-location">📍 ${escapeHtml(info.locations.join(', '))}</div>`
      : '';

    numberCard.innerHTML = `
      <div class="number-header">
        <span class="number-value">${escapeHtml(info.number)}</span>
        ${badge}
      </div>
      ${locations}
    `;

    numberList.appendChild(numberCard);
  });
}

// Display number swaps
function displaySwaps(swaps) {
  const swapSection = document.getElementById('swapsSection');
  const swapCount = document.getElementById('swapCount');
  const swapList = document.getElementById('swapList');

  swapCount.textContent = swaps.length;
  swapSection.style.display = 'block';

  swapList.innerHTML = '';

  swaps.forEach(swap => {
    const swapCard = document.createElement('div');
    swapCard.className = 'swap-card';

    const locations = swap.locations?.length > 0
      ? `<div class="swap-location">📍 ${escapeHtml(swap.locations.join(', '))}</div>`
      : '';

    swapCard.innerHTML = `
      <div class="swap-row">
        <span class="swap-label">Original:</span>
        <span class="swap-value">${escapeHtml(swap.original)}</span>
      </div>
      <div class="swap-arrow">→</div>
      <div class="swap-row">
        <span class="swap-label">Tracking:</span>
        <span class="swap-value tracking">${escapeHtml(swap.tracking)}</span>
      </div>
      ${locations}
    `;

    swapList.appendChild(swapCard);
  });
}

// Set up event listeners
function setupEventListeners() {
  // Close panel button
  document.getElementById('closePanel')?.addEventListener('click', () => {
    window.close();
  });

  // Blocking toggle
  const blockingToggle = document.getElementById('blockingToggle');
  blockingToggle?.addEventListener('change', async (e) => {
    const enabled = e.target.checked;

    try {
      if (enabled) {
        await chrome.runtime.sendMessage({ action: 'enableBlocking' });
        alert('Blocking enabled. Page will reload.');
      } else {
        await chrome.runtime.sendMessage({ action: 'disableBlocking' });
        alert('Blocking disabled. Page will reload.');
      }

      // Reload the page
      chrome.tabs.reload(currentTabId);
    } catch (error) {
      console.error('Error toggling blocking:', error);
      alert('Could not toggle blocking');
      e.target.checked = !enabled;
    }
  });

  // Apply traffic source
  document.getElementById('applySource')?.addEventListener('click', async () => {
    const select = document.getElementById('trafficSource');
    const param = select.value;

    if (!param) {
      alert('Please select a traffic source');
      return;
    }

    const tab = await chrome.tabs.get(currentTabId);
    const currentUrl = new URL(tab.url);
    const separator = currentUrl.search ? '&' : '?';
    const newUrl = currentUrl.href + separator + param;

    chrome.tabs.update(currentTabId, { url: newUrl });
  });

  // Clear traffic source
  document.getElementById('clearSource')?.addEventListener('click', async () => {
    const tab = await chrome.tabs.get(currentTabId);
    const currentUrl = new URL(tab.url);
    currentUrl.search = '';

    chrome.tabs.update(currentTabId, { url: currentUrl.href });
  });

  // Clear cookies
  document.getElementById('clearCookies')?.addEventListener('click', async () => {
    try {
      const tab = await chrome.tabs.get(currentTabId);
      const response = await chrome.runtime.sendMessage({
        action: 'clearCookies',
        url: tab.url
      });

      if (response.success) {
        alert(`Cleared ${response.removed} cookie(s). Page will reload.`);
        chrome.tabs.reload(currentTabId);
      }
    } catch (error) {
      console.error('Error clearing cookies:', error);
      alert('Could not clear cookies');
    }
  });

  // Rescan
  document.getElementById('rescan')?.addEventListener('click', async () => {
    try {
      updateStatus('Rescanning...', 'default');

      await chrome.tabs.sendMessage(currentTabId, { action: 'rescan' });

      setTimeout(() => {
        loadDetectionResults();
      }, 2500);
    } catch (error) {
      console.error('Error rescanning:', error);
      alert('Could not rescan. Try reloading the page.');
    }
  });

  // Help link
  document.getElementById('helpLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/petethree/call-tracking-script-detector' });
  });
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show error message
function showError(message) {
  updateStatus(message, 'error');
}
