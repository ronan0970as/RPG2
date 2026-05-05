// ════════════════════════════════════════════════════════════
//  buffs.js — Parser de Buffs Dinâmicos Unificado
//  Fonte única de verdade para java.js e talentos.html.
//
//  Detecta QUALQUER forma de escrever um buff na descrição:
//
//  ── Formato simples:
//     +1 Força     +1Força     (+1 Força)    (+1 em Força)
//     +1 de Força  +1 em Força
//     +1 Velocidade / Inteligência / Defesa / Pontaria / Carisma / Furtividade
//     +1 em todos  /  +1 em tudo
//
//  ── Formato condicional  (+N a cada X de STATUS):
//     +1 de força a cada 50 de mana
//     +1 de força a cada 50 mana
//     +1 de força a cada 50 de vida
//     +1 de força a cada 50 de sanidade
//     +1 de todos a cada 50 de mana   ← aplica em todos
//     (+1 a cada 50 de mana)          ← sem atributo = todos
//
//  ── Formato percentual:
//     +10% Velocidade   +10% de Força   +10% em Defesa
//
//  ── Formato por nível:
//     +2 de Defesa por nível
//
//  Funciona com/sem acento, maiúsculas/minúsculas, com/sem parênteses.
// ════════════════════════════════════════════════════════════

// ── Normaliza: remove acentos + minúsculas ────────────────
function _norm(txt) {
    return String(txt).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Tabela de atributos ───────────────────────────────────
const BUFF_ALIAS = {
    forca:        ['forca','dano fisico','ataque fisico','dano'],
    velocidade:   ['velocidade','agilidade'],
    inteligencia: ['inteligencia','intel','magia','poder magico'],
    defesa:       ['defesa','armadura','resistencia'],
    pontaria:     ['pontaria','precisao','mira'],
    carisma:      ['carisma','persuasao','lideranca'],
    furtividade:  ['furtividade','furtivo','stealth','sombra']
};

// ── Tabela de recursos (para "a cada X de RECURSO") ───────
const RECURSO_ALIAS = {
    mana:     ['mana','mp'],
    vida:     ['vida','hp'],
    sanidade: ['sanidade','san'],
    nivel:    ['nivel','level','lv','lvl']
};

// Resolve nome de atributo → chave interna
function resolverAtributo(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    if (!t) return null;

    const exatos = {
        forca:'forca', velocidade:'velocidade',
        inteligencia:'inteligencia', defesa:'defesa',
        pontaria:'pontaria', carisma:'carisma', furtividade:'furtividade'
    };
    for (const [key, alias] of Object.entries(exatos)) {
        if (new RegExp('(?:^|\\W)' + alias + '(?:\\W|$)').test(t)) return key;
    }
    for (const [key, aliases] of Object.entries(BUFF_ALIAS)) {
        if (aliases.some(a => t.includes(a))) return key;
    }
    return null;
}

// Resolve nome de recurso → chave interna
function resolverRecurso(txt) {
    const t = _norm(txt).trim().replace(/[).,!:;]/g, '');
    for (const [key, aliases] of Object.entries(RECURSO_ALIAS)) {
        if (aliases.some(a => {
            const re = new RegExp('(?:^|\\W)' + a + '(?:\\W|$)');
            return re.test(t) || t === a;
        })) return key;
    }
    return null;
}

// ─────────────────────────────────────────────────────────
//  parsearBuffsDinamicos(descricao, opts)
//
//  opts.bases        — { forca: N, ... }  para calcular percentuais e "por nível"
//  opts.statusLocal  — { manaMax, vidaMax, nivel, sanidade }
//  opts.getRecurso   — função(recurso) → valor atual (override do padrão DOM)
//
//  Retorna { forca: N, velocidade: N, ... }
// ─────────────────────────────────────────────────────────
function parsearBuffsDinamicos(descricao, opts = {}) {
    if (!descricao) return {};

    const { bases = {}, statusLocal = {}, getRecurso } = opts;

    // Lê o valor atual de um recurso: tenta o override, depois statusLocal, depois DOM
    function _getValorRecurso(recurso) {
        if (typeof getRecurso === 'function') return getRecurso(recurso) || 0;
        switch (recurso) {
            case 'mana':
                return statusLocal.manaMax
                    || parseInt(document.getElementById?.('mana-maxima')?.textContent)
                    || parseInt(document.getElementById?.('mana-atual')?.value)
                    || 0;
            case 'vida':
                return statusLocal.vidaMax
                    || parseInt(document.getElementById?.('vida-maxima')?.textContent)
                    || parseInt(document.getElementById?.('vida-atual')?.value)
                    || 0;
            case 'sanidade':
                return statusLocal.sanidade
                    || parseInt(document.getElementById?.('sanidade-atual')?.value)
                    || 0;
            case 'nivel':
                return statusLocal.nivel
                    || parseInt(document.getElementById?.('nivel')?.value)
                    || 0;
            default:
                return 0;
        }
    }

    const buffs = {};
    const texto = _norm(descricao);
    const ATTRS = Object.keys(BUFF_ALIAS);

    function add(key, val) {
        if (!key || isNaN(val) || val === 0) return;
        buffs[key] = (buffs[key] || 0) + val;
    }
    function addTodos(val) { ATTRS.forEach(k => add(k, val)); }

    // Tokeniza: cada bloco entre parênteses com + ou após um +
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

        // 2. "N [de/em] ATRIBUTO a cada X [de] RECURSO"
        const mAC = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]*?)\s*a cada\s+(\d+(?:[.,]\d+)?)\s*(?:de\s+)?([a-z]+)/.exec(token);
        if (mAC) {
            const bonusPorX  = parseFloat(mAC[1].replace(',', '.'));
            const attrTxt    = mAC[2].trim();
            const divisor    = parseFloat(mAC[3].replace(',', '.'));
            const recursoKey = resolverRecurso(mAC[4]);
            if (divisor > 0 && recursoKey) {
                const bonus = Math.floor(_getValorRecurso(recursoKey) / divisor) * bonusPorX;
                if (!attrTxt || /^(tudo|todos)$/.test(attrTxt)) addTodos(bonus);
                else add(resolverAtributo(attrTxt), bonus);
            }
            continue;
        }

        // 3. "N% [de/em] ATRIBUTO"
        const mPct = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+|em\s+)?([a-z ]{2,30})/.exec(token);
        if (mPct) {
            const pct = parseFloat(mPct[1].replace(',', '.'));
            const key = resolverAtributo(mPct[2]);
            if (key) {
                const baseVal = parseInt(bases[key] ?? 0);
                add(key, Math.round((pct / 100) * baseVal));
            }
            continue;
        }

        // 4. "N [de/em] ATRIBUTO por nível"
        const mNiv = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]{2,30}?)\s+por\s+n[ií]vel/.exec(token);
        if (mNiv) {
            const key = resolverAtributo(mNiv[2]);
            if (key) {
                const nivel = _getValorRecurso('nivel');
                add(key, parseFloat(mNiv[1].replace(',', '.')) * nivel);
            }
            continue;
        }

        // 5. Formato simples: "N [de/em] ATRIBUTO"
        const mS = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z][a-z ]{0,25})/.exec(token);
        if (mS) {
            const val = parseFloat(mS[1].replace(',', '.'));
            const txt = mS[2].trim();
            if (/^(tudo|todos)$/.test(txt)) { addTodos(val); continue; }
            add(resolverAtributo(txt), val);
        }
    }

    return buffs;
}
