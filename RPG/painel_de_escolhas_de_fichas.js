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

async function criarFichaSupabase({ nome, classe, img }) {
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
    const classe  = document.getElementById('nova-classe').value;
    const genero  = document.querySelector('#modal-genero-selector .genero-btn.ativo')?.dataset.genero || '';

    fecharModal();
    await criarFichaSupabase({ nome, classe, img: imgUrl, genero });
}

// ── Importar ───────────────────────────────────────────────
function importarFicha() {
    alert('Para importar, copie os arquivos de outra ficha.\n(Funcionalidade de exportação futura)');
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
