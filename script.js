// === УПРАВЛЕНИЕ ПАНЕЛЯМИ ===
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
    vibrate(50);
});

signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
    vibrate(50);
});

// === ВИБРООТКЛИК ===
function vibrate(duration = 50) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

// === УВЕДОМЛЕНИЯ ===
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    vibrate(100);
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentUser = null;
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

// PWA переменные
let deferredPrompt = null;

// === РЕГИСТРАЦИЯ ===
document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    vibrate(50);
    
    const name = document.getElementById('regName').value.trim();
    const login = document.getElementById('regLogin').value.trim();
    const password = document.getElementById('regPassword').value;
    
    if (!name || !login || !password) {
        showNotification('Заполните все поля!', 'error');
        return;
    }
    
    const loginRegex = /^[A-Za-z0-9_]{3,20}$/;
    if (!loginRegex.test(login)) {
        showNotification('Логин: 3-20 символов, только буквы, цифры и _', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    let users = JSON.parse(localStorage.getItem('users')) || [];
    
    if (users.find(user => user.login === login)) {
        showNotification('Этот логин уже занят!', 'error');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        name: name,
        login: login,
        password: password,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    showNotification('Аккаунт успешно создан! Теперь войдите.', 'success');
    
    this.reset();
    container.classList.remove("right-panel-active");
});

// === ВХОД ===
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    vibrate(50);
    
    const login = document.getElementById('loginInput').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!login || !password) {
        showNotification('Введите логин и пароль', 'error');
        return;
    }
    
    let users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.login === login && u.password === password);
    
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        setTimeout(() => {
            showDashboard(user);
        }, 500);
    } else {
        showNotification('Неверный логин или пароль', 'error');
    }
});

// === ВОССТАНОВЛЕНИЕ ПАРОЛЯ ===
const modal = document.getElementById('resetModal');
const modalContent = document.getElementById('resetModalContent');
const closeBtn = document.getElementsByClassName('close')[0];
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    vibrate(50);
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
    if (resetForm) {
        resetForm.addEventListener('submit', function(e) {
            e.preventDefault();
            vibrate(50);
            
            const login = document.getElementById('resetLogin').value.trim();
            const newPassword = document.getElementById('resetPassword').value;
            
            if (!login || !newPassword) {
                showNotification('Заполните все поля', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showNotification('Пароль должен быть не менее 6 символов', 'error');
                return;
            }
            
            let users = JSON.parse(localStorage.getItem('users')) || [];
            const user = users.find(u => u.login === login);
            
            if (user) {
                user.password = newPassword;
                const userIndex = users.findIndex(u => u.login === login);
                users[userIndex] = user;
                localStorage.setItem('users', JSON.stringify(users));
                
                modalContent.innerHTML = `
                    <span class="close">&times;</span>
                    <h2>✅ Пароль изменён!</h2>
                    <p>Теперь вы можете войти с новым паролем</p>
                    <button onclick="location.reload()">Хорошо, войти</button>
                `;
                
                document.querySelector('#resetModal .close').onclick = () => {
                    modal.style.display = 'none';
                    location.reload();
                };
                
            } else {
                showNotification('Пользователь с таким логином не найден', 'error');
            }
        });
    }
}

attachResetFormHandler();

// === ЛИЧНЫЙ КАБИНЕТ ===
function showDashboard(user) {
    currentUser = user;
    
    const splashScreen = document.getElementById('splashScreen');
    splashScreen.classList.remove('hidden');
    
    document.getElementById('container').style.display = 'none';
    
    document.body.style.background = 'var(--bg-gradient)';
    document.body.classList.add('dashboard-active');
    document.body.classList.remove('dark-theme');
    
    const dashboard = document.getElementById('dashboard');
    dashboard.classList.remove('hidden');
    
    document.getElementById('userName').textContent = user.name;
    
    loadTheme();
    loadEvents();
    loadUserData(user.id);
    loadPomodoroSettings();
    loadPomodoroStats();
    checkUpcomingDeadlines();
    setupMobileNav();
    
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        showNotification(`Добро пожаловать, ${user.name}!`, 'success');
    }, 2000);
}

// === ВЫХОД ===
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    currentUser = null;
    vibrate(100);
    
    const splashScreen = document.getElementById('splashScreen');
    if (splashScreen) {
        splashScreen.classList.add('hidden');
    }
    
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('container').style.display = 'block';
    document.body.classList.remove('dashboard-active');
    document.body.style.background = 'var(--bg-gradient)';
    document.body.style.height = '100vh';
    document.body.style.padding = '0';
    document.body.style.display = 'flex';
    
    showNotification('Вы успешно вышли', 'info');
});

// === ТЁМНАЯ ТЕМА ===
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    vibrate(30);
});

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = '☀️';
    }
}

// === НИЖНЯЯ НАВИГАЦИЯ ===
function setupMobileNav() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            vibrate(30);
            
            // Убираем активный класс у всех
            navItems.forEach(nav => nav.classList.remove('active'));
            // Добавляем текущему
            item.classList.add('active');
            
            const action = item.dataset.action;
            
            switch(action) {
                case 'home':
                    // Главная - ничего не делаем
                    break;
                case 'calendar':
                    // Показать календарь
                    const calendarSection = document.getElementById('calendarSection');
                    if (calendarSection.classList.contains('hidden')) {
                        calendarSection.classList.remove('hidden');
                        document.getElementById('toggleCalendarBtn').textContent = '📅 Скрыть';
                        renderCalendar();
                    }
                    calendarSection.scrollIntoView({ behavior: 'smooth' });
                    break;
                case 'add':
                    // Добавить событие
                    document.getElementById('addEventBtn').click();
                    break;
                case 'pomodoro':
                    // Открыть Pomodoro
                    document.getElementById('openPomodoro').click();
                    break;
                case 'profile':
                    // Профиль - скролл к началу
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    break;
            }
        });
    });
}

// === ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ ===
function loadUserData(userId) {
    const userTasks = allEvents.filter(e => e.type === 'task');
    const userDeadlines = allEvents.filter(e => e.type === 'deadline');
    const userExams = allEvents.filter(e => e.type === 'exam');
    const completedEvents = allEvents.filter(e => e.completed);
    
    document.getElementById('tasksCount').textContent = userTasks.length;
    document.getElementById('deadlinesCount').textContent = userDeadlines.length;
    document.getElementById('examsCount').textContent = userExams.length;
    document.getElementById('completedCount').textContent = completedEvents.length;
}

// === ЗАГРУЗКА СОБЫТИЙ ===
function loadEvents() {
    if (!currentUser) return;
    
    allEvents = JSON.parse(localStorage.getItem(`events_${currentUser.id}`)) || [];
    renderEvents(allEvents);
    loadUserData(currentUser.id);
    renderCalendar();
}

// === ОТРИСОВКА СОБЫТИЙ ===
function renderEvents(events) {
    const eventsList = document.getElementById('eventsList');
    const noEvents = document.getElementById('noEvents');
    
    eventsList.innerHTML = '';
    
    if (events.length === 0) {
        noEvents.style.display = 'block';
        return;
    }
    
    noEvents.style.display = 'none';
    
    events.sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')));
    
    events.forEach(event => {
        const card = document.createElement('div');
        card.className = `event-card ${event.type} priority-${event.priority || 'medium'} ${event.completed ? 'completed' : ''}`;
        
        const typeLabels = {
            task: '📚 Задание',
            deadline: '⏰ Дедлайн',
            exam: '📝 Экзамен'
        };
        
        const priorityLabels = {
            high: '🔴 Высокий',
            medium: '🟡 Средний',
            low: '🟢 Низкий'
        };
        
        const dateObj = new Date(event.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        
        const timeStr = event.time ? ` в ${event.time}` : '';
        
        card.innerHTML = `
            <div class="event-info">
                <input type="checkbox" class="event-checkbox" ${event.completed ? 'checked' : ''} onchange="toggleEventComplete(${event.id})" />
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
                <button class="edit-btn" onclick="editEvent(${event.id})">✏️</button>
                <button class="delete-btn" onclick="deleteEvent(${event.id})">🗑️</button>
            </div>
        `;
        
        eventsList.appendChild(card);
    });
}

// === ПЕРЕКЛЮЧЕНИЕ СТАТУСА ВЫПОЛНЕНО ===
window.toggleEventComplete = function(id) {
    const eventIndex = allEvents.findIndex(e => e.id === id);
    if (eventIndex !== -1) {
        allEvents[eventIndex].completed = !allEvents[eventIndex].completed;
        allEvents[eventIndex].completedAt = allEvents[eventIndex].completed ? new Date().toISOString() : null;
        saveEvents();
        renderEvents(getFilteredEvents());
        loadUserData(currentUser.id);
        renderCalendar();
        vibrate(50);
        
        if (allEvents[eventIndex].completed) {
            showNotification('✅ Событие выполнено!', 'success');
        } else {
            showNotification('⏳ Событие возвращено в ожидание', 'info');
        }
    }
};

// === КАЛЕНДАРЬ ===
function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    const currentMonthYear = document.getElementById('currentMonthYear');
    
    if (!calendarDays || !currentMonthYear) return;
    
    calendarDays.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    
    currentMonthYear.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    for (let i = 0; i < startDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarDays.appendChild(emptyCell);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);
        
        if (currentDate.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }
        
        if (selectedDate && currentDate.getTime() === selectedDate.getTime()) {
            dayCell.classList.add('selected');
        }
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayEvents = allEvents.filter(e => e.date === dateStr);
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);
        
        if (dayEvents.length > 0) {
            const markers = document.createElement('div');
            markers.className = 'day-markers';
            
            const types = [...new Set(dayEvents.map(e => e.type))];
            types.slice(0, 3).forEach(type => {
                const marker = document.createElement('div');
                marker.className = `day-marker ${type}`;
                markers.appendChild(marker);
            });
            
            dayCell.appendChild(markers);
        }
        
        dayCell.addEventListener('click', () => {
            document.querySelectorAll('.calendar-day.selected').forEach(d => {
                d.classList.remove('selected');
            });
            
            dayCell.classList.add('selected');
            selectedDate = currentDate;
            
            document.getElementById('filterDate').value = dateStr;
            applyFilters();
            vibrate(30);
        });
        
        calendarDays.appendChild(dayCell);
    }
}

// === НАВИГАЦИЯ КАЛЕНДАРЯ ===
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
        vibrate(30);
    });
}

if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
        vibrate(30);
    });
}

// === ПЕРЕКЛЮЧЕНИЕ КАЛЕНДАРЯ ===
const calendarSection = document.getElementById('calendarSection');
const toggleCalendarBtn = document.getElementById('toggleCalendarBtn');

if (toggleCalendarBtn) {
    toggleCalendarBtn.addEventListener('click', () => {
        if (calendarSection) {
            calendarSection.classList.toggle('hidden');
            
            if (calendarSection.classList.contains('hidden')) {
                toggleCalendarBtn.textContent = '📅 Календарь';
            } else {
                toggleCalendarBtn.textContent = '📅 Скрыть';
                renderCalendar();
            }
            vibrate(30);
        }
    });
}

// === ФИЛЬТРАЦИЯ ===
const filterType = document.getElementById('filterType');
const filterPriority = document.getElementById('filterPriority');
const filterStatus = document.getElementById('filterStatus');
const filterDate = document.getElementById('filterDate');
const clearFiltersBtn = document.getElementById('clearFilters');

function getFilteredEvents() {
    let filtered = [...allEvents];
    
    if (filterType && filterType.value !== 'all') {
        filtered = filtered.filter(e => e.type === filterType.value);
    }
    
    if (filterPriority && filterPriority.value !== 'all') {
        filtered = filtered.filter(e => e.priority === filterPriority.value);
    }
    
    if (filterStatus && filterStatus.value !== 'all') {
        if (filterStatus.value === 'completed') {
            filtered = filtered.filter(e => e.completed);
        } else {
            filtered = filtered.filter(e => !e.completed);
        }
    }
    
    if (filterDate && filterDate.value) {
        filtered = filtered.filter(e => e.date === filterDate.value);
    }
    
    return filtered;
}

function applyFilters() {
    const filtered = getFilteredEvents();
    renderEvents(filtered);
}

if (filterType) filterType.addEventListener('change', applyFilters);
if (filterPriority) filterPriority.addEventListener('change', applyFilters);
if (filterStatus) filterStatus.addEventListener('change', applyFilters);
if (filterDate) filterDate.addEventListener('change', applyFilters);

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        if (filterType) filterType.value = 'all';
        if (filterPriority) filterPriority.value = 'all';
        if (filterStatus) filterStatus.value = 'all';
        if (filterDate) filterDate.value = '';
        selectedDate = null;
        document.querySelectorAll('.calendar-day.selected').forEach(d => {
            d.classList.remove('selected');
        });
        applyFilters();
        vibrate(30);
    });
}

// === МОДАЛЬНОЕ ОКНО СОБЫТИЯ ===
const eventModal = document.getElementById('eventModal');
const closeEventModal = document.getElementById('closeEventModal');
const addEventBtn = document.getElementById('addEventBtn');
const eventForm = document.getElementById('eventForm');

if (addEventBtn) {
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
        vibrate(30);
    });
}

if (closeEventModal) {
    closeEventModal.addEventListener('click', () => {
        eventModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === eventModal) {
        eventModal.style.display = 'none';
    }
});

// === СОХРАНЕНИЕ СОБЫТИЯ ===
if (eventForm) {
    eventForm.addEventListener('submit', function(e) {
        e.preventDefault();
        vibrate(50);
        
        const eventId = document.getElementById('eventId').value;
        const title = document.getElementById('eventTitle').value.trim();
        const type = document.getElementById('eventType').value;
        const priority = document.getElementById('eventPriority').value;
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const description = document.getElementById('eventDescription').value.trim();
        
        if (!title || !date) {
            showNotification('Заполните название и дату', 'error');
            return;
        }
        
        if (eventId) {
            const eventIndex = allEvents.findIndex(e => e.id == eventId);
            if (eventIndex !== -1) {
                allEvents[eventIndex] = {
                    ...allEvents[eventIndex],
                    title,
                    type,
                    priority,
                    date,
                    time,
                    description,
                    updatedAt: new Date().toISOString()
                };
                showNotification('Событие обновлено!', 'success');
            }
        } else {
            const newEvent = {
                id: Date.now(),
                userId: currentUser.id,
                title,
                type,
                priority,
                date,
                time,
                description,
                completed: false,
                createdAt: new Date().toISOString()
            };
            allEvents.push(newEvent);
            showNotification('Событие добавлено!', 'success');
        }
        
        saveEvents();
        renderEvents(getFilteredEvents());
        loadUserData(currentUser.id);
        renderCalendar();
        eventModal.style.display = 'none';
    });
}

// === СОХРАНЕНИЕ СОБЫТИЙ В LOCALSTORAGE ===
function saveEvents() {
    if (!currentUser) return;
    localStorage.setItem(`events_${currentUser.id}`, JSON.stringify(allEvents));
}

// === РЕДАКТИРОВАНИЕ СОБЫТИЯ ===
window.editEvent = function(id) {
    const event = allEvents.find(e => e.id === id);
    if (!event) return;
    
    document.getElementById('eventModalTitle').textContent = 'Изменить событие ✏️';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventPriority').value = event.priority || 'medium';
    document.getElementById('eventDate').value = event.date;
    document.getElementById('eventTime').value = event.time || '';
    document.getElementById('eventDescription').value = event.description || '';
    
    eventModal.style.display = 'block';
    vibrate(30);
};

// === УДАЛЕНИЕ СОБЫТИЯ ===
const deleteModal = document.getElementById('deleteModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');

window.deleteEvent = function(id) {
    document.getElementById('deleteEventId').value = id;
    deleteModal.style.display = 'block';
    vibrate(30);
};

if (closeDeleteModal) {
    closeDeleteModal.addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });
}

if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.style.display = 'none';
    });
}

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {
        const eventId = document.getElementById('deleteEventId').value;
        allEvents = allEvents.filter(e => e.id != eventId);
        saveEvents();
        renderEvents(getFilteredEvents());
        loadUserData(currentUser.id);
        renderCalendar();
        deleteModal.style.display = 'none';
        showNotification('Событие удалено!', 'success');
        vibrate(100);
    });
}

window.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.style.display = 'none';
    }
});

// === POMODORO ТАЙМЕР ===
const pomodoroModal = document.getElementById('pomodoroModal');
const openPomodoroBtn = document.getElementById('openPomodoro');
const closePomodoroModal = document.getElementById('closePomodoroModal');
const pomodoroTimeDisplay = document.getElementById('pomodoroTime');
const pomodoroStatus = document.getElementById('pomodoroStatus');
const startPomodoroBtn = document.getElementById('startPomodoro');
const pausePomodoroBtn = document.getElementById('pausePomodoro');
const resetPomodoroBtn = document.getElementById('resetPomodoro');
const workModeBtn = document.getElementById('workMode');
const breakModeBtn = document.getElementById('breakMode');
const completedSessionsDisplay = document.getElementById('completedSessions');
const workTimeSelect = document.getElementById('workTimeSelect');
const breakTimeSelect = document.getElementById('breakTimeSelect');
const savePomodoroSettingsBtn = document.getElementById('savePomodoroSettings');

if (openPomodoroBtn) {
    openPomodoroBtn.addEventListener('click', () => {
        pomodoroModal.style.display = 'block';
        loadPomodoroSettings();
        loadPomodoroStats();
        vibrate(30);
    });
}

if (closePomodoroModal) {
    closePomodoroModal.addEventListener('click', () => {
        pomodoroModal.style.display = 'none';
        pausePomodoro();
    });
}

window.addEventListener('click', (e) => {
    if (e.target === pomodoroModal) {
        pomodoroModal.style.display = 'none';
        pausePomodoro();
    }
});

// === НАСТРОЙКИ POMODORO ===
function loadPomodoroSettings() {
    if (!currentUser) return;
    
    const savedWorkTime = localStorage.getItem(`pomodoro_work_${currentUser.id}`);
    const savedBreakTime = localStorage.getItem(`pomodoro_break_${currentUser.id}`);
    
    if (savedWorkTime) {
        workTime = parseInt(savedWorkTime);
        workTimeSelect.value = workTime;
    }
    
    if (savedBreakTime) {
        breakTime = parseInt(savedBreakTime);
        breakTimeSelect.value = breakTime;
    }
    
    resetPomodoro();
}

if (savePomodoroSettingsBtn) {
    savePomodoroSettingsBtn.addEventListener('click', () => {
        workTime = parseInt(workTimeSelect.value);
        breakTime = parseInt(breakTimeSelect.value);
        
        localStorage.setItem(`pomodoro_work_${currentUser.id}`, workTime);
        localStorage.setItem(`pomodoro_break_${currentUser.id}`, breakTime);
        
        resetPomodoro();
        showNotification('⚙️ Настройки Pomodoro сохранены!', 'success');
        vibrate(100);
    });
}

function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroTime / 60);
    const seconds = pomodoroTime % 60;
    pomodoroTimeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startPomodoro() {
    if (isRunning) return;
    
    isRunning = true;
    pomodoroInterval = setInterval(() => {
        if (pomodoroTime > 0) {
            pomodoroTime--;
            updatePomodoroDisplay();
        } else {
            completePomodoro();
        }
    }, 1000);
}

function pausePomodoro() {
    isRunning = false;
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
}

function resetPomodoro() {
    pausePomodoro();
    pomodoroTime = isWorkMode ? workTime * 60 : breakTime * 60;
    updatePomodoroDisplay();
}

function completePomodoro() {
    pausePomodoro();
    vibrate([100, 50, 100, 50, 200]);
    
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

if (startPomodoroBtn) {
    startPomodoroBtn.addEventListener('click', startPomodoro);
}

if (pausePomodoroBtn) {
    pausePomodoroBtn.addEventListener('click', pausePomodoro);
}

if (resetPomodoroBtn) {
    resetPomodoroBtn.addEventListener('click', resetPomodoro);
}

if (workModeBtn) {
    workModeBtn.addEventListener('click', switchToWorkMode);
}

if (breakModeBtn) {
    breakModeBtn.addEventListener('click', switchToBreakMode);
}

function savePomodoroStats() {
    if (!currentUser) return;
    localStorage.setItem(`pomodoro_sessions_${currentUser.id}`, completedSessions.toString());
}

function loadPomodoroStats() {
    if (!currentUser) return;
    completedSessions = parseInt(localStorage.getItem(`pomodoro_sessions_${currentUser.id}`)) || 0;
    completedSessionsDisplay.textContent = completedSessions;
}

// === УВЕДОМЛЕНИЯ О ДЕДЛАЙНАХ ===
function checkUpcomingDeadlines() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingDeadlines = allEvents.filter(e => {
        if (e.type !== 'deadline') return false;
        const eventDate = new Date(e.date + 'T00:00:00');
        const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
    });
    
    if (upcomingDeadlines.length > 0) {
        const names = upcomingDeadlines.map(e => e.title).join(', ');
        showNotification(`⚠️ Скоро дедлайны: ${names}`, 'warning');
    }
}

// === PWA INSTALL PROMPT ===
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
        installPrompt.classList.remove('hidden');
    }
});

const installBtn = document.getElementById('installBtn');
const dismissInstall = document.getElementById('dismissInstall');

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                showNotification('🎉 Приложение установлено!', 'success');
            }
            deferredPrompt = null;
        }
        document.getElementById('installPrompt').classList.add('hidden');
    });
}

if (dismissInstall) {
    dismissInstall.addEventListener('click', () => {
        document.getElementById('installPrompt').classList.add('hidden');
    });
}

// === ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ ===
window.addEventListener('load', () => {
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (savedUser) {
        showDashboard(savedUser);
    }
});