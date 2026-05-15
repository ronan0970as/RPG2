// ════════════════════════════════════════════════════════════
//  java.js — Ficha RPG Principal
//  Dados salvos no Supabase (tabela: fichas_dados)
// ════════════════════════════════════════════════════════════

// ── Debounce — evita múltiplas escritas ao Supabase em sequência ──
function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// ── ID da ficha ativa ──────────────────────────────────────
function getFichaId() {
    return localStorage.getItem('rpg_ficha_ativa') || null;
}

// ── Proteção: redireciona para o painel se não houver ficha ativa ──
function protegerFichaAtiva() {
    if (!getFichaId()) {
        window.location.replace('painel_de_escolhas_de_fichas.html');
        return false;
    }
    return true;
}

// ── Chave local de cache (para performance) ────────────────
function k(chave) {
    const id = getFichaId();
    if (!id) return '__sem_ficha__' + chave; // nunca usa null como prefixo
    return id + '_' + chave;
}

// ── Supabase helpers ───────────────────────────────────────
function getSupa() { return window._supaClient; }

// Salva um campo (tipo = 'status' | 'talentos' | 'inventario') no Supabase
async function salvarNuvem(tipo, valor) {
    const fichaId = getFichaId();
    if (!fichaId) return;

    const supa = getSupa();
    const payload = { ficha_id: fichaId, tipo, valor: JSON.stringify(valor) };

    // Upsert: insere ou atualiza se já existir
    const { error } = await supa
        .from('fichas_dados')
        .upsert(payload, { onConflict: 'ficha_id,tipo' });

    if (error) console.error(`Erro ao salvar ${tipo}:`, error.message);
}

// Carrega um campo da nuvem (retorna o valor ou null)
async function carregarDaNuvem(tipo) {
    const fichaId = getFichaId();
    if (!fichaId) return null;

    const { data, error } = await getSupa()
        .from('fichas_dados')
        .select('valor')
        .eq('ficha_id', fichaId)
        .eq('tipo', tipo)
        .maybeSingle();

    if (error) { console.error(`Erro ao carregar ${tipo}:`, error.message); return null; }
    if (!data)  return null;

    try { return JSON.parse(data.valor); } catch(e) { return null; }
}

// ── Salvar / carregar dados da ficha ──────────────────────
async function salvarFicha() {
    const dados = {
        jogador:    document.getElementById('jogador')?.value || '',
        personagem: document.getElementById('personagem')?.value || '',
        idade:      document.getElementById('idade')?.value || '',
        nivel:      document.getElementById('nivel')?.value || '0',
        raca:       document.getElementById('raca')?.value || '',
        genero:     document.querySelector('.genero-btn.ativo')?.dataset.genero || '',
        vidaAtual:  document.getElementById('vida-atual')?.value || '0',
        manaAtual:  document.getElementById('mana-atual')?.value || '0',
        sanAtual:   document.getElementById('sanidade-atual')?.value || '0',
        forcaBase:  document.getElementById('forca-base')?.value || '0',
        forcaBonus: document.getElementById('forca-bonus')?.value || '0',
        velBase:    document.getElementById('vel-base')?.value || '0',
        velBonus:   document.getElementById('vel-bonus')?.value || '0',
        intBase:    document.getElementById('int-base')?.value || '0',
        intBonus:   document.getElementById('int-bonus')?.value || '0',
        defBase:    document.getElementById('defesa-base')?.value || '0',
        defBonus:   document.getElementById('defesa-bonus')?.value || '0',
        pontBase:   document.getElementById('pont-base')?.value || '0',
        pontBonus:  document.getElementById('pont-bonus')?.value || '0',
        carBase:    document.getElementById('car-base')?.value || '0',
        carBonus:   document.getElementById('car-bonus')?.value || '0',
        furtBase:   document.getElementById('furt-base')?.value || '0',
        furtBonus:  document.getElementById('furt-bonus')?.value || '0',
        habilidades: document.getElementById('habilidades-ativas')?.value || '',
        classe:      document.getElementById('classe')?.value || ''
    };

    // Salva também a foto
    try {
        const fichaId = getFichaId();
        const { data } = await getSupa().from('fichas').select('img').eq('id', fichaId).maybeSingle();
        if (data?.img) dados.fotoBase64 = data.img;
    } catch(e) {}

    // Cache local + nuvem
    localStorage.setItem(k('rpg_dados'), JSON.stringify(dados));
    await salvarNuvem('status', dados);
    _mostrarToastSave();
}

async function carregarDadosFicha() {
    // Tenta carregar da nuvem; fallback para cache local
    let dados = await carregarDaNuvem('status');
    if (!dados) {
        try { dados = JSON.parse(localStorage.getItem(k('rpg_dados'))); } catch(e) {}
    }
    if (!dados) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
    set('jogador',        dados.jogador);
    set('personagem',     dados.personagem);
    set('idade',          dados.idade);
    set('nivel',          dados.nivel);
    set('raca',           dados.raca);

    // Restaura gênero
    if (dados.genero) {
        document.querySelectorAll('.genero-btn').forEach(btn => {
            btn.classList.toggle('ativo', btn.dataset.genero === dados.genero);
        });
    }
    set('vida-atual',     dados.vidaAtual);
    set('mana-atual',     dados.manaAtual);
    set('sanidade-atual', dados.sanAtual);
    set('forca-base',     dados.forcaBase);
    set('forca-bonus',    dados.forcaBonus);
    set('vel-base',       dados.velBase);
    set('vel-bonus',      dados.velBonus);
    set('int-base',       dados.intBase);
    set('int-bonus',      dados.intBonus);
    set('defesa-base',    dados.defBase);
    set('defesa-bonus',   dados.defBonus);
    set('pont-base',      dados.pontBase);
    set('pont-bonus',     dados.pontBonus);
    set('car-base',       dados.carBase);
    set('car-bonus',      dados.carBonus);
    set('furt-base',      dados.furtBase);
    set('furt-bonus',     dados.furtBonus);
    set('habilidades-ativas', dados.habilidades);
    set('classe',             dados.classe);

    if (dados.fotoBase64) mostrarFotoCard(dados.fotoBase64);
}

function mostrarToastSalvo() {
    let t = document.getElementById('toast-save');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast-save';
        t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a1a1a;border:1px solid #c8aa6e;color:#c8aa6e;padding:10px 18px;border-radius:6px;font-weight:bold;font-size:13px;z-index:999;transition:opacity 0.3s;';
        document.body.appendChild(t);
    }
    t.textContent = '💾 Ficha salva!';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

// ─────────────────────────────────────────────────────────
const ATRIBUTOS_MAPA = {
    forca: 'forca-total', velocidade: 'vel-total', inteligencia: 'int-total',
    defesa: 'defesa-total', pontaria: 'pont-total', carisma: 'car-total', furtividade: 'furt-total'
};

// ─────────────────────────────────────────────────────────
//  _lerBasesDoDOM() — lê os atributos base+bônus manual da página index.html
// ─────────────────────────────────────────────────────────
function _lerBasesDoDOM() {
    function base(id) { return parseInt(document.getElementById(id)?.value) || 0; }
    function bonus(baseVal, id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const txt = el.value.trim();
        if (!txt || txt === '0') return 0;
        if (txt.includes('%')) return Math.round(baseVal * (parseFloat(txt.replace('%','')) / 100));
        return parseInt(txt) || 0;
    }
    const f = base('forca-base');
    const v = base('vel-base');
    const i = base('int-base');
    const d = base('defesa-base');
    const p = base('pont-base');
    const c = base('car-base');
    const fu= base('furt-base');
    return {
        // base pura (para renderTotal separar as parcelas)
        _raw: { forca:f, velocidade:v, inteligencia:i, defesa:d, pontaria:p, carisma:c, furtividade:fu },
        // bonus manual dos campos de texto
        _bonus: {
            forca:       bonus(f,  'forca-bonus'),
            velocidade:  bonus(v,  'vel-bonus'),
            inteligencia:bonus(i,  'int-bonus'),
            defesa:      bonus(d,  'defesa-bonus'),
            pontaria:    bonus(p,  'pont-bonus'),
            carisma:     bonus(c,  'car-bonus'),
            furtividade: bonus(fu, 'furt-bonus'),
        },
        // base + bonus (o que os talentos enxergam como "base")
        forca:        f  + bonus(f,  'forca-bonus'),
        velocidade:   v  + bonus(v,  'vel-bonus'),
        inteligencia: i  + bonus(i,  'int-bonus'),
        defesa:       d  + bonus(d,  'defesa-bonus'),
        pontaria:     p  + bonus(p,  'pont-bonus'),
        carisma:      c  + bonus(c,  'car-bonus'),
        furtividade:  fu + bonus(fu, 'furt-bonus'),
    };
}

// ─────────────────────────────────────────────────────────
//  Cache em memória de talentos — evita chamada ao Supabase
//  a cada keystroke. Invalidado ao salvar talentos.
// ─────────────────────────────────────────────────────────
let _talentosCache = null;
let _talentosUltimaFicha = null;

async function _getTalentos() {
    const fichaId = getFichaId();
    if (_talentosCache !== null && _talentosUltimaFicha === fichaId) {
        return _talentosCache;
    }
    let talentos;
    try {
        talentos = await carregarDaNuvem('talentos')
            || JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');
        if (!Array.isArray(talentos)) talentos = [];
    } catch(e) { talentos = []; }
    _talentosCache = talentos;
    _talentosUltimaFicha = fichaId;
    return talentos;
}

// ─────────────────────────────────────────────────────────
//  calcularStatus() — ponto único de cálculo na aba Status.
//  Usa calcularTodosBuffs() (iterativo) do buffs.js.
// ─────────────────────────────────────────────────────────
async function calcularStatus() {
    const bases = _lerBasesDoDOM();

    // Carrega talentos do cache em memória (evita chamada de rede a cada keystroke)
    const talentos = await _getTalentos();

    const nivel    = parseInt(document.getElementById('nivel')?.value) || 0;
    const sanidade = parseInt(document.getElementById('sanidade-atual')?.value) || 0;

    // bases como contexto inicial (base + bônus manual já somados)
    const statusInicial = {
        manaMax:  bases.inteligencia * 10,
        vidaMax:  50 + bases.defesa * 50,
        nivel, sanidade
    };

    // Cálculo iterativo/acumulativo de buffs.js
    const totais = calcularTodosBuffs(talentos, bases, statusInicial);

    // Habilidades Ativas (textarea da aba Status) — sempre ativas
    const habilidades = document.getElementById('habilidades-ativas')?.value || '';
    if (habilidades.trim()) {
        // Contexto com os atributos já acumulados pelos talentos
        const ATTR_KEYS = ['forca','velocidade','inteligencia','defesa','pontaria','carisma','furtividade'];
        const ctxAttr = {};
        ATTR_KEYS.forEach(k2 => { ctxAttr[k2] = (bases[k2] || 0) + (totais[k2] || 0); });
        const ctxStatus = {
            manaMax:  (ctxAttr.inteligencia * 10) + (totais.manaMax || 0),
            vidaMax:  50 + (ctxAttr.defesa * 50) + (totais.vidaMax || 0),
            nivel, sanidade, ...ctxAttr
        };
        const habBuffs = parsearBuffsDinamicos(habilidades, { bases: ctxAttr, statusLocal: ctxStatus });
        Object.keys(totais).forEach(k2 => { if (habBuffs[k2]) totais[k2] += habBuffs[k2]; });
    }

    // Totais finais de atributos e status
    const defTotal = (bases.defesa       || 0) + (totais.defesa       || 0);
    const intTotal = (bases.inteligencia || 0) + (totais.inteligencia || 0);
    const vidaMax  = Math.max(1, 50 + (defTotal * 50) + (totais.vidaMax || 0));
    const manaMax  = Math.max(1, (intTotal * 10)       + (totais.manaMax || 0));

    // Renderiza cada linha de atributo: = TOTAL (+X manual, +Y talento)
    function renderTotal(elId, rawBase, manualBonus, talentoTotal) {
        const el = document.getElementById(elId);
        if (!el) return;
        const total = rawBase + manualBonus + talentoTotal;
        const partes = [];
        if (manualBonus !== 0)
            partes.push(`<span class="buff-part" style="color:#c8aa6e">${manualBonus > 0 ? '+' : ''}${manualBonus} manual</span>`);
        if (talentoTotal !== 0)
            partes.push(`<span class="buff-part" style="color:#4CAF50">${talentoTotal > 0 ? '+' : ''}${talentoTotal} talento</span>`);
        el.innerHTML = `<span>= ${total}</span>${partes.length ? ' <small>(' + partes.join(', ') + ')</small>' : ''}`;
    }

    const r = bases._raw;
    const b = bases._bonus;
    renderTotal('forca-total',  r.forca,        b.forca,        totais.forca        || 0);
    renderTotal('vel-total',    r.velocidade,   b.velocidade,   totais.velocidade   || 0);
    renderTotal('int-total',    r.inteligencia, b.inteligencia, totais.inteligencia || 0);
    renderTotal('defesa-total', r.defesa,       b.defesa,       totais.defesa       || 0);
    renderTotal('pont-total',   r.pontaria,     b.pontaria,     totais.pontaria     || 0);
    renderTotal('car-total',    r.carisma,      b.carisma,      totais.carisma      || 0);
    renderTotal('furt-total',   r.furtividade,  b.furtividade,  totais.furtividade  || 0);

    // Atualiza vida/mana máxima na tela com toast de mudança
    const vidaMaxEl = document.getElementById('vida-maxima');
    const manaMaxEl = document.getElementById('mana-maxima');

    if (vidaMaxEl) {
        const ant = parseInt(vidaMaxEl.textContent) || 0;
        vidaMaxEl.textContent = vidaMax;
        notificarMudancaStatus('vida', ant, vidaMax);
    }
    if (manaMaxEl) {
        const ant = parseInt(manaMaxEl.textContent) || 0;
        manaMaxEl.textContent = manaMax;
        notificarMudancaStatus('mana', ant, manaMax);
    }

    // Clamp: vida/mana atual não pode ultrapassar o máximo
    const vidaAtualEl = document.getElementById('vida-atual');
    const manaAtualEl = document.getElementById('mana-atual');
    if (vidaAtualEl) {
        const v = parseInt(vidaAtualEl.value) || 0;
        if (v > vidaMax) vidaAtualEl.value = vidaMax;
    }
    if (manaAtualEl) {
        const m = parseInt(manaAtualEl.value) || 0;
        if (m > manaMax) manaAtualEl.value = manaMax;
    }
}

// ── Toast de mudança de status em tempo real ──────────────
// Guarda os valores iniciais carregados para não disparar
// toast logo ao renderizar a página pela primeira vez.
let _statusCarregado = false;

function notificarMudancaStatus(tipo, anterior, novo) {
    // Não notifica na carga inicial da página
    if (!_statusCarregado) return;
    // Não notifica se o valor não mudou
    if (anterior === novo) return;

    const diff  = novo - anterior;
    const sinal = diff > 0 ? '+' : '';

    const CONFIG = {
        vida: { emoji: '❤️', label: 'HP Máximo',    cor: '#e07b39', corBg: 'rgba(224,123,57,0.12)',  corBorda: 'rgba(224,123,57,0.5)'  },
        mana: { emoji: '💧', label: 'Mana Máxima',  cor: '#00bfff', corBg: 'rgba(0,191,255,0.10)',   corBorda: 'rgba(0,191,255,0.45)'  },
    };
    const c = CONFIG[tipo];
    if (!c) return;

    // Remove toast anterior do mesmo tipo se ainda estiver visível
    const toastAntigo = document.getElementById(`_toast_status_${tipo}`);
    if (toastAntigo) {
        clearTimeout(toastAntigo._timer);
        toastAntigo.remove();
    }

    const corDiff = diff > 0 ? '#4CAF50' : '#e74c3c';

    const toast = document.createElement('div');
    toast.id = `_toast_status_${tipo}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(12px);
        background: ${c.corBg};
        border: 1px solid ${c.corBorda};
        border-left: 4px solid ${c.cor};
        border-radius: 10px;
        padding: 12px 18px 12px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.75);
        z-index: 9990;
        min-width: 230px;
        max-width: 320px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.22s ease, transform 0.22s ease;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
    `;
    toast.innerHTML = `
        <span style="font-size:26px;line-height:1;flex-shrink:0">${c.emoji}</span>
        <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
            <span style="font-size:10px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:.6px">${c.label} alterado</span>
            <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">
                <span style="font-size:14px;font-weight:bold;color:#aaa;text-decoration:line-through;opacity:.7">${anterior}</span>
                <span style="font-size:11px;color:#555">→</span>
                <span style="font-size:18px;font-weight:bold;color:${c.cor}">${novo}</span>
                <span style="font-size:12px;font-weight:bold;color:${corDiff};background:rgba(0,0,0,0.3);border-radius:4px;padding:1px 5px">${sinal}${diff}</span>
            </div>
        </div>
    `;

    document.body.appendChild(toast);

    // Anima entrada — um único rAF é suficiente após appendChild
    requestAnimationFrame(() => {
        toast.style.opacity   = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Anima saída após 3s
    toast._timer = setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateX(-50%) translateY(8px)';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 280);
    }, 3000);
}

function modificarStatus(tipo) {
    const atualEl = document.getElementById(`${tipo}-atual`);
    const modEl   = document.getElementById(`${tipo}-mod`);
    if (!atualEl || !modEl) return;

    let atual  = parseFloat(atualEl.value) || 0;
    const mod  = modEl.value.trim();
    let maxVal = Infinity;
    if (tipo === 'vida') {
        const maxEl = document.getElementById('vida-maxima');
        maxVal = maxEl ? parseInt(maxEl.textContent) || Infinity : Infinity;
    } else if (tipo === 'mana') {
        const maxEl = document.getElementById('mana-maxima');
        maxVal = maxEl ? parseInt(maxEl.textContent) || Infinity : Infinity;
    } else if (tipo === 'sanidade') {
        maxVal = 100;
    }

    if (mod.includes('%')) {
        const pct = parseFloat(mod.replace('%', ''));
        if (!isNaN(pct)) atual = Math.round(atual * (1 + pct / 100));
    } else {
        const num = parseFloat(mod);
        if (!isNaN(num)) atual += num;
    }

    atualEl.value = Math.min(Math.max(Math.round(atual), 0), maxVal);
    modEl.value   = '';
    // Recalcula buffs dos talentos com novo valor de vida/mana atual
    calcularStatus();
}

// ── Card de foto do personagem ────────────────────────────
async function carregarFotoCard() {
    try {
        const fichaId = getFichaId();
        if (!fichaId) return;

        const { data } = await getSupa()
            .from('fichas')
            .select('nome, classe, img')
            .eq('id', fichaId)
            .maybeSingle();

        if (!data) return;

        const nomeEl   = document.getElementById('char-foto-nome');
        const classeEl = document.getElementById('char-foto-classe');
        if (nomeEl)   nomeEl.textContent   = data.nome   || '—';
        if (classeEl) classeEl.textContent = data.classe || '—';
        if (data.img) mostrarFotoCard(data.img);
    } catch(e) {}
}

function mostrarFotoCard(src) {
    const img = document.getElementById('char-foto-img');
    const ph  = document.getElementById('char-foto-placeholder');
    if (!img || !ph) return;
    img.src = src;
    img.style.display = 'block';
    ph.style.display  = 'none';
}

function atualizarNomeCard() {
    const personagem = document.getElementById('personagem')?.value || '—';
    const classe     = document.getElementById('classe')?.value     || '—';
    const nomeEl     = document.getElementById('char-foto-nome');
    const classeEl   = document.getElementById('char-foto-classe');
    if (nomeEl)   nomeEl.textContent   = personagem;
    if (classeEl) classeEl.textContent = classe;
}

async function trocarFotoPersonagem(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        const img = new Image();
        img.onload = async function() {
            const canvas  = document.createElement('canvas');
            const MAX_W   = 300;
            const scale   = MAX_W / img.width;
            canvas.width  = MAX_W;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64  = canvas.toDataURL('image/jpeg', 0.8);

            // Atualiza imagem da ficha no Supabase
            const fichaId = getFichaId();
            if (fichaId) {
                await getSupa().from('fichas').update({ img: base64 }).eq('id', fichaId);
            }
            mostrarFotoCard(base64);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ════════════════════════════════════════════════════════════
//  LÓGICA DO INVENTÁRIO
// ════════════════════════════════════════════════════════════

function carregarImagemLocal(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas    = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width    = MAX_WIDTH;
            canvas.height   = img.height * scaleSize;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            document.getElementById('item-imagem').value = canvas.toDataURL('image/jpeg', 0.7);
            atualizarPreview();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function atualizarPreview() {
    const nome   = document.getElementById('item-nome')?.value || 'Título...';
    const desc   = document.getElementById('item-descricao')?.value || 'O texto aparecerá aqui...';
    const imgUrl = document.getElementById('item-imagem')?.value || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"%3E%3Crect width="120" height="120" fill="%23111"%2F%3E%3Ctext x="60" y="66" text-anchor="middle" font-size="32" fill="%23444"%3E📷%3C%2Ftext%3E%3C%2Fsvg%3E';
    const zoom   = document.getElementById('crop-zoom')?.value || 1;
    const posX   = document.getElementById('crop-x')?.value || 50;
    const posY   = document.getElementById('crop-y')?.value || 50;

    if (document.getElementById('prev-nome')) document.getElementById('prev-nome').innerText = nome;
    if (document.getElementById('prev-desc')) document.getElementById('prev-desc').innerText = desc;

    const imgEl = document.getElementById('prev-img');
    if (imgEl) {
        imgEl.src = imgUrl;
        imgEl.style.transform      = `scale(${zoom})`;
        imgEl.style.objectPosition = `${posX}% ${posY}%`;
    }
}

// ── Cache em memória do inventário (evita múltiplas chamadas ao Supabase) ──
let _inventarioCache = null;

async function _getInventario() {
    if (_inventarioCache !== null) return _inventarioCache;
    let inv = await carregarDaNuvem('inventario');
    if (!inv) inv = JSON.parse(localStorage.getItem(k('rpg_inventario')) || '[]');
    _inventarioCache = Array.isArray(inv) ? inv : [];
    return _inventarioCache;
}

async function _salvarInventario(inventario) {
    _inventarioCache = inventario;
    localStorage.setItem(k('rpg_inventario'), JSON.stringify(inventario));
    await salvarNuvem('inventario', inventario);
}

// Escapa HTML para evitar XSS ao inserir nome/descrição no innerHTML
function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function adicionarItem() {
    const nome      = document.getElementById('item-nome').value;
    const descricao = document.getElementById('item-descricao').value;
    const imgUrl    = document.getElementById('item-imagem').value || 'https://via.placeholder.com/120?text=Foto';
    const zoom      = document.getElementById('crop-zoom').value;
    const posX      = document.getElementById('crop-x').value;
    const posY      = document.getElementById('crop-y').value;

    if (!nome || !descricao) { alert('Preencha o nome e a descrição do item!'); return; }

    const categoria  = document.getElementById('item-categoria')?.value  || 'geral';
    const quantidade = Math.max(1, parseInt(document.getElementById('item-quantidade')?.value || '1') || 1);

    const inventario = await _getInventario();
    inventario.push({ id: Date.now(), nome, descricao, imagem: imgUrl, zoom, posX, posY, categoria, quantidade });
    await _salvarInventario(inventario);

    document.getElementById('item-nome').value      = '';
    document.getElementById('item-descricao').value = '';
    document.getElementById('item-imagem').value    = '';
    document.getElementById('item-file').value      = '';
    document.getElementById('crop-zoom').value      = '1';
    document.getElementById('crop-x').value         = '50';
    document.getElementById('crop-y').value         = '50';
    const qtdEl = document.getElementById('item-quantidade');
    if (qtdEl) qtdEl.value = '1';

    atualizarPreview();
    _renderizarInventarioLocal();
}


// ── Configuração de categorias do inventário ────────────────────────
const CATEGORIAS_INV = {
    geral:      { label: '📦 Geral',      cor: '#888',    borda: '#444' },
    arma:       { label: '⚔️ Arma',       cor: '#e74c3c', borda: '#c0392b' },
    armadura:   { label: '🛡️ Armadura',   cor: '#3498db', borda: '#2980b9' },
    consumivel: { label: '🧪 Consumível', cor: '#2ecc71', borda: '#27ae60' },
    anotacao:   { label: '📝 Anotação',   cor: '#f39c12', borda: '#d68910' },
    tesouro:    { label: '💰 Tesouro',    cor: '#f1c40f', borda: '#d4ac0d' },
    magico:     { label: '✨ Mágico',     cor: '#9b59b6', borda: '#8e44ad' },
    montaria:   { label: '🐴 Montaria',   cor: '#1abc9c', borda: '#16a085' },
};
function _catInfo(cat) { return CATEGORIAS_INV[cat] || CATEGORIAS_INV.geral; }
function _norm_inv(txt) {
    const s = String(txt).toLowerCase();
    try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    catch(e) { return s; } // fallback para navegadores antigos
}

// ── Alterar quantidade de um item diretamente no card ────────────────
async function alterarQuantidade(id, delta) {
    const inventario = await _getInventario();
    const item = inventario.find(i => i.id === id);
    if (!item) return;

    const novaQtd = Math.max(0, (item.quantidade || 1) + delta);

    if (novaQtd === 0) {
        // Quantidade zerou — confirmar remoção
        if (!confirm(`Remover "${item.nome}" do inventário?`)) {
            // Cancela — re-renderiza sem mudança
            _renderizarInventarioLocal();
            return;
        }
        const novo = inventario.filter(i => i.id !== id);
        await _salvarInventario(novo);
    } else {
        item.quantidade = novaQtd;
        await _salvarInventario(inventario);
    }
    _renderizarInventarioLocal();
}

// ── Toast de confirmação de salvamento ──────────────────────────────
function _mostrarToastSave(msg, cor) {
    msg = msg || '💾 Ficha salva!';
    cor = cor || '#4CAF50';
    const id  = '_toast_save';
    const ant = document.getElementById(id);
    if (ant) ant.remove();
    const t = document.createElement('div');
    t.id = id;
    t.innerHTML = msg;
    t.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);
        background:#1a1a1a;border:1px solid ${cor};color:${cor};
        padding:10px 22px;border-radius:8px;font-size:14px;font-weight:bold;
        z-index:9998;opacity:0;transition:opacity .2s,transform .2s;
        pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.7);
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(16px)';
        setTimeout(() => t.remove(), 250);
    }, 2200);
}

// Renderiza a partir do cache — sem nova chamada ao Supabase
// Respeita filtros de categoria e busca ativos na página
function _renderizarInventarioLocal() {
    const listaConteiner = document.getElementById('lista-itens');
    if (!listaConteiner) return;
    let inventario = _inventarioCache || [];

    // Filtro de busca
    const buscaEl = document.getElementById('inv-busca');
    const termo   = buscaEl ? _norm_inv(buscaEl.value) : '';
    if (termo) inventario = inventario.filter(i =>
        _norm_inv((i.nome || '') + ' ' + (i.descricao || '')).includes(termo)
    );

    // Filtro de categoria
    const catAtiva = document.querySelector('.inv-cat-btn.ativo')?.dataset.cat || 'todos';
    if (catAtiva !== 'todos') inventario = inventario.filter(i => (i.categoria || 'geral') === catAtiva);

    if (inventario.length === 0) {
        listaConteiner.innerHTML = `<div style="color:#555;padding:24px;text-align:center;font-size:14px;">
            ${termo || catAtiva !== 'todos'
                ? '🔍 Nenhum item encontrado com esses filtros.'
                : '📦 Inventário vazio. Adicione seu primeiro item acima.'
            }
        </div>`;
        return;
    }

    listaConteiner.innerHTML = inventario.map(item => {
        const cat = _catInfo(item.categoria || 'geral');
        const qtd = item.quantidade && item.quantidade > 0 ? item.quantidade : 1;

        // Cor dos controles: vermelho quando quantidade é 1 (próximo passo remove)
        const corMenos = qtd <= 1 ? '#e74c3c' : '#888';
        const titMenos = qtd <= 1 ? 'Remover item' : 'Diminuir quantidade';

        const badge = `<span style="font-size:10px;font-weight:bold;color:${cat.cor};
            background:rgba(0,0,0,.4);border:1px solid ${cat.borda};
            padding:2px 8px;border-radius:10px;white-space:nowrap">${cat.label}</span>`;

        return `
        <div class="item-card" style="border-left:3px solid ${cat.borda};">
            <div class="item-info">
                <h3 style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                    ${_esc(item.nome)}
                    <span style="flex:1"></span>${badge}
                </h3>
                <p>${_esc(item.descricao)}</p>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;">
                <div class="item-img-container" style="margin:0">
                    <img src="${_esc(item.imagem)}" alt="${_esc(item.nome)}"
                         style="transform:scale(${parseFloat(item.zoom)||1});
                                object-position:${parseFloat(item.posX)||50}% ${parseFloat(item.posY)||50}%;">
                </div>
                <!-- Controles de quantidade -->
                <div style="display:flex;align-items:center;gap:6px;background:#0f0f0f;
                            border:1px solid #2a2a2a;border-radius:6px;padding:4px 8px;">
                    <button onclick="alterarQuantidade(${Number(item.id)}, -1)"
                        title="${titMenos}"
                        style="background:none;border:none;color:${corMenos};font-size:18px;
                               font-weight:bold;cursor:pointer;padding:0 4px;line-height:1;
                               transition:color .15s;font-family:inherit;">−</button>
                    <span style="color:#fff;font-weight:bold;font-size:15px;
                                 min-width:22px;text-align:center;">${qtd}</span>
                    <button onclick="alterarQuantidade(${Number(item.id)}, +1)"
                        title="Aumentar quantidade"
                        style="background:none;border:none;color:#4CAF50;font-size:18px;
                               font-weight:bold;cursor:pointer;padding:0 4px;line-height:1;
                               transition:color .15s;font-family:inherit;">+</button>
                </div>
                <button class="btn-remover-item"
                    onclick="removerItemInventario(${Number(item.id)})"
                    style="width:100%;padding:6px 8px;font-size:12px;">🗑️ Remover</button>
            </div>
        </div>`;
    }).join('');
}

// Carrega da nuvem UMA vez e depois só usa o cache
async function renderizarInventario() {
    const listaConteiner = document.getElementById('lista-itens');
    if (!listaConteiner) return;
    _inventarioCache = null; // força recarregar do Supabase ao abrir a página
    await _getInventario();
    _renderizarInventarioLocal();
}

async function removerItemInventario(id) {
    if (!confirm('Tem certeza que deseja remover este item?')) return;
    const inventario = (await _getInventario()).filter(item => item.id !== id);
    await _salvarInventario(inventario);
    _renderizarInventarioLocal(); // usa cache — sem nova chamada à rede
}

// ── Salvar talentos (chamado do talentos.html) ─────────────
async function salvarTalentosNuvem(talentos) {
    _talentosCache = null; // invalida cache em memória
    localStorage.setItem(k('rpg_talentos'), JSON.stringify(talentos));
    await salvarNuvem('talentos', talentos);
}

async function carregarTalentosNuvem() {
    let talentos = await carregarDaNuvem('talentos');
    if (!talentos) talentos = JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');
    return talentos;
}

// ── Inicialização ──────────────────────────────────────────
// calcularStatusDebounced: sempre chama window.calcularStatus no momento da invocação,
// garantindo que o wrap do ui-enhancements.js seja respeitado.
const calcularStatusDebounced = debounce(function(...args) {
    return window.calcularStatus(...args);
}, 350);

document.addEventListener('DOMContentLoaded', async () => {
    // Proteção: sem ficha ativa → volta ao painel
    if (!protegerFichaAtiva()) return;

    // Skeleton loader enquanto carrega dados
    const rpgWindow = document.querySelector('.rpg-window');
    if (rpgWindow) rpgWindow.style.opacity = '0.4';

    await carregarFotoCard();
    await carregarDadosFicha();
    await calcularStatus();
    // Só dispara toasts APÓS o carregamento inicial
    _statusCarregado = true;

    if (rpgWindow) rpgWindow.style.transition = 'opacity 0.25s';
    if (rpgWindow) rpgWindow.style.opacity = '1';

    if (document.getElementById('lista-itens')) {
        atualizarPreview();
        await renderizarInventario();
    }
});
