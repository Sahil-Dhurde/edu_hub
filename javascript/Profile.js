// ============================================
// EduEx — Profile Page (API-Connected)
// ============================================

let currentPopupUserId = null;

document.addEventListener("DOMContentLoaded", function () {
    loadAllUsers();
});

// Load all users from backend
async function loadAllUsers() {
    try {
        const users = await getAllUsers();
        renderUsers(users);
    } catch (err) {
        console.error('Failed to load users:', err);
        showUsersError();
    }
}

// Search users by query
async function searchUsers() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        loadAllUsers();
        return;
    }

    try {
        const users = await getUsersBySearch(query);
        renderUsers(users);
    } catch (err) {
        console.error('Search failed:', err);
        showUsersError();
    }
}

// Filter by skill category
async function filterByCategory(category) {
    // Update active nav link
    document.querySelectorAll('.navbar a').forEach(a => a.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    try {
        const users = await getUsersBySkill(category);
        renderUsers(users);
    } catch (err) {
        console.error('Filter failed:', err);
        showUsersError();
    }
}

// Render users into the grid
function renderUsers(users) {
    const grid = document.getElementById('usersGrid');

    if (!users || users.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; width: 100%; grid-column: 1 / -1; padding: 50px; color: var(--text-secondary);">
                <i class="fa-solid fa-users-slash fa-2x" style="margin-bottom: 15px; display: block;"></i>
                <p>No users found. Try a different search or category.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = users.map(user => {
        const avatarUrl = user.avatar && user.avatar !== 'assets/SSD.jpg'
            ? user.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=120`;

        const skills = user.skills ? user.skills.split(',').slice(0, 3).map(s => s.trim()).join(', ') : 'No skills listed';

        return `
            <div class="course" onclick='openProfilePopup(${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                <img src="${avatarUrl}" alt="${user.name}" class="user-avatar"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=120'">
                <h3 class="user-name">${user.name}</h3>
                <p class="user-skill">${skills}</p>
                <button class="course-btn">View Profile</button>
            </div>
        `;
    }).join('');
}

function showUsersError() {
    const grid = document.getElementById('usersGrid');
    grid.innerHTML = `
        <div style="text-align: center; width: 100%; grid-column: 1 / -1; padding: 50px; color: #ff4757;">
            <i class="fa-solid fa-triangle-exclamation fa-2x" style="margin-bottom: 15px; display: block;"></i>
            <p>Failed to load users. Please try again.</p>
        </div>
    `;
}

// Open profile popup with user data
function openProfilePopup(user) {
    currentPopupUserId = user.id;
    const popup = document.getElementById('popup');
    const avatarUrl = user.avatar && user.avatar !== 'assets/SSD.jpg'
        ? user.avatar
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=120`;

    document.getElementById('popup-avatar').src = avatarUrl;
    document.getElementById('popup-name').textContent = user.name;
    document.getElementById('popup-skill').textContent = user.skills || 'No skills listed';
    document.getElementById('popup-bio').textContent = user.bio || 'No bio available';

    const githubLink = document.getElementById('popup-github');
    const linkedinLink = document.getElementById('popup-linkedin');
    githubLink.href = user.github || '#';
    linkedinLink.href = user.linkedin || '#';

    // Reset request state
    const sendBtn = document.getElementById('send-request-btn');
    const sentMsg = document.getElementById('request-sent-msg');
    const formArea = document.getElementById('request-form-area');

    sendBtn.style.display = 'block';
    sentMsg.style.display = 'none';

    // Show skill request form only if logged in
    if (isLoggedIn()) {
        formArea.style.display = 'block';
        document.getElementById('skillWanted').value = '';
        document.getElementById('skillOffered').value = '';
    } else {
        formArea.style.display = 'none';
    }

    popup.style.display = 'flex';
}

function closeProfilePopup() {
    document.getElementById('popup').style.display = 'none';
    currentPopupUserId = null;
}

// Close popup when clicking outside
window.addEventListener('click', function(e) {
    const popup = document.getElementById('popup');
    if (e.target === popup) {
        closeProfilePopup();
    }
});

// Submit skill swap request
async function submitSkillRequest() {
    if (!isLoggedIn()) {
        showToast('Please log in to send skill swap requests', 'error');
        return;
    }

    if (!currentPopupUserId) return;

    const skillWanted = document.getElementById('skillWanted').value.trim();
    const skillOffered = document.getElementById('skillOffered').value.trim();

    if (!skillWanted || !skillOffered) {
        showToast('Please fill in both skill fields', 'error');
        return;
    }

    const sendBtn = document.getElementById('send-request-btn');
    const sentMsg = document.getElementById('request-sent-msg');

    try {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';

        await sendSkillRequest(currentPopupUserId, skillOffered, skillWanted);

        sendBtn.style.display = 'none';
        sentMsg.style.display = 'block';
        showToast('Skill swap request sent!', 'success');
    } catch (err) {
        showToast('Failed to send request: ' + err.message, 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = 'Send Skill Swap Request';
    }
}
