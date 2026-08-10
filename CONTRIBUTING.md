# Contribuindo com o CalculadoraFood

Obrigado pelo interesse em contribuir! Este é um projeto simples — HTML/CSS/JS puro, sem
build, sem dependências — e a ideia é manter assim.

## Antes de começar

- Leia o [`CLAUDE.md`](./CLAUDE.md): ele documenta a arquitetura, as decisões de design e as
  convenções do projeto (formato do estado, cálculo do preço recomendado, export CSV/XLSX,
  catálogo de canais, etc.). A maioria das dúvidas de "por que isso funciona assim" está lá.
- Não há lint, teste automatizado ou build configurado. Validação é manual, no navegador.

## Como rodar localmente

```
python3 -m http.server 8000
```

Ou simplesmente abra o `index.html` direto no navegador.

## Fazendo uma alteração

1. Abra a página no navegador e reproduza o comportamento atual antes de alterar algo.
2. Faça a alteração no `script.js`, `style.css` ou `index.html`, conforme o caso.
3. Teste manualmente o caminho principal (fluxo feliz) e os casos de borda relevantes
   (ex.: campos vazios, canal sem taxa, exportação com zero produtos).
4. Se a alteração envolver exportação para XLSX, verifique o arquivo gerado com
   `unzip -t` (integridade do ZIP) e `python3 -c "import xml.dom.minidom, zipfile; ..."`
   para confirmar que cada parte XML é bem formada — veja o `CLAUDE.md` para o processo
   completo, já que não há teste automatizado para isso.

## Alterando o catálogo de canais (`SUPPORTED_CHANNELS`)

Se você alterar `commission`, `paymentFee` ou `monthlyFee` de um canal em `script.js`,
atualize o arquivo correspondente em [`channels/`](./channels) na mesma alteração (e
vice-versa). Os dois precisam ficar sempre sincronizados. Ao adicionar um canal novo ao
catálogo, crie o doc dele em `channels/` também, com fonte e nível de confiança do número
(informado pelo usuário vs. estimativa de mercado).

## Enviando um Pull Request

- Descreva o que mudou e por quê (o "porquê" importa mais que o "o quê" — o diff já mostra
  o quê).
- Mantenha o PR focado em uma única mudança lógica. PRs pequenos são mais fáceis de revisar.
- Não é necessário abrir uma issue antes de um PR pequeno, mas para mudanças maiores
  (ex.: novo canal, nova forma de export) vale abrir uma issue primeiro para alinhar o
  escopo.

## Código de conduta

Este projeto segue o [Código de Conduta](./.github/CODE_OF_CONDUCT.md). Ao participar,
espera-se que você o respeite.
