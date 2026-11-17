# Supabase Database Keep-Alive & Activity Monitoring System

This document outlines the architecture, setup, operation, and troubleshooting for the automated Supabase Database Keep-Alive & Health Check system implemented in the **Joint Family Expense & Business Ledger** project.

---

## 1. Overview & Objectives

Supabase Free Plan projects may be paused automatically after approximately 7 days of inactivity. To reduce the risk of unexpected database pausing and ensure system availability, this project integrates a lightweight, read-only health-check mechanism:

* **Pure Read-Only:** Executes `SELECT 1 AS alive, current_timestamp AS server_time, version() AS pg_version` to verify connectivity without writing, mutating, or locking any business records.
* **Zero Overhead:** Connects via SQLAlchemy connection pooling directly to Supabase (`pooler.supabase.com:5432`), verifies latency, and disconnects cleanly.
* **Security & Credential Protection:** All connection strings and passwords are automatically masked (`***`) before being logged to the terminal or CI step summaries.
* **Scheduled Automation:** Runs automatically every 24 hours via GitHub Actions, with support for manual triggers (`workflow_dispatch`).

> [!IMPORTANT]
> **Supabase Free Plan Limitation:** While periodic database queries actively communicate with the database pooler and maintain activity, **automated keep-alive scripts do not guarantee that Supabase will never pause a project**. Supabase retains full control over its free-tier pause policies and criteria for meaningful usage. Always maintain periodic backups and keep local copies of data files (`.csv` files, schema definitions, etc.).

---

## 2. Architecture & Components

```
┌─────────────────────────────────────────────────────────────┐
│                       GitHub Actions                         │
│   Schedule (Every 24h: 06:00 UTC) / Manual Trigger          │
│   File: .github/workflows/supabase-keepalive.yml           │
└──────────────────────────────┬──────────────────────────────┘
                               │ Reads secrets.DATABASE_URL
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python Health-Check Runner                  │
│   File: scripts/supabase_health_check.py                    │
│   - Resolves connection URL from env or backend/.env        │
│   - Masks secrets & validates credentials                   │
│   - Enforces 15-second connection timeout                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Lightweight read-only query
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL Pooler                  │
│   Host: aws-1-ap-south-1.pooler.supabase.com:5432           │
│   Query: SELECT 1                                           │
└─────────────────────────────────────────────────────────────┘
```

### Files Created:
1. **[scripts/supabase_health_check.py](file:///d:/python/HOME%20PROJECT%20Vadsak/scripts/supabase_health_check.py)**: Standalone Python keep-alive script.
2. **[.github/workflows/supabase-keepalive.yml](file:///d:/python/HOME%20PROJECT%20Vadsak/.github/workflows/supabase-keepalive.yml)**: GitHub Actions workflow with cron scheduling and job summary reporting.
3. **[docs/SUPABASE_KEEPALIVE.md](file:///d:/python/HOME%20PROJECT%20Vadsak/docs/SUPABASE_KEEPALIVE.md)**: System guide and troubleshooting documentation.

---

## 3. GitHub Actions Setup Guide

### Step 1: Configure Repository Secret

1. Open your repository on GitHub.
2. Navigate to **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Set the secret details:
   * **Name**: `DATABASE_URL`
   * **Secret**: Paste your Supabase PostgreSQL connection string:
     ```text
     postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
     ```
     *(Example: `postgresql://postgres.dwxhefobwqieixekqovk:YourPassword@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`)*
5. Click **Add secret**.

### Step 2: Enable GitHub Actions

1. In your GitHub repository, click on the **Actions** tab.
2. If actions are disabled, click **I understand my workflows, go ahead and enable them**.
3. You will see **Supabase Database Keep-Alive & Health Check** listed in the left sidebar.

### Step 3: Run Workflow Manually (`workflow_dispatch`)

1. In GitHub, go to the **Actions** tab.
2. Under "Workflows" on the left, click **Supabase Database Keep-Alive & Health Check**.
3. Click the **Run workflow** dropdown on the right.
4. Select the branch (e.g., `main` or `master`) and click **Run workflow**.
5. The job will start within seconds and display a green checkmark upon success.

---

## 4. Local Execution & Testing

You can run the health check script locally from your development machine at any time:

### Standard Run (Reads from `backend/.env` automatically):
```bash
python scripts/supabase_health_check.py
```

**Expected Output:**
```text
2026-11-17 13:36:25 [INFO] Initiating Supabase Keep-Alive Health Check...
2026-11-17 13:36:25 [INFO] Target: postgresql://postgres.dwxhefobwqieixekqovk:***@aws-1-ap-south-1.pooler.supabase.com:5432/postgres (resolved from .env file (.env))
2026-11-17 13:36:25 [INFO] Timeout: 15 seconds
2026-11-17 13:36:28 [INFO] ✅ Supabase database is REACHABLE and ACTIVE!
2026-11-17 13:36:28 [INFO] Server Time: 2026-11-17 08:06:42.727574+00:00
2026-11-17 13:36:28 [INFO] Engine: PostgreSQL 17.6
2026-11-17 13:36:28 [INFO] Latency: Connect 789.43ms | Query 125.73ms | Total 1145.19ms
```

### JSON Mode (For automated pipelines):
```bash
python scripts/supabase_health_check.py --json
```

**Output:**
```json
{
  "status": "healthy",
  "alive": true,
  "target": "postgresql://postgres.dwxhefobwqieixekqovk:***@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  "server_time": "2026-11-17 08:06:56.650844+00:00",
  "pg_version": "PostgreSQL 17.6",
  "connect_latency_ms": 646.52,
  "query_latency_ms": 81.65,
  "total_latency_ms": 861.16,
  "timestamp_utc": "2026-11-17T08:06:42.352103+00:00",
  "error": null
}
```

### Custom Timeout:
```bash
python scripts/supabase_health_check.py --timeout 10
```

---

## 5. Live FastAPI Health Check Endpoint

In addition to the standalone script and GitHub Actions workflow, the FastAPI backend also exposes live HTTP health endpoints:

* **Endpoint**: `GET /health` or `GET /api/health`
* **Response**:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "latency_ms": 55.71,
    "timestamp": "2026-11-17T08:13:09.390534"
  }
  ```
Whenever this endpoint is called (e.g., by an uptime monitor like UptimeRobot, Render health check, or BetterStack), it actively runs `SELECT 1` on Supabase and reports latency.

---

## 6. How to Inspect Execution Logs

### On GitHub Actions:
1. Go to the **Actions** tab in your repository.
2. Click on the latest run of **Supabase Database Keep-Alive & Health Check**.
3. In the summary page, view the **🛡️ Supabase Keep-Alive Health Check Report** markdown table displaying:
   * **Target Database** (masked)
   * **PostgreSQL Engine Version**
   * **Server Time (UTC)**
   * **Total Latency**
   * **Timestamp**
4. Click into the **health-check** job step `Execute Supabase Keep-Alive Health Check` to view stdout logs.

---

## 7. Troubleshooting Connection Failures

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| `Missing database connection URL` | Neither `DATABASE_URL` nor `.env` was found | Add `DATABASE_URL` to GitHub Repository Secrets or ensure `backend/.env` exists locally. |
| `OperationalError: connection to server failed: timeout expired` | Network connectivity issue or firewall block | Verify that port 5432/6543 outbound is permitted. Increase timeout via `--timeout 30`. |
| `password authentication failed for user` | Supabase database password was rotated or incorrect | Reset your database password in Supabase Dashboard (**Settings** > **Database** > **Database Password**) and update `DATABASE_URL`. |
| `Tenant or user not found` | Incorrect project reference in database username | Check username format: `postgres.<project-ref>`. Verify against Supabase Connection Pooler settings. |
| Project paused | Supabase paused the project due to inactivity | Log in to the Supabase dashboard and click **Restore project**. Once restored, the keep-alive script will resume successful checks. |

---

## 8. How to Disable the Automation

If you ever wish to disable this keep-alive automation:
1. **Temporarily Disable via GitHub UI**:
   * Go to **Actions** > Select **Supabase Database Keep-Alive & Health Check**.
   * Click the **...** menu in the top-right corner.
   * Click **Disable workflow**.
2. **Permanently Remove**:
   * Delete `.github/workflows/supabase-keepalive.yml` or comment out the `schedule` cron block.
