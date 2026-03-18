# Height Reduction Plan (Explorer, Editor, Thread Header)

## Objective

Reduce the height of the remaining secondary headers (Explorer, Editor, and Thread tabs) to `32px` to ensure a consistent, compact UI across the entire application, matching the previous changes.

## Proposed Changes

1. **`apps/web/src/pages/Project.tsx`**
   - **Explorer Header:** Change the `<div className="h-9 ...">` to `h-[32px]`.
   - **Editor Header (File open/controls):** Change the `<div className="h-9 ...">` to `h-[32px]`.
   - _(Optional Consistency)_ **Terminal Header:** Change the `<div className="h-9 ...">` to `h-[32px]` so all panel headers share the exact same height.

2. **`apps/web/src/components/assistant/vibe-assistant-thread.tsx`**
   - **Thread Tabs Header:** The container currently uses `py-1` with `28px` inner elements, resulting in a `36px` total height.
   - We will replace `py-1` with `h-[32px]` on the `<div className="sticky top-0 ...">` container to strictly enforce the `32px` height constraint, while allowing the `28px` child elements to vertically center perfectly within it.

## Next Steps

Once you approve this plan, I'll switch to implementation mode and apply these changes.
