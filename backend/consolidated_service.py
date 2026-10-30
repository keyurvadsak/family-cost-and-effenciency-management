import csv
import io
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Tuple, Set, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

import models

CATEGORY_MAPPING: Dict[str, Tuple[str, str]] = {
    'INCOME:M.J & J.T': ('બિઝનેસ આવક', 'M.J & J.T ટ્રેડિંગ આવક'),
    'INCOME:EMBRO-PRISHA FAB': ('બિઝનેસ આવક', 'પ્રિશા ફેબ એમ્બ્રોઈડરી આવક'),
    'INCOME:LOOMS': ('બિઝનેસ આવક', 'લૂમ્સ ખાતાની આવક'),
    'ASSETS:DAIMOND KG': ('હીરા વેપાર', 'કેયુર જેમ્સ હીરા વેપાર'),
    'INCOME:Other Income': ('અન્ય આવક', 'અન્ય આવક (ભાડું/પગાર/વેચાણ)'),
    'LIABILITIES:UCHINA LIDHELA': ('ઉછીના & લોન', 'ઉછીના લીધેલા'),
    'LIABILITIES:VALLBHBHAI N.': ('ઉછીના & લોન', 'વલ્લભભાઈ એન. લોન'),
    'LIABILITIES:BHARATBHAI GARAGE': ('ઉછીના & લોન', 'ભારતભાઈ ગેરેજ લોન'),
    'LIABILITIES:GoldLoan': ('ઉછીના & લોન', 'ગોલ્ડ લોન'),
    'LIABILITIES:DADA': ('ઉછીના & લોન', 'દાદા ખાતે'),
    'LIABILITIES:DEVANA CM CO.': ('ઉછીના & લોન', 'દેવાના CM CO.'),
    'ASSETS:UCHINA APELA': ('ઉછીના & લોન', 'ઉછીના આપેલા'),
    'ASSETS:EMBRO-HARDIK/RAVI-INVEST XX': ('મૂડી રોકાણ', 'એમ્બ્રોઈડરી રોકાણ (હાર્દિક/રવિ)'),
    'ASSETS:EMBRO-AKASH/MAYANK-INVEST PF': ('મૂડી રોકાણ', 'એમ્બ્રોઈડરી રોકાણ (આકાશ/મયંક)'),
    'EXPENSES:BHEGA:BIG': ('સંયુક્ત ઘરખર્ચ', 'મોટા ઘરખર્ચ (મકાન/પ્રસંગ)'),
    'EXPENSES:BHEGA:Monthly': ('સંયુક્ત ઘરખર્ચ', 'નિયમિત માસિક ઘરખર્ચ'),
    'EXPENSES:BHEGA:Small': ('સંયુક્ત ઘરખર્ચ', 'પરચૂરણ રોજિંદો ઘરખર્ચ'),
    'EXPENSES:Medical': ('મેડિકલ & દવાઓ', 'મેડિકલ અને હોસ્પિટલ ખર્ચ'),
    'EXPENSES:School & Education': ('શિક્ષણ & ફી', 'શિક્ષણ અને કોલેજ/સ્કૂલ ફી'),
    'EXPENSES:Intrest & EMIs': ('વ્યાજ & હપ્તા', 'વ્યાજ અને લોન EMI'),
    'EXPENSES:Car & Bike': ('વાહન ખર્ચ', 'વાહન પેટ્રોલ/ગેસ/રીપેરીંગ'),
    'EXPENSES:TRAVEL': ('પ્રવાસ & ટૂર', 'પ્રવાસ અને ટૂર ખર્ચ'),
    'EXPENSES:Mobile & Recharge': ('પરચૂરણ ઘરખર્ચ', 'મોબાઈલ રિચાર્જ'),
    'EXPENSES:Insuranse': ('વીમો (ઇન્સ્યોરન્સ)', 'મેડિક્લેમ ઇન્સ્યોરન્સ'),
    'Cap. Old-Money 24-25': ('મૂડી ખાતું', 'જૂની મૂડી ૨૦૨૪-૨૫'),
    'Capital Acc': ('મૂડી ખાતું', 'મૂડી ખાતું (Capital)')
}

def classify_account(acc_name: str) -> Tuple[str, str]:
    cleaned = acc_name.strip()
    if cleaned in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[cleaned]
    
    # Heuristic dynamic fallback
    if cleaned.startswith("INCOME:"):
        sub = cleaned.split(":", 1)[1] if ":" in cleaned else cleaned
        return ("બિઝનેસ આવક", f"આવક ({sub})")
    elif cleaned.startswith("EXPENSES:"):
        sub = cleaned.split(":", 1)[1] if ":" in cleaned else cleaned
        return ("ઘરખર્ચ / વ્યવસાય ખર્ચ", f"ખર્ચ ({sub})")
    elif cleaned.startswith("LIABILITIES:"):
        sub = cleaned.split(":", 1)[1] if ":" in cleaned else cleaned
        return ("ઉછીના & લોન", f"લોન/દેવું ({sub})")
    elif cleaned.startswith("ASSETS:"):
        sub = cleaned.split(":", 1)[1] if ":" in cleaned else cleaned
        return ("મૂડી રોકાણ", f"સંપત્તિ ({sub})")
    elif "Capital" in cleaned or "Cap." in cleaned:
        return ("મૂડી ખાતું", "મૂડી ખાતું")
    return ("અન્ય વ્યવહારો", cleaned)

def calculate_financial_year(dt: datetime) -> str:
    # Indian Financial Year: April 1 to March 31
    if dt.month >= 4:
        return f"{dt.year}-{str(dt.year + 1)[-2:]}"
    else:
        return f"{dt.year - 1}-{str(dt.year)[-2:]}"

def parse_date(date_str: str) -> datetime.date:
    cleaned = date_str.strip()
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Unknown date format: {date_str}")

def parse_float_amount(amt_str: Optional[str]) -> float:
    if not amt_str:
        return 0.0
    cleaned = amt_str.replace(",", "").replace("₹", "").replace("$", "").strip()
    if not cleaned:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def process_consolidated_csv(
    file_bytes: bytes,
    db: Session,
    user_id: Optional[int] = None,
    filename: Optional[str] = None
) -> Dict[str, Any]:
    text_content = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text_content))
    rows = list(reader)

    if not rows:
        return {
            "total_rows_parsed": 0,
            "total_transactions_in_file": 0,
            "new_transactions_added": 0,
            "duplicate_transactions_skipped": 0,
            "is_duplicate_file": True,
            "message": "ફાઇલમાં કોઈ માન્ય ડેટા લાઈન મળેલ નથી.",
            "date_min": None,
            "date_max": None
        }

    # Group splits by Transaction ID or fingerprint
    tx_groups: Dict[str, List[Dict[str, str]]] = {}
    for r in rows:
        tx_id = r.get("Transaction ID", "").strip()
        if not tx_id:
            # Fallback deterministic fingerprint
            row_fp = f"{r.get('Date', '')}|{r.get('Description', '')}|{r.get('Amount Num.', '')}|{r.get('Full Account Name', '')}"
            tx_id = "FP_" + hashlib.sha256(row_fp.encode("utf-8")).hexdigest()[:24]
        if tx_id not in tx_groups:
            tx_groups[tx_id] = []
        tx_groups[tx_id].append(r)

    # 100% Duplicate Prevention: Fetch all existing tx_guid from database in a single query
    existing_guids: Set[str] = set(
        guid for (guid,) in db.query(models.ConsolidatedTransaction.tx_guid).all()
    )

    new_tx_models = []
    skipped_count = 0
    all_dates = []

    for tx_id, splits in tx_groups.items():
        if tx_id in existing_guids:
            skipped_count += 1
            continue

        first = splits[0]
        try:
            tx_date = parse_date(first.get("Date", ""))
        except Exception:
            continue
        all_dates.append(tx_date)

        desc = (first.get("Description") or "").strip()
        notes = (first.get("Notes") or "").strip()
        number = (first.get("Number") or "").strip()
        fy = calculate_financial_year(datetime.combine(tx_date, datetime.min.time()))

        # Separate Cashbook split from other split
        cb_split = next((s for s in splits if (s.get("Full Account Name") or "").strip() == "Cashbook"), None)
        other_split = next((s for s in splits if (s.get("Full Account Name") or "").strip() != "Cashbook"), None)

        inflow = 0.0
        outflow = 0.0
        is_journal = False

        if cb_split:
            cb_val = parse_float_amount(cb_split.get("Amount Num."))
            if cb_val > 0:
                inflow = cb_val
            else:
                outflow = abs(cb_val)
            primary_acc = other_split.get("Full Account Name", "").strip() if other_split else "Cashbook"
        else:
            is_journal = True
            # For journal transaction, take the first debit or first account
            primary_acc = first.get("Full Account Name", "").strip()

        cat_group, _ = classify_account(primary_acc)

        tx_obj = models.ConsolidatedTransaction(
            tx_guid=tx_id,
            date=tx_date,
            number=number if number else None,
            description=desc,
            notes=notes if notes else None,
            inflow=inflow,
            outflow=outflow,
            primary_account=primary_acc,
            category_group=cat_group,
            is_journal=is_journal,
            financial_year=fy,
            source_batch=filename,
            added_by=user_id
        )

        # Build split models
        for s in splits:
            s_acc = (s.get("Full Account Name") or "").strip()
            s_amt = parse_float_amount(s.get("Amount Num."))
            s_memo = (s.get("Memo") or "").strip()

            # Determine account type
            s_acc_upper = s_acc.upper()
            if "INCOME" in s_acc_upper:
                acc_type = "INCOME"
            elif "EXPENSE" in s_acc_upper:
                acc_type = "EXPENSE"
            elif "LIABILIT" in s_acc_upper:
                acc_type = "LIABILITY"
            elif "CAPITAL" in s_acc_upper or "CAP." in s_acc_upper:
                acc_type = "EQUITY"
            else:
                acc_type = "ASSET"

            split_obj = models.ConsolidatedSplit(
                account_name=s_acc,
                account_type=acc_type,
                amount=s_amt,
                memo=s_memo if s_memo else None
            )
            tx_obj.splits.append(split_obj)

        new_tx_models.append(tx_obj)

    # Bulk save new transactions
    if new_tx_models:
        db.add_all(new_tx_models)
        db.commit()

    total_in_file = len(tx_groups)
    new_added = len(new_tx_models)
    is_all_dup = (new_added == 0 and total_in_file > 0)

    if is_all_dup:
        msg = f"ડુપ્લિકેટ ફાઇલ: આ ફાઇલના તમામ {total_in_file} વ્યવહારો પહેલેથી જ ડેટાબેઝમાં મોજૂદ છે. કોઈ ડુપ્લિકેટ એન્ટ્રી ઉમેરાઈ નથી."
    elif skipped_count > 0:
        msg = f"સફળતાપૂર્વક અપલોડ: {new_added} નવા વ્યવહારો ઉમેરાયા, {skipped_count} જૂના વ્યવહારો આપમેળે સ્કીપ થયા (કોઈ ડુપ્લિકેશન નથી)."
    else:
        msg = f"સફળતાપૂર્વક અપલોડ: તમામ {new_added} વ્યવહારો ડેટાબેઝમાં સાચવવામાં આવ્યા."

    d_min = min(all_dates).strftime("%d-%m-%Y") if all_dates else None
    d_max = max(all_dates).strftime("%d-%m-%Y") if all_dates else None

    return {
        "total_rows_parsed": len(rows),
        "total_transactions_in_file": total_in_file,
        "new_transactions_added": new_added,
        "duplicate_transactions_skipped": skipped_count,
        "is_duplicate_file": is_all_dup,
        "message": msg,
        "date_min": d_min,
        "date_max": d_max
    }

