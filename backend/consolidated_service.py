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

def classify_business_stream(acc_name: str) -> str:
    cleaned = (acc_name or "").strip()
    upper = cleaned.upper()
    if "LOOMS" in upper:
        return "લૂમ્સ (LOOMS)"
    elif "EMBRO" in upper or "PRISHA" in upper:
        return "પ્રિશા ફેબ / એમ્બ્રોઈડરી"
    elif "DAIMOND" in upper or "DIAMOND" in upper or "KEYUR" in upper:
        return "કેયુર જેમ્સ (હીરા વેપાર)"
    elif "M.J" in upper or "J.T" in upper:
        return "M.J & J.T ટ્રેડિંગ"
    elif "UCHINA" in upper or "LIABILITIES" in upper or "LOAN" in upper or "DEVANA" in upper or "DADA" in upper or "INTREST" in upper or "INTEREST" in upper:
        return "લોન & ઉછીના"
    elif "CAPITAL" in upper or "CAP." in upper or "INVEST" in upper:
        return "મૂડી & રોકાણ"
    elif "EXPENSES" in upper:
        return "પારિવારિક ઘરખર્ચ"
    return "અન્ય વ્યવસાય / આવક"

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

    # User requirement: When uploading a new CSV, clear old records and replace with newly uploaded CSV records
    db.query(models.ConsolidatedSplit).delete()
    db.query(models.ConsolidatedTransaction).delete()
    db.commit()

    new_tx_models = []
    all_dates = []

    for tx_id, splits in tx_groups.items():
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
            # For journal transactions, calculate the positive/negative split amount
            pos_split = next((s for s in splits if parse_float_amount(s.get("Amount Num.")) > 0), None)
            neg_split = next((s for s in splits if parse_float_amount(s.get("Amount Num.")) < 0), None)

            if pos_split:
                val = abs(parse_float_amount(pos_split.get("Amount Num.")))
                primary_acc = pos_split.get("Full Account Name", "").strip()
            elif neg_split:
                val = abs(parse_float_amount(neg_split.get("Amount Num.")))
                primary_acc = neg_split.get("Full Account Name", "").strip()
            else:
                val = abs(parse_float_amount(first.get("Amount Num.")))
                primary_acc = first.get("Full Account Name", "").strip()

            inflow = val
            outflow = 0.0

        cat_group, _ = classify_account(primary_acc)
        biz_stream = classify_business_stream(primary_acc)
        if biz_stream == "અન્ય વ્યવસાય / આવક" or primary_acc == "Cashbook":
            for s in splits:
                s_acc = (s.get("Full Account Name") or "").strip()
                if s_acc != "Cashbook":
                    cand = classify_business_stream(s_acc)
                    if cand != "અન્ય વ્યવસાય / આવક":
                        biz_stream = cand
                        break

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
            business_stream=biz_stream,
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

    msg = f"જૂનો હિસાબ સાફ કરીને નવા {new_added} વ્યવહારો સફળતાપૂર્વક સાચવવામાં આવ્યા."

    d_min = min(all_dates).strftime("%d-%m-%Y") if all_dates else None
    d_max = max(all_dates).strftime("%d-%m-%Y") if all_dates else None

    return {
        "total_rows_parsed": len(rows),
        "total_transactions_in_file": total_in_file,
        "new_transactions_added": new_added,
        "duplicate_transactions_skipped": 0,
        "is_duplicate_file": False,
        "message": msg,
        "date_min": d_min,
        "date_max": d_max
    }


ACCOUNT_GUJARATI_LABELS: Dict[str, str] = {
    'INCOME:M.J & J.T': 'M.J & J.T ટ્રેડિંગ આવક',
    'INCOME:EMBRO-PRISHA FAB': 'પ્રિશા ફેબ એમ્બ્રોઈડરી આવક',
    'INCOME:LOOMS': 'લૂમ્સ ખાતાની આવક',
    'ASSETS:DAIMOND KG': 'કેયુર જેમ્સ હીરા વેપાર',
    'INCOME:Other Income': 'અન્ય આવક (ભાડું/પગાર)',
    'INCOME:Rent': 'ભાડું આવક',
    'LIABILITIES:UCHINA LIDHELA': 'ઉછીના લીધેલા',
    'LIABILITIES:VALLBHBHAI N.': 'વલ્લભભાઈ એન. લોન',
    'LIABILITIES:BHARATBHAI GARAGE': 'ભારતભાઈ ગેરેજ લોન',
    'LIABILITIES:GoldLoan': 'ગોલ્ડ લોન',
    'LIABILITIES:DADA': 'દાદા ખાતે લોન',
    'LIABILITIES:DEVANA CM CO.': 'દેવાના CM CO.',
    'ASSETS:UCHINA APELA': 'ઉછીના આપેલા',
    'ASSETS:EMBRO-HARDIK/RAVI-INVEST XX': 'એમ્બ્રોઈડરી રોકાણ (હાર્દિક/રવિ)',
    'ASSETS:EMBRO-AKASH/MAYANK-INVEST PF': 'એમ્બ્રોઈડરી રોકાણ (આકાશ/મયંક)',
    'EXPENSES:BHEGA': 'સંયુક્ત ઘરખર્ચ',
    'EXPENSES:BHEGA:BIG': 'મોટા ઘરખર્ચ (મકાન/પ્રસંગ)',
    'EXPENSES:BHEGA:Monthly': 'નિયમિત માસિક ઘરખર્ચ',
    'EXPENSES:BHEGA:Small': 'પરચૂરણ રોજિંદો ઘરખર્ચ',
    'EXPENSES:Medical': 'મેડિકલ & દવાઓ',
    'EXPENSES:School & Education': 'શિક્ષણ & સ્કૂલ ફી',
    'EXPENSES:Intrest & EMIs': 'વ્યાજ & લોન EMI',
    'EXPENSES:Car & Bike': 'વાહન ખર્ચ (પેટ્રોલ/રીપેરીંગ)',
    'EXPENSES:TRAVEL': 'પ્રવાસ અને ટૂર ખર્ચ',
    'EXPENSES:Mobile & Recharge': 'મોબાઈલ રિચાર્જ',
    'EXPENSES:Insuranse': 'મેડિક્લેમ ઇન્સ્યોરન્સ',
    'Cap. Old-Money 24-25': 'જૂની મૂડી ૨૦૨૪-૨૫',
    'Capital Acc': 'મૂડી ખાતું (Capital Acc)',
    'Cashbook': 'રોકડ સિલક (Cashbook)',
    'ASSETS': 'કુલ સંપત્તિ (Assets)',
    'EXPENSES': 'કુલ ખર્ચાઓ (Expenses)',
    'INCOME': 'કુલ આવક (Income)',
    'LIABILITIES': 'કુલ દેવું & લોન (Liabilities)',
}

def get_accounts_tree_data(db: Session) -> List[Dict[str, Any]]:
    rows = db.query(
        models.ConsolidatedSplit.account_name,
        func.sum(models.ConsolidatedSplit.amount).label("total"),
        func.count(models.ConsolidatedSplit.id).label("tx_count")
    ).group_by(models.ConsolidatedSplit.account_name).all()

    account_map = {r[0]: {"total": float(r[1] or 0.0), "count": int(r[2])} for r in rows}
    if "INCOME:Rent" not in account_map:
        account_map["INCOME:Rent"] = {"total": 0.0, "count": 0}

    root_nodes = []

    # 1. ASSETS
    assets_items = [
        ("DAIMOND KG", "ASSETS:DAIMOND KG"),
        ("EMBRO-AKASH/MAYANK-INVEST PF", "ASSETS:EMBRO-AKASH/MAYANK-INVEST PF"),
        ("EMBRO-HARDIK/RAVI-INVEST XX", "ASSETS:EMBRO-HARDIK/RAVI-INVEST XX"),
        ("UCHINA APELA", "ASSETS:UCHINA APELA"),
    ]
    assets_tot = sum(account_map.get(p, {}).get("total", 0.0) for _, p in assets_items)
    root_nodes.append({
        "name": "ASSETS",
        "full_name": "ASSETS",
        "type": "Asset",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("ASSETS", "કુલ સંપત્તિ"),
        "balance": assets_tot,
        "tx_count": sum(account_map.get(p, {}).get("count", 0) for _, p in assets_items),
        "children": [
            {
                "name": n,
                "full_name": p,
                "type": "Asset",
                "gujarati_name": ACCOUNT_GUJARATI_LABELS.get(p, n),
                "balance": account_map.get(p, {}).get("total", 0.0),
                "tx_count": account_map.get(p, {}).get("count", 0),
                "children": []
            }
            for n, p in assets_items
        ]
    })

    # 2. Cap. Old-Money 24-25
    root_nodes.append({
        "name": "Cap. Old-Money 24-25",
        "full_name": "Cap. Old-Money 24-25",
        "type": "Bank",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("Cap. Old-Money 24-25", "જૂની મૂડી ૨૦૨૪-૨૫"),
        "balance": abs(account_map.get("Cap. Old-Money 24-25", {}).get("total", 0.0)),
        "tx_count": account_map.get("Cap. Old-Money 24-25", {}).get("count", 0),
        "children": []
    })

    # 3. Capital Acc
    root_nodes.append({
        "name": "Capital Acc",
        "full_name": "Capital Acc",
        "type": "Equity",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("Capital Acc", "મૂડી ખાતું"),
        "balance": abs(account_map.get("Capital Acc", {}).get("total", 0.0)),
        "tx_count": account_map.get("Capital Acc", {}).get("count", 0),
        "children": []
    })

    # 4. Cashbook
    root_nodes.append({
        "name": "Cashbook",
        "full_name": "Cashbook",
        "type": "Cash",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("Cashbook", "રોકડ સિલક"),
        "balance": account_map.get("Cashbook", {}).get("total", 0.0),
        "tx_count": account_map.get("Cashbook", {}).get("count", 0),
        "children": []
    })

    # 5. EXPENSES
    bhega_items = [
        ("BIG", "EXPENSES:BHEGA:BIG"),
        ("Monthly", "EXPENSES:BHEGA:Monthly"),
        ("Small", "EXPENSES:BHEGA:Small")
    ]
    bhega_tot = sum(account_map.get(p, {}).get("total", 0.0) for _, p in bhega_items)

    exp_other = [
        ("Car & Bike", "EXPENSES:Car & Bike"),
        ("Insuranse", "EXPENSES:Insuranse"),
        ("Intrest & EMIs", "EXPENSES:Intrest & EMIs"),
        ("Medical", "EXPENSES:Medical"),
        ("Mobile & Recharge", "EXPENSES:Mobile & Recharge"),
        ("School & Education", "EXPENSES:School & Education"),
        ("TRAVEL", "EXPENSES:TRAVEL"),
    ]
    exp_other_tot = sum(account_map.get(p, {}).get("total", 0.0) for _, p in exp_other)
    root_nodes.append({
        "name": "EXPENSES",
        "full_name": "EXPENSES",
        "type": "Expense",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("EXPENSES", "કુલ ખર્ચાઓ"),
        "balance": bhega_tot + exp_other_tot,
        "tx_count": sum(account_map.get(p, {}).get("count", 0) for _, p in bhega_items) + sum(account_map.get(p, {}).get("count", 0) for _, p in exp_other),
        "children": [
            {
                "name": "BHEGA",
                "full_name": "EXPENSES:BHEGA",
                "type": "Expense",
                "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("EXPENSES:BHEGA", "સંયુક્ત ઘરખર્ચ"),
                "balance": bhega_tot,
                "tx_count": sum(account_map.get(p, {}).get("count", 0) for _, p in bhega_items),
                "children": [
                    {
                        "name": n,
                        "full_name": p,
                        "type": "Expense",
                        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get(p, n),
                        "balance": account_map.get(p, {}).get("total", 0.0),
                        "tx_count": account_map.get(p, {}).get("count", 0),
                        "children": []
                    }
                    for n, p in bhega_items
                ]
            }
        ] + [
            {
                "name": n,
                "full_name": p,
                "type": "Expense",
                "gujarati_name": ACCOUNT_GUJARATI_LABELS.get(p, n),
                "balance": account_map.get(p, {}).get("total", 0.0),
                "tx_count": account_map.get(p, {}).get("count", 0),
                "children": []
            }
            for n, p in exp_other
        ]
    })

    # 6. INCOME
    income_items = [
        ("EMBRO-PRISHA FAB", "INCOME:EMBRO-PRISHA FAB"),
        ("LOOMS", "INCOME:LOOMS"),
        ("M.J & J.T", "INCOME:M.J & J.T"),
        ("Other Income", "INCOME:Other Income"),
        ("Rent", "INCOME:Rent"),
    ]
    inc_tot = sum(abs(account_map.get(p, {}).get("total", 0.0)) for _, p in income_items)
    root_nodes.append({
        "name": "INCOME",
        "full_name": "INCOME",
        "type": "Income",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("INCOME", "કુલ આવક"),
        "balance": inc_tot,
        "tx_count": sum(account_map.get(p, {}).get("count", 0) for _, p in income_items),
        "children": [
            {
                "name": n,
                "full_name": p,
                "type": "Income",
                "gujarati_name": ACCOUNT_GUJARATI_LABELS.get(p, n),
                "balance": abs(account_map.get(p, {}).get("total", 0.0)),
                "tx_count": account_map.get(p, {}).get("count", 0),
                "children": []
            }
            for n, p in income_items
        ]
    })

    # 7. LIABILITIES
    liab_items = [
        ("BHARATBHAI GARAGE", "LIABILITIES:BHARATBHAI GARAGE"),
        ("DADA", "LIABILITIES:DADA"),
        ("DEVANA CM CO.", "LIABILITIES:DEVANA CM CO."),
        ("GoldLoan", "LIABILITIES:GoldLoan"),
        ("UCHINA LIDHELA", "LIABILITIES:UCHINA LIDHELA"),
        ("VALLBHBHAI N.", "LIABILITIES:VALLBHBHAI N."),
    ]
    liab_tot = sum(abs(account_map.get(p, {}).get("total", 0.0)) for _, p in liab_items)
    root_nodes.append({
        "name": "LIABILITIES",
        "full_name": "LIABILITIES",
        "type": "Liability",
        "gujarati_name": ACCOUNT_GUJARATI_LABELS.get("LIABILITIES", "કુલ દેવું & લોન"),
        "balance": liab_tot,
        "tx_count": sum(account_map.get(p, {}).get("count", 0) for _, p in liab_items),
        "children": [
            {
                "name": n,
                "full_name": p,
                "type": "Liability",
                "gujarati_name": ACCOUNT_GUJARATI_LABELS.get(p, n),
                "balance": abs(account_map.get(p, {}).get("total", 0.0)),
                "tx_count": account_map.get(p, {}).get("count", 0),
                "children": []
            }
            for n, p in liab_items
        ]
    })

    return root_nodes
