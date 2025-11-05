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

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractPhoneNumbers,
    normalizePhone,
    formatPhone,
    isValidPhone,
    phonesEqual,
    findPhoneNumbersInElement,
    getElementLocation
  };
}
