# Task 5: Storybook / DiscreteTabs Embedding Spec for Nav-Sidebar <!-- oc:id=sec_aa -->

## Source Capabilities <!-- oc:id=sec_ab -->
`~/src/ch5/ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx` provides:
- Controlled or uncontrolled active value (`value`, `defaultValue`, `onValueChange`)
- Sizes `sm | default | lg`
- Icon-always-visible pills with active-label expansion
- Built-in reduced-motion handling via `useReducedMotion()` and `reducedMotionTransition`
- A `role="tablist"` root and `role="tab"` buttons, which fit host accessibility needs

The Storybook wrapper in `discrete-tabs.stories.tsx` uses decorative chrome (`rounded-full border ... p-2 shadow`) that should inform, not dictate, production embedding.

## Recommended Production Embedding <!-- oc:id=sec_ac -->
Use `size="sm"` for nav-sidebar. The sidebar width is constrained (`defaultPanelWidth=320`, `minPanelWidth=200`, `maxPanelWidth=480` in `sidebar-layout.tsx`), so `default` is too roomy and `lg` is clearly oversized for chrome-level navigation.

## Header Container Chrome <!-- oc:id=sec_ad -->
Inside the future host-owned nav-sidebar shell:
- Place `DiscreteTabs` in a dedicated header strip above the body outlet.
- Wrap it in a container with:
  - horizontal padding: `px-3`
  - vertical padding: `pt-3 pb-2`
  - bottom border: subtle separator using existing sidebar border token
  - background: inherit sidebar surface, not Storybook's separate card bubble
- Tabs themselves keep their rounded pill appearance, but the outer Storybook border/shadow wrapper should be removed in production.

## Tab Composition Rules <!-- oc:id=sec_ae -->
- Each tab should always show an icon.
- Only the active tab reveals its label, per component behavior.
- Prefer short labels (`Overview`, `Folio`, `Notes`) so active-pill expansion stays within sidebar width.
- Use host-provided icon tokens mapped to Lucide icons; no arbitrary plugin-rendered tab icon components.

## Behavior <!-- oc:id=sec_af -->
- `onValueChange` updates host-owned nav-sidebar selection state.
- Built-in tab always exists and is the fallback default.
- Inactive tabs remain compact icon pills.
- Active tab label should truncate rather than wrap if future labels grow too wide.

## Narrow / Collapsed Sidebar Handling <!-- oc:id=sec_ag -->
The current sidebar fully closes at narrow widths via `leftPanelOpenAtom`, so the first production slice does not need a miniature collapsed-icon-only rail. For future semi-collapsed states:
- Hide labels and keep icon pills only.
- Preserve keyboard focus order.
- Do not let the tab row overflow horizontally past the sidebar gutter.

## Overflow Strategy <!-- oc:id=sec_ah -->
For MVP, cap the number of visible nav-sidebar tabs to a small set (built-in + one or two plugin tabs). If more tabs arrive later:
- either degrade to horizontal scroll inside the header strip, or
- move overflow tabs into a host-owned more-menu.
Do not guess this in plugin code.

## Reduced Motion <!-- oc:id=sec_ai -->
Rely on the component's built-in reduced-motion path. The host must not add extra spring or fade wrappers around `DiscreteTabs`; otherwise it would fight the component's own motion logic.

## Acceptance Check <!-- oc:id=sec_aj -->
- [x] Size, container chrome, active behavior, and responsive expectations are defined from real source props.
- [x] Reduced-motion and narrow/collapsed behavior are explicitly covered.