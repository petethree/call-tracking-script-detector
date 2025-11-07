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
  displaySwaps([]);
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

  // Display swaps (always call, it will handle empty state)
  displaySwaps(swaps);
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

  Object.entries(grouped).forEach(([provider, scripts], index) => {
    const trackerCard = document.createElement('div');
    trackerCard.className = 'tracker-card';

    // Generate unique ID for this tracker's details
    const detailsId = `tracker-details-${index}`;

    // Count different detection methods
    const externalScripts = scripts.filter(s => !s.isInline);
    const inlineScripts = scripts.filter(s => s.isInline);

    // Build detection details
    let detailsHtml = '<div class="detection-details-content">';

    // External scripts section
    if (externalScripts.length > 0) {
      detailsHtml += '<div class="detection-section">';
      detailsHtml += '<div class="detection-section-title">🔗 External Scripts Detected:</div>';
      externalScripts.forEach(s => {
        detailsHtml += `<div class="detection-item">
          <span class="detection-label">Script URL:</span>
          <span class="detection-value">${escapeHtml(s.scriptUrl)}</span>
        </div>`;
      });
      detailsHtml += '</div>';
    }

    // Inline scripts section
    if (inlineScripts.length > 0) {
      detailsHtml += '<div class="detection-section">';
      detailsHtml += '<div class="detection-section-title">📄 Inline Scripts Detected:</div>';
      detailsHtml += `<div class="detection-item">
        <span class="detection-label">Count:</span>
        <span class="detection-value">${inlineScripts.length} inline script(s) with ${escapeHtml(provider)} signatures</span>
      </div>`;
      detailsHtml += '</div>';
    }

    // Detection method explanation
    detailsHtml += '<div class="detection-section">';
    detailsHtml += '<div class="detection-section-title">🔍 Detection Method:</div>';
    detailsHtml += '<div class="detection-item">';
    if (externalScripts.length > 0) {
      detailsHtml += '<span class="detection-value">✓ Matched script domain/URL pattern</span>';
    }
    if (inlineScripts.length > 0) {
      detailsHtml += '<span class="detection-value">✓ Found provider-specific JavaScript signatures</span>';
    }
    detailsHtml += '</div>';
    detailsHtml += '</div>';

    detailsHtml += '</div>'; // Close detection-details-content

    trackerCard.innerHTML = `
      <div class="tracker-header">
        <span class="tracker-name">${escapeHtml(provider)}</span>
        <span class="tracker-badge">${scripts.length} script(s)</span>
      </div>
      <div class="detection-details">
        <button class="detection-toggle collapsed" data-target="${detailsId}" aria-expanded="false">
          <span class="toggle-icon">▼</span>
          <span class="toggle-text">Detection Details</span>
        </button>
        <div id="${detailsId}" class="detection-details-body collapsed">
          ${detailsHtml}
        </div>
      </div>
    `;

    trackerList.appendChild(trackerCard);
  });

  // Add event listeners for detection toggles
  document.querySelectorAll('.detection-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = toggle.getAttribute('data-target');
      const detailsBody = document.getElementById(targetId);
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

      if (detailsBody) {
        detailsBody.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
        toggle.setAttribute('aria-expanded', !isExpanded);
      }
    });
  });
}

// Store all numbers for pagination
let allPhoneNumbersData = [];
let displayedNumberCount = 0;
const NUMBERS_PER_PAGE = 10;

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
    allPhoneNumbersData = [];
    displayedNumberCount = 0;
    return;
  }

  // Store all numbers data for pagination
  allPhoneNumbersData = Array.from(allNumbers.entries()).map(([normalized, info]) => ({
    normalized,
    info
  }));

  // Reset and display first batch
  numberList.innerHTML = '';
  displayedNumberCount = 0;
  displayMoreNumbers();

  // Clear any existing search and reset
  const searchInput = document.getElementById('numberSearch');
  if (searchInput) {
    searchInput.value = '';
    updateSearchMatchCount(allNumbers.size, allNumbers.size);
  }
}

// Display the next batch of phone numbers
function displayMoreNumbers() {
  const numberList = document.getElementById('numberList');

  // Remove existing "Show More" button if present
  const existingButton = numberList.querySelector('.show-more-btn');
  if (existingButton) {
    existingButton.remove();
  }

  // Calculate how many to show in this batch
  const startIndex = displayedNumberCount;
  const endIndex = Math.min(startIndex + NUMBERS_PER_PAGE, allPhoneNumbersData.length);

  // Display the batch
  for (let i = startIndex; i < endIndex; i++) {
    const { normalized, info } = allPhoneNumbersData[i];

    const numberCard = document.createElement('div');
    numberCard.className = 'number-card';

    // Store both formatted and normalized number for searching
    numberCard.setAttribute('data-number', normalized);
    numberCard.setAttribute('data-formatted', info.number);

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
  }

  displayedNumberCount = endIndex;

  // Add "Show More" button if there are more numbers
  if (displayedNumberCount < allPhoneNumbersData.length) {
    const showMoreBtn = document.createElement('button');
    showMoreBtn.className = 'btn btn-secondary btn-block show-more-btn';
    showMoreBtn.style.marginTop = '12px';
    showMoreBtn.textContent = `Show More (${allPhoneNumbersData.length - displayedNumberCount} remaining)`;
    showMoreBtn.addEventListener('click', displayMoreNumbers);
    numberList.appendChild(showMoreBtn);
  }
}

// Display number swaps
function displaySwaps(swaps) {
  const swapCount = document.getElementById('swapCount');
  const swapList = document.getElementById('swapList');

  swapCount.textContent = swaps.length;

  if (swaps.length === 0) {
    swapList.innerHTML = '<p class="empty-state">No number swaps detected yet. If tracking scripts are active, swaps may appear as the page loads or when conditions change.</p>';
    return;
  }

  swapList.innerHTML = '';

  // Add info box at the top
  const infoBox = document.createElement('div');
  infoBox.className = 'swap-info';
  infoBox.innerHTML = `
    <strong>Number Swaps Detected!</strong> The tracking script has replaced original phone numbers with tracking numbers.
    Below you can see which original numbers were on the page and what tracking numbers are now showing to visitors.
  `;
  swapList.appendChild(infoBox);

  swaps.forEach(swap => {
    const swapCard = document.createElement('div');
    swapCard.className = 'swap-card';

    const locations = swap.locations?.length > 0
      ? `<div class="swap-location">📍 Found in: ${escapeHtml(swap.locations.join(', '))}</div>`
      : '';

    swapCard.innerHTML = `
      <div class="swap-row original">
        <div>
          <div class="swap-label">Original Number on Page</div>
          <div class="swap-value original">${escapeHtml(swap.original)}</div>
        </div>
      </div>
      <div class="swap-arrow">↓</div>
      <div class="swap-row tracking">
        <div>
          <div class="swap-label">Swapped to Tracking Number</div>
          <div class="swap-value tracking">${escapeHtml(swap.tracking)}</div>
        </div>
      </div>
      ${locations}
    `;

    swapList.appendChild(swapCard);
  });
}

// Filter phone numbers based on search query
function filterPhoneNumbers(searchQuery) {
  const numberList = document.getElementById('numberList');

  if (!searchQuery || searchQuery.trim() === '') {
    // Return to paginated view when search is cleared
    numberList.innerHTML = '';
    displayedNumberCount = 0;
    displayMoreNumbers();
    updateSearchMatchCount(allPhoneNumbersData.length, allPhoneNumbersData.length);
    return;
  }

  const query = searchQuery.toLowerCase().replace(/\D/g, ''); // Remove non-digits from query
  let matchCount = 0;

  // Clear list and show all matching numbers (no pagination when searching)
  numberList.innerHTML = '';

  allPhoneNumbersData.forEach(({ normalized, info }) => {
    // Check if the query matches any part of the normalized number
    if (normalized.includes(query)) {
      matchCount++;

      const numberCard = document.createElement('div');
      numberCard.className = 'number-card';
      numberCard.setAttribute('data-number', normalized);
      numberCard.setAttribute('data-formatted', info.number);

      const badge = info.isTracking
        ? '<span class="number-badge tracking">Tracking</span>'
        : '<span class="number-badge original">Original</span>';

      const locations = info.locations.length > 0
        ? `<div class="number-location">📍 ${escapeHtml(info.locations.join(', '))}</div>`
        : '';

      // Highlight matching part in the display
      const highlightedNumber = highlightMatch(info.number, query);

      numberCard.innerHTML = `
        <div class="number-header">
          <span class="number-value">${highlightedNumber}</span>
          ${badge}
        </div>
        ${locations}
      `;

      numberList.appendChild(numberCard);
    }
  });

  if (matchCount === 0) {
    numberList.innerHTML = '<p class="empty-state">No matching phone numbers found</p>';
  }

  updateSearchMatchCount(matchCount, allPhoneNumbersData.length);
}

// Highlight matching digits in the phone number
function highlightMatch(phoneNumber, query) {
  if (!query) return escapeHtml(phoneNumber);

  // Extract just the digits from the phone number
  const digits = phoneNumber.replace(/\D/g, '');

  // Find where the query matches in the digits
  const matchIndex = digits.indexOf(query);
  if (matchIndex === -1) return escapeHtml(phoneNumber);

  // Build the highlighted phone number
  let result = '';
  let digitIndex = 0;

  for (let i = 0; i < phoneNumber.length; i++) {
    const char = phoneNumber[i];

    if (/\d/.test(char)) {
      // This is a digit
      if (digitIndex >= matchIndex && digitIndex < matchIndex + query.length) {
        // This digit is part of the match
        result += `<span class="highlight">${escapeHtml(char)}</span>`;
      } else {
        result += escapeHtml(char);
      }
      digitIndex++;
    } else {
      // This is formatting (-, (, ), space, etc.)
      result += escapeHtml(char);
    }
  }

  return result;
}

// Update the search match count display
function updateSearchMatchCount(matchCount, totalCount) {
  const matchCountElement = document.getElementById('searchMatchCount');
  if (matchCountElement) {
    if (matchCount === totalCount) {
      matchCountElement.textContent = `Showing all ${totalCount} number${totalCount !== 1 ? 's' : ''}`;
    } else {
      matchCountElement.textContent = `Showing ${matchCount} of ${totalCount} number${totalCount !== 1 ? 's' : ''}`;
    }
  }
}

// Set up event listeners
function setupEventListeners() {
  // Close panel button
  document.getElementById('closePanel')?.addEventListener('click', () => {
    window.close();
  });

  // Collapsible sections
  document.querySelectorAll('.collapsible').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-target');
      const content = document.getElementById(targetId);

      if (content) {
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
      }
    });
  });

  // Phone number search
  const numberSearch = document.getElementById('numberSearch');
  if (numberSearch) {
    numberSearch.addEventListener('input', (e) => {
      const searchQuery = e.target.value;
      filterPhoneNumbers(searchQuery);
    });

    // Also handle paste events
    numberSearch.addEventListener('paste', (e) => {
      setTimeout(() => {
        const searchQuery = e.target.value;
        filterPhoneNumbers(searchQuery);
      }, 10);
    });
  }

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

    // Remove existing test parameters
    const testParams = ['gclid', 'fbclid', 'msclkid', 'ttclid', 'epik', 'ScCid', 'twclid', 'li_fat_id', 'yclid'];
    testParams.forEach(testParam => {
      currentUrl.searchParams.delete(testParam);
    });

    // Add the new parameter
    const [paramName, paramValue] = param.split('=');
    currentUrl.searchParams.set(paramName, paramValue);

    chrome.tabs.update(currentTabId, { url: currentUrl.href });
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

  // Suggest Feature link
  document.getElementById('featureLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://docs.google.com/forms/d/e/1FAIpQLSeBxDix5LOQY_nxflpipyLUBlLI_11Ac0WyMs0yYLeZJIPrOg/viewform?usp=dialog' });
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
