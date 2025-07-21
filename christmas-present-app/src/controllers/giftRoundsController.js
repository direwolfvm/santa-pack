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
}

module.exports = GiftRoundsController;
