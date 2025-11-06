// Popup script for Call Tracking Detector

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    showError('Unable to access current tab');
    return;
  }

  // Load detection results
  loadDetectionResults(tab);

  // Set up event listeners
  setupEventListeners(tab);
});

// Load detection results from content script
async function loadDetectionResults(tab) {
  try {
    // Try to get results from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getDetection' });

    if (response) {
      displayResults(response);
    } else {
      // Fall back to storage
      loadFromStorage(tab);
    }
  } catch (error) {
    console.log('Could not get detection from content script:', error);
    // Fall back to storage
    loadFromStorage(tab);
  }
}

// Load from chrome storage
async function loadFromStorage(tab) {
  const key = `detection_${tab.url}`;
  const result = await chrome.storage.local.get(key);

  if (result[key]) {
    displayResults(result[key]);
  } else {
    updateStatus('No detection data available', 'gray');
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

  statusText.textContent = message;

  statusElement.className = 'status';
  if (type === 'success') {
    statusElement.classList.add('status-success');
  } else if (type === 'gray') {
    statusElement.classList.add('status-gray');
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
      return `<div class="script-url">🔗 ${s.scriptUrl}</div>`;
    }).join('');

    trackerCard.innerHTML = `
      <div class="tracker-header">
        <span class="tracker-name">${provider}</span>
        <span class="tracker-badge">${scripts.length} script(s)</span>
      </div>
      ${scriptUrls}
    `;

    trackerList.appendChild(trackerCard);
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

    const badge = info.isTracking
      ? '<span class="number-badge tracking">Tracking</span>'
      : '<span class="number-badge original">Original</span>';

    const locations = info.locations.length > 0
      ? `<div class="number-location">📍 ${info.locations.join(', ')}</div>`
      : '';

    numberCard.innerHTML = `
      <div class="number-header">
        <span class="number-value">${info.number}</span>
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
      ? `<div class="swap-location">📍 ${swap.locations.join(', ')}</div>`
      : '';

    swapCard.innerHTML = `
      <div class="swap-row">
        <span class="swap-label">Original:</span>
        <span class="swap-value">${swap.original}</span>
      </div>
      <div class="swap-arrow">→</div>
      <div class="swap-row">
        <span class="swap-label">Tracking:</span>
        <span class="swap-value tracking">${swap.tracking}</span>
      </div>
      ${locations}
    `;

    swapList.appendChild(swapCard);
  });
}

// Set up event listeners
function setupEventListeners(tab) {
  // Blocking toggle
  const blockingToggle = document.getElementById('blockingToggle');
  blockingToggle.addEventListener('change', async (e) => {
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
      chrome.tabs.reload(tab.id);
      window.close();
    } catch (error) {
      console.error('Error toggling blocking:', error);
      showError('Could not toggle blocking');
      e.target.checked = !enabled;
    }
  });

  // Apply traffic source
  document.getElementById('applySource').addEventListener('click', () => {
    const select = document.getElementById('trafficSource');
    const param = select.value;

    if (!param) {
      alert('Please select a traffic source');
      return;
    }

    const currentUrl = new URL(tab.url);

    // Remove existing test parameters
    const testParams = ['gclid', 'fbclid', 'msclkid', 'ttclid', 'epik', 'ScCid', 'twclid', 'li_fat_id', 'yclid'];
    testParams.forEach(testParam => {
      currentUrl.searchParams.delete(testParam);
    });

    // Add the new parameter
    const [paramName, paramValue] = param.split('=');
    currentUrl.searchParams.set(paramName, paramValue);

    chrome.tabs.update(tab.id, { url: currentUrl.href });
    window.close();
  });

  // Clear traffic source
  document.getElementById('clearSource').addEventListener('click', () => {
    const currentUrl = new URL(tab.url);
    currentUrl.search = '';

    chrome.tabs.update(tab.id, { url: currentUrl.href });
    window.close();
  });

  // Clear cookies
  document.getElementById('clearCookies').addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'clearCookies',
        url: tab.url
      });

      if (response.success) {
        alert(`Cleared ${response.removed} cookie(s). Page will reload.`);
        chrome.tabs.reload(tab.id);
        window.close();
      }
    } catch (error) {
      console.error('Error clearing cookies:', error);
      showError('Could not clear cookies');
    }
  });

  // Rescan
  document.getElementById('rescan').addEventListener('click', async () => {
    try {
      updateStatus('Rescanning...', 'default');

      await chrome.tabs.sendMessage(tab.id, { action: 'rescan' });

      setTimeout(() => {
        loadDetectionResults(tab);
      }, 2500);
    } catch (error) {
      console.error('Error rescanning:', error);
      showError('Could not rescan. Try reloading the page.');
    }
  });

  // Help link
  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/petethree/call-tracking-script-detector' });
  });

  // Suggest Feature link
  document.getElementById('featureLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://docs.google.com/forms/d/e/1FAIpQLSeBxDix5LOQY_nxflpipyLUBlLI_11Ac0WyMs0yYLeZJIPrOg/viewform?usp=dialog' });
  });
}

// Show error message
function showError(message) {
  updateStatus(message, 'error');
}
