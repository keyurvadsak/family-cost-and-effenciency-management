import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, JSON
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
