// ════════════════════════════════════════════════════════════
//  buffs.js — Parser de Buffs Dinâmicos Unificado v5
//  Fonte única de verdade para java.js e talentos.html.
//
//  NOVIDADES v5:
//  ─ acumularBuffsDeTalentos(): função central com multi-pass
//    Resolve dependências cruzadas entre talentos:
//      Talento 1: +1 Defesa a cada 50 Mana
//      Talento 2: +1 Força a cada 1 Defesa   ← já enxerga a Defesa do T1
//    Itera até convergência (máx 8 rounds) para estabilizar buffs circulares.
//
//  ─ construirStatusAtual(bases, totais, nivel, sanidade): monta o snapshot
//    completo de status (atributos + vidaMax/manaMax) dado um acumulado.
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

// ── Chaves de atributos ───────────────────────────────────
const BUFF_ATTR_KEYS = ['forca','velocidade','inteligencia','defesa','pontaria','carisma','furtividade'];

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
    for (const [key, aliases] of Object.entries(STATUS_DEST_ALIAS)) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => t.includes(a))) return key;
    }
    return null;
}

// ── Resolve nome de fonte → chave interna ────────────────
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
//  construirStatusAtual(bases, totais, nivel, sanidade)
//
//  Monta o snapshot completo de atributos + status derivados
//  a partir dos atributos base + totais acumulados.
//  Retorna um objeto pronto para ser passado como statusLocal
//  ao parsearBuffsDinamicos().
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
        forca:        (bases.forca       || 0) + (totais.forca       || 0),
        velocidade:   (bases.velocidade  || 0) + (totais.velocidade  || 0),
        inteligencia: intTotal,
        defesa:       defTotal,
        pontaria:     (bases.pontaria    || 0) + (totais.pontaria    || 0),
        carisma:      (bases.carisma     || 0) + (totais.carisma     || 0),
        furtividade:  (bases.furtividade || 0) + (totais.furtividade || 0),
        vidaMax,
        manaMax,
        sanidadeMax: 100 + (totais.sanidadeMax || 0),
        // aliases para o parser de fontes
        vida: vidaMax,
        mana: manaMax,
    };
}

// ─────────────────────────────────────────────────────────
//  _zeroTotais() — objeto de totais zerado
// ─────────────────────────────────────────────────────────
function _zeroTotais() {
    return {
        forca: 0, velocidade: 0, inteligencia: 0, defesa: 0,
        pontaria: 0, carisma: 0, furtividade: 0,
        vidaMax: 0, manaMax: 0, sanidadeMax: 0
    };
}

// ─────────────────────────────────────────────────────────
//  _totaliguais(a, b) — verifica convergência de dois totais
// ─────────────────────────────────────────────────────────
function _totaisIguais(a, b) {
    return Object.keys(a).every(k => (a[k] || 0) === (b[k] || 0));
}

// ─────────────────────────────────────────────────────────
//  _calcularBonusFixo(buffsObj, bases) — soma buffs dos campos
//  do painel de talentos (inputs buff-forca-N, buff-defesa-N...)
// ─────────────────────────────────────────────────────────
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
//  Sistema multi-pass: recalcula todos os talentos ativos
//  repetidamente até que os totais parem de mudar.
//  Isso garante que T2 sempre veja o resultado de T1, e vice-versa.
//
//  Parâmetros:
//    talentos — array de objetos { ativo, buffs, desc }
//    bases    — { forca, defesa, ... } atributos base do personagem
//               (já inclui bônus manual dos campos de texto)
//    extras   — { nivel, sanidade } valores auxiliares
//
//  Retorna o objeto de totais final:
//    { forca, velocidade, ..., vidaMax, manaMax, sanidadeMax }
// ─────────────────────────────────────────────────────────
function acumularBuffsDeTalentos(talentos, bases, extras) {
    const MAX_PASSES = 8;
    const nivel    = (extras && extras.nivel)    || 0;
    const sanidade = (extras && extras.sanidade) || 0;

    const ativos = (talentos || []).filter(t => t && t.ativo);
    if (ativos.length === 0) return _zeroTotais();

    let totais = _zeroTotais();

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        // Monta snapshot com o estado atual dos totais
        const statusAtual = construirStatusAtual(bases, totais, nivel, sanidade);
        const novos = _zeroTotais();

        ativos.forEach(t => {
            // 1. Buffs fixos dos campos do painel
            const fixos = _calcularBonusFixo(t.buffs, bases);
            Object.keys(fixos).forEach(k => { novos[k] = (novos[k] || 0) + fixos[k]; });

            // 2. Buffs dinâmicos da descrição textual
            //    usa o statusAtual deste round (inclui buffs acumulados do round anterior)
            const din = parsearBuffsDinamicos(t.desc, { bases, statusLocal: statusAtual });
            Object.keys(novos).forEach(key => {
                if (din[key]) novos[key] += din[key];
            });
        });

        // Convergência: se nada mudou, para
        if (_totaisIguais(totais, novos)) break;
        totais = novos;
    }

    return totais;
}

// ─────────────────────────────────────────────────────────
//  parsearBuffsDinamicos(descricao, opts)
//
//  opts.bases       — { forca: N, defesa: N, ... } bases dos atributos
//  opts.statusLocal — snapshot completo (ideal: vindo de construirStatusAtual)
//  opts.getValorFonte — function(chave) → número (override do padrão)
// ─────────────────────────────────────────────────────────
function parsearBuffsDinamicos(descricao, opts) {
    if (!descricao) return {};
    opts = opts || {};

    const bases      = opts.bases      || {};
    const statusLocal= opts.statusLocal|| {};
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
            case 'forca':        return parseInt(bases.forca        ?? 0);
            case 'velocidade':   return parseInt(bases.velocidade   ?? 0);
            case 'inteligencia': return parseInt(bases.inteligencia ?? 0);
            case 'defesa':       return parseInt(bases.defesa       ?? 0);
            case 'pontaria':     return parseInt(bases.pontaria     ?? 0);
            case 'carisma':      return parseInt(bases.carisma      ?? 0);
            case 'furtividade':  return parseInt(bases.furtividade  ?? 0);
            default: return 0;
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
