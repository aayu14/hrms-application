const Attendance = (function () {
    async function clockIn(employeeId) {
        const today = new Date().toISOString().split('T')[0];
        const newRecord = {
            id: Date.now().toString(),
            employeeId,
            date: today,
            clockIn: new Date().toLocaleTimeString(),
            clockOut: null,
            duration: null,
            status: 'Present'
        };

        if (window.APIAdapter && APIAdapter.mode === 'api') {
            return await APIAdapter.create('attendance', newRecord).then(data => ({ success: true, data })).catch(err => ({ success: false, error: err.message }));
        }

        // local fallback
        db.create('attendance', newRecord);
        return { success: true, data: newRecord };
    }

    async function clockOut(employeeId) {
        const today = new Date().toISOString().split('T')[0];

        if (window.APIAdapter && APIAdapter.mode === 'api') {
            const records = await APIAdapter.getData('attendance');
            const rec = (records || []).find(r => String(r.employeeId) === String(employeeId) && r.date === today && !r.clockOut);
            if (!rec) return { success: false, message: 'No active clock-in found for today.' };
            const clockOutTime = new Date();
            const clockInTime = new Date(`${today} ${rec.clockIn}`);
            const diffMs = clockOutTime - clockInTime;
            const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
            const updated = await APIAdapter.update('attendance', rec.id, { clockOut: clockOutTime.toLocaleTimeString(), duration: diffHrs, status: 'Present' });
            return { success: true, data: updated };
        }

        const attendanceRecords = db.getData('attendance') || [];
        const recordIndex = attendanceRecords.findIndex(
            record => record.employeeId === employeeId && record.date === today && !record.clockOut
        );

        if (recordIndex === -1) {
            return { success: false, message: 'No active clock-in found for today.' };
        }

        const clockOutTime = new Date();
        attendanceRecords[recordIndex].clockOut = clockOutTime.toLocaleTimeString();
        const clockInTime = new Date(`${today} ${attendanceRecords[recordIndex].clockIn}`);
        const diffMs = clockOutTime - clockInTime;
        const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
        attendanceRecords[recordIndex].duration = diffHrs;

        db.saveData('attendance', attendanceRecords);
        return { success: true, data: attendanceRecords[recordIndex] };
    }

    async function getEmployeeStatus(employeeId) {
        const today = new Date().toISOString().split('T')[0];
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            const records = await APIAdapter.getData('attendance');
            const record = (records || []).find(r => String(r.employeeId) === String(employeeId) && r.date === today);
            if (!record) return 'Out';
            return record.clockOut ? 'Clocked Out' : 'Clocked In';
        }
        const attendanceRecords = db.getData('attendance') || [];
        const record = attendanceRecords.find(r => r.employeeId === employeeId && r.date === today);
        if (!record) return 'Out';
        return record.clockOut ? 'Clocked Out' : 'Clocked In';
    }

    async function getAttendanceHistory(employeeId = null) {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            const records = await APIAdapter.getData('attendance');
            const list = records || [];
            if (employeeId) return list.filter(r => String(r.employeeId) === String(employeeId)).reverse();
            return list.reverse();
        }
        const attendanceRecords = db.getData('attendance') || [];
        if (employeeId) return attendanceRecords.filter(r => r.employeeId === employeeId).reverse();
        return attendanceRecords.reverse();
    }

    async function submitLeaveRequest(leaveData) {
        const newRequest = {
            id: 'LR-' + Date.now(),
            employeeId: leaveData.employeeId,
            employeeName: leaveData.employeeName,
            type: leaveData.type,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            reason: leaveData.reason,
            status: 'Pending',
            appliedOn: new Date().toISOString().split('T')[0]
        };

        if (window.APIAdapter && APIAdapter.mode === 'api') {
            return await APIAdapter.create('leaveRequests', newRequest).then(data => ({ success: true, data })).catch(err => ({ success: false, error: err.message }));
        }

        const leaveRequests = db.getData('leaveRequests') || [];
        leaveRequests.push(newRequest);
        db.saveData('leaveRequests', leaveRequests);
        return { success: true, data: newRequest };
    }

    async function getLeaveRequests(employeeId = null) {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            const records = await APIAdapter.getData('leaveRequests');
            const list = records || [];
            if (employeeId) return list.filter(r => String(r.employeeId) === String(employeeId)).reverse();
            return list.reverse();
        }
        const leaveRequests = db.getData('leaveRequests') || [];
        if (employeeId) return leaveRequests.filter(req => req.employeeId === employeeId).reverse();
        return leaveRequests.reverse();
    }

    async function updateLeaveStatus(requestId, status) {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            await APIAdapter.update('leaveRequests', requestId, { status });
            return { success: true };
        }
        const leaveRequests = db.getData('leaveRequests') || [];
        const index = leaveRequests.findIndex(req => req.id === requestId);
        if (index !== -1) {
            leaveRequests[index].status = status;
            db.saveData('leaveRequests', leaveRequests);
            return { success: true };
        }
        return { success: false, message: 'Request not found' };
    }

    async function getAttendanceReport(month, year) {
        if (window.APIAdapter && APIAdapter.mode === 'api') {
            const records = await APIAdapter.getData('attendance');
            return (records || []).filter(record => {
                const recordDate = new Date(record.date);
                return recordDate.getMonth() === parseInt(month) && recordDate.getFullYear() === parseInt(year);
            });
        }
        const attendanceRecords = db.getData('attendance') || [];
        return attendanceRecords.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate.getMonth() === parseInt(month) && recordDate.getFullYear() === parseInt(year);
        });
    }

    return {
        clockIn,
        clockOut,
        getEmployeeStatus,
        getAttendanceHistory,
        submitLeaveRequest,
        getLeaveRequests,
        updateLeaveStatus,
        getAttendanceReport
    };
})();

// Expose both names for compatibility
window.Attendance = Attendance;
window.attendance = Attendance;