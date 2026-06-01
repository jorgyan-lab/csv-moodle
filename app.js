/* ==========================================================================
   GLOBAL APP STATE & INITIALIZATION
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Theme
    initTheme();

    // 2. Initialize Gerador Shift-Select event
    const sheetBody = document.getElementById('sheetBody');
    if (sheetBody) {
        sheetBody.addEventListener('click', handleShiftSelectClick);
    }

    // 3. Initialize Gerador Live Listeners
    const courseNameInput = document.getElementById('courseName');
    if (courseNameInput) {
        courseNameInput.addEventListener('input', () => {
            document.getElementById('courseNameError').textContent = '';
        });
    }

    // 4. Initialize Validador Live Listeners
    initValidadorListeners();

    // 5. Initialize Gerador window drag and drop
    initGeradorDragAndDrop();

    // 6. Pre-fill Gerador table with first row if empty
    if (sheetBody && sheetBody.children.length === 0) {
        addRow();
    }
});

/* ==========================================================================
   NAVIGATION & BREADCRUMBS
   ========================================================================== */

function navigateTo(sectionId) {
    // Hide all sections and show selected one
    document.querySelectorAll('.app-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    // Update active nav item class
    document.querySelectorAll('.nav-menu-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNavItem = document.querySelector(`.nav-menu-item[data-target="${sectionId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }

    // Update Breadcrumb Text
    const breadcrumbLabel = document.getElementById('header-active-tab');
    if (breadcrumbLabel) {
        if (sectionId === 'section-inicio') breadcrumbLabel.textContent = 'Início';
        else if (sectionId === 'section-gerador') breadcrumbLabel.textContent = 'Extrator / Gerador';
        else if (sectionId === 'section-validador') breadcrumbLabel.textContent = 'Validador de CSV';
    }

    // Scroll main panel back to top
    const mainContent = document.querySelector('.app-main-content');
    if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/* ==========================================================================
   THEME MANAGER (Claro / Escuro Toggle)
   ========================================================================== */

function initTheme() {
    const savedTheme = localStorage.getItem('moodle-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        setTheme('dark');
    } else {
        setTheme('light');
    }
}

function setTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('theme-btn-dark').classList.add('active');
        document.getElementById('theme-btn-light').classList.remove('active');
    } else {
        document.body.classList.remove('dark-theme');
        document.getElementById('theme-btn-light').classList.add('active');
        document.getElementById('theme-btn-dark').classList.remove('active');
    }
    localStorage.setItem('moodle-theme', theme);
}

/* ==========================================================================
   SHARED HELPERS & VALIDATORS
   ========================================================================== */

function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    
    // Add check or warning symbol based on type
    const icon = type === 'success' ? '✓ ' : '⚠️ ';
    t.textContent = icon + msg;
    
    c.appendChild(t);
    
    setTimeout(() => { 
        t.classList.add('exit'); 
        setTimeout(() => t.remove(), 300); 
    }, 3000);
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function validateEmail(e) {
    if (/[àáâãäéèêëíìîïóòôõöúùûüçÀÁÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/.test(e)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function validateCPF(cpf) {
    cpf = cpf.replace(/[\.\-]/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    let r = (s * 10) % 11; if (r === 10) r = 0;
    if (r !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    r = (s * 10) % 11; if (r === 10) r = 0;
    return r === parseInt(cpf[10]);
}

function hasAccentsOrSpecial(str) {
    if (typeof str !== 'string') return false;
    const normalized = str.normalize("NFD");
    const hasDiacritics = /[\u0300-\u036f]/.test(normalized);
    const hasCAndCedilla = /[çÇ]/.test(str);
    return hasDiacritics || hasCAndCedilla;
}

function validateLogin(loginVal) {
    const v = String(loginVal || '').trim();
    if (!v) return { valid: false, msg: 'login é obrigatório.' };
    if (hasAccentsOrSpecial(v)) return { valid: false, msg: 'login não pode conter acentos ou ç.' };
    
    const cleanVal = v.replace(/[\.\-]/g, '');
    if (/^\d{11}$/.test(cleanVal)) {
        if (!validateCPF(cleanVal)) {
            return { valid: false, msg: 'CPF inválido.' };
        }
    }
    return { valid: true };
}

function inferIdType(value) {
    const cleaned = value.replace(/[\.\-]/g, '');
    if (/^\d+$/.test(cleaned)) {
        if (cleaned.length === 7) return 'SIAPE';
        if (cleaned.length > 7) return 'CPF';
        return 'NUMÉRICO_CURTO'; // less than 7 digits — possibly wrong SIAPE
    }
    return 'MATRÍCULA';
}

/* ==========================================================================
   MODULE 1: GERADOR DE CSV LOGIC
   ========================================================================== */

let courseName = '';
let rowId = 0;

const ROLES_OPTIONS = [
    'Aluno','Professor Formador','Tutor à Distância','Tutor Presencial',
    'Editor Moodle','Coordenador de Curso','Coordenador de Polo','Monitor'
];
const ROLES_MAP = {
    'Editor Moodle':2,'Professor Formador':3,'Tutor à Distância':4,'Aluno':5,
    'Coordenador de Curso':9,'Tutor Presencial':10,'Coordenador de Polo':11,'Monitor':28
};

function applyBulkRoleToSelected(role) {
    const checkboxes = document.querySelectorAll('#sheetBody tr .row-selector:checked');
    if (checkboxes.length === 0) {
        showToast('Marque a caixinha das linhas que deseja alterar.', 'error');
        return;
    }
    
    const roleClassMap = {
        'Aluno': 'row-role-aluno',
        'Professor Formador': 'row-role-professor',
        'Tutor à Distância': 'row-role-tutor-dist',
        'Tutor Presencial': 'row-role-tutor-pres',
        'Editor Moodle': 'row-role-editor',
        'Coordenador de Curso': 'row-role-coord-curso',
        'Coordenador de Polo': 'row-role-coord-polo',
        'Monitor': 'row-role-monitor'
    };
    
    const className = roleClassMap[role];
    
    checkboxes.forEach(cb => {
        const tr = cb.closest('tr');
        if (!tr) return;
        
        const select = tr.querySelector('[data-field="papel"]');
        if (select) {
            select.value = role;
            select.dispatchEvent(new Event('change'));
        }
        
        // Remove any previous role classes
        Object.values(roleClassMap).forEach(cls => tr.classList.remove(cls));
        
        // Add new role class
        if (className) {
            tr.classList.add(className);
        }
        
        // Uncheck
        cb.checked = false;
    });
    
    // Reset header checkbox
    const headerCb = document.getElementById('selectAllRows');
    if (headerCb) {
        headerCb.checked = false;
        headerCb.indeterminate = false;
    }
    
    showToast(`Papel "${role}" aplicado a ${checkboxes.length} linha(s) selecionada(s)!`);
}

function toggleSelectAll(selectAllCb) {
    const checkcbs = document.querySelectorAll('#sheetBody tr .row-selector');
    checkcbs.forEach(cb => {
        cb.checked = selectAllCb.checked;
    });
}

function onRowSelectChange() {
    const total = document.querySelectorAll('#sheetBody tr .row-selector').length;
    const checked = document.querySelectorAll('#sheetBody tr .row-selector:checked').length;
    const headerCb = document.getElementById('selectAllRows');
    if (headerCb) {
        headerCb.checked = (total > 0 && total === checked);
        headerCb.indeterminate = (checked > 0 && checked < total);
    }
}

/* Shift-Select Row Functionality */
let lastCheckedCheckbox = null;

function handleShiftSelectClick(e) {
    const target = e.target;
    if (!target.classList.contains('row-selector')) return;

    if (lastCheckedCheckbox && !document.body.contains(lastCheckedCheckbox)) {
        lastCheckedCheckbox = null;
    }

    if (e.shiftKey && lastCheckedCheckbox && lastCheckedCheckbox !== target) {
        const checkboxes = Array.from(document.querySelectorAll('#sheetBody .row-selector'));
        const start = checkboxes.indexOf(target);
        const end = checkboxes.indexOf(lastCheckedCheckbox);
        
        if (start !== -1 && end !== -1) {
            const min = Math.min(start, end);
            const max = Math.max(start, end);
            for (let i = min; i <= max; i++) {
                checkboxes[i].checked = target.checked;
            }
            onRowSelectChange();
        }
    }
    
    lastCheckedCheckbox = target;
}

function setupLiveValidation(el, validator) {
    el.addEventListener('blur', function() {
        const v = (el.value || '').trim();
        if (v && !validator(this)) {
            this.classList.add('has-error');
        }
    });
    const clearIfValid = function() {
        if (this.classList.contains('has-error') && validator(this)) {
            this.classList.remove('has-error');
        }
    };
    el.addEventListener('input', clearIfValid);
    el.addEventListener('change', clearIfValid);
}

function setupRow(tr) {
    const nome = tr.querySelector('[data-field="nome"]');
    const sobrenome = tr.querySelector('[data-field="sobrenome"]');
    const email = tr.querySelector('[data-field="email"]');
    const papel = tr.querySelector('[data-field="papel"]');
    const idval = tr.querySelector('[data-field="idvalue"]');

    setupLiveValidation(nome, el => el.value.trim().length > 0);
    setupLiveValidation(sobrenome, el => el.value.trim().length > 0);
    setupLiveValidation(email, el => { const v = el.value.trim(); return v.length > 0 && validateEmail(v); });
    setupLiveValidation(papel, el => el.value !== '');
    setupLiveValidation(idval, el => validateLogin(el.value).valid);

    papel.addEventListener('change', function() {
        const roleClassMap = {
            'Aluno': 'row-role-aluno',
            'Professor Formador': 'row-role-professor',
            'Tutor à Distância': 'row-role-tutor-dist',
            'Tutor Presencial': 'row-role-tutor-pres',
            'Editor Moodle': 'row-role-editor',
            'Coordenador de Curso': 'row-role-coord-curso',
            'Coordenador de Polo': 'row-role-coord-polo',
            'Monitor': 'row-role-monitor'
        };
        Object.values(roleClassMap).forEach(cls => tr.classList.remove(cls));
        const className = roleClassMap[this.value];
        if (className) {
            tr.classList.add(className);
        }
    });
}

function validateExistingRows() {
    const rows = document.querySelectorAll('#sheetBody tr');
    let allValid = true;
    let firstBad = null;
    let errorMsg = '';
    
    for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        const n = i + 1;
        const nome = tr.querySelector('[data-field="nome"]');
        const sobrenome = tr.querySelector('[data-field="sobrenome"]');
        const email = tr.querySelector('[data-field="email"]');
        const idval = tr.querySelector('[data-field="idvalue"]');

        [nome, sobrenome, email, idval].forEach(el => el.classList.remove('has-error'));

        function markBad(el, msg) {
            el.classList.add('has-error');
            if (allValid) {
                allValid = false;
                firstBad = el;
                errorMsg = `Linha ${n}: ${msg}`;
            }
        }

        if (!nome.value.trim()) { markBad(nome, 'Nome é obrigatório.'); continue; }
        if (!sobrenome.value.trim()) { markBad(sobrenome, 'Sobrenome é obrigatório.'); continue; }
        
        const ev = email.value.trim();
        if (!ev) { markBad(email, 'Email é obrigatório.'); continue; }
        else if (!validateEmail(ev)) { markBad(email, 'Email inválido (não use acentos ou ç).'); continue; }
        
        const loginRes = validateLogin(idval.value);
        if (!loginRes.valid) { markBad(idval, loginRes.msg); continue; }
    }
    return { allValid, firstBad, errorMsg };
}

function addRow() {
    const existing = document.querySelectorAll('#sheetBody tr');
    if (existing.length > 0) {
        const { allValid, firstBad, errorMsg } = validateExistingRows();
        if (!allValid) {
            if (firstBad) firstBad.focus();
            showToast(errorMsg || 'Corrija os erros antes de adicionar nova linha.', 'error');
            return;
        }
    }
    rowId++;
    const id = rowId;
    const tr = document.createElement('tr');
    tr.id = 'row-' + id;
    tr.innerHTML = `
        <td class="cell-select-col"><input type="checkbox" class="row-selector" data-row="${id}" onchange="onRowSelectChange()"></td>
        <td><input class="cell-input" data-field="nome" placeholder="Nome" data-row="${id}"></td>
        <td><input class="cell-input" data-field="sobrenome" placeholder="Sobrenome" data-row="${id}"></td>
        <td><input class="cell-input" data-field="email" placeholder="email@exemplo.com" data-row="${id}"></td>
        <td><input class="cell-input" data-field="idvalue" placeholder="login (CPF, SIAPE ou Matrícula)" data-row="${id}" maxlength="30"></td>
        <td><input class="cell-input" data-field="grupo" placeholder="Grupo (opcional)" data-row="${id}"></td>
        <td><select class="cell-select" data-field="papel" data-row="${id}">
            <option value="">Selecione</option>
            ${ROLES_OPTIONS.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select></td>
        <td><button class="btn-remove" onclick="removeRow(${id})" title="Remover linha">×</button></td>
    `;
    document.getElementById('sheetBody').appendChild(tr);

    setupRow(tr);

    const nome = tr.querySelector('[data-field="nome"]');
    nome.focus();
    onRowSelectChange();
}

function removeRow(id) {
    const row = document.getElementById('row-' + id);
    if (row) row.remove();
    // If no rows left, add one
    if (document.getElementById('sheetBody').children.length === 0) addRow();
    onRowSelectChange();
}

function generateCSV() {
    const nameInput = document.getElementById('courseName');
    const nameErr = document.getElementById('courseNameError');
    nameErr.textContent = '';
    const name = nameInput.value.trim();
    if (!name) {
        nameErr.textContent = 'Informe o nome da sala.';
        nameInput.focus();
        nameInput.classList.add('has-error');
        showToast('Informe o nome da sala no topo do Gerador.', 'error');
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    courseName = name;

    const tbody = document.getElementById('sheetBody');
    const rows = tbody.querySelectorAll('tr');
    const errContainer = document.getElementById('sheetErrors');
    errContainer.innerHTML = '';
    
    // Clear previous errors
    tbody.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    nameInput.classList.remove('has-error');

    const users = [];
    const errors = [];

    rows.forEach((tr, idx) => {
        const n = idx + 1;
        const nome = tr.querySelector('[data-field="nome"]');
        const sobrenome = tr.querySelector('[data-field="sobrenome"]');
        const email = tr.querySelector('[data-field="email"]');
        const papel = tr.querySelector('[data-field="papel"]');
        const idval = tr.querySelector('[data-field="idvalue"]');
        const grupo = tr.querySelector('[data-field="grupo"]');

        const nv = nome.value.trim(), sv = sobrenome.value.trim(), ev = email.value.trim();
        const pv = papel.value, iv = idval.value.trim(), gv = grupo.value.trim();

        // Skip completely empty rows
        if (!nv && !sv && !ev && !pv && !iv && !gv) return;

        let rowOk = true;
        function err(el, msg) { el.classList.add('has-error'); errors.push(`Linha ${n}: ${msg}`); rowOk = false; }

        if (!nv) err(nome, 'Nome é obrigatório.');
        if (!sv) err(sobrenome, 'Sobrenome é obrigatório.');
        if (!ev) err(email, 'Email é obrigatório.');
        else if (!validateEmail(ev)) err(email, 'Email inválido.');
        if (!pv) err(papel, 'Selecione o papel.');

        const loginRes = validateLogin(iv);
        if (!loginRes.valid) {
            err(idval, loginRes.msg);
        }

        if (rowOk) {
            const cleanVal = iv.replace(/[\.\-]/g, '');
            let username = '';
            if (/^\d{11}$/.test(cleanVal)) {
                username = cleanVal;
            } else {
                username = iv.toLowerCase();
            }
            users.push({ firstName: nv, lastName: sv, email: ev, role: ROLES_MAP[pv] || '', group: gv, username, idnumber: username });
        }
    });

    if (errors.length > 0) {
        errContainer.innerHTML = errors.map(e => `<div class="sheet-error-item">⚠️ ${e}</div>`).join('');
        showToast('Corrija os erros indicados.', 'error');
        return;
    }
    if (users.length === 0) {
        showToast('Preencha pelo menos uma linha.', 'error');
        return;
    }

    // Build CSV
    const csvRows = [['firstname','lastname','username','email','course1','group1','role1','idnumber','password']];
    users.forEach(u => {
        csvRows.push([u.firstName, u.lastName, u.username, u.email, courseName, u.group, u.role, u.idnumber, 'Mud@r123']);
    });
    const csv = csvRows.map(r => r.map(c => {
        const s = String(c);
        return (s.includes(';') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (courseName.replace(/[^a-zA-Z0-9]/g, '_') || 'usuarios') + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast(`CSV gerado com ${users.length} usuário(s)!`);
}

function clearGerador() {
    // Clear course name input
    const courseNameInput = document.getElementById('courseName');
    if (courseNameInput) {
        courseNameInput.value = '';
        courseNameInput.classList.remove('has-error');
    }
    const courseNameError = document.getElementById('courseNameError');
    if (courseNameError) {
        courseNameError.textContent = '';
    }

    // Clear sheet body rows
    const sheetBody = document.getElementById('sheetBody');
    if (sheetBody) {
        sheetBody.innerHTML = '';
    }

    // Reset row ID count
    rowId = 0;

    // Clear validation errors container
    const sheetErrors = document.getElementById('sheetErrors');
    if (sheetErrors) {
        sheetErrors.innerHTML = '';
    }

    // Reset selectAllRows checkbox state
    const headerCb = document.getElementById('selectAllRows');
    if (headerCb) {
        headerCb.checked = false;
        headerCb.indeterminate = false;
    }

    // Reset shift selection helper
    lastCheckedCheckbox = null;

    // Re-add a single clean row
    addRow();

    showToast('Gerador limpo com sucesso!');
}

/* Guide Modal Helpers */
function openGuideModal() {
    const m = document.getElementById('guideModal');
    if (m) m.style.display = 'flex';
}
function closeGuideModal() {
    const m = document.getElementById('guideModal');
    if (m) m.style.display = 'none';
}

/* Spreadsheet Import Logic for Gerador */
function importSpreadsheetFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const bytes = new Uint8Array(e.target.result);
            const wb = XLSX.read(bytes, { type: 'array' });
            const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
            
            if (raw.length === 0) {
                showToast('A planilha importada está vazia.', 'error');
                return;
            }

            const nomeKey = Object.keys(raw[0]).find(k => ['nome', 'firstname', 'first name', 'name'].includes(k.trim().toLowerCase()));
            const sobrenomeKey = Object.keys(raw[0]).find(k => ['sobrenome', 'lastname', 'last name', 'surname', 'apelido'].includes(k.trim().toLowerCase()));
            
            if (!nomeKey || !sobrenomeKey) {
                showToast('A planilha deve conter pelo menos as colunas "nome" e "sobrenome".', 'error');
                return;
            }

            const emailKey = Object.keys(raw[0]).find(k => ['email', 'e-mail', 'mail'].includes(k.trim().toLowerCase()));
            const loginKey = Object.keys(raw[0]).find(k => ['login', 'username', 'idnumber', 'cpf/siape/matrícula', 'cpf/siape/matricula', 'login (cpf, siape ou matrícula)', 'login (cpf, siape ou matricula)'].includes(k.trim().toLowerCase()));
            const grupoKey = Object.keys(raw[0]).find(k => ['grupo', 'group1', 'group', 'grupo (opcional)'].includes(k.trim().toLowerCase()));
            const papelKey = Object.keys(raw[0]).find(k => ['papel', 'role1', 'role'].includes(k.trim().toLowerCase()));

            // Clear existing empty rows in the table
            const tbody = document.getElementById('sheetBody');
            const rows = tbody.querySelectorAll('tr');
            if (rows.length === 1) {
                const firstRow = rows[0];
                const n = firstRow.querySelector('[data-field="nome"]').value.trim();
                const s = firstRow.querySelector('[data-field="sobrenome"]').value.trim();
                const em = firstRow.querySelector('[data-field="email"]').value.trim();
                const idv = firstRow.querySelector('[data-field="idvalue"]').value.trim();
                if (!n && !s && !em && !idv) {
                    firstRow.remove();
                }
            }

            let importedCount = 0;
            raw.forEach(row => {
                const nomeVal = String(row[nomeKey] || '').trim();
                const sobrenomeVal = String(row[sobrenomeKey] || '').trim();
                
                if (!nomeVal && !sobrenomeVal) return;

                const emailVal = emailKey ? String(row[emailKey] || '').trim() : '';
                const loginVal = loginKey ? String(row[loginKey] || '').trim() : '';
                const grupoVal = grupoKey ? String(row[grupoKey] || '').trim() : '';
                const papelVal = papelKey ? String(row[papelKey] || '').trim() : '';

                // Add row
                rowId++;
                const id = rowId;
                const tr = document.createElement('tr');
                tr.id = 'row-' + id;
                
                let roleVal = '';
                if (papelVal) {
                    const cleanPapel = papelVal.trim();
                    if (ROLES_OPTIONS.includes(cleanPapel)) {
                        roleVal = cleanPapel;
                    } else {
                        const matchKey = Object.keys(ROLES_MAP).find(k => String(ROLES_MAP[k]) === cleanPapel);
                        if (matchKey) {
                            roleVal = matchKey;
                        } else if (/aluno/i.test(cleanPapel)) {
                            roleVal = 'Aluno';
                        } else if (/professor/i.test(cleanPapel)) {
                            roleVal = 'Professor Formador';
                        } else if (/tutor.*dist/i.test(cleanPapel) || /dist/i.test(cleanPapel)) {
                            roleVal = 'Tutor à Distância';
                        } else if (/tutor.*pres/i.test(cleanPapel) || /pres/i.test(cleanPapel)) {
                            roleVal = 'Tutor Presencial';
                        } else if (/editor/i.test(cleanPapel)) {
                            roleVal = 'Editor Moodle';
                        } else if (/coord.*curso/i.test(cleanPapel)) {
                            roleVal = 'Coordenador de Curso';
                        } else if (/coord.*polo/i.test(cleanPapel)) {
                            roleVal = 'Coordenador de Polo';
                        } else if (/monitor/i.test(cleanPapel)) {
                            roleVal = 'Monitor';
                        }
                    }
                }

                tr.innerHTML = `
                    <td class="cell-select-col"><input type="checkbox" class="row-selector" data-row="${id}" onchange="onRowSelectChange()"></td>
                    <td><input class="cell-input" data-field="nome" placeholder="Nome" data-row="${id}" value="${escapeHtml(nomeVal)}"></td>
                    <td><input class="cell-input" data-field="sobrenome" placeholder="Sobrenome" data-row="${id}" value="${escapeHtml(sobrenomeVal)}"></td>
                    <td><input class="cell-input" data-field="email" placeholder="email@exemplo.com" data-row="${id}" value="${escapeHtml(emailVal)}"></td>
                    <td><input class="cell-input" data-field="idvalue" placeholder="login (CPF, SIAPE ou Matrícula)" data-row="${id}" maxlength="30" value="${escapeHtml(loginVal)}"></td>
                    <td><input class="cell-input" data-field="grupo" placeholder="Grupo (opcional)" data-row="${id}" value="${escapeHtml(grupoVal)}"></td>
                    <td><select class="cell-select" data-field="papel" data-row="${id}">
                        <option value="">Selecione</option>
                        ${ROLES_OPTIONS.map(r => `<option value="${r}" ${r === roleVal ? 'selected' : ''}>${r}</option>`).join('')}
                    </select></td>
                    <td><button class="btn-remove" onclick="removeRow(${id})" title="Remover linha">×</button></td>
                `;

                if (roleVal) {
                    const roleClassMap = {
                        'Aluno': 'row-role-aluno',
                        'Professor Formador': 'row-role-professor',
                        'Tutor à Distância': 'row-role-tutor-dist',
                        'Tutor Presencial': 'row-role-tutor-pres',
                        'Editor Moodle': 'row-role-editor',
                        'Coordenador de Curso': 'row-role-coord-curso',
                        'Coordenador de Polo': 'row-role-coord-polo',
                        'Monitor': 'row-role-monitor'
                    };
                    tr.classList.add(roleClassMap[roleVal]);
                }

                tbody.appendChild(tr);

                setupRow(tr);

                // Run initial validation to highlight imported errors immediately
                const nome = tr.querySelector('[data-field="nome"]');
                const sobrenome = tr.querySelector('[data-field="sobrenome"]');
                const email = tr.querySelector('[data-field="email"]');
                const idval = tr.querySelector('[data-field="idvalue"]');
                if (!nomeVal) nome.classList.add('has-error');
                if (!sobrenomeVal) sobrenome.classList.add('has-error');
                if (!emailVal || !validateEmail(emailVal)) email.classList.add('has-error');
                if (!loginVal || !validateLogin(loginVal).valid) idval.classList.add('has-error');

                importedCount++;
            });

            if (importedCount > 0) {
                showToast(`${importedCount} linha(s) importada(s) com sucesso!`);
            } else {
                if (tbody.children.length === 0) addRow();
                showToast('Nenhum registro válido pôde ser importado.', 'error');
            }

            onRowSelectChange();
        } catch (err) {
            showToast('Erro ao importar planilha: ' + err.message, 'error');
            if (document.getElementById('sheetBody').children.length === 0) addRow();
        }
    };
    reader.readAsArrayBuffer(file);
}

function handleSpreadsheetImport(input) {
    const file = input.files[0];
    if (file) {
        importSpreadsheetFile(file);
    }
    input.value = '';
}

/* Drag & Drop Global Listener for Gerador */
let dragCounter = 0;

function initGeradorDragAndDrop() {
    window.addEventListener('dragenter', (e) => {
        // Gate: only trigger overlay if we are on the Generator page
        if (!document.getElementById('section-gerador').classList.contains('active')) return;
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
            const overlay = document.getElementById('dragOverlay');
            if (overlay) overlay.classList.add('active');
        }
    });

    window.addEventListener('dragleave', (e) => {
        if (!document.getElementById('section-gerador').classList.contains('active')) return;
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            const overlay = document.getElementById('dragOverlay');
            if (overlay) overlay.classList.remove('active');
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
        if (!document.getElementById('section-gerador').classList.contains('active')) return;
        e.preventDefault();
        dragCounter = 0;
        const overlay = document.getElementById('dragOverlay');
        if (overlay) overlay.classList.remove('active');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const extension = file.name.split('.').pop().toLowerCase();
            if (['xlsx', 'xls', 'ods'].includes(extension)) {
                importSpreadsheetFile(file);
            } else {
                showToast('Formato de arquivo inválido. Use .xlsx, .xls ou .ods', 'error');
            }
        }
    });
}

/* ==========================================================================
   MODULE 2: VALIDADOR DE PLANILHAS LOGIC
   ========================================================================== */

const EXPECTED_COLS = ['firstname','lastname','username','email','course1','group1','role1','idnumber','password'];
const VALID_ROLES = [2,3,4,5,9,10,11,28];
const ROLE_NAMES = {
    2:'Editor Moodle', 3:'Professor Formador', 4:'Tutor à Distância', 5:'Aluno',
    9:'Coordenador de Curso', 10:'Tutor Presencial', 11:'Coordenador de Polo', 28:'Monitor'
};
const DEFAULT_PASSWORD = 'Mud@r123';

let currentExportData = null;
let currentExportFileName = null;

function initValidadorListeners() {
    const zone = document.getElementById('uploadZone');
    const valInput = document.getElementById('fileInput');

    if (!zone || !valInput) return;

    zone.addEventListener('click', () => valInput.click());
    zone.addEventListener('dragover', e => { 
        e.preventDefault(); 
        zone.classList.add('drag-over'); 
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); 
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            processValidadorFile(e.dataTransfer.files[0]);
        }
    });
    valInput.addEventListener('change', () => { 
        if (valInput.files.length) {
            processValidadorFile(valInput.files[0]);
        } 
    });
}

function processValidadorFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv','ods','xlsx','xls'].includes(ext)) {
        showToast('Formato não suportado. Use CSV, ODS ou XLSX.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data;
            if (ext === 'csv') {
                data = parseCSVText(e.target.result);
            } else {
                const bytes = new Uint8Array(e.target.result);
                const wb = XLSX.read(bytes, { type: 'array' });
                const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
                // Ensure all values are strings
                data = raw.map(row => {
                    const obj = {};
                    Object.keys(row).forEach(k => { obj[k] = String(row[k]); });
                    return obj;
                });
            }
            validateValidadorData(data, file.name, ext);
        } catch (err) {
            showToast('Erro ao ler o arquivo: ' + err.message, 'error');
        }
    };
    if (ext === 'csv') reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
}

/* CSV Text Parser (preserves leading zeros) */
function parseCSVText(text) {
    // Remove BOM if present
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const lines = splitCSVLines(text);
    if (lines.length < 2) return [];

    // Auto-detect delimiter
    const firstLine = lines[0];
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const delim = semicolons >= commas ? ';' : ',';

    const headers = parseCSVRow(lines[0], delim).map(h => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVRow(lines[i], delim);
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (values[idx] || '').trim(); });
        data.push(obj);
    }
    return data;
}

function splitCSVLines(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            current += ch;
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
            lines.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) lines.push(current);
    return lines;
}

function parseCSVRow(line, delim) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === delim) { fields.push(current); current = ''; }
            else { current += ch; }
        }
    }
    fields.push(current);
    return fields;
}

/* Validation logic for imported spreadsheet in validator */
function validateValidadorData(rows, fileName, ext) {
    const errors = [];
    const warnings = [];
    let validCount = 0;
    const cellErrors = {}; // { "rowIdx-colName": true }
    const cellDupEmail = {}; // { "rowIdx-email": { lines: [] } }

    if (rows.length === 0) {
        showToast('O arquivo está vazio.', 'error');
        return;
    }

    // Check columns present in file
    const fileCols = Object.keys(rows[0]).map(c => c.trim().toLowerCase());
    const hasCols = new Set(fileCols);
    const missingCols = EXPECTED_COLS.filter(c => !hasCols.has(c));
    const extraCols = fileCols.filter(c => !EXPECTED_COLS.includes(c));

    if (missingCols.length > 0) {
        warnings.push({ row: 0, msg: `Colunas não incluídas (não serão validadas): ${missingCols.join(', ')}` });
    }
    if (extraCols.length > 0) {
        warnings.push({ row: 0, msg: `Colunas extras (serão ignoradas): ${extraCols.join(', ')}` });
    }

    // Normalize column names
    const normalized = rows.map(r => {
        const obj = {};
        Object.keys(r).forEach(k => { obj[k.trim().toLowerCase()] = String(r[k]).trim(); });
        return obj;
    });

    // 1. Duplicate E-mail detection
    const emailIndex = {};
    normalized.forEach((row, idx) => {
        if (row.email) {
            const emailLower = row.email.toLowerCase();
            if (!emailIndex[emailLower]) emailIndex[emailLower] = [];
            emailIndex[emailLower].push(idx);
        }
    });

    const duplicatedEmails = {};
    Object.keys(emailIndex).forEach(email => {
        if (emailIndex[email].length > 1) {
            duplicatedEmails[email] = emailIndex[email];
        }
    });

    // 2. Validate rows
    const usernamesSeen = new Set();

    normalized.forEach((row, idx) => {
        const n = idx + 2; // Row number in sheet (header is row 1)
        let rowOk = true;

        function addErr(col, msg) {
            errors.push({ row: n, msg });
            cellErrors[idx + '-' + col] = true;
            rowOk = false;
        }

        // firstname
        if (hasCols.has('firstname') && !row.firstname) addErr('firstname', 'Nome (firstname) vazio.');

        // lastname
        if (hasCols.has('lastname') && !row.lastname) addErr('lastname', 'Sobrenome (lastname) vazio.');

        // username
        if (hasCols.has('username')) {
            if (!row.username) {
                addErr('username', 'Username vazio.');
            } else {
                if (usernamesSeen.has(row.username.toLowerCase())) {
                    addErr('username', `Username "${row.username}" duplicado.`);
                }
                usernamesSeen.add(row.username.toLowerCase());

                const usernameType = inferIdType(row.username);
                if (usernameType === 'MATRÍCULA') {
                    if (row.username !== row.username.toLowerCase()) {
                        addErr('username', `Username/Matrícula "${row.username}" deve estar em minúscula.`);
                    }
                } else if (usernameType === 'NUMÉRICO_CURTO') {
                    addErr('username', `Username "${row.username}" possui menos de 7 dígitos — possível SIAPE incorreto.`);
                }
            }
        }

        // email duplicate detection
        if (hasCols.has('email')) {
            if (!row.email) {
                addErr('email', 'Email vazio.');
            } else if (!validateEmail(row.email)) {
                addErr('email', `Email "${row.email}" inválido (formato incorreto ou contém acentos/ç).`);
            } else {
                const emailLower = row.email.toLowerCase();
                if (duplicatedEmails[emailLower]) {
                    const otherLines = duplicatedEmails[emailLower]
                        .filter(i => i !== idx)
                        .map(i => i + 2);
                    addErr('email', `Email "${row.email}" duplicado (também na(s) linha(s): ${otherLines.join(', ')}).`);
                    cellDupEmail[idx + '-email'] = otherLines;
                }
            }
        }

        // course1
        if (hasCols.has('course1') && !row.course1) addErr('course1', 'Curso (course1) vazio.');

        // role1
        if (hasCols.has('role1')) {
            if (!row.role1 && row.role1 !== 0) {
                addErr('role1', 'Papel (role1) vazio.');
            } else {
                const roleStr = String(row.role1);
                if (!/\d/.test(roleStr)) {
                    addErr('role1', `Papel "${row.role1}" inválido — não contém dígitos numéricos.`);
                } else {
                    const roleNum = parseInt(roleStr);
                    if (isNaN(roleNum) || !VALID_ROLES.includes(roleNum)) {
                        addErr('role1', `Papel "${row.role1}" inválido. Valores aceitos: ${VALID_ROLES.join(', ')}.`);
                    }
                }
            }
        }

        // idnumber
        if (hasCols.has('idnumber')) {
            if (row.idnumber) {
                const idType = inferIdType(row.idnumber);
                if (idType === 'CPF') {
                    const cleanId = row.idnumber.replace(/[\.\-]/g, '');
                    if (!validateCPF(cleanId)) {
                        addErr('idnumber', `CPF "${row.idnumber}" inválido (dígitos verificadores incorretos).`);
                    }
                } else if (idType === 'MATRÍCULA') {
                    if (row.idnumber !== row.idnumber.toLowerCase()) {
                        addErr('idnumber', `Matrícula "${row.idnumber}" deve estar em minúscula.`);
                    }
                } else if (idType === 'NUMÉRICO_CURTO') {
                    addErr('idnumber', `idnumber "${row.idnumber}" possui menos de 7 dígitos — possível SIAPE incorreto.`);
                }
            } else {
                warnings.push({ row: n, msg: 'idnumber está vazio.' });
            }
        }

        // username must equal idnumber
        if (hasCols.has('username') && hasCols.has('idnumber') && row.username && row.idnumber && row.username !== row.idnumber) {
            addErr('username', `Username "${row.username}" diferente do idnumber "${row.idnumber}". Devem ser iguais.`);
            cellErrors[idx + '-idnumber'] = true;
        }

        // password
        if (hasCols.has('password')) {
            if (!row.password) {
                warnings.push({ row: n, msg: 'Senha (password) vazia.' });
            } else if (row.password !== DEFAULT_PASSWORD) {
                addErr('password', `Senha "${row.password}" diferente do padrão esperado "${DEFAULT_PASSWORD}".`);
            }
        }

        if (rowOk) validCount++;
    });

    renderValidadorResults(normalized, errors, warnings, validCount, fileName, cellErrors, cellDupEmail, ext);
}

/* Render results in Validador view */
function renderValidadorResults(data, errors, warnings, validCount, fileName, cellErrors, cellDupEmail, ext) {
    document.getElementById('uploadCard').style.display = 'none';
    const card = document.getElementById('resultsCard');
    card.style.display = 'block';

    document.getElementById('resultsFile').textContent = `📄 ${fileName} · ${data.length} linha(s)`;

    const errCount = errors.filter(e => e.row > 0).length;
    const warnCount = warnings.filter(w => w.row > 0).length;

    // Summary Cards (inspired by the stats widgets in dashboard of inspiracao.png)
    document.getElementById('summaryRow').innerHTML = `
        <div class="stat-widget-card info">
            <div class="stat-widget-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>
            <div class="stat-widget-content">
                <span class="stat-widget-value">${data.length}</span>
                <span class="stat-widget-label">Total de Linhas</span>
            </div>
        </div>
        <div class="stat-widget-card ok">
            <div class="stat-widget-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            </div>
            <div class="stat-widget-content">
                <span class="stat-widget-value">${validCount}</span>
                <span class="stat-widget-label">Linhas Válidas</span>
            </div>
        </div>
        <div class="stat-widget-card err">
            <div class="stat-widget-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </div>
            <div class="stat-widget-content">
                <span class="stat-widget-value">${data.length - validCount}</span>
                <span class="stat-widget-label">Com Erros</span>
            </div>
        </div>
        <div class="stat-widget-card warn">
            <div class="stat-widget-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
            </div>
            <div class="stat-widget-content">
                <span class="stat-widget-value">${warnCount}</span>
                <span class="stat-widget-label">Avisos</span>
            </div>
        </div>
    `;

    // Render Errors
    const errSection = document.getElementById('errorsSection');
    const errList = document.getElementById('errorsList');
    if (errors.length > 0) {
        errSection.style.display = 'block';
        errList.innerHTML = errors.map(e =>
            `<div class="error-item"><span class="error-row-num">${e.row === 0 ? 'Estrutura' : 'Linha ' + e.row}</span><span>${escapeHtml(e.msg)}</span></div>`
        ).join('');
    } else {
        errSection.style.display = 'none';
    }

    // Render Warnings
    const warnSection = document.getElementById('warningsSection');
    const warnList = document.getElementById('warningsList');
    if (warnings.length > 0) {
        warnSection.style.display = 'block';
        warnList.innerHTML = warnings.map(w =>
            `<div class="warning-item"><span class="warning-row-num">${w.row === 0 ? 'Estrutura' : 'Linha ' + w.row}</span><span>${escapeHtml(w.msg)}</span></div>`
        ).join('');
    } else {
        warnSection.style.display = 'none';
    }

    // Preview Table
    const cols = EXPECTED_COLS.filter(c => {
        const fileCols = Object.keys(data[0] || {}).map(k => k.trim().toLowerCase());
        return fileCols.includes(c);
    });

    const thead = document.getElementById('previewHead');
    thead.innerHTML = `<tr><th>#</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;

    const tbody = document.getElementById('previewBody');
    const maxPreview = Math.min(data.length, 100);
    tbody.innerHTML = data.slice(0, maxPreview).map((row, idx) => {
        const rowNum = idx + 2;
        return `<tr><td class="row-num">${rowNum}</td>${cols.map(c => {
            const val = row[c] || '';
            const isErr = cellErrors[idx + '-' + c];
            const isDupEmail = cellDupEmail[idx + '-' + c];
            let cls = '';
            let extra = '';
            if (isDupEmail) {
                cls = 'cell-dup-email';
                extra = ` data-dup-info="↔ L${isDupEmail.join(',')}"`;
            } else if (isErr) {
                cls = 'cell-error';
            }
            return `<td class="${cls}"${extra}>${escapeHtml(val)}</td>`;
        }).join('')}</tr>`;
    }).join('');
    
    if (data.length > 100) {
        tbody.innerHTML += `<tr><td colspan="${cols.length + 1}" style="text-align:center;color:var(--text-muted);padding:10px;">Mostrando 100 de ${data.length} linhas...</td></tr>`;
    }

    // Colors Legend
    const legendContainer = document.getElementById('legendBar');
    if (legendContainer) {
        const hasDups = Object.keys(cellDupEmail).length > 0;
        const hasErrs = Object.keys(cellErrors).length > 0;
        if (hasDups || hasErrs) {
            let html = '<strong>Legenda:</strong>';
            if (hasErrs) html += '<div class="legend-item"><span class="legend-swatch err-swatch"></span> Erro de validação</div>';
            if (hasDups) html += '<div class="legend-item"><span class="legend-swatch dup-swatch"></span> E-mail duplicado</div>';
            legendContainer.innerHTML = html;
            legendContainer.style.display = 'flex';
        } else {
            legendContainer.style.display = 'none';
        }
    }

    // Customize title color and toast notifications
    const title = document.getElementById('resultsTitle');
    if (errors.length === 0) {
        title.textContent = '✅ Planilha válida!';
        title.style.color = 'var(--success)';
        showToast('Planilha validada sem erros!');
    } else {
        title.textContent = '⚠️ Erros encontrados';
        title.style.color = 'var(--danger)';
        showToast(`${errors.length} erro(s) encontrado(s).`, 'error');
    }

    // Toggle CSV Fixer Downloader Button
    const btnDownload = document.getElementById('btnDownloadCsv');
    if (ext && ext !== 'csv') {
        currentExportData = data;
        currentExportFileName = fileName;
        btnDownload.style.display = 'inline-flex';
    } else {
        btnDownload.style.display = 'none';
        currentExportData = null;
    }

    // Smooth scroll top
    const mainContent = document.querySelector('.app-main-content');
    if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetValidator() {
    document.getElementById('uploadCard').style.display = 'block';
    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('fileInput').value = '';
    
    // Clear active spreadsheet validation cache
    currentExportData = null;
    currentExportFileName = null;

    // Clear rendered DOM results elements
    const summaryRow = document.getElementById('summaryRow');
    if (summaryRow) summaryRow.innerHTML = '';

    const errorsList = document.getElementById('errorsList');
    if (errorsList) errorsList.innerHTML = '';

    const warningsList = document.getElementById('warningsList');
    if (warningsList) warningsList.innerHTML = '';

    const previewHead = document.getElementById('previewHead');
    if (previewHead) previewHead.innerHTML = '';

    const previewBody = document.getElementById('previewBody');
    if (previewBody) previewBody.innerHTML = '';

    const resultsFile = document.getElementById('resultsFile');
    if (resultsFile) resultsFile.textContent = '';

    const errorsSection = document.getElementById('errorsSection');
    if (errorsSection) errorsSection.style.display = 'none';

    const warningsSection = document.getElementById('warningsSection');
    if (warningsSection) warningsSection.style.display = 'none';

    const legendBar = document.getElementById('legendBar');
    if (legendBar) legendBar.style.display = 'none';

    const btnDownloadCsv = document.getElementById('btnDownloadCsv');
    if (btnDownloadCsv) btnDownloadCsv.style.display = 'none';
    
    const mainContent = document.querySelector('.app-main-content');
    if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/* Download validated data as CSV */
function downloadCSV() {
    if (!currentExportData || currentExportData.length === 0) return;

    // Use only the columns that were passed by the user
    const cols = Object.keys(currentExportData[0]);
    const csvRows = [cols];
    
    currentExportData.forEach(row => {
        csvRows.push(cols.map(c => row[c] || ''));
    });
    
    // Convert to semicolon-delimited CSV string
    const csv = csvRows.map(r => r.map(c => {
        const s = String(c);
        return (s.includes(';') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    
    const baseName = currentExportFileName ? currentExportFileName.split('.').slice(0, -1).join('.') : 'exportacao';
    a.download = baseName + '.csv';
    
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    
    showToast('Download do CSV iniciado!');
}
