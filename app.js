// DealOrbit Rotation System
// State Management
let managers = [];
let dealHistory = [];
let rotationOrder = [];
let dailyDeals = {};
let lastAssignedManager = null;
let dealRows = new Map(); // Track deal rows by dealId
let pinwheelSpinTimeout = null;
let historicalSpreadsheets = []; // Store historical deal spreadsheets
let paymentBumpGoals = {}; // Store payment bump goals per manager
let currentUser = null; // Current logged in user
let users = []; // All registered users
let pendingPasswordResetCodes = {}; // Store pending password reset codes: { email: { code: '123456', expiresAt: timestamp } }
let removedDeals = []; // Store removed deals for audit trail
let purchasePlan = { // Purchase plan configuration
    planType: 'standard', // 'standard', 'professional', 'enterprise'
    maxUsers: 10,
    currentUsers: 0
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initializeUI();
    setupEventListeners();
    updateRotationDisplay();
    updateDealsTable();
    scheduleDailyReset();
    setupTabCloseLogout();
});

// Setup automatic logout when tab is closed
function setupTabCloseLogout() {
    // Clear user session when tab/window is closed
    window.addEventListener('beforeunload', () => {
        if (currentUser) {
            // Clear current user from localStorage
            localStorage.removeItem('dealOrbit_currentUser');
        }
    });
    
    // Also handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && currentUser) {
            // Optional: Could add a timeout here to logout after inactivity
            // For now, we'll just clear on tab close
        }
    });
}

// Load state from localStorage
function loadState() {
    const savedManagers = localStorage.getItem('dealOrbit_managers');
    const savedDealHistory = localStorage.getItem('dealOrbit_dealHistory');
    const savedRotationOrder = localStorage.getItem('dealOrbit_rotationOrder');
    const savedDailyDeals = localStorage.getItem('dealOrbit_dailyDeals');
    const savedLastAssigned = localStorage.getItem('dealOrbit_lastAssigned');
    const savedHistorical = localStorage.getItem('dealOrbit_historicalSpreadsheets');
    const savedGoals = localStorage.getItem('dealOrbit_paymentBumpGoals');
    const savedUsers = localStorage.getItem('dealOrbit_users');
    const savedCurrentUser = localStorage.getItem('dealOrbit_currentUser');
    const savedRemovedDeals = localStorage.getItem('dealOrbit_removedDeals');
    const savedPurchasePlan = localStorage.getItem('dealOrbit_purchasePlan');

    if (savedManagers) {
        managers = JSON.parse(savedManagers).map(manager => ({
            ...manager,
            phone: manager.phone || '',
            email: manager.email || ''
        }));
    }
    if (savedDealHistory) dealHistory = JSON.parse(savedDealHistory);
    if (savedRotationOrder) rotationOrder = JSON.parse(savedRotationOrder);
    if (savedDailyDeals) dailyDeals = JSON.parse(savedDailyDeals);
    if (savedLastAssigned) lastAssignedManager = savedLastAssigned;
    if (savedHistorical) historicalSpreadsheets = JSON.parse(savedHistorical);
    if (savedGoals) paymentBumpGoals = JSON.parse(savedGoals);
    if (savedUsers) users = JSON.parse(savedUsers);
    if (savedCurrentUser) currentUser = JSON.parse(savedCurrentUser);
    if (savedRemovedDeals) removedDeals = JSON.parse(savedRemovedDeals);
    if (savedPurchasePlan) purchasePlan = JSON.parse(savedPurchasePlan);
    
    // Update current user count
    purchasePlan.currentUsers = users.length;

    // Initialize dailyDeals for today if needed
    const today = getTodayKey();
    if (!dailyDeals[today]) {
        dailyDeals[today] = {};
    }

    // Rebuild dealRows map
    dealHistory.forEach(deal => {
        dealRows.set(deal.dealId, deal);
    });
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('dealOrbit_managers', JSON.stringify(managers));
    localStorage.setItem('dealOrbit_dealHistory', JSON.stringify(dealHistory));
    localStorage.setItem('dealOrbit_rotationOrder', JSON.stringify(rotationOrder));
    localStorage.setItem('dealOrbit_dailyDeals', JSON.stringify(dailyDeals));
    localStorage.setItem('dealOrbit_historicalSpreadsheets', JSON.stringify(historicalSpreadsheets));
    localStorage.setItem('dealOrbit_paymentBumpGoals', JSON.stringify(paymentBumpGoals));
    localStorage.setItem('dealOrbit_users', JSON.stringify(users));
    localStorage.setItem('dealOrbit_removedDeals', JSON.stringify(removedDeals));
    localStorage.setItem('dealOrbit_purchasePlan', JSON.stringify(purchasePlan));
    if (lastAssignedManager) {
        localStorage.setItem('dealOrbit_lastAssigned', lastAssignedManager);
    }
    if (currentUser) {
        localStorage.setItem('dealOrbit_currentUser', JSON.stringify(currentUser));
    }
}

// Get today's date key (YYYY-MM-DD)
function getTodayKey() {
    const now = new Date();
    // Convert to PDT (UTC-7) or PST (UTC-8) depending on DST
    const pdtOffset = -7 * 60; // PDT offset in minutes
    const pdtTime = new Date(now.getTime() + (pdtOffset * 60 * 1000));
    return pdtTime.toISOString().split('T')[0];
}

// Initialize UI
function initializeUI() {
    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    updateProducerList();
    setupTabs();
    setupReports();
    updateHistoryList();
    setupSignup();
    setupLogin();
    setupForgotPassword();
    setupChatbot();
    setupLogout();
    setupUserManagement();
    checkAuth();
}

// Setup event listeners
function setupEventListeners() {
    const addManagerBtn = document.getElementById('addManagerBtn');
    if (addManagerBtn) {
        addManagerBtn.addEventListener('click', addManager);
    }
    const managerNameInput = document.getElementById('managerNameInput');
    if (managerNameInput) {
        managerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addManager();
        });
    }
    
    const clearAllRotationBtn = document.getElementById('clearAllRotationBtn');
    if (clearAllRotationBtn) {
        clearAllRotationBtn.addEventListener('click', clearAllRotation);
    }
    document.getElementById('logDealBtn').addEventListener('click', logDeal);
    document.getElementById('trashDealLogBtn').addEventListener('click', trashDealLog);
    
    // Search functionality
    const searchDealsInput = document.getElementById('searchDealsInput');
    if (searchDealsInput) {
        searchDealsInput.addEventListener('input', (e) => {
            filterDealsTable(e.target.value);
        });
    }

    const searchHistoryInput = document.getElementById('searchHistoryInput');
    if (searchHistoryInput) {
        searchHistoryInput.addEventListener('input', (e) => {
            filterHistoryList(e.target.value);
        });
    }
    
    // Navigation links smooth scroll (only when landing page is visible)
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const landingPageContent = document.getElementById('landingPageContent');
            if (landingPageContent && landingPageContent.style.display !== 'none') {
                const sectionId = link.getAttribute('data-section');
                const section = document.getElementById(sectionId);
                if (section) {
                    const offset = 80; // Account for sticky nav
                    const elementPosition = section.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - offset;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Handle GET STARTED button and signup links
    const getStartedBtn = document.getElementById('getStartedBtn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showSignup();
        });
    }
    
    // Handle signup links
    const signupLinks = document.querySelectorAll('a[href="#signup"]');
    signupLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showSignup();
        });
    });
    
    // Handle login links
    const loginLinks = document.querySelectorAll('a[href="#login"]');
    loginLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
    });
    
    // Handle view landing page link
    const viewLandingLink = document.getElementById('viewLandingLink');
    if (viewLandingLink) {
        viewLandingLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLandingPage();
        });
    }
    
    // Handle logo click on login page to go to landing page
    const loginPageLogoLink = document.getElementById('loginPageLogoLink');
    if (loginPageLogoLink) {
        loginPageLogoLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLandingPage();
        });
    }
    
    // LOGIN link scroll to Control Center
    const loginLink = document.querySelector('.nav-link[href="#appContainer"]');
    if (loginLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            const appContainer = document.getElementById('appContainer');
            if (appContainer) {
                const offset = 80;
                const elementPosition = appContainer.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    }

    const settingsTrigger = document.getElementById('settingsTrigger');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const settingsOverlay = document.getElementById('settingsOverlay');

    if (settingsTrigger) {
        settingsTrigger.addEventListener('click', () => {
            triggerPinwheelSpin();
            toggleSettingsPanel();
        });
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => toggleSettingsPanel(false));
    }
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', () => toggleSettingsPanel(false));
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleSettingsPanel(false);
        }
    });
}

// Add a new manager to rotation
function addManager() {
    const nameInput = document.getElementById('managerNameInput');
    const managerName = nameInput.value.trim();

    if (!managerName) {
        alert('Please enter a manager name');
        return;
    }

    const added = registerManager({ name: managerName });
    if (added) {
        nameInput.value = '';
    }
}

// Removed - Producer management functions no longer needed
// Producer management is now handled in the Manage tab

function registerManager({ name, phone = '', email = '' }) {
    const trimmedName = name?.trim();
    if (!trimmedName) {
        alert('Please enter a manager name');
        return false;
    }

    // Check if this person is a Finance Manager
    const associatedUser = users.find(u => 
        u.name.toLowerCase() === trimmedName.toLowerCase() || 
        (email && u.email.toLowerCase() === email.toLowerCase())
    );
    
    // If user account exists, check role
    if (associatedUser && associatedUser.role !== 'finance') {
        alert(`${trimmedName} is a ${associatedUser.role.charAt(0).toUpperCase() + associatedUser.role.slice(1)}. Only Finance Managers can be added to rotation.`);
        return false;
    }

    const existingManager = managers.find(m => m.name.toLowerCase() === trimmedName.toLowerCase());
    let storedName = trimmedName;

    if (existingManager) {
        const wasInactive = !existingManager.inRotation;
        if (wasInactive) {
            // Double-check role before adding to rotation
            const userCheck = users.find(u => 
                u.name.toLowerCase() === trimmedName.toLowerCase() || 
                (existingManager.email && u.email.toLowerCase() === existingManager.email.toLowerCase())
            );
            if (userCheck && userCheck.role !== 'finance') {
                alert(`${trimmedName} is a ${userCheck.role.charAt(0).toUpperCase() + userCheck.role.slice(1)}. Only Finance Managers can be added to rotation.`);
                return false;
            }
            existingManager.inRotation = true;
            existingManager.rotationTimestamp = Date.now();
        } else if (!phone && !email) {
            alert('Manager already in rotation');
            return false;
        }
        if (phone) existingManager.phone = phone;
        if (email) existingManager.email = email;
        storedName = existingManager.name;
        if (wasInactive && !rotationOrder.includes(existingManager.name)) {
            rotationOrder.push(existingManager.name);
        }
    } else {
        const newManager = {
            name: trimmedName,
            phone,
            email,
            inRotation: true,
            rotationTimestamp: Date.now()
        };
        managers.push(newManager);
        rotationOrder.push(trimmedName);
        storedName = trimmedName;
    }

    const today = getTodayKey();
    if (!dailyDeals[today]) {
        dailyDeals[today] = {};
    }
    if (!dailyDeals[today][storedName]) {
        dailyDeals[today][storedName] = 0;
    }

    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    updateProducerList();
    saveState();
    return true;
}

// Toggle manager rotation status
function toggleManagerRotation(managerName) {
    const manager = managers.find(m => m.name === managerName);
    if (!manager) return;

    // Check if manager is a Finance Manager
    const associatedUser = users.find(u => 
        u.name.toLowerCase() === managerName.toLowerCase() || 
        (manager.email && u.email.toLowerCase() === manager.email.toLowerCase())
    );
    
    // If user account exists, check role
    if (associatedUser) {
        if (associatedUser.role !== 'finance') {
            alert(`${managerName} is a ${associatedUser.role.charAt(0).toUpperCase() + associatedUser.role.slice(1)}. Only Finance Managers can be added to rotation.`);
            return;
        }
    }

    manager.inRotation = !manager.inRotation;

    if (manager.inRotation) {
        // Add back to rotation order if not already there
        if (!rotationOrder.includes(managerName)) {
            rotationOrder.push(managerName);
            manager.rotationTimestamp = Date.now();
        }
    } else {
        // Remove from rotation order
        rotationOrder = rotationOrder.filter(name => name !== managerName);
    }

    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    saveState();
}

// Get rotation queue (active managers in rotation order - Finance Managers only)
function getRotationQueue() {
    return rotationOrder.filter(name => {
        const manager = managers.find(m => m.name === name);
        if (!manager || !manager.inRotation) return false;
        
        // Check if manager is a Finance Manager (exclude Admin and Desk Manager)
        const associatedUser = users.find(u => 
            u.name.toLowerCase() === manager.name.toLowerCase() || 
            (manager.email && u.email.toLowerCase() === manager.email.toLowerCase())
        );
        
        // If no user account found, assume Finance Manager (legacy support)
        if (!associatedUser) return true;
        
        // Only Finance Managers can be in rotation
        return associatedUser.role === 'finance';
    });
}

// Get next manager for deal assignment
function getNextManager() {
    const queue = getRotationQueue();
    if (queue.length === 0) return null;
    if (queue.length === 1) return queue[0];

    const today = getTodayKey();
    if (!dailyDeals[today]) {
        dailyDeals[today] = {};
    }

    // Find earliest manager (lowest rotationTimestamp) with 0 deals today
    // Managers added first have priority, and those without deals get priority
    let earliestUnassigned = null;
    let lowestTimestamp = Infinity;

    for (const managerName of queue) {
        const manager = managers.find(m => m.name === managerName);
        if (!manager) continue;

        const dealsToday = dailyDeals[today][managerName] || 0;
        if (dealsToday === 0 && manager.rotationTimestamp < lowestTimestamp) {
            lowestTimestamp = manager.rotationTimestamp;
            earliestUnassigned = managerName;
        }
    }

    // If we found an earliest unassigned manager, use them
    if (earliestUnassigned) {
        // Check for back-to-back assignment
        if (earliestUnassigned === lastAssignedManager && queue.length > 1) {
            // Find next eligible manager (by rotation order/timestamp)
            // Sort queue by rotationTimestamp to get proper order
            const sortedQueue = [...queue].sort((a, b) => {
                const managerA = managers.find(m => m.name === a);
                const managerB = managers.find(m => m.name === b);
                return (managerA?.rotationTimestamp || 0) - (managerB?.rotationTimestamp || 0);
            });
            
            const currentIndex = sortedQueue.indexOf(earliestUnassigned);
            for (let i = 1; i < sortedQueue.length; i++) {
                const nextIndex = (currentIndex + i) % sortedQueue.length;
                const nextManager = sortedQueue[nextIndex];
                const dealsToday = dailyDeals[today][nextManager] || 0;
                if (dealsToday === 0) {
                    return nextManager;
                }
            }
        }
        return earliestUnassigned;
    }

    // All managers have at least one deal
    // Find the minimum deal count
    let minDeals = Infinity;
    for (const managerName of queue) {
        const dealsToday = dailyDeals[today][managerName] || 0;
        if (dealsToday < minDeals) {
            minDeals = dealsToday;
        }
    }

    // Get all managers sorted by rotation order (by timestamp)
    const sortedQueue = [...queue].sort((a, b) => {
        const managerA = managers.find(m => m.name === a);
        const managerB = managers.find(m => m.name === b);
        return (managerA?.rotationTimestamp || 0) - (managerB?.rotationTimestamp || 0);
    });

    // Find the next manager in rotation order who has the minimum deal count
    // Start from the position after last assigned, or from the beginning if no last assigned
    let startIndex = 0;
    if (lastAssignedManager) {
        const lastIndex = sortedQueue.indexOf(lastAssignedManager);
        if (lastIndex !== -1) {
            startIndex = (lastIndex + 1) % sortedQueue.length;
        }
    }

    // Cycle through rotation order starting from startIndex, find first with minimum deals
    for (let i = 0; i < sortedQueue.length; i++) {
        const index = (startIndex + i) % sortedQueue.length;
        const managerName = sortedQueue[index];
        const dealsToday = dailyDeals[today][managerName] || 0;
        if (dealsToday === minDeals) {
            return managerName;
        }
    }

    // Fallback (shouldn't reach here)
    return sortedQueue[0];
}

// Log a new deal
function logDeal() {
    const customerLastName = document.getElementById('customerLastName').value.trim();
    const salesperson = document.getElementById('salesperson').value.trim();
    const vehicleSold = document.getElementById('vehicleSold').value.trim();
    const stockNumber = document.getElementById('stockNumber').value.trim();
    const financeType = document.getElementById('financeType').value;
    const paymentIn = parseFloat(document.getElementById('paymentIn').value) || 0;
    const paymentOut = parseFloat(document.getElementById('paymentOut').value) || 0;

    if (!customerLastName || !salesperson || !vehicleSold || !stockNumber || !financeType) {
        alert('Please fill in all required fields');
        return;
    }

    // Get next manager from rotation
    const assignedManager = getNextManager();
    if (!assignedManager) {
        alert('No managers in rotation. Please add a manager first.');
        return;
    }

    // Create deal object
    const now = new Date();
    const dealId = `deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dealNumber = dealHistory.length + 1;

    const deal = {
        dealId,
        dealNumber,
        fiManager: assignedManager,
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        customerLastName,
        salesperson,
        vehicleSold,
        stockNumber,
        financeType,
        paymentIn,
        paymentOut,
        paymentBump: paymentIn - paymentOut, // Calculate payment bump
        date: getTodayKey(),
        timestamp: now.getTime(),
        loggedBy: currentUser ? currentUser.name : 'System'
    };

    // Add to deal history
    dealHistory.push(deal);
    dealRows.set(dealId, deal);

    // Update daily deals count
    const today = getTodayKey();
    if (!dailyDeals[today][assignedManager]) {
        dailyDeals[today][assignedManager] = 0;
    }
    dailyDeals[today][assignedManager]++;

    // Update last assigned manager
    lastAssignedManager = assignedManager;

    // Show notification if logged by desk manager or admin
    if (currentUser && (currentUser.role === 'desk' || currentUser.role === 'admin')) {
        showDealNotification(assignedManager);
    }
    
    // Send SMS notification to Finance Managers about rotation position
    notifyFinanceManagersRotation();

    // Clear form
    document.getElementById('customerLastName').value = '';
    document.getElementById('salesperson').value = '';
    document.getElementById('vehicleSold').value = '';
    document.getElementById('stockNumber').value = '';
    document.getElementById('financeType').value = '';
    document.getElementById('paymentIn').value = '';
    document.getElementById('paymentOut').value = '';

    // Update UI
    appendDealRow(deal);
    updateRotationQueue();
    updateNextManagerDisplay();
    saveState();
}

// Check if payment out can be edited for a deal
function canEditPaymentOut(deal) {
    if (!currentUser) return false;
    
    // Admin can always edit
    if (currentUser.role === 'admin') return true;
    
    // Finance manager can edit if:
    // 1. They are the F&I manager assigned to the deal
    // 2. It's still the same day
    if (currentUser.role === 'finance') {
        const isSameDay = deal.date === getTodayKey();
        const isAssignedManager = deal.fiManager && currentUser.name && 
            deal.fiManager.toLowerCase().trim() === currentUser.name.toLowerCase().trim();
        return isSameDay && isAssignedManager;
    }
    
    return false;
}

// Append a new deal row to the table (static - doesn't move existing rows)
function appendDealRow(deal) {
    const tbody = document.getElementById('dealsTableBody');
    const row = document.createElement('tr');
    row.setAttribute('data-deal-id', deal.dealId);

    const paymentIn = deal.paymentIn ? `$${deal.paymentIn.toFixed(2)}` : '-';
    const paymentOutValue = deal.paymentOut || 0;
    
    // Check if payment out can be edited
    const canEdit = canEditPaymentOut(deal);
    
    // Create payment out cell - editable if allowed
    let paymentOutCell;
    if (canEdit) {
        paymentOutCell = `
            <td class="editable-payment-out">
                <input type="number" 
                       class="payment-out-input" 
                       value="${paymentOutValue.toFixed(2)}" 
                       step="0.01" 
                       min="0" 
                       data-deal-id="${deal.dealId}"
                       onchange="updatePaymentOut('${deal.dealId}', this.value)"
                       style="width: 100px; padding: 4px; border: 1px solid #72CFF4; border-radius: 4px; text-align: right;"
                       title="Editable until end of day">
            </td>
        `;
    } else {
        paymentOutCell = `<td>${paymentOutValue > 0 ? `$${paymentOutValue.toFixed(2)}` : '-'}</td>`;
    }
    
    // Check if user can remove deals (desk or admin)
    const canRemove = currentUser && (currentUser.role === 'desk' || currentUser.role === 'admin');
    const removeButton = canRemove 
        ? `<button class="remove-deal-btn" onclick="removeDeal('${deal.dealId}')" title="Remove deal">Remove</button>`
        : '-';

    row.innerHTML = `
        <td></td>
        <td>${deal.fiManager}</td>
        <td>${deal.time}</td>
        <td>${deal.customerLastName}</td>
        <td>${deal.salesperson}</td>
        <td>${deal.vehicleSold}</td>
        <td>${deal.stockNumber}</td>
        <td>${deal.dealNumber}</td>
        <td>${deal.financeType}</td>
        <td>${paymentIn}</td>
        ${paymentOutCell}
        <td>${removeButton}</td>
    `;

    tbody.appendChild(row);
}

// Update payment out for a deal
function updatePaymentOut(dealId, newValue) {
    // Check if deal exists and can be edited
    const deal = dealHistory.find(d => d.dealId === dealId);
    if (!deal) {
        alert('Deal not found');
        return;
    }
    
    if (!canEditPaymentOut(deal)) {
        alert('You do not have permission to edit this payment out value.');
        // Revert the input value
        const input = document.querySelector(`input[data-deal-id="${dealId}"]`);
        if (input) {
            input.value = (deal.paymentOut || 0).toFixed(2);
        }
        return;
    }
    
    // Validate the new value
    const paymentOut = parseFloat(newValue) || 0;
    if (paymentOut < 0) {
        alert('Payment out cannot be negative');
        const input = document.querySelector(`input[data-deal-id="${dealId}"]`);
        if (input) {
            input.value = (deal.paymentOut || 0).toFixed(2);
        }
        return;
    }
    
    // Update the deal
    deal.paymentOut = paymentOut;
    deal.paymentBump = (deal.paymentIn || 0) - paymentOut;
    
    // Save state
    saveState();
    
    // Update reports if they're currently displayed
    const reportsTab = document.getElementById('reportsTab');
    if (reportsTab && reportsTab.classList.contains('active')) {
        updateReports();
    }
    
    // Show confirmation (optional - you can remove this if you don't want the alert)
    console.log(`Payment out updated for deal ${deal.dealNumber} to $${paymentOut.toFixed(2)}`);
}

// Make function available globally
window.updatePaymentOut = updatePaymentOut;

// Update deals table (rebuild from dealHistory)
function updateDealsTable() {
    const tbody = document.getElementById('dealsTableBody');
    tbody.innerHTML = '';

    // Sort by deal number to maintain order (Deal #1 at top)
    const sortedDeals = [...dealHistory].sort((a, b) => a.dealNumber - b.dealNumber);

    sortedDeals.forEach(deal => {
        // Skip removed deals
        if (deal.removed) return;
        
        // Ensure payment fields exist for old deals
        if (deal.paymentIn === undefined) deal.paymentIn = 0;
        if (deal.paymentOut === undefined) deal.paymentOut = 0;
        appendDealRow(deal);
    });
}

// Remove a deal (desk/admin only)
function removeDeal(dealId) {
    if (!currentUser || (currentUser.role !== 'desk' && currentUser.role !== 'admin')) {
        alert('You do not have permission to remove deals.');
        return;
    }
    
    const deal = dealHistory.find(d => d.dealId === dealId);
    if (!deal) {
        alert('Deal not found.');
        return;
    }
    
    // Prompt for removal reason
    const reason = prompt(`Please provide a reason for removing this deal:\n\nDeal #${deal.dealNumber} - ${deal.customerLastName}`);
    
    if (!reason || reason.trim() === '') {
        alert('A reason is required to remove a deal.');
        return;
    }
    
    if (!confirm(`Are you sure you want to remove Deal #${deal.dealNumber}?\n\nReason: ${reason}`)) {
        return;
    }
    
    // Store removal info for record keeping
    deal.removed = true;
    deal.removedAt = new Date().toISOString();
    deal.removedBy = currentUser.name;
    deal.removalReason = reason.trim();
    
    // Add to removed deals for audit trail
    removedDeals.push(deal);
    
    // Remove from active deal history
    const index = dealHistory.findIndex(d => d.dealId === dealId);
    if (index !== -1) {
        dealHistory.splice(index, 1);
    }
    
    // Update daily deals count
    const today = getTodayKey();
    if (dailyDeals[today] && dailyDeals[today][deal.fiManager]) {
        dailyDeals[today][deal.fiManager] = Math.max(0, (dailyDeals[today][deal.fiManager] || 0) - 1);
    }
    
    // Update UI
    updateDealsTable();
    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    saveState();
    
    alert('Deal removed successfully. The removal has been recorded for audit purposes.');
}

// Filter deals table by search term
function filterDealsTable(searchTerm) {
    const rows = document.querySelectorAll('#dealsTableBody tr');
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

// Update managers list display (Manage tab - Show ALL Finance Managers)
function updateManagersList() {
    const container = document.getElementById('managersList');
    container.innerHTML = '';

    // Get all Finance Managers from users list
    const allFinanceManagers = users.filter(user => user.role === 'finance');

    if (allFinanceManagers.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No Finance Managers found. Add Finance Managers in the Settings panel.</p>';
        return;
    }

    // Sort Finance Managers by name
    allFinanceManagers.sort((a, b) => a.name.localeCompare(b.name));

    allFinanceManagers.forEach(financeUser => {
        const item = document.createElement('div');
        
        // Find if this user is already in the managers array
        const existingManager = managers.find(m => 
            m.name.toLowerCase() === financeUser.name.toLowerCase() || 
            (financeUser.email && m.email && m.email.toLowerCase() === financeUser.email.toLowerCase())
        );
        
        const isInRotation = existingManager ? existingManager.inRotation : false;
        const managerName = financeUser.name;
        
        item.className = `manager-item ${isInRotation ? 'active' : 'inactive'}`;

        const today = getTodayKey();
        const dealsToday = dailyDeals[today]?.[managerName] || 0;
        
        // Get contact info from manager record or user record
        const phone = existingManager?.phone || financeUser.phone || '';
        const email = existingManager?.email || financeUser.email || '';
        const phoneMarkup = phone ? `<div class="manager-contact">📞 ${phone}</div>` : '';
        const emailMarkup = email ? `<div class="manager-contact">✉️ ${email}</div>` : '';
        
        const rotationButton = `
            <button class="toggle-rotation-btn ${isInRotation ? 'remove-btn' : 'add-btn'}" onclick="toggleFinanceManagerRotation('${managerName}')">
                ${isInRotation ? 'Remove from Rotation' : 'Add to Rotation'}
            </button>
        `;
        
        item.innerHTML = `
            <div class="manager-info">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span class="manager-name">${managerName}</span>
                    ${financeUser.username ? `<span style="font-size: 11px; color: #72CFF4; font-weight: 600;">@${financeUser.username}</span>` : ''}
                </div>
                <span class="manager-status ${isInRotation ? 'active' : 'inactive'}">
                    ${isInRotation ? 'In Rotation' : 'Not in Rotation'}
                </span>
                <span style="font-size: 12px; color: #666;">Deals today: ${dealsToday}</span>
                ${phoneMarkup}
                ${emailMarkup}
            </div>
            ${rotationButton}
        `;

        container.appendChild(item);
    });
}

// Toggle Finance Manager rotation status (new function for all Finance Managers)
function toggleFinanceManagerRotation(managerName) {
    // Find the user
    const financeUser = users.find(u => u.name.toLowerCase() === managerName.toLowerCase());
    if (!financeUser || financeUser.role !== 'finance') {
        alert('Only Finance Managers can be added to rotation.');
        return;
    }

    // Find if manager already exists in managers array
    let manager = managers.find(m => 
        m.name.toLowerCase() === managerName.toLowerCase() || 
        (financeUser.email && m.email && m.email.toLowerCase() === financeUser.email.toLowerCase())
    );

    if (!manager) {
        // Create new manager entry
        manager = {
            name: financeUser.name,
            phone: financeUser.phone || '',
            email: financeUser.email || '',
            inRotation: true,
            rotationTimestamp: Date.now()
        };
        managers.push(manager);
        if (!rotationOrder.includes(manager.name)) {
            rotationOrder.push(manager.name);
        }
    } else {
        // Check if we're removing from rotation (need confirmation)
        if (manager.inRotation) {
            // Confirm removal
            const confirmed = confirm(`Are you sure you want to remove ${managerName} from rotation?`);
            if (!confirmed) {
                return; // User cancelled
            }
        }
        
        // Toggle rotation status
        manager.inRotation = !manager.inRotation;

        if (manager.inRotation) {
            // Add back to rotation order if not already there
            if (!rotationOrder.includes(managerName)) {
                rotationOrder.push(managerName);
                manager.rotationTimestamp = Date.now();
            }
        } else {
            // Remove from rotation order
            rotationOrder = rotationOrder.filter(name => name.toLowerCase() !== managerName.toLowerCase());
        }
    }

    // Update contact info from user if available
    if (financeUser.phone && !manager.phone) {
        manager.phone = financeUser.phone;
    }
    if (financeUser.email && !manager.email) {
        manager.email = financeUser.email;
    }

    // Initialize daily deals for today if needed
    const today = getTodayKey();
    if (!dailyDeals[today]) {
        dailyDeals[today] = {};
    }
    if (!dailyDeals[today][manager.name]) {
        dailyDeals[today][manager.name] = 0;
    }

    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    saveState();
}

// Make function available globally
window.toggleFinanceManagerRotation = toggleFinanceManagerRotation;

// Clear all managers from rotation
function clearAllRotation() {
    const confirmed = confirm('Are you sure you want to remove ALL managers from rotation? This will clear the rotation completely.');
    if (!confirmed) {
        return;
    }
    
    // Set all managers to not in rotation
    managers.forEach(manager => {
        manager.inRotation = false;
    });
    
    // Clear rotation order
    rotationOrder = [];
    
    // Reset last assigned manager
    lastAssignedManager = null;
    
    // Update UI
    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    
    // Save state
    saveState();
    
    alert('All managers have been removed from rotation.');
}

// Make function available globally
window.clearAllRotation = clearAllRotation;

// Removed - Producer list management no longer in Settings panel
function updateProducerList() {
    // Function kept for compatibility but does nothing
    // Producer management is now handled in the Manage tab
}

function triggerPinwheelSpin() {
    const trigger = document.getElementById('settingsTrigger');
    if (!trigger) return;

    trigger.classList.add('spinning');
    if (pinwheelSpinTimeout) {
        clearTimeout(pinwheelSpinTimeout);
    }
    pinwheelSpinTimeout = setTimeout(() => {
        trigger.classList.remove('spinning');
        pinwheelSpinTimeout = null;
    }, 600);
}

function toggleSettingsPanel(forceOpen) {
    const page = document.getElementById('settingsPage');
    const controlCenter = document.getElementById('controlCenter');
    const trigger = document.getElementById('settingsTrigger');
    if (!page || !controlCenter) return;

    const isOpen = page.style.display !== 'none';
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;

    if (shouldOpen) {
        // Show settings page, hide control center
        page.style.display = 'block';
        controlCenter.style.display = 'none';
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        
        // Update content when opening settings
        if (currentUser && currentUser.role === 'admin') {
            updateUsersGrid();
            updatePlanInfo();
            // Re-attach event listeners in case they weren't set up initially
            setupUserManagement();
        }
    } else {
        // Hide settings page, show control center
        page.style.display = 'none';
        controlCenter.style.display = 'block';
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
}

// Update rotation queue display
function updateRotationQueue() {
    const container = document.getElementById('rotationQueue');
    container.innerHTML = '';

    const queue = getRotationQueue();
    if (queue.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No managers in rotation</p>';
        return;
    }

    const today = getTodayKey();
    const nextManager = getNextManager();

    // Sort queue by rotation order (by timestamp) to maintain proper order
    const sortedQueue = [...queue].sort((a, b) => {
        const managerA = managers.find(m => m.name === a);
        const managerB = managers.find(m => m.name === b);
        return (managerA?.rotationTimestamp || 0) - (managerB?.rotationTimestamp || 0);
    });

    // Reorder: next at top, last at bottom, others maintain rotation order in between
    let displayOrder = [...sortedQueue];
    if (nextManager && lastAssignedManager && nextManager !== lastAssignedManager) {
        // Build display order maintaining rotation order
        // Start with next manager
        displayOrder = [nextManager];
        
        // Add managers in rotation order after next, but before last
        const nextIndex = sortedQueue.indexOf(nextManager);
        const lastIndex = sortedQueue.indexOf(lastAssignedManager);
        
        // Add managers after next (in rotation order) up to but not including last
        for (let i = 1; i < sortedQueue.length; i++) {
            const index = (nextIndex + i) % sortedQueue.length;
            const manager = sortedQueue[index];
            if (manager !== lastAssignedManager) {
                displayOrder.push(manager);
            }
        }
        
        // Add last at the end
        displayOrder.push(lastAssignedManager);
    } else if (nextManager) {
        // Only next manager (or same as last) - just move next to top
        const nextIndex = sortedQueue.indexOf(nextManager);
        displayOrder = [nextManager];
        for (let i = 1; i < sortedQueue.length; i++) {
            const index = (nextIndex + i) % sortedQueue.length;
            displayOrder.push(sortedQueue[index]);
        }
    }

    displayOrder.forEach((managerName, index) => {
        const item = document.createElement('div');
        const manager = managers.find(m => m.name === managerName);
        if (!manager) return;
        
        // Double-check this is a Finance Manager (should already be filtered, but safety check)
        const associatedUser = users.find(u => 
            u.name.toLowerCase() === managerName.toLowerCase() || 
            (manager.email && u.email.toLowerCase() === manager.email.toLowerCase())
        );
        
        // Skip if not a Finance Manager
        if (associatedUser && associatedUser.role !== 'finance') {
            return;
        }
        
        const dealsToday = dailyDeals[today]?.[managerName] || 0;

        let className = 'rotation-item';
        if (managerName === nextManager) {
            className += ' next';
        }
        if (managerName === lastAssignedManager) {
            className += ' last';
        }

        item.className = className;
        item.innerHTML = `
            <div>
                <span class="rotation-position">${index + 1}.</span>
                <strong>${managerName}</strong>
                <span style="font-size: 12px; color: #666; margin-left: 10px;">Deals today: ${dealsToday}</span>
            </div>
            ${managerName === nextManager ? '<span style="color: #28a745; font-weight: bold;">NEXT</span>' : ''}
            ${managerName === lastAssignedManager ? '<span style="color: #ffc107; font-weight: bold;">LAST</span>' : ''}
        `;

        container.appendChild(item);
    });
}

// Update next manager display
function updateNextManagerDisplay() {
    const nextManager = getNextManager();
    const display = document.getElementById('nextManagerDisplay');
    display.textContent = nextManager || 'No managers in rotation';
}

// Trash deal log (clear deals and dailyDeals, preserve rotationOrder)
function trashDealLog() {
    if (!confirm('Are you sure you want to clear the deal log? This will remove all deals and reset daily counts, but preserve the rotation order.')) {
        return;
    }

    dealHistory = [];
    dealRows.clear();
    const today = getTodayKey();
    dailyDeals = { [today]: {} };
    lastAssignedManager = null;

    // Reset daily counts for all managers
    managers.forEach(manager => {
        if (!dailyDeals[today][manager.name]) {
            dailyDeals[today][manager.name] = 0;
        }
    });

    updateDealsTable();
    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    saveState();
}

// ===== TAB FUNCTIONALITY =====
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            btn.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}Tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            // Refresh content if needed
            if (targetTab === 'reports') {
                updateReports();
            } else if (targetTab === 'history') {
                updateHistoryList();
            } else if (targetTab === 'rotation') {
                updateRotationQueue();
                updateNextManagerDisplay();
            } else if (targetTab === 'manage') {
                updateManagersList();
            }
        });
    });
}

// ===== REPORTS FUNCTIONALITY =====
function setupReports() {
    populateReportFilters();
    const reportMonth = document.getElementById('reportMonth');
    const reportYear = document.getElementById('reportYear');
    
    if (reportMonth) {
        reportMonth.addEventListener('change', updateReports);
    }
    if (reportYear) {
        reportYear.addEventListener('change', updateReports);
    }
}

function populateReportFilters() {
    const monthSelect = document.getElementById('reportMonth');
    const yearSelect = document.getElementById('reportYear');
    
    if (!monthSelect || !yearSelect) return;
    
    // Populate months
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    monthSelect.innerHTML = '<option value="">Select Month</option>';
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1;
        option.textContent = month;
        monthSelect.appendChild(option);
    });
    
    // Set current month
    const now = new Date();
    monthSelect.value = now.getMonth() + 1;
    
    // Populate years (current year and past 2 years)
    yearSelect.innerHTML = '<option value="">Select Year</option>';
    for (let i = 0; i < 3; i++) {
        const year = now.getFullYear() - i;
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
    yearSelect.value = now.getFullYear();
}

function updateReports() {
    const month = parseInt(document.getElementById('reportMonth')?.value) || new Date().getMonth() + 1;
    const year = parseInt(document.getElementById('reportYear')?.value) || new Date().getFullYear();
    const reportsContent = document.getElementById('reportsContent');
    
    if (!reportsContent) return;
    
    // Filter deals for the selected month/year
    const filteredDeals = dealHistory.filter(deal => {
        const dealDate = new Date(deal.timestamp);
        return dealDate.getMonth() + 1 === month && dealDate.getFullYear() === year;
    });
    
    // Group by manager
    const managerStats = {};
    filteredDeals.forEach(deal => {
        if (!managerStats[deal.fiManager]) {
            managerStats[deal.fiManager] = {
                deals: 0,
                totalPaymentIn: 0,
                totalPaymentOut: 0,
                paymentBumps: []
            };
        }
        managerStats[deal.fiManager].deals++;
        managerStats[deal.fiManager].totalPaymentIn += deal.paymentIn || 0;
        managerStats[deal.fiManager].totalPaymentOut += deal.paymentOut || 0;
        if (deal.paymentBump !== undefined) {
            managerStats[deal.fiManager].paymentBumps.push(deal.paymentBump);
        }
    });
    
    // Generate report HTML
    let html = '<div class="reports-grid">';
    
    Object.keys(managerStats).forEach(managerName => {
        const stats = managerStats[managerName];
        const avgPaymentBump = stats.paymentBumps.length > 0 
            ? stats.paymentBumps.reduce((a, b) => a + b, 0) / stats.paymentBumps.length 
            : 0;
        const goal = paymentBumpGoals[managerName] || 0;
        const goalMet = goal > 0 && avgPaymentBump >= goal;
        
        html += `
            <div class="report-card">
                <h3>${managerName}</h3>
                <div class="report-stats">
                    <div class="report-stat">
                        <span class="stat-label">Deals This Month:</span>
                        <span class="stat-value">${stats.deals}</span>
                    </div>
                    <div class="report-stat">
                        <span class="stat-label">Avg Payment Bump:</span>
                        <span class="stat-value">$${avgPaymentBump.toFixed(2)}</span>
                    </div>
                    <div class="report-stat">
                        <span class="stat-label">Payment Bump Goal:</span>
                        <span class="stat-value">$${goal.toFixed(2)}</span>
                    </div>
                    <div class="report-stat ${goalMet ? 'goal-met' : 'goal-not-met'}">
                        <span class="stat-label">Status:</span>
                        <span class="stat-value">${goalMet ? '✓ Goal Met' : goal > 0 ? 'Goal Not Met' : 'No Goal Set'}</span>
                    </div>
                </div>
                <div class="report-goal-input">
                    <label>
                        Set Payment Bump Goal ($):
                        <input type="number" id="goal-${managerName}" step="0.01" min="0" 
                               value="${goal}" placeholder="0.00" />
                    </label>
                    <button onclick="setPaymentBumpGoal('${managerName}')" class="primary-btn">Set Goal</button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    reportsContent.innerHTML = html || '<p>No deals found for the selected month.</p>';
}

function setPaymentBumpGoal(managerName) {
    const input = document.getElementById(`goal-${managerName}`);
    if (!input) return;
    
    const goal = parseFloat(input.value) || 0;
    paymentBumpGoals[managerName] = goal;
    saveState();
    updateReports();
}

// ===== HISTORY FUNCTIONALITY =====
function updateHistoryList() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    // Group deals by date
    const dealsByDate = {};
    dealHistory.forEach(deal => {
        if (!dealsByDate[deal.date]) {
            dealsByDate[deal.date] = [];
        }
        dealsByDate[deal.date].push(deal);
    });
    
    // Create history entries
    let html = '';
    Object.keys(dealsByDate).sort().reverse().forEach(date => {
        const deals = dealsByDate[date];
        const dateObj = new Date(date + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        html += `
            <div class="history-item" data-date="${date}">
                <div class="history-item-header">
                    <h4>${formattedDate}</h4>
                    <span class="history-deal-count">${deals.length} deals</span>
                </div>
                <div class="history-item-actions">
                    <button onclick="exportHistoryDate('${date}')" class="primary-btn">Export</button>
                    <button onclick="viewHistoryDate('${date}')" class="secondary-btn">View</button>
                </div>
            </div>
        `;
    });
    
    historyList.innerHTML = html || '<p>No historical data available.</p>';
}

function filterHistoryList(searchTerm) {
    const items = document.querySelectorAll('.history-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? '' : 'none';
    });
}

function exportHistoryDate(date) {
    const deals = dealHistory.filter(d => d.date === date);
    if (deals.length === 0) {
        alert('No deals found for this date.');
        return;
    }
    
    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined') {
        alert('PDF library not loaded. Please refresh the page and try again.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Format date for display
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Set up PDF styling
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const startY = 20;
    let yPos = startY;
    const lineHeight = 7;
    const colWidths = [25, 18, 30, 25, 30, 20, 15, 20, 20, 20];
    const headers = ['F&I', 'Time', 'Customer', 'Salesperson', 'Vehicle', 'Stock #', 'Deal #', 'Type', 'Pay In', 'Pay Out'];
    
    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('DealOrbit Deal Log', margin, yPos);
    yPos += lineHeight;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Date: ${formattedDate}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Total Deals: ${deals.length}`, margin, yPos);
    yPos += lineHeight + 5;
    
    // Table headers
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    let xPos = margin;
    headers.forEach((header, index) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[index];
    });
    yPos += lineHeight;
    
    // Draw line under headers
    doc.setLineWidth(0.5);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 3;
    
    // Table rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    
    deals.forEach((deal, index) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            yPos = startY;
            
            // Redraw headers on new page
            doc.setFont(undefined, 'bold');
            xPos = margin;
            headers.forEach((header, idx) => {
                doc.text(header, xPos, yPos);
                xPos += colWidths[idx];
            });
            yPos += lineHeight;
            doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
            yPos += 3;
            doc.setFont(undefined, 'normal');
        }
        
        const rowData = [
            deal.fiManager || '-',
            deal.time || '-',
            deal.customerLastName || '-',
            deal.salesperson || '-',
            deal.vehicleSold || '-',
            deal.stockNumber || '-',
            deal.dealNumber || '-',
            deal.financeType || '-',
            deal.paymentIn ? `$${deal.paymentIn.toFixed(2)}` : '-',
            deal.paymentOut ? `$${deal.paymentOut.toFixed(2)}` : '-'
        ];
        
        xPos = margin;
        rowData.forEach((data, idx) => {
            // Truncate long text to fit column
            let text = String(data);
            if (text.length > 15 && idx !== 0) {
                text = text.substring(0, 12) + '...';
            }
            doc.text(text, xPos, yPos);
            xPos += colWidths[idx];
        });
        
        yPos += lineHeight;
    });
    
    // Add summary at the end
    yPos += 10;
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPos = startY;
    }
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', margin, yPos);
    yPos += lineHeight;
    
    doc.setFont(undefined, 'normal');
    const totalPaymentIn = deals.reduce((sum, d) => sum + (d.paymentIn || 0), 0);
    const totalPaymentOut = deals.reduce((sum, d) => sum + (d.paymentOut || 0), 0);
    const totalBump = totalPaymentIn - totalPaymentOut;
    
    doc.text(`Total Payment In: $${totalPaymentIn.toFixed(2)}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Total Payment Out: $${totalPaymentOut.toFixed(2)}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Total Payment Bump: $${totalBump.toFixed(2)}`, margin, yPos);
    
    // Save PDF
    doc.save(`dealorbit-${date}.pdf`);
}

function viewHistoryDate(date) {
    const deals = dealHistory.filter(d => d.date === date);
    if (deals.length === 0) {
        alert('No deals found for this date.');
        return;
    }
    
    // Switch to deals tab and filter
    document.querySelector('[data-tab="deals"]').click();
    setTimeout(() => {
        document.getElementById('searchDealsInput').value = date;
        filterDealsTable(date);
    }, 100);
}

// ===== AUTHENTICATION SYSTEM =====
function checkAuth() {
    // Check if there's a saved user session
    const savedCurrentUser = localStorage.getItem('dealOrbit_currentUser');
    
    if (savedCurrentUser && currentUser) {
        // User is logged in, show control center and hide landing page
        showControlCenter();
        updateDealershipName();
    } else {
        // No user session - for returning users, show login page (hide landing page)
        // For new visitors, landing page will be visible by default
        // Check if user has visited before (has any saved data)
        const hasExistingData = localStorage.getItem('dealOrbit_users') || 
                                localStorage.getItem('dealOrbit_managers');
        
        if (hasExistingData) {
            // Returning user - show login, hide landing page
            currentUser = null;
            localStorage.removeItem('dealOrbit_currentUser');
            showLogin();
        } else {
            // New visitor - show landing page (default state)
            // Landing page is visible by default, just ensure login/signup are hidden
            const loginSection = document.getElementById('login');
            const signupSection = document.getElementById('signup');
            const forgotPasswordSection = document.getElementById('forgotPassword');
            const controlCenter = document.querySelector('.control-center-wrapper');
            
            if (loginSection) loginSection.style.display = 'none';
            if (signupSection) signupSection.style.display = 'none';
            if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
            if (controlCenter) controlCenter.style.display = 'none';
        }
    }
}

function showLogin() {
    const loginSection = document.getElementById('login');
    const signupSection = document.getElementById('signup');
    const forgotPasswordSection = document.getElementById('forgotPassword');
    const controlCenter = document.querySelector('.control-center-wrapper');
    const landingPageContent = document.getElementById('landingPageContent');
    const topNav = document.getElementById('topNav');
    
    // Hide landing page content for returning users
    if (landingPageContent) landingPageContent.style.display = 'none';
    if (topNav) topNav.style.display = 'none';
    
    // Show login section
    if (loginSection) loginSection.style.display = 'block';
    if (signupSection) signupSection.style.display = 'none';
    if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
    if (controlCenter) controlCenter.style.display = 'none';
    
    const navLoginLink = document.getElementById('navLoginLink');
    const navLogoutLink = document.getElementById('navLogoutLink');
    if (navLoginLink) navLoginLink.style.display = 'inline-block';
    if (navLogoutLink) navLogoutLink.style.display = 'none';
    
    // Reset login form when showing login page
    resetLoginForm();
}

// Show landing page
function showLandingPage() {
    const loginSection = document.getElementById('login');
    const signupSection = document.getElementById('signup');
    const forgotPasswordSection = document.getElementById('forgotPassword');
    const controlCenter = document.querySelector('.control-center-wrapper');
    const landingPageContent = document.getElementById('landingPageContent');
    const topNav = document.getElementById('topNav');
    
    // Show landing page content
    if (landingPageContent) landingPageContent.style.display = 'block';
    if (topNav) topNav.style.display = 'block';
    
    // Hide other sections
    if (loginSection) loginSection.style.display = 'none';
    if (signupSection) signupSection.style.display = 'none';
    if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
    if (controlCenter) controlCenter.style.display = 'none';
    
    const navLoginLink = document.getElementById('navLoginLink');
    const navLogoutLink = document.getElementById('navLogoutLink');
    if (navLoginLink) navLoginLink.style.display = 'inline-block';
    if (navLogoutLink) navLogoutLink.style.display = 'none';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSignup() {
    const loginSection = document.getElementById('login');
    const signupSection = document.getElementById('signup');
    const forgotPasswordSection = document.getElementById('forgotPassword');
    const controlCenter = document.querySelector('.control-center-wrapper');
    const landingPageContent = document.getElementById('landingPageContent');
    const topNav = document.getElementById('topNav');
    
    // Hide landing page content
    if (landingPageContent) landingPageContent.style.display = 'none';
    if (topNav) topNav.style.display = 'none';
    
    // Show signup section
    if (loginSection) loginSection.style.display = 'none';
    if (signupSection) signupSection.style.display = 'block';
    if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
    if (controlCenter) controlCenter.style.display = 'none';
}

function showControlCenter() {
    const loginSection = document.getElementById('login');
    const signupSection = document.getElementById('signup');
    const forgotPasswordSection = document.getElementById('forgotPassword');
    const controlCenter = document.querySelector('.control-center-wrapper');
    const landingPageContent = document.getElementById('landingPageContent');
    const topNav = document.getElementById('topNav');
    
    // Hide landing page content completely when logged in
    if (landingPageContent) landingPageContent.style.display = 'none';
    if (topNav) topNav.style.display = 'none';
    
    // Show only control center
    if (loginSection) loginSection.style.display = 'none';
    if (signupSection) signupSection.style.display = 'none';
    if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
    if (controlCenter) controlCenter.style.display = 'block';
    
    const navLoginLink = document.getElementById('navLoginLink');
    const navLogoutLink = document.getElementById('navLogoutLink');
    if (navLoginLink) navLoginLink.style.display = 'none';
    if (navLogoutLink) navLogoutLink.style.display = 'inline-block';
    
    // Apply role-based access when showing control center
    if (currentUser) {
        applyRoleBasedAccess();
        updateDealershipName();
        // Show/hide user management in settings based on role - ADMIN ONLY
        const settingsUserManagement = document.getElementById('settingsUserManagement');
        if (settingsUserManagement) {
            if (currentUser.role === 'admin') {
                settingsUserManagement.style.display = 'block';
                // Update user management if admin
                updateUsersGrid();
                updatePlanInfo();
            } else {
                settingsUserManagement.style.display = 'none';
            }
        }
    }
}

// Update dealership name in header
function updateDealershipName() {
    const dealershipName = document.getElementById('dealershipName');
    const dealershipNameValue = document.getElementById('dealershipNameValue');
    const usernameValue = document.getElementById('usernameValue');
    
    if (dealershipName && dealershipNameValue && currentUser) {
        if (currentUser.company) {
            dealershipNameValue.textContent = currentUser.company;
            dealershipName.style.display = 'block';
            
            // Update username display
            if (usernameValue) {
                usernameValue.textContent = currentUser.username || 'Not set';
            }
        } else {
            dealershipName.style.display = 'none';
        }
    }
}

// Simple hash function for password (in production, use proper hashing)
function hashPassword(password) {
    if (!password) return '';
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

// Helper function to fix user password (for debugging/admin use)
window.fixUserPassword = function(username, newPassword) {
    const user = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        console.error('User not found:', username);
        return false;
    }
    user.passwordHash = hashPassword(newPassword);
    user.needsPasswordSetup = false;
    saveState();
    console.log('Password updated for user:', username);
    return true;
};

// Helper function to check user details
window.checkUser = function(username) {
    const user = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
        console.log('User not found:', username);
        console.log('Available users:', users.map(u => u.username));
        return null;
    }
    console.log('User details:', {
        username: user.username,
        name: user.name,
        email: user.email,
        hasPasswordHash: !!user.passwordHash,
        passwordHash: user.passwordHash,
        needsPasswordSetup: user.needsPasswordSetup
    });
    return user;
};

// Generate a 6-digit verification code
function generate2FACode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send 2FA code via SMS (simulated for testing)
function send2FACode(phone, code) {
    // In production, this would call an SMS service API
    // For testing, we'll log it and show it in an alert
    console.log(`[2FA] Code sent to ${phone}: ${code}`);
    
    // Show code in alert for testing purposes (this should always appear)
    setTimeout(() => {
        alert(`2FA Code sent to ${phone}:\n\n${code}\n\n(This is for testing. In production, this would be sent via SMS.)`);
    }, 100);
    
    // In production, you would integrate with an SMS service like:
    // Twilio, AWS SNS, etc.
}

// Send 2FA code to user
function sendVerificationCode(user) {
    console.log('sendVerificationCode called for user:', user.email, 'Phone:', user.phone);
    
    if (!user.phone || user.phone.trim() === '') {
        throw new Error('User does not have a phone number on file. Please contact an administrator.');
    }
    
    const code = generate2FACode();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    pending2FACodes[user.email.toLowerCase()] = {
        code: code,
        expiresAt: expiresAt,
        phone: user.phone
    };
    
    console.log('Sending 2FA code:', code, 'to phone:', user.phone);
    send2FACode(user.phone, code);
    
    // Clean up expired codes
    cleanupExpired2FACodes();
}

// Clean up expired 2FA codes
function cleanupExpired2FACodes() {
    const now = Date.now();
    Object.keys(pending2FACodes).forEach(email => {
        if (pending2FACodes[email].expiresAt < now) {
            delete pending2FACodes[email];
        }
    });
}

// Verify 2FA code
function verify2FACode(email, code) {
    cleanupExpired2FACodes();
    
    const emailKey = email.toLowerCase();
    const pending = pending2FACodes[emailKey];
    
    if (!pending) {
        return { valid: false, error: 'No verification code found. Please request a new code.' };
    }
    
    if (pending.expiresAt < Date.now()) {
        delete pending2FACodes[emailKey];
        return { valid: false, error: 'Verification code has expired. Please request a new code.' };
    }
    
    if (pending.code !== code.trim()) {
        return { valid: false, error: 'Invalid verification code. Please try again.' };
    }
    
    // Code is valid, remove it
    delete pending2FACodes[emailKey];
    return { valid: true };
}

function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }
    console.log('Setting up login form');
    
    const passwordSection = document.getElementById('passwordSection');
    const passwordSetupSection = document.getElementById('passwordSetupSection');
    const passwordLoginSection = document.getElementById('passwordLoginSection');
    const loginUsernameInput = document.getElementById('loginUsername');
    const loginPasswordInput = document.getElementById('loginPassword');
    const newPasswordSetupInput = document.getElementById('newPasswordSetup');
    const confirmPasswordSetupInput = document.getElementById('confirmPasswordSetup');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    
    let currentLoginUser = null; // Store user being logged in
    let usernameVerified = false; // Track if username has been verified
    
    // Function to verify username and show password section
    function verifyUsername() {
        const username = loginUsernameInput ? loginUsernameInput.value.trim() : '';
        const errorMsg = document.getElementById('loginError');
        
        if (!username) {
            if (errorMsg) {
                errorMsg.textContent = 'Please enter your username';
                errorMsg.style.display = 'block';
            }
            if (passwordSection) passwordSection.style.display = 'none';
            usernameVerified = false;
            currentLoginUser = null;
            return false;
        }
        
        // Find user by username
        console.log('Looking for username:', username);
        console.log('Available users:', users.map(u => ({ username: u.username, name: u.name, email: u.email })));
        const user = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
            console.error('Username not found:', username);
            if (errorMsg) {
                errorMsg.textContent = 'Username not found';
                errorMsg.style.display = 'block';
            }
            if (passwordSection) passwordSection.style.display = 'none';
            usernameVerified = false;
            currentLoginUser = null;
            return false;
        }
        
        console.log('User found:', { username: user.username, name: user.name, hasPasswordHash: !!user.passwordHash, needsPasswordSetup: user.needsPasswordSetup });
        
        // Username found - show password section
        currentLoginUser = user;
        usernameVerified = true;
        
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
        
        if (passwordSection) {
            passwordSection.style.display = 'block';
        }
        
        // Check if user needs password setup
        if (user.needsPasswordSetup || !user.passwordHash) {
            // Show password setup section
            if (passwordSetupSection) passwordSetupSection.style.display = 'block';
            if (passwordLoginSection) passwordLoginSection.style.display = 'none';
            if (loginPasswordInput) {
                loginPasswordInput.required = false;
                loginPasswordInput.removeAttribute('required');
            }
            if (loginSubmitBtn) loginSubmitBtn.textContent = 'Create Password & Login';
            if (newPasswordSetupInput) {
                newPasswordSetupInput.focus();
            }
        } else {
            // Show regular password login
            if (passwordSetupSection) passwordSetupSection.style.display = 'none';
            if (passwordLoginSection) passwordLoginSection.style.display = 'block';
            if (loginPasswordInput) {
                loginPasswordInput.required = true;
                loginPasswordInput.setAttribute('required', 'required');
                loginPasswordInput.focus();
            }
            if (loginSubmitBtn) loginSubmitBtn.textContent = 'Login';
        }
        
        return true;
    }
    
    // Check username on blur or Enter key
    if (loginUsernameInput) {
        loginUsernameInput.addEventListener('blur', () => {
            verifyUsername();
        });
        
        loginUsernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !usernameVerified) {
                e.preventDefault();
                if (verifyUsername()) {
                    // Focus on password field after username is verified
                    setTimeout(() => {
                        if (currentLoginUser && (currentLoginUser.needsPasswordSetup || !currentLoginUser.passwordHash)) {
                            if (newPasswordSetupInput) newPasswordSetupInput.focus();
                        } else {
                            if (loginPasswordInput) loginPasswordInput.focus();
                        }
                    }, 100);
                }
            }
        });
        
        // Reset when username changes
        loginUsernameInput.addEventListener('input', () => {
            if (passwordSection) passwordSection.style.display = 'none';
            if (loginSubmitBtn) loginSubmitBtn.textContent = 'Continue';
            usernameVerified = false;
            currentLoginUser = null;
            // Remove required attributes from password fields when hiding
            if (loginPasswordInput) {
                loginPasswordInput.required = false;
                loginPasswordInput.removeAttribute('required');
            }
            const newPwdInput = document.getElementById('newPasswordSetup');
            const confirmPwdInput = document.getElementById('confirmPasswordSetup');
            if (newPwdInput) {
                newPwdInput.required = false;
                newPwdInput.removeAttribute('required');
            }
            if (confirmPwdInput) {
                confirmPwdInput.required = false;
                confirmPwdInput.removeAttribute('required');
            }
            const errorMsg = document.getElementById('loginError');
            if (errorMsg) errorMsg.style.display = 'none';
        });
    }
    
    // Only attach submit listener once
    if (!loginForm.dataset.submitHandlerAttached) {
        console.log('Attaching login form submit handler');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('=== LOGIN FORM SUBMITTED ===');
            
            // Get fresh references to form elements each time
            const freshLoginUsernameInput = document.getElementById('loginUsername');
            const freshLoginPasswordInput = document.getElementById('loginPassword');
            const freshNewPasswordSetupInput = document.getElementById('newPasswordSetup');
            const freshConfirmPasswordSetupInput = document.getElementById('confirmPasswordSetup');
            const freshPasswordSection = document.getElementById('passwordSection');
            const errorMsg = document.getElementById('loginError');
            
            const username = freshLoginUsernameInput ? freshLoginUsernameInput.value.trim() : '';
            const password = freshLoginPasswordInput ? freshLoginPasswordInput.value : '';
            const newPassword = freshNewPasswordSetupInput ? freshNewPasswordSetupInput.value : '';
            const confirmPassword = freshConfirmPasswordSetupInput ? freshConfirmPasswordSetupInput.value : '';
            
            console.log('Login attempt:', { username, hasPassword: !!password, hasNewPassword: !!newPassword, usernameVerified, currentLoginUser: !!currentLoginUser });
            
            // Step 1: Verify username if password section is not visible
            const passwordSectionVisible = freshPasswordSection && freshPasswordSection.style.display !== 'none';
            if (!passwordSectionVisible || !usernameVerified) {
                console.log('Step 1: Verifying username');
                if (!verifyUsername()) {
                    return; // Username verification failed
                }
                // Username verified, password section is now shown
                // Focus on appropriate field
                setTimeout(() => {
                    if (currentLoginUser && (currentLoginUser.needsPasswordSetup || !currentLoginUser.passwordHash)) {
                        const setupInput = document.getElementById('newPasswordSetup');
                        if (setupInput) setupInput.focus();
                    } else {
                        const pwdInput = document.getElementById('loginPassword');
                        if (pwdInput) pwdInput.focus();
                    }
                }, 100);
                return; // Wait for next submit to handle password
            }
            
            // Step 2: Handle password (username already verified)
            console.log('Step 2: Handling password');
            if (!currentLoginUser) {
                console.error('No current login user');
                if (errorMsg) {
                    errorMsg.textContent = 'Please enter your username first';
                    errorMsg.style.display = 'block';
                }
                return;
            }
            
            const user = currentLoginUser;
            console.log('Processing login for user:', user.username, 'needsPasswordSetup:', user.needsPasswordSetup, 'hasPasswordHash:', !!user.passwordHash);
            
            // Check if user needs password setup
            if (user.needsPasswordSetup || !user.passwordHash) {
                console.log('User needs password setup');
                // Handle password setup
                if (!newPassword || newPassword.length < 8) {
                    if (errorMsg) {
                        errorMsg.textContent = 'Password must be at least 8 characters';
                        errorMsg.style.display = 'block';
                    }
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    if (errorMsg) {
                        errorMsg.textContent = 'Passwords do not match';
                        errorMsg.style.display = 'block';
                    }
                    return;
                }
                
                console.log('Setting password for user');
                // Set password
                user.passwordHash = hashPassword(newPassword);
                user.needsPasswordSetup = false;
                saveState();
                
                // Clear password setup fields
                if (freshNewPasswordSetupInput) freshNewPasswordSetupInput.value = '';
                if (freshConfirmPasswordSetupInput) freshConfirmPasswordSetupInput.value = '';
                
                // Password created successfully, proceed directly to login
                // Skip password verification since we just set it
                currentLoginUser = user;
                console.log('Password set, proceeding to login');
            } else {
                console.log('User has password, verifying');
                // User already has password - verify it
                if (!password) {
                    if (errorMsg) {
                        errorMsg.textContent = 'Please enter your password';
                        errorMsg.style.display = 'block';
                    }
                    return;
                }
                
                const hashedPassword = hashPassword(password);
                console.log('Password verification:', { 
                    enteredPassword: password, 
                    enteredHash: hashedPassword, 
                    storedHash: user.passwordHash,
                    match: user.passwordHash === hashedPassword
                });
                if (user.passwordHash !== hashedPassword) {
                    console.error('Password verification failed', { 
                        stored: user.passwordHash, 
                        entered: hashedPassword,
                        enteredPassword: password
                    });
                    if (errorMsg) {
                        errorMsg.textContent = 'Invalid username or password';
                        errorMsg.style.display = 'block';
                    }
                    return;
                }
                console.log('Password verified successfully');
            }
            
            // Password is correct, complete login
            console.log('Completing login');
            currentUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
                username: user.username
            };
            
            saveState();
            showControlCenter();
            applyRoleBasedAccess();
            
            // Reset form
            resetLoginForm();
            loginForm.reset();
            if (errorMsg) errorMsg.style.display = 'none';
            
            // Scroll to control center
            window.location.href = '#appContainer';
            setTimeout(() => {
                document.getElementById('appContainer')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });
        loginForm.dataset.submitHandlerAttached = 'true';
    }
    
    // Also attach direct click handler to submit button as fallback
    if (loginSubmitBtn && !loginSubmitBtn.dataset.clickHandlerAttached) {
        loginSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Login button clicked directly');
            // Trigger form submit
            if (loginForm) {
                loginForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
        });
        loginSubmitBtn.dataset.clickHandlerAttached = 'true';
    }
    
    // Logout link
    const logoutLink = document.getElementById('navLogoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Reset login form
function resetLoginForm() {
    const passwordSection = document.getElementById('passwordSection');
    const passwordSetupSection = document.getElementById('passwordSetupSection');
    const passwordLoginSection = document.getElementById('passwordLoginSection');
    const loginUsernameInput = document.getElementById('loginUsername');
    const loginPasswordInput = document.getElementById('loginPassword');
    const newPasswordSetupInput = document.getElementById('newPasswordSetup');
    const confirmPasswordSetupInput = document.getElementById('confirmPasswordSetup');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    
    // Hide password section initially
    if (passwordSection) {
        passwordSection.style.display = 'none';
    }
    
    if (passwordSetupSection) {
        passwordSetupSection.style.display = 'none';
    }
    
    if (passwordLoginSection) {
        passwordLoginSection.style.display = 'none';
    }
    
    if (loginUsernameInput) {
        loginUsernameInput.disabled = false;
    }
    
    if (loginPasswordInput) {
        loginPasswordInput.disabled = false;
        loginPasswordInput.required = false;
        loginPasswordInput.value = '';
    }
    
    if (newPasswordSetupInput) {
        newPasswordSetupInput.value = '';
    }
    
    if (confirmPasswordSetupInput) {
        confirmPasswordSetupInput.value = '';
    }
    
    if (loginSubmitBtn) {
        loginSubmitBtn.textContent = 'Continue';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('dealOrbit_currentUser');
    resetLoginForm();
    showLogin();
    window.location.href = '#login';
}

// ===== FORGOT PASSWORD FUNCTIONALITY =====
// Send password reset code via email (simulated for testing)
function sendPasswordResetEmail(email, code) {
    // In production, this would call an email service API
    // For testing, we'll log it and show it in an alert
    console.log(`[Password Reset] Code sent to ${email}: ${code}`);
    
    // Show code in alert for testing purposes
    alert(`Password Reset Code sent to ${email}:\n\n${code}\n\n(This is for testing. In production, this would be sent via email.)`);
    
    // In production, you would integrate with an email service like:
    // SendGrid, AWS SES, Mailgun, etc.
}

// Send password reset code
function sendPasswordResetCode(email) {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
        // Don't reveal if email exists for security
        // Still show success message to prevent email enumeration
        return { success: true };
    }
    
    const code = generate2FACode();
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
    
    pendingPasswordResetCodes[email.toLowerCase()] = {
        code: code,
        expiresAt: expiresAt
    };
    
    sendPasswordResetEmail(email, code);
    cleanupExpiredPasswordResetCodes();
    
    return { success: true };
}

// Clean up expired password reset codes
function cleanupExpiredPasswordResetCodes() {
    const now = Date.now();
    Object.keys(pendingPasswordResetCodes).forEach(email => {
        if (pendingPasswordResetCodes[email].expiresAt < now) {
            delete pendingPasswordResetCodes[email];
        }
    });
}

// Verify password reset code
function verifyPasswordResetCode(email, code) {
    cleanupExpiredPasswordResetCodes();
    
    const emailKey = email.toLowerCase();
    const pending = pendingPasswordResetCodes[emailKey];
    
    if (!pending) {
        return { valid: false, error: 'No reset code found. Please request a new code.' };
    }
    
    if (pending.expiresAt < Date.now()) {
        delete pendingPasswordResetCodes[emailKey];
        return { valid: false, error: 'Reset code has expired. Please request a new code.' };
    }
    
    if (pending.code !== code.trim()) {
        return { valid: false, error: 'Invalid verification code. Please try again.' };
    }
    
    // Code is valid
    return { valid: true };
}

// Reset user password
function resetUserPassword(email, newPassword) {
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
        return { success: false, error: 'User not found' };
    }
    
    // Update password
    user.passwordHash = hashPassword(newPassword);
    saveState();
    
    // Remove the reset code
    delete pendingPasswordResetCodes[email.toLowerCase()];
    
    return { success: true };
}

function setupForgotPassword() {
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    
    // Beta: Show placeholder message for password reset
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Beta placeholder - will be finalized with 2FA later
            alert('Password reset functionality will be available soon. For beta testing, please contact an administrator to reset your password.');
        });
        return; // Skip the rest of the forgot password setup for now
    }
    
    // Original forgot password code (commented out for beta)
    /*
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginLink1 = document.getElementById('backToLoginLink1');
    const backToLoginLink2 = document.getElementById('backToLoginLink2');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const forgotPasswordSection = document.getElementById('forgotPassword');
    const forgotPasswordStep1 = document.getElementById('forgotPasswordStep1');
    const forgotPasswordStep2 = document.getElementById('forgotPasswordStep2');
    const resetCodeInput = document.getElementById('resetCode');
    const resendResetCodeBtn = document.getElementById('resendResetCodeBtn');
    
    // Show forgot password section
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const loginSection = document.getElementById('login');
            const landingPageContent = document.getElementById('landingPageContent');
            const topNav = document.getElementById('topNav');
            
            // Hide landing page
            if (landingPageContent) landingPageContent.style.display = 'none';
            if (topNav) topNav.style.display = 'none';
            
            if (loginSection) loginSection.style.display = 'none';
            if (forgotPasswordSection) {
                forgotPasswordSection.style.display = 'block';
                // Reset to step 1
                if (forgotPasswordStep1) forgotPasswordStep1.style.display = 'block';
                if (forgotPasswordStep2) forgotPasswordStep2.style.display = 'none';
                // Clear form
                if (forgotPasswordForm) forgotPasswordForm.reset();
                const error1 = document.getElementById('forgotPasswordError');
                const error2 = document.getElementById('resetPasswordError');
                if (error1) error1.style.display = 'none';
                if (error2) error2.style.display = 'none';
            }
        });
    }
    
    // Back to login links
    if (backToLoginLink1) {
        backToLoginLink1.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
            if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
        });
    }
    
    if (backToLoginLink2) {
        backToLoginLink2.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
            if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
        });
    }
    
    // Restrict reset code input to numbers only
    if (resetCodeInput) {
        resetCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        resetCodeInput.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    // Resend reset code button
    if (resendResetCodeBtn) {
        resendResetCodeBtn.addEventListener('click', () => {
            const email = document.getElementById('forgotPasswordEmail').value.trim();
            if (!email) {
                alert('Please enter your email address first');
                return;
            }
            
            const result = sendPasswordResetCode(email);
            if (result.success) {
                alert('Verification code resent to your email address');
            }
        });
    }
    
    // Handle form submission
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('forgotPasswordEmail').value.trim();
            const resetCode = document.getElementById('resetCode').value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;
            
            const error1 = document.getElementById('forgotPasswordError');
            const error2 = document.getElementById('resetPasswordError');
            
            // Step 1: Request reset code
            if (forgotPasswordStep1 && forgotPasswordStep1.style.display !== 'none') {
                if (!email) {
                    if (error1) {
                        error1.textContent = 'Please enter your email address';
                        error1.style.display = 'block';
                    }
                    return;
                }
                
                const result = sendPasswordResetCode(email);
                if (result.success) {
                    // Show step 2
                    if (forgotPasswordStep1) forgotPasswordStep1.style.display = 'none';
                    if (forgotPasswordStep2) forgotPasswordStep2.style.display = 'block';
                    if (error1) error1.style.display = 'none';
                    if (resetCodeInput) resetCodeInput.focus();
                } else {
                    if (error1) {
                        error1.textContent = result.error || 'Failed to send reset code';
                        error1.style.display = 'block';
                    }
                }
            }
            // Step 2: Verify code and reset password
            else if (forgotPasswordStep2 && forgotPasswordStep2.style.display !== 'none') {
                if (!resetCode || resetCode.length !== 6) {
                    if (error2) {
                        error2.textContent = 'Please enter the 6-digit verification code';
                        error2.style.display = 'block';
                    }
                    return;
                }
                
                if (!newPassword || newPassword.length < 8) {
                    if (error2) {
                        error2.textContent = 'Password must be at least 8 characters';
                        error2.style.display = 'block';
                    }
                    return;
                }
                
                if (newPassword !== confirmNewPassword) {
                    if (error2) {
                        error2.textContent = 'Passwords do not match';
                        error2.style.display = 'block';
                    }
                    return;
                }
                
                // Verify reset code
                const verification = verifyPasswordResetCode(email, resetCode);
                if (!verification.valid) {
                    if (error2) {
                        error2.textContent = verification.error;
                        error2.style.display = 'block';
                    }
                    return;
                }
                
                // Reset password
                const resetResult = resetUserPassword(email, newPassword);
                if (resetResult.success) {
                    alert('Password reset successfully! You can now login with your new password.');
                    showLogin();
                    if (forgotPasswordSection) forgotPasswordSection.style.display = 'none';
                    // Reset form
                    if (forgotPasswordForm) forgotPasswordForm.reset();
                    if (forgotPasswordStep1) forgotPasswordStep1.style.display = 'block';
                    if (forgotPasswordStep2) forgotPasswordStep2.style.display = 'none';
                } else {
                    if (error2) {
                        error2.textContent = resetResult.error || 'Failed to reset password';
                        error2.style.display = 'block';
                    }
                }
            }
        });
    }
    */
}

// ===== SIGNUP FUNCTIONALITY =====
function setupSignup() {
    const signupForm = document.getElementById('signupForm');
    if (!signupForm) return;
    
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const company = document.getElementById('signupCompany').value.trim();
        const phone = document.getElementById('signupPhone').value.trim();
        const role = document.getElementById('signupRole').value;
        const password = document.getElementById('signupPassword').value;
        const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
        const errorMsg = document.getElementById('signupError');
        
        // Validation
        if (!name || !email || !company || !role || !password) {
            if (errorMsg) {
                errorMsg.textContent = 'Please fill in all required fields';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        if (password.length < 8) {
            if (errorMsg) {
                errorMsg.textContent = 'Password must be at least 8 characters';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        if (password !== passwordConfirm) {
            if (errorMsg) {
                errorMsg.textContent = 'Passwords do not match';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Check if email already exists
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            if (errorMsg) {
                errorMsg.textContent = 'An account with this email already exists';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Create user
        const newUser = {
            id: 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name,
            email,
            username: '', // Username will be set by admin in user management
            company,
            phone,
            role,
            passwordHash: hashPassword(password),
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        saveState();
        
        // Auto-login
        currentUser = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            company: newUser.company,
            username: newUser.username
        };
        saveState();
        
        alert('Account created successfully!');
        showControlCenter();
        applyRoleBasedAccess();
        
        // Clear form
        signupForm.reset();
        if (errorMsg) errorMsg.style.display = 'none';
        
        // Scroll to control center
        window.location.href = '#appContainer';
        setTimeout(() => {
            document.getElementById('appContainer')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    });
}


// Show notification
function showNotification(message) {
    // Remove existing notification if any
    const existing = document.getElementById('dealNotification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'dealNotification';
    notification.className = 'deal-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Show deal notification with special formatting
function showDealNotification(managerName) {
    // Remove existing notification if any
    const existing = document.getElementById('dealNotification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'dealNotification';
    notification.className = 'deal-notification';
    notification.innerHTML = `
        <div style="font-size: 14px; margin-bottom: 4px;">Deal goes to</div>
        <div style="font-size: 24px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 2px;">${managerName.toUpperCase()}</div>
    `;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Send SMS notifications to Finance Managers about their rotation position
function notifyFinanceManagersRotation() {
    if (!managers || managers.length === 0) return;
    
    const queue = getRotationQueue();
    if (queue.length === 0) return;
    
    // Get next manager
    const nextManager = getNextManager();
    if (!nextManager) return;
    
    // Find all Finance Managers in the system
    const financeManagers = users.filter(u => u.role === 'finance');
    
    financeManagers.forEach(financeUser => {
        // Find the manager in rotation
        const managerInRotation = managers.find(m => 
            m.name.toLowerCase() === financeUser.name.toLowerCase() ||
            m.email.toLowerCase() === financeUser.email.toLowerCase()
        );
        
        if (!managerInRotation || !managerInRotation.phone) return;
        
        // Find their position in rotation
        const position = queue.indexOf(managerInRotation.name) + 1;
        const totalInQueue = queue.length;
        
        let message = '';
        if (managerInRotation.name === nextManager) {
            message = `You are NEXT in rotation! A deal will be assigned to you.`;
        } else {
            message = `You are #${position} of ${totalInQueue} in the rotation queue. Next deal goes to ${nextManager}.`;
        }
        
        // Send SMS (simulated for testing)
        sendSMSNotification(managerInRotation.phone, message);
    });
}

// Send SMS notification (simulated for testing)
function sendSMSNotification(phone, message) {
    // In production, this would call an SMS service API
    // For testing, we'll log it and show it in console
    console.log(`[SMS] To: ${phone}\nMessage: ${message}`);
    
    // In production, you would integrate with an SMS service like:
    // Twilio, AWS SNS, etc.
}

// Apply role-based access control
function applyRoleBasedAccess() {
    if (!currentUser) return;
    
    const tabs = document.querySelectorAll('.tab-btn');
    
    // Hide/show tabs based on role
    tabs.forEach(tab => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName === 'reports' || tabName === 'history') {
            // Only admin can see these
            if (currentUser.role !== 'admin') {
                tab.style.display = 'none';
                const content = document.getElementById(`${tabName}Tab`);
                if (content) content.style.display = 'none';
            } else {
                tab.style.display = 'inline-block';
            }
        } else if (tabName === 'manage') {
            // Everyone can see manage tab
            tab.style.display = 'inline-block';
        } else if (tabName === 'rotation') {
            // Admin and Finance Manager can see rotation
            if (currentUser.role === 'desk') {
                tab.style.display = 'none';
                const content = document.getElementById(`${tabName}Tab`);
                if (content) content.style.display = 'none';
            } else {
                tab.style.display = 'inline-block';
            }
        } else if (tabName === 'deals') {
            // Everyone can see deals
            tab.style.display = 'inline-block';
        } else if (tabName === 'manage') {
            // Everyone can see manage tab (producers section)
            // Users sub-section is controlled separately
            tab.style.display = 'inline-block';
        } else if (tabName === 'logdeal') {
            // Desk Manager and Admin can log deals
            if (currentUser.role === 'finance') {
                tab.style.display = 'none';
                const content = document.getElementById(`${tabName}Tab`);
                if (content) content.style.display = 'none';
            } else {
                tab.style.display = 'inline-block';
            }
        }
    });
    
    // If desk manager, switch to log deal tab
    if (currentUser.role === 'desk') {
        const logDealTab = document.querySelector('[data-tab="logdeal"]');
        if (logDealTab) {
            logDealTab.click();
        }
    }
    
    // Hide settings trigger for non-admin users
    const settingsTrigger = document.getElementById('settingsTrigger');
    if (settingsTrigger) {
        if (currentUser.role !== 'admin') {
            settingsTrigger.style.display = 'none';
        } else {
            settingsTrigger.style.display = 'block';
        }
    }
    
    // Show chatbot only for Finance Managers
    const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
    const aiChatbot = document.getElementById('aiChatbot');
    if (chatbotToggleBtn && aiChatbot) {
        if (currentUser.role === 'finance') {
            chatbotToggleBtn.style.display = 'block';
        } else {
            chatbotToggleBtn.style.display = 'none';
            aiChatbot.style.display = 'none';
        }
    }
}

// ===== AI CHATBOT FUNCTIONALITY =====
function setupChatbot() {
    const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
    const chatbotCloseBtn = document.getElementById('chatbotCloseBtn');
    const aiChatbot = document.getElementById('aiChatbot');
    const chatbotSendBtn = document.getElementById('chatbotSendBtn');
    const chatbotInput = document.getElementById('chatbotInput');
    const chatbotMessages = document.getElementById('chatbotMessages');
    
    // Toggle chatbot
    if (chatbotToggleBtn && aiChatbot) {
        chatbotToggleBtn.addEventListener('click', () => {
            if (aiChatbot.style.display === 'none') {
                aiChatbot.style.display = 'flex';
                chatbotToggleBtn.style.display = 'none';
                if (chatbotInput) chatbotInput.focus();
            }
        });
    }
    
    // Close chatbot
    if (chatbotCloseBtn && aiChatbot && chatbotToggleBtn) {
        chatbotCloseBtn.addEventListener('click', () => {
            aiChatbot.style.display = 'none';
            chatbotToggleBtn.style.display = 'block';
        });
    }
    
    // Send message
    function sendMessage() {
        const message = chatbotInput ? chatbotInput.value.trim() : '';
        if (!message) return;
        
        // Add user message
        if (chatbotMessages) {
            const userMessage = document.createElement('div');
            userMessage.className = 'chatbot-message user-message';
            userMessage.innerHTML = `<p>${message}</p>`;
            chatbotMessages.appendChild(userMessage);
        }
        
        // Clear input
        if (chatbotInput) chatbotInput.value = '';
        
        // Scroll to bottom
        if (chatbotMessages) {
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        }
        
        // Simulate AI response (in production, this would call an AI API)
        setTimeout(() => {
            const botResponse = generateAIResponse(message);
            if (chatbotMessages) {
                const botMessage = document.createElement('div');
                botMessage.className = 'chatbot-message bot-message';
                botMessage.innerHTML = `<p>${botResponse}</p>`;
                chatbotMessages.appendChild(botMessage);
                chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
            }
        }, 500);
    }
    
    if (chatbotSendBtn) {
        chatbotSendBtn.addEventListener('click', sendMessage);
    }
    
    if (chatbotInput) {
        chatbotInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
}

// Generate AI response (simulated - replace with actual AI API call)
function generateAIResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Simple keyword-based responses (replace with actual AI integration)
    if (message.includes('rotation') || message.includes('next')) {
        const nextManager = document.getElementById('nextManagerDisplay');
        const managerName = nextManager ? nextManager.textContent : 'No manager assigned';
        return `The next deal is assigned to: ${managerName}. Would you like to know more about the rotation queue?`;
    }
    
    if (message.includes('deal') || message.includes('log')) {
        return `To log a deal, go to the "Log Deal" tab and fill in the customer information. The system will automatically assign it to the next manager in rotation.`;
    }
    
    if (message.includes('report') || message.includes('statistics')) {
        return `You can view payment bump reports in the "Reports" tab. Select a month and year to see detailed statistics for each finance manager.`;
    }
    
    if (message.includes('help') || message.includes('how')) {
        return `I can help you with:
- Rotation information
- Deal logging
- Reports and statistics
- General DealOrbit questions

What would you like to know?`;
    }
    
    if (message.includes('hello') || message.includes('hi')) {
        return `Hello! I'm here to help you with DealOrbit. You can ask me about rotation, deals, reports, or anything else related to the system.`;
    }
    
    // Default response
    return `I understand you're asking about "${userMessage}". I can help you with rotation management, deal logging, reports, and general questions about DealOrbit. Could you be more specific?`;
}

// ===== LOGOUT FUNCTIONALITY =====
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Make functions globally available for onclick handlers
window.setPaymentBumpGoal = setPaymentBumpGoal;
window.exportHistoryDate = exportHistoryDate;
window.viewHistoryDate = viewHistoryDate;
window.removeDeal = removeDeal;

// Perform daily reset
function performDailyReset() {
    // Clear deals and dailyDeals
    dealHistory = [];
    dealRows.clear();
    dailyDeals = {};
    lastAssignedManager = null;

    // Remove inactive managers and non-Finance Managers from rotationOrder
    rotationOrder = rotationOrder.filter(name => {
        const manager = managers.find(m => m.name === name);
        if (!manager || !manager.inRotation) return false;
        
        // Check if manager is a Finance Manager
        const associatedUser = users.find(u => 
            u.name.toLowerCase() === manager.name.toLowerCase() || 
            (manager.email && u.email.toLowerCase() === manager.email.toLowerCase())
        );
        
        // Only keep Finance Managers in rotation
        if (associatedUser && associatedUser.role !== 'finance') {
            return false;
        }
        
        return true;
    });

    // Remove inactive managers (but keep all managers in the list, just remove from rotation)
    // Don't filter out managers, just mark them as inactive
    managers.forEach(m => {
        if (!m.inRotation) {
            // Check if they should be removed from rotation due to role change
            const associatedUser = users.find(u => 
                u.name.toLowerCase() === m.name.toLowerCase() || 
                (m.email && u.email.toLowerCase() === m.email.toLowerCase())
            );
            if (associatedUser && associatedUser.role !== 'finance' && m.inRotation) {
                m.inRotation = false;
                const index = rotationOrder.indexOf(m.name);
                if (index !== -1) {
                    rotationOrder.splice(index, 1);
                }
            }
        }
    });

    // Initialize new day
    const today = getTodayKey();
    dailyDeals[today] = {};
    managers.forEach(manager => {
        dailyDeals[today][manager.name] = 0;
    });

    updateDealsTable();
    updateManagersList();
    updateRotationQueue();
    updateNextManagerDisplay();
    updateProducerList();
    saveState();
}

// Make toggleManagerRotation available globally for onclick handlers
window.toggleManagerRotation = toggleManagerRotation;

// Edit manager role (admin only)
function editManagerRole(managerName) {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only administrators can change manager roles.');
        return;
    }
    
    const manager = managers.find(m => m.name === managerName);
    if (!manager) {
        alert('Manager not found.');
        return;
    }
    
    // Find associated user
    const associatedUser = users.find(u => 
        u.name.toLowerCase() === managerName.toLowerCase() || 
        (manager.email && u.email.toLowerCase() === manager.email.toLowerCase())
    );
    
    if (!associatedUser) {
        alert('No user account found for this manager. Please create a user account first in User Management.');
        return;
    }
    
    // Show role selection modal
    const currentRole = associatedUser.role;
    showRoleChangeModal(managerName, associatedUser, currentRole);
}

function showRoleChangeModal(managerName, user, currentRole) {
    const modal = document.createElement('div');
    modal.id = 'roleChangeModal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    
    const roleOptions = [
        { value: 'admin', label: 'Admin', description: 'Full system access, can manage users and all features' },
        { value: 'desk', label: 'Desk Manager', description: 'Can log deals and view rotation' },
        { value: 'finance', label: 'Finance Manager', description: 'Can view rotation and deals, receives notifications' }
    ];
    
    const optionsHtml = roleOptions.map(opt => {
        const isCurrent = opt.value === currentRole;
        return `
            <label style="display: flex; align-items: flex-start; padding: 12px; border: 2px solid ${isCurrent ? '#72CFF4' : '#e5e7eb'}; border-radius: 8px; margin-bottom: 8px; cursor: pointer; background: ${isCurrent ? '#e6f7fd' : '#ffffff'}; transition: all 0.2s;">
                <input type="radio" name="newRole" value="${opt.value}" ${isCurrent ? 'checked' : ''} style="margin-right: 12px; margin-top: 2px;" />
                <div>
                    <div style="font-weight: 600; color: #333334; margin-bottom: 4px;">${opt.label} ${isCurrent ? '(Current)' : ''}</div>
                    <div style="font-size: 13px; color: #6b7280;">${opt.description}</div>
                </div>
            </label>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 100%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            <h2 style="margin-bottom: 8px; color: #333334;">Change Role</h2>
            <p style="color: #6b7280; margin-bottom: 24px;">Select a new role for <strong>${managerName}</strong></p>
            <form id="roleChangeForm">
                ${optionsHtml}
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button type="submit" class="settings-submit" style="flex: 1;">Change Role</button>
                    <button type="button" class="settings-cancel" onclick="closeRoleChangeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    const form = document.getElementById('roleChangeForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedRole = form.querySelector('input[name="newRole"]:checked')?.value;
        
        if (!selectedRole) {
            alert('Please select a role');
            return;
        }
        
        if (selectedRole === currentRole) {
            alert('Role is already set to ' + selectedRole);
            closeRoleChangeModal();
            return;
        }
        
        // Prevent changing your own role
        if (currentUser.id === user.id) {
            alert('You cannot change your own role. Please have another admin do this.');
            closeRoleChangeModal();
            return;
        }
        
        // Update user role
        user.role = selectedRole;
        
        // Update currentUser if it's the same user
        if (currentUser.email.toLowerCase() === user.email.toLowerCase()) {
            currentUser.role = selectedRole;
        }
        
        // If role changed to Admin or Desk Manager, remove from rotation
        const manager = managers.find(m => m.name === managerName);
        if (manager && selectedRole !== 'finance') {
            if (manager.inRotation) {
                manager.inRotation = false;
                const index = rotationOrder.indexOf(managerName);
                if (index !== -1) {
                    rotationOrder.splice(index, 1);
                }
            }
        }
        
        saveState();
        updateManagersList();
        updateRotationQueue();
        updateNextManagerDisplay();
        updateUsersGrid();
        updateProducerList();
        closeRoleChangeModal();
        
        alert(`Role changed successfully! ${managerName} is now a ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}.${selectedRole !== 'finance' ? ' They have been removed from rotation.' : ''}`);
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRoleChangeModal();
        }
    });
}

function closeRoleChangeModal() {
    const modal = document.getElementById('roleChangeModal');
    if (modal) {
        modal.remove();
    }
}

window.closeRoleChangeModal = closeRoleChangeModal;


// ===== USER MANAGEMENT FUNCTIONALITY (ADMIN ONLY) =====
let userManagementHandlersAttached = false;

function setupUserManagement() {
    const addUserBtn = document.getElementById('addUserBtn');
    const userForm = document.getElementById('userForm');
    const userCancelBtn = document.getElementById('userCancelBtn');
    const searchUsersInput = document.getElementById('searchUsersInput');
    const upgradePlanBtn = document.getElementById('upgradePlanBtn');
    
    // Set up Add User button - use event delegation to avoid cloning
    if (addUserBtn && !addUserBtn.dataset.listenerAttached) {
        addUserBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add User button clicked');
            showUserForm();
        });
        addUserBtn.dataset.listenerAttached = 'true';
    }
    
    // Set up Cancel button - use event delegation to avoid cloning
    if (userCancelBtn && !userCancelBtn.dataset.listenerAttached) {
        userCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Cancel button clicked');
            hideUserForm();
        });
        userCancelBtn.dataset.listenerAttached = 'true';
    }
    
    // Set up form submit handler - DON'T clone, just attach handler once
    if (userForm && !userForm.dataset.submitHandlerAttached) {
        // Attach submit handler
        userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('User form submitted via form submit event');
            handleUserFormSubmit(e);
        });
        userForm.dataset.submitHandlerAttached = 'true';
        
        // Also handle submit button click directly
        const submitBtn = userForm.querySelector('#userSubmitBtn');
        if (submitBtn && !submitBtn.dataset.listenerAttached) {
            submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Submit button clicked - calling handleUserFormSubmit');
                handleUserFormSubmit(e);
            });
            submitBtn.dataset.listenerAttached = 'true';
        }
    }
    
    if (searchUsersInput && !searchUsersInput.dataset.listenerAttached) {
        searchUsersInput.addEventListener('input', (e) => {
            filterUsersTable(e.target.value);
        });
        searchUsersInput.dataset.listenerAttached = 'true';
    }
    
    if (upgradePlanBtn && !upgradePlanBtn.dataset.listenerAttached) {
        upgradePlanBtn.addEventListener('click', () => {
            showUpgradePlanModal();
        });
        upgradePlanBtn.dataset.listenerAttached = 'true';
    }
    
    userManagementHandlersAttached = true;
}

function showUserForm(userId = null) {
    const formContainer = document.getElementById('userFormContainer');
    const formTitle = document.getElementById('userFormTitle');
    const submitBtn = document.getElementById('userSubmitBtn');
    const passwordLabel = document.getElementById('passwordLabel');
    const passwordInput = document.getElementById('userPassword');
    const editingUserId = document.getElementById('editingUserId');
    
    if (!formContainer) {
        console.error('User form container not found');
        return;
    }
    
    console.log('Showing user form'); // Debug log
    formContainer.style.display = 'block';
    
    if (userId) {
        // Editing existing user
        const user = users.find(u => u.id === userId);
        if (!user) return;
        
        formTitle.textContent = 'Edit User';
        submitBtn.textContent = 'Update User';
        editingUserId.value = userId;
        
        document.getElementById('userName').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userUsername').value = user.username || '';
        document.getElementById('userCompany').value = user.company;
        document.getElementById('userPhone').value = user.phone || '';
        document.getElementById('userRole').value = user.role;
        
        // Show password fields for editing
        if (passwordLabel) {
            passwordLabel.style.display = 'block';
            passwordLabel.innerHTML = 'Password (leave blank to keep current)';
        }
        const passwordConfirmLabel = document.getElementById('passwordConfirmLabel');
        if (passwordConfirmLabel) {
            passwordConfirmLabel.style.display = 'block';
        }
        const passwordInfo = document.getElementById('passwordInfo');
        if (passwordInfo) {
            passwordInfo.style.display = 'none';
        }
        
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.required = false;
            passwordInput.placeholder = 'Leave blank to keep current';
        }
        const passwordConfirm = document.getElementById('userPasswordConfirm');
        if (passwordConfirm) {
            passwordConfirm.value = '';
            passwordConfirm.required = false;
        }
        
        // Disable email editing (email is used as unique identifier)
        document.getElementById('userEmail').disabled = true;
        
        // Allow username to be set if empty, but disable if already set
        const usernameField = document.getElementById('userUsername');
        if (user.username) {
            usernameField.disabled = true;
        } else {
            usernameField.disabled = false;
            usernameField.required = true;
        }
    } else {
        // Adding new user
        formTitle.textContent = 'Add New User';
        submitBtn.textContent = 'Add User';
        editingUserId.value = '';
        
        // Reset form first
        const form = document.getElementById('userForm');
        if (form) {
            form.reset();
        }
        
        // Re-get elements after reset to ensure we have current references
        const currentPasswordInput = document.getElementById('userPassword');
        const currentPasswordLabel = document.getElementById('passwordLabel');
        const currentPasswordConfirm = document.getElementById('userPasswordConfirm');
        const currentEmail = document.getElementById('userEmail');
        const currentUsername = document.getElementById('userUsername');
        
        // Set up for new user - hide password fields
        if (currentPasswordLabel) {
            currentPasswordLabel.style.display = 'none';
        }
        const passwordConfirmLabel = document.getElementById('passwordConfirmLabel');
        if (passwordConfirmLabel) {
            passwordConfirmLabel.style.display = 'none';
        }
        const passwordInfo = document.getElementById('passwordInfo');
        if (passwordInfo) {
            passwordInfo.style.display = 'block';
        }
        if (currentPasswordInput) {
            currentPasswordInput.required = false;
            currentPasswordInput.value = '';
        }
        if (currentPasswordConfirm) {
            currentPasswordConfirm.required = false;
            currentPasswordConfirm.value = '';
        }
        if (currentEmail) {
            currentEmail.disabled = false;
            currentEmail.required = true;
        }
        if (currentUsername) {
            currentUsername.disabled = false;
            currentUsername.required = true;
        }
        
        // Auto-populate company with admin's company
        const companyField = document.getElementById('userCompany');
        if (companyField && currentUser && currentUser.company) {
            companyField.value = currentUser.company;
        }
    }
    
    // Scroll to form
    formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideUserForm() {
    const formContainer = document.getElementById('userFormContainer');
    const errorMsg = document.getElementById('userFormError');
    
    if (formContainer) {
        formContainer.style.display = 'none';
        const form = document.getElementById('userForm');
        if (form) {
            form.reset();
            // Re-enable fields that might have been disabled
            const emailField = document.getElementById('userEmail');
            const usernameField = document.getElementById('userUsername');
            const passwordInput = document.getElementById('userPassword');
            const passwordLabel = document.getElementById('passwordLabel');
            const passwordConfirm = document.getElementById('userPasswordConfirm');
            
            if (emailField) {
                emailField.disabled = false;
                emailField.required = true;
            }
            if (usernameField) {
                usernameField.disabled = false;
                usernameField.required = true;
            }
            if (passwordInput) {
                passwordInput.required = false;
                passwordInput.value = '';
            }
            if (passwordLabel) {
                passwordLabel.style.display = 'none';
                passwordLabel.innerHTML = 'Password (leave blank to keep current)';
            }
            if (passwordConfirm) {
                passwordConfirm.required = false;
                passwordConfirm.value = '';
            }
            const passwordConfirmLabel = document.getElementById('passwordConfirmLabel');
            if (passwordConfirmLabel) {
                passwordConfirmLabel.style.display = 'none';
            }
            const passwordInfo = document.getElementById('passwordInfo');
            if (passwordInfo) {
                passwordInfo.style.display = 'block';
            }
        }
        const editingUserIdEl = document.getElementById('editingUserId');
        if (editingUserIdEl) {
            editingUserIdEl.value = '';
        }
    }
    
    if (errorMsg) {
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
    }
}

function handleUserFormSubmit(e) {
    // Prevent default if event object is provided
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only administrators can manage users.');
        return;
    }
    
    // Get form elements - always get fresh references from DOM
    const editingUserIdEl = document.getElementById('editingUserId');
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const usernameEl = document.getElementById('userUsername');
    const companyEl = document.getElementById('userCompany');
    const phoneEl = document.getElementById('userPhone');
    const roleEl = document.getElementById('userRole');
    const passwordEl = document.getElementById('userPassword');
    const passwordConfirmEl = document.getElementById('userPasswordConfirm');
    const errorMsg = document.getElementById('userFormError');
    
    if (!nameEl || !emailEl || !companyEl || !roleEl) {
        console.error('Required form elements not found:', { nameEl, emailEl, companyEl, roleEl });
        if (errorMsg) {
            errorMsg.textContent = 'Form error: Please refresh the page and try again.';
            errorMsg.style.display = 'block';
        }
        return;
    }
    
    // Read values directly from elements
    const editingUserId = editingUserIdEl ? editingUserIdEl.value : '';
    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const username = usernameEl ? usernameEl.value.trim() : '';
    const company = companyEl.value.trim();
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const role = roleEl.value;
    
    // Read password values - only needed when editing existing users
    // For new users, password will be set on first login
    const currentPasswordEl = document.getElementById('userPassword');
    const currentPasswordConfirmEl = document.getElementById('userPasswordConfirm');
    
    let password = '';
    let passwordConfirm = '';
    
    // Only read password if we're editing an existing user
    if (editingUserIdEl && editingUserIdEl.value) {
        if (currentPasswordEl) {
            password = currentPasswordEl.value || '';
        }
        if (currentPasswordConfirmEl) {
            passwordConfirm = currentPasswordConfirmEl.value || '';
        }
    }
    
    console.log('Form values:', { 
        editingUserId, 
        name, 
        email, 
        username, 
        company, 
        phone, 
        role, 
        passwordLength: password ? password.length : 0,
        passwordValue: password ? '***' : 'empty',
        hasPassword: !!password,
        passwordElExists: !!passwordEl,
        passwordElType: passwordEl ? passwordEl.type : 'none'
    });
    
    // Validation
    if (!name || !email || !company || !role) {
        if (errorMsg) {
            errorMsg.textContent = 'Please fill in all required fields';
            errorMsg.style.display = 'block';
        }
        return;
    }
    
    // Username validation - required for new users, optional for existing users if already set
    if (!editingUserId) {
        // New user - username is required
        if (!username) {
            if (errorMsg) {
                errorMsg.textContent = 'Username is required for new users';
                errorMsg.style.display = 'block';
            }
            return;
        }
    } else {
        // Editing user - check if username needs to be set
        const user = users.find(u => u.id === editingUserId);
        if (user && !user.username && !username) {
            if (errorMsg) {
                errorMsg.textContent = 'Username is required. Please set a username for this user.';
                errorMsg.style.display = 'block';
            }
            return;
        }
    }
    
    // Validate username format (alphanumeric and underscores only) if provided
    if (username) {
        const usernamePattern = /^[a-zA-Z0-9_]+$/;
        if (!usernamePattern.test(username)) {
            if (errorMsg) {
                errorMsg.textContent = 'Username can only contain letters, numbers, and underscores';
                errorMsg.style.display = 'block';
            }
            return;
        }
    }
    
    if (!editingUserId) {
        // New user - password is NOT required (will be set on first login)
        // Skip password validation for new users
        password = '';
        passwordConfirm = '';
    } else {
        // Editing user - password is optional but must match if provided
        if (password) {
            if (password.length < 8) {
                if (errorMsg) {
                    errorMsg.textContent = 'Password must be at least 8 characters';
                    errorMsg.style.display = 'block';
                }
                return;
            }
            
            if (password !== passwordConfirm) {
                if (errorMsg) {
                    errorMsg.textContent = 'Passwords do not match';
                    errorMsg.style.display = 'block';
                }
                return;
            }
        }
    }
    
    if (editingUserId) {
        // Editing existing user
        const user = users.find(u => u.id === editingUserId);
        if (!user) {
            if (errorMsg) {
                errorMsg.textContent = 'User not found';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Check if email is being changed and if new email already exists
        if (email.toLowerCase() !== user.email.toLowerCase()) {
            const emailExists = users.find(u => u.id !== editingUserId && u.email.toLowerCase() === email.toLowerCase());
            if (emailExists) {
                if (errorMsg) {
                    errorMsg.textContent = 'An account with this email already exists';
                    errorMsg.style.display = 'block';
                }
                return;
            }
        }
        
        // Handle username - use existing if field is disabled, otherwise use new value
        const usernameField = document.getElementById('userUsername');
        const finalUsername = usernameField && usernameField.disabled ? user.username : username;
        
        // Check if username is being set/changed
        const currentUsername = (user.username || '').toLowerCase();
        const newUsername = (finalUsername || '').toLowerCase();
        
        // If username is being changed (and user already has one), don't allow it
        if (currentUsername && newUsername !== currentUsername) {
            if (errorMsg) {
                errorMsg.textContent = 'Username cannot be changed once set. Please contact support if you need to change it.';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // If setting a new username, check if it already exists
        if (newUsername && newUsername !== currentUsername) {
            const usernameExists = users.find(u => u.id !== editingUserId && u.username && u.username.toLowerCase() === newUsername);
            if (usernameExists) {
                if (errorMsg) {
                    errorMsg.textContent = 'An account with this username already exists';
                    errorMsg.style.display = 'block';
                }
                return;
            }
        }
        
        // Update user
        user.name = name;
        user.email = email;
        user.username = finalUsername || user.username; // Keep existing if not provided
        user.company = company;
        user.phone = phone;
        user.role = role;
        
        // Update password if provided
        if (password) {
            user.passwordHash = hashPassword(password);
        }
        
        // Update currentUser if editing self
        if (currentUser.id === editingUserId) {
            currentUser.name = name;
            currentUser.email = email;
            currentUser.username = username;
            currentUser.company = company;
            currentUser.role = role;
            // Update dealership name in header if company changed
            updateDealershipName();
        }
        
        saveState();
        updateUsersGrid();
        updatePlanInfo();
        hideUserForm();
        
        alert('User updated successfully!');
    } else {
        // Adding new user
        // Check user limit
        if (users.length >= purchasePlan.maxUsers) {
            if (errorMsg) {
                errorMsg.textContent = `User limit reached (${purchasePlan.maxUsers} users). Please upgrade your plan to add more users.`;
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Check if email already exists
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            if (errorMsg) {
                errorMsg.textContent = 'An account with this email already exists';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Check if username already exists
        if (users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
            if (errorMsg) {
                errorMsg.textContent = 'An account with this username already exists';
                errorMsg.style.display = 'block';
            }
            return;
        }
        
        // Create new user - password will be set on first login
        const newUser = {
            id: 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name,
            email,
            username,
            company,
            phone,
            role,
            passwordHash: null, // Password will be set on first login
            needsPasswordSetup: true, // Flag to indicate user needs to set password
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        purchasePlan.currentUsers = users.length;
        
        // If new user is Admin or Desk Manager, ensure they're not in rotation
        if (role !== 'finance') {
            const manager = managers.find(m => 
                m.name.toLowerCase() === name.toLowerCase() || 
                (newUser.email && m.email && m.email.toLowerCase() === newUser.email.toLowerCase())
            );
            if (manager && manager.inRotation) {
                manager.inRotation = false;
                const index = rotationOrder.indexOf(manager.name);
                if (index !== -1) {
                    rotationOrder.splice(index, 1);
                }
            }
        }
        
        saveState();
        updateUsersGrid();
        updatePlanInfo();
        updateManagersList();
        updateRotationQueue();
        updateNextManagerDisplay();
        hideUserForm();
        
        alert('User added successfully!');
        return true;
    }
    return false;
}

function updateUsersGrid() {
    const grid = document.getElementById('usersGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (users.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b7280;">No users found</div>';
        return;
    }
    
    // Sort users by creation date (newest first)
    const sortedUsers = [...users].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    sortedUsers.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.style.cssText = 'background: #ffffff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; transition: all 0.2s;';
        
        const roleBadge = getRoleBadge(user.role);
        const formattedDate = new Date(user.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        
        const canDelete = currentUser && currentUser.id !== user.id;
        const deleteButton = canDelete 
            ? `<button class="remove-deal-btn" onclick="deleteUser('${user.id}')" style="font-size: 12px; padding: 6px 12px; margin-top: 8px;" title="Delete user">Delete</button>`
            : '<span style="color: #9ca3af; font-size: 12px; margin-top: 8px; display: block;">Current User</span>';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 8px 0; color: #333334; font-size: 18px; font-weight: 600;">${user.name}</h4>
                    <div style="margin-bottom: 8px;">${roleBadge}</div>
                </div>
                <button class="edit-producer-btn" onclick="editUser('${user.id}')" style="font-size: 12px; padding: 6px 12px;">Edit</button>
            </div>
            <div style="color: #6b7280; font-size: 13px; margin-bottom: 12px;">
                <div style="margin-bottom: 4px;"><strong style="color: #72CFF4;">@${user.username || 'no-username'}</strong></div>
                <div style="margin-bottom: 4px;">📧 ${user.email}</div>
                ${user.phone ? `<div style="margin-bottom: 4px;">📞 ${user.phone}</div>` : ''}
                <div style="margin-bottom: 4px;">🏢 ${user.company}</div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">Created: ${formattedDate}</div>
            </div>
            ${deleteButton}
        `;
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#72CFF4';
            card.style.boxShadow = '0 4px 12px rgba(114, 207, 244, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e5e7eb';
            card.style.boxShadow = 'none';
        });
        
        grid.appendChild(card);
    });
}

// Keep updateUsersTable for backward compatibility
function updateUsersTable() {
    updateUsersGrid();
}

function getRoleBadge(role) {
    const badges = {
        'admin': '<span style="background: #dc2626; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">ADMIN</span>',
        'desk': '<span style="background: #72CFF4; color: #333334; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">DESK</span>',
        'finance': '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">FINANCE</span>'
    };
    return badges[role] || role;
}

function editUser(userId) {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only administrators can edit users.');
        return;
    }
    
    showUserForm(userId);
}

function deleteUser(userId) {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Only administrators can delete users.');
        return;
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        alert('User not found.');
        return;
    }
    
    // Prevent deleting yourself
    if (currentUser.id === userId) {
        alert('You cannot delete your own account.');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${user.name} (${user.email})? This action cannot be undone.`)) {
        return;
    }
    
    // Remove user
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
        users.splice(index, 1);
        purchasePlan.currentUsers = users.length;
        saveState();
        updateUsersGrid();
        updatePlanInfo();
        alert('User deleted successfully.');
    }
}

function filterUsersTable(searchTerm) {
    const cards = document.querySelectorAll('.user-card');
    const term = searchTerm.toLowerCase();
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(term) ? '' : 'none';
    });
}

function updatePlanInfo() {
    const currentPlanName = document.getElementById('currentPlanName');
    const currentUserCount = document.getElementById('currentUserCount');
    const maxUsers = document.getElementById('maxUsers');
    
    if (currentPlanName) {
        const planNames = {
            'standard': 'Standard',
            'professional': 'Professional',
            'enterprise': 'Enterprise'
        };
        currentPlanName.textContent = planNames[purchasePlan.planType] || 'Standard';
    }
    
    if (currentUserCount) {
        currentUserCount.textContent = users.length;
    }
    
    if (maxUsers) {
        maxUsers.textContent = purchasePlan.maxUsers;
    }
    
    // Update plan info styling if at limit
    const planInfo = document.getElementById('planInfo');
    if (planInfo) {
        if (users.length >= purchasePlan.maxUsers) {
            planInfo.style.background = '#fef3c7';
            planInfo.style.borderColor = '#f59e0b';
        } else {
            planInfo.style.background = '#e6f7fd';
            planInfo.style.borderColor = '#72CFF4';
        }
    }
}

function showUpgradePlanModal() {
    const plans = [
        { type: 'standard', name: 'Standard', maxUsers: 10, price: '$99/month' },
        { type: 'professional', name: 'Professional', maxUsers: 25, price: '$199/month' },
        { type: 'enterprise', name: 'Enterprise', maxUsers: 100, price: '$399/month' }
    ];
    
    let planOptions = plans.map(plan => {
        const isCurrent = plan.type === purchasePlan.planType;
        const isUpgrade = getPlanLevel(plan.type) > getPlanLevel(purchasePlan.planType);
        return `
            <div style="padding: 16px; border: 2px solid ${isCurrent ? '#72CFF4' : '#e5e7eb'}; border-radius: 8px; margin-bottom: 12px; background: ${isCurrent ? '#e6f7fd' : '#ffffff'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="font-size: 18px; color: #333334;">${plan.name}</strong>
                        <div style="color: #6b7280; margin-top: 4px;">Up to ${plan.maxUsers} users</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 700; color: #72CFF4;">${plan.price}</div>
                        ${isCurrent ? '<div style="color: #10b981; font-size: 12px; margin-top: 4px;">Current Plan</div>' : ''}
                    </div>
                </div>
                ${isUpgrade ? `<button onclick="upgradeToPlan('${plan.type}')" class="primary-btn" style="width: 100%; margin-top: 12px;">Upgrade to ${plan.name}</button>` : ''}
            </div>
        `;
    }).join('');
    
    const modalContent = `
        <div style="max-width: 500px;">
            <h2 style="margin-bottom: 20px; color: #333334;">Upgrade Your Plan</h2>
            <p style="color: #6b7280; margin-bottom: 24px;">Choose a plan that fits your team size. All plans include full access to DealOrbit features.</p>
            ${planOptions}
            <button onclick="closeUpgradeModal()" class="secondary-btn" style="width: 100%; margin-top: 16px;">Close</button>
        </div>
    `;
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'upgradePlanModal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            ${modalContent}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeUpgradeModal();
        }
    });
}

function closeUpgradeModal() {
    const modal = document.getElementById('upgradePlanModal');
    if (modal) {
        modal.remove();
    }
}

function getPlanLevel(planType) {
    const levels = { 'standard': 1, 'professional': 2, 'enterprise': 3 };
    return levels[planType] || 1;
}

function upgradeToPlan(planType) {
    const plans = {
        'standard': { maxUsers: 10 },
        'professional': { maxUsers: 25 },
        'enterprise': { maxUsers: 100 }
    };
    
    const plan = plans[planType];
    if (!plan) return;
    
    purchasePlan.planType = planType;
    purchasePlan.maxUsers = plan.maxUsers;
    
    saveState();
    updatePlanInfo();
    closeUpgradeModal();
    
    alert(`Plan upgraded to ${planType.charAt(0).toUpperCase() + planType.slice(1)}! You can now add up to ${plan.maxUsers} users.`);
}

// Make functions globally available for onclick handlers
window.editUser = editUser;
window.deleteUser = deleteUser;
window.upgradeToPlan = upgradeToPlan;
window.closeUpgradeModal = closeUpgradeModal;
window.editManagerRole = editManagerRole;

