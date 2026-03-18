# Design Guidelines

## UI/UX Design Principles

### Core Design Philosophy

VisgniteAI follows a **function-first, clarity-focused** design approach. The interface prioritizes operational efficiency over visual flourish, ensuring operators can quickly understand system state and take action.

### Design Principles

#### 1. Clarity Over Complexity
- Clear visual hierarchy with consistent spacing
- Obvious action buttons and navigation
- Minimal cognitive load for common operations
- Progressive disclosure for advanced features

#### 2. Operational Efficiency
- Quick access to frequently used actions
- Keyboard shortcuts for power users
- Bulk operations for repetitive tasks
- Contextual actions based on current view

#### 3. Consistent Patterns
- Reusable component library (Radix UI)
- Consistent interaction patterns across features
- Predictable navigation structure
- Uniform error and success messaging

#### 4. Responsive Feedback
- Immediate visual feedback for user actions
- Loading states for async operations
- Optimistic UI updates where appropriate
- Clear error messages with actionable guidance

#### 5. Accessibility First
- Semantic HTML structure
- ARIA labels for screen readers
- Keyboard navigation support
- Sufficient color contrast (WCAG AA)

## Visual Design System

### Color Palette

#### Primary Colors
```css
/* Brand colors */
--primary: 222.2 47.4% 11.2%;        /* Dark slate */
--primary-foreground: 210 40% 98%;   /* Light text */

/* Accent colors */
--accent: 210 40% 96.1%;             /* Light accent */
--accent-foreground: 222.2 47.4% 11.2%; /* Dark text */
```

#### Semantic Colors
```css
/* Status colors */
--success: 142 76% 36%;    /* Green for success states */
--warning: 38 92% 50%;     /* Orange for warnings */
--error: 0 84% 60%;        /* Red for errors */
--info: 221 83% 53%;       /* Blue for information */

/* Background colors */
--background: 0 0% 100%;   /* White background */
--foreground: 222.2 84% 4.9%; /* Dark text */

/* Muted colors */
--muted: 210 40% 96.1%;    /* Light gray */
--muted-foreground: 215.4 16.3% 46.9%; /* Medium gray text */
```

#### Border and Divider Colors
```css
--border: 214.3 31.8% 91.4%;  /* Light border */
--ring: 222.2 84% 4.9%;       /* Focus ring */
```

### Typography

#### Font Families
```css
/* Primary font stack */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;

/* Monospace for code */
font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono",
             Consolas, "Courier New", monospace;
```

#### Font Sizes
```css
/* Text sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

#### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### Line Heights
```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### Spacing System

Consistent spacing scale based on 4px increments:

```css
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
--spacing-10: 2.5rem;  /* 40px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */
```

### Border Radius

```css
--radius-sm: 0.125rem;  /* 2px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-full: 9999px;  /* Fully rounded */
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

## Component Design Patterns

### Atomic Design Structure

Components are organized by complexity level:

```
atoms/          Basic building blocks (Button, Input, Label)
    ↓
molecules/      Simple combinations (FormField, SearchBar, Card)
    ↓
organisms/      Complex components (DataTable, NavigationBar, Form)
    ↓
templates/      Page layouts (DashboardLayout, SettingsLayout)
    ↓
pages/          Complete pages (app/ directory)
```

### Button Patterns

#### Primary Actions
```typescript
<Button variant="default" size="default">
  Create Board
</Button>
```

#### Secondary Actions
```typescript
<Button variant="outline" size="default">
  Cancel
</Button>
```

#### Destructive Actions
```typescript
<Button variant="destructive" size="default">
  Delete
</Button>
```

#### Icon Buttons
```typescript
<Button variant="ghost" size="icon">
  <TrashIcon className="h-4 w-4" />
</Button>
```

### Form Patterns

#### Standard Form Field
```typescript
<div className="space-y-2">
  <Label htmlFor="name">Board Name</Label>
  <Input
    id="name"
    type="text"
    placeholder="Enter board name"
    value={name}
    onChange={(e) => setName(e.target.value)}
  />
  <p className="text-sm text-muted-foreground">
    A descriptive name for your board
  </p>
</div>
```

#### Form Validation
```typescript
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    aria-invalid={!!error}
    aria-describedby={error ? "email-error" : undefined}
  />
  {error && (
    <p id="email-error" className="text-sm text-destructive">
      {error}
    </p>
  )}
</div>
```

### Card Patterns

#### Standard Card
```typescript
<Card>
  <CardHeader>
    <CardTitle>Board Name</CardTitle>
    <CardDescription>Board description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Card content */}
  </CardContent>
  <CardFooter>
    {/* Card actions */}
  </CardFooter>
</Card>
```

#### Interactive Card
```typescript
<Card className="cursor-pointer hover:bg-accent transition-colors">
  <CardHeader>
    <CardTitle>Clickable Board</CardTitle>
  </CardHeader>
</Card>
```

### Table Patterns

#### Data Table with TanStack Table
```typescript
<Table>
  <TableHeader>
    {table.getHeaderGroups().map((headerGroup) => (
      <TableRow key={headerGroup.id}>
        {headerGroup.headers.map((header) => (
          <TableHead key={header.id}>
            {flexRender(
              header.column.columnDef.header,
              header.getContext()
            )}
          </TableHead>
        ))}
      </TableRow>
    ))}
  </TableHeader>
  <TableBody>
    {table.getRowModel().rows.map((row) => (
      <TableRow key={row.id}>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Dialog Patterns

#### Confirmation Dialog
```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleConfirm}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Loading States

#### Skeleton Loaders
```typescript
<Card>
  <CardHeader>
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-[200px] w-full" />
  </CardContent>
</Card>
```

#### Spinner
```typescript
<div className="flex items-center justify-center p-8">
  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
</div>
```

### Empty States

```typescript
<div className="flex flex-col items-center justify-center p-8 text-center">
  <InboxIcon className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold">No boards yet</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Get started by creating your first board
  </p>
  <Button onClick={handleCreate}>
    <PlusIcon className="h-4 w-4 mr-2" />
    Create Board
  </Button>
</div>
```

## Layout Patterns

### Dashboard Layout
```typescript
<div className="flex min-h-screen">
  {/* Sidebar */}
  <aside className="w-64 border-r bg-muted/40">
    <Navigation />
  </aside>

  {/* Main content */}
  <main className="flex-1">
    <header className="border-b">
      <div className="container py-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
    </header>
    <div className="container py-6">
      {children}
    </div>
  </main>
</div>
```

### Grid Layout
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map((item) => (
    <Card key={item.id}>
      {/* Card content */}
    </Card>
  ))}
</div>
```

### List Layout
```typescript
<div className="space-y-4">
  {items.map((item) => (
    <Card key={item.id} className="p-4">
      {/* List item content */}
    </Card>
  ))}
</div>
```

## Responsive Design

### Breakpoints
```css
/* Tailwind CSS breakpoints */
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X large devices */
```

### Mobile-First Approach
```typescript
{/* Stack on mobile, grid on desktop */}
<div className="flex flex-col md:flex-row gap-4">
  <div className="flex-1">Left column</div>
  <div className="flex-1">Right column</div>
</div>

{/* Hide on mobile, show on desktop */}
<div className="hidden md:block">
  Desktop only content
</div>

{/* Show on mobile, hide on desktop */}
<div className="block md:hidden">
  Mobile only content
</div>
```

## Accessibility Guidelines

### Semantic HTML
```typescript
{/* Use semantic elements */}
<nav>Navigation</nav>
<main>Main content</main>
<aside>Sidebar</aside>
<footer>Footer</footer>

{/* Not generic divs */}
<div>Navigation</div>
<div>Main content</div>
```

### ARIA Labels
```typescript
{/* Icon-only buttons need labels */}
<Button variant="ghost" size="icon" aria-label="Delete board">
  <TrashIcon className="h-4 w-4" />
</Button>

{/* Descriptive labels for form fields */}
<Label htmlFor="email">Email Address</Label>
<Input
  id="email"
  type="email"
  aria-describedby="email-help"
/>
<p id="email-help" className="text-sm text-muted-foreground">
  We'll never share your email
</p>
```

### Keyboard Navigation
```typescript
{/* Ensure all interactive elements are keyboard accessible */}
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Clickable div
</div>
```

### Focus Management
```typescript
{/* Visible focus indicators */}
<Button className="focus:ring-2 focus:ring-ring focus:ring-offset-2">
  Focusable button
</Button>

{/* Trap focus in modals */}
<Dialog>
  <DialogContent>
    {/* Focus is trapped within dialog */}
  </DialogContent>
</Dialog>
```

### Color Contrast

Ensure WCAG AA compliance:
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

```typescript
{/* Good contrast */}
<p className="text-foreground">Dark text on light background</p>

{/* Avoid low contrast */}
<p className="text-muted-foreground">
  Use for secondary text only
</p>
```

## Animation and Transitions

### Subtle Transitions
```css
/* Hover transitions */
.transition-colors {
  transition: color 150ms ease-in-out,
              background-color 150ms ease-in-out;
}

/* Transform transitions */
.transition-transform {
  transition: transform 150ms ease-in-out;
}
```

### Loading Animations
```typescript
{/* Spinner animation */}
<Loader2 className="animate-spin" />

{/* Pulse animation for loading states */}
<div className="animate-pulse">
  <Skeleton />
</div>
```

### Page Transitions
```typescript
{/* Fade in on mount */}
<div className="animate-in fade-in duration-300">
  Content
</div>

{/* Slide in from bottom */}
<div className="animate-in slide-in-from-bottom duration-300">
  Content
</div>
```

## Icon Usage

### Icon Library
Using Lucide React for consistent icon set:

```typescript
import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  XIcon,
  AlertCircleIcon,
  InfoIcon,
} from 'lucide-react';
```

### Icon Sizing
```typescript
{/* Small icons (16px) */}
<Icon className="h-4 w-4" />

{/* Medium icons (20px) */}
<Icon className="h-5 w-5" />

{/* Large icons (24px) */}
<Icon className="h-6 w-6" />
```

### Icon with Text
```typescript
<Button>
  <PlusIcon className="h-4 w-4 mr-2" />
  Create Board
</Button>
```

## Error Handling UI

### Inline Errors
```typescript
<div className="rounded-md bg-destructive/10 p-4">
  <div className="flex">
    <AlertCircleIcon className="h-5 w-5 text-destructive" />
    <div className="ml-3">
      <h3 className="text-sm font-medium text-destructive">
        Error
      </h3>
      <p className="text-sm text-destructive/80 mt-1">
        {errorMessage}
      </p>
    </div>
  </div>
</div>
```

### Toast Notifications
```typescript
{/* Success toast */}
toast.success("Board created successfully");

{/* Error toast */}
toast.error("Failed to create board");

{/* Info toast */}
toast.info("Changes saved");
```

## Data Visualization

### Charts (Recharts)
```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="value" stroke="#8884d8" />
  </LineChart>
</ResponsiveContainer>
```

### Status Badges
```typescript
{/* Success status */}
<Badge variant="success">Active</Badge>

{/* Warning status */}
<Badge variant="warning">Pending</Badge>

{/* Error status */}
<Badge variant="destructive">Failed</Badge>

{/* Default status */}
<Badge variant="secondary">Draft</Badge>
```

## Performance Considerations

### Image Optimization
```typescript
import Image from 'next/image';

<Image
  src="/image.jpg"
  alt="Description"
  width={500}
  height={300}
  loading="lazy"
/>
```

### Code Splitting
```typescript
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### Virtualization for Long Lists
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

// Virtualize long lists for performance
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
});
```

## Design Checklist

### Component Design
- [ ] Follows atomic design structure
- [ ] Uses Radix UI primitives where applicable
- [ ] Implements proper TypeScript types
- [ ] Includes loading and error states
- [ ] Handles empty states gracefully
- [ ] Responsive across breakpoints
- [ ] Accessible with ARIA labels
- [ ] Keyboard navigable
- [ ] Sufficient color contrast

### Page Design
- [ ] Clear visual hierarchy
- [ ] Consistent spacing and alignment
- [ ] Proper heading structure (h1, h2, h3)
- [ ] Breadcrumb navigation where appropriate
- [ ] Loading states for async data
- [ ] Error boundaries for error handling
- [ ] Mobile-responsive layout
- [ ] Optimized images and assets

## Unresolved Questions

1. Should we implement dark mode support?
2. What is the strategy for internationalization (i18n)?
3. Should we provide design tokens as CSS variables or Tailwind config?
4. What is the approach for custom theming by users?
5. Should we create a Figma design system library?
