class FamiliesController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createFamily(req, res) {
        const { name } = req.body;
        const { data, error } = await this.supabase
            .from('family')
            .insert([{ name }]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getFamilies(req, res) {
        const role = req.user.role;
        let query = this.supabase.from('family').select('*');
        if (role === 'user') {
            const { data: memberships, error: membershipsError } = await this.supabase
                .from('person')
                .select('family')
                .eq('user_profile', req.user.id);
            if (membershipsError) {
                return res.status(400).json({ error: membershipsError.message });
            }
            const familyIds = memberships.map(m => m.family);
            if (familyIds.length === 0) {
                return res.status(200).json([]);
            }
            query = query.in('id', familyIds);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async deleteFamily(req, res) {
        const { familyId } = req.params;
        const { error } = await this.supabase
            .from('family')
            .delete()
            .eq('id', familyId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(204).send();
    }
}

module.exports = FamiliesController;
