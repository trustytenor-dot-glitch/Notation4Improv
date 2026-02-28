# ImprovTest - AI Context & Documentation

> **STOP! READ THIS FIRST.**
> This file contains critical project context, architectural decisions, and constraints.
> Always refer to this when starting a new session to prevent hallucinations (e.g., assuming Python backends) or regressions.

## 1. Project Identity & Stack
*   **Name:** ImprovTest
*   **Location:** `/Users/mandrews/Desktop/Audio Visualizer/ImprovTest` (Note: Parent folder is legacy name)
*   **Type:** Client-side Single Page Application (SPA)
*   **Framework:** React + Vite + TypeScript
*   **State Management:** Zustand (`src/state/store.ts`)
*   **Music Rendering:** VexFlow (`src/components/StaffCanvas.tsx`)
*   **Audio Engine:** Tone.js (`src/lib/audio.ts`)
*   **Styling:** CSS / Inline styles (Minimal tailwind/component library usage visible).

## 2. Directory Structure & Key Files
*   **Active Root:** `/Users/mandrews/Desktop/Audio Visualizer/ImprovTest`
    *   *Ignore sibling folders like `songwriting-app` (Legacy/Reference) or root HTML files.*
*   **`src/components/StaffCanvas.tsx`**: **THE CORE FILE.**
    *   Contains the `Renderer`, `Stave`, `Voice`, and `Grid` logic.
    *   Handles all user interactions: `handleClick`, `handleKeyDown`.
    *   Custom rendering logic overrides VexFlow's default spacing to enforce a linear 16-step grid.
*   **`src/state/store.ts`**:
    *   Zustand store holding `melody`, `bass`, `bpm`, `key`.
    *   Data shape: `melody[measure][beat][subdivision]`.
*   **`src/lib/audio.ts`**:
    *   Handles playback. Contains `vexToTone` helper to convert VexFlow keys (`c/5`) to Tone.js frequencies (`C5`).

## 3. Critical Implementation Details (Do Not Regress)

### A. The "Strict Grid" Logic
*   **Problem:** VexFlow naturally formats notes with variable spacing (music typography).
*   **Solution:** We force a linear grid where every 16th note has equal width.
*   **Implementation:** 
    *   `tickStep = noteWidth / 16`.
    *   Grid lines are drawn manually via SVG iteration.
    *   Note X positions are manually overridden using `tickContext.setX()`.
    *   **Measure 1 Spacing:** Measure 1 has a custom width (`standardStaveWidth + 60px`) to account for the Clef and Time Signature headers without squishing the grid.

### B. User Interaction & Input
*   **Click Mapping:**
    *   X-Axis: Uses "floor" logic (`if x > tick[i] && x < tick[i+1]`). Clicking anywhere in a slot snaps to that slot.
    *   Y-Axis: Maps vertical pixels to pitch indices.
    *   **Calibration:** Current offset is `-5` (e.g., `Math.round(relativeY / 5) - 5`). This was empirically tuned to fix a "10th below" visual bug.
*   **Keyboard Navigation:**
    *   **Arrow Up/Down:** Shifts pitch of the *selected* note.
    *   **Arrow Left/Right:** Navigates selection to previous/next existing note (skipping rests).
*   **Double Grid Lines:**
    *   **Feature:** The double vertical lines between measures (End of M, Start of M+1) are intentional. Do not remove the `endLine` drawing logic.

### C. Audio
*   **Sanitization:** Input pitches must be sanitized (lower case, `c/5` format) before Tone.js trigger to avoid "droning" or errors.

## 4. Known Issues & Oddities
*   **Port Collisions:** The dev server often spawns on ports like 5174, 5175, etc., because previous processes hang. Check `lsof -i :5173` if connection fails.
*   **Syntax Errors:** Watch out for unclosed braces in `StaffCanvas.tsx` when editing complex nested logic (click handlers inside layouts).

## 5. Explicit Constraints for AI Agents
1.  **NO Python:** There is no Python backend. Do not check for `pylance`, `conda`, or `requirements.txt`.
2.  **No Server-Side Generation:** This is a localized React app.
3.  **Verify Imports:** When adding VexFlow types, ensure they are imported from `vexflow` (e.g., `StaveNote`, `Formatter`).

---
*Created: Feb 19, 2026*
