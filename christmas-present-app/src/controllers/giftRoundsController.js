class GiftRoundsController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createGiftRound(req, res) {
        const { familyId } = req.params;
        const { name } = req.body;
        const { data, error } = await this.supabase
            .from('gift_round')
            .insert([{ name, family: familyId, stage: 'giving' }]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getGiftRounds(req, res) {
        const { familyId } = req.params;
        if (req.user.role === 'user') {
            const { data: membership, error: membershipError } = await this.supabase
                .from('person')
                .select('id')
                .eq('family', familyId)
                .eq('user_profile', req.user.id)
                .maybeSingle();
            if (membershipError) {
                return res.status(400).json({ error: membershipError.message });
            }
            if (!membership) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        const { data, error } = await this.supabase
            .from('gift_round')
            .select('*')
            .eq('family', familyId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async updateGiftRoundStage(req, res) {
        if (req.user.role === 'user') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { giftRoundId } = req.params;
        const { stage } = req.body;
        const { data, error } = await this.supabase
            .from('gift_round')
            .update({ stage })
            .eq('id', giftRoundId)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async deleteGiftRound(req, res) {
        const { giftRoundId } = req.params;
        const { error } = await this.supabase
            .from('gift_round')
            .delete()
            .eq('id', giftRoundId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(204).send();
    }
}

module.exports = GiftRoundsController;
