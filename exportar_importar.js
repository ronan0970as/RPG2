// ════════════════════════════════════════════════════════════
//  exportar_importar.js
//  Exporta e importa fichas RPG em JSON (completo) e CSV (resumo)
//
//  COMO USAR:
//  Adicione este script nas páginas que quiser o botão:
//  <script src="exportar_importar.js"></script>
//  O painel de exportação/importação é injetado automaticamente.
// ════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── Aguarda DOM pronto ─────────────────────────────────
    function onReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    // ── Helpers de download ────────────────────────────────
    function baixarArquivo(conteudo, nomeArquivo, tipo) {
        const blob = new Blob([conteudo], { type: tipo });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function nomeArquivoSeguro(nome) {
        return (nome || 'ficha').replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '').trim().replace(/\s+/g, '_') || 'ficha';
    }

    // ── Carregar todos os dados da ficha ativa do Supabase ─
    async function carregarDadosCompletos() {
        const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
        if (!fichaId) throw new Error('Nenhuma ficha ativa encontrada.');

        const supa = window._supaClient;

        // Busca dados da ficha (nome, classe, img, genero)
        const { data: fichaInfo, error: erroFicha } = await supa
            .from('fichas')
            .select('*')
            .eq('id', fichaId)
            .maybeSingle();

        if (erroFicha) throw new Error('Erro ao buscar ficha: ' + erroFicha.message);

        // Busca status, talentos e inventário
        const { data: fichasDados, error: erroDados } = await supa
            .from('fichas_dados')
            .select('tipo, valor')
            .eq('ficha_id', fichaId);

        if (erroDados) throw new Error('Erro ao buscar dados: ' + erroDados.message);

        const dados = { status: null, talentos: [], inventario: [] };
        (fichasDados || []).forEach(row => {
            try { dados[row.tipo] = JSON.parse(row.valor); } catch(e) {}
        });

        return { fichaInfo, dados };
    }

    // ════════════════════════════════════════════════════════
    //  EXPORTAR JSON — backup completo fiel
    // ════════════════════════════════════════════════════════
    async function exportarJSON() {
        mostrarLoadingBtn('btn-exp-json', '⏳ Exportando...');
        try {
            const { fichaInfo, dados } = await carregarDadosCompletos();

            const exportado = {
                _versao:      '1.0',
                _exportadoEm: new Date().toISOString(),
                _app:         'Ficha RPG',
                ficha: {
                    nome:   fichaInfo.nome,
                    classe: fichaInfo.classe,
                    genero: fichaInfo.genero,
                    img:    fichaInfo.img || ''
                },
                status:    dados.status    || {},
                talentos:  dados.talentos  || [],
                inventario: dados.inventario || []
            };

            const json     = JSON.stringify(exportado, null, 2);
            const nomeFich = nomeArquivoSeguro(fichaInfo.nome);
            const data     = new Date().toISOString().slice(0, 10);
            baixarArquivo(json, `${nomeFich}_${data}.json`, 'application/json');

            mostrarToastExp('✅ JSON exportado com sucesso!', '#4CAF50');
        } catch (e) {
            mostrarToastExp('❌ Erro: ' + e.message, '#e74c3c');
        } finally {
            restaurarBtn('btn-exp-json', '📦 Exportar JSON');
        }
    }

    // ════════════════════════════════════════════════════════
    //  EXPORTAR CSV — tabela para Excel/Sheets
    //  Gera 3 abas em arquivos separados: status, talentos, inventário
    // ════════════════════════════════════════════════════════
    async function exportarCSV() {
        mostrarLoadingBtn('btn-exp-csv', '⏳ Exportando...');
        try {
            const { fichaInfo, dados } = await carregarDadosCompletos();
            const nomeFich = nomeArquivoSeguro(fichaInfo.nome);
            const data     = new Date().toISOString().slice(0, 10);
            const s        = dados.status || {};

            // ── CSV 1: Status ──────────────────────────────
            const linhasStatus = [
                ['Campo', 'Valor'],
                ['Nome',          fichaInfo.nome   || ''],
                ['Classe',        fichaInfo.classe || ''],
                ['Gênero',        fichaInfo.genero || ''],
                ['Jogador',       s.jogador        || ''],
                ['Personagem',    s.personagem     || ''],
                ['Raça',          s.raca           || ''],
                ['Idade',         s.idade          || ''],
                ['Nível',         s.nivel          || '0'],
                ['Vida Atual',    s.vidaAtual      || '0'],
                ['Mana Atual',    s.manaAtual      || '0'],
                ['Sanidade',      s.sanAtual       || '0'],
                ['Força Base',    s.forcaBase      || '0'],
                ['Força Bônus',   s.forcaBonus     || '0'],
                ['Velocidade Base',  s.velBase     || '0'],
                ['Velocidade Bônus', s.velBonus    || '0'],
                ['Inteligência Base',  s.intBase   || '0'],
                ['Inteligência Bônus', s.intBonus  || '0'],
                ['Defesa Base',   s.defBase        || '0'],
                ['Defesa Bônus',  s.defBonus       || '0'],
                ['Pontaria Base', s.pontBase       || '0'],
                ['Pontaria Bônus',s.pontBonus      || '0'],
                ['Carisma Base',  s.carBase        || '0'],
                ['Carisma Bônus', s.carBonus       || '0'],
                ['Furtividade Base',  s.furtBase   || '0'],
                ['Furtividade Bônus', s.furtBonus  || '0'],
                ['Habilidades Ativas', s.habilidades || ''],
            ];
            baixarArquivo(
                linhasParaCSV(linhasStatus),
                `${nomeFich}_status_${data}.csv`,
                'text/csv;charset=utf-8;'
            );

            // ── CSV 2: Talentos ────────────────────────────
            const talentos = dados.talentos || [];
            const linhasTalentos = [
                ['Nome', 'Categoria', 'Tipo', 'Raça', 'Classe', 'Ativo', 'Descrição',
                 'Buff Força', 'Buff Velocidade', 'Buff Inteligência',
                 'Buff Defesa', 'Buff Pontaria', 'Buff Carisma', 'Buff Furtividade'],
                ...talentos.map(t => [
                    t.nome      || '',
                    t.categoria || 'Talento',
                    t.tipo      || 'Passivo',
                    t.raca      || '',
                    t.classe    || '',
                    t.ativo     ? 'Sim' : 'Não',
                    t.desc      || '',
                    t.buffs?.forca        || '',
                    t.buffs?.velocidade   || '',
                    t.buffs?.inteligencia || '',
                    t.buffs?.defesa       || '',
                    t.buffs?.pontaria     || '',
                    t.buffs?.carisma      || '',
                    t.buffs?.furtividade  || '',
                ])
            ];
            baixarArquivo(
                linhasParaCSV(linhasTalentos),
                `${nomeFich}_talentos_${data}.csv`,
                'text/csv;charset=utf-8;'
            );

            // ── CSV 3: Inventário ──────────────────────────
            const inventario = dados.inventario || [];
            const linhasInv = [
                ['Nome', 'Categoria', 'Quantidade', 'Descrição'],
                ...inventario.map(i => [
                    i.nome       || '',
                    i.categoria  || 'geral',
                    i.quantidade || 1,
                    i.descricao  || '',
                ])
            ];
            baixarArquivo(
                linhasParaCSV(linhasInv),
                `${nomeFich}_inventario_${data}.csv`,
                'text/csv;charset=utf-8;'
            );

            mostrarToastExp('✅ 3 arquivos CSV exportados!', '#4CAF50');
        } catch (e) {
            mostrarToastExp('❌ Erro: ' + e.message, '#e74c3c');
        } finally {
            restaurarBtn('btn-exp-csv', '📊 Exportar CSV');
        }
    }

    // ── Converte array de linhas para string CSV ───────────
    function linhasParaCSV(linhas) {
        return '\uFEFF' + linhas.map(linha =>
            linha.map(celula => {
                const str = String(celula ?? '').replace(/"/g, '""');
                return /[,"\n\r]/.test(str) ? `"${str}"` : str;
            }).join(',')
        ).join('\r\n');
    }

    // ════════════════════════════════════════════════════════
    //  IMPORTAR JSON — restaura ficha completa
    // ════════════════════════════════════════════════════════
    function importarJSON() {
        const input = document.createElement('input');
        input.type  = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            mostrarLoadingBtn('btn-imp-json', '⏳ Importando...');
            try {
                const texto = await file.text();
                const dados = JSON.parse(texto);

                // Validação básica
                if (!dados._app || dados._app !== 'Ficha RPG') {
                    throw new Error('Arquivo inválido. Use um JSON exportado por esta aplicação.');
                }
                if (!dados.ficha || !dados.status) {
                    throw new Error('Arquivo corrompido ou incompleto.');
                }

                const confirmou = confirm(
                    `Importar ficha "${dados.ficha.nome}"?\n\n` +
                    `⚠️ Isso vai SUBSTITUIR todos os dados da ficha atual.\n` +
                    `Exportado em: ${new Date(dados._exportadoEm).toLocaleString('pt-BR')}`
                );
                if (!confirmou) return;

                const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
                if (!fichaId) throw new Error('Nenhuma ficha ativa.');

                const supa = window._supaClient;

                // Atualiza ficha (nome, classe, genero, img)
                await supa.from('fichas').update({
                    nome:   dados.ficha.nome   || '',
                    classe: dados.ficha.classe || '',
                    genero: dados.ficha.genero || '',
                    img:    dados.ficha.img    || ''
                }).eq('id', fichaId);

                // Salva cada tipo de dado
                const tipos = ['status', 'talentos', 'inventario'];
                for (const tipo of tipos) {
                    if (dados[tipo] === undefined) continue;
                    await supa.from('fichas_dados').upsert({
                        ficha_id: fichaId,
                        tipo,
                        valor: JSON.stringify(dados[tipo])
                    }, { onConflict: 'ficha_id,tipo' });
                }

                mostrarToastExp('✅ Ficha importada! Recarregando...', '#4CAF50');
                setTimeout(() => window.location.reload(), 1500);

            } catch (e) {
                mostrarToastExp('❌ Erro ao importar: ' + e.message, '#e74c3c');
            } finally {
                restaurarBtn('btn-imp-json', '📂 Importar JSON');
            }
        };
        input.click();
    }

    // ════════════════════════════════════════════════════════
    //  IMPORTAR CSV — apenas status (CSV é limitado)
    // ════════════════════════════════════════════════════════
    function importarCSV() {
        const input   = document.createElement('input');
        input.type    = 'file';
        input.accept  = '.csv,text/csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            mostrarLoadingBtn('btn-imp-csv', '⏳ Importando...');
            try {
                const texto = await file.text();
                const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());

                // Detecta se é CSV de status (2 colunas: Campo, Valor)
                const cabecalho = linhas[0].split(',').map(c => c.replace(/"/g, '').trim());
                if (cabecalho[0] !== 'Campo' || cabecalho[1] !== 'Valor') {
                    throw new Error(
                        'Use apenas o CSV de Status para importar.\n' +
                        'CSVs de Talentos e Inventário são apenas para visualização no Excel.'
                    );
                }

                // Monta objeto de dados a partir das linhas
                const mapa = {};
                linhas.slice(1).forEach(linha => {
                    const partes = parsarLinhaCSV(linha);
                    if (partes.length >= 2) mapa[partes[0].trim()] = partes[1].trim();
                });

                const CAMPO_PARA_CHAVE = {
                    'Jogador':               'jogador',
                    'Personagem':            'personagem',
                    'Raça':                  'raca',
                    'Idade':                 'idade',
                    'Nível':                 'nivel',
                    'Vida Atual':            'vidaAtual',
                    'Mana Atual':            'manaAtual',
                    'Sanidade':              'sanAtual',
                    'Força Base':            'forcaBase',
                    'Força Bônus':           'forcaBonus',
                    'Velocidade Base':       'velBase',
                    'Velocidade Bônus':      'velBonus',
                    'Inteligência Base':     'intBase',
                    'Inteligência Bônus':    'intBonus',
                    'Defesa Base':           'defBase',
                    'Defesa Bônus':          'defBonus',
                    'Pontaria Base':         'pontBase',
                    'Pontaria Bônus':        'pontBonus',
                    'Carisma Base':          'carBase',
                    'Carisma Bônus':         'carBonus',
                    'Furtividade Base':      'furtBase',
                    'Furtividade Bônus':     'furtBonus',
                    'Habilidades Ativas':    'habilidades',
                };

                // Carrega status atual e mescla com os dados do CSV
                const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
                if (!fichaId) throw new Error('Nenhuma ficha ativa.');

                const supa = window._supaClient;
                const { data: atual } = await supa
                    .from('fichas_dados')
                    .select('valor')
                    .eq('ficha_id', fichaId)
                    .eq('tipo', 'status')
                    .maybeSingle();

                let statusAtual = {};
                try { statusAtual = JSON.parse(atual?.valor || '{}'); } catch(e) {}

                Object.entries(CAMPO_PARA_CHAVE).forEach(([campo, chave]) => {
                    if (mapa[campo] !== undefined) statusAtual[chave] = mapa[campo];
                });

                // Atualiza também nome/classe na tabela fichas se existirem no CSV
                const updates = {};
                if (mapa['Nome'])   updates.nome   = mapa['Nome'];
                if (mapa['Classe']) updates.classe = mapa['Classe'];
                if (mapa['Gênero']) updates.genero = mapa['Gênero'];
                if (Object.keys(updates).length > 0) {
                    await supa.from('fichas').update(updates).eq('id', fichaId);
                }

                await supa.from('fichas_dados').upsert({
                    ficha_id: fichaId,
                    tipo: 'status',
                    valor: JSON.stringify(statusAtual)
                }, { onConflict: 'ficha_id,tipo' });

                mostrarToastExp('✅ Status importado via CSV! Recarregando...', '#4CAF50');
                setTimeout(() => window.location.reload(), 1500);

            } catch (e) {
                mostrarToastExp('❌ Erro: ' + e.message, '#e74c3c');
            } finally {
                restaurarBtn('btn-imp-csv', '📋 Importar CSV');
            }
        };
        input.click();
    }

    // ── Parser simples de linha CSV (respeita aspas) ───────
    function parsarLinhaCSV(linha) {
        const resultado = [];
        let campo = '';
        let dentroAspas = false;
        for (let i = 0; i < linha.length; i++) {
            const c = linha[i];
            if (c === '"') {
                if (dentroAspas && linha[i + 1] === '"') { campo += '"'; i++; }
                else dentroAspas = !dentroAspas;
            } else if (c === ',' && !dentroAspas) {
                resultado.push(campo);
                campo = '';
            } else {
                campo += c;
            }
        }
        resultado.push(campo);
        return resultado;
    }

    // ════════════════════════════════════════════════════════
    //  UI — Painel injetado na página
    // ════════════════════════════════════════════════════════
    function injetarPainel() {
        if (document.getElementById('exp-imp-painel')) return;

        const painel = document.createElement('section');
        painel.id = 'exp-imp-painel';
        painel.innerHTML = `
            <style>
                #exp-imp-painel {
                    width: 100%;
                    max-width: 900px;
                    margin: 0 auto 16px;
                    padding: 12px 14px;
                    background: rgba(10,7,4,0.72);
                    border: 1px solid var(--panel-border, rgba(160,120,40,0.45));
                    border-radius: 6px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.38);
                    backdrop-filter: blur(6px);
                }
                .exp-imp-titulo {
                    font-family: var(--font-heading, serif);
                    color: var(--gold-light, #f5d06e);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }
                .exp-imp-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                .exp-imp-grupo {
                    background: rgba(0,0,0,0.22);
                    border: 1px solid rgba(160,120,40,0.25);
                    border-radius: 6px;
                    padding: 10px;
                }
                .exp-imp-grupo-titulo {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    color: var(--ink-dim, #9a8e6e);
                    margin-bottom: 8px;
                }
                .exp-imp-btns {
                    display: flex;
                    gap: 7px;
                    flex-wrap: wrap;
                }
                .exp-imp-btn {
                    flex: 1;
                    min-height: 38px;
                    padding: 7px 10px;
                    border: 1px solid var(--gold-dark, #a07828);
                    border-radius: 5px;
                    background: rgba(20,16,8,0.78);
                    color: var(--ink, #d4c8a0);
                    cursor: pointer;
                    font-family: var(--font-heading, serif);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.6px;
                    text-transform: uppercase;
                    transition: border-color 0.2s, background 0.2s, color 0.2s;
                    white-space: nowrap;
                }
                .exp-imp-btn:hover {
                    border-color: var(--gold-light, #f5d06e);
                    background: rgba(212,169,67,0.16);
                    color: var(--gold-light, #f5d06e);
                }
                .exp-imp-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .exp-imp-nota {
                    margin-top: 7px;
                    font-size: 11px;
                    color: var(--ink-dim, #9a8e6e);
                    line-height: 1.4;
                }
                #exp-imp-toast {
                    display: none;
                    margin-top: 10px;
                    padding: 8px 12px;
                    border-radius: 5px;
                    font-size: 13px;
                    font-weight: bold;
                }
                @media (max-width: 520px) {
                    .exp-imp-grid { grid-template-columns: 1fr; }
                    .exp-imp-btn { font-size: 10px; }
                }
            </style>

            <div class="exp-imp-titulo">💾 Exportar / Importar Ficha</div>

            <div class="exp-imp-grid">

                <!-- Exportar -->
                <div class="exp-imp-grupo">
                    <div class="exp-imp-grupo-titulo">📤 Exportar</div>
                    <div class="exp-imp-btns">
                        <button id="btn-exp-json" class="exp-imp-btn" onclick="window._expImp.exportarJSON()">
                            📦 Exportar JSON
                        </button>
                        <button id="btn-exp-csv" class="exp-imp-btn" onclick="window._expImp.exportarCSV()">
                            📊 Exportar CSV
                        </button>
                    </div>
                    <div class="exp-imp-nota">
                        <strong style="color:var(--gold,#d4a943)">JSON</strong> — backup completo (status, talentos, inventário, foto).<br>
                        <strong style="color:var(--gold,#d4a943)">CSV</strong> — 3 arquivos para Excel/Sheets (sem foto).
                    </div>
                </div>

                <!-- Importar -->
                <div class="exp-imp-grupo">
                    <div class="exp-imp-grupo-titulo">📥 Importar</div>
                    <div class="exp-imp-btns">
                        <button id="btn-imp-json" class="exp-imp-btn" onclick="window._expImp.importarJSON()">
                            📂 Importar JSON
                        </button>
                        <button id="btn-imp-csv" class="exp-imp-btn" onclick="window._expImp.importarCSV()">
                            📋 Importar CSV
                        </button>
                    </div>
                    <div class="exp-imp-nota">
                        <strong style="color:var(--gold,#d4a943)">JSON</strong> — restaura tudo (substitui ficha atual).<br>
                        <strong style="color:var(--gold,#d4a943)">CSV</strong> — importa apenas o arquivo de <em>status</em>.
                    </div>
                </div>

            </div>

            <div id="exp-imp-toast"></div>
        `;

        // Injeta após o painel de ambiente (ui-ambient-panel) ou no início do rpg-window
        const anchor = document.querySelector('.ui-ambient-panel') || document.querySelector('.rpg-window');
        if (anchor) anchor.insertAdjacentElement('afterend', painel);
        else document.body.appendChild(painel);
    }

    // ── Feedback visual nos botões ─────────────────────────
    function mostrarLoadingBtn(id, texto) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled    = true;
        btn.textContent = texto;
    }

    function restaurarBtn(id, texto) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled    = false;
        btn.textContent = texto;
    }

    function mostrarToastExp(msg, cor) {
        const toast = document.getElementById('exp-imp-toast');
        if (!toast) return;
        toast.textContent   = msg;
        toast.style.display = 'block';
        toast.style.background  = cor === '#4CAF50' ? 'rgba(76,175,80,0.12)' : 'rgba(231,76,60,0.12)';
        toast.style.border      = `1px solid ${cor}`;
        toast.style.color       = cor;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }

    // ── Expõe funções globalmente ──────────────────────────
    window._expImp = { exportarJSON, exportarCSV, importarJSON, importarCSV };

    // ── Inicia ─────────────────────────────────────────────
    onReady(injetarPainel);

})();
