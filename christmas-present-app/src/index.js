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

app.get('/', (req, res) => {
    res.send('Santa Pack API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});