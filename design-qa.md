# Design QA — KNUD Design QA Hub

## Comparison target

- Source visual truth: `/Users/sub_j/Desktop/KNUD2026 QA-Agent/KNUD Design QA Hub v2.dc.html` (served at `http://127.0.0.1:4174/KNUD%20Design%20QA%20Hub%20v2.dc.html`)
- Implementation: `http://localhost:3002/`
- Viewport: 1440 × 920 CSS px, device scale factor 1
- State: review canvas, route `/`, `1020 × 1370` selected viewport at `68%` visual zoom, selected open comment
- Evidence: source and implementation were opened and captured in the Codex in-app browser at the same viewport. The live content inside the frame is intentionally different: the source uses a stand-in and the implementation uses the running local KNUD deployment at `http://localhost:3000`.

## Full-view comparison

The implementation matches the reference shell composition: 44px black toolbar; 230px left navigation; dot-grid central canvas; 694px selected deployment frame; narrow viewport strip; and 280px right inspector. The implementation keeps the CSS viewport at `1020 × 1370` and uses only a `0.68` visual transform.

Focused comparison covered the toolbar tool states, browser bar, selected frame ring, left route/viewport rows, selected comment inspector, and the fixed bottom-left mode switch. A separate focus capture was not needed because all of these components are readable in the 1440px full view.

## Required fidelity surfaces

- Fonts and typography: Pretendard with IBM Plex Mono for routes, dimensions, hashes, and reproduction metadata. Hierarchy and dense tool sizing follow the handoff.
- Spacing and layout rhythm: panel widths, toolbar/browser heights, selected-frame geometry, row heights, and restrained borders/shadows follow the supplied measurements.
- Colors and visual tokens: `#111111`, `#FCD519`, `#06AFFD`, `#EFEEEC`, and hairline neutral borders map to the supplied token palette.
- Image quality and asset fidelity: no bespoke image, logo, or illustration from the handoff was replaced. The primary frame intentionally renders the actual KNUD deployment rather than re-creating the reference stand-in.
- Copy and content: Korean labels, reproduction facts, status action, and Agent disclaimer match the reference content.

## Interaction checks

- Pin tool / `C`: opens comment mode, accepts a click target, displays the selected-anchor composer, accepts text input, and supports cancel/save.
- Compare tool / `O`: opens the split overlay and Agent suggestion panel; the divider range control updates the comparison position.
- Route and viewport rows update selected state; the inspector action advances the displayed QA state.
- Browser console: no QA Hub errors. Warnings observed came from the already-running embedded KNUD deployment's image sizing, not from the Hub shell.

## Findings

- [P3] The live iframe naturally differs from the reference's blue stand-in. This is expected and is the intended production behavior described by the handoff; it is not a design-shell mismatch.

## Comparison history

1. Initial implementation comparison: found no actionable P0/P1/P2 mismatch in the Hub chrome. The deployment frame showed the actual KNUD site as required.
2. Interaction pass: verified comment composer and compare state, then rechecked the canvas layout with the deployed site in the primary frame.

## Implementation checklist

- [x] Apply the supplied chrome geometry and visual token system.
- [x] Render the actual deployment in a fixed CSS viewport with visual-only scaling.
- [x] Implement browse, comment, and compare states.
- [x] Verify primary interactions and console errors in a browser.

## 2026-08-08 incremental toolbar QA

- Source visual truth: `/var/folders/9y/mbx7q58d0ss61ynd7y3m_j0m0000gn/T/TemporaryItems/NSIRD_screencaptureui_HU4VPl/스크린햣 2026-08-08 오후 3.13.27.png` (642 × 248 px).
- Changed state: compact, bordered left/right sidebar controls in the upper-left toolbar; visual scale selector; active deployment and route opening in a new browser tab.
- Fonts and typography: existing dense KNUD toolbar tokens remain in use.
- Spacing and layout rhythm: controls use a 28 × 26 px framed density based on the source image.
- Colors and visual tokens: existing charcoal, muted icon, and yellow hover tokens are retained.
- Image quality and asset fidelity: the reference’s standard toolbar icon is represented by the installed Phosphor icon library.
- Copy and content: controls are icon-first with accessible Korean labels; scale and original-tab actions are product-specific additions.

### Incremental finding

- [P1] Browser-rendered comparison unavailable in this environment.
  - Evidence: no in-app browser control or implementation screenshot capture tool is available for this turn.
  - Impact: this exact updated toolbar state cannot be checked against the supplied source at a matching viewport.
  - Fix: capture the Hub toolbar in its default state and compare it beside the source image before accepting pixel-level polish.

final result: blocked
