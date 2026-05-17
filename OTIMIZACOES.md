# Otimizações — Ficha RPG (Mobile & PC)

## Arquivos gerados
- `style.css` — versão otimizada do CSS principal
- `ui-enhancements.css` — versão otimizada das melhorias de UI

---

## 🔴 Problemas críticos corrigidos

### 1. `background-attachment: fixed` em todos os dispositivos
**Arquivo:** `style.css` e `ui-enhancements.css`

O fundo fixo causa **flickering severo** no iOS Safari e consome GPU desnecessariamente em Android. A correção aplica `fixed` apenas em dispositivos com mouse real:

```css
/* Antes */
body { background-attachment: fixed; }
@supports (-webkit-overflow-scrolling: touch) { body { background-attachment: scroll; } }

/* Depois — mais preciso */
body { background-attachment: scroll; }
@media (hover: hover) and (pointer: fine) {
    body { background-attachment: fixed; }
}
```

### 2. Hover com `transform` em cards de inventário no mobile
**Arquivo:** `style.css`

O `transform: translateX(3px)` em `.item-card:hover` disparava ao toque no mobile, causando layout quebrado. Agora só ativa em dispositivos com mouse:

```css
@media (hover: hover) and (pointer: fine) {
    .item-card:hover { transform: translateX(3px); ... }
}
```

### 3. Input `font-size` menor que 16px em mobile
**Arquivo:** `style.css`

`input[type="number"]` tinha `font-size: 14px` no mobile, o que causa **zoom automático no iOS** ao focar o campo. Corrigido para 16px mínimo no breakpoint ≤ 750px.

---

## 🟡 Melhorias de acessibilidade (A11Y)

### 4. Foco visível para navegação por teclado
**Arquivo:** `style.css`

Adicionado `:focus-visible` consistente em toda a aplicação — garante que usuários de teclado vejam onde estão sem poluir a experiência de mouse/touch:

```css
:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px rgba(212,169,67,0.55);
}
```

### 5. Touch targets abaixo de 44px
**Arquivo:** `style.css`

Vários botões (`.char-foto-btn`, `.calc-btn`, `.save-btn`) não tinham altura mínima garantida. A WCAG 2.5.5 recomenda 44×44px para alvos de toque. Corrigido com `min-height: 44px` e `display: flex; align-items: center`.

### 6. Preferência por movimento reduzido
**Arquivo:** `style.css`

Usuários com `prefers-reduced-motion: reduce` agora têm a animação do dragão e todas as transitions desativadas:

```css
@media (prefers-reduced-motion: reduce) {
    body::before { animation: none; }
    * { transition-duration: 0.01ms !important; }
}
```

### 7. Seleção de texto em botões
**Arquivo:** `ui-enhancements.css`

Botões de tema e ação rápida receberam `user-select: none` para evitar que o texto seja selecionado ao pressionar/segurar no mobile.

---

## 🟢 Melhorias de performance (PERF)

### 8. `will-change` cirúrgico
**Arquivo:** `style.css`, `ui-enhancements.css`

Adicionado `will-change: transform` apenas ao elemento que anima continuamente (dragão). Removido de `.save-btn` e `.item-card` onde não havia animação contínua — `will-change` desnecessário consome memória GPU.

### 9. `stat-meter` com `contain: strict`
**Arquivo:** `ui-enhancements.css`

As barras de vida/mana/sanidade agora têm `contain: strict`, informando ao browser que mudanças de largura dentro da barra não afetam o layout externo — evita reflow desnecessário.

### 10. `@import` de font removido do CSS
**Arquivo:** `style.css`

O `@import url(...)` da Google Fonts dentro do CSS bloqueia renderização. Os HTMLs já carregam a font via `<link>` no `<head>` com `preconnect`. O `@import` redundante foi removido.

### 11. Transições simplificadas
**Arquivo:** `style.css`

Substituídas `transition: all 0.25s` por propriedades específicas (`background, color, border-color, box-shadow`) em `.save-btn`, `.btn-remover-item` e `nav a`. `transition: all` anima propriedades invisíveis e desperdiça recursos.

---

## 🔵 Melhorias de UX mobile

### 12. `min-height: 100dvh`
**Arquivo:** `style.css`

Adicionado `min-height: 100dvh` além do `100vh`. A unidade `dvh` (dynamic viewport height) compensa a barra de endereços retrátil do iOS/Android, que faz `100vh` ficar maior que a tela visível.

### 13. Select com ícone nativo visível
**Arquivo:** `style.css`

O `-webkit-appearance: none` remove o indicador de dropdown no iOS. Adicionado um SVG de seta via `background-image` para garantir que o campo seja reconhecido como selecionável:

```css
select {
    background-image: url("data:image/svg+xml,...");
    background-position: right 10px center;
    padding-right: 32px;
}
```

### 14. Active states para touch
**Arquivo:** `style.css`, `ui-enhancements.css`

Botões passaram a ter `:active` com feedback visual (`transform: scale(0.98)`, mudança de cor), garantindo que usuários mobile vejam confirmação ao tocar — antes só havia `:hover` que não funciona em telas touch.

### 15. Nav com fundo sólido ao ficar sticky
**Arquivo:** `style.css`

Em mobile a nav fica `position: sticky`. Adicionado `background: rgba(10,8,4,0.92)` para que o conteúdo que passa por baixo não apareça sobre os links de navegação.

### 16. `touch-action: manipulation` no `html`
**Arquivo:** `style.css`

Desativa o delay de 300ms em double-tap no iOS sem precisar de JavaScript, acelerando a resposta de todos os toques na aplicação.

---

## 📐 Melhorias de layout PC

### 17. Breakpoint para PC grande (≥ 1200px)
**Arquivo:** `style.css`

Adicionado media query para telas largas com padding e gap maiores, aproveitando melhor o espaço disponível em monitores 1440p+.

### 18. CSS Variables consolidadas
**Arquivo:** `style.css`

Adicionadas `--nav-height`, `--widget-height` e `--content-max` para facilitar ajustes futuros em um único lugar.

---

## Como aplicar

Substitua os arquivos `style.css` e `ui-enhancements.css` no projeto pelos arquivos gerados. Nenhuma alteração nos arquivos HTML, JS ou no Supabase é necessária.

Para testar as melhorias mobile, use o Chrome DevTools com throttling de CPU em 4x e simule iPhone 12 (390px). Verifique especialmente:
- Zoom ao focar inputs numéricos (não deve ocorrer)
- Feedback ao tocar botões (deve ter resposta imediata)
- Fundo da página (não deve piscar ao rolar)
