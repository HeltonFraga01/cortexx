---
inclusion: fileMatch
fileMatchPattern: ['**/*.tsx', '**/*.ts']
---

# UX Patterns

## Core Rule: No Modals for Forms or Data

**NEVER use `Dialog`, `Sheet`, or `Modal` for forms or data display.** All interactions are inline.

## Component Usage Rules

**Always Use**: `Card`, `Button`, `Input`, `Select`, `Checkbox`, `Table`, `Accordion`, `Tabs`

**Restricted Use**:
- `AlertDialog` - ONLY for destructive confirmations (delete actions)
- `Popover` - ONLY for small context menus
- `DropdownMenu` - ONLY for action menus

**Never Use**: `Dialog`, `Sheet`, `Modal` for forms or data

## Pattern: Inline Forms

Show/hide forms with conditional `Card` rendering:

```tsx
const [showNewForm, setShowNewForm] = useState(false);
const [editingId, setEditingId] = useState<number | null>(null);

{showNewForm && (
  <Card className="border-2 border-primary">
    <CardHeader><CardTitle>New Item</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <Input />
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setShowNewForm(false)}>
          <X className="h-4 w-4 mr-2" />Cancel
        </Button>
        <Button onClick={handleSave}>
          <Check className="h-4 w-4 mr-2" />Save
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

## Pattern: Inline Row Editing

Toggle between view/edit modes in same row:

```tsx
<TableRow>
  {editingId === item.id ? (
    <>
      <TableCell><Input value={formData.name} /></TableCell>
      <TableCell>
        <Button size="sm" onClick={handleSave}><Check /></Button>
        <Button size="sm" variant="outline" onClick={handleCancel}><X /></Button>
      </TableCell>
    </>
  ) : (
    <>
      <TableCell>{item.name}</TableCell>
      <TableCell>
        <Button size="sm" onClick={() => setEditingId(item.id)}><Edit /></Button>
      </TableCell>
    </>
  )}
</TableRow>
```

## Pattern: Row Expansion

Expand rows inline for details:

```tsx
const [expandedItem, setExpandedItem] = useState<string | null>(null);

{items.map((item) => (
  <>
    <TableRow key={item.id}>
      <TableCell>{item.name}</TableCell>
      <TableCell>
        <Button size="sm" onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
          {expandedItem === item.id ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </TableCell>
    </TableRow>
    {expandedItem === item.id && (
      <TableRow>
        <TableCell colSpan={2} className="bg-muted/50 p-6">
          {/* Details */}
        </TableCell>
      </TableRow>
    )}
  </>
))}
```

## Pattern: Destructive Confirmations

Use `useConfirmDialog` hook for delete actions:

```tsx
const { confirm, ConfirmDialog } = useConfirmDialog();

const handleDelete = async (id: number) => {
  const confirmed = await confirm({
    title: 'Confirm Deletion',
    description: 'This action cannot be undone.',
    confirmText: 'Delete',
    variant: 'destructive',
  });
  if (confirmed) await deleteItem(id);
};

return <ConfirmDialog />;
```
