let tradesData = [];
let accountsList = ['Main Account'];
let currentAccount = 'Main Account';
let analyticsTimeframe = 'This Month';
let calendarMode = 'month'; // 'week', 'month', 'year', 'all'
let showWeekends = true;

let accountGoalsData = {}; 

let currentTab = 'calendar';
let selectedTradeType = 'profit';
let uploadedBase64ImagesArray = [];
let editingTradeId = null;

let currentDate = new Date();
let currentYearForYearView = new Date().getFullYear();
let selectedDayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

let tradeIdToDelete = null;
let accountNameToDelete = null;
let toastTimeout = null;

let pnlDonutChartInstance = null;
let winrateDonutChartInstance = null;
let pfDonutChartInstance = null;
let drawdownMiniChartInstance = null;
let currentIosZoom = 1;

document.addEventListener('DOMContentLoaded', () => {
    loadAccountsFromStorage();
    loadTradesFromStorage();
    loadGoalsFromStorage();
    lucide.createIcons();
    switchTab('calendar');
    startLiveClock();
});

// ================= PENGURUSAN GOAL & CAPITAL =================
function loadGoalsFromStorage() {
    const stored = localStorage.getItem('tj_accounts_goals');
    if (stored) {
        try { accountGoalsData = JSON.parse(stored); } catch (e) { accountGoalsData = {}; }
    }
    if (!accountGoalsData[currentAccount]) {
        accountGoalsData[currentAccount] = { capital: 5000, monthlyGoal: 1008 };
    }
}

function saveGoalsToStorage() {
    localStorage.setItem('tj_accounts_goals', JSON.stringify(accountGoalsData));
}

function openGoalModal() {
    if (!accountGoalsData[currentAccount]) {
        accountGoalsData[currentAccount] = { capital: 5000, monthlyGoal: 1008 };
    }
    document.getElementById('modalInputCapital').value = accountGoalsData[currentAccount].capital;
    document.getElementById('modalInputMonthlyGoal').value = accountGoalsData[currentAccount].monthlyGoal;
    document.getElementById('goalModal').classList.remove('opacity-0', 'pointer-events-none');
}

function closeGoalModal() {
    document.getElementById('goalModal').classList.add('opacity-0', 'pointer-events-none');
}

function saveGoalAndCapital() {
    const cap = parseFloat(document.getElementById('modalInputCapital').value) || 0;
    const goal = parseFloat(document.getElementById('modalInputMonthlyGoal').value) || 0;

    accountGoalsData[currentAccount] = { capital: cap, monthlyGoal: goal };
    saveGoalsToStorage();
    closeGoalModal();
    showToast('Tetapan modal & sasaran dikemas kini!');
    renderCalendarModeContent();
}

// ================= PENGURUSAN MOD KALIENDAR =================
function setCalendarMode(mode) {
    calendarMode = mode;
    ['week', 'month', 'year', 'all'].forEach(m => {
        const btn = document.getElementById(`calModeBtn-${m}`);
        const view = document.getElementById(`calView-${m}`);
        if (m === mode) {
            btn.className = "py-2 rounded-xl text-xs font-bold transition bg-profitG text-black shadow-md";
            view.classList.remove('hidden');
        } else {
            btn.className = "py-2 rounded-xl text-xs font-bold transition text-gray-400 hover:text-white";
            view.classList.add('hidden');
        }
    });
    renderCalendarModeContent();
    lucide.createIcons();
}

function renderCalendarModeContent() {
    if (calendarMode === 'week') renderWeekView();
    else if (calendarMode === 'month') renderMonthView();
    else if (calendarMode === 'year') renderYearView();
    else if (calendarMode === 'all') renderAllTimeView();
}

function toggleWeekends() {
    showWeekends = !showWeekends;
    document.getElementById('weekendStatus').textContent = showWeekends ? 'ON' : 'OFF';
    renderMonthView();
}

// 1. Mod Week View
function renderWeekView() {
    const accTrades = getCurrentAccountTrades();
    const listEl = document.getElementById('weekDaysList');
    listEl.innerHTML = '';
    document.getElementById('weekAccountText').textContent = currentAccount;

    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay() + 1;
    
    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
        const dayObj = new Date(curr.setDate(first + i));
        if (!showWeekends && (dayObj.getDay() === 0 || dayObj.getDay() === 6)) continue;
        
        const yyyy = dayObj.getFullYear();
        const mm = String(dayObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dayObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        const dayNameShort = dayObj.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
        const dTrades = accTrades.filter(t => t.date.startsWith(dateStr));
        
        let dPnL = 0;
        dTrades.forEach(t => { dPnL += (t.type === 'profit' ? t.amount : -t.amount); });
        weekTotal += dPnL;

        const item = document.createElement('div');
        item.className = 'bg-cardBg rounded-2xl p-4 border border-gray-800 flex justify-between items-center cursor-pointer hover:border-gray-700 transition';
        item.onclick = () => openIntradayView(dateStr);

        const pnlColor = dPnL > 0 ? 'text-profitG' : (dPnL < 0 ? 'text-lossR' : 'text-gray-400');
        const pnlText = dPnL !== 0 ? ((dPnL > 0 ? '+' : '-') + '$' + Math.abs(dPnL).toFixed(2)) : '—';

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="text-center w-8">
                    <span class="text-base font-bold text-white block">${dayObj.getDate()}</span>
                    <span class="text-[10px] font-semibold text-gray-500 uppercase block">${dayNameShort}</span>
                </div>
            </div>
            <span class="text-sm font-bold ${pnlColor}">${pnlText}</span>
        `;
        listEl.appendChild(item);
    }

    const totalEl = document.getElementById('weekTotalPnL');
    totalEl.textContent = (weekTotal >= 0 ? '$' : '-$') + Math.abs(weekTotal).toFixed(2);
    totalEl.className = `text-2xl font-bold ${weekTotal >= 0 ? 'text-profitG' : 'text-lossR'}`;
}
function changeWeek(dir) { 
    currentDate.setDate(currentDate.getDate() + (dir * 7)); 
    renderWeekView(); 
}

// 2. Mod Month View
function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const realToday = new Date();
    const isCurrentMonthReal = realToday.getFullYear() === year && realToday.getMonth() === month;
    const todayDayNumber = realToday.getDate();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;
    document.getElementById('monthAccountText').textContent = currentAccount;

    const headerRow = document.getElementById('calendarWeekHeaderRow');
    headerRow.innerHTML = showWeekends ? 
        `<div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div><div>SUN</div>` :
        `<div class="col-span-full grid grid-cols-5 text-center"><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div></div>`;

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    grid.className = showWeekends ? "grid grid-cols-7 gap-1.5" : "grid grid-cols-5 gap-1.5";

    const firstDayIndex = new Date(year, month, 1).getDay();
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const accTrades = getCurrentAccountTrades();
    let monthTotalPnL = 0;

    for (let i = 0; i < adjustedFirstDay; i++) {
        if (!showWeekends && (i >= 5)) continue;
        const emptyCell = document.createElement('div');
        emptyCell.className = 'h-16 rounded-xl bg-gray-900/10 border border-gray-900/20 opacity-20';
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDateObj = new Date(year, month, day);
        const dayOfWeek = dayDateObj.getDay(); 
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        if (!showWeekends && isWeekend) continue;

        const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTrades = accTrades.filter(t => t.date.startsWith(dayDateStr));

        let dayPnL = 0;
        dayTrades.forEach(t => { dayPnL += (t.type === 'profit' ? t.amount : -t.amount); });
        monthTotalPnL += dayPnL;

        const cell = document.createElement('div');
        cell.onclick = () => openIntradayView(dayDateStr);

        let cellStyle = 'bg-cardBg/60 border-gray-800/60';
        let textStyle = 'text-gray-400';
        let contentDisplay = `<span class="text-[10px] text-gray-500">—</span>`;

        if (dayTrades.length > 0) {
            if (dayPnL > 0) {
                cellStyle = 'bg-emerald-950/40 border-profitG/40';
                textStyle = 'text-white font-bold';
                contentDisplay = `
                    <span class="text-[10px] font-extrabold text-profitG">+${dayPnL.toFixed(2)}</span>
                    <span class="text-[8px] text-gray-400">${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}</span>
                `;
            } else if (dayPnL < 0) {
                cellStyle = 'bg-rose-950/40 border-lossR/40';
                textStyle = 'text-white font-bold';
                contentDisplay = `
                    <span class="text-[10px] font-extrabold text-lossR">${dayPnL.toFixed(2)}</span>
                    <span class="text-[8px] text-gray-400">${dayTrades.length} trade${dayTrades.length > 1 ? 's' : ''}</span>
                `;
            }
        }

        const isTodayCell = isCurrentMonthReal && day === todayDayNumber;
        cell.className = `h-16 rounded-xl p-1.5 flex flex-col justify-between items-center text-center cursor-pointer border hover:scale-105 transition ${cellStyle} ${isTodayCell ? 'today-highlight' : ''}`;
        cell.innerHTML = `
            <div class="flex items-center justify-between w-full px-1">
                <span class="text-[11px] ${textStyle}">${day}</span>
                ${dayTrades.length > 0 ? `<i data-lucide="file-text" class="w-2.5 h-2.5 text-gray-400"></i>` : ''}
            </div>
            <div class="flex flex-col items-center justify-center">${contentDisplay}</div>
        `;
        grid.appendChild(cell);
    }

    const mTotEl = document.getElementById('monthTotalPnL');
    mTotEl.textContent = (monthTotalPnL >= 0 ? '$' : '-$') + Math.abs(monthTotalPnL).toFixed(2);
    mTotEl.className = `text-xl font-bold ${monthTotalPnL >= 0 ? 'text-profitG' : 'text-lossR'}`;

    if (!accountGoalsData[currentAccount]) accountGoalsData[currentAccount] = { capital: 5000, monthlyGoal: 1008 };
    const goalTarget = accountGoalsData[currentAccount].monthlyGoal;
    document.getElementById('monthlyGoalTarget').textContent = `$${goalTarget.toFixed(2)}`;
    const curGoalEl = document.getElementById('monthlyGoalCurrent');
    curGoalEl.textContent = (monthTotalPnL >= 0 ? '$' : '-$') + Math.abs(monthTotalPnL).toFixed(2);
    curGoalEl.className = `text-[10px] ${monthTotalPnL >= 0 ? 'text-profitG' : 'text-lossR'}`;

    let progressPct = Math.min(Math.max((monthTotalPnL / goalTarget) * 100, 0), 100);
    if (monthTotalPnL < 0) progressPct = 0;
    document.getElementById('monthlyGoalBar').style.width = `${progressPct}%`;
}

// 3. Mod Year View
function renderYearView() {
    document.getElementById('yearDisplayLabel').textContent = currentYearForYearView;
    document.getElementById('yearAccountText').textContent = currentAccount;
    const accTrades = getCurrentAccountTrades();
    let yearTotal = 0;
    const monthsGrid = document.getElementById('yearMonthsGrid');
    monthsGrid.innerHTML = '';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    monthNames.forEach((mName, mIdx) => {
        const mStr = String(mIdx + 1).padStart(2, '0');
        const mTrades = accTrades.filter(t => t.date.startsWith(`${currentYearForYearView}-${mStr}`));
        let mPnL = 0;
        mTrades.forEach(t => { mPnL += (t.type === 'profit' ? t.amount : -t.amount); });
        yearTotal += mPnL;

        const card = document.createElement('div');
        card.className = 'bg-cardBg rounded-2xl p-3 border border-gray-800 flex flex-col justify-between h-32';
        const pnlColor = mPnL > 0 ? 'text-profitG' : (mPnL < 0 ? 'text-lossR' : 'text-gray-400');
        const pnlText = mPnL !== 0 ? ((mPnL > 0 ? '+' : '-') + '$' + Math.abs(mPnL).toFixed(2)) : '$0.00';

        card.innerHTML = `
            <div class="flex justify-between items-center text-xs font-bold text-white"><span>${mName}</span></div>
            <div class="grid grid-cols-7 gap-0.5 my-1 opacity-40">${'<div class="w-full h-1.5 rounded-sm bg-gray-800"></div>'.repeat(28)}</div>
            <span class="text-xs font-bold ${pnlColor} text-right">${pnlText}</span>
        `;
        monthsGrid.appendChild(card);
    });

    const yTotEl = document.getElementById('yearTotalPnL');
    yTotEl.textContent = (yearTotal >= 0 ? '$' : '-$') + Math.abs(yearTotal).toFixed(2);
    yTotEl.className = `text-xl font-bold ${yearTotal >= 0 ? 'text-profitG' : 'text-lossR'}`;
}
function changeYear(dir) { currentYearForYearView += dir; renderYearView(); }

// 4. Mod All Time View
function renderAllTimeView() {
    document.getElementById('allAccountText').textContent = currentAccount;
    const accTrades = getCurrentAccountTrades();
    let allTotal = 0;
    const yearsMap = {};
    accTrades.forEach(t => {
        const y = t.date.substring(0, 4);
        if (!yearsMap[y]) yearsMap[y] = 0;
        yearsMap[y] += (t.type === 'profit' ? t.amount : -t.amount);
        allTotal += (t.type === 'profit' ? t.amount : -t.amount);
    });
    const allTotEl = document.getElementById('allTimeTotalPnL');
    allTotEl.textContent = (allTotal >= 0 ? '$' : '-$') + Math.abs(allTotal).toFixed(2);
    allTotEl.className = `text-2xl font-bold ${allTotal >= 0 ? 'text-profitG' : 'text-lossR'}`;

    const listEl = document.getElementById('allTimeYearsList');
    listEl.innerHTML = '';
    const sortedYears = Object.keys(yearsMap).sort((a,b) => b - a);
    if (sortedYears.length === 0) sortedYears.push(new Date().getFullYear());
    sortedYears.forEach(y => {
        const yPnL = yearsMap[y] || 0;
        const pnlColor = yPnL >= 0 ? 'text-profitG' : 'text-lossR';
        const item = document.createElement('div');
        item.className = 'bg-cardBg rounded-2xl p-4 border border-gray-800 flex justify-between items-center';
        item.innerHTML = `<span class="text-base font-bold text-white">${y}</span><span class="text-sm font-bold ${pnlColor}">${yPnL >= 0 ? '+' : '-'}$${Math.abs(yPnL).toFixed(2)}</span>`;
        listEl.appendChild(item);
    });
}

// ================= PENGURUSAN AKAUN =================
function loadAccountsFromStorage() {
    const storedAccs = localStorage.getItem('tj_accounts_list');
    if (storedAccs) { try { accountsList = JSON.parse(storedAccs); } catch (e) { accountsList = ['Main Account']; } }
    const storedCurrent = localStorage.getItem('tj_current_account');
    if (storedCurrent && accountsList.includes(storedCurrent)) { currentAccount = storedCurrent; }
    else { currentAccount = accountsList[0] || 'Main Account'; }
    updateAccountUIElements();
}
function saveAccountsToStorage() {
    localStorage.setItem('tj_accounts_list', JSON.stringify(accountsList));
    localStorage.setItem('tj_current_account', currentAccount);
    updateAccountUIElements();
}
function updateAccountUIElements() {
    document.getElementById('headerAccountName').textContent = currentAccount;
    document.getElementById('analyticsAccountText').textContent = currentAccount;
    document.getElementById('settingsCurrentAccount').textContent = currentAccount;
}
function openAccountModal() { renderAccountList(); document.getElementById('accountModal').classList.remove('opacity-0', 'pointer-events-none'); }
function closeAccountModal() { document.getElementById('accountModal').classList.add('opacity-0', 'pointer-events-none'); }
function renderAccountList() {
    const container = document.getElementById('accountListContainer');
    container.innerHTML = '';
    accountsList.forEach(acc => {
        const isSelected = acc === currentAccount;
        const item = document.createElement('div');
        item.className = `p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold cursor-pointer transition ${isSelected ? 'bg-accentCyan/10 border-accentCyan text-accentCyan' : 'bg-inputBg border-gray-800 text-gray-300 hover:border-gray-700'}`;
        item.innerHTML = `<span onclick="selectAccount('${acc}')" class="flex-1 py-0.5">${acc}</span>${accountsList.length > 1 ? `<button type="button" onclick="event.stopPropagation(); promptDeleteAccount('${acc}');" class="text-gray-500 hover:text-lossR p-1 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}`;
        container.appendChild(item);
    });
    lucide.createIcons();
}
function selectAccount(accName) { currentAccount = accName; saveAccountsToStorage(); closeAccountModal(); showToast(`Bertukar ke ${accName}`); updateAllUI(); }
function addNewAccount() {
    const input = document.getElementById('newAccountNameInput');
    const name = input.value.trim();
    if (!name) { showToast('Masukkan nama akaun!', 'error'); return; }
    if (accountsList.includes(name)) { showToast('Akaun ini sudah wujud!', 'error'); return; }
    accountsList.push(name); currentAccount = name; input.value = '';
    saveAccountsToStorage(); renderAccountList(); showToast(`Akaun '${name}' ditambah!`); updateAllUI();
}
function promptDeleteAccount(accName) {
    accountNameToDelete = accName;
    document.getElementById('deleteAccountTitle').textContent = `Padam Akaun '${accName}'?`;
    document.getElementById('btnConfirmDeleteAccount').onclick = () => { executeDeleteAccount(); };
    document.getElementById('deleteAccountConfirmModal').classList.remove('opacity-0', 'pointer-events-none');
}
function closeDeleteAccountModal() { document.getElementById('deleteAccountConfirmModal').classList.add('opacity-0', 'pointer-events-none'); accountNameToDelete = null; }
function executeDeleteAccount() {
    if (!accountNameToDelete) return;
    const deletedAcc = accountNameToDelete;
    accountsList = accountsList.filter(a => a !== deletedAcc);
    if (currentAccount === deletedAcc) currentAccount = accountsList[0] || 'Main Account';
    saveAccountsToStorage(); closeDeleteAccountModal(); renderAccountList(); showToast(`Akaun '${deletedAcc}' dipadamkan`, 'delete'); updateAllUI();
}

// ================= TIMEFRAME ANALYTICS =================
function openTimeframeModal() { 
    document.getElementById('timeframeModal').classList.remove('opacity-0', 'pointer-events-none'); 
}
function closeTimeframeModal() { 
    document.getElementById('timeframeModal').classList.add('opacity-0', 'pointer-events-none'); 
}
function selectAnalyticsTimeframe(tf) { 
    analyticsTimeframe = tf; 
    document.getElementById('analyticsTimeframeText').textContent = tf; 
    closeTimeframeModal(); 
    renderAnalytics(); 
    showToast(`Julat: ${tf}`); 
}

// ================= JAM REAL-TIME =================
function startLiveClock() {
    function updateClock() {
        const now = new Date();
        const day = now.getDate();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        let period = hours >= 12 ? 'PTG' : 'PAGI';
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        const clockEl = document.getElementById('liveRealtimeClock');
        if (clockEl) clockEl.textContent = `${day} ${monthNames[now.getMonth()]} ${now.getFullYear()} | ${hours}:${minutes}:${seconds} ${period}`;
    }
    updateClock(); setInterval(updateClock, 1000);
}

function loadTradesFromStorage() {
    const stored = localStorage.getItem('tj_trades_data_v2');
    if (stored) { try { tradesData = JSON.parse(stored); } catch (e) { tradesData = []; } } else { tradesData = []; }
}
function saveTradesToStorage() { try { localStorage.setItem('tj_trades_data_v2', JSON.stringify(tradesData)); } catch (e) { showToast('Storan penuh!', 'error'); } }

function promptResetData() { document.getElementById('resetConfirmModal').classList.remove('opacity-0', 'pointer-events-none'); }
function closeResetConfirmModal() { document.getElementById('resetConfirmModal').classList.add('opacity-0', 'pointer-events-none'); }
function executeResetData() {
    tradesData = tradesData.filter(t => (t.account || 'Main Account') !== currentAccount);
    saveTradesToStorage(); closeResetConfirmModal(); showToast('Data akaun diset semula', 'delete'); updateAllUI();
}
function getCurrentAccountTrades() { return tradesData.filter(t => (t.account || 'Main Account') === currentAccount); }

// ================= iOS PHOTOS VIEWER =================
function openIosPhotoViewer(imgSrc, titleText = "Chart Setup") {
    const viewer = document.getElementById('iosPhotoViewer');
    const imgEl = document.getElementById('iosViewerImg');
    imgEl.src = imgSrc;
    document.getElementById('iosViewerTitle').textContent = selectedDayStr;
    document.getElementById('iosViewerSubtitle').textContent = titleText;
    currentIosZoom = 1; imgEl.style.transform = `scale(${currentIosZoom})`;
    viewer.classList.remove('opacity-0', 'pointer-events-none'); viewer.classList.add('opacity-100');
}
function closeIosPhotoViewer() { document.getElementById('iosPhotoViewer').classList.remove('opacity-100'); document.getElementById('iosPhotoViewer').classList.add('opacity-0', 'pointer-events-none'); }
function toggleIosImageZoom() { if (currentIosZoom === 1) zoomIosImage(0.8); else resetIosImageZoom(); }
function zoomIosImage(delta) { currentIosZoom = Math.min(Math.max(0.8, currentIosZoom + delta), 3.0); document.getElementById('iosViewerImg').style.transform = `scale(${currentIosZoom})`; }
function resetIosImageZoom() { currentIosZoom = 1; document.getElementById('iosViewerImg').style.transform = `scale(1)`; }
function downloadViewerImage() {
    const imgSrc = document.getElementById('iosViewerImg').src;
    if (!imgSrc) return;
    const a = document.createElement('a'); a.href = imgSrc; a.download = `Trade_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); showToast('Gambar dimuat turun!');
}

function showInfoTooltip(title, bodyText) {
    document.getElementById('infoTooltipTitle').textContent = title;
    document.getElementById('infoTooltipBody').textContent = bodyText;
    document.getElementById('infoTooltipModal').classList.remove('opacity-0', 'pointer-events-none');
}
function closeInfoTooltip() { document.getElementById('infoTooltipModal').classList.add('opacity-0', 'pointer-events-none'); }

// ================= NAVIGASI UTAMA =================
function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.className = "nav-item flex flex-col items-center text-gray-400 hover:text-white transition cursor-pointer py-1 px-4 rounded-full";
    });
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) activeBtn.className = "nav-item flex flex-col items-center text-white bg-gray-800/80 transition cursor-pointer py-1.5 px-5 rounded-full";
    renderCurrentTab();
}

function renderCurrentTab() {
    if (currentTab === 'calendar') setCalendarMode(calendarMode);
    else if (currentTab === 'analytics') renderAnalytics();
    lucide.createIcons();
}

function updateAllUI() {
    renderCurrentTab();
    if (!document.getElementById('intradayView').classList.contains('hidden')) renderIntradayView(selectedDayStr);
}

// ================= KALENDAR & INTRADAY =================
function changeMonth(dir) { currentDate.setMonth(currentDate.getMonth() + dir); renderMonthView(); }
function goToToday() { 
    currentDate = new Date(); 
    const now = new Date();
    selectedDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    renderMonthView(); 
    showToast('Pindah ke hari ini'); 
}

function openIntradayView(dateStr) {
    selectedDayStr = dateStr;
    document.getElementById('calView-month').classList.add('hidden');
    document.querySelector('.grid.grid-cols-4.gap-1').classList.add('hidden');
    document.getElementById('intradayView').classList.remove('hidden');
    renderIntradayView(dateStr);
}

function closeIntradayView() {
    document.getElementById('intradayView').classList.add('hidden');
    document.getElementById('calView-month').classList.remove('hidden');
    document.querySelector('.grid.grid-cols-4.gap-1').classList.remove('hidden');
    renderMonthView();
}

function renderIntradayView(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const fullMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('intradayDateTitle').textContent = `${fullMonthNames[dateObj.getMonth()]} ${dateObj.getDate()} ${dateObj.getFullYear()}`;

    const accTrades = getCurrentAccountTrades();
    const dayTrades = accTrades.filter(t => t.date.startsWith(dateStr));

    let totalPnL = 0, totalProfit = 0, totalLoss = 0, profitCount = 0, lossCount = 0;
    dayTrades.forEach(t => {
        if (t.type === 'profit') { totalPnL += t.amount; totalProfit += t.amount; profitCount++; }
        else { totalPnL -= t.amount; totalLoss += t.amount; lossCount++; }
    });

    document.getElementById('intradayPnLLabel').textContent = `Intraday PnL (${dayTrades.length})`;
    const pnlValEl = document.getElementById('intradayPnLValue');
    pnlValEl.textContent = (totalPnL >= 0 ? '$' : '-$') + Math.abs(totalPnL).toFixed(2);
    pnlValEl.className = `text-2xl font-bold ${totalPnL >= 0 ? 'text-profitG' : 'text-lossR'}`;

    document.getElementById('intradayProfitLabel').textContent = `Profits (${profitCount})`;
    document.getElementById('intradayProfitValue').textContent = `$${totalProfit.toFixed(2)}`;
    document.getElementById('intradayLossLabel').textContent = `Losses (${lossCount})`;
    document.getElementById('intradayLossValue').textContent = `$${totalLoss.toFixed(2)}`;

    const listEl = document.getElementById('intradayTradesList');
    listEl.innerHTML = '';

    if (dayTrades.length === 0) {
        listEl.innerHTML = `<div class="py-4 text-gray-400 text-xs leading-relaxed"><p class="mb-2">Add your intraday trades here.</p></div>`;
    } else {
        dayTrades.forEach(t => {
            const isProfit = t.type === 'profit';
            const item = document.createElement('div');
            item.className = 'bg-cardBg rounded-2xl p-4 border border-gray-800 space-y-3';

            let imageGridHtml = '';
            const imgs = t.images || (t.image ? [t.image] : []);
            if (imgs.length > 0) {
                imageGridHtml = `<div class="space-y-2 mt-2">`;
                imgs.forEach((imgUrl, index) => {
                    imageGridHtml += `
                        <div class="relative group rounded-xl overflow-hidden border border-gray-800 cursor-pointer bg-black/60" onclick="openIosPhotoViewer('${imgUrl}', '${t.note || 'Setup ' + (index+1)}')">
                            <img src="${imgUrl}" alt="Setup" class="w-full h-auto max-h-56 object-contain mx-auto">
                        </div>
                    `;
                });
                imageGridHtml += `</div>`;
            }

            item.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold ${isProfit ? 'text-profitG' : 'text-lossR'}">${isProfit ? 'PROFIT' : 'LOSS'}</span>
                            <span class="text-[11px] text-gray-400">${t.time || '12:00'}</span>
                        </div>
                        <p class="text-sm font-bold text-white">${isProfit ? '+' : '-'}$${t.amount.toFixed(2)}</p>
                        ${t.note ? `<p class="text-xs text-gray-300">${t.note}</p>` : ''}
                        ${t.lesson ? `<p class="text-xs text-amber-400">Lesson: ${t.lesson}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="openEditTradeModal('${t.id}')" class="text-gray-400 hover:text-accentCyan p-1.5 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                        <button type="button" onclick="promptDeleteTrade('${t.id}')" class="text-gray-500 hover:text-lossR p-1.5 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
                ${imageGridHtml}
            `;
            listEl.appendChild(item);
        });
    }
    lucide.createIcons();
}

// ================= MODAL TRADE =================
function openTradeModal() {
    editingTradeId = null;
    document.getElementById('tradeModal').classList.remove('opacity-0', 'pointer-events-none');
    const [y, m, d] = selectedDayStr.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    document.getElementById('modalDateTitle').textContent = `New Trade on ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    document.getElementById('btnSubmitTrade').textContent = "Submit Trade";

    const now = new Date();
    document.getElementById('tradeTimeInput').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('tradePnLInput').value = '';
    document.getElementById('tradeNoteInput').value = '';
    document.getElementById('tradeLessonInput').value = '';
    setTradeType('profit');
    uploadedBase64ImagesArray = [];
    renderModalImagePreviews();
}

function openEditTradeModal(tradeId) {
    const trade = tradesData.find(t => t.id === tradeId);
    if (!trade) return;
    editingTradeId = tradeId;
    document.getElementById('tradeModal').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('modalDateTitle').textContent = `Edit Trade`;
    document.getElementById('btnSubmitTrade').textContent = "Update Trade";

    setTradeType(trade.type);
    document.getElementById('tradePnLInput').value = trade.amount;
    document.getElementById('tradeTimeInput').value = trade.time || '12:00';
    document.getElementById('tradeNoteInput').value = trade.note || '';
    document.getElementById('tradeLessonInput').value = trade.lesson || '';
    uploadedBase64ImagesArray = [...(trade.images || (trade.image ? [trade.image] : []))];
    renderModalImagePreviews();
}

function closeTradeModal() { document.getElementById('tradeModal').classList.add('opacity-0', 'pointer-events-none'); editingTradeId = null; }

function setTradeType(type) {
    selectedTradeType = type;
    const btnProfit = document.getElementById('btnTypeProfit');
    const btnLoss = document.getElementById('btnTypeLoss');
    if (type === 'profit') {
        btnProfit.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition bg-profitG/10 border border-profitG text-profitG';
        btnLoss.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition bg-transparent border border-gray-800 text-gray-500';
    } else {
        btnLoss.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition bg-lossR/10 border border-lossR text-lossR';
        btnProfit.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center transition bg-transparent border border-gray-800 text-gray-500';
    }
}

function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    let loadedCount = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            uploadedBase64ImagesArray.push(e.target.result);
            loadedCount++;
            if (loadedCount === files.length) renderModalImagePreviews();
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function renderModalImagePreviews() {
    const placeholder = document.getElementById('uploadPlaceholder');
    const previewList = document.getElementById('imagePreviewList');
    const addMoreBtn = document.getElementById('btnAddMoreImagesBtn');
    previewList.innerHTML = '';
    if (uploadedBase64ImagesArray.length === 0) {
        placeholder.classList.remove('hidden'); previewList.classList.add('hidden'); addMoreBtn.classList.add('hidden');
    } else {
        placeholder.classList.add('hidden'); previewList.classList.remove('hidden'); addMoreBtn.classList.remove('hidden');
        uploadedBase64ImagesArray.forEach((imgSrc, idx) => {
            const item = document.createElement('div');
            item.className = 'relative rounded-xl overflow-hidden border border-gray-700 bg-black/40 group cursor-pointer';
            item.innerHTML = `
                <div onclick="openIosPhotoViewer('${imgSrc}', 'Preview')" class="w-full h-24 relative"><img src="${imgSrc}" class="w-full h-full object-cover"></div>
                <button type="button" onclick="event.stopPropagation(); removeSelectedImage(${idx});" class="absolute top-1 right-1 bg-black/80 text-white rounded-full p-1 hover:bg-lossR transition z-10"><i data-lucide="x" class="w-3 h-3"></i></button>
            `;
            previewList.appendChild(item);
        });
        lucide.createIcons();
    }
}

function removeSelectedImage(index) { uploadedBase64ImagesArray.splice(index, 1); renderModalImagePreviews(); }

function saveTrade() {
    const pnlVal = parseFloat(document.getElementById('tradePnLInput').value);
    if (isNaN(pnlVal) || pnlVal <= 0) { showToast('Masukkan nilai P&L yang sah!', 'error'); return; }

    const timeVal = document.getElementById('tradeTimeInput').value || '12:00';
    const noteVal = document.getElementById('tradeNoteInput').value.trim();
    const lessonVal = document.getElementById('tradeLessonInput').value.trim();

    if (editingTradeId) {
        const tradeIndex = tradesData.findIndex(t => t.id === editingTradeId);
        if (tradeIndex !== -1) {
            tradesData[tradeIndex].type = selectedTradeType;
            tradesData[tradeIndex].amount = pnlVal;
            tradesData[tradeIndex].time = timeVal;
            tradesData[tradeIndex].note = noteVal;
            tradesData[tradeIndex].lesson = lessonVal;
            tradesData[tradeIndex].images = [...uploadedBase64ImagesArray];
        }
        showToast('Trade dikemas kini!', 'success');
    } else {
        const newTrade = {
            id: Date.now().toString(),
            account: currentAccount,
            date: `${selectedDayStr}T${timeVal}:00.000Z`,
            time: timeVal,
            type: selectedTradeType,
            amount: pnlVal,
            note: noteVal,
            lesson: lessonVal,
            images: [...uploadedBase64ImagesArray]
        };
        tradesData.push(newTrade);
        showToast('Trade berjaya ditambah!', 'success');
    }
    saveTradesToStorage();
    closeTradeModal();
    updateAllUI();
}

function promptDeleteTrade(tradeId) {
    tradeIdToDelete = tradeId;
    document.getElementById('btnConfirmDelete').onclick = () => { executeDeleteTrade(); };
    document.getElementById('deleteConfirmModal').classList.remove('opacity-0', 'pointer-events-none');
}
function closeDeleteConfirmModal() { document.getElementById('deleteConfirmModal').classList.add('opacity-0', 'pointer-events-none'); tradeIdToDelete = null; }
function executeDeleteTrade() {
    if (!tradeIdToDelete) return;
    tradesData = tradesData.filter(t => t.id !== tradeIdToDelete);
    saveTradesToStorage();
    closeDeleteConfirmModal();
    showToast('Trade dipadamkan', 'delete');
    updateAllUI();
}

// ================= ANALYTICS =================
function renderAnalytics() {
    const accTrades = getCurrentAccountTrades();
    const now = new Date();
    let filteredTrades = accTrades.filter(t => {
        const tDate = new Date(t.date);
        if (analyticsTimeframe === 'This Week') {
            const startOfWeek = new Date(now);
            const day = now.getDay() || 7;
            startOfWeek.setDate(now.getDate() - day + 1);
            startOfWeek.setHours(0, 0, 0, 0);
            return tDate >= startOfWeek;
        } else if (analyticsTimeframe === 'This Month') {
            return tDate.getFullYear() === now.getFullYear() && tDate.getMonth() === now.getMonth();
        } else if (analyticsTimeframe === 'This Year') {
            return tDate.getFullYear() === now.getFullYear();
        } else { return true; }
    });

    let totalProfit = 0, totalLoss = 0, winCount = 0, lossCount = 0;
    filteredTrades.forEach(t => {
        if (t.type === 'profit') { totalProfit += t.amount; winCount++; }
        else { totalLoss += t.amount; lossCount++; }
    });

    const totalTrades = winCount + lossCount;
    const netPnL = totalProfit - totalLoss;

    document.getElementById('analyticsTotalProfit').textContent = `$${totalProfit.toFixed(2)}`;
    document.getElementById('analyticsTotalLoss').textContent = `$${totalLoss.toFixed(2)}`;
    document.getElementById('analyticsNetPnL').textContent = (netPnL >= 0 ? '$' : '-$') + Math.abs(netPnL).toFixed(2);
    renderDonut('pnlDonutCanvas', totalProfit, totalLoss);

    document.getElementById('winrateTotalTrades').textContent = totalTrades;
    document.getElementById('winrateWinningTrades').textContent = winCount;
    document.getElementById('winrateLosingTrades').textContent = lossCount;
    const winRatePercent = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : '0.0';
    document.getElementById('winratePercentageText').textContent = `${winRatePercent}%`;
    renderDonut('winrateDonutCanvas', winCount, lossCount);

    const avgWin = winCount > 0 ? (totalProfit / winCount) : 0;
    const avgLoss = lossCount > 0 ? (totalLoss / lossCount) : 0;
    const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : (totalProfit > 0 ? '99.99' : '0.00');
    document.getElementById('pfWinLossRatio').textContent = lossCount > 0 ? (winCount / lossCount).toFixed(2) : '0.00';
    document.getElementById('pfAvgWin').textContent = `$${avgWin.toFixed(2)}`;
    document.getElementById('pfAvgLoss').textContent = `$${avgLoss.toFixed(2)}`;
    document.getElementById('pfFactorValue').textContent = profitFactor;
    const expectancy = ((totalTrades > 0 ? winCount/totalTrades : 0) * avgWin) - ((totalTrades > 0 ? lossCount/totalTrades : 0) * avgLoss);
    document.getElementById('pfExpectancyValue').textContent = (expectancy >= 0 ? '$' : '-$') + Math.abs(expectancy).toFixed(2);
    renderDonut('pfDonutCanvas', avgWin, avgLoss);
    renderMiniDrawdownChart();
}

function renderDonut(canvasId, val1, val2) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (canvasId === 'pnlDonutCanvas' && pnlDonutChartInstance) pnlDonutChartInstance.destroy();
    if (canvasId === 'winrateDonutCanvas' && winrateDonutChartInstance) winrateDonutChartInstance.destroy();
    if (canvasId === 'pfDonutCanvas' && pfDonutChartInstance) pfDonutChartInstance.destroy();

    const dataVals = (val1 === 0 && val2 === 0) ? [0, 0, 1] : [val1, val2, 0];
    const bgColors = (val1 === 0 && val2 === 0) ? ['#22C55E', '#EF4444', '#374151'] : ['#22C55E', '#EF4444', 'transparent'];

    const chartObj = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['A', 'B', 'Empty'], datasets: [{ data: dataVals, backgroundColor: bgColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true, duration: 800 } }
    });

    if (canvasId === 'pnlDonutCanvas') pnlDonutChartInstance = chartObj;
    if (canvasId === 'winrateDonutCanvas') winrateDonutChartInstance = chartObj;
    if (canvasId === 'pfDonutCanvas') pfDonutChartInstance = chartObj;
}

function renderMiniDrawdownChart() {
    const ctx = document.getElementById('analyticsDrawdownMiniCanvas').getContext('2d');
    if (drawdownMiniChartInstance) drawdownMiniChartInstance.destroy();
    drawdownMiniChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: ['1', '2', '3', '4', '5'], datasets: [{ data: [10, 25, 15, 30, 20], borderColor: '#22C55E', borderWidth: 2, fill: true, backgroundColor: 'rgba(34, 197, 94, 0.15)', tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMsg.textContent = message;

    if (type === 'success') {
        toast.className = "fixed top-12 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl transition-all duration-300 bg-white text-black border border-gray-200 pointer-events-auto opacity-100 translate-y-0";
        toastIcon.setAttribute('data-lucide', 'check-circle'); toastIcon.className = "w-4 h-4 text-emerald-600";
    } else if (type === 'delete') {
        toast.className = "fixed top-12 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl transition-all duration-300 bg-lossR text-white border border-rose-700 pointer-events-auto opacity-100 translate-y-0";
        toastIcon.setAttribute('data-lucide', 'trash-2'); toastIcon.className = "w-4 h-4 text-white";
    } else {
        toast.className = "fixed top-12 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl transition-all duration-300 bg-amber-500 text-black border border-amber-600 pointer-events-auto opacity-100 translate-y-0";
        toastIcon.setAttribute('data-lucide', 'alert-circle'); toastIcon.className = "w-4 h-4 text-black";
    }
    lucide.createIcons();
    toastTimeout = setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
        toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-[-20px]');
    }, 1800);
}
