# Política de Segurança

## Sobre este projeto

O CalculadoraFood é uma página estática (HTML/CSS/JS puro, sem backend, sem servidor, sem
banco de dados). Todo o processamento acontece no navegador do usuário e o único dado
persistido é salvo em `localStorage`, no próprio navegador - nada é enviado para nenhum
servidor. Isso limita bastante a superfície de ataque em comparação com uma aplicação com
backend, mas ainda vale reportar problemas como:

- Vulnerabilidades de XSS (ex.: algum campo de entrada que permita injetar HTML/JS na página)
- Problemas na geração dos arquivos exportados (CSV/XLSX) que possam ser explorados ao abrir
  o arquivo em outro programa
- Qualquer forma de vazamento de dados do usuário para fora do navegador

## Reportando uma vulnerabilidade

Se você encontrar uma vulnerabilidade de segurança, por favor **não abra uma issue pública**.
Em vez disso, use o recurso de
[Relatório privado de vulnerabilidade](../../security/advisories/new) do GitHub neste
repositório (aba "Security" → "Report a vulnerability"). Isso garante que o problema seja
tratado de forma privada até que uma correção esteja disponível.

Você pode esperar uma resposta inicial em até alguns dias. Como este é um projeto mantido
sem dedicação em tempo integral, o prazo para uma correção completa pode variar conforme a
gravidade do problema.

## Versões suportadas

Não há versões/releases formais - o projeto vive na branch `main`. Correções de segurança
são aplicadas diretamente nela.
