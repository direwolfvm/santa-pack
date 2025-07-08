class PresentsController {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async createPresent(req, res) {
        const { title, description } = req.body;
        const { data, error } = await this.supabase
            .from('presents')
            .insert([{ title, description }]);

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json(data);
    }

    async getPresents(req, res) {
        const { data, error } = await this.supabase
            .from('presents')
            .select('*');

        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    }

    async updatePresent(req, res) {
        const { id } = req.params;
        const { title, description } = req.body;
        const { data, error } = await this.supabase
            .from('presents')
            .update({ title, description })
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

export default PresentsController;