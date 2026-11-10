import { Router } from 'express';
import PresentsController from '../controllers/presentsController.js';

/** @param {ReturnType<typeof import('../db/supabaseClient.js').createSupabase>} supabase */
export default function createPresentsRouter(supabase) {
  const router = Router();
  const presents = new PresentsController(supabase);

  router.post('/', presents.createPresent.bind(presents));
  router.get('/', presents.getPresents.bind(presents));
  router.put('/:id', presents.updatePresent.bind(presents));
  router.delete('/:id', presents.deletePresent.bind(presents));

  return router;
}
