/**
 * Provider Adapters - Entry point for provider adapter system
 * 
 * Exports all provider-related classes and utilities.
 * 
 * Requirements: 1.3, 1.4, 2.1-2.6 (wuzapi-status-source-of-truth spec)
 */

const ProviderAdapter = require('./ProviderAdapter');
const ProviderAdapterFactory = require('./ProviderAdapterFactory');
const WuzapiAdapter = require('./WuzapiAdapter');
const errors = require('./errors');

module.exports = {
  // Base class
  ProviderAdapter,
  
  // Factory
  ProviderAdapterFactory,
  
  // Adapters
  WuzapiAdapter,
  
  // Errors
  ...errors
};
