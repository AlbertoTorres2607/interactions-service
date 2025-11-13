// auth.js (simple - sin JWT)
// En producción, el gateway inyectará la identidad del usuario en headers.
// Preferencia: X-User-Id -> X-Consumer-Username -> "demo-user"
function getUserId(req) {
  return (
    req.header("x-user-id") ||
    req.header("x-consumer-username") ||
    "demo-user"
  );
}

module.exports = { getUserId };
