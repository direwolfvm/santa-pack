const express = require('express');
const bodyParser = require('body-parser');
const presentsRoutes = require('./routes/presents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use('/api/presents', presentsRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});