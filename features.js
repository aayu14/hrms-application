/**
 * Advanced Features Module
 * Add these features to extend your HRMS system
 */

// ============================================
// FEATURE 1: Employee Self-Service Portal
// ============================================

// DataSync helper: synchronous local reads with background sync to APIAdapter (if enabled)
const DataSync = {
    getCollection(name) {
        const local = (db.getCollection && db.getCollection(name)) || [];
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            APIAdapter.getData(name).then(remote => {
                if (Array.isArray(remote)) {
                    try { db.set(name, remote); } catch (e) { console.warn('DataSync remote->local set failed', e); }
                }
            }).catch(() => {});
        }
        return local;
    },
    findById(name, id) {
        return this.getCollection(name).find(item => String(item.id) === String(id));
    },
    create(name, item) {
        const created = (db.create && db.create(name, item)) || (() => { const c = this.getCollection(name); c.push(item); db.set(name, c); return item; })();
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            APIAdapter.create(name, created).catch(e => console.warn('DataSync create remote failed', e));
        }
        return created;
    },
    update(name, id, fields) {
        const updated = (db.update && db.update(name, id, fields)) || (() => {
            const c = this.getCollection(name);
            const idx = c.findIndex(x => String(x.id) === String(id));
            if (idx === -1) return null;
            c[idx] = { ...c[idx], ...fields };
            db.set(name, c);
            return c[idx];
        })();
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            APIAdapter.update(name, id, fields).catch(e => console.warn('DataSync update remote failed', e));
        }
        return updated;
    },
    set(name, arr) {
        try { db.set(name, arr); } catch (e) { console.warn('DataSync set local failed', e); }
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            // best-effort: push items individually (no bulk API)
            (async () => {
                for (const it of arr) {
                    try {
                        if (it.id) {
                            await APIAdapter.update(name, it.id, it).catch(async () => { await APIAdapter.create(name, it).catch(() => {}); });
                        } else {
                            await APIAdapter.create(name, it).catch(() => {});
                        }
                    } catch (e) { /* continue */ }
                }
            })();
        }
    },
    delete(name, id) {
        try { db.delete && db.delete(name, id); } catch (e) { console.warn('DataSync delete local failed', e); }
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            APIAdapter.delete(name, id).catch(e => console.warn('DataSync delete remote failed', e));
        }
    }
};

const EmployeeSelfService = {
    /**
     * Employee can view their own profile
     */
    getMyProfile(employeeId) {
        const employee = DataSync.findById('employees', employeeId);
        return {
            name: employee.name,
            email: employee.email,
            department: employee.department,
            role: employee.role,
            joinDate: employee.joinDate,
            manager: employee.manager,
            phone: employee.phone
        };
    },

    /**
     * Update own profile
     */
    updateMyProfile(employeeId, updates) {
        const allowed = ['phone', 'email'];
        const filtered = Object.keys(updates)
            .filter(key => allowed.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});
        
        return DataSync.update('employees', employeeId, filtered);
    },

    /**
     * View personal attendance
     */
    getMyAttendance(employeeId, month, year) {
        const attendance = DataSync.getCollection('attendance') || [];
        return attendance.filter(record => 
            record.employeeId === employeeId &&
            new Date(record.date).getMonth() === month &&
            new Date(record.date).getFullYear() === year
        );
    },

    /**
     * View personal payslips
     */
    getMyPayslips(employeeId, year) {
        const payroll = DataSync.getCollection('payroll') || [];
        return payroll.filter(record => 
            record.employeeId === employeeId &&
            record.year === year
        );
    },

    /**
     * Request time off
     */
    async requestTimeOff(employeeId, leaveData) {
        const emp = DataSync.findById('employees', employeeId);
        const request = {
            id: 'TO-' + Date.now(),
            employeeId,
            employeeName: emp.name,
            type: leaveData.type,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            days: this.calculateDays(leaveData.startDate, leaveData.endDate),
            reason: leaveData.reason,
            status: 'Pending',
            appliedOn: new Date().toISOString()
        };

        const leaveRequests = DataSync.getCollection('leaveRequests') || [];
        leaveRequests.push(request);
        DataSync.set('leaveRequests', leaveRequests);

        // Notify manager via Slack if integrated
        if (IntegrationManager.integrations.slack?.enabled) {
            await SlackIntegration.sendMessage(
                '#hr',
                `New leave request from ${emp.name}`
            );
        }

        return request;
    },

    calculateDays(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
};

// ============================================
// FEATURE 2: Performance Management
// ============================================

const PerformanceManagement = {
    /**
     * Create performance review
     */
    createReview(reviewData) {
        const review = {
            id: 'PR-' + Date.now(),
            employeeId: reviewData.employeeId,
            employeeName: reviewData.employeeName,
            reviewerId: reviewData.reviewerId,
            reviewerName: reviewData.reviewerName,
            period: reviewData.period,
            ratings: reviewData.ratings, // e.g., {technical: 4, communication: 3, leadership: 5}
            comments: reviewData.comments,
            goals: reviewData.goals,
            areasForImprovement: reviewData.areasForImprovement,
            status: 'Draft',
            createdDate: new Date().toISOString()
        };

        const performance = DataSync.getCollection('performance') || [];
        performance.push(review);
        DataSync.set('performance', performance);

        return review;
    },

    /**
     * Calculate average rating
     */
    calculateAverageRating(ratings) {
        const values = Object.values(ratings);
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    },

    /**
     * Get performance summary
     */
    getEmployeeSummary(employeeId) {
        const performance = DataSync.getCollection('performance') || [];
        const reviews = performance.filter(r => r.employeeId === employeeId);
        
        if (reviews.length === 0) return null;

        const averageRating = reviews
            .map(r => parseFloat(this.calculateAverageRating(r.ratings)))
            .reduce((a, b) => a + b, 0) / reviews.length;

        return {
            employeeId,
            reviewCount: reviews.length,
            averageRating: averageRating.toFixed(2),
            latestReview: reviews[reviews.length - 1],
            trend: this.calculateTrend(reviews)
        };
    },

    calculateTrend(reviews) {
        if (reviews.length < 2) return 'stable';
        const latest = parseFloat(this.calculateAverageRating(reviews[reviews.length - 1].ratings));
        const previous = parseFloat(this.calculateAverageRating(reviews[reviews.length - 2].ratings));
        
        if (latest > previous) return 'improving';
        if (latest < previous) return 'declining';
        return 'stable';
    }
};

// ============================================
// FEATURE 3: Skills & Development
// ============================================

const SkillsManagement = {
    /**
     * Add skill to employee
     */
    addSkill(employeeId, skillData) {
        const skills = DataSync.getCollection('skills') || [];
        
        skills.push({
            id: 'SK-' + Date.now(),
            employeeId,
            skill: skillData.skill,
            proficiency: skillData.proficiency, // 1-5
            endorsements: 0,
            yearsOfExperience: skillData.yearsOfExperience,
            lastUsed: new Date().toISOString()
        });

        DataSync.set('skills', skills);
    },

    /**
     * Endorse skill
     */
    endorseSkill(skillId, endorsedBy) {
        const skills = DataSync.getCollection('skills') || [];
        const skill = skills.find(s => s.id === skillId);
        
        if (skill) {
            skill.endorsements = (skill.endorsements || 0) + 1;
            DataSync.set('skills', skills);
        }

        return skill;
    },

    /**
     * Get employee skills
     */
    getEmployeeSkills(employeeId) {
        const skills = DataSync.getCollection('skills') || [];
        return skills.filter(s => s.employeeId === employeeId);
    },

    /**
     * Recommend training
     */
    recommendTraining(employeeId) {
        const employee = DataSync.findById('employees', employeeId);
        const skills = this.getEmployeeSkills(employeeId);
        const performance = PerformanceManagement.getEmployeeSummary(employeeId);

        const recommendations = [];

        // Based on performance gaps
        if (performance && parseFloat(performance.averageRating) < 3) {
            recommendations.push({
                title: 'Leadership Skills',
                reason: 'Performance improvement needed'
            });
        }

        // Based on skills
        if (skills.length < 3) {
            recommendations.push({
                title: 'Technical Skills',
                reason: 'Skill development recommended'
            });
        }

        return recommendations;
    }
};

// ============================================
// FEATURE 4: Training & Development
// ============================================

const TrainingManagement = {
    /**
     * Create training program
     */
    createProgram(programData) {
        const program = {
            id: 'TRN-' + Date.now(),
            name: programData.name,
            description: programData.description,
            startDate: programData.startDate,
            endDate: programData.endDate,
            instructor: programData.instructor,
            participants: [],
            status: 'Scheduled',
            budget: programData.budget,
            createdDate: new Date().toISOString()
        };

        const training = db.getCollection('training') || [];
        training.push(program);
        DataSync.set('training', training);

        return program;
    },

    /**
     * Enroll employee in training
     */
    enrollEmployee(trainingId, employeeId) {
        const training = db.getCollection('training') || [];
        const program = training.find(t => t.id === trainingId);
        const employee = DataSync.findById('employees', employeeId);

        if (program && employee) {
            program.participants.push({
                employeeId,
                name: employee.name,
                status: 'Enrolled',
                enrolledDate: new Date().toISOString()
            });
            DataSync.set('training', training);
        }

        return program;
    },

    /**
     * Mark training complete
     */
    completeTraining(trainingId, employeeId) {
        const training = db.getCollection('training') || [];
        const program = training.find(t => t.id === trainingId);

        if (program) {
            const participant = program.participants.find(p => p.employeeId === employeeId);
            if (participant) {
                participant.status = 'Completed';
                participant.completedDate = new Date().toISOString();
                DataSync.set('training', training);
            }
        }

        return program;
    }
};

// ============================================
// FEATURE 5: Expense Management
// ============================================

const ExpenseManagement = {
    /**
     * Submit expense report
     */
    submitExpense(employeeId, expenseData) {
        const expense = {
            id: 'EXP-' + Date.now(),
            employeeId,
            employeeName: DataSync.findById('employees', employeeId).name,
            category: expenseData.category, // Travel, Meal, Equipment, etc
            amount: expenseData.amount,
            currency: expenseData.currency || 'USD',
            description: expenseData.description,
            date: expenseData.date,
            receipt: expenseData.receipt, // file reference
            status: 'Pending',
            submittedDate: new Date().toISOString(),
            approver: null,
            notes: ''
        };

        const expenses = DataSync.getCollection('expenses') || [];
        expenses.push(expense);
        DataSync.set('expenses', expenses);

        return expense;
    },

    /**
     * Approve expense
     */
    approveExpense(expenseId, approverId, notes = '') {
        const expenses = DataSync.getCollection('expenses') || [];
        const expense = expenses.find(e => e.id === expenseId);

        if (expense) {
            expense.status = 'Approved';
            expense.approver = approverId;
            expense.approvedDate = new Date().toISOString();
            expense.notes = notes;
            DataSync.set('expenses', expenses);
        }

        return expense;
    },

    /**
     * Get expense summary
     */
    getEmployeeSummary(employeeId, month, year) {
        const expenses = DataSync.getCollection('expenses') || [];
        const filtered = expenses.filter(e =>
            e.employeeId === employeeId &&
            new Date(e.date).getMonth() === month &&
            new Date(e.date).getFullYear() === year
        );

        return {
            totalExpenses: filtered.length,
            totalAmount: filtered.reduce((sum, e) => sum + e.amount, 0),
            approved: filtered.filter(e => e.status === 'Approved').length,
            pending: filtered.filter(e => e.status === 'Pending').length,
            rejected: filtered.filter(e => e.status === 'Rejected').length
        };
    }
};

// ============================================
// FEATURE 6: Shift Management
// ============================================

const ShiftManagement = {
    /**
     * Create shift template
     */
    createShift(shiftData) {
        const shift = {
            id: 'SHIFT-' + Date.now(),
            name: shiftData.name,
            startTime: shiftData.startTime,
            endTime: shiftData.endTime,
            breakDuration: shiftData.breakDuration || 0,
            workDays: shiftData.workDays, // [Mon, Tue, Wed...]
            description: shiftData.description
        };

        const shifts = DataSync.getCollection('shifts') || [];
        shifts.push(shift);
        db.set('shifts', shifts);

        return shift;
    },

    /**
     * Assign employee to shift
     */
    assignShift(employeeId, shiftId, effectiveDate) {
        const assignments = db.getCollection('shiftAssignments') || [];

        assignments.push({
            id: 'SA-' + Date.now(),
            employeeId,
            shiftId,
            effectiveDate,
            status: 'Active'
        });

        db.set('shiftAssignments', assignments);
    },

    /**
     * Get employee schedule
     */
    getSchedule(employeeId, weekOf) {
        const assignments = db.getCollection('shiftAssignments') || [];
        const shifts = DataSync.getCollection('shifts') || [];
        
        const active = assignments.filter(a =>
            a.employeeId === employeeId && a.status === 'Active'
        );

        return active.map(a => {
            const shift = shifts.find(s => s.id === a.shiftId);
            return {
                date: a.effectiveDate,
                shift: shift.name,
                startTime: shift.startTime,
                endTime: shift.endTime
            };
        });
    }
};

// ============================================
// FEATURE 7: Benefits Management
// ============================================

const BenefitsManagement = {
    /**
     * Create benefit plan
     */
    createPlan(planData) {
        const plan = {
            id: 'BEN-' + Date.now(),
            name: planData.name,
            type: planData.type, // Health, Dental, Vision, 401k, etc
            provider: planData.provider,
            cost: planData.cost,
            coverage: planData.coverage,
            deductible: planData.deductible,
            eligibleEmployees: [],
            status: 'Active'
        };

        const benefits = db.getCollection('benefits') || [];
        benefits.push(plan);
        db.set('benefits', benefits);

        return plan;
    },

    /**
     * Enroll employee in benefit
     */
    enrollInBenefit(employeeId, benefitId) {
        const benefits = db.getCollection('benefits') || [];
        const benefit = benefits.find(b => b.id === benefitId);
        const employee = DataSync.findById('employees', employeeId);

        if (benefit && employee) {
            benefit.eligibleEmployees.push({
                employeeId,
                name: employee.name,
                enrolledDate: new Date().toISOString(),
                status: 'Active'
            });
            db.set('benefits', benefits);
        }

        return benefit;
    },

    /**
     * Get employee benefits
     */
    getEmployeeBenefits(employeeId) {
        const benefits = db.getCollection('benefits') || [];
        return benefits.filter(b =>
            b.eligibleEmployees.some(e => e.employeeId === employeeId)
        );
    }
};

// ============================================
// FEATURE 8: Compliance & Certifications
// ============================================

const ComplianceManagement = {
    /**
     * Create compliance requirement
     */
    createRequirement(requirementData) {
        const requirement = {
            id: 'COMP-' + Date.now(),
            name: requirementData.name,
            description: requirementData.description,
            category: requirementData.category, // Training, Certification, Review, etc
            frequency: requirementData.frequency, // Annual, Quarterly, Monthly, etc
            dueDate: requirementData.dueDate,
            applicableRoles: requirementData.applicableRoles || [],
            createdDate: new Date().toISOString()
        };

        const compliance = db.getCollection('compliance') || [];
        compliance.push(requirement);
        db.set('compliance', compliance);

        return requirement;
    },

    /**
     * Mark requirement as completed
     */
    completeRequirement(requirementId, employeeId, evidence = '') {
        const completion = {
            id: 'COMP-DONE-' + Date.now(),
            requirementId,
            employeeId,
            completedDate: new Date().toISOString(),
            evidence,
            status: 'Completed'
        };

        const completions = db.getCollection('complianceCompletions') || [];
        completions.push(completion);
        db.set('complianceCompletions', completions);

        return completion;
    },

    /**
     * Get compliance status dashboard
     */
    getComplianceDashboard() {
        const requirements = db.getCollection('compliance') || [];
        const completions = db.getCollection('complianceCompletions') || [];
        const employees = db.getCollection('employees') || [];

        return {
            totalRequirements: requirements.length,
            totalEmployees: employees.length,
            completionRate: this.calculateCompletionRate(requirements, completions),
            overdue: this.getOverdueRequirements(requirements, completions),
            upcoming: this.getUpcomingRequirements(requirements)
        };
    },

    calculateCompletionRate(requirements, completions) {
        if (requirements.length === 0) return 100;
        const completed = completions.length;
        return Math.round((completed / requirements.length) * 100);
    },

    getOverdueRequirements(requirements, completions) {
        const today = new Date();
        return requirements.filter(r => {
            const due = new Date(r.dueDate);
            const completed = completions.some(c => c.requirementId === r.id);
            return !completed && due < today;
        });
    },

    getUpcomingRequirements(requirements) {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        return requirements.filter(r => {
            const due = new Date(r.dueDate);
            return due >= today && due <= nextWeek;
        });
    }
};

// ============================================
// FEATURE 9: Goal Setting & OKRs
// ============================================

const GoalManagement = {
    /**
     * Create employee goal
     */
    createGoal(employeeId, goalData) {
        const goal = {
            id: 'GOAL-' + Date.now(),
            employeeId,
            title: goalData.title,
            description: goalData.description,
            category: goalData.category, // Personal, Team, Company
            keyResults: goalData.keyResults || [],
            targetDate: goalData.targetDate,
            progress: 0,
            status: 'Active',
            createdDate: new Date().toISOString()
        };

        const goals = db.getCollection('goals') || [];
        goals.push(goal);
        db.set('goals', goals);

        return goal;
    },

    /**
     * Update goal progress
     */
    updateGoalProgress(goalId, progress, comments = '') {
        const goals = db.getCollection('goals') || [];
        const goal = goals.find(g => g.id === goalId);

        if (goal) {
            goal.progress = Math.min(progress, 100);
            goal.lastUpdated = new Date().toISOString();
            if (progress === 100) goal.status = 'Completed';
            db.set('goals', goals);
        }

        return goal;
    },

    /**
     * Get employee goals
     */
    getEmployeeGoals(employeeId) {
        const goals = db.getCollection('goals') || [];
        return goals.filter(g => g.employeeId === employeeId);
    }
};

// ============================================
// FEATURE 10: Internal Communications
// ============================================

const Communications = {
    /**
     * Send announcement
     */
    sendAnnouncement(announcementData) {
        const announcement = {
            id: 'ANN-' + Date.now(),
            title: announcementData.title,
            message: announcementData.message,
            author: announcementData.author,
            department: announcementData.department || 'All',
            priority: announcementData.priority || 'Normal', // Low, Normal, High, Urgent
            attachments: announcementData.attachments || [],
            createdDate: new Date().toISOString(),
            expiryDate: announcementData.expiryDate
        };

        const announcements = db.getCollection('announcements') || [];
        announcements.push(announcement);
        db.set('announcements', announcements);

        // Send to Slack if integrated
        if (IntegrationManager.integrations.slack?.enabled) {
            SlackIntegration.sendMessage('#announcements', `📢 ${announcement.title}\n${announcement.message}`);
        }

        return announcement;
    },

    /**
     * Get active announcements
     */
    getActiveAnnouncements(department = null) {
        const announcements = db.getCollection('announcements') || [];
        const today = new Date();

        return announcements.filter(a => {
            const expired = new Date(a.expiryDate) < today;
            const matchDept = !department || a.department === 'All' || a.department === department;
            return !expired && matchDept;
        });
    }
};

// Export all features
window.EmployeeSelfService = EmployeeSelfService;
window.PerformanceManagement = PerformanceManagement;
window.SkillsManagement = SkillsManagement;
window.TrainingManagement = TrainingManagement;
window.ExpenseManagement = ExpenseManagement;
window.ShiftManagement = ShiftManagement;
window.BenefitsManagement = BenefitsManagement;
window.ComplianceManagement = ComplianceManagement;
window.GoalManagement = GoalManagement;
window.Communications = Communications;
