# CalculadoraFood

Calculadora de taxas para marketplaces de delivery de comida. Cadastre seus produtos com o
preço de custo, escolha os canais de venda (iFood, Aiqfome, 99Food) e veja a taxa de cada um
lado a lado, além de um preço de venda recomendado com base na maior taxa entre os canais
selecionados e na margem de lucro que você definir.

Página estática - HTML/CSS/JS puro, sem framework, sem build, sem dependências.

## Como rodar

Abra `index.html` direto no navegador, ou sirva a pasta estaticamente:

```
python3 -m http.server 8000
```

## Funcionalidades

- Lista de produtos com preço de custo editável
- Canais pré-cadastrados (comissão + taxa de pagamento + mensalidade) - ver [`channels/`](./channels)
- Diluição da mensalidade de cada canal em custo por pedido, com base na média de pedidos por mês
- Preço de venda recomendado = custo + maior taxa entre os canais selecionados + margem de lucro + custo fixo diluído
- Exportação da tabela em CSV e em Excel (`.xlsx` real)
- Botão para limpar todos os dados salvos

## Canais suportados

As taxas de cada canal ficam cadastradas em `SUPPORTED_CHANNELS` (`script.js`) e documentadas
individualmente em [`channels/`](./channels). Os dois devem sempre estar sincronizados - veja
`CLAUDE.md`.

## Para desenvolvedores

Consulte [`CLAUDE.md`](./CLAUDE.md) para arquitetura, decisões de design e convenções do
projeto, e [`CONTRIBUTING.md`](./CONTRIBUTING.md) para como contribuir.

## Comunidade

- [Código de Conduta](./.github/CODE_OF_CONDUCT.md)
- [Política de Segurança](./SECURITY.md)
