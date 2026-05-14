// ===== 사용자 DB (localStorage) =====
const DB = {
    users: JSON.parse(localStorage.getItem('users')) || [],
    currentUser: null,

    save() { localStorage.setItem('users', JSON.stringify(this.users)); },
    addUser(id, password, email, phone) {
        this.users.push({ id, password, email, phone, keywords: [], keywordChecks: {}, notifications: [] });
        this.save();
    },
    findUser(id, password) { return this.users.find(u => u.id === id && u.password === password); },
    updateUserKeywords(keywords) {
        if (this.currentUser) {
            const user = this.users.find(u => u.id === this.currentUser.id);
            if (user) {
                user.keywords = keywords;
                const nc = {};
                keywords.forEach(kw => { if (user.keywordChecks && user.keywordChecks[kw] !== undefined) nc[kw] = user.keywordChecks[kw]; });
                user.keywordChecks = nc;
                this.save();
            }
        }
    },
    getUserKeywords() {
        if (this.currentUser) { const u = this.users.find(u => u.id === this.currentUser.id); return u ? u.keywords : []; }
        return [];
    },
    getKeywordChecks() {
        if (this.currentUser) { const u = this.users.find(u => u.id === this.currentUser.id); return u ? (u.keywordChecks || {}) : {}; }
        return {};
    },
    setKeywordCheck(keyword, checked) {
        if (this.currentUser) {
            const u = this.users.find(u => u.id === this.currentUser.id);
            if (u) { if (!u.keywordChecks) u.keywordChecks = {}; u.keywordChecks[keyword] = checked; this.save(); }
        }
    },
    addNotification(message, keyword, noticeNumber = null) {
        if (this.currentUser) {
            const u = this.users.find(u => u.id === this.currentUser.id);
            if (u) {
                const now = new Date();
                const d = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
                u.notifications.push({ message, keyword, date: d, read: false, noticeNumber, starred: false });
                this.save();
            }
        }
    },
    markAsRead(index) {
        if (this.currentUser) {
            const u = this.users.find(u => u.id === this.currentUser.id);
            if (u && u.notifications[index]) { u.notifications[index].read = true; this.save(); }
        }
    },
    toggleStar(index) {
        if (this.currentUser) {
            const u = this.users.find(u => u.id === this.currentUser.id);
            if (u && u.notifications[index]) { u.notifications[index].starred = !u.notifications[index].starred; this.save(); }
        }
    },
    getNotifications() {
        if (this.currentUser) { const u = this.users.find(u => u.id === this.currentUser.id); return u ? u.notifications : []; }
        return [];
    }
};

// ===== 상태 변수 =====
let allData    = [];   // 서버에서 받은 전체 데이터
let apiData    = [];   // 검색 필터 적용 후 표시할 데이터
let totalCount = 0;
let currentPage = 1;
const itemsPerPage = 10;

// ===== 목록 상태 저장/복원 =====
let savedBidState = null;

function saveBidState() {
    savedBidState = {
        page:         currentPage,
        searchInput:  document.getElementById('searchInput')?.value  || '',
        regionFilter: document.getElementById('regionFilter')?.value || '',
        methodFilter: document.getElementById('methodFilter')?.value || '',
        agencyFilter: document.getElementById('agencyFilter')?.value || '',
    };
}

function restoreBidState() {
    if (!savedBidState) return false;
    if (document.getElementById('searchInput'))  document.getElementById('searchInput').value  = savedBidState.searchInput;
    if (document.getElementById('regionFilter')) document.getElementById('regionFilter').value = savedBidState.regionFilter;
    if (document.getElementById('methodFilter')) document.getElementById('methodFilter').value = savedBidState.methodFilter;
    if (document.getElementById('agencyFilter')) document.getElementById('agencyFilter').value = savedBidState.agencyFilter;
    fetchBidList(savedBidState.page);
    savedBidState = null;
    return true;
}

// ===== 초기화 =====
window.addEventListener('DOMContentLoaded', () => {
    fetchBidList();
});

// ===== 목록 호출 =====
async function fetchBidList(page = 1) {
    currentPage = page;
    showTableLoading('bidTable', 7);
    showTableLoading('mainBidTable', 6);

    try {
        const res = await fetch('http://localhost:8080/api/notices');
        allData   = await res.json();

        applySearchFilter();
        renderBidTable();
        renderMainBidTable();
        renderPagination();
        updateBidStats();
        checkNewBidsForKeywords();
    } catch (e) {
        console.error('API 오류:', e);
        showTableError('bidTable', 7, 'API 호출에 실패했습니다. 서버 상태를 확인하세요.');
    }
}

// ===== 검색 필터 적용 =====
function applySearchFilter() {
    const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    apiData    = searchTerm ? allData.filter(item => (item.notice_title || '').toLowerCase().includes(searchTerm)) : allData;
    totalCount = apiData.length;
}

// ===== 포맷 함수 =====
function formatAmount(val) {
    if (!val || val === '0') return '-';
    const n = parseInt(val);
    if (isNaN(n)) return '-';
    if (n >= 100000000) return Math.round(n / 100000000) + '억';
    if (n >= 10000)     return Math.round(n / 10000) + '만';
    return n.toLocaleString() + '원';
}

function formatDate(val) {
    if (!val) return '-';
    const s = String(val).replace(/[^0-9]/g, '');
    if (s.length >= 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    return val;
}

// ===== 테이블 렌더링 =====
function renderBidTable() {
    const table = document.getElementById('bidTable');
    while (table.rows.length > 1) table.deleteRow(1);

    const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';

    if (apiData.length === 0) {
        const row = table.insertRow(); const cell = row.insertCell(0);
        cell.colSpan = 7; cell.style.cssText = 'text-align:center;padding:40px;color:#9ca3af;';
        cell.textContent = '검색 결과가 없습니다.'; return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end   = Math.min(start + itemsPerPage, apiData.length);

    for (let i = start; i < end; i++) {
        const item = apiData[i];
        const row  = table.insertRow();
        row.style.cursor = 'pointer';
        row.onclick = () => { saveBidState(); showBidDetail(item.notice_number); };

        row.insertCell(0).textContent = i + 1;

        const titleCell = row.insertCell(1);
        if (searchTerm) {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            titleCell.innerHTML = (item.notice_title || '-').replace(regex, '<span class="highlight">$1</span>');
        } else {
            titleCell.textContent = item.notice_title || '-';
        }

        row.insertCell(2).textContent = item.contract_method || '-';
        row.insertCell(3).textContent = formatAmount(item.amount);
        row.insertCell(4).textContent = item.region           || '-';
        row.insertCell(5).textContent = item.agency           || '-';
        row.insertCell(6).textContent = '-';
    }
}

function renderMainBidTable() {
    const table = document.getElementById('mainBidTable');
    if (!table) return;
    while (table.rows.length > 1) table.deleteRow(1);
    allData.slice(0, 4).forEach((item, i) => {
        const row = table.insertRow();
        row.style.cursor = 'pointer';
        row.onclick = () => { showPage('bid'); setTimeout(() => showBidDetail(item.notice_number), 100); };
        row.insertCell(0).textContent = i + 1;
        row.insertCell(1).textContent = item.notice_title    || '-';
        row.insertCell(2).textContent = item.contract_method || '-';
        row.insertCell(3).textContent = formatAmount(item.amount);
        row.insertCell(4).textContent = item.region          || '-';
        row.insertCell(5).textContent = item.agency          || '-';
    });
}

// ===== 상세 페이지 =====
function showBidDetail(noticeNumber) {
    showPage('bidDetail');

    const item = allData.find(i => i.notice_number === noticeNumber);
    if (!item) return;

    document.getElementById('detailTitle').textContent      = item.notice_title    || '-';
    document.getElementById('detailNtceNo').textContent     = item.notice_number   || '-';
    document.getElementById('detailMethod').textContent     = item.contract_method || '-';
    document.getElementById('detailDminstt').textContent    = item.agency          || '-';
    document.getElementById('detailDmndInstt').textContent  = item.demand_agency   || '-';
    document.getElementById('detailAmount').textContent     = formatAmount(item.amount);
    document.getElementById('detailNtceDate').textContent   = formatDate(item.bid_start);
    document.getElementById('detailOpengDate').textContent  = formatDate(item.bid_end);
    document.getElementById('detailBizType').textContent    = item.contract_method || '-';
    document.getElementById('detailRegion').textContent     = item.region          || '-';
    document.getElementById('detailFiles').textContent      = '-';
}

// ===== 페이지네이션 =====
function renderPagination() {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const div = document.getElementById('pagination');
    let html = `<button onclick="fetchBidList(${currentPage-1})" ${currentPage===1?'disabled':''}>이전</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i===1 || i===totalPages || (i>=currentPage-2 && i<=currentPage+2))
            html += `<button onclick="fetchBidList(${i})" class="${i===currentPage?'active':''}">${i}</button>`;
        else if (i===currentPage-3 || i===currentPage+3)
            html += `<button disabled>...</button>`;
    }
    html += `<button onclick="fetchBidList(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>다음</button>`;
    div.innerHTML = html;
}

// ===== 통계 =====
function updateBidStats() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
    const todayCount = allData.filter(b => String(b.bid_start||'').startsWith(today)).length;
    let matchedCount = 0;
    if (DB.currentUser) {
        const kws = DB.getUserKeywords();
        matchedCount = allData.filter(b => kws.some(kw => (b.notice_title||'').includes(kw))).length;
    }
    const amounts   = allData.map(b => parseInt(b.amount||0)).filter(n => n > 0);
    const avgAmount = amounts.length ? formatAmount(Math.round(amounts.reduce((a,b)=>a+b,0)/amounts.length)) : '-';

    document.getElementById('totalBids').textContent   = allData.length;
    document.getElementById('todayBids').textContent   = todayCount;
    document.getElementById('matchedBids').textContent = matchedCount;
    document.getElementById('avgAmount').textContent   = avgAmount;
}

// ===== 검색/필터 =====
function searchBids() { applySearchFilter(); currentPage = 1; renderBidTable(); renderPagination(); }
function handleSearchEnter(e) { if (e.key === 'Enter') searchBids(); }
function applyFilters()       { searchBids(); }
function clearFilters() {
    ['regionFilter','methodFilter','agencyFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('searchInput').value = '';
    applySearchFilter(); currentPage = 1; renderBidTable(); renderPagination();
}

// ===== 페이지 전환 =====
function showPage(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id !== 'mypage') resetKeywordEditMode();
    if (id === 'mypage') { resetKeywordEditMode(); loadMyPage(); }
    if (id === 'bid')    { if (!restoreBidState()) updateBidStats(); }
}

// ===== 로딩/에러 =====
function showTableLoading(tableId, cols) {
    const t = document.getElementById(tableId); if (!t) return;
    while (t.rows.length > 1) t.deleteRow(1);
    const row = t.insertRow(); row.className = 'loading-row';
    const cell = row.insertCell(0); cell.colSpan = cols; cell.textContent = '불러오는 중...';
}
function showTableError(tableId, cols, msg) {
    const t = document.getElementById(tableId); if (!t) return;
    while (t.rows.length > 1) t.deleteRow(1);
    const row = t.insertRow(); const cell = row.insertCell(0);
    cell.colSpan = cols; cell.style.cssText = 'text-align:center;padding:40px;color:#ef4444;'; cell.textContent = msg;
}

// ===== 키워드 알림 체크 =====
function checkNewBidsForKeywords() {
    if (!DB.currentUser) return;
    const kws = DB.getUserKeywords();
    const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
    allData.forEach(item => {
        if (String(item.bid_start||'').startsWith(today)) {
            kws.forEach(kw => { if ((item.notice_title||'').includes(kw)) DB.addNotification(`새 입찰공고: ${item.notice_title}`, kw, item.notice_number); });
        }
    });
    updateNotificationBadge();
}

// ===== 회원가입 =====
function openSignupModal()  { document.getElementById('signupModal').classList.add('show'); }
function closeSignupModal() {
    document.getElementById('signupModal').classList.remove('show');
    ['signupId','signupPassword','signupPasswordConfirm','signupEmail','signupPhone'].forEach(id => { document.getElementById(id).value = ''; });
}
function handleSignup() {
    const id=document.getElementById('signupId').value.trim(), pw=document.getElementById('signupPassword').value;
    const pwc=document.getElementById('signupPasswordConfirm').value, email=document.getElementById('signupEmail').value.trim();
    const phone=document.getElementById('signupPhone').value.trim();
    if (!id||!pw||!email||!phone) { showAlert('모든 항목을 입력해주세요.'); return; }
    if (pw!==pwc) { showAlert('비밀번호가 일치하지 않습니다.'); return; }
    if (DB.users.find(u=>u.id===id)) { showAlert('이미 존재하는 아이디입니다.'); return; }
    DB.addUser(id,pw,email,phone); showAlert('회원가입이 완료되었습니다.'); closeSignupModal();
}

// ===== 로그인/로그아웃 =====
function handleLogin() {
    const id=document.getElementById('loginId').value.trim(), pw=document.getElementById('loginPassword').value;
    if (!id||!pw) { showAlert('아이디와 비밀번호를 입력해주세요.'); return; }
    const user=DB.findUser(id,pw);
    if (user) {
        resetKeywordEditMode(); DB.currentUser=user; showAlert('로그인 성공!');
        document.getElementById('loginLink').style.display='none';
        document.getElementById('logoutLink').style.display='inline';
        document.getElementById('mypageLink').style.display='inline';
        document.getElementById('divider').style.display='inline';
        document.getElementById('notificationBell').classList.add('show');
        showPage('main');
        document.getElementById('mainKeywordPanel').classList.add('show');
        loadUserKeywords(); updateNotificationBadge();
        document.getElementById('loginId').value=''; document.getElementById('loginPassword').value='';
    } else { showAlert('등록되지 않은 회원입니다.'); }
}
function handleLoginEnter(e)         { if (e.key==='Enter') handleLogin(); }
function handleKeywordEnter(e, type) { if (e.key==='Enter' && type==='mypage') addMypageKeyword(); }
function handleLogout() {
    resetKeywordEditMode(); DB.currentUser=null;
    document.getElementById('loginLink').style.display='inline';
    document.getElementById('logoutLink').style.display='none';
    document.getElementById('mypageLink').style.display='none';
    document.getElementById('notificationBell').classList.remove('show');
    document.getElementById('mainKeywordPanel').classList.remove('show');
    showAlert('로그아웃되었습니다.'); showPage('main');
}

// ===== 키워드 =====
function loadUserKeywords() {
    const kws=DB.getUserKeywords();
    document.getElementById('keywordList').innerHTML = kws.length===0
        ? '<p style="color:#999;text-align:center;padding:20px;">등록된 키워드가 없습니다.</p>'
        : kws.map(kw=>`<div class="keyword-item" onclick="showPage('mypage')"><span class="keyword-item-text">${kw}</span></div>`).join('');
    loadMypageKeywordList();
}
function loadMyPage() {
    if (!DB.currentUser) return;
    const u=DB.users.find(u=>u.id===DB.currentUser.id);
    if (u) {
        document.getElementById('userIdDisplay').textContent=u.id;
        document.getElementById('userEmailDisplay').textContent=u.email;
        document.getElementById('userPhoneDisplay').textContent=u.phone;
        loadUserKeywordsMypage(); loadNotifications();
    }
}
let isEditMode=false, originalEmail='', originalPhone='';
function toggleEditMode() {
    isEditMode=!isEditMode;
    const em=document.getElementById('userEmailDisplay'), pm=document.getElementById('userPhoneDisplay');
    document.getElementById('editBtn').style.display=isEditMode?'none':'block';
    document.getElementById('editButtons').style.display=isEditMode?'block':'none';
    if (isEditMode) {
        originalEmail=em.textContent; originalPhone=pm.textContent;
        em.innerHTML=`<input type="email" id="editEmail" value="${originalEmail}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">`;
        pm.innerHTML=`<input type="tel" id="editPhone" value="${originalPhone}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">`;
    }
}
function cancelEdit() {
    isEditMode=false;
    document.getElementById('editBtn').style.display='block';
    document.getElementById('editButtons').style.display='none';
    document.getElementById('userEmailDisplay').textContent=originalEmail;
    document.getElementById('userPhoneDisplay').textContent=originalPhone;
}
function saveUserInfo() {
    const ne=document.getElementById('editEmail').value.trim(), np=document.getElementById('editPhone').value.trim();
    if (!ne||!np) { showAlert('이메일과 전화번호를 모두 입력해주세요.'); return; }
    if (DB.currentUser) { const u=DB.users.find(u=>u.id===DB.currentUser.id); if (u) { u.email=ne; u.phone=np; DB.currentUser.email=ne; DB.currentUser.phone=np; DB.save(); } }
    isEditMode=false;
    document.getElementById('editBtn').style.display='block';
    document.getElementById('editButtons').style.display='none';
    document.getElementById('userEmailDisplay').textContent=ne;
    document.getElementById('userPhoneDisplay').textContent=np;
    showAlert('회원정보가 수정되었습니다.');
}
function loadUserKeywordsMypage() { loadMypageKeywordList(); }
let isKeywordEditMode=false;
function loadMypageKeywordList() {
    const kws=DB.getUserKeywords(), kc=DB.getKeywordChecks();
    const container=document.getElementById('mypageKeywordList');
    if (kws.length===0) { container.innerHTML='<p style="color:#999;text-align:center;padding:20px;">등록된 키워드가 없습니다.</p>'; return; }
    const sorted=[...kws].sort((a,b)=>{ const ac=kc[a]||false,bc=kc[b]||false; if(ac&&!bc)return -1; if(!ac&&bc)return 1; return a.localeCompare(b,'ko'); });
    container.innerHTML=sorted.map(kw=>`
        <div class="keyword-item ${isKeywordEditMode?'edit-mode':''} ${kc[kw]?'checked':''}" onclick="event.stopPropagation()">
            <input type="checkbox" class="keyword-item-checkbox" ${kc[kw]?'checked':''} onchange="toggleKeywordCheck('${kw}',this.checked)">
            <span class="keyword-item-text">${kw}</span>
            <button class="keyword-item-delete" onclick="deleteKeyword('${kw}')"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join('');
}
function toggleKeywordCheck(kw,checked) { DB.setKeywordCheck(kw,checked); loadMypageKeywordList(); }
function toggleKeywordEditMode() {
    isKeywordEditMode=!isKeywordEditMode;
    const eb=document.getElementById('keywordEditBtn'),bd=document.getElementById('keywordBulkDeleteBtn'),ab=document.getElementById('keywordAddBtn');
    if (isKeywordEditMode) { eb.textContent='확인'; eb.className='btn-confirm'; bd.style.display='block'; ab.classList.add('show'); }
    else { eb.textContent='수정'; eb.className='btn-edit'; bd.style.display='none'; ab.classList.remove('show'); }
    loadMypageKeywordList();
}
function resetKeywordEditMode() {
    isKeywordEditMode=false;
    const eb=document.getElementById('keywordEditBtn'),bd=document.getElementById('keywordBulkDeleteBtn'),ab=document.getElementById('keywordAddBtn');
    if(eb){eb.textContent='수정';eb.className='btn-edit';} if(bd)bd.style.display='none'; if(ab)ab.classList.remove('show');
}
function showKeywordInputBox() { document.getElementById('mypageKeywordInput').focus(); }
function deleteKeyword(kw) {
    if (confirm('삭제하시겠습니까?')) { DB.updateUserKeywords(DB.getUserKeywords().filter(k=>k!==kw)); loadUserKeywords(); updateBidStats(); }
}
function loadNotifications() {
    const notis=DB.getNotifications(), container=document.getElementById('notificationList');
    if (notis.length===0) { container.innerHTML='<div class="no-notification">새로운 입찰공고 알림이 없습니다.</div>'; return; }
    container.innerHTML=notis.map((n,i)=>`
        <div class="notification-item ${n.read?'read':'unread'}" >
            <div class="noti-content" onclick="clickNotification(${i})" style="cursor:pointer;flex:1">
                새로운 입찰공고가 올라왔습니다. - <strong>${n.keyword}</strong>
                <span class="date">${n.date}</span>
            </div>
            <button class="star-noti ${n.starred?'starred':''}" onclick="toggleStarNotification(${i})" title="즐겨찾기">★</button>
            <button class="delete-noti" onclick="deleteNotification(${i})" title="삭제">×</button>
        </div>`).join('');
}
function clickNotification(index) {
    DB.markAsRead(index);
    const n = DB.getNotifications()[index];
    loadNotifications();
    updateNotificationBadge();
    if (n.noticeNumber) { showPage('bid'); setTimeout(() => showBidDetail(n.noticeNumber), 100); }
}
function toggleStarNotification(index) {
    DB.toggleStar(index);
    loadNotifications();
}
function deleteNotification(index) {
    if (DB.currentUser) { const u=DB.users.find(u=>u.id===DB.currentUser.id); if (u) { u.notifications.splice(index,1); DB.save(); loadNotifications(); } }
}
function addMypageKeyword() {
    const input=document.getElementById('mypageKeywordInput'), val=input.value.trim();
    if (!val) return;
    const cur=DB.getUserKeywords();
    if (cur.includes(val)) { showAlert('이미 존재하는 키워드입니다.'); input.value=''; return; }
    cur.push(val); DB.updateUserKeywords(cur); input.value=''; loadUserKeywords(); updateBidStats();
}
function openBulkDeleteModal() {
    const kws=DB.getUserKeywords(), c=document.getElementById('bulkDeleteList');
    if (kws.length===0) { showAlert('삭제할 키워드가 없습니다.'); return; }
    c.innerHTML=kws.map((kw,i)=>`<div class="bulk-delete-item"><input type="checkbox" id="bulk_${i}" value="${kw}"><label for="bulk_${i}">${kw}</label></div>`).join('');
    document.getElementById('bulkDeleteModal').classList.add('show');
}
function closeBulkDeleteModal() { document.getElementById('bulkDeleteModal').classList.remove('show'); }
let bulkDeleteCallback=null;
function confirmBulkDelete() {
    const cbs=document.querySelectorAll('#bulkDeleteList input[type="checkbox"]:checked');
    if (cbs.length===0) { showAlert('삭제할 키워드를 선택해주세요.'); return; }
    const toDel=Array.from(cbs).map(cb=>cb.value);
    bulkDeleteCallback=()=>{ DB.updateUserKeywords(DB.getUserKeywords().filter(kw=>!toDel.includes(kw))); loadUserKeywords(); updateBidStats(); toggleKeywordEditMode(); setTimeout(()=>showAlert('선택한 키워드가 삭제되었습니다.'),100); };
    showConfirm('일괄 삭제하시겠습니까?');
}
function showConfirm(msg)  { document.getElementById('confirmMessage').textContent=msg; document.getElementById('confirmModal').classList.add('show'); }
function closeConfirm()    { document.getElementById('confirmModal').classList.remove('show'); }
function confirmAction()   { if (bulkDeleteCallback) { const cb=bulkDeleteCallback; bulkDeleteCallback=null; closeConfirm(); closeBulkDeleteModal(); cb(); } else closeConfirm(); }

// ===== 알림 =====
function updateNotificationBadge() {
    const n=DB.getNotifications().filter(n=>!n.read), badge=document.getElementById('notificationBadge');
    badge.textContent=n.length; badge.style.display=n.length===0?'none':'flex';
}
function toggleNotificationDropdown() {
    const d=document.getElementById('notificationDropdown'); d.classList.toggle('show');
    if (d.classList.contains('show')) loadNotificationDropdown();
}
function loadNotificationDropdown() {
    const notis=DB.getNotifications(), c=document.getElementById('notificationDropdownContent');
    if (notis.length===0) { c.innerHTML='<div class="notification-dropdown-empty">새로운 알림이 없습니다.</div>'; return; }
    c.innerHTML=notis.slice(0,5).map((n,i)=>`
        <div class="notification-dropdown-item ${n.read?'read':'unread'}" onclick="clickNotification(${i}); toggleNotificationDropdown()" style="cursor:pointer">
            <strong>${n.keyword}</strong> 키워드와 매칭되는 새 공고<br>
            <span style="font-size:11px;color:#9ca3af;">${n.date}</span>
        </div>`).join('');
}
document.addEventListener('click', e => {
    const d=document.getElementById('notificationDropdown'), bell=document.getElementById('notificationBell');
    if (!bell.contains(e.target)&&!d.contains(e.target)) d.classList.remove('show');
});

// ===== Alert =====
function showAlert(msg) { document.getElementById('alertMessage').textContent=msg; document.getElementById('alertModal').classList.add('show'); setTimeout(()=>document.getElementById('alertModal').focus(),100); }
function closeAlert()   { document.getElementById('alertModal').classList.remove('show'); }
document.addEventListener('keypress', e => { if (e.key==='Enter'&&document.getElementById('alertModal').classList.contains('show')) closeAlert(); });
