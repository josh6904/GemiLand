const DB_KEY = 'dcd_fundraising_v20';
const DEPARTMENTS = ["Eagles", "Daughters of Faith", "Youth", "Planning Committee", "Guests"];

const store = {
    data: { pledges: [], transactions: [], expenses: [] },
    init() {
        try {
            const saved = localStorage.getItem(DB_KEY);
            if (saved) this.data = JSON.parse(saved);
        } catch (e) { console.error("Load failed", e); }
    },
    save() {
        localStorage.setItem(DB_KEY, JSON.stringify(this.data));
        app.render();
    }
};

const app = {
    chart: null,
    init() {
        store.init();
        this.populateSelects();
        this.router('dashboard');
    },

    router(view) {
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`view-${view}`).classList.remove('hidden');
        this.render();
    },

    // --- JSON BACKUP/RESTORE ---
    downloadBackup() {
        const blob = new Blob([JSON.stringify(store.data)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dcd-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    },

    restoreBackup(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.pledges) {
                    if (confirm("Restore this backup? Current data will be replaced.")) {
                        store.data = imported;
                        store.save();
                    }
                } else { throw new Error(); }
            } catch (err) { alert("Error: Invalid backup file format."); }
        };
        reader.readAsText(file);
    },

    // --- CSV IMPORT ---
    handleCSVUpload(input) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            lines.slice(1).forEach(line => {
                const [name, dept, amt] = line.split(',').map(s => s.trim());
                if (name && amt) {
                    store.data.pledges.push({
                        id: Date.now() + Math.random(),
                        name, department: dept || "Guests", amount: parseFloat(amt) || 0
                    });
                }
            });
            store.save();
            alert("CSV Data Imported!");
        };
        reader.readAsText(file);
    },

    // --- DASHBOARD CHART ---
    renderChart() {
        const ctx = document.getElementById('financeChart').getContext('2d');
        const rev = store.data.transactions.reduce((s,t) => s + t.amount, 0);
        const exp = store.data.expenses.reduce((s,e) => s + e.amount, 0);

        if (this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Revenue', 'Expenses', 'Net'],
                datasets: [{
                    label: 'Amount (KES)',
                    data: [rev, exp, rev - exp],
                    backgroundColor: ['#10B981', '#EF4444', '#3B82F6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    render() {
        const rev = store.data.transactions.reduce((s,t) => s + t.amount, 0);
        const exp = store.data.expenses.reduce((s,e) => s + e.amount, 0);
        
        document.getElementById('dash-cash').innerText = "KES " + rev.toLocaleString();
        document.getElementById('dash-expenses').innerText = "KES " + exp.toLocaleString();
        document.getElementById('dash-net').innerText = "KES " + (rev - exp).toLocaleString();

        this.renderPledges();
        this.renderDepartments();
        this.renderLedger();
        this.renderChart();
    },

    renderPledges() {
        const tbody = document.getElementById('pledges-table-body');
        tbody.innerHTML = store.data.pledges.map(p => {
            const paid = store.data.transactions.filter(t => t.pledgeId === p.id).reduce((s,t) => s + t.amount, 0);
            return `<tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.department}</td>
                <td class="text-right">${p.amount.toLocaleString()}</td>
                <td class="text-right">${paid.toLocaleString()}</td>
                <td class="text-right" style="color:${p.amount-paid > 0 ? 'red':'green'}">${(p.amount-paid).toLocaleString()}</td>
                <td class="text-center">${paid >= p.amount ? '✅' : '⏳'}</td>
            </tr>`;
        }).join('');
    },

    renderDepartments() {
        const container = document.getElementById('dept-container');
        container.innerHTML = DEPARTMENTS.map(dept => {
            const collected = store.data.transactions.filter(t => t.department === dept).reduce((s,t) => s+t.amount, 0);
            return `<div class="kpi-card"><div><p>${dept}</p><h2>KES ${collected.toLocaleString()}</h2></div></div>`;
        }).join('');
    },

    renderLedger() {
        const tbody = document.getElementById('ledger-table-body');
        const all = [...store.data.transactions, ...store.data.expenses.map(e => ({...e, type: 'Expense'}))];
        tbody.innerHTML = all.sort((a,b) => new Date(b.date) - new Date(a.date)).map(i => `
            <tr>
                <td>${new Date(i.date).toLocaleDateString()}</td>
                <td><code>${i.id.toString().slice(-5)}</code></td>
                <td>${i.name || i.description}</td>
                <td>${i.type || 'Income'}</td>
                <td class="text-right">KES ${i.amount.toLocaleString()}</td>
            </tr>
        `).join('');
    },

    submitManualCash(e) {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('cash-amount').value);
        const name = document.getElementById('cash-name').value;
        const dept = document.getElementById('cash-dept').value;
        
        store.data.transactions.push({
            id: Date.now(),
            name, department: dept, amount: amt, date: new Date().toISOString()
        });
        store.save();
        this.closeModal('manual-cash');
    },

    submitPledge(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        store.data.pledges.push({
            id: Date.now(),
            name: fd.get('name'),
            department: fd.get('department'),
            amount: parseFloat(fd.get('amount'))
        });
        store.save();
        this.closeModal('pledge');
    },

    populateSelects() {
        const html = DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('');
        document.getElementById('cash-dept').innerHTML = html;
        document.getElementById('pledge-dept').innerHTML = html;
    },

    openModal(id) { document.getElementById(`modal-${id}`).classList.add('open'); },
    closeModal(id) { document.getElementById(`modal-${id}`).classList.remove('open'); },
    hardReset() { if(confirm("DELETE EVERYTHING?")) { localStorage.clear(); location.reload(); } }
};

window.onload = () => app.init();
