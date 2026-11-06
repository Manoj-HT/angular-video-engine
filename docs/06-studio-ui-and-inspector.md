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

## 4.1. Timeline Zoom & Virtual Content Canvas

AVE features professional non-linear editor (NLE) timeline zooming and panning:

```
┌──────────────────┬──────────────────────────────────────────────────────────────────┐
│ Pinned 180px Col │  Scrollable Viewport (overflow-x: auto)                          │
│                  │  ◄───────────────── Virtual Width: 4,880px (4x) ───────────────► │
│ [Master Scrubber]│  [ Ruler Ticks: 0s  0.5s  1.0s  1.5s  2.0s ... 21s ]             │
│ [Track: Video 1 ]│  [ Clip A (0s–5s) ]          [ Clip B (5s–21s) ]                 │
│ [Track: Audio 1 ]│  [ Audio Track                                 ]                 │
└──────────────────┴──────────────────────────────────────────────────────────────────┘
```

### Key Capabilities:
1. **Virtual Content Expansion:** Zoom scale ranges from `1.0x` (Fit entire video to viewport width) up to `10.0x` (frame-level precision). For a 21-second video, `4x` zoom renders a ~5-second window inside the viewport.
2. **Pinned 180px Track Headers:** The left column containing track names, sequence icons, and master time readout remains fixed while the timeline lane scrolls horizontally.
3. **Playhead & Mouse Anchor Zooming:**
   - Zooming via toolbar buttons (`+`, `−`, slider, or presets `Fit`, `2x`, `4x`, `8x`) anchors on the current playhead, keeping it centered in the visible viewport.
   - Zooming via `Alt + MouseWheel` (or trackpad pinch) anchors directly under the mouse cursor.
4. **Adaptive Ruler Ticks (LOD):**
   - Automatically recalibrates tick density based on zoom factor ($1.0\text{s}$ at $2\text{x}$, $0.5\text{s}$ at $4\text{x}$, $5$ frames at $8\text{x}$).
5. **Playback Auto-Scroll (Playhead Follow):**
   - When playing video while zoomed in, the viewport automatically scrolls forward as the playhead approaches the right edge of the screen ($> 85\%$).
6. **Edge Drag Scrolling:** Dragging the playhead near the left or right edges of the visible viewport automatically pans the timeline.

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

---

## 7. Remote Clean Feed & Presentation / POC Mode

Remotion Studio provides only an in-tab fullscreen toggle for the canvas, forcing presenters to mirror their entire display.

**AVE introduces a First-Class Remote Clean Feed (`?mode=presentation`):**

```
┌─────────────────────────────────────────────────┐       ┌───────────────────────────────────────────────┐
│              STUDIO HOST WORKBENCH              │       │          REMOTE CLEAN FEED / POC MODE         │
│  (Operator Screen: Full Scrubber & Inspector)   │       │     (2nd Monitor, Projector, or Remote TV)    │
│                                                 │  WS   │                                               │
│  [▶] [⏮] [F 44] [Loop In/Out] [Inspector Tools] │──────►│  [ PURE EDGE-TO-EDGE CANVAS ONLY ]            │
│  Audio Route: [🔊 Studio] / [🖥️ Remote / TV]   │       │  [Auto-Hiding Pill: ● Live Synced | F44 | 🔊] │
└─────────────────────────────────────────────────┘       └───────────────────────────────────────────────┘
```

### Key Capabilities:
1. **Dual-Screen Reference Window:** Click `[ 🖥️ Clean Feed ] -> Pop-out Clean Feed Window` in the header to open a chrome-less reference monitor (ideal for multi-monitor setups or projector rigs).
2. **Cross-Device Enterprise POC:** Click `Copy Remote Presentation Link` (`/?mode=presentation&id=<composition>`) to review on a remote TV or executive computer.
3. **Real-Time WebSocket Synchronization (`/ave-sync`):**
   - Playhead scrubbing, pause, play, loop regions, active composition, and schema props reflect instantly across all screens.
   - Instant connection handshake: New clients immediately receive the server's authoritative session state snapshot.
   - Clean termination: When a viewer window or tab is closed, the host studio updates its live viewers count in real time.
4. **Audio Echo Guard:** When presenting on a TV or second screen, simultaneous audio playback causes unpleasant acoustic echo. AVE features an explicit audio destination router:
   - `Studio Tab`: Audio plays solely on the operator's laptop/studio tab; remote clean feeds are muted.
   - `Remote / TV`: Audio outputs directly to the presentation display/TV; operator studio audio is muted.
5. **Auto-Hiding HUD:** Displays connection status (`● Live Synced`), current frame number, and audio route status. Fades to black after 3 seconds of cursor inactivity for an immaculate reference presentation.
6. **In-Tab Fullscreen vs. Remote Clean Feed:** In addition to Clean Feed mode, the transport bar retains a dedicated in-tab `⛶` button for quick single-monitor canvas fullscreen.
