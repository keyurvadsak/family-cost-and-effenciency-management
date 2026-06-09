import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, FamilyMember, FamilyExpense, Business, BusinessRecord

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:keyur6634@localhost:5432/joint_family")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("--- Database Verification Results ---")
print(f"User Accounts (Total: {db.query(User).count()}):")
for u in db.query(User).all():
    print(f"  - Username: {u.username}, Role: {u.role}")

print(f"\nFamily Heads (Total: {db.query(FamilyMember).count()}):")
for m in db.query(FamilyMember).all():
    print(f"  - Name: {m.name}")
    expenses = db.query(FamilyExpense).filter(FamilyExpense.family_member_id == m.id).all()
    print(f"    Expenses logged: {len(expenses)}")
    for e in expenses[:2]: # Show first 2
        print(f"      * {e.date} | {e.category} | Rs.{e.amount} | {e.description}")

print(f"\nBusiness Registries (Total: {db.query(Business).count()}):")
for b in db.query(Business).all():
    print(f"  - Name: {b.name}, Description: {b.description}")
    records = db.query(BusinessRecord).filter(BusinessRecord.business_id == b.id).all()
    print(f"    Monthly ledgers count: {len(records)}")
    for r in records:
        print(f"      * Month: {r.month} | Revenue: Rs.{r.revenue} | Cost: Rs.{r.cost} | OpEx: Rs.{r.expenses}")
        print(f"        Custom parameters: {r.custom_data}")

print("-------------------------------------")
db.close()
