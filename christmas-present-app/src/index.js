const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

require('dotenv').config();
const presentsRoutes = require('./routes/presents');
const familiesRoutes = require('./routes/families');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/presents', presentsRoutes);
app.use('/api/families', familiesRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
