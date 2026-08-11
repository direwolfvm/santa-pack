const { getAuthenticatedUser, getRole, requireText } = require('../lib/request');

class PresentsController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPresent(req, res) {
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, description, giver, receiver, cloakedName, giftRoundId } = req.body;
        let cleanName;
        try {
            cleanName = requireText(name, 'name');
        } catch (error) {
            return res.status(error.status).json({ error: error.message });
        }
        const role = await getRole(this.supabase, user.id);
        if (role !== 'admin' && role !== 'manager') {
            const { data: person } = await this.supabase
                .from('person').select('id').eq('id', giver).eq('user_profile', user.id).maybeSingle();
            if (!person) return res.status(403).json({ error: 'Forbidden' });
        }

        const insertData = { name: cleanName, description: typeof description === 'string' ? description.trim() : '' };
        if (giver) insertData.giver = giver;
        if (receiver) insertData.receiver = receiver;
        if (cloakedName !== undefined) insertData.cloaked_name = cloakedName;
        if (giftRoundId) insertData.gift_round = giftRoundId;
        const { data, error } = await this.supabase
            .from('present')
            .insert([insertData]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getPresents(req, res) {
        const { giver, receiver, giftRoundId } = req.query;
        let query = this.supabase.from('present').select('*');
        if (giver) query = query.eq('giver', giver);
        if (receiver) query = query.eq('receiver', receiver);
        if (giftRoundId) query = query.eq('gift_round', giftRoundId);
        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async updatePresent(req, res) {
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        const role = await getRole(this.supabase, user.id);

        const { id } = req.params;
        if (role !== 'admin' && role !== 'manager') {
            const { data: present } = await this.supabase
                .from('present')
                .select('giver, receiver')
                .eq('id', id)
                .maybeSingle();

            if (!present) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const { data: person } = await this.supabase
                .from('person').select('id').eq('user_profile', user.id).maybeSingle();
            if (!person || (String(present.giver) !== String(person.id) && String(present.receiver) !== String(person.id))) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        const { name, description, cloakedName, receiverGuess, revealed } = req.body;
        const updates = {};
        if (name !== undefined) {
            try { updates.name = requireText(name, 'name'); }
            catch (error) { return res.status(error.status).json({ error: error.message }); }
        }
        if (description !== undefined) updates.description = typeof description === 'string' ? description.trim() : '';
        if (cloakedName !== undefined) updates.cloaked_name = cloakedName;
        if (receiverGuess !== undefined) updates.receiver_guess = receiverGuess;
        if (revealed !== undefined) updates.revealed = revealed;
        const { data, error } = await this.supabase
            .from('present')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        // Previously this endpoint would automatically mark the gift round
        // complete once every present had a guess recorded. This logic has
        // been removed so that completion can be triggered manually from the
        // UI. The update endpoint now simply records the guess without
        // altering the gift round stage.

        res.status(200).json(data);
    }

    async deletePresent(req, res) {
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        const role = await getRole(this.supabase, user.id);

        const { id } = req.params;
        if (role !== 'admin' && role !== 'manager') {
            const { data: present } = await this.supabase
                .from('present')
                .select('giver')
                .eq('id', id)
                .maybeSingle();

            const { data: person } = await this.supabase
                .from('person').select('id').eq('user_profile', user.id).maybeSingle();
            if (!present || !person || String(present.giver) !== String(person.id)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }

        const { data, error } = await this.supabase
            .from('present')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(204).send();
    }
}

module.exports = PresentsController;
