// ════════════════════════════════════════════════════════════
//  auth.js — Autenticação via Supabase
// ════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://qvpcjvwikrfkwlskfevy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cGNqdndpa3Jma3dsc2tmZXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDkwMjUsImV4cCI6MjA5MjEyNTAyNX0.4T1_K4pq7cueH03GVcaa0ONM8x0VpIwBFLRZt3n2Vq0';

const AUTH_PAGE   = 'auth.html';
const PAINEL_PAGE = 'painel_de_escolhas_de_fichas.html';

// ── Cliente Supabase ──────────────────────────────────────
// O script do Supabase CDN deve ser carregado antes deste arquivo
// em todos os HTMLs: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utilitários de sessão ─────────────────────────────────
function estaLogado() {
    // A sessão do Supabase é gerenciada por ele mesmo no localStorage
    // Mas precisamos de uma forma síncrona — usamos o cache salvo
    try {
        const raw = localStorage.getItem('rpg_sessao_cache');
        if (!raw) return false;
        const s = JSON.parse(raw);
        return !!(s && s.email);
    } catch(e) { return false; }
}

function getSessao() {
    try { return JSON.parse(localStorage.getItem('rpg_sessao_cache')); } catch(e) { return null; }
}

// Sincroniza a sessão do Supabase com o cache local
async function sincronizarSessao() {
    const { data } = await _supa.auth.getSession();
    const session = data?.session;
    if (session && session.user) {
        const nome = session.user.user_metadata?.nome || session.user.email.split('@')[0];
        localStorage.setItem('rpg_sessao_cache', JSON.stringify({
            email: session.user.email,
            nome: nome,
            id: session.user.id
        }));
        return true;
    } else {
        localStorage.removeItem('rpg_sessao_cache');
        return false;
    }
}

// ── Proteção de página ────────────────────────────────────
async function exigirLogin() {
    const logado = await sincronizarSessao();
    if (!logado) {
        window.location.replace(AUTH_PAGE);
    }
}

// ── Cadastro ──────────────────────────────────────────────
async function cadastrar(nome, email, senha) {
    if (!nome || !email || !senha) return { ok: false, erro: 'Preencha todos os campos.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.' };
    if (senha.length < 6) return { ok: false, erro: 'Senha deve ter ao menos 6 caracteres.' };

    const { data, error } = await _supa.auth.signUp({
        email,
        password: senha,
        options: { data: { nome: nome.trim() } }
    });

    if (error) return { ok: false, erro: traduzirErro(error.message) };

    // Alguns provedores exigem confirmação de e-mail — verificar
    if (data.user && !data.session) {
        return { ok: false, erro: 'Verifique seu e-mail para confirmar o cadastro.' };
    }

    await sincronizarSessao();
    return { ok: true };
}

// ── Login ──────────────────────────────────────────────────
async function loginUsuario(email, senha) {
    if (!email || !senha) return { ok: false, erro: 'Preencha todos os campos.' };

    const { data, error } = await _supa.auth.signInWithPassword({ email, password: senha });

    if (error) return { ok: false, erro: traduzirErro(error.message) };

    await sincronizarSessao();
    return { ok: true };
}

// ── Logout ────────────────────────────────────────────────
async function logout() {
    await _supa.auth.signOut();
    localStorage.removeItem('rpg_sessao_cache');
    window.location.replace(AUTH_PAGE);
}

// ── Widget de usuário na nav ──────────────────────────────
function injetarUsuarioNav() {
    const sessao = getSessao();
    if (!sessao) return;
    const nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.auth-usuario')) return;

    const span = document.createElement('span');
    span.className = 'auth-usuario';
    span.innerHTML = `
        <span class="auth-nome">👤 ${sessao.nome.split(' ')[0]}</span>
        <button class="auth-logout-btn" onclick="logout()" title="Sair da conta">Sair</button>
    `;
    nav.appendChild(span);
}

// ── Helpers ───────────────────────────────────────────────
function traduzirErro(msg) {
    if (!msg) return 'Erro desconhecido.';
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('User already registered'))   return 'E-mail já cadastrado.';
    if (msg.includes('Email not confirmed'))        return 'Confirme seu e-mail antes de entrar.';
    if (msg.includes('Password should be'))         return 'Senha deve ter ao menos 6 caracteres.';
    if (msg.includes('Unable to validate'))         return 'E-mail inválido.';
    return msg;
}

// Expõe o cliente para outros scripts
window._supaClient = _supa;
