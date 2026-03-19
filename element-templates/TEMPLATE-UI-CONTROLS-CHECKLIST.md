# Element Template UI Controls Checklist

Quick reference for auditing or building `ui-controls.json` and `index.js` for any element template. Use this to ensure consistency across templates.

---

## ui-controls.json Structure

### Standard Groups (in order)

1. **Layout** — master visibility toggles + precision
   - `showHeader`, `showBackground`, `showLabel` — nearly universal
   - `showValue` — only if template has primary rows
   - `showSecondaryRows` — only if template has secondary rows
   - `showFooter` — only if template has a footer section
   - `precision` / `decimalPlaces` — only if template has numeric displays
   - **Only include toggles for features the template actually has.** Don't add `showFooter` to a template with no footer.

2. **Footer** — footer button styling (omit entirely if no footer)
   - `footerButtonColor` (color-alpha, `x-theme-default: "accentPrimary"`)

3. **Label** — header title label styling
   - `labelFontFamily`, `labelFontSize`, `labelFontWeight`, `labelFontStyle`, `labelColor`
   - `labelColor` gets `x-theme-default: "textPrimary"`

4. **Background & Border** — card-level appearance
   - `backgroundColor` (`x-theme-default: "bgSecondary"`)
   - `headerColor` (`x-theme-default: "bgTertiary"`)
   - `borderColor` (`x-theme-default: "borderColor"`)
   - `image` (file-upload for background image)

5. **Per-section groups** — one group per visible section in the template UI

### Per-Section Group Rules

Each rendered section (row) in the template gets its own group in `ui-controls.json`.

| Control | Naming | Format | x-theme-default | Notes |
|---------|--------|--------|-----------------|-------|
| Visibility toggle | `show{Section}` | boolean | — | Default `true` |
| Value text color | `{prefix}Color` | color-alpha | `accentGreen` | — |
| Background color | `{prefix}Bg` | color-alpha | `bgTertiary` | Primary rows only |
| Label text color | `{prefix}LabelColor` | color-alpha | `textSecondary` | — |
| Font family | `{prefix}Font` | font-family | — | — |
| Font size | `{prefix}Size` | font-size (number) | — | min 8, max 120, default null |
| Font weight | `{prefix}Weight` | font-weight | — | — |
| Font style | `{prefix}Style` | font-style | — | — |

- **Primary rows** (rendered with `primaryRow()`) get all 8 controls including `{prefix}Bg`.
- **Secondary rows** (rendered with `row()`) get 7 controls — no `{prefix}Bg`.
- Group name in JSON must match the UI section label exactly (e.g., group `"Target"` for the Target row).
- Section order in JSON = section order in the controls panel. Match the rendered row order.

### Per-Section Extras

Some sections need controls beyond the standard set. Add these to the same group:

- **Custom label text** — e.g., `countLabel` lets the user rename the "Count" label to "Total". Use `{ "type": "text", "default": "Count" }`.
- **Per-section precision** — e.g., `countPrecision`, `ratePrecision` when different sections need different decimal places.
- **Per-section label font overrides** — e.g., `countLabelFontFamily`, `countLabelFontSize`, `countLabelFontWeight`, `countLabelFontStyle` when a section's label needs independent font control beyond just color. In the JS label loop, check for `key === "count"` to apply these with global fallback.

### Non-Row Templates (e.g., Button)

Templates without rows follow a simpler pattern:
- Controls go in a single group named after the element (e.g., `"Button"`).
- Include: `show{ElementText}` (text visibility toggle), `{element}Color` (background), `{element}TextColor` (text color), `{element}FontFamily/Size/Weight/Style`, `image`.
- `{element}TextColor` uses `x-theme-default: "textOnAccent"` for text on colored backgrounds.

### Naming Collisions

If a section name collides with a global property prefix, use an alternate prefix:
- Example: Deadband's "Value" row uses prefix `reading` (`readingColor`, `readingBg`, etc.) to avoid collision with the global `value*` namespace.

### x-theme-default is Required on Every color-alpha Property

Every property with `"format": "color-alpha"` **must** have `"x-theme-default"` set. Without it, the color picker shows black instead of the actual theme default.

Common mappings:
- Value text → `"accentGreen"`
- Backgrounds → `"bgTertiary"`
- Labels → `"textSecondary"`
- Header label → `"textPrimary"`
- Card background → `"bgSecondary"`
- Card border → `"borderColor"`
- Button backgrounds → `"accentPrimary"`
- Button/accent text → `"textOnAccent"` (white text on colored backgrounds)

---

## index.js Binding Rules

### Row Rendering (`renderContentRows`)

- Every row must pass a `key` that matches the `sectionPrefix` / `sectionToggle` maps.
- Row render order = the visual order you want (top to bottom).
- Use `primaryRow(label, value, cls, key)` for boxed rows with background.
- Use `row(label, value, cls, { key: "keyname" })` for simple inline rows.

### Visibility (`row()` function)

- Maintain a `sectionToggle` map: `{ rowKey: "showPropertyName" }`
  ```js
  var sectionToggle = { output: "showOutput", target: "showTarget", input: "showInput" };
  ```
- In `row()`, check `if (d[sectionToggle[key]] === false) return null;`
- Master toggles (`showValue`, `showSecondaryRows`) are checked separately.

### Styling (`applyStyles()` function)

- Maintain a `sectionPrefix` map: `{ rowKey: "propertyPrefix" }`
  ```js
  var sectionPrefix = { output: "output", target: "target", input: "input" };
  ```
- Each row has `data-row-key` attribute set by the `row()` function.

**Label nodes** — query `.element-row .row-label`:
- Apply `d[pfx + "LabelColor"]` if set, otherwise `""` (CSS `var(--text-secondary)` provides default).

**Primary row backgrounds** — query `.element-row--primary`:
- Apply `d[pfx + "Bg"]` if set, otherwise `""` (CSS `var(--bg-tertiary)` provides default).

**Value nodes** — query `.element-row .row-value`:
- Color: `d[pfx + "Color"]` if set, otherwise `"var(--accent-green, #4ec9b0)"`.
- Font: `d[pfx + "Font"]`, `d[pfx + "Size"]`, `d[pfx + "Weight"]`, `d[pfx + "Style"]` — each falls back to `""`.
- If template uses semantic CSS classes (e.g., `value--ok`, `value--warn`, `value--bad`), skip color assignment for those elements so CSS handles it.

### Preview Data (`getPreviewData()`)

- Must include every property from `ui-controls.json` with its default value.
- Do NOT include deleted/removed properties.

---

## Verification Checklist

- [ ] Every rendered section has a matching group in `ui-controls.json`
- [ ] Group names match displayed section labels
- [ ] Section order in JSON matches desired controls panel order
- [ ] Row render order in `renderContentRows` matches desired visual order
- [ ] Every `color-alpha` property has `x-theme-default`
- [ ] Primary rows have `{prefix}Bg`; secondary rows do not
- [ ] `sectionToggle` map covers every row key
- [ ] `sectionPrefix` map covers every row key
- [ ] No references to removed global properties (`valueColor`, `rowLabelColor`, `valueFontFamily`, etc.)
- [ ] No "Value" or "Rows" groups (use per-section groups instead)
- [ ] No `hiddenRowKeys` array (use per-section `show{Section}` toggles instead)
- [ ] No `getHiddenRowsMap()` function in JS (use `sectionToggle` map instead)
- [ ] Naming collisions resolved with alternate prefix (document in code)
- [ ] `getPreviewData()` includes all current properties
- [ ] JSON is valid (`JSON.parse` succeeds)
- [ ] TypeScript builds clean (`npx tsc --noEmit`)
- [ ] All tests pass (`npx vitest run`)
