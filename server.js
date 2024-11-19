const express = require('express');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();
const port = 3000;
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// Cache setup to store theme detection results for reuse
const themeCache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 30,  // limit each IP to 30 requests per windowMs
});

app.use(limiter);
app.use(express.static('public'));
app.use(express.json());

// Detect theme from cached results or API
async function detectTheme(userInput) {
    const cachedTheme = themeCache.get(userInput);
    if (cachedTheme) {
        console.log('Returning cached theme');
        return cachedTheme;
    }

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Analyze the following text and categorize it into one of these themes: motivation, love, wisdom, leadership, happiness, success, creativity, friendship, courage, growth, peace, nature, family, education, health, spirituality. Text to analyze: "${userInput}"`
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 50,
                },
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to detect theme');
        }

        const data = await response.json();
        const detectedTheme = data.candidates[0].content.parts[0].text.trim().toLowerCase();
        themeCache.set(userInput, detectedTheme);
        return detectedTheme;
    } catch (error) {
        console.error('Theme detection error:', error);
        return 'motivation';  // Default theme
    }
}

async function generateQuote(prompt) {
    const theme = await detectTheme(prompt);  // Detect theme first
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `Generate an inspiring quote about ${theme}. The quote should be profound and meaningful. Format it as 'Quote - Author'.`
                }]
            }],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 100,
            },
        })
    });

    if (!response.ok) {
        throw new Error('Quote generation failed');
    }

    const data = await response.json();
    const quoteText = data.candidates[0].content.parts[0].text;
    const [quote, author] = quoteText.split(' - ');

    return { quote, author, theme };
}

app.post('/api/generate-quote', async (req, res) => {
    try {
        const { prompt } = req.body;
        const quote = await generateQuote(prompt);
        res.json(quote);
    } catch (error) {
        res.status(500).json({ error: 'Error generating quote' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
