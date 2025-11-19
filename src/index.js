require("express-async-errors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");

const { connectDB } = require("./db");
const config = require("./config");

// Swagger
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const swaggerDoc = YAML.load(path.join(__dirname, "..", "openapi", "interactions.openapi.yaml"));

// GraphQL
const { graphqlHTTP } = require("express-graphql");
const schema = require("./graphql/schema");
const resolvers = require("./graphql/resolvers");

// REST
const restRouter = require("./routes/rest");

// MQ (RabbitMQ)
const { startConsumers } = require("./mq/consumer");

async function main() {
  // 1) DB
  await connectDB();

  // 2) App
  const app = express();

  // ⚠️ Desactivamos CSP para que GraphiQL cargue sus assets sin bloquearse
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  // 3) REST (POST/PUT/DELETE)
  app.use("/api", restRouter);

  // 4) GraphQL (solo consultas)
  app.use(
    "/graphql",
    graphqlHTTP({
      schema,
      rootValue: resolvers,
      graphiql: true
    })
  );

  // 5) Swagger (doc de REST)
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

  // 6) Health
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // 7) Error handler
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  // 8) Start HTTP server
  app.listen(config.port, async () => {
    console.log(`[interactions] up on :${config.port}`);
    console.log(`REST:     http://localhost:${config.port}/api`);
    console.log(`GraphQL:  http://localhost:${config.port}/graphql`);
    console.log(`Swagger:  http://localhost:${config.port}/docs`);

    // 9) Iniciar consumidores de RabbitMQ (no tumbar el server si fallan)
    try {
      await startConsumers();
      console.log("🎧 RabbitMQ consumers started (likes & comments)");
    } catch (e) {
      console.error("⚠️ No se pudieron iniciar los consumers de RabbitMQ:", e.message);
      console.error("El servicio sigue activo para lecturas (REST/GraphQL). Reintenta luego.");
    }
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
