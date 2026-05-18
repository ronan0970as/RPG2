# Patch obrigatório — painel_de_escolhas_de_fichas.html

O JS do painel foi reescrito para não usar `window.onload`.
O HTML precisa de **uma alteração** no bloco `<script>` inline que chama `exigirLogin()`.

---

## LOCALIZAR este trecho (perto do fim do HTML, antes de `</script>`):

```js
// ── Inicialização ─────────────────────────────────────────
exigirLogin().then(() => {
    preencherUsuarioUI();
});
```

## SUBSTITUIR por:

```js
// ── Inicialização ─────────────────────────────────────────
// [BUG-PANEL-1] _iniciarPainel() substitui window.onload
// Garante que auth resolva antes de qualquer chamada ao Supabase
exigirLogin().then(() => {
    preencherUsuarioUI();
    if (typeof _iniciarPainel === 'function') _iniciarPainel();
});
```

---

## Por que isso corrige o bug?

**Antes:** `window.onload` disparava `carregarFichas()` ao mesmo
tempo que `exigirLogin()` ainda estava verificando a sessão.
`getUserId()` retornava `null` porque `getSessao()` ainda não
tinha sido populado pelo auth.js, então as fichas nunca carregavam
e o grid ficava exibindo apenas os skeletons eternamente.

**Depois:** `_iniciarPainel()` só é chamada quando `exigirLogin()`
já resolveu — ou seja, o cliente Supabase está pronto e
`getSessao()` retorna o usuário correto.
