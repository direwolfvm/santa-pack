class PeopleController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPerson(req, res) {
        const { familyId } = req.params;
        const { name, user_profile } = req.body;
        const { data, error } = await this.supabase
            .from('person')
            .insert([{ name, family_pending: familyId, user_profile }])
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getPendingPeople(req, res) {
        const { familyId } = req.params;
        const { data, error } = await this.supabase
            .from('person')
            .select('*')
            .eq('family_pending', familyId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async approvePerson(req, res) {
        const { personId } = req.params;
        const { data, error } = await this.supabase
            .from('person')
            .select('family_pending')
            .eq('id', personId)
            .maybeSingle();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        if (!data || !data.family_pending) {
            return res.status(400).json({ error: 'No pending family request' });
        }

        const { error: updError } = await this.supabase
            .from('person')
            .update({ family: data.family_pending, family_pending: null })
            .eq('id', personId);

        if (updError) {
            return res.status(400).json({ error: updError.message });
        }
        res.status(200).json({ message: 'Approved' });
    }

    async removePerson(req, res) {
        const { personId } = req.params;
        const { error } = await this.supabase
            .from('person')
            .update({ family: null, family_pending: null })
            .eq('id', personId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json({ message: 'Removed' });
    }

    async getPeople(req, res) {
        const { familyId } = req.params;
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
