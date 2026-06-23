import datetime
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Authentication Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# User schemas
class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "member"

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Family Member schemas
class FamilyMemberCreate(BaseModel):
    name: str
    allowed_user_ids: List[int] = []

class FamilyMemberUpdateAccess(BaseModel):
    allowed_user_ids: List[int] = []

class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    allowed_user_ids: List[int]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Family Expense schemas
class FamilyExpenseCreate(BaseModel):
    family_member_id: int
    amount: float = Field(gt=0)
    category: str
    description: Optional[str] = None
    date: datetime.date = Field(default_factory=datetime.date.today)

class FamilyExpenseResponse(BaseModel):
    id: int
    family_member_id: int
    amount: float
    category: str
    description: Optional[str]
    date: datetime.date
    added_by: Optional[int]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Business schemas
class BusinessCreate(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[int] = None

class BusinessUpdateManager(BaseModel):
    manager_id: Optional[int] = None

class BusinessUpdateColumns(BaseModel):
    custom_columns: List[str]

class BusinessResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_by: Optional[int]
    manager_id: Optional[int]
    custom_columns: List[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Business Record schemas
class BusinessRecordCreate(BaseModel):
    business_id: int
    date: datetime.date = Field(default_factory=datetime.date.today)
    cost: float = Field(default=0.0, ge=0)
    revenue: float = Field(default=0.0, ge=0)
    expenses: float = Field(default=0.0, ge=0)
    custom_data: Dict[str, Any] = Field(default_factory=dict)

class BusinessRecordResponse(BaseModel):
    id: int
    business_id: int
    date: datetime.date
    cost: float
    revenue: float
    expenses: float
    custom_data: Dict[str, Any]
    added_by: Optional[int]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Business Investment schemas
class BusinessInvestmentCreate(BaseModel):
    business_id: int
    person_name: str
    date: datetime.date = Field(default_factory=datetime.date.today)
    amount: float = Field(gt=0)
    type: str # "INVESTMENT" or "WITHDRAWAL"

class BusinessInvestmentResponse(BaseModel):
    id: int
    business_id: int
    person_name: str
    date: datetime.date
    amount: float
    type: str
    added_by: Optional[int]
    created_at: datetime.datetime

    class Config:
        from_attributes = True
