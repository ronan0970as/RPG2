// ════════════════════════════════════════════════════════════
//  java.js — Ficha RPG Principal
//  Dados salvos no Supabase (tabela: fichas_dados)
// ════════════════════════════════════════════════════════════

// ── ID da ficha ativa ──────────────────────────────────────
function getFichaId() {
    return localStorage.getItem('rpg_ficha_ativa') || null;
}

// ── Chave local de cache (para performance) ────────────────
function k(chave) {
    return getFichaId() + '_' + chave;
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
    mostrarToastSalvo();
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

async function lerBuffsDosTalentos(bases) {
    const buffs = { forca: 0, velocidade: 0, inteligencia: 0, defesa: 0, pontaria: 0, carisma: 0, furtividade: 0 };
    try {
        let talentos = await carregarDaNuvem('talentos');
        if (!talentos) talentos = JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');
        talentos.forEach(t => {
            if (!t.ativo) return;
            const b = t.buffs || {};
            Object.keys(buffs).forEach(key => {
                const valStr = b[key] || '';
                if (!valStr) return;
                if (valStr.includes('%')) {
                    const pct = parseFloat(valStr.replace('%', ''));
                    const baseVal = bases[key] || 0;
                    if (!isNaN(pct)) buffs[key] += Math.round((pct / 100) * baseVal);
                } else {
                    const num = parseInt(valStr);
                    if (!isNaN(num)) buffs[key] += num;
                }
            });
        });
    } catch(e) {}
    return buffs;
}

function calcularBonusAttr(baseValue, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return 0;
    let txt = el.value.trim();
    if (txt === '') return 0;
    if (txt.includes('%')) {
        const pct = parseFloat(txt.replace('%', ''));
        return Math.round(baseValue * (pct / 100));
    }
    return parseInt(txt) || 0;
}

// ── Calcula buffs dinâmicos dos talentos (ex: +1 força a cada 50 mana) ──────
async function calcularBuffsDinamicos(bases, manaMax) {
    const resultado = { forca: 0, velocidade: 0, inteligencia: 0, defesa: 0, pontaria: 0, carisma: 0, furtividade: 0 };
    try {
        let talentos = await carregarDaNuvem('talentos');
        if (!talentos) talentos = JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');

        talentos.forEach(t => {
            if (!t.ativo) return;
            const configs = t.buffDinamicoConfig;
            if (!configs || !Array.isArray(configs)) return;

            configs.forEach(bd => {
                const attr = bd.atributo;
                if (!attr || resultado[attr] === undefined) return;

                switch (bd.tipo) {
                    case 'mana_para_atributo': {
                        const divisor = parseInt(bd.divisor) || 50;
                        const valPor  = parseFloat(bd.valorPorDivisor) || 1;
                        resultado[attr] += Math.floor(manaMax / divisor) * valPor;
                        break;
                    }
                    case 'kills_para_atributo': {
                        // Lê kills salvos; o campo é salvo como dado extra na ficha
                        const kills = parseInt(localStorage.getItem(k('rpg_kills')) || '0');
                        const kPor  = parseInt(bd.killsPorBuff) || 25;
                        const vPor  = parseFloat(bd.valorPorDivisor) || 1;
                        resultado[attr] += Math.floor(kills / kPor) * vPor;
                        break;
                    }
                    case 'turnos_para_atributo': {
                        // Lê turno atual salvo
                        const turnosTotal = parseInt(localStorage.getItem(k('rpg_turno')) || '0');
                        const tPor = parseInt(bd.turnosPorBuff) || 5;
                        const vPor = parseFloat(bd.valorPorDivisor) || 1;
                        const maxPct = bd.maxPorcentagem ? parseFloat(bd.maxPorcentagem) : Infinity;
                        const crescimento = Math.floor(turnosTotal / tPor) * vPor;
                        // Se for percentual crescente, calcular sobre a base
                        if (bd.formula && bd.formula.includes('%')) {
                            const pct = Math.min(crescimento, maxPct);
                            resultado[attr] += Math.round((bases[attr] || 0) * (pct / 100));
                        } else {
                            resultado[attr] += crescimento;
                        }
                        break;
                    }
                    case 'multiplicador_mestre': {
                        // Controlado manualmente pelo mestre via campo de buffs fixos — não calcula automaticamente
                        break;
                    }
                }
            });
        });
    } catch(e) { console.warn('Erro ao calcular buffs dinâmicos:', e); }
    return resultado;
}

async function calcularStatus() {
    const bases = {
        defesa:       parseInt(document.getElementById('defesa-base')?.value) || 0,
        inteligencia: parseInt(document.getElementById('int-base')?.value) || 0,
        forca:        parseInt(document.getElementById('forca-base')?.value) || 0,
        velocidade:   parseInt(document.getElementById('vel-base')?.value) || 0,
        pontaria:     parseInt(document.getElementById('pont-base')?.value) || 0,
        carisma:      parseInt(document.getElementById('car-base')?.value) || 0,
        furtividade:  parseInt(document.getElementById('furt-base')?.value) || 0
    };

    const buffs = await lerBuffsDosTalentos(bases);

    const defBonus   = calcularBonusAttr(bases.defesa,       'defesa-bonus');
    const intBonus   = calcularBonusAttr(bases.inteligencia, 'int-bonus');
    const forcaBonus = calcularBonusAttr(bases.forca,        'forca-bonus');
    const velBonus   = calcularBonusAttr(bases.velocidade,   'vel-bonus');
    const pontBonus  = calcularBonusAttr(bases.pontaria,     'pont-bonus');
    const carBonus   = calcularBonusAttr(bases.carisma,      'car-bonus');
    const furtBonus  = calcularBonusAttr(bases.furtividade,  'furt-bonus');

    const defTotal  = bases.defesa       + defBonus   + buffs.defesa;
    const intTotal  = bases.inteligencia + intBonus   + buffs.inteligencia;
    const manaMax   = intTotal * 10;
    const vidaMax   = 50 + (defTotal * 50);

    // ── Buffs dinâmicos dos talentos (ex: +1 força a cada 50 mana) ──
    const buffsDinamicos = await calcularBuffsDinamicos(bases, manaMax);

    function renderTotal(elId, baseVal, buffManual, buffTalento, extra) {
        const el = document.getElementById(elId);
        if (!el) return;
        const total = baseVal + buffManual + buffTalento + (extra || 0);
        let txt = `= ${total}`;
        const partes = [];
        if (buffManual  !== 0) partes.push(`<span class="buff-part" style="color:#c8aa6e">${buffManual > 0 ? '+' : ''}${buffManual} manual</span>`);
        if (buffTalento !== 0) partes.push(`<span class="buff-part" style="color:#4CAF50">${buffTalento > 0 ? '+' : ''}${buffTalento} talento</span>`);
        if (extra !== undefined && extra !== 0) partes.push(`<span class="buff-part" style="color:#00bfff">${extra > 0 ? '+' : ''}${extra} dinâmico</span>`);
        el.innerHTML = `<span>${txt}</span>${partes.length ? ' <small>(' + partes.join(', ') + ')</small>' : ''}`;
    }

    renderTotal('forca-total',  bases.forca,        forcaBonus, buffs.forca,       buffsDinamicos.forca);
    renderTotal('vel-total',    bases.velocidade,   velBonus,   buffs.velocidade,  buffsDinamicos.velocidade);
    renderTotal('int-total',    bases.inteligencia, intBonus,   buffs.inteligencia,buffsDinamicos.inteligencia);
    renderTotal('defesa-total', bases.defesa,       defBonus,   buffs.defesa,      buffsDinamicos.defesa);
    renderTotal('pont-total',   bases.pontaria,     pontBonus,  buffs.pontaria,    buffsDinamicos.pontaria);
    renderTotal('car-total',    bases.carisma,      carBonus,   buffs.carisma,     buffsDinamicos.carisma);
    renderTotal('furt-total',   bases.furtividade,  furtBonus,  buffs.furtividade, buffsDinamicos.furtividade);

    const vidaMaxEl = document.getElementById('vida-maxima');
    const manaMaxEl = document.getElementById('mana-maxima');

    if (vidaMaxEl) {
        const vidaAnterior = parseInt(vidaMaxEl.textContent) || 0;
        vidaMaxEl.textContent = vidaMax;
        notificarMudancaStatus('vida', vidaAnterior, vidaMax);
    }
    if (manaMaxEl) {
        const manaAnterior = parseInt(manaMaxEl.textContent) || 0;
        manaMaxEl.textContent = manaMax;
        notificarMudancaStatus('mana', manaAnterior, manaMax);
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

    // Anima entrada
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity   = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
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

async function adicionarItem() {
    const nome      = document.getElementById('item-nome').value;
    const descricao = document.getElementById('item-descricao').value;
    const imgUrl    = document.getElementById('item-imagem').value || 'https://via.placeholder.com/120?text=Foto';
    const zoom      = document.getElementById('crop-zoom').value;
    const posX      = document.getElementById('crop-x').value;
    const posY      = document.getElementById('crop-y').value;

    if (!nome || !descricao) { alert('Preencha o nome e a descrição do item!'); return; }

    let inventario = await carregarDaNuvem('inventario') || [];
    inventario.push({ id: Date.now(), nome, descricao, imagem: imgUrl, zoom, posX, posY });

    // Cache local + nuvem
    localStorage.setItem(k('rpg_inventario'), JSON.stringify(inventario));
    await salvarNuvem('inventario', inventario);

    document.getElementById('item-nome').value      = '';
    document.getElementById('item-descricao').value = '';
    document.getElementById('item-imagem').value    = '';
    document.getElementById('item-file').value      = '';
    document.getElementById('crop-zoom').value      = '1';
    document.getElementById('crop-x').value         = '50';
    document.getElementById('crop-y').value         = '50';

    atualizarPreview();
    renderizarInventario();
}

async function renderizarInventario() {
    const listaConteiner = document.getElementById('lista-itens');
    if (!listaConteiner) return;

    let inventario = await carregarDaNuvem('inventario');
    if (!inventario) inventario = JSON.parse(localStorage.getItem(k('rpg_inventario')) || '[]');

    listaConteiner.innerHTML = '';
    inventario.forEach((item) => {
        listaConteiner.innerHTML += `
            <div class="item-card">
                <div class="item-info">
                    <h3>${item.nome}</h3>
                    <p>${item.descricao}</p>
                </div>
                <div class="item-img-container">
                    <img src="${item.imagem}" alt="${item.nome}"
                         style="transform:scale(${item.zoom||1});object-position:${item.posX||50}% ${item.posY||50}%;">
                </div>
                <button class="btn-remover-item" onclick="removerItemInventario(${item.id})">Remover</button>
            </div>`;
    });
}

async function removerItemInventario(id) {
    if (!confirm('Tem certeza que deseja remover este item?')) return;
    let inventario = await carregarDaNuvem('inventario') || [];
    inventario = inventario.filter(item => item.id !== id);
    localStorage.setItem(k('rpg_inventario'), JSON.stringify(inventario));
    await salvarNuvem('inventario', inventario);
    renderizarInventario();
}

// ── Salvar talentos (chamado do talentos.html) ─────────────
async function salvarTalentosNuvem(talentos) {
    localStorage.setItem(k('rpg_talentos'), JSON.stringify(talentos));
    await salvarNuvem('talentos', talentos);
}

async function carregarTalentosNuvem() {
    let talentos = await carregarDaNuvem('talentos');
    if (!talentos) talentos = JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');
    return talentos;
}

// ── Inicialização ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await carregarFotoCard();
    await carregarDadosFicha();
    await calcularStatus();
    // Só dispara toasts APÓS o carregamento inicial
    _statusCarregado = true;

    if (document.getElementById('lista-itens')) {
        atualizarPreview();
        await renderizarInventario();
    }
});
