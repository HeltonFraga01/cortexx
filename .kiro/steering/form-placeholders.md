---
inclusion: fileMatch
fileMatchPattern: ['**/*.tsx', '**/*.ts']
---

# Form Placeholder Rules

## Core Rule

**Leave placeholders EMPTY unless showing format or for search/select fields.**

Prevents confusion where users think the field is pre-filled.

## When to Use Placeholders

### ✅ Format Indicators Only

```tsx
<Input placeholder="+55 11 99999-9999" />  // Phone format
<Input placeholder="https://example.com" />  // URL format
<Input placeholder="email@example.com" />  // Email format
<Input placeholder="sk-proj-..." />  // API key format
```

### ✅ Search/Select/Filter Fields

```tsx
<Input placeholder="Search..." />
<Select placeholder="Select an option" />
<Input placeholder="Filter by name..." />
```

## When NOT to Use Placeholders

### ❌ Simple Text Fields

```tsx
// ❌ WRONG - Repeating label
<Label>Name</Label>
<Input placeholder="Name" />

// ❌ WRONG - Example
<Label>Name</Label>
<Input placeholder="Ex: John Smith" />

// ✅ CORRECT - Empty
<Label>Name</Label>
<Input />
```

### ❌ Instructions

```tsx
// ❌ WRONG
<Input placeholder="Enter your full name" />
<Input placeholder="Paste your token" />

// ✅ CORRECT - Use helper text
<Label>Token</Label>
<Input />
<p className="text-xs text-muted-foreground">Paste your access token here</p>
```

### ❌ Fields with Values

```tsx
// ✅ CORRECT
<Input value={userData.name} onChange={...} />

// ❌ WRONG
<Input value={userData.name} placeholder="User name" onChange={...} />
```

## Decision Checklist

Use placeholder ONLY if:
- Field has specific format (phone, URL, email, key) OR
- Field is search/select/filter

Otherwise: **leave empty**

## Examples

```tsx
// User Form
<Label>Full Name</Label>
<Input />

<Label>Email</Label>
<Input placeholder="email@example.com" />

<Label>Phone</Label>
<Input placeholder="+55 11 99999-9999" />

<Label>Password</Label>
<Input type="password" />

// Connection Form
<Label>Connection Name</Label>
<Input />

<Label>Host</Label>
<Input />

<Label>Port</Label>
<Input type="number" />

<Label>API URL</Label>
<Input placeholder="https://api.example.com" />

// Token Form
<Label>Access Token</Label>
<Input type="password" />
<p className="text-xs text-muted-foreground">Paste your access token here</p>
```
