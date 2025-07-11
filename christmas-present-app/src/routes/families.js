const express = require('express');
const router = express.Router();
const FamiliesController = require('../controllers/familiesController');
const GiftRoundsController = require('../controllers/giftRoundsController');
const PeopleController = require('../controllers/peopleController');
const supabase = require('../db/supabaseClient');

const familiesController = new FamiliesController(supabase);
const giftRoundsController = new GiftRoundsController(supabase);
const peopleController = new PeopleController(supabase);

// List families
router.get('/', familiesController.getFamilies.bind(familiesController));

// Create a family
router.post('/', familiesController.createFamily.bind(familiesController));

// List gift rounds for a family
router.get('/:familyId/gift-rounds', giftRoundsController.getGiftRounds.bind(giftRoundsController));

// Create a gift round for a family
router.post('/:familyId/gift-rounds', giftRoundsController.createGiftRound.bind(giftRoundsController));

// List people for a family
router.get('/:familyId/people', peopleController.getPeople.bind(peopleController));

// Create a person for a family
router.post('/:familyId/people', peopleController.createPerson.bind(peopleController));

module.exports = router;
