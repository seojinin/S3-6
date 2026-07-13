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
};
// 알림(Notification)은 더 이상 localStorage에 저장하지 않고, 백엔드 /api/notifications API에서
// 직접 조회/갱신합니다 (아래 "===== 알림 =====" 섹션 참고).

// 백엔드 로그인 세션으로 받아온 현재 로그인 회원 정보 (member_id, login_id, username, email, phone, role)
let currentMember = null;

// 기존 키워드/알림은 localStorage(DB) 기반으로 그대로 동작하므로,
// 백엔드 로그인 성공 시 DB.users 안에도 호환용 레코드를 만들어 연결해줍니다.
function ensureLocalUserRecord(loginId) {
    let user = DB.users.find(u => u.id === loginId);
    if (!user) {
        user = { id: loginId, password: null, email: '', phone: '', keywords: [], keywordChecks: {}, notifications: [] };
        DB.users.push(user);
        DB.save();
    }
    DB.currentUser = user;
    return user;
}

// 로그인 상태에 따른 공통 UI 처리
function setLoggedInUI() {
    document.getElementById('loginLink').style.display = 'none';
    document.getElementById('logoutLink').style.display = 'inline';
    document.getElementById('mypageLink').style.display = 'inline';
    document.getElementById('divider').style.display = 'inline';
    document.getElementById('notificationBell').classList.add('show');
    document.getElementById('mainKeywordPanel').classList.add('show');
    const heroLoginBtn = document.getElementById('heroLoginBtn');
    if (heroLoginBtn) heroLoginBtn.style.display = 'none';
    loadUserKeywords();
    updateUnreadBadge();
}
function setLoggedOutUI() {
    currentMember = null;
    DB.currentUser = null;
    userKeywords = [];
    const kl = document.getElementById('keywordList');
    if (kl) kl.innerHTML = '';
    document.getElementById('loginLink').style.display = 'inline';
    document.getElementById('logoutLink').style.display = 'none';
    document.getElementById('mypageLink').style.display = 'none';
    document.getElementById('divider').style.display = 'none';
    document.getElementById('notificationBell').classList.remove('show');
    document.getElementById('mainKeywordPanel').classList.remove('show');
    const heroLoginBtn = document.getElementById('heroLoginBtn');
    if (heroLoginBtn) heroLoginBtn.style.display = 'inline-block';
    updateUnreadBadge();
}

// 새로고침해도 세션이 살아있으면 로그인 상태를 복원
async function checkLoginStatus() {
    try {
        const res = await fetch('http://localhost:8080/api/member/mypage', { credentials: 'include' });
        if (!res.ok) { setLoggedOutUI(); return; }
        currentMember = await res.json();
        ensureLocalUserRecord(currentMember.login_id);
        setLoggedInUI();
    } catch (e) {
        setLoggedOutUI();
    }
}
function goToNoticeDetail(notice_number, notificationId) {
    if (!notice_number) return;
    if (notificationId) {
        markNotificationRead(notificationId).then(() => updateUnreadBadge());
    }
    const d = document.getElementById('notificationDropdown');
    if (d) d.classList.remove('show');
    showBidDetail(notice_number);
}

// ===== 상태 변수 =====
let allData    = [];
let apiData    = [];
let totalCount = 0;
let currentPage = 1;
const itemsPerPage = 10;

// ===== 다중 키워드 검색 상태 =====
let searchKeywords = [];

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderSearchChips() {
    const wrap = document.getElementById('searchChipWrap');
    if (!wrap) return;
    wrap.innerHTML = searchKeywords.map(kw => `
        <span class="search-chip">${kw}<button onclick="removeSearchKeyword('${kw.replace(/'/g, "\\'")}')">×</button></span>
    `).join('');
}

// 입력값을 검색 키워드 목록에 추가 (중복/공백 제외)
function addSearchKeyword(raw) {
    const kw = (raw || '').trim();
    if (!kw) return false;
    if (searchKeywords.includes(kw)) return false;
    searchKeywords.push(kw);
    renderSearchChips();
    return true;
}

function removeSearchKeyword(kw) {
    searchKeywords = searchKeywords.filter(k => k !== kw);
    renderSearchChips();
    searchBids();
}

// ===== 목록 상태 저장/복원 =====
let savedBidState = null;

function saveBidState() {
    savedBidState = {
        page:           currentPage,
        searchInput:    document.getElementById('searchInput')?.value  || '',
        searchKeywords: [...searchKeywords],
        regionFilter:   document.getElementById('regionFilter')?.value || '',
        methodFilter:   document.getElementById('methodFilter')?.value || '',
        agencyFilter:   document.getElementById('agencyFilter')?.value || '',
    };
}

function restoreBidState() {
    if (!savedBidState) return false;
    if (document.getElementById('searchInput'))  document.getElementById('searchInput').value  = savedBidState.searchInput;
    if (document.getElementById('regionFilter')) document.getElementById('regionFilter').value = savedBidState.regionFilter;
    if (document.getElementById('methodFilter')) document.getElementById('methodFilter').value = savedBidState.methodFilter;
    if (document.getElementById('agencyFilter')) document.getElementById('agencyFilter').value = savedBidState.agencyFilter;

    searchKeywords = savedBidState.searchKeywords || [];
    renderSearchChips();

    const page = savedBidState.page;
    savedBidState = null;

    fetchBidList(page).then(() => { if (searchKeywords.length > 0) searchBids(); });
    return true;
}

// ===== 초기화 =====
window.addEventListener('DOMContentLoaded', () => {
    fetchBidList();
    checkLoginStatus();
    restoreInitialPage(); // 새로고침해도 URL 해시를 보고 있던 페이지 그대로 복원
    // 로그인 상태일 때 알림을 새로고침 없이 실시간에 가깝게 갱신
    // (드롭다운/마이페이지 알림탭이 열려있으면 전체 목록을, 아니면 뱃지 숫자만)
    setInterval(pollNotifications, 4000);
});

// 새로고침 시 현재 URL 해시를 읽어서 그 페이지를 복원 (없으면 메인으로)
function restoreInitialPage() {
    const hash = location.hash.replace('#', '');

    if (hash.startsWith('bidDetail:')) {
        const noticeNumber = decodeURIComponent(hash.substring('bidDetail:'.length));
        if (noticeNumber) { showBidDetail(noticeNumber, false); return; }
    }

    const validPages = ['main', 'bid', 'mypage', 'login'];
    const page = validPages.includes(hash) ? hash : 'main';
    showPage(page, false);
    if (!hash) history.replaceState({ page: 'main' }, '', '#main');
}

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
    } catch (e) {
        console.error('API 오류:', e);
        showTableError('bidTable', 7, 'API 호출에 실패했습니다. 서버 상태를 확인하세요.');
    }
}

// ===== 검색 필터 적용 =====
function applySearchFilter() {
    const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    apiData = searchTerm ? allData.filter(item => {
        const title    = (item.notice_title || '').toLowerCase();
        const keywords = (item.entity_value || '').toLowerCase();
        return title.includes(searchTerm) || keywords.includes(searchTerm);
    }) : allData;
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

    // 칩으로 추가된 다중 키워드가 있으면 그것들을, 없으면 입력창의 텍스트를 하이라이트 대상으로 사용
    const inputTerm = document.getElementById('searchInput')?.value.trim() || '';
    const highlightTerms = searchKeywords.length > 0 ? searchKeywords : (inputTerm ? [inputTerm] : []);

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
        row.onclick = (e) => {
            if (e.target.tagName !== 'A') { saveBidState(); showBidDetail(item.notice_number); }
        };

        row.insertCell(0).textContent = i + 1;

        const titleCell = row.insertCell(1);
        if (highlightTerms.length > 0) {
            const pattern = highlightTerms.map(escapeRegExp).join('|');
            const regex = new RegExp(`(${pattern})`, 'gi');
            titleCell.innerHTML = (item.notice_title || '-').replace(regex, '<span class="highlight">$1</span>');
        } else {
            titleCell.textContent = item.notice_title || '-';
        }

        row.insertCell(2).textContent = item.contract_method || '-';
        row.insertCell(3).textContent = formatAmount(item.amount);
        row.insertCell(4).textContent = item.region           || '-';
        row.insertCell(5).textContent = item.agency           || '-';

        const fileCell = row.insertCell(6);
        if (item.file_name && item.file_url) {
            const names = item.file_name.split('| ');
            const urls  = item.file_url.split('| ');
            let html = '';
            names.forEach((name, idx) => {
                const url = urls[idx] || '#';
                html += `<a href="${url}" target="_blank" title="${name}" style="color:#2563eb;text-decoration:none;margin-right:5px;">💾</a>`;
            });
            fileCell.innerHTML = html;
        } else {
            fileCell.textContent = '-';
        }
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
async function showBidDetail(notice_number, pushHistory = true) {
    showPage('bidDetail', false);
    if (pushHistory) {
        history.pushState({ page: 'bidDetail', notice_number }, '', '#bidDetail:' + encodeURIComponent(notice_number));
    }
    try {
        const res  = await fetch(`http://localhost:8080/api/notices/${notice_number}/detail`);
        const data = await res.json();

        document.getElementById('detailTitle').textContent      = data.notice_title    || '-';
        document.getElementById('detailNtceNo').textContent     = data.notice_number   || '-';
        document.getElementById('detailMethod').textContent     = data.contract_method || '-';
        document.getElementById('detailDminstt').textContent    = data.agency          || '-';
        document.getElementById('detailDmndInstt').textContent  = data.demand_agency   || '-';
        document.getElementById('detailAmount').textContent     = formatAmount(data.amount);
        document.getElementById('detailNtceDate').textContent   = formatDate(data.notice_date);
        document.getElementById('detailOpengDate').textContent  = formatDate(data.opening_date);
        document.getElementById('detailBizType').textContent    = data.biz_type        || '-';
        document.getElementById('detailRegion').textContent     = data.region          || '-';

        const fileContainer = document.getElementById('detailFiles');
        fileContainer.innerHTML = '';
        if (data.files && data.files.length > 0) {
            data.files.forEach(file => {
                const a = document.createElement('a');
                a.href = file.fileUrl; a.textContent = `💾 ${file.fileName}`;
                a.target = '_blank'; a.style.cssText = 'display:block;margin-bottom:5px;color:#2563eb;text-decoration:none;';
                fileContainer.appendChild(a);
            });
        } else { fileContainer.textContent = '첨부파일 없음'; }
    } catch (e) {
        console.error('상세 정보 로드 실패:', e);
        document.getElementById('detailFiles').textContent = '상세 정보를 불러올 수 없습니다.';
    }
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
    const todayCount = allData.filter(b => String(b.notice_date||'').startsWith(today)).length;
    let matchedCount = 0;
    if (currentMember) {
        const kws = userKeywords;
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

// 입력창에 남은 텍스트를 칩으로 추가하고 비움
function commitPendingSearchInput() {
    const input = document.getElementById('searchInput');
    if (input && input.value.trim()) {
        addSearchKeyword(input.value);
        input.value = '';
    }
}

// 다중 키워드 검색 (백엔드 /api/notices/entities/search?keyword=A/B/C 연동)
async function searchBids() {
    commitPendingSearchInput();
    currentPage = 1;

    // 활성화된 검색 키워드가 없으면 전체 목록을 그대로 보여줌
    if (searchKeywords.length === 0) {
        applySearchFilter();
        renderBidTable();
        renderPagination();
        return;
    }

    showTableLoading('bidTable', 7);

    try {
        const query = searchKeywords.map(encodeURIComponent).join('/');
        const res = await fetch(`http://localhost:8080/api/notices/entities/search?keyword=${query}`);
        if (!res.ok) throw new Error('검색 API 응답 오류');
        const results = await res.json();

        // 검색 결과(엔티티 단위 row)에서 매칭된 공고번호만 추려서 allData와 매칭
        const matchedNumbers = new Set(results.map(r => r.notice_number).filter(Boolean));
        apiData    = allData.filter(item => matchedNumbers.has(item.notice_number));
        totalCount = apiData.length;

        renderBidTable();
        renderPagination();
    } catch (e) {
        console.error('다중 키워드 검색 API 호출 실패, 로컬 검색으로 대체합니다:', e);
        applySearchFilterMultiLocal();
        renderBidTable();
        renderPagination();
    }
}

// 백엔드 검색이 실패했을 때를 위한 로컬(클라이언트) 다중 키워드 대체 검색
function applySearchFilterMultiLocal() {
    apiData = allData.filter(item => {
        const title    = (item.notice_title || '').toLowerCase();
        const keywords = (item.entity_value || '').toLowerCase();
        return searchKeywords.some(kw => {
            const k = kw.toLowerCase();
            return title.includes(k) || keywords.includes(k);
        });
    });
    totalCount = apiData.length;
}

function handleSearchEnter(e) {
    if (e.key === 'Enter') searchBids();
}
function applyFilters()       { searchBids(); }
function clearFilters() {
    ['regionFilter','methodFilter','agencyFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('searchInput').value = '';
    searchKeywords = [];
    renderSearchChips();
    applySearchFilter(); currentPage = 1; renderBidTable(); renderPagination();
}

// ===== 메인페이지 키워드 클릭 → 입찰공고 검색 (다중 검색 API 사용) =====
function searchByKeyword(keyword) {
    showPage('bid');
    document.getElementById('searchInput').value = '';
    searchKeywords = [keyword];
    renderSearchChips();
    searchBids();
}

// ===== 페이지 전환 =====
function showPage(id, pushHistory = true) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id !== 'mypage') resetKeywordEditMode();
    if (id === 'mypage') { resetKeywordEditMode(); loadMyPage(); }
    if (id === 'bid')    { if (!restoreBidState()) updateBidStats(); }
    if (pushHistory) history.pushState({ page: id }, '', '#' + id);
}

window.addEventListener('popstate', (e) => {
    const id = e.state?.page || 'main';
    showPage(id, false);
});

// ===== 마이페이지 탭 전환 =====
function switchMpTab(tab) {
    // 탭 버튼 active 처리
    ['info','keyword','noti'].forEach(t => {
        const btn  = document.getElementById(`mpTab-${t}`);
        const side = document.getElementById(`mpSide-${t}`);
        const panel = document.getElementById(`mpPanel-${t}`);
        if (btn)   btn.classList.toggle('active',   t === tab);
        if (side)  side.classList.toggle('active',  t === tab);
        if (panel) panel.classList.toggle('active', t === tab);
    });
    if (tab === 'noti') fetchNotificationsFromDB();
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

// ===== 회원가입 =====
function openSignupModal()  { document.getElementById('signupModal').classList.add('show'); }
function closeSignupModal() {
    document.getElementById('signupModal').classList.remove('show');
    ['signupId','signupPassword','signupPasswordConfirm','signupUsername','signupEmail','signupPhone'].forEach(id => { document.getElementById(id).value = ''; });
}
async function handleSignup() {
    const id = document.getElementById('signupId').value.trim();
    const pw = document.getElementById('signupPassword').value;
    const pwc = document.getElementById('signupPasswordConfirm').value;
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();

    if (!id || !pw || !username || !email || !phone) {
        showAlert('모든 항목을 입력해주세요.');
        return;
    }
    if (pw !== pwc) {
        showAlert('비밀번호가 일치하지 않습니다.');
        return;
    }

    try {
        const res = await fetch('/api/member/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                login_id: id,
                password: pw,
                username: username,
                email: email,
                phone: phone
            })
        });
        if (!res.ok) {
            const msg = await res.text();
            showAlert(msg || '회원가입에 실패했습니다.');
            return;
        }
        showAlert('회원가입이 완료되었습니다.');
        closeSignupModal();
    } catch (e) {
        console.error('회원가입 API 호출 실패:', e);
        showAlert('서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
}
// ===== 로그인/로그아웃 (Spring Security 세션 기반) =====
async function handleLogin() {
    const id=document.getElementById('loginId').value.trim(), pw=document.getElementById('loginPassword').value;
    if (!id||!pw) { showAlert('아이디와 비밀번호를 입력해주세요.'); return; }

    try {
        const params = new URLSearchParams();
        params.append('loginId', id);
        params.append('password', pw);

        const res = await fetch('http://localhost:8080/processLogin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            credentials: 'include',
            body: params
        });

        if (!res.ok) { showAlert('아이디 또는 비밀번호가 올바르지 않습니다.'); return; }

        // 로그인 성공 → 세션 쿠키가 발급된 상태이므로 내 정보를 다시 조회
        const meRes = await fetch('http://localhost:8080/api/member/mypage', { credentials: 'include' });
        if (!meRes.ok) { showAlert('로그인 성공했지만 회원 정보를 불러오지 못했습니다.'); return; }
        currentMember = await meRes.json();

        resetKeywordEditMode();
        ensureLocalUserRecord(currentMember.login_id);
        showAlert('로그인 성공!');
        showPage('main');
        setLoggedInUI();
        document.getElementById('loginId').value=''; document.getElementById('loginPassword').value='';
    } catch (e) {
        console.error('로그인 API 호출 실패:', e);
        showAlert('서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
}
function handleLoginEnter(e)         { if (e.key==='Enter') handleLogin(); }
function handleKeywordEnter(e, type) { if (e.key==='Enter' && type==='mypage') addMypageKeyword(); }
async function handleLogout() {
    try {
        await fetch('http://localhost:8080/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
        console.error('로그아웃 API 호출 실패:', e);
    }
    resetKeywordEditMode();
    setLoggedOutUI();
    showAlert('로그아웃되었습니다.'); showPage('main');
}

// ===== 키워드 (백엔드 /api/member/keywords 연동) =====
let userKeywords = [];

// 서버에서 로그인한 회원의 관심 키워드 목록을 가져옴
async function fetchUserKeywords() {
    if (!currentMember) { userKeywords = []; return userKeywords; }
    try {
        const res = await fetch('http://localhost:8080/api/member/keywords', { credentials: 'include' });
        if (!res.ok) { userKeywords = []; return userKeywords; }
        userKeywords = await res.json();
    } catch (e) {
        console.error('키워드 조회 API 호출 실패:', e);
        userKeywords = [];
    }
    return userKeywords;
}

// 키워드 전체 목록을 서버에 저장 (덮어쓰기 방식)
async function saveUserKeywordsToServer(keywords) {
    try {
        const res = await fetch('http://localhost:8080/api/member/keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(keywords)
        });
        if (!res.ok) { showAlert('키워드 저장에 실패했습니다.'); return false; }
        return true;
    } catch (e) {
        console.error('키워드 저장 API 호출 실패:', e);
        showAlert('서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
        return false;
    }
}

async function loadUserKeywords() {
    await fetchUserKeywords();
    const kws = userKeywords;
    document.getElementById('keywordList').innerHTML = kws.length===0
        ? '<p style="color:#999;text-align:center;padding:20px;">등록된 키워드가 없습니다.</p>'
        : kws.map(kw=>`<div class="keyword-item" onclick="searchByKeyword('${kw}')"><span class="keyword-item-text">${kw}</span></div>`).join('');
    loadMypageKeywordList();
}
async function loadMyPage() {
    try {
        const res = await fetch('http://localhost:8080/api/member/mypage', { credentials: 'include' });
        if (!res.ok) { showAlert('회원 정보를 불러올 수 없습니다. 다시 로그인해주세요.'); showPage('login'); return; }
        currentMember = await res.json();
        ensureLocalUserRecord(currentMember.login_id);

        document.getElementById('userIdDisplay').textContent = currentMember.login_id;
        document.getElementById('userUsernameDisplay').textContent = currentMember.username || '-';
        document.getElementById('userEmailDisplay').textContent = currentMember.email || '-';
        document.getElementById('userPhoneDisplay').textContent = currentMember.phone || '-';
        loadUserKeywordsMypage(); loadNotifications();
    } catch (e) {
        console.error('마이페이지 조회 API 호출 실패:', e);
        showAlert('서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
}
let isEditMode=false, originalUsername='', originalEmail='', originalPhone='';
function toggleEditMode() {
    isEditMode=!isEditMode;
    const um=document.getElementById('userUsernameDisplay'), em=document.getElementById('userEmailDisplay'), pm=document.getElementById('userPhoneDisplay');
    document.getElementById('editBtn').style.display=isEditMode?'none':'block';
    document.getElementById('editButtons').style.display=isEditMode?'block':'none';
    if (isEditMode) {
        originalUsername=um.textContent; originalEmail=em.textContent; originalPhone=pm.textContent;
        um.innerHTML=`<input type="text" id="editUsername" value="${originalUsername}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">`;
        em.innerHTML=`<input type="email" id="editEmail" value="${originalEmail}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">`;
        pm.innerHTML=`<input type="tel" id="editPhone" value="${originalPhone}" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">`;
    }
}
function cancelEdit() {
    isEditMode=false;
    document.getElementById('editBtn').style.display='block';
    document.getElementById('editButtons').style.display='none';
    document.getElementById('userUsernameDisplay').textContent=originalUsername;
    document.getElementById('userEmailDisplay').textContent=originalEmail;
    document.getElementById('userPhoneDisplay').textContent=originalPhone;
}
async function saveUserInfo() {
    const nu=document.getElementById('editUsername').value.trim();
    const ne=document.getElementById('editEmail').value.trim(), np=document.getElementById('editPhone').value.trim();
    if (!nu||!ne||!np) { showAlert('이름, 이메일, 전화번호를 모두 입력해주세요.'); return; }

    try {
        const res = await fetch('http://localhost:8080/api/member/mypage', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: nu, email: ne, phone: np })
        });
        if (!res.ok) { showAlert('회원정보 수정에 실패했습니다.'); return; }

        if (currentMember) { currentMember.username = nu; currentMember.email = ne; currentMember.phone = np; }
        isEditMode=false;
        document.getElementById('editBtn').style.display='block';
        document.getElementById('editButtons').style.display='none';
        document.getElementById('userUsernameDisplay').textContent=nu;
        document.getElementById('userEmailDisplay').textContent=ne;
        document.getElementById('userPhoneDisplay').textContent=np;
        showAlert('회원정보가 수정되었습니다.');
    } catch (e) {
        console.error('회원정보 수정 API 호출 실패:', e);
        showAlert('서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
}
async function loadUserKeywordsMypage() { await fetchUserKeywords(); loadMypageKeywordList(); }
let isKeywordEditMode=false;
function loadMypageKeywordList() {
    const kws=userKeywords, kc=DB.getKeywordChecks();
    const container=document.getElementById('mypageKeywordList');
    if (kws.length===0) { container.innerHTML='<p style="color:#999;text-align:center;padding:20px;">등록된 키워드가 없습니다.</p>'; return; }
    // 명시적으로 체크 해제(false)한 적 없으면 기본값은 "체크됨"(알림 켜짐)
    const isChecked = kw => kc[kw] !== false;
    const sorted=[...kws].sort((a,b)=>{ const ac=isChecked(a),bc=isChecked(b); if(ac&&!bc)return -1; if(!ac&&bc)return 1; return a.localeCompare(b,'ko'); });
    container.innerHTML=sorted.map(kw=>`
        <div class="keyword-item ${isKeywordEditMode?'edit-mode':''} ${isChecked(kw)?'checked':''}" onclick="event.stopPropagation()">
            <input type="checkbox" class="keyword-item-checkbox" ${isChecked(kw)?'checked':''} onchange="toggleKeywordCheck('${kw}',this.checked)">
            <span class="keyword-item-text">${kw}</span>
            <button class="keyword-item-delete" onclick="deleteKeyword('${kw}')"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join('');
}
function toggleKeywordCheck(kw,checked) { DB.setKeywordCheck(kw,checked); loadMypageKeywordList(); fetchNotificationsFromDB(); }
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

// ===== 키워드 팝업 =====
let popupKeyword = '';

function openKeywordPopup(val) {
    if (!val || val.trim() === '') return;
    popupKeyword = val.trim();
    document.getElementById('keywordPopupInput').value = popupKeyword;
    renderPopupTag(popupKeyword);
    document.getElementById('keywordPopup').classList.add('show');
    document.getElementById('keywordPopupInput').focus();
}

function closeKeywordPopup() {
    document.getElementById('keywordPopup').classList.remove('show');
    document.getElementById('mypageKeywordInput').value = '';
    popupKeyword = '';
    renderPopupTag('');
}

function syncKeywordInput(val) {
    popupKeyword = val.trim();
    renderPopupTag(popupKeyword);
}

function renderPopupTag(kw) {
    const wrap = document.getElementById('keywordPopupTag');
    if (!kw) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `<span class="keyword-popup-tag">${kw}<button onclick="clearPopupTag()">×</button></span>`;
}

function clearPopupTag() {
    popupKeyword = '';
    document.getElementById('keywordPopupInput').value = '';
    document.getElementById('keywordPopupTag').innerHTML = '';
}

function handlePopupEnter(e) { if (e.key === 'Enter') confirmKeywordPopup(); }

async function confirmKeywordPopup() {
    const kw = popupKeyword || document.getElementById('keywordPopupInput').value.trim();
    if (!kw) return;
    if (userKeywords.includes(kw)) { showAlert('이미 존재하는 키워드입니다.'); return; }
    const ok = await saveUserKeywordsToServer([...userKeywords, kw]);
    if (!ok) return;
    await loadUserKeywords();
    updateBidStats();
    closeKeywordPopup();
    showAlert(`'${kw}' 키워드가 등록되었습니다.`);
}

document.addEventListener('click', e => {
    const popup = document.getElementById('keywordPopup');
    const inner = document.querySelector('.keyword-popup-inner');
    if (popup && popup.classList.contains('show') && inner && !inner.contains(e.target)) {
        closeKeywordPopup();
    }
});

async function deleteKeyword(kw) {
    if (!confirm('삭제하시겠습니까?')) return;
    const ok = await saveUserKeywordsToServer(userKeywords.filter(k=>k!==kw));
    if (!ok) return;
    await loadUserKeywords();
    updateBidStats();
}

// ===== 알림 (백엔드 /api/notifications 연동) =====
function loadNotifications() { fetchNotificationsFromDB(); }
function loadNotificationDropdown() { fetchNotificationsFromDB(); }

// 각 요청 종류별로 "가장 마지막에 보낸 요청의 응답만" 반영하기 위한 순번 (서로 다른 종류끼리는 간섭하지 않음)
let listFetchSeq = 0;

// 직전에 확인한 안읽은 알림 개수 (null이면 아직 모름 = 최초 로드, 이때는 토스트를 띄우지 않음)
let lastKnownUnreadCount = null;

// 뱃지 숫자를 갱신하고, 개수가 "늘어났을 때"만 화면 우측 상단에 토스트로 알려줌
function applyUnreadCount(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) { badge.textContent = count; badge.style.display = count === 0 ? 'none' : 'flex'; }

    if (lastKnownUnreadCount !== null && count > lastKnownUnreadCount) {
        showNotificationToast(count - lastKnownUnreadCount);
    }
    lastKnownUnreadCount = count;
}

// 새 알림 도착을 알려주는 자동 소멸 토스트 (새로고침 없이도 눈에 띄게)
function showNotificationToast(newCount) {
    let toast = document.getElementById('liveNotiToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'liveNotiToast';
        toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#2563eb;color:#fff;padding:14px 20px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,0.2);font-size:14px;font-weight:600;z-index:99999;cursor:pointer;transition:opacity 0.3s;max-width:320px;';
        toast.onclick = () => { toast.style.display='none'; toggleNotificationDropdown(); };
        document.body.appendChild(toast);
    }
    toast.textContent = `🔔 새로운 알림이 ${newCount}건 도착했습니다`;
    toast.style.opacity = '1';
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 4000);
}

// 마이페이지 "관심 키워드"에서 체크(✓) 해제된 키워드인지 확인 (명시적으로 체크 해제한 것만 알림에서 제외, 기본은 켜짐)
function isKeywordChecked(keyword) {
    const kc = DB.getKeywordChecks();
    return kc[keyword] !== false;
}

// 알림 목록 전체 조회 (드롭다운을 열거나 마이페이지 진입 시, 또는 폴링 시 호출)
// + 체크된 키워드의 알림만 남기고 필터링
async function fetchNotificationsFromDB() {
    if (!currentMember) { renderNotifications([]); return; }
    const seq = ++listFetchSeq;
    try {
        const res = await fetch('http://localhost:8080/api/notifications', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
            if (res.status === 401) renderNotifications([]);
            return;
        }
        const notis = await res.json();
        if (seq !== listFetchSeq) return; // 그 사이 더 최신 "목록 조회"가 있었으면 이 응답은 무시 (깜빡임 방지)
        renderNotifications(notis.filter(n => isKeywordChecked(n.keyword)));
    } catch (e) {
        console.error('알림 조회 API 호출 실패:', e);
    }
}

// 뱃지 갱신 (체크된 키워드만 반영해야 하므로 전체 목록을 받아와서 판단 → fetchNotificationsFromDB에 위임)
async function updateUnreadBadge() {
    if (!currentMember) {
        const badge = document.getElementById('notificationBadge');
        if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
        lastKnownUnreadCount = null;
        return;
    }
    await fetchNotificationsFromDB();
}

// 새로고침 없이 실시간에 가깝게 알림 갱신 (뱃지 + 열려있는 드롭다운/마이페이지 알림탭 내용까지 함께 갱신)
function pollNotifications() {
    if (!currentMember) return;
    fetchNotificationsFromDB();
}

// 알림 읽음 처리 (서버에 PUT 요청)
async function markNotificationRead(notificationId) {
    if (!notificationId) return;
    try {
        await fetch(`http://localhost:8080/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            credentials: 'include'
        });
    } catch (e) {
        console.error('알림 읽음 처리 실패:', e);
    }
}

// 전체 알림 읽음 처리
async function markAllNotificationsRead() {
    if (!currentMember) return;
    try {
        const res = await fetch('http://localhost:8080/api/notifications/read-all', {
            method: 'PUT',
            credentials: 'include'
        });
        if (!res.ok) { showAlert('전체 읽음 처리에 실패했습니다.'); return; }
        await fetchNotificationsFromDB();
    } catch (e) {
        console.error('전체 읽음 처리 실패:', e);
        showAlert('서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }
}

function renderNotifications(notis) {
    const unreadCount = notis.filter(n => !n.is_read).length;
    applyUnreadCount(unreadCount);

    const dropdownContent = document.getElementById('notificationDropdownContent');
    if (dropdownContent) {
        if (notis.length === 0) {
            dropdownContent.innerHTML = '<div class="notification-dropdown-empty">새로운 알림이 없습니다.</div>';
        } else {
            dropdownContent.innerHTML = notis.slice(0,5).map(n => `
                <div class="notification-dropdown-item" onclick="goToNoticeDetail('${n.notice_number}', ${n.notification_id})" style="cursor:pointer;${n.is_read ? 'background:#f3f4f6;opacity:0.65;' : ''}">
                    <strong style="color:#2563eb;">[${n.keyword || '알림'}]</strong> ${n.notice_title || '새로운 공고가 등록되었습니다.'}<br>
                    <span style="font-size:11px;color:#9ca3af;">${n.created_at || '-'}${n.is_read ? ' · 읽음' : ''}</span>
                </div>`).join('');
        }
    }

    const mypageList = document.getElementById('notificationList');
    if (mypageList) {
        if (notis.length === 0) {
            mypageList.innerHTML = '<div class="no-notification">새로운 입찰공고 알림이 없습니다.</div>';
        } else {
            mypageList.innerHTML = notis.map(n => `
                <div class="notification-item" onclick="goToNoticeDetail('${n.notice_number}', ${n.notification_id})"
                     style="cursor:pointer;margin-bottom:10px;border-left:4px solid ${n.is_read ? '#d1d5db' : '#2563eb'};padding:10px 15px;border-radius:6px;
                            background:${n.is_read ? '#f3f4f6' : '#eff6ff'};">
                    <div>
                        <span style="background:${n.is_read ? '#e5e7eb' : '#e0e7ff'};color:${n.is_read ? '#6b7280' : '#4338ca'};padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;margin-right:8px;">${n.keyword || '알림'}</span>
                        <strong style="color:${n.is_read ? '#9ca3af' : '#111827'};">${n.notice_title || '공고 정보를 불러오는 중...'}</strong>
                        ${n.is_read ? '<span style="margin-left:8px;font-size:11px;color:#9ca3af;">✓ 읽음</span>' : ''}
                    </div>
                    <span class="date" style="font-size:12px;color:#6b7280;">${n.created_at || '-'}</span>
                    <button class="delete-noti" onclick="event.stopPropagation(); deleteNotification(${n.notification_id})" title="읽음 처리">×</button>
                </div>`).join('');
        }
    }
}

// 백엔드에 알림 삭제 API가 없어, 읽음 처리 후 목록을 새로고침하는 방식으로 동작
async function deleteNotification(notificationId) {
    await markNotificationRead(notificationId);
    await fetchNotificationsFromDB();
}

function toggleNotificationDropdown() {
    const d=document.getElementById('notificationDropdown'); d.classList.toggle('show');
    if (d.classList.contains('show')) fetchNotificationsFromDB();
}

document.addEventListener('click', e => {
    const d=document.getElementById('notificationDropdown'), bell=document.getElementById('notificationBell');
    if (d && bell && !bell.contains(e.target)&&!d.contains(e.target)) d.classList.remove('show');
});

async function addMypageKeyword() {
    const input=document.getElementById('mypageKeywordInput'), val=input.value.trim();
    if (!val) return;
    if (userKeywords.includes(val)) { showAlert('이미 존재하는 키워드입니다.'); input.value=''; return; }
    const ok = await saveUserKeywordsToServer([...userKeywords, val]);
    input.value='';
    if (!ok) return;
    await loadUserKeywords();
    updateBidStats();
}
function openBulkDeleteModal() {
    const kws=userKeywords, c=document.getElementById('bulkDeleteList');
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
    bulkDeleteCallback=async ()=>{
        const ok = await saveUserKeywordsToServer(userKeywords.filter(kw=>!toDel.includes(kw)));
        if (ok) { await loadUserKeywords(); updateBidStats(); }
        toggleKeywordEditMode();
        setTimeout(()=>showAlert('선택한 키워드가 삭제되었습니다.'),100);
    };
    showConfirm('일괄 삭제하시겠습니까?');
}
function showConfirm(msg)  { document.getElementById('confirmMessage').textContent=msg; document.getElementById('confirmModal').classList.add('show'); }
function closeConfirm()    { document.getElementById('confirmModal').classList.remove('show'); }
function confirmAction()   { if (bulkDeleteCallback) { const cb=bulkDeleteCallback; bulkDeleteCallback=null; closeConfirm(); closeBulkDeleteModal(); cb(); } else closeConfirm(); }

// ===== Alert =====
function showAlert(msg) { document.getElementById('alertMessage').textContent=msg; document.getElementById('alertModal').classList.add('show'); setTimeout(()=>document.getElementById('alertModal').focus(),100); }
function closeAlert()   { document.getElementById('alertModal').classList.remove('show'); }
document.addEventListener('keypress', e => { if (e.key==='Enter'&&document.getElementById('alertModal').classList.contains('show')) closeAlert(); });