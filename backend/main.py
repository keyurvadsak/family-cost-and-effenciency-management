import datetime
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

import models
import schemas
import auth
from database import engine, Base, get_db

# Lifespan manager to handle database startup seeding
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Seed data
    db = next(get_db())
    try:
        # Check if users already seeded
        if db.query(models.User).count() == 0:
            # Create users
            admin_user = models.User(
                username="admin",
                hashed_password=auth.get_password_hash("admin123"),
                role="admin"
            )
            member_user = models.User(
                username="member",
                hashed_password=auth.get_password_hash("member123"),
                role="member"
            )
            db.add_all([admin_user, member_user])
            db.commit()
            db.refresh(admin_user)
            db.refresh(member_user)

            # Create default family heads
            f1 = models.FamilyMember(name="Jayeshbhai")
            f2 = models.FamilyMember(name="Hareshbhai")
            f3 = models.FamilyMember(name="Mansukhbhai")
            db.add_all([f1, f2, f3])
            db.commit()
            db.refresh(f1)
            db.refresh(f2)
            db.refresh(f3)

            # Seed sample expenses
            expenses = [
                # Jayeshbhai
                models.FamilyExpense(
                    family_member_id=f1.id, amount=15000.0, category="Groceries",
                    description="Monthly kitchen inventory & provisions", date=datetime.date.today(), added_by=admin_user.id
                ),
                models.FamilyExpense(
                    family_member_id=f1.id, amount=4200.0, category="Medical",
                    description="Dr. Mehta checkup & routine pills", date=datetime.date.today() - datetime.timedelta(days=5), added_by=admin_user.id
                ),
                models.FamilyExpense(
                    family_member_id=f1.id, amount=8500.0, category="Bills",
                    description="Torrent Power electricity bill", date=datetime.date.today() - datetime.timedelta(days=12), added_by=admin_user.id
                ),
                # Hareshbhai
                models.FamilyExpense(
                    family_member_id=f2.id, amount=24000.0, category="Education",
                    description="Quarterly school tuition fee", date=datetime.date.today() - datetime.timedelta(days=3), added_by=member_user.id
                ),
                models.FamilyExpense(
                    family_member_id=f2.id, amount=12000.0, category="Groceries",
                    description="Supermarket shopping visit", date=datetime.date.today() - datetime.timedelta(days=10), added_by=member_user.id
                ),
                models.FamilyExpense(
                    family_member_id=f2.id, amount=50000.0, category="Investments",
                    description="HDFC mutual fund SIP deduction", date=datetime.date.today() - datetime.timedelta(days=15), added_by=admin_user.id
                ),
                # Mansukhbhai
                models.FamilyExpense(
                    family_member_id=f3.id, amount=6200.0, category="Bills",
                    description="Water tax & Jio Broadband connection", date=datetime.date.today() - datetime.timedelta(days=2), added_by=member_user.id
                ),
                models.FamilyExpense(
                    family_member_id=f3.id, amount=11000.0, category="Medical",
                    description="Dental cleaning and root canal", date=datetime.date.today() - datetime.timedelta(days=8), added_by=member_user.id
                ),
                models.FamilyExpense(
                    family_member_id=f3.id, amount=7500.0, category="Leisure",
                    description="Family anniversary dinner at Radisson", date=datetime.date.today() - datetime.timedelta(days=14), added_by=admin_user.id
                )
            ]
            db.add_all(expenses)

            # Seed sample businesses
            b1 = models.Business(name="Vraj Textiles", description="Textile Loom & Fabric Manufacturing", created_by=admin_user.id)
            b2 = models.Business(name="Diamond Crafters", description="Imported Polished Diamond Trading", created_by=admin_user.id)
            db.add_all([b1, b2])
            db.commit()
            db.refresh(b1)
            db.refresh(b2)

            # Seed Business Records
            records = [
                # Vraj Textiles
                models.BusinessRecord(
                    business_id=b1.id, month="2026-03", cost=150000.0, revenue=220000.0, expenses=30000.0,
                    custom_data={"Yarn Purchase": 80000, "Loom Machine Greasing": 10000}, added_by=admin_user.id
                ),
                models.BusinessRecord(
                    business_id=b1.id, month="2026-04", cost=160000.0, revenue=250000.0, expenses=35000.0,
                    custom_data={"Yarn Purchase": 90000, "Worker Extra Shifts": 5000}, added_by=admin_user.id
                ),
                models.BusinessRecord(
                    business_id=b1.id, month="2026-05", cost=170000.0, revenue=290000.0, expenses=40000.0,
                    custom_data={"Yarn Purchase": 95000, "Dyeing House Charges": 12000, "Office Tea & Coffee": 1500}, added_by=member_user.id
                ),
                # Diamond Crafters
                models.BusinessRecord(
                    business_id=b2.id, month="2026-04", cost=500000.0, revenue=720000.0, expenses=80000.0,
                    custom_data={"Rough Diamonds Lot": 350000, "Polishing Wheel Replacement": 20000}, added_by=admin_user.id
                ),
                models.BusinessRecord(
                    business_id=b2.id, month="2026-05", cost=520000.0, revenue=810000.0, expenses=85000.0,
                    custom_data={"Rough Diamonds Lot": 370000, "Diamond Import Duty": 40000, "Laser Engraving Calibration": 5000}, added_by=member_user.id
                )
            ]
            db.add_all(records)
            db.commit()
    except Exception as e:
        print("Error during database seed execution:", e)
        db.rollback()
    finally:
        db.close()
    yield

app = FastAPI(
    title="Joint Family Expense & Business Manager API",
    description="Backend services for joint family financials and business ledgers.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for React frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- AUTH ENDPOINTS -----------------
@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username exists
    existing = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username is already registered.")
    
    hashed_pwd = auth.get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        hashed_password=hashed_pwd,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

# Support raw JSON bodies for login as well (highly useful for standard React axios requests)
class JSONLoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login-json", response_model=schemas.Token)
def login_user_json(payload: JSONLoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_user_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# ----------------- FAMILY MEMBER ENDPOINTS -----------------
@app.get("/api/family-members", response_model=List[schemas.FamilyMemberResponse])
def get_family_members(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.FamilyMember).order_by(models.FamilyMember.name).all()

@app.post("/api/family-members", response_model=schemas.FamilyMemberResponse, status_code=status.HTTP_201_CREATED)
def create_family_member(
    member_data: schemas.FamilyMemberCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.get_current_admin)
):
    existing = db.query(models.FamilyMember).filter(models.FamilyMember.name == member_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Family head name already exists.")
    
    new_member = models.FamilyMember(name=member_data.name)
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member

@app.delete("/api/family-members/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family_member(
    id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.get_current_admin)
):
    member = db.query(models.FamilyMember).filter(models.FamilyMember.id == id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found.")
    
    db.delete(member)
    db.commit()
    return None


# ----------------- FAMILY EXPENSE ENDPOINTS -----------------
@app.get("/api/expenses/{family_member_id}", response_model=List[schemas.FamilyExpenseResponse])
def get_expenses_by_member(
    family_member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify member exists
    member = db.query(models.FamilyMember).filter(models.FamilyMember.id == family_member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found.")
    
    return db.query(models.FamilyExpense).filter(
        models.FamilyExpense.family_member_id == family_member_id
    ).order_by(models.FamilyExpense.date.desc(), models.FamilyExpense.id.desc()).all()

@app.post("/api/expenses", response_model=schemas.FamilyExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_data: schemas.FamilyExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    member = db.query(models.FamilyMember).filter(models.FamilyMember.id == expense_data.family_member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found.")
    
    new_expense = models.FamilyExpense(
        family_member_id=expense_data.family_member_id,
        amount=expense_data.amount,
        category=expense_data.category,
        description=expense_data.description,
        date=expense_data.date,
        added_by=current_user.id
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    return new_expense

@app.delete("/api/expenses/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    expense = db.query(models.FamilyExpense).filter(models.FamilyExpense.id == id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense log not found.")
    
    # Restrict deletion: Only admin or the person who added it can delete
    if current_user.role != "admin" and expense.added_by != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this expense log.")
    
    db.delete(expense)
    db.commit()
    return None


# ----------------- BUSINESS ENDPOINTS -----------------
@app.get("/api/businesses", response_model=List[schemas.BusinessResponse])
def get_businesses(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Business).order_by(models.Business.name).all()

@app.post("/api/businesses", response_model=schemas.BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(
    business_data: schemas.BusinessCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    existing = db.query(models.Business).filter(models.Business.name == business_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business name already exists.")
    
    new_biz = models.Business(
        name=business_data.name,
        description=business_data.description,
        created_by=current_user.id
    )
    db.add(new_biz)
    db.commit()
    db.refresh(new_biz)
    return new_biz

@app.delete("/api/businesses/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.get_current_admin)
):
    biz = db.query(models.Business).filter(models.Business.id == id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business card not found.")
    
    db.delete(biz)
    db.commit()
    return None


# ----------------- BUSINESS MONTHLY RECORD ENDPOINTS -----------------
@app.get("/api/businesses/{business_id}/records", response_model=List[schemas.BusinessRecordResponse])
def get_business_records(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    biz = db.query(models.Business).filter(models.Business.id == business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    
    return db.query(models.BusinessRecord).filter(
        models.BusinessRecord.business_id == business_id
    ).order_by(models.BusinessRecord.month.desc()).all()

@app.post("/api/business-records", response_model=schemas.BusinessRecordResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_business_record(
    record_data: schemas.BusinessRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    biz = db.query(models.Business).filter(models.Business.id == record_data.business_id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    
    # Check if record for this month already exists; if so, update it. Otherwise, insert new.
    record = db.query(models.BusinessRecord).filter(
        models.BusinessRecord.business_id == record_data.business_id,
        models.BusinessRecord.month == record_data.month
    ).first()
    
    if record:
        record.cost = record_data.cost
        record.revenue = record_data.revenue
        record.expenses = record_data.expenses
        record.custom_data = record_data.custom_data
        record.added_by = current_user.id
    else:
        record = models.BusinessRecord(
            business_id=record_data.business_id,
            month=record_data.month,
            cost=record_data.cost,
            revenue=record_data.revenue,
            expenses=record_data.expenses,
            custom_data=record_data.custom_data,
            added_by=current_user.id
        )
        db.add(record)
        
    db.commit()
    db.refresh(record)
    return record
