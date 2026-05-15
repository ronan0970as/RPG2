// ════════════════════════════════════════════════════════════
//  exportar_importar.js  (v4 — CSV e TXT corrigidos)
//  Exporta e importa fichas RPG em JSON (completo), CSV e TXT
//
//  CORREÇÕES v4:
//  [FIX-CSV-1] importarCSV: normalização robusta de acentos e BOM
//              no cabeçalho e nos nomes de campo.
//  [FIX-CSV-2] importarCSV: aceita CSV gerado pelo baixarTemplateCSV
//              do painel (sem colunas de bônus opcionais).
//  [FIX-CSV-3] importarCSV: feedback de erro mais descritivo,
//              mostrando o cabeçalho recebido vs. esperado.
//  [FIX-TXT-1] importarTXT: nova função que lê o template gerado
//              por baixarTemplateTXT() e salva no Supabase.
//  [FIX-UI-1]  Expõe importarCSV e importarTXT em window._expImp
//              para que o painel principal possa chamá-las.
// ════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── Aguarda DOM pronto ─────────────────────────────────
    function onReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    // ── [FIX-2] Aguarda _supaClient estar disponível ───────
    function aguardarSupa(callback, tentativas) {
        tentativas = tentativas || 0;
        if (window._supaClient) { callback(window._supaClient); return; }
        if (tentativas > 40) { console.error('[exp-imp] _supaClient não encontrado após 4s.'); return; }
        setTimeout(() => aguardarSupa(callback, tentativas + 1), 100);
    }

    // ── Helpers de download ────────────────────────────────
    function baixarArquivo(conteudo, nomeArquivo, tipo) {
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

        if (isIOS) {
            try {
                const base64  = btoa(unescape(encodeURIComponent(conteudo)));
                const mime    = tipo.includes('json') ? 'application/json' : 'text/csv';
                const dataURI = `data:${mime};charset=utf-8;base64,${base64}`;
                const win     = window.open(dataURI, '_blank');
                if (!win) {
                    _baixarViaLinkVisivel(conteudo, nomeArquivo, tipo);
                }
            } catch (err) {
                _baixarViaLinkVisivel(conteudo, nomeArquivo, tipo);
            }
            return;
        }

        const blob = new Blob([conteudo], { type: tipo });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href          = url;
        a.download      = nomeArquivo;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 2000);
    }

    function _baixarViaLinkVisivel(conteudo, nomeArquivo, tipo) {
        const blob = new Blob([conteudo], { type: tipo });
        const url  = URL.createObjectURL(blob);

        const antigo = document.getElementById('_download-fallback-link');
        if (antigo) antigo.remove();

        const a = document.createElement('a');
        a.id          = '_download-fallback-link';
        a.href        = url;
        a.download    = nomeArquivo;
        a.textContent = `⬇️ Toque aqui para baixar: ${nomeArquivo}`;
        a.style.cssText = [
            'display:block',
            'margin:10px 0',
            'padding:12px 14px',
            'background:rgba(76,175,80,0.15)',
            'border:1px solid #4CAF50',
            'border-radius:6px',
            'color:#4CAF50',
            'font-weight:bold',
            'font-size:13px',
            'text-align:center',
            'text-decoration:none',
            'word-break:break-all',
        ].join(';');

        const toast = document.getElementById('exp-imp-toast');
        if (toast) toast.insertAdjacentElement('afterend', a);
        else document.body.appendChild(a);

        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
    }

    function nomeArquivoSeguro(nome) {
        return (nome || 'ficha').replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '').trim().replace(/\s+/g, '_') || 'ficha';
    }

    // ── Normaliza string: remove BOM, trim, e normaliza unicode ─
    // [FIX-CSV-1] Necessário porque Excel/LibreOffice podem salvar
    // acentos em NFC ou NFD, e o BOM pode persistir em campos.
    function normalizar(str) {
        return String(str || '')
            .replace(/^\uFEFF/, '')   // remove BOM se estiver no campo
            .normalize('NFC')         // padroniza acentos (NFD → NFC)
            .trim();
    }

    // ── Carregar todos os dados da ficha ativa do Supabase ─
    async function carregarDadosCompletos() {
        const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
        if (!fichaId) throw new Error('Nenhuma ficha ativa encontrada.');

        const supa = window._supaClient;
        if (!supa) throw new Error('Cliente Supabase não disponível.');

        const { data: fichaInfo, error: erroFicha } = await supa
            .from('fichas')
            .select('*')
            .eq('id', fichaId)
            .maybeSingle();

        if (erroFicha) throw new Error('Erro ao buscar ficha: ' + erroFicha.message);

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
    //  EXPORTAR CSV
    // ════════════════════════════════════════════════════════
    async function exportarCSV() {
        mostrarLoadingBtn('btn-exp-csv', '⏳ Exportando...');
        try {
            const { fichaInfo, dados } = await carregarDadosCompletos();
            const nomeFich = nomeArquivoSeguro(fichaInfo.nome);
            const data     = new Date().toISOString().slice(0, 10);
            const s        = dados.status || {};

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
            baixarArquivo(linhasParaCSV(linhasStatus), `${nomeFich}_status_${data}.csv`, 'text/csv;charset=utf-8;');

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
            await new Promise(r => setTimeout(r, 600));
            baixarArquivo(linhasParaCSV(linhasTalentos), `${nomeFich}_talentos_${data}.csv`, 'text/csv;charset=utf-8;');

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
            await new Promise(r => setTimeout(r, 600));
            baixarArquivo(linhasParaCSV(linhasInv), `${nomeFich}_inventario_${data}.csv`, 'text/csv;charset=utf-8;');

            mostrarToastExp('✅ 3 arquivos CSV exportados!', '#4CAF50');
        } catch (e) {
            mostrarToastExp('❌ Erro: ' + e.message, '#e74c3c');
        } finally {
            restaurarBtn('btn-exp-csv', '📊 Exportar CSV');
        }
    }

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
        const input  = document.createElement('input');
        input.type   = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            mostrarLoadingBtn('btn-imp-json', '⏳ Importando...');
            try {
                const texto = await file.text();
                const dados = JSON.parse(texto);

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
                if (!confirmou) { restaurarBtn('btn-imp-json', '📂 Importar JSON'); return; }

                const supa = window._supaClient;
                if (!supa) throw new Error('Cliente Supabase não disponível. Recarregue a página.');

                const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
                if (!fichaId) throw new Error('Nenhuma ficha ativa. Selecione uma ficha primeiro.');

                await supa.from('fichas').update({
                    nome:   dados.ficha.nome   || '',
                    classe: dados.ficha.classe || '',
                    genero: dados.ficha.genero || '',
                    img:    dados.ficha.img    || ''
                }).eq('id', fichaId);

                const tipos = ['status', 'talentos', 'inventario'];
                for (const tipo of tipos) {
                    if (dados[tipo] === undefined) continue;
                    const { error } = await supa.from('fichas_dados').upsert({
                        ficha_id: fichaId,
                        tipo,
                        valor: JSON.stringify(dados[tipo])
                    }, { onConflict: 'ficha_id,tipo' });
                    if (error) throw new Error(`Erro ao salvar ${tipo}: ${error.message}`);
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
    //  IMPORTAR CSV — apenas status
    //  [FIX-CSV-1] Normaliza BOM, acentos e espaços extras
    //  [FIX-CSV-2] Aceita template gerado pelo painel (sem bônus)
    //  [FIX-CSV-3] Mensagem de erro descritiva com cabeçalho recebido
    // ════════════════════════════════════════════════════════
    function importarCSV() {
        const input   = document.createElement('input');
        input.type    = 'file';
        // [FIX: accept agora inclui .csv de forma abrangente]
        input.accept  = '.csv,text/csv,text/plain,application/vnd.ms-excel';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            mostrarLoadingBtn('btn-imp-csv', '⏳ Importando...');
            try {
                const texto  = await file.text();

                // [FIX-CSV-1] Remove BOM global e normaliza quebras de linha
                const textoLimpo = texto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const linhas = textoLimpo.split('\n').filter(l => l.trim());

                if (linhas.length < 2) {
                    throw new Error('Arquivo CSV vazio ou com apenas o cabeçalho. Preencha os dados antes de importar.');
                }

                // [FIX-CSV-1] Normaliza o cabeçalho (NFC + trim + remove BOM residual por campo)
                const cabecalho = parsarLinhaCSV(linhas[0]).map(normalizar);

                // [FIX-CSV-3] Mensagem clara com o cabeçalho recebido
                if (cabecalho[0] !== 'Campo' || cabecalho[1] !== 'Valor') {
                    throw new Error(
                        `Cabeçalho inválido. Esperado: "Campo, Valor"\n` +
                        `Recebido: "${cabecalho.join(', ')}"\n\n` +
                        `Use apenas o CSV de Status gerado por esta aplicação ou pelo template de importação.\n` +
                        `CSVs de Talentos e Inventário não podem ser importados por aqui.`
                    );
                }

                // Monta mapa Campo → Valor (normaliza chave)
                const mapa = {};
                linhas.slice(1).forEach(linha => {
                    const partes = parsarLinhaCSV(linha);
                    if (partes.length >= 2) {
                        const chave = normalizar(partes[0]);
                        const valor = normalizar(partes[1]);
                        mapa[chave] = valor;
                    }
                });

                // [FIX-CSV-2] Mapeamento completo: campo CSV → chave JS
                // Inclui todas as variantes do template + exportação com bônus
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

                const supa = window._supaClient;
                if (!supa) throw new Error('Cliente Supabase não disponível. Recarregue a página.');

                const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
                if (!fichaId) throw new Error('Nenhuma ficha ativa.');

                // Carrega status atual para fazer merge (não sobrescreve campos ausentes)
                const { data: atual } = await supa
                    .from('fichas_dados')
                    .select('valor')
                    .eq('ficha_id', fichaId)
                    .eq('tipo', 'status')
                    .maybeSingle();

                let statusAtual = {};
                try { statusAtual = JSON.parse(atual?.valor || '{}'); } catch(e) {}

                // Aplica cada campo mapeado ao status
                Object.entries(CAMPO_PARA_CHAVE).forEach(([campo, chave]) => {
                    // [FIX-CSV-1] Normaliza a chave do mapa antes de buscar
                    const valorCSV = mapa[normalizar(campo)];
                    if (valorCSV !== undefined && valorCSV !== '') {
                        statusAtual[chave] = valorCSV;
                    }
                });

                // Atualiza tabela fichas (nome, classe, gênero)
                const updates = {};
                if (mapa['Nome'])    updates.nome   = mapa['Nome'];
                if (mapa['Classe'])  updates.classe = mapa['Classe'];
                if (mapa['Gênero']) updates.genero  = mapa['Gênero'];
                // Fallback sem acento (caso Excel remova)
                if (!updates.genero && mapa['Genero']) updates.genero = mapa['Genero'];

                if (Object.keys(updates).length > 0) {
                    const { error: erroFicha } = await supa.from('fichas').update(updates).eq('id', fichaId);
                    if (erroFicha) throw new Error('Erro ao atualizar dados da ficha: ' + erroFicha.message);
                }

                const { error: erroUpsert } = await supa.from('fichas_dados').upsert({
                    ficha_id: fichaId,
                    tipo: 'status',
                    valor: JSON.stringify(statusAtual)
                }, { onConflict: 'ficha_id,tipo' });

                if (erroUpsert) throw new Error('Erro ao salvar status: ' + erroUpsert.message);

                mostrarToastExp('✅ Status importado via CSV! Recarregando...', '#4CAF50');
                setTimeout(() => window.location.reload(), 1500);

            } catch (e) {
                mostrarToastExp('❌ ' + e.message, '#e74c3c');
            } finally {
                restaurarBtn('btn-imp-csv', '📋 Importar CSV');
            }
        };
        input.click();
    }

    // ════════════════════════════════════════════════════════
    //  IMPORTAR TXT — campos básicos da ficha
    //  [FIX-TXT-1] Nova função: lê o template gerado por
    //  baixarTemplateTXT() e salva nas tabelas fichas e fichas_dados
    //
    //  Formato esperado (cada linha):
    //    Chave: Valor
    //  Linhas que comecem com "=" ou "Preencha" são ignoradas.
    // ════════════════════════════════════════════════════════
    function importarTXT() {
        const input  = document.createElement('input');
        input.type   = 'file';
        // [FIX: accept abrangente para .txt em todos os SOs]
        input.accept = '.txt,text/plain';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Verifica extensão explicitamente (Windows às vezes ignora accept)
            if (!file.name.toLowerCase().endsWith('.txt')) {
                mostrarToastExp('❌ Selecione um arquivo .txt válido.', '#e74c3c');
                return;
            }

            mostrarLoadingBtn('btn-imp-txt', '⏳ Importando...');
            try {
                const texto = await file.text();

                // Remove BOM e normaliza quebras de linha
                const textoLimpo = texto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const linhas = textoLimpo.split('\n');

                // Mapa de campos TXT → objeto de dados
                const mapa = {};
                linhas.forEach(linha => {
                    linha = linha.trim();
                    // Ignora linhas de cabeçalho/comentário
                    if (!linha || linha.startsWith('=') || linha.startsWith('Preencha')) return;

                    // Formato: "Chave: Valor" — divide apenas no primeiro ":"
                    const idx = linha.indexOf(':');
                    if (idx === -1) return;

                    const chave = normalizar(linha.slice(0, idx));
                    const valor = normalizar(linha.slice(idx + 1));
                    if (chave) mapa[chave] = valor;
                });

                if (Object.keys(mapa).length === 0) {
                    throw new Error('Nenhum campo encontrado no arquivo TXT. Verifique se o formato é "Campo: Valor" em cada linha.');
                }

                // Mapeamento: rótulo TXT → chave JS do status
                const CAMPO_PARA_CHAVE_TXT = {
                    'Jogador':               'jogador',
                    'Personagem':            'personagem',
                    'Raça':                  'raca',
                    'Idade':                 'idade',
                    'Nível':                 'nivel',
                    'Vida Atual':            'vidaAtual',
                    'Mana Atual':            'manaAtual',
                    'Sanidade':              'sanAtual',
                    'Força Base':            'forcaBase',
                    'Velocidade Base':       'velBase',
                    'Inteligência Base':     'intBase',
                    'Defesa Base':           'defBase',
                    'Pontaria Base':         'pontBase',
                    'Carisma Base':          'carBase',
                    'Furtividade Base':      'furtBase',
                    'Habilidades Ativas':    'habilidades',
                };

                const supa = window._supaClient;
                if (!supa) throw new Error('Cliente Supabase não disponível. Recarregue a página.');

                const fichaId = typeof getFichaId === 'function' ? getFichaId() : null;
                if (!fichaId) throw new Error('Nenhuma ficha ativa. Selecione uma ficha primeiro.');

                // Carrega status atual para fazer merge
                const { data: atual } = await supa
                    .from('fichas_dados')
                    .select('valor')
                    .eq('ficha_id', fichaId)
                    .eq('tipo', 'status')
                    .maybeSingle();

                let statusAtual = {};
                try { statusAtual = JSON.parse(atual?.valor || '{}'); } catch(err) {}

                // Aplica campos de status mapeados
                Object.entries(CAMPO_PARA_CHAVE_TXT).forEach(([campo, chave]) => {
                    const valor = mapa[normalizar(campo)];
                    if (valor !== undefined && valor !== '') {
                        statusAtual[chave] = valor;
                    }
                });

                // Atualiza tabela fichas com campos de identificação
                const updates = {};
                if (mapa['Nome'])    updates.nome   = mapa['Nome'];
                if (mapa['Classe'])  updates.classe = mapa['Classe'];
                if (mapa['Gênero']) updates.genero  = mapa['Gênero'];
                if (!updates.genero && mapa['Genero']) updates.genero = mapa['Genero'];

                if (Object.keys(updates).length > 0) {
                    const { error: erroFicha } = await supa.from('fichas').update(updates).eq('id', fichaId);
                    if (erroFicha) throw new Error('Erro ao atualizar dados da ficha: ' + erroFicha.message);
                }

                // Salva status via upsert
                const { error: erroUpsert } = await supa.from('fichas_dados').upsert({
                    ficha_id: fichaId,
                    tipo: 'status',
                    valor: JSON.stringify(statusAtual)
                }, { onConflict: 'ficha_id,tipo' });

                if (erroUpsert) throw new Error('Erro ao salvar status: ' + erroUpsert.message);

                const nomeFicha = mapa['Nome'] || mapa['Personagem'] || 'a ficha';
                mostrarToastExp(`✅ "${nomeFicha}" importada via TXT! Recarregando...`, '#4CAF50');
                setTimeout(() => window.location.reload(), 1500);

            } catch (e) {
                mostrarToastExp('❌ ' + e.message, '#e74c3c');
            } finally {
                restaurarBtn('btn-imp-txt', '📄 Importar TXT');
            }
        };
        input.click();
    }

    // ── Parser simples de linha CSV (RFC 4180) ─────────────
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

        const isPainelFichas = !!document.querySelector('.grid-personagens, #gridPersonagens');

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
                    -webkit-backdrop-filter: blur(6px);
                    box-sizing: border-box;
                }
                .rpg-window #exp-imp-painel {
                    max-width: none;
                    margin-left: 0;
                    margin-right: 0;
                }
                .exp-imp-titulo {
                    font-family: var(--font-heading, serif);
                    color: var(--gold-light, #f5d06e);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
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
                    min-width: 0;
                    min-height: 40px;
                    padding: 8px 10px;
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
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
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
                    line-height: 1.45;
                }
                .exp-imp-nota strong {
                    color: var(--gold, #d4a943);
                }
                #exp-imp-toast {
                    display: none;
                    margin-top: 10px;
                    padding: 8px 12px;
                    border-radius: 5px;
                    font-size: 13px;
                    font-weight: bold;
                    word-break: break-word;
                    white-space: pre-line;
                }
                @media (max-width: 750px) {
                    #exp-imp-painel { margin-left: 0; margin-right: 0; padding: 10px 12px; }
                }
                @media (max-width: 520px) {
                    #exp-imp-painel { padding: 10px; border-radius: 4px; }
                    .exp-imp-grid { grid-template-columns: 1fr; gap: 8px; }
                    .exp-imp-btn { font-size: 10px; min-height: 38px; padding: 7px 8px; }
                    .exp-imp-nota { font-size: 10px; }
                }
                @media (max-width: 360px) {
                    .exp-imp-btn { font-size: 9px; letter-spacing: 0.4px; }
                }
            </style>

            <div class="exp-imp-titulo">💾 Exportar / Importar Ficha</div>

            <div class="exp-imp-grid">

                <!-- Exportar -->
                <div class="exp-imp-grupo">
                    <div class="exp-imp-grupo-titulo">📤 Exportar</div>
                    <div class="exp-imp-btns">
                        <button id="btn-exp-json" class="exp-imp-btn" type="button">
                            📦 Exportar JSON
                        </button>
                        <button id="btn-exp-csv" class="exp-imp-btn" type="button">
                            📊 Exportar CSV
                        </button>
                    </div>
                    <div class="exp-imp-nota">
                        <strong>JSON</strong> — backup completo (status, talentos, inventário, foto).<br>
                        <strong>CSV</strong> — 3 arquivos para Excel/Sheets (sem foto).
                    </div>
                </div>

                <!-- Importar -->
                <div class="exp-imp-grupo">
                    <div class="exp-imp-grupo-titulo">📥 Importar</div>
                    <div class="exp-imp-btns">
                        <button id="btn-imp-json" class="exp-imp-btn" type="button">
                            📂 Importar JSON
                        </button>
                        <button id="btn-imp-csv" class="exp-imp-btn" type="button">
                            📋 Importar CSV
                        </button>
                        <button id="btn-imp-txt" class="exp-imp-btn" type="button">
                            📄 Importar TXT
                        </button>
                    </div>
                    <div class="exp-imp-nota">
                        <strong>JSON</strong> — restaura tudo (substitui ficha atual).<br>
                        <strong>CSV</strong> — importa o arquivo de <em>status</em>.<br>
                        <strong>TXT</strong> — importa o template <em>.txt</em> preenchido.
                    </div>
                </div>

            </div>

            <div id="exp-imp-toast"></div>
        `;

        painel.querySelector('#btn-exp-json').addEventListener('click', exportarJSON);
        painel.querySelector('#btn-exp-csv').addEventListener('click', exportarCSV);
        painel.querySelector('#btn-imp-json').addEventListener('click', importarJSON);
        painel.querySelector('#btn-imp-csv').addEventListener('click', importarCSV);
        painel.querySelector('#btn-imp-txt').addEventListener('click', importarTXT);

        _injetarPainelNoDOM(painel, isPainelFichas);
    }

    // ── [FIX-1] Injeção inteligente com retry ─────────────
    function _injetarPainelNoDOM(painel, isPainelFichas) {
        const rpgWindow = document.querySelector('.rpg-window');
        if (rpgWindow) {
            const saveBtn = rpgWindow.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.insertAdjacentElement('beforebegin', painel);
            } else {
                rpgWindow.appendChild(painel);
            }
            return;
        }

        if (isPainelFichas) {
            const ambientPanel = document.querySelector('.ui-ambient-panel');
            if (ambientPanel) {
                ambientPanel.insertAdjacentElement('afterend', painel);
                return;
            }
            const grid = document.querySelector('#gridPersonagens, .grid-personagens');
            if (grid) {
                grid.insertAdjacentElement('beforebegin', painel);
                return;
            }
        }

        const ambientPanel = document.querySelector('.ui-ambient-panel');
        if (ambientPanel) {
            ambientPanel.insertAdjacentElement('afterend', painel);
        } else {
            document.body.appendChild(painel);
        }
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
        toast.textContent        = msg;
        toast.style.display      = 'block';
        toast.style.background   = cor === '#4CAF50' ? 'rgba(76,175,80,0.12)' : 'rgba(231,76,60,0.12)';
        toast.style.border       = `1px solid ${cor}`;
        toast.style.color        = cor;
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 8000);
    }

    // ── [FIX-UI-1] Expõe funções globalmente ──────────────
    // importarTXT agora faz parte da API pública do módulo
    window._expImp = { exportarJSON, exportarCSV, importarJSON, importarCSV, importarTXT };

    // ── Inicia após DOM ────────────────────────────────────
    onReady(() => {
        requestAnimationFrame(() => {
            setTimeout(injetarPainel, 80);
        });
    });

})();
