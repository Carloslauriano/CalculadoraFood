(function () {
  "use strict";

  const STORAGE_KEY = "calculadoraFood.state.v1";
  const COST_DEBOUNCE_MS = 500;

  // fee % used in calculations = commission + paymentFee (per-order costs).
  // monthlyFee is a flat monthly cost, not scaled per product, so it's shown
  // as reference info only and never included in per-product math.
  const SUPPORTED_CHANNELS = [
    {
      id: "ifood-basico",
      name: "iFood Básico",
      commission: 12,
      paymentFee: 3.2,
      monthlyFee: 110,
      monthlyFeeNote: "a partir de R$ 1.800/mês faturados (1º mês grátis)",
    },
    {
      id: "ifood-entrega",
      name: "iFood Entrega",
      commission: 23,
      paymentFee: 3.2,
      monthlyFee: 150,
      monthlyFeeNote: "a partir de R$ 1.800/mês faturados (1º mês grátis)",
    },
    {
      id: "aiqfome-entrega-propria",
      name: "Aiqfome Entrega Própria",
      commission: 14.99,
      paymentFee: 0,
      monthlyFee: 89.9,
      monthlyFeeNote: "isenta para faturamento até R$ 1.500,00/mês",
    },
    {
      id: "aiqfome-delivery-entrega",
      name: "Aiqfome Delivery + Entrega",
      commission: 19.99,
      paymentFee: 0,
      monthlyFee: 89.9,
      monthlyFeeNote: "isenta para faturamento até R$ 1.500,00/mês",
    },
    // 99Food's commission/monthlyFee below are promotional (site shows them
    // struck through against a standard 12% / R$150 / 1.59% saque semanal) —
    // see channels/99food-*.md for the original values this can revert to.
    {
      id: "99food-entrega-99",
      name: "99Food Entrega pela 99",
      commission: 8.9,
      paymentFee: 3.2,
      monthlyFee: 0,
      monthlyFeeNote: "promocional grátis (padrão R$ 150,00/mês) — taxa de saque semanal também promocional (0%, padrão 1,59%)",
    },
    {
      id: "99food-entrega-propria",
      name: "99Food Entrega Própria",
      commission: 10.9,
      paymentFee: 3.2,
      monthlyFee: 0,
      monthlyFeeNote: "promocional grátis (padrão R$ 150,00/mês) — taxa de saque semanal também promocional (0%, padrão 1,59%)",
    },
  ];

  // Rounds to 2 decimals, correcting for float drift (e.g. 8.9 + 3.2 === 12.100000000000001).
  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function formatPercent(n) {
    return round2(n).toFixed(2).replace(".", ",");
  }

  function getTotalFee(channel) {
    return round2((Number(channel.commission) || 0) + (Number(channel.paymentFee) || 0));
  }

  const DEFAULT_STATE = {
    profitMargin: 33,
    averageMonthlyOrders: 100,
    channelIds: [],
    products: [
      { id: "p1", name: "", cost: 0 },
    ],
  };

  let state = loadState();
  let nextId = computeNextId(state);
  let pickerOpen = false;
  let costDebounceTimer = null;

  function computeNextId(s) {
    const ids = s.products
      .map((item) => parseInt(String(item.id).replace(/\D/g, ""), 10))
      .filter((n) => !Number.isNaN(n));
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      if (!parsed.products) return structuredClone(DEFAULT_STATE);
      return {
        profitMargin: parsed.profitMargin ?? DEFAULT_STATE.profitMargin,
        averageMonthlyOrders: parsed.averageMonthlyOrders ?? DEFAULT_STATE.averageMonthlyOrders,
        channelIds: Array.isArray(parsed.channelIds) ? parsed.channelIds : [],
        products: parsed.products,
      };
    } catch (e) {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  }

  function getChannelById(id) {
    return SUPPORTED_CHANNELS.find((c) => c.id === id);
  }

  function getActiveChannels() {
    return state.channelIds.map(getChannelById).filter(Boolean);
  }

  function getAvailableChannels() {
    return SUPPORTED_CHANNELS.filter((c) => !state.channelIds.includes(c.id));
  }

  function getMaxFee() {
    const active = getActiveChannels();
    if (!active.length) return 0;
    return Math.max(...active.map(getTotalFee));
  }

  function getMaxFeeChannel() {
    const active = getActiveChannels();
    if (!active.length) return null;
    return active.reduce((max, c) => (getTotalFee(c) > getTotalFee(max) ? c : max), active[0]);
  }

  // Amortizes the channel's flat monthly fee over the average number of
  // orders per month, so it can be treated as a per-order cost.
  function getFixedCostPerOrder(channel) {
    const orders = Number(state.averageMonthlyOrders) || 0;
    if (!channel || !channel.monthlyFee || orders <= 0) return 0;
    return channel.monthlyFee / orders;
  }

  function computeRecommendedPrice(cost) {
    const maxFee = getMaxFee();
    const profit = Number(state.profitMargin) || 0;
    const fixedCost = getFixedCostPerOrder(getMaxFeeChannel());
    return Number(cost || 0) * (1 + (maxFee + profit) / 100) + fixedCost;
  }

  // --- Rendering ---

  function render() {
    renderMaxFeeHint();
    renderChannelsPanel();
    renderTable();
    saveState();
  }

  function renderMaxFeeHint() {
    const hint = document.getElementById("max-fee-hint");
    const topChannel = getMaxFeeChannel();
    if (!topChannel) {
      hint.textContent = "Nenhum canal selecionado — o preço recomendado usará apenas a margem de lucro.";
    } else {
      const fixedCost = getFixedCostPerOrder(topChannel);
      const fixedCostText = fixedCost > 0
        ? ` + custo fixo de ${formatCurrency(fixedCost)}/pedido (mensalidade ÷ pedidos/mês)`
        : "";
      hint.textContent = `Maior taxa entre os canais selecionados: ${topChannel.name} (${formatPercent(getTotalFee(topChannel))}%)${fixedCostText}. O preço recomendado usa esses valores.`;
    }
  }

  function renderChannelsPanel() {
    const list = document.getElementById("channels-list");
    list.innerHTML = "";

    getActiveChannels().forEach((channel) => {
      const card = document.createElement("div");
      card.className = "channel-card";

      const nameSpan = document.createElement("span");
      nameSpan.className = "channel-name";
      nameSpan.textContent = channel.name;

      const feeSpan = document.createElement("span");
      feeSpan.className = "channel-fee";
      feeSpan.textContent = `${formatPercent(getTotalFee(channel))}%`;
      feeSpan.title = `Comissão: ${formatPercent(channel.commission)}% + Taxa de pagamento: ${formatPercent(channel.paymentFee)}%`;

      const details = document.createElement("span");
      details.className = "channel-details";
      const parts = [`Comissão ${formatPercent(channel.commission)}% + pagamento ${formatPercent(channel.paymentFee)}%`];
      if (channel.monthlyFee) {
        parts.push(`Mensalidade R$ ${channel.monthlyFee.toFixed(2).replace(".", ",")} (${channel.monthlyFeeNote})`);
      }
      details.textContent = parts.join(" · ");

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-channel";
      removeBtn.textContent = "×";
      removeBtn.title = "Remover canal";
      removeBtn.addEventListener("click", () => {
        state.channelIds = state.channelIds.filter((id) => id !== channel.id);
        pickerOpen = false;
        render();
      });

      const topRow = document.createElement("div");
      topRow.className = "channel-top-row";
      topRow.appendChild(nameSpan);
      topRow.appendChild(feeSpan);
      topRow.appendChild(removeBtn);

      card.appendChild(topRow);
      card.appendChild(details);
      list.appendChild(card);
    });

    renderChannelPicker();
  }

  function renderChannelPicker() {
    const picker = document.getElementById("channel-picker");
    const addBtn = document.getElementById("add-channel-btn");
    const available = getAvailableChannels();

    addBtn.disabled = available.length === 0;
    addBtn.textContent = available.length === 0 ? "Todos os canais adicionados" : "+ Adicionar canal";

    picker.innerHTML = "";
    if (!pickerOpen || available.length === 0) {
      picker.hidden = true;
      return;
    }
    picker.hidden = false;

    available.forEach((channel) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "channel-option";
      option.textContent = `${channel.name} (${formatPercent(getTotalFee(channel))}%)`;
      option.addEventListener("click", () => {
        state.channelIds.push(channel.id);
        pickerOpen = false;
        render();
      });
      picker.appendChild(option);
    });
  }

  // renderTable() rebuilds every row's DOM, so a naive re-render while the
  // user is typing in a product input steals focus mid-keystroke. Capture
  // which field was focused (by product id) and restore it afterwards.
  function captureFocus() {
    const el = document.activeElement;
    if (!el || !el.dataset || !el.dataset.productId) return null;
    return {
      productId: el.dataset.productId,
      field: el.dataset.field,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
    };
  }

  function restoreFocus(focusInfo) {
    if (!focusInfo) return;
    const selector = `[data-product-id="${focusInfo.productId}"][data-field="${focusInfo.field}"]`;
    const el = document.getElementById("products-body").querySelector(selector);
    if (!el) return;
    el.focus();
    if (typeof focusInfo.selectionStart === "number") {
      el.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
    }
  }

  function renderTable() {
    const focusInfo = captureFocus();
    const headerRow = document.getElementById("table-header-row");
    const body = document.getElementById("products-body");
    const activeChannels = getActiveChannels();

    headerRow.innerHTML = "";
    const thProduct = document.createElement("th");
    thProduct.textContent = "Produto";
    const thCost = document.createElement("th");
    thCost.textContent = "Preço de Custo";
    headerRow.appendChild(thProduct);
    headerRow.appendChild(thCost);

    activeChannels.forEach((channel) => {
      const th = document.createElement("th");
      th.textContent = `${channel.name} (${formatPercent(getTotalFee(channel))}%)`;
      headerRow.appendChild(th);
    });

    const thRecommended = document.createElement("th");
    thRecommended.textContent = "Preço de Venda Recomendado";
    headerRow.appendChild(thRecommended);

    const thActions = document.createElement("th");
    thActions.textContent = "";
    headerRow.appendChild(thActions);

    body.innerHTML = "";
    state.products.forEach((product) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = product.name;
      nameInput.placeholder = "Nome do produto";
      nameInput.dataset.productId = product.id;
      nameInput.dataset.field = "name";
      nameInput.addEventListener("input", () => {
        product.name = nameInput.value;
        saveState();
      });
      tdName.appendChild(nameInput);
      tr.appendChild(tdName);

      const tdCost = document.createElement("td");
      const costInput = document.createElement("input");
      costInput.type = "number";
      costInput.min = "0";
      costInput.step = "0.01";
      costInput.value = product.cost;
      costInput.dataset.productId = product.id;
      costInput.dataset.field = "cost";
      costInput.addEventListener("input", () => {
        product.cost = costInput.value === "" ? 0 : Number(costInput.value);
        clearTimeout(costDebounceTimer);
        costDebounceTimer = setTimeout(() => {
          renderTable();
          saveState();
        }, COST_DEBOUNCE_MS);
      });
      tdCost.appendChild(costInput);
      tr.appendChild(tdCost);

      activeChannels.forEach((channel) => {
        const td = document.createElement("td");
        const feeValue = Number(product.cost || 0) * getTotalFee(channel) / 100 + getFixedCostPerOrder(channel);
        td.textContent = formatCurrency(feeValue);
        tr.appendChild(td);
      });

      const tdRecommended = document.createElement("td");
      tdRecommended.className = "col-recommended";
      tdRecommended.textContent = formatCurrency(computeRecommendedPrice(product.cost));
      tr.appendChild(tdRecommended);

      const tdActions = document.createElement("td");
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-product";
      removeBtn.textContent = "×";
      removeBtn.title = "Remover produto";
      removeBtn.addEventListener("click", () => {
        state.products = state.products.filter((p) => p.id !== product.id);
        render();
      });
      tdActions.appendChild(removeBtn);
      tr.appendChild(tdActions);

      body.appendChild(tr);
    });

    restoreFocus(focusInfo);
  }

  // --- Export ---

  // Shared by both exporters: the table's current data as plain strings,
  // formatted the same way it's displayed on screen (currency, %).
  function getExportTableData() {
    const activeChannels = getActiveChannels();
    const header = [
      "Produto",
      "Preço de Custo",
      ...activeChannels.map((c) => `${c.name} (${formatPercent(getTotalFee(c))}%)`),
      "Preço de Venda Recomendado",
    ];

    const rows = state.products.map((product) => {
      const channelValues = activeChannels.map((channel) => {
        const feeValue = Number(product.cost || 0) * getTotalFee(channel) / 100 + getFixedCostPerOrder(channel);
        return formatCurrency(feeValue);
      });
      return [
        product.name || "",
        formatCurrency(product.cost),
        ...channelValues,
        formatCurrency(computeRecommendedPrice(product.cost)),
      ];
    });

    return [header, ...rows];
  }

  function csvField(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportToCsv() {
    const rows = getExportTableData();
    const lines = rows.map((row) => row.map(csvField).join(";"));
    const csvContent = String.fromCharCode(0xfeff) + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "calculadora-food.csv");
  }

  // --- XLSX (real .xlsx, hand-built) ---
  //
  // A .xlsx is a ZIP of a handful of XML parts (OOXML SpreadsheetML). We
  // write the ZIP entries "stored" (uncompressed) to avoid needing a DEFLATE
  // implementation, and every cell as an inline string — simple, valid, and
  // enough for an exported report. Deliberately hand-rolled instead of
  // pulling in a library, to keep this a dependency-free static page.

  const CRC_TABLE = (() => {
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(n) {
    return [n & 0xff, (n >>> 8) & 0xff];
  }

  function u32(n) {
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  }

  function strToBytes(str) {
    return Array.from(new TextEncoder().encode(str));
  }

  // Minimal valid ZIP: local file headers + data (stored), central
  // directory, end-of-central-directory record. Fixed DOS date/time
  // (1980-01-01) since the actual mod time doesn't matter for an export.
  function makeZip(files) {
    const DOS_TIME = 0;
    const DOS_DATE = 0x21;
    const localAndData = [];
    const central = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = strToBytes(file.name);
      const dataBytes = strToBytes(file.content);
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      const localHeader = [
        ...u32(0x04034b50),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(DOS_TIME),
        ...u16(DOS_DATE),
        ...u32(crc),
        ...u32(size),
        ...u32(size),
        ...u16(nameBytes.length),
        ...u16(0),
        ...nameBytes,
      ];
      localAndData.push(...localHeader, ...dataBytes);

      central.push(
        ...u32(0x02014b50),
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(0),
        ...u16(DOS_TIME),
        ...u16(DOS_DATE),
        ...u32(crc),
        ...u32(size),
        ...u32(size),
        ...u16(nameBytes.length),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
        ...nameBytes
      );

      offset += localHeader.length + dataBytes.length;
    });

    const centralDirOffset = offset;
    const eocd = [
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(files.length),
      ...u16(files.length),
      ...u32(central.length),
      ...u32(centralDirOffset),
      ...u16(0),
    ];

    return new Uint8Array([...localAndData, ...central, ...eocd]);
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function colLetter(index) {
    let n = index + 1;
    let letters = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  }

  // Style ids match the cellXfs order in buildStylesXml(): 0 = plain bordered
  // body cell, 1 = header (bold white on red), 2 = recommended-price column
  // body cell (bold on light highlight, matching .col-recommended on screen).
  function cellStyleId(rowIndex, colIndex, lastColIndex) {
    if (rowIndex === 0) return 1;
    if (colIndex === lastColIndex) return 2;
    return 0;
  }

  // Rough auto-fit: widen each column to its longest cell (in characters),
  // clamped to a sane range so a long product name can't blow out the sheet.
  function computeColumnWidths(rows) {
    const lastColIndex = rows[0].length - 1;
    return rows[0].map((_, colIndex) => {
      const maxLen = rows.reduce((max, row) => Math.max(max, String(row[colIndex] ?? "").length), 0);
      const base = colIndex === lastColIndex ? maxLen + 4 : maxLen + 2;
      return Math.min(40, Math.max(10, base));
    });
  }

  function buildSheetXml(rows) {
    const lastColIndex = rows[0].length - 1;

    const colsXml = computeColumnWidths(rows)
      .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
      .join("");

    const rowsXml = rows
      .map((row, rowIndex) => {
        const r = rowIndex + 1;
        const cellsXml = row
          .map((value, colIndex) => {
            const cellRef = `${colLetter(colIndex)}${r}`;
            const styleId = cellStyleId(rowIndex, colIndex, lastColIndex);
            return `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
          })
          .join("");
        return `<row r="${r}">${cellsXml}</row>`;
      })
      .join("");

    // Child element order inside <worksheet> is schema-enforced:
    // sheetViews, then cols, then sheetData (among others) — Excel's
    // validator rejects the file (not just a well-formedness check) if
    // this order is wrong, even though the XML itself is well-formed.
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
      "</sheetView></sheetViews>" +
      `<cols>${colsXml}</cols>` +
      `<sheetData>${rowsXml}</sheetData></worksheet>`
    );
  }

  // Minimal styles.xml: fill/border indices 0 and 1 are reserved defaults per
  // the OOXML spec, so custom fills/borders start at index 2.
  function buildStylesXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      "</fonts>" +
      '<fills count="4">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEA1D2C"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D6"/><bgColor indexed="64"/></patternFill></fill>' +
      "</fills>" +
      '<borders count="2">' +
      "<border><left/><right/><top/><bottom/><diagonal/></border>" +
      '<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right>' +
      '<top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom></border>' +
      "</borders>" +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">' +
      '<alignment vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
      "</cellXfs>" +
      "</styleSheet>"
    );
  }

  function exportToXlsx() {
    const sheetXml = buildSheetXml(getExportTableData());
    const stylesXml = buildStylesXml();

    const contentTypesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>";

    const rootRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>";

    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Produtos" sheetId="1" r:id="rId1"/></sheets>' +
      "</workbook>";

    const workbookRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>";

    const files = [
      { name: "[Content_Types].xml", content: contentTypesXml },
      { name: "_rels/.rels", content: rootRelsXml },
      { name: "xl/workbook.xml", content: workbookXml },
      { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
      { name: "xl/styles.xml", content: stylesXml },
      { name: "xl/worksheets/sheet1.xml", content: sheetXml },
    ];

    const zipBytes = makeZip(files);
    const blob = new Blob([zipBytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "calculadora-food.xlsx");
  }

  // --- Clear ---

  function clearCalculator() {
    const confirmed = window.confirm(
      "Isso vai apagar todos os produtos, canais e configurações salvos. Deseja continuar?"
    );
    if (!confirmed) return;

    clearTimeout(costDebounceTimer);
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(DEFAULT_STATE);
    nextId = computeNextId(state);
    pickerOpen = false;

    document.getElementById("profit-margin").value = state.profitMargin;
    document.getElementById("average-orders").value = state.averageMonthlyOrders;
    document.getElementById("average-orders-slider").value = state.averageMonthlyOrders;
    render();
  }

  // --- Event bindings ---

  document.getElementById("profit-margin").addEventListener("input", (e) => {
    state.profitMargin = e.target.value === "" ? 0 : Number(e.target.value);
    render();
  });

  document.getElementById("average-orders").addEventListener("input", (e) => {
    state.averageMonthlyOrders = e.target.value === "" ? 0 : Number(e.target.value);
    document.getElementById("average-orders-slider").value = state.averageMonthlyOrders;
    render();
  });

  document.getElementById("average-orders-slider").addEventListener("input", (e) => {
    state.averageMonthlyOrders = Number(e.target.value);
    document.getElementById("average-orders").value = state.averageMonthlyOrders;
    render();
  });

  document.getElementById("export-csv-btn").addEventListener("click", exportToCsv);

  document.getElementById("export-xlsx-btn").addEventListener("click", exportToXlsx);

  document.getElementById("clear-btn").addEventListener("click", clearCalculator);

  document.getElementById("add-channel-btn").addEventListener("click", () => {
    pickerOpen = !pickerOpen;
    renderChannelPicker();
  });

  document.getElementById("add-product-btn").addEventListener("click", () => {
    state.products.push({ id: `p${nextId++}`, name: "", cost: 0 });
    render();
  });

  // --- Init ---

  document.getElementById("profit-margin").value = state.profitMargin;
  document.getElementById("average-orders").value = state.averageMonthlyOrders;
  document.getElementById("average-orders-slider").value = state.averageMonthlyOrders;
  render();
})();
