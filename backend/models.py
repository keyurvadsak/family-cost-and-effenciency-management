import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="member") # "admin" or "member"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    expenses_added = relationship("FamilyExpense", back_populates="creator")
    businesses_created = relationship("Business", foreign_keys="[Business.created_by]", back_populates="creator")
    records_added = relationship("BusinessRecord", back_populates="creator")


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g. Jayeshbhai
    allowed_user_ids = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    expenses = relationship("FamilyExpense", back_populates="family_member", cascade="all, delete-orphan")


class FamilyExpense(Base):
    __tablename__ = "family_expenses"

    id = Column(Integer, primary_key=True, index=True)
    family_member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False) # e.g. Groceries, Bills, Medical
    description = Column(String, nullable=True)
    date = Column(Date, default=datetime.date.today, nullable=False)
    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    family_member = relationship("FamilyMember", back_populates="expenses")
    creator = relationship("User", back_populates="expenses_added")


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    custom_columns = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by], back_populates="businesses_created")
    manager = relationship("User", foreign_keys=[manager_id])
    records = relationship("BusinessRecord", back_populates="business", cascade="all, delete-orphan")
    investments = relationship("BusinessInvestment", back_populates="business", cascade="all, delete-orphan")


class BusinessRecord(Base):
    __tablename__ = "business_records"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=datetime.date.today, nullable=False) # YYYY-MM-DD format
    cost = Column(Float, default=0.0, nullable=False)
    revenue = Column(Float, default=0.0, nullable=False)
    expenses = Column(Float, default=0.0, nullable=False) # standard operational expenses
    custom_data = Column(JSON, default=dict, nullable=False) # Dictionary storing custom attributes/values
    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="records")
    creator = relationship("User", back_populates="records_added")


class BusinessInvestment(Base):
    __tablename__ = "business_investments"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    person_name = Column(String, nullable=False)
    date = Column(Date, default=datetime.date.today, nullable=False) # YYYY-MM-DD format
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False) # "INVESTMENT" or "WITHDRAWAL"
    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="investments")
    creator = relationship("User")


class ConsolidatedTransaction(Base):
    __tablename__ = "consolidated_transactions"

    id = Column(Integer, primary_key=True, index=True)
    tx_guid = Column(String, unique=True, index=True, nullable=False)  # GnuCash UUID or sha256 hash (100% duplicate prevention)
    date = Column(Date, index=True, nullable=False)
    number = Column(String, nullable=True)  # Voucher / Cheque number
    description = Column(String, index=True, nullable=False)
    notes = Column(String, nullable=True)

    # Financial metrics for Cashbook view
    inflow = Column(Float, default=0.0, nullable=False)  # Money into Cashbook (+)
    outflow = Column(Float, default=0.0, nullable=False)  # Money out of Cashbook (-)

    # Categorization and mapping
    primary_account = Column(String, index=True, nullable=False)  # E.g. "INCOME:LOOMS", "EXPENSES:Medical"
    category_group = Column(String, index=True, nullable=False)  # Human-readable Gujarati category group
    is_journal = Column(Boolean, default=False, nullable=False)  # True if non-cashbook transaction
    financial_year = Column(String, index=True, nullable=False)  # E.g. "2025-26"

    source_batch = Column(String, nullable=True)
    added_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    splits = relationship("ConsolidatedSplit", back_populates="transaction", cascade="all, delete-orphan")
    creator = relationship("User")


class ConsolidatedSplit(Base):
    __tablename__ = "consolidated_splits"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("consolidated_transactions.id", ondelete="CASCADE"), nullable=False)
    account_name = Column(String, index=True, nullable=False)
    account_type = Column(String, nullable=False)  # ASSET, LIABILITY, INCOME, EXPENSE, EQUITY
    amount = Column(Float, nullable=False)  # Positive = Debit, Negative = Credit
    memo = Column(String, nullable=True)

    # Relationship
    transaction = relationship("ConsolidatedTransaction", back_populates="splits")
