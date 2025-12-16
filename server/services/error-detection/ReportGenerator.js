/**
 * Report Generator
 * 
 * Generates error reports in multiple formats: Markdown, JSON, and HTML.
 * Includes interactive elements for HTML and structured data for JSON.
 * 
 * @module error-detection/ReportGenerator
 */

const {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  ExportFormat,
  createExportOptions
} = require('./types');

/**
 * Default export options
 */
const DEFAULT_OPTIONS = {
  format: ExportFormat.MARKDOWN,
  includeResolutions: true,
  includePrevention: true,
  includeExamples: true,
  groupByCategory: true,
  sortBy: 'severity'
};

class ReportGenerator {
  /**
   * Creates a new ReportGenerator instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.defaultOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generates a report in the specified format
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<string|Object>} Generated report
   */
  async generate(errors, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    
    switch (opts.format) {
      case ExportFormat.MARKDOWN:
        return this.generateMarkdown(errors, opts);
      case ExportFormat.JSON:
        return this.generateJSON(errors, opts);
      case ExportFormat.HTML:
        return this.generateHTML(errors, opts);
      default:
        throw new Error(`Unsupported format: ${opts.format}`);
    }
  }

  /**
   * Generates a Markdown report
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<string>} Markdown content
   */
  async generateMarkdown(errors, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const sortedErrors = this.sortErrors(errors, opts.sortBy);
    const groupedErrors = opts.groupByCategory 
      ? this.groupByCategory(sortedErrors)
      : { all: sortedErrors };
    
    let md = '# Error Detection Report\n\n';
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Total Errors:** ${errors.length}\n\n`;
    
    // Summary
    md += '## Summary\n\n';
    md += this.generateMarkdownSummary(errors);
    md += '\n';
    
    // Errors by category
    if (opts.groupByCategory) {
      for (const [category, categoryErrors] of Object.entries(groupedErrors)) {
        md += `## ${this.formatCategory(category)} (${categoryErrors.length})\n\n`;
        
        for (const error of categoryErrors) {
          md += this.formatErrorMarkdown(error, opts);
          md += '\n---\n\n';
        }
      }
    } else {
      md += '## Errors\n\n';
      for (const error of sortedErrors) {
        md += this.formatErrorMarkdown(error, opts);
        md += '\n---\n\n';
      }
    }
    
    return md;
  }

  /**
   * Generates a JSON report
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<Object>} JSON object
   */
  async generateJSON(errors, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const sortedErrors = this.sortErrors(errors, opts.sortBy);
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalErrors: errors.length,
        options: opts
      },
      summary: this.generateJSONSummary(errors),
      errors: sortedErrors.map(error => this.formatErrorJSON(error, opts))
    };
    
    if (opts.groupByCategory) {
      report.errorsByCategory = this.groupByCategory(sortedErrors);
    }
    
    return report;
  }

  /**
   * Generates an HTML report
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<string>} HTML content
   */
  async generateHTML(errors, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    const sortedErrors = this.sortErrors(errors, opts.sortBy);
    const groupedErrors = opts.groupByCategory 
      ? this.groupByCategory(sortedErrors)
      : { all: sortedErrors };
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error Detection Report</title>
  <style>
    ${this.getHTMLStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Error Detection Report</h1>
      <p class="meta">Generated: ${new Date().toISOString()}</p>
      <p class="meta">Total Errors: ${errors.length}</p>
    </header>
    
    <section class="summary">
      <h2>Summary</h2>
      ${this.generateHTMLSummary(errors)}
    </section>
    
    <section class="filters">
      <h2>Filters</h2>
      <div class="filter-controls">
        <label>
          Category:
          <select id="categoryFilter" onchange="filterErrors()">
            <option value="all">All</option>
            ${Object.keys(groupedErrors).map(cat => 
              `<option value="${cat}">${this.formatCategory(cat)}</option>`
            ).join('')}
          </select>
        </label>
        <label>
          Severity:
          <select id="severityFilter" onchange="filterErrors()">
            <option value="all">All</option>
            ${Object.values(ErrorSeverity).map(sev => 
              `<option value="${sev}">${sev}</option>`
            ).join('')}
          </select>
        </label>
        <label>
          Sort by:
          <select id="sortBy" onchange="sortErrors()">
            <option value="severity">Severity</option>
            <option value="type">Type</option>
            <option value="location">Location</option>
          </select>
        </label>
      </div>
    </section>
    
    <section class="errors" id="errorsContainer">
      ${this.generateHTMLErrors(sortedErrors, opts)}
    </section>
  </div>
  
  <script>
    ${this.getHTMLScript(sortedErrors)}
  </script>
</body>
</html>`;
    
    return html;
  }

  /**
   * Sorts errors by specified field
   * @param {Array} errors - Errors to sort
   * @param {string} sortBy - Sort field
   * @returns {Array} Sorted errors
   */
  sortErrors(errors, sortBy) {
    const severityOrder = {
      [ErrorSeverity.BLOCKER]: 0,
      [ErrorSeverity.CRITICAL]: 1,
      [ErrorSeverity.MAJOR]: 2,
      [ErrorSeverity.MINOR]: 3,
      [ErrorSeverity.TRIVIAL]: 4
    };
    
    return [...errors].sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          return (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'location':
          return (a.location?.filePath || '').localeCompare(b.location?.filePath || '');
        default:
          return 0;
      }
    });
  }

  /**
   * Groups errors by category
   * @param {Array} errors - Errors to group
   * @returns {Object} Grouped errors
   */
  groupByCategory(errors) {
    const grouped = {};
    
    for (const error of errors) {
      const category = error.category || ErrorCategory.INFO;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(error);
    }
    
    // Sort categories by severity
    const categoryOrder = [
      ErrorCategory.CRITICAL,
      ErrorCategory.HIGH,
      ErrorCategory.MEDIUM,
      ErrorCategory.LOW,
      ErrorCategory.INFO
    ];
    
    const sorted = {};
    for (const cat of categoryOrder) {
      if (grouped[cat]) {
        sorted[cat] = grouped[cat];
      }
    }
    
    return sorted;
  }

  /**
   * Formats category name for display
   * @param {string} category - Category value
   * @returns {string} Formatted category
   */
  formatCategory(category) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Generates Markdown summary
   * @param {Array} errors - Errors
   * @returns {string} Markdown summary
   */
  generateMarkdownSummary(errors) {
    const byType = {};
    const bySeverity = {};
    
    for (const error of errors) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }
    
    let md = '| Metric | Count |\n|--------|-------|\n';
    md += `| Total Errors | ${errors.length} |\n`;
    
    md += '\n### By Type\n\n';
    md += '| Type | Count |\n|------|-------|\n';
    for (const [type, count] of Object.entries(byType)) {
      md += `| ${type} | ${count} |\n`;
    }
    
    md += '\n### By Severity\n\n';
    md += '| Severity | Count |\n|----------|-------|\n';
    for (const [severity, count] of Object.entries(bySeverity)) {
      md += `| ${severity} | ${count} |\n`;
    }
    
    return md;
  }

  /**
   * Formats a single error for Markdown
   * @param {Object} error - Error object
   * @param {Object} options - Format options
   * @returns {string} Markdown formatted error
   */
  formatErrorMarkdown(error, options) {
    let md = `### ${error.message}\n\n`;
    md += `**Type:** ${error.type} | **Severity:** ${error.severity} | **Category:** ${error.category}\n\n`;
    
    if (error.location) {
      md += `**Location:** \`${error.location.filePath}:${error.location.line}:${error.location.column}\`\n\n`;
      if (error.location.context) {
        md += '```\n' + error.location.context + '\n```\n\n';
      }
    }
    
    if (error.description) {
      md += `**Description:** ${error.description}\n\n`;
    }
    
    if (error.causes?.length > 0) {
      md += '**Possible Causes:**\n';
      for (const cause of error.causes) {
        md += `- ${cause}\n`;
      }
      md += '\n';
    }
    
    if (options.includeResolutions && error.resolutions?.length > 0) {
      md += '**Resolutions:**\n\n';
      for (const resolution of error.resolutions) {
        md += `#### ${resolution.title}\n`;
        md += `${resolution.description}\n\n`;
        if (resolution.steps?.length > 0) {
          for (const step of resolution.steps) {
            md += `${step.order}. ${step.description}\n`;
          }
          md += '\n';
        }
      }
    }
    
    if (options.includeExamples && error.examples?.length > 0) {
      md += '**Code Examples:**\n\n';
      for (const example of error.examples) {
        md += '❌ Incorrect:\n```\n' + example.incorrect + '\n```\n\n';
        md += '✅ Correct:\n```\n' + example.correct + '\n```\n\n';
        if (example.explanation) {
          md += `*${example.explanation}*\n\n`;
        }
      }
    }
    
    if (options.includePrevention && error.preventionStrategies?.length > 0) {
      md += '**Prevention Strategies:**\n';
      for (const strategy of error.preventionStrategies) {
        md += `- **${strategy.title}:** ${strategy.description}\n`;
      }
      md += '\n';
    }
    
    return md;
  }

  /**
   * Generates JSON summary
   * @param {Array} errors - Errors
   * @returns {Object} Summary object
   */
  generateJSONSummary(errors) {
    const byType = {};
    const bySeverity = {};
    const byCategory = {};
    
    for (const error of errors) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
    }
    
    return {
      total: errors.length,
      byType,
      bySeverity,
      byCategory
    };
  }

  /**
   * Formats a single error for JSON
   * @param {Object} error - Error object
   * @param {Object} options - Format options
   * @returns {Object} JSON formatted error
   */
  formatErrorJSON(error, options) {
    const formatted = {
      id: error.id,
      type: error.type,
      category: error.category,
      severity: error.severity,
      message: error.message,
      description: error.description,
      location: error.location,
      causes: error.causes
    };
    
    if (options.includeResolutions) {
      formatted.resolutions = error.resolutions;
    }
    
    if (options.includeExamples) {
      formatted.examples = error.examples;
    }
    
    if (options.includePrevention) {
      formatted.preventionStrategies = error.preventionStrategies;
    }
    
    return formatted;
  }

  /**
   * Gets CSS styles for HTML report
   * @returns {string} CSS styles
   */
  getHTMLStyles() {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
      .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
      header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
      header h1 { margin-bottom: 10px; }
      .meta { opacity: 0.8; font-size: 14px; }
      section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
      h2 { color: #2c3e50; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
      .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
      .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
      .summary-card .value { font-size: 24px; font-weight: bold; color: #3498db; }
      .summary-card .label { font-size: 14px; color: #666; }
      .filter-controls { display: flex; gap: 15px; flex-wrap: wrap; }
      .filter-controls label { display: flex; align-items: center; gap: 8px; }
      .filter-controls select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
      .error-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
      .error-header { padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
      .error-header:hover { background: #f8f9fa; }
      .error-body { padding: 15px; border-top: 1px solid #ddd; display: none; }
      .error-body.open { display: block; }
      .severity-blocker { border-left: 4px solid #e74c3c; }
      .severity-critical { border-left: 4px solid #e67e22; }
      .severity-major { border-left: 4px solid #f1c40f; }
      .severity-minor { border-left: 4px solid #3498db; }
      .severity-trivial { border-left: 4px solid #95a5a6; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
      .badge-type { background: #3498db; color: white; }
      .badge-severity { background: #e74c3c; color: white; }
      .badge-category { background: #2ecc71; color: white; }
      .location { font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
      .code-block { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: monospace; margin: 10px 0; }
      .resolution { background: #e8f6e8; padding: 15px; border-radius: 4px; margin: 10px 0; }
      .resolution h4 { color: #27ae60; margin-bottom: 10px; }
      .resolution ol { margin-left: 20px; }
      .example { margin: 10px 0; }
      .example-incorrect { background: #fde8e8; padding: 10px; border-radius: 4px; margin-bottom: 5px; }
      .example-correct { background: #e8f6e8; padding: 10px; border-radius: 4px; }
    `;
  }

  /**
   * Generates HTML summary section
   * @param {Array} errors - Errors
   * @returns {string} HTML summary
   */
  generateHTMLSummary(errors) {
    const byType = {};
    const bySeverity = {};
    
    for (const error of errors) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }
    
    let html = '<div class="summary-grid">';
    html += `<div class="summary-card"><div class="value">${errors.length}</div><div class="label">Total Errors</div></div>`;
    
    for (const [severity, count] of Object.entries(bySeverity)) {
      html += `<div class="summary-card"><div class="value">${count}</div><div class="label">${severity}</div></div>`;
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Generates HTML errors section
   * @param {Array} errors - Errors
   * @param {Object} options - Format options
   * @returns {string} HTML errors
   */
  generateHTMLErrors(errors, options) {
    let html = '';
    
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      html += this.formatErrorHTML(error, options, i);
    }
    
    return html;
  }

  /**
   * Formats a single error for HTML
   * @param {Object} error - Error object
   * @param {Object} options - Format options
   * @param {number} index - Error index
   * @returns {string} HTML formatted error
   */
  formatErrorHTML(error, options, index) {
    const severityClass = `severity-${error.severity}`;
    
    let html = `<div class="error-card ${severityClass}" data-category="${error.category}" data-severity="${error.severity}" data-type="${error.type}">`;
    html += `<div class="error-header" onclick="toggleError(${index})">`;
    html += `<div><strong>${this.escapeHTML(error.message)}</strong></div>`;
    html += `<div>`;
    html += `<span class="badge badge-type">${error.type}</span> `;
    html += `<span class="badge badge-severity">${error.severity}</span> `;
    html += `<span class="badge badge-category">${error.category}</span>`;
    html += `</div></div>`;
    
    html += `<div class="error-body" id="error-${index}">`;
    
    if (error.location) {
      html += `<div class="location">${this.escapeHTML(error.location.filePath)}:${error.location.line}:${error.location.column}</div>`;
      if (error.location.context) {
        html += `<div class="code-block">${this.escapeHTML(error.location.context)}</div>`;
      }
    }
    
    if (error.description) {
      html += `<p>${this.escapeHTML(error.description)}</p>`;
    }
    
    if (error.causes?.length > 0) {
      html += '<h4>Possible Causes:</h4><ul>';
      for (const cause of error.causes) {
        html += `<li>${this.escapeHTML(cause)}</li>`;
      }
      html += '</ul>';
    }
    
    if (options.includeResolutions && error.resolutions?.length > 0) {
      for (const resolution of error.resolutions) {
        html += `<div class="resolution">`;
        html += `<h4>${this.escapeHTML(resolution.title)}</h4>`;
        html += `<p>${this.escapeHTML(resolution.description)}</p>`;
        if (resolution.steps?.length > 0) {
          html += '<ol>';
          for (const step of resolution.steps) {
            html += `<li>${this.escapeHTML(step.description)}</li>`;
          }
          html += '</ol>';
        }
        html += '</div>';
      }
    }
    
    if (options.includeExamples && error.examples?.length > 0) {
      html += '<h4>Code Examples:</h4>';
      for (const example of error.examples) {
        html += '<div class="example">';
        html += `<div class="example-incorrect"><strong>❌ Incorrect:</strong><pre>${this.escapeHTML(example.incorrect)}</pre></div>`;
        html += `<div class="example-correct"><strong>✅ Correct:</strong><pre>${this.escapeHTML(example.correct)}</pre></div>`;
        if (example.explanation) {
          html += `<p><em>${this.escapeHTML(example.explanation)}</em></p>`;
        }
        html += '</div>';
      }
    }
    
    html += '</div></div>';
    return html;
  }

  /**
   * Gets JavaScript for HTML interactivity
   * @param {Array} errors - Errors for data
   * @returns {string} JavaScript code
   */
  getHTMLScript(errors) {
    return `
      const errors = ${JSON.stringify(errors)};
      
      function toggleError(index) {
        const body = document.getElementById('error-' + index);
        body.classList.toggle('open');
      }
      
      function filterErrors() {
        const category = document.getElementById('categoryFilter').value;
        const severity = document.getElementById('severityFilter').value;
        const cards = document.querySelectorAll('.error-card');
        
        cards.forEach(card => {
          const matchCategory = category === 'all' || card.dataset.category === category;
          const matchSeverity = severity === 'all' || card.dataset.severity === severity;
          card.style.display = matchCategory && matchSeverity ? 'block' : 'none';
        });
      }
      
      function sortErrors() {
        const sortBy = document.getElementById('sortBy').value;
        const container = document.getElementById('errorsContainer');
        const cards = Array.from(container.querySelectorAll('.error-card'));
        
        cards.sort((a, b) => {
          if (sortBy === 'severity') {
            const order = ['blocker', 'critical', 'major', 'minor', 'trivial'];
            return order.indexOf(a.dataset.severity) - order.indexOf(b.dataset.severity);
          }
          return a.dataset[sortBy].localeCompare(b.dataset[sortBy]);
        });
        
        cards.forEach(card => container.appendChild(card));
      }
    `;
  }

  /**
   * Escapes HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = ReportGenerator;
