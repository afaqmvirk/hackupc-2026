# hackupc-2026

Ideas:
- Create a swarm of agents with different personalities, train the swarm on the data we have. Can be used to test different variants of ad designs .

MVP: 
- Create a minimal web page to submit a few design variants for an ad and get instant analytics from the AI swarm with personalities (A/B testing, etc) . Later contruct improvements over it, for example an interactive customer definition (Region, Language, Age, Preferences, etc) and use it for generation of the swarm personalities

## Running the MVP

```bash
pnpm install
cp .env.example .env
pnpm seed
pnpm dev
```

Set `GEMINI_API_KEY` in `.env` before running the Gemini swarm, uploads, or Copilot Q&A. `MONGODB_URI` is optional for local demos; without it, the app reads the provided Smadex CSV dataset directly and uses local similarity fallback.

