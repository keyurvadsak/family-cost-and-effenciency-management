import datetime
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import text
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
    
    # Initialize first admin if database is empty and credentials are provided
    db = next(get_db())
    try:
        if db.query(models.User).count() == 0:
            import os
            import auth
            first_admin_user = os.getenv("FIRST_ADMIN_USER")
            first_admin_pwd = os.getenv("FIRST_ADMIN_PASSWORD")
            
            if first_admin_user and first_admin_pwd:
                admin_user = models.User(
                    username=first_admin_user,
                    hashed_password=auth.get_password_hash(first_admin_pwd),
                    role="admin"
                )
                db.add(admin_user)
                db.commit()
                print(f"Created initial admin user: {first_admin_user}")
            else:
                print("No users found. To create an initial admin, set FIRST_ADMIN_USER and FIRST_ADMIN_PASSWORD in .env")
    except Exception as e:
        print("Error during initial admin setup:", e)
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

@app.get("/")
def root():
    return {"message": "Welcome to the Joint Family Expense & Business Manager API!"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}

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

@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.User).order_by(models.User.username).all()


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
    
    new_member = models.FamilyMember(name=member_data.name, allowed_user_ids=member_data.allowed_user_ids)
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    return new_member

@app.patch("/api/family-members/{id}/access", response_model=schemas.FamilyMemberResponse)
def update_family_member_access(
    id: int,
    access_data: schemas.FamilyMemberUpdateAccess,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.get_current_admin)
):
    member = db.query(models.FamilyMember).filter(models.FamilyMember.id == id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found.")
    
    if access_data.allowed_user_ids is not None:
        # Check if all users exist
        if access_data.allowed_user_ids:
            users = db.query(models.User).filter(models.User.id.in_(access_data.allowed_user_ids)).all()
            if len(users) != len(set(access_data.allowed_user_ids)):
                raise HTTPException(status_code=404, detail="One or more users not found.")
            
    member.allowed_user_ids = access_data.allowed_user_ids
    db.commit()
    db.refresh(member)
    return member

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
        
    if current_user.role != "admin" and current_user.id not in (member.allowed_user_ids or []):
        raise HTTPException(status_code=403, detail="You do not have permission to add details to this family member.")
    
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
    admin_user: models.User = Depends(auth.get_current_admin)
):
    existing = db.query(models.Business).filter(models.Business.name == business_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Business name already exists.")
    
    new_biz = models.Business(
        name=business_data.name,
        description=business_data.description,
        created_by=admin_user.id,
        manager_id=business_data.manager_id
    )
    db.add(new_biz)
    db.commit()
    db.refresh(new_biz)
    return new_biz

@app.delete("/api/businesses/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    biz = db.query(models.Business).filter(models.Business.id == id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business card not found.")
    
    if current_user.role != "admin" and biz.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this business.")
    
    db.delete(biz)
    db.commit()
    return None

@app.patch("/api/businesses/{id}/manager", response_model=schemas.BusinessResponse)
def update_business_manager(
    id: int,
    manager_data: schemas.BusinessUpdateManager,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.get_current_admin)
):
    biz = db.query(models.Business).filter(models.Business.id == id).first()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found.")
    
    if manager_data.manager_id is not None:
        user = db.query(models.User).filter(models.User.id == manager_data.manager_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Manager user not found.")
            
    biz.manager_id = manager_data.manager_id
    db.commit()
    db.refresh(biz)
    return biz


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
        
    if current_user.role != "admin" and biz.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have permission to add details to this business.")
    
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
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, log_level="info", access_log=True)
