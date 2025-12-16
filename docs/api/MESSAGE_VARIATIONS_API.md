# Message Variations API Documentation

## Overview

API endpoints for message variation system that enables humanized message sending with automatic text variations.

## Authentication

All endpoints require user authentication via token:

```
Headers:
  token: <user_token>
  OR
  Authorization: Bearer <user_token>
```

## Endpoints

### 1. Validate Variations

Validates message template syntax and returns structured feedback.

**Endpoint:** `POST /api/user/messages/validate-variations`

**Request Body:**
```json
{
  "template": "Olá|Oi|E aí, tudo bem?"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "blocks": [
      {
        "index": 0,
        "variations": ["Olá", "Oi", "E aí"],
        "variationCount": 3
      }
    ],
    "totalCombinations": 3,
    "errors": [],
    "warnings": [],
    "metadata": {
      "blockCount": 1,
      "hasStaticText": true
    }
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Template com variações inválidas",
  "message": "Corrija os erros de sintaxe nas variações",
  "errors": [
    {
      "type": "INSUFFICIENT_VARIATIONS",
      "message": "Bloco 1 tem apenas 1 variação(ões). Mínimo: 2",
      "blockIndex": 0,
      "suggestion": "Adicione mais variações separadas por | ou remova o bloco"
    }
  ],
  "warnings": []
}
```

**Error Types:**
- `INSUFFICIENT_VARIATIONS` - Less than 2 variations in block
- `TOO_MANY_VARIATIONS` - More than 10 variations in block
- `EMPTY_VARIATIONS` - Empty variation detected
- `PARSE_ERROR` - General parsing error

---

### 2. Generate Preview

Generates preview samples of processed messages with variations.

**Endpoint:** `POST /api/user/messages/preview-variations`

**Request Body:**
```json
{
  "template": "Olá|Oi {{nome}}, tudo bem?|como vai?",
  "variables": {
    "nome": "João"
  },
  "count": 3
}
```

**Parameters:**
- `template` (string, required): Message template with variations
- `variables` (object, optional): Variables for substitution
- `count` (number, optional): Number of previews (1-10, default: 3)

**Response:**
```json
{
  "success": true,
  "data": {
    "previews": [
      {
        "index": 0,
        "message": "Olá João, tudo bem?",
        "selections": [
          {
            "blockIndex": 0,
            "variationIndex": 0,
            "selected": "Olá",
            "totalOptions": 2
          },
          {
            "blockIndex": 1,
            "variationIndex": 0,
            "selected": "tudo bem?",
            "totalOptions": 2
          }
        ],
        "hasVariations": true,
        "hasVariables": true
      }
    ],
    "count": 3
  }
}
```

---

### 3. Get Campaign Variation Statistics

Retrieves variation usage statistics for a campaign.

**Endpoint:** `GET /api/user/campaigns/:campaignId/variation-stats`

**Parameters:**
- `campaignId` (path, required): Campaign ID

**Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "campaign-123",
    "totalSent": 1000,
    "uniqueCombinations": 45,
    "distribution": {
      "block_0": {
        "Olá": {
          "count": 334,
          "percentage": 33.4
        },
        "Oi": {
          "count": 333,
          "percentage": 33.3
        },
        "E aí": {
          "count": 333,
          "percentage": 33.3
        }
      }
    },
    "deliveryMetrics": {
      "delivered": 980,
      "failed": 20,
      "read": 450
    }
  }
}
```

---

### 4. Export Variation Statistics

Exports variation statistics in JSON or CSV format.

**Endpoint:** `GET /api/user/campaigns/:campaignId/variation-stats/export`

**Parameters:**
- `campaignId` (path, required): Campaign ID
- `format` (query, optional): Export format - `json` or `csv` (default: `json`)

**Example:**
```
GET /api/user/campaigns/campaign-123/variation-stats/export?format=csv
```

**Response:**
- Content-Type: `application/json` or `text/csv`
- Content-Disposition: `attachment; filename="variation-stats-{campaignId}-{date}.{format}"`

**CSV Format:**
```csv
Block,Variation,Count,Percentage
0,Olá,334,33.4
0,Oi,333,33.3
0,E aí,333,33.3
```

---

## Integration with Message Sending

### Single Message Send

When sending a single message with variations:

```javascript
POST /api/user/messages/send
{
  "phone": "5511999999999",
  "message": "Olá|Oi {{nome}}, tudo bem?",
  "variables": {
    "nome": "João"
  }
}
```

The system automatically:
1. Parses variations
2. Selects random options
3. Applies variable substitution
4. Sends via WUZAPI
5. Logs variation usage

### Bulk Campaign

When creating a bulk campaign with variations:

```javascript
POST /api/user/bulk-campaigns
{
  "name": "Campaign Test",
  "messageContent": "Olá|Oi|E aí, tudo bem?",
  "contacts": [...],
  ...
}
```

Each contact receives:
- Different random variation combination
- Individual processing
- Tracked variation usage

---

## Template Management

### Create Template with Variations

```javascript
POST /api/user/templates
{
  "name": "Greeting Template",
  "content": "Olá|Oi|E aí {{nome}}, tudo bem?"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template criado com sucesso",
  "data": {
    "id": 1,
    "name": "Greeting Template",
    "content": "Olá|Oi|E aí {{nome}}, tudo bem?",
    "hasVariations": true,
    "variationInfo": {
      "blockCount": 1,
      "totalCombinations": 3
    }
  }
}
```

### Update Template

```javascript
PUT /api/user/templates/:id
{
  "name": "Updated Template",
  "content": "Olá|Oi, tudo bem?"
}
```

Automatically validates variations and updates `hasVariations` flag.

---

## Error Handling

All endpoints follow consistent error format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable message",
  "details": {} // Optional additional details
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (invalid token)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Standard rate limits apply to all endpoints:
- 100 requests per minute per user
- 1000 requests per hour per user

---

## Performance Considerations

### Caching

- Template parsing is cached (LRU, 1000 entries, 1h TTL)
- Cache hit rate typically >70%
- Automatic cache management

### Bulk Processing

- Asynchronous processing for campaigns
- Progress tracking available
- Supports 1000+ messages per campaign

### Database Optimization

- Indexed queries for statistics
- Efficient aggregation
- Batch inserts for variation logs

---

## Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Validate variations
async function validateVariations(template, userToken) {
  const response = await axios.post(
    'http://localhost:3001/api/user/messages/validate-variations',
    { template },
    { headers: { 'token': userToken } }
  );
  return response.data;
}

// Generate preview
async function generatePreview(template, variables, userToken) {
  const response = await axios.post(
    'http://localhost:3001/api/user/messages/preview-variations',
    { template, variables, count: 3 },
    { headers: { 'token': userToken } }
  );
  return response.data;
}

// Get statistics
async function getStats(campaignId, userToken) {
  const response = await axios.get(
    `http://localhost:3001/api/user/campaigns/${campaignId}/variation-stats`,
    { headers: { 'token': userToken } }
  );
  return response.data;
}
```

### cURL

```bash
# Validate
curl -X POST http://localhost:3001/api/user/messages/validate-variations \
  -H "Content-Type: application/json" \
  -H "token: YOUR_TOKEN" \
  -d '{"template":"Olá|Oi, tudo bem?"}'

# Preview
curl -X POST http://localhost:3001/api/user/messages/preview-variations \
  -H "Content-Type: application/json" \
  -H "token: YOUR_TOKEN" \
  -d '{"template":"Olá|Oi {{nome}}","variables":{"nome":"João"},"count":3}'

# Statistics
curl -X GET http://localhost:3001/api/user/campaigns/campaign-123/variation-stats \
  -H "token: YOUR_TOKEN"

# Export
curl -X GET "http://localhost:3001/api/user/campaigns/campaign-123/variation-stats/export?format=csv" \
  -H "token: YOUR_TOKEN" \
  -o stats.csv
```

---

## Changelog

### Version 1.0 (January 2025)
- Initial release
- Validation endpoint
- Preview generation
- Statistics and export
- Template integration
- Bulk campaign support

---

**API Version:** 1.0  
**Last Updated:** January 2025
