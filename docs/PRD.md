# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1️⃣ PROJECT OVERVIEW

### Product Name
**Roomettes**

### One-Line Description
A mobile-only app that helps roommates easily track shared expenses and instantly know who owes whom.

### Problem Statement
College students and roommates often share daily expenses like groceries, rent, food, and utilities. Tracking these manually leads to confusion, forgotten entries, and arguments about who owes how much.

### Solution
A simple mobile app where all roommates can add expenses, split them fairly, and see real-time balances showing who owes whom—no calculations, no fights.

---

## 2️⃣ TARGET USERS

### Primary User
**Who:** College students living with roommates  
**Age:** 18–26  
**Tech Comfort:** Medium to High  
**Main Goal:** Track shared expenses quickly and fairly without manual calculations

### Secondary Users
None (v1 focuses only on students/roommates)

---

## 3️⃣ CORE FEATURES (MVP ONLY)

### Feature 1: Add & Split Expenses

**What it does:**  
Allows any roommate to add an expense and split it equally or with custom amounts among selected roommates.

**User story:**  
"As a roommate, I want to add a shared expense so that everyone knows how much they owe."

**Acceptance criteria:**
- [ ] User can enter expense name and amount
- [ ] User can select who paid
- [ ] User can split expense equally
- [ ] User can split expense with custom amounts
- [ ] Expense is saved instantly

---

### Feature 2: Automatic Balance Calculation

**What it does:**  
Automatically calculates net balances showing who owes money and who should receive money.

**User story:**  
"As a roommate, I want the app to calculate balances automatically so I don’t have to do math."

**Acceptance criteria:**
- [ ] App calculates balances after every expense
- [ ] Shows who owes whom and how much
- [ ] Balances update in real time
- [ ] No manual adjustment allowed

---

### Feature 3: Expense History & Monthly Totals

**What it does:**  
Displays a list of all past expenses with simple monthly totals.

**User story:**  
"As a roommate, I want to see past expenses so I understand where the money went."

**Acceptance criteria:**
- [ ] List view of all expenses
- [ ] Shows amount, payer, and date
- [ ] Monthly total is displayed
- [ ] Old expenses remain read-only

---

## 4️⃣ USER FLOWS

### Flow 1: Add New Expense

**Steps:**
1. User opens app
2. User taps "Add Expense"
3. User enters amount and description
4. User selects who paid
5. User chooses split type
6. System saves expense
7. Updated balances are shown

---

### Flow 2: View Balances

**Steps:**
1. User opens app
2. User lands on balance screen
3. System displays who owes whom
4. User reviews settle-up summary

---

## 5️⃣ DATA MODELS

### Model 1: User

**Fields:**
- `id` (string, unique)
- `name` (string, required)
- `createdAt` (timestamp)

**Relationships:**
- Has many: Expenses

---

### Model 2: Expense

**Fields:**
- `id` (string, unique)
- `title` (string, required)
- `amount` (number, required)
- `paidBy` (userId)
- `splitType` (enum: equal | custom)
- `splits` (array of userId + amount)
- `createdAt` (timestamp)

**Relationships:**
- Belongs to: Group
- Created by: User

---

### Model 3: Group

**Fields:**
- `id` (string, unique)
- `name` (string)
- `members` (array of userIds)

**Relationships:**
- Has many: Users
- Has many: Expenses

---

## 6️⃣ BUSINESS RULES

### Rule 1: Expense Ownership
Only group members can add expenses to that group.

### Rule 2: Balance Calculation
Balances are calculated as total paid minus total owed per user.

### Rule 3: Platform Restriction
App is strictly mobile-only (Android & iOS). No desktop support.

---

## 7️⃣ EDGE CASES & ERROR HANDLING

### Edge Case 1: Split mismatch
**What happens:** Custom split doesn’t equal total amount  
**How to handle:**
- Show error message
- Disable save button

---

### Edge Case 2: Empty expense
**What happens:** User submits without amount  
**How to handle:**
- Inline validation
- Prevent submission

---

## 8️⃣ SECURITY REQUIREMENTS

- [ ] Validate all inputs
- [ ] Prevent negative values
- [ ] Group data visible only to members

---

## 9️⃣ PERFORMANCE REQUIREMENTS

- [ ] App loads within 2 seconds
- [ ] Expense addition under 300ms
- [ ] Works on low-end phones

---

## 🔟 INTEGRATIONS

### Integration 1: Database / Sync
**Purpose:** Store and sync data  
**What it does:**
- Saves expenses
- Syncs balances across users

---

## 1️⃣1️⃣ OUT OF SCOPE (v1)

- ❌ Payments / UPI
- ❌ Desktop or web version
- ❌ Categories & analytics
- ❌ Notifications
- ❌ Multi-language support

---

## 1️⃣2️⃣ SUCCESS METRICS

- [ ] 80% users add an expense
- [ ] Users return 3+ times in first week
- [ ] Zero balance calculation complaints

---

## 1️⃣3️⃣ TIMELINE

**MVP Deadline:** 2 hours

**Milestones:**
- Hour 1: UI + add expense logic
- Hour 2: Balances + history

---

## 1️⃣4️⃣ NOTES & ASSUMPTIONS

**Assumptions:**
- Users are students
- Simple UI is acceptable
- Internet is available

**Open Questions:**
- Login vs local-only?
- Single group or multiple groups?

---

## ✅ SIGN-OFF

**Approved by:** Rajat  
**Date:** Today

