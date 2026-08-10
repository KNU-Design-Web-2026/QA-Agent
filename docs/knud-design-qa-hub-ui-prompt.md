# KNUD Design QA Hub UI 생성 프롬프트

아래 프롬프트를 Stitch 또는 Claude Design에 그대로 붙여 넣는다. 생성 결과는 프로덕션 전시 사이트가 아니라, 디자이너와 개발자가 실제 배포 사이트를 검수하는 데스크톱 웹 애플리케이션이다.

```text
Design a polished desktop-first internal web application named “KNUD Design QA Hub”.

Purpose:
This is a visual QA collaboration tool for designers and developers. A designer reviews the real deployed graduation-exhibition website inside a responsive browser canvas, interacts with the live page, then pins visual comments directly onto the exact problematic location. Developers reopen the same deployment, route, viewport, scroll position, and annotation to fix it.

Design direction:
- Professional design-review tool, not a social feed and not a generic dashboard.
- Precise, calm, editorial, technical, and trustworthy.
- Monochrome base: near-black #111111, white #FFFFFF, neutral gray panels, subtle #E8E8E8 borders.
- Use one vivid KNUD accent yellow #FCD519 for active pins, selected states, and primary actions. Use sky blue #06AFFD only for deployment or live-preview metadata.
- Typography: modern Korean/Latin grotesk similar to Pretendard or Inter. Dense but highly legible.
- Large desktop canvas, restrained rounded corners (8px), 1px borders, almost no decorative shadows.
- Build an accessibility-conscious interface with strong focus states and text labels; do not rely on color alone.

Create these screens:

1. Review workspace — primary screen, 1440px wide desktop.
   - Fixed top bar, 64px high.
   - Left: KNUD Design QA Hub wordmark and project switcher “KNUD 2026 Exhibition”.
   - Center: deployment selector showing “Production · 9e74d1b · Ready”, route field “/”, and a “Open live site” external-link button.
   - Right: reviewer avatars, notification icon, and user menu.
   - Left vertical tool rail, 56px wide: cursor, pin comment, rectangle area comment, arrow annotation, draw tool, compare/overlay tool, and settings. Pin tool is selected in yellow.
   - Central review canvas on a muted warm-gray background. Place a live responsive website viewport frame in the center, showing a graduation exhibition home page with a black navigation header and a vivid blue-to-navy art hero.
   - Above the frame: viewport preset controls “1920”, “1350”, “1020”, “600”, “400”; choose “1020” as selected. Include zoom control at 80%, reload, and fit-to-canvas controls.
   - The viewport should visually be 1020px wide but scaled to fit the workspace. Make it clear this is a real live preview using a small “LIVE DEPLOYMENT” label.
   - Add three visible annotation pins on the hero/header: yellow numbered pin 1, red priority pin 2, gray resolved pin 3. Pin 1 should be selected.
   - Right comment panel, 360px wide. Header: “QA Comments”, filter chips “Open 12”, “In progress 4”, “Review 2”, and a search field.
   - Selected comment card: priority High, type “Interaction”, author “Jisoo Kim”, timestamp “2 min ago”, status “Open”. Korean content: “헤더 메뉴로 이동할 때 움직임이 어색해요. 버튼을 오른쪽으로 2px 옮겼으면 좋겠어요.” Add an attached screenshot thumbnail, viewport “1020 × 1370”, route “/”, target “site-header / navigation-toggle”, and buttons “Mark in progress” and “Reply”.
   - Below it, show compact cards for other comments with status, assignee, and coordinate context.

2. Create comment state.
   - Same workspace, but the user has dragged a rectangle over the header menu button.
   - Show a lightweight floating composer near the selected area: comment textarea, priority selector, issue type selector (Visual / Interaction / Content / Design confirmation), “Save comment” yellow primary button, and “Cancel”.
   - Show a subtle context line: “1020 × 1370 · / · scroll Y 0 · navigation-toggle”.
   - The page underneath remains interactive-looking but is dimmed just enough to clarify annotation mode.

3. Compare mode.
   - Same workspace with a segmented switch “Live / Figma / Overlay / Diff”; Overlay is selected.
   - Show the live page and a Figma reference with a draggable vertical comparison divider.
   - Display a small difference summary panel: “3 visual differences detected”, including “Header button position: +2px”, “Hero artwork top spacing: +8px”, and “Mobile title line-break needs confirmation”.
   - Make it clear these are Agent suggestions that need human review, with a label “Agent suggestion — review required”.

4. QA list screen.
   - Table-style, not card-heavy.
   - Columns: status, priority, page, viewport, comment, assignee, deployment, updated.
   - Include filters for deployment, viewport, status, issue type, and assignee.
   - Include a clear “Open review workspace” action for every row.
   - Use realistic Korean sample feedback and a mix of Open, In progress, Review requested, and Resolved states.

Important interaction details to communicate visually:
- The live site must be the visual center of the product, not the comment list.
- Comments are spatially anchored to page elements and must look directly connected to their pins.
- Designers should feel safe to inspect real navigation and interactions before entering annotation mode.
- The interface should support exact responsive review and developer reproducibility.
- Avoid gradients in the application chrome; reserve the blue-to-navy gradient only for the embedded KNUD live-site hero.

Produce a coherent high-fidelity UI system across all screens, including empty states, hover/selected treatment, concise Korean UI labels, and reusable components.
```
