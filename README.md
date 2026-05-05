# Microsserviço de Empréstimos e Devoluções

Sistema de Gestão de Biblioteca — Grupo 5  
**Stack:** Node.js · Fastify · Prisma · MySQL

---

## Estrutura de Pastas

```
src/
├── app.js               # Instância do Fastify e registro de rotas
├── server.js            # Ponto de entrada
├── routes/
│   ├── emprestimos.js
│   ├── devolucoes.js
│   └── multas.js
├── services/
│   ├── emprestimoService.js
│   ├── devolucaoService.js
│   └── multaService.js
├── plugins/
│   └── prisma.js
└── utils/
    ├── prisma.js        # Singleton do PrismaClient
    └── dateHelper.js    # addDays / diffDays
prisma/
└── schema.prisma
```

---

## Como rodar

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com sua string de conexão MySQL
```

### 3. Rodar migrations e gerar client
```bash
npm run prisma:migrate
npm run prisma:generate
```

### 4. Iniciar o servidor
```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm start
```

---

## Endpoints

### Empréstimos `/emprestimos`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/emprestimos` | Lista todos (filtros: status, page, limit, orderBy) |
| GET | `/emprestimos/ativos` | Lista empréstimos ativos |
| GET | `/emprestimos/atrasados` | Lista empréstimos com prazo vencido |
| GET | `/emprestimos/usuario/:usuarioId` | Lista por usuário |
| GET | `/emprestimos/livro/:livroId` | Lista por livro |
| GET | `/emprestimos/:id` | Busca por ID |
| POST | `/emprestimos` | Cria novo empréstimo |
| PATCH | `/emprestimos/:id/renovar` | Renova prazo |
| DELETE | `/emprestimos/:id` | Remove (admin) |

### Devoluções `/devolucoes`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/devolucoes` | Lista todas |
| GET | `/devolucoes/:id` | Busca por ID |
| GET | `/devolucoes/emprestimo/:empId` | Busca pela devolução de um empréstimo |
| GET | `/devolucoes/usuario/:usuarioId` | Lista por usuário |
| POST | `/devolucoes` | Registra devolução (gera multa automaticamente se atrasado) |
| PATCH | `/devolucoes/:id/confirmar` | Confirma devolução (bibliotecário) |

### Multas `/multas`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/multas` | Lista todas |
| GET | `/multas/pendentes` | Lista multas pendentes |
| GET | `/multas/usuario/:usuarioId` | Lista por usuário |
| GET | `/multas/:id` | Busca por ID |
| POST | `/multas` | Cria manualmente (admin) |
| PUT | `/multas/:id` | Atualiza (admin) |
| PATCH | `/multas/:id/pagar` | Registra pagamento |
| PATCH | `/multas/:id/cancelar` | Cancela multa (admin) |
| DELETE | `/multas/:id` | Remove (admin) |

---

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DATABASE_URL` | String de conexão MySQL | — |
| `PORT` | Porta do servidor | `3000` |
| `VALOR_MULTA_DIA` | Valor da multa por dia de atraso (R$) | `2.50` |
