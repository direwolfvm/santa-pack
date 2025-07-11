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
        const { data, error } = await this.supabase
            .from('family')
            .select('*');

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }
}

module.exports = FamiliesController;
