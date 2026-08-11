const { canManageFamily, getAuthenticatedUser, getRequestDatabase, getRole, requireText } = require('../lib/request');

class GiftRoundsController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createGiftRound(req, res) {
        const database = getRequestDatabase(this.supabase, req);
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const {
            data: { user },
            error: userError,
        } = await this.supabase.auth.getUser(token);
        if (userError || !user) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const role = await getRole(database, user.id);
        const { familyId } = req.params;
        if (!await canManageFamily(database, user.id, role, familyId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        let name;
        try { name = requireText(req.body.name, 'name'); }
        catch (error) { return res.status(error.status).json({ error: error.message }); }
        const { data, error } = await database
            .from('gift_round')
            .insert([{ name, family: familyId, stage: 'giving' }]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getGiftRounds(req, res) {
        const database = getRequestDatabase(this.supabase, req);
        const { familyId } = req.params;
        const { data, error } = await database
            .from('gift_round')
            .select('*')
            .eq('family', familyId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async updateGiftRoundStage(req, res) {
        const database = getRequestDatabase(this.supabase, req);
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const {
            data: { user },
            error: userError,
        } = await this.supabase.auth.getUser(token);
        if (userError || !user) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data: profile } = await database
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { giftRoundId } = req.params;
        const { stage } = req.body;
        if (!['giving', 'guessing', 'complete'].includes(stage)) {
            return res.status(400).json({ error: 'Invalid gift round stage' });
        }
        const { data, error } = await database
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
        const database = getRequestDatabase(this.supabase, req);
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (await getRole(database, user.id) !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { giftRoundId } = req.params;
        const { error } = await database
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
