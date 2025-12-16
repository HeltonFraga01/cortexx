/**
 * Error Detection Analyzers - Index
 * 
 * Exports all analyzer components.
 */

const SyntaxAnalyzer = require('./SyntaxAnalyzer');
const RuntimeAnalyzer = require('./RuntimeAnalyzer');
const ConfigurationValidator = require('./ConfigurationValidator');

module.exports = {
  SyntaxAnalyzer,
  RuntimeAnalyzer,
  ConfigurationValidator
};
