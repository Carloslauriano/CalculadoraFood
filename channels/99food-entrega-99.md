# 99Food Entrega pela 99

- **Id no catálogo** (`SUPPORTED_CHANNELS` em `script.js`): `99food-entrega-99`
- **Comissão**: 8,9% (**promocional** — padrão é 12%)
- **Taxa de intermediação/administrativa**: 3,2% — cobrada somente quando o cliente paga na
  plataforma 99Food
- **Mensalidade**: R$ 0 (**promocional** — padrão é R$ 150,00/mês)
- **Taxa de saque semanal**: 0% (**promocional** — padrão é 1,59%) — não modelada no
  catálogo do app, pois não é uma taxa por pedido
- **Entrega**: feita pela 99Food (a 99Food é responsável por todas as entregas da loja,
  com rastreio em tempo real)
- **Custos logísticos**: cobrança de taxa de entrega baseada na quilometragem, variável por
  contrato — **não modelada** no catálogo (não há um número único aplicável a todo pedido)

## Fonte

Informado pelo usuário a partir do painel de parceiros 99Food, em 2026-08 (HTML da página de
comissões, com valores promocionais e valores padrão riscados ao lado).

## Status

**Atenção: valores promocionais, sujeitos a expirar.** Diferente dos planos do iFood e
Aiqfome (que também são confirmados, mas são a taxa "padrão" contratual), os números atuais
de comissão, mensalidade e taxa de saque aqui são uma condição promocional temporária. Se o
usuário informar que a promoção acabou, atualize `commission`/`monthlyFee` em
`SUPPORTED_CHANNELS` (`script.js`) para os valores padrão (12% / R$ 150,00) e este arquivo
juntos.
