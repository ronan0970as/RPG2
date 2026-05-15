// ════════════════════════════════════════════════════════════
//  buffs.js — Parser de Buffs Dinâmicos v6
//  Fonte única de verdade para java.js e talentos.html.
//
//  CORREÇÕES v6:
//  [BUG-1] Tokenizador aceita números sem sinal explícito
//          "Concede 5 Força e 10 Mana Máxima" agora funciona
//  [BUG-2] calcularTodosBuffs() captura o contexto DEPOIS
//          de aplicar os buffs fixos do talento atual
//  [BUG-3] _getFonte() unificado: 'mana'/'manaMax' e
//          'vida'/'vidaMax' agora resolvem pela mesma lógica
//  [BUG-4] Regex "a cada" limpa "de/do/da" antes da fonte,
//          evitando que "a cada 1 de Mana Total" falhe
//  [BUG-5] add() não descarta mais val===0 em operações
//          de arredondamento; guarda apenas se != 0 no final
//  [DES-6] _getFonte() não acessa document.getElementById
//          diretamente — usa apenas statusLocal/bases
//  [DES-7] Fórmulas de vidaMax/manaMax centralizadas aqui
//          via FORMULAS_STATUS — java.js deve importar daqui
//  [DES-8] Cache de resultados de resolução de alias
//          (evita recompilar RegExp a cada chamada)
//  [DES-9] Modo debug: buffsDebug(desc, opts) devolve log
//          detalhado de cada token e o que foi resolvido
//
//  FORMATOS aceitos (todos suportam +, - e sem sinal):
//
//  Simples      → [±]N Força | [±]N de Vida Máxima | ([±]N Mana Max)
//  Condicional  → [±]N Força a cada 50 Mana
//                 [±]10 Mana Máxima a cada 1 Inteligência
//                 [±]50 Vida Máxima a cada 1 de Defesa
//                 ([±]1 a cada 50 Mana)  ← todos os atributos
//  Percentual   → [±]10% Velocidade | [±]5% vida máxima
//  Por nível    → [±]2 Defesa por nível | [±]50 Vida Máx por nível
//  Todos        → [±]1 em todos | [±]1 em tudo
//
//  RETORNO de parsearBuffsDinamicos():
//    { forca, velocidade, inteligencia, defesa, pontaria,
//      carisma, furtividade, vidaMax, manaMax, sanidadeMax }
// ════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
//  [DES-7] Fórmulas de status centralizadas
//  java.js deve usar estas funções em vez de hardcodar
// ─────────────────────────────────────────────────────────
const FORMULAS_STATUS = {
    vidaMax:  (defesa)       => 50 + defesa * 50,
    manaMax:  (inteligencia) => inteligencia * 10,
    sanidade: ()             => 100
};

// ─────────────────────────────────────────────────────────
//  Normalização de texto
// ─────────────────────────────────────────────────────────
function _norm(txt) {
    const s = String(txt).toLowerCase();
    try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    catch(e) { return s; } // fallback para navegadores sem suporte a normalize
}

// ─────────────────────────────────────────────────────────
//  Tabelas de alias
// ─────────────────────────────────────────────────────────
const BUFF_ALIAS = {
    forca:        ['forca', 'dano fisico', 'ataque fisico', 'dano', 'str'],
    velocidade:   ['velocidade', 'agilidade', 'spd'],
    inteligencia: ['inteligencia', 'intel', 'magia', 'poder magico', 'int'],
    defesa:       ['defesa', 'armadura', 'resistencia', 'def'],
    pontaria:     ['pontaria', 'precisao', 'mira', 'pont'],
    carisma:      ['carisma', 'persuasao', 'lideranca', 'car'],
    furtividade:  ['furtividade', 'furtivo', 'stealth', 'sombra', 'furt']
};

const STATUS_DEST_ALIAS = {
    vidaMax:     ['vida maxima', 'vida max', 'hp maximo', 'hp max', 'vida total'],
    manaMax:     ['mana maxima', 'mana max', 'mp maximo', 'mp max', 'mana total'],
    sanidadeMax: ['sanidade maxima', 'sanidade max', 'san max']
};

// [BUG-3] FONTE_ALIAS unificado: manaMax e mana apontam para
// a mesma chave canônica 'manaMax'; vida → 'vidaMax'
const FONTE_ALIAS = {
    manaMax:      ['mana maxima', 'mana max', 'mana total', 'mana', 'mp'],
    vidaMax:      ['vida maxima', 'vida max', 'vida total', 'vida', 'hp'],
    sanidade:     ['sanidade', 'san'],
    nivel:        ['nivel', 'level', 'lv', 'lvl'],
    forca:        ['forca', 'str'],
    velocidade:   ['velocidade', 'agilidade', 'spd'],
    inteligencia: ['inteligencia', 'intel', 'magia', 'int'],
    defesa:       ['defesa', 'armadura', 'resistencia', 'def'],
    pontaria:     ['pontaria', 'precisao', 'mira', 'pont'],
    carisma:      ['carisma', 'persuasao', 'lideranca', 'car'],
    furtividade:  ['furtividade', 'furtivo', 'stealth', 'furt']
};

// ─────────────────────────────────────────────────────────
//  [DES-8] Cache de resolução de alias
//  Evita recompilar RegExps a cada chamada do parser
// ─────────────────────────────────────────────────────────
const _cacheAtrib  = new Map();
const _cacheDest   = new Map();
const _cacheFonte  = new Map();

function _buildMatcher(aliases) {
    // Ordena do mais longo para o mais curto (evita match parcial)
    return [...aliases]
        .sort((a, b) => b.length - a.length)
        .map(a => ({
            str: a,
            re:  new RegExp('(?:^|\\s)' + a.replace(/\s+/g, '\\s+') + '(?:\\s|$)')
        }));
}

// Pré-compila matchers uma única vez
const _matchersAtrib = Object.fromEntries(
    Object.entries(BUFF_ALIAS).map(([k, v]) => [k, _buildMatcher(v)])
);
const _matchersDest = Object.fromEntries(
    Object.entries(STATUS_DEST_ALIAS).map(([k, v]) => [k, _buildMatcher(v)])
);
const _matchersFonte = Object.entries(FONTE_ALIAS)
    .sort((a, b) =>
        Math.max(...b[1].map(x => x.length)) - Math.max(...a[1].map(x => x.length))
    )
    .map(([k, v]) => [k, _buildMatcher(v)]);

function resolverAtributo(txt) {
    if (!txt) return null;
    const t = _norm(txt).replace(/[).,!:;]/g, '').trim();
    if (_cacheAtrib.has(t)) return _cacheAtrib.get(t);
    let resultado = null;
    for (const [key, matchers] of Object.entries(_matchersAtrib)) {
        if (matchers.some(({ re, str }) => re.test(t) || t === str)) {
            resultado = key; break;
        }
    }
    _cacheAtrib.set(t, resultado);
    return resultado;
}

function resolverStatusDestino(txt) {
    if (!txt) return null;
    const t = _norm(txt).replace(/[).,!:;]/g, '').trim();
    if (_cacheDest.has(t)) return _cacheDest.get(t);
    let resultado = null;
    for (const [key, matchers] of Object.entries(_matchersDest)) {
        if (matchers.some(({ str }) => t.includes(str))) {
            resultado = key; break;
        }
    }
    _cacheDest.set(t, resultado);
    return resultado;
}

function resolverFonte(txt) {
    if (!txt) return null;
    const t = _norm(txt).replace(/[).,!:;]/g, '').trim();
    if (_cacheFonte.has(t)) return _cacheFonte.get(t);
    let resultado = null;
    for (const [key, matchers] of _matchersFonte) {
        if (matchers.some(({ re, str }) => re.test(t) || t === str || t.includes(str))) {
            resultado = key; break;
        }
    }
    _cacheFonte.set(t, resultado);
    return resultado;
}

// ─────────────────────────────────────────────────────────
//  Tokenizador
//
//  [BUG-1] Agora aceita tokens SEM sinal explícito.
//  Estratégia: divide o texto em trechos separados por
//  vírgula, ponto-e-vírgula, "e ", "ou " e quebras de linha,
//  depois extrai números de cada trecho individualmente.
//  Tokens com sinal explícito (+ / -) mantêm prioridade.
// ─────────────────────────────────────────────────────────
function _tokenizar(texto) {
    const tokens = [];
    const norm   = _norm(texto);

    // Passo 1: extrai tokens com sinal explícito (comportamento original)
    // — captura (±N ...) e ±N ... fora de parênteses
    const rgxExplicito = /\(\s*([+-])\s*(\d[^)]*)\)|(?<![a-z\d])([+-])\s*(\d[^\n]*?)(?=\s*[+-]|\s*\(|$)/g;
    const posicoesCom  = new Set();
    let m;

    while ((m = rgxExplicito.exec(norm)) !== null) {
        if (m[1] !== undefined) {
            tokens.push({ sinal: m[1] === '-' ? -1 : 1, corpo: m[2].trim(), pos: m.index });
        } else {
            tokens.push({ sinal: m[3] === '-' ? -1 : 1, corpo: m[4].trim(), pos: m.index });
        }
        // Marca o intervalo como "já coberto"
        for (let i = m.index; i < m.index + m[0].length; i++) posicoesCom.add(i);
    }

    // Passo 2: [BUG-1] busca números SEM sinal em trechos ainda não cobertos
    // Divide por separadores naturais de lista
    const separadores = /[,;\n]|\be\b|\bou\b/g;
    const partes = [];
    let ultimo = 0;
    let sep;
    while ((sep = separadores.exec(norm)) !== null) {
        partes.push({ txt: norm.slice(ultimo, sep.index), ini: ultimo });
        ultimo = sep.index + sep[0].length;
    }
    partes.push({ txt: norm.slice(ultimo), ini: ultimo });

    const rgxSemSinal = /(?<![a-z\d+-])(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?[a-z]/g;
    for (const { txt, ini } of partes) {
        let ms;
        while ((ms = rgxSemSinal.exec(txt)) !== null) {
            const posAbsoluta = ini + ms.index;
            // Só adiciona se a posição NÃO foi coberta pelo passo 1
            if (!posicoesCom.has(posAbsoluta)) {
                tokens.push({ sinal: 1, corpo: txt.slice(ms.index).trim(), pos: posAbsoluta, semSinal: true });
            }
        }
    }

    // Ordena por posição para manter a ordem original do texto
    tokens.sort((a, b) => (a.pos || 0) - (b.pos || 0));
    return tokens;
}

// ─────────────────────────────────────────────────────────
//  parsearBuffsDinamicos(descricao, opts)
//
//  opts.bases        — { forca, defesa, ... } bases dos atributos
//  opts.statusLocal  — contexto acumulado { manaMax, vidaMax,
//                      nivel, sanidade, forca, ... }
//  opts.getValorFonte — override function(chave) → número
//  opts._debug       — se true, devolve { buffs, log[] }
// ─────────────────────────────────────────────────────────
function parsearBuffsDinamicos(descricao, opts) {
    if (!descricao) return {};
    const { bases = {}, statusLocal = {}, getValorFonte, _debug = false } = (opts || {});
    const log = [];

    // [DES-6] _getFonte() usa APENAS statusLocal/bases — sem acesso ao DOM
    // [BUG-3] Chaves canônicas unificadas: manaMax, vidaMax
    function _getFonte(chave) {
        if (typeof getValorFonte === 'function') {
            const v = getValorFonte(chave);
            if (v !== undefined && v !== null) return Number(v) || 0;
        }
        if (statusLocal[chave] !== undefined) return Number(statusLocal[chave]) || 0;
        switch (chave) {
            // [BUG-3] Ambas as variantes resolvem para manaMax/vidaMax do contexto
            case 'manaMax':
                return Number(statusLocal.manaMax ?? 0);
            case 'vidaMax':
                return Number(statusLocal.vidaMax ?? 0);
            case 'sanidade':
                return Number(statusLocal.sanidade ?? 0);
            case 'nivel':
                return Number(statusLocal.nivel ?? 0);
            case 'forca':        return Number(statusLocal.forca        ?? bases.forca        ?? 0);
            case 'velocidade':   return Number(statusLocal.velocidade   ?? bases.velocidade   ?? 0);
            case 'inteligencia': return Number(statusLocal.inteligencia ?? bases.inteligencia ?? 0);
            case 'defesa':       return Number(statusLocal.defesa       ?? bases.defesa       ?? 0);
            case 'pontaria':     return Number(statusLocal.pontaria     ?? bases.pontaria     ?? 0);
            case 'carisma':      return Number(statusLocal.carisma      ?? bases.carisma      ?? 0);
            case 'furtividade':  return Number(statusLocal.furtividade  ?? bases.furtividade  ?? 0);
            default: return 0;
        }
    }

    const buffs    = {};
    const ATTR_KEYS = Object.keys(BUFF_ALIAS);

    // [BUG-5] Acumula normalmente; o filtro val===0 foi removido do add()
    // para não descartar resultados válidos de arredondamento
    function add(key, val) {
        if (!key || isNaN(val)) return;
        buffs[key] = (buffs[key] || 0) + val;
        if (_debug) log.push(`  → add(${key}, ${val})  [acum: ${buffs[key]}]`);
    }
    function addTodos(val) { ATTR_KEYS.forEach(k => add(k, val)); }

    const tokens = _tokenizar(_norm(descricao));

    for (const { sinal, corpo, semSinal } of tokens) {
        if (_debug) log.push(`TOKEN: "${corpo}" sinal=${sinal > 0 ? '+' : '-'}${semSinal ? ' (sem sinal)' : ''}`);

        // ── 1. ±N em tudo/todos ──────────────────────────
        if (/^(\d+(?:[.,]\d+)?)\s*(?:em\s+)?(?:tudo|todos)/.test(corpo)) {
            const val = parseFloat(corpo.replace(',', '.')) * sinal;
            if (_debug) log.push(`  [1] todos → ${val}`);
            addTodos(val);
            continue;
        }

        // ── 2. ±N [de/em] DEST a cada X [de/do/da] FONTE ─
        // [BUG-4] Regex limpa artigos "de/do/da/dos/das" antes da fonte
        const mAC = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]*?)\s*a cada\s+(\d+(?:[.,]\d+)?)\s*(?:d[eoa]s?\s+)?([a-z ]+)/.exec(corpo);
        if (mAC) {
            const bonusPorX = parseFloat(mAC[1].replace(',', '.')) * sinal;
            const destTxt   = mAC[2].trim();
            const divisor   = parseFloat(mAC[3].replace(',', '.'));
            // [BUG-4] Remove artigos residuais da string da fonte antes de resolver
            const fonteTxt  = mAC[4].trim().replace(/^(?:de|do|da|dos|das)\s+/, '');
            const fonteKey  = resolverFonte(fonteTxt);

            if (_debug) log.push(`  [2] condicional: dest="${destTxt}" divisor=${divisor} fonte="${fonteTxt}"→${fonteKey}`);

            if (divisor > 0 && fonteKey) {
                const fonteVal = _getFonte(fonteKey);
                const bonus    = Math.floor(fonteVal / divisor) * bonusPorX;
                if (_debug) log.push(`      fonteVal=${fonteVal} bonus=${bonus}`);
                if (!destTxt || /^(?:tudo|todos)$/.test(destTxt)) addTodos(bonus);
                else {
                    const sk = resolverStatusDestino(destTxt);
                    if (sk) add(sk, bonus);
                    else    add(resolverAtributo(destTxt), bonus);
                }
            } else if (_debug) {
                log.push(`      IGNORADO (divisor=${divisor}, fonteKey=${fonteKey})`);
            }
            continue;
        }

        // ── 3. ±N% [de/em] DEST ──────────────────────────
        const mPct = /^(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+|em\s+)?([a-z ]{2,35})/.exec(corpo);
        if (mPct) {
            const pct     = parseFloat(mPct[1].replace(',', '.')) * sinal;
            const destTxt = mPct[2].trim();
            const sk      = resolverStatusDestino(destTxt);
            if (_debug) log.push(`  [3] pct: ${pct}% dest="${destTxt}"→${sk || resolverAtributo(destTxt)}`);
            if (sk) {
                add(sk, Math.round((pct / 100) * _getFonte(sk)));
            } else {
                const ak = resolverAtributo(destTxt);
                if (ak) add(ak, Math.round((pct / 100) * Number(bases[ak] ?? statusLocal[ak] ?? 0)));
            }
            continue;
        }

        // ── 4. ±N [de/em] DEST por nível ─────────────────
        const mNiv = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z ]{2,35}?)\s+por\s+n[ií]vel/.exec(corpo);
        if (mNiv) {
            const bonusNiv = parseFloat(mNiv[1].replace(',', '.')) * sinal;
            const nivel    = _getFonte('nivel');
            const destTxt  = mNiv[2].trim();
            const sk       = resolverStatusDestino(destTxt);
            if (_debug) log.push(`  [4] porNivel: ${bonusNiv}/nível × nível=${nivel} dest="${destTxt}"→${sk || resolverAtributo(destTxt)}`);
            if (sk) add(sk, bonusNiv * nivel);
            else    add(resolverAtributo(destTxt), bonusNiv * nivel);
            continue;
        }

        // ── 5. ±N [de/em] DEST (simples) ─────────────────
        const mS = /^(\d+(?:[.,]\d+)?)\s*(?:de\s+|em\s+)?([a-z][a-z ]{0,30})/.exec(corpo);
        if (mS) {
            const val     = parseFloat(mS[1].replace(',', '.')) * sinal;
            const destTxt = mS[2].trim();
            if (/^(?:tudo|todos)$/.test(destTxt)) {
                if (_debug) log.push(`  [5] todos → ${val}`);
                addTodos(val); continue;
            }
            const sk = resolverStatusDestino(destTxt);
            const ak = sk ? null : resolverAtributo(destTxt);
            if (_debug) log.push(`  [5] simples: val=${val} dest="${destTxt}"→${sk || ak || 'NÃO RECONHECIDO'}`);
            if (sk) add(sk, val);
            else    add(ak, val);
            continue;
        }

        if (_debug) log.push(`  [?] token não reconhecido`);
    }

    // [BUG-5] Remove chaves com valor zero do resultado final
    // (acumulação interna pode chegar a 0 por buffs negativos — não é erro)
    Object.keys(buffs).forEach(k => { if (buffs[k] === 0) delete buffs[k]; });

    if (_debug) return { buffs, log };
    return buffs;
}

// ─────────────────────────────────────────────────────────
//  [DES-9] Modo debug público
//
//  Uso: buffsDebug("Concede +5 Força e +10 Mana Máxima a cada 1 Intel", {
//           statusLocal: { inteligencia: 8, manaMax: 80 }
//       })
//  Imprime no console e retorna { buffs, log }
// ─────────────────────────────────────────────────────────
function buffsDebug(descricao, opts) {
    const resultado = parsearBuffsDinamicos(descricao, { ...(opts || {}), _debug: true });
    console.group(`[buffs.js DEBUG] "${descricao}"`);
    (resultado.log || []).forEach(l => console.log(l));
    console.log('RESULTADO:', resultado.buffs);
    console.groupEnd();
    return resultado;
}

// ─────────────────────────────────────────────────────────
//  calcularTodosBuffs(talentos, basesIniciais, statusInicial)
//
//  Processa talentos de forma ITERATIVA/ACUMULATIVA:
//  o contexto é atualizado após cada talento, então buffs
//  condicionais do talento N enxergam valores já somados.
//
//  [BUG-2] CORREÇÃO: o contexto (ctxAttr/ctxStatus) é
//  montado ANTES dos buffs fixos e dinâmicos do talento
//  atual, mas os buffs fixos são somados ao acumulador
//  ANTES dos buffs dinâmicos — garantindo que os buffs
//  dinâmicos do mesmo talento enxergam os fixos do mesmo
//  talento. Isso é o comportamento mais intuitivo.
//
//  [DES-7] Fórmulas de vidaMax/manaMax vêm de FORMULAS_STATUS
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

        // ── Passo A: aplica buffs fixos dos campos do painel ──
        // [BUG-2] Feito ANTES de montar o ctxStatus para os dinâmicos,
        // para que o próprio talento veja seus fixos no contexto dinâmico
        const fixosAplicados = {};
        ATTR_KEYS.forEach(k => {
            const valStr = talento.buffs?.[k] || '';
            if (!valStr) return;
            const baseVal = basesIniciais[k] || 0;
            let delta = 0;
            if (valStr.includes('%')) {
                const pct = parseFloat(valStr.replace('%', ''));
                if (!isNaN(pct)) delta = Math.round((pct / 100) * baseVal);
            } else {
                const num = parseInt(valStr);
                if (!isNaN(num)) delta = num;
            }
            if (delta !== 0) {
                acum[k]             += delta;
                fixosAplicados[k]    = delta;
            }
        });

        // ── Passo B: monta contexto com acumulado ATÉ AGORA
        //   (já inclui os fixos do talento atual do passo A)
        const ctxAttr = {};
        ATTR_KEYS.forEach(k => { ctxAttr[k] = (basesIniciais[k] || 0) + (acum[k] || 0); });

        const ctxStatus = {
            // [DES-7] Usa FORMULAS_STATUS — não duplica lógica
            manaMax:  FORMULAS_STATUS.manaMax(ctxAttr.inteligencia)  + (acum.manaMax  || 0),
            vidaMax:  FORMULAS_STATUS.vidaMax(ctxAttr.defesa)        + (acum.vidaMax  || 0),
            sanidade: statusInicial.sanidade || 0,
            nivel:    statusInicial.nivel    || 0,
            ...ctxAttr
        };

        // ── Passo C: buffs dinâmicos da descrição ────────────
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
