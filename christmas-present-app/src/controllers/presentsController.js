class PresentsController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPresent(req, res) {
        const { name, description, giver, receiver, cloakedName, giftRoundId } = req.body;
        const insertData = { name, description };
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
        if (giftRoundId) query = query.eq('gift_round', giftRoundId);

        if (req.user.role === 'user') {
            const { data: persons, error: personsError } = await this.supabase
                .from('person')
                .select('id')
                .eq('user_profile', req.user.id);
            if (personsError) {
                return res.status(400).json({ error: personsError.message });
            }
            const personIds = persons.map(p => p.id);
            if (personIds.length === 0) {
                return res.status(200).json([]);
            }
            const filter = `giver.in.(${personIds.join(',')}),receiver.in.(${personIds.join(',')})`;
            query = query.or(filter);
            if (giver && personIds.includes(Number(giver))) {
                query = query.eq('giver', giver);
            }
            if (receiver && personIds.includes(Number(receiver))) {
                query = query.eq('receiver', receiver);
            }
        } else {
            if (giver) query = query.eq('giver', giver);
            if (receiver) query = query.eq('receiver', receiver);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async updatePresent(req, res) {
        const { id } = req.params;
        const { name, description, cloakedName, receiverGuess, revealed } = req.body;
        const updates = { name, description };
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
        const { id } = req.params;
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