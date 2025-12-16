/**
 * WhatsApp Text Formatter
 * 
 * Converts WhatsApp formatting syntax to React components
 * Supports: *bold*, _italic_, ~strikethrough~, ```monospace```
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 5.1, 5.2, 5.4
 */

import React from 'react'
import DOMPurify from 'dompurify'

// WhatsApp formatting patterns
// Rules: No space after opening marker or before closing marker
const PATTERNS = {
  // ```monospace``` - must be processed first (greedy)
  monospace: /```([^`]+)```/g,
  // *bold* - no space after * or before *
  bold: /\*([^\s*](?:[^*]*[^\s*])?)\*/g,
  // _italic_ - no space after _ or before _
  italic: /_([^\s_](?:[^_]*[^\s_])?)_/g,
  // ~strikethrough~ - no space after ~ or before ~
  strikethrough: /~([^\s~](?:[^~]*[^\s~])?)~/g,
}

// Single character patterns (for single char content)
const SINGLE_CHAR_PATTERNS = {
  bold: /\*([^\s*])\*/g,
  italic: /_([^\s_])_/g,
  strikethrough: /~([^\s~])~/g,
}

export interface FormatOptions {
  /** Convert URLs to clickable links */
  linkify?: boolean
  /** Preserve newline characters as <br /> */
  preserveLineBreaks?: boolean
  /** Sanitize HTML to prevent XSS */
  sanitize?: boolean
}

const DEFAULT_OPTIONS: FormatOptions = {
  linkify: true,
  preserveLineBreaks: true,
  sanitize: true,
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, char => htmlEscapes[char])
}

/**
 * Converts WhatsApp formatting to HTML
 */
function convertToHtml(text: string, options: FormatOptions): string {
  let result = text

  // Escape HTML first to prevent XSS
  if (options.sanitize) {
    result = escapeHtml(result)
  }

  // Process monospace first (triple backticks are greedy)
  result = result.replace(PATTERNS.monospace, '<code class="wa-monospace">$1</code>')

  // Process other formatting
  // Handle single character content first
  result = result.replace(SINGLE_CHAR_PATTERNS.bold, '<strong class="wa-bold">$1</strong>')
  result = result.replace(SINGLE_CHAR_PATTERNS.italic, '<em class="wa-italic">$1</em>')
  result = result.replace(SINGLE_CHAR_PATTERNS.strikethrough, '<del class="wa-strikethrough">$1</del>')

  // Handle multi-character content
  result = result.replace(PATTERNS.bold, '<strong class="wa-bold">$1</strong>')
  result = result.replace(PATTERNS.italic, '<em class="wa-italic">$1</em>')
  result = result.replace(PATTERNS.strikethrough, '<del class="wa-strikethrough">$1</del>')

  // Preserve line breaks
  if (options.preserveLineBreaks) {
    result = result.replace(/\n/g, '<br />')
  }

  return result
}

/**
 * Converts WhatsApp formatted text to React nodes
 * 
 * @param text - The text with WhatsApp formatting
 * @param options - Formatting options
 * @returns React nodes with proper styling
 */
export function formatWhatsAppText(
  text: string | null | undefined,
  options: FormatOptions = {}
): React.ReactNode {
  if (!text) {
    return null
  }

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const html = convertToHtml(text, mergedOptions)

  // Sanitize the final HTML if enabled
  const sanitizedHtml = mergedOptions.sanitize 
    ? DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'br'],
        ALLOWED_ATTR: ['class'],
      })
    : html

  return React.createElement('span', {
    className: 'wa-formatted-text',
    dangerouslySetInnerHTML: { __html: sanitizedHtml },
  })
}

/**
 * Removes WhatsApp formatting markers and returns plain text
 * 
 * @param text - The text with WhatsApp formatting
 * @returns Plain text without formatting markers
 */
export function stripWhatsAppFormatting(text: string | null | undefined): string {
  if (!text) {
    return ''
  }

  let result = text

  // Remove monospace markers
  result = result.replace(/```([^`]+)```/g, '$1')
  
  // Remove other markers (handle single char first)
  result = result.replace(/\*([^\s*])\*/g, '$1')
  result = result.replace(/_([^\s_])_/g, '$1')
  result = result.replace(/~([^\s~])~/g, '$1')
  
  // Remove multi-char markers
  result = result.replace(/\*([^\s*](?:[^*]*[^\s*])?)\*/g, '$1')
  result = result.replace(/_([^\s_](?:[^_]*[^\s_])?)_/g, '$1')
  result = result.replace(/~([^\s~](?:[^~]*[^\s~])?)~/g, '$1')

  return result
}

/**
 * Checks if text contains WhatsApp formatting markers
 * 
 * @param text - The text to check
 * @returns True if text contains formatting markers
 */
export function hasWhatsAppFormatting(text: string | null | undefined): boolean {
  if (!text) {
    return false
  }

  // Check for any formatting pattern
  return (
    PATTERNS.monospace.test(text) ||
    PATTERNS.bold.test(text) ||
    PATTERNS.italic.test(text) ||
    PATTERNS.strikethrough.test(text) ||
    SINGLE_CHAR_PATTERNS.bold.test(text) ||
    SINGLE_CHAR_PATTERNS.italic.test(text) ||
    SINGLE_CHAR_PATTERNS.strikethrough.test(text)
  )
}

/**
 * Formats text and also extracts URLs for link preview
 * 
 * @param text - The text to format
 * @param options - Formatting options
 * @returns Object with formatted content and extracted URLs
 */
export function formatWithUrls(
  text: string | null | undefined,
  options: FormatOptions = {}
): { formatted: React.ReactNode; urls: string[] } {
  if (!text) {
    return { formatted: null, urls: [] }
  }

  // Extract URLs
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi
  const urls = text.match(urlRegex) || []

  return {
    formatted: formatWhatsAppText(text, options),
    urls: [...new Set(urls)], // Remove duplicates
  }
}

export default {
  formatWhatsAppText,
  stripWhatsAppFormatting,
  hasWhatsAppFormatting,
  formatWithUrls,
}
