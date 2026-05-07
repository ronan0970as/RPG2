// ════════════════════════════════════════════════════════════
//  buffs.js — Parser de Buffs Dinâmicos v6
//  Fonte única de verdade para java.js e talentos.html.
//
//  CORREÇÃO v6 — fim do loop infinito:
//  ─ manaMax e vidaMax usados como FONTE de buff condicional
//    são calculados APENAS a partir das bases fixas do personagem
//    (base + bônus manual). Eles NÃO crescem com os buffs dos talentos.
//  ─ Exemplo sem loop:
//      T1: "+1 Defesa a cada 1 de Mana"  → usa manaBase = int*10
//      T2: "+1 Inteligência a cada 1 de Vida" → usa vidaBase = 50+def*50
//    Ambos calculam sobre os valores fixos das bases, não sobre si mesmos.
//
//  ATRIBUTOS como DESTINO: força, velocidade, inteligência,
//    defesa, pontaria, carisma, furtividade
//
//  STATUS como DESTINO: vida máxima, mana máxima, sanidade máxima
//
//  FONTES (a cada X de ...): mana, vida, sanidade, nível,
//    e todos os atributos acima
//
//  FORMATOS suportados:
//    +1 Força | +1 de Força | (+1 Força) | +1 em Força
//    +1 em todos | +1 em tudo
//    +50 vida máxima | +10 mana máxima
//    +1 de Força a cada 50 de Mana
//    +10% Velocidade | +10% de Força | +10% vida máxima
//    +2 de Defesa por nível
// ════════════════════════════════════════════════════════════

// ── Normaliza: remove acentos + minúsculas ────────────────
function _norm(txt) {
    return String(txt).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Chaves de atributos ───────────────────────────────────
const BUFF_ATTR_KEYS = [
    'forca','velocidade','inteligencia','defesa',
    'pontaria','carisma','furtividade'
];

// ── Aliases de atributos ──────────────────────────────────
const BUFF_ALIAS = {
    forca:        ['forca','dano fisico','ataque fisico','dano','str'],
    velocidade:   ['velocidade','agilidade','spd'],
    inteligencia: ['inteligencia','intel','magia','poder magico','int'],
    defesa:       ['defesa','armadura','resistencia','def'],
    pontaria:     ['pontaria','precisao','mira','pont'],
    carisma:      ['carisma','persuasao','lideranca','car'],
    furtividade:  ['furtividade','furtivo','stealth','sombra','furt']
};

// ── Status como DESTINO ───────────────────────────────────
const STATUS_DEST_ALIAS = {
    vidaMax:     ['vida maxima','vida max','hp maximo','hp max','vida total','vida'],
    manaMax:     ['mana maxima','mana max','mp maximo','mp max','mana total','mana'],
    sanidadeMax: ['sanidade maxima','sanidade max','san max','sanidade']
};

// ── Fontes para "a cada X de FONTE" ──────────────────────
const FONTE_ALIAS = {
    mana:         ['mana','mp','mana maxima','mana max'],
    vida:         ['vida','hp','vida maxima','vida max'],
    sanidade:     ['sanidade','san'],
    nivel:        ['nivel','level','lv','lvl'],
    forca:        ['forca','str'],
    velocidade:   ['velocidade','agilidade','spd'],
    inteligencia: ['inteligencia','intel','magia','int'],
    defesa:       ['defesa','armadura','resistencia','def'],
    pontaria:     ['pontaria','precisao','mira','pont'],
    carisma:      ['carisma','persuasao','lideranca','car'],
    furtividade:  ['furtividade','furtivo','stealth','furt']
};

// ── Resolve atributo → chave interna ─────────────────────
function resolverAtributo(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;
    for (const [key, aliases] of Object.entries(BUFF_ALIAS)) {
        if (aliases.some(a => {
            const re = new RegExp('(?:^|\\W)' + a + '(?:\\W|$)');
            return re.test(t) || t.includes(a);
        })) return key;
    }
    return null;
}

// ── Resolve status destino → chave interna ────────────────
function resolverStatusDestino(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;
    for (const [key, aliases] of Object.entries(STATUS_DEST_ALIAS)) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => {
            // Word boundary: alias deve ser palavra isolada ou estar no início/fim
            // Evita "vida" dentro de "furtividade", "sanidade" dentro de "velocidade" etc.
            const re = new RegExp('(?:^|\\s)' + a.replace(/\s+/g,'\\s+') + '(?:\\s|$)');
            return re.test(t) || t === a;
        })) return key;
    }
    return null;
}

// ── Resolve fonte → chave interna ────────────────────────
function resolverFonte(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;
    const entries = Object.entries(FONTE_ALIAS).sort((a, b) => {
        const maxA = Math.max(...a[1].map(x => x.length));
        const maxB = Math.max(...b[1].map(x => x.length));
        return maxB - maxA;
    });
    for (const [key, aliases] of entries) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => {
            const re = new RegExp('(?:^|\\W)' + a.replace(/\s+/g, '\\s+') + '(?:\\W|$)');
            return re.test(t) || t === a;
        })) return key;
    }
    return null;
}

// ─────────────────────────────────────────────────────────
//  construirStatusBase(bases, nivel, sanidade)
//
//  Calcula o snapshot de STATUS usando SOMENTE as bases fixas
//  do personagem (base + bônus manual dos campos de texto).
//  NÃO inclui buffs de talentos.
//
//  Este é o valor que alimenta as fontes dos buffs condicionais
//  (ex: "a cada 1 de Mana") — garantindo que não haja loop.
// ─────────────────────────────────────────────────────────
function construirStatusBase(bases, nivel, sanidade) {
    nivel    = nivel    || 0;
    sanidade = sanidade || 0;
    const def = bases.defesa       || 0;
    const int = bases.inteligencia || 0;
    return {
        nivel,
        sanidade,
        forca:        bases.forca        || 0,
        velocidade:   bases.velocidade   || 0,
        inteligencia: int,
        defesa:       def,
        pontaria:     bases.pontaria     || 0,
        carisma:      bases.carisma      || 0,
        furtividade:  bases.furtividade  || 0,
        // vida e mana calculadas APENAS das bases — sem buffs de talentos
        vidaMax:  50 + (def * 50),
        manaMax:  int * 10,
        sanidadeMax: 100,
        vida: 50 + (def * 50),
        mana: int * 10,
    };
}

// ─────────────────────────────────────────────────────────
//  construirStatusAtual(bases, totais, nivel, sanidade)
//
//  Monta o snapshot completo para EXIBIÇÃO dos resultados finais.
//  Inclui os buffs dos talentos nos atributos e nos status.
//  NÃO é usado como fonte de condicionais — apenas para mostrar
//  os valores totais ao jogador.
// ─────────────────────────────────────────────────────────
function construirStatusAtual(bases, totais, nivel, sanidade) {
    nivel    = nivel    || 0;
    sanidade = sanidade || 0;
    const defTotal = (bases.defesa       || 0) + (totais.defesa       || 0);
    const intTotal = (bases.inteligencia || 0) + (totais.inteligencia || 0);
    const vidaMax  = 50 + (defTotal * 50) + (totais.vidaMax    || 0);
    const manaMax  = (intTotal * 10)       + (totais.manaMax    || 0);
    return {
        nivel,
        sanidade,
        forca:        (bases.forca        || 0) + (totais.forca        || 0),
        velocidade:   (bases.velocidade   || 0) + (totais.velocidade   || 0),
        inteligencia: intTotal,
        defesa:       defTotal,
        pontaria:     (bases.pontaria     || 0) + (totais.pontaria     || 0),
        carisma:      (bases.carisma      || 0) + (totais.carisma      || 0),
        furtividade:  (bases.furtividade  || 0) + (totais.furtividade  || 0),
        vidaMax,
        manaMax,
        sanidadeMax: 100 + (totais.sanidadeMax || 0),
        vida: vidaMax,
        mana: manaMax,
    };
}

// ── Totais zerados ────────────────────────────────────────
function _zeroTotais() {
    return {
        forca: 0, velocidade: 0, inteligencia: 0, defesa: 0,
        pontaria: 0, carisma: 0, furtividade: 0,
        vidaMax: 0, manaMax: 0, sanidadeMax: 0
    };
}

// ── Compara convergência ──────────────────────────────────
function _totaisIguais(a, b) {
    return Object.keys(a).every(k => (a[k] || 0) === (b[k] || 0));
}

// ── Bonus fixo dos campos do painel ──────────────────────
function _calcularBonusFixo(buffsObj, bases) {
    const resultado = {};
    if (!buffsObj) return resultado;
    BUFF_ATTR_KEYS.forEach(key => {
        const valStr = String(buffsObj[key] || '').trim();
        if (!valStr) return;
        const baseVal = bases[key] || 0;
        if (valStr.includes('%')) {
            const pct = parseFloat(valStr.replace('%', ''));
            if (!isNaN(pct)) resultado[key] = Math.round((pct / 100) * baseVal);
        } else {
            const num = parseInt(valStr);
            if (!isNaN(num)) resultado[key] = num;
        }
    });
    return resultado;
}

// ─────────────────────────────────────────────────────────
//  acumularBuffsDeTalentos(talentos, bases, extras)
//
//  Calcula o total de buffs de todos os talentos ativos.
//
//  REGRA ANTI-LOOP:
//  ─ Os buffs condicionais "a cada X de FONTE" sempre usam
//    o statusBase (calculado apenas das bases fixas), não
//    o manaMax/vidaMax que cresce com os talentos.
//  ─ Isso evita completamente loops do tipo:
//      Defesa ↑ → vidaMax ↑ → mais Defesa ↑ → vidaMax ↑...
//
//  AINDA suporta dependências entre ATRIBUTOS:
//  ─ T1: "+1 Defesa a cada 1 Mana" (usa manaBase fixo)
//  ─ T2: "+1 Força a cada 1 Defesa" (usa Defesa acumulada do T1)
//  ─ Para atributos, faz multi-pass até convergir (max 8 rounds).
//
//  Parâmetros:
//    talentos — array { ativo, buffs, desc }
//    bases    — atributos base+bônus manual do personagem
//    extras   — { nivel, sanidade }
// ─────────────────────────────────────────────────────────
function acumularBuffsDeTalentos(talentos, bases, extras) {
    const MAX_PASSES = 8;
    const nivel    = (extras && extras.nivel)    || 0;
    const sanidade = (extras && extras.sanidade) || 0;

    const ativos = (talentos || []).filter(t => t && t.ativo);
    if (ativos.length === 0) return _zeroTotais();

    // statusBase: valores fixos das bases — usado como FONTE dos condicionais
    // Este snapshot NÃO muda durante o cálculo, evitando loops
    const statusBase = construirStatusBase(bases, nivel, sanidade);

    let totais = _zeroTotais();

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        // Para fontes de atributo (ex: "a cada 1 de Defesa"), usamos o
        // snapshot do round anterior para que T2 veja o buff de T1.
        // Para fontes de status (mana/vida), usamos sempre statusBase fixo.
        const statusAtributos = construirStatusAtual(bases, totais, nivel, sanidade);

        // Merge: atributos do round anterior + status fixos das bases
        // Isso permite T2 ver Defesa do T1, mas NÃO permite que
        // manaMax/vidaMax cresçam em loop
        const fonteParaCondicional = {
            ...statusAtributos,         // atributos acumulados (Defesa, Força...)
            vidaMax:  statusBase.vidaMax,  // vida fixa — sem loop
            manaMax:  statusBase.manaMax,  // mana fixa — sem loop
            vida:     statusBase.vida,
            mana:     statusBase.mana,
            sanidade: statusBase.sanidade,
            sanidadeMax: statusBase.sanidadeMax,
        };

        const novos = _zeroTotais();

        ativos.forEach(t => {
            // 1. Buffs fixos dos campos do painel
            const fixos = _calcularBonusFixo(t.buffs, bases);
            Object.keys(fixos).forEach(k => { novos[k] = (novos[k] || 0) + fixos[k]; });

            // 2. Buffs dinâmicos da descrição
            const din = parsearBuffsDinamicos(t.desc, {
                bases,
                statusLocal: fonteParaCondicional
            });
            Object.keys(novos).forEach(key => {
                if (din[key]) novos[key] += din[key];
            });
        });

        if (_totaisIguais(totais, novos)) break;
        totais = novos;
    }

    return totais;
}

// ─────────────────────────────────────────────────────────
//  parsearBuffsDinamicos(descricao, opts)
//
//  opts.bases        — atributos base do personagem
//  opts.statusLocal  — snapshot para resolver fontes condicionais
//  opts.getValorFonte — override (opcional)
// ─────────────────────────────────────────────────────────
function parsearBuffsDinamicos(descricao, opts) {
    if (!descricao) return {};
    opts = opts || {};

    const bases       = opts.bases       || {};
    const statusLocal = opts.statusLocal || {};
    const getValorFonte = opts.getValorFonte;

    function _getFonte(chave) {
        if (typeof getValorFonte === 'function') {
            const v = getValorFonte(chave);
            if (v !== undefined && v !== null) return Number(v) || 0;
        }
        if (statusLocal[chave] !== undefined) return Number(statusLocal[chave]) || 0;
        // Fallback DOM
        switch (chave) {
            case 'mana':
            case 'manaMax':
                return parseInt(document.getElementById?.('mana-maxima')?.textContent)
                    || parseInt(document.getElementById?.('mana-atual')?.value) || 0;
            case 'vida':
            case 'vidaMax':
                return parseInt(document.getElementById?.('vida-maxima')?.textContent)
                    || parseInt(document.getElementById?.('vida-atual')?.value) || 0;
            case 'sanidade':
            case 'sanidadeMax':
                return parseInt(document.getElementById?.('sanidade-atual')?.value) || 0;
            case 'nivel':
                return parseInt(document.getElementById?.('nivel')?.value) || 0;
            default:
                return parseInt(bases[chave] ?? statusLocal[chave] ?? 0) || 0;
        }
    }

    const buffs = {};
    const texto = _norm(descricao);

    function add(key, val) {
        if (!key || isNaN(val) || val === 0) return;
        buffs[key] = (buffs[key] || 0) + val;
    }
    function addTodos(val) {
        BUFF_ATTR_KEYS.forEach(k => add(k, val));
    }

    const tokens = [];
    const rgxToken = /\(\s*\+([^)]+)\)|\+([^\n+]+)/g;
    let mt;
    while ((mt = rgxToken.exec(texto)) !== null) {
        tokens.push((mt[1] || mt[2]).trim());
    }

    for (const token of tokens) {

        // 1. "+N em tudo/todos"
        if (/^(\d+(?:[.,]\d+)?)\s*(?:em\s+)?(?:tudo|todos)/.test(token)) {
            addTodos(parseFloat(token.replace(',', '.')));
            continue;
        }

        // 2. "N DESTINO a cada X FONTE"
        const rgxACada = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]*?)\s*a cada\s+(\d+(?:[.,]\d+)?)\s*(?:de\s+)?([a-z ]+)/;
        const mAC = rgxACada.exec(token);
        if (mAC) {
            const bonusPorX = parseFloat(mAC[1].replace(',', '.'));
            const destTxt   = mAC[2].trim();
            const divisor   = parseFloat(mAC[3].replace(',', '.'));
            const fonteKey  = resolverFonte(mAC[4].trim());

            if (divisor > 0 && fonteKey) {
                const bonus = Math.floor(_getFonte(fonteKey) / divisor) * bonusPorX;
                if (!destTxt || /^(tudo|todos)$/.test(destTxt)) {
                    addTodos(bonus);
                } else {
                    const sk = resolverStatusDestino(destTxt);
                    if (sk) add(sk, bonus);
                    else    add(resolverAtributo(destTxt), bonus);
                }
            }
            continue;
        }

        // 3. "N% DESTINO"
        const rgxPct = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+|em\s+)?([a-z ]{2,35})/;
        const mPct = rgxPct.exec(token);
        if (mPct) {
            const pct     = parseFloat(mPct[1].replace(',', '.'));
            const destTxt = mPct[2].trim();
            const sk = resolverStatusDestino(destTxt);
            if (sk) {
                add(sk, Math.round((pct / 100) * _getFonte(sk)));
            } else {
                const ak = resolverAtributo(destTxt);
                if (ak) add(ak, Math.round((pct / 100) * parseInt(bases[ak] ?? statusLocal[ak] ?? 0)));
            }
            continue;
        }

        // 4. "N DESTINO por nível"
        const rgxNivel = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]{2,35}?)\s+por\s+n[ií]vel/;
        const mNiv = rgxNivel.exec(token);
        if (mNiv) {
            const bonusNiv = parseFloat(mNiv[1].replace(',', '.'));
            const nivel    = _getFonte('nivel');
            const destTxt  = mNiv[2].trim();
            const sk = resolverStatusDestino(destTxt);
            if (sk) add(sk, bonusNiv * nivel);
            else    add(resolverAtributo(destTxt), bonusNiv * nivel);
            continue;
        }

        // 5. "N DESTINO" simples
        const rgxSimples = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z][a-z ]{0,30})/;
        const mS = rgxSimples.exec(token);
        if (mS) {
            const val     = parseFloat(mS[1].replace(',', '.'));
            const destTxt = mS[2].trim();
            if (/^(tudo|todos)$/.test(destTxt)) { addTodos(val); continue; }
            const sk = resolverStatusDestino(destTxt);
            if (sk) add(sk, val);
            else    add(resolverAtributo(destTxt), val);
        }
    }

    return buffs;
}
