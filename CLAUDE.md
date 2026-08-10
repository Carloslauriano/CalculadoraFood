# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CalculadoraFood is a single-page, static (no build step) tool for comparing food-delivery
marketplace fees and computing a recommended sale price per product. It's plain HTML/CSS/JS -
no framework, no bundler, no package.json, no dependencies.

## Running it

Open `index.html` directly in a browser, or serve the folder statically, e.g.:

```
python3 -m http.server 8000
```

There is no build, lint, or test command - there is no tooling configured for any of these.

## Architecture

- `index.html` - page shell: profit-margin input, channels panel container, products table container.
- `style.css` - all styling.
- `channels/*.md` - one doc per `SUPPORTED_CHANNELS` catalog entry, kept in sync with it (see below).
- `script.js` - the entire application (IIFE, no modules/bundler):
  - `SUPPORTED_CHANNELS` is a fixed catalog of known food-delivery marketplaces/plans
    (iFood Básico, iFood Entrega, Aiqfome Entrega Própria, Aiqfome Delivery + Entrega,
    99Food Entrega pela 99, 99Food Entrega Própria), each with `commission` %, `paymentFee` %
    and `monthlyFee` (R$, flat). Nothing here is user-editable - intentional per product
    decision: users pick from this fixed list rather than typing arbitrary channels/rates.
    `getTotalFee(channel)` = `commission + paymentFee`, rounded via `round2()`, is the
    per-order % used everywhere in calculations - the rounding matters because e.g.
    `8.9 + 3.2` is `12.100000000000001` in JS float math (99Food's rates hit this exactly);
    every displayed percentage goes through `formatPercent()` (2 decimals, comma) so this
    never leaks into the UI. `monthlyFee` is a flat cost shown only as reference text
    (`channel-details` in the channel card) and is deliberately excluded from per-product math
    since it doesn't scale with order value. iFood, Aiqfome, and 99Food each have two plan
    entries (self-delivery vs. platform-delivered, at different commission rates) because the
    commission genuinely differs by delivery model - treat each plan as its own catalog
    entry, not a sub-option of one channel. To support a new marketplace/plan, add an entry
    here. Uber Eats and Rappi were removed from the catalog (no longer in `SUPPORTED_CHANNELS`)
    - they were the two entries whose rates were unconfirmed market-research estimates rather
    than sourced from the user; if re-adding either, get real numbers first and add a matching
    `channels/*.md` doc, same as every other entry.
  - **Every catalog entry has a matching doc file in [`channels/`](./channels)** (e.g.
    `channels/ifood-basico.md`), named after the entry's `id`. Each doc records the same
    numbers as the catalog plus a source and a confidence note ("informed by the user" vs.
    "approximate, from market research - unconfirmed"). **These two must stay in sync**:
    whenever `commission`, `paymentFee`, or `monthlyFee` changes in `SUPPORTED_CHANNELS`,
    update the corresponding `channels/*.md` file in the same change (and vice versa - if the
    user tells you a real rate for a channel, update both). When adding a new channel entry,
    add its doc file too.
  - `state` holds `profitMargin`, `channelIds` (array of `SUPPORTED_CHANNELS` ids the user has
    added - starts empty), and `products` (id, name, cost price). Persisted to `localStorage`
    under `calculadoraFood.state.v1` on every change via `saveState()`.
  - `render()` is the single re-render entry point: it rebuilds the channels panel and the
    entire products table from `state` on every mutation (no diffing/virtual DOM - the lists
    are small enough that full re-render is fine). Because `renderTable()` recreates every
    row's `<input>` elements, it captures/restores focus + cursor position around the rebuild
    (`captureFocus`/`restoreFocus`, matched via `data-product-id`/`data-field` on the inputs) -
    without this, typing in a product field would lose focus on every re-render.
  - The "Preço de Custo" input is intentionally debounced (`COST_DEBOUNCE_MS` = 500ms): typing
    updates `product.cost` immediately but only triggers `renderTable()`/`saveState()` after
    the user pauses. This was a deliberate choice over recalculating per keystroke or only on
    blur - the product name input, by contrast, never re-renders the table (no cross-column
    values depend on it), so it stays a plain immediate `input` listener.
  - Adding a channel is picker-driven: clicking "+ Adicionar canal" toggles a dropdown
    (`renderChannelPicker`) listing only catalog channels not yet in `channelIds`
    (`getAvailableChannels`); picking one appends its id. Once every catalog channel is added,
    the button disables itself. Removing a channel just drops its id from `channelIds`.
  - `state.averageMonthlyOrders` (user-entered) amortizes each channel's flat `monthlyFee`
    into a per-order cost via `getFixedCostPerOrder(channel)` = `monthlyFee / averageMonthlyOrders`
    (0 if orders is 0). This fixed cost is added to that channel's fee cell in the table and,
    for the channel with the highest %fee, added to the final recommended price too. It's
    editable both via a number input and a `<input type="range">` (100–2000) kept in sync in
    both directions - the number input is never clamped to the slider's range (a value outside
    100–2000 is still used as-is in every calculation; the slider just can't represent it, so
    it visually clamps to its own min/max while the real value lives in `state`).
  - Pricing formula (in `computeRecommendedPrice`): recommended price = cost × (1 + (highest
    fee % among *active* channels + configured profit %) / 100) + fixed cost/order of that
    same highest-fee channel. This is a markup (not margin) calculation on the variable part -
    intentional, matches how the feature was specified. If you change the formula, update it
    only in this one function.
  - Catalog fee percentages have mixed confidence - check each channel's doc in `channels/`
    before treating a number as authoritative. All current entries (iFood, Aiqfome, 99Food)
    are user-confirmed, straight from their partner portals (mid-2026). The two 99Food
    entries are a special case: their `commission`/`monthlyFee` are **promotional** values
    (the portal shows them struck through against standard 12% / R$ 150,00/mês) - see
    `channels/99food-*.md` for the standard values to revert to once the promotion ends. All
    entries can still vary by plan/region/negotiation, so don't treat any of them as fixed
    forever.
  - Two separate export buttons, both built from the same `getExportTableData()` (header +
    formatted rows, matching what's on screen):
    - `exportToCsv()` - `;`-delimited CSV with a UTF-8 BOM (so accented characters render
      correctly when opened in Excel).
    - `exportToXlsx()` - a real `.xlsx`, hand-built with zero dependencies: a ZIP (written
      "stored"/uncompressed via `makeZip`, so no DEFLATE implementation is needed - just
      CRC-32, which `crc32`/`CRC_TABLE` provide) containing the minimal valid OOXML
      SpreadsheetML parts (`[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`,
      `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheet1.xml`). Every cell
      is written as `t="inlineStr"` (no `sharedStrings.xml` needed) - simple and sufficient
      for an exported report, though it means numbers aren't "live" numeric cells in Excel.
    - Visual styling lives in `buildStylesXml()` (fonts/fills/borders/cellXfs) and is applied
      per-cell via `cellStyleId(rowIndex, colIndex, lastColIndex)`: style `1` = header row
      (bold white on the app's red), style `2` = the "Preço de Venda Recomendado" column
      (bold on a light highlight, mirroring `.col-recommended` in `style.css`), style `0` =
      plain bordered body cell. `computeColumnWidths()` auto-sizes each column from its
      longest cell (clamped 10–40 chars) and `buildSheetXml()` also freezes the header row
      via a `<pane>`. If you change the on-screen `.col-recommended` look, mirror it here too
      - the two aren't linked, just meant to match.
    - **Element order inside `<worksheet>` and `<styleSheet>` is schema-enforced, not just
      well-formedness.** `xml.dom.minidom`/`unzip -t` only catch malformed XML and bad
      CRCs - they will happily pass a file that's well-formed but schema-invalid, and Excel
      then reports "removed part" / "repaired" errors on open. This already happened once:
      `<cols>` was emitted before `<sheetViews>` (correct order is `sheetViews`, `cols`, then
      `sheetData`). When adding new child elements to `buildSheetXml()` or `buildStylesXml()`,
      check the actual CT_Worksheet/CT_StyleSheet element order in the OOXML spec - don't
      assume any order is fine just because minidom accepts it.
    - Verified by generating a sample file and checking it with `unzip -t`/Python's
      `zipfile.testzip()` (CRC integrity) and `xml.dom.minidom` (well-formedness on every
      part, including `styles.xml`) - there's no in-repo test for this, so re-verify the same
      way if this code changes (extract the helper functions verbatim into a throwaway Node
      script rather than retyping them, to catch drift from the real implementation).
    - If richer output (real numeric cells, number formats, multiple sheets) is ever needed,
      that's the point where pulling in a library becomes justified instead of extending this
      by hand.
  - `clearCalculator()` (the header's "Limpar calculadora" button) resets everything -
    margin, average orders, channels, products - back to `DEFAULT_STATE` and wipes the
    `localStorage` key. Gated behind a `window.confirm()` since it's destructive and
    irreversible.
