document.addEventListener('DOMContentLoaded', () => {

    /* ===== GLOBAL VARIABLES ===== */
    let currentUser = null;
    let replyTo = null;
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');
    const loginProfile = document.getElementById('login-profile');
    const topPfp = document.getElementById('top-pfp');
    const statusIndicator = document.getElementById('status-indicator');
    const welcomeText = document.getElementById('welcome-text');
    const loadingScreen = document.getElementById('loading-screen');
    const usernameChangeCooldown = 300000; // 5 minutes
    let lastUsernameChange = 0;
    const galleryImgs = document.querySelectorAll('#gallery-container .gallery-img');

    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        document.body.classList.add('mobile-user');
    }



    /* ===== CHAT HISTORY PERSISTENCE ===== */
    let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');

    /* ===== GUEST NAME ===== */
    let guestName = sessionStorage.getItem('guestName');
    if(!guestName){
        guestName = `Guest${Math.floor(Math.random() * 9000) + 1000}`;
        sessionStorage.setItem('guestName', guestName);
    }

    /* ===== APP KEY ===== */
    function getAppKey(){ return 'cRunchyV3rsE2025!'; }
    const APP_KEY = getAppKey();

    /* ===== HELPER FUNCTIONS ===== */
    async function hashPassword(password, salt){
        const enc = new TextEncoder();
        const data = enc.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    function encrypt(text){
        let out=''; 
        for(let i=0;i<text.length;i++) out += String.fromCharCode(text.charCodeAt(i) ^ APP_KEY.charCodeAt(i%APP_KEY.length));
        return btoa(out);
    }
    function decrypt(encText){
        let text = atob(encText), out=''; 
        for(let i=0;i<text.length;i++) out += String.fromCharCode(text.charCodeAt(i) ^ APP_KEY.charCodeAt(i%APP_KEY.length));
        return out;
    }

    // Load your data from localStorage at the top of the script
    let data = JSON.parse(localStorage.getItem("accountData")) || {
        username: "Guest",
        bio: "",
        friends: []
    };

    // Then later when rendering friends:
    if (data.friends && Array.isArray(data.friends)) {
        data.friends.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                switchToPage('account');   // Go to account page
                loadOtherProfile(f);       // Show their profile
            });
            friendsUl.appendChild(li);
        });
    }


    function showLoading(nextPage){
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';

        // Minimum display time
        setTimeout(()=>{ 
            // Fade out
            loadingScreen.style.opacity = '0';
        
            // Remove from DOM after fade
            setTimeout(()=>{
                loadingScreen.style.display='none';
                if(nextPage) switchToPage(nextPage);
            }, 800); // matches CSS transition duration

        }, 2000); // 2 seconds minimum
    }

    /* ===== PAGE SWITCH ===== */
    function switchToPage(pageId){
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-'+pageId);
        if(target) target.classList.add('active');
        welcomeText.textContent = pageId.toUpperCase();
        if(pageId==='account') loadAccountPage();
    }
    navItems.forEach(nav=>nav.addEventListener('click',()=>showLoading(nav.dataset.page)));

    /* ===== LOGIN/SIGNUP ===== */
    const loginUsername = document.getElementById('username');
    const loginPassword = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');

    function updateLoginDisplay(){
        if(currentUser){
            const inputs = loginProfile.querySelectorAll('input, button');
            inputs.forEach(el=>{ if(el.id!=='top-pfp') el.style.display='none'; });
            topPfp.style.display='inline-block';
            statusIndicator.style.display='inline-block';
        } else {
            const inputs = loginProfile.querySelectorAll('input, button');
            inputs.forEach(el=>el.style.display='inline-block');
            topPfp.style.display='none';
            statusIndicator.style.display='none';
        }
        updateChatUI();
    }

    function loadUserProfile(){
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const data = users[currentUser];
        if(!data) return;
        statusIndicator.className = `status-${data.status||'offline'}`;
    }

    loginBtn.addEventListener('click', async ()=>{
        const uname = loginUsername.value.trim();
        const pass = loginPassword.value;
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        if(users[uname]){
            const decryptedHash = decrypt(users[uname].password);
            const salt = users[uname].salt;
            const hash = await hashPassword(pass, salt);
            if(hash === decryptedHash){
                currentUser = uname;
                loginUsername.value=''; loginPassword.value='';
                loadUserProfile(); updateLoginDisplay(); showLoading('home');
                return;
            }
        }
        alert('Invalid username or password');
    });

    signupBtn.addEventListener('click', async ()=>{
        const uname = loginUsername.value.trim();
        const pass = loginPassword.value;
        if(!uname||!pass) return alert('Enter username and password');
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        if(users[uname]) return alert('Username exists');
        const salt = Math.random().toString(36).slice(2,10);
        const hash = await hashPassword(pass, salt);
        users[uname] = {password:encrypt(hash), salt: salt, bio:'', pfp:'', status:'offline', friends:[]};
        localStorage.setItem('users', JSON.stringify(users));
        alert('Account created! You can log in now.');
        loginUsername.value=''; loginPassword.value='';
    });

    /* ===== ACCOUNT PAGE ===== */
    const accountUsername = document.getElementById('account-username');
    const accountBio = document.getElementById('account-bio');
    const accountPfpUpload = document.getElementById('account-pfp-upload');
    const accountStatus = document.getElementById('account-status');
    const changeUsernameBtn = document.getElementById('change-username');
    const changePasswordBtn = document.getElementById('change-password');
    const saveAccountBtn = document.getElementById('save-account');
    const signOutBtn = document.getElementById('sign-out');
    const friendsUl = document.getElementById('friends-ul');
    const addFriendBtn = document.getElementById('add-friend-btn');

    topPfp.addEventListener('click', () => viewProfile(currentUser));

    function loadAccountPage(){
        if(!currentUser) return;
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const data = users[currentUser];
        accountUsername.textContent=currentUser;
        accountBio.value=data.bio;
        accountStatus.value=data.status||'offline';
        loadFriends();
    }

    saveAccountBtn.addEventListener('click',()=>{
        if(!currentUser) return;
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const data = users[currentUser];
        data.bio = accountBio.value.trim().slice(0,100);
        data.status = accountStatus.value;
        if(accountPfpUpload.files[0]){
            const reader = new FileReader();
            reader.onload = ()=>{
                data.pfp = reader.result; 
                users[currentUser]=data; 
                localStorage.setItem('users', JSON.stringify(users)); 
                loadUserProfile(); 
                switchToPage('account'); 
            }
            reader.readAsDataURL(accountPfpUpload.files[0]);
        } else {
            users[currentUser]=data;
            localStorage.setItem('users', JSON.stringify(users));
            loadUserProfile();
            switchToPage('account');
        }
    });

    changeUsernameBtn.addEventListener('click',()=>{
        if(!currentUser) return;
        const now = Date.now();
        if(now - lastUsernameChange < usernameChangeCooldown) return alert('Wait before changing username again');
        const newName = prompt('New username:').trim();
        if(!newName) return;
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        if(users[newName]) return alert('Username exists');
        users[newName] = users[currentUser];
        delete users[currentUser];
        currentUser = newName;
        localStorage.setItem('users', JSON.stringify(users));
        lastUsernameChange = now;
        alert('Username updated!');
        loadAccountPage(); loadUserProfile(); updateLoginDisplay();
    });

    changePasswordBtn.addEventListener('click', async ()=>{
        if(!currentUser) return;
        const newPass = prompt('New password:');
        if(!newPass) return;
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const salt = Math.random().toString(36).slice(2,10);
        const hash = await hashPassword(newPass, salt);
        users[currentUser].password = encrypt(hash);
        users[currentUser].salt = salt;
        localStorage.setItem('users', JSON.stringify(users));
        alert('Password updated!');
    });

    signOutBtn.addEventListener('click',()=>{
        currentUser=null;
        updateLoginDisplay();
        showLoading('home');
    });

    /* ===== FRIENDS SYSTEM ===== */
    function loadFriends(){
        friendsUl.innerHTML='';
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const data = users[currentUser];
        data.friends.forEach(f=>{
            const li=document.createElement('li');
            li.textContent=f;
            friendsUl.appendChild(li);
        });
    }

    function loadOtherProfile(username) {
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const data = users[username];
        if(!data) return alert('User not found');

        // Hide your own account section
        document.getElementById('account-username').parentElement.style.display = 'none';
        document.getElementById('save-account').style.display = 'none';
        document.getElementById('change-username').style.display = 'none';
        document.getElementById('change-password').style.display = 'none';
        document.getElementById('account-pfp-upload').style.display = 'none';
        document.getElementById('account-bio').style.display = 'none';
        document.getElementById('account-status').style.display = 'none';

        // Show the view profile container
        const container = document.getElementById('view-profile-container');
        container.style.display = 'block';
        document.getElementById('view-username').textContent = data.username || username;
        document.getElementById('view-bio').textContent = data.bio || '';
        document.getElementById('view-pfp').src = data.pfp || 'pfp-placeholder.png';
        document.getElementById('view-status').textContent = data.status || 'offline';
    }

    if (data.friends && Array.isArray(data.friends)) {
        data.friends.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f;
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                viewProfile(f);
            });

            friendsUl.appendChild(li);
        });
    }

    function viewProfile(username) {
        switchToPage("account");

        if (username === currentUser) {
            // show self account settings
            document.getElementById("account-settings-container").style.display = "block";
            document.getElementById("view-profile-container").style.display = "none";
            document.getElementById("account-username").textContent = currentUser;
        } else {
            // show other user’s profile
            document.getElementById("account-settings-container").style.display = "none";
            document.getElementById("view-profile-container").style.display = "block";

            document.getElementById("view-username").textContent = username;
            document.getElementById("view-bio").textContent = users[username]?.bio || "No bio yet";
            document.getElementById("view-status").textContent = users[username]?.status || "offline";

            // ✅ add-friend button logic
            const addBtn = document.getElementById("add-friend-view");
            addBtn.onclick = () => {
                if (!friends[currentUser]) friends[currentUser] = [];
                if (!friends[currentUser].includes(username)) {
                    friends[currentUser].push(username);
                    alert(username + " added as friend!");
                    renderFriendsList();
                } else {
                    alert(username + " is already your friend.");
                }
            };
        }
    }

    const friendCooldown = 60000;
    let lastFriendRequestTime = 0;
    function canSendFriendRequest(){
        const now = Date.now();
        if(now - lastFriendRequestTime < friendCooldown){
            alert(`Wait ${Math.ceil((friendCooldown - (now - lastFriendRequestTime))/1000)}s`);
            return false;
        }
        lastFriendRequestTime = now;
        return true;
    }
    addFriendBtn.addEventListener('click', () => {
        if(!currentUser) return;
        if(!canSendFriendRequest()) return;

        const friendName = document.getElementById('add-friend-input').value.trim();
        if(!friendName) return alert('Enter a username');
    
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        if(!users[friendName]) return alert('User not found');
    
        const data = users[currentUser];
        if(data.friends.includes(friendName)) return alert('Already friends');
        if(friendName === currentUser) return alert('You cannot add yourself');
    
        data.friends.push(friendName);
        localStorage.setItem('users', JSON.stringify(users));
        loadFriends();
        alert('Friend added!');
    });

    /* ===== CHAT SYSTEM ===== */
    const chatWrapper = document.getElementById('chat-wrapper');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const guestDropdown = document.getElementById('guestPremessages');

    const guestMessages = ['haii', 'yo', 'wsp?', 'lol', 'LMAO', 'wth', 'bruh', ':3', 'no', 'yes'];
    const bannedWords = ['nigger','nigga','fucker','fuck','fuk','shit','s.h.i.t','bitch','b1tch','ass','piss','cunt','hoe','ho3','slut','whore',
    'g4y','gay','dyke','faggot','fag','c0ck','d1ck','penis','vagina','boob','t1ts','pussy','n1gger','n1gga','sh1t','b!tch']; 
    let lastChatMsg = '';
    let lastPasteTime = 0;

    function updateChatUI(){
        if(currentUser){
            chatInput.style.display = 'inline-block';
            chatSend.style.display = 'inline-block';
            guestDropdown.style.display = 'none';
        } else {
            chatInput.style.display = 'none';
            chatSend.style.display = 'none';
            guestDropdown.style.display = 'inline-block';
        }
    }
    updateChatUI();

    function filterMessage(msg){
        // Normalize leetspeak numbers to letters
        msg = msg.toLowerCase()
                 .replace(/4/g,'a')
                 .replace(/3/g,'e')
                 .replace(/1/g,'i')
                 .replace(/0/g,'o')
                 .replace(/5/g,'s')
                 .replace(/7/g,'t');

        let filtered = msg;
        const bannedWords = [
            'nigger','nigga','fucker','fuck','fuk','shit','bitch','b1tch','ass','piss','cunt','hoe','ho3','slut','whore',
            'g4y','gay','dyke','faggot','fag','c0ck','d1ck','penis','vagina','boob','t1ts','pussy'
        ];

        bannedWords.forEach(word => {
            const pattern = word.split('').join('[^a-zA-Z0-9]*');
            const regex = new RegExp(pattern,'gi');
            filtered = filtered.replace(regex,'[censored]');
        });

        return filtered;
    }

    function appendChat(msg, user, status, replyToUser=null, skipSave=false){
        const div = document.createElement('div');
        div.classList.add('chat-message');

        const statusBubble = document.createElement('div');
        statusBubble.className = 'chat-status-bubble';
        statusBubble.textContent = status || 'offline';
        statusBubble.style.color = status==='online'?'lime':status==='away'?'yellow':'grey';
        statusBubble.style.fontSize = '0.7rem';
        statusBubble.style.marginBottom = '2px';
        div.appendChild(statusBubble);

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('chat-user');
        nameSpan.textContent = user;
        nameSpan.style.cursor = 'pointer';
        nameSpan.style.color = 'dodgerblue';
        nameSpan.onclick = () => viewProfile(user); // <-- NEW
        div.appendChild(nameSpan);


        if(replyToUser){
            const replySpan = document.createElement('span');
            replySpan.classList.add('chat-reply');
            replySpan.textContent = ` ↪ ${replyToUser}`;
            div.appendChild(replySpan);
        }

        const msgSpan = document.createElement('span');
        msgSpan.classList.add('chat-text');
        msgSpan.textContent = msg;
        div.appendChild(msgSpan);

        const replyBtn = document.createElement('button');
        replyBtn.textContent = 'Reply';
        replyBtn.className = 'reply-btn';
        replyBtn.onclick = () => { replyTo = user; if(currentUser) chatInput.focus(); };
        div.appendChild(replyBtn);

        chatWrapper.appendChild(div);
        chatWrapper.scrollTop = chatWrapper.scrollHeight;

        if(!skipSave){
            const chatEntry = {user, msg, status, replyTo: replyToUser, timestamp: Date.now()};
            chatHistory.push(chatEntry);
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        }
    }

    /* ===== LOAD SAVED CHAT ===== */
    chatHistory.forEach(c => appendChat(c.msg, c.user, c.status, c.replyTo, true));

    function sendMessage(msgOverride=null){
        let msg = msgOverride || (currentUser ? chatInput.value.trim() : null);
        if(!msg) return alert('Please select a premade message.');
        if(!currentUser && !guestMessages.includes(msg)) return alert('Guests can only use preset messages');
        if(currentUser && msg === lastChatMsg) { alert('Do not repeat the same message.'); return; }
        msg = filterMessage(msg);

        const users = JSON.parse(localStorage.getItem('users')||'{}');
        const status = currentUser ? users[currentUser]?.status : 'online';
        appendChat(msg, currentUser || guestName, status, replyTo);
        replyTo = null;
        lastChatMsg = msg;
        if(currentUser) chatInput.value = '';
    }

    chatSend.addEventListener('click', ()=>sendMessage(currentUser ? undefined : guestDropdown.value));
    guestDropdown.addEventListener('change', ()=>{ if(guestDropdown.value) sendMessage(guestDropdown.value); guestDropdown.selectedIndex = 0; });
    chatInput.addEventListener('keypress', e=>{ if(e.key==='Enter') sendMessage(); });
    chatInput.addEventListener('paste', e=>{ const now = Date.now(); if(now - lastPasteTime < 500){ e.preventDefault(); alert('Slow down with pasting!'); } else lastPasteTime = now; });

    /* ===== CONTACT HEADER MINIGAME ===== */
    const contactHeaderLetters = document.querySelectorAll('#contact-header span');
    const catSequence = ['C','A','T'];
    let catIndex = 0;
    contactHeaderLetters.forEach(letter=>{
        letter.addEventListener('click', ()=>{
            if(letter.dataset.letter === catSequence[catIndex]){
                catIndex++;
                if(catIndex === catSequence.length){
                    alert('Sequence complete! Opening minigame...');
                    window.open('minigame.html', '_blank');
                    catIndex = 0;
                }
            } else catIndex = 0;
        });
    });

    galleryImgs.forEach(img => {
        let x = Math.random() * 70; // max left %
        let y = Math.random() * 70; // max top %
        img.style.left = x + '%';
        img.style.top = y + '%';

        let dx = (Math.random() - 0.5) * 0.5;
        let dy = (Math.random() - 0.5) * 0.5;

        setInterval(() => {
            let currentX = parseFloat(img.style.left);
            let currentY = parseFloat(img.style.top);

            if (currentX + dx < 0 || currentX + dx > 70) dx *= -1;
            if (currentY + dy < 0 || currentY + dy > 70) dy *= -1;

            img.style.left = (currentX + dx) + '%';
            img.style.top = (currentY + dy) + '%';
        }, 50);
    });


    const canvas = document.getElementById('code-rain');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Characters to use
    const chars = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズヅブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);

    // Track y position for each column
    const drops = Array(columns).fill(1);

    function draw() {
        // Black semi-transparent background to create trail effect
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0ff';
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = chars.charAt(Math.floor(Math.random() * chars.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            // Reset drop to top randomly
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }

            drops[i]++;
        }

        requestAnimationFrame(draw);
    }

    draw();

    // Resize handling
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    /* ===== PASSWORD RESET ===== */
    async function resetPasswordHelper(){
        const uname = prompt('Enter your username:').trim();
        if(!uname) return alert('Cancelled');
        const users = JSON.parse(localStorage.getItem('users')||'{}');
        if(!users[uname]) return alert('Username not found');

        const confirmReset = confirm('This will reset your password to "1234". Proceed?');
        if(!confirmReset) return;

        const newPass = '1234';
        const salt = Math.random().toString(36).slice(2,10);
        const hash = await hashPassword(newPass, salt);
        users[uname].password = encrypt(hash);
        users[uname].salt = salt;
        localStorage.setItem('users', JSON.stringify(users));
        alert(`Password for ${uname} has been reset to "${newPass}".`);
    }

    const forgotBtn = document.createElement('button');
    forgotBtn.textContent = 'Forgot Password?';
    forgotBtn.style.display='block';
    forgotBtn.style.marginTop='10px';
    forgotBtn.addEventListener('click', resetPasswordHelper);
    loginProfile.appendChild(forgotBtn);

    /* ===== START HOME PAGE ===== */
    showLoading('home');
});
