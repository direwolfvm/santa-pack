const { canManageFamily, getAuthenticatedUser, getRole } = require('../lib/request');

class PeopleController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPerson(req, res) {
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

        const role = await getRole(this.supabase, user.id);
        const { familyId } = req.params;
        if (!await canManageFamily(this.supabase, user.id, role, familyId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { user_profile } = req.body;
        if (!user_profile) {
            return res.status(400).json({ error: 'user_profile is required' });
        }

        const { data: existing, error: exError } = await this.supabase
            .from('person')
            .select('id')
            .eq('user_profile', user_profile)
            .maybeSingle();

        if (exError) {
            return res.status(400).json({ error: exError.message });
        }
        if (!existing) {
            return res.status(400).json({ error: 'Person not found' });
        }

        const { data, error } = await this.supabase
            .from('person')
            .update({ family: familyId, family_pending: null })
            .eq('user_profile', user_profile)
            .select();

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
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
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
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

        const role = await getRole(this.supabase, user.id);
        if (!await canManageFamily(this.supabase, user.id, role, data.family_pending)) {
            return res.status(403).json({ error: 'Forbidden' });
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
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        const { personId } = req.params;
        const { data: person, error: personError } = await this.supabase
            .from('person')
            .select('family')
            .eq('id', personId)
            .maybeSingle();
        if (personError) return res.status(400).json({ error: personError.message });
        if (!person?.family) return res.status(404).json({ error: 'Person not found in a family' });

        const role = await getRole(this.supabase, user.id);
        if (!await canManageFamily(this.supabase, user.id, role, person.family)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
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
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (await getRole(this.supabase, user.id) !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
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
