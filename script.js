// === SUPABASE CONFIG ===
const SUPABASE_URL = 'https://kvvxcwvryrbilkosisdw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dnhjd3ZyeXJiaWxrb3Npc2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjc0NjUsImV4cCI6MjA5NTc0MzQ2NX0.0u-KLkrmx8nb9CTMdPAG140UK1uWTkSqr3U3Q1U-2-Y';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === УПРАВЛЕНИЕ ПАНЕЛЯМИ ===
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

// === УВЕДОМЛЕНИЯ ===
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentUser = null;      // { id, name, login } — из таблицы profiles
let allEvents = [];
let currentCalendarDate = new Date();
let selectedDate = null;

// Pomodoro переменные
let pomodoroTime = 30 * 60;
let pomodoroInterval = null;
let isRunning = false;
let isWorkMode = true;
let completedSessions = 0;
let workTime = 30;
let breakTime = 15;

// =============================================
// === РЕГИСТРАЦИЯ ===
// =============================================
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name  = document.getElementById('regName').value.trim();
    const login = document.getElementById('regLogin').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!name || !login || !password) {
        showNotification('Заполните все поля!', 'error'); return;
    }
    const loginRegex = /^[A-Za-z0-9_]{3,20}$/;
    if (!loginRegex.test(login)) {
        showNotification('Логин: 3-20 символов, только буквы, цифры и _', 'error'); return;
    }
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error'); return;
    }

    // Проверяем уникальность логина
    const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('login', login)
        .maybeSingle();

    if (existing) {
        showNotification('Этот логин уже занят!', 'error'); return;
    }

    // Регистрируем через Supabase Auth (email = login@app.local)
    const fakeEmail = `${login}@calendar-app.local`;
    const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password: password,
    });

    if (error) {
        showNotification('Ошибка регистрации: ' + error.message, 'error'); return;
    }

    // Сохраняем профиль (имя + логин) в таблице profiles
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, name: name, login: login });

    if (profileError) {
        showNotification('Ошибка сохранения профиля: ' + profileError.message, 'error'); return;
    }

    showNotification('Аккаунт успешно создан! Теперь войдите.', 'success');
    this.reset();
    container.classList.remove("right-panel-active");
});

// =============================================
// === ВХОД ===
// =============================================
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const login    = document.getElementById('loginInput').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!login || !password) {
        showNotification('Введите логин и пароль', 'error'); return;
    }

    // Находим email по логину
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, login')
        .eq('login', login)
        .maybeSingle();

    if (profileError || !profile) {
        showNotification('Неверный логин или пароль', 'error'); return;
    }

    const fakeEmail = `${login}@calendar-app.local`;
    const { data, error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: password,
    });

    if (error) {
        showNotification('Неверный логин или пароль', 'error'); return;
    }

    showDashboard(profile);
});

// =============================================
// === ВОССТАНОВЛЕНИЕ ПАРОЛЯ ===
// =============================================
const modal = document.getElementById('resetModal');
const modalContent = document.getElementById('resetModalContent');
const closeBtn = document.getElementsByClassName('close')[0];
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    resetModalContent();
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
        resetModalContent();
    }
});

function resetModalContent() {
    modalContent.innerHTML = `
        <span class="close">&times;</span>
        <h2>Восстановление пароля 🔐</h2>
        <p>Введите ваш логин и новый пароль</p>
        <form id="resetForm">
            <input type="text" id="resetLogin" placeholder="Ваш логин" required />
            <input type="password" id="resetPassword" placeholder="Новый пароль (мин. 6 символов)" required minlength="6" />
            <button type="submit">Сменить пароль</button>
        </form>
    `;
    attachResetFormHandler();
    document.querySelector('#resetModal .close').addEventListener('click', () => {
        modal.style.display = 'none';
        resetModalContent();
    });
}

function attachResetFormHandler() {
    const resetForm = document.getElementById('resetForm');
    if (!resetForm) return;

    resetForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const login       = document.getElementById('resetLogin').value.trim();
        const newPassword = document.getElementById('resetPassword').value;

        if (!login || !newPassword) { showNotification('Заполните все поля', 'error'); return; }
        if (newPassword.length < 6) { showNotification('Пароль должен быть не менее 6 символов', 'error'); return; }

        // Войдём под старым паролем невозможно без него — вместо этого
        // используем Admin API недоступен на клиенте, поэтому делаем через
        // signInWithPassword + updateUser (нужен текущий сеанс).
        // Альтернативный подход: храним хэш пароля в profiles и обновляем через auth.updateUser
        // После signIn пользователя мы можем вызвать updateUser.
        // Но без старого пароля сбросить нельзя из фронтенда без email.
        // Поэтому просим сначала войти, потом поменять пароль.

        showNotification('Для смены пароля войдите в аккаунт и используйте настройки профиля', 'info');
        modal.style.display = 'none';
    });
}

attachResetFormHandler();

// =============================================
// === ЛИЧНЫЙ КАБИНЕТ ===
// =============================================
async function showDashboard(profile) {
    currentUser = profile;

    const splashScreen = document.getElementById('splashScreen');
    splashScreen.classList.remove('hidden');
    document.getElementById('container').style.display = 'none';
    document.body.style.background = 'var(--bg-gradient)';
    document.body.classList.add('dashboard-active');
    document.body.classList.remove('dark-theme');

    const dashboard = document.getElementById('dashboard');
    dashboard.classList.remove('hidden');
    document.getElementById('userName').textContent = profile.name;

    loadTheme();
    await loadEvents();
    loadPomodoroSettings();
    loadPomodoroStats();
    checkUpcomingDeadlines();

    setTimeout(() => {
        splashScreen.classList.add('hidden');
        showNotification(`Добро пожаловать, ${profile.name}!`, 'success');
    }, 2000);
}

// =============================================
// === ВЫХОД ===
// =============================================
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    currentUser = null;

    document.getElementById('splashScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('container').style.display = 'block';
    document.body.classList.remove('dashboard-active');
    document.body.style.background = 'var(--bg-gradient)';
    document.body.style.height = '100vh';
    document.body.style.padding = '0';
    document.body.style.display = 'flex';

    showNotification('Вы успешно вышли', 'info');
});

// =============================================
// === ТЁМНАЯ ТЕМА (остаётся в localStorage — это настройка браузера, не данные) ===
// =============================================
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.textContent = isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = '☀️ Светлая тема';
    }
}

// =============================================
// === ЗАГРУЗКА ДАННЫХ / СТАТИСТИКА ===
// =============================================
function updateStats() {
    document.getElementById('tasksCount').textContent     = allEvents.filter(e => e.type === 'task').length;
    document.getElementById('deadlinesCount').textContent = allEvents.filter(e => e.type === 'deadline').length;
    document.getElementById('examsCount').textContent     = allEvents.filter(e => e.type === 'exam').length;
    document.getElementById('completedCount').textContent = allEvents.filter(e => e.completed).length;
}

// =============================================
// === ЗАГРУЗКА СОБЫТИЙ ИЗ SUPABASE ===
// =============================================
async function loadEvents() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: true });

    if (error) {
        showNotification('Ошибка загрузки событий: ' + error.message, 'error');
        allEvents = [];
    } else {
        allEvents = data || [];
    }

    renderEvents(allEvents);
    updateStats();
    renderCalendar();
}

// =============================================
// === ОТРИСОВКА СОБЫТИЙ ===
// =============================================
function renderEvents(events) {
    const eventsList = document.getElementById('eventsList');
    const noEvents   = document.getElementById('noEvents');
    eventsList.innerHTML = '';

    if (events.length === 0) {
        noEvents.style.display = 'block';
        return;
    }
    noEvents.style.display = 'none';

    const sorted = [...events].sort((a, b) =>
        new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00'))
    );

    const typeLabels     = { task: '📚 Задание', deadline: '⏰ Дедлайн', exam: '📝 Экзамен' };
    const priorityLabels = { high: '🔴 Высокий',  medium: '🟡 Средний',  low: '🟢 Низкий' };

    sorted.forEach(event => {
        const card = document.createElement('div');
        card.className = `event-card ${event.type} priority-${event.priority || 'medium'} ${event.completed ? 'completed' : ''}`;

        const dateObj = new Date(event.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = event.time ? ` в ${event.time}` : '';

        card.innerHTML = `
            <div class="event-info">
                <input type="checkbox" class="event-checkbox" ${event.completed ? 'checked' : ''} onchange="toggleEventComplete('${event.id}')" />
                <div class="event-content">
                    <div class="event-title">
                        ${typeLabels[event.type]}: ${event.title}
                        <span class="event-priority ${event.priority || 'medium'}">${priorityLabels[event.priority || 'medium']}</span>
                    </div>
                    <div class="event-date">📅 ${dateStr}${timeStr}</div>
                    ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                </div>
            </div>
            <div class="event-actions">
                <button class="edit-btn" onclick="editEvent('${event.id}')">✏️ Изменить</button>
                <button class="delete-btn" onclick="deleteEvent('${event.id}')">🗑️ Удалить</button>
            </div>
        `;
        eventsList.appendChild(card);
    });
}

// =============================================
// === ПЕРЕКЛЮЧЕНИЕ СТАТУСА ВЫПОЛНЕНО ===
// =============================================
window.toggleEventComplete = async function(id) {
    const event = allEvents.find(e => e.id === id);
    if (!event) return;

    const newCompleted = !event.completed;

    const { error } = await supabase
        .from('events')
        .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
        .eq('id', id);

    if (error) { showNotification('Ошибка обновления: ' + error.message, 'error'); return; }

    event.completed = newCompleted;
    renderEvents(getFilteredEvents());
    updateStats();
    renderCalendar();

    showNotification(newCompleted ? '✅ Событие выполнено!' : '⏳ Событие возвращено в ожидание',
                     newCompleted ? 'success' : 'info');
};

// =============================================
// === КАЛЕНДАРЬ ===
// =============================================
function renderCalendar() {
    const calendarDays    = document.getElementById('calendarDays');
    const currentMonthYear = document.getElementById('currentMonthYear');
    if (!calendarDays || !currentMonthYear) return;

    calendarDays.innerHTML = '';

    const year  = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                        'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    currentMonthYear.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    let startDay   = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        calendarDays.appendChild(empty);
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayCell    = document.createElement('div');
        dayCell.className = 'calendar-day';

        const currentDate = new Date(year, month, day);
        currentDate.setHours(0,0,0,0);

        if (currentDate.getTime() === today.getTime()) dayCell.classList.add('today');
        if (selectedDate && currentDate.getTime() === selectedDate.getTime()) dayCell.classList.add('selected');

        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayEvents = allEvents.filter(e => e.date === dateStr);

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        if (dayEvents.length > 0) {
            const markers = document.createElement('div');
            markers.className = 'day-markers';
            [...new Set(dayEvents.map(e => e.type))].slice(0,3).forEach(type => {
                const m = document.createElement('div');
                m.className = `day-marker ${type}`;
                markers.appendChild(m);
            });
            dayCell.appendChild(markers);
        }

        dayCell.addEventListener('click', () => {
            document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
            dayCell.classList.add('selected');
            selectedDate = currentDate;
            document.getElementById('filterDate').value = dateStr;
            applyFilters();
        });

        calendarDays.appendChild(dayCell);
    }
}

document.getElementById('prevMonth').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
});

const calendarSection  = document.getElementById('calendarSection');
const toggleCalendarBtn = document.getElementById('toggleCalendarBtn');
if (toggleCalendarBtn) {
    toggleCalendarBtn.addEventListener('click', () => {
        calendarSection.classList.toggle('hidden');
        toggleCalendarBtn.textContent = calendarSection.classList.contains('hidden')
            ? '📅 Показать календарь' : '📅 Скрыть календарь';
        if (!calendarSection.classList.contains('hidden')) renderCalendar();
    });
}

// =============================================
// === ФИЛЬТРАЦИЯ ===
// =============================================
const filterType     = document.getElementById('filterType');
const filterPriority = document.getElementById('filterPriority');
const filterStatus   = document.getElementById('filterStatus');
const filterDate     = document.getElementById('filterDate');
const clearFiltersBtn = document.getElementById('clearFilters');

function getFilteredEvents() {
    let filtered = [...allEvents];
    if (filterType.value !== 'all')     filtered = filtered.filter(e => e.type === filterType.value);
    if (filterPriority.value !== 'all') filtered = filtered.filter(e => e.priority === filterPriority.value);
    if (filterStatus.value === 'completed') filtered = filtered.filter(e => e.completed);
    if (filterStatus.value === 'pending')   filtered = filtered.filter(e => !e.completed);
    if (filterDate.value)               filtered = filtered.filter(e => e.date === filterDate.value);
    return filtered;
}

function applyFilters() { renderEvents(getFilteredEvents()); }

filterType.addEventListener('change', applyFilters);
filterPriority.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);
filterDate.addEventListener('change', applyFilters);

clearFiltersBtn.addEventListener('click', () => {
    filterType.value = 'all'; filterPriority.value = 'all';
    filterStatus.value = 'all'; filterDate.value = '';
    selectedDate = null;
    document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
    applyFilters();
});

// =============================================
// === МОДАЛЬНОЕ ОКНО СОБЫТИЯ ===
// =============================================
const eventModal      = document.getElementById('eventModal');
const closeEventModal = document.getElementById('closeEventModal');
const addEventBtn     = document.getElementById('addEventBtn');
const eventForm       = document.getElementById('eventForm');

addEventBtn.addEventListener('click', () => {
    document.getElementById('eventModalTitle').textContent = 'Добавить событие 📌';
    document.getElementById('eventId').value = '';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventType').value = 'task';
    document.getElementById('eventPriority').value = 'medium';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventTime').value = '';
    document.getElementById('eventDescription').value = '';
    eventModal.style.display = 'block';
});

closeEventModal.addEventListener('click', () => { eventModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === eventModal) eventModal.style.display = 'none'; });

// =============================================
// === СОХРАНЕНИЕ СОБЫТИЯ В SUPABASE ===
// =============================================
eventForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const eventId     = document.getElementById('eventId').value;
    const title       = document.getElementById('eventTitle').value.trim();
    const type        = document.getElementById('eventType').value;
    const priority    = document.getElementById('eventPriority').value;
    const date        = document.getElementById('eventDate').value;
    const time        = document.getElementById('eventTime').value;
    const description = document.getElementById('eventDescription').value.trim();

    if (!title || !date) { showNotification('Заполните название и дату', 'error'); return; }

    if (eventId) {
        // Обновление
        const { error } = await supabase
            .from('events')
            .update({ title, type, priority, date, time, description, updated_at: new Date().toISOString() })
            .eq('id', eventId);

        if (error) { showNotification('Ошибка обновления: ' + error.message, 'error'); return; }

        const idx = allEvents.findIndex(e => e.id === eventId);
        if (idx !== -1) allEvents[idx] = { ...allEvents[idx], title, type, priority, date, time, description };
        showNotification('Событие обновлено!', 'success');

    } else {
        // Создание
        const { data, error } = await supabase
            .from('events')
            .insert({
                user_id: currentUser.id,
                title, type, priority, date,
                time:        time || null,
                description: description || null,
                completed:   false,
            })
            .select()
            .single();

        if (error) { showNotification('Ошибка сохранения: ' + error.message, 'error'); return; }

        allEvents.push(data);
        showNotification('Событие добавлено!', 'success');
    }

    renderEvents(getFilteredEvents());
    updateStats();
    renderCalendar();
    eventModal.style.display = 'none';
});

// =============================================
// === РЕДАКТИРОВАНИЕ СОБЫТИЯ ===
// =============================================
window.editEvent = function(id) {
    const event = allEvents.find(e => e.id === id);
    if (!event) return;

    document.getElementById('eventModalTitle').textContent = 'Изменить событие ✏️';
    document.getElementById('eventId').value          = event.id;
    document.getElementById('eventTitle').value       = event.title;
    document.getElementById('eventType').value        = event.type;
    document.getElementById('eventPriority').value    = event.priority || 'medium';
    document.getElementById('eventDate').value        = event.date;
    document.getElementById('eventTime').value        = event.time || '';
    document.getElementById('eventDescription').value = event.description || '';

    eventModal.style.display = 'block';
};

// =============================================
// === УДАЛЕНИЕ СОБЫТИЯ ===
// =============================================
const deleteModal      = document.getElementById('deleteModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn  = document.getElementById('cancelDelete');

window.deleteEvent = function(id) {
    document.getElementById('deleteEventId').value = id;
    deleteModal.style.display = 'block';
};

closeDeleteModal.addEventListener('click', () => { deleteModal.style.display = 'none'; });
cancelDeleteBtn.addEventListener('click',  () => { deleteModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });

confirmDeleteBtn.addEventListener('click', async () => {
    const eventId = document.getElementById('deleteEventId').value;

    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) { showNotification('Ошибка удаления: ' + error.message, 'error'); return; }

    allEvents = allEvents.filter(e => e.id !== eventId);
    renderEvents(getFilteredEvents());
    updateStats();
    renderCalendar();
    deleteModal.style.display = 'none';
    showNotification('Событие удалено!', 'success');
});

// =============================================
// === POMODORO ===
// =============================================
const pomodoroModal      = document.getElementById('pomodoroModal');
const openPomodoroBtn    = document.getElementById('openPomodoro');
const closePomodoroModal = document.getElementById('closePomodoroModal');
const pomodoroTimeDisplay = document.getElementById('pomodoroTime');
const pomodoroStatus     = document.getElementById('pomodoroStatus');
const startPomodoroBtn   = document.getElementById('startPomodoro');
const pausePomodoroBtn   = document.getElementById('pausePomodoro');
const resetPomodoroBtn   = document.getElementById('resetPomodoro');
const workModeBtn        = document.getElementById('workMode');
const breakModeBtn       = document.getElementById('breakMode');
const completedSessionsDisplay = document.getElementById('completedSessions');
const workTimeSelect     = document.getElementById('workTimeSelect');
const breakTimeSelect    = document.getElementById('breakTimeSelect');
const savePomodoroSettingsBtn  = document.getElementById('savePomodoroSettings');

openPomodoroBtn.addEventListener('click', () => {
    pomodoroModal.style.display = 'block';
    loadPomodoroSettings();
    loadPomodoroStats();
});

closePomodoroModal.addEventListener('click', () => {
    pomodoroModal.style.display = 'none';
    pausePomodoro();
});

window.addEventListener('click', (e) => {
    if (e.target === pomodoroModal) { pomodoroModal.style.display = 'none'; pausePomodoro(); }
});

// Pomodoro настройки — остаются в localStorage (это настройки UI, не данные)
function loadPomodoroSettings() {
    if (!currentUser) return;
    const sw = localStorage.getItem(`pomodoro_work_${currentUser.id}`);
    const sb = localStorage.getItem(`pomodoro_break_${currentUser.id}`);
    if (sw) { workTime = parseInt(sw); workTimeSelect.value = workTime; }
    if (sb) { breakTime = parseInt(sb); breakTimeSelect.value = breakTime; }
    resetPomodoro();
}

savePomodoroSettingsBtn.addEventListener('click', () => {
    workTime  = parseInt(workTimeSelect.value);
    breakTime = parseInt(breakTimeSelect.value);
    localStorage.setItem(`pomodoro_work_${currentUser.id}`, workTime);
    localStorage.setItem(`pomodoro_break_${currentUser.id}`, breakTime);
    resetPomodoro();
    showNotification('⚙️ Настройки Pomodoro сохранены!', 'success');
});

function updatePomodoroDisplay() {
    const m = Math.floor(pomodoroTime / 60);
    const s = pomodoroTime % 60;
    pomodoroTimeDisplay.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startPomodoro() {
    if (isRunning) return;
    isRunning = true;
    pomodoroInterval = setInterval(() => {
        if (pomodoroTime > 0) { pomodoroTime--; updatePomodoroDisplay(); }
        else completePomodoro();
    }, 1000);
}

function pausePomodoro() {
    isRunning = false;
    if (pomodoroInterval) { clearInterval(pomodoroInterval); pomodoroInterval = null; }
}

function resetPomodoro() {
    pausePomodoro();
    pomodoroTime = isWorkMode ? workTime * 60 : breakTime * 60;
    updatePomodoroDisplay();
}

function completePomodoro() {
    pausePomodoro();
    if (isWorkMode) {
        completedSessions++;
        savePomodoroStats();
        showNotification('🎉 Сессия завершена! Время перерыва!', 'success');
        switchToBreakMode();
    } else {
        showNotification('☕ Перерыв окончен! Время работать!', 'info');
        switchToWorkMode();
    }
}

function switchToWorkMode() {
    isWorkMode = true;
    pomodoroTime = workTime * 60;
    pomodoroStatus.textContent = 'Время учиться!';
    workModeBtn.classList.add('active');
    breakModeBtn.classList.remove('active');
    updatePomodoroDisplay();
}

function switchToBreakMode() {
    isWorkMode = false;
    pomodoroTime = breakTime * 60;
    pomodoroStatus.textContent = 'Время отдыха!';
    workModeBtn.classList.remove('active');
    breakModeBtn.classList.add('active');
    updatePomodoroDisplay();
}

startPomodoroBtn.addEventListener('click', startPomodoro);
pausePomodoroBtn.addEventListener('click', pausePomodoro);
resetPomodoroBtn.addEventListener('click', resetPomodoro);
workModeBtn.addEventListener('click',  switchToWorkMode);
breakModeBtn.addEventListener('click', switchToBreakMode);

function savePomodoroStats() {
    if (!currentUser) return;
    localStorage.setItem(`pomodoro_sessions_${currentUser.id}`, completedSessions.toString());
}
function loadPomodoroStats() {
    if (!currentUser) return;
    completedSessions = parseInt(localStorage.getItem(`pomodoro_sessions_${currentUser.id}`)) || 0;
    completedSessionsDisplay.textContent = completedSessions;
}

// =============================================
// === УВЕДОМЛЕНИЯ О ДЕДЛАЙНАХ ===
// =============================================
function checkUpcomingDeadlines() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const upcoming = allEvents.filter(e => {
        if (e.type !== 'deadline' || e.completed) return false;
        const eventDate = new Date(e.date + 'T00:00:00');
        const diff = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 3;
    });

    if (upcoming.length > 0) {
        showNotification(`⚠️ Скоро дедлайны: ${upcoming.map(e => e.title).join(', ')}`, 'warning');
    }
}

// =============================================
// === ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ ===
// =============================================
window.addEventListener('load', async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // Получаем профиль пользователя
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, login')
            .eq('id', session.user.id)
            .single();

        if (profile) showDashboard(profile);
    }
});