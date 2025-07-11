class PeopleController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPerson(req, res) {
        const { familyId } = req.params;
        const { name } = req.body;
        const { data, error } = await this.supabase
            .from('person')
            .insert([{ name, family: familyId }]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
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
}

module.exports = PeopleController;
