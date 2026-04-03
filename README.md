# ESA

ESA (Engaging Study Assistant) turns raw study material into narrated slides with built-in Q&A and self-test prompts.

It is designed for students who want a faster way to turn dense notes, pasted text, Markdown, HTML, or PDFs into something they can actually review.

ESA is intentionally Ollama-first. No paid API keys are required.

## What It Does

- Upload a `.txt`, `.md`, `.html`, or `.pdf` file, or paste raw study material directly
- Split the content into sections and score how complex each section is
- Simplify difficult sections when needed
- Generate presentation-style slides with examples, speaker notes, and optional self-test questions
- Let the user ask follow-up questions and insert gap-fill slides on the fly
- Read slide narration aloud with the browser's built-in text-to-speech support
- Save sessions locally in the browser so study decks persist across refreshes

## How It Works

ESA is a React + Vite frontend that talks to an Ollama-compatible chat endpoint.

The flow is:

1. Parse the uploaded or pasted content
2. Break it into sections
3. Ask the model to score section complexity
4. Optionally simplify harder sections
5. Generate a slide deck with speaker notes
6. Let the user review, listen, and ask questions

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Install Ollama and pull the project model

The easiest path for new joiners is:

```bash
npm run setup:ollama
```

That setup script:

- installs Ollama with the official installer on macOS or Linux if it is missing
- starts Ollama if it is not already running
- pulls the model used by this project

If you prefer doing it manually:

```bash
ollama pull openvoid/Void-Gemini
ollama serve
```

Windows note:

- install Ollama from the official Windows download page
- then run `ollama pull openvoid/Void-Gemini`
- then start the Ollama app or background service

### 3. Configure the app

Create a local env file only if you want to override the defaults:

```bash
cp .env.example .env.local
```

Default values:

- `VITE_OLLAMA_MODEL=openvoid/Void-Gemini`
- `VITE_OLLAMA_BASE_URL=/api/ollama`
- `OLLAMA_PROXY_TARGET=http://localhost:11434`

For local development, the Vite dev server proxies `/api/ollama` to your local Ollama instance.

### 4. Start the app

```bash
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

## Supported Inputs

- Plain text
- Markdown
- HTML
- PDF

## Study Modes

- `Quick Prep`: short review and key ideas
- `Revision`: balanced explanations plus self-test prompts
- `Deep Dive`: fuller explanations, examples, and longer speaker notes

## Project Structure

```text
src/
  components/    UI building blocks
  pipeline/      document -> slide orchestration
  services/      Ollama, parsing, search, and TTS helpers
  assets/        static visuals
public/          public assets such as icons
```

## Privacy

- Sessions are stored in the browser with `localStorage`
- The repo no longer writes study sessions to a tracked file
- There are no API keys checked into this project
- If you paste sensitive notes into the app, treat them as local browser data on that machine

## Publishing And Sharing

This repo is easy to share on GitHub and demo on X as a local-first AI study tool.

If you want other people to run it locally:

- they need Node.js
- they need Ollama
- they need an installed model such as `openvoid/Void-Gemini`
- they do not need any paid API key

If you want to host it publicly:

- the frontend still needs access to an Ollama-compatible backend
- the cleanest setup is a same-origin proxy that exposes `/api/ollama`
- if you point `VITE_OLLAMA_BASE_URL` at a remote endpoint directly, that endpoint must allow browser access

Static hosting by itself is not enough unless you also provide the model backend.

## Troubleshooting

### "Cannot connect to the Ollama endpoint"

Check that:

- `ollama serve` is running
- your proxy target is correct
- the app can reach the configured `VITE_OLLAMA_BASE_URL`

### "Model not found"

Pull the configured model:

```bash
ollama pull openvoid/Void-Gemini
```

Or update `VITE_OLLAMA_MODEL` in `.env.local`.

### PDF parsing issues

Some PDFs with scanned pages, unusual formatting, or passwords may fail to parse cleanly.

## Tech Stack

- React 19
- Vite
- Ollama-compatible chat API
- `pdfjs-dist` for PDF parsing
- Browser Web Speech API for narration

## Current Limitations

- The quality of generated slides depends heavily on the chosen model
- Search enrichment is best-effort and may fail silently if the external request is blocked
- Browser text-to-speech quality depends on the voices installed on the user's device

## Why This Repo Exists

The goal is simple: make study material less painful to review by turning static content into something more interactive, audible, and easier to revisit.
