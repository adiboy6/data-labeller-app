# Data Labeller UI -- New View Spec

## Stack
- React + Tailwind CSS
- Output: single file `GridView.jsx` (do NOT modify any existing files)

## Layout Rules
- Use the same theme as the existing app
- Left icon rail: Home, Undo, Submit icons (fixed, always visible)
- Top bar: full-width progress bar + item counter (2/99) + user avatar when clicked will give a dropdown with the following options:
  - Profile
  - Logout
- Main content: single QACard centered, ~75% width on web, full width on mobile
- ActionButtons (Approve/Deny) float above bottom of card, centered

## Overlay System (CRITICAL)
Both drawers use the same pattern:
- Renders ON TOP of main content (position: fixed, z-50)
- Backdrop: blurred + darkened (backdrop-blur-sm + bg-black/50)
- Does NOT push or resize the main layout
- X button to close

### Left Drawer: QuestionStatusDrawer
- Triggered by: hamburger icon (bottom of left rail on web, 
  Questions tab on mobile)
- Width: ~35% on web, full width on mobile
- Content: list of questions, color coded
  - green = approved
  - red = denied  
  - white/gray = pending
- Numbered on web, unnumbered on mobile

### Right Drawer: CommentsDrawer
- Triggered by: chat bubble icon (bottom right)
- Width: ~30% on web, full width on mobile
- Content:
  - Textarea at top ("Add a comment...")
  - Blue "Post Comment" button
  - Scrollable comment list: username + timestamp + truncated text

## Components to Build (all new, self-contained)
1. `QACard` -- question + answer text, "Show Explanation" + "Source" links
2. `ActionButtons` -- green Approve (✓) + red Deny (✗), floating pill container
3. `ProgressBar` -- with counter and avatar
4. `SideNav` -- left icon rail
5. `QuestionStatusDrawer` -- left overlay
6. `CommentsDrawer` -- right overlay
7. `Drawer` -- shared primitive, accepts side="left|right" prop
8. `BottomTabBar` -- mobile only (Home, Questions, Reviews, Profile)

## Responsive Behavior
- Web (≥768px): card is 75% width, drawers are partial width
- Mobile (<768px): card is full width, drawers are full width, 
  BottomTabBar visible, SideNav hidden

## Card Stack & Swipe
- Library: framer-motion
- Stack depth: 3 visible cards
- Swipe right = Approve, swipe left = Deny
- Threshold: 150px drag before commit
- Stamp overlay: "APPROVE" (green) / "DENY" (red) fades in during drag
- Snap back if under threshold