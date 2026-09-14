# Crônicas do Vazio

Aplicação de RPG compatível com a quinta edição revisada de 2024. Referência: SRD 5.2.1, sob CC BY 4.0.

## Estado da implementação

Versão inicial funcional, não uma automação integral de todas as regras do jogo.

- Mesas persistentes em D1, membros por convite e controle de versão otimista.
- Fichas editáveis: 12 classes, 9 espécies, antecedentes, níveis, atributos, perícias, especialização, salvaguardas, PV, CA, equipamento, condições, espaços de magia, características e história.
- Dados no servidor com crypto.getRandomValues, vantagem/desvantagem, iniciativa, ataque simples, crítico, dano, turnos e encontro original.
- Campanha original com três locais, mapa com posicionamento livre, NPCs e diário persistente.
- Compêndio com 364 páginas do SRD e índice de 330 criaturas. Texto em inglês, interface em português.
- Gemini 2.5 Flash via servidor, chave apenas em memória no cliente, pesquisa opcional, fontes no diário e prompt que impede a narrativa de ser autoridade para o estado mecânico.

## Limitações explícitas

A ficha permite preenchimento manual. Não há validação automática de todas as combinações legais de criação, multiclasse ou progressão. Magias, características de classe, ações bônus, reações, concentração, resistência, morte, alcance, movimento legal e efeitos de condições ainda exigem adjudicação do anfitrião. O encontro automatizado usa uma criatura original, não pretende simular todo o bestiário. A IA não altera estado mecânico. A recuperação do SRD usa correspondência lexical em inglês; a busca web complementa essa referência. Não houve teste real com chave Gemini. Cotas gratuitas variam por conta e podem mudar.

Acesso privado é limitado ao proprietário. Convites da mesa não alteram a política de acesso do site. Jogadores adicionais precisam de acesso ao site antes de entrar com o código.

## Execução

Use Node >=22.13, npm run install:ci, npm run db:generate, npm run build e npm run dev. Aplique as migrações locais conforme o README do starter. O diretório work contém apenas ferramentas temporárias necessárias ao ambiente Windows restrito, não faz parte da aplicação publicada. Não há chave de API no código ou na configuração.

## Validação realizada

TypeScript sem erros e build de produção concluído. Testes de motor: modificadores, proficiência, limites de dados, vantagem, crítico, PV mínimo e validação básica de ficha. Testes HTTP: autenticação local, persistência, ficha, conflitos de versão, iniciativa, isolamento anônimo, busca de criaturas e erro sem chave Gemini. Não houve teste visual no navegador nem validação completa das regras de D&D.

## Atribuição

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

A interface e a campanha são originais; textos de referência foram extraídos do PDF original. A extração pode perder detalhes de tabelas; cada resultado possui um link para o PDF.
