// Loaders module entry point
const businessPartnerLoader = require('./businessPartnerLoader');
const salesOrderLoader = require('./salesOrderLoader');
const productLoader = require('./productLoader');
const deliveryLoader = require('./deliveryLoader');
const billingDocumentLoader = require('./billingDocumentLoader');
const paymentLoader = require('./paymentLoader');
const plantLoader = require('./plantLoader');
const { loadRelationships } = require('./relationshipLoader');

module.exports = {
  businessPartnerLoader,
  salesOrderLoader,
  productLoader,
  deliveryLoader,
  billingDocumentLoader,
  paymentLoader,
  plantLoader,
  loadRelationships,
};
