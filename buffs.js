// ════════════════════════════════════════════════════════════
//  buffs.js — Parser de Buffs Dinâmicos Unificado v4
//  Fonte única de verdade para java.js e talentos.html.
//
//  ATRIBUTOS suportados como DESTINO dos buffs:
//    força, velocidade, inteligência, defesa, pontaria, carisma, furtividade
//
//  STATUS suportados como DESTINO dos buffs:
//    vida máxima, mana máxima, sanidade máxima
//
//  STATUS/ATRIBUTOS suportados como FONTE (a cada X de ...):
//    mana (mana máxima), vida (vida máxima), sanidade, nível,
//    força, velocidade, inteligência, defesa, pontaria, carisma, furtividade
//
//  FORMATOS detectados (com/sem acento, maiúsculas/minúsculas):
//
//  ── Buff simples em atributo:
//     +1 Força | +1 de Força | (+1 Força) | +1 em Força
//     +1 em todos | +1 em tudo
//
//  ── Buff simples em status:
//     +50 vida máxima | +10 mana máxima | +50 de vida max
//
//  ── Buff condicional — "a cada X de FONTE → N em DESTINO":
//     +1 de Força a cada 50 de Mana
//     +10 de Mana Máxima a cada 1 de Inteligência
//     +50 de Vida Máxima a cada 1 de Defesa
//     +1 de todos a cada 50 de Mana
//     (+1 a cada 50 de Mana)   ← sem destino = aplica em todos os atributos
//
//  ── Buff percentual:
//     +10% Velocidade | +10% de Força | +10% vida máxima
//
//  ── Buff por nível:
//     +2 de Defesa por nível | +50 de Vida Máxima por nível
//
//  RETORNO de parsearBuffsDinamicos():
//    {
//      forca: N, velocidade: N, inteligencia: N, defesa: N,
//      pontaria: N, carisma: N, furtividade: N,
//      vidaMax: N, manaMax: N, sanidadeMax: N
//    }
// ════════════════════════════════════════════════════════════

// ── Normaliza: remove acentos + minúsculas ────────────────
function _norm(txt) {
    return String(txt).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Tabela de atributos (destino E fonte) ─────────────────
const BUFF_ALIAS = {
    forca:        ['forca','dano fisico','ataque fisico','dano','str'],
    velocidade:   ['velocidade','agilidade','spd'],
    inteligencia: ['inteligencia','intel','magia','poder magico','int'],
    defesa:       ['defesa','armadura','resistencia','def'],
    pontaria:     ['pontaria','precisao','mira','pont'],
    carisma:      ['carisma','persuasao','lideranca','car'],
    furtividade:  ['furtividade','furtivo','stealth','sombra','furt']
};

// ── Tabela de status como DESTINO de buff ─────────────────
const STATUS_DEST_ALIAS = {
    vidaMax:      ['vida maxima','vida max','hp maximo','hp max','vida total','vida'],
    manaMax:      ['mana maxima','mana max','mp maximo','mp max','mana total','mana'],
    sanidadeMax:  ['sanidade maxima','sanidade max','san max','sanidade']
};

// ── Tabela de fontes (para "a cada X de FONTE") ───────────
// inclui atributos + recursos de status
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

// ── Resolve nome de atributo → chave interna ─────────────
function resolverAtributo(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;
    const exatos = {
        forca:'forca', velocidade:'velocidade', inteligencia:'inteligencia',
        defesa:'defesa', pontaria:'pontaria', carisma:'carisma', furtividade:'furtividade'
    };
    for (const [key, alias] of Object.entries(exatos)) {
        if (new RegExp('(?:^|\\W)' + alias + '(?:\\W|$)').test(t)) return key;
    }
    for (const [key, aliases] of Object.entries(BUFF_ALIAS)) {
        if (aliases.some(a => t.includes(a))) return key;
    }
    return null;
}

// ── Resolve nome de status como destino → chave interna ──
function resolverStatusDestino(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;
    // Testa "vida maxima"/"mana maxima" antes de "vida"/"mana" (mais específico primeiro)
    for (const [key, aliases] of Object.entries(STATUS_DEST_ALIAS)) {
        // Ordena por tamanho decrescente para testar aliases mais longos primeiro
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => t.includes(a))) return key;
    }
    return null;
}

// ── Resolve nome de fonte → chave interna ────────────────
function resolverFonte(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;
    // Ordena por especificidade (mais longo primeiro)
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
//  parsearBuffsDinamicos(descricao, opts)
//
//  opts.bases       — { forca: N, defesa: N, ... } bases dos atributos
//  opts.statusLocal — { manaMax, vidaMax, nivel, sanidade, forca, ... }
//  opts.getValorFonte — function(chave) → número (override do padrão)
//
//  Retorna:
//  {
//    forca, velocidade, inteligencia, defesa, pontaria, carisma, furtividade,
//    vidaMax, manaMax, sanidadeMax
//  }
// ─────────────────────────────────────────────────────────
function parsearBuffsDinamicos(descricao, opts = {}) {
    if (!descricao) return {};

    const { bases = {}, statusLocal = {}, getValorFonte } = opts;

    // Valor atual de uma FONTE (atributo ou recurso)
    function _getFonte(chave) {
        if (typeof getValorFonte === 'function') {
            const v = getValorFonte(chave);
            if (v !== undefined && v !== null) return Number(v) || 0;
        }
        // statusLocal pode conter tanto atributos como manaMax/vidaMax/nivel
        if (statusLocal[chave] !== undefined) return Number(statusLocal[chave]) || 0;
        // tenta ler bases do DOM via statusLocal de fallback
        switch (chave) {
            case 'mana':
            case 'manaMax':
                return statusLocal.manaMax
                    || parseInt(document.getElementById?.('mana-maxima')?.textContent)
                    || parseInt(document.getElementById?.('mana-atual')?.value)
                    || 0;
            case 'vida':
            case 'vidaMax':
                return statusLocal.vidaMax
                    || parseInt(document.getElementById?.('vida-maxima')?.textContent)
                    || parseInt(document.getElementById?.('vida-atual')?.value)
                    || 0;
            case 'sanidade':
            case 'sanidadeMax':
                return statusLocal.sanidade
                    || parseInt(document.getElementById?.('sanidade-atual')?.value)
                    || 0;
            case 'nivel':
                return statusLocal.nivel
                    || parseInt(document.getElementById?.('nivel')?.value)
                    || 0;
            // atributos base
            case 'forca':        return parseInt(bases.forca        ?? statusLocal.forca        ?? 0);
            case 'velocidade':   return parseInt(bases.velocidade   ?? statusLocal.velocidade   ?? 0);
            case 'inteligencia': return parseInt(bases.inteligencia ?? statusLocal.inteligencia ?? 0);
            case 'defesa':       return parseInt(bases.defesa       ?? statusLocal.defesa       ?? 0);
            case 'pontaria':     return parseInt(bases.pontaria     ?? statusLocal.pontaria     ?? 0);
            case 'carisma':      return parseInt(bases.carisma      ?? statusLocal.carisma      ?? 0);
            case 'furtividade':  return parseInt(bases.furtividade  ?? statusLocal.furtividade  ?? 0);
            default: return 0;
        }
    }

    const buffs = {};
    const texto = _norm(descricao);
    const ATTR_KEYS = Object.keys(BUFF_ALIAS);

    function add(key, val) {
        if (!key || isNaN(val) || val === 0) return;
        buffs[key] = (buffs[key] || 0) + val;
    }

    // Aplica em todos os ATRIBUTOS (não em status como vidaMax/manaMax)
    function addTodosAtributos(val) {
        ATTR_KEYS.forEach(k => add(k, val));
    }

    // Tokeniza: cada bloco "(+...)" ou "+..." até próximo "+" ou fim
    const tokens = [];
    const rgxToken = /\(\s*\+([^)]+)\)|\+([^\n+]+)/g;
    let mt;
    while ((mt = rgxToken.exec(texto)) !== null) {
        tokens.push((mt[1] || mt[2]).trim());
    }

    for (const token of tokens) {

        // ── 1. "+N em tudo/todos" ─────────────────────────────
        if (/^(\d+(?:[.,]\d+)?)\s*(?:em\s+)?(?:tudo|todos)/.test(token)) {
            addTodosAtributos(parseFloat(token.replace(',', '.')));
            continue;
        }

        // ── 2. "N [de/em] DESTINO a cada X [de] FONTE" ───────
        //   Suporta DESTINO = atributo OU status (vida max, mana max...)
        //   Suporta FONTE   = recurso OU atributo
        const rgxACada = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]*?)\s*a cada\s+(\d+(?:[.,]\d+)?)\s*(?:de\s+)?([a-z ]+)/;
        const mAC = rgxACada.exec(token);
        if (mAC) {
            const bonusPorX  = parseFloat(mAC[1].replace(',', '.'));
            const destTxt    = mAC[2].trim();
            const divisor    = parseFloat(mAC[3].replace(',', '.'));
            const fonteRaw   = mAC[4].trim();
            const fonteKey   = resolverFonte(fonteRaw);

            if (divisor > 0 && fonteKey) {
                const valorFonte = _getFonte(fonteKey);
                const bonus = Math.floor(valorFonte / divisor) * bonusPorX;

                if (!destTxt || /^(tudo|todos)$/.test(destTxt)) {
                    // sem destino ou "todos" → aplica em todos os atributos
                    addTodosAtributos(bonus);
                } else {
                    // Tenta resolver como status primeiro (vida max, mana max), depois atributo
                    const statusKey = resolverStatusDestino(destTxt);
                    if (statusKey) {
                        add(statusKey, bonus);
                    } else {
                        const attrKey = resolverAtributo(destTxt);
                        add(attrKey, bonus);
                    }
                }
            }
            continue;
        }

        // ── 3. "N% [de/em] DESTINO" ──────────────────────────
        const rgxPct = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+|em\s+)?([a-z ]{2,35})/;
        const mPct = rgxPct.exec(token);
        if (mPct) {
            const pct     = parseFloat(mPct[1].replace(',', '.'));
            const destTxt = mPct[2].trim();
            // Tenta status primeiro
            const statusKey = resolverStatusDestino(destTxt);
            if (statusKey) {
                // % de vida/mana max — usa o valor atual do status
                const baseVal = _getFonte(statusKey);
                add(statusKey, Math.round((pct / 100) * baseVal));
            } else {
                const attrKey = resolverAtributo(destTxt);
                if (attrKey) {
                    const baseVal = parseInt(bases[attrKey] ?? 0);
                    add(attrKey, Math.round((pct / 100) * baseVal));
                }
            }
            continue;
        }

        // ── 4. "N [de/em] DESTINO por nível" ─────────────────
        const rgxNivel = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]{2,35}?)\s+por\s+n[ií]vel/;
        const mNiv = rgxNivel.exec(token);
        if (mNiv) {
            const bonusPorNivel = parseFloat(mNiv[1].replace(',', '.'));
            const destTxt = mNiv[2].trim();
            const nivel   = _getFonte('nivel');
            const statusKey = resolverStatusDestino(destTxt);
            if (statusKey) {
                add(statusKey, bonusPorNivel * nivel);
            } else {
                const attrKey = resolverAtributo(destTxt);
                add(attrKey, bonusPorNivel * nivel);
            }
            continue;
        }

        // ── 5. Formato simples: "N [de/em] DESTINO" ──────────
        const rgxSimples = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z][a-z ]{0,30})/;
        const mS = rgxSimples.exec(token);
        if (mS) {
            const val     = parseFloat(mS[1].replace(',', '.'));
            const destTxt = mS[2].trim();
            if (/^(tudo|todos)$/.test(destTxt)) {
                addTodosAtributos(val);
                continue;
            }
            // Tenta status primeiro (ex: "+50 vida max")
            const statusKey = resolverStatusDestino(destTxt);
            if (statusKey) {
                add(statusKey, val);
            } else {
                const attrKey = resolverAtributo(destTxt);
                add(attrKey, val);
            }
        }
    }

    return buffs;
}
