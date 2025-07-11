const express = require('express');


const bodyParser = require('body-parser');

require('dotenv').config();
const presentsRoutes = require('./routes/presents');
const familiesRoutes = require('./routes/families');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/presents', presentsRoutes);
app.use('/api/families', familiesRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});