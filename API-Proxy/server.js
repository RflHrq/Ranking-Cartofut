import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import AbortController from 'abort-controller';

const app = express();
const port = 3000;

app.use(cors());

// 🔹 Função utilitária para buscar da API do Cartola com retry + timeout
async function fetchCartolaAPI(
  url,
  retries = 3,
  timeoutMs = 10000
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CartolaApp/1.0)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeout);

      if (attempt < retries) {
        console.warn(`Tentativa ${attempt} falhou (${err.message}), tentando novamente...`);
      } else {
        throw err;
      }
    }
  }
}

// 🔹 Rota para proxy da API do Cartola
app.get('/api/cartola/mercado', async (req, res) => {
  const url = 'https://api.cartola.globo.com/atletas/mercado';
  try {
    const data = await fetchCartolaAPI(url);
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados do Cartola:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados da API do Cartola' });
  }
});

app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
