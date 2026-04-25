## Main goal extracted from the challenge

The Smadex challenge is **not simply “make an ad analyzer.”** The real goal is to build a **Creative Copilot for mobile advertisers**: a tool that connects **raw creative assets**—images, videos, playable-style ads, mobile formats—with **performance data** so marketers can understand **what is working, what is decaying, why it is happening, and what action to take next**. The deck frames the core pain as creative fatigue: many ads must be monitored, performance decays over time, and marketers often know *what* failed but not *why*. The explicit goal is to **bridge visual assets and KPIs**. 

Your swarm idea fits the challenge very well, especially across these challenge paths: **Explainability**, **Recommendation**, **Performance Explorer**, **Clustering**, and later **Fatigue Detection**. The judges will likely care less about “agents having fun personalities” and more about whether the swarm helps a marketer decide: **scale, pause, pivot, test, or redesign**. The deck also emphasizes interactive web apps, AI copilots, data storytelling, usability, decision support, and “surprising” creative execution. 

---

# Refined concept: Creative Swarm Copilot

Your product could be positioned as:

> **Creative Swarm Copilot: a data-grounded AI focus group that predicts, explains, and improves mobile ad variants before and after launch.**

The marketer uploads several ad variants. The system analyzes them visually, compares them against historical performance data, asks a swarm of specialized AI agents and target-audience personas to evaluate them, then returns a clear decision:

**Variant B should be tested first. Variant C has higher attention but weaker trust. Variant A should be redesigned because the CTA is unclear. Here is the A/B test plan and the exact edits to make.**

The key is that the swarm should not be just LLM opinions. It should be an **evidence-grounded swarm**. Each agent receives:

1. The uploaded creative.
2. Extracted visual features.
3. Target customer context.
4. Historical KPI benchmarks from the dataset.
5. Similar high-performing and low-performing creatives.
6. The predictive model’s estimated uplift or risk.

That makes the product feel magical while still aligning with the challenge’s emphasis on performance data and decision support.

---

# What the MVP should look like

## 1. Landing / brief screen

The first screen should feel like a mini campaign setup.

The marketer enters:

| Field          | Example                                                               |
| -------------- | --------------------------------------------------------------------- |
| App category   | Mobile game, fintech, food delivery, lottery, shopping                |
| Objective      | CTR, CVR, CPI, CPA, ROAS proxy                                        |
| Target region  | Spain, US, LATAM, global                                              |
| Language       | English, Spanish, Portuguese                                          |
| Platform       | iOS, Android                                                          |
| Ad format      | Static image, video, playable preview, story/reel                     |
| Audience style | Casual gamers, deal seekers, crypto-curious users, busy professionals |

For the hackathon MVP, keep this short: **category, region, language, OS, objective**.

Later, this becomes the interactive customer definition system you described.

---

## 2. Upload screen

The user uploads 2–6 ad variants.

Supported MVP assets:

* Static images.
* Short videos, reduced to key frames.
* Playable or HTML ads represented by screenshots.
* Optional CSV with campaign metadata or historical metrics.

The upload cards should immediately show:

* Thumbnail.
* Format.
* Text detected in the ad.
* CTA detected.
* Aspect ratio.
* Visual density.
* Dominant colors.
* Whether logo, product, price, face, hand, button, reward, or app UI appears.

This connects directly to the deck’s “what is a creative?” section, where creatives are shown as many different mobile ad experiences, not just static banners. 

---

## 3. “Swarm is analyzing” experience

This is where the idea becomes memorable.

Show a “swarm room” with agents posting short live observations:

**Performance Analyst**
“Variant B is visually similar to high-performing ads in this category. Its CTA is more prominent than Variant A.”

**Creative Director**
“Variant C has stronger emotional pull, but the visual hierarchy is crowded.”

**Skeptical User Persona**
“I understand the reward, but I do not trust the offer because the terms are too small.”

**Regional Persona: Spain / Android / Casual Gamer**
“The ‘Play Now’ button is clear, but the copy feels generic. I would respond better to a challenge-based message.”

This makes the demo entertaining, but each message should be backed by extracted features or historical similarity.

---

## 4. Results dashboard

The main result should be a ranked table:

| Rank | Variant |             Predicted outcome | Creative health | Swarm confidence | Action           |
| ---- | ------: | ----------------------------: | --------------: | ---------------: | ---------------- |
| 1    |       B | +12% expected CTR vs baseline |          84/100 |             High | Test / Scale     |
| 2    |       C | +7% expected CTR, lower trust |          76/100 |           Medium | Test with edits  |
| 3    |       A |              -4% expected CTR |          51/100 |             High | Pivot / Redesign |

Then show four clear sections:

### Champion

“Variant B is the recommended winner for the first test.”

### Why it wins

* Strongest CTA visibility.
* Lowest text clutter.
* Similar to top-performing creatives in the same category.
* Better alignment with target persona motivations.

### Risks

* Similarity to many existing ads may create fatigue faster.
* The reward claim may need clearer legal copy.
* Visual novelty score is medium.

### What to do next

* Launch B as primary.
* Test C as challenger.
* Redesign A by increasing CTA contrast and simplifying copy.
* Monitor fatigue after 5–7 days or after the first spend threshold.

This directly supports the challenge scoring criteria: usefulness, clarity, technical quality, creativity, and the bonus of combining image analysis with performance data to unlock the “why.” 

---

# The AI swarm design

The swarm should have two types of agents: **specialist agents** and **persona agents**.

## Specialist agents

| Agent                   | Job                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Performance Analyst     | Compares variants against historical KPIs and predicts likely winner                |
| Creative Director       | Reviews visual hierarchy, CTA, composition, message clarity                         |
| Fatigue Analyst         | Estimates whether the creative is likely to decay quickly                           |
| Clustering Agent        | Finds visually similar historical creatives and patterns                            |
| Localization Agent      | Checks whether copy, tone, and visuals fit the selected region/language             |
| Risk / Compliance Agent | Flags misleading claims, unreadable small text, risky financial/game/reward framing |
| Experiment Strategist   | Converts the analysis into an A/B test plan                                         |

## Persona agents

Persona agents simulate likely customer reactions. They should be generated from the marketer’s target definition.

Example persona swarm for a mobile game in Spain:

| Persona                  | Motivation                               | Likely concern            |
| ------------------------ | ---------------------------------------- | ------------------------- |
| Competitive Casual Gamer | Wants challenge and progression          | “Is this actually fun?”   |
| Reward-Seeking Player    | Wants prizes, bonuses, progression       | “Is the reward real?”     |
| Low-Attention Scroller   | Reacts in under 2 seconds                | “What is the action?”     |
| Skeptical User           | Worries about scams or misleading claims | “Can I trust this?”       |
| Visual Trend Seeker      | Likes modern, polished visuals           | “Does this feel premium?” |

Each persona returns structured scores:

```json
{
  "agent": "Reward-Seeking Player",
  "variantId": "B",
  "attention": 8,
  "clarity": 7,
  "trust": 5,
  "conversionIntent": 7,
  "topPositive": "The reward is immediately visible.",
  "topConcern": "The terms are too small to read.",
  "suggestedEdit": "Make the reward condition clearer below the CTA."
}
```

The swarm’s final score should be aggregated, not guessed.

A good MVP weighting could be:

| Signal                      | Weight |
| --------------------------- | -----: |
| Historical KPI predictor    |    40% |
| Similar creative benchmark  |    25% |
| Persona swarm response      |    20% |
| Creative-quality heuristics |    10% |
| Risk/fatigue penalty        |     5% |

This gives the swarm personality, but the ranking still comes from data.

---

# MVP feature set

For the hackathon, build this:

## Must-have

1. **Upload 2–6 creatives.**
2. **Enter basic audience/campaign context.**
3. **Extract visual features.**
4. **Compare against historical dataset.**
5. **Run 5–7 AI agents.**
6. **Rank variants.**
7. **Explain why the winner wins.**
8. **Recommend scale / test / edit / pivot.**
9. **Generate an A/B test plan.**

## Nice-to-have

1. Swarm debate animation.
2. Persona cards.
3. Visual overlay on the ad: CTA, logo, clutter, text density.
4. Similar-creatives gallery.
5. Creative fatigue forecast.
6. Copilot chat: “Why did Variant C lose?” or “How should I improve Variant A?”

## Do not build in the MVP

Avoid these until later:

* Full ad generation.
* Full campaign management.
* Real-time ad network integration.
* Deep fine-tuning.
* Complex multi-armed bandit live optimization.
* Too many personas.

The MVP should be a **decision-support demo**, not a full ad platform.

---

# Suggested product flow

```text
1. Marketer uploads variants
        ↓
2. System extracts visual features
        ↓
3. System retrieves similar historical ads
        ↓
4. Predictive model estimates performance
        ↓
5. Swarm agents review evidence
        ↓
6. Aggregator ranks variants
        ↓
7. Dashboard shows winner, risks, reasons, and next actions
        ↓
8. Copilot answers follow-up questions
```

---

# Implementation plan

## Phase 1: Dataset and scoring foundation

Create the core dataset pipeline.

Tasks:

* Load creative metadata and KPI data.
* Normalize CTR, CVR, spend, CPA/CPI if available.
* Create labels: `high_performer`, `average`, `low_performer`.
* Create fatigue labels if time-series data exists.
* Precompute baseline metrics by country, OS, format, advertiser, and category.
* Build a simple benchmark API.

Output:

```text
For any uploaded creative, we can say:
“Compared to similar historical ads in this context, this looks above/below baseline.”
```

---

## Phase 2: Creative feature extraction

Build an asset analyzer.

For images:

* OCR.
* CTA detection.
* Dominant colors.
* Text density.
* Logo/product/person detection.
* Image embedding.
* Layout features.

For videos:

* Sample 5–10 key frames.
* Run the same image analysis on each frame.
* Add motion/pacing summary.

For the hackathon, you can use a multimodal LLM for fast extraction and combine it with deterministic image processing for obvious features like color, aspect ratio, and text density.

---

## Phase 3: Similarity and clustering

Build the “show me similar creatives” engine.

Use embeddings to cluster creatives by visual similarity:

* Store embeddings in MongoDB Atlas and index them with Atlas Vector Search.
* Retrieve nearest neighbors for each uploaded variant.
* Compare high-performing vs low-performing neighbors.
* Generate pattern summaries.

Example output:

> “Variant B belongs to a cluster of gameplay-first creatives. This cluster historically performs better on Android than iOS, but fatigue appears faster when the CTA and reward framing are too similar.”

This directly maps to the challenge’s clustering and explainability paths.

---

## Phase 4: Predictive model

Train a lightweight model:

Input features:

* Visual features.
* Embedding cluster.
* Country.
* OS.
* Format.
* Category.
* Historical similarity stats.

Output:

* Predicted relative CTR.
* Predicted relative CVR.
* Winner probability.
* Confidence.
* Fatigue risk if time-series data exists.

For speed, start with a simple model and make the explanation better than the model. A clear, honest “confidence medium” is better than fake precision.

---

## Phase 5: Swarm orchestration

Create agents as structured functions.

Recommended swarm flow:

```text
Feature Extractor
    ↓
Benchmark Agent
    ↓
Specialist Agents run in parallel
    ↓
Persona Agents run in parallel
    ↓
Debate / critique round
    ↓
Aggregator Agent
    ↓
Final Report Agent
```

The aggregator should enforce a strict JSON schema:

```json
{
  "winner": "variant_b",
  "ranking": [
    {
      "variantId": "variant_b",
      "score": 86,
      "predictedUplift": "+12%",
      "confidence": "high",
      "action": "test_or_scale",
      "topReasons": [],
      "risks": [],
      "recommendedEdits": []
    }
  ],
  "abTestPlan": {
    "primaryMetric": "CVR",
    "variants": ["variant_b", "variant_c"],
    "hypothesis": "Clearer CTA and lower text density will increase conversion.",
    "trafficSplit": "70/30",
    "stopCondition": "Stop when one variant underperforms baseline for 3 consecutive days or reaches minimum spend threshold."
  }
}
```

---

## Phase 6: React dashboard

The frontend should be the hero of the demo.

Recommended screens:

1. **Campaign Brief**
2. **Creative Upload**
3. **Live Swarm Analysis**
4. **Variant Ranking Dashboard**
5. **Creative X-Ray**
6. **A/B Test Plan**
7. **Copilot Chat**

The UI should make the judges immediately understand the value in 30 seconds.

---

# Development stack

## Frontend

Use **React + Next.js App Router + TypeScript**. React Server Components are designed to render ahead of time in a server environment, and Next.js App Router is built around layouts, navigation, and server/client components, which makes it a strong fit for a dashboard with upload flows, server-side analysis, and streaming AI results. ([React][1])

Recommended frontend tools:

| Need          | Tool                                         |
| ------------- | -------------------------------------------- |
| App framework | Next.js App Router                           |
| UI language   | React + TypeScript                           |
| Styling       | Tailwind CSS                                 |
| Components    | shadcn/ui                                    |
| Charts        | Recharts, Tremor, or Visx                    |
| Uploads       | react-dropzone                               |
| State         | Zustand for local UI state                   |
| Server data   | TanStack Query or React server data patterns |
| Animations    | Framer Motion                                |
| Forms         | React Hook Form + Zod                        |

Tailwind is a good fit because it uses utility classes directly in markup, and shadcn/ui has a documented Next.js setup for component-driven interfaces. ([Tailwind CSS][2])

---

## AI layer

Use **Vercel AI SDK** for streaming and structured outputs in the web app. It supports structured object generation with schemas, which is useful because every swarm agent should return validated JSON rather than free-form text. ([AI SDK][3])

Use **LangGraph** for the multi-agent workflow. Its docs describe workflow and agent patterns, with support for persistence, streaming, debugging, and deployment, which fits the swarm orchestration layer well. ([LangChain Docs][4])

Recommended AI tools:

| Need                    | Tool                        |
| ----------------------- | --------------------------- |
| Agent orchestration     | LangGraph                   |
| AI streaming to UI      | Vercel AI SDK               |
| Output validation       | Zod schemas                 |
| Multimodal analysis     | Vision-capable LLM          |
| Prompt/version tracking | LangSmith or custom logs    |

---

## Backend and data

Use **MongoDB Atlas + Atlas Vector Search** for the hackathon data layer. MongoDB's document model fits creative analysis well because every asset can have different OCR blocks, visual features, layout annotations, model outputs, and agent reviews. Atlas Vector Search lets you store embeddings beside creative metadata and retrieve similar creatives with filters for category, country, OS, format, language, or advertiser context. ([MongoDB Atlas Vector Search][5])

Use the **MongoDB Node.js driver** or **Mongoose** from the Next.js backend. Prefer the native driver for the MVP if you want direct access to aggregation pipelines and `$vectorSearch` without ORM friction. ([MongoDB Node.js Driver][6])

Recommended backend stack:

| Need            | Tool                                                       |
| --------------- | ---------------------------------------------------------- |
| API             | Next.js Route Handlers                                     |
| ML/CV service   | Python FastAPI                                             |
| Database        | MongoDB Atlas                                              |
| Vector search   | Atlas Vector Search                                        |
| Data access     | MongoDB Node.js driver or Mongoose                         |
| File storage    | S3, Vercel Blob, Cloudinary, or another object store        |
| Background jobs | Inngest, Trigger.dev, BullMQ, or Celery                    |
| Cache           | Redis                                                      |
| Deployment      | Vercel for frontend, Railway/Fly/Render for Python service |

---

# Suggested architecture

MongoDB Atlas stores campaign documents, creative metadata, extracted features, metric summaries, agent outputs, and embedding vectors. Atlas Vector Search handles nearest-neighbor creative retrieval with metadata filters, while the actual image/video binaries should live in object storage.

```text
                    ┌──────────────────────────┐
                    │ React / Next.js Frontend │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ Next.js API / Server     │
                    │ - upload handling        │
                    │ - auth/session           │
                    │ - report streaming       │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │ Python CV/ML API │ │ LangGraph Swarm  │ │ MongoDB Atlas    │
   │ feature extract  │ │ agent workflow   │ │ docs + vectors   │
   └──────────────────┘ └──────────────────┘ └──────────────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │ Final Creative Report    │
                    │ ranking, why, actions    │
                    └──────────────────────────┘
```

---

# Data model

Minimum useful MongoDB collections:

```text
experiments
- _id
- user_id
- objective
- category
- country
- language
- os
- status
- created_at
- variants: [
    {
      creative_id,
      label,
      asset_url,
      asset_type,
      format,
      thumbnail_url
    }
  ]

creatives
- _id
- asset_url
- thumbnail_url
- asset_type
- advertiser_id
- campaign_id
- category
- country
- language
- os
- format
- created_at
- features: {
    embedding,
    ocr_text,
    cta_text,
    dominant_colors,
    text_density,
    visual_clutter,
    has_logo,
    has_person,
    has_price,
    has_reward,
    has_gameplay,
    layout_json
  }
- metrics_summary: {
    impressions,
    clicks,
    installs,
    conversions,
    ctr,
    cvr,
    cpi,
    cpa,
    relative_ctr,
    relative_cvr
  }

creative_daily_metrics
- _id
- creative_id
- date
- spend
- impressions
- clicks
- installs
- conversions
- ctr
- cvr
- cpi
- cpa

variant_analyses
- _id
- experiment_id
- creative_id
- predicted_score
- predicted_uplift
- confidence
- fatigue_risk
- recommendation
- ranking_reasons
- risks
- recommended_edits

agent_reviews
- _id
- experiment_id
- creative_id
- agent_name
- agent_type
- scores
- reasoning
- recommendation
- created_at
```

---

# A/B testing output

The MVP should not pretend to have run a real A/B test. It should say:

> “This is a pre-test simulation based on historical creative performance, visual similarity, and persona-agent evaluation.”

Then provide an actual test plan:

| Field            | Example                                               |
| ---------------- | ----------------------------------------------------- |
| Primary metric   | CVR                                                   |
| Secondary metric | CTR                                                   |
| Control          | Existing best creative or Variant A                   |
| Challenger       | Variant B                                             |
| Traffic split    | 50/50 or 70/30 if risk is high                        |
| Hypothesis       | Clearer CTA and lower clutter will improve conversion |
| Stop condition   | Stop after minimum spend or stable performance gap    |
| Action if winner | Scale                                                 |
| Action if loser  | Pivot creative, keep concept                          |

This is much more useful than just saying “B is better.”

---

# Example final report

## Recommended winner: Variant B

**Decision:** Test Variant B first. Use Variant C as challenger. Redesign Variant A.

**Why B wins:**

* CTA is detected quickly.
* Visual hierarchy is cleaner.
* Similar creatives in the historical dataset performed above baseline.
* Persona swarm shows higher clarity and conversion intent.
* Lower text density reduces cognitive load.

**Risks:**

* Similarity to existing winning creatives means fatigue risk is medium.
* Reward message may need clearer terms.
* Localization could be improved for the selected region.

**Recommended edits:**

1. Make the CTA 15–20% larger.
2. Move the reward claim closer to the CTA.
3. Reduce secondary text.
4. Add a stronger first-frame hook.
5. Create one localized copy variant.

**A/B test plan:**

* Launch B vs C.
* Primary metric: CVR.
* Secondary metric: CTR.
* Use B as main variant and C as challenger.
* Monitor fatigue after the first spend threshold or after several days of declining CTR/CVR.

---

# Why this idea can win

Your idea is strong because it gives the judges something more memorable than a normal dashboard:

**A marketer does not just see charts. They watches a swarm of simulated customers, creative experts, and data analysts debate the ad, then receives a practical decision.**

It maps well to the evaluation criteria:

| Challenge criterion     | How your idea satisfies it                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| Usefulness              | Gives scale/test/edit/pivot decisions                                          |
| Clarity                 | Ranks variants and explains why                                                |
| Technical quality       | Uses embeddings, visual features, KPI normalization, agents, and vector search |
| Creativity              | AI swarm with personalities is demo-friendly and surprising                    |
| Bonus visionary insight | Combines image analysis with performance data to explain the “why”             |

The best pitch framing:

> **“Smadex helps advertisers know which creatives performed. Creative Swarm Copilot helps them understand why, predict what to test next, and avoid wasting spend on creatives that are about to fatigue.”**

[1]: https://react.dev/reference/rsc/server-components?utm_source=chatgpt.com "Server Components"
[2]: https://tailwindcss.com/docs/styling-with-utility-classes?utm_source=chatgpt.com "Styling with utility classes - Core concepts"
[3]: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data?utm_source=chatgpt.com "Generating Structured Data"
[4]: https://docs.langchain.com/oss/python/langgraph/workflows-agents?utm_source=chatgpt.com "Workflows and agents - Docs by LangChain"
[5]: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/ "MongoDB Atlas Vector Search overview"
[6]: https://www.mongodb.com/docs/drivers/node/current/ "MongoDB Node.js Driver"
