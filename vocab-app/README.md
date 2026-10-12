# 📚 Spaced — 智慧英語單字學習工作站 / Intelligent Vocabulary App

> **Spaced** 是一套專為深度學習者打造的現代化智慧英語學習工作站，整合多源權威字典、FSRS 間隔重複演算法、AI 字根拆解與語境情境故事。
>
> **Spaced** is a modern intelligent English learning workstation built for serious learners, integrating multi-source authoritative dictionaries, the FSRS spaced repetition algorithm, AI-powered etymology breakdowns, and contextual story generation.

---

[![Launch App](https://img.shields.io/badge/Launch_App-Spaced_Web-6366F1?style=for-the-badge&logo=vercel&logoColor=white)](https://vocab-app-beta-blush.vercel.app/#)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Algorithm](https://img.shields.io/badge/Spaced_Repetition-FSRS_v5-FF6B6B)](https://github.com/open-spaced-repetition/fsrs4anki)
[![AI Engine](https://img.shields.io/badge/AI_Engine-Groq_LLM-F55036)](https://groq.com/)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-red.svg)](#-授權條款--license)

---

## 🌐 產品線上服務入口 / Live Web Application

**Spaced** 為已正式上線運行的完整 Web 應用程式。無須安裝任何軟體或配置後端，點擊下方入口連結即可直接開始使用完整的個人化英語單字學習工作站（已針對桌面端多欄位操作與手機行動瀏覽全盤優化）：

**Spaced** is a fully functional, production-ready web application running live. No local installation or backend configuration required—click the link below to enter your personal English learning workstation directly (fully responsive and optimized for both desktop multi-column layouts and mobile screens):

👉 **[進入 Spaced 線上應用程式 / Open Spaced Web Application](https://vocab-app-beta-blush.vercel.app/#)**

---

## 💡 為什麼打造這款應用？ / Why This App?

傳統單字軟體往往流於死記硬背，查閱、收集、發音與複習各階段嚴重割裂。本專案將「權威查詞、AI 深度記憶輔助、無變調調速發音、科學間隔複習」無縫串接，打造流暢且符合認知科學的個人化單字學習系統。

Traditional vocabulary tools often reduce learning to mindless memorization, leaving search, collection, pronunciation, and review disconnected. This application bridges that gap by seamlessly unifying authoritative dictionary lookups, AI memory scaffolding, pitch-preserving speed-controlled audio, and scientifically proven spaced repetition into a cohesive, cognitive-friendly workspace.

---

## ✨ 核心特色與亮點 / Key Features & Highlights

### 1. 🔍 多源權威字典與雙向智慧查詢 / Multi-Source Dictionaries & Smart Bidirectional Search
- **多字典源即時切換**：內建劍橋詞典（Cambridge Dictionary）、Yahoo 奇摩字典、Google 翻譯，涵蓋詳細詞性、CEFR 分級標籤（A1–C2）、音標與實用例句。
- **中英雙向智慧辨識**：輸入中文即可自動調用翻譯並匹配出最精確的英文候選詞，點擊即直接調出完整單字卡。
- **毫秒級即時聯想詞**：整合 Supabase 全文/前綴匹配資料庫與 Datamuse API，輸入 2 個字母即精準預測推薦。

- **Instant Multi-Source Switching**: Built-in integration with Cambridge Dictionary, Yahoo Dictionary, and Google Translate, complete with parts of speech, CEFR levels (A1–C2), IPA phonetics, and contextual sentences.
- **Smart Bidirectional Detection**: Enter Chinese directly; the system automatically translates, extracts English candidate keywords, and navigates straight into comprehensive word entries.
- **Low-Latency Predictive Suggestions**: Combines Supabase full-text/prefix matching with the Datamuse API to deliver accurate autocompletion after just 2 characters.

---

### 2. 🧠 AI 字根詞綴拆解與記憶輔助 / AI Etymology & Mnemonic Engine
- **結構化詞根拆解**：由 Groq 高速 LLM 自動將單字拆解為「前綴 (Prefix) + 字根 (Root) + 字尾 (Suffix)」，並標註各自涵義，掌握構詞規律。
- **生動聯想記憶法**：針對抽象詞彙自動生成情境記憶提示與聯想故事，大幅降低背誦門檻。

- **Structured Morphological Breakdown**: Powered by ultra-fast Groq LLMs, words are automatically decomposed into Prefix, Root, and Suffix components alongside their individual etymological meanings.
- **Vivid Memory Aids**: Generates mnemonic associations and contextual imagery for challenging vocabulary, substantially reducing memory fatigue.

---

### 3. 📈 FSRS 科學間隔重複複習 / FSRS-Powered Spaced Repetition (SRS)
- **新世代排程演算法**：採用比傳統 SuperMemo SM-2 / Anki 更精準的 **FSRS (Free Spaced Repetition Scheduler)** 演算法，動態計算單字記憶穩定度 (Stability) 與可提取度 (Retrievability)，並具備防堆疊擾動 (Fuzzing) 機制。
- **四大互動複習模式**：
  - 🗂️ **翻卡記憶 (Flashcard)**：經典雙面卡片，支援「Again / Hard / Good / Easy」四級評分。
  - ✍️ **拼寫測驗 (Spelling)**：透過詞義與例句遮蔽鍛鍊主動回想與精準拼字。
  - 🧩 **克漏字 (Cloze)**：真實語境挖空填詞，強化上下文語感理解。
  - 🎧 **聽寫模式 (Dictation)**：純聽力輸入檢測，徹底打通發音與文字連結。

- **Next-Gen Scheduling Algorithm**: Powered by the modern **FSRS (Free Spaced Repetition Scheduler)** algorithm (superior to legacy SM-2), optimizing review intervals based on memory stability and retrievability with anti-bunching fuzzing.
- **Four Interactive Review Modes**:
  - 🗂️ **Flashcard**: Classic dual-sided card interface with four standard rating levels (Again, Hard, Good, Easy).
  - ✍️ **Spelling**: Practice active recall and typo-free typing guided by definitions and masked sentences.
  - 🧩 **Cloze Deletion**: Fill-in-the-blank challenges inside authentic example sentences to master usage in context.
  - 🎧 **Dictation**: Pure auditory recall to reinforce the neuromuscular link between phonetics and orthography.

---

### 4. 🎧 SoundTouch 無變調調速發音 / Pitch-Preserved Audio Playback
- **原生發音串流**：直連權威母語真人發音（美式 US / 英式 UK 音源），伺服端自動處理 CORS 音訊代理。
- **SoundTouchJS 演算法調速**：自由調節播放速率（0.7x ~ 1.5x），採用 Web Audio 緩衝時域延展演算法，放慢速度時**完全不變調**（告別機器變聲與小鴨音）。
- **Web Speech 雙軌備援**：支援本機語音合成 (TTS) 與多口音切換，離線或特殊詞彙也能清晰朗讀。

- **Authentic Native Audio Streams**: Direct streaming of human US/UK pronunciations, powered by serverless CORS-compliant audio proxying.
- **Pitch-Preserved Time-Stretching via SoundTouchJS**: Smoothly adjust playback speed (0.7x to 1.5x) using time-domain stretching over Web Audio buffers—slowing down audio with **zero pitch distortion** (no cartoon chipmunk effect).
- **Dual-Track Fallback**: Seamless fallback to native browser Web Speech API (TTS) across multiple voice accents.

---

### 5. 📖 AI 語境情境故事生成 / AI Contextual Vocabulary Story
- **單字串聯成篇**：在單字庫中自由勾選多個單字，AI 一鍵將其串聯成一篇流暢、道地、趣味的英文短篇故事。
- **沉浸式閱聽體驗**：支援一鍵全文語音朗讀與生詞高亮，在完整篇章中自然吸收單字用法。

- **Contextual Narrative Weaving**: Select multiple words from your library and let AI weave them into an engaging, cohesive story demonstrating practical usage.
- **Immersive Read-Along**: Features full-text text-to-speech narration and bolded target keywords for comprehensive contextual retention.

---

### 6. 🗂️ 靈活單字庫與流暢交互 / Flexible Library & Smooth Interactions
- **資料夾自訂分組**：支援自訂顏色、圖示與備註標籤，自由建構專屬單字本。
- **拖曳排序與批次操作**：整合 `@dnd-kit` 流暢拖曳排序，支援框選、跨本搬移與批次刪除。
- **全方位多語系 (i18n)**：完整支援繁體中文 (`zh-TW`) 與英文 (`en`) 介面即時無縫切換。

- **Custom Folders & Tagging**: Organize vocabularies with custom accent colors, icons, and metadata notes.
- **Drag-and-Drop & Batch Actions**: Fluid drag reordering via `@dnd-kit`, coupled with drag-to-select, cross-folder migration, and bulk deletion.
- **Full Internationalization (i18n)**：Instant toggle between Traditional Chinese (`zh-TW`) and English (`en`).

---

## 🛠️ 技術架構 / Technical Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    React 19 Frontend                        │
│  Vite 7 • Tailwind CSS v4 • Lucide React • Headless UI      │
│  @dnd-kit (DND) • ts-fsrs (SRS) • SoundTouchJS (Web Audio)  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Vercel Serverless APIs     │ │     Supabase Backend       │
│  • /api/dictionary (Scraper) │ │  • PostgreSQL Database     │
│  • /api/proxy-audio (CORS)   │ │  • Row Level Security (RLS)│
│  • Google / Yahoo / Cambridge│ │  • Supabase Edge Functions │
└──────────────────────────────┘ └──────────────┬─────────────┘
                                                │
                                                ▼
                                 ┌────────────────────────────┐
                                 │       Groq AI Engine       │
                                 │  • Fast LLM Inference      │
                                 │  • Etymology & Storyteller │
                                 └────────────────────────────┘
```

| 層級 / Layer | 技術方案 / Technologies | 說明 / Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 7 | 頂級效能 SPA 架構，瞬時 HMR 與快取最佳化 / High-performance SPA with instant HMR |
| **Styling** | Tailwind CSS v4 | 全新高效能引擎樣式系統 / Next-gen modern utility-first CSS |
| **SRS Engine**| `ts-fsrs` | Free Spaced Repetition Scheduler 演算法實作 / Modern cognitive spaced-repetition algorithm |
| **Audio** | Web Audio API + SoundTouchJS | 保真無變調調速音訊處理 / Pitch-preserved time-stretching audio pipeline |
| **Backend** | Supabase (PostgreSQL + Auth) | 具備 RLS 安全性策略與雲端同步 / Managed database with strict RLS and sync |
| **Serverless**| Vercel Serverless Functions | Cheerio 字典抓取器與音訊串流反向代理 / Node.js scrapers and audio proxy |
| **AI LLM** | Groq Cloud API | 超低延遲大語言模型推理 / Blazing-fast inference for etymology & stories |

---

## 💻 本機開發與工程規範 / Local Development & Engineering Specs

<details>
<summary>點擊展開本機建置與開發說明 / Click to expand build & dev instructions</summary>

### 1. 前置依賴 / Prerequisites
- Node.js `>= 18.0.0`
- npm `>= 9.0.0`

### 2. 安裝與執行 / Setup & Run

```bash
# 複製專案庫 / Clone repository
git clone https://github.com/PolarBear1017/Spaced.git
cd Spaced

# 安裝依賴項 / Install dependencies
npm install
npm --prefix vocab-app install

# 啟動開發伺服器 / Start dev server
npm run dev

# 專案打包建置 / Production build
npm run build
```

### 3. 環境變數 / Environment Variables
於專案目錄建立 `.env.local`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

</details>

---

## 📬 反饋與建議 / Feedback & Suggestions

如果您在體驗過程中有任何想法、改進建議或遇到異常，歡迎至 GitHub Issues 提出討論！

Feel free to open an issue on GitHub for feedback, feature requests, or bug reports!

---

## 📄 授權條款 / License

版權所有 © 2026 PolarBear1017。保留所有權利。本專案原始碼僅供個人學習、研究與作品展示使用。未經作者書面授權，禁止將本專案用於任何商業用途、重新分發或二次封裝銷售。

Copyright © 2026 PolarBear1017. All rights reserved. This source code is provided solely for personal learning, research, and portfolio demonstration purposes. Unauthorized commercial use, redistribution, or repackaging for sale without explicit written permission from the author is strictly prohibited.
