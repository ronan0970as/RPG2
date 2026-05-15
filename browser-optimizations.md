# Otimizações para Compatibilidade de Navegadores
## Ficha RPG — Torre Sombria

---

## Resumo Executivo

Foram identificados **18 problemas** distribuídos em 5 categorias:
CSS sem prefixos vendor · JS sem fallbacks · Performance · Acessibilidade · Segurança

---

## 1. CSS — Prefixos e Compatibilidade

### 1.1 `backdrop-filter` sem prefixo `-webkit-`

**Arquivos:** `ui-enhancements.css`, `java.js` (toast inline), `auth.js` (widget)

Safari (iOS/macOS) exige `-webkit-backdrop-filter`. O código já tem em alguns lugares, mas falta em outros.

**Problema:**
```css
/* ui-enhancements.css — .ui-ambient-panel */
backdrop-filter: blur(6px);
/* falta: -webkit-backdrop-filter: blur(6px); */
```

**Correção — adicionar em TODOS os blocos que usam `backdrop-filter`:**
```css
-webkit-backdrop-filter: blur(6px);
backdrop-filter: blur(6px);
```

**Locais afetados em `ui-enhancements.css`:**
- `.ui-ambient-panel` ✅ (já tem)
- `.ui-mini-toast` ❌ (falta)

**Locais afetados em `java.js` (toast inline, linha ~357):**
```js
// Adicionar na cssText do toast de notifyMudancaStatus:
-webkit-backdrop-filter: blur(6px);
backdrop-filter: blur(6px);
```

---

### 1.2 `background-attachment: fixed` — quebra no iOS Safari

**Arquivo:** `ui-enhancements.css`, `style.css`, todos os HTMLs

No iOS Safari, `background-attachment: fixed` causa flickering e não funciona corretamente em elementos que não sejam o `<body>` diretamente.

**Correção:**
```css
/* ui-enhancements.css — já existe o @media, mas incompleto */
@media (max-width: 750px) {
    body {
        background-attachment: scroll; /* ✅ já existe */
    }
}

/* Adicionar também para iOS especificamente: */
@supports (-webkit-overflow-scrolling: touch) {
    body {
        background-attachment: scroll;
    }
}
```

---

### 1.3 `appearance` em `<select>` — Firefox e Safari

**Arquivo:** `itens.html` (linha inline no select de categoria)

```html
<!-- Atual -->
<select id="item-categoria" style="-webkit-appearance:auto;appearance:auto;">

<!-- Correto: incluir todos os prefixos -->
<select id="item-categoria" style="-webkit-appearance:auto;-moz-appearance:auto;appearance:auto;">
```

Adicionar também no `style.css` global para todos os `<select>`:
```css
select {
    -webkit-appearance: auto;
    -moz-appearance: auto;
    appearance: auto;
}
```

---

### 1.4 `accent-color` — não suportado em navegadores antigos

**Arquivo:** `itens.html` (`.crop-controls input[type="range"]`)

```css
.crop-controls input[type="range"] {
    accent-color: #c8aa6e; /* não suportado no Safari < 15.4 */
}
```

**Correção — adicionar fallback manual para o range:**
```css
.crop-controls input[type="range"] {
    accent-color: #c8aa6e;
    /* Fallback para Safari mais antigo */
    background: linear-gradient(to right, #c8aa6e 0%, #c8aa6e var(--val, 50%), #333 var(--val, 50%), #333 100%);
}
```

---

### 1.5 `gap` em Flexbox — Safari < 14

**Arquivo:** `style.css`, `ui-enhancements.css`, `itens.html`

O `gap` em flexbox não funciona no Safari < 14. O projeto usa extensivamente.

**Correção recomendada — adicionar `margin` como fallback:**
```css
/* Para .genero-selector, .inv-toolbar, etc. */
.genero-selector > * + * { margin-left: 6px; } /* fallback */
@supports (gap: 6px) {
    .genero-selector { gap: 6px; }
    .genero-selector > * + * { margin-left: 0; }
}
```

> **Nota prática:** Se o público-alvo usa iOS 14+ e Chrome/Firefox modernos, esse item pode ser ignorado. O risco é baixo.

---

### 1.6 `minmax(0, 1fr)` em Grid — compatibilidade geral

O uso de `minmax(0, 1fr)` é correto e amplamente suportado. ✅ Nenhuma ação necessária.

---

## 2. JavaScript — Fallbacks e Compatibilidade

### 2.1 `structuredClone()` — não disponível em Safari < 15.4

**Arquivo:** `buffs.js` (verificar uso)

Se qualquer parte do código usar `structuredClone()`, adicionar polyfill:
```js
if (typeof structuredClone === 'undefined') {
    window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
```

---

### 2.2 `String.prototype.normalize()` — IE/Edge Legacy

**Arquivo:** `buffs.js` (linha 56)

```js
function _norm(txt) {
    return String(txt).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
```

**Correção com fallback:**
```js
function _norm(txt) {
    const s = String(txt).toLowerCase();
    try {
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch(e) {
        return s; // fallback para navegadores sem suporte
    }
}
```

---

### 2.3 `Array.from()` com `{ length }` — IE não suporta

**Arquivo:** `ui-enhancements.js` (linha 392)

```js
// Atual
const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
```

Isso funciona em todos os navegadores modernos. Para IE (se necessário):
```js
const rolls = Array.apply(null, { length: count }).map(() => Math.floor(Math.random() * sides) + 1);
```

> **Nota:** Se não há suporte a IE no escopo do projeto, ignorar.

---

### 2.4 `?.` (Optional Chaining) — não suportado em Safari < 13.1

**Arquivo:** `java.js`, `auth.js`, `ui-enhancements.js` — uso extensivo

```js
// Exemplos no código
document.getElementById('jogador')?.value
document.querySelector('.genero-btn.ativo')?.dataset.genero
```

**Correção (onde crítico):**
```js
// Em vez de:
document.getElementById('jogador')?.value || ''

// Use (mais seguro para navegadores antigos):
(document.getElementById('jogador') || {}).value || ''
// OU verificação explícita:
const el = document.getElementById('jogador');
const val = el ? el.value : '';
```

> **Impacto:** Médio. Safari 13.1+ (2020) já suporta. Dispositivos iOS muito antigos podem falhar silenciosamente.

---

### 2.5 `??` (Nullish Coalescing) — mesma situação do `?.`

Verificar uso e usar `||` como substituto seguro onde o valor `0` ou `''` não for problemático.

---

### 2.6 `requestAnimationFrame` duplo — pode causar flash

**Arquivo:** `java.js` (linhas 396-399)

```js
// Atual — double rAF para forçar reflow
requestAnimationFrame(() => {
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
});
```

**Mais confiável com `setTimeout(fn, 0)`:**
```js
requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
});
```

O elemento já foi adicionado ao DOM com `opacity: 0`, então um único rAF é suficiente após `appendChild`.

---

## 3. Performance

### 3.1 Google Fonts bloqueando renderização

**Arquivo:** `style.css` (linha 6)

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel...');
```

`@import` dentro de CSS é **síncrono e bloqueante**. Isso atrasa a renderização inicial.

**Correção — mover para `<link>` no `<head>` do HTML com `preconnect`:**
```html
<!-- Adicionar em TODOS os HTMLs, antes do <link rel="stylesheet"> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700&family=IM+Fell+English:ital@0;1&display=swap">

<!-- Remover o @import do style.css -->
```

**Ganho estimado:** 200–800ms no First Contentful Paint.

---

### 3.2 Imagens de fundo sem `loading` lazy

As imagens de fundo (`torre_*.png`) são carregadas via CSS e não podem usar `loading="lazy"`. Porém podem ser otimizadas:

**Recomendação:** Converter as imagens para `.webp` com fallback:
```css
/* Usando @supports para webp */
body {
    background-image: url('torre_status.png'); /* fallback */
}
@supports (background-image: url('data:image/webp;base64,UklG')) {
    body {
        background-image: url('torre_status.webp');
    }
}
```

---

### 3.3 `calcularStatus()` chama Supabase a cada keystroke

**Arquivo:** `java.js`

```js
// calcularStatus() faz await carregarDaNuvem('talentos') em cada chamada!
async function calcularStatus() {
    let talentos = await carregarDaNuvem('talentos') // ← chamada de rede!
```

**Correção — cache em memória para talentos:**
```js
let _talentosCache = null;
let _talentosUltimaFicha = null;

async function _getTalentos() {
    const fichaId = getFichaId();
    if (_talentosCache && _talentosUltimaFicha === fichaId) return _talentosCache;
    
    let talentos = await carregarDaNuvem('talentos')
        || JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');
    if (!Array.isArray(talentos)) talentos = [];
    
    _talentosCache = talentos;
    _talentosUltimaFicha = fichaId;
    return talentos;
}

// Em calcularStatus(), trocar:
// let talentos = await carregarDaNuvem('talentos') || ...
// Por:
let talentos = await _getTalentos();
```

**Impacto:** Reduz chamadas ao Supabase de dezenas para 1 por sessão.

---

### 3.4 `innerHTML` em loop de inventário sem sanitização

**Arquivo:** `java.js` (função `_renderizarInventarioLocal`)

A função `_esc()` já escapa HTML — verificar se está sendo usada em todos os campos:
```js
// Verificar que _esc() é chamada em nome, descrição e imagem
// ✅ já está correto para nome e descrição
// ✅ imagem também usa _esc()
```

Nenhuma ação necessária aqui — o código já é seguro.

---

## 4. Acessibilidade (impacta também SEO e leitores)

### 4.1 Botões sem `type="button"` dentro de forms

**Arquivo:** `index.html` (botão Salvar), `itens.html`

```html
<!-- Atual -->
<button class="save-btn" onclick="salvarFicha()">💾 Salvar Ficha</button>

<!-- Correto: evita submit acidental em alguns navegadores -->
<button type="button" class="save-btn" onclick="salvarFicha()">💾 Salvar Ficha</button>
```

---

### 4.2 Inputs numéricos sem `min` definido

**Arquivo:** `index.html`

```html
<!-- Atual -->
<input type="number" id="nivel" value="0" inputmode="numeric" oninput="calcularStatus()">

<!-- Correto -->
<input type="number" id="nivel" value="0" min="0" max="999" inputmode="numeric" oninput="calcularStatus()">
```

---

### 4.3 `<nav>` sem `aria-label`

```html
<!-- Atual -->
<nav>
    <a href="index.html" class="active">Status</a>
    ...
</nav>

<!-- Correto -->
<nav aria-label="Navegação principal">
    ...
</nav>
```

---

## 5. Segurança

### 5.1 Chave Supabase exposta no código-fonte

**Arquivo:** `auth.js` (linha 24)

```js
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

O próprio código já documenta isso com `[SEG-5]`. A `anon key` do Supabase é **pública por design** — ela é necessária no frontend. **Não é um vazamento de segurança**, desde que:

✅ RLS (Row Level Security) esteja ativado nas tabelas `fichas` e `fichas_dados`  
✅ As políticas RLS garantam que cada usuário só acessa seus próprios dados  
⚠️ **Verificar:** `fichas_dados` tem política `WHERE ficha_id IN (SELECT id FROM fichas WHERE user_id = auth.uid())`?

---

### 5.2 `confirm()` para ações destrutivas — bloqueado em alguns contextos

**Arquivo:** `java.js` (remover item, alterar quantidade)

```js
if (!confirm(`Remover "${item.nome}" do inventário?`)) return;
```

Em alguns contextos (iframes, PWAs) `confirm()` é bloqueado ou silenciado. Considerar usar um modal customizado (o projeto já tem infraestrutura para isso com o modal de logout).

---

## Priorização

| Prioridade | Item | Impacto |
|---|---|---|
| 🔴 Alta | 3.1 — Google Fonts bloqueante | Performance visível |
| 🔴 Alta | 3.3 — Cache de talentos | Reduz chamadas ao Supabase |
| 🟡 Média | 1.1 — `backdrop-filter` Safari | Visual quebrado no iOS |
| 🟡 Média | 1.2 — `background-attachment` iOS | Flickering no iPhone |
| 🟡 Média | 2.4 — Optional chaining Safari < 13 | Erros silenciosos |
| 🟢 Baixa | 1.3 — `appearance` Firefox | Estético |
| 🟢 Baixa | 4.1–4.3 — Acessibilidade | Semântica |
| 🟢 Baixa | 2.6 — rAF duplo | Micro-otimização |

---

## Correções Prontas para Copiar

### A) `<head>` de todos os HTMLs — substituir @import por preconnect

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
```

### B) `style.css` linha 6 — remover esta linha:

```css
/* REMOVER: */
@import url('https://fonts.googleapis.com/css2?...');
```

### C) `ui-enhancements.css` — `.ui-mini-toast` adicionar:

```css
.ui-mini-toast {
    /* ... código existente ... */
    -webkit-backdrop-filter: blur(6px); /* ADICIONAR */
    backdrop-filter: blur(6px);         /* já existe? verificar */
}
```

### D) `java.js` — cache de talentos em `calcularStatus()`:

```js
// Adicionar ANTES da função calcularStatus():
let _talentosCache = null;
let _talentosUltimaFicha = null;

async function _getTalentos() {
    const fichaId = getFichaId();
    if (_talentosCache !== null && _talentosUltimaFicha === fichaId) {
        return _talentosCache;
    }
    let talentos;
    try {
        talentos = await carregarDaNuvem('talentos')
            || JSON.parse(localStorage.getItem(k('rpg_talentos')) || '[]');
        if (!Array.isArray(talentos)) talentos = [];
    } catch(e) { talentos = []; }
    _talentosCache = talentos;
    _talentosUltimaFicha = fichaId;
    return talentos;
}

// Quando os talentos forem salvos, invalidar o cache:
// Adicionar ao final de salvarTalentosNuvem():
//   _talentosCache = null;

// Em calcularStatus(), linha ~234, trocar:
//   let talentos = [];
//   try {
//       talentos = await carregarDaNuvem('talentos') || ...
// Por:
//   const talentos = await _getTalentos();
```

### E) `buffs.js` — `_norm()` com fallback:

```js
function _norm(txt) {
    const s = String(txt).toLowerCase();
    try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    catch(e) { return s; }
}
```

---

*Gerado automaticamente — revisão humana recomendada antes de aplicar em produção.*
