# Fix & Flow - Full Automation System

## 🚀 Project Overview

Build a scalable automation system that posts service listings on Facebook Marketplace using multiple accounts, rotating content, proxies, and schedules. The system must mimic human behavior and avoid detection.

---

## 🧱 Tech Stack

### Backend

* Node.js (TypeScript)
* Express.js

### Automation

* Playwright (browser automation)

### Database

* PostgreSQL

### Queue System

* Redis
* BullMQ

### Frontend (Admin Panel)

* Next.js
* Tailwind CSS

### DevOps

* Docker
* PM2

---

## 📁 Folder Structure (MANDATORY)

```
fix-and-flow/
│
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── modules/
│   │   │   │   ├── accounts/
│   │   │   │   ├── proxies/
│   │   │   │   ├── content/
│   │   │   │   ├── posting/
│   │   │   │   ├── scheduler/
│   │   │   │   ├── inbox/
│   │   │   │   └── analytics/
│   │   │   ├── services/
│   │   │   ├── jobs/
│   │   │   ├── utils/
│   │   │   ├── db/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │
│   ├── frontend/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── styles/
│
├── packages/
│   ├── shared/
│   ├── types/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│
├── .env
├── docker-compose.yml
└── README.md
```

---

## 🧠 Core Modules

### 1. Account Manager

* Store Facebook accounts securely
* Use cookies instead of repeated login
* Detect banned/flagged accounts

### 2. Proxy Manager

* Assign 1 proxy per account
* Support residential proxies
* Rotate IPs carefully

### 3. Content Engine

* Rotate:

  * Titles
  * Descriptions
  * Images
* Avoid duplicate posting patterns

### 4. Posting Engine (Playwright)

* Simulate human behavior:

  * random delays
  * mouse movement
  * typing simulation
* Steps:

  1. Open Facebook
  2. Navigate to Marketplace
  3. Create listing
  4. Upload images
  5. Publish

### 5. Scheduler (BullMQ)

* Max 3–5 posts/day/account
* Random intervals
* Queue-based job system

### 6. Inbox Automation

* Read incoming messages
* Auto-reply with templates
* Convert leads to calls

### 7. Admin Dashboard

* Manage:

  * accounts
  * proxies
  * posts
  * logs
  * cities

---

## 🗄️ Database Design (High-Level)

Tables:

* users
* accounts
* proxies
* posts
* messages
* logs
* schedules

---

## ⚙️ Coding Standards

* Use TypeScript strictly
* Modular architecture
* Use service layer pattern
* Use repository pattern for DB
* Environment-based configs
* Error handling middleware
* Logging system (Winston or Pino)

---

## 🔐 Security

* Encrypt sensitive data (AES)
* Never store plain passwords
* Proxy authentication support

---

## 🤖 Anti-Detection Strategy

* Random delays (2–10 sec)
* Random typing speed
* Rotate user agents
* Use real browser (not headless when needed)
* Avoid repetitive actions

---

## 🧪 Development Phases

### Phase 1

* Setup backend
* Setup DB
* Setup Redis

### Phase 2

* Implement Playwright bot (basic posting)

### Phase 3

* Add proxy + account system

### Phase 4

* Add scheduler (BullMQ)

### Phase 5

* Inbox automation

### Phase 6

* Build frontend dashboard

---

## 🐳 Deployment

* Use Docker containers
* Separate services:

  * backend
  * redis
  * postgres
* Use PM2 for process management

---

## ⚠️ Important Notes

* System must be scalable
* Avoid tight coupling
* Follow clean architecture
* Write reusable services
* Logs must be detailed

---

## 🎯 Goal

Build a production-grade automation system that behaves like a human and generates leads reliably without detection.
