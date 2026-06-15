# 📈 TradeAI — Terminal Quantitativo de Investimentos

Sistema privado e automatizado de inteligência de mercado, rastreamento de tendências e arbitragem estatística por reversão à média. O **TradeAI** varre o mercado nacional (B3) e internacional em busca de distorções de preço, pânico sistêmico e gatilhos técnicos de entrada.

---

## 🏗️ Arquitetura do Ecossistema

O projeto é dividido em duas frentes independentes e conectadas:
* **Frontend (Este repositório):** Dashboard de alta fidelidade construído em React 19 + Vite 8 com tema Bloomberg/Terminal Dark.
* **Backend (Repositório irmão):** Engine em Python rodando com FastAPI no Railway, integrada ao banco de dados PostgreSQL e modelos de IA (OpenAI e Claude 3.5 Sonnet).

---

## 📡 Módulos do Terminal

* **🌎 Sinais do Mercado (Swing Tradicional):** Rastreador de tendência de médio/longo prazo baseado em médias móveis exponenciais (MME20/MMA200) e cálculo de risco por ATR.
* **⚡ Swing Rápido:** Algoritmo quantitativo focado em **Reversão à Média (Mean Reversion)**. Monitora pânico técnico através da calibragem combinada de RSI esmagado ($\le 38/42$) e explosão de volume institucional ($\ge 130/150\%$).
* **💼 Portfólio Persistente:** Módulo integrado diretamente ao banco de dados PostgreSQL. Segrega patrimônio nominal, lucros flutuantes e históricos de trades de forma isolada por moeda (R$ e US$).
* **📰 Notícias:** Hub de clipping que mapeia e avalia o sentimento do mercado via IA para validar se uma queda é um susto sistêmico ou quebra de fundamentos.
* **🤖 IA Análise:** Chat de contexto integrado ao modelo Claude para auditoria de ativos sob demanda.

---

## 🛠️ Como Executar o Dashboard Localmente

### 1. Pré-requisitos
Certifique-se de ter o **Node.js** instalado no seu MacBook.

### 2. Configurar as Variáveis de Ambiente
Crie um arquivo `.env` na raiz deste diretório (este arquivo está blindado pelo `.gitignore` e não sobe para o GitHub):
```text
VITE_API_URL=[https://sua-url-do-backend.up.railway.app](https://sua-url-do-backend.up.railway.app)
VITE_TRADEAI_API_KEY=sua_chave_secreta_aqui