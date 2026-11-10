import { Router } from 'express';
import FamiliesController from '../controllers/familiesController.js';
import GiftRoundsController from '../controllers/giftRoundsController.js';
import PeopleController from '../controllers/peopleController.js';

/** @param {ReturnType<typeof import('../db/supabaseClient.js').createSupabase>} supabase */
export default function createFamiliesRouter(supabase) {
  const router = Router();
  const families = new FamiliesController(supabase);
  const giftRounds = new GiftRoundsController(supabase);
  const people = new PeopleController(supabase);

  router.get('/', families.getFamilies.bind(families));
  router.post('/', families.createFamily.bind(families));

  router.get('/:familyId/gift-rounds', giftRounds.getGiftRounds.bind(giftRounds));
  router.post('/:familyId/gift-rounds', giftRounds.createGiftRound.bind(giftRounds));
  router.put('/gift-rounds/:giftRoundId', giftRounds.updateGiftRoundStage.bind(giftRounds));

  router.get('/:familyId/people', people.getPeople.bind(people));
  router.get('/:familyId/pending-people', people.getPendingPeople.bind(people));
  router.post('/:familyId/people', people.createPerson.bind(people));

  // Admin console deletes
  router.delete('/:familyId', families.deleteFamily.bind(families));
  router.delete('/gift-rounds/:giftRoundId', giftRounds.deleteGiftRound.bind(giftRounds));
  router.delete('/people/:personId', people.deletePerson.bind(people));

  // Membership approval
  router.post('/people/:personId/approve', people.approvePerson.bind(people));
  router.post('/people/:personId/remove', people.removePerson.bind(people));

  return router;
}
