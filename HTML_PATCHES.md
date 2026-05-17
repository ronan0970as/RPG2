# Patches para os arquivos HTML

Os arquivos HTML precisam de ajustes pontuais no bloco `<style>` interno de cada página.
Abaixo estão os trechos ANTIGOS e os substitutos NOVOS para cada arquivo.

---

## index.html, itens.html, talentos.html

Substituir o bloco de `background-attachment` em cada página pelo padrão abaixo:

### ANTES (em cada HTML):
```css
body {
    background-image: ...;
    background-size: cover;
    background-position: center center;
    background-attachment: fixed;   /* ← causa flickering iOS */
    background-repeat: no-repeat;
}
@supports (-webkit-overflow-scrolling: touch) {
    body { background-attachment: scroll; }
}
```

### DEPOIS (use em todos os HTMLs):
```css
body {
    background-image: ...;
    background-size: cover;
    background-position: center center;
    background-attachment: scroll;    /* scroll por padrão — sem flickering */
    background-repeat: no-repeat;
}
/* fixed apenas em dispositivos com mouse real */
@media (hover: hover) and (pointer: fine) {
    body { background-attachment: fixed; }
}
```

---

## talentos.html — `.status-pill:hover`

### ANTES:
```css
.status-pill:hover { border-color: #c8aa6e; }
```
### DEPOIS:
```css
@media (hover: hover) and (pointer: fine) {
    .status-pill:hover { border-color: #c8aa6e; }
}
.status-pill:active { border-color: #c8aa6e; }
```

---

## talentos.html — `.attr-chip:hover`

### ANTES:
```css
.attr-chip:hover { border-color: #c8aa6e; }
```
### DEPOIS:
```css
@media (hover: hover) and (pointer: fine) {
    .attr-chip:hover { border-color: #c8aa6e; }
}
.attr-chip:active { border-color: #c8aa6e; }
```

---

## talentos.html — `.talento-nome`

### ANTES:
```css
.talento-nome { ... font-size: 15px; ... }
```
### DEPOIS:
```css
.talento-nome { ... font-size: 16px; ... }  /* ≥ 16px evita zoom iOS */
```

---

## talentos.html — `.tipo-badge, .cat-badge`

### ANTES:
```css
.tipo-badge, .cat-badge { ... font-size: 13px; ... }
```
### DEPOIS:
```css
.tipo-badge, .cat-badge { ... font-size: 16px; ... }  /* ≥ 16px evita zoom iOS */
```

---

## painel_de_escolhas_de_fichas.html — `body` inline

O painel já tem o `background-attachment` no CSS externo (`painel_de_escolhas_de_fichas.css`).
Remover o `@supports (-webkit-overflow-scrolling: touch)` do `<style>` inline e substituir por:

```css
@media (hover: hover) and (pointer: fine) {
    body { background-attachment: fixed; }
}
```
