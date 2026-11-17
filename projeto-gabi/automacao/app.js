/**
 * AutoInforme IRRF PJ - Motor de Automação & Geração de Informes
 * Conforme Instrução Normativa SRF nº 119/2000
 */

// Global State
let rawWorkbookData = [];
let processedCompanies = new Map();
let currentCompanyForModal = null;
let columnMapping = {
  cnpj: '',
  razaoSocial: '',
  mes: '',
  data: '',
  rendimento: '',
  irrf: '',
  codigo: '',
  descricao: ''
};

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const MONTH_FULL_NAMES = {
  'janeiro': 0, 'jan': 0, '1': 0, '01': 0,
  'fevereiro': 1, 'fev': 1, '2': 1, '02': 1,
  'março': 2, 'marco': 2, 'mar': 2, '3': 2, '03': 2,
  'abril': 3, 'abr': 3, '4': 3, '04': 3,
  'maio': 4, 'mai': 4, '5': 4, '05': 4,
  'junho': 5, 'jun': 5, '6': 5, '06': 5,
  'julho': 6, 'jul': 6, '7': 6, '07': 6,
  'agosto': 7, 'ago': 7, '8': 7, '08': 7,
  'setembro': 8, 'set': 8, '9': 8, '09': 8,
  'outubro': 9, 'out': 9, '10': 9,
  'novembro': 10, 'nov': 10, '11': 10,
  'dezembro': 11, 'dez': 11, '12': 11
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  initTheme();
  loadConfigFromStorage();
  setupEventListeners();
});

function initTheme() {
  const savedTheme = localStorage.getItem('autoinforme_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) window.lucide.createIcons();
  }
}

function loadConfigFromStorage() {
  const saved = localStorage.getItem('autoinforme_cfg');
  if (saved) {
    try {
      const cfg = JSON.parse(saved);
      if (cfg.empresa) document.getElementById('cfg-empresa').value = cfg.empresa;
      if (cfg.cnpj) document.getElementById('cfg-cnpj').value = cfg.cnpj;
      if (cfg.ano) document.getElementById('cfg-ano').value = cfg.ano;
      if (cfg.responsavel) document.getElementById('cfg-responsavel').value = cfg.responsavel;
      if (cfg.data) document.getElementById('cfg-data').value = cfg.data;
      if (cfg.codPadrao) document.getElementById('cfg-cod-padrao').value = cfg.codPadrao;
      if (cfg.infoComp) document.getElementById('cfg-info-comp').value = cfg.infoComp;
    } catch(e) {}
  }
}

function saveConfigToStorage() {
  const cfg = {
    empresa: document.getElementById('cfg-empresa')?.value || '',
    cnpj: document.getElementById('cfg-cnpj')?.value || '',
    ano: document.getElementById('cfg-ano')?.value || '',
    responsavel: document.getElementById('cfg-responsavel')?.value || '',
    data: document.getElementById('cfg-data')?.value || '',
    codPadrao: document.getElementById('cfg-cod-padrao')?.value || '1708',
    infoComp: document.getElementById('cfg-info-comp')?.value || ''
  };
  localStorage.setItem('autoinforme_cfg', JSON.stringify(cfg));
}

function setupEventListeners() {
  // Theme toggle
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('autoinforme_theme', next);
    updateThemeIcon(next);
  });

  // Config Drawer Toggle
  const configDrawer = document.getElementById('config-drawer');
  document.getElementById('btn-config-toggle')?.addEventListener('click', () => {
    configDrawer.classList.toggle('closed');
  });
  document.getElementById('btn-close-config')?.addEventListener('click', () => {
    configDrawer.classList.add('closed');
  });
  document.getElementById('btn-save-config-close')?.addEventListener('click', () => {
    configDrawer.classList.add('closed');
    showToast('Configurações salvas com sucesso!');
  });

  // Auto-save on config input
  ['cfg-empresa', 'cfg-cnpj', 'cfg-ano', 'cfg-responsavel', 'cfg-data', 'cfg-cod-padrao', 'cfg-info-comp'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveConfigToStorage);
  });

  // Dropzone & File Input
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const btnBrowse = document.getElementById('btn-browse');

  btnBrowse?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone?.addEventListener('click', () => fileInput.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Load sample data
  document.getElementById('btn-load-sample')?.addEventListener('click', (e) => {
    e.stopPropagation();
    loadSampleData();
  });

  // Search input
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    filterCompaniesTable(e.target.value);
  });

  // Master Actions
  document.getElementById('btn-download-all-zip')?.addEventListener('click', downloadAllAsZip);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportExcelSummary);
  document.getElementById('btn-reset')?.addEventListener('click', resetApplication);

  // Modal Actions
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('pdf-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'pdf-modal') closeModal();
  });

  document.getElementById('btn-modal-download-pdf')?.addEventListener('click', () => {
    if (currentCompanyForModal) {
      downloadCompanyPDF(currentCompanyForModal);
    }
  });

  document.getElementById('btn-modal-print')?.addEventListener('click', () => {
    const frame = document.getElementById('pdf-preview-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.print();
    }
  });

  document.getElementById('btn-apply-mapping')?.addEventListener('click', applyMappingAndProcess);
}

/* ==========================================================================
   FILE READING & METADATA SCANNING
   ========================================================================== */
function handleFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      scanSheetForMetadata(worksheet);

      // Parse JSON using column letters (A, B, C, D, E...)
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: "A", defval: '' });

      if (!rawRows || rawRows.length === 0) {
        alert('O arquivo selecionado está vazio ou não possui linhas legíveis.');
        return;
      }

      rawWorkbookData = rawRows;
      autoDetectColumns(rawRows);
    } catch (err) {
      console.error('Erro ao ler planilha:', err);
      alert('Erro ao processar o arquivo. Certifique-se de que é uma planilha válida (.xlsx, .xls ou .csv).');
    }
  };

  reader.readAsArrayBuffer(file);
}

function scanSheetForMetadata(worksheet) {
  let detectedEmpresa = '';
  let detectedCnpj = '';
  let detectedAno = '';
  let detectedResponsavel = '';
  let detectedData = '';

  const cnpjRegex = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4})/;
  const yearRegex = /\b(202[0-9])\b/;

  const a1 = String(worksheet['A1']?.v || worksheet['A1']?.w || '').trim().toLowerCase();
  const b1 = String(worksheet['B1']?.v || worksheet['B1']?.w || '').trim().toLowerCase();
  if (a1 === 'empresa' && worksheet['A2']) detectedEmpresa = String(worksheet['A2'].v || worksheet['A2'].w || '').trim();
  if (b1.includes('cnpj') && worksheet['B2']) detectedCnpj = String(worksheet['B2'].v || worksheet['B2'].w || '').trim();

  for (let cellKey in worksheet) {
    if (cellKey[0] === '!') continue;
    const rowMatch = cellKey.match(/\d+/);
    if (!rowMatch || parseInt(rowMatch[0], 10) > 10) continue;
    const cell = worksheet[cellKey];
    const val = String(cell.v || cell.w || '').trim();
    if (!val) continue;

    const lower = val.toLowerCase();

    if (!detectedCnpj) {
      const matchCnpj = val.match(cnpjRegex);
      if (matchCnpj && (lower.includes('pagador') || lower.includes('empresa') || cellKey.startsWith('A') || cellKey.startsWith('B'))) {
        detectedCnpj = matchCnpj[1];
      }
    }

    if (!detectedEmpresa) {
      if (lower.startsWith('empresa:') || lower.startsWith('razao social:') || lower.startsWith('fonte pagadora:')) {
        detectedEmpresa = val.split(':')[1]?.trim() || '';
      } else if (!val.match(cnpjRegex) && !val.match(dateRegex) && val.length > 5 && (cellKey === 'A1' || cellKey === 'A2' || cellKey === 'A3' || cellKey === 'B1' || cellKey === 'B2')) {
        if (!lower.includes('relatorio') && !lower.includes('pagamento') && lower !== 'empresa') {
          detectedEmpresa = val;
        }
      }
    }

    if (!detectedResponsavel) {
      if (lower.startsWith('responsavel:') || lower.startsWith('emitido por:') || lower.startsWith('usuario:')) {
        detectedResponsavel = val.split(':')[1]?.trim() || '';
      }
    }

    if (!detectedData) {
      if (lower.includes('emissao:') || lower.includes('data:')) {
        const matchDate = val.match(dateRegex);
        if (matchDate) detectedData = matchDate[1];
      }
    }

    if (!detectedAno) {
      if (lower.includes('exercicio') || lower.includes('ano') || lower.includes('calendario') || lower.includes('periodo')) {
        const matchYear = val.match(yearRegex);
        if (matchYear) detectedAno = matchYear[1];
      }
    }
  }

  if (detectedEmpresa) document.getElementById('cfg-empresa').value = detectedEmpresa;
  if (detectedCnpj) {
    const cleanCnpj = detectedCnpj.replace(/\D/g, '').padStart(14, '0');
    if (cleanCnpj.length === 14) {
      detectedCnpj = cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    document.getElementById('cfg-cnpj').value = detectedCnpj;
  }
  if (detectedAno) document.getElementById('cfg-ano').value = detectedAno;
  if (detectedResponsavel) document.getElementById('cfg-responsavel').value = detectedResponsavel;
  if (detectedData) document.getElementById('cfg-data').value = detectedData;

  saveConfigToStorage();
}

/* ==========================================================================
   AUTO-DETECTION OF COLUMNS BY LETTERS
   ========================================================================== */
function autoDetectColumns(rows) {
  columnMapping = {
    cnpj: '', razaoSocial: '', rendimento: '', irrf: '', mes: '', data: '', tributo: '',
    codigo: '',
    descricao: ''
  };

  const normalize = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const headers = rows[0] || {};
  const entries = Object.entries(headers).map(([column, value]) => [column, normalize(value)]);
  const findHeader = predicates => {
    const match = entries.find(([, header]) => predicates.some(predicate => predicate(header)));
    return match ? match[0] : '';
  };

  columnMapping.cnpj = findHeader([h => h === 'cnpj', h => h.includes('cpf/cnpj'), h => h.includes('inscricao')]);
  columnMapping.razaoSocial = findHeader([h => h === 'fornecedor', h => h.includes('razao social'), h => h.includes('beneficiario'), h => h.includes('favorecido')]);
  columnMapping.rendimento = findHeader([h => h === 'valor bruto nota', h => h === 'valor pago nota', h => h === 'valor pago', h => h.includes('rendimento pago'), h => h.includes('rendimento'), h => h.includes('valor bruto')]);
  columnMapping.irrf = findHeader([h => h === 'valor tributo', h => h === 'irrf', h => h.includes('imposto retido'), h => h.includes('valor ir'), h => h === 'ir']);
  columnMapping.mes = findHeader([h => h === 'mes', h => h === 'competencia', h => h === 'periodo']);
  columnMapping.data = findHeader([h => h === 'dt pagamento nota', h => h === 'data pagamento', h => h === 'dt pagamento', h => h.includes('pagamento')]);
  columnMapping.tributo = findHeader([h => h === 'nome tributo', h => h === 'tributo', h => h.includes('imposto')]);
  columnMapping.codigo = findHeader([h => h === 'codigo', h => h.includes('codigo darf'), h => h === 'receita']);
  columnMapping.descricao = findHeader([h => h === 'descricao', h => h.includes('historico'), h => h.includes('servico'), h => h.includes('natureza')]);
  if (!columnMapping.mes) columnMapping.mes = columnMapping.data;

  renderColumnMapper();
}

function renderColumnMapper() {
  const mapperSection = document.getElementById('mapper-section');
  const mapperFields = document.getElementById('mapper-fields');
  if (!mapperSection || !mapperFields) return;

  const fields = [
    { key: 'razaoSocial', label: 'Razão Social Beneficiário *' },
    { key: 'cnpj', label: 'CNPJ Beneficiário *' },
    { key: 'rendimento', label: 'Rendimento Bruto (R$) *' },
    { key: 'irrf', label: 'Imposto Retido IRRF (R$) *' },
    { key: 'mes', label: 'Mês ou Competência' },
    { key: 'data', label: 'Data Pagamento' },
    { key: 'tributo', label: 'Nome do Tributo' }
  ];

  const colLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  mapperFields.innerHTML = fields.map(f => `
    <div class="mapper-item">
      <label>${f.label}</label>
      <select id="map-select-${f.key}" class="form-input" style="cursor: pointer;">
        <option value="">-- Selecione a coluna --</option>
        ${colLetters.map(l => `<option value="${l}" ${columnMapping[f.key] === l ? 'selected' : ''}>Coluna ${l}</option>`).join('')}
      </select>
    </div>
  `).join('');

  mapperSection.classList.remove('hidden');

  const tributoSelect = document.getElementById('map-select-tributo');
  if (tributoSelect) {
    tributoSelect.addEventListener('change', (e) => {
      columnMapping.tributo = e.target.value;
      renderTributosMappers();
    });
  }

  renderTributosMappers();
}

function renderTributosMappers() {
  const container = document.getElementById('tributos-fields');
  if (!container) return;

  if (!columnMapping.tributo) {
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Selecione a coluna do "Nome do Tributo" acima para mapear os códigos.</p>';
    return;
  }

  const uniqueTributos = new Set();
  rawWorkbookData.forEach(row => {
    const val = String(row[columnMapping.tributo] || '').trim();
    if (val && !val.toLowerCase().includes('tributo')) {
      uniqueTributos.add(val);
    }
  });

  if (uniqueTributos.size === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">Nenhum tributo encontrado nessa coluna.</p>';
    return;
  }

  // Load saved mapping from localStorage
  let savedMappings = {};
  try {
    savedMappings = JSON.parse(localStorage.getItem('autoinforme_tributos_map') || '{}');
  } catch (e) {}

  let html = '';
  Array.from(uniqueTributos).sort().forEach((trib, idx) => {
    const isIR = trib.toUpperCase().includes('IR');
    let defaultCode = isIR ? '1708' : '';
    if (savedMappings[trib]) defaultCode = savedMappings[trib];

    html += `
      <div class="mapper-item">
        <label title="${escapeForAttr(trib)}">${escapeHtml(trib)}</label>
        <input type="text" class="form-input map-tributo-input" data-tributo="${escapeForAttr(trib)}" value="${defaultCode}" placeholder="Ex: 1708, 5952...">
      </div>
    `;
  });

  container.innerHTML = html;
}

function applyMappingAndProcess() {
  ['cnpj', 'razaoSocial', 'mes', 'data', 'rendimento', 'irrf', 'codigo', 'descricao', 'tributo'].forEach(f => {
    const sel = document.getElementById(`map-select-${f}`);
    if (sel) columnMapping[f] = sel.value;
  });

  if (!columnMapping.razaoSocial || !columnMapping.cnpj || !columnMapping.rendimento || !columnMapping.irrf || (!columnMapping.mes && !columnMapping.data)) {
    alert("Você precisa selecionar Razão Social, CNPJ, Rendimento, IRRF e uma coluna de Mês/Data.");
    return;
  }

  // Save tributos mapping
  const tributosMap = {};
  document.querySelectorAll('.map-tributo-input').forEach(input => {
    const trib = input.getAttribute('data-tributo');
    const code = input.value.trim();
    if (trib && code) tributosMap[trib] = code;
  });
  localStorage.setItem('autoinforme_tributos_map', JSON.stringify(tributosMap));

  window.currentTributosMap = tributosMap;

  processRows(rawWorkbookData);
}

/* ==========================================================================
   DATA PROCESSING ENGINE
   ========================================================================== */
function processRows(rows) {
  processedCompanies.clear();

  const defaultCode = document.getElementById('cfg-cod-padrao')?.value || '1708';
  const defaultDesc = 'Remuneração de serviços profissionais prestados por Pessoa Jurídica';

  let totalRendimentoGeral = 0;
  let totalIrrfGeral = 0;
  let totalLinhas = 0;
  let detectedYears = [];

  rows.forEach((row) => {
    let razao = String(row[columnMapping.razaoSocial] || '').trim();
    let cnpj = String(row[columnMapping.cnpj] || '').trim();

    if (!razao && !cnpj) return;

    // Ignore headers and subtotal rows
    const rLower = razao.toLowerCase();
    const cLower = cnpj.toLowerCase();
    if (
      rLower === 'fornecedor' || rLower === 'razao social' || rLower === 'nome' ||
      rLower === 'empresa' || rLower === 'beneficiario' || rLower === 'total' ||
      rLower === 'cnpj' || cLower.includes('cnpj') || cLower === 'total'
    ) {
      return;
    }

    if (!razao) razao = `Empresa ${cnpj}`;

    let cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length > 0 && cleanCnpj.length <= 14) {
      cleanCnpj = cleanCnpj.padStart(14, '0');
    }
    
    const rendVal = parseCurrency(row[columnMapping.rendimento]);
    const irrfVal = parseCurrency(row[columnMapping.irrf]);

    // Ignora linhas totalmente vazias ou de sujeira
    if (cleanCnpj === '' && rendVal === 0 && irrfVal === 0) return;

    const rawDateVal = (columnMapping.mes && row[columnMapping.mes]) ||
               (columnMapping.data && row[columnMapping.data]);
    const { month, year } = parseDateOrMonth(rawDateVal);
    if (month < 0 || month > 11) return;
    const monthIdx = month;
    if (year) detectedYears.push(year);

    totalLinhas++;

    const cnpjFormatted = cleanCnpj.length === 14 
      ? cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      : (cnpj || '00.000.000/0000-00');

    const key = cleanCnpj || razao.toLowerCase();

    if (!processedCompanies.has(key)) {
      processedCompanies.set(key, {
        razaoSocial: razao,
        cnpj: cnpjFormatted,
        cleanCnpj: cleanCnpj,
        months: Array.from({ length: 12 }, (_, i) => ({
          mesIndex: i,
          mesNome: MONTH_NAMES[i],
          codigo: defaultCode,
          descricao: defaultDesc,
          rendimento: 0,
          irrf: 0,
          temMovimento: false
        })),
        totalRendimento: 0,
        totalIrrf: 0,
        mesesComMovimento: 0
      });
    }

    const comp = processedCompanies.get(key);

    const tribName = columnMapping.tributo ? String(row[columnMapping.tributo] || '').trim() : '';
    let mappedCode = '';
    if (tribName && window.currentTributosMap && window.currentTributosMap[tribName]) {
      mappedCode = window.currentTributosMap[tribName];
    } else if (tribName && tribName.toUpperCase().includes('IR')) {
      mappedCode = '1708';
    }

    const codVal = mappedCode || String(row[columnMapping.codigo] || defaultCode).trim();
    const descVal = String(row[columnMapping.descricao] || defaultDesc).trim();

    const m = comp.months[monthIdx];
    m.rendimento += rendVal;
    m.irrf += irrfVal;
    if (codVal) m.codigo = codVal;
    if (descVal) m.descricao = descVal;
    if (rendVal > 0 || irrfVal > 0) m.temMovimento = true;

    comp.totalRendimento += rendVal;
    comp.totalIrrf += irrfVal;

    totalRendimentoGeral += rendVal;
    totalIrrfGeral += irrfVal;
  });

  // Auto-set most frequent year
  if (detectedYears.length > 0) {
    const mostYear = getMostFrequent(detectedYears);
    if (mostYear) {
      document.getElementById('cfg-ano').value = mostYear;
      saveConfigToStorage();
    }
  }

  processedCompanies.forEach(comp => {
    comp.mesesComMovimento = comp.months.filter(m => m.temMovimento).length;
  });

  // Update Stepper to step 3
  updateStepperState(3);

  // Update UI Dashboard
  updateKPIs(processedCompanies.size, totalLinhas, totalRendimentoGeral, totalIrrfGeral);
  renderCompaniesTable(Array.from(processedCompanies.values()));

  document.getElementById('upload-section')?.classList.add('hidden');
  document.getElementById('mapper-section')?.classList.add('hidden');
  document.getElementById('results-section')?.classList.remove('hidden');

  showToast(`✅ ${processedCompanies.size} empresas processadas com sucesso!`);
}

function updateStepperState(activeStep) {
  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById(`step-${i}-indicator`);
    const lineEl = document.getElementById(`step-line-${i}`);
    
    if (stepEl) {
      stepEl.classList.remove('active', 'completed');
      if (i < activeStep) stepEl.classList.add('completed');
      else if (i === activeStep) stepEl.classList.add('active');
    }

    if (lineEl) {
      if (i < activeStep) lineEl.classList.add('completed');
      else lineEl.classList.remove('completed');
    }
  }
}

/**
 * Universal date & month parser supporting:
 * - JavaScript Date instances
 * - Excel numeric serial dates (e.g. 46223)
 * - String dates (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
 * - Month text in Portuguese ('janeiro', 'jan', 'fev', etc.)
 * - Month numbers (1..12, '01'..'12')
 */
function parseDateOrMonth(val) {
  if (val === null || val === undefined || val === '') return { month: -1, year: null };

  // 1. Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    return { month: val.getUTCMonth(), year: val.getUTCFullYear() };
  }

  // 2. Excel numeric serial or integer month
  if (typeof val === 'number') {
    if (val >= 1 && val <= 12 && Number.isInteger(val)) {
      return { month: val - 1, year: null };
    }
    if (val > 30000 && val < 70000) {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return { month: d.getUTCMonth(), year: d.getUTCFullYear() };
    }
  }

  const s = String(val).trim();
  if (!s) return { month: -1, year: null };

  // 3. String dates: DD/MM/YYYY or DD-MM-YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (brMatch) {
    const m = parseInt(brMatch[2], 10);
    const y = parseInt(brMatch[3], 10);
    const fullYear = y < 100 ? 2000 + y : y;
    if (m >= 1 && m <= 12) {
      return { month: m - 1, year: fullYear };
    }
  }

  // 4. ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return { month: m - 1, year: y };
    }
  }

  // 5. Month name in text
  const clean = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const MONTHS_WORD = {
    'janeiro': 0, 'jan': 0,
    'fevereiro': 1, 'fev': 1,
    'marco': 2, 'mar': 2,
    'abril': 3, 'abr': 3,
    'maio': 4, 'mai': 4,
    'junho': 5, 'jun': 5,
    'julho': 6, 'jul': 6,
    'agosto': 7, 'ago': 7,
    'setembro': 8, 'set': 8,
    'outubro': 9, 'out': 9,
    'novembro': 10, 'nov': 10,
    'dezembro': 11, 'dez': 11
  };
  for (const [w, idx] of Object.entries(MONTHS_WORD)) {
    if (clean === w || clean.startsWith(w)) return { month: idx, year: null };
  }

  // 6. Standalone number 1-12
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 12 && clean === String(num)) {
    return { month: num - 1, year: null };
  }

  return { month: -1, year: null };
}

function parseMonth(val) {
  return parseDateOrMonth(val).month;
}

function parseMonthFromDate(val) {
  return parseDateOrMonth(val).month;
}

function parseYearFromDate(val) {
  return parseDateOrMonth(val).year;
}

function getMostFrequent(arr) {
  return arr.sort((a,b) =>
    arr.filter(v => v === a).length - arr.filter(v => v === b).length
  ).pop();
}

function parseCurrency(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let s = String(val).trim().replace('R$', '').replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function formatBRL(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatBRLValueOnly(val) {
  return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.innerHTML = `<i data-lucide="check-circle"></i> <span>${msg}</span>`;
  container.appendChild(toast);

  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ==========================================================================
   UI RENDERING
   ========================================================================== */
function updateKPIs(totalEmpresas, totalLinhas, totalRendimento, totalIrrf) {
  document.getElementById('kpi-total-empresas').textContent = totalEmpresas;
  document.getElementById('kpi-total-linhas').textContent = totalLinhas;
  document.getElementById('kpi-total-rendimento').textContent = formatBRL(totalRendimento);
  document.getElementById('kpi-total-irrf').textContent = formatBRL(totalIrrf);

  const summary = document.getElementById('master-summary-text');
  if (summary) {
    summary.textContent = `Identificamos ${totalEmpresas} empresa${totalEmpresas !== 1 ? 's' : ''} e ${totalLinhas} lançamentos totalizando ${formatBRL(totalRendimento)}.`;
  }
}

function renderCompaniesTable(companies) {
  const tbody = document.getElementById('companies-tbody');
  const counter = document.getElementById('companies-counter');
  if (!tbody) return;

  if (counter) {
    counter.textContent = `${companies.length} empresa${companies.length !== 1 ? 's' : ''}`;
  }

  if (companies.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
          Nenhuma empresa encontrada com os filtros atuais.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = companies.map(comp => `
    <tr>
      <td>
        <div class="company-name-bold">${escapeHtml(comp.razaoSocial)}</div>
      </td>
      <td>
        <span class="cnpj-tag">${escapeHtml(comp.cnpj)}</span>
      </td>
      <td class="text-center">
        <span class="badge-months-tag">${comp.mesesComMovimento} de 12 meses</span>
      </td>
      <td class="text-right" style="font-weight: 700;">
        ${formatBRL(comp.totalRendimento)}
      </td>
      <td class="text-right text-amber" style="font-weight: 700;">
        ${formatBRL(comp.totalIrrf)}
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" onclick="openPdfPreview('${escapeForAttr(comp.cleanCnpj || comp.razaoSocial)}')">
            <i data-lucide="eye"></i>
            <span>Visualizar</span>
          </button>
          <button class="btn btn-sm btn-primary" onclick="downloadCompanyPDFByKey('${escapeForAttr(comp.cleanCnpj || comp.razaoSocial)}')">
            <i data-lucide="download"></i>
            <span>PDF</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

function filterCompaniesTable(query) {
  const q = query.toLowerCase().trim();
  const all = Array.from(processedCompanies.values());
  if (!q) {
    renderCompaniesTable(all);
    return;
  }

  const filtered = all.filter(c => 
    c.razaoSocial.toLowerCase().includes(q) || 
    c.cnpj.toLowerCase().includes(q) ||
    c.cleanCnpj.includes(q)
  );

  renderCompaniesTable(filtered);
}

/* ==========================================================================
   OFFICIAL PDF GENERATION ENGINE (IN/SRF 119/2000)
   ========================================================================== */
function generateOfficialPDF(company) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const config = {
    empresaPagadora: document.getElementById('cfg-empresa')?.value || 'ASSOCIACAO MANTENEDORA CY LOG GUARULHOS',
    cnpjPagador: document.getElementById('cfg-cnpj')?.value || '58.936.490/0001-12',
    anoCalendario: document.getElementById('cfg-ano')?.value || '2025',
    responsavel: document.getElementById('cfg-responsavel')?.value || 'LUCIANO JOSE DA PAIXAO FIEL REIS',
    dataEmissao: document.getElementById('cfg-data')?.value || '18/03/2026',
    infoComp: document.getElementById('cfg-info-comp')?.value || ''
  };

  const margin = 12;
  const pageWidth = 210;
  const contentWidth = pageWidth - (margin * 2);
  let y = 14;

  // Pág. 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50);
  doc.text('Pág. 1', margin, y);
  y += 4;

  // QUADRO 1: FONTE PAGADORA
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. FONTE PAGADORA', margin, y);
  y += 2;

  const q1Height = 20;
  doc.rect(margin, y, contentWidth, q1Height);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Nome Empresarial', margin + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(config.empresaPagadora.toUpperCase(), margin + 2, y + 8.5);

  doc.setLineWidth(0.2);
  doc.line(margin, y + 10.5, margin + contentWidth, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('CNPJ', margin + 2, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(config.cnpjPagador, margin + 2, y + 18.5);

  y += q1Height + 4;

  // QUADRO 2: BENEFICIÁRIA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2. PESSOA JURÍDICA BENEFICIÁRIA DOS RENDIMENTOS', margin, y);
  y += 2;

  const q2Height = 20;
  doc.rect(margin, y, contentWidth, q2Height);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Nome Empresarial', margin + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(company.razaoSocial, margin + 2, y + 8.5);

  doc.line(margin, y + 10.5, margin + contentWidth, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('CNPJ', margin + 2, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(company.cnpj, margin + 2, y + 18.5);

  y += q2Height + 4;

  // QUADRO 3: RENDIMENTO E IMPOSTO RETIDO NA FONTE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('3. RENDIMENTO E IMPOSTO RETIDO NA FONTE', margin, y);
  y += 2;

  const tableRows = company.months.map(m => {
    const rendText = m.rendimento > 0 ? `R$ ${formatBRLValueOnly(m.rendimento)}` : '0,00';
    const irrfText = m.irrf > 0 ? `R$ ${formatBRLValueOnly(m.irrf)}` : '0,00';
    return [
      m.mesNome,
      m.codigo || '1708',
      m.descricao || 'Remuneração de serviços profissionais prestados por Pessoa Jurídica',
      rendText,
      irrfText
    ];
  });

  const totalRendStr = `R$ ${formatBRLValueOnly(company.totalRendimento)}`;
  const totalIrrfStr = `R$ ${formatBRLValueOnly(company.totalIrrf)}`;
  tableRows.push([
    { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: '-', styles: { halign: 'center' } },
    { content: '-', styles: { halign: 'center' } },
    { content: totalRendStr, styles: { fontStyle: 'bold', halign: 'right' } },
    { content: totalIrrfStr, styles: { fontStyle: 'bold', halign: 'right' } }
  ]);

  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      'Mês',
      'Código de\nretenção',
      'Descrição do rendimento',
      'Rendimento\n(R$)',
      'Imposto retido\n(R$)'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' }
    }
  });

  y = doc.lastAutoTable.finalY + 4;

  // QUADRO 4: INFORMAÇÕES COMPLEMENTARES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('4. INFORMAÇÕES COMPLEMENTARES', margin, y);
  y += 2;

  const q4Height = 16;
  doc.rect(margin, y, contentWidth, q4Height);
  if (config.infoComp) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(config.infoComp, margin + 2, y + 5);
  }

  y += q4Height + 4;

  // QUADRO 5: RESPONSÁVEL PELAS INFORMAÇÕES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('5. RESPONSÁVEL PELAS INFORMAÇÕES', margin, y);
  y += 2;

  const q5Height = 18;
  doc.rect(margin, y, contentWidth, q5Height);

  const colNomeWidth = contentWidth * 0.55;
  const colDataWidth = contentWidth * 0.20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Nome', margin + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(config.responsavel.toUpperCase(), margin + 2, y + 12);

  doc.line(margin + colNomeWidth, y, margin + colNomeWidth, y + q5Height);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Data', margin + colNomeWidth + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(config.dataEmissao, margin + colNomeWidth + 2, y + 12);

  doc.line(margin + colNomeWidth + colDataWidth, y, margin + colNomeWidth + colDataWidth, y + q5Height);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Assinatura', margin + colNomeWidth + colDataWidth + 2, y + 4);

  y += q5Height + 6;

  // FOOTER (RECEITA FEDERAL)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Aprovado pela IN/SRF nº 119/2000', margin, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('COMPROVANTE ANUAL DE RENDIMENTOS PAGOS OU', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('CREDITADOS E DE RETENÇÃO DE', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('IMPOSTO DE RENDA NA FONTE - PESSOA JURÍDICA', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Ano-calendário de ${config.anoCalendario}`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MINISTÉRIO DA FAZENDA', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Secretaria Especial da Receita Federal do Brasil', pageWidth / 2, y, { align: 'center' });

  return doc;
}

/* ==========================================================================
   MODAL & DOWNLOADS
   ========================================================================== */
function openPdfPreview(companyKey) {
  const company = processedCompanies.get(companyKey);
  if (!company) return;

  currentCompanyForModal = company;
  document.getElementById('modal-company-name').textContent = company.razaoSocial;
  document.getElementById('modal-company-cnpj').textContent = `CNPJ: ${company.cnpj}`;

  const doc = generateOfficialPDF(company);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const frame = document.getElementById('pdf-preview-frame');
  if (frame) {
    frame.src = pdfUrl;
  }

  document.getElementById('pdf-modal')?.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('pdf-modal')?.classList.add('hidden');
  const frame = document.getElementById('pdf-preview-frame');
  if (frame) frame.src = 'about:blank';
}

function downloadCompanyPDFByKey(companyKey) {
  const company = processedCompanies.get(companyKey);
  if (company) downloadCompanyPDF(company);
}

function downloadCompanyPDF(company) {
  const doc = generateOfficialPDF(company);
  const ano = document.getElementById('cfg-ano')?.value || '2025';
  const sanitizedName = sanitizeFilename(company.razaoSocial);
  const filename = `Informe_IR_${ano}_${sanitizedName}.pdf`;
  doc.save(filename);
  showToast(`📥 PDF baixado: ${filename}`);
}

async function downloadAllAsZip() {
  if (processedCompanies.size === 0) {
    alert('Nenhuma empresa disponível para exportação.');
    return;
  }

  const btn = document.getElementById('btn-download-all-zip');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Gerando ${processedCompanies.size} PDFs...`;
  btn.disabled = true;

  try {
    const zip = new JSZip();
    const ano = document.getElementById('cfg-ano')?.value || '2025';

    let index = 1;
    for (const [key, company] of processedCompanies.entries()) {
      const doc = generateOfficialPDF(company);
      const pdfBlob = doc.output('blob');
      const sanitizedName = sanitizeFilename(company.razaoSocial);
      const filename = `Informe_IR_${ano}_${String(index).padStart(2, '0')}_${sanitizedName}.pdf`;
      zip.file(filename, pdfBlob);
      index++;
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `Informes_IR_${ano}_Todas_Empresas.zip`);
    showToast(`🎉 Todos os ${processedCompanies.size} PDFs foram baixados em .ZIP!`);
  } catch (err) {
    console.error('Erro ao gerar ZIP:', err);
    alert('Erro ao gerar o arquivo ZIP compactado.');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    if (window.lucide) window.lucide.createIcons();
  }
}

function exportExcelSummary() {
  if (processedCompanies.size === 0) {
    alert('Nenhum dado para exportar.');
    return;
  }

  const summaryData = [];
  processedCompanies.forEach(comp => {
    const row = {
      'CNPJ': comp.cnpj,
      'Razão Social': comp.razaoSocial,
      'Total Rendimento (R$)': comp.totalRendimento,
      'Total IRRF Retido (R$)': comp.totalIrrf,
      'Meses c/ Movimento': comp.mesesComMovimento
    };

    comp.months.forEach(m => {
      row[`Rend_${m.mesNome}`] = m.rendimento;
      row[`IRRF_${m.mesNome}`] = m.irrf;
    });

    summaryData.push(row);
  });

  const ws = XLSX.utils.json_to_sheet(summaryData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumo_Informes_IR');

  const ano = document.getElementById('cfg-ano')?.value || '2025';
  XLSX.writeFile(wb, `Resumo_Consolidado_IR_${ano}.xlsx`);
  showToast(`📊 Resumo em Excel exportado com sucesso!`);
}

function resetApplication() {
  rawWorkbookData = [];
  processedCompanies.clear();
  updateStepperState(1);
  document.getElementById('results-section')?.classList.add('hidden');
  document.getElementById('mapper-section')?.classList.add('hidden');
  document.getElementById('upload-section')?.classList.remove('hidden');
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';
}

/* ==========================================================================
   SAMPLE DATA
   ========================================================================== */
function loadSampleData() {
  const sampleRows = [
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Abril', 'Rendimento': 95652.16, 'IRRF': 1056.52, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Junho', 'Rendimento': 47826.08, 'IRRF': 528.26, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Julho', 'Rendimento': 127072.45, 'IRRF': 1395.72, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Agosto', 'Rendimento': 35000.00, 'IRRF': 400.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Setembro', 'Rendimento': 30000.00, 'IRRF': 325.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Outubro', 'Rendimento': 30000.00, 'IRRF': 325.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },
    { 'CNPJ': '02.730.611/0001-10', 'RazaoSocial': 'Cushman & Wakefield Consultoria Imob. Ltda.', 'Mes': 'Dezembro', 'Rendimento': 60000.00, 'IRRF': 650.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica' },

    { 'CNPJ': '11.222.333/0001-44', 'RazaoSocial': 'Alpha Segurança e Vigilância Patrimonial Ltda.', 'Mes': 'Janeiro', 'Rendimento': 42000.00, 'IRRF': 420.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços de vigilância e segurança' },
    { 'CNPJ': '11.222.333/0001-44', 'RazaoSocial': 'Alpha Segurança e Vigilância Patrimonial Ltda.', 'Mes': 'Fevereiro', 'Rendimento': 42000.00, 'IRRF': 420.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços de vigilância e segurança' },
    { 'CNPJ': '11.222.333/0001-44', 'RazaoSocial': 'Alpha Segurança e Vigilância Patrimonial Ltda.', 'Mes': 'Março', 'Rendimento': 42000.00, 'IRRF': 420.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços de vigilância e segurança' },
    { 'CNPJ': '11.222.333/0001-44', 'RazaoSocial': 'Alpha Segurança e Vigilância Patrimonial Ltda.', 'Mes': 'Abril', 'Rendimento': 45000.00, 'IRRF': 450.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços de vigilância e segurança' },
    { 'CNPJ': '11.222.333/0001-44', 'RazaoSocial': 'Alpha Segurança e Vigilância Patrimonial Ltda.', 'Mes': 'Maio', 'Rendimento': 45000.00, 'IRRF': 450.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços de vigilância e segurança' },
    { 'CNPJ': '11.222.333/0001-44', 'RazaoSocial': 'Alpha Segurança e Vigilância Patrimonial Ltda.', 'Mes': 'Junho', 'Rendimento': 45000.00, 'IRRF': 450.00, 'Codigo': '1708', 'Descricao': 'Remuneração de serviços de vigilância e segurança' },

    { 'CNPJ': '22.333.444/0001-55', 'RazaoSocial': 'Beta Engenharia e Manutenção Predial Ltda.', 'Mes': 'Janeiro', 'Rendimento': 18500.00, 'IRRF': 277.50, 'Codigo': '1708', 'Descricao': 'Serviços de engenharia e manutenção predial' },
    { 'CNPJ': '22.333.444/0001-55', 'RazaoSocial': 'Beta Engenharia e Manutenção Predial Ltda.', 'Mes': 'Maio', 'Rendimento': 25000.00, 'IRRF': 375.00, 'Codigo': '1708', 'Descricao': 'Serviços de engenharia e manutenção predial' },
    { 'CNPJ': '22.333.444/0001-55', 'RazaoSocial': 'Beta Engenharia e Manutenção Predial Ltda.', 'Mes': 'Novembro', 'Rendimento': 32000.00, 'IRRF': 480.00, 'Codigo': '1708', 'Descricao': 'Serviços de engenharia e manutenção predial' }
  ];

  rawWorkbookData = sampleRows;
  columnMapping = {
    cnpj: 'CNPJ',
    razaoSocial: 'RazaoSocial',
    mes: 'Mes',
    data: '',
    rendimento: 'Rendimento',
    irrf: 'IRRF',
    codigo: 'Codigo',
    descricao: 'Descricao'
  };

  processRows(sampleRows);
}

/* Utilities */
function sanitizeFilename(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeForAttr(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
