const Payroll = {
    /**
     * Calculates salary breakdown based on base salary and attendance
     * @param {number} baseSalary 
     * @param {number} presentDays 
     * @param {number} totalDaysInMonth 
     */
    calculateSalaryDetails(baseSalary, presentDays, totalDaysInMonth) {
        if (!baseSalary || totalDaysInMonth === 0) {
            return { gross: 0, tax: 0, allowance: 0, net: 0 };
        }

        const dailyRate = baseSalary / totalDaysInMonth;
        const gross = dailyRate * presentDays;
        
        // Simple HRMS Logic: 
        // 5% professional tax if gross > 3000
        // 10% bonus allowance if attendance is 100%
        const tax = gross > 3000 ? gross * 0.05 : 0;
        const allowance = presentDays === totalDaysInMonth ? baseSalary * 0.10 : 0;
        const net = (gross + allowance) - tax;

        return {
            gross: parseFloat(gross.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            allowance: parseFloat(allowance.toFixed(2)),
            net: parseFloat(net.toFixed(2))
        };
    },

    /**
     * Generates payroll records for all employees for a specific month
     * @param {number} month (0-11)
     * @param {number} year 
     */
    async processMonthlyPayroll(month, year) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let employees = [];
        let attendance = [];

        if (window.APIAdapter && APIAdapter.mode === 'api') {
            employees = await APIAdapter.getData('employees');
            attendance = await APIAdapter.getData('attendance');
        } else {
            employees = await db.getAll('employees');
            attendance = await db.getAll('attendance');
        }

        const payrollRecords = (employees || []).map(emp => {
            const presentDays = (attendance || []).filter(rec => {
                const recDate = new Date(rec.date);
                return String(rec.employeeId) === String(emp.id) && 
                       recDate.getMonth() === parseInt(month) && 
                       recDate.getFullYear() === parseInt(year) &&
                       rec.status === 'Present';
            }).length;

            const salaryDetails = Payroll.calculateSalaryDetails(emp.salary, presentDays, daysInMonth);

            return {
                id: `PY-${Date.now()}-${emp.id}`,
                employeeId: emp.id,
                employeeName: emp.name || (emp.first_name ? `${emp.first_name} ${emp.last_name}` : ''),
                department: emp.department || emp.department_id || null,
                month: parseInt(month),
                year: parseInt(year),
                daysPresent: presentDays,
                totalDays: daysInMonth,
                baseSalary: emp.salary || emp.base_salary || 0,
                ...salaryDetails,
                processedDate: new Date().toISOString()
            };
        });

        // Persist payroll records
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            // delete existing for month/year then bulk insert (best-effort)
            const existing = await APIAdapter.getData('payroll');
            const others = (existing || []).filter(p => !(p.month === parseInt(month) && p.year === parseInt(year)));
            const merged = [...others, ...payrollRecords];
            // For simplicity, replace by saving each record via API
            for (const rec of payrollRecords) {
                await APIAdapter.create('payroll', rec).catch(()=>{});
            }
        } else {
            const existingPayroll = await db.getAll('payroll') || [];
            const otherRecords = existingPayroll.filter(p => !(p.month === parseInt(month) && p.year === parseInt(year)));
            const updatedPayroll = [...otherRecords, ...payrollRecords];
            await db.save('payroll', updatedPayroll);
        }

        return payrollRecords;
    },

    /**
     * Retrieves payroll records for display
     */
    async getPayrollReport(month, year) {
        let allPayroll = [];
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            allPayroll = await APIAdapter.getData('payroll');
        } else {
            allPayroll = await db.getAll('payroll') || [];
        }
        if (month !== undefined && year !== undefined) {
            return (allPayroll || []).filter(p => p.month === parseInt(month) && p.year === parseInt(year));
        }
        return allPayroll || [];
    },

    /**
     * Formats month index to string
     */
    getMonthName(monthIndex) {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[monthIndex];
    },

    /**
     * Deletes a specific payroll run
     */
    async deletePayrollRun(month, year) {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            const records = await APIAdapter.getData('payroll');
            const toDelete = (records || []).filter(p => p.month === parseInt(month) && p.year === parseInt(year));
            for (const r of toDelete) {
                await APIAdapter.delete('payroll', r.id).catch(()=>{});
            }
            return true;
        }
        const allPayroll = await db.getAll('payroll') || [];
        const filtered = allPayroll.filter(p => !(p.month === parseInt(month) && p.year === parseInt(year)));
        await db.save('payroll', filtered);
        return true;
    }
};

// Export to global scope
// Expose for compatibility
window.Payroll = Payroll;
window.payroll = Payroll;