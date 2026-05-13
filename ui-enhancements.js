(function () {
    'use strict';

    const THEMES = {
        sombria: {
            label: 'Sombria',
            image: 'torre_status.png',
            position: 'center center',
            overlay: 'linear-gradient(to bottom, rgba(4,3,2,0.50), rgba(6,4,2,0.32), rgba(4,3,2,0.58))',
            vars: {
                '--gold': '#d4a943',
                '--gold-light': '#f5d06e',
                '--gold-dark': '#a07828',
                '--gold-glow': 'rgba(212,169,67,0.45)',
                '--parchment': '#f5e8c0',
                '--ink': '#d4c8a0',
                '--ink-dim': '#9a8e6e',
                '--ink-faint': '#4a4230',
                '--panel-bg': 'rgba(14,11,7,0.78)',
                '--panel-border': 'rgba(160,120,40,0.55)',
                '--input-bg': 'rgba(8,6,3,0.72)'
            }
        },
        cristal: {
            label: 'Cristal',
            image: 'torre_painel.png',
            position: 'center center',
            overlay: 'linear-gradient(to bottom, rgba(4,2,8,0.48), rgba(6,3,12,0.30), rgba(3,2,6,0.58))',
            vars: {
                '--gold': '#b06ee8',
                '--gold-light': '#d4a8f5',
                '--gold-dark': '#7c3aed',
                '--gold-glow': 'rgba(176,110,232,0.50)',
                '--parchment': '#ede0ff',
                '--ink': '#c9b8e8',
                '--ink-dim': '#9a82c0',
                '--ink-faint': '#3d2a5a',
                '--panel-bg': 'rgba(10,5,20,0.82)',
                '--panel-border': 'rgba(130,80,220,0.50)',
                '--input-bg': 'rgba(6,3,14,0.75)'
            }
        },
        alvorada: {
            label: 'Alvorada',
            image: 'torre_itens.png',
            position: 'center center',
            overlay: 'linear-gradient(to bottom, rgba(8,10,5,0.32), rgba(8,9,5,0.20), rgba(5,6,3,0.45))',
            vars: {
                '--gold': '#caa24a',
                '--gold-light': '#f2d581',
                '--gold-dark': '#8f7730',
                '--gold-glow': 'rgba(242,213,129,0.34)',
                '--parchment': '#fff1c9',
                '--ink': '#dfd09d',
                '--ink-dim': '#a89b6c',
                '--ink-faint': '#564d2d',
                '--panel-bg': 'rgba(14,13,7,0.76)',
                '--panel-border': 'rgba(202,162,74,0.48)',
                '--input-bg': 'rgba(8,7,3,0.72)'
            }
        },
        arcana: {
            label: 'Arcana',
            image: 'torre_talentos.png',
            position: 'center top',
            overlay: 'linear-gradient(to bottom, rgba(6,3,12,0.46), rgba(8,4,16,0.30), rgba(5,2,10,0.56))',
            vars: {
                '--gold': '#9f7aea',
                '--gold-light': '#d6bcfa',
                '--gold-dark': '#6b46c1',
                '--gold-glow': 'rgba(159,122,234,0.48)',
                '--parchment': '#f0e9ff',
                '--ink': '#cfc2ef',
                '--ink-dim': '#9f8ec2',
                '--ink-faint': '#44335e',
                '--panel-bg': 'rgba(11,7,22,0.80)',
                '--panel-border': 'rgba(130,95,220,0.52)',
                '--input-bg': 'rgba(7,4,15,0.76)'
            }
        }
    };

    function onReady(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function getActiveFichaId() {
        try {
            if (typeof window.getFichaId === 'function') return window.getFichaId() || 'global';
        } catch (e) {}
        return localStorage.getItem('rpg_ficha_ativa') || 'global';
    }

    function scopedKey(name) {
        return `${getActiveFichaId()}_${name}`;
    }

    function showToast(message) {
        let toast = document.querySelector('.ui-mini-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'ui-mini-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
    }

    function applyTheme(key, persist) {
        const themeKey = THEMES[key] ? key : 'sombria';
        const theme = THEMES[themeKey];

        Object.entries(theme.vars).forEach(([cssVar, value]) => {
            document.documentElement.style.setProperty(cssVar, value);
        });

        document.body.style.backgroundImage = `${theme.overlay}, url('${theme.image}')`;
        document.body.style.backgroundPosition = theme.position;
        document.body.dataset.towerTheme = themeKey;

        document.querySelectorAll('.tower-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeKey);
        });

        if (persist) {
            localStorage.setItem('rpg_tower_theme', themeKey);
            showToast(`Ambiente: ${theme.label}`);
        }
    }

    function injectThemePicker() {
        if (document.querySelector('.ui-ambient-panel')) return;

        const pageFile = (location.pathname.split('/').pop() || '').toLowerCase();
        if (pageFile.includes('painel')) document.body.classList.add('painel-page');

        const panel = document.createElement('section');
        panel.className = 'ui-ambient-panel';
        panel.setAttribute('aria-label', 'Ambiente da torre');

        const buttons = Object.entries(THEMES).map(([key, theme]) => `
            <button type="button" class="tower-theme-btn" data-theme="${key}" aria-label="Ambiente ${theme.label}">
                <span>${theme.label}</span>
            </button>
        `).join('');

        panel.innerHTML = `
            <div class="ui-ambient-title">
                <span>Ambiente da torre</span>
            </div>
            <div class="tower-theme-grid">${buttons}</div>
        `;

        panel.querySelectorAll('.tower-theme-btn').forEach(btn => {
            const theme = THEMES[btn.dataset.theme];
            btn.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.04), rgba(0,0,0,0.78)), url('${theme.image}')`;
            btn.addEventListener('click', () => applyTheme(btn.dataset.theme, true));
        });

        const nav = document.querySelector('body > nav');
        const filters = document.querySelector('.painel-filtros-busca');
        const top = document.querySelector('.painel-topo');
        const anchor = nav || filters || top;

        if (anchor && anchor.parentNode) anchor.insertAdjacentElement('afterend', panel);
        else document.body.insertBefore(panel, document.body.firstChild);

        applyTheme(localStorage.getItem('rpg_tower_theme') || defaultThemeForPage(), false);
    }

    function defaultThemeForPage() {
        const file = (location.pathname.split('/').pop() || '').toLowerCase();
        if (file.includes('talentos')) return 'arcana';
        if (file.includes('itens')) return 'alvorada';
        if (file.includes('painel')) return 'cristal';
        return 'sombria';
    }

    function statusValue(key) {
        const map = {
            vida:     'vida-atual',
            mana:     'mana-atual',
            sanidade: 'sanidade-atual'
        };
        return parseInt(document.getElementById(map[key])?.value, 10) || 0;
    }

    function statusMax(key) {
        if (key === 'vida') return parseInt(document.getElementById('vida-maxima')?.textContent, 10) || 1;
        if (key === 'mana') return parseInt(document.getElementById('mana-maxima')?.textContent, 10) || 1;
        return 100;
    }

    function setStatusValue(key, value) {
        const ids = {
            vida: 'vida-atual',
            mana: 'mana-atual',
            sanidade: 'sanidade-atual'
        };
        const el = document.getElementById(ids[key]);
        if (!el) return;

        const max = statusMax(key);
        const next = Math.max(0, Math.min(max, Math.round(value)));
        el.value = String(next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function markSheetChanged() {
        try {
            if (typeof window.marcarAlterada === 'function') window.marcarAlterada();
        } catch (e) {}
    }

    function refreshStatusMeters() {
        const keyMap = {
            vida:     'vida-atual',
            mana:     'mana-atual',
            sanidade: 'sanidade-atual'
        };
        Object.entries(keyMap).forEach(([key, inputId]) => {
            const input = document.getElementById(inputId);
            if (!input) return;
            const row = input.closest('.status-bar');
            const meter = row?.querySelector('.stat-meter');
            if (!row || !meter) return;

            const max = statusMax(key);
            const val = parseInt(input.value, 10) || 0;
            const pct = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 0;
            const fill = meter.querySelector('.stat-meter-fill');
            if (fill) fill.style.setProperty('--meter-value', `${pct}%`);
            row.classList.toggle('is-low', pct <= 25);
        });
    }

    function addStatusMeters() {
        const configs = [
            { key: 'vida',     id: 'vida-atual' },
            { key: 'mana',     id: 'mana-atual' },
            { key: 'sanidade', id: 'sanidade-atual' }
        ];

        configs.forEach(({ key, id }) => {
            const input = document.getElementById(id);
            const row = input?.closest('.status-bar');
            if (!row || row.querySelector('.stat-meter')) return;
            row.dataset.statusKind = key;
            const meter = document.createElement('div');
            meter.className = 'stat-meter';
            meter.innerHTML = '<span class="stat-meter-fill"></span>';
            row.appendChild(meter);
            input.addEventListener('input', refreshStatusMeters);
            input.addEventListener('change', refreshStatusMeters);
        });

        ['vida-maxima', 'mana-maxima'].forEach(id => {
            const target = document.getElementById(id);
            if (!target) return;
            new MutationObserver(() => refreshStatusMeters())
                .observe(target, { childList: true, characterData: true, subtree: true });
        });

        // Aguarda DOM estabilizar antes de renderizar os meters
        requestAnimationFrame(() => {
            refreshStatusMeters();
            setTimeout(refreshStatusMeters, 500);
        });
    }

    function injectStatusTools() {
        if (!document.getElementById('vida-atual') || document.getElementById('status-smart-panel')) return;

        addStatusMeters();

        const statusSection = document.getElementById('vida-atual')?.closest('.section');
        const panel = document.createElement('section');
        panel.id = 'status-smart-panel';
        panel.className = 'status-smart-panel';
        panel.innerHTML = `
            <div class="status-smart-grid">
                <div class="status-tool-block">
                    <div class="status-tool-title">Acoes rapidas</div>
                    <div class="quick-actions-grid">
                        <button type="button" class="ui-action-btn" data-status-delta="vida:-10">Dano 10</button>
                        <button type="button" class="ui-action-btn" data-status-delta="vida:10">Curar 10</button>
                        <button type="button" class="ui-action-btn" data-status-delta="mana:10">Mana +10</button>
                        <button type="button" class="ui-action-btn" data-status-delta="mana:-10">Mana -10</button>
                        <button type="button" class="ui-action-btn" data-status-delta="sanidade:-5">San -5</button>
                        <button type="button" class="ui-action-btn" data-status-rest="true">Descanso</button>
                    </div>
                </div>
                <div class="status-tool-block">
                    <div class="status-tool-title">Rolagem de dados</div>
                    <div class="dice-controls">
                        <input id="dice-expression" type="text" value="1d20" inputmode="text" autocomplete="off" aria-label="Expressao de dados">
                        <button type="button" class="ui-action-btn" id="dice-roll-btn">Rolar</button>
                    </div>
                    <div class="dice-presets">
                        <button type="button" class="ui-action-btn" data-dice-preset="1d20">d20</button>
                        <button type="button" class="ui-action-btn" data-dice-preset="1d12">d12</button>
                        <button type="button" class="ui-action-btn" data-dice-preset="1d10">d10</button>
                        <button type="button" class="ui-action-btn" data-dice-preset="1d8">d8</button>
                        <button type="button" class="ui-action-btn" data-dice-preset="1d6">d6</button>
                        <button type="button" class="ui-action-btn" data-dice-preset="1d4">d4</button>
                    </div>
                    <div class="dice-result" id="dice-result">Pronto para rolar.</div>
                    <div class="dice-history" id="dice-history"></div>
                </div>
            </div>
            <div class="status-tool-block quick-notes">
                <div class="status-tool-title">Notas rapidas</div>
                <textarea id="quick-session-notes" placeholder="Objetivos, pistas, efeitos temporarios..."></textarea>
                <div class="quick-notes-footer" id="quick-notes-status"></div>
            </div>
        `;

        if (statusSection) statusSection.insertAdjacentElement('afterend', panel);

        panel.querySelectorAll('[data-status-delta]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [key, rawDelta] = btn.dataset.statusDelta.split(':');
                setStatusValue(key, statusValue(key) + Number(rawDelta));
                markSheetChanged();
                refreshStatusMeters();
                showToast('Status atualizado');
            });
        });

        panel.querySelector('[data-status-rest]')?.addEventListener('click', () => {
            setStatusValue('vida', statusMax('vida'));
            setStatusValue('mana', statusMax('mana'));
            setStatusValue('sanidade', statusValue('sanidade') + 10);
            markSheetChanged();
            refreshStatusMeters();
            showToast('Descanso aplicado');
        });

        initDiceRoller(panel);
        initQuickNotes(panel);

        if (typeof window.calcularStatus === 'function' && !window.calcularStatus._uiEnhanced) {
            const original = window.calcularStatus;
            window.calcularStatus = function (...args) {
                const result = original.apply(this, args);
                // Suporta tanto síncrono quanto assíncrono
                if (result && typeof result.then === 'function') {
                    return result.then(r => { refreshStatusMeters(); return r; });
                }
                refreshStatusMeters();
                return result;
            };
            window.calcularStatus._uiEnhanced = true;
            // Atualiza o debounced também, caso já exista
            if (typeof window.calcularStatusDebounced === 'function' && !window.calcularStatusDebounced._uiEnhanced) {
                window.calcularStatusDebounced = (function(fn, ms) {
                    let t;
                    const d = function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
                    d._uiEnhanced = true;
                    return d;
                })(window.calcularStatus, 350);
            }
        }
    }

    function rollExpression(expression) {
        const clean = String(expression || '').toLowerCase().replace(/\s+/g, '');
        if (!clean || !/^[0-9d+\-]+$/.test(clean)) {
            throw new Error('Use algo como 1d20, 2d6+3 ou 1d8-1.');
        }

        const parts = clean.match(/[+-]?[^+-]+/g) || [];
        let total = 0;
        const details = [];

        parts.forEach(part => {
            const sign = part.startsWith('-') ? -1 : 1;
            const term = part.replace(/^[+-]/, '');
            if (!term) return;

            if (term.includes('d')) {
                const [countRaw, sidesRaw] = term.split('d');
                const count = countRaw ? parseInt(countRaw, 10) : 1;
                const sides = parseInt(sidesRaw, 10);
                if (!Number.isInteger(count) || !Number.isInteger(sides) || count < 1 || count > 50 || sides < 2 || sides > 1000) {
                    throw new Error('Limite: ate 50 dados, com faces entre 2 e 1000.');
                }
                const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
                const sum = rolls.reduce((acc, n) => acc + n, 0);
                total += sign * sum;
                details.push(`${sign < 0 ? '-' : ''}${count}d${sides} [${rolls.join(', ')}]`);
            } else {
                const number = parseInt(term, 10);
                if (!Number.isInteger(number)) throw new Error('Expressao invalida.');
                total += sign * number;
                details.push(`${sign < 0 ? '-' : '+'}${number}`);
            }
        });

        return { total, details: details.join(' ') };
    }

    function diceHistoryKey() {
        return scopedKey('rpg_dice_history');
    }

    function getDiceHistory() {
        try {
            const history = JSON.parse(localStorage.getItem(diceHistoryKey()) || '[]');
            return Array.isArray(history) ? history : [];
        } catch (e) {
            return [];
        }
    }

    function saveDiceHistory(entry) {
        const history = getDiceHistory();
        history.unshift(entry);
        localStorage.setItem(diceHistoryKey(), JSON.stringify(history.slice(0, 8)));
        renderDiceHistory();
    }

    function renderDiceHistory() {
        const wrap = document.getElementById('dice-history');
        if (!wrap) return;
        const history = getDiceHistory();
        wrap.innerHTML = history.map(item => `<span>${item}</span>`).join('');
    }

    function initDiceRoller(panel) {
        const input = panel.querySelector('#dice-expression');
        const resultEl = panel.querySelector('#dice-result');

        function roll() {
            try {
                const result = rollExpression(input.value);
                const label = input.value.trim() || '1d20';
                resultEl.innerHTML = `<strong>${result.total}</strong> <span>${result.details}</span>`;
                saveDiceHistory(`${label}: ${result.total}`);
            } catch (error) {
                resultEl.textContent = error.message;
            }
        }

        panel.querySelector('#dice-roll-btn')?.addEventListener('click', roll);
        input?.addEventListener('keydown', event => {
            if (event.key === 'Enter') roll();
        });
        panel.querySelectorAll('[data-dice-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.dicePreset;
                roll();
            });
        });

        renderDiceHistory();
    }

    function initQuickNotes(panel) {
        const notes = panel.querySelector('#quick-session-notes');
        const status = panel.querySelector('#quick-notes-status');
        if (!notes) return;

        notes.value = localStorage.getItem(scopedKey('rpg_quick_notes')) || '';
        let timer;
        notes.addEventListener('input', () => {
            markSheetChanged();
            if (status) status.textContent = 'salvando...';
            clearTimeout(timer);
            timer = setTimeout(() => {
                localStorage.setItem(scopedKey('rpg_quick_notes'), notes.value);
                if (status) status.textContent = 'salvo neste navegador';
            }, 250);
        });
    }

    onReady(() => {
        injectThemePicker();
        injectStatusTools();
    });
})();
