// ════════════════════════════════════════════════════════════
//  buffs.js — Parser de Buffs Dinâmicos v5
//  Fonte única de verdade para java.js e talentos.html.
//
//  NOVIDADES v5:
//  • Suporte completo a valores NEGATIVOS ( -x )
//  • calcularTodosBuffs(): cálculo ITERATIVO — o resultado
//    de cada talento alimenta o contexto do próximo, então
//    "+1 Força a cada 50 de Mana" de um talento enxerga a
//    Mana Máxima já aumentada por talentos anteriores.
//
//  FORMATOS aceitos (todos suportam + e -):
//
//  Simples      → ±N Força | ±N de Vida Máxima | (±N Mana Max)
//  Condicional  → ±N Força a cada 50 Mana
//                 ±10 Mana Máxima a cada 1 Inteligência
//                 ±50 Vida Máxima a cada 1 Defesa
//                 (±1 a cada 50 Mana)  ← todos os atributos
//  Percentual   → ±10% Velocidade | ±5% vida máxima
//  Por nível    → ±2 Defesa por nível | ±50 Vida Máx por nível
//  Todos        → ±1 em todos | ±1 em tudo
//
//  RETORNO de parsearBuffsDinamicos():
//    { forca, velocidade, inteligencia, defesa, pontaria,
//      carisma, furtividade, vidaMax, manaMax, sanidadeMax }
// ════════════════════════════════════════════════════════════

function _norm(txt) {
    return String(txt).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const BUFF_ALIAS = {
    forca:        ['forca','dano fisico','ataque fisico','dano','str'],
    velocidade:   ['velocidade','agilidade','spd'],
    inteligencia: ['inteligencia','intel','magia','poder magico','int'],
    defesa:       ['defesa','armadura','resistencia','def'],
    pontaria:     ['pontaria','precisao','mira','pont'],
    carisma:      ['carisma','persuasao','lideranca','car'],
    furtividade:  ['furtividade','furtivo','stealth','sombra','furt']
};

const STATUS_DEST_ALIAS = {
    vidaMax:     ['vida maxima','vida max','hp maximo','hp max','vida total'],
    manaMax:     ['mana maxima','mana max','mp maximo','mp max','mana total'],
    sanidadeMax: ['sanidade maxima','sanidade max','san max']
};

const FONTE_ALIAS = {
    mana:         ['mana maxima','mana max','mana','mp'],
    vida:         ['vida maxima','vida max','vida','hp'],
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

function resolverAtributo(txt) {
    if (!txt) return null;
    const t = _norm(txt).replace(/[).,!:;]/g, '').trim();
    for (const [key, aliases] of Object.entries(BUFF_ALIAS)) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => {
            const re = new RegExp('(?:^|\\s)' + a.replace(/\s+/g, '\\s+') + '(?:\\s|$)');
            return re.test(t) || t === a;
        })) return key;
    }
    return null;
}

function resolverStatusDestino(txt) {
    if (!txt) return null;
    const t = _norm(txt).replace(/[).,!:;]/g, '').trim();
    for (const [key, aliases] of Object.entries(STATUS_DEST_ALIAS)) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => t.includes(a))) return key;
    }
    return null;
}

function resolverFonte(txt) {
    if (!txt) return null;
    const t = _norm(txt).replace(/[).,!:;]/g, '').trim();
    const entries = Object.entries(FONTE_ALIAS).sort((a, b) =>
        Math.max(...b[1].map(x => x.length)) - Math.max(...a[1].map(x => x.length))
    );
    for (const [key, aliases] of entries) {
        const sorted = [...aliases].sort((a, b) => b.length - a.length);
        if (sorted.some(a => {
            const re = new RegExp('(?:^|\\s)' + a.replace(/\s+/g, '\\s+') + '(?:\\s|$)');
            return re.test(t) || t === a || t.includes(a);
        })) return key;
    }
    return null;
}

// ─────────────────────────────────────────────────────────
//  parsearBuffsDinamicos(descricao, opts)
//
//  opts.bases       — { forca, defesa, ... } bases dos atributos
//  opts.statusLocal — contexto acumulado { manaMax, vidaMax,
//                     nivel, sanidade, forca, ... }
//  opts.getValorFonte — override function(chave) → número
// ─────────────────────────────────────────────────────────
function parsearBuffsDinamicos(descricao, opts) {
    if (!descricao) return {};
    const { bases = {}, statusLocal = {}, getValorFonte } = (opts || {});

    function _getFonte(chave) {
        if (typeof getValorFonte === 'function') {
            const v = getValorFonte(chave);
            if (v !== undefined && v !== null) return Number(v) || 0;
        }
        if (statusLocal[chave] !== undefined) return Number(statusLocal[chave]) || 0;
        switch (chave) {
            case 'mana': case 'manaMax':
                return statusLocal.manaMax
                    || parseInt(document.getElementById?.('mana-maxima')?.textContent) || 0;
            case 'vida': case 'vidaMax':
                return statusLocal.vidaMax
                    || parseInt(document.getElementById?.('vida-maxima')?.textContent) || 0;
            case 'sanidade': case 'sanidadeMax':
                return statusLocal.sanidade
                    || parseInt(document.getElementById?.('sanidade-atual')?.value) || 0;
            case 'nivel':
                return statusLocal.nivel
                    || parseInt(document.getElementById?.('nivel')?.value) || 0;
            case 'forca':        return parseInt(statusLocal.forca        ?? bases.forca        ?? 0);
            case 'velocidade':   return parseInt(statusLocal.velocidade   ?? bases.velocidade   ?? 0);
            case 'inteligencia': return parseInt(statusLocal.inteligencia ?? bases.inteligencia ?? 0);
            case 'defesa':       return parseInt(statusLocal.defesa       ?? bases.defesa       ?? 0);
            case 'pontaria':     return parseInt(statusLocal.pontaria     ?? bases.pontaria     ?? 0);
            case 'carisma':      return parseInt(statusLocal.carisma      ?? bases.carisma      ?? 0);
            case 'furtividade':  return parseInt(statusLocal.furtividade  ?? bases.furtividade  ?? 0);
            default: return 0;
        }
    }

    const buffs = {};
    const ATTR_KEYS = Object.keys(BUFF_ALIAS);

    function add(key, val) {
        if (!key || isNaN(val) || val === 0) return;
        buffs[key] = (buffs[key] || 0) + val;
    }
    function addTodos(val) { ATTR_KEYS.forEach(k => add(k, val)); }

    // Tokeniza capturando sinal + e - explicitamente
    const texto  = _norm(descricao);
    const tokens = [];
    const rgx    = /\(\s*([+-])\s*(\d[^)]*)\)|(?<![a-z\d])([+-])\s*(\d[^\n]*?)(?=\s*[+-]|\s*\(|$)/g;
    let m;
    while ((m = rgx.exec(texto)) !== null) {
        if (m[1] !== undefined) {
            // grupo entre parênteses: (±N ...)
            tokens.push({ sinal: m[1] === '-' ? -1 : 1, corpo: m[2].trim() });
        } else {
            // grupo fora de parênteses: ±N ...
            tokens.push({ sinal: m[3] === '-' ? -1 : 1, corpo: m[4].trim() });
        }
    }

    for (const { sinal, corpo } of tokens) {

        // 1. ±N em tudo/todos
        if (/^(\d+(?:[.,]\d+)?)\s*(?:em\s+)?(?:tudo|todos)/.test(corpo)) {
            addTodos(parseFloat(corpo.replace(',', '.')) * sinal);
            continue;
        }

        // 2. ±N [de/em] DESTINO a cada X [de] FONTE
        const mAC = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]*?)\s*a cada\s+(\d+(?:[.,]\d+)?)\s*(?:de\s+)?([a-z ]+)/.exec(corpo);
        if (mAC) {
            const bonusPorX = parseFloat(mAC[1].replace(',', '.')) * sinal;
            const destTxt   = mAC[2].trim();
            const divisor   = parseFloat(mAC[3].replace(',', '.'));
            const fonteKey  = resolverFonte(mAC[4].trim());
            if (divisor > 0 && fonteKey) {
                const bonus = Math.floor(_getFonte(fonteKey) / divisor) * bonusPorX;
                if (!destTxt || /^(tudo|todos)$/.test(destTxt)) addTodos(bonus);
                else {
                    const sk = resolverStatusDestino(destTxt);
                    if (sk) add(sk, bonus); else add(resolverAtributo(destTxt), bonus);
                }
            }
            continue;
        }

        // 3. ±N% [de/em] DESTINO
        const mPct = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+|em\s+)?([a-z ]{2,35})/.exec(corpo);
        if (mPct) {
            const pct     = parseFloat(mPct[1].replace(',', '.')) * sinal;
            const destTxt = mPct[2].trim();
            const sk      = resolverStatusDestino(destTxt);
            if (sk) {
                add(sk, Math.round((pct / 100) * _getFonte(sk)));
            } else {
                const ak = resolverAtributo(destTxt);
                if (ak) add(ak, Math.round((pct / 100) * parseInt(bases[ak] ?? statusLocal[ak] ?? 0)));
            }
            continue;
        }

        // 4. ±N [de/em] DESTINO por nível
        const mNiv = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]{2,35}?)\s+por\s+n[ií]vel/.exec(corpo);
        if (mNiv) {
            const bonusNiv = parseFloat(mNiv[1].replace(',', '.')) * sinal;
            const nivel    = _getFonte('nivel');
            const sk       = resolverStatusDestino(mNiv[2].trim());
            if (sk) add(sk, bonusNiv * nivel);
            else    add(resolverAtributo(mNiv[2].trim()), bonusNiv * nivel);
            continue;
        }

        // 5. ±N [de/em] DESTINO (simples)
        const mS = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z][a-z ]{0,30})/.exec(corpo);
        if (mS) {
            const val     = parseFloat(mS[1].replace(',', '.')) * sinal;
            const destTxt = mS[2].trim();
            if (/^(tudo|todos)$/.test(destTxt)) { addTodos(val); continue; }
            const sk = resolverStatusDestino(destTxt);
            if (sk) add(sk, val); else add(resolverAtributo(destTxt), val);
        }
    }

    return buffs;
}

// ─────────────────────────────────────────────────────────
//  calcularTodosBuffs(talentos, basesIniciais, statusInicial)
//
//  Processa talentos de forma ITERATIVA/ACUMULATIVA:
//  o contexto (atributos + vida/mana max) é atualizado
//  após cada talento, então buffs condicionais do talento N
//  enxergam os valores já modificados pelos talentos 1…N-1.
//
//  basesIniciais — { forca, velocidade, inteligencia, defesa,
//                    pontaria, carisma, furtividade }
//                  (base + bônus manuais do campo de texto)
//
//  statusInicial — { manaMax, vidaMax, sanidade, nivel }
//                  calculados das bases iniciais
//
//  Retorna o acumulado total:
//    { forca, velocidade, inteligencia, defesa, pontaria,
//      carisma, furtividade, vidaMax, manaMax, sanidadeMax }
// ─────────────────────────────────────────────────────────
function calcularTodosBuffs(talentos, basesIniciais, statusInicial) {
    const acum = {
        forca: 0, velocidade: 0, inteligencia: 0, defesa: 0,
        pontaria: 0, carisma: 0, furtividade: 0,
        vidaMax: 0, manaMax: 0, sanidadeMax: 0
    };

    const ATTR_KEYS = Object.keys(BUFF_ALIAS);

    for (const talento of talentos) {
        if (!talento.ativo) continue;

        // Contexto acumulado ATÉ AGORA
        const ctxAttr = {};
        ATTR_KEYS.forEach(k => { ctxAttr[k] = (basesIniciais[k] || 0) + (acum[k] || 0); });

        const defAcum = ctxAttr.defesa;
        const intAcum = ctxAttr.inteligencia;

        const ctxStatus = {
            manaMax:  (intAcum * 10) + (acum.manaMax  || 0),
            vidaMax:  50 + (defAcum * 50) + (acum.vidaMax || 0),
            sanidade: statusInicial.sanidade || 0,
            nivel:    statusInicial.nivel    || 0,
            ...ctxAttr
        };

        // Buffs fixos dos campos do painel
        ATTR_KEYS.forEach(k => {
            const valStr = talento.buffs?.[k] || '';
            if (!valStr) return;
            const baseVal = basesIniciais[k] || 0;
            if (valStr.includes('%')) {
                const pct = parseFloat(valStr.replace('%', ''));
                if (!isNaN(pct)) acum[k] += Math.round((pct / 100) * baseVal);
            } else {
                const num = parseInt(valStr);
                if (!isNaN(num)) acum[k] += num;
            }
        });

        // Buffs dinâmicos da descrição
        if (talento.desc) {
            const din = parsearBuffsDinamicos(talento.desc, {
                bases:       ctxAttr,
                statusLocal: ctxStatus
            });
            Object.keys(acum).forEach(key => {
                if (din[key]) acum[key] += din[key];
            });
        }
    }

    return acum;
}
