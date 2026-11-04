import csv
import io
import hashlib
from datetime import datetime, date
from typing import Dict, Any, List, Tuple, Set, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

import models

# ═══════════════════════════════════════════════════════════════════════════
# DEFAULT DICTIONARIES & HEURISTICS (Used as baseline seeds / fallbacks)
# All user changes are saved dynamically to database (models.ConsolidatedAccount)
# ═══════════════════════════════════════════════════════════════════════════

DEFAULT_GUJARATI_MAP: Dict[str, str] = {
    'ASSETS': 'કુલ સંપત્તિ',
    'EXPENSES': 'કુલ ખર્ચાઓ',
    'INCOME': 'કુલ આવક',
    'LIABILITIES': 'કુલ દેવું & લોન',
    'CAPITAL ACC': 'મૂડી ખાતું',
    'CAP. OLD-MONEY 24-25': 'જૂની મૂડી ૨૦૨૪-૨૫',
    'CASHBOOK': 'રોકડ સિલક',
    'BHEGA': 'સંયુક્ત ઘરખર્ચ',
    'BIG': 'મોટા ઘરખર્ચ (મકાન/પ્રસંગ)',
    'MONTHLY': 'નિયમિત માસિક ઘરખર્ચ',
    'SMALL': 'પરચૂરણ રોજિંદો ઘરખર્ચ',
    'MEDICAL': 'મેડિકલ & દવાઓ',
    'SCHOOL & EDUCATION': 'શિક્ષણ & સ્કૂલ ફી',
    'INTREST & EMIS': 'વ્યાજ & લોન EMI',
    'CAR & BIKE': 'વાહન ખર્ચ (પેટ્રોલ/રીપેરીંગ)',
    'TRAVEL': 'પ્રવાસ અને ટૂર ખર્ચ',
    'MOBILE & RECHARGE': 'મોબાઈલ રિચાર્જ',
    'INSURANSE': 'મેડિક્લેમ ઇન્સ્યોરન્સ',
    'DAIMOND KG': 'કેયુર જેમ્સ હીરા વેપાર',
    'DAIMOND- C & M CO.': 'ડાયમંડ C & M Co.',
    'LOOMS': 'લૂમ્સ ખાતાની આવક',
    'OTHER INCOME': 'અન્ય આવક (ભાડું/પગાર)',
    'RENT': 'ભાડું આવક',
    'UCHINA LIDHELA': 'ઉછીના લીધેલા',
    'UCHINA APELA': 'ઉછીના આપેલા',
    'VALLBHBHAI N.': 'વલ્લભભાઈ એન. લોન',
    'BHARATBHAI GARAGE': 'ભારતભાઈ ગેરેજ લોન',
    'GOLDLOAN': 'ગોલ્ડ લોન',
    'DADA': 'દાદા ખાતે લોન',
    'DEVANA CM CO.': 'દેવાના CM CO.',
    'EMBRO-PRISHA FAB': 'પ્રિશા ફેબ એમ્બ્રોઈડરી આવક',
    'M.J & J.T': 'M.J & J.T ટ્રેડિંગ આવક',
    'EMBRO-HARDIK/RAVI-INVEST XX': 'એમ્બ્રોઈડરી રોકાણ (હાર્દિક/રવિ)',
    'EMBRO-AKASH/MAYANK-INVEST PF': 'એમ્બ્રોઈડરી રોકાણ (આકાશ/મયંક)',
}

DEFAULT_STREAM_KEYWORDS: Dict[str, str] = {
    'LOOMS': 'લૂમ્સ (LOOMS)',
    'EMBRO': 'પ્રિશા ફેબ / એમ્બ્રોઈડરી',
    'PRISHA': 'પ્રિશા ફેબ / એમ્બ્રોઈડરી',
    'DAIMOND': 'કેયુર જેમ્સ (હીરા વેપાર)',
    'DIAMOND': 'કેયુર જેમ્સ (હીરા વેપાર)',
    'M.J': 'M.J & J.T ટ્રેડિંગ',
    'J.T': 'M.J & J.T ટ્રેડિંગ',
    'UCHINA': 'લોન & ઉછીના',
    'LOAN': 'લોન & ઉછીના',
    'CAPITAL': 'મૂડી & રોકાણ',
    'INVEST': 'મૂડી & રોકાણ',
    'BHEGA': 'સંયુક્ત ઘરખર્ચ',
}

def infer_root_type(full_name: str) -> str:
    """Dynamically determine account category without hardcoded lists."""
    parts = full_name.split(':')
    root = parts[0].strip().upper()
    if 'ASSET' in root or 'CASH' in root or 'BANK' in root or 'OLD-MONEY' in root:
        return 'ASSET'
    elif 'LIABILIT' in root or 'LOAN' in root or 'DEBT' in root or 'PAYABLE' in root:
        return 'LIABILITY'
    elif 'EQUITY' in root or 'CAPITAL' in root:
        return 'EQUITY'
    elif 'INCOME' in root or 'REVENUE' in root or 'SALES' in root:
        return 'INCOME'
    elif 'EXPENSE' in root or 'COST' in root or 'PURCHASE' in root:
        return 'EXPENSE'
    return 'ASSET'

def infer_business_stream(full_name: str) -> str:
    """Dynamically deduce business stream from account path."""
    upper = full_name.upper()
    for kw, label in DEFAULT_STREAM_KEYWORDS.items():
        if kw in upper:
            return label
    parts = [p.strip() for p in full_name.split(':') if p.strip()]
    if len(parts) > 1:
        return parts[1]
    return "અન્ય વ્યવસાય / આવક"

def get_dynamic_gujarati_label(full_name: str, leaf_name: str, db: Optional[Session] = None) -> str:
    """Fetches custom user label from database if available, else standard fallback."""
    if db:
        acc = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.full_name == full_name).first()
        if acc and acc.gujarati_name:
            return acc.gujarati_name
    return (
        DEFAULT_GUJARATI_MAP.get(full_name.upper()) or
        DEFAULT_GUJARATI_MAP.get(leaf_name.upper()) or
        leaf_name
    )

def sync_consolidated_accounts(db: Session) -> int:
    """
    100% Dynamic Account Synchronizer:
    Scans all database splits and transactions, discovers any new or modified accounts,
    builds parent-child links, and registers them in models.ConsolidatedAccount.
    User-defined customizations (custom labels, order) are strictly preserved!
    """
    accounts_set: Set[str] = set()

    # Discover all accounts from splits
    for (acc_name,) in db.query(models.ConsolidatedSplit.account_name).distinct():
        if acc_name and acc_name.strip():
            accounts_set.add(acc_name.strip())

    # Discover all primary accounts
    for (p_name,) in db.query(models.ConsolidatedTransaction.primary_account).distinct():
        if p_name and p_name.strip():
            accounts_set.add(p_name.strip())

    # Baseline seed accounts (e.g. from GnuCash chart of accounts that may have 0 transactions)
    accounts_set.add("ASSETS:DAIMOND- C & M Co.")
    accounts_set.add("INCOME:Rent")

    # Build all hierarchy paths
    all_paths: Set[str] = set()
    for acc in accounts_set:
        parts = [p.strip() for p in acc.split(':') if p.strip()]
        cur: List[str] = []
        for p in parts:
            cur.append(p)
            all_paths.add(':'.join(cur))

    existing_map = {a.full_name: a for a in db.query(models.ConsolidatedAccount).all()}
    added_count = 0

    for path in sorted(all_paths):
        if path not in existing_map:
            parts = path.split(':')
            leaf_name = parts[-1].strip()
            parent_name = ':'.join(parts[:-1]) if len(parts) > 1 else None
            root_t = infer_root_type(path)
            guj = DEFAULT_GUJARATI_MAP.get(path.upper()) or DEFAULT_GUJARATI_MAP.get(leaf_name.upper()) or leaf_name
            stream = infer_business_stream(path)

            new_acc = models.ConsolidatedAccount(
                full_name=path,
                name=leaf_name,
                parent_name=parent_name,
                root_type=root_t,
                gujarati_name=guj,
                business_stream=stream,
                display_order=100,
                is_active=True
            )
            db.add(new_acc)
            existing_map[path] = new_acc
            added_count += 1

    if added_count > 0:
        db.commit()

    return added_count


def classify_business_stream(acc_name: str, db: Optional[Session] = None) -> str:
    cleaned = (acc_name or "").strip()
    if db:
        acc = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.full_name == cleaned).first()
        if acc and acc.business_stream:
            return acc.business_stream
    return infer_business_stream(cleaned)


def classify_account(acc_name: str, db: Optional[Session] = None) -> Tuple[str, str]:
    cleaned = (acc_name or "").strip()
    if db:
        acc = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.full_name == cleaned).first()
        if acc:
            group_map = {
                'ASSET': 'મૂડી રોકાણ / સંપત્તિ',
                'LIABILITY': 'ઉછીના & લોન',
                'EQUITY': 'મૂડી ખાતું',
                'INCOME': 'બિઝનેસ આવક',
                'EXPENSE': 'ઘરખર્ચ / વ્યવસાય ખર્ચ'
            }
            cat_group = group_map.get(acc.root_type, 'અન્ય વ્યવહારો')
            label = acc.gujarati_name or acc.name
            return (cat_group, label)

    root_t = infer_root_type(cleaned)
    group_map = {
        'ASSET': 'મૂડી રોકાણ / સંપત્તિ',
        'LIABILITY': 'ઉછીના & લોન',
        'EQUITY': 'મૂડી ખાતું',
        'INCOME': 'બિઝનેસ આવક',
        'EXPENSE': 'ઘરખર્ચ / વ્યવસાય ખર્ચ'
    }
    cat_group = group_map.get(root_t, 'અન્ય વ્યવહારો')
    leaf = cleaned.split(':')[-1].strip()
    label = DEFAULT_GUJARATI_MAP.get(cleaned.upper()) or DEFAULT_GUJARATI_MAP.get(leaf.upper()) or leaf
    return (cat_group, label)


def calculate_financial_year(dt: datetime) -> str:
    if dt.month >= 4:
        return f"{dt.year}-{str(dt.year + 1)[-2:]}"
    else:
        return f"{dt.year - 1}-{str(dt.year)[-2:]}"


def parse_date(date_str: str) -> date:
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

    # Group splits by Transaction ID or deterministic fingerprint
    tx_groups: Dict[str, List[Dict[str, str]]] = {}
    for r in rows:
        tx_id = r.get("Transaction ID", "").strip()
        if not tx_id:
            row_fp = f"{r.get('Date', '')}|{r.get('Description', '')}|{r.get('Amount Num.', '')}|{r.get('Full Account Name', '')}"
            tx_id = "FP_" + hashlib.sha256(row_fp.encode("utf-8")).hexdigest()[:24]
        if tx_id not in tx_groups:
            tx_groups[tx_id] = []
        tx_groups[tx_id].append(r)

    # Clear old records when uploading new CSV file
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

        cat_group, _ = classify_account(primary_acc, db=db)
        biz_stream = classify_business_stream(primary_acc, db=db)
        if biz_stream == "અન્ય વ્યવસાય / આવક" or primary_acc == "Cashbook":
            for s in splits:
                s_acc = (s.get("Full Account Name") or "").strip()
                if s_acc != "Cashbook":
                    cand = classify_business_stream(s_acc, db=db)
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

        for s in splits:
            s_acc = (s.get("Full Account Name") or "").strip()
            s_amt = parse_float_amount(s.get("Amount Num."))
            s_memo = (s.get("Memo") or "").strip()
            acc_type = infer_root_type(s_acc)

            split_obj = models.ConsolidatedSplit(
                account_name=s_acc,
                account_type=acc_type,
                amount=s_amt,
                memo=s_memo if s_memo else None
            )
            tx_obj.splits.append(split_obj)

        new_tx_models.append(tx_obj)

    if new_tx_models:
        db.add_all(new_tx_models)
        db.commit()

    # Automatically synchronize any newly discovered accounts into models.ConsolidatedAccount
    sync_consolidated_accounts(db)

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


def infer_account_type(root_name: str, path: str) -> Tuple[str, int]:
    root_upper = root_name.upper()
    if 'ASSET' in root_upper:
        return 'Asset', 1
    elif 'EXPENSE' in root_upper:
        return 'Expense', 1
    elif 'INCOME' in root_upper or 'REVENUE' in root_upper:
        return 'Income', -1
    elif 'LIABILIT' in root_upper:
        return 'Liability', -1
    elif 'CAPITAL' in root_upper or 'EQUITY' in root_upper:
        return 'Equity', -1
    elif 'BANK' in root_upper or 'OLD-MONEY' in root_upper:
        return 'Bank', 1
    elif 'CASH' in root_upper:
        return 'Cash', 1
    return 'Asset', 1


# ═══════════════════════════════════════════════════════════════════════════
# GENERIC DYNAMIC TREE BUILDER (Works for arbitrary accounts, categories & depth)
# ═══════════════════════════════════════════════════════════════════════════

def build_generic_statement_tree(
    accounts: List[models.ConsolidatedAccount],
    amt_map: Dict[str, float]
) -> List[Dict[str, Any]]:
    """
    Builds a generic hierarchical tree from accounts and aggregate amounts.
    Sums up all children recursively to their parent nodes.
    Supports arbitrary depth (0, 1, 2, 3... levels) with zero hardcoded account names.
    """
    node_map: Dict[str, Dict[str, Any]] = {}

    for a in accounts:
        raw_amt = amt_map.get(a.full_name, 0.0)
        # Sign normalization:
        # Assets & Cash: Debit > 0
        # Liabilities, Equity, Income: Credit balances are negative in splits, so we use absolute values
        # Expenses: Debit balances are positive
        if a.root_type in ('INCOME', 'LIABILITY', 'EQUITY', 'EXPENSE'):
            direct_bal = abs(raw_amt)
        else:
            direct_bal = raw_amt

        node_map[a.full_name] = {
            'id': a.id,
            'name': a.name,
            'full_name': a.full_name,
            'parent_name': a.parent_name,
            'root_type': a.root_type,
            'gujarati_name': a.gujarati_name or a.name,
            'business_stream': a.business_stream,
            'direct_balance': direct_bal,
            'balance': direct_bal,
            'children': []
        }

    # Build parent-child links
    root_nodes: List[Dict[str, Any]] = []
    for full_name, node in node_map.items():
        p_name = node['parent_name']
        if p_name and p_name in node_map:
            node_map[p_name]['children'].append(node)
        else:
            root_nodes.append(node)

    # Recursive balance rollup
    def rollup(n: Dict[str, Any]) -> float:
        child_sum = 0.0
        for c in n['children']:
            child_sum += rollup(c)
        n['children'].sort(key=lambda x: (x['name'].upper()))
        n['has_children'] = len(n['children']) > 0
        n['balance'] = round(n['direct_balance'] + child_sum, 2)
        return n['balance']

    for r in root_nodes:
        rollup(r)

    root_nodes.sort(key=lambda x: (x['root_type'], x['name'].upper()))
    return root_nodes


def get_accounts_tree_data(db: Session) -> List[Dict[str, Any]]:
    """
    Dynamic Hierarchical Tree Builder for Chart of Accounts.
    Reads directly from database splits and models.ConsolidatedAccount.
    """
    sync_consolidated_accounts(db)

    rows = db.query(
        models.ConsolidatedSplit.account_name,
        func.sum(models.ConsolidatedSplit.amount).label('total'),
        func.count(models.ConsolidatedSplit.id).label('tx_count')
    ).group_by(models.ConsolidatedSplit.account_name).all()

    amt_map = {name: float(total or 0.0) for name, total, _ in rows}
    all_accs = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.is_active == True).all()

    roots = build_generic_statement_tree(all_accs, amt_map)

    # Map order for standard accounting presentation
    order_map = {
        'ASSETS': 1,
        'CAP. OLD-MONEY 24-25': 2,
        'CAPITAL ACC': 3,
        'CASHBOOK': 4,
        'EXPENSES': 5,
        'INCOME': 6,
        'LIABILITIES': 7
    }

    # Helper to convert to AccountTreeNode format expected by frontend tree
    def format_tree_node(n: Dict[str, Any]) -> Dict[str, Any]:
        ac_type, _ = infer_account_type(n['name'], n['full_name'])
        return {
            'name': n['name'],
            'full_name': n['full_name'],
            'type': ac_type,
            'gujarati_name': n['gujarati_name'],
            'balance': n['balance'],
            'tx_count': 0,
            'has_children': n['has_children'],
            'children': [format_tree_node(c) for c in n['children']]
        }

    formatted = [format_tree_node(r) for r in roots]
    formatted.sort(key=lambda r: (order_map.get(r['name'].upper(), 99), r['name'].upper()))
    return formatted


def get_balance_sheet_data(db: Session, as_of_date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    100% Dynamic Multicolumn Balance Sheet calculation.
    Assets = Liabilities + Equity
    Uses models.ConsolidatedAccount to dynamically assemble any number of Asset,
    Liability, and Equity accounts with zero hardcoded names.
    """
    sync_consolidated_accounts(db)

    if as_of_date_str:
        try:
            as_of = datetime.strptime(as_of_date_str, "%Y-%m-%d").date()
        except ValueError:
            as_of = date(2026, 12, 31)
    else:
        as_of = date(2026, 12, 31)

    splits = db.query(
        models.ConsolidatedSplit.account_name,
        func.sum(models.ConsolidatedSplit.amount)
    ).join(models.ConsolidatedTransaction).filter(
        models.ConsolidatedTransaction.date <= as_of
    ).group_by(models.ConsolidatedSplit.account_name).all()

    amt_map = {n: float(a or 0.0) for n, a in splits}
    all_accs = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.is_active == True).all()

    # 1. Assets (All accounts marked ASSET)
    asset_accs = [a for a in all_accs if a.root_type == 'ASSET']
    asset_roots = build_generic_statement_tree(asset_accs, amt_map)
    total_asset = round(sum(r['balance'] for r in asset_roots), 2)

    # Separate main ASSETS root from standalone asset accounts (e.g. Cashbook, Old-Money)
    assets_group = next((r for r in asset_roots if r['name'].upper() == 'ASSETS'), None)
    assets_children = assets_group['children'] if assets_group else [r for r in asset_roots if r['has_children']]
    standalone_assets = [r for r in asset_roots if r != assets_group and not r.get('parent_name')]

    # 2. Liabilities (All accounts marked LIABILITY)
    liab_accs = [a for a in all_accs if a.root_type == 'LIABILITY']
    liab_roots = build_generic_statement_tree(liab_accs, amt_map)
    total_liab = round(sum(r['balance'] for r in liab_roots), 2)

    liab_group = next((r for r in liab_roots if r['name'].upper() == 'LIABILITIES'), None)
    liab_children = liab_group['children'] if liab_group else liab_roots

    # 3. Equity (All accounts marked EQUITY)
    equity_accs = [a for a in all_accs if a.root_type == 'EQUITY']
    equity_roots = build_generic_statement_tree(equity_accs, amt_map)
    total_explicit_equity = round(sum(r['balance'] for r in equity_roots), 2)

    # Accounting Identity: Retained Earnings balances Assets with Liabilities and Capital
    unrealized_gains = 0.0
    retained_earnings = round(total_asset - total_liab - total_explicit_equity, 2)
    total_equity = round(total_explicit_equity + unrealized_gains + retained_earnings, 2)
    total_liab_and_equity = round(total_liab + total_equity, 2)

    cap_acc = total_explicit_equity

    return {
        "as_of_date": as_of.strftime("%Y-%m-%d"),
        "as_of_date_formatted": as_of.strftime("%d-%m-%Y"),
        "assets": {
            "root_name": "ASSETS",
            "root_total": round(assets_group['balance'] if assets_group else total_asset, 2),
            "children": assets_children,
            "standalone": standalone_assets,
            "total_asset": total_asset,
            "tree": asset_roots
        },
        "liabilities": {
            "root_name": "LIABILITIES",
            "root_total": round(liab_group['balance'] if liab_group else total_liab, 2),
            "children": liab_children,
            "total_liability": total_liab,
            "tree": liab_roots
        },
        "equity": {
            "accounts": equity_roots,
            "capital_acc": round(cap_acc, 2),
            "capital_acc_name": "Capital Acc",
            "capital_acc_full": "Capital Acc",
            "unrealized_gains": round(unrealized_gains, 2),
            "retained_earnings": round(retained_earnings, 2),
            "total_equity": round(total_equity, 2),
            "tree": equity_roots
        },
        "total_liability_and_equity": total_liab_and_equity
    }


def get_income_statement_data(
    db: Session,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> Dict[str, Any]:
    """
    100% Dynamic Multicolumn Income Statement calculation.
    Net Income = Total Income - Total Expense
    Uses generic recursive trees to render any depth of income or expense categories dynamically.
    """
    sync_consolidated_accounts(db)

    if start_date_str:
        try:
            start_d = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            start_d = date(2025, 11, 1)
    else:
        start_d = date(2025, 11, 1)

    if end_date_str:
        try:
            end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            end_d = date(2026, 12, 31)
    else:
        end_d = date(2026, 12, 31)

    splits = db.query(
        models.ConsolidatedSplit.account_name,
        func.sum(models.ConsolidatedSplit.amount)
    ).join(models.ConsolidatedTransaction).filter(
        models.ConsolidatedTransaction.date >= start_d,
        models.ConsolidatedTransaction.date <= end_d
    ).group_by(models.ConsolidatedSplit.account_name).all()

    amt_map = {n: float(a or 0.0) for n, a in splits}
    all_accs = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.is_active == True).all()

    # 1. Income Tree
    inc_accs = [a for a in all_accs if a.root_type == 'INCOME']
    inc_roots = build_generic_statement_tree(inc_accs, amt_map)
    total_income = round(sum(r['balance'] for r in inc_roots), 2)

    inc_group = next((r for r in inc_roots if r['name'].upper() == 'INCOME'), None)
    inc_children = inc_group['children'] if inc_group else inc_roots

    # 2. Expense Tree
    exp_accs = [a for a in all_accs if a.root_type == 'EXPENSE']
    exp_roots = build_generic_statement_tree(exp_accs, amt_map)
    total_expense = round(sum(r['balance'] for r in exp_roots), 2)

    exp_group = next((r for r in exp_roots if r['name'].upper() == 'EXPENSES'), None)
    exp_children = exp_group['children'] if exp_group else exp_roots

    # Backward compatibility helper for BHEGA
    bhega_node = next((c for c in exp_children if c['name'].upper() == 'BHEGA'), None)

    net_income = round(total_income - total_expense, 2)

    return {
        "start_date": start_d.strftime("%Y-%m-%d"),
        "end_date": end_d.strftime("%Y-%m-%d"),
        "start_date_formatted": start_d.strftime("%d-%m-%Y"),
        "end_date_formatted": end_d.strftime("%d-%m-%Y"),
        "income": {
            "root_name": "INCOME",
            "root_total": total_income,
            "children": inc_children,
            "total_income": total_income,
            "tree": inc_roots
        },
        "expense": {
            "root_name": "EXPENSES",
            "root_total": total_expense,
            "bhega": bhega_node,
            "children": exp_children,
            "total_expense": total_expense,
            "tree": exp_roots
        },
        "net_income": net_income
    }


def get_account_statement_data(db: Session, account_name: str) -> Dict[str, Any]:
    """
    Returns full ledger statement for a single account:
    All matching transactions, splits, inflows, outflows, and net balance.
    """
    prefix = f"{account_name}:"
    query = db.query(models.ConsolidatedTransaction).filter(
        (models.ConsolidatedTransaction.primary_account == account_name) |
        (models.ConsolidatedTransaction.primary_account.startswith(prefix)) |
        (models.ConsolidatedTransaction.splits.any(
            (models.ConsolidatedSplit.account_name == account_name) |
            (models.ConsolidatedSplit.account_name.startswith(prefix))
        ))
    ).order_by(models.ConsolidatedTransaction.date.desc(), models.ConsolidatedTransaction.id.desc())

    txs = query.all()

    total_in = 0.0
    total_out = 0.0
    tx_list = []

    for t in txs:
        matched_split = next((s for s in t.splits if s.account_name == account_name or s.account_name.startswith(prefix)), None)
        split_amt = matched_split.amount if matched_split else (t.inflow if t.inflow > 0 else -t.outflow)

        in_val = t.inflow
        out_val = t.outflow
        total_in += in_val
        total_out += out_val

        tx_list.append({
            "id": t.id,
            "date": t.date.strftime("%Y-%m-%d"),
            "description": t.description,
            "notes": t.notes,
            "primary_account": t.primary_account,
            "business_stream": t.business_stream,
            "inflow": in_val,
            "outflow": out_val,
            "split_amount": split_amt,
            "splits": [
                {
                    "account_name": s.account_name,
                    "amount": s.amount,
                    "memo": s.memo
                }
                for s in t.splits
            ]
        })

    # Retrieve custom label from database
    acc = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.full_name == account_name).first()
    guj = acc.gujarati_name if acc else DEFAULT_GUJARATI_MAP.get(account_name.upper())

    return {
        "account_name": account_name,
        "gujarati_name": guj,
        "total_inflow": round(total_in, 2),
        "total_outflow": round(total_out, 2),
        "net_balance": round(total_in - total_out, 2),
        "transaction_count": len(tx_list),
        "transactions": tx_list
    }


def get_all_registered_accounts(db: Session) -> List[Dict[str, Any]]:
    sync_consolidated_accounts(db)
    accs = db.query(models.ConsolidatedAccount).order_by(
        models.ConsolidatedAccount.root_type,
        models.ConsolidatedAccount.display_order,
        models.ConsolidatedAccount.full_name
    ).all()

    return [
        {
            "id": a.id,
            "full_name": a.full_name,
            "name": a.name,
            "parent_name": a.parent_name,
            "root_type": a.root_type,
            "gujarati_name": a.gujarati_name,
            "business_stream": a.business_stream,
            "display_order": a.display_order,
            "is_active": a.is_active
        }
        for a in accs
    ]


def update_account_metadata(
    db: Session,
    account_id: int,
    gujarati_name: Optional[str] = None,
    business_stream: Optional[str] = None,
    display_order: Optional[int] = None,
    is_active: Optional[bool] = None
) -> Dict[str, Any]:
    acc = db.query(models.ConsolidatedAccount).filter(models.ConsolidatedAccount.id == account_id).first()
    if not acc:
        raise ValueError("Account not found")

    if gujarati_name is not None:
        acc.gujarati_name = gujarati_name.strip()
    if business_stream is not None:
        acc.business_stream = business_stream.strip()
    if display_order is not None:
        acc.display_order = display_order
    if is_active is not None:
        acc.is_active = is_active

    db.commit()
    db.refresh(acc)

    return {
        "id": acc.id,
        "full_name": acc.full_name,
        "name": acc.name,
        "parent_name": acc.parent_name,
        "root_type": acc.root_type,
        "gujarati_name": acc.gujarati_name,
        "business_stream": acc.business_stream,
        "display_order": acc.display_order,
        "is_active": acc.is_active
    }
