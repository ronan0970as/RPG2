// ════════════════════════════════════════════════════════════
//  painel_de_escolhas_de_fichas.js
//  Fichas salvas por usuário no Supabase (tabela: fichas)
// ════════════════════════════════════════════════════════════

// ── Estado global ──────────────────────────────────────────
let fichas = [];
let categoriaAtual = 'todos';
let fichaContextoId = null;
let imgPreCarregada = '';

// ── Inicialização ──────────────────────────────────────────
window.onload = async () => {
    await carregarFichas();
    renderizar();
    fecharCtxMenuAoClicarFora();
};

// ── Obtém o user_id da sessão ──────────────────────────────
function getUserId() {
    const s = getSessao();
    return s?.id || null;
}

// ── CRUD Supabase ──────────────────────────────────────────
async function carregarFichas() {
    const userId = getUserId();
    if (!userId) return;

    const { data, error } = await window._supaClient
        .from('fichas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erro ao carregar fichas:', error.message);
        fichas = [];
        return;
    }

    // Se for o primeiro acesso, cria uma ficha de exemplo
    if (data.length === 0) {
        await criarFichaSupabase({ nome: 'Ficha 1', classe: 'Guerreiro', img: '' });
        return;
    }

    fichas = data.map(f => ({
        id:     f.id,
        nome:   f.nome,
        classe: f.classe,
        img:    f.img || '',
        genero: f.genero || ''
    }));
}

async function criarFichaSupabase({ nome, classe, img, genero }) {
    const userId = getUserId();
    if (!userId) return;

    const { data, error } = await window._supaClient
        .from('fichas')
        .insert([{ user_id: userId, nome, classe, img, genero: genero || '' }])
        .select()
        .single();

    if (error) { console.error('Erro ao criar ficha:', error.message); return; }

    fichas.push({ id: data.id, nome: data.nome, classe: data.classe, img: data.img || '', genero: data.genero || '' });
    renderizar();
}

async function atualizarFichaSupabase(id, campos) {
    const { error } = await window._supaClient
        .from('fichas')
        .update(campos)
        .eq('id', id);
    if (error) console.error('Erro ao atualizar ficha:', error.message);
}

async function excluirFichaSupabase(id) {
    // Remove dados da ficha (inventário, talentos, status)
    await window._supaClient.from('fichas_dados').delete().eq('ficha_id', id);
    // Remove a ficha
    const { error } = await window._supaClient.from('fichas').delete().eq('id', id);
    if (error) console.error('Erro ao excluir ficha:', error.message);
}

// ── Renderização ───────────────────────────────────────────
function renderizar() {
    const grid = document.getElementById('gridPersonagens');
    const termo = (document.getElementById('inputBusca')?.value || '').toLowerCase();

    const lista = fichas.filter(f => {
        const bateNome     = f.nome.toLowerCase().includes(termo);
        const bateCategoria = categoriaAtual === 'todos' || f.classe === categoriaAtual;
        return bateNome && bateCategoria;
    });

    if (lista.length === 0) {
        grid.innerHTML = `
            <div class="estado-vazio">
                <div class="icone-vazio">📜</div>
                <p>Nenhuma ficha encontrada.</p>
                <small>Crie uma nova ficha com o botão "＋ Criar Ficha".</small>
            </div>`;
        return;
    }

    grid.innerHTML = lista.map(f => {
        const imgHtml = f.img
            ? `<img src="${f.img}" alt="${f.nome}" loading="lazy">`
            : `<div class="card-sem-img">⚔️</div>`;
        const generoIcon = f.genero === 'Masculino' ? '♂' : f.genero === 'Feminino' ? '♀' : f.genero === 'Outro' ? '⚧' : '';
        const generoBadge = generoIcon ? `<span class="card-genero">${generoIcon}</span>` : '';
        return `
            <div class="card-personagem" ondblclick="abrirFicha('${f.id}')" data-id="${f.id}">
                ${imgHtml}
                <div class="nome-overlay">
                    <span class="card-nome">${f.nome} ${generoBadge}</span>
                    <span class="card-classe">${f.classe}</span>
                </div>
                <button class="btn-opcoes" onclick="abrirCtxMenu(event, '${f.id}')" title="Opções">⋯</button>
            </div>`;
    }).join('');
}

// ── Filtros ────────────────────────────────────────────────
function filtrar() { renderizar(); }

function filtrarCategoria(cat) {
    categoriaAtual = cat;
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        const texto = btn.textContent.toLowerCase();
        btn.classList.toggle('active',
            cat === 'todos' ? texto === 'todos' : texto.includes(cat.toLowerCase())
        );
    });
    renderizar();
}

// ── Modal de Criar ─────────────────────────────────────────
function abrirModalCriar() {
    document.getElementById('novo-nome').value     = '';
    document.getElementById('nova-img').value      = '';
    document.getElementById('nova-img-file').value = '';
    imgPreCarregada = '';
    // Reseta gênero
    document.querySelectorAll('#modal-genero-selector .genero-btn').forEach(b => b.classList.remove('ativo'));
    document.getElementById('modalCriar').classList.add('visivel');
    setTimeout(() => document.getElementById('novo-nome').focus(), 100);
}

function fecharModal() {
    document.getElementById('modalCriar').classList.remove('visivel');
}

function fecharModalSeFora(e) {
    if (e.target.id === 'modalCriar') fecharModal();
}

function preCarregarImagem(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas  = document.createElement('canvas');
            const MAX_W   = 300;
            const scale   = MAX_W / img.width;
            canvas.width  = MAX_W;
            canvas.height = img.height * scale;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            imgPreCarregada = canvas.toDataURL('image/jpeg', 0.75);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function criarFicha() {
    const nome = document.getElementById('novo-nome').value.trim();
    if (!nome) { alert('Digite um nome para a ficha!'); return; }

    const imgUrl  = imgPreCarregada || document.getElementById('nova-img').value.trim();
    // Sanitiza: ignora valor de placeholder interno do select
    const classeRaw = document.getElementById('nova-classe').value;
    const classe = (!classeRaw || classeRaw === '__outro__') ? '' : classeRaw;
    const genero  = document.querySelector('#modal-genero-selector .genero-btn.ativo')?.dataset.genero || '';

    fecharModal();
    await criarFichaSupabase({ nome, classe, img: imgUrl, genero });
}

// ── Importar ───────────────────────────────────────────────
// [FIX-UI-1] importarFicha() agora abre um modal de seleção de formato
// em vez de aceitar apenas .json diretamente.
function importarFicha() {
    _abrirModalImportacao();
}

// ── Modal de seleção de formato de importação ──────────────
function _abrirModalImportacao() {
    // Remove modal anterior se existir
    const antigo = document.getElementById('modal-importacao-formato');
    if (antigo) antigo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-importacao-formato';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9990;
        background: rgba(0,0,0,0.72);
        display: flex; align-items: center; justify-content: center;
        padding: 16px; box-sizing: border-box;
    `;

    overlay.innerHTML = `
        <div style="
            background: #0f0c07;
            border: 1px solid rgba(200,170,110,0.45);
            border-radius: 10px;
            padding: 24px 22px;
            max-width: 380px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.7);
            font-family: var(--font-heading, serif);
        ">
            <h3 style="
                margin: 0 0 6px;
                color: #f5d06e;
                font-size: 15px;
                letter-spacing: 1px;
                text-transform: uppercase;
            ">📥 Importar Ficha</h3>
            <p style="
                margin: 0 0 18px;
                font-size: 12px;
                color: #9a8e6e;
                line-height: 1.5;
            ">Escolha o formato do arquivo a importar:</p>

            <div style="display:flex; flex-direction:column; gap:10px;">

                <button id="btn-imp-modal-json" style="
                    background: rgba(200,170,110,0.08);
                    border: 1px solid rgba(200,170,110,0.4);
                    color: #d4c8a0;
                    padding: 12px 14px;
                    border-radius: 7px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: bold;
                    text-align: left;
                    transition: border-color 0.2s, background 0.2s;
                ">
                    📦 <strong style="color:#f5d06e">JSON</strong>
                    <span style="display:block;font-size:11px;color:#9a8e6e;margin-top:2px;font-weight:normal">
                        Backup completo — restaura tudo (status, talentos, inventário)
                    </span>
                </button>

                <button id="btn-imp-modal-csv" style="
                    background: rgba(200,170,110,0.08);
                    border: 1px solid rgba(200,170,110,0.4);
                    color: #d4c8a0;
                    padding: 12px 14px;
                    border-radius: 7px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: bold;
                    text-align: left;
                    transition: border-color 0.2s, background 0.2s;
                ">
                    📋 <strong style="color:#f5d06e">CSV</strong>
                    <span style="display:block;font-size:11px;color:#9a8e6e;margin-top:2px;font-weight:normal">
                        Template de status (.csv) — importa campos de atributos
                    </span>
                </button>

                <button id="btn-imp-modal-txt" style="
                    background: rgba(200,170,110,0.08);
                    border: 1px solid rgba(200,170,110,0.4);
                    color: #d4c8a0;
                    padding: 12px 14px;
                    border-radius: 7px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: bold;
                    text-align: left;
                    transition: border-color 0.2s, background 0.2s;
                ">
                    📄 <strong style="color:#f5d06e">TXT</strong>
                    <span style="display:block;font-size:11px;color:#9a8e6e;margin-top:2px;font-weight:normal">
                        Template preenchido (.txt) — importa campos básicos da ficha
                    </span>
                </button>

            </div>

            <button id="btn-imp-modal-cancelar" style="
                margin-top: 14px;
                width: 100%;
                background: transparent;
                border: 1px solid rgba(200,170,110,0.2);
                color: #9a8e6e;
                padding: 9px;
                border-radius: 6px;
                cursor: pointer;
                font-family: inherit;
                font-size: 12px;
                transition: border-color 0.2s, color 0.2s;
            ">Cancelar</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fecha ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    document.addEventListener('keydown', function _esc(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _esc); }
    });

    // Ações dos botões
    overlay.querySelector('#btn-imp-modal-cancelar').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#btn-imp-modal-json').addEventListener('click', () => {
        overlay.remove();
        _importarFichaJSON();
    });

    overlay.querySelector('#btn-imp-modal-csv').addEventListener('click', () => {
        overlay.remove();
        _importarFichaCSV();
    });

    overlay.querySelector('#btn-imp-modal-txt').addEventListener('click', () => {
        overlay.remove();
        _importarFichaTXT();
    });

    // Hover visual nos botões do modal
    overlay.querySelectorAll('button[id^="btn-imp-modal-"]:not(#btn-imp-modal-cancelar)').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = 'rgba(200,170,110,0.85)';
            btn.style.background  = 'rgba(200,170,110,0.14)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = 'rgba(200,170,110,0.4)';
            btn.style.background  = 'rgba(200,170,110,0.08)';
        });
    });
}

// ── Importar JSON — cria uma NOVA ficha no painel ─────────
// (diferente do importarJSON do exportar_importar.js que SUBSTITUI
//  a ficha ativa — aqui criamos uma nova entrada na lista)
async function _importarFichaJSON() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const btn = document.querySelector('.btn-acao.secundario[onclick="importarFicha()"]');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Importando...'; }

        try {
            const texto = await file.text();
            const dados = JSON.parse(texto);

            if (!dados._app || dados._app !== 'Ficha RPG') {
                throw new Error('Arquivo inválido. Use um JSON exportado por esta aplicação.');
            }
            if (!dados.ficha) {
                throw new Error('Arquivo corrompido ou sem dados de ficha.');
            }

            const confirmou = confirm(
                `Importar ficha "${dados.ficha.nome || 'Sem nome'}"?\n\n` +
                `Isso criará uma nova ficha com todos os dados do arquivo.\n` +
                `Exportado em: ${dados._exportadoEm ? new Date(dados._exportadoEm).toLocaleString('pt-BR') : 'data desconhecida'}`
            );
            if (!confirmou) return;

            const userId = getUserId();
            if (!userId) throw new Error('Usuário não autenticado.');

            const supa = window._supaClient;

            const { data: novaFicha, error: erroFicha } = await supa
                .from('fichas')
                .insert([{
                    user_id: userId,
                    nome:    dados.ficha.nome   || 'Ficha Importada',
                    classe:  dados.ficha.classe || '',
                    genero:  dados.ficha.genero || '',
                    img:     dados.ficha.img    || ''
                }])
                .select()
                .single();

            if (erroFicha) throw new Error('Erro ao criar ficha: ' + erroFicha.message);

            const tipos = ['status', 'talentos', 'inventario'];
            for (const tipo of tipos) {
                if (dados[tipo] === undefined) continue;
                const { error: erroDados } = await supa.from('fichas_dados').insert({
                    ficha_id: novaFicha.id,
                    tipo,
                    valor: JSON.stringify(dados[tipo])
                });
                if (erroDados) console.warn(`Aviso ao salvar ${tipo}:`, erroDados.message);
            }

            fichas.push({
                id:     novaFicha.id,
                nome:   novaFicha.nome,
                classe: novaFicha.classe,
                img:    novaFicha.img || '',
                genero: novaFicha.genero || ''
            });
            renderizar();

            _mostrarToastPainel(`✅ Ficha "${novaFicha.nome}" importada com sucesso!`, '#4CAF50');

        } catch (err) {
            _mostrarToastPainel('❌ Erro ao importar: ' + err.message, '#e74c3c');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⬆ Importar'; }
        }
    };
    input.click();
}

// ── [FIX-CSV] Importar CSV — cria nova ficha via template CSV ─
// Lê o arquivo _status_.csv gerado pelo painel e cria uma nova
// ficha no Supabase, delegando o parsing ao _expImp se disponível.
async function _importarFichaCSV() {
    const input  = document.createElement('input');
    input.type   = 'file';
    // [FIX: accept abrangente — garante que Windows/Mac mostrem .csv]
    input.accept = '.csv,text/csv,text/plain,application/vnd.ms-excel';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const btn = document.querySelector('.btn-acao.secundario[onclick="importarFicha()"]');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Importando CSV...'; }

        try {
            const texto = await file.text();

            // Normaliza BOM e quebras de linha
            const textoLimpo = texto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const linhas = textoLimpo.split('\n').filter(l => l.trim());

            if (linhas.length < 2) {
                throw new Error('CSV vazio ou sem dados. Preencha o template antes de importar.');
            }

            // Valida cabeçalho (normaliza acentos e BOM residual)
            function normalizar(str) {
                return String(str || '').replace(/^\uFEFF/, '').normalize('NFC').trim();
            }
            function parsarLinhaCSV(linha) {
                const res = []; let campo = ''; let aspas = false;
                for (let i = 0; i < linha.length; i++) {
                    const c = linha[i];
                    if (c === '"') { if (aspas && linha[i+1] === '"') { campo += '"'; i++; } else aspas = !aspas; }
                    else if (c === ',' && !aspas) { res.push(campo); campo = ''; }
                    else campo += c;
                }
                res.push(campo); return res;
            }

            const cab = parsarLinhaCSV(linhas[0]).map(normalizar);
            if (cab[0] !== 'Campo' || cab[1] !== 'Valor') {
                throw new Error(
                    `Cabeçalho inválido. Esperado: "Campo, Valor"\n` +
                    `Recebido: "${cab.join(', ')}"\n\n` +
                    `Use o arquivo _status_.csv gerado pelo sistema ou baixe o template CSV.`
                );
            }

            // Monta mapa de campos
            const mapa = {};
            linhas.slice(1).forEach(l => {
                const p = parsarLinhaCSV(l);
                if (p.length >= 2) mapa[normalizar(p[0])] = normalizar(p[1]);
            });

            const CAMPO_STATUS = {
                'Jogador':'jogador','Personagem':'personagem','Raça':'raca',
                'Idade':'idade','Nível':'nivel','Vida Atual':'vidaAtual',
                'Mana Atual':'manaAtual','Sanidade':'sanAtual',
                'Força Base':'forcaBase','Força Bônus':'forcaBonus',
                'Velocidade Base':'velBase','Velocidade Bônus':'velBonus',
                'Inteligência Base':'intBase','Inteligência Bônus':'intBonus',
                'Defesa Base':'defBase','Defesa Bônus':'defBonus',
                'Pontaria Base':'pontBase','Pontaria Bônus':'pontBonus',
                'Carisma Base':'carBase','Carisma Bônus':'carBonus',
                'Furtividade Base':'furtBase','Furtividade Bônus':'furtBonus',
                'Habilidades Ativas':'habilidades',
            };

            const statusObj = {};
            Object.entries(CAMPO_STATUS).forEach(([campo, chave]) => {
                const v = mapa[normalizar(campo)];
                if (v !== undefined && v !== '') statusObj[chave] = v;
            });

            const userId = getUserId();
            if (!userId) throw new Error('Usuário não autenticado.');
            const supa = window._supaClient;

            // Cria nova ficha
            const nome   = mapa['Nome']   || mapa['Personagem'] || 'Ficha CSV';
            const classe = mapa['Classe'] || '';
            const genero = mapa['Gênero'] || mapa['Genero'] || '';

            const { data: novaFicha, error: erroFicha } = await supa
                .from('fichas')
                .insert([{ user_id: userId, nome, classe, genero, img: '' }])
                .select().single();

            if (erroFicha) throw new Error('Erro ao criar ficha: ' + erroFicha.message);

            const { error: erroDados } = await supa.from('fichas_dados').insert({
                ficha_id: novaFicha.id,
                tipo: 'status',
                valor: JSON.stringify(statusObj)
            });
            if (erroDados) console.warn('Aviso ao salvar status:', erroDados.message);

            fichas.push({
                id: novaFicha.id, nome: novaFicha.nome,
                classe: novaFicha.classe, img: '', genero: novaFicha.genero || ''
            });
            renderizar();

            _mostrarToastPainel(`✅ Ficha "${novaFicha.nome}" importada via CSV!`, '#4CAF50');

        } catch (err) {
            _mostrarToastPainel('❌ Erro: ' + err.message, '#e74c3c');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⬆ Importar'; }
        }
    };
    input.click();
}

// ── [FIX-TXT] Importar TXT — cria nova ficha via template TXT ─
// Lê o arquivo template_ficha.txt (gerado por baixarTemplateTXT)
// e cria uma nova ficha no Supabase com os campos preenchidos.
async function _importarFichaTXT() {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.txt')) {
            _mostrarToastPainel('❌ Selecione um arquivo .txt válido.', '#e74c3c');
            return;
        }

        const btn = document.querySelector('.btn-acao.secundario[onclick="importarFicha()"]');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Importando TXT...'; }

        try {
            const texto = await file.text();
            const textoLimpo = texto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const linhas = textoLimpo.split('\n');

            function normalizar(str) {
                return String(str || '').replace(/^\uFEFF/, '').normalize('NFC').trim();
            }

            // Parseia formato "Chave: Valor"
            const mapa = {};
            linhas.forEach(linha => {
                linha = linha.trim();
                if (!linha || linha.startsWith('=') || linha.startsWith('Preencha')) return;
                const idx = linha.indexOf(':');
                if (idx === -1) return;
                const chave = normalizar(linha.slice(0, idx));
                const valor = normalizar(linha.slice(idx + 1));
                if (chave) mapa[chave] = valor;
            });

            if (Object.keys(mapa).length === 0) {
                throw new Error('Nenhum campo encontrado no arquivo TXT.\nVerifique se o formato é "Campo: Valor" em cada linha.');
            }

            const CAMPO_STATUS = {
                'Jogador':'jogador','Personagem':'personagem','Raça':'raca',
                'Idade':'idade','Nível':'nivel','Vida Atual':'vidaAtual',
                'Mana Atual':'manaAtual','Sanidade':'sanAtual',
                'Força Base':'forcaBase','Velocidade Base':'velBase',
                'Inteligência Base':'intBase','Defesa Base':'defBase',
                'Pontaria Base':'pontBase','Carisma Base':'carBase',
                'Furtividade Base':'furtBase','Habilidades Ativas':'habilidades',
            };

            const statusObj = {};
            Object.entries(CAMPO_STATUS).forEach(([campo, chave]) => {
                const v = mapa[normalizar(campo)];
                if (v !== undefined && v !== '') statusObj[chave] = v;
            });

            const userId = getUserId();
            if (!userId) throw new Error('Usuário não autenticado.');
            const supa = window._supaClient;

            const nome   = mapa['Nome']   || mapa['Personagem'] || 'Ficha TXT';
            const classe = mapa['Classe'] || '';
            const genero = mapa['Gênero'] || mapa['Genero'] || '';

            const { data: novaFicha, error: erroFicha } = await supa
                .from('fichas')
                .insert([{ user_id: userId, nome, classe, genero, img: '' }])
                .select().single();

            if (erroFicha) throw new Error('Erro ao criar ficha: ' + erroFicha.message);

            const { error: erroDados } = await supa.from('fichas_dados').insert({
                ficha_id: novaFicha.id,
                tipo: 'status',
                valor: JSON.stringify(statusObj)
            });
            if (erroDados) console.warn('Aviso ao salvar status:', erroDados.message);

            fichas.push({
                id: novaFicha.id, nome: novaFicha.nome,
                classe: novaFicha.classe, img: '', genero: novaFicha.genero || ''
            });
            renderizar();

            _mostrarToastPainel(`✅ Ficha "${novaFicha.nome}" importada via TXT!`, '#4CAF50');

        } catch (err) {
            _mostrarToastPainel('❌ Erro: ' + err.message, '#e74c3c');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '⬆ Importar'; }
        }
    };
    input.click();
}

// ── Exportar ficha pelo menu de contexto ───────────────────
async function exportarFichaAtual() {
    if (!fichaContextoId) return;
    const ficha = fichas.find(f => f.id === fichaContextoId);
    if (!ficha) return;

    _mostrarToastPainel('⏳ Exportando...', '#c8aa6e');

    try {
        const supa = window._supaClient;

        // Busca dados completos da ficha
        const { data: fichaInfo, error: erroFicha } = await supa
            .from('fichas')
            .select('*')
            .eq('id', fichaContextoId)
            .maybeSingle();

        if (erroFicha) throw new Error('Erro ao buscar ficha: ' + erroFicha.message);

        const { data: fichasDados, error: erroDados } = await supa
            .from('fichas_dados')
            .select('tipo, valor')
            .eq('ficha_id', fichaContextoId);

        if (erroDados) throw new Error('Erro ao buscar dados: ' + erroDados.message);

        const dados = { status: {}, talentos: [], inventario: [] };
        (fichasDados || []).forEach(row => {
            try { dados[row.tipo] = JSON.parse(row.valor); } catch(e) {}
        });

        const exportado = {
            _versao:       '1.0',
            _exportadoEm:  new Date().toISOString(),
            _app:          'Ficha RPG',
            ficha: {
                nome:   fichaInfo.nome   || '',
                classe: fichaInfo.classe || '',
                genero: fichaInfo.genero || '',
                img:    fichaInfo.img    || ''
            },
            status:    dados.status    || {},
            talentos:  dados.talentos  || [],
            inventario: dados.inventario || []
        };

        const json      = JSON.stringify(exportado, null, 2);
        const nomeSeg   = (ficha.nome || 'ficha').replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '').trim().replace(/\s+/g, '_') || 'ficha';
        const data      = new Date().toISOString().slice(0, 10);
        const blob      = new Blob([json], { type: 'application/json' });
        const url       = URL.createObjectURL(blob);
        const a         = document.createElement('a');
        a.href          = url;
        a.download      = `${nomeSeg}_${data}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        _mostrarToastPainel(`✅ "${ficha.nome}" exportada com sucesso!`, '#4CAF50');

    } catch (err) {
        _mostrarToastPainel('❌ Erro ao exportar: ' + err.message, '#e74c3c');
    }
}

// ── Toast do painel ─────────────────────────────────────────
function _mostrarToastPainel(msg, cor) {
    let toast = document.getElementById('painel-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'painel-toast';
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            z-index: 9999; padding: 10px 18px; border-radius: 6px;
            font-size: 14px; font-weight: bold; pointer-events: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent        = msg;
    toast.style.background   = cor === '#4CAF50' ? 'rgba(30,60,30,0.95)' : cor === '#e74c3c' ? 'rgba(60,20,20,0.95)' : 'rgba(30,24,10,0.95)';
    toast.style.border       = `1px solid ${cor}`;
    toast.style.color        = cor === '#4CAF50' ? '#7ee87e' : cor === '#e74c3c' ? '#ff8a7a' : '#f5d06e';
    toast.style.opacity      = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

// ── Abrir Ficha ────────────────────────────────────────────
function abrirFicha(id) {
    localStorage.setItem('rpg_ficha_ativa', id);
    window.location.href = 'index.html';
}

// ── Menu de contexto ───────────────────────────────────────
function abrirCtxMenu(event, id) {
    event.stopPropagation();
    fichaContextoId = id;
    const menu = document.getElementById('ctxMenu');
    menu.style.left = event.clientX + 'px';
    menu.style.top  = event.clientY + 'px';
    menu.classList.add('visivel');
}

function fecharCtxMenuAoClicarFora() {
    document.addEventListener('click', () => {
        document.getElementById('ctxMenu').classList.remove('visivel');
    });
}

function abrirFichaAtual() {
    if (fichaContextoId) abrirFicha(fichaContextoId);
}

async function editarFichaAtual() {
    if (!fichaContextoId) return;
    const ficha = fichas.find(f => f.id === fichaContextoId);
    if (!ficha) return;
    const novoNome = prompt('Novo nome para a ficha:', ficha.nome);
    if (!novoNome || !novoNome.trim()) return;

    ficha.nome = novoNome.trim();
    await atualizarFichaSupabase(ficha.id, { nome: ficha.nome });
    renderizar();
}

async function excluirFichaAtual() {
    if (!fichaContextoId) return;
    const ficha = fichas.find(f => f.id === fichaContextoId);
    if (!ficha) return;
    if (!confirm(`Excluir a ficha "${ficha.nome}"? Esta ação não pode ser desfeita.`)) return;

    await excluirFichaSupabase(fichaContextoId);
    fichas = fichas.filter(f => f.id !== fichaContextoId);
    fichaContextoId = null;
    renderizar();
}
// ── Downloads de Templates (CSV e TXT) ─────────────────────

// Função auxiliar para forçar o download no navegador
function dispararDownloadArquivo(conteudo, nomeArquivo, tipoMime) {
    const blob = new Blob([conteudo], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    // Pequeno delay para garantir que funcione em todos os navegadores
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 2000);
}

// Gera e baixa o Template CSV
window.baixarTemplateCSV = function() {
    // Cabeçalho e campos baseados no importador do exportar_importar.js
    const cabecalho = "Campo,Valor\n";
    const linhas = [
        "Nome,",
        "Classe,",
        "Gênero,",
        "Jogador,",
        "Personagem,",
        "Raça,",
        "Idade,",
        "Nível,1",
        "Vida Atual,10",
        "Mana Atual,10",
        "Sanidade,10",
        "Força Base,0",
        "Velocidade Base,0",
        "Inteligência Base,0",
        "Defesa Base,0",
        "Pontaria Base,0",
        "Carisma Base,0",
        "Furtividade Base,0",
        "Habilidades Ativas,"
    ];
    
    // O \uFEFF garante que o Excel leia os acentos (UTF-8 com BOM) corretamente
    const csvContent = "\uFEFF" + cabecalho + linhas.join("\n");
    
    dispararDownloadArquivo(csvContent, "template_importacao_status.csv", "text/csv;charset=utf-8;");
    if (typeof _mostrarToastPainel === 'function') _mostrarToastPainel('✅ Template CSV baixado!', '#4CAF50');
};

// Gera e baixa o Template TXT
window.baixarTemplateTXT = function() {
    const txtContent = `=== TEMPLATE DE FICHA RPG ===
Preencha os dados abaixo e importe no sistema (se suportado).

Nome: 
Classe: 
Gênero: 
Jogador: 
Personagem: 
Raça: 
Idade: 
Nível: 1
Vida Atual: 10
Mana Atual: 10
Sanidade: 10
Força Base: 0
Velocidade Base: 0
Inteligência Base: 0
Defesa Base: 0
Pontaria Base: 0
Carisma Base: 0
Furtividade Base: 0
Habilidades Ativas: 
`;

    dispararDownloadArquivo(txtContent, "template_ficha.txt", "text/plain;charset=utf-8;");
    if (typeof _mostrarToastPainel === 'function') _mostrarToastPainel('✅ Template TXT baixado!', '#4CAF50');
};