# Dev Space – Interactions Service

Microservicio de **interacciones** (comentarios y likes) para Dev Space.  
Lecturas por **GraphQL** (`/graphql`) y escrituras **REST** (`/api`) con **Swagger** en `/docs`.  
Autenticación simplificada vía **header** inyectado por el gateway (p. ej., Kong): `X-User-Id` (fallback: `demo-user`).

---

## Stack y dependencias
- **Node.js 20+**
- **Express 4**, **Mongoose 8** (MongoDB)
- **GraphQL** 15 + **express-graphql** 0.12 (sólo consultas)
- **Swagger UI** / OpenAPI 3 para la doc de REST
- **Helmet**, **CORS**, **morgan**

> Nota de compatibilidad: `express-graphql@0.12.0` requiere **graphql@^14 || ^15**. Se usa `graphql@^15.8.0`.

---

## Estructura (resumen)
```
interactions-service/
├─ Dockerfile
├─ docker-compose.yml
├─ .env.example
├─ openapi/
│  └─ interactions.openapi.yaml
└─ src/
   ├─ index.js            # app (REST/GraphQL/Swagger)
   ├─ config.js           # env vars
   ├─ db.js               # conexión Mongo
   ├─ auth.js             # getUserId() desde headers (sin JWT)
   ├─ models/
   │  ├─ Comment.js
   │  └─ Like.js
   ├─ graphql/
   │  ├─ schema.js
   │  └─ resolvers.js
   └─ routes/
      └─ rest.js          # POST/PUT/DELETE
```

---

## Requisitos previos
- **Docker + Docker Compose** (recomendado) o **MongoDB 7+** local.
- **Node.js 20+** si vas a correr en modo local.

---

## Variables de entorno
Crea el archivo `.env` (puedes copiar desde `.env.example`):

```ini
PORT=3000
MONGO_URL=mongodb://mongo:27017/devspace   # con docker-compose
# MONGO_URL=mongodb://localhost:27017/devspace  # si usas Mongo local
NODE_ENV=development
```

**Puerto expuesto:** `3000`

---

## Cómo correr

### Opción A — Docker (recomendado)
```bash
cp .env.example .env
docker compose up -d --build
```
- Interacciones (REST): `http://localhost:3000/api`
- GraphQL: `http://localhost:3000/graphql`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`

### Opción B — Local (sin Docker)
```bash
cp .env.example .env
# si usas Mongo local, ajusta MONGO_URL
npm install
npm run dev
```

---

## Cómo probar (rápido)

### 1) Health
```bash
curl http://localhost:3000/health
# => {"ok":true}
```

### 2) REST (escrituras) – headers: `X-User-Id: beto-dev`

**Crear comentario**
```bash
curl -X POST http://localhost:3000/api/comments   -H "Content-Type: application/json"   -H "X-User-Id: beto-dev"   -d '{"postId":"post-001","text":"Hola DevSpace!","parentCommentId":null}'
# => { "id": "<ObjectId>" }
```

**Editar comentario**
```bash
curl -X PUT http://localhost:3000/api/comments/<ID>   -H "Content-Type: application/json"   -H "X-User-Id: beto-dev"   -d '{"text":"Comentario editado"}'
# => { "ok": true }
```

**Eliminar comentario (soft-delete)**
```bash
curl -X DELETE http://localhost:3000/api/comments/<ID>   -H "X-User-Id: beto-dev"
# => 204 No Content
```

**Dar like / Quitar like (idempotente)**
```bash
curl -X POST http://localhost:3000/api/comments/<ID>/like -H "X-User-Id: beto-dev"
# => { "liked": true }  # si repites: { "liked": true, "dedup": true }

curl -X DELETE http://localhost:3000/api/comments/<ID>/like -H "X-User-Id: beto-dev"
# => { "liked": false }
```

### 3) Swagger (documentación REST)
- Navega a `http://localhost:3000/docs`
- Rutas disponibles:
  - `POST /comments` – Crear comentario
  - `PUT /comments/{id}` – Editar comentario (sólo autor)
  - `DELETE /comments/{id}` – Eliminar comentario (soft-delete)
  - `POST /comments/{id}/like` – Dar like (idempotente)
  - `DELETE /comments/{id}/like` – Quitar like (idempotente)

### 4) GraphQL (lecturas)

**Endpoint:** `POST http://localhost:3000/graphql`

**A) Postman en modo GraphQL**  
- **Query:**
```
query ($postId: String!, $limit: Int, $after: String){
  commentsByPost(postId: $postId, limit: $limit, after: $after){
    edges { cursor node { id authorId text likesCount createdAt } }
    pageInfo { endCursor hasNextPage }
  }
}
```
- **Variables:**
```json
{ "postId":"post-001", "limit":10 }
```

**Otra query (por id):**
```
query ($id: ID!) {
  comment(id: $id) {
    id postId authorId text likesCount isDeleted createdAt updatedAt
  }
}
```
Variables:
```json
{ "id":"<ObjectId>" }
```

**B) Raw JSON (Body → raw → application/json)**
```json
{
  "query": "query($postId:String!, $limit:Int){ commentsByPost(postId:$postId, limit:$limit){ edges{ cursor node{ id authorId text likesCount createdAt } } pageInfo{ endCursor hasNextPage } } }",
  "variables": { "postId":"post-001", "limit":10 }
}
```

**C) GET (opcional)**
- Params:
  - `query` = `query($id:ID!){ comment(id:$id){ id postId authorId text } }`
  - `variables` = `{"id":"<ObjectId>"}`

---

## Postman (colección y environment)
- Crea un **Environment** “DevSpace Local” con:
  - `baseUrl = http://localhost:3000`
  - `xUserId = beto-dev`
  - `postId = post-001`
  - `commentId =` *(vacío; se setea tras crear comentario)*
- Requests sugeridas (para capturas):
  1. GET `{{baseUrl}}/health`
  2. POST `{{baseUrl}}/api/comments`
  3. PUT `{{baseUrl}}/api/comments/{{commentId}}`
  4. POST `{{baseUrl}}/api/comments/{{commentId}}/like`
  5. DELETE `{{baseUrl}}/api/comments/{{commentId}}/like`
  6. POST `{{baseUrl}}/graphql` (modo GraphQL) – `commentsByPost`
  7. POST `{{baseUrl}}/graphql` (modo GraphQL) – `comment` por id
  8. DELETE `{{baseUrl}}/api/comments/{{commentId}}`

> Si la UI `/graphql` se queda en “Loading…”, puede ser por bloqueo al CDN de GraphiQL. Usa Postman para las consultas o desactiva temporalmente CSP en `helmet` durante dev:
```js
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
```

---

## Notas de diseño
- **Identidad**: se toma de `X-User-Id` (o `X-Consumer-Username`) y por defecto `demo-user`.  
  En producción, un **API Gateway (Kong)** inyecta estos headers luego de autenticar.
- **Idempotencia en likes**: índice único `(commentId, userId)` y respuesta sin error si ya existía.
- **Paginación**: GraphQL usa cursor por `_id` (estable y eficiente).
- **Migraciones**: no aplica (MongoDB). Mongoose crea índices al iniciar.

---

## Troubleshooting
- **`.env not found`** en Docker: crea `.env` o quita `env_file` y usa `environment:` en el compose.
- **`ERESOLVE` al instalar**: usa `graphql@^15.8.0` con `express-graphql@^0.12.0`.
- **Mongo connection refused**: verifica `MONGO_URL` y que el contenedor `mongo` esté **healthy**.
- **GraphiQL “Loading…”**: firewall/AV bloqueando CDN; usa Postman o desactiva CSP temporalmente (ver arriba).
