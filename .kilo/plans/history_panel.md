# History Panel Redesign Plan

## Objective

Update the `VibeAssistantThread` component's history overlay to perfectly match the provided "Image 3" visual reference (a dark, simple list with dates on the right). The list items should be edge-to-edge rectangles with a subtle bottom border, rather than rounded pills with gaps. The title and timestamp should be stacked vertically on the left, with the trash icon (on hover) aligned to the right.

## Current State Analysis

- The list items currently use rounded corners (`rounded-md`), paddings (`px-3 py-2.5`), and gaps (`gap-0.5`).
- The timestamp is currently aligned to the right of the title.
- The overall container has paddings (`px-2 pt-2`).

## Target Design (Image 3)

- **Container:** No side padding. Items stretch full width.
- **List Items:**
  - Rectangular (no rounded corners).
  - Subtle bottom border divider (`border-b border-border/10` or `border-border/20`).
  - Height: Approximately `66px` based on the annotation.
  - Padding: Likely `px-4 py-3` or similar to achieve the height and match the edge-to-edge look.
- **Content Layout (per item):**
  - **Left Side:** Title (`14px` or `15px`) and below it, the Timestamp (`11px` or `12px`, muted). Stacked vertically.
  - **Right Side:** Trash icon (visible on hover).
- **Header:** Simple text (`History`) and icons (`+`, `x`), vertically centered.
- **Search Bar:** Simple input, no box shadow, subtle placeholder.

## Implementation Steps (`apps/web/src/components/assistant/vibe-assistant-thread.tsx`)

1.  **Update Container Padding:**
    - Remove `px-2 pt-2` and `gap-0.5` from the `<div className="flex flex-col px-2 pt-2 gap-0.5">` wrapping the list items. Change it to `<div className="flex flex-col">`.

2.  **Update List Item Styling:**
    - Change the main wrapper classes:
      - From: `"group/history-item flex w-full cursor-pointer items-center justify-between px-3 py-2.5 rounded-md text-left transition-colors duration-150"`
      - To: `"group/history-item flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors duration-150 border-b border-border/10 last:border-0"`
    - Update background hover states to ensure it spans edge-to-edge seamlessly.

3.  **Adjust Content Layout (Title & Timestamp):**
    - Modify the inner container to stack vertically:
      ```tsx
      <div className="flex min-w-0 flex-1 flex-col pr-2">
        <span className="truncate text-[14px] font-medium text-foreground/90">
          {thread.title || "Untitled Chat"}
        </span>
        <span className="mt-0.5 text-[12px] text-muted-foreground/60">
          {new Date(thread.updatedAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>
      ```

4.  **Trash Icon:**
    - Ensure it is right-aligned and vertically centered. It should be inside the `justify-between` flex container, opposite the title/time column.

## Review against Constraints

- Matches "pixel perfect" request: Adopts edge-to-edge list, bottom borders, vertical text stacking.
- Reverts previous changes (like right-aligned timestamps and pill-shaped items) to align strictly with the new reference image.
