# Script Page Components

This directory contains all the sub-components for the script generation page, extracted from the original monolithic component for better maintainability and reusability.

## Component Hierarchy

```
ScriptGenerationPage (page.tsx)
├── ScriptHeader
│   ├── Navigation (back button)
│   ├── Title & Book info
│   └── Actions (sentence count, audio generation link)
│
├── GenerationProgress (conditional)
│   ├── Status icon (loading/success/error)
│   ├── Status message
│   ├── Progress bar
│   └── Preview button
│
├── Main Content (3 columns)
│   ├── ScriptGenerationCard
│   │   ├── Empty state (no segments)
│   │   ├── Initial state (no script)
│   │   └── Generated state
│   │       ├── Status summary
│   │       ├── Action buttons (preview, export, regenerate)
│   │       └── Advanced options (incremental, regenerate segments)
│   │
│   ├── CharacterAssignment (conditional)
│   │   ├── Progress indicator
│   │   ├── Assignment list (first 10 sentences)
│   │   └── Save button
│   │
│   └── ScriptSentencesList (conditional)
│       └── Sentence items
│           ├── Metadata (index, character, emotion, segment)
│           ├── Text content
│           └── Actions (edit, delete)
│
└── Sidebar (1 column)
    ├── StatusSidebar
    │   ├── Status Overview
    │   │   ├── Segments count
    │   │   ├── Sentences count
    │   │   ├── Characters count
    │   │   └── Assigned sentences count
    │   │
    │   ├── Quick Actions
    │   │   ├── View segments
    │   │   ├── Manage characters
    │   │   └── Generate audio
    │   │
    │   └── Tips section

Modals (conditional rendering)
├── ScriptPreviewModal
│   └── Full script preview with formatting
│
├── EditSentenceModal
│   ├── Textarea for editing
│   └── Save/Cancel buttons
│
├── IncrementalProcessingModal
│   ├── Segment selection list
│   └── Start processing button
│
└── RegenerateSegmentsModal
    ├── Multi-select segment list
    ├── Bulk selection actions
    └── Regenerate button
```

## Component Files

### Core Components

- **`types.ts`** - Shared TypeScript interfaces used across components
- **`index.ts`** - Barrel export for clean imports

### UI Components

1. **`ScriptHeader.tsx`** - Page header with navigation and actions
2. **`GenerationProgress.tsx`** - Progress indicator during generation
3. **`ScriptGenerationCard.tsx`** - Main generation controls and status
4. **`CharacterAssignment.tsx`** - Interface for assigning characters to sentences
5. **`ScriptSentencesList.tsx`** - List view of all script sentences
6. **`StatusSidebar.tsx`** - Right sidebar with overview and quick actions

### Modal Components

7. **`ScriptPreviewModal.tsx`** - Full-screen script preview
8. **`EditSentenceModal.tsx`** - Edit individual sentence
9. **`IncrementalProcessingModal.tsx`** - Select starting point for incremental generation
10. **`RegenerateSegmentsModal.tsx`** - Multi-select segments for regeneration

## Usage

Import components from the barrel export:

```tsx
import {
  ScriptHeader,
  GenerationProgress,
  ScriptGenerationCard,
  // ... other components
} from "./components";
```

Or import specific components:

```tsx
import { ScriptHeader } from "./components/ScriptHeader";
```

## Props Interface

Each component has a well-defined props interface. See individual component files for detailed prop types.

### Example: ScriptHeader

```tsx
interface ScriptHeaderProps {
  bookId: string;
  bookTitle: string;
  scriptSentencesCount: number;
  hasScriptSentences: boolean;
}
```

## State Management

State is managed in the parent `page.tsx` component and passed down as props. This follows the "lifting state up" pattern for better control and testability.

## Styling

All components use:
- **Tailwind CSS** for styling
- **shadcn/ui** components (Button, Card, Badge, Progress, etc.)
- **Lucide React** for icons

## Best Practices

1. **Single Responsibility** - Each component handles one specific part of the UI
2. **Props Over State** - Components receive data via props, keeping them stateless when possible
3. **Composition** - Complex UIs are built by composing smaller components
4. **Type Safety** - All props are fully typed with TypeScript interfaces
5. **Accessibility** - Semantic HTML and proper ARIA attributes

## Future Improvements

- [ ] Add unit tests for each component
- [ ] Extract API logic to custom hooks
- [ ] Add loading skeletons
- [ ] Implement optimistic updates
- [ ] Add keyboard shortcuts
- [ ] Improve mobile responsiveness
