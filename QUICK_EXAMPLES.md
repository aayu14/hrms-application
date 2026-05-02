# ⚡ Quick Reference Guide

## Copy-Paste Ready Examples

### 🚀 Employee Self-Service Portal

```javascript
// Employee submits leave request
const leaveRequest = await EmployeeSelfService.requestTimeOff(
    employeeId,
    {
        type: 'Vacation',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        reason: 'Family vacation'
    }
);
console.log('Leave requested:', leaveRequest);
```

**Result:** 
- ✅ Request saved to database
- ✅ Manager notified via Slack (if enabled)
- ✅ Audit logged

---

### 📊 Performance Review Workflow

```javascript
// Manager creates review
const review = PerformanceManagement.createReview({
    employeeId: 1,
    employeeName: 'John Doe',
    reviewerId: 5,
    reviewerName: 'Sarah Manager',
    period: 'Q2 2026',
    ratings: {
        'Technical Skills': 4.5,
        'Communication': 4.0,
        'Leadership': 3.5,
        'Teamwork': 4.2,
        'Initiative': 4.0
    },
    comments: 'Strong technical background, needs leadership development',
    goals: ['Lead team project', 'Mentor 2 junior developers'],
    areasForImprovement: ['Delegation', 'Long-term planning']
});

// Get performance summary
const summary = PerformanceManagement.getEmployeeSummary(1);
console.log(`Average Rating: ${summary.averageRating}/5`);
console.log(`Trend: ${summary.trend}`);
```

---

### 🎓 Training Enrollment Campaign

```javascript
// Create new training program
const program = TrainingManagement.createProgram({
    name: 'Leadership Excellence 2026',
    description: 'Develop leadership and management skills',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    instructor: 'Dr. James Smith',
    budget: 25000
});

// Enroll multiple employees
const departments = ['Engineering', 'Finance', 'Sales'];
const employees = db.getCollection('employees');

employees.forEach(emp => {
    if (departments.includes(emp.department)) {
        TrainingManagement.enrollEmployee(program.id, emp.id);
    }
});

// Send announcement
Communications.sendAnnouncement({
    title: '📚 Leadership Training - Enrollment Open',
    message: `Join our ${program.name} program. Limited seats available!`,
    author: 'HR Team',
    department: 'All',
    priority: 'High',
    expiryDate: '2026-06-15'
});

// Notify via Teams
await MicrosoftTeamsIntegration.sendMessage(
    'Training Program Available',
    `${program.name} starting ${program.startDate}`
);
```

---

### 💰 Expense Approval Workflow

```javascript
// Employee submits expense
const expense = ExpenseManagement.submitExpense(1, {
    category: 'Business Travel',
    amount: 450.00,
    currency: 'USD',
    description: 'Flight and hotel for NYC conference',
    date: '2026-05-15',
    receipt: 'url_to_receipt.pdf'
});

console.log(`Expense submitted: ${expense.id}`);

// Manager approves
const approved = ExpenseManagement.approveExpense(expense.id, 5, 'Approved - valid business expense');

// Get summary
const summary = ExpenseManagement.getEmployeeSummary(1, 4, 2026); // April 2026
console.log(`Total Approved: $${summary.approved} out of ${summary.totalAmount}`);

// Send to QuickBooks for accounting
if (IntegrationManager.integrations.quickbooks?.enabled) {
    await QuickBooksIntegration.createExpense(approved);
}
```

---

### 🔄 NetSuite Data Sync

```javascript
// Initialize NetSuite connection
await IntegrationManager.init('netsuite', {
    realm: '12345678',
    consumerId: 'xxx_consumer_key',
    consumerSecret: 'xxx_consumer_secret',
    tokenId: 'xxx_token_id',
    tokenSecret: 'xxx_token_secret'
});

// Sync all HR data
const results = await IntegrationManager.sync('netsuite', [
    'employees',
    'payroll',
    'attendance',
    'leave',
    'recruitment'
]);

// Check results
console.log('Sync Results:');
Object.entries(results).forEach(([type, result]) => {
    if (result.synced) {
        console.log(`✅ ${type}: ${result.count} records`);
    } else {
        console.log(`❌ ${type}: ${result.error}`);
    }
});
```

---

### 📢 Slack Notifications

```javascript
// Setup Slack
await IntegrationManager.init('slack', {
    // webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
});

// Send leave notification
await SlackIntegration.sendMessage(
    '#hr-approvals',
    '🏖️ New Leave Request',
    [
        {
            color: '#FF9900',
            fields: [
                { title: 'Employee', value: 'John Doe', short: true },
                { title: 'Type', value: 'Vacation - 5 days', short: true },
                { title: 'Dates', value: 'June 1-5, 2026', short: false }
            ]
        }
    ]
);

// Send payroll notification
await SlackIntegration.notifyPayrollApproval(50, 125000);

// Send general alert
await SlackIntegration.sendMessage(
    '#finance',
    '💰 Monthly Budget Report'
);
```

---

### 📋 Compliance Tracking

```javascript
// Create compliance requirement
const requirement = ComplianceManagement.createRequirement({
    name: 'Annual Data Privacy Training',
    description: 'GDPR and data protection training',
    category: 'Training',
    frequency: 'Annual',
    dueDate: '2026-12-31',
    applicableRoles: ['All']
});

// Mark as completed for employee
ComplianceManagement.completeRequirement(
    requirement.id,
    1,
    'Certificate: https://training.example.com/cert/123'
);

// Get compliance dashboard
const dashboard = ComplianceManagement.getComplianceDashboard();

console.log(`Compliance Status:`);
console.log(`  Completion Rate: ${dashboard.completionRate}%`);
console.log(`  Overdue Items: ${dashboard.overdue.length}`);
console.log(`  Upcoming: ${dashboard.upcoming.length}`);

// Send alerts for overdue items
for (const item of dashboard.overdue) {
    await SlackIntegration.sendMessage(
        '#compliance',
        `⚠️ Overdue: ${item.name}`
    );
}
```

---

### 🎯 Goal Setting & OKRs

```javascript
// Manager sets employee goals
const goal1 = GoalManagement.createGoal(1, {
    title: 'Launch Payment System',
    description: 'Lead development of new payment module',
    category: 'Team',
    keyResults: [
        'Complete API design by May 15',
        'Build MVP by June 15',
        'Launch beta by July 1'
    ],
    targetDate: '2026-07-31'
});

// Employee updates progress
GoalManagement.updateGoalProgress(goal1.id, 33, 'API design completed');

// Check in later
GoalManagement.updateGoalProgress(goal1.id, 66, 'MVP development in progress');

// Complete goal
GoalManagement.updateGoalProgress(goal1.id, 100, 'Launched successfully!');

// Get all goals
const goals = GoalManagement.getEmployeeGoals(1);
console.log(`Employee has ${goals.length} active goals`);
```

---

### 🏥 Benefits Enrollment

```javascript
// Create benefit plans
const healthPlan = BenefitsManagement.createPlan({
    name: 'Premium Health Coverage',
    type: 'Health',
    provider: 'United Healthcare',
    cost: 450,
    coverage: 'Comprehensive',
    deductible: 1500
});

const dentalPlan = BenefitsManagement.createPlan({
    name: 'Dental Plus',
    type: 'Dental',
    provider: 'Delta Dental',
    cost: 50,
    coverage: 'Preventive + Basic',
    deductible: 50
});

// Open enrollment announcement
Communications.sendAnnouncement({
    title: '💚 Open Enrollment Starts Tomorrow',
    message: 'Enroll in health, dental, vision, and 401(k) plans. Deadline: May 31',
    author: 'Benefits Team',
    department: 'All',
    priority: 'High',
    expiryDate: '2026-05-31'
});

// Enroll employee
BenefitsManagement.enrollInBenefit(1, healthPlan.id);
BenefitsManagement.enrollInBenefit(1, dentalPlan.id);

// Get employee benefits
const benefits = BenefitsManagement.getEmployeeBenefits(1);
console.log(`Employee enrolled in ${benefits.length} benefit plans`);
```

---

### 🔐 Shift Scheduling

```javascript
// Create shifts
const morningShift = ShiftManagement.createShift({
    name: 'Morning Shift',
    startTime: '08:00',
    endTime: '16:00',
    breakDuration: 1,
    workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
});

const eveningShift = ShiftManagement.createShift({
    name: 'Evening Shift',
    startTime: '16:00',
    endTime: '00:00',
    breakDuration: 1,
    workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
});

// Assign employees
ShiftManagement.assignShift(1, morningShift.id, '2026-06-01');
ShiftManagement.assignShift(2, eveningShift.id, '2026-06-01');

// Get employee schedule for the week
const schedule = ShiftManagement.getSchedule(1, '2026-05-25');
console.log(`Employee schedule this week:`, schedule);
```

---

### 🎓 Skills Inventory

```javascript
// Add skills to employee
SkillsManagement.addSkill(1, {
    skill: 'JavaScript',
    proficiency: 5,
    yearsOfExperience: 7
});

SkillsManagement.addSkill(1, {
    skill: 'React',
    proficiency: 4,
    yearsOfExperience: 3
});

SkillsManagement.addSkill(1, {
    skill: 'Node.js',
    proficiency: 4,
    yearsOfExperience: 5
});

// Get employee skills
const skills = SkillsManagement.getEmployeeSkills(1);
console.log(`Employee has ${skills.length} skills`);

// Get training recommendations
const recommendations = SkillsManagement.recommendTraining(1);
console.log('Training recommendations:', recommendations);

// Endorse peer's skill
SkillsManagement.endorseSkill('SK-123456', 5); // Manager endorses
```

---

### 🤝 Multiple Integration Setup

```javascript
// Setup all integrations at once
async function setupAllIntegrations() {
    try {
        // NetSuite
        await IntegrationManager.init('netsuite', {
            realm: '12345678',
            consumerId: 'key',
            consumerSecret: 'secret',
            tokenId: 'token',
            tokenSecret: 'token_secret'
        });

        // Slack
        await IntegrationManager.init('slack', {
            webhookUrl: 'https://hooks.slack.com/services/...'
        });

        // HubSpot
        await IntegrationManager.init('hubspot', {
            apiKey: 'your_api_key'
        });

        // Microsoft Teams
        await IntegrationManager.init('teams', {
            webhookUrl: 'https://outlook.webhook.office.com/...'
        });

        // Verify all connections
        const allIntegrations = IntegrationManager.getAll();
        console.log('Active integrations:', allIntegrations);

    } catch (error) {
        console.error('Setup failed:', error);
    }
}

setupAllIntegrations();
```

---

### 📅 Scheduled Auto-Sync

```javascript
// Auto-sync every hour
function startAutoSync() {
    setInterval(async () => {
        try {
            const results = await IntegrationManager.sync('netsuite', [
                'employees',
                'payroll',
                'attendance'
            ]);
            
            console.log(`✅ Auto-sync completed at ${new Date().toLocaleTimeString()}`);
            
            // Send summary to Slack
            if (Object.values(results).every(r => r.synced)) {
                await SlackIntegration.sendMessage(
                    '#ops',
                    '✅ NetSuite sync completed successfully'
                );
            }
        } catch (error) {
            console.error('Auto-sync failed:', error);
            await SlackIntegration.sendMessage(
                '#ops',
                `❌ NetSuite sync failed: ${error.message}`
            );
        }
    }, 3600000); // Every hour
}

startAutoSync();
```

---

### 📊 Generate HR Reports

```javascript
// Generate comprehensive HR report
function generateHRReport(month, year) {
    const employees = db.getCollection('employees');
    const attendance = db.getCollection('attendance');
    const payroll = db.getCollection('payroll');
    const training = db.getCollection('training');
    const performance = db.getCollection('performance');

    const report = {
        month: month,
        year: year,
        generatedDate: new Date().toISOString(),
        
        // Headcount
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.status === 'Active').length,
        
        // Attendance
        averageAttendance: this.calculateAttendance(attendance, month, year),
        
        // Payroll
        totalPayroll: payroll
            .filter(p => p.month === month && p.year === year)
            .reduce((sum, p) => sum + p.net, 0),
        
        // Training
        employeesInTraining: training.filter(t => 
            t.status === 'Active' || t.status === 'In Progress'
        ).length,
        
        // Performance
        averageRating: this.calculateAverageRating(performance),
        
        // Turnover
        joinedThisMonth: employees.filter(e => 
            new Date(e.joinDate).getMonth() === month
        ).length
    };

    return report;
}

// Generate and send report
const report = generateHRReport(4, 2026); // April 2026
console.log('Monthly HR Report:', report);

// Export to CSV or send via email
```

---

## 🎯 Common Workflows

### Complete Onboarding Flow

```javascript
async function onboardNewEmployee(employeeData) {
    // 1. Create employee
    const emp = db.create('employees', employeeData);
    console.log('✅ Employee created');

    // 2. Assign to shift
    const morning = db.getCollection('shifts')[0];
    ShiftManagement.assignShift(emp.id, morning.id, new Date());
    console.log('✅ Shift assigned');

    // 3. Enroll in benefits
    const benefits = db.getCollection('benefits');
    benefits.forEach(b => BenefitsManagement.enrollInBenefit(emp.id, b.id));
    console.log('✅ Benefits enrolled');

    // 4. Assign compliance training
    ComplianceManagement.completeRequirement(
        'COMPLIANCE-001',
        emp.id,
        'Pending completion'
    );
    console.log('✅ Compliance assigned');

    // 5. Send welcome message
    await Communications.sendAnnouncement({
        title: `Welcome ${emp.name}!`,
        message: 'Please complete onboarding tasks',
        author: 'HR',
        department: emp.department
    });
    console.log('✅ Welcome announcement sent');

    // 6. Notify Slack
    await SlackIntegration.sendMessage(
        '#general',
        `🎉 Welcome to the team, ${emp.name}!`
    );
    console.log('✅ Slack notification sent');

    return emp;
}
```

### Annual Review Cycle

```javascript
async function startAnnualReviewCycle() {
    const employees = db.getCollection('employees');
    const managers = employees.filter(e => e.role.includes('Manager'));

    // 1. Create announcement
    Communications.sendAnnouncement({
        title: '📋 Annual Performance Review Cycle Begins',
        message: 'Please complete reviews for your direct reports by June 30',
        author: 'HR',
        department: 'All',
        priority: 'High'
    });

    // 2. Send individual notifications
    for (const manager of managers) {
        const directReports = employees.filter(e => e.manager === manager.name);
        await SlackIntegration.sendMessage(
            `@${manager.email}`,
            `📊 You have ${directReports.length} direct reports to review`
        );
    }

    console.log(`✅ Annual review cycle started for ${managers.length} managers`);
}
```

---

## 🔧 Troubleshooting Guide

### Integration Not Working

```javascript
// Check status
console.log(IntegrationManager.getStatus('netsuite'));

// Try reconnecting
await IntegrationManager.disconnect('netsuite');
await IntegrationManager.init('netsuite', credentials);

// Check errors
try {
    await IntegrationManager.sync('netsuite', ['employees']);
} catch (error) {
    console.error('Sync error:', error.message);
}
```

### Features Not Saving

```javascript
// Check localStorage
console.log(localStorage.getItem('hrms_db_v2'));

// Verify data persistence
const before = db.getCollection('employees');
const emp = db.create('employees', {name: 'Test'});
const after = db.getCollection('employees');
console.log('Before:', before.length, 'After:', after.length);
```

---

**Ready to use! Copy-paste any example into your browser console.** 🚀
