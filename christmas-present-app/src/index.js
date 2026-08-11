require('dotenv').config();
const createApp = require('./app');

const PORT = Number.parseInt(process.env.PORT, 10) || 8080;
const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Santa Pack is ready at http://localhost:${PORT}`);
  });
}

module.exports = app;
