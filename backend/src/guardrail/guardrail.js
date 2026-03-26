// O2C domain keyword list (case-insensitive matching)
const O2C_KEYWORDS = [
  'salesorder',
  'sales order',
  'delivery',
  'billing',
  'payment',
  'customer',
  'product',
  'plant',
  'invoice',
  'businesspartner',
  'business partner',
  'order',
  'shipment',
  'clearing',
  'material',
  'quantity',
  'amount',
  'currency',
  'fiscal',
  'accounting',
  'journal',
  'journal entry',
  'document',
  'transaction',
  'partner',
  'net',
  'gross',
  'revenue',
  'linked',
  'find',
  'show',
  'list',
  'get',
  'what',
  'which',
  'how many',
];

/**
 * Classifies a query as in-scope or out-of-scope for the O2C dataset.
 * Ambiguous/unclear queries default to in-scope (per requirement 8.5).
 * @param {string} query
 * @returns {{ inScope: boolean }}
 */
function classify(query) {
  if (!query || typeof query !== 'string') {
    return { inScope: true };
  }

  const lower = query.toLowerCase();

  // Pass through if it contains an O2C keyword
  if (O2C_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return { inScope: true };
  }

  // Pass through if query contains a numeric document ID (6+ digits) — likely an O2C reference
  if (/\d{6,}/.test(query)) {
    return { inScope: true };
  }

  // Pass through if query contains an alphanumeric product/order code
  if (/[a-zA-Z]\d{6,}/.test(query) || /\d{6,}[a-zA-Z]/.test(query)) {
    return { inScope: true };
  }

  return { inScope: false };
}

module.exports = { classify };
