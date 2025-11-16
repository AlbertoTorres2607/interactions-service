// auth.js - No authentication, just return a default user
function getUserId() {
  // Since Kong handles authentication, we can use a default
  // or get user info from Kong headers if needed later
  return "kong-authenticated-user";
}

module.exports = { getUserId };