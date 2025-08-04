const express = require('express');
const router = express.Router();
const PresentsController = require('../controllers/presentsController');
const supabase = require('../db/supabaseClient');
const authenticate = require('../middleware/authenticate');

const presentsController = new PresentsController(supabase);

router.use(authenticate);

// Route to create a present
router.post('/', presentsController.createPresent.bind(presentsController));

// Route to retrieve all presents
router.get('/', presentsController.getPresents.bind(presentsController));

// Route to update a present
router.put('/:id', presentsController.updatePresent.bind(presentsController));

// Route to delete a present
router.delete('/:id', presentsController.deletePresent.bind(presentsController));

module.exports = router;