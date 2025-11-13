require("express-async-errors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const { connectDB } = require("./db");
const config = require("./config");

const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const swaggerDoc = YAML.load(path.join(__dirname, "..", "openapi", "interactions.openapi.yaml"));

const { graphqlHTTP } = require("express-graphql");
const schema = require("./graphql/schema");
const resolvers = require("./graphql/resolvers");

const restRouter = require("./routes/rest");

async function main() {
  await connectDB();

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  // REST (POST/PUT/DELETE)
  app.use("/api", restRouter);

  // GraphQL (solo consultas)
  app.use(
    "/graphql",
    graphqlHTTP({
      schema,
      rootValue: resolvers,
      graphiql: true // útil para probar queries
    })
  );

  // Swagger (doc de REST)
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  app.listen(config.port, () => {
    console.log(`[interactions] up on :${config.port}`);
    console.log(`REST:     http://localhost:${config.port}/api`);
    console.log(`GraphQL:  http://localhost:${config.port}/graphql`);
    console.log(`Swagger:  http://localhost:${config.port}/docs`);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
