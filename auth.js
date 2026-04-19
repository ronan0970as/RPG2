// ════════════════════════════════════════════════════════════
//  auth.js — Autenticação via Supabase
// ════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://mjbvslyfatzqrmrdqpwl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYnZzbHlmYXR6cXJtcmRxcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzA3NjIsImV4cCI6MjA5MjIwNjc2Mn0.Oomslg7gPS39VMW9QGW-BL_8ugezAR8-BZWf__9TrEM';

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

// Abre o modal de confirmação de saída
function abrirModalLogout() {
    // Cria o modal se ainda não existir
    if (!document.getElementById('_modal-logout')) {
        const overlay = document.createElement('div');
        overlay.id = '_modal-logout';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.82);
            display:flex;align-items:center;justify-content:center;
            z-index:9999;animation:_fadeIn .15s ease;
        `;
        overlay.innerHTML = `
            <style>
                @keyframes _fadeIn  { from{opacity:0} to{opacity:1} }
                @keyframes _slideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
                #_modal-logout-box {
                    background:#1a1a1a;
                    border:1px solid #2a2a2a;
                    border-top:3px solid #c8aa6e;
                    border-radius:12px;
                    padding:28px 28px 22px;
                    width:90%;max-width:340px;
                    display:flex;flex-direction:column;align-items:center;gap:14px;
                    box-shadow:0 12px 40px rgba(0,0,0,0.9);
                    animation:_slideUp .18s ease;
                    text-align:center;
                }
                #_modal-logout-box .ml-icon  { font-size:38px; }
                #_modal-logout-box .ml-title { font-size:16px;font-weight:bold;color:#c8aa6e;text-transform:uppercase;letter-spacing:1px; }
                #_modal-logout-box .ml-sub   { font-size:13px;color:#888;line-height:1.5; }
                #_modal-logout-box .ml-aviso { font-size:12px;color:#4CAF50;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.25);border-radius:6px;padding:8px 12px;width:100%; }
                #_modal-logout-box .ml-btns  { display:flex;gap:10px;width:100%;margin-top:4px; }
                #_modal-logout-box .ml-btn-sim {
                    flex:1;background:#c8aa6e;color:#0f0f0f;border:none;
                    padding:12px;border-radius:6px;font-size:14px;font-weight:bold;
                    cursor:pointer;font-family:inherit;transition:background .2s;
                }
                #_modal-logout-box .ml-btn-sim:hover  { background:#d4ba80; }
                #_modal-logout-box .ml-btn-sim:disabled { opacity:.6;cursor:not-allowed; }
                #_modal-logout-box .ml-btn-nao {
                    flex:1;background:transparent;color:#888;
                    border:1px solid #333;padding:12px;border-radius:6px;
                    font-size:14px;font-weight:bold;cursor:pointer;
                    font-family:inherit;transition:.2s;
                }
                #_modal-logout-box .ml-btn-nao:hover { border-color:#c8aa6e;color:#c8aa6e; }
            </style>
            <div id="_modal-logout-box">
                <div class="ml-icon">🚪</div>
                <div class="ml-title">Sair da conta?</div>
                <div class="ml-sub">Você será desconectado da sua sessão atual.</div>
                <div class="ml-aviso">💾 Seus dados serão salvos automaticamente antes de sair.</div>
                <div class="ml-btns">
                    <button class="ml-btn-sim" id="_btn-confirmar-logout" onclick="confirmarLogout()">Sim, sair</button>
                    <button class="ml-btn-nao" onclick="fecharModalLogout()">Cancelar</button>
                </div>
            </div>
        `;
        // Fecha ao clicar fora da caixa
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) fecharModalLogout();
        });
        document.body.appendChild(overlay);
    }
    document.getElementById('_modal-logout').style.display = 'flex';
}

function fecharModalLogout() {
    const el = document.getElementById('_modal-logout');
    if (el) el.style.display = 'none';
}

async function confirmarLogout() {
    const btn = document.getElementById('_btn-confirmar-logout');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    // Tenta salvar a ficha ativa antes de sair (se a função existir na página)
    try {
        if (typeof salvarFicha === 'function') {
            await salvarFicha();
        }
        // Salva talentos se disponível
        if (typeof salvarTalentos === 'function') {
            await salvarTalentos();
        }
        // Salva inventário se disponível  
        if (typeof salvarInventarioNuvem === 'function') {
            await salvarInventarioNuvem();
        }
    } catch(e) {
        console.warn('Aviso ao salvar antes de sair:', e);
    }

    if (btn) btn.textContent = 'Saindo...';
    await logout();
}

// ── Widget de usuário na nav ──────────────────────────────
function injetarUsuarioNav() {
    const sessao = getSessao();
    if (!sessao) return;
    if (document.getElementById('_widget-usuario')) return;

    const widget = document.createElement('div');
    widget.id = '_widget-usuario';
    widget.innerHTML = `
        <style>
            #_widget-usuario {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(26,26,26,0.95);
                border: 1px solid #2a2a2a;
                border-radius: 8px;
                padding: 6px 10px 6px 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
            }
            #_widget-usuario .wu-nome {
                font-size: 12px;
                font-weight: bold;
                color: #c8aa6e;
                white-space: nowrap;
                max-width: 110px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #_widget-usuario .wu-btn {
                background: transparent;
                border: 1px solid #333;
                color: #666;
                padding: 0;
                width: 34px;
                height: 34px;
                min-width: 34px;
                min-height: 34px;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: border-color 0.2s, color 0.2s, background 0.2s;
                /* Área de toque generosa para mobile */
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
            }
            #_widget-usuario .wu-btn:hover,
            #_widget-usuario .wu-btn:active {
                border-color: #e74c3c;
                color: #e74c3c;
                background: rgba(231,76,60,0.1);
            }
        </style>
        <span class="wu-nome">👤 ${sessao.nome.split(' ')[0]}</span>
        <button class="wu-btn" id="_btn-logout-widget" title="Sair da conta">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" style="display:block;pointer-events:none;">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
        </button>
    `;
    document.body.appendChild(widget);

    // Listener separado — mais confiável em mobile do que onclick inline
    document.getElementById('_btn-logout-widget')
        .addEventListener('click', function(e) {
            e.stopPropagation();
            abrirModalLogout();
        });
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
