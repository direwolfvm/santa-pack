const { getAuthenticatedUser, getRequestDatabase, getRole, requireText } = require('../lib/request');

class FamiliesController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createFamily(req, res) {
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

        let name;
        try { name = requireText(req.body.name, 'name'); }
        catch (error) { return res.status(error.status).json({ error: error.message }); }
        const { data, error } = await database
            .from('family')
            .insert([{ name }]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getFamilies(req, res) {
        const database = getRequestDatabase(this.supabase, req);
        const { data, error } = await database
            .from('family')
            .select('*');

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async deleteFamily(req, res) {
        const database = getRequestDatabase(this.supabase, req);
        const user = await getAuthenticatedUser(this.supabase, req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        if (await getRole(database, user.id) !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const { familyId } = req.params;
        const { error } = await database
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
