# Smadex Challenge — Requirements & Constraints

## Core Challenge

**Build the next Creative Copilot for mobile advertisers.**

The product should turn:

* **Raw ad assets**
* **Performance data**

into:

* **Actionable insights**
* **Clear recommendations**
* **Decision-support for marketers**

The overall goal is to **bridge visual assets and KPIs**.

---

## Problem Context

### The “Creative Fatigue” Crisis

Smadex describes the problem as a creative fatigue crisis with three main issues:

### 1. The Scale

There are **thousands of ads across 36+ advertisers** that need constant monitoring.

### 2. The Decay

Ads lose effectiveness over time, which can cost **thousands in wasted spend**.

### 3. The Black Box

Marketers know **what failed**, but they do not know **why**.

The data lacks **visual context**, meaning performance metrics alone are not enough.

---

## What Is a “Creative”?

The PDF shows “creative” as mobile advertising assets, including examples such as:

* Static mobile ad images
* Video-like mobile ads
* App install ads
* Game ads
* Finance/crypto ads
* Lottery/casino-style ads
* Recipe/app ads
* Ads with CTAs like “Download Now,” “Play Now,” “Join Now,” and “Get the App”

So, in this challenge, a creative should be understood as the **visual/video ad asset shown to users**, often combined with performance data.

---

# Mission: Choose a Path

The PDF says: **“Pick your Poison”** and **“Choose Your Path.”**

The project does not need to solve every possible problem. Teams can focus on one or more of these paths:

## 1. Performance Explorer

Build cross-dimension analysis across:

* Country
* OS
* Format

Purpose: help marketers understand how creative performance changes across different campaign dimensions.

---

## 2. Fatigue Detection

Predict when a creative is about to **“die.”**

This means identifying when an ad is losing effectiveness and should potentially be paused, refreshed, or replaced.

---

## 3. Explainability

Use **Computer Vision / LLMs** to explain why an image works.

The tool should connect visual features of the creative with performance outcomes.

---

## 4. Recommendation

Provide suggestions such as:

* Scale
* Pause
* Pivot

The key is to turn analysis into clear marketer actions.

---

## 5. Clustering

Group creatives by **visual similarity** to find patterns.

This could help marketers discover which types of visuals perform similarly or fatigue together.

---

# Example Path: Fatigue Detection

## Example Input

### Time-series performance data

Includes:

* Daily spend
* CTR
* CVR

### Creative metadata

Includes:

* Campaign start date
* Historical benchmarks

## Example Pipeline

Use a model or anomaly detection method to identify when performance drops below a standard deviation relative to launch.

## Example Output

### Actionable Insight

A **“Creative Health” score**, from **0–100%**.

### Recommendation

A suggestion such as:

* “Pause ad”
* “Pivot creative”

---

# Example Path: Explainability

## Example Input

### Raw Image / Video Assets

The actual creative content.

### Performance Metrics

Labels or metrics separating:

* High-performing creatives
* Low-performing creatives

based on KPI data.

## Example Pipeline

Use a Computer Vision model to extract visual features such as:

* CTA button color
* Text density

Then feed those visual features into an LLM to generate a natural-language explanation.

## Example Output

### Insight

Example from the PDF:

Ads with **“Play Now” buttons in neon green** perform **15% better** in this category.

### AI Copilot Chat

A conversational answer explaining why a specific asset is successful.

---

# Prototype & Demo Requirements

The demo should show **how a marketer uses the tool**.

The output can take different forms.

## Acceptable Output Formats

### 1. Interactive Web App

A dashboard interface for real-time campaign management.

### 2. AI Copilot

A conversational assistant for rapid insight generation.

### 3. Data Storytelling

Interactive notebooks explaining the **“why”** behind performance.

---

# Product Focus

The PDF explicitly says to focus on:

## Usability & Decision-Support

Prioritize **clear actions** over **black-box complexity**.

This means the solution should not only produce models, charts, or predictions. It should help a marketer decide what to do next.

The PDF also says:

**“But above all: surprise us! Be creative!”**

---

# Evaluation Criteria

## 1. Usefulness

Does it help an advertiser make a better decision?

Examples of decisions:

* Scale
* Pause
* Pivot

## 2. Clarity

Are the insights easy to understand at a glance through an app or notebook?

## 3. Technical Quality

Is the architecture smart enough to handle:

* Thousands of ads
* Hundreds of advertisers

## 4. Creativity

Does the solution surprise the user with novel features or visionary storytelling?

## Bonus: Visionary Insight

Combine **image analysis** with **performance data** to unlock the **“why.”**

The PDF frames this as bridging the gap between:

* The Creative Director
* The Data Scientist

---

# Practical Constraints for What We Should Build

From the PDF, the solution should likely satisfy these constraints:

1. It should be designed for **mobile advertisers**.
2. It should use both **creative assets** and **performance data**.
3. It should provide **actionable recommendations**, not just analysis.
4. It should support creative-level decision-making, especially around **fatigue**, **performance**, and **why something works**.
5. It should scale conceptually to **thousands of ads** and **hundreds of advertisers**.
6. It should be understandable by marketers at a glance.
7. It should avoid being a pure black-box ML system.
8. It should preferably include visual analysis, LLM explanation, or both.
9. It should demonstrate a clear marketer workflow.
10. It should be creative or surprising in presentation, features, or storytelling.

---

# Build Target Summary

The most faithful interpretation of the challenge is:

**Build a marketer-facing Creative Intelligence Copilot that analyzes mobile ad creatives and KPI data, detects performance issues or opportunities, explains visual-performance relationships, and recommends whether to scale, pause, or pivot each creative.**
