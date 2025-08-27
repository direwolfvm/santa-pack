class FamiliesController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createFamily(req, res) {
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

        const { data: profile } = await this.supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

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
        const { data, error } = await this.supabase
            .from('family')
            .select('*');

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
