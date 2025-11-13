// Utility functions for phone number detection and formatting

/**
 * Phone number regex patterns
 * Matches various formats including:
 * - (555) 123-4567
 * - 555-123-4567
 * - 555.123.4567
 * - +1 555 123 4567
 * - 1-800-555-1234
 */
const PHONE_REGEX = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Extract all phone numbers from text
 * @param {string} text - Text to search for phone numbers
 * @returns {Array} Array of phone number matches
 */
function extractPhoneNumbers(text) {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Normalize phone number to a standard format
 * Removes all formatting and returns just digits
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number (digits only)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Format phone number consistently
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number (555) 123-4567
 */
function formatPhone(phone) {
  const digits = normalizePhone(phone);

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone; // Return original if format is unrecognized
}

/**
 * Check if a phone number is valid (US format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  return digits.length === 10 || (digits.length === 11 && digits[0] === '1');
}

/**
 * Compare two phone numbers for equality
 * @param {string} phone1 - First phone number
 * @param {string} phone2 - Second phone number
 * @returns {boolean} True if numbers are the same
 */
function phonesEqual(phone1, phone2) {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

/**
 * Find phone numbers in DOM element
 * @param {Element} element - DOM element to search
 * @returns {Array} Array of objects with phone number and element info
 */
function findPhoneNumbersInElement(element) {
  const results = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const phones = extractPhoneNumbers(node.textContent);
    phones.forEach(phone => {
      if (isValidPhone(phone)) {
        results.push({
          phone: phone,
          formatted: formatPhone(phone),
          normalized: normalizePhone(phone),
          element: node.parentElement,
          textContent: node.textContent.trim()
        });
      }
    });
  }

  // Also check tel: links
  const telLinks = element.querySelectorAll('a[href^="tel:"]');
  telLinks.forEach(link => {
    const href = link.getAttribute('href');
    const phone = href.replace('tel:', '').replace(/\D/g, '');
    if (isValidPhone(phone)) {
      results.push({
        phone: formatPhone(phone),
        formatted: formatPhone(phone),
        normalized: phone,
        element: link,
        textContent: link.textContent.trim(),
        isTelLink: true
      });
    }
  });

  return results;
}

/**
 * Get element location description (header, footer, etc.)
 * @param {Element} element - DOM element
 * @returns {string} Location description
 */
function getElementLocation(element) {
  const locations = [];

  // Check for common semantic elements
  if (element.closest('header')) locations.push('Header');
  if (element.closest('footer')) locations.push('Footer');
  if (element.closest('nav')) locations.push('Navigation');
  if (element.closest('aside')) locations.push('Sidebar');
  if (element.closest('form')) locations.push('Form');
  if (element.closest('[class*="contact"]')) locations.push('Contact');

  // Check by ID or class
  const classList = element.className ? element.className.toString().toLowerCase() : '';
  const id = element.id ? element.id.toLowerCase() : '';

  if (classList.includes('header') || id.includes('header')) locations.push('Header');
  if (classList.includes('footer') || id.includes('footer')) locations.push('Footer');
  if (classList.includes('sidebar') || id.includes('sidebar')) locations.push('Sidebar');
  if (classList.includes('contact') || id.includes('contact')) locations.push('Contact');

  return locations.length > 0 ? locations.join(', ') : 'Content';
}

/**
 * Match URL against path patterns
 * Supports wildcards (*) and exact matching
 * @param {string} url - URL to match
 * @param {Array<string>} patterns - Array of path patterns to match against
 * @returns {boolean} True if URL matches any pattern
 */
function matchesUrlPattern(url, patterns) {
  if (!url || !patterns || patterns.length === 0) return false;

  try {
    const urlObj = new URL(url.toLowerCase());
    const pathname = urlObj.pathname;

    return patterns.some(pattern => {
      const normalizedPattern = pattern.toLowerCase();

      try {
        // Convert wildcard pattern to regex
        // Escape special regex chars except *
        const regexPattern = normalizedPattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');

        const regex = new RegExp(regexPattern);
        return regex.test(pathname);
      } catch (regexError) {
        // If regex creation fails, skip this pattern
        console.warn('[Utils] Invalid regex pattern:', pattern, regexError);
        return false;
      }
    });
  } catch (e) {
    // If URL parsing fails, fall back to simple string matching
    return patterns.some(pattern => {
      const normalizedPattern = pattern.toLowerCase();
      const normalizedUrl = url.toLowerCase();

      try {
        if (normalizedPattern.includes('*')) {
          const regexPattern = normalizedPattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
          const regex = new RegExp(regexPattern);
          return regex.test(normalizedUrl);
        }

        return normalizedUrl.includes(normalizedPattern);
      } catch (regexError) {
        console.warn('[Utils] Invalid regex pattern:', pattern, regexError);
        return false;
      }
    });
  }
}

/**
 * Match URL against query parameter patterns
 * @param {string} url - URL to match
 * @param {Array<string>} paramPatterns - Array of query parameter names to look for
 * @returns {boolean} True if URL contains any of the query parameters
 */
function matchesQueryParams(url, paramPatterns) {
  if (!url || !paramPatterns || paramPatterns.length === 0) return false;

  try {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;

    return paramPatterns.some(param => {
      const normalizedParam = param.toLowerCase();

      // Check if any query parameter matches
      for (const key of searchParams.keys()) {
        if (key.toLowerCase().includes(normalizedParam)) {
          return true;
        }
      }
      return false;
    });
  } catch (e) {
    // If URL parsing fails, fall back to simple string matching
    return paramPatterns.some(param => {
      const normalizedParam = param.toLowerCase();
      const normalizedUrl = url.toLowerCase();

      // Look for the parameter in the query string
      return normalizedUrl.includes(`?${normalizedParam}=`) ||
             normalizedUrl.includes(`&${normalizedParam}=`);
    });
  }
}

/**
 * Comprehensive URL pattern matching for tracking detection
 * Checks domains, script patterns, URL paths, and query parameters
 * @param {string} url - URL to check
 * @param {Object} provider - Provider object with detection patterns
 * @returns {Object} Match result with details
 */
function matchesTrackingUrl(url, provider) {
  if (!url || !provider) {
    return { matches: false };
  }

  const normalizedUrl = url.toLowerCase();
  const matchDetails = {
    matches: false,
    matchType: null,
    matchedPattern: null
  };

  // Check domains
  if (provider.domains && provider.domains.length > 0) {
    const domainMatch = provider.domains.some(domain =>
      normalizedUrl.includes(domain.toLowerCase())
    );
    if (domainMatch) {
      matchDetails.matches = true;
      matchDetails.matchType = 'domain';
      matchDetails.matchedPattern = provider.domains.find(d =>
        normalizedUrl.includes(d.toLowerCase())
      );
      return matchDetails;
    }
  }

  // Check script patterns
  if (provider.scriptPatterns && provider.scriptPatterns.length > 0) {
    const scriptMatch = provider.scriptPatterns.some(pattern =>
      normalizedUrl.includes(pattern.toLowerCase())
    );
    if (scriptMatch) {
      matchDetails.matches = true;
      matchDetails.matchType = 'scriptPattern';
      matchDetails.matchedPattern = provider.scriptPatterns.find(p =>
        normalizedUrl.includes(p.toLowerCase())
      );
      return matchDetails;
    }
  }

  // Check URL path patterns
  if (provider.urlPathPatterns && provider.urlPathPatterns.length > 0) {
    if (matchesUrlPattern(url, provider.urlPathPatterns)) {
      matchDetails.matches = true;
      matchDetails.matchType = 'urlPath';
      matchDetails.matchedPattern = provider.urlPathPatterns.find(p =>
        matchesUrlPattern(url, [p])
      );
      return matchDetails;
    }
  }

  // Check query parameters
  if (provider.queryParamPatterns && provider.queryParamPatterns.length > 0) {
    if (matchesQueryParams(url, provider.queryParamPatterns)) {
      matchDetails.matches = true;
      matchDetails.matchType = 'queryParam';
      matchDetails.matchedPattern = provider.queryParamPatterns.find(p =>
        matchesQueryParams(url, [p])
      );
      return matchDetails;
    }
  }

  return matchDetails;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractPhoneNumbers,
    normalizePhone,
    formatPhone,
    isValidPhone,
    phonesEqual,
    findPhoneNumbersInElement,
    getElementLocation,
    matchesUrlPattern,
    matchesQueryParams,
    matchesTrackingUrl
  };
}
