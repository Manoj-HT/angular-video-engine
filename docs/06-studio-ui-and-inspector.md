# 06. Studio UI & Inspector Architecture

## 1. Overview & Spatial Philosophy

Traditional video development studios (like Remotion Studio) dedicate excessive horizontal screen space to permanent sidebars (composition trees, export panels) that developers only reference periodically.

**Angular Video Engine (AVE)** adopts a **Canvas-First Layout**:
- **90% of the viewport is allocated to the Canvas preview and timeline.**
- Management panels, composition switchers, and export dialogues are consolidated into contextual dropdowns and collapsible flyout drawers.
- Seamless responsiveness across both **Desktop** (horizontal/ultrawide) and **Mobile/Tablet** (vertical/touch-optimized).

---

## 2. Responsive Spatial Modes

```
                               DESKTOP WORKBENCH (MAX-CANVAS)
┌────────────────────────────────────────────────────────────────────────┐
│ [AVE]  ▼ "Product Promo (1080p, 60fps)"          [⚡ Quick Export] [⚙]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                      [ PREVIEW CANVAS (MAXIMIZED) ]                     │
│                           (Contain / Auto-Fit)                         │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ [▶] [00:01:14 / F 44] ───●──────────────────────── [Speed 1x] [🔊 Mute] │
└────────────────────────────────────────────────────────────────────────┘
```

### A. Desktop Mode
- **Header Dropdown:** The composition title includes a dropdown chevron. Clicking opens a modal/sheet to switch compositions, adjust resolution/FPS, or configure export parameters.
- **Collapsible Tools Drawer:** A floating or docked inspector panel on the right (toggleable to the left via user settings) containing the Visual Authoring tools and property controls.
- **Maximized Canvas Stage:** Auto-fits compositions with letterboxing/pillarboxing and optional transparency checkerboard.

### B. Mobile & Tablet Mode (Portrait / Touch)
- **Minimal View:** Displays only the Canvas and the Transport Seekbar.
- **Floating Edge Chevron (`<`):** A discreet floating handle slides open the full-height Tools & Inspector sheet on touch/click.

---

## 3. Strict "No Browser Hijack" Keybinding Policy

AVE strictly enforces a **Non-Conflicting Whitelist Policy**. System-level browser shortcuts (`Ctrl+Shift+I` for DevTools, `Ctrl+R` for Reload, `Ctrl+P` for Print, `Ctrl+W` for Close) are **never intercepted or prevented**.

### Whitelisted Video Shortcuts:

| Keybinding | Action |
| :--- | :--- |
| `Space` | Toggle Play / Pause |
| `ArrowLeft` / `ArrowRight` | Step $-1$ / $+1$ frame |
| `Shift + ArrowLeft` / `Right` | Step $-10$ / $+10$ frames |
| `Home` / `End` | Jump to Frame 0 / Last Frame |
| `J` / `K` / `L` | Reverse Play (`J`), Pause (`K`), Forward Play (`L`) |
| `M` | Toggle Audio Mute |

---

## 4. The Frame Management & Transport Bar

Located directly adjacent to the timeline scrubber:
1. **Dual Time Readout:** Displays both wall-clock timecode (`00:01:14`) and discrete frame count (`F 44`).
2. **Local vs. Global Frame Inspection:** Toggle to inspect the current sub-scene's local frame ($0 \dots 90$) versus the global composition frame ($300 \dots 390$).
3. **Direct Frame Jump:** An input field allowing developers to type a target frame number and jump instantaneously.
4. **Hardware Preview Speeds:** Built-in speed toggles (`0.25x`, `0.5x`, `1.0x`, `2.0x`) leveraging native browser `playbackRate`.

---

## 5. Visual Authoring & Bidirectional `storyboard.ts` Sync

The Studio provides visual editing capabilities (adding text boxes, shapes, images, or layer animations) without forcing developers to leave the browser.

```
┌────────────────────────┐                   ┌────────────────────────┐
│   Studio UI Inspector  │ ──(HTTP/WS API)─► │ Backend File Service   │
│   (Adds Track / Clip)  │                   │ (CLI Node Runner)      │
└────────────────────────┘                   └───────────┬────────────┘
                                                         │
                                                         ▼
                                             ┌────────────────────────┐
                                             │ Updates storyboard.ts  │
                                             │ (Typed Track Registry) │
                                             └────────────────────────┘
```

### Why `storyboard.ts` Sync is Chosen:
- **1:1 Mapping to Seekbar Tracks:** Visual layers in the UI directly correspond to track items in `storyboard.ts`.
- **Zero Risk of Code Corruption:** Avoids brittle AST template rewrites on custom user components.
- **Bidirectional Collaboration:** Developers can adjust timings in `storyboard.ts` via VS Code, and visual creators can tweak clips in the Studio UI; both stay in sync.

---

## 6. Property Inspector & Dynamic Controls

When a composition or track clip is selected, the Inspector Drawer dynamically renders editable controls based on its TypeScript inputs:

1. **Transform Tools:** Direct inputs for position $(X, Y)$, scale, rotation, and opacity.
2. **Style & Easing Tool:** Color pickers, padding/margin sliders, and visual Bezier easing curve selectors.
3. **Schema-Driven Prop Form:** Automatically generates text inputs, toggles, and dropdowns based on the component's `defaultProps`.
