import datetime
import os

from dotenv import load_dotenv
from sqlalchemy import select

import auth
import models
from database import SessionLocal


def get_or_create_user(session, username: str, password: str, role: str) -> models.User:
    user = session.execute(
        select(models.User).where(models.User.username == username)
    ).scalar_one_or_none()
    if user:
        return user

    user = models.User(
        username=username,
        hashed_password=auth.get_password_hash(password),
        role=role,
    )
    session.add(user)
    session.flush()
    return user


def get_or_create_family_member(session, name: str, allowed_user_ids: list[int]) -> models.FamilyMember:
    member = session.execute(
        select(models.FamilyMember).where(models.FamilyMember.name == name)
    ).scalar_one_or_none()
    if member:
        return member

    member = models.FamilyMember(name=name, allowed_user_ids=allowed_user_ids)
    session.add(member)
    session.flush()
    return member


def get_or_create_business(session, name: str, description: str, manager_id: int | None = None) -> models.Business:
    business = session.execute(
        select(models.Business).where(models.Business.name == name)
    ).scalar_one_or_none()
    if business:
        return business

    business = models.Business(
        name=name,
        description=description,
        created_by=manager_id,
        manager_id=manager_id,
    )
    session.add(business)
    session.flush()
    return business


def ensure_family_expense(
    session,
    family_member_id: int,
    added_by: int,
    date_value: datetime.date,
    amount: float,
    category: str,
    description: str,
) -> None:
    existing = session.execute(
        select(models.FamilyExpense).where(
            models.FamilyExpense.family_member_id == family_member_id,
            models.FamilyExpense.date == date_value,
            models.FamilyExpense.amount == amount,
            models.FamilyExpense.category == category,
        )
    ).scalar_one_or_none()
    if existing:
        return

    session.add(
        models.FamilyExpense(
            family_member_id=family_member_id,
            added_by=added_by,
            date=date_value,
            amount=amount,
            category=category,
            description=description,
        )
    )


def ensure_business_record(
    session,
    business_id: int,
    added_by: int,
    month: str,
    cost: float,
    revenue: float,
    expenses: float,
    custom_data: dict,
) -> None:
    existing = session.execute(
        select(models.BusinessRecord).where(
            models.BusinessRecord.business_id == business_id,
            models.BusinessRecord.month == month,
        )
    ).scalar_one_or_none()
    if existing:
        return

    session.add(
        models.BusinessRecord(
            business_id=business_id,
            added_by=added_by,
            month=month,
            cost=cost,
            revenue=revenue,
            expenses=expenses,
            custom_data=custom_data,
        )
    )


def seed_database() -> None:
    load_dotenv()

    if not os.getenv("DATABASE_URL"):
        raise ValueError("DATABASE_URL environment variable is not set")

    session = SessionLocal()
    try:
        admin = get_or_create_user(session, "admin", "admin123", "admin")
        member = get_or_create_user(session, "member", "member123", "member")

        jayeshbhai = get_or_create_family_member(session, "Jayeshbhai", [member.id])
        hareshbhai = get_or_create_family_member(session, "Hareshbhai", [member.id])
        mansukhbhai = get_or_create_family_member(session, "Mansukhbhai", [member.id])

        vraj_textiles = get_or_create_business(
            session,
            "Vraj Textiles",
            "Textile Loom & Fabric Manufacturing",
            admin.id,
        )
        diamond_crafters = get_or_create_business(
            session,
            "Diamond Crafters",
            "Imported Polished Diamond Trading",
            admin.id,
        )
        shree_ganesh_garments = get_or_create_business(
            session,
            "Shree Ganesh Garments",
            "Readymade apparel stitching and wholesale distribution",
            admin.id,
        )

        ensure_family_expense(
            session,
            jayeshbhai.id,
            admin.id,
            datetime.date(2026, 6, 9),
            15000.0,
            "Groceries",
            "Monthly kitchen inventory & provisions",
        )
        ensure_family_expense(
            session,
            jayeshbhai.id,
            admin.id,
            datetime.date(2026, 6, 4),
            4200.0,
            "Medical",
            "Dr. Mehta checkup & routine pills",
        )
        ensure_family_expense(
            session,
            jayeshbhai.id,
            admin.id,
            datetime.date(2026, 5, 28),
            6800.0,
            "Utilities",
            "Gas cylinder, water canisters, and power top-up",
        )

        ensure_family_expense(
            session,
            hareshbhai.id,
            admin.id,
            datetime.date(2026, 6, 6),
            24000.0,
            "Education",
            "Quarterly school tuition fee",
        )
        ensure_family_expense(
            session,
            hareshbhai.id,
            admin.id,
            datetime.date(2026, 5, 30),
            12000.0,
            "Groceries",
            "Supermarket shopping visit",
        )
        ensure_family_expense(
            session,
            hareshbhai.id,
            admin.id,
            datetime.date(2026, 5, 18),
            3500.0,
            "Medical",
            "Family doctor consultation and medicines",
        )
        ensure_family_expense(
            session,
            hareshbhai.id,
            admin.id,
            datetime.date(2026, 5, 8),
            6100.0,
            "Bills",
            "Electricity and broadband bill",
        )

        ensure_family_expense(
            session,
            mansukhbhai.id,
            admin.id,
            datetime.date(2026, 6, 7),
            6200.0,
            "Bills",
            "Water tax & Jio Broadband connection",
        )
        ensure_family_expense(
            session,
            mansukhbhai.id,
            admin.id,
            datetime.date(2026, 6, 1),
            11000.0,
            "Medical",
            "Dental cleaning and root canal",
        )
        ensure_family_expense(
            session,
            mansukhbhai.id,
            admin.id,
            datetime.date(2026, 5, 22),
            9800.0,
            "Groceries",
            "Monthly ration and household supplies",
        )

        ensure_business_record(
            session,
            vraj_textiles.id,
            admin.id,
            "2026-03",
            150000.0,
            220000.0,
            30000.0,
            {"Yarn Purchase": 80000, "Loom Machine Greasing": 10000},
        )
        ensure_business_record(
            session,
            vraj_textiles.id,
            admin.id,
            "2026-04",
            158000.0,
            235000.0,
            32000.0,
            {"Warp Threads": 90000, "Machine Repair": 12000},
        )
        ensure_business_record(
            session,
            vraj_textiles.id,
            admin.id,
            "2026-05",
            149000.0,
            228000.0,
            29000.0,
            {"Dyeing Charges": 22000, "Packing Material": 7000},
        )

        ensure_business_record(
            session,
            diamond_crafters.id,
            admin.id,
            "2026-04",
            500000.0,
            720000.0,
            80000.0,
            {"Rough Diamonds Lot": 350000, "Polishing Wheel Replacement": 20000},
        )
        ensure_business_record(
            session,
            diamond_crafters.id,
            admin.id,
            "2026-05",
            510000.0,
            760000.0,
            85000.0,
            {"Import Duty": 60000, "Inspection Fees": 15000},
        )

        ensure_business_record(
            session,
            shree_ganesh_garments.id,
            admin.id,
            "2026-05",
            120000.0,
            180000.0,
            25000.0,
            {"Fabric Roll Purchase": 70000, "Stitching Needles": 5000},
        )
        ensure_business_record(
            session,
            shree_ganesh_garments.id,
            admin.id,
            "2026-06",
            130000.0,
            190000.0,
            27000.0,
            {"Cutting Table Maintenance": 8000, "Button Stock": 3000},
        )

        session.commit()
        print("Supabase seed completed successfully.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_database()