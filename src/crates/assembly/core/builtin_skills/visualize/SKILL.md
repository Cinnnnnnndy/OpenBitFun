---
name: visualize
description: "Show a visual or an interactive tool in the conversation. Use for diagrams, maps, charts, spatial explanations, project architecture, comparisons, mockups and working simulations such as clocks. Use proactively when an illustration or an adjustable input would make an explanation easier to understand. An explicit request for a webpage, application or downloadable file asks for that deliverable."
---

# Visual answers in FlowChat

For a visual explanation, publish the figure in this turn. For an independently openable webpage, implement it in the workspace and link the entry file. A request for a working object, such as a pendulum, is enough to publish an inline simulation. Use a simple Markdown table or Mermaid diagram when the requested information fits those formats.

Use Write with a single patch section. The first line names the session artifact. Put the literal HTML fragment below it. Replace the slug with a short ASCII name.

    +++ openbitfun://current-session/artifacts/visualizations/v2/city-map.html
    <h2>Great Lakes cities</h2>
    <script type="application/json" data-visual-atlas="1">{"places":[{"name":"Chicago","country":"US"},{"name":"Toronto","country":"CA"}]}</script>

For city and regional maps use that declaration directly with the requested places. The built-in atlas provides real coasts, lakes, rivers, administrative boundaries, projections and place labels offline. Each place accepts a name, optional ISO country code and region, or sourced coordinates in [longitude, latitude] order. Optional bounds use [west, south, east, north]. Set language for translated labels if needed. Report ambiguous names or ask for detail when the supplied names do not uniquely identify places.

For architectural diagrams and mockups, use readable HTML and SVG. Label responsibilities, relationships and direction. Provide a working selection or input when it explains something. Use native buttons and inputs, explicit axis labels and units, responsive dimensions and theme variables such as --foreground, --background, --muted-foreground and --viz-series-1. Tabs with role="tab" select panels by aria-controls. For charts the frame supplies Apache ECharts when the fragment uses echarts.init(). Give the chart a nonzero height and resize it with its container. For a simulation implement the moving object and mark it with data-visual-motion so the host can check it. Respect reduced motion and keep essential labels visible.

Write and Edit check the fragment in the background. For a map the host resolves the atlas declaration and checks the resulting geometry. Read the tool result and repair reported errors with Edit on the same URI. Skip temporary scripts, local servers and browser previews. Put the successful reference on its own line in the final answer, using the returned path.

    visualize{"path":"openbitfun://current-session/artifacts/visualizations/v2/city-map.html"}

Add "mode":"wide" to the reference for a wide figure. Use window.openai.setWidgetState({modelContent, privateContent}) for selections that survive replay. Keep reader-only selections in privateContent. To expose a design adjustment in the figure menu, create new Tweak({container, onChange}) and register a slider, toggle, color or selection with addSlider, addToggle, addColorPicker or addSelect. Live binding updates are available through window.openai.visualization.onData(name, callback). For a locally imported reference kit, authoring/SKILL.md contains its extended component API.
