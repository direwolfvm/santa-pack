class PeopleController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPerson(req, res) {
        const { familyId } = req.params;
        const { name, user_profile } = req.body;
        const { data, error } = await this.supabase
            .from('person')
            .insert([{ name, family: familyId, user_profile }])
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getPeople(req, res) {
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
            .from('person')
            .select('*')
            .eq('family', familyId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async deletePerson(req, res) {
        const { personId } = req.params;
        const { error } = await this.supabase
            .from('person')
            .delete()
            .eq('id', personId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(204).send();
    }
}

module.exports = PeopleController;
