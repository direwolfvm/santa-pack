class PresentsController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPresent(req, res) {
        const { title, description, giver, receiver, cloakedName, familyId } = req.body;
        const insertData = { title, description };
        if (giver) insertData.giver = giver;
        if (receiver) insertData.receiver = receiver;
        if (cloakedName !== undefined) insertData.cloaked_name = cloakedName;
        if (familyId) insertData.family = familyId;
        const { data, error } = await this.supabase
            .from('presents')
            .insert([insertData]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getPresents(req, res) {
        const { giver, receiver, familyId } = req.query;
        let query = this.supabase.from('presents').select('*');
        if (giver) query = query.eq('giver', giver);
        if (receiver) query = query.eq('receiver', receiver);
        if (familyId) query = query.eq('family', familyId);
        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async updatePresent(req, res) {
        const { id } = req.params;
        const { title, description, cloakedName } = req.body;
        const updates = { title, description };
        if (cloakedName !== undefined) updates.cloaked_name = cloakedName;
        const { data, error } = await this.supabase
            .from('presents')
            .update(updates)
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async deletePresent(req, res) {
        const { id } = req.params;
        const { data, error } = await this.supabase
            .from('presents')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(204).send();
    }
}

module.exports = PresentsController;