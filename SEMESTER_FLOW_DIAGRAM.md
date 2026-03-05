# Semester Flow Diagram - Textual Representation

## Semester Lifecycle Flow

```
SEMESTER START
       ↓
   ONGOING (Student enrolled, classes in progress)
       ↓
   ← FEES DUE/PAYMENT ←
       ↓
   SUBJECT SELECTION (MJC, MIC, MDC, SEC, VAC)
       ↓
   ← ATTENDANCE & ASSESSMENT ←
       ↓
   COMPLETED ──→ FAILED
       ↓           ↑
   ← AUTO-        │
   PROMOTION      │
       ↓           │
   NEXT SEMESTER ←─┘
       ↓
   REPEAT PROCESS
```

## Detailed Flow Description

### 1. ONGOING Status
- Student assigned to semester
- Classes begin
- Student must pay semester fees
- Student selects subjects for the semester (MJC, MIC, MDC, SEC, VAC)

### 2. Subject Selection Process
- Student can select only 1 MJC (Major Core)
- Student can select only 1 MIC (Minor Core)
- Student can select only 1 MDC (Multi-Disciplinary Course)
- Student can select multiple SEC (Skill Enhancement Courses)
- Student can select multiple VAC (Value Added Courses)

### 3. Assessment & Evaluation
- Regular assessments conducted
- Attendance tracked
- Final evaluation performed

### 4. COMPLETED Status
- Student successfully completes semester requirements
- **AUTOMATIC**: System auto-creates next semester assignment
- Student promoted to next semester
- Student status updated to new semester

### 5. FAILED Status
- Student does not meet semester requirements
- Student remains in same semester
- Can repeat semester or be detained
- Manual intervention required for repeat/detention

### 6. PROMOTION Process
- **AUTOMATIC**: When status set to COMPLETED, system auto-assigns next semester
- **MANUAL**: Admin/HOD can manually promote via bulk operations
- **VALIDATION**: System checks previous semester completion before promotion

## Status Transitions

```
ONGOING → COMPLETED → NEXT SEMESTER (Auto-promotion)
  ↓
FAILED → REPEAT/DETAIN → MANUAL INTERVENTION
  ↓
PROMOTED → NEXT SEMESTER (Manual promotion)
```

## Business Rules

1. **One Active Semester Rule**: A student can only have one ongoing semester at a time
2. **Subject Type Restrictions**: Each subject type (MJC, MIC, MDC) limited to one per semester
3. **Sequential Progression**: Student must complete previous semester to advance
4. **Auto-assignment**: Completed semesters trigger automatic next semester assignment
5. **Manual Override**: Admin/HOD can manually assign semesters for special cases
6. **Fee Payment**: Semester completion may require fee payment status