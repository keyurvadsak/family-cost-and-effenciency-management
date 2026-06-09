# Joint Family Expense & Business Ledger Walkthrough

A high-fidelity financial ledger application built with **React, TypeScript, Vite** (frontend) and **FastAPI** (backend) backed by a **PostgreSQL** database.

---

## Technical Architecture Overview

The codebase is split into two clean modules under `d:/HOME/`:

### 1. Python FastAPI Backend (`backend/`)
- **Web Server**: FastAPI exposes secure REST API endpoints with auto-generated Swagger documentation at `/docs`.
- **Database Engine**: SQLAlchemy with a PostgreSQL connection pool. It automatically connects and executes `CREATE DATABASE joint_family` if the database does not exist.
- **Security**: Token-based JWT OAuth2 authentication. Password encryption uses the direct `bcrypt` library to ensure compatibility under Python 3.11/3.12.
- **Auto-Seeding**: Upon startup, if the database is blank, it automatically seeds:
  - Default accounts: Admin (`admin` / `admin123`) and Family Member (`member` / `member123`).
  - Core family heads: *Jayeshbhai*, *Hareshbhai*, and *Mansukhbhai*.
  - Rich dataset of historical monthly household expenses and business records to present charts immediately.

### 2. Vite React TypeScript Frontend (`frontend/`)
- **Design Language**: Rich Dark Theme with custom glassmorphism overlays (using `backdrop-filter` blur rules), floating geometric gradient highlights, sleek form layouts, responsive collapsible sidebars, and micro-interactions.
- **Gujarati Translation**: The entire web interface has been fully translated to Gujarati. This includes input fields, error messages, modal grids, headings, confirmation boxes, charts, and title attributes.
- **Responsiveness**: The entire website is optimized for mobile screens. Added stateful window resizing hooks to dynamically adjust header spacing, auto-collapse buttons (showing icons instead of text on mobile), reflow cards from side-by-side to vertical stack layouts, and scale down modal overlays to prevent any content clipping.
- **Components**:
  - [index.html](file:///d:/HOME/frontend/index.html): Localized with `lang="gu"` and title `વડસક પરિવાર ખાતાવહી`.
  - [LoginPage.tsx](file:///d:/HOME/frontend/src/pages/LoginPage.tsx): Beautiful credentials panel with Gujarati labels and quick-test account shortcuts.
  - [DashboardPortal.tsx](file:///d:/HOME/frontend/src/pages/DashboardPortal.tsx): The main app workspace. Integrates household expense management, member selections, and custom business ledgers (with the custom JSON column builder) into a smooth, animated progressive-disclosure portal.
  - [AdminPage.tsx](file:///d:/HOME/frontend/src/pages/AdminPage.tsx): Fully localized admin dashboard for adding family heads and registering new user credentials with roles.

---

## Database Seeding Verification

We verified database operations by running a backend Python script. The output confirmed successful seed values and correct relations:

```text
--- Database Verification Results ---
User Accounts (Total: 2):
  - Username: admin, Role: admin
  - Username: member, Role: member

Family Heads (Total: 3):
  - Name: Jayeshbhai
    Expenses logged: 3
      * 2026-06-09 | Groceries | Rs.15000.0 | Monthly kitchen inventory & provisions
      * 2026-06-04 | Medical | Rs.4200.0 | Dr. Mehta checkup & routine pills
  - Name: Hareshbhai
    Expenses logged: 4
      * 2026-06-06 | Education | Rs.24000.0 | Quarterly school tuition fee
      * 2026-05-30 | Groceries | Rs.12000.0 | Supermarket shopping visit
  - Name: Mansukhbhai
    Expenses logged: 3
      * 2026-06-07 | Bills | Rs.6200.0 | Water tax & Jio Broadband connection
      * 2026-06-01 | Medical | Rs.11000.0 | Dental cleaning and root canal

Business Registries (Total: 3):
  - Name: Vraj Textiles, Description: Textile Loom & Fabric Manufacturing
    Monthly ledgers count: 3
      * Month: 2026-03 | Revenue: Rs.220000.0 | Cost: Rs.150000.0 | OpEx: Rs.30000.0
        Custom parameters: {'Yarn Purchase': 80000, 'Loom Machine Greasing': 10000}
  - Name: Diamond Crafters, Description: Imported Polished Diamond Trading
    Monthly ledgers count: 2
      * Month: 2026-04 | Revenue: Rs.720000.0 | Cost: Rs.500000.0 | OpEx: Rs.80000.0
        Custom parameters: {'Rough Diamonds Lot': 350000, 'Polishing Wheel Replacement': 20000}
```

---

## How to Run the Application

### 1. Start the FastAPI Backend
```bash
cd backend
# Activate virtual environment
.\venv\Scripts\activate
# Start backend server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Start the React Frontend
```bash
cd frontend
# Start local development server
npm run dev
```
*The React app compiles and launches on `http://localhost:5173/`.*

### 3. Login Credentials
Use the quick click shortcuts on the Login Page, or type manually:
- **Administrator**: `admin` / `admin123`
- **Family Member**: `member` / `member123`
