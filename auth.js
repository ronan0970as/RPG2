// ════════════════════════════════════════════════════════════
//  auth.js — Autenticação via Supabase  (v2 — corrigido)
//
//  CORREÇÕES APLICADAS:
//  [BUG-1] exigirLogin() agora trata exceções e exibe spinner
//          em vez de deixar tela preta
//  [BUG-2] estaLogado() removida do fluxo crítico; sessão
//          sempre validada com o Supabase (não só cache local)
//  [BUG-3] cadastrar() distingue "verifique e-mail" (info)
//          de erro real — retorna ok:true + emailPendente:true
//  [BUG-4] injetarUsuarioNav() não depende mais de
//          DOMContentLoaded; chama diretamente se DOM pronto
//  [SEG-5] SUPABASE_KEY comentada com aviso de env var
//  [SEG-6] Rate limiting no frontend: máx 5 tentativas/60s
//  [UX-7]  Fluxo "Esqueci minha senha" implementado
//  [UX-8]  Spinner de carregamento durante exigirLogin()
// ════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://mjbvslyfatzqrmrdqpwl.supabase.co';
// [SEG-5] Esta é a chave pública (anon key) do Supabase.
// Em produção com um bundler (Vite/Webpack), mova para
// variável de ambiente: import.meta.env.VITE_SUPABASE_KEY
// Certifique-se de que RLS está ativado nas tabelas!
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qYnZzbHlmYXR6cXJtcmRxcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzA3NjIsImV4cCI6MjA5MjIwNjc2Mn0.Oomslg7gPS39VMW9QGW-BL_8ugezAR8-BZWf__9TrEM';

const AUTH_PAGE   = 'auth.html';
const PAINEL_PAGE = 'painel_de_escolhas_de_fichas.html';

// ── Cliente Supabase ──────────────────────────────────────
const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════════════════════
//  [SEG-6] Rate limiting de tentativas de login no frontend
// ════════════════════════════════════════════════════════════
const _RL_KEY      = 'rpg_login_rl';
const _RL_MAX      = 5;    // tentativas máximas
const _RL_JANELA   = 60000; // janela de 60 segundos

function _rlCheck() {
    try {
        const raw = sessionStorage.getItem(_RL_KEY);
        const dados = raw ? JSON.parse(raw) : { count: 0, inicio: Date.now() };
        const agora = Date.now();

        // Reseta se a janela expirou
        if (agora - dados.inicio > _RL_JANELA) {
            sessionStorage.setItem(_RL_KEY, JSON.stringify({ count: 1, inicio: agora }));
            return { bloqueado: false };
        }

        if (dados.count >= _RL_MAX) {
            const restante = Math.ceil((_RL_JANELA - (agora - dados.inicio)) / 1000);
            return { bloqueado: true, restante };
        }

        dados.count++;
        sessionStorage.setItem(_RL_KEY, JSON.stringify(dados));
        return { bloqueado: false };
    } catch(e) {
        return { bloqueado: false }; // falha silenciosa: não bloqueia por erro
    }
}

function _rlReset() {
    sessionStorage.removeItem(_RL_KEY);
}

// ════════════════════════════════════════════════════════════
//  Utilitários de sessão
// ════════════════════════════════════════════════════════════

// [BUG-2] Mantida apenas para leitura de dados do cache (nome, id).
// NÃO use para verificar se está logado — use sincronizarSessao().
function getSessao() {
    try { return JSON.parse(localStorage.getItem('rpg_sessao_cache')); } catch(e) { return null; }
}

async function sincronizarSessao() {
    try {
        const { data, error } = await _supa.auth.getSession();
        if (error) throw error;

        const session = data?.session;
        if (session && session.user) {
            const nome = session.user.user_metadata?.nome || session.user.email.split('@')[0];
            localStorage.setItem('rpg_sessao_cache', JSON.stringify({
                email: session.user.email,
                nome:  nome,
                id:    session.user.id
            }));
            return true;
        } else {
            localStorage.removeItem('rpg_sessao_cache');
            return false;
        }
    } catch(e) {
        // [BUG-1] Retorna false em vez de deixar a promise pendente
        console.warn('sincronizarSessao: erro ao verificar sessão', e);
        localStorage.removeItem('rpg_sessao_cache');
        return false;
    }
}

// ════════════════════════════════════════════════════════════
//  [UX-8] Spinner de carregamento para exigirLogin()
// ════════════════════════════════════════════════════════════
function _mostrarSpinnerAuth() {
    if (document.getElementById('_spinner-auth')) return;
    const el = document.createElement('div');
    el.id = '_spinner-auth';
    el.innerHTML = `
        <style>
            #_spinner-auth {
                position: fixed; inset: 0;
                background: #0f0f0f;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                z-index: 99999; gap: 16px;
                /* [MOB-2] opacity em vez de visibility para compatibilidade iOS */
                opacity: 1;
                pointer-events: all;
            }
            #_spinner-auth .sp-anel {
                width: 40px; height: 40px;
                border: 3px solid #2a2a2a;
                border-top-color: #c8aa6e;
                border-radius: 50%;
                animation: _spin .7s linear infinite;
            }
            #_spinner-auth .sp-txt {
                font-family: 'Segoe UI', sans-serif;
                font-size: 13px; color: #555;
                letter-spacing: 0.5px;
            }
            @keyframes _spin { to { transform: rotate(360deg); } }
        </style>
        <div class="sp-anel"></div>
        <div class="sp-txt">Verificando sessão...</div>
    `;
    // Garante que o body exista antes de tentar inserir
    if (document.body) {
        document.body.appendChild(el);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (!document.getElementById('_spinner-auth')) document.body.appendChild(el);
        });
    }
}

function _removerSpinnerAuth() {
    const el = document.getElementById('_spinner-auth');
    if (el) el.remove();
}

// ════════════════════════════════════════════════════════════
//  [BUG-1 + UX-8 + MOBILE-FIX] Proteção de página
//  CORREÇÕES MOBILE:
//  [MOB-1] Timeout de segurança: se a verificação demorar mais
//          de 8s (conexão lenta no mobile), restaura visibilidade
//          e redireciona para login em vez de travar infinito.
//  [MOB-2] visibility:hidden substituído por opacity:0 +
//          pointer-events:none para evitar tela preta no iOS
//          quando o spinner ainda não renderizou.
// ════════════════════════════════════════════════════════════
async function exigirLogin() {
    // [MOB-2] Usa opacity em vez de visibility — mais seguro no iOS Safari
    // visibility:hidden pode causar tela completamente preta antes do spinner aparecer
    document.documentElement.style.opacity = '0';
    document.documentElement.style.pointerEvents = 'none';
    _mostrarSpinnerAuth();

    // [MOB-1] Timeout de segurança: 8s máximo para verificar sessão
    // Em conexões 3G/4G lentas o Supabase pode demorar ou timeout
    let logado = false;
    try {
        const _timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
        );
        logado = await Promise.race([sincronizarSessao(), _timeoutPromise]);
    } catch(e) {
        if (e.message === 'timeout') {
            console.warn('exigirLogin: timeout de verificação de sessão (conexão lenta?)');
        } else {
            console.error('exigirLogin: falha crítica', e);
        }
        logado = false;
    }

    // Sempre restaura visibilidade antes de redirecionar ou exibir
    document.documentElement.style.opacity = '';
    document.documentElement.style.pointerEvents = '';

    if (!logado) {
        window.location.replace(AUTH_PAGE);
        return;
    }

    _removerSpinnerAuth();
}

// ════════════════════════════════════════════════════════════
//  Cadastro
// ════════════════════════════════════════════════════════════
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

    // [BUG-3] Distingue confirmação pendente de erro real
    // Retorna ok:true + emailPendente:true para o auth.html
    // tratar com mensagem informativa (azul), não de erro (vermelho)
    if (data.user && !data.session) {
        return { ok: true, emailPendente: true };
    }

    await sincronizarSessao();
    return { ok: true, emailPendente: false };
}

// ════════════════════════════════════════════════════════════
//  Login (com rate limiting)
// ════════════════════════════════════════════════════════════
async function loginUsuario(email, senha) {
    if (!email || !senha) return { ok: false, erro: 'Preencha todos os campos.' };

    // [SEG-6] Verifica limite de tentativas
    const rl = _rlCheck();
    if (rl.bloqueado) {
        return {
            ok: false,
            erro: `Muitas tentativas. Aguarde ${rl.restante}s antes de tentar novamente.`
        };
    }

    const { data, error } = await _supa.auth.signInWithPassword({ email, password: senha });

    if (error) return { ok: false, erro: traduzirErro(error.message) };

    // Login bem-sucedido: reseta o contador
    _rlReset();
    await sincronizarSessao();
    return { ok: true };
}

// ════════════════════════════════════════════════════════════
//  [UX-7] Esqueci minha senha
// ════════════════════════════════════════════════════════════
async function enviarResetSenha(email) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, erro: 'Digite um e-mail válido.' };
    }

    const { error } = await _supa.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/' + AUTH_PAGE + '?modo=nova-senha'
    });

    if (error) return { ok: false, erro: traduzirErro(error.message) };
    return { ok: true };
}

// Detecta se voltou do link de reset e abre o modal automaticamente
function _verificarModoReset() {
    const params = new URLSearchParams(window.location.search);
    const hash   = window.location.hash;

    // Supabase envia o token no hash após o redirect
    if (hash.includes('type=recovery') || params.get('modo') === 'nova-senha') {
        _abrirModalNovaSenha();
    }
}

function _abrirModalNovaSenha() {
    if (document.getElementById('_modal-nova-senha')) {
        document.getElementById('_modal-nova-senha').style.display = 'flex';
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = '_modal-nova-senha';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.85);
        display:flex;align-items:center;justify-content:center;
        z-index:9999;
    `;
    overlay.innerHTML = `
        <style>
            #_ns-box {
                background:#1a1a1a; border:1px solid #2a2a2a;
                border-top:3px solid #c8aa6e; border-radius:12px;
                padding:28px; width:90%; max-width:360px;
                display:flex; flex-direction:column; gap:14px;
                box-shadow:0 12px 40px rgba(0,0,0,0.9);
                animation: _nsSlide .2s ease;
            }
            @keyframes _nsSlide {
                from { opacity:0; transform:translateY(16px); }
                to   { opacity:1; transform:translateY(0); }
            }
            #_ns-box .ns-titulo {
                font-size:15px; font-weight:bold;
                color:#c8aa6e; text-transform:uppercase;
                letter-spacing:.8px; text-align:center;
            }
            #_ns-box .ns-campo label {
                display:block; font-size:11px; font-weight:bold;
                color:#888; text-transform:uppercase;
                letter-spacing:.5px; margin-bottom:6px;
                width:auto;
            }
            #_ns-box .ns-campo .ns-senha-wrap { position:relative; }
            #_ns-box .ns-campo input {
                width:100%; background:#111; border:1px solid #333;
                color:#fff; padding:10px 42px 10px 12px;
                border-radius:4px; font-size:14px;
                font-family:inherit; outline:none;
                transition:border-color .2s;
                -webkit-appearance:none; appearance:none;
            }
            #_ns-box .ns-campo input:focus { border-color:#c8aa6e; }
            #_ns-box .ns-toggle {
                position:absolute; right:10px; top:50%;
                transform:translateY(-50%); background:none;
                border:none; color:#555; font-size:12px;
                cursor:pointer; font-family:inherit;
                padding:2px 4px; transition:color .2s;
            }
            #_ns-box .ns-toggle:hover { color:#c8aa6e; }
            #_ns-box .ns-msg { font-size:13px; text-align:center; font-weight:bold; min-height:18px; }
            #_ns-box .ns-msg.erro    { color:#e74c3c; }
            #_ns-box .ns-msg.sucesso { color:#4CAF50; }
            #_ns-box .ns-btn {
                background:#c8aa6e; color:#0f0f0f; border:none;
                padding:12px; border-radius:5px; font-size:14px;
                font-weight:bold; cursor:pointer; width:100%;
                text-transform:uppercase; letter-spacing:.5px;
                font-family:inherit; transition:background .2s, opacity .2s;
            }
            #_ns-box .ns-btn:hover    { background:#d4ba80; }
            #_ns-box .ns-btn:disabled { opacity:.6; cursor:not-allowed; }
            #_ns-box .ns-cancelar {
                background:none; border:1px solid #333; color:#666;
                padding:10px; border-radius:5px; font-size:13px;
                font-weight:bold; cursor:pointer; width:100%;
                font-family:inherit; transition:.2s;
            }
            #_ns-box .ns-cancelar:hover { border-color:#c8aa6e; color:#c8aa6e; }
        </style>
        <div id="_ns-box">
            <div class="ns-titulo">🔑 Nova senha</div>
            <div class="ns-campo">
                <label>Nova senha</label>
                <div class="ns-senha-wrap">
                    <input type="password" id="_ns-senha" placeholder="mínimo 6 caracteres">
                    <button type="button" class="ns-toggle"
                        onclick="(function(b){var i=document.getElementById('_ns-senha');var h=i.type==='password';i.type=h?'text':'password';b.textContent=h?'ocultar':'ver';})(this)">ver</button>
                </div>
            </div>
            <div class="ns-campo">
                <label>Confirmar nova senha</label>
                <div class="ns-senha-wrap">
                    <input type="password" id="_ns-confirma" placeholder="repita a senha">
                    <button type="button" class="ns-toggle"
                        onclick="(function(b){var i=document.getElementById('_ns-confirma');var h=i.type==='password';i.type=h?'text':'password';b.textContent=h?'ocultar':'ver';})(this)">ver</button>
                </div>
            </div>
            <div class="ns-msg" id="_ns-msg"></div>
            <button class="ns-btn" id="_ns-btn-salvar" onclick="_salvarNovaSenha()">Salvar nova senha</button>
            <button class="ns-cancelar" onclick="document.getElementById('_modal-nova-senha').style.display='none'">Cancelar</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function _salvarNovaSenha() {
    const btn      = document.getElementById('_ns-btn-salvar');
    const msgEl    = document.getElementById('_ns-msg');
    const senha    = document.getElementById('_ns-senha').value;
    const confirma = document.getElementById('_ns-confirma').value;

    function setNsMsg(txt, tipo) {
        msgEl.textContent = txt;
        msgEl.className = 'ns-msg ' + tipo;
    }

    if (senha.length < 6) { setNsMsg('Senha deve ter ao menos 6 caracteres.', 'erro'); return; }
    if (senha !== confirma) { setNsMsg('As senhas não coincidem.', 'erro'); return; }

    btn.disabled    = true;
    btn.textContent = 'Salvando...';

    const { error } = await _supa.auth.updateUser({ password: senha });

    if (error) {
        setNsMsg(traduzirErro(error.message), 'erro');
        btn.disabled    = false;
        btn.textContent = 'Salvar nova senha';
        return;
    }

    setNsMsg('Senha alterada com sucesso! Redirecionando...', 'sucesso');
    setTimeout(() => window.location.replace(PAINEL_PAGE), 1200);
}

// ════════════════════════════════════════════════════════════
//  Logout
// ════════════════════════════════════════════════════════════
async function logout() {
    await _supa.auth.signOut();
    localStorage.removeItem('rpg_sessao_cache');
    window.location.replace(AUTH_PAGE);
}

function abrirModalLogout() {
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
                    background:#1a1a1a; border:1px solid #2a2a2a;
                    border-top:3px solid #c8aa6e; border-radius:12px;
                    padding:28px 28px 22px; width:90%; max-width:340px;
                    display:flex; flex-direction:column; align-items:center; gap:14px;
                    box-shadow:0 12px 40px rgba(0,0,0,0.9);
                    animation:_slideUp .18s ease; text-align:center;
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
                #_modal-logout-box .ml-btn-sim:hover    { background:#d4ba80; }
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

    try {
        if (typeof salvarFicha === 'function')            await salvarFicha();
        if (typeof salvarTalentos === 'function')         await salvarTalentos();
        if (typeof salvarInventarioNuvem === 'function')  await salvarInventarioNuvem();
    } catch(e) {
        console.warn('Aviso ao salvar antes de sair:', e);
    }

    if (btn) btn.textContent = 'Saindo...';
    await logout();
}

// ════════════════════════════════════════════════════════════
//  [BUG-4] Widget de usuário — sem dependência de DOMContentLoaded
// ════════════════════════════════════════════════════════════
function injetarUsuarioNav() {
    const sessao = getSessao();
    if (!sessao) return;
    if (document.getElementById('_widget-usuario')) return;

    function _injetar() {
        if (document.getElementById('_widget-usuario')) return;

        const widget = document.createElement('div');
        widget.id = '_widget-usuario';
        widget.innerHTML = `
            <style>
                #_widget-usuario {
                    position: fixed; top: 8px; right: 10px;
                    z-index: 500; display: flex; align-items: center; gap: 6px;
                    background: rgba(20,20,20,0.96); border: 1px solid #2a2a2a;
                    border-radius: 8px; padding: 5px 8px 5px 10px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
                    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
                    pointer-events: all;
                }
                #_widget-usuario .wu-nome {
                    font-size: 12px; font-weight: bold; color: #c8aa6e;
                    white-space: nowrap; max-width: 120px;
                    overflow: hidden; text-overflow: ellipsis;
                }
                #_widget-usuario .wu-divider {
                    width: 1px; height: 16px; background: #333; flex-shrink: 0;
                }
                #_widget-usuario .wu-btn-logout {
                    background: transparent; border: none; color: #555;
                    padding: 4px 6px; border-radius: 5px; cursor: pointer;
                    display: flex; align-items: center; gap: 5px;
                    font-size: 12px; font-weight: bold; font-family: inherit;
                    transition: color 0.2s, background 0.2s; white-space: nowrap;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation; min-height: 32px;
                }
                #_widget-usuario .wu-btn-logout:hover,
                #_widget-usuario .wu-btn-logout:active {
                    color: #e74c3c; background: rgba(231,76,60,0.1);
                }
                #_widget-usuario .wu-btn-logout svg { flex-shrink: 0; }
                @media (max-width: 480px) {
                    #_widget-usuario .wu-btn-texto { display: none; }
                    #_widget-usuario .wu-nome { max-width: 80px; }
                }
            </style>
            <span class="wu-nome">👤 ${sessao.nome ? sessao.nome.split(' ')[0] : sessao.email}</span>
            <div class="wu-divider"></div>
            <button class="wu-btn-logout" id="_btn-logout-widget" title="Sair da conta">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span class="wu-btn-texto">Sair</span>
            </button>
        `;
        document.body.appendChild(widget);

        document.getElementById('_btn-logout-widget')
            .addEventListener('click', function(e) {
                e.stopPropagation();
                abrirModalLogout();
            });
    }

    // [BUG-4] Injeta imediatamente se DOM já está pronto,
    // caso contrário aguarda o evento
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _injetar);
    } else {
        _injetar();
    }
}

// ════════════════════════════════════════════════════════════
//  Helpers
// ════════════════════════════════════════════════════════════
function traduzirErro(msg) {
    if (!msg) return 'Erro desconhecido.';
    if (msg.includes('Invalid login credentials'))   return 'E-mail ou senha incorretos.';
    if (msg.includes('User already registered'))      return 'E-mail já cadastrado.';
    if (msg.includes('Email not confirmed'))          return 'Confirme seu e-mail antes de entrar.';
    if (msg.includes('Password should be'))           return 'Senha deve ter ao menos 6 caracteres.';
    if (msg.includes('Unable to validate'))           return 'E-mail inválido.';
    if (msg.includes('Email rate limit exceeded'))    return 'Muitos e-mails enviados. Tente mais tarde.';
    if (msg.includes('over_email_send_rate_limit'))   return 'Muitos e-mails enviados. Tente mais tarde.';
    if (msg.includes('Token has expired'))            return 'O link de recuperação expirou. Solicite um novo.';
    return msg;
}

// Expõe o cliente para outros scripts
window._supaClient = _supa;
