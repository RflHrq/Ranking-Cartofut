import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());

app.get('/api/cartola/mercado', async (req, res) => {
    const url = 'https://api.cartola.globo.com/atletas/mercado';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro na API do Cartola: ${response.statusText}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados do Cartola:', error);
        res.status(500).json({ error: 'Erro ao buscar dados da API do Cartola' });
    }
});

app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
