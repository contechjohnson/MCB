# Denefits Contracts Analysis

**File:** `contracts_export.xlsx` → converted to `denefits_contracts.csv`
**Analyzed:** November 5, 2025

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| **Total Contracts** | 103 |
| **Total Financed** | $271,208.00 |
| **Average Plan Amount** | $2,633.09 |
| **Total Down Payments** | $2,675.00 |
| **Date Range** | Aug 13, 2025 - Nov 5, 2025 |
| **Missing Emails** | 0 (100% have emails!) |

---

## 📈 Contract Status Breakdown

| Status | Count | Percentage |
|--------|-------|------------|
| **Active** | 99 | 96.1% |
| **Overdue** | 2 | 1.9% |
| **Completed** | 1 | 1.0% |
| **Cancelled** | 1 | 1.0% |

---

## 💰 Financial Details

**Payment Plan Structure:**
- Most common: 18 monthly payments
- Down payment: Typically $0 (rare to have down payment)
- Interest rates: ~19.4% on average
- Recurring payment: ~$188/month average

**Total Revenue:**
- Financed amount: $271,208.00
- This represents revenue already earned (they paid upfront via Denefits)
- Denefits collects from customers over time

---

## 📋 Available Fields

The Denefits export has **27 columns** with complete data:

### **Customer Information:**
- Payment Plan ID (e.g., "BRKSZJ139062")
- Customer Name
- Customer Email ✅ (100% populated)
- Customer Mobile
- Customer Address
- Guardian First Name / Last Name (usually "-" if not applicable)

### **Financial Details:**
- Payment Plan Amount (total financed)
- Service Amount
- Down Payment Amount
- Recurring Payment (monthly)
- Number of Payments
- Number of Remaining Payments
- Interest Rate (%)
- Interest Amount
- Monthly Payout to Business Owner
- Customer Payoff Amount
- Due Principal
- Due Interest

### **Contract Details:**
- Payment Plan Sign Up Date ✅ (when contract started)
- Payment Plan Status (Active/Overdue/Completed/Cancelled)
- Contract Verification Status
- Payment Plan Type (e.g., "EZ Payment Plan")
- Next Recurring Payment Date
- Payment Plan Created (how: "Remotely")
- Payment Plan Created by User

### **Business:**
- Location Name (always "POSTPARTUM CARE USA")

---

## 🎯 What This Means for Your Data

### **Good News:**
1. ✅ **All 103 contracts have emails** - Perfect for matching to contacts!
2. ✅ **Clean, structured data** - Denefits export is very consistent
3. ✅ **Complete financial details** - Know exact amounts, payment schedules
4. ✅ **Recent data** - Aug-Nov 2025 (last ~3 months)
5. ✅ **Can track payment status** - See who's active vs overdue

### **Important Notes:**
1. 📅 **This is recent data only** - Older Denefits contracts (before Aug 2025) not included
2. 💵 **$271k financed** - This is real revenue to your business
3. 🔍 **Can match to contacts by email** - Link these 103 customers to their funnel journey
4. ⏰ **Payment tracking** - Know who's on track, who's overdue, who completed

---

## 🔗 Integration with Other Data

### **Matching Strategy:**
- **Primary key:** Customer Email (all 103 have emails!)
- **Can link to:**
  - Google Sheets contacts (by email)
  - Airtable contacts (by email)
  - Stripe payments (by email) to get full payment history

### **What You'll Learn:**
- Which trigger words led to BNPL (Buy Now Pay Later) purchases
- Time from first contact to Denefits signup
- Conversion rate: contacts → Denefits customers
- Average deal size for BNPL vs full payment (Stripe)
- Which ads drove BNPL customers

---

## 📝 Import Recommendations

### **Map to `hist_payments` table:**

```
Payment Plan ID → external_id
Customer Email → email
Customer Name → (parse to first/last name if needed)
Customer Mobile → (can update hist_contacts.phone)
Payment Plan Sign Up Date → payment_date
Payment Plan Amount → amount
Payment Plan Status → (store in payment_type or notes)
Payment Plan Type → payment_type ("buy_now_pay_later")
Recurring Payment → (store in JSON details if needed)
Number of Payments → (store in JSON details)
Number of Remaining Payments → (store in JSON details)
```

### **Timeline Events:**

Create events for:
- `denefits_signup` - When contract was signed
- `denefits_completed` - If status = "Completed"
- `denefits_overdue` - If status = "Overdue"

### **Update `hist_contacts`:**

For each customer:
- Set `has_purchase = TRUE`
- Set `purchase_date = Payment Plan Sign Up Date`
- Add to `purchase_amount` (aggregate with Stripe if they have both)
- Mark as BNPL customer

---

## 🚀 Next Steps

1. **Wait for Stripe export** - This will give you full payment history
2. **Import Denefits contracts** - Use updated `import_payments.py` script
3. **Match to contacts** - Link by email to see full customer journey
4. **Calculate BNPL vs Full Payment** - Compare Stripe vs Denefits customers
5. **Analyze BNPL conversion** - See which marketing sources drive BNPL

---

## 💡 Key Insights You Can Get

Once imported:

✅ **BNPL adoption rate** - What % of customers choose financing?
✅ **BNPL customer profile** - What do they have in common?
✅ **Revenue mix** - How much comes from Stripe vs Denefits?
✅ **Payment plan performance** - Completion rate, overdue rate
✅ **Time to purchase** - How long from first contact to Denefits signup?
✅ **Source attribution** - Which ads/trigger words drive BNPL?

---

This is valuable data! 103 contracts worth $271k in the last 3 months shows strong BNPL adoption.
